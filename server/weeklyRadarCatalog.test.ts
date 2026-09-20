import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWeeklyRadarCatalog, injectWeeklyRadarEmbedStyles } from "./weeklyRadarCatalog";

const roots: string[] = [];

async function temporaryWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "weekly-radar-"));
  roots.push(root);
  return root;
}

async function seedReport(root: string, id = "2026-09-14--2026-09-20-v01") {
  const directory = join(root, id);
  await mkdir(directory, { recursive: true });
  const html = "<!doctype html><html><head><title>周报</title></head><body><div class=\"dashboard-topbar\"></div><section class=\"radar-hero-card\"><div class=\"radar-decision\"><h1>一周决策</h1></div></section></body></html>";
  const evidence = JSON.stringify({ capturedAt: "2026-09-20T15:10:00+08:00" });
  await writeFile(join(directory, "report.html"), html);
  await writeFile(join(directory, "evidence.json"), evidence);
  await writeFile(join(directory, "manifest.json"), JSON.stringify({
    schemaVersion: 1,
    id,
    title: "AI 视频一周雷达 · 2026.09.20",
    summary: "本周优先做一条高概念复刻，再拆成教学内容。",
    period: { start: "2026-09-14", end: "2026-09-20", timezone: "Asia/Shanghai" },
    generatedAt: "2026-09-20T16:20:00+08:00",
    status: "READY",
    counts: { strictWeekSamples: 8, detailVerified: 6, shortCandidates: 5, teachingTopics: 13 },
    picks: {
      primary: { title: "说谎的人就会爆炸", angle: "复刻结构，不复制角色。" },
      secondary: { title: "AI 漫剧人设", angle: "一人多种人设。" },
    },
    evidenceNote: "北京时间搜索抽样，不是平台全量榜单。",
    reportFile: "report.html",
    reportSha256: createHash("sha256").update(html).digest("hex"),
    evidenceFile: "evidence.json",
    evidenceSha256: createHash("sha256").update(evidence).digest("hex"),
  }));
  return { id, html };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("weekly radar catalog", () => {
  it("lists valid reports newest first without exposing local paths", async () => {
    const root = await temporaryWorkspace();
    await seedReport(root);
    await seedReport(root, "2026-09-07--2026-09-13-v01");

    const result = await createWeeklyRadarCatalog(root).listReports();

    expect(result.issues).toEqual([]);
    expect(result.reports.map((report) => report.id)).toEqual([
      "2026-09-14--2026-09-20-v01",
      "2026-09-07--2026-09-13-v01",
    ]);
    expect(JSON.stringify(result)).not.toContain(root);
    expect(result.reports[0].reportUrl).toBe("/api/ai-video-radar/reports/2026-09-14--2026-09-20-v01/document");
  });

  it("injects compact embed styles while preserving the registered file", async () => {
    const root = await temporaryWorkspace();
    const { id, html } = await seedReport(root);
    const catalog = createWeeklyRadarCatalog(root);

    await expect(catalog.readReportHtml(id)).resolves.toBe(html);
    const embedded = await catalog.readReportHtml(id, true);
    expect(embedded).toContain('id="weekly-radar-embed-styles"');
    expect(embedded).toContain(".dashboard-topbar, .theme-drawer { display: none !important; }");
    expect(embedded).toContain("font-size: clamp(28px, 3vw, 38px)");
  });

  it("rejects traversal-like ids and changed report bytes", async () => {
    const root = await temporaryWorkspace();
    const { id } = await seedReport(root);
    const catalog = createWeeklyRadarCatalog(root);

    await expect(catalog.readReportHtml("../../private")).rejects.toMatchObject({ code: "report_not_found" });
    await writeFile(join(root, id, "report.html"), "changed");
    await expect(catalog.readReportHtml(id)).rejects.toMatchObject({ code: "invalid_report" });
  });

  it("adds an issue for malformed historical reports instead of hiding valid history", async () => {
    const root = await temporaryWorkspace();
    await seedReport(root);
    const broken = join(root, "2026-09-01--2026-09-07-v01");
    await mkdir(broken, { recursive: true });
    await writeFile(join(broken, "manifest.json"), "{}");

    const result = await createWeeklyRadarCatalog(root).listReports();
    expect(result.reports).toHaveLength(1);
    expect(result.issues).toEqual([{ id: "2026-09-01--2026-09-07-v01", reason: "周报清单格式无效。" }]);
  });
});

describe("weekly radar embed CSS", () => {
  it("refuses documents without a head boundary", () => {
    expect(() => injectWeeklyRadarEmbedStyles("<html><body>broken</body></html>")).toThrow("缺少 head");
  });
});
