import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDirectorKnowledgeCatalog } from "./directorKnowledge";

const temporaryRoots: string[] = [];

async function temporaryKnowledgeRoot() {
  const root = await mkdtemp(join(tmpdir(), "director-knowledge-"));
  temporaryRoots.push(root);
  await Promise.all([
    mkdir(join(root, ".ai-director"), { recursive: true }),
    mkdir(join(root, "标准"), { recursive: true }),
    mkdir(join(root, "知识卡"), { recursive: true }),
    mkdir(join(root, "案例", "CASE-20260828-TEST"), { recursive: true }),
  ]);
  return root;
}

function usageContract() {
  return {
    triggers: ["触发"],
    exclusions: ["排除"],
    requiredInputs: ["输入"],
    outputTargets: ["输出"],
    stopConditions: ["停止"],
    acceptance: {
      machineChecks: ["机器检查"],
      actualViewing: ["实际观看"],
      actualListening: ["实际试听"],
      humanAcceptance: ["人工接受"],
    },
  };
}

function validIndex() {
  return {
    schemaVersion: 2,
    standards: [{
      schemaVersion: 2,
      id: "DRAMA-STD-WORKFLOW-001",
      kind: "workflow-standard",
      title: "剧本到分镜",
      path: "标准/workflow.md",
      domain: "workflow",
      knowledgeAreas: ["script", "image-asset", "shot-prompt"],
      knowledgeAreaRole: "CROSS_CUTTING",
      policyStatus: "ACTIVE",
      evidenceStatus: "OBSERVED",
      version: "1.0.0",
      tags: ["工作流"],
      triggerFeatures: ["剧本到分镜"],
      exclusionFeatures: [],
      sourceCardIds: ["DRAMA-PAT-001"],
      createdAt: "2026-08-28",
      updatedAt: "2026-08-28",
      usageContract: usageContract(),
    }],
    cards: [{
      schemaVersion: 2,
      id: "DRAMA-PAT-001",
      kind: "pattern",
      title: "测试机制",
      path: "知识卡/pattern.md",
      domain: "workflow",
      status: "OBSERVED",
      tags: ["测试"],
      sourceCaseIds: ["CASE-20260828-TEST"],
      evidenceRefs: ["EV-TEST-001"],
      evidenceStrength: "HIGH",
      sourceCount: 1,
      ownProductionUses: 0,
      ownAcceptedUses: 0,
      createdAt: "2026-08-28",
      updatedAt: "2026-08-28",
      knowledgeAreas: ["script"],
      knowledgeAreaRole: "PRIMARY",
      usageContract: usageContract(),
    }],
    cases: [{
      schemaVersion: 2,
      id: "CASE-20260828-TEST",
      kind: "case",
      origin: "external-work",
      title: "测试案例",
      path: "案例/CASE-20260828-TEST/案例档案.md",
      studiedAt: "2026-08-28",
      sourceDocument: "来源/source.md",
      evidenceDocument: "案例/CASE-20260828-TEST/证据账本.md",
      domains: ["workflow"],
      derivedCardIds: ["DRAMA-PAT-001"],
      knowledgeAreas: ["script"],
      knowledgeAreaRole: "PRIMARY",
    }],
  };
}

function evidenceBlock(
  id: string,
  type: "DIRECT_FACT" | "ANALYTICAL_INFERENCE" | "UNKNOWN" = "DIRECT_FACT",
  claimType?: string,
) {
  return `### ${id}\n\n- 类型：\`${type}\`\n${claimType ? `- claimType：\`${claimType}\`\n` : ""}- 来源：测试来源\n- 检查：读取节点\n- 观察：观察到结果\n- 可信度：\`HIGH\`\n- 读取日期：\`2026-08-28\`\n`;
}

async function writeFixture(
  index = validIndex(),
  evidence = evidenceBlock("EV-TEST-001"),
  validation?: string,
) {
  const root = await temporaryKnowledgeRoot();
  await Promise.all([
    writeFile(join(root, "标准", "workflow.md"), "# Workflow\n", "utf8"),
    writeFile(join(root, "知识卡", "pattern.md"), "# Pattern\n", "utf8"),
    writeFile(join(root, "案例", "CASE-20260828-TEST", "案例档案.md"), "# Case\n", "utf8"),
    writeFile(join(root, "案例", "CASE-20260828-TEST", "证据账本.md"), evidence, "utf8"),
    writeFile(join(root, ".ai-director", "index.json"), JSON.stringify(index), "utf8"),
  ]);
  if (validation !== undefined) {
    await mkdir(join(root, "验证"), { recursive: true });
    await writeFile(join(root, "验证", "验证记录.md"), validation, "utf8");
  }
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("director knowledge catalog", () => {
  it("loads the checked-in schema v2 knowledge index with its evidence ledgers", async () => {
    const catalog = await createDirectorKnowledgeCatalog(join(process.cwd(), "director-knowledge-base"));

    expect(catalog.overview()).toEqual(expect.objectContaining({
      status: "VALID",
      totals: { standards: 3, cards: 14, cases: 7, validatedCards: 0 },
      validation: { practiceCount: 0, humanAcceptedCount: 0 },
    }));
    expect((catalog.get("CASE-20260828-NUO") as { evidenceRecords: unknown[] }).evidenceRecords.length).toBeGreaterThan(0);
    expect((catalog.get("DRAMA-PAT-101") as { evidenceRecords: unknown[] }).evidenceRecords).toHaveLength(8);
  });

  it("serves validated metadata, evidence lineage, validation summary, and read-only lookup methods", async () => {
    const catalog = await createDirectorKnowledgeCatalog(await writeFixture());

    expect(catalog.overview()).toEqual({
      status: "VALID",
      totals: { standards: 1, cards: 1, cases: 1, validatedCards: 0 },
      validation: { practiceCount: 0, humanAcceptedCount: 0 },
      areas: [
        { id: "script", primaryStandards: 0, crossCuttingStandards: 1, patterns: 1, risks: 0, cases: 1, gaps: ["NO_PRIMARY_STANDARD", "NO_VALIDATED_CARDS"] },
        { id: "image-asset", primaryStandards: 0, crossCuttingStandards: 1, patterns: 0, risks: 0, cases: 0, gaps: ["NO_PRIMARY_STANDARD", "NO_CARDS", "NO_VALIDATED_CARDS"] },
        { id: "shot-prompt", primaryStandards: 0, crossCuttingStandards: 1, patterns: 0, risks: 0, cases: 0, gaps: ["NO_PRIMARY_STANDARD", "NO_CARDS", "NO_VALIDATED_CARDS"] },
      ],
    });
    expect(catalog.list({ area: "script", layer: "standard", status: "ACTIVE", query: "分镜" }))
      .toEqual([expect.objectContaining({ id: "DRAMA-STD-WORKFLOW-001", entryType: "standard" })]);
    expect(catalog.get("DRAMA-PAT-001")).toEqual(expect.objectContaining({
      entryType: "card",
      evidenceRecords: [expect.objectContaining({
        id: "EV-TEST-001",
        caseId: "CASE-20260828-TEST",
        type: "DIRECT_FACT",
        claimType: "OBSERVED_ARTIFACT",
        source: "测试来源",
        inspection: "读取节点",
        observation: "观察到结果",
        strength: "HIGH",
        readAt: "2026-08-28",
      })],
    }));
    expect(catalog.get("CASE-20260828-TEST")).toEqual(expect.objectContaining({
      entryType: "case",
      derivedCardIds: ["DRAMA-PAT-001"],
      evidenceRecords: [expect.objectContaining({ id: "EV-TEST-001" })],
    }));
    expect(catalog.hasEntry("DRAMA-PAT-001")).toBe(true);
    expect(catalog.hasEntry("DRAMA-PAT-999")).toBe(false);
    expect(catalog.entryType("DRAMA-STD-WORKFLOW-001")).toBe("standard");
    expect(catalog.entryType("CASE-20260828-TEST")).toBe("case");
    expect(catalog.entryType("DRAMA-PAT-999")).toBeUndefined();
  });

  it("assigns conservative claim types while honoring an explicit supported claimType", async () => {
    const index = validIndex();
    index.cards[0].evidenceRefs = ["EV-TEST-001", "EV-TEST-002", "EV-TEST-003", "EV-TEST-004"];
    const evidence = [
      evidenceBlock("EV-TEST-001", "DIRECT_FACT"),
      evidenceBlock("EV-TEST-002", "ANALYTICAL_INFERENCE"),
      evidenceBlock("EV-TEST-003", "UNKNOWN"),
      evidenceBlock("EV-TEST-004", "DIRECT_FACT", "CREATOR_CLAIM"),
    ].join("\n");
    const catalog = await createDirectorKnowledgeCatalog(await writeFixture(index, evidence));

    expect((catalog.get("DRAMA-PAT-001") as { evidenceRecords: Array<{ claimType: string }> }).evidenceRecords.map(({ claimType }) => claimType))
      .toEqual(["OBSERVED_ARTIFACT", "ILLUSTRATIVE_EXAMPLE", "UNKNOWN", "CREATOR_CLAIM"]);
  });

  it("summarizes structured validation practices and checks them against card counters", async () => {
    const index = validIndex();
    index.cards[0].ownProductionUses = 2;
    index.cards[0].ownAcceptedUses = 1;
    const validation = [
      "# 验证记录",
      "### PRACTICE-20260828-PROJECT-SHOT1",
      "- 计入人工接受：`YES`",
      "### PRACTICE-20260828-PROJECT-SHOT2",
      "- 计入人工接受：`NO`",
    ].join("\n\n");
    const catalog = await createDirectorKnowledgeCatalog(await writeFixture(index, undefined, validation));

    expect(catalog.overview().validation).toEqual({ practiceCount: 2, humanAcceptedCount: 1 });
  });

  it.each([
    ["schema v2", (index: ReturnType<typeof validIndex>) => { index.schemaVersion = 1; }],
    ["legal status", (index: ReturnType<typeof validIndex>) => { index.cards[0].status = "ACTIVE"; }],
    ["role semantics", (index: ReturnType<typeof validIndex>) => { index.cards[0].knowledgeAreas = ["script", "image-asset"]; }],
    ["non-empty usage fields", (index: ReturnType<typeof validIndex>) => { index.cards[0].usageContract.exclusions = []; }],
    ["real dates", (index: ReturnType<typeof validIndex>) => { index.cases[0].studiedAt = "2026-02-30"; }],
    ["semantic versions", (index: ReturnType<typeof validIndex>) => { index.standards[0].version = "v1"; }],
    ["cross references", (index: ReturnType<typeof validIndex>) => { index.cards[0].evidenceRefs = ["EV-MISSING-001"]; }],
    ["safe evidence paths", (index: ReturnType<typeof validIndex>) => { index.cases[0].evidenceDocument = "../outside.md"; }],
  ])("fails closed with KB_INVALID for invalid %s", async (_label, mutate) => {
    const index = validIndex();
    mutate(index);
    await expect(createDirectorKnowledgeCatalog(await writeFixture(index))).rejects.toMatchObject({ code: "KB_INVALID" });
  });

  it("rejects duplicate IDs and duplicate indexed paths before serving partial knowledge", async () => {
    const duplicateId = validIndex();
    duplicateId.cards.push({ ...structuredClone(duplicateId.cards[0]), path: "知识卡/duplicate.md" });
    await expect(createDirectorKnowledgeCatalog(await writeFixture(duplicateId))).rejects.toMatchObject({ code: "KB_INVALID" });

    const duplicatePath = validIndex();
    duplicatePath.cards.push({ ...structuredClone(duplicatePath.cards[0]), id: "DRAMA-PAT-002" });
    await expect(createDirectorKnowledgeCatalog(await writeFixture(duplicatePath))).rejects.toMatchObject({ code: "KB_INVALID" });
  });

  it("rejects evidence that exists but belongs to a case outside sourceCaseIds", async () => {
    const index = validIndex();
    index.cases.push({
      ...structuredClone(index.cases[0]),
      id: "CASE-20260828-OTHER",
      title: "另一个案例",
      path: "案例/CASE-20260828-OTHER/案例档案.md",
      evidenceDocument: "案例/CASE-20260828-OTHER/证据账本.md",
      derivedCardIds: [],
    });
    index.cards[0].evidenceRefs = ["EV-OTHER-001"];
    const root = await writeFixture(index);
    await mkdir(join(root, "案例", "CASE-20260828-OTHER"), { recursive: true });
    await Promise.all([
      writeFile(join(root, "案例", "CASE-20260828-OTHER", "案例档案.md"), "# Other\n", "utf8"),
      writeFile(join(root, "案例", "CASE-20260828-OTHER", "证据账本.md"), evidenceBlock("EV-OTHER-001"), "utf8"),
    ]);

    await expect(createDirectorKnowledgeCatalog(root)).rejects.toMatchObject({ code: "KB_INVALID" });
  });

  it("rejects malformed evidence and mismatched validation summaries", async () => {
    await expect(createDirectorKnowledgeCatalog(await writeFixture(validIndex(), evidenceBlock("EV-TEST-001").replace("2026-08-28", "2026-02-30"))))
      .rejects.toMatchObject({ code: "KB_INVALID" });

    const index = validIndex();
    index.cards[0].ownProductionUses = 1;
    await expect(createDirectorKnowledgeCatalog(await writeFixture(index, undefined, "# 没有 PRACTICE 记录\n")))
      .rejects.toMatchObject({ code: "KB_INVALID" });
  });
});
