import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import { basename, extname, isAbsolute, join, sep } from "node:path";
import type { PromptReferenceItem, PromptReferencePreview } from "../src/types/story.ts";
import { createProjectWorkspace, ProjectWorkspaceError } from "./projectWorkspace.ts";

type JsonObject = Record<string, unknown>;
interface Binding extends JsonObject {
  assetId?: string;
  materialType?: string;
  role?: string;
  path?: string;
  sha256?: string;
  status?: string;
  decisionStatus?: string;
  version?: string;
  subject?: JsonObject;
}

interface UnitMatch {
  planPath: string;
  unit: JsonObject;
  references?: JsonObject[];
}

const digestPattern = /^[a-f0-9]{64}$/i;
const referencePattern = /^\{\{(?:Mixed\s+\d+|Node\s+[a-zA-Z0-9_-]+)\}\}$/;

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.flatMap((entry) => object(entry) ? [entry as JsonObject] : []) : [];
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function current(binding: Binding) {
  const status = string(binding.status) ?? string(binding.decisionStatus) ?? "";
  return status !== "SUPERSEDED" && !status.startsWith("REJECTED");
}

/** Indexes use library-relative paths; reference plans also use project-relative library/ paths. */
function libraryPath(value: unknown, allowPrefix = true): string {
  if (typeof value !== "string") throw new ProjectWorkspaceError("invalid_path", "引用素材路径无效。");
  const path = allowPrefix && value.startsWith("library/") ? value.slice("library/".length) : value;
  if (!path || isAbsolute(path) || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === ".." || part.startsWith("."))) {
    throw new ProjectWorkspaceError("invalid_path", "引用素材必须使用当前项目内的普通文件路径。");
  }
  return path;
}

function samePath(value: unknown, expected: string) {
  try { return libraryPath(value) === expected; } catch { return false; }
}

function mediaKind(binding: JsonObject, path?: string): PromptReferenceItem["kind"] {
  const type = string(binding.materialType) ?? string(binding.mediaType) ?? "";
  if (type.startsWith("image.")) return "image";
  if (type.startsWith("audio.")) return "audio";
  if (type.startsWith("video.")) return "video";
  const extension = extname(path ?? "").toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) return "image";
  if ([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"].includes(extension)) return "audio";
  if ([".mp4", ".mov", ".mkv", ".webm"].includes(extension)) return "video";
  return "other";
}

function promptIdentities(unit: JsonObject) {
  const prompt = object(unit.prompt);
  return [
    { path: unit.bodyPath, sha256: unit.bodySha256 },
    { path: unit.promptPath, sha256: unit.promptSha256 },
    { path: prompt?.path, sha256: prompt?.sha256 },
    // These exact fields occur in formally bound EP14/15/19–21 plans.
    { path: unit.path, sha256: unit.sha256 },
  ];
}

function unitReferences(unit: JsonObject): JsonObject[] | undefined {
  const referencePlan = object(unit.referencePlan);
  if (Array.isArray(referencePlan?.assets)) return objects(referencePlan.assets);
  // EP08/12 explicitly store the same local identity and reference tokens here.
  if (Array.isArray(unit.references) && unit.references.every((entry) => object(entry))) return objects(unit.references);
  return undefined;
}

function referenceToken(reference: JsonObject, body: string): string | undefined {
  const tokens = [reference.reference, reference.token, reference.logicalReference, reference.logicalToken]
    .flatMap((value) => typeof value === "string" && referencePattern.test(value) ? [value] : []);
  // An explicit logical token may be present alongside a resolved Node token. Select only
  // a token actually used by this exact prompt, never derive numbering from array order.
  return tokens.find((token) => body.includes(token)) ?? tokens[0];
}

export function createPromptReferenceResolver(workspaceRoot: string) {
  const workspace = createProjectWorkspace(workspaceRoot);
  const digests = new Map<string, { signature: string; digest: string }>();

  async function strictFile(projectRoot: string, relativePath: string): Promise<string> {
    let cursor = projectRoot;
    const segments = relativePath.split("/");
    for (const [index, segment] of segments.entries()) {
      cursor = join(cursor, segment);
      let entry;
      try { entry = await lstat(cursor); } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ProjectWorkspaceError("material_not_found", "引用文件缺失。");
        throw error;
      }
      if (entry.isSymbolicLink() || (index === segments.length - 1 ? !entry.isFile() : !entry.isDirectory())) {
        throw new ProjectWorkspaceError("invalid_path", "引用路径不能经过符号链接、目录或特殊文件。");
      }
    }
    const actual = await realpath(cursor);
    if (!actual.startsWith(`${projectRoot}${sep}`)) throw new ProjectWorkspaceError("invalid_path", "引用素材路径超出当前项目。");
    return actual;
  }

  async function digest(path: string) {
    const entry = await lstat(path);
    const signature = `${entry.dev}:${entry.ino}:${entry.size}:${entry.mtimeMs}:${entry.ctimeMs}`;
    const cached = digests.get(path);
    if (cached?.signature === signature) return cached.digest;
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    const value = hash.digest("hex");
    if (digests.size >= 512) digests.clear();
    digests.set(path, { signature, digest: value });
    return value;
  }

  async function readIndex(projectRoot: string, name: string): Promise<JsonObject | undefined> {
    try {
      const file = await strictFile(projectRoot, `production/${name}`);
      const result = object(JSON.parse(await readFile(file, "utf8")));
      return result?.schemaVersion === 1 ? result : undefined;
    } catch (error) {
      if (error instanceof ProjectWorkspaceError || error instanceof SyntaxError) return undefined;
      throw error;
    }
  }

  async function resolveReference(projectRoot: string, projectId: string, raw: JsonObject, token: string, assets: Binding[]): Promise<PromptReferenceItem> {
    const assetId = string(raw.assetId);
    const subject = string(raw.subject) ?? string(raw.label) ?? string(raw.name);
    const responsibility = string(raw.responsibility) ?? string(raw.primaryResponsibility);
    const duration = raw.durationSeconds;
    const base: PromptReferenceItem = {
      reference: token,
      label: subject ?? (typeof raw.path === "string" ? basename(raw.path) : assetId ?? token),
      ...(assetId ? { assetId } : {}),
      kind: mediaKind(raw, string(raw.path)),
      ...(string(raw.version) ? { version: string(raw.version) } : {}),
      ...(string(raw.status) ?? string(raw.assetStatus) ? { assetStatus: string(raw.status) ?? string(raw.assetStatus) } : {}),
      ...(responsibility ? { responsibility } : {}),
      ...(typeof duration === "number" && Number.isFinite(duration) && duration >= 0 ? { durationSeconds: duration } : {}),
      resolution: "UNREGISTERED",
    };
    const candidates = assets.filter((asset) => asset.assetId === assetId);
    if (!assetId || !candidates.length) return { ...base, reason: "引用素材尚未正式登记。" };
    if (candidates.length > 1) return { ...base, resolution: "CONFLICT", reason: "素材 ID 存在多个正式绑定。" };
    let path: string;
    try { path = libraryPath(raw.path); } catch {
      return { ...base, resolution: "CONFLICT", reason: "引用路径无效或超出当前项目。" };
    }
    const currentBinding = candidates[0];
    // Version history is an explicit formal record. It can prove an old reference;
    // never replace that reference with the asset's newer current file.
    const historical = objects(currentBinding.versionHistory).filter((entry) =>
      samePath(entry.path, path)
      && typeof entry.sha256 === "string" && typeof raw.sha256 === "string"
      && entry.sha256.toLowerCase() === raw.sha256.toLowerCase());
    if (historical.length > 1) return { ...base, resolution: "CONFLICT", reason: "引用的历史版本存在多个正式记录。" };
    const matchesCurrent = samePath(currentBinding.path, path)
      && typeof raw.sha256 === "string" && string(currentBinding.sha256)?.toLowerCase() === raw.sha256.toLowerCase();
    const binding = !matchesCurrent && historical.length === 1
      ? {
        ...currentBinding,
        ...historical[0],
        status: string(historical[0].status) ?? string(raw.status) ?? "SUPERSEDED",
        version: string(historical[0].version) ?? string(raw.version),
        bindingState: undefined,
      } as Binding
      : currentBinding;
    const details: PromptReferenceItem = {
      ...base,
      kind: mediaKind(binding, binding.path),
      ...(binding.status ? { assetStatus: binding.status } : {}),
      ...(string(raw.version) ?? binding.version ? { version: string(raw.version) ?? binding.version } : {}),
    };
    try {
      if (path !== libraryPath(binding.path)) return { ...details, resolution: "VERSION_MISMATCH", reason: "引用路径与正式绑定的版本不一致。" };
    } catch {
      return { ...details, resolution: "CONFLICT", reason: "引用路径无效或超出当前项目。" };
    }
    const referenceHash = string(raw.sha256)?.toLowerCase();
    const bindingHash = string(binding.sha256)?.toLowerCase();
    if (!referenceHash || !bindingHash || !digestPattern.test(referenceHash) || !digestPattern.test(bindingHash) || referenceHash !== bindingHash) {
      return { ...details, resolution: "VERSION_MISMATCH", reason: "引用与正式绑定的 SHA-256 不一致或缺失。" };
    }
    if (string(raw.version) && string(binding.version) && raw.version !== binding.version) {
      return { ...details, resolution: "VERSION_MISMATCH", reason: "引用版本号与正式绑定不一致。" };
    }
    if (binding.bindingState === "CONFLICT" || binding.bindingState === "STALE_BINDING") {
      return { ...details, resolution: "CONFLICT", reason: "正式素材绑定存在冲突或已过期。" };
    }
    try {
      const file = await strictFile(projectRoot, `library/${path}`);
      if (await digest(file) !== referenceHash) return { ...details, resolution: "VERSION_MISMATCH", reason: "素材文件内容与引用的 SHA-256 不一致。" };
    } catch (error) {
      if (!(error instanceof ProjectWorkspaceError)) throw error;
      return { ...details, resolution: error.code === "invalid_path" ? "CONFLICT" : "MISSING_FILE", reason: error.message };
    }
    if (details.kind === "other") return { ...details, resolution: "UNSUPPORTED", reason: "这个引用的文件类型暂不支持媒体预览。" };
    return {
      ...details,
      resolution: "RESOLVED",
      url: `/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`,
    };
  }

  return {
    async readPromptReferences(projectId: string, requestedPath: string): Promise<PromptReferencePreview> {
      const promptPath = libraryPath(requestedPath, false);
      // Resolve through the workspace first, which also validates project IDs and manifests.
      await workspace.resolveMaterialPath(projectId, promptPath);
      const projectRoot = await realpath(join(workspaceRoot, projectId));
      const promptFile = await strictFile(projectRoot, `library/${promptPath}`);
      const unavailable = (reason: string): PromptReferencePreview => ({ promptPath, state: "UNAVAILABLE", reason, references: [] });
      const conflict = (reason: string): PromptReferencePreview => ({ promptPath, state: "CONFLICT", reason, references: [] });
      const [assetIndex, storyIndex] = await Promise.all([
        readIndex(projectRoot, "asset-bindings.v1.json"),
        readIndex(projectRoot, "story-index.v1.json"),
      ]);
      if (!assetIndex || !storyIndex) return unavailable("项目尚无可读取的正式引用索引。");
      const assets = objects(assetIndex.assets) as Binding[];
      const documents = objects(storyIndex.documentBindings) as Binding[];
      const promptBindings = [...assets, ...documents].filter((binding) => binding.materialType === "prompt.video" && samePath(binding.path, promptPath));
      if (!promptBindings.length) return unavailable("此文档尚未正式关联提示词引用素材。");
      // Use one snapshot for identity and placeholder extraction, including when a local
      // editor saves the source while this request is in flight.
      const body = await readFile(promptFile, "utf8");
      const promptHash = createHash("sha256").update(body).digest("hex");
      if (promptBindings.some((binding) => string(binding.sha256)?.toLowerCase() !== promptHash)) {
        return conflict("提示词正文与正式绑定版本不一致，未加载引用素材。");
      }
      const episodeIds = new Set(promptBindings.flatMap((binding) => string(binding.subject?.episodeId) ? [binding.subject!.episodeId as string] : []));
      if (episodeIds.size > 1) return conflict("提示词同时绑定了不同分集，无法确定引用计划。");
      const plans = assets.filter((binding) => binding.role === "reference-plan" && current(binding)
        && (episodeIds.size === 0 || !binding.subject?.episodeId || episodeIds.has(binding.subject.episodeId as string)));
      const planBindingsByPath = new Map<string, Binding>();
      for (const plan of plans) {
        let path: string;
        try { path = libraryPath(plan.path); } catch { continue; }
        const previous = planBindingsByPath.get(path);
        if (previous && string(previous.sha256)?.toLowerCase() !== string(plan.sha256)?.toLowerCase()) {
          return conflict("同一引用计划路径存在不同的正式版本哈希。");
        }
        planBindingsByPath.set(path, plan);
      }
      const matches: UnitMatch[] = [];
      let invalidPlan = false;
      let mismatchedVersion = false;
      const planPaths = new Set<string>();
      for (const binding of plans) {
        try {
          const path = libraryPath(binding.path);
          if (planPaths.has(path)) continue;
          planPaths.add(path);
          const file = await strictFile(projectRoot, `library/${path}`);
          const expectedPlanHash = string(binding.sha256)?.toLowerCase();
          if (!expectedPlanHash || !digestPattern.test(expectedPlanHash) || await digest(file) !== expectedPlanHash) {
            invalidPlan = true;
            continue;
          }
          const plan = object(JSON.parse(await readFile(file, "utf8")));
          for (const unit of objects(plan?.units)) {
            const identities = promptIdentities(unit).filter((identity) => samePath(identity.path, promptPath));
            if (!identities.length) continue;
            if (identities.some((identity) => typeof identity.sha256 !== "string" || identity.sha256.toLowerCase() !== promptHash)) {
              mismatchedVersion = true;
              continue;
            }
            matches.push({ planPath: path, unit, references: unitReferences(unit) });
          }
        } catch (error) {
          if (!(error instanceof ProjectWorkspaceError) && !(error instanceof SyntaxError)) throw error;
          invalidPlan = true;
        }
      }
      if (matches.length > 1) return conflict("多个引用单元匹配同一版提示词，需先修正正式映射。");
      if (!matches.length) return unavailable(mismatchedVersion
        ? "此版本与引用计划中的正文哈希不一致。"
        : invalidPlan ? "引用计划缺失、不可读取或版本校验未通过。" : "此版本尚未关联可解析的引用素材。");
      const match = matches[0];
      if (!match.references) return unavailable("此引用计划的结构暂不支持预览，正文仍可阅读。");
      const references: Array<{ raw: JsonObject; token: string }> = [];
      for (const raw of match.references) {
        const token = referenceToken(raw, body);
        if (!token) return conflict("引用计划含缺失或不支持的素材标记。");
        if (references.some((reference) => reference.token === token)) return conflict(`素材标记 ${token} 存在多个映射。`);
        references.push({ raw, token });
      }
      // A placeholder with no mapping stays visible as an explicit, unplayable card.
      for (const token of new Set(body.match(/\{\{(?:Mixed\s+\d+|Node\s+[a-zA-Z0-9_-]+)\}\}/g) ?? [])) {
        if (!references.some((reference) => reference.token === token)) references.push({ raw: {}, token });
      }
      references.sort((left, right) => {
        const leftNumber = left.token.match(/^\{\{Mixed\s+(\d+)\}\}$/)?.[1];
        const rightNumber = right.token.match(/^\{\{Mixed\s+(\d+)\}\}$/)?.[1];
        return leftNumber && rightNumber ? Number(leftNumber) - Number(rightNumber) : body.indexOf(left.token) - body.indexOf(right.token);
      });
      return {
        promptPath,
        promptSha256: promptHash,
        ...(string(match.unit.unitId) ?? string(match.unit.id) ? { unitId: string(match.unit.unitId) ?? string(match.unit.id) } : {}),
        sourcePlanPath: match.planPath,
        state: "RESOLVED",
        references: await Promise.all(references.map(({ raw, token }) => resolveReference(projectRoot, projectId, raw, token, assets))),
      };
    },
  };
}
