import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { createWeeklyRadarCatalog, WeeklyRadarCatalogError } from "./weeklyRadarCatalog.ts";

interface WeeklyRadarPluginOptions {
  reportsRoot?: string;
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(value));
}

function attachWeeklyRadarMiddleware(server: ViteDevServer | PreviewServer, reportsRoot: string) {
  const catalog = createWeeklyRadarCatalog(reportsRoot);
  server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (!request.url?.startsWith("/api/ai-video-radar/")) {
      next();
      return;
    }

    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/api/ai-video-radar/reports") {
        sendJson(response, 200, await catalog.listReports());
        return;
      }

      const documentMatch = url.pathname.match(/^\/api\/ai-video-radar\/reports\/([^/]+)\/document$/);
      if (request.method === "GET" && documentMatch) {
        const reportId = decodeURIComponent(documentMatch[1]);
        const source = await catalog.readReportHtml(reportId, url.searchParams.get("embed") === "1");
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Content-Disposition", "inline");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Frame-Options", "SAMEORIGIN");
        response.end(source);
        return;
      }

      sendJson(response, 404, { error: "接口不存在" });
    } catch (error) {
      if (error instanceof WeeklyRadarCatalogError) {
        const status = error.code === "report_not_found" ? 404 : 422;
        sendJson(response, status, { error: error.message, code: error.code });
        return;
      }
      sendJson(response, 500, { error: "读取 AI 视频周报失败", code: "WEEKLY_RADAR_READ_FAILED" });
    }
  });
}

export function weeklyRadarPlugin(options: WeeklyRadarPluginOptions = {}): Plugin {
  const siteRoot = resolve(process.cwd());
  const reportsRoot = resolve(siteRoot, options.reportsRoot ?? "weekly-radar/reports");
  return {
    name: "ai-video-weekly-radar",
    configureServer(server) {
      attachWeeklyRadarMiddleware(server, reportsRoot);
    },
    configurePreviewServer(server) {
      attachWeeklyRadarMiddleware(server, reportsRoot);
    },
  };
}
