export function projectLibraryPath(projectId: string, directoryPath = "") {
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedDirectory = directoryPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/projects/${encodedProjectId}/library${encodedDirectory ? `/${encodedDirectory}` : ""}`;
}

export function knowledgeAreaPath(area: string) {
  return `/knowledge/areas/${encodeURIComponent(area)}`;
}

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
