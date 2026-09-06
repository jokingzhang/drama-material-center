#!/usr/bin/env node

// Author-neutral, read-only structural checks. This never invokes a creative model.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const referencePattern = /\{\{Mixed\s+\d+\}\}|@图片\d+|<Subject\s+\d+>|\{\{Node\s+[^{}\n]+\}\}/gi;
const close = (left, right) => Math.abs(left - right) < 0.000_001;

export function validateShotBlockPrompt(output, contract) {
  const errors = [];
  const duration = Number(contract?.durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) errors.push("durationSeconds must be positive");
  const ratio = contract?.aspectRatio;
  if (typeof ratio !== "string" || !/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(ratio)
    || ratio.split(":").some((part) => Number(part) <= 0)) {
    errors.push("aspectRatio must be a positive ratio");
  }
  if (/〖(?:风格|空间与轴线|时间轴|声音|参考|禁止)〗/.test(output)) {
    errors.push("legacy five-section prompts are not valid video-shot-prompt-v2 output");
  }
  if (/^#\s*(?:DRAFT|READY|NEEDS_REVISION|BLOCKED)｜/m.test(output)) {
    errors.push("status/version metadata belongs outside the model body");
  }
  const globalHeading = "【全局美学设定】";
  const actionHeading = "正文：分镜执行动作";
  const globalStart = output.indexOf(globalHeading);
  const actionStart = output.indexOf(actionHeading);
  if (globalStart < 0 || output.indexOf(globalHeading, globalStart + 1) !== -1) {
    errors.push("exactly one 【全局美学设定】 is required");
  }
  if (actionStart < globalStart || actionStart < 0) errors.push("正文：分镜执行动作 must follow global aesthetics");
  const global = output.slice(Math.max(globalStart, 0), Math.max(actionStart, 0));
  for (const field of ["画幅", "影调", "摄影", "地点"]) {
    if (!new RegExp(`^${field}：[^\\S\\r\\n]*\\S[^\\r\\n]*$`, "m").test(global)) {
      errors.push(`global aesthetics require a nonempty ${field}： line`);
    }
  }
  const actualRatio = global.match(/^画幅：[ \t]*(\d+(?:\.\d+)?:\d+(?:\.\d+)?)/m)?.[1];
  if (actualRatio !== ratio) errors.push(`画幅 must start with the contracted ratio ${ratio}`);

  const shotPattern = /^镜头(\d+)｜(\d{2,}):([0-5]\d(?:\.\d+)?)—(\d{2,}):([0-5]\d(?:\.\d+)?)｜(\d+(?:\.\d+)?)秒[ \t]*\r?$/gm;
  const shots = [...output.matchAll(shotPattern)].map((match) => ({
    index: match.index,
    headingEnd: match.index + match[0].length,
    number: Number(match[1]),
    start: Number(match[2]) * 60 + Number(match[3]),
    end: Number(match[4]) * 60 + Number(match[5]),
    printedDuration: Number(match[6]),
  }));
  const declaredShots = [...output.matchAll(/^镜头\d+[^\r\n]*/gm)];
  if (shots.length !== declaredShots.length) errors.push("malformed shot header; use 镜头N｜MM:SS.d—MM:SS.d｜X秒");
  if (shots.length < 2) errors.push("at least two timed shot blocks are required; inline beat times do not count as shots");
  if (shots.length && shots[0].index < actionStart) errors.push("shot blocks must follow 正文：分镜执行动作");
  if (shots.length && !close(shots[0].start, 0)) errors.push("generation-unit timeline must start at 00:00.0");
  shots.forEach((shot, index) => {
    if (shot.number < 1 || (index > 0 && shot.number <= shots[index - 1].number)) {
      errors.push(`shot numbers must be positive and increase: ${shot.number}`);
    }
    if (shot.end <= shot.start || !close(shot.end - shot.start, shot.printedDuration)) {
      errors.push(`shot ${shot.number} printed duration must equal its positive interval`);
    }
    if (index > 0 && !close(shot.start, shots[index - 1].end)) {
      errors.push(`shot ${shot.number} must touch the previous shot without a gap or overlap`);
    }
    const body = output.slice(shot.headingEnd, shots[index + 1]?.index ?? output.length);
    const position = (field) => body.search(new RegExp(`^${field}：[^\\S\\r\\n]*\\S[^\\r\\n]*$`, "m"));
    const camera = position("相机");
    const combined = position("构图[／/、]运镜");
    const composition = combined >= 0 ? combined : position("构图");
    const motion = combined >= 0 ? combined : position("运镜");
    const picture = position("画面");
    if (camera < 0 || composition < camera || motion < composition || picture <= motion) {
      errors.push(`shot ${shot.number} requires ordered 相机, 构图／运镜 (or split fields), 画面 with content`);
    }
  });
  if (shots.length && !close(shots.at(-1).end, duration)) errors.push(`timeline must end at ${duration}s`);

  const unresolved = [...output.matchAll(/<([^>\n]+)>/g)]
    .map((match) => match[0]).filter((token) => !/^<Subject\s+\d+>$/i.test(token));
  if (unresolved.length) errors.push(`unresolved template instructions: ${[...new Set(unresolved)].join(", ")}`);

  const assets = contract?.referencePlan?.assets;
  if (!Array.isArray(assets)) {
    errors.push("referencePlan.assets is required; an empty array explicitly declares no references");
    return errors;
  }
  const occurrences = [...output.matchAll(referencePattern)];
  const planned = new Set();
  for (const asset of assets) {
    if (typeof asset?.reference !== "string" || typeof asset?.subject !== "string" || !asset.subject.trim()) {
      errors.push("each reference requires a token and a nonempty subject");
      continue;
    }
    const tokens = [...asset.reference.matchAll(referencePattern)];
    if (tokens.length !== 1 || tokens[0][0] !== asset.reference) errors.push(`invalid reference token: ${asset.reference}`);
    if (planned.has(asset.reference)) errors.push(`duplicate planned reference: ${asset.reference}`);
    planned.add(asset.reference);
    const matching = occurrences.map((match, index) => ({ match, index }))
      .filter(({ match }) => match[0] === asset.reference);
    if (!matching.length) {
      errors.push(`missing planned reference: ${asset.reference}`);
      continue;
    }
    const associated = matching.some(({ match, index }) => {
      const previous = occurrences[index - 1];
      const left = output.slice(previous ? previous.index + previous[0].length : 0, match.index)
        .split(/[。；\n]/).at(-1).slice(-100);
      let next = index + 1;
      let right = output.slice(match.index + match[0].length, occurrences[next]?.index ?? output.length);
      // Consecutive reference tokens can share a group caption, as in the user's example.
      while (!right.trim() && next < occurrences.length) {
        const grouped = occurrences[next++];
        right = output.slice(grouped.index + grouped[0].length, occurrences[next]?.index ?? output.length);
      }
      right = right.split(/[。；\n]/)[0].slice(0, 100);
      return left.includes(asset.subject) || right.includes(asset.subject);
    });
    if (!associated) errors.push(`${asset.reference} must be associated with subject ${asset.subject}`);
  }
  for (const token of new Set(occurrences.map((match) => match[0]))) {
    if (!planned.has(token)) errors.push(`unplanned reference: ${token}`);
  }
  return errors;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--prompt" || args[2] !== "--contract") {
    throw new Error("Usage: validate-shot-prompt.mjs --prompt <body.md> --contract <contract.json>");
  }
  const [body, rawContract] = await Promise.all([readFile(args[1], "utf8"), readFile(args[3], "utf8")]);
  const errors = validateShotBlockPrompt(body, JSON.parse(rawContract));
  process.stdout.write(`${JSON.stringify({ ok: !errors.length, checks: "format, timing, declared references only", errors }, null, 2)}\n`);
  if (errors.length) process.exitCode = 4;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2; });
}
