import type {
  AnalysisDetail,
  AnalysisSummary,
  KnowledgeArea,
  KnowledgeEntryDetail,
  KnowledgeListEntry,
  KnowledgeOverview,
  SourceCatalogResponse,
  SourceDocumentResponse,
  SourceRecord,
} from "./directorKnowledgeTypes";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const value = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(value.error || "无法读取导演知识库");
  return value;
}

export function getKnowledgeOverview(signal?: AbortSignal) {
  return getJson<KnowledgeOverview>("/api/director/overview", signal);
}

export function getKnowledgeEntries(filters: { area?: KnowledgeArea; layer?: string; status?: string; q?: string }, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (filters.area) query.set("area", filters.area);
  if (filters.layer) query.set("layer", filters.layer);
  if (filters.status) query.set("status", filters.status);
  if (filters.q) query.set("q", filters.q);
  return getJson<{ entries: KnowledgeListEntry[] }>(`/api/director/knowledge${query.size ? `?${query}` : ""}`, signal);
}

export function getKnowledgeEntry(entryId: string, signal?: AbortSignal) {
  return getJson<{ entry: KnowledgeEntryDetail }>(`/api/director/knowledge/${encodeURIComponent(entryId)}`, signal);
}

export function getDirectorSources(filters: { type?: string; provider?: string; coverage?: string; research?: string; q?: string }, signal?: AbortSignal) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return getJson<SourceCatalogResponse>(`/api/director/sources${query.size ? `?${query}` : ""}`, signal);
}

export function getDirectorSource(sourceId: string, signal?: AbortSignal) {
  return getJson<{ source: SourceRecord }>(`/api/director/sources/${encodeURIComponent(sourceId)}`, signal);
}

export function getDirectorSourceDocument(sourceId: string, documentKey: "summary" | "raw", section?: string, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (section) query.set("section", section);
  return getJson<{ document: SourceDocumentResponse }>(
    `/api/director/sources/${encodeURIComponent(sourceId)}/documents/${documentKey}${query.size ? `?${query}` : ""}`,
    signal,
  );
}

export function getProjectAnalyses(projectId: string, signal?: AbortSignal) {
  return getJson<{ status: "EMPTY" | "AVAILABLE"; analyses: AnalysisSummary[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/analyses`,
    signal,
  );
}

export function getProjectAnalysis(projectId: string, analysisId: string, signal?: AbortSignal) {
  return getJson<{ analysis: AnalysisDetail }>(
    `/api/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId)}`,
    signal,
  );
}
