import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAnalysisCatalog } from "./analysisCatalog";

function knowledgeResolver(entries: Record<string, "standard" | "card" | "case">) {
  return {
    hasEntry: (entryId: string) => entryId in entries,
    entryType: (entryId: string) => entries[entryId],
  };
}

const temporaryRoots: string[] = [];

async function temporaryWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "director-analysis-"));
  temporaryRoots.push(root);
  const projectRoot = join(root, "sample-project");
  await mkdir(join(projectRoot, "library", "剧情"), { recursive: true });
  await writeFile(join(projectRoot, "project.json"), JSON.stringify({ schemaVersion: 1, name: "Sample" }), "utf8");
  return { root, projectRoot };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("script production analysis catalog", () => {
  it("returns an honest empty state when no registered analysis manifest exists", async () => {
    const { root, projectRoot } = await temporaryWorkspace();
    await writeFile(join(projectRoot, "library", "剧情", "legacy.md"), "knowledgeUsed: DRAMA-PAT-101", "utf8");

    const catalog = await createAnalysisCatalog(root, "sample-project");

    expect(catalog.list()).toEqual({ status: "EMPTY", analyses: [] });
  });

  it("preserves adopted, rejected, and higher-priority override decisions from a registered analysis", async () => {
    const { root, projectRoot } = await temporaryWorkspace();
    await mkdir(join(projectRoot, ".ai-director", "analyses"), { recursive: true });
    await writeFile(join(projectRoot, ".ai-director", "analysis-index.json"), JSON.stringify({
      schemaVersion: 1,
      analyses: [{ analysisId: "SPA-EP01-v01", path: ".ai-director/analyses/SPA-EP01-v01.json" }],
    }), "utf8");
    const baseUse = {
      entryKind: "card",
      reason: "可审计理由",
      matchedTriggers: [],
      matchedExclusions: [],
      missingInputs: [],
      outputRefs: [],
      entrySnapshot: { title: "知识", maturity: "REUSABLE", updatedAt: "2026-08-28" },
    };
    await writeFile(join(projectRoot, ".ai-director", "analyses", "SPA-EP01-v01.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "ScriptProductionAnalysis",
      analysisId: "SPA-EP01-v01",
      projectId: "sample-project",
      createdAt: "2026-08-28T06:00:00.000Z",
      sourceBinding: { relativePath: "library/剧情/EP01.md", sha256: "a".repeat(64) },
      knowledgeUsed: [
        {
          ...baseUse,
          entryId: "DRAMA-PAT-101",
          disposition: "ADOPTED",
          matchedTriggers: ["人物参考"],
          outputRefs: [{ artifact: "AssetPlan", locator: "assets[0]" }],
        },
        {
          ...baseUse,
          entryId: "DRAMA-PAT-202",
          disposition: "REJECTED_CONDITION",
          matchedExclusions: ["当前镜头无对白"],
        },
        {
          ...baseUse,
          entryId: "DRAMA-PAT-203",
          disposition: "OVERRIDDEN_BY_HIGHER_PRIORITY",
          override: {
            authority: "USER_DECISION",
            locator: "DIR-EP01-001",
            summary: "用户冻结为静态镜头",
          },
        },
      ],
    }), "utf8");

    const catalog = await createAnalysisCatalog(root, "sample-project", knowledgeResolver({
      "DRAMA-PAT-101": "card",
      "DRAMA-PAT-202": "card",
      "DRAMA-PAT-203": "card",
    }));

    expect(catalog.list()).toEqual({
      status: "AVAILABLE",
      analyses: [{
        analysisId: "SPA-EP01-v01",
        kind: "ScriptProductionAnalysis",
        createdAt: "2026-08-28T06:00:00.000Z",
        knowledgeUseCounts: { adopted: 1, rejected: 1, overridden: 1 },
      }],
    });
    expect(catalog.get("SPA-EP01-v01").knowledgeUsed.map((entry) => entry.disposition)).toEqual([
      "ADOPTED",
      "REJECTED_CONDITION",
      "OVERRIDDEN_BY_HIGHER_PRIORITY",
    ]);
    expect(JSON.stringify(catalog.get("SPA-EP01-v01"))).not.toContain(projectRoot);
  });

  it("reads a project-bound script development analysis and preserves its knowledge decisions", async () => {
    const { root, projectRoot } = await temporaryWorkspace();
    await mkdir(join(projectRoot, ".ai-director", "analyses"), { recursive: true });
    await writeFile(join(projectRoot, ".ai-director", "analysis-index.json"), JSON.stringify({
      schemaVersion: 1,
      analyses: [{ analysisId: "SDA-EP01-v01", path: ".ai-director/analyses/SDA-EP01-v01.json" }],
    }), "utf8");
    await writeFile(join(projectRoot, ".ai-director", "analyses", "SDA-EP01-v01.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "ScriptDevelopmentAnalysis",
      analysisId: "SDA-EP01-v01",
      projectId: "sample-project",
      createdAt: "2026-08-28T07:00:00.000Z",
      title: "EP01 剧本优化",
      sourceBinding: { relativePath: "library/剧情/EP01.md", sha256: "b".repeat(64) },
      storyEngine: {},
      episodeLadder: [],
      problemLedger: [],
      knowledgeUsed: [{
        entryId: "DRAMA-STD-WORKFLOW-002",
        entryKind: "standard",
        disposition: "ADOPTED",
        reason: "用剧本诊断合同约束 story engine 和问题账本。",
        matchedTriggers: ["剧本优化"],
        matchedExclusions: [],
        missingInputs: [],
        outputRefs: [{ artifact: "StoryEngine", locator: "storyEngine" }],
        entrySnapshot: {
          title: "短剧剧本诊断与优化合同",
          version: "0.1.0",
          policyStatus: "ACTIVE",
          evidenceStatus: "OBSERVED",
        },
      }],
    }), "utf8");

    const catalog = await createAnalysisCatalog(root, "sample-project", knowledgeResolver({
      "DRAMA-STD-WORKFLOW-002": "standard",
    }));

    expect(catalog.list()).toEqual({
      status: "AVAILABLE",
      analyses: [{
        analysisId: "SDA-EP01-v01",
        kind: "ScriptDevelopmentAnalysis",
        title: "EP01 剧本优化",
        createdAt: "2026-08-28T07:00:00.000Z",
        knowledgeUseCounts: { adopted: 1, rejected: 0, overridden: 0 },
      }],
    });
    expect(catalog.get("SDA-EP01-v01")).toMatchObject({
      kind: "ScriptDevelopmentAnalysis",
      title: "EP01 剧本优化",
      knowledgeUsed: [{ entryId: "DRAMA-STD-WORKFLOW-002", disposition: "ADOPTED" }],
    });
  });

  it("rejects unknown IDs, entry-type mismatches, and incomplete immutable snapshots", async () => {
    const { root, projectRoot } = await temporaryWorkspace();
    await mkdir(join(projectRoot, ".ai-director", "analyses"), { recursive: true });
    await writeFile(join(projectRoot, ".ai-director", "analysis-index.json"), JSON.stringify({
      schemaVersion: 1,
      analyses: [{ analysisId: "SPA-EP01-v02", path: ".ai-director/analyses/SPA-EP01-v02.json" }],
    }), "utf8");
    await writeFile(join(projectRoot, ".ai-director", "analyses", "SPA-EP01-v02.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "ScriptProductionAnalysis",
      analysisId: "SPA-EP01-v02",
      projectId: "sample-project",
      createdAt: "2026-08-28T06:00:00.000Z",
      sourceBinding: { relativePath: "library/剧情/EP01.md" },
      knowledgeUsed: [{
        entryId: "DRAMA-UNKNOWN-999",
        entryKind: "standard",
        disposition: "ADOPTED",
        reason: "不应通过",
        matchedTriggers: ["测试"],
        matchedExclusions: [],
        missingInputs: [],
        outputRefs: [{ artifact: "AssetPlan", locator: "assets[0]" }],
        entrySnapshot: { title: "伪造标准" },
      }],
    }), "utf8");

    await expect(createAnalysisCatalog(root, "sample-project", knowledgeResolver({
      "DRAMA-STD-ASSET-001": "standard",
    }))).rejects.toMatchObject({ code: "ANALYSIS_INDEX_INVALID" });
  });
});
