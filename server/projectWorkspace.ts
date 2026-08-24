import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
}

interface ProjectManifest {
  schemaVersion: 1;
  name: string;
  description?: string;
  cover?: string;
}

export interface CreateProjectInput {
  id: string;
  name: string;
  description?: string;
}

export interface SetProjectCoverInput {
  contentType: string;
  data: Buffer;
}

export class ProjectWorkspaceError extends Error {
  constructor(
    readonly code: "invalid_project" | "invalid_cover" | "project_exists" | "project_not_found" | "material_not_found" | "invalid_path",
    message: string,
  ) {
    super(message);
    this.name = "ProjectWorkspaceError";
  }
}

const projectIdPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const coverNamePattern = /^cover\.(?:png|jpe?g|webp|gif)$/;
const coverExtensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function parseManifest(value: unknown): ProjectManifest | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ProjectManifest>;
  if (candidate.schemaVersion !== 1 || typeof candidate.name !== "string" || !candidate.name.trim()) return undefined;
  if (candidate.description !== undefined && typeof candidate.description !== "string") return undefined;
  if (candidate.cover !== undefined && (typeof candidate.cover !== "string" || !coverNamePattern.test(candidate.cover))) return undefined;
  return {
    schemaVersion: 1,
    name: candidate.name.trim(),
    ...(candidate.description?.trim() ? { description: candidate.description.trim() } : {}),
    ...(candidate.cover ? { cover: candidate.cover } : {}),
  };
}

async function readProjectManifest(root: string, id: string): Promise<ProjectManifest | undefined> {
  if (!projectIdPattern.test(id)) return undefined;
  try {
    const projectRootStat = await lstat(join(root, id));
    const manifestStat = await lstat(join(root, id, "project.json"));
    if (!projectRootStat.isDirectory() || !manifestStat.isFile()) return undefined;
    return parseManifest(JSON.parse(await readFile(join(root, id, "project.json"), "utf8")));
  } catch {
    return undefined;
  }
}

async function readProject(root: string, id: string): Promise<ProjectSummary | undefined> {
  const manifest = await readProjectManifest(root, id);
  if (!manifest) return undefined;

  let coverUrl: string | undefined;
  if (manifest.cover) {
    try {
      const coverStat = await lstat(join(root, id, manifest.cover));
      if (coverStat.isFile()) {
        coverUrl = `/api/projects/${encodeURIComponent(id)}/cover?v=${Math.trunc(coverStat.mtimeMs)}`;
      }
    } catch {
      // A missing cover should not hide an otherwise valid project.
    }
  }

  return {
    id,
    name: manifest.name,
    ...(manifest.description ? { description: manifest.description } : {}),
    ...(coverUrl ? { coverUrl } : {}),
  };
}

async function writeAtomic(path: string, data: string | Uint8Array) {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, data, { flag: "wx" });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export function createProjectWorkspace(root: string) {
  return {
    async listProjects(): Promise<ProjectSummary[]> {
      await mkdir(root, { recursive: true });
      const entries = await readdir(root, { withFileTypes: true });
      const projects = await Promise.all(entries
        .filter((entry) => entry.isDirectory() && projectIdPattern.test(entry.name))
        .map((entry) => readProject(root, entry.name)));

      return projects
        .filter((project): project is ProjectSummary => Boolean(project))
        .sort((left, right) => left.name.localeCompare(right.name, "zh-CN", { numeric: true }));
    },

    async createProject(input: CreateProjectInput): Promise<ProjectSummary> {
      const id = input.id.trim();
      const name = input.name.trim();
      const description = input.description?.trim();
      if (!projectIdPattern.test(id)) {
        throw new ProjectWorkspaceError("invalid_project", "项目标识只能使用小写字母、数字和连字符，长度不能超过 64 位。");
      }
      if (!name) {
        throw new ProjectWorkspaceError("invalid_project", "项目名称不能为空。");
      }

      await mkdir(root, { recursive: true });
      const projectRoot = join(root, id);
      try {
        await mkdir(projectRoot);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          throw new ProjectWorkspaceError("project_exists", "该项目标识已经存在。");
        }
        throw error;
      }

      const manifest: ProjectManifest = {
        schemaVersion: 1,
        name,
        ...(description ? { description } : {}),
      };
      await writeAtomic(join(projectRoot, "project.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      await Promise.all([
        mkdir(join(projectRoot, "library", "剧情"), { recursive: true }),
        mkdir(join(projectRoot, "library", "图片", "人物"), { recursive: true }),
        mkdir(join(projectRoot, "library", "图片", "场景"), { recursive: true }),
        mkdir(join(projectRoot, "library", "视频", "成片"), { recursive: true }),
      ]);

      return { id, name, ...(description ? { description } : {}) };
    },

    async setProjectCover(projectId: string, input: SetProjectCoverInput): Promise<ProjectSummary> {
      const manifest = await readProjectManifest(root, projectId);
      if (!manifest) {
        throw new ProjectWorkspaceError("project_not_found", "项目不存在。");
      }

      const extension = coverExtensions[input.contentType.toLowerCase()];
      if (!extension) {
        throw new ProjectWorkspaceError("invalid_cover", "封面仅支持 PNG、JPEG、WebP 或 GIF 图片。");
      }
      if (!input.data.length || input.data.length > 10 * 1024 * 1024) {
        throw new ProjectWorkspaceError("invalid_cover", "封面图片不能为空，且不能超过 10 MB。");
      }

      const cover = `cover.${extension}`;
      const projectRoot = join(root, projectId);
      await writeAtomic(join(projectRoot, cover), input.data);
      await writeAtomic(join(projectRoot, "project.json"), `${JSON.stringify({ ...manifest, cover }, null, 2)}\n`);

      const project = await readProject(root, projectId);
      if (!project) throw new ProjectWorkspaceError("project_not_found", "项目不存在。");
      return project;
    },

    async resolveProjectCover(projectId: string): Promise<string> {
      const manifest = await readProjectManifest(root, projectId);
      if (!manifest) {
        throw new ProjectWorkspaceError("project_not_found", "项目不存在。");
      }
      if (!manifest.cover) {
        throw new ProjectWorkspaceError("material_not_found", "项目还没有设置封面。");
      }

      const projectRoot = join(root, projectId);
      const candidate = join(projectRoot, manifest.cover);
      try {
        const candidateStat = await lstat(candidate);
        if (!candidateStat.isFile()) throw new Error("cover is not a file");
        const [resolvedRoot, resolvedCandidate] = await Promise.all([realpath(projectRoot), realpath(candidate)]);
        if (!resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)) {
          throw new ProjectWorkspaceError("invalid_path", "封面路径超出了当前项目。");
        }
        return resolvedCandidate;
      } catch (error) {
        if (error instanceof ProjectWorkspaceError) throw error;
        throw new ProjectWorkspaceError("material_not_found", "项目封面不存在。");
      }
    },

    async resolveMaterialPath(projectId: string, materialPath = ""): Promise<string> {
      if (!(await readProject(root, projectId))) {
        throw new ProjectWorkspaceError("project_not_found", "项目不存在。");
      }

      const libraryRoot = join(root, projectId, "library");
      let resolvedRoot: string;
      try {
        resolvedRoot = await realpath(libraryRoot);
      } catch {
        throw new ProjectWorkspaceError("project_not_found", "项目不存在。");
      }

      const candidate = resolve(libraryRoot, materialPath);
      let resolvedCandidate: string;
      try {
        resolvedCandidate = await realpath(candidate);
      } catch {
        throw new ProjectWorkspaceError("material_not_found", "素材不存在。");
      }

      if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)) {
        throw new ProjectWorkspaceError("invalid_path", "素材路径超出了当前项目。");
      }
      return resolvedCandidate;
    },
  };
}
