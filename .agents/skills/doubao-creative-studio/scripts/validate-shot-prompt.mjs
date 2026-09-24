#!/usr/bin/env node

// Author-neutral, read-only structural checks. This never invokes a creative model.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const referencePattern = /\{\{Mixed\s+\d+\}\}|@图片\d+|<Subject\s+\d+>|\{\{Node\s+[^{}\n]+\}\}/gi;
const close = (left, right) => Math.abs(left - right) < 0.000_001;
const lightingFormat = "single-level-shots-lighting";
const lightingMarkers = /^(?:\*\*(?:人物资产|环境资产|物品资产|声音资产|视频资产|景别与镜头运动|画面与动作|光影表现)：\*\*|\[整体场景与氛围\]|【多分镜时间轴】)/m;
const usesLightingFormat = (output, contract) => contract?.format === lightingFormat
  || (!contract?.format && lightingMarkers.test(output));

export function validateShotBlockPrompt(output, contract) {
  if (usesLightingFormat(output, contract) || contract?.format === "single-level-shots" || /^### \d+(?:\.\d+)?s–/m.test(output)) return validateSingleLevelShots(output, contract);
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

  const shotPattern = /^镜头[ \t]*(\d+)｜(\d{2,}):([0-5]\d(?:\.\d+)?)—(\d{2,}):([0-5]\d(?:\.\d+)?)｜(\d+(?:\.\d+)?)[ \t]*秒[ \t]*\r?$/gm;
  const shots = [...output.matchAll(shotPattern)].map((match) => ({
    index: match.index,
    headingEnd: match.index + match[0].length,
    number: Number(match[1]),
    start: Number(match[2]) * 60 + Number(match[3]),
    end: Number(match[4]) * 60 + Number(match[5]),
    printedDuration: Number(match[6]),
  }));
  const declaredShots = [...output.matchAll(/^镜头[ \t]*\d+[^\r\n]*/gm)];
  if (shots.length !== declaredShots.length) errors.push("malformed shot header; use 镜头N｜MM:SS.d—MM:SS.d｜X秒");
  if (shots.length === 0) errors.push("at least one complete timed shot block is required; inline beat times do not count as shots");
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
    const picture = contract?.timedBeats ? body.search(/^画面：[ \t]*$/m) : position("画面");
    if (camera < 0 || composition < camera || motion < composition || picture <= motion) {
      errors.push(`shot ${shot.number} requires ordered 相机, 构图／运镜 (or split fields), 画面 with content`);
    }
    if (contract?.timedBeats) {
      const pictureBody = picture < 0 ? "" : body.slice(picture).replace(/^画面：[ \t]*\r?\n/, "");
      const beatPattern = /^\*\*(\d{2,}):([0-5]\d(?:\.\d+)?)—(\d{2,}):([0-5]\d(?:\.\d+)?)｜([^\n]+)：\*\*[ \t]*\r?$/gm;
      const beats = [...pictureBody.matchAll(beatPattern)];
      if (!beats.length || pictureBody.slice(0, beats[0]?.index).trim()) {
        errors.push(`shot ${shot.number} requires timed beats with a named subject`);
      }
      let cursor = shot.start;
      beats.forEach((beat, beatIndex) => {
        const start = Number(beat[1]) * 60 + Number(beat[2]);
        const end = Number(beat[3]) * 60 + Number(beat[4]);
        if (!close(start, cursor) || end <= start || end > shot.end) {
          errors.push(`shot ${shot.number} beat ${beatIndex + 1} must continuously cover cumulative unit time within the shot`);
        }
        const prose = pictureBody.slice(beat.index + beat[0].length, beats[beatIndex + 1]?.index ?? pictureBody.length).trim();
        if (!prose || /^\*\*\d[^\n]*｜/m.test(prose)) errors.push(`shot ${shot.number} has empty prose or a malformed beat heading`);
        cursor = end;
      });
      if (!close(cursor, shot.end)) errors.push(`shot ${shot.number} beats must cover its ending reaction or hold`);
      if (/本镜头起点为零|\d+(?:\.\d+)?[—–]\d+(?:\.\d+)?秒/.test(body)) {
        errors.push(`shot ${shot.number} mixes relative seconds with cumulative timecodes`);
      }
    }
  });
  if (shots.length && !close(shots.at(-1).end, duration)) errors.push(`timeline must end at ${duration}s`);

  const unresolved = [...output.matchAll(/<([^>\n]+)>/g)]
    .map((match) => match[0]).filter((token) => !/^<Subject\s+\d+>$/i.test(token));
  if (unresolved.length) errors.push(`unresolved template instructions: ${[...new Set(unresolved)].join(", ")}`);

  errors.push(...validateReferences(output, contract));
  return errors;
}

function validateReferences(output, contract) {
  const errors = [];
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

export function validateSingleLevelShots(output, contract) {
  const errors = [];
  const lighting = usesLightingFormat(output, contract);
  const duration = Number(contract?.durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) errors.push('durationSeconds must be positive');
  const summary = output.match(/^\*\*总时长：(\d+(?:\.\d+)?)秒｜([^\n]+)\*\*$/m);
  if (!summary || !close(Number(summary[1]), duration)) errors.push('summary total must equal contracted duration');
  if (!/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(contract?.aspectRatio ?? '') || !summary?.[2].includes(contract.aspectRatio)) errors.push('summary requires contracted aspect ratio');
  const pattern = /^### (\d+(?:\.\d+)?)s–(\d+(?:\.\d+)?)s｜镜头(\d+)：([^\n]+)$/gm;
  const shots = [...output.matchAll(pattern)];
  if (!shots.length || shots.length !== [...output.matchAll(/^### /gm)].length) errors.push('each real shot requires one valid timed heading');
  if (lighting) errors.push(...validateLightingPrelude(output, shots[0]?.index ?? output.length));
  let cursor = 0;
  for (const [index, shot] of shots.entries()) {
    const start = Number(shot[1]), end = Number(shot[2]);
    if (Number(shot[3]) !== index + 1 || !close(start, cursor) || end <= start || end > duration) errors.push(`shot ${index + 1} has wrong numbering or cumulative interval`);
    const prose = output.slice(shot.index + shot[0].length, shots[index + 1]?.index ?? output.length);
    const fieldPattern = lighting ? /^\*\*([^*\n]+)：\*\*([^\n]*)$/gm
      : /^\*\*(画面提示词|镜头|音效|景别与镜头运动|画面与动作|光影表现)：\*\*([^\n]*)$/gm;
    const fields = [...prose.matchAll(fieldPattern)];
    const expected = lighting ? ['景别与镜头运动', '画面与动作', '光影表现', '音效'] : ['画面提示词', '镜头', '音效'];
    if (fields.map(x => x[1]).join(',') !== expected.join(',')) errors.push(`shot ${index + 1} requires exactly ${expected.join(', ')}`);
    for (const [fieldIndex, field] of fields.entries()) {
      const content = field[2] + prose.slice(field.index + field[0].length, fields[fieldIndex + 1]?.index ?? prose.length);
      if (!content.replace(/^\s*---+\s*$/gm, '').trim()) errors.push(`shot ${index + 1} requires nonempty ${field[1]}`);
      if (lighting && field[1] === '画面与动作') {
        const details = [...content.matchAll(/^(构图与主体|道具布局|动作与表演)：([^\n]*)$/gm)];
        for (const [detailIndex, detail] of details.entries()) {
          const detailContent = detail[2] + content.slice(detail.index + detail[0].length, details[detailIndex + 1]?.index ?? content.length);
          if (!detailContent.replace(/^\s*---+\s*$/gm, '').trim()) errors.push(`shot ${index + 1} requires nonempty ${detail[1]} when included; omit unused details`);
        }
      }
    }
    if (/\d{1,}:\d{2}|\d+(?:\.\d+)?\s*(?:s|秒)?\s*[—–~～-]\s*\d|\d+(?:\.\d+)?\s*(?:秒|s\b)|^#{1,6}\s|^\*\*[^\n]*(?:节拍|子镜头)/m.test(prose)) errors.push(`shot ${index + 1} contains forbidden inner timing or subshots`);
    cursor = end;
  }
  if (!close(cursor, duration)) errors.push('shots must cover the full duration');
  if (/【全局美学设定】|正文：分镜执行动作|^相机：|^画面：/m.test(output)) errors.push('superseded prompt format mixed into single-level shots');
  if (lighting) {
    const unresolved = [...output.matchAll(/<([^>\n]+)>/g)]
      .map((match) => match[0]).filter((token) => !/^<Subject\s+\d+>$/i.test(token))
      .concat([...output.matchAll(/\{\{[^{}\n]+\}\}/g)].map((match) => match[0])
        .filter((token) => !/^\{\{(?:Mixed\s+\d+|Node\s+[^{}\n]+)\}\}$/i.test(token)));
    if (unresolved.length) errors.push(`unresolved template instructions: ${[...new Set(unresolved)].join(', ')}`);
  }
  errors.push(...validateReferences(output, contract));
  return errors;
}

function validateLightingPrelude(output, firstShotIndex) {
  const errors = [];
  const assetHeadings = ['**人物资产：**', '**环境资产：**', '**物品资产：**', '**声音资产：**', '**视频资产：**'];
  const ordered = [...assetHeadings, '[整体场景与氛围]', '【多分镜时间轴】'];
  const sections = [...output.matchAll(/^(\*\*[^*\n]+：\*\*|\[[^\n]+\]|【[^\n]+】)([^\n]*)$/gm)];
  let cursor = -1;
  for (const heading of ordered) {
    const matching = sections.filter((section) => section[1] === heading);
    if (!matching.length && assetHeadings.includes(heading)) continue;
    if (matching.length !== 1) {
      errors.push(`exactly one ${heading} is required`);
      continue;
    }
    const section = matching[0];
    if (section.index <= cursor || section.index >= firstShotIndex) errors.push(`${heading} must appear in asset/atmosphere/timeline order before the shots`);
    cursor = section.index;
    if (heading === '【多分镜时间轴】') continue;
    const nextSection = sections.find((candidate) => candidate.index > section.index);
    const end = Math.min(nextSection?.index ?? output.length, firstShotIndex);
    const content = section[2] + output.slice(section.index + section[0].length, end);
    if (!content.replace(/^\s*---+\s*$/gm, '').trim()) errors.push(`${heading} requires nonempty content; omit unused asset categories`);
  }
  return errors;
}
