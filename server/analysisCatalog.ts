import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import {
  resolveRegisteredDirectory,
  resolveRegisteredFile,
  RegisteredReadError,
  sanitizePublicText,
} from "./safeRegisteredRead.ts";

const projectIdPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const analysisIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const dispositions = new Set(["ADOPTED", "REJECTED_CONDITION", "OVERRIDDEN_BY_HIGHER_PRIORITY"]);
const overrideAuthorities = new Set(["USER_DECISION", "PROJECT_FACT", "APPROVED_CONTRACT"]);

interface AnalysisIndexEntry {
  analysisId: string;
  path: string;
}

interface AnalysisIndex {
  schemaVersion: 1;
  analyses: AnalysisIndexEntry[];
}

export interface KnowledgeUse {
  entryId: string;
  entryKind: "standard" | "card" | "case";
  disposition: "ADOPTED" | "REJECTED_CONDITION" | "OVERRIDDEN_BY_HIGHER_PRIORITY";
  reason: string;
  matchedTriggers: string[];
  matchedExclusions: string[];
  missingInputs: string[];
  outputRefs: Array<{ artifact: string; locator: string }>;
  entrySnapshot: {
    title: string;
    version?: string;
    policyStatus?: string;
    evidenceStatus?: string;
    maturity?: string;
    updatedAt?: string;
  };
  override?: {
    authority: "USER_DECISION" | "PROJECT_FACT" | "APPROVED_CONTRACT";
    locator: string;
    summary: string;
  };
}

export interface KnowledgeEntryResolver {
  hasEntry(entryId: string): boolean;
  entryType(entryId: string): "standard" | "card" | "case" | undefined;
}

export interface ScriptProductionAnalysis {
  schemaVersion: 1;
  kind: "ScriptProductionAnalysis";
  analysisId: string;
  projectId: string;
  createdAt: string;
  sourceBinding: { relativePath: string; sha256?: string; [key: string]: unknown };
  knowledgeUsed: KnowledgeUse[];
  [key: string]: unknown;
}

export class AnalysisCatalogError extends Error {
  constructor(
    readonly code: "PROJECT_NOT_FOUND" | "ANALYSIS_INDEX_INVALID" | "ANALYSIS_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "AnalysisCatalogError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseIndex(value: unknown): AnalysisIndex {
  if (!isObject(value) || value.schemaVersion !== 1 || !Array.isArray(value.analyses)) {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "分析索引无效。");
  }
  const ids = new Set<string>();
  for (const entry of value.analyses) {
    if (!isObject(entry)
      || typeof entry.analysisId !== "string"
      || !analysisIdPattern.test(entry.analysisId)
      || typeof entry.path !== "string"
      || isAbsolute(entry.path)
      || ids.has(entry.analysisId)) {
      throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "分析索引条目无效。");
    }
    ids.add(entry.analysisId);
  }
  return value as unknown as AnalysisIndex;
}

function parseKnowledgeUse(value: unknown, knowledge: KnowledgeEntryResolver): KnowledgeUse {
  if (!isObject(value)
    || typeof value.entryId !== "string"
    || !value.entryId.trim()
    || (value.entryKind !== "standard" && value.entryKind !== "card" && value.entryKind !== "case")
    || typeof value.disposition !== "string"
    || !dispositions.has(value.disposition)
    || typeof value.reason !== "string"
    || !value.reason.trim()
    || !isStringArray(value.matchedTriggers)
    || !isStringArray(value.matchedExclusions)
    || !isStringArray(value.missingInputs)
    || !Array.isArray(value.outputRefs)
    || value.outputRefs.some((item) => !isObject(item) || typeof item.artifact !== "string" || typeof item.locator !== "string")
    || !isObject(value.entrySnapshot)
    || typeof value.entrySnapshot.title !== "string"
    || !value.entrySnapshot.title.trim()) {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "知识使用记录无效。");
  }
  if (!knowledge.hasEntry(value.entryId) || knowledge.entryType(value.entryId) !== value.entryKind) {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "知识使用记录引用了不存在或类型不一致的知识条目。");
  }
  if (value.entryKind === "standard"
    && (typeof value.entrySnapshot.version !== "string"
      || typeof value.entrySnapshot.policyStatus !== "string"
      || typeof value.entrySnapshot.evidenceStatus !== "string")) {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "标准知识记录缺少版本、策略状态或证据状态快照。");
  }
  if (value.entryKind === "card" && typeof value.entrySnapshot.maturity !== "string") {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "知识卡使用记录缺少成熟度快照。");
  }
  if (value.entryKind === "case"
    && (typeof value.entrySnapshot.updatedAt !== "string" || Number.isNaN(Date.parse(value.entrySnapshot.updatedAt)))) {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "案例使用记录缺少有效的研究时间快照。");
  }
  if (value.disposition === "ADOPTED" && value.outputRefs.length === 0) {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "采用的知识必须指向受影响产物。");
  }
  if (value.disposition === "REJECTED_CONDITION"
    && value.matchedExclusions.length === 0
    && value.missingInputs.length === 0) {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "拒绝的知识必须记录排除条件或缺失输入。");
  }
  if (value.disposition === "OVERRIDDEN_BY_HIGHER_PRIORITY") {
    if (!isObject(value.override)
      || typeof value.override.authority !== "string"
      || !overrideAuthorities.has(value.override.authority)
      || typeof value.override.locator !== "string"
      || typeof value.override.summary !== "string") {
      throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "被覆盖的知识必须记录更高优先级依据。");
    }
  }
  return value as unknown as KnowledgeUse;
}

function sanitizeUnknown<T>(value: T): T {
  if (typeof value === "string") return sanitizePublicText(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item)) as T;
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeUnknown(item)])) as T;
  }
  return value;
}

function parseAnalysis(value: unknown, expectedId: string, projectId: string, knowledge: KnowledgeEntryResolver): ScriptProductionAnalysis {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || value.kind !== "ScriptProductionAnalysis"
    || value.analysisId !== expectedId
    || value.projectId !== projectId
    || typeof value.createdAt !== "string"
    || Number.isNaN(Date.parse(value.createdAt))
    || !isObject(value.sourceBinding)
    || typeof value.sourceBinding.relativePath !== "string"
    || isAbsolute(value.sourceBinding.relativePath)
    || value.sourceBinding.relativePath.split(/[\\/]/).includes("..")
    || !Array.isArray(value.knowledgeUsed)) {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "分析产物无效。");
  }
  const analysis = value as unknown as ScriptProductionAnalysis;
  analysis.knowledgeUsed = analysis.knowledgeUsed.map((use) => parseKnowledgeUse(use, knowledge));
  return sanitizeUnknown(analysis);
}

async function resolveProjectRoot(workspaceRoot: string, projectId: string) {
  if (!projectIdPattern.test(projectId)) {
    throw new AnalysisCatalogError("PROJECT_NOT_FOUND", "项目不存在。");
  }
  try {
    const projectRoot = await resolveRegisteredDirectory(workspaceRoot, projectId);
    const manifest = JSON.parse(await readFile(await resolveRegisteredFile(projectRoot, "project.json", [".json"]), "utf8")) as unknown;
    if (!isObject(manifest) || manifest.schemaVersion !== 1 || typeof manifest.name !== "string") {
      throw new AnalysisCatalogError("PROJECT_NOT_FOUND", "项目不存在。");
    }
    return projectRoot;
  } catch (error) {
    if (error instanceof AnalysisCatalogError) throw error;
    throw new AnalysisCatalogError("PROJECT_NOT_FOUND", "项目不存在。");
  }
}

export async function createAnalysisCatalog(workspaceRoot: string, projectId: string, knowledge?: KnowledgeEntryResolver) {
  const projectRoot = await resolveProjectRoot(workspaceRoot, projectId);
  let indexFile: string;
  try {
    indexFile = await resolveRegisteredFile(projectRoot, ".ai-director/analysis-index.json", [".json"]);
  } catch (error) {
    if (error instanceof RegisteredReadError && error.code === "registered_file_not_found") {
      return {
        list: () => ({ status: "EMPTY" as const, analyses: [] }),
        get: (_analysisId: string): ScriptProductionAnalysis => {
          throw new AnalysisCatalogError("ANALYSIS_NOT_FOUND", "结构化分析产物不存在。");
        },
      };
    }
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "分析索引无效。");
  }

  let index: AnalysisIndex;
  try {
    index = parseIndex(JSON.parse(await readFile(indexFile, "utf8")));
  } catch (error) {
    if (error instanceof AnalysisCatalogError) throw error;
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "分析索引无效。");
  }

  if (!knowledge) {
    throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "缺少导演知识目录，无法校验分析中的知识使用记录。");
  }

  const analyses = await Promise.all(index.analyses.map(async (entry) => {
    try {
      const file = await resolveRegisteredFile(projectRoot, entry.path, [".json"]);
      return parseAnalysis(JSON.parse(await readFile(file, "utf8")), entry.analysisId, projectId, knowledge);
    } catch (error) {
      if (error instanceof AnalysisCatalogError) throw error;
      throw new AnalysisCatalogError("ANALYSIS_INDEX_INVALID", "分析索引引用了无效文件。");
    }
  }));
  const byId = new Map(analyses.map((analysis) => [analysis.analysisId, analysis]));

  return {
    list() {
      return {
        status: "AVAILABLE" as const,
        analyses: analyses.map((analysis) => ({
          analysisId: analysis.analysisId,
          createdAt: analysis.createdAt,
          knowledgeUseCounts: {
            adopted: analysis.knowledgeUsed.filter((use) => use.disposition === "ADOPTED").length,
            rejected: analysis.knowledgeUsed.filter((use) => use.disposition === "REJECTED_CONDITION").length,
            overridden: analysis.knowledgeUsed.filter((use) => use.disposition === "OVERRIDDEN_BY_HIGHER_PRIORITY").length,
          },
        })),
      };
    },
    get(analysisId: string) {
      const analysis = byId.get(analysisId);
      if (!analysis) throw new AnalysisCatalogError("ANALYSIS_NOT_FOUND", "结构化分析产物不存在。");
      return analysis;
    },
  };
}
