import { responseError } from "./http";
import type {
  StudioOpsDocumentDetail,
  StudioOpsOverview,
  StudioOpsStatus,
  StudioOpsTodo,
  StudioOpsTodoStatus,
} from "../../server/studioOpsCatalog";

export type {
  StudioOpsAccount,
  StudioOpsColor,
  StudioOpsDocumentDetail,
  StudioOpsDocumentSummary,
  StudioOpsMetric,
  StudioOpsOverview,
  StudioOpsProject,
  StudioOpsState,
  StudioOpsStatus,
  StudioOpsTodo,
  StudioOpsTodoBucket,
  StudioOpsTodoStatus,
  StudioOpsTodoTimeSlot,
  StudioOpsTodosFile,
  StudioOpsTone,
} from "../../server/studioOpsCatalog";

export async function getStudioOpsStatus(signal?: AbortSignal): Promise<StudioOpsStatus> {
  const response = await fetch("/api/studio-ops/status", { signal, cache: "no-store" });
  if (!response.ok) return { available: false };
  return (await response.json()) as StudioOpsStatus;
}

export async function getStudioOpsOverview(signal?: AbortSignal): Promise<StudioOpsOverview> {
  const response = await fetch("/api/studio-ops/overview", { signal, cache: "no-store" });
  if (!response.ok) throw await responseError(response, "无法读取运营管家数据");
  return (await response.json()) as StudioOpsOverview;
}

export async function getStudioOpsDocument(path: string, signal?: AbortSignal): Promise<StudioOpsDocumentDetail> {
  const response = await fetch(`/api/studio-ops/doc?path=${encodeURIComponent(path)}`, { signal, cache: "no-store" });
  if (!response.ok) throw await responseError(response, "无法读取运营文档");
  return (await response.json()) as StudioOpsDocumentDetail;
}

export async function updateStudioOpsTodoStatus(todoId: string, status: StudioOpsTodoStatus): Promise<StudioOpsTodo> {
  const response = await fetch(`/api/studio-ops/todos/${encodeURIComponent(todoId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw await responseError(response, "更新待办状态失败");
  const payload = (await response.json()) as { item: StudioOpsTodo };
  return payload.item;
}

export function formatDaysUntil(dueDate?: string, now = new Date()): { label: string; overdue: boolean } | undefined {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return undefined;
  const [year, month, day] = dueDate.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return { label: "就是今天", overdue: false };
  if (diffDays > 0) return { label: `还有 ${diffDays} 天`, overdue: false };
  return { label: `已过 ${Math.abs(diffDays)} 天`, overdue: true };
}
