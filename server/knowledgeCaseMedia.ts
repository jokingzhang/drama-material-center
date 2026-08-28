import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { RegisteredReadError, resolveRegisteredFile } from "./safeRegisteredRead.ts";

const routePrefix = "/knowledge-media/";
const allowedExtensions = [".mp4"] as const;

export async function resolveKnowledgeCaseMedia(root: string, pathname: string) {
  if (!pathname.startsWith(routePrefix)) {
    throw new RegisteredReadError("invalid_registered_path", "案例媒体路径无效。");
  }
  let relativePath: string;
  try {
    relativePath = decodeURIComponent(pathname.slice(routePrefix.length));
  } catch {
    throw new RegisteredReadError("invalid_registered_path", "案例媒体路径编码无效。");
  }
  return resolveRegisteredFile(root, relativePath, allowedExtensions);
}

export function parseKnowledgeMediaRange(value: string | undefined, size: number) {
  const match = value?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || !Number.isSafeInteger(size) || size <= 0) return undefined;

  const requestedStart = match[1] ? Number(match[1]) : undefined;
  const requestedEnd = match[2] ? Number(match[2]) : undefined;
  if (requestedStart === undefined && requestedEnd === undefined) return undefined;

  if (requestedStart === undefined) {
    if (!Number.isSafeInteger(requestedEnd) || requestedEnd! <= 0) return undefined;
    return { start: Math.max(0, size - requestedEnd!), end: size - 1 };
  }

  const start = requestedStart;
  const end = Math.min(requestedEnd ?? size - 1, size - 1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) return undefined;
  return { start, end };
}

async function streamMedia(request: IncomingMessage, response: ServerResponse, target: string) {
  const fileStat = await stat(target);
  const range = parseKnowledgeMediaRange(typeof request.headers.range === "string" ? request.headers.range : undefined, fileStat.size);

  response.setHeader("Content-Type", "video/mp4");
  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Disposition", "inline");

  if (request.headers.range && !range) {
    response.statusCode = 416;
    response.setHeader("Content-Range", `bytes */${fileStat.size}`);
    response.end();
    return;
  }

  if (range) {
    response.statusCode = 206;
    response.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${fileStat.size}`);
    response.setHeader("Content-Length", range.end - range.start + 1);
    if (request.method === "HEAD") response.end();
    else createReadStream(target, range).pipe(response);
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Length", fileStat.size);
  if (request.method === "HEAD") response.end();
  else createReadStream(target).pipe(response);
}

function attachKnowledgeCaseMediaMiddleware(server: ViteDevServer | PreviewServer, root: string) {
  server.middlewares.use(async (request, response, next) => {
    if (!request.url) {
      next();
      return;
    }

    const url = new URL(request.url, "http://127.0.0.1");
    if (!url.pathname.startsWith(routePrefix)) {
      next();
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.statusCode = 405;
      response.end("Method Not Allowed");
      return;
    }

    try {
      const target = await resolveKnowledgeCaseMedia(root, url.pathname);
      await streamMedia(request, response, target);
    } catch (error) {
      response.statusCode = error instanceof RegisteredReadError && error.code === "invalid_registered_path" ? 400 : 404;
      response.end("Case media not found");
    }
  });
}

export function knowledgeCaseMediaPlugin(root = resolve(process.cwd(), "director-knowledge-base/.media")): Plugin {
  return {
    name: "director-knowledge-case-media",
    configureServer(server) {
      attachKnowledgeCaseMediaMiddleware(server, root);
    },
    configurePreviewServer(server) {
      attachKnowledgeCaseMediaMiddleware(server, root);
    },
  };
}
