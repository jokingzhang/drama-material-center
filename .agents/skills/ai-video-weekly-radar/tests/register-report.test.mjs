import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerWeeklyRadarReport } from "../scripts/register-report.mjs";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "weekly-radar-skill-"));
  const html = join(root, "source.html");
  const evidence = join(root, "source.json");
  await writeFile(html, "<!doctype html><html><head><title>Radar</title></head><body>report</body></html>");
  await writeFile(evidence, JSON.stringify({ rows: 8 }));
  return { root, html, evidence };
}

function input(fx) {
  return {
    repoRoot: fx.root,
    id: "2026-09-14--2026-09-20-v01",
    html: fx.html,
    evidence: fx.evidence,
    title: "AI 视频一周雷达 · 2026.09.20",
    summary: "先复刻，再做教学。",
    periodStart: "2026-09-14",
    periodEnd: "2026-09-20",
    generatedAt: "2026-09-20T16:20:00+08:00",
    strictWeekSamples: 8,
    detailVerified: 6,
    shortCandidates: 5,
    teachingTopics: 13,
    primaryTitle: "说谎的人就会爆炸",
    primaryAngle: "只复刻高概念结构。",
    secondaryTitle: "AI 漫剧人设",
    secondaryAngle: "同一角色做多种原创人设。",
    evidenceNote: "北京时间搜索抽样，不是平台全量榜单。",
  };
}

test("registers a report atomically with hashes and evidence", async () => {
  const fx = await fixture();
  try {
    const result = await registerWeeklyRadarReport(input(fx));
    assert.equal(result.directory, "weekly-radar/reports/2026-09-14--2026-09-20-v01");
    const target = join(fx.root, result.directory);
    const manifest = JSON.parse(await readFile(join(target, "manifest.json"), "utf8"));
    assert.equal(manifest.reportSha256, result.reportSha256);
    assert.equal(manifest.evidenceSha256, result.evidenceSha256);
    assert.equal(await readFile(join(target, "report.html"), "utf8"), await readFile(fx.html, "utf8"));
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test("refuses to overwrite a historical version", async () => {
  const fx = await fixture();
  try {
    await registerWeeklyRadarReport(input(fx));
    await assert.rejects(registerWeeklyRadarReport(input(fx)), /不能覆盖历史版本/);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test("requires the id and observation window to agree", async () => {
  const fx = await fixture();
  try {
    await assert.rejects(registerWeeklyRadarReport({ ...input(fx), periodEnd: "2026-09-19" }), /必须与 periodStart\/periodEnd 一致/);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});
