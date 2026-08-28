import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import {
  resolveRegisteredDirectory,
  resolveRegisteredFile,
  sanitizePublicText,
  sanitizePublicUrl,
} from "./safeRegisteredRead.ts";

type SourceType = "SCRIPT_SAMPLE" | "COURSE_MATERIAL" | "COMPLETED_WORK_CANVAS";
type CaptureCoverage = "CAPTURED_5" | "METADATA_ONLY" | "UNAVAILABLE" | "PARTIAL_EPISODES" | "NOT_APPLICABLE";
type InspectionDepth =
  | "UNAVAILABLE"
  | "METADATA_ONLY"
  | "METADATA_AND_EPISODE_SAMPLE"
  | "REGISTERED_CANDIDATE_ONLY"
  | "GRAPH_AND_MEDIA_SAMPLED";
type ClaimType =
  | "CREATOR_CLAIM"
  | "DOCUMENTED_PROCEDURE"
  | "ILLUSTRATIVE_EXAMPLE"
  | "OBSERVED_ARTIFACT"
  | "OBSERVED_RESULT"
  | "HUMAN_ACCEPTED_RESULT";
type FreshnessBasis = "CAPTURED_AT" | "SNAPSHOT_GENERATED_AT" | "REGISTRY_ONLY" | "STUDIED_AT";

interface SourceFreshness {
  basis: FreshnessBasis;
  asOf?: string;
  revalidationStatus: "NOT_REVALIDATED" | "NOT_IMPORTED";
}

interface ExpectedCatalogSummary {
  marketTotal: number;
  archivedTotal: number;
  unavailableTotal: number;
  capturedFiveTotal: number;
  metadataOnlyTotal: number;
  providers: Array<{
    provider: string;
    marketCount: number;
    archivedCount: number;
    unavailableCount: number;
    capturedFiveCount: number;
    metadataOnlyCount: number;
  }>;
}

interface SourceRegistrySnapshot {
  snapshotId: string;
  sourceType: SourceType;
  workspaceRelativePath: string;
  indexFile: string;
  checksumFile: string;
  providers: string[];
  expectedCatalog?: ExpectedCatalogSummary;
}

interface PendingSource {
  sourceId: string;
  sourceType: SourceType;
  provider: string;
  title: string;
  sourceUrl?: string;
  importStatus: "IMPORT_PENDING" | "MEDIA_NOT_IMPORTED";
  researchStatus: "UNSTUDIED" | "SELECTED" | "SOURCE_STUDIED" | "MEDIA_STUDIED";
  productionStages?: string[];
  relatedCaseIds?: string[];
  relatedKnowledgeIds?: string[];
  inspectionDepth: InspectionDepth;
  freshness: SourceFreshness;
  claimTypes: ClaimType[];
  rights?: {
    status: "RIGHTS_UNKNOWN";
    gate: "RIGHTS_REVIEW_REQUIRED";
  };
}

interface ScriptStudyRecord {
  sourceId: string;
  researchStatus: "SOURCE_STUDIED";
  relatedCaseIds: string[];
  relatedKnowledgeIds: string[];
  inspectionDepth: "METADATA_AND_EPISODE_SAMPLE";
  studiedAt: string;
  claimTypes: ClaimType[];
}

interface SourceRegistry {
  schemaVersion: 1;
  snapshots: SourceRegistrySnapshot[];
  sourceStudies?: ScriptStudyRecord[];
  pendingSources: PendingSource[];
}

interface SnapshotIndexEntry {
  id: string;
  title: string;
  episodes: number;
}

interface SnapshotIndex {
  schemaVersion: 1;
  generatedAt: string;
  platforms: Array<{
    site: string;
    marketCount: number;
    archivedCount: number;
    fullFiveCount: number;
    zeroEpisodeCount: number;
    savedEpisodeCount: number;
    entries: SnapshotIndexEntry[];
  }>;
  unavailable: Array<{ site: string; title: string; reason: string }>;
}

interface RawScriptSource {
  schemaVersion: 1;
  site: string;
  id: string;
  title: string;
  sourceUrl: string;
  capturedAt: string;
  accessScope: string;
  requestedEpisodeLimit: number;
  capturedEpisodeCount: number;
  availableFields: string[];
}

export interface SourceRecord {
  sourceId: string;
  snapshotId: string;
  sourceType: SourceType;
  provider: string;
  title: string;
  sourceUrl?: string;
  capturedAt?: string;
  captureCoverage: CaptureCoverage;
  requestedEpisodeLimit?: number;
  capturedEpisodeCount?: number;
  fullWorkCompleteness: "UNKNOWN";
  files: Array<{
    key: "metadata" | "summary" | "raw" | "media" | "image";
    relativePath: string;
    sha256?: string;
    integrity: "VERIFIED" | "FAILED" | "DECLARED" | "UNVERIFIED";
  }>;
  rights: {
    accessScope: string;
    status: "RIGHTS_UNKNOWN";
    gate: "RIGHTS_REVIEW_REQUIRED";
  };
  researchStatus: "UNSTUDIED" | "SELECTED" | "SOURCE_STUDIED" | "MEDIA_STUDIED";
  importStatus: "IMPORTED" | "IMPORT_PENDING" | "MEDIA_NOT_IMPORTED";
  productionStages: string[];
  relatedCaseIds: string[];
  relatedKnowledgeIds: string[];
  inspectionDepth: InspectionDepth;
  freshness: SourceFreshness;
  claimTypes: ClaimType[];
}

export interface SourceCatalogFilter {
  sourceType?: SourceType;
  provider?: string;
  captureCoverage?: CaptureCoverage;
  researchStatus?: SourceRecord["researchStatus"];
  query?: string;
}

export class SourceCatalogError extends Error {
  constructor(
    readonly code:
      | "SOURCE_REGISTRY_INVALID"
      | "SOURCE_NOT_FOUND"
      | "SOURCE_DOCUMENT_NOT_FOUND"
      | "SOURCE_DOCUMENT_INTEGRITY_FAILED"
      | "SOURCE_SECTION_NOT_FOUND"
      | "SOURCE_SECTION_AMBIGUOUS"
      | "SOURCE_SECTION_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "SourceCatalogError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const inspectionDepths = new Set<InspectionDepth>([
  "UNAVAILABLE",
  "METADATA_ONLY",
  "METADATA_AND_EPISODE_SAMPLE",
  "REGISTERED_CANDIDATE_ONLY",
  "GRAPH_AND_MEDIA_SAMPLED",
]);
const claimTypes = new Set<ClaimType>([
  "CREATOR_CLAIM",
  "DOCUMENTED_PROCEDURE",
  "ILLUSTRATIVE_EXAMPLE",
  "OBSERVED_ARTIFACT",
  "OBSERVED_RESULT",
  "HUMAN_ACCEPTED_RESULT",
]);
const freshnessBases = new Set<FreshnessBasis>([
  "CAPTURED_AT",
  "SNAPSHOT_GENERATED_AT",
  "REGISTRY_ONLY",
  "STUDIED_AT",
]);

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function isFreshness(value: unknown): value is SourceFreshness {
  return isObject(value)
    && freshnessBases.has(value.basis as FreshnessBasis)
    && (value.asOf === undefined || (typeof value.asOf === "string" && isIsoDate(value.asOf)))
    && (value.revalidationStatus === "NOT_REVALIDATED" || value.revalidationStatus === "NOT_IMPORTED")
    && (value.basis === "REGISTRY_ONLY" ? value.asOf === undefined : typeof value.asOf === "string")
    && (value.basis === "REGISTRY_ONLY" ? value.revalidationStatus === "NOT_IMPORTED" : value.revalidationStatus === "NOT_REVALIDATED");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && Boolean(item.trim()));
}

function isClaimTypes(value: unknown): value is ClaimType[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && claimTypes.has(item as ClaimType))
    && new Set(value).size === value.length;
}

function isExpectedCatalog(value: unknown) {
  if (!isObject(value)
    || !Number.isInteger(value.marketTotal)
    || !Number.isInteger(value.archivedTotal)
    || !Number.isInteger(value.unavailableTotal)
    || !Number.isInteger(value.capturedFiveTotal)
    || !Number.isInteger(value.metadataOnlyTotal)
    || !Array.isArray(value.providers)) return false;
  return value.providers.every((provider) => isObject(provider)
    && typeof provider.provider === "string"
    && Boolean(provider.provider.trim())
    && Number.isInteger(provider.marketCount)
    && Number.isInteger(provider.archivedCount)
    && Number.isInteger(provider.unavailableCount)
    && Number.isInteger(provider.capturedFiveCount)
    && Number.isInteger(provider.metadataOnlyCount));
}

function parseRegistry(value: unknown): SourceRegistry {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || !Array.isArray(value.snapshots)
    || (value.sourceStudies !== undefined && !Array.isArray(value.sourceStudies))
    || !Array.isArray(value.pendingSources)) {
    throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "导演来源登记表无效。");
  }
  const snapshotIds = new Set<string>();
  for (const snapshot of value.snapshots) {
    if (!isObject(snapshot)
      || typeof snapshot.snapshotId !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(snapshot.snapshotId)
      || snapshotIds.has(snapshot.snapshotId)
      || snapshot.sourceType !== "SCRIPT_SAMPLE"
      || typeof snapshot.workspaceRelativePath !== "string"
      || typeof snapshot.indexFile !== "string"
      || typeof snapshot.checksumFile !== "string"
      || !isStringArray(snapshot.providers)
      || (snapshot.expectedCatalog !== undefined && !isExpectedCatalog(snapshot.expectedCatalog))) {
      throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "导演来源快照登记无效。");
    }
    snapshotIds.add(snapshot.snapshotId);
  }
  const studiedIds = new Set<string>();
  for (const study of value.sourceStudies ?? []) {
    if (!isObject(study)
      || typeof study.sourceId !== "string"
      || !study.sourceId.startsWith("SCRIPT-")
      || studiedIds.has(study.sourceId)
      || study.researchStatus !== "SOURCE_STUDIED"
      || !isStringArray(study.relatedCaseIds)
      || !isStringArray(study.relatedKnowledgeIds)
      || study.inspectionDepth !== "METADATA_AND_EPISODE_SAMPLE"
      || typeof study.studiedAt !== "string"
      || !isIsoDate(study.studiedAt)
      || !isClaimTypes(study.claimTypes)) {
      throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "导演剧本研究登记无效。");
    }
    studiedIds.add(study.sourceId);
  }
  const pendingIds = new Set<string>();
  for (const source of value.pendingSources) {
    if (!isObject(source)
      || typeof source.sourceId !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(source.sourceId)
      || pendingIds.has(source.sourceId)
      || (source.sourceType !== "SCRIPT_SAMPLE" && source.sourceType !== "COURSE_MATERIAL" && source.sourceType !== "COMPLETED_WORK_CANVAS")
      || typeof source.provider !== "string"
      || !source.provider.trim()
      || typeof source.title !== "string"
      || !source.title.trim()
      || (source.sourceUrl !== undefined && (typeof source.sourceUrl !== "string" || !sanitizePublicUrl(source.sourceUrl)))
      || (source.importStatus !== "IMPORT_PENDING" && source.importStatus !== "MEDIA_NOT_IMPORTED")
      || (source.researchStatus !== "UNSTUDIED" && source.researchStatus !== "SELECTED" && source.researchStatus !== "SOURCE_STUDIED" && source.researchStatus !== "MEDIA_STUDIED")
      || (source.productionStages !== undefined && !isStringArray(source.productionStages))
      || (source.relatedCaseIds !== undefined && !isStringArray(source.relatedCaseIds))
      || (source.relatedKnowledgeIds !== undefined && !isStringArray(source.relatedKnowledgeIds))
      || !inspectionDepths.has(source.inspectionDepth as InspectionDepth)
      || !isFreshness(source.freshness)
      || !isClaimTypes(source.claimTypes)
      || (source.rights !== undefined && (!isObject(source.rights) || source.rights.status !== "RIGHTS_UNKNOWN" || source.rights.gate !== "RIGHTS_REVIEW_REQUIRED"))) {
      throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "导演待导入来源登记无效。");
    }
    pendingIds.add(source.sourceId);
  }
  return value as unknown as SourceRegistry;
}

function parseSnapshotIndex(value: unknown): SnapshotIndex {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || typeof value.generatedAt !== "string"
    || !isIsoDate(value.generatedAt)
    || !Array.isArray(value.platforms)
    || value.platforms.some((platform) => !isObject(platform)
      || typeof platform.site !== "string"
      || !Number.isInteger(platform.marketCount)
      || !Number.isInteger(platform.archivedCount)
      || !Number.isInteger(platform.fullFiveCount)
      || !Number.isInteger(platform.zeroEpisodeCount)
      || !Number.isInteger(platform.savedEpisodeCount)
      || !Array.isArray(platform.entries))
    || !Array.isArray(value.unavailable)
    || value.unavailable.some((entry) => !isObject(entry)
      || typeof entry.site !== "string"
      || typeof entry.title !== "string"
      || typeof entry.reason !== "string")) {
    throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "剧本来源快照索引无效。");
  }
  return value as unknown as SnapshotIndex;
}

function parseRawScriptSource(value: unknown): RawScriptSource {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || typeof value.site !== "string"
    || typeof value.id !== "string"
    || typeof value.title !== "string"
    || typeof value.sourceUrl !== "string"
    || typeof value.capturedAt !== "string"
    || !isIsoDate(value.capturedAt)
    || typeof value.accessScope !== "string"
    || typeof value.requestedEpisodeLimit !== "number"
    || typeof value.capturedEpisodeCount !== "number") {
    throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "剧本来源条目无效。");
  }
  return value as unknown as RawScriptSource;
}

function coverageFor(source: RawScriptSource): CaptureCoverage {
  if (source.capturedEpisodeCount === 0) return "METADATA_ONLY";
  if (source.capturedEpisodeCount === 5) return "CAPTURED_5";
  return "PARTIAL_EPISODES";
}

function inspectionDepthFor(coverage: CaptureCoverage): InspectionDepth {
  if (coverage === "UNAVAILABLE") return "UNAVAILABLE";
  if (coverage === "METADATA_ONLY") return "METADATA_ONLY";
  return "METADATA_AND_EPISODE_SAMPLE";
}

function assertExpectedCatalog(snapshotIndex: SnapshotIndex, expected?: ExpectedCatalogSummary) {
  if (!expected) return;
  const unavailableByProvider = new Map<string, number>();
  for (const unavailable of snapshotIndex.unavailable) {
    unavailableByProvider.set(unavailable.site, (unavailableByProvider.get(unavailable.site) ?? 0) + 1);
  }
  const actualProviders = snapshotIndex.platforms.map((platform) => ({
    provider: platform.site,
    marketCount: platform.marketCount,
    archivedCount: platform.archivedCount,
    unavailableCount: unavailableByProvider.get(platform.site) ?? 0,
    capturedFiveCount: platform.fullFiveCount,
    metadataOnlyCount: platform.zeroEpisodeCount,
  }));
  const actual = {
    marketTotal: actualProviders.reduce((total, provider) => total + provider.marketCount, 0),
    archivedTotal: actualProviders.reduce((total, provider) => total + provider.archivedCount, 0),
    unavailableTotal: snapshotIndex.unavailable.length,
    capturedFiveTotal: actualProviders.reduce((total, provider) => total + provider.capturedFiveCount, 0),
    metadataOnlyTotal: actualProviders.reduce((total, provider) => total + provider.metadataOnlyCount, 0),
    providers: actualProviders.sort((left, right) => left.provider.localeCompare(right.provider)),
  };
  const normalizedExpected = {
    ...expected,
    providers: [...expected.providers].sort((left, right) => left.provider.localeCompare(right.provider)),
  };
  if (JSON.stringify(actual) !== JSON.stringify(normalizedExpected)) {
    throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "剧本来源快照统计与登记基线不一致。");
  }
}

function posixRelative(root: string, target: string) {
  return relative(root, target).split(sep).join("/");
}

function parseChecksumManifest(value: string) {
  const checksums = new Map<string, string>();
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-fA-F0-9]{64})\s{1,2}(.+)$/);
    if (!match) throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "来源哈希清单格式无效。");
    const path = match[2].replace(/^\*/, "").split("\\").join("/");
    if (!path || isAbsolute(path) || path.split("/").includes("..") || checksums.has(path)) {
      throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "来源哈希清单包含不安全路径。");
    }
    checksums.set(path, match[1].toLowerCase());
  }
  return checksums;
}

interface MarkdownHeading {
  text: string;
  level: number;
  startIndex: number;
  bodyStartIndex: number;
}

function markdownHeadings(lines: string[]) {
  const headings: MarkdownHeading[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const atx = lines[index].match(/^(#{1,6})[\t ]+(.+?)(?:[\t ]+#+[\t ]*)?$/);
    if (atx) {
      headings.push({ text: atx[2].trim(), level: atx[1].length, startIndex: index, bodyStartIndex: index + 1 });
      continue;
    }
    if (index + 1 < lines.length && lines[index].trim()) {
      const setext = lines[index + 1].match(/^[\t ]*(=+|-+)[\t ]*$/);
      if (setext) {
        headings.push({
          text: lines[index].trim(),
          level: setext[1][0] === "=" ? 1 : 2,
          startIndex: index,
          bodyStartIndex: index + 2,
        });
        index += 1;
      }
    }
  }
  return headings;
}

function extractMarkdownSection(content: string, requestedHeading: string) {
  const heading = requestedHeading.trim();
  if (!heading || heading.length > 200 || /[\u0000-\u001f\u007f]/u.test(heading)) {
    throw new SourceCatalogError("SOURCE_SECTION_INVALID", "Markdown 章节标题无效。");
  }
  const lines = content.split(/\r?\n/);
  const headings = markdownHeadings(lines);
  const matches = headings.filter((candidate) => candidate.text === heading);
  if (matches.length === 0) {
    throw new SourceCatalogError("SOURCE_SECTION_NOT_FOUND", "Markdown 章节不存在。");
  }
  if (matches.length > 1) {
    throw new SourceCatalogError("SOURCE_SECTION_AMBIGUOUS", "Markdown 章节标题不唯一。");
  }
  const match = matches[0];
  const following = headings.find((candidate) => candidate.startIndex > match.startIndex && candidate.level === match.level);
  const endIndexExclusive = following?.startIndex ?? lines.length;
  return {
    content: lines.slice(match.startIndex, endIndexExclusive).join("\n"),
    locator: {
      kind: "MARKDOWN_HEADING" as const,
      heading: match.text,
      headingLevel: match.level,
      startLine: match.startIndex + 1,
      bodyStartLine: match.bodyStartIndex + 1,
      endLine: endIndexExclusive,
    },
  };
}

async function sha256(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function sourceFileRef(
  snapshotRoot: string,
  checksums: Map<string, string>,
  key: SourceRecord["files"][number]["key"],
  relativePath: string,
  verify: boolean,
) {
  const declared = checksums.get(relativePath);
  if (!declared) return { key, relativePath, integrity: "UNVERIFIED" as const };
  if (!verify) return { key, relativePath, sha256: declared, integrity: "DECLARED" as const };
  const file = await resolveRegisteredFile(snapshotRoot, relativePath, [".json", ".md", ".txt"]);
  const actual = await sha256(file);
  return {
    key,
    relativePath,
    sha256: declared,
    integrity: actual === declared ? "VERIFIED" as const : "FAILED" as const,
  };
}

async function loadSnapshot(
  workspaceRoot: string,
  snapshot: SourceRegistrySnapshot,
) {
  const snapshotRoot = await resolveRegisteredDirectory(workspaceRoot, snapshot.workspaceRelativePath);
  const indexFile = await resolveRegisteredFile(snapshotRoot, snapshot.indexFile, [".json"]);
  const checksumFile = await resolveRegisteredFile(snapshotRoot, snapshot.checksumFile, [""]);
  const snapshotIndex = parseSnapshotIndex(JSON.parse(await readFile(indexFile, "utf8")));
  assertExpectedCatalog(snapshotIndex, snapshot.expectedCatalog);
  const checksums = parseChecksumManifest(await readFile(checksumFile, "utf8"));
  const sources: SourceRecord[] = [];

  for (const provider of snapshot.providers) {
    const providerRoot = await resolveRegisteredDirectory(snapshotRoot, provider);
    const entries = await readdir(providerRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const sourceFile = await resolveRegisteredFile(providerRoot, `${entry.name}/source.json`, [".json"]);
      const source = parseRawScriptSource(JSON.parse(await readFile(sourceFile, "utf8")));
      if (source.site !== provider) throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "来源平台与登记目录不一致。");
      const captureCoverage = coverageFor(source);
      const itemRelativeRoot = posixRelative(snapshotRoot, sourceFile).replace(/\/source\.json$/, "");
      const files = await Promise.all([
        sourceFileRef(snapshotRoot, checksums, "metadata", `${itemRelativeRoot}/source.json`, true),
        sourceFileRef(snapshotRoot, checksums, "summary", `${itemRelativeRoot}/剧本资料.md`, false),
        sourceFileRef(snapshotRoot, checksums, "raw", `${itemRelativeRoot}/原始页面文本.txt`, false),
      ]);
      sources.push({
        sourceId: `SCRIPT-${source.site}-${source.id}`,
        snapshotId: snapshot.snapshotId,
        sourceType: snapshot.sourceType,
        provider: source.site,
        title: source.title,
        ...(sanitizePublicUrl(source.sourceUrl) ? { sourceUrl: sanitizePublicUrl(source.sourceUrl) } : {}),
        capturedAt: source.capturedAt,
        captureCoverage,
        requestedEpisodeLimit: source.requestedEpisodeLimit,
        capturedEpisodeCount: source.capturedEpisodeCount,
        fullWorkCompleteness: "UNKNOWN",
        files,
        rights: {
          accessScope: source.accessScope,
          status: "RIGHTS_UNKNOWN",
          gate: "RIGHTS_REVIEW_REQUIRED",
        },
        researchStatus: "UNSTUDIED",
        importStatus: "IMPORTED",
        productionStages: [],
        relatedCaseIds: [],
        relatedKnowledgeIds: [],
        inspectionDepth: inspectionDepthFor(captureCoverage),
        freshness: {
          basis: "CAPTURED_AT",
          asOf: source.capturedAt,
          revalidationStatus: "NOT_REVALIDATED",
        },
        claimTypes: ["OBSERVED_ARTIFACT"],
      });
    }
  }

  for (const unavailable of snapshotIndex.unavailable) {
    const stableTitle = Buffer.from(unavailable.title).toString("base64url").slice(0, 24);
    sources.push({
      sourceId: `SCRIPT-${unavailable.site}-unavailable-${stableTitle}`,
      snapshotId: snapshot.snapshotId,
      sourceType: snapshot.sourceType,
      provider: unavailable.site,
      title: unavailable.title,
      captureCoverage: "UNAVAILABLE",
      capturedEpisodeCount: 0,
      fullWorkCompleteness: "UNKNOWN",
      files: [],
      rights: {
        accessScope: "unavailable",
        status: "RIGHTS_UNKNOWN",
        gate: "RIGHTS_REVIEW_REQUIRED",
      },
      researchStatus: "UNSTUDIED",
      importStatus: "IMPORTED",
      productionStages: [],
      relatedCaseIds: [],
      relatedKnowledgeIds: [],
      inspectionDepth: "UNAVAILABLE",
      freshness: {
        basis: "SNAPSHOT_GENERATED_AT",
        asOf: snapshotIndex.generatedAt,
        revalidationStatus: "NOT_REVALIDATED",
      },
      claimTypes: ["OBSERVED_ARTIFACT"],
    });
  }
  return { sources, snapshotRoot };
}

export async function createSourceCatalog(options: { workspaceRoot: string; knowledgeRoot: string }) {
  try {
    const registryFile = await resolveRegisteredFile(options.knowledgeRoot, ".ai-director/source-registry.json", [".json"]);
    const registry = parseRegistry(JSON.parse(await readFile(registryFile, "utf8")));
    const loadedSnapshots = await Promise.all(registry.snapshots.map((snapshot) => loadSnapshot(options.workspaceRoot, snapshot)));
    const snapshotSources = loadedSnapshots.flatMap((snapshot) => snapshot.sources);
    const studies = new Map((registry.sourceStudies ?? []).map((study) => [study.sourceId, study]));
    const studiedSourceIds = new Set<string>();
    const enrichedSnapshotSources = snapshotSources.map((source) => {
      const study = studies.get(source.sourceId);
      if (!study) return source;
      studiedSourceIds.add(source.sourceId);
      return {
        ...source,
        researchStatus: study.researchStatus,
        relatedCaseIds: study.relatedCaseIds,
        relatedKnowledgeIds: study.relatedKnowledgeIds,
        inspectionDepth: study.inspectionDepth,
        freshness: {
          basis: "STUDIED_AT" as const,
          asOf: study.studiedAt,
          revalidationStatus: "NOT_REVALIDATED" as const,
        },
        claimTypes: study.claimTypes,
      };
    });
    if (studiedSourceIds.size !== studies.size) {
      throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "剧本研究登记引用了不存在的快照来源。");
    }
    const sources: SourceRecord[] = [
      ...enrichedSnapshotSources,
      ...registry.pendingSources.map((source): SourceRecord => ({
        sourceId: source.sourceId,
        snapshotId: "NOT_IMPORTED",
        sourceType: source.sourceType,
        provider: source.provider,
        title: source.title,
        ...(source.sourceUrl && sanitizePublicUrl(source.sourceUrl) ? { sourceUrl: sanitizePublicUrl(source.sourceUrl) } : {}),
        captureCoverage: "NOT_APPLICABLE",
        fullWorkCompleteness: "UNKNOWN",
        files: [],
        rights: { accessScope: "not-imported", ...(source.rights ?? { status: "RIGHTS_UNKNOWN", gate: "RIGHTS_REVIEW_REQUIRED" }) },
        researchStatus: source.researchStatus,
        importStatus: source.importStatus,
        productionStages: source.productionStages ?? [],
        relatedCaseIds: source.relatedCaseIds ?? [],
        relatedKnowledgeIds: source.relatedKnowledgeIds ?? [],
        inspectionDepth: source.inspectionDepth,
        freshness: source.freshness,
        claimTypes: source.claimTypes,
      })),
    ].sort((left, right) => left.sourceId.localeCompare(right.sourceId));
    if (new Set(sources.map((source) => source.sourceId)).size !== sources.length) {
      throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "导演来源 ID 重复。");
    }
    const byId = new Map(sources.map((source) => [source.sourceId, source]));
    const snapshotRootById = new Map(registry.snapshots.map((snapshot, index) => [snapshot.snapshotId, loadedSnapshots[index].snapshotRoot]));

    return {
      list(filters: SourceCatalogFilter = {}) {
        const query = filters.query?.trim().toLocaleLowerCase("zh-CN");
        const baselineSources = sources.filter((source) => !filters.sourceType || source.sourceType === filters.sourceType);
        const visibleSources = baselineSources
          .filter((source) => !filters.provider || source.provider === filters.provider)
          .filter((source) => !filters.captureCoverage || source.captureCoverage === filters.captureCoverage)
          .filter((source) => !filters.researchStatus || source.researchStatus === filters.researchStatus)
          .filter((source) => !query || `${source.sourceId} ${source.provider} ${source.title}`.toLocaleLowerCase("zh-CN").includes(query));
        const files = baselineSources.flatMap((source) => source.files);
        return {
          sources: visibleSources,
          filteredTotal: visibleSources.length,
          summary: {
            total: baselineSources.length,
            archived: baselineSources.filter((source) => source.importStatus === "IMPORTED" && source.captureCoverage !== "UNAVAILABLE").length,
            unavailable: baselineSources.filter((source) => source.captureCoverage === "UNAVAILABLE").length,
            capturedFive: baselineSources.filter((source) => source.captureCoverage === "CAPTURED_5").length,
            metadataOnly: baselineSources.filter((source) => source.captureCoverage === "METADATA_ONLY").length,
            partialEpisodes: baselineSources.filter((source) => source.captureCoverage === "PARTIAL_EPISODES").length,
            verifiedFiles: files.filter((file) => file.integrity === "VERIFIED").length,
            failedFiles: files.filter((file) => file.integrity === "FAILED").length,
            declaredFiles: files.filter((file) => file.integrity === "DECLARED").length,
            unverifiedFiles: files.filter((file) => file.integrity === "UNVERIFIED").length,
          },
        };
      },
      get(sourceId: string) {
        const source = byId.get(sourceId);
        if (!source) throw new SourceCatalogError("SOURCE_NOT_FOUND", "导演来源不存在。");
        return source;
      },
      async readDocument(
        sourceId: string,
        documentKey: "summary" | "raw",
        options: { section?: string } = {},
      ) {
        const source = byId.get(sourceId);
        if (!source) throw new SourceCatalogError("SOURCE_NOT_FOUND", "导演来源不存在。");
        if (documentKey === "raw" && options.section !== undefined) {
          throw new SourceCatalogError("SOURCE_SECTION_INVALID", "原始页面文本不支持章节读取。");
        }
        const document = source.files.find((file) => file.key === documentKey);
        const snapshotRoot = snapshotRootById.get(source.snapshotId);
        if (!document || !snapshotRoot) {
          throw new SourceCatalogError("SOURCE_DOCUMENT_NOT_FOUND", "导演来源文档尚未导入。");
        }
        try {
          const file = await resolveRegisteredFile(snapshotRoot, document.relativePath, documentKey === "summary" ? [".md"] : [".txt"]);
          const fileStat = await stat(file);
          if (fileStat.size > 2 * 1024 * 1024) {
            throw new SourceCatalogError("SOURCE_DOCUMENT_NOT_FOUND", "导演来源文档超过读取上限。");
          }
          if (!document.sha256 || await sha256(file) !== document.sha256) {
            throw new SourceCatalogError("SOURCE_DOCUMENT_INTEGRITY_FAILED", "导演来源文档完整性校验失败，已拒绝读取。");
          }
          const actualIntegrity = "VERIFIED" as const;
          const sanitizedContent = sanitizePublicText(await readFile(file, "utf8"));
          const selection = options.section === undefined
            ? {
                content: sanitizedContent,
                locator: {
                  kind: "FULL_DOCUMENT" as const,
                  startLine: 1,
                  endLine: sanitizedContent.split(/\r?\n/).length,
                },
              }
            : extractMarkdownSection(sanitizedContent, options.section);
          return {
            sourceId,
            documentKey,
            sha256: document.sha256,
            integrity: actualIntegrity,
            locator: {
              sourceId,
              snapshotId: source.snapshotId,
              relativePath: document.relativePath,
              sha256: document.sha256,
              integrity: actualIntegrity,
              section: selection.locator,
              rights: source.rights,
            },
            content: selection.content,
          };
        } catch (error) {
          if (error instanceof SourceCatalogError) throw error;
          throw new SourceCatalogError("SOURCE_DOCUMENT_NOT_FOUND", "导演来源文档尚未导入或登记已失效。");
        }
      },
    };
  } catch (error) {
    if (error instanceof SourceCatalogError) throw error;
    throw new SourceCatalogError("SOURCE_REGISTRY_INVALID", "导演来源登记表无效。");
  }
}
