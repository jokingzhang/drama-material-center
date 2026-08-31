import type { ProjectStoryReadModel, StoryAssetLink } from "../types/story";
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

export function storyAssetLibraryPath(projectId: string, asset: Pick<StoryAssetLink, "path">) {
  const separator = asset.path.lastIndexOf("/");
  const directory = separator < 0 ? "" : asset.path.slice(0, separator);
  const search = new URLSearchParams({ file: asset.path, preview: "dialog" });
  return `${projectLibraryPath(projectId, directory)}?${search}`;
}
