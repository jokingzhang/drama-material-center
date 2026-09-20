import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { join, sep } from "node:path";

export interface WeeklyRadarCounts {
  strictWeekSamples: number;
  detailVerified: number;
  shortCandidates: number;
  teachingTopics: number;
}

export interface WeeklyRadarPick {
  title: string;
  angle: string;
}

export interface WeeklyRadarReportSummary {
  schemaVersion: 1;
  id: string;
  title: string;
  summary: string;
  period: {
    start: string;
    end: string;
    timezone: "Asia/Shanghai";
  };
  generatedAt: string;
  status: "READY";
  counts: WeeklyRadarCounts;
  picks: {
    primary: WeeklyRadarPick;
    secondary?: WeeklyRadarPick;
  };
  evidenceNote: string;
  reportUrl: string;
}

interface WeeklyRadarManifest extends Omit<WeeklyRadarReportSummary, "reportUrl"> {
  reportFile: "report.html";
  reportSha256: string;
  evidenceFile?: "evidence.json";
  evidenceSha256?: string;
}

export interface WeeklyRadarCatalogIssue {
  id: string;
  reason: string;
}

export class WeeklyRadarCatalogError extends Error {
  constructor(
    readonly code: "report_not_found" | "invalid_report" | "invalid_path",
    message: string,
  ) {
    super(message);
    this.name = "WeeklyRadarCatalogError";
  }
}

const reportIdPattern = /^\d{4}-\d{2}-\d{2}--\d{4}-\d{2}-\d{2}-v\d{2}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const MAX_REPORT_BYTES = 12 * 1024 * 1024;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function nonEmptyString(value: unknown, maxLength = 500): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.length <= maxLength;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function parsePick(value: unknown): WeeklyRadarPick | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<WeeklyRadarPick>;
  if (!nonEmptyString(candidate.title, 160) || !nonEmptyString(candidate.angle, 500)) return undefined;
  return { title: candidate.title.trim(), angle: candidate.angle.trim() };
}

export function parseWeeklyRadarManifest(value: unknown, directoryId: string): WeeklyRadarManifest | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<WeeklyRadarManifest>;
  if (
    candidate.schemaVersion !== 1
    || candidate.id !== directoryId
    || !reportIdPattern.test(directoryId)
    || !nonEmptyString(candidate.title, 180)
    || !nonEmptyString(candidate.summary, 800)
    || candidate.status !== "READY"
    || candidate.reportFile !== "report.html"
    || typeof candidate.reportSha256 !== "string"
    || !sha256Pattern.test(candidate.reportSha256)
    || !nonEmptyString(candidate.evidenceNote, 800)
    || !candidate.period
    || !validDate(candidate.period.start)
    || !validDate(candidate.period.end)
    || candidate.period.start > candidate.period.end
    || candidate.period.timezone !== "Asia/Shanghai"
    || typeof candidate.generatedAt !== "string"
    || !Number.isFinite(Date.parse(candidate.generatedAt))
    || !candidate.counts
    || !nonNegativeInteger(candidate.counts.strictWeekSamples)
    || !nonNegativeInteger(candidate.counts.detailVerified)
    || !nonNegativeInteger(candidate.counts.shortCandidates)
    || !nonNegativeInteger(candidate.counts.teachingTopics)
    || !candidate.picks
  ) return undefined;

  const primary = parsePick(candidate.picks.primary);
  const secondary = candidate.picks.secondary ? parsePick(candidate.picks.secondary) : undefined;
  if (!primary || (candidate.picks.secondary && !secondary)) return undefined;
  if (candidate.evidenceFile !== undefined && candidate.evidenceFile !== "evidence.json") return undefined;
  if (candidate.evidenceSha256 !== undefined && !sha256Pattern.test(candidate.evidenceSha256)) return undefined;
  if (candidate.evidenceFile && !candidate.evidenceSha256) return undefined;
  if (candidate.evidenceSha256 && !candidate.evidenceFile) return undefined;

  return {
    schemaVersion: 1,
    id: directoryId,
    title: candidate.title.trim(),
    summary: candidate.summary.trim(),
    period: {
      start: candidate.period.start,
      end: candidate.period.end,
      timezone: "Asia/Shanghai",
    },
    generatedAt: candidate.generatedAt,
    status: "READY",
    counts: {
      strictWeekSamples: candidate.counts.strictWeekSamples,
      detailVerified: candidate.counts.detailVerified,
      shortCandidates: candidate.counts.shortCandidates,
      teachingTopics: candidate.counts.teachingTopics,
    },
    picks: {
      primary,
      ...(secondary ? { secondary } : {}),
    },
    evidenceNote: candidate.evidenceNote.trim(),
    reportFile: "report.html",
    reportSha256: candidate.reportSha256,
    ...(candidate.evidenceFile ? { evidenceFile: "evidence.json" as const } : {}),
    ...(candidate.evidenceSha256 ? { evidenceSha256: candidate.evidenceSha256 } : {}),
  };
}

function summaryFor(manifest: WeeklyRadarManifest): WeeklyRadarReportSummary {
  const { reportFile: _reportFile, reportSha256: _reportSha256, evidenceFile: _evidenceFile, evidenceSha256: _evidenceSha256, ...summary } = manifest;
  return {
    ...summary,
    reportUrl: `/api/ai-video-radar/reports/${encodeURIComponent(manifest.id)}/document`,
  };
}

async function checksum(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export function injectWeeklyRadarEmbedStyles(source: string) {
  const embedStyles = `
<style id="weekly-radar-embed-styles">
  .dashboard-topbar, .theme-drawer { display: none !important; }
  .dashboard-root { --dashboard-topbar-base-height: 0px !important; }
  main.page, main.report-page { padding-top: 14px !important; }
  .radar-hero-card { padding: 14px 18px !important; }
  .radar-hero-card > .component-header { margin-bottom: 10px !important; }
  .radar-decision { grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr) !important; gap: 24px !important; padding: 0 4px 2px !important; }
  .radar-decision h1 { max-width: 620px !important; margin: 8px 0 9px !important; font-size: clamp(28px, 3vw, 38px) !important; line-height: 1.08 !important; letter-spacing: -.04em !important; }
  .radar-decision-copy > p { font-size: 12px !important; line-height: 1.58 !important; }
  .radar-window { margin-top: 0 !important; padding-top: 13px !important; }
  .radar-call-stack { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
  .radar-call-card { padding: 12px !important; }
  .radar-call-card > a { margin-top: 4px !important; font-size: 15px !important; }
  .radar-call-card > p { display: -webkit-box; margin: 5px 0 8px !important; overflow: hidden; font-size: 10px !important; line-height: 1.45 !important; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .radar-call-head b { font-size: 20px !important; }
  .radar-avoid { grid-column: 1 / -1; padding-top: 1px !important; }
  @media (max-width: 900px) {
    .radar-decision { grid-template-columns: minmax(0, 1fr) !important; gap: 18px !important; }
  }
  @media (max-width: 620px) {
    main.page, main.report-page { padding: 8px 10px 48px !important; }
    .radar-hero-card { padding: 13px !important; }
    .radar-hero-card > .component-header { display: none !important; }
    .radar-decision h1 { font-size: 27px !important; }
    .radar-call-stack { grid-template-columns: minmax(0, 1fr) !important; }
  }
</style>`;
  const headClose = source.search(/<\/head>/i);
  if (headClose < 0) throw new WeeklyRadarCatalogError("invalid_report", "周报 HTML 缺少 head 结束标签。");
  return `${source.slice(0, headClose)}${embedStyles}\n${source.slice(headClose)}`;
}

async function safeReportFile(reportRoot: string, fileName: string) {
  const candidate = join(reportRoot, fileName);
  const [resolvedRoot, resolvedCandidate] = await Promise.all([realpath(reportRoot), realpath(candidate)]);
  if (!resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)) {
    throw new WeeklyRadarCatalogError("invalid_path", "周报文件超出了报告目录。");
  }
  const fileStat = await lstat(resolvedCandidate);
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    throw new WeeklyRadarCatalogError("invalid_path", "周报文件不是普通文件。");
  }
  return { path: resolvedCandidate, size: fileStat.size };
}

export function createWeeklyRadarCatalog(reportsRoot: string) {
  async function readManifest(reportId: string) {
    if (!reportIdPattern.test(reportId)) {
      throw new WeeklyRadarCatalogError("report_not_found", "周报不存在。");
    }
    const reportRoot = join(reportsRoot, reportId);
    try {
      const rootStat = await lstat(reportRoot);
      if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("invalid report directory");
      const manifestPath = await safeReportFile(reportRoot, "manifest.json");
      const manifest = parseWeeklyRadarManifest(JSON.parse(await readFile(manifestPath.path, "utf8")), reportId);
      if (!manifest) throw new WeeklyRadarCatalogError("invalid_report", "周报清单格式无效。");
      return { reportRoot, manifest };
    } catch (error) {
      if (error instanceof WeeklyRadarCatalogError) throw error;
      throw new WeeklyRadarCatalogError("report_not_found", "周报不存在。");
    }
  }

  return {
    async listReports(): Promise<{ reports: WeeklyRadarReportSummary[]; issues: WeeklyRadarCatalogIssue[] }> {
      await mkdir(reportsRoot, { recursive: true });
      const entries = await readdir(reportsRoot, { withFileTypes: true });
      const reports: WeeklyRadarReportSummary[] = [];
      const issues: WeeklyRadarCatalogIssue[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.isSymbolicLink() || !reportIdPattern.test(entry.name)) continue;
        try {
          const { reportRoot, manifest } = await readManifest(entry.name);
          const report = await safeReportFile(reportRoot, manifest.reportFile);
          if (report.size <= 0 || report.size > MAX_REPORT_BYTES) {
            throw new WeeklyRadarCatalogError("invalid_report", "周报 HTML 大小超出允许范围。");
          }
          reports.push(summaryFor(manifest));
        } catch (error) {
          issues.push({
            id: entry.name,
            reason: error instanceof WeeklyRadarCatalogError ? error.message : "周报读取失败。",
          });
        }
      }

      reports.sort((left, right) => right.period.end.localeCompare(left.period.end)
        || right.generatedAt.localeCompare(left.generatedAt)
        || right.id.localeCompare(left.id));
      issues.sort((left, right) => left.id.localeCompare(right.id));
      return { reports, issues };
    },

    async readReportHtml(reportId: string, embed = false) {
      const { reportRoot, manifest } = await readManifest(reportId);
      const report = await safeReportFile(reportRoot, manifest.reportFile);
      if (report.size <= 0 || report.size > MAX_REPORT_BYTES) {
        throw new WeeklyRadarCatalogError("invalid_report", "周报 HTML 大小超出允许范围。");
      }
      const source = await readFile(report.path, "utf8");
      if (createHash("sha256").update(source).digest("hex") !== manifest.reportSha256) {
        throw new WeeklyRadarCatalogError("invalid_report", "周报 HTML 与登记哈希不一致。");
      }
      if (manifest.evidenceFile && manifest.evidenceSha256) {
        const evidence = await safeReportFile(reportRoot, manifest.evidenceFile);
        if (await checksum(evidence.path) !== manifest.evidenceSha256) {
          throw new WeeklyRadarCatalogError("invalid_report", "周报证据快照与登记哈希不一致。");
        }
      }
      return embed ? injectWeeklyRadarEmbedStyles(source) : source;
    },
  };
}
