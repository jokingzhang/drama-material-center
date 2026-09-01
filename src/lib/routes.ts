export function projectLibraryPath(projectId: string, directoryPath = "") {
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedDirectory = directoryPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/projects/${encodedProjectId}/library${encodedDirectory ? `/${encodedDirectory}` : ""}`;
}

export function projectStoryPath(projectId: string) {
  return `/projects/${encodeURIComponent(projectId)}/story`;
}

export type ProjectStorySection = "overview" | "characters" | "locations" | "episodes";

export function projectStorySectionPath(projectId: string, section: ProjectStorySection) {
  return `${projectStoryPath(projectId)}?section=${section}`;
}

export function projectStoryOverviewPath(projectId: string) {
  return projectStorySectionPath(projectId, "overview");
}

export function projectCharacterPath(projectId: string, characterId: string) {
  return `${projectStoryPath(projectId)}/characters/${encodeURIComponent(characterId)}`;
}

export function projectLocationPath(projectId: string, locationId: string) {
  return `${projectStoryPath(projectId)}/locations/${encodeURIComponent(locationId)}`;
}

export function projectEpisodePath(projectId: string, episodeId: string) {
  return `${projectStoryPath(projectId)}/episodes/${encodeURIComponent(episodeId)}`;
}

export function projectScenePath(projectId: string, episodeId: string, sceneId: string) {
  return `${projectEpisodePath(projectId, episodeId)}/scenes/${encodeURIComponent(sceneId)}`;
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
