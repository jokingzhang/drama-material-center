import type { CreateProjectInput, MaterialResponse, MaterialTextSearchResponse, ProjectSummary, ProjectsResponse } from "../types";
import { responseError } from "./http";

export async function getProjects() {
  const response = await fetch("/api/projects", { cache: "no-store" });
  if (!response.ok) throw await responseError(response, "无法读取本地项目列表。");
  return response.json() as Promise<ProjectsResponse>;
}

export async function createProject(input: CreateProjectInput) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response, "无法创建项目。");
  return (await response.json() as { project: ProjectSummary }).project;
}

export async function uploadProjectCover(projectId: string, file: File) {
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("封面仅支持 PNG、JPEG、WebP 或 GIF 图片。");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("封面图片不能超过 10 MB。");

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/cover`, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) throw await responseError(response, "无法保存项目封面。");
  return (await response.json() as { project: ProjectSummary }).project;
}

export async function getMaterials(projectId: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, { cache: "no-store" });
  if (!response.ok) throw await responseError(response, "无法读取本地素材目录，请确认站点通过 npm run dev 启动。");
  return response.json() as Promise<MaterialResponse>;
}

export async function searchMaterialText(projectId: string, query: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/search?q=${encodeURIComponent(query)}`,
    { cache: "no-store", signal },
  );
  if (!response.ok) throw await responseError(response, "无法搜索文档正文。");
  return response.json() as Promise<MaterialTextSearchResponse>;
}

export async function getMaterialSummary(projectId: string, path: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/summary?path=${encodeURIComponent(path)}`,
    { cache: "no-store", signal },
  );
  if (!response.ok) throw await responseError(response, "无法读取文档摘要。");
  return response.json() as Promise<{ content: string; bytesRead: number; truncated: boolean }>;
}

export async function revealMaterial(projectId: string, path?: string) {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/reveal${query}`, { method: "POST" });
  if (!response.ok) throw await responseError(response, "无法打开 Finder，请手动打开项目素材目录。");
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unit);
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
