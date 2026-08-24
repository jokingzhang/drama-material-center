import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
}

interface ProjectManifest {
  schemaVersion: 1;
  name: string;
  description?: string;
}

export interface CreateProjectInput {
  id: string;
  name: string;
  description?: string;
}

export class ProjectWorkspaceError extends Error {
  constructor(
    readonly code: "invalid_project" | "project_exists" | "project_not_found" | "material_not_found" | "invalid_path",
    message: string,
  ) {
    super(message);
    this.name = "ProjectWorkspaceError";
  }
}

const projectIdPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function parseManifest(value: unknown): ProjectManifest | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ProjectManifest>;
  if (candidate.schemaVersion !== 1 || typeof candidate.name !== "string" || !candidate.name.trim()) return undefined;
  if (candidate.description !== undefined && typeof candidate.description !== "string") return undefined;
  return {
    schemaVersion: 1,
    name: candidate.name.trim(),
    ...(candidate.description?.trim() ? { description: candidate.description.trim() } : {}),
  };
}

async function readProject(root: string, id: string): Promise<ProjectSummary | undefined> {
  if (!projectIdPattern.test(id)) return undefined;
  try {
    const manifest = parseManifest(JSON.parse(await readFile(join(root, id, "project.json"), "utf8")));
    if (!manifest) return undefined;
    return {
      id,
      name: manifest.name,
      ...(manifest.description ? { description: manifest.description } : {}),
    };
  } catch {
    return undefined;
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
      await writeFile(join(projectRoot, "project.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      await Promise.all([
        mkdir(join(projectRoot, "library", "剧情"), { recursive: true }),
        mkdir(join(projectRoot, "library", "图片", "人物"), { recursive: true }),
        mkdir(join(projectRoot, "library", "图片", "场景"), { recursive: true }),
        mkdir(join(projectRoot, "library", "视频", "成片"), { recursive: true }),
      ]);

      return { id, name, ...(description ? { description } : {}) };
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
