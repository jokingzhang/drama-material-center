import { createReadStream } from "node:fs";
import { access, mkdir, readdir, realpath, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, relative, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

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
  ".webm": "video/webm",
};

function sendJson(response: ServerResponse, statusCode: number, value: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface LibraryEntries {
  files: string[];
  directories: string[];
}

async function walkLibrary(directory: string): Promise<LibraryEntries> {
  if (!(await exists(directory))) return { files: [], directories: [] };
  const entries = await readdir(directory, { withFileTypes: true });
  const visibleEntries = entries.filter((entry) => !entry.name.startsWith("."));
  const nested = await Promise.all(visibleEntries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const children = await walkLibrary(entryPath);
      return {
        files: children.files,
        directories: [entryPath, ...children.directories],
      };
    }
    return { files: [entryPath], directories: [] };
  }));
  return nested.reduce<LibraryEntries>((result, current) => ({
    files: [...result.files, ...current.files],
    directories: [...result.directories, ...current.directories],
  }), { files: [], directories: [] });
}

function kindFor(path: string) {
  if (path.startsWith("剧情/")) return "story";
  if (path.startsWith("图片/")) return "image";
  if (path.startsWith("视频/")) return "video";
  return "other";
}

function folderLabel(path: string) {
  const parts = path.split("/");
  return parts.slice(0, -1).join(" / ");
}

function attachMaterialMiddleware(server: ViteDevServer | PreviewServer, libraryRoot: string) {
  server.middlewares.use(async (request, response, next) => {
    if (!request.url?.startsWith("/api/material-library/")) {
      next();
      return;
    }

    try {
      const url = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/material-library/files") {
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
            url: `/api/material-library/file?path=${encodeURIComponent(path)}`,
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
        sendJson(response, 200, { assets, directories, libraryRoot });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/material-library/file") {
        const path = url.searchParams.get("path") ?? "";
        const candidate = resolve(libraryRoot, path);
        const resolvedRoot = await realpath(libraryRoot);
        const resolvedCandidate = await realpath(candidate);
        const allowed = resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${sep}`);
        if (!allowed || !(await exists(resolvedCandidate))) {
          sendJson(response, 404, { error: "文件不存在" });
          return;
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", contentTypes[extname(resolvedCandidate).toLowerCase()] ?? "application/octet-stream");
        response.setHeader("Content-Disposition", "inline");
        createReadStream(resolvedCandidate).pipe(response);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/material-library/reveal") {
        const requestedPath = url.searchParams.get("path");
        const candidate = requestedPath ? resolve(libraryRoot, requestedPath) : libraryRoot;
        const target = candidate.startsWith(libraryRoot) && await exists(candidate) ? candidate : libraryRoot;
        const command = process.platform === "darwin" ? "open" : "xdg-open";
        const args = process.platform === "darwin" && requestedPath ? ["-R", target] : [target];
        spawn(command, args, { detached: true, stdio: "ignore" }).unref();
        sendJson(response, 200, { ok: true, target });
        return;
      }

      sendJson(response, 404, { error: "接口不存在" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取本地素材失败";
      sendJson(response, 500, { error: message });
    }
  });
}

export function materialLibraryPlugin(): Plugin {
  const siteRoot = resolve(process.cwd());
  const libraryRoot = join(siteRoot, "material-library", "library");
  const requiredDirectories = [
    join(libraryRoot, "剧情"),
    join(libraryRoot, "图片", "人物"),
    join(libraryRoot, "图片", "场景"),
    join(libraryRoot, "视频", "成片"),
  ];

  return {
    name: "zero-boundary-readonly-material-library",
    async configureServer(server) {
      await Promise.all(requiredDirectories.map((directory) => mkdir(directory, { recursive: true })));
      attachMaterialMiddleware(server, libraryRoot);
    },
    async configurePreviewServer(server) {
      await Promise.all(requiredDirectories.map((directory) => mkdir(directory, { recursive: true })));
      attachMaterialMiddleware(server, libraryRoot);
    },
  };
}
