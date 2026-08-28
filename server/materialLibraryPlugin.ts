import { createReadStream } from "node:fs";
import { open as openFile, readFile, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, relative, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import {
  createProjectWorkspace,
  ProjectWorkspaceError,
  type CreateProjectInput,
} from "./projectWorkspace.ts";
import { createDirectorKnowledgeMiddleware } from "./directorKnowledgeApi.ts";

const contentTypes: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

const searchableTextExtensions = new Set([".md", ".txt"]);
const MAX_SEARCHABLE_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_MATERIAL_SUMMARY_BYTES = 64 * 1024;
const MAX_SEARCH_RESULTS = 200;

interface LibraryEntries {
  files: string[];
  directories: string[];
}

interface MaterialLibraryPluginOptions {
  workspaceRoot?: string;
  knowledgeRoot?: string;
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new ProjectWorkspaceError("invalid_project", "请求内容过大。");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new ProjectWorkspaceError("invalid_project", "请求内容不是合法 JSON。");
  }
}

async function readBinary(request: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new ProjectWorkspaceError("invalid_cover", "封面图片不能超过 10 MB。");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function walkLibrary(directory: string): Promise<LibraryEntries> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter((entry) => !entry.name.startsWith(".") && !entry.isSymbolicLink())
    .map(async (entry) => {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        const children = await walkLibrary(entryPath);
        return { files: children.files, directories: [entryPath, ...children.directories] };
      }
      return { files: [entryPath], directories: [] };
    }));
  return nested.reduce<LibraryEntries>((result, current) => ({
    files: [...result.files, ...current.files],
    directories: [...result.directories, ...current.directories],
  }), { files: [], directories: [] });
}

export function kindFor(path: string) {
  const mimeType = contentTypes[extname(path).toLowerCase()] ?? "";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("text/")) return "story";
  return "other";
}

function folderLabel(path: string) {
  return path.split("/").slice(0, -1).join(" / ");
}

function projectRoute(pathname: string) {
  const match = pathname.match(/^\/api\/projects\/([^/]+)\/(assets|cover|file|reveal|search|summary)$/);
  if (!match) return undefined;
  return { projectId: decodeURIComponent(match[1]), action: match[2] };
}

export async function readMaterialSummary(filePath: string) {
  const file = await openFile(filePath, "r");
  try {
    const fileStat = await file.stat();
    const requestedBytes = Math.min(fileStat.size, MAX_MATERIAL_SUMMARY_BYTES);
    const buffer = Buffer.alloc(requestedBytes);
    const { bytesRead } = await file.read(buffer, 0, requestedBytes, 0);
    return {
      content: new TextDecoder().decode(buffer.subarray(0, bytesRead)),
      bytesRead,
      truncated: fileStat.size > bytesRead,
    };
  } finally {
    await file.close();
  }
}

function searchSnippet(source: string, matchIndex: number, queryLength: number) {
  const start = Math.max(0, matchIndex - 58);
  const end = Math.min(source.length, matchIndex + queryLength + 92);
  return `${start ? "…" : ""}${source.slice(start, end).replace(/\s+/g, " ").trim()}${end < source.length ? "…" : ""}`;
}

async function searchTextFiles(libraryRoot: string, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  if (normalizedQuery.length < 2) return [];

  const entries = await walkLibrary(libraryRoot);
  const results: Array<{ path: string; snippet: string }> = [];

  for (const filePath of entries.files) {
    if (results.length >= MAX_SEARCH_RESULTS) break;
    if (!searchableTextExtensions.has(extname(filePath).toLowerCase())) continue;
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_SEARCHABLE_TEXT_BYTES) continue;

    const source = await readFile(filePath, "utf8");
    const matchIndex = source.toLocaleLowerCase("zh-CN").indexOf(normalizedQuery);
    if (matchIndex < 0) continue;
    const path = relative(libraryRoot, filePath).split(sep).join("/");
    results.push({ path, snippet: searchSnippet(source, matchIndex, query.length) });
  }

  return results;
}

function statusFor(error: ProjectWorkspaceError) {
  if (error.code === "invalid_project" || error.code === "invalid_cover") return 400;
  if (error.code === "project_exists") return 409;
  return 404;
}

function attachMaterialMiddleware(server: ViteDevServer | PreviewServer, workspaceRoot: string, knowledgeRoot: string) {
  const workspace = createProjectWorkspace(workspaceRoot);

  server.middlewares.use(createDirectorKnowledgeMiddleware({ workspaceRoot, knowledgeRoot }));

  server.middlewares.use(async (request, response, next) => {
    if (!request.url?.startsWith("/api/")) {
      next();
      return;
    }

    try {
      const url = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/projects") {
        sendJson(response, 200, { projects: await workspace.listProjects() });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/projects") {
        const input = await readJson(request) as Partial<CreateProjectInput>;
        const project = await workspace.createProject({
          id: typeof input.id === "string" ? input.id : "",
          name: typeof input.name === "string" ? input.name : "",
          ...(typeof input.description === "string" ? { description: input.description } : {}),
        });
        sendJson(response, 201, { project });
        return;
      }

      const route = projectRoute(url.pathname);
      if (!route) {
        sendJson(response, 404, { error: "接口不存在" });
        return;
      }

      if (request.method === "GET" && route.action === "cover") {
        const target = await workspace.resolveProjectCover(route.projectId);
        response.statusCode = 200;
        response.setHeader("Content-Type", contentTypes[extname(target).toLowerCase()] ?? "application/octet-stream");
        response.setHeader("Content-Disposition", "inline");
        response.setHeader("Cache-Control", "no-store");
        createReadStream(target).pipe(response);
        return;
      }

      if (request.method === "PUT" && route.action === "cover") {
        const contentType = String(request.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
        const project = await workspace.setProjectCover(route.projectId, {
          contentType,
          data: await readBinary(request, 10 * 1024 * 1024),
        });
        sendJson(response, 200, { project });
        return;
      }

      if (request.method === "GET" && route.action === "assets") {
        const libraryRoot = await workspace.resolveMaterialPath(route.projectId);
        const entries = await walkLibrary(libraryRoot);
        const assets = await Promise.all(entries.files.map(async (filePath) => {
          const fileStat = await stat(filePath);
          const path = relative(libraryRoot, filePath).split(sep).join("/");
          return {
            id: path,
            path,
            name: path.split("/").at(-1) ?? path,
            folder: folderLabel(path),
            kind: kindFor(path),
            size: fileStat.size,
            updatedAt: fileStat.mtime.toISOString(),
            mimeType: contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
            url: `/api/projects/${encodeURIComponent(route.projectId)}/file?path=${encodeURIComponent(path)}`,
          };
        }));
        const directories = entries.directories.map((directoryPath) => {
          const path = relative(libraryRoot, directoryPath).split(sep).join("/");
          const parts = path.split("/");
          return {
            path,
            name: parts.at(-1) ?? path,
            parentPath: parts.slice(0, -1).join("/"),
          };
        });
        sendJson(response, 200, { assets, directories });
        return;
      }

      if (request.method === "GET" && route.action === "search") {
        const libraryRoot = await workspace.resolveMaterialPath(route.projectId);
        const results = await searchTextFiles(libraryRoot, url.searchParams.get("q") ?? "");
        sendJson(response, 200, { results });
        return;
      }

      if (request.method === "GET" && route.action === "summary") {
        const target = await workspace.resolveMaterialPath(route.projectId, url.searchParams.get("path") ?? "");
        if (!searchableTextExtensions.has(extname(target).toLowerCase())) {
          sendJson(response, 415, { error: "这个文件不支持文本摘要。", code: "UNSUPPORTED_SUMMARY" });
          return;
        }
        sendJson(response, 200, await readMaterialSummary(target));
        return;
      }

      if (request.method === "GET" && route.action === "file") {
        const target = await workspace.resolveMaterialPath(route.projectId, url.searchParams.get("path") ?? "");
        response.statusCode = 200;
        response.setHeader("Content-Type", contentTypes[extname(target).toLowerCase()] ?? "application/octet-stream");
        response.setHeader("Content-Disposition", "inline");
        createReadStream(target).pipe(response);
        return;
      }

      if (request.method === "POST" && route.action === "reveal") {
        const requestedPath = url.searchParams.get("path");
        const target = await workspace.resolveMaterialPath(route.projectId, requestedPath ?? "");
        const command = process.platform === "darwin" ? "open" : "xdg-open";
        const args = process.platform === "darwin" && requestedPath ? ["-R", target] : [target];
        spawn(command, args, { detached: true, stdio: "ignore" }).unref();
        sendJson(response, 200, { ok: true });
        return;
      }

      sendJson(response, 405, { error: "请求方法不受支持" });
    } catch (error) {
      if (error instanceof ProjectWorkspaceError) {
        sendJson(response, statusFor(error), { error: error.message, code: error.code });
        return;
      }
      const message = error instanceof Error ? error.message : "读取本地素材失败";
      sendJson(response, 500, { error: message });
    }
  });
}

export function materialLibraryPlugin(options: MaterialLibraryPluginOptions = {}): Plugin {
  const siteRoot = resolve(process.cwd());
  const workspaceRoot = resolve(siteRoot, options.workspaceRoot ?? "workspace");
  const knowledgeRoot = resolve(siteRoot, options.knowledgeRoot ?? "director-knowledge-base");

  return {
    name: "drama-material-workspace",
    configureServer(server) {
      attachMaterialMiddleware(server, workspaceRoot, knowledgeRoot);
    },
    configurePreviewServer(server) {
      attachMaterialMiddleware(server, workspaceRoot, knowledgeRoot);
    },
  };
}
