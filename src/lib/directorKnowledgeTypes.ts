export type KnowledgeArea = "script" | "image-asset" | "shot-prompt";
export type KnowledgeEntryType = "standard" | "card" | "case";

export interface KnowledgeAreaSummary {
  id: KnowledgeArea;
  primaryStandards: number;
  crossCuttingStandards: number;
  patterns: number;
  risks: number;
  cases: number;
  gaps: string[];
}

export interface KnowledgeOverview {
  status: "VALID";
  totals: { standards: number; cards: number; cases: number; validatedCards: number };
  validation: { practiceCount: number; humanAcceptedCount: number };
  areas: KnowledgeAreaSummary[];
}

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
  type: "DIRECT_FACT" | "ANALYTICAL_INFERENCE" | "UNKNOWN";
  claimType: EvidenceClaimType;
  source: string;
  inspection: string;
  observation: string;
  strength: "LOW" | "MEDIUM" | "HIGH";
  readAt: string;
}

export interface KnowledgeListEntry {
  id: string;
  entryType: KnowledgeEntryType;
  kind: string;
  title: string;
  knowledgeAreas: KnowledgeArea[];
  knowledgeAreaRole: "PRIMARY" | "CROSS_CUTTING";
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

export interface KnowledgeEntryDetail extends KnowledgeListEntry {
  body: string;
  version?: string;
  policyStatus?: string;
  evidenceStatus?: string;
  status?: string;
  domain?: string;
  origin?: "external-work" | "own-production";
  createdAt?: string;
  updatedAt?: string;
  studiedAt?: string;
  sourceUrl?: string;
  tags?: string[];
  sourceCardIds?: string[];
  sourceCaseIds?: string[];
  evidenceRefs?: string[];
  evidenceOverrides?: Array<{
    feature?: string;
    evidenceStatus?: string;
    representativeTestRequired?: boolean;
    sourceCardIds?: string[];
  }>;
  derivedCardIds?: string[];
  evidenceRecords?: EvidenceRecord[];
  evidenceStrength?: "LOW" | "MEDIUM" | "HIGH";
  sourceCount?: number;
  ownProductionUses?: number;
  ownAcceptedUses?: number;
  usageContract?: KnowledgeUsageContract;
}

export type SourceType = "SCRIPT_SAMPLE" | "COURSE_MATERIAL" | "COMPLETED_WORK_CANVAS";
export type CaptureCoverage = "CAPTURED_5" | "METADATA_ONLY" | "UNAVAILABLE" | "PARTIAL_EPISODES" | "NOT_APPLICABLE";
export type InspectionDepth = "UNAVAILABLE" | "METADATA_ONLY" | "METADATA_AND_EPISODE_SAMPLE" | "REGISTERED_CANDIDATE_ONLY" | "GRAPH_AND_MEDIA_SAMPLED";
export type SourceClaimType = Exclude<EvidenceClaimType, "UNKNOWN">;

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
    integrity: "VERIFIED" | "DECLARED" | "FAILED" | "UNVERIFIED";
  }>;
  rights: { accessScope: string; status: "RIGHTS_UNKNOWN"; gate: "RIGHTS_REVIEW_REQUIRED" };
  researchStatus: "UNSTUDIED" | "SELECTED" | "SOURCE_STUDIED" | "MEDIA_STUDIED";
  importStatus: "IMPORTED" | "IMPORT_PENDING" | "MEDIA_NOT_IMPORTED";
  productionStages: string[];
  relatedCaseIds: string[];
  relatedKnowledgeIds: string[];
  inspectionDepth: InspectionDepth;
  freshness: {
    basis: "CAPTURED_AT" | "SNAPSHOT_GENERATED_AT" | "REGISTRY_ONLY" | "STUDIED_AT";
    asOf?: string;
    revalidationStatus: "NOT_REVALIDATED" | "NOT_IMPORTED";
  };
  claimTypes: SourceClaimType[];
}

export interface SourceDocumentResponse {
  sourceId: string;
  documentKey: "summary" | "raw";
  sha256?: string;
  integrity: "VERIFIED" | "FAILED" | "DECLARED" | "UNVERIFIED";
  locator: {
    sourceId: string;
    snapshotId: string;
    relativePath: string;
    sha256?: string;
    integrity: "VERIFIED" | "FAILED" | "DECLARED" | "UNVERIFIED";
    section: {
      kind: "FULL_DOCUMENT" | "MARKDOWN_HEADING";
      heading?: string;
      headingLevel?: number;
      startLine: number;
      bodyStartLine?: number;
      endLine: number;
    };
    rights: SourceRecord["rights"];
  };
  content: string;
}

export interface SourceCatalogResponse {
  filteredTotal: number;
  summary: {
    total: number;
    archived: number;
    unavailable: number;
    capturedFive: number;
    metadataOnly: number;
    partialEpisodes: number;
    verifiedFiles: number;
    declaredFiles: number;
    failedFiles: number;
    unverifiedFiles: number;
  };
  sources: SourceRecord[];
}

export type KnowledgeUseDisposition = "ADOPTED" | "REJECTED_CONDITION" | "OVERRIDDEN_BY_HIGHER_PRIORITY";

export interface KnowledgeUse {
  entryId: string;
  entryKind: "standard" | "card" | "case";
  disposition: KnowledgeUseDisposition;
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
  override?: { authority: string; locator: string; summary: string };
}

export interface AnalysisSummary {
  analysisId: string;
  createdAt: string;
  knowledgeUseCounts: { adopted: number; rejected: number; overridden: number };
}

export interface AnalysisDetail {
  analysisId: string;
  createdAt: string;
  projectId?: string;
  title?: string;
  knowledgeUsed: KnowledgeUse[];
  [key: string]: unknown;
}
