#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const REPORT_ID_PATTERN = /^\d{4}-\d{2}-\d{2}--\d{4}-\d{2}-\d{2}-v\d{2}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_GIT_REPORT_BYTES = 5 * 1024 * 1024;

function requiredString(value, label, maxLength = 800) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} 不能为空。`);
  if (value.length > maxLength) throw new Error(`${label} 不能超过 ${maxLength} 个字符。`);
  return value.trim();
}

function count(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} 必须是非负整数。`);
  return number;
}

function validDate(value, label) {
  if (!DATE_PATTERN.test(value ?? "")) throw new Error(`${label} 必须使用 YYYY-MM-DD。`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} 不是有效日期。`);
  }
  return value;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function assertRegularFile(path, label) {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) throw new Error(`${label} 不是普通文件。`);
  return fileStat;
}

function targetWithinRepo(repoRoot, target) {
  return target === repoRoot || target.startsWith(`${repoRoot}${sep}`);
}

export function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`参数格式错误：${flag ?? "<empty>"}`);
    values[flag.slice(2)] = value;
  }
  return values;
}

export async function registerWeeklyRadarReport(input) {
  const repoRoot = await realpath(resolve(input.repoRoot ?? process.cwd()));
  const reportsRoot = resolve(repoRoot, input.reportsRoot ?? "weekly-radar/reports");
  if (!targetWithinRepo(repoRoot, reportsRoot)) throw new Error("报告目录必须位于当前仓库内。");

  const id = requiredString(input.id, "id", 64);
  if (!REPORT_ID_PATTERN.test(id)) throw new Error("id 必须使用 YYYY-MM-DD--YYYY-MM-DD-vNN。 ");
  const start = validDate(input.periodStart, "periodStart");
  const end = validDate(input.periodEnd, "periodEnd");
  if (start > end) throw new Error("观察窗口开始日期不能晚于结束日期。");
  if (!id.startsWith(`${start}--${end}-`)) throw new Error("id 中的观察窗口必须与 periodStart/periodEnd 一致。");
  const generatedAt = requiredString(input.generatedAt, "generatedAt", 80);
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error("generatedAt 必须是带时区的 ISO 时间。");

  const htmlPath = await realpath(resolve(input.html));
  const htmlStat = await assertRegularFile(htmlPath, "HTML");
  if (htmlStat.size <= 0 || htmlStat.size > MAX_GIT_REPORT_BYTES) {
    throw new Error("HTML 必须非空且不超过 5 MB；更大的程序资产需先取得明确确认。");
  }
  const html = await readFile(htmlPath);
  const htmlText = html.toString("utf8", 0, Math.min(html.length, 8192));
  if (!/<html[\s>]/i.test(htmlText) || !/<head[\s>]/i.test(htmlText)) throw new Error("HTML 缺少 html/head 文档结构。");

  let evidencePath;
  let evidence;
  if (input.evidence) {
    evidencePath = await realpath(resolve(input.evidence));
    await assertRegularFile(evidencePath, "证据快照");
    evidence = await readFile(evidencePath);
    try {
      JSON.parse(evidence.toString("utf8"));
    } catch {
      throw new Error("证据快照必须是合法 JSON。");
    }
  }

  const manifest = {
    schemaVersion: 1,
    id,
    title: requiredString(input.title, "title", 180),
    summary: requiredString(input.summary, "summary", 800),
    period: { start, end, timezone: "Asia/Shanghai" },
    generatedAt,
    status: "READY",
    counts: {
      strictWeekSamples: count(input.strictWeekSamples, "strictWeekSamples"),
      detailVerified: count(input.detailVerified, "detailVerified"),
      shortCandidates: count(input.shortCandidates, "shortCandidates"),
      teachingTopics: count(input.teachingTopics, "teachingTopics"),
    },
    picks: {
      primary: {
        title: requiredString(input.primaryTitle, "primaryTitle", 160),
        angle: requiredString(input.primaryAngle, "primaryAngle", 500),
      },
      ...(input.secondaryTitle || input.secondaryAngle ? {
        secondary: {
          title: requiredString(input.secondaryTitle, "secondaryTitle", 160),
          angle: requiredString(input.secondaryAngle, "secondaryAngle", 500),
        },
      } : {}),
    },
    evidenceNote: requiredString(input.evidenceNote, "evidenceNote", 800),
    reportFile: "report.html",
    reportSha256: sha256(html),
    ...(evidence ? { evidenceFile: "evidence.json", evidenceSha256: sha256(evidence) } : {}),
  };

  await mkdir(reportsRoot, { recursive: true });
  const target = join(reportsRoot, id);
  try {
    await access(target, constants.F_OK);
    throw new Error(`报告 ${id} 已存在；请使用下一个 vNN，不能覆盖历史版本。`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const temporary = join(reportsRoot, `.${id}.${randomUUID()}.tmp`);
  await mkdir(temporary, { recursive: false });
  try {
    await copyFile(htmlPath, join(temporary, "report.html"), constants.COPYFILE_EXCL);
    if (evidencePath) await copyFile(evidencePath, join(temporary, "evidence.json"), constants.COPYFILE_EXCL);
    await writeFile(join(temporary, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }

  return {
    id,
    directory: relative(repoRoot, target).split(sep).join("/"),
    reportSha256: manifest.reportSha256,
    evidenceSha256: manifest.evidenceSha256,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const result = await registerWeeklyRadarReport({
    repoRoot: args["repo-root"],
    reportsRoot: args["reports-root"],
    id: args.id,
    html: args.html,
    evidence: args.evidence,
    title: args.title,
    summary: args.summary,
    periodStart: args["period-start"],
    periodEnd: args["period-end"],
    generatedAt: args["generated-at"],
    strictWeekSamples: args["strict-week-samples"],
    detailVerified: args["detail-verified"],
    shortCandidates: args["short-candidates"],
    teachingTopics: args["teaching-topics"],
    primaryTitle: args["primary-title"],
    primaryAngle: args["primary-angle"],
    secondaryTitle: args["secondary-title"],
    secondaryAngle: args["secondary-angle"],
    evidenceNote: args["evidence-note"],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
