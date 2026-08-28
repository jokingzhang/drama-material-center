import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import {
  RegisteredReadError,
  resolveRegisteredFile,
  sanitizePublicText,
  sanitizePublicUrl,
} from "./safeRegisteredRead.ts";

export type KnowledgeArea = "script" | "image-asset" | "shot-prompt";
export type KnowledgeAreaRole = "PRIMARY" | "CROSS_CUTTING";
export type KnowledgeEntryType = "standard" | "card" | "case";
export type EvidenceLegacyType = "DIRECT_FACT" | "ANALYTICAL_INFERENCE" | "UNKNOWN";
export type EvidenceClaimType =
  | "CREATOR_CLAIM"
  | "DOCUMENTED_PROCEDURE"
  | "ILLUSTRATIVE_EXAMPLE"
  | "OBSERVED_ARTIFACT"
  | "OBSERVED_RESULT"
  | "HUMAN_ACCEPTED_RESULT"
  | "UNKNOWN";

export interface EvidenceRecord {
  id: string;
  caseId: string;
  type: EvidenceLegacyType;
  claimType: EvidenceClaimType;
  source: string;
  inspection: string;
  observation: string;
  strength: "LOW" | "MEDIUM" | "HIGH";
  readAt: string;
}

export interface KnowledgeUsageContract {
  triggers: string[];
  exclusions: string[];
  requiredInputs: string[];
  outputTargets: string[];
  stopConditions: string[];
  acceptance: {
    machineChecks: string[];
    actualViewing: string[];
    actualListening: string[];
    humanAcceptance: string[];
  };
}

interface KnowledgeBaseIndex {
  schemaVersion: 2;
  validationDocument?: string;
  standards: KnowledgeStandardMeta[];
  cards: KnowledgeCardMeta[];
  cases: KnowledgeCaseMeta[];
}

interface KnowledgeCommonMeta {
  schemaVersion: 2;
  id: string;
  kind: string;
  title: string;
  path: string;
  domain: "narrative" | "visual-material" | "cinematography" | "workflow";
  knowledgeAreas: KnowledgeArea[];
  knowledgeAreaRole: KnowledgeAreaRole;
}

interface KnowledgeEvidenceOverride {
  feature: string;
  evidenceStatus: "OBSERVED" | "REUSABLE" | "VALIDATED";
  reason: string;
  representativeTestRequired: boolean;
  sourceCardIds: string[];
}

interface KnowledgeStandardMeta extends KnowledgeCommonMeta {
  kind: "asset-standard" | "shot-type" | "workflow-standard";
  policyStatus: "DRAFT" | "ACTIVE" | "RETIRED";
  evidenceStatus: "OBSERVED" | "REUSABLE" | "VALIDATED";
  version: string;
  tags: string[];
  triggerFeatures: string[];
  exclusionFeatures: string[];
  sourceCardIds: string[];
  evidenceOverrides?: KnowledgeEvidenceOverride[];
  createdAt: string;
  updatedAt: string;
  usageContract: KnowledgeUsageContract;
}

interface KnowledgeCardMeta extends KnowledgeCommonMeta {
  kind: "pattern" | "risk";
  status: "OBSERVED" | "REUSABLE" | "VALIDATED" | "RETIRED";
  tags: string[];
  sourceCaseIds: string[];
  evidenceRefs: string[];
  evidenceStrength: "LOW" | "MEDIUM" | "HIGH";
  sourceCount: number;
  ownProductionUses: number;
  ownAcceptedUses: number;
  createdAt: string;
  updatedAt: string;
  usageContract: KnowledgeUsageContract;
}

interface KnowledgeCaseMeta {
  schemaVersion: 2;
  id: string;
  kind: "case";
  origin: "external-work" | "own-production";
  title: string;
  path: string;
  studiedAt: string;
  sourceDocument: string;
  evidenceDocument: string;
  knowledgeAreas: KnowledgeArea[];
  knowledgeAreaRole: KnowledgeAreaRole;
  domains: KnowledgeCommonMeta["domain"][];
  sourceUrl?: string;
  sourceCaseIds?: string[];
  derivedCardIds: string[];
}

type KnowledgeRecord =
  | { entryType: "standard"; meta: KnowledgeStandardMeta; body: string }
  | { entryType: "card"; meta: KnowledgeCardMeta; body: string }
  | { entryType: "case"; meta: KnowledgeCaseMeta; body: string };

export interface DirectorKnowledgeFilter {
  area?: KnowledgeArea;
  layer?: "standard" | "pattern" | "risk" | "case";
  status?: string;
  query?: string;
}

export class DirectorKnowledgeError extends Error {
  constructor(
    readonly code: "KB_INVALID" | "KNOWLEDGE_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "DirectorKnowledgeError";
  }
}

const knowledgeAreas = ["script", "image-asset", "shot-prompt"] as const;
const domains = new Set(["narrative", "visual-material", "cinematography", "workflow"]);
const standardKinds = new Set(["asset-standard", "shot-type", "workflow-standard"]);
const cardKinds = new Set(["pattern", "risk"]);
const policyStatuses = new Set(["DRAFT", "ACTIVE", "RETIRED"]);
const evidenceStatuses = new Set(["OBSERVED", "REUSABLE", "VALIDATED"]);
const cardStatuses = new Set(["OBSERVED", "REUSABLE", "VALIDATED", "RETIRED"]);
const strengths = new Set(["LOW", "MEDIUM", "HIGH"]);
const caseOrigins = new Set(["external-work", "own-production"]);
const claimTypes = new Set<EvidenceClaimType>([
  "CREATOR_CLAIM",
  "DOCUMENTED_PROCEDURE",
  "ILLUSTRATIVE_EXAMPLE",
  "OBSERVED_ARTIFACT",
  "OBSERVED_RESULT",
  "HUMAN_ACCEPTED_RESULT",
  "UNKNOWN",
]);
const evidenceStatusRank = new Map([
  ["OBSERVED", 1],
  ["REUSABLE", 2],
  ["VALIDATED", 3],
]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const practiceIdPattern = /^PRACTICE-\d{8}-[A-Z0-9]+(?:-[A-Z0-9]+)+$/;

function invalid(message: string): never {
  throw new DirectorKnowledgeError("KB_INVALID", message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) invalid(`${label} 必须是对象。`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") invalid(`${label} 必须是非空字符串。`);
  return value;
}

function requireEnum<T extends string>(value: unknown, allowed: ReadonlySet<string>, label: string): T {
  if (typeof value !== "string" || !allowed.has(value)) invalid(`${label} 的枚举值无效。`);
  return value as T;
}

function requireStringArray(value: unknown, label: string, allowEmpty = false): string[] {
  if (!Array.isArray(value)
    || (!allowEmpty && value.length === 0)
    || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    invalid(`${label} 必须是${allowEmpty ? "" : "非空"}字符串数组。`);
  }
  if (new Set(value).size !== value.length) invalid(`${label} 不能包含重复值。`);
  return value as string[];
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) invalid(`${label} 必须是非负整数。`);
  return value as number;
}

function isRealDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function requireDate(value: unknown, label: string): string {
  const date = requireString(value, label);
  if (!isRealDate(date)) invalid(`${label} 必须是真实的 YYYY-MM-DD 日期。`);
  return date;
}

function requireKnowledgeClassification(value: Record<string, unknown>, label: string) {
  const areas = requireStringArray(value.knowledgeAreas, `${label}.knowledgeAreas`);
  if (!areas.every((area) => knowledgeAreas.includes(area as KnowledgeArea))) invalid(`${label}.knowledgeAreas 包含不支持的领域。`);
  const role = requireEnum<KnowledgeAreaRole>(value.knowledgeAreaRole, new Set(["PRIMARY", "CROSS_CUTTING"]), `${label}.knowledgeAreaRole`);
  if (role === "PRIMARY" && areas.length !== 1) invalid(`${label} 的 PRIMARY 条目必须且只能属于一个核心领域。`);
  if (role === "CROSS_CUTTING" && areas.length < 2) invalid(`${label} 的 CROSS_CUTTING 条目必须至少属于两个核心领域。`);
}

function requireUsageContract(value: unknown, label: string): KnowledgeUsageContract {
  const contract = requireObject(value, label);
  for (const key of ["triggers", "exclusions", "requiredInputs", "outputTargets", "stopConditions"] as const) {
    requireStringArray(contract[key], `${label}.${key}`);
  }
  const acceptance = requireObject(contract.acceptance, `${label}.acceptance`);
  for (const key of ["machineChecks", "actualViewing", "actualListening", "humanAcceptance"] as const) {
    requireStringArray(acceptance[key], `${label}.acceptance.${key}`);
  }
  return contract as unknown as KnowledgeUsageContract;
}

function requireCommonMeta(value: Record<string, unknown>, label: string) {
  if (value.schemaVersion !== 2) invalid(`${label}.schemaVersion 必须为 2。`);
  requireString(value.id, `${label}.id`);
  requireString(value.title, `${label}.title`);
  requireString(value.path, `${label}.path`);
  requireEnum(value.domain, domains, `${label}.domain`);
  requireKnowledgeClassification(value, label);
}

function validateStandard(value: unknown, index: number): KnowledgeStandardMeta {
  const label = `standards[${index}]`;
  const meta = requireObject(value, label);
  requireCommonMeta(meta, label);
  if (!/^DRAMA-STD-(?:ASSET|SHOT|WORKFLOW)-\d{3}$/.test(String(meta.id))) invalid(`${label}.id 格式无效。`);
  requireEnum(meta.kind, standardKinds, `${label}.kind`);
  requireEnum(meta.policyStatus, policyStatuses, `${label}.policyStatus`);
  requireEnum(meta.evidenceStatus, evidenceStatuses, `${label}.evidenceStatus`);
  if (typeof meta.version !== "string" || !/^\d+\.\d+\.\d+$/.test(meta.version)) invalid(`${label}.version 必须使用 x.y.z。`);
  requireStringArray(meta.tags, `${label}.tags`);
  requireStringArray(meta.triggerFeatures, `${label}.triggerFeatures`);
  requireStringArray(meta.exclusionFeatures, `${label}.exclusionFeatures`, true);
  requireStringArray(meta.sourceCardIds, `${label}.sourceCardIds`);
  requireDate(meta.createdAt, `${label}.createdAt`);
  requireDate(meta.updatedAt, `${label}.updatedAt`);
  requireUsageContract(meta.usageContract, `${label}.usageContract`);
  if (meta.evidenceOverrides !== undefined) {
    if (!Array.isArray(meta.evidenceOverrides)) invalid(`${label}.evidenceOverrides 必须是数组。`);
    const features = new Set<string>();
    meta.evidenceOverrides.forEach((candidate, overrideIndex) => {
      const overrideLabel = `${label}.evidenceOverrides[${overrideIndex}]`;
      const override = requireObject(candidate, overrideLabel);
      const feature = requireString(override.feature, `${overrideLabel}.feature`);
      if (features.has(feature)) invalid(`${label}.evidenceOverrides 不能重复声明 feature。`);
      features.add(feature);
      requireEnum(override.evidenceStatus, evidenceStatuses, `${overrideLabel}.evidenceStatus`);
      requireString(override.reason, `${overrideLabel}.reason`);
      if (typeof override.representativeTestRequired !== "boolean") invalid(`${overrideLabel}.representativeTestRequired 必须是布尔值。`);
      requireStringArray(override.sourceCardIds, `${overrideLabel}.sourceCardIds`);
    });
  }
  return meta as unknown as KnowledgeStandardMeta;
}

function validateCard(value: unknown, index: number): KnowledgeCardMeta {
  const label = `cards[${index}]`;
  const meta = requireObject(value, label);
  requireCommonMeta(meta, label);
  if (!/^DRAMA-(?:PAT|RISK)-\d{3}$/.test(String(meta.id))) invalid(`${label}.id 格式无效。`);
  const kind = requireEnum<KnowledgeCardMeta["kind"]>(meta.kind, cardKinds, `${label}.kind`);
  if ((kind === "pattern") !== String(meta.id).startsWith("DRAMA-PAT-")) invalid(`${label}.kind 与 id 不一致。`);
  requireEnum(meta.status, cardStatuses, `${label}.status`);
  requireStringArray(meta.tags, `${label}.tags`);
  const sourceCaseIds = requireStringArray(meta.sourceCaseIds, `${label}.sourceCaseIds`);
  requireStringArray(meta.evidenceRefs, `${label}.evidenceRefs`);
  requireEnum(meta.evidenceStrength, strengths, `${label}.evidenceStrength`);
  const sourceCount = requireNonNegativeInteger(meta.sourceCount, `${label}.sourceCount`);
  requireNonNegativeInteger(meta.ownProductionUses, `${label}.ownProductionUses`);
  const acceptedUses = requireNonNegativeInteger(meta.ownAcceptedUses, `${label}.ownAcceptedUses`);
  if (sourceCount !== sourceCaseIds.length) invalid(`${label}.sourceCount 与 sourceCaseIds 数量不一致。`);
  if (acceptedUses > Number(meta.ownProductionUses)) invalid(`${label}.ownAcceptedUses 不能超过 ownProductionUses。`);
  if (meta.status === "REUSABLE" && sourceCount < 2 && acceptedUses < 1) invalid(`${label} 不满足 REUSABLE 成熟度。`);
  if (meta.status === "VALIDATED" && acceptedUses < 2) invalid(`${label} 不满足 VALIDATED 成熟度。`);
  requireDate(meta.createdAt, `${label}.createdAt`);
  requireDate(meta.updatedAt, `${label}.updatedAt`);
  requireUsageContract(meta.usageContract, `${label}.usageContract`);
  return meta as unknown as KnowledgeCardMeta;
}

function validateCase(value: unknown, index: number): KnowledgeCaseMeta {
  const label = `cases[${index}]`;
  const meta = requireObject(value, label);
  if (meta.schemaVersion !== 2) invalid(`${label}.schemaVersion 必须为 2。`);
  const id = requireString(meta.id, `${label}.id`);
  if (!/^CASE-\d{8}-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(id)) invalid(`${label}.id 格式无效。`);
  if (meta.kind !== "case") invalid(`${label}.kind 必须为 case。`);
  requireEnum(meta.origin, caseOrigins, `${label}.origin`);
  requireString(meta.title, `${label}.title`);
  requireString(meta.path, `${label}.path`);
  requireDate(meta.studiedAt, `${label}.studiedAt`);
  requireString(meta.sourceDocument, `${label}.sourceDocument`);
  requireString(meta.evidenceDocument, `${label}.evidenceDocument`);
  const caseDomains = requireStringArray(meta.domains, `${label}.domains`);
  if (!caseDomains.every((domain) => domains.has(domain))) invalid(`${label}.domains 包含不支持的领域。`);
  requireStringArray(meta.derivedCardIds, `${label}.derivedCardIds`, true);
  requireKnowledgeClassification(meta, label);
  if (meta.sourceUrl !== undefined && typeof meta.sourceUrl !== "string") invalid(`${label}.sourceUrl 必须是字符串。`);
  if (meta.sourceCaseIds !== undefined) requireStringArray(meta.sourceCaseIds, `${label}.sourceCaseIds`, true);
  return meta as unknown as KnowledgeCaseMeta;
}

function parseIndex(value: unknown): KnowledgeBaseIndex {
  const root = requireObject(value, "知识索引");
  if (root.schemaVersion !== 2) invalid("导演知识索引 schemaVersion 必须为 2。");
  if (!Array.isArray(root.standards) || !Array.isArray(root.cards) || !Array.isArray(root.cases)) invalid("导演知识索引 standards、cards 和 cases 必须是数组。");
  if (root.validationDocument !== undefined) requireString(root.validationDocument, "validationDocument");
  const index: KnowledgeBaseIndex = {
    schemaVersion: 2,
    ...(root.validationDocument === undefined ? {} : { validationDocument: root.validationDocument as string }),
    standards: root.standards.map(validateStandard),
    cards: root.cards.map(validateCard),
    cases: root.cases.map(validateCase),
  };
  const seenIds = new Map<string, string>();
  const seenPaths = new Map<string, string>();
  for (const [entryType, entries] of [["standard", index.standards], ["card", index.cards], ["case", index.cases]] as const) {
    for (const meta of entries) {
      if (seenIds.has(meta.id)) invalid(`知识索引包含重复 ID：${meta.id}。`);
      seenIds.set(meta.id, entryType);
      const normalizedPath = posix.normalize(meta.path);
      if (seenPaths.has(normalizedPath)) invalid(`知识索引包含重复路径：${normalizedPath}。`);
      seenPaths.set(normalizedPath, meta.id);
    }
  }
  return index;
}

function stripFencedCode(text: string) {
  let fence: string | undefined;
  return text.split("\n").map((line) => {
    const marker = line.match(/^\s{0,3}(```+|~~~+)/)?.[1];
    if (marker) {
      if (!fence) fence = marker[0];
      else if (marker[0] === fence) fence = undefined;
      return " ".repeat(line.length);
    }
    return fence ? " ".repeat(line.length) : line;
  }).join("\n").replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, " "));
}

function extractIdBlocks(text: string, prefix: "EV-" | "PRACTICE-") {
  const clean = stripFencedCode(text);
  const matches = [...clean.matchAll(new RegExp(`^###\\s+(${prefix}[A-Z0-9-]+)\\b[^\\n]*$`, "gm"))];
  return matches.map((match, index) => ({ id: match[1], body: clean.slice(match.index! + match[0].length, matches[index + 1]?.index ?? clean.length) }));
}

function bulletValue(body: string, label: string) {
  return body.match(new RegExp(`^-\\s+${label}：\\s*(.*?)\\s*$`, "m"))?.[1]?.trim();
}

function unquote(value: string | undefined) {
  return value?.replace(/^`|`$/g, "").trim();
}

function defaultClaimType(type: EvidenceLegacyType): EvidenceClaimType {
  if (type === "DIRECT_FACT") return "OBSERVED_ARTIFACT";
  if (type === "ANALYTICAL_INFERENCE") return "ILLUSTRATIVE_EXAMPLE";
  return "UNKNOWN";
}

async function loadEvidenceRecords(root: string, meta: KnowledgeCaseMeta): Promise<EvidenceRecord[]> {
  const path = await resolveRegisteredFile(root, meta.evidenceDocument, [".md"]);
  const text = await readFile(path, "utf8");
  const blocks = extractIdBlocks(text, "EV-");
  if (blocks.length === 0) invalid(`案例 ${meta.id} 的证据账本没有 EV-* 条目。`);
  const seen = new Set<string>();
  return blocks.map(({ id, body }) => {
    if (!/^EV-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(id)) invalid(`案例 ${meta.id} 包含无效证据 ID。`);
    if (seen.has(id)) invalid(`案例 ${meta.id} 包含重复证据 ID：${id}。`);
    seen.add(id);
    const type = requireEnum<EvidenceLegacyType>(unquote(bulletValue(body, "类型")), new Set(["DIRECT_FACT", "ANALYTICAL_INFERENCE", "UNKNOWN"]), `${id}.类型`);
    const source = requireString(unquote(bulletValue(body, "来源")), `${id}.来源`);
    const inspection = requireString(unquote(bulletValue(body, "检查")), `${id}.检查`);
    const observation = requireString(unquote(bulletValue(body, "观察")), `${id}.观察`);
    const strength = requireEnum<EvidenceRecord["strength"]>(unquote(bulletValue(body, "可信度")), strengths, `${id}.可信度`);
    const readAt = requireDate(unquote(bulletValue(body, "读取日期")), `${id}.读取日期`);
    const explicitClaimType = unquote(bulletValue(body, "claimType") ?? bulletValue(body, "ClaimType") ?? bulletValue(body, "主张类型"));
    const claimType = explicitClaimType === undefined ? defaultClaimType(type) : requireEnum<EvidenceClaimType>(explicitClaimType, claimTypes, `${id}.claimType`);
    return {
      id,
      caseId: meta.id,
      type,
      claimType,
      source: sanitizePublicText(source),
      inspection: sanitizePublicText(inspection),
      observation: sanitizePublicText(observation),
      strength,
      readAt,
    };
  });
}

async function loadValidationSummary(root: string, index: KnowledgeBaseIndex) {
  const relativePath = index.validationDocument ?? "验证/验证记录.md";
  let text: string;
  try {
    const path = await resolveRegisteredFile(root, relativePath, [".md"]);
    text = await readFile(path, "utf8");
  } catch (error) {
    const expectedMissingDefault = index.validationDocument === undefined && error instanceof RegisteredReadError && error.code === "registered_file_not_found";
    if (!expectedMissingDefault) throw error;
    const declaredPracticeCount = index.cards.reduce((sum, card) => sum + card.ownProductionUses, 0);
    const declaredAcceptedCount = index.cards.reduce((sum, card) => sum + card.ownAcceptedUses, 0);
    if (declaredPracticeCount > 0 || declaredAcceptedCount > 0) invalid("知识卡声明了实践记录，但验证记录文件不存在。");
    return { practiceCount: 0, humanAcceptedCount: 0 };
  }
  const blocks = extractIdBlocks(text, "PRACTICE-");
  const seen = new Set<string>();
  let humanAcceptedCount = 0;
  for (const { id, body } of blocks) {
    if (!practiceIdPattern.test(id)) invalid(`验证记录包含无效 PRACTICE ID：${id}。`);
    if (seen.has(id)) invalid(`验证记录包含重复 PRACTICE ID：${id}。`);
    seen.add(id);
    const accepted = unquote(bulletValue(body, "计入人工接受"));
    if (accepted !== "YES" && accepted !== "NO") invalid(`${id} 必须明确计入人工接受为 YES 或 NO。`);
    if (accepted === "YES") humanAcceptedCount += 1;
  }
  const declaredPracticeCount = index.cards.reduce((sum, card) => sum + card.ownProductionUses, 0);
  const declaredAcceptedCount = index.cards.reduce((sum, card) => sum + card.ownAcceptedUses, 0);
  if (blocks.length !== declaredPracticeCount || humanAcceptedCount !== declaredAcceptedCount) invalid("知识卡实践计数与验证记录不一致。");
  return { practiceCount: blocks.length, humanAcceptedCount };
}

async function loadRecord(root: string, entryType: KnowledgeEntryType, meta: KnowledgeStandardMeta | KnowledgeCardMeta | KnowledgeCaseMeta): Promise<KnowledgeRecord> {
  const file = await resolveRegisteredFile(root, meta.path, [".md"]);
  const body = sanitizePublicText(await readFile(file, "utf8"));
  if (entryType === "standard") return { entryType, meta: meta as KnowledgeStandardMeta, body };
  if (entryType === "card") return { entryType, meta: meta as KnowledgeCardMeta, body };
  return { entryType, meta: meta as KnowledgeCaseMeta, body };
}

function validateRelationships(index: KnowledgeBaseIndex, evidenceById: Map<string, EvidenceRecord>, evidenceByCase: Map<string, EvidenceRecord[]>) {
  const cards = new Map(index.cards.map((card) => [card.id, card]));
  const cases = new Map(index.cases.map((caseMeta) => [caseMeta.id, caseMeta]));
  for (const caseMeta of index.cases) {
    for (const cardId of caseMeta.derivedCardIds) {
      const card = cards.get(cardId);
      if (!card) invalid(`${caseMeta.id}.derivedCardIds 引用了不存在的知识卡。`);
      if (!card.sourceCaseIds.includes(caseMeta.id)) invalid(`${caseMeta.id} 与 ${cardId} 的双向关系不一致。`);
    }
  }
  for (const card of index.cards) {
    const allowedEvidence = new Set<string>();
    for (const caseId of card.sourceCaseIds) {
      const caseMeta = cases.get(caseId);
      if (!caseMeta) invalid(`${card.id}.sourceCaseIds 引用了不存在的案例。`);
      if (!caseMeta.derivedCardIds.includes(card.id)) invalid(`${card.id} 与 ${caseId} 的双向关系不一致。`);
      for (const evidence of evidenceByCase.get(caseId) ?? []) allowedEvidence.add(evidence.id);
    }
    for (const evidenceId of card.evidenceRefs) {
      if (!evidenceById.has(evidenceId)) invalid(`${card.id}.evidenceRefs 引用了不存在的证据。`);
      if (!allowedEvidence.has(evidenceId)) invalid(`${card.id}.evidenceRefs 引用了不属于 sourceCaseIds 的证据。`);
    }
  }
  for (const standard of index.standards) {
    const sourceCards = standard.sourceCardIds.map((cardId) => {
      const card = cards.get(cardId);
      if (!card) invalid(`${standard.id}.sourceCardIds 引用了不存在的知识卡。`);
      return card;
    });
    const strongestRank = Math.max(0, ...sourceCards.map((card) => evidenceStatusRank.get(card.status) ?? 0));
    if ((evidenceStatusRank.get(standard.evidenceStatus) ?? Number.POSITIVE_INFINITY) > strongestRank) invalid(`${standard.id}.evidenceStatus 超过来源知识卡成熟度。`);
    for (const override of standard.evidenceOverrides ?? []) {
      const overrideCards = override.sourceCardIds.map((cardId) => {
        const card = cards.get(cardId);
        if (!card) invalid(`${standard.id}.evidenceOverrides 引用了不存在的知识卡。`);
        if (!standard.sourceCardIds.includes(cardId)) invalid(`${standard.id}.evidenceOverrides 的知识卡不在 sourceCardIds 中。`);
        return card;
      });
      const overrideRank = Math.max(0, ...overrideCards.map((card) => evidenceStatusRank.get(card.status) ?? 0));
      if ((evidenceStatusRank.get(override.evidenceStatus) ?? Number.POSITIVE_INFINITY) > overrideRank) invalid(`${standard.id}.evidenceOverrides 成熟度超过来源知识卡。`);
    }
  }
}

export async function createDirectorKnowledgeCatalog(root: string) {
  try {
    const indexPath = await resolveRegisteredFile(root, ".ai-director/index.json", [".json"]);
    const index = parseIndex(JSON.parse(await readFile(indexPath, "utf8")));
    const records = await Promise.all([
      ...index.standards.map((meta) => loadRecord(root, "standard", meta)),
      ...index.cards.map((meta) => loadRecord(root, "card", meta)),
      ...index.cases.map((meta) => loadRecord(root, "case", meta)),
    ]);
    const evidenceByCase = new Map<string, EvidenceRecord[]>();
    const evidenceById = new Map<string, EvidenceRecord>();
    for (const caseMeta of index.cases) {
      const evidenceRecords = await loadEvidenceRecords(root, caseMeta);
      evidenceByCase.set(caseMeta.id, evidenceRecords);
      for (const evidence of evidenceRecords) {
        if (evidenceById.has(evidence.id)) invalid(`证据 ID 在多个案例中重复：${evidence.id}。`);
        evidenceById.set(evidence.id, evidence);
      }
    }
    validateRelationships(index, evidenceById, evidenceByCase);
    const validation = await loadValidationSummary(root, index);
    const byId = new Map(records.map((record) => [record.meta.id, record]));
    return {
      overview() {
        const cards = records.filter((record): record is Extract<KnowledgeRecord, { entryType: "card" }> => record.entryType === "card");
        const standards = records.filter((record): record is Extract<KnowledgeRecord, { entryType: "standard" }> => record.entryType === "standard");
        const cases = records.filter((record): record is Extract<KnowledgeRecord, { entryType: "case" }> => record.entryType === "case");
        return {
          status: "VALID" as const,
          totals: { standards: standards.length, cards: cards.length, cases: cases.length, validatedCards: cards.filter((record) => record.meta.status === "VALIDATED").length },
          validation,
          areas: knowledgeAreas.map((id) => {
            const areaCards = cards.filter((record) => record.meta.knowledgeAreas.includes(id));
            const areaStandards = standards.filter((record) => record.meta.knowledgeAreas.includes(id));
            const areaCases = cases.filter((record) => record.meta.knowledgeAreas.includes(id));
            const primaryStandards = areaStandards.filter((record) => record.meta.knowledgeAreaRole === "PRIMARY").length;
            const gaps: string[] = [];
            if (primaryStandards === 0) gaps.push("NO_PRIMARY_STANDARD");
            if (areaCards.length === 0) gaps.push("NO_CARDS");
            if (!areaCards.some((record) => record.meta.status === "VALIDATED")) gaps.push("NO_VALIDATED_CARDS");
            return {
              id,
              primaryStandards,
              crossCuttingStandards: areaStandards.filter((record) => record.meta.knowledgeAreaRole === "CROSS_CUTTING").length,
              patterns: areaCards.filter((record) => record.meta.kind === "pattern").length,
              risks: areaCards.filter((record) => record.meta.kind === "risk").length,
              cases: areaCases.length,
              gaps,
            };
          }),
        };
      },

      list(filters: DirectorKnowledgeFilter = {}) {
        const query = filters.query?.trim().toLocaleLowerCase("zh-CN");
        return records
          .filter((record) => !filters.area || record.meta.knowledgeAreas.includes(filters.area))
          .filter((record) => !filters.layer || (filters.layer === "standard" && record.entryType === "standard") || (filters.layer === "case" && record.entryType === "case") || (record.entryType === "card" && record.meta.kind === filters.layer))
          .filter((record) => {
            if (!filters.status) return true;
            if (record.entryType === "standard") return record.meta.policyStatus === filters.status || record.meta.evidenceStatus === filters.status;
            return record.entryType === "card" && record.meta.status === filters.status;
          })
          .filter((record) => !query || [record.meta.id, record.meta.title, ...(record.entryType === "case" ? record.meta.domains : record.meta.tags), record.body].join(" ").toLocaleLowerCase("zh-CN").includes(query))
          .map((record) => ({
            id: record.meta.id,
            entryType: record.entryType,
            kind: record.meta.kind,
            title: record.meta.title,
            knowledgeAreas: record.meta.knowledgeAreas,
            knowledgeAreaRole: record.meta.knowledgeAreaRole,
            ...(record.entryType === "standard" ? { domain: record.meta.domain, version: record.meta.version, policyStatus: record.meta.policyStatus, evidenceStatus: record.meta.evidenceStatus } : {}),
            ...(record.entryType === "card" ? { domain: record.meta.domain, status: record.meta.status } : {}),
          }));
      },

      get(entryId: string) {
        const record = byId.get(entryId);
        if (!record) throw new DirectorKnowledgeError("KNOWLEDGE_NOT_FOUND", "导演知识条目不存在。");
        const meta = { ...record.meta } as Record<string, unknown>;
        delete meta.path;
        delete meta.evidenceDocument;
        delete meta.sourceDocument;
        if (typeof meta.sourceUrl === "string") meta.sourceUrl = sanitizePublicUrl(meta.sourceUrl);
        const evidenceRecords = record.entryType === "card"
          ? record.meta.evidenceRefs.map((id) => evidenceById.get(id)!)
          : record.entryType === "case" ? evidenceByCase.get(record.meta.id) ?? [] : undefined;
        return { ...meta, entryType: record.entryType, body: record.body, ...(evidenceRecords === undefined ? {} : { evidenceRecords }) };
      },

      hasEntry(entryId: string) {
        return byId.has(entryId);
      },

      entryType(entryId: string): KnowledgeEntryType | undefined {
        return byId.get(entryId)?.entryType;
      },
    };
  } catch (error) {
    if (error instanceof DirectorKnowledgeError) throw error;
    throw new DirectorKnowledgeError("KB_INVALID", "导演知识索引或登记文件无效。");
  }
}
