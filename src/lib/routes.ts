export function projectLibraryPath(projectId: string, directoryPath = "") {
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedDirectory = directoryPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/projects/${encodedProjectId}/library${encodedDirectory ? `/${encodedDirectory}` : ""}`;
}

export function knowledgeAreaPath(area: string, documentPath = "") {
  const encodedDocumentPath = documentPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/knowledge/areas/${encodeURIComponent(area)}${encodedDocumentPath ? `/${encodedDocumentPath}` : ""}`;
}

export type KnowledgeCaseEntry = "image-asset" | "shot-prompt";

export function knowledgeCasePath(caseId: string, from?: KnowledgeCaseEntry) {
  const path = `/knowledge/cases/${encodeURIComponent(caseId)}`;
  return from ? `${path}?from=${encodeURIComponent(from)}` : path;
}

// Compatibility helpers for disconnected legacy views. DirectorKnowledgePage no longer
// routes to these locations; keeping the pure URL builders avoids rewriting paused work.
export function knowledgeEntryPath(entryId: string) {
  return `/knowledge/items/${encodeURIComponent(entryId)}`;
}

export function knowledgeSourcePath(category: string, sourceId?: string) {
  return `/knowledge/sources/${encodeURIComponent(category)}${sourceId ? `/${encodeURIComponent(sourceId)}` : ""}`;
}

export function knowledgeUsagePath(projectId?: string, analysisId?: string) {
  if (!projectId) return "/knowledge/usage";
  return `/knowledge/usage/${encodeURIComponent(projectId)}${analysisId ? `/${encodeURIComponent(analysisId)}` : ""}`;
}
