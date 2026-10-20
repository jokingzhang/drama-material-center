import type { ProjectStoryReadModel, PromptReferencePreview, StoryAssetLink } from "../types/story";
import { responseError } from "./http";
import { projectLibraryPath } from "./routes";

export async function getProjectStory(projectId: string, episodeId?: string, signal?: AbortSignal) {
  const suffix = episodeId ? `/episodes/${encodeURIComponent(episodeId)}` : "";
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/story${suffix}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await responseError(response, "无法读取项目剧本业务索引。");
  return response.json() as Promise<ProjectStoryReadModel>;
}

export async function getPromptReferences(projectId: string, path: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ path });
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/prompt-references?${query}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await responseError(response, "无法读取提示词引用素材。");
  return response.json() as Promise<PromptReferencePreview>;
}

export function storyAssetLibraryPath(projectId: string, asset: Pick<StoryAssetLink, "path">) {
  const separator = asset.path.lastIndexOf("/");
  const directory = separator < 0 ? "" : asset.path.slice(0, separator);
  const search = new URLSearchParams({ file: asset.path, preview: "dialog" });
  return `${projectLibraryPath(projectId, directory)}?${search}`;
}
