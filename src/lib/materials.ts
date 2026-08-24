import type { MaterialResponse } from "../types";

export async function getMaterials() {
  const response = await fetch("/api/material-library/files", { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取本地素材目录，请确认站点通过 npm run dev 启动。");
  return response.json() as Promise<MaterialResponse>;
}

export async function revealMaterial(path?: string) {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const response = await fetch(`/api/material-library/reveal${query}`, { method: "POST" });
  if (!response.ok) throw new Error("无法打开 Finder，请手动打开 material-library/library。");
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
