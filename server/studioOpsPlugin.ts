import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { createStudioOpsCatalog, StudioOpsError, type StudioOpsTodoStatus } from "./studioOpsCatalog.ts";

interface StudioOpsPluginOptions {
  opsRoot?: string;
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(value));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > 64 * 1024) {
      throw new StudioOpsError("invalid_payload", "请求体过大。");
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new StudioOpsError("invalid_payload", "请求体不是合法 JSON。");
  }
}

function attachStudioOpsMiddleware(server: ViteDevServer | PreviewServer, opsRoot: string) {
  const catalog = createStudioOpsCatalog(opsRoot);

  server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (!request.url?.startsWith("/api/studio-ops/")) {
      next();
      return;
    }

    try {
      const url = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/studio-ops/status") {
        sendJson(response, 200, await catalog.getStatus());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/studio-ops/overview") {
        sendJson(response, 200, await catalog.getOverview());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/studio-ops/doc") {
        const docPath = url.searchParams.get("path") ?? "";
        sendJson(response, 200, await catalog.readDocument(docPath));
        return;
      }

      const todoMatch = url.pathname.match(/^\/api\/studio-ops\/todos\/([^/]+)$/);
      if (request.method === "PATCH" && todoMatch) {
        const todoId = decodeURIComponent(todoMatch[1]);
        const body = (await readJsonBody(request)) as { status?: StudioOpsTodoStatus };
        if (typeof body?.status !== "string") {
          throw new StudioOpsError("invalid_payload", "缺少 status 字段。");
        }
        const updated = await catalog.updateTodoStatus(todoId, body.status);
        sendJson(response, 200, { item: updated });
        return;
      }

      sendJson(response, 404, { error: "接口不存在" });
    } catch (error) {
      if (error instanceof StudioOpsError) {
        const status =
          error.code === "doc_not_found" || error.code === "todo_not_found"
            ? 404
            : error.code === "ops_unavailable"
              ? 404
              : error.code === "invalid_payload" || error.code === "invalid_path"
                ? 400
                : 422;
        sendJson(response, status, { error: error.message, code: error.code });
        return;
      }
      sendJson(response, 500, { error: "读取运营管家数据失败", code: "STUDIO_OPS_FAILED" });
    }
  });
}

export function studioOpsPlugin(options: StudioOpsPluginOptions = {}): Plugin {
  const siteRoot = resolve(process.cwd());
  const opsRoot = resolve(siteRoot, options.opsRoot || "ops-workspace");
  return {
    name: "studio-ops",
    configureServer(server) {
      attachStudioOpsMiddleware(server, opsRoot);
    },
    configurePreviewServer(server) {
      attachStudioOpsMiddleware(server, opsRoot);
    },
  };
}
