import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";

export type StudioOpsTone = "neutral" | "info" | "warning" | "danger" | "success";
export type StudioOpsColor = "purple" | "blue" | "amber" | "green" | "rose" | "neutral";
export type StudioOpsTodoBucket = "now" | "waiting" | "decide" | "later";
export type StudioOpsTodoStatus = "todo" | "in_progress" | "done";
export type StudioOpsTodoTimeSlot = "fragment" | "deep" | "any";

export interface StudioOpsMetric {
  id: string;
  label: string;
  value: string;
  detail?: string;
  dueDate?: string;
  badge?: string;
  tone?: StudioOpsTone;
}

export interface StudioOpsProject {
  id: string;
  name: string;
  workspaceProjectId?: string;
  stage: string;
  tone?: StudioOpsTone;
  summary: string;
  nextAction?: string;
  blocker?: string;
  platforms?: string[];
  tags?: string[];
  docPath?: string;
  updatedAt?: string;
}

export interface StudioOpsAccount {
  id: string;
  name: string;
  role: string;
  status: string;
  tone?: StudioOpsTone;
  platforms: string[];
  followers?: string;
  positioning: string;
  monetization?: string;
  nextAction?: string;
  docPath?: string;
}

export interface StudioOpsState {
  schemaVersion: 1;
  studioName: string;
  tagline?: string;
  focusSummary: string;
  updatedAt: string;
  metrics: StudioOpsMetric[];
  projects: StudioOpsProject[];
  accounts: StudioOpsAccount[];
}

export interface StudioOpsTodo {
  id: string;
  title: string;
  detail?: string;
  category?: string;
  color?: StudioOpsColor;
  bucket: StudioOpsTodoBucket;
  status: StudioOpsTodoStatus;
  timeSlot?: StudioOpsTodoTimeSlot;
  dueDate?: string;
  workspaceProjectId?: string;
  projectId?: string;
  accountId?: string;
  tags?: string[];
  completedAt?: string;
}

export interface StudioOpsTodosFile {
  schemaVersion: 1;
  updatedAt: string;
  items: StudioOpsTodo[];
}

export interface StudioOpsDocumentSummary {
  path: string;
  title: string;
  category: string;
  updatedAt: string;
}

export interface StudioOpsDocumentDetail extends StudioOpsDocumentSummary {
  content: string;
}

export interface StudioOpsStatus {
  available: boolean;
}

export interface StudioOpsOverview {
  available: boolean;
  state: StudioOpsState;
  todos: StudioOpsTodosFile;
  documents: StudioOpsDocumentSummary[];
  issues: string[];
}

export class StudioOpsError extends Error {
  constructor(
    readonly code:
      | "ops_unavailable"
      | "invalid_path"
      | "doc_not_found"
      | "todo_not_found"
      | "invalid_payload"
      | "invalid_data",
    message: string,
  ) {
    super(message);
    this.name = "StudioOpsError";
  }
}

const VALID_TONES = new Set<StudioOpsTone>(["neutral", "info", "warning", "danger", "success"]);
const VALID_COLORS = new Set<StudioOpsColor>(["purple", "blue", "amber", "green", "rose", "neutral"]);
const VALID_BUCKETS = new Set<StudioOpsTodoBucket>(["now", "waiting", "decide", "later"]);
const VALID_STATUSES = new Set<StudioOpsTodoStatus>(["todo", "in_progress", "done"]);
const VALID_TIME_SLOTS = new Set<StudioOpsTodoTimeSlot>(["fragment", "deep", "any"]);

const IGNORED_NAMES = new Set([".gitkeep", ".DS_Store", "Thumbs.db"]);

function isIgnoredName(name: string): boolean {
  return IGNORED_NAMES.has(name) || name.startsWith(".");
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function asTone(value: unknown): StudioOpsTone {
  return typeof value === "string" && VALID_TONES.has(value as StudioOpsTone) ? (value as StudioOpsTone) : "neutral";
}

function asColor(value: unknown): StudioOpsColor | undefined {
  return typeof value === "string" && VALID_COLORS.has(value as StudioOpsColor) ? (value as StudioOpsColor) : undefined;
}

function asBucket(value: unknown): StudioOpsTodoBucket {
  return typeof value === "string" && VALID_BUCKETS.has(value as StudioOpsTodoBucket) ? (value as StudioOpsTodoBucket) : "now";
}

function asStatus(value: unknown): StudioOpsTodoStatus {
  return typeof value === "string" && VALID_STATUSES.has(value as StudioOpsTodoStatus) ? (value as StudioOpsTodoStatus) : "todo";
}

function asTimeSlot(value: unknown): StudioOpsTodoTimeSlot | undefined {
  return typeof value === "string" && VALID_TIME_SLOTS.has(value as StudioOpsTodoTimeSlot)
    ? (value as StudioOpsTodoTimeSlot)
    : undefined;
}

function normalizeRelativePath(input: string): string {
  return input.replaceAll("\\", "/").replace(/^\/+/, "");
}

function isInsideRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function defaultState(): StudioOpsState {
  return {
    schemaVersion: 1,
    studioName: "运营管家",
    focusSummary: "暂未填写本周焦点，可在对话中与运营助理更新 state.json。",
    updatedAt: new Date().toISOString(),
    metrics: [],
    projects: [],
    accounts: [],
  };
}

function defaultTodos(): StudioOpsTodosFile {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    items: [],
  };
}

function parseState(raw: unknown): StudioOpsState {
  if (!raw || typeof raw !== "object") {
    throw new StudioOpsError("invalid_data", "state.json 必须是 JSON 对象。");
  }
  const obj = raw as Record<string, unknown>;
  const metricsRaw = Array.isArray(obj.metrics) ? obj.metrics : [];
  const projectsRaw = Array.isArray(obj.projects) ? obj.projects : [];
  const accountsRaw = Array.isArray(obj.accounts) ? obj.accounts : [];

  const metrics: StudioOpsMetric[] = metricsRaw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry, index) => ({
      id: asString(entry.id, `metric-${index + 1}`),
      label: asString(entry.label, "指标"),
      value: asString(entry.value, "—"),
      detail: asOptionalString(entry.detail),
      dueDate: asOptionalString(entry.dueDate),
      badge: asOptionalString(entry.badge),
      tone: asTone(entry.tone),
    }));

  const projects: StudioOpsProject[] = projectsRaw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry, index) => ({
      id: asString(entry.id, `project-${index + 1}`),
      name: asString(entry.name, "未命名项目"),
      workspaceProjectId: asOptionalString(entry.workspaceProjectId),
      stage: asString(entry.stage, "规划中"),
      tone: asTone(entry.tone),
      summary: asString(entry.summary, ""),
      nextAction: asOptionalString(entry.nextAction),
      blocker: asOptionalString(entry.blocker),
      platforms: asStringArray(entry.platforms),
      tags: asStringArray(entry.tags),
      docPath: asOptionalString(entry.docPath),
      updatedAt: asOptionalString(entry.updatedAt),
    }));

  const accounts: StudioOpsAccount[] = accountsRaw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry, index) => ({
      id: asString(entry.id, `account-${index + 1}`),
      name: asString(entry.name, "未命名账号"),
      role: asString(entry.role, "自媒体账号"),
      status: asString(entry.status, "规划中"),
      tone: asTone(entry.tone),
      platforms: asStringArray(entry.platforms),
      followers: asOptionalString(entry.followers),
      positioning: asString(entry.positioning, ""),
      monetization: asOptionalString(entry.monetization),
      nextAction: asOptionalString(entry.nextAction),
      docPath: asOptionalString(entry.docPath),
    }));

  return {
    schemaVersion: 1,
    studioName: asString(obj.studioName, "运营管家"),
    tagline: asOptionalString(obj.tagline),
    focusSummary: asString(obj.focusSummary, ""),
    updatedAt: asString(obj.updatedAt, new Date().toISOString()),
    metrics,
    projects,
    accounts,
  };
}

function parseTodos(raw: unknown): StudioOpsTodosFile {
  if (!raw || typeof raw !== "object") {
    throw new StudioOpsError("invalid_data", "todos.json 必须是 JSON 对象。");
  }
  const obj = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  const items: StudioOpsTodo[] = itemsRaw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry, index) => ({
      id: asString(entry.id, `todo-${index + 1}`),
      title: asString(entry.title, "未命名事项"),
      detail: asOptionalString(entry.detail),
      category: asOptionalString(entry.category),
      color: asColor(entry.color),
      bucket: asBucket(entry.bucket),
      status: asStatus(entry.status),
      timeSlot: asTimeSlot(entry.timeSlot),
      dueDate: asOptionalString(entry.dueDate),
      workspaceProjectId: asOptionalString(entry.workspaceProjectId),
      projectId: asOptionalString(entry.projectId),
      accountId: asOptionalString(entry.accountId),
      tags: asStringArray(entry.tags),
      completedAt: asOptionalString(entry.completedAt),
    }));

  return {
    schemaVersion: 1,
    updatedAt: asString(obj.updatedAt, new Date().toISOString()),
    items,
  };
}

function extractMarkdownTitle(content: string, fallbackName: string): string {
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^#\s+(.+)$/);
    if (match?.[1]?.trim()) return match[1].replaceAll("`", "").trim();
  }
  return basename(fallbackName, extname(fallbackName));
}

function categorizeDocPath(relPath: string): string {
  const parts = relPath.split("/");
  if (parts.length === 1) {
    if (relPath === "roadmap.md") return "规划路线";
    if (relPath === "decisions.md") return "决策日志";
    return "总览文档";
  }
  const dir = parts[0];
  if (dir === "projects") return "项目档案";
  if (dir === "plans") return "运营预案";
  if (dir === "accounts") return "账号与对标";
  if (dir === "research") return "专题调研";
  if (dir === "reviews" || dir === "logs") return "复盘记录";
  return dir;
}

export function createStudioOpsCatalog(opsRootInput: string) {
  const opsRoot = resolve(opsRootInput);

  async function resolveSafeRoot(): Promise<string | undefined> {
    try {
      const stat = await lstat(opsRoot);
      if (!stat.isDirectory() || stat.isSymbolicLink()) return undefined;
      return await realpath(opsRoot);
    } catch {
      return undefined;
    }
  }

  async function hasAnyContent(root: string, current = root, depth = 0): Promise<boolean> {
    if (depth > 4) return false;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (isIgnoredName(entry.name) || entry.isSymbolicLink()) continue;
      const fullPath = join(current, entry.name);
      if (entry.isFile()) return true;
      if (entry.isDirectory()) {
        if (await hasAnyContent(root, fullPath, depth + 1)) return true;
      }
    }
    return false;
  }

  async function getStatus(): Promise<StudioOpsStatus> {
    const safeRoot = await resolveSafeRoot();
    if (!safeRoot) return { available: false };
    return { available: await hasAnyContent(safeRoot) };
  }

  async function scanMarkdownDocs(safeRoot: string, current = safeRoot, depth = 0): Promise<StudioOpsDocumentSummary[]> {
    if (depth > 4) return [];
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return [];
    }
    const docs: StudioOpsDocumentSummary[] = [];
    for (const entry of entries) {
      if (isIgnoredName(entry.name) || entry.isSymbolicLink()) continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        docs.push(...(await scanMarkdownDocs(safeRoot, fullPath, depth + 1)));
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        try {
          const fileStat = await lstat(fullPath);
          const content = await readFile(fullPath, "utf8");
          const relPath = normalizeRelativePath(relative(safeRoot, fullPath));
          docs.push({
            path: relPath,
            title: extractMarkdownTitle(content, entry.name),
            category: categorizeDocPath(relPath),
            updatedAt: fileStat.mtime.toISOString(),
          });
        } catch {
          // Skip unreadable files rather than failing the whole desk.
        }
      }
    }
    return docs.sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));
  }

  async function getOverview(): Promise<StudioOpsOverview> {
    const safeRoot = await resolveSafeRoot();
    if (!safeRoot || !(await hasAnyContent(safeRoot))) {
      return {
        available: false,
        state: defaultState(),
        todos: defaultTodos(),
        documents: [],
        issues: [],
      };
    }

    const issues: string[] = [];
    let state = defaultState();
    let todos = defaultTodos();

    const statePath = join(safeRoot, "state.json");
    try {
      const stateStat = await lstat(statePath);
      if (stateStat.isFile() && !stateStat.isSymbolicLink()) {
        state = parseState(JSON.parse(await readFile(statePath, "utf8")));
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        issues.push(`state.json 读取异常：${error instanceof Error ? error.message : "格式错误"}`);
      }
    }

    const todosPath = join(safeRoot, "todos.json");
    try {
      const todosStat = await lstat(todosPath);
      if (todosStat.isFile() && !todosStat.isSymbolicLink()) {
        todos = parseTodos(JSON.parse(await readFile(todosPath, "utf8")));
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        issues.push(`todos.json 读取异常：${error instanceof Error ? error.message : "格式错误"}`);
      }
    }

    const documents = await scanMarkdownDocs(safeRoot);
    return { available: true, state, todos, documents, issues };
  }

  async function readDocument(requestedPath: string): Promise<StudioOpsDocumentDetail> {
    const safeRoot = await resolveSafeRoot();
    if (!safeRoot) {
      throw new StudioOpsError("ops_unavailable", "运营管家本地数据目录尚未初始化。");
    }
    const normalized = normalizeRelativePath(requestedPath.trim());
    if (!normalized || normalized.includes("..") || extname(normalized).toLowerCase() !== ".md") {
      throw new StudioOpsError("invalid_path", "只允许读取 ops-workspace 内的 Markdown 文档。");
    }
    const segments = normalized.split("/");
    if (segments.some((segment) => !segment || isIgnoredName(segment))) {
      throw new StudioOpsError("invalid_path", "文档路径包含不支持的隐藏或非法片段。");
    }

    const targetPath = resolve(safeRoot, normalized);
    if (!isInsideRoot(safeRoot, targetPath)) {
      throw new StudioOpsError("invalid_path", "文档路径超出了 ops-workspace 目录范围。");
    }

    let fileStat;
    try {
      fileStat = await lstat(targetPath);
    } catch {
      throw new StudioOpsError("doc_not_found", `未找到文档：${normalized}`);
    }
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new StudioOpsError("doc_not_found", `文档不可读：${normalized}`);
    }

    const resolvedTarget = await realpath(targetPath);
    if (!isInsideRoot(safeRoot, resolvedTarget)) {
      throw new StudioOpsError("invalid_path", "文档真实路径超出了 ops-workspace 边界。");
    }

    const content = await readFile(resolvedTarget, "utf8");
    return {
      path: normalized,
      title: extractMarkdownTitle(content, basename(normalized)),
      category: categorizeDocPath(normalized),
      updatedAt: fileStat.mtime.toISOString(),
      content,
    };
  }

  async function updateTodoStatus(todoId: string, status: StudioOpsTodoStatus): Promise<StudioOpsTodo> {
    if (!VALID_STATUSES.has(status)) {
      throw new StudioOpsError("invalid_payload", "不支持的待办状态。");
    }
    const safeRoot = await resolveSafeRoot();
    if (!safeRoot) {
      throw new StudioOpsError("ops_unavailable", "运营管家本地数据目录尚未初始化。");
    }
    const todosPath = join(safeRoot, "todos.json");
    let raw;
    try {
      const stat = await lstat(todosPath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new StudioOpsError("todo_not_found", "todos.json 不存在。");
      }
      raw = JSON.parse(await readFile(todosPath, "utf8"));
    } catch (error) {
      if (error instanceof StudioOpsError) throw error;
      throw new StudioOpsError("invalid_data", "读取 todos.json 失败，请检查文件格式。");
    }

    const parsed = parseTodos(raw);
    const index = parsed.items.findIndex((item) => item.id === todoId);
    if (index === -1) {
      throw new StudioOpsError("todo_not_found", `未找到待办项：${todoId}`);
    }

    const now = new Date().toISOString();
    const updatedItem: StudioOpsTodo = {
      ...parsed.items[index],
      status,
      ...(status === "done" ? { completedAt: now } : { completedAt: undefined }),
    };
    if (status !== "done") {
      delete updatedItem.completedAt;
    }

    const nextFile: StudioOpsTodosFile = {
      ...parsed,
      updatedAt: now,
      items: parsed.items.map((item, itemIndex) => (itemIndex === index ? updatedItem : item)),
    };

    await mkdir(safeRoot, { recursive: true });
    const tempPath = join(safeRoot, `.todos.json.${Date.now()}.tmp`);
    await writeFile(tempPath, `${JSON.stringify(nextFile, null, 2)}\n`, "utf8");
    await rename(tempPath, todosPath);
    return updatedItem;
  }

  return {
    opsRoot,
    getStatus,
    getOverview,
    readDocument,
    updateTodoStatus,
  };
}
