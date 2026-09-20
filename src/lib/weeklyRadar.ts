import { responseError } from "./http";

export interface WeeklyRadarReportSummary {
  schemaVersion: 1;
  id: string;
  title: string;
  summary: string;
  period: {
    start: string;
    end: string;
    timezone: "Asia/Shanghai";
  };
  generatedAt: string;
  status: "READY";
  counts: {
    strictWeekSamples: number;
    detailVerified: number;
    shortCandidates: number;
    teachingTopics: number;
  };
  picks: {
    primary: { title: string; angle: string };
    secondary?: { title: string; angle: string };
  };
  evidenceNote: string;
  reportUrl: string;
}

export interface WeeklyRadarReportsResponse {
  reports: WeeklyRadarReportSummary[];
  issues: Array<{ id: string; reason: string }>;
}

export async function getWeeklyRadarReports(signal?: AbortSignal) {
  const response = await fetch("/api/ai-video-radar/reports", { cache: "no-store", signal });
  if (!response.ok) throw await responseError(response, "无法读取 AI 视频周报历史。");
  return response.json() as Promise<WeeklyRadarReportsResponse>;
}

export function weeklyRadarEmbedUrl(report: WeeklyRadarReportSummary) {
  return `${report.reportUrl}?embed=1`;
}
