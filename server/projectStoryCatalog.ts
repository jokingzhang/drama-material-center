import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type {
  CharacterReadModel,
  EpisodeProductionStage,
  EpisodeDetailReadModel,
  EpisodeSummaryReadModel,
  LocationReadModel,
  ProjectStoryReadModel,
  SceneReadModel,
  StoryAssetKind,
  StoryAssetLink,
  StoryCompletion,
  StoryObjectStatus,
  StoryRequirementResult,
} from "../src/types/story.ts";
import { createProjectWorkspace, ProjectWorkspaceError } from "./projectWorkspace.ts";

interface RawSubject {
  characterId?: string;
  lookId?: string;
  episodeId?: string;
  episodeIds?: string[];
  sceneId?: string;
  locationId?: string;
  propId?: string;
  state?: string;
  shotId?: string;
}

interface RawAssetBinding {
  assetId: string;
  materialType: string;
  path: string;
  role: string;
  subject?: RawSubject;
  status: string;
  sha256?: string;
  legacyPath?: boolean;
  bindingState?: "STALE_BINDING" | "CONFLICT";
  verification?: { kind?: string; verifiedAt?: string };
}

interface RawRequirement {
  id: string;
  label?: string;
  milestoneId?: string;
  role: string;
  subject?: RawSubject;
  required?: boolean;
  bindingAssetIds?: string[];
}

interface RawLook {
  id: string;
  name: string;
  kind: "primary" | "alternate" | "story-required";
  applicableEpisodeIds?: string[];
}

interface RawCharacter {
  id: string;
  name: string;
  kind: "human" | "creature" | "other";
  storyRole: string;
  oneLineSetting: string;
  personality: string[];
  biography: string;
  defaultLookId?: string;
  cardImageAssetId?: string;
  looks?: RawLook[];
}

interface RawLocation {
  id: string;
  name: string;
  oneLineSetting?: string;
  description?: string;
  cardImageAssetId?: string;
  aliasLocationIds?: string[];
}

interface RawScene {
  id: string;
  heading: string;
  summary?: string;
  locationId?: string;
  locationName?: string;
  scriptExcerpt?: string;
  cast?: Array<{ characterId: string; lookId?: string; speaks?: boolean }>;
  propIds?: string[];
  requirementIds?: string[];
}

interface RawEpisode {
  id: string;
  title: string;
  summary: string;
  summaryStatus?: string;
  scenes?: RawScene[];
}

interface RawStoryIndex {
  schemaVersion: 1;
  sourceBindings?: RawDocumentBinding[];
  documentBindings?: RawDocumentBinding[];
  story: ProjectStoryReadModel["story"];
  currentMilestone?: ProjectStoryReadModel["currentMilestone"];
  requirements?: RawRequirement[];
  characters?: RawCharacter[];
  locations?: RawLocation[];
  episodes?: RawEpisode[];
}

interface RawAssetIndex {
  schemaVersion: 1;
  assets?: RawAssetBinding[];
}

interface RawDocumentBinding {
  materialType: string;
  kind?: string;
  path: string;
  subject?: RawSubject;
  decisionStatus?: string;
  sha256?: string;
  legacyPath?: boolean;
}

const subjectKeysByRole: Record<string, Array<keyof RawSubject>> = {
  "character-standard": ["characterId", "lookId"],
  "voice-anchor": ["characterId"],
  "scene-master": ["locationId"],
  "prop-standard": ["propId", "state"],
};

function subjectMatches(requirement: RawRequirement, asset: RawAssetBinding) {
  const keys = subjectKeysByRole[requirement.role]
    ?? (["characterId", "lookId", "episodeId", "sceneId", "locationId", "propId", "shotId"] satisfies Array<keyof RawSubject>);
  return keys.every((key) => requirement.subject?.[key] === undefined || requirement.subject?.[key] === asset.subject?.[key]);
}

function assetAppliesToEpisodeScene(asset: RawAssetBinding, episodeId: string, sceneId: string) {
  const subject = asset.subject;
  if (subject?.episodeId && subject.episodeId !== episodeId) return false;
  if (subject?.episodeIds?.length && !subject.episodeIds.includes(episodeId)) return false;
  if (subject?.sceneId && subject.sceneId !== sceneId) return false;
  return true;
}

type AssetProblem = "INVALID_PATH" | "MISSING_FILE" | "HASH_MISMATCH";

async function sha256File(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

function aggregateCompletion(requirements: StoryRequirementResult[]): StoryCompletion {
  const due = requirements.filter((requirement) => requirement.status !== "NOT_DUE");
  const counts = {
    ready: due.filter((requirement) => requirement.status === "READY").length,
    required: due.length,
    missing: due.filter((requirement) => requirement.status === "MISSING").length,
    inProgress: due.filter((requirement) => requirement.status === "IN_PROGRESS").length,
    blocked: due.filter((requirement) => requirement.status === "BLOCKED").length,
  };
  const status: StoryObjectStatus = counts.required === 0
    ? "NOT_DUE"
    : counts.blocked > 0
      ? "BLOCKED"
      : counts.missing > 0
        ? "MISSING"
        : counts.inProgress > 0
          ? "IN_PROGRESS"
          : "READY";
  return { status, ...counts };
}

function kindForMaterialType(materialType: string): StoryAssetKind {
  if (materialType.startsWith("image.")) return "image";
  if (materialType.startsWith("video.")) return "video";
  if (materialType.startsWith("audio.")) return "audio";
  if (materialType.startsWith("story.") || materialType.startsWith("plan.") || materialType.startsWith("contract.") || materialType.startsWith("prompt.")) return "story";
  return "other";
}

function kindForPath(path: string): StoryAssetKind {
  const extension = extname(path).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) return "image";
  if ([".mp4", ".mov", ".mkv", ".webm"].includes(extension)) return "video";
  if ([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"].includes(extension)) return "audio";
  if ([".md", ".txt"].includes(extension)) return "story";
  return "other";
}

function isDiscardedStatus(status: string) {
  return status === "SUPERSEDED" || status.startsWith("REJECTED");
}

function isCurrentStoryAsset(asset: StoryAssetLink | undefined): asset is StoryAssetLink {
  return asset !== undefined
    && asset.materialType !== "media.reference"
    && asset.status !== "REFERENCE"
    && !isDiscardedStatus(asset.status);
}

function publicStoryMetadata(raw: ProjectStoryReadModel["story"]): Omit<ProjectStoryReadModel["story"], "source"> {
  return {
    title: raw.title,
    genre: raw.genre,
    totalEpisodes: raw.totalEpisodes,
    ...(raw.productionScope !== undefined ? { productionScope: raw.productionScope } : {}),
    logline: raw.logline,
    synopsis: raw.synopsis,
    ...(raw.coreConflict !== undefined ? { coreConflict: raw.coreConflict } : {}),
    ...(raw.relationshipArc !== undefined ? { relationshipArc: raw.relationshipArc } : {}),
    ...(raw.worldRules !== undefined ? { worldRules: raw.worldRules } : {}),
    summaryStatus: raw.summaryStatus,
  };
}

function assertUniqueStableIds(label: string, ids: unknown[]) {
  const values = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || !id.trim() || values.has(id)) {
      throw new ProjectWorkspaceError("invalid_index", `${label} 必须存在且保持唯一。`);
    }
    values.add(id);
  }
}

function publicVerification(raw: RawAssetBinding["verification"]): StoryAssetLink["verification"] | undefined {
  if (!raw) return undefined;
  return {
    ...(typeof raw.kind === "string" ? { kind: raw.kind } : {}),
    ...(typeof raw.verifiedAt === "string" ? { verifiedAt: raw.verifiedAt } : {}),
  };
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter((entry) => !entry.name.startsWith(".") && !entry.isSymbolicLink())
    .map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? walkFiles(path) : [path];
    }));
  return nested.flat();
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readProjectIndex<T>(workspaceRoot: string, projectId: string, fileName: string): Promise<T> {
  const projectRoot = await realpath(join(workspaceRoot, projectId));
  const candidate = join(projectRoot, "production", fileName);
  try {
    const fileStat = await lstat(candidate);
    const resolvedCandidate = await realpath(candidate);
    if (!fileStat.isFile() || fileStat.isSymbolicLink() || !resolvedCandidate.startsWith(`${projectRoot}${sep}`)) {
      throw new ProjectWorkspaceError("invalid_path", "剧本业务索引路径超出了当前项目。");
    }
    return await readJson<T>(resolvedCandidate);
  } catch (error) {
    if (error instanceof ProjectWorkspaceError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ProjectWorkspaceError("material_not_found", "项目还没有剧本业务索引。");
    }
    throw error;
  }
}

export function createProjectStoryCatalog(workspaceRoot: string) {
  const workspace = createProjectWorkspace(workspaceRoot);

  async function resolveStrictMaterialFile(projectId: string, materialPath: string) {
    const rawSegments = materialPath.split("/");
    if (!materialPath || isAbsolute(materialPath) || materialPath.includes("\\")
      || rawSegments.some((segment) => !segment || segment === "." || segment === ".." || segment.startsWith("."))) {
      throw new ProjectWorkspaceError("invalid_path", "素材绑定必须使用不含隐藏段或路径跳转的相对路径。");
    }
    const resolvedPath = await workspace.resolveMaterialPath(projectId, materialPath);
    const libraryRoot = resolve(workspaceRoot, projectId, "library");
    const libraryStat = await lstat(libraryRoot);
    if (!libraryStat.isDirectory() || libraryStat.isSymbolicLink()) {
      throw new ProjectWorkspaceError("invalid_path", "素材库必须是项目内的普通目录。");
    }

    const candidate = resolve(libraryRoot, materialPath);
    const relativeCandidate = relative(libraryRoot, candidate);
    if (!relativeCandidate || relativeCandidate.startsWith(`..${sep}`) || isAbsolute(relativeCandidate)) {
      throw new ProjectWorkspaceError("invalid_path", "素材绑定必须指向项目素材库内的普通文件。");
    }

    let cursor = libraryRoot;
    let updatedAt: string | undefined;
    const segments = relativeCandidate.split(sep);
    for (const [index, segment] of segments.entries()) {
      cursor = join(cursor, segment);
      const entryStat = await lstat(cursor);
      if (entryStat.isSymbolicLink()) {
        throw new ProjectWorkspaceError("invalid_path", "素材绑定不能经过符号链接。");
      }
      const isLast = index === segments.length - 1;
      if ((isLast && !entryStat.isFile()) || (!isLast && !entryStat.isDirectory())) {
        throw new ProjectWorkspaceError("invalid_path", "素材绑定必须指向普通文件。");
      }
      if (isLast) updatedAt = entryStat.mtime.toISOString();
    }
    if (!updatedAt) throw new ProjectWorkspaceError("invalid_path", "素材绑定必须指向普通文件。");
    return { resolvedPath, updatedAt };
  }

  async function assetLink(
    projectId: string,
    asset: RawAssetBinding,
    assetProblems: Map<string, AssetProblem>,
  ): Promise<StoryAssetLink> {
    let url: string | undefined;
    let updatedAt: string | undefined;
    let safePath = asset.path;
    const verification = publicVerification(asset.verification);
    const expectedSha256 = asset.sha256?.toLowerCase();
    if (expectedSha256 !== undefined && !/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new ProjectWorkspaceError("invalid_index", `素材 ${asset.assetId} 的 sha256 格式无效。`);
    }
    try {
      const resolvedFile = await resolveStrictMaterialFile(projectId, asset.path);
      url = `/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(asset.path)}`;
      updatedAt = resolvedFile.updatedAt;
      if (expectedSha256 !== undefined && await sha256File(resolvedFile.resolvedPath) !== expectedSha256) {
        assetProblems.set(asset.assetId, "HASH_MISMATCH");
      }
    } catch (error) {
      if (!(error instanceof ProjectWorkspaceError)) throw error;
      if (error.code === "invalid_index") throw error;
      const problem = error.code === "invalid_path" || isAbsolute(asset.path) ? "INVALID_PATH" : "MISSING_FILE";
      assetProblems.set(asset.assetId, problem);
      if (problem === "INVALID_PATH") safePath = "[已拒绝的不安全路径]";
    }
    const bindingState = asset.bindingState
      ?? (assetProblems.get(asset.assetId) === "HASH_MISMATCH" ? "CONFLICT" : undefined);
    const status = isDiscardedStatus(asset.status)
      ? asset.status
      : assetProblems.has(asset.assetId) ? "BLOCKED" : asset.status;
    return {
      assetId: asset.assetId,
      materialType: asset.materialType,
      path: safePath,
      name: basename(asset.path),
      kind: kindForMaterialType(asset.materialType),
      ...(url ? { url } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      status,
      legacyPath: asset.legacyPath === true,
      ...(bindingState ? { bindingState } : {}),
      ...(verification ? { verification } : {}),
    };
  }

  return {
    async readProjectStory(projectId: string, selection?: { episodeId?: string }): Promise<ProjectStoryReadModel> {
      const project = (await workspace.listProjects()).find((candidate) => candidate.id === projectId);
      if (!project) throw new ProjectWorkspaceError("project_not_found", "项目不存在。");

      const [storyIndex, assetIndex] = await Promise.all([
        readProjectIndex<RawStoryIndex>(workspaceRoot, projectId, "story-index.v1.json"),
        readProjectIndex<RawAssetIndex>(workspaceRoot, projectId, "asset-bindings.v1.json"),
      ]);
      if (storyIndex.schemaVersion !== 1 || assetIndex.schemaVersion !== 1) {
        throw new Error("项目剧本索引版本不受支持。");
      }

      const rawAssets = assetIndex.assets ?? [];
      const requirements = storyIndex.requirements ?? [];
      const rawCharacters = storyIndex.characters ?? [];
      const rawLocations = storyIndex.locations ?? [];
      const rawEpisodes = storyIndex.episodes ?? [];
      assertUniqueStableIds("assetId", rawAssets.map((asset) => asset.assetId));
      assertUniqueStableIds("requirement id", requirements.map((requirement) => requirement.id));
      assertUniqueStableIds("character id", rawCharacters.map((character) => character.id));
      assertUniqueStableIds("location id", rawLocations.map((location) => location.id));
      assertUniqueStableIds("episode id", rawEpisodes.map((episode) => episode.id));
      assertUniqueStableIds("scene id", rawEpisodes.flatMap((episode) => (episode.scenes ?? []).map((scene) => scene.id)));
      const episodeIds = new Set(rawEpisodes.map((episode) => episode.id));
      for (const asset of rawAssets) {
        assertUniqueStableIds("asset subject episode id", asset.subject?.episodeIds ?? []);
        for (const episodeId of asset.subject?.episodeIds ?? []) {
          if (!episodeIds.has(episodeId)) {
            throw new ProjectWorkspaceError("invalid_index", `素材 ${asset.assetId} 绑定了不存在的分集 ${episodeId}。`);
          }
        }
      }
      for (const character of rawCharacters) {
        assertUniqueStableIds("look id", (character.looks ?? []).map((look) => look.id));
      }
      const canonicalLocationIdByAlias = new Map(rawLocations.map((location) => [location.id, location.id] as const));
      for (const location of rawLocations) {
        assertUniqueStableIds("location alias id", location.aliasLocationIds ?? []);
        for (const aliasLocationId of location.aliasLocationIds ?? []) {
          const existing = canonicalLocationIdByAlias.get(aliasLocationId);
          if (existing && existing !== location.id) {
            throw new ProjectWorkspaceError("invalid_index", `地点别名 ${aliasLocationId} 同时指向多个地点家族。`);
          }
          canonicalLocationIdByAlias.set(aliasLocationId, location.id);
        }
      }
      const canonicalLocationId = (locationId: string) => canonicalLocationIdByAlias.get(locationId) ?? locationId;
      const linkedAssets = new Map<string, StoryAssetLink>();
      const assetProblems = new Map<string, AssetProblem>();
      await Promise.all(rawAssets.map(async (asset) => linkedAssets.set(asset.assetId, await assetLink(projectId, asset, assetProblems))));

      const rawDocuments = [
        ...(storyIndex.sourceBindings ?? []).map((binding, index) => ({ binding, assetId: `SOURCE:${index + 1}` })),
        ...(storyIndex.documentBindings ?? []).map((binding, index) => ({ binding, assetId: `DOCUMENT:${index + 1}` })),
      ];
      const linkedDocuments = new Map<string, StoryAssetLink>();
      await Promise.all(rawDocuments.map(async ({ binding, assetId }) => {
        const documentAsset: RawAssetBinding = {
          assetId,
          materialType: binding.materialType,
          path: binding.path,
          role: binding.materialType,
          subject: binding.subject,
          status: binding.decisionStatus ?? "DRAFT",
          sha256: binding.sha256,
          legacyPath: binding.legacyPath,
        };
        linkedDocuments.set(assetId, await assetLink(projectId, documentAsset, assetProblems));
      }));

      const currentMilestoneId = storyIndex.currentMilestone?.id;
      const currentMilestoneEpisodeIds = new Set(storyIndex.currentMilestone?.episodeIds ?? []);
      const episodeIdBySceneId = new Map(rawEpisodes.flatMap((episode) =>
        (episode.scenes ?? []).map((scene) => [scene.id, episode.id] as const),
      ));
      const sortedAssets = (assets: RawAssetBinding[]) => [...assets].sort((left, right) => left.assetId.localeCompare(right.assetId));
      const isReadyAsset = (asset: RawAssetBinding) => {
        const linked = linkedAssets.get(asset.assetId);
        return asset.status === "ACCEPTED" && Boolean(linked?.url) && !linked?.bindingState && !assetProblems.has(asset.assetId);
      };
      function evaluateRequirement(requirement: RawRequirement): StoryRequirementResult {
        const characterName = requirement.subject?.characterId
          ? rawCharacters.find((character) => character.id === requirement.subject?.characterId)?.name
          : undefined;
        const label = requirement.label
          ?? (requirement.role === "voice-anchor" && characterName ? `${characterName}对白声音` : requirement.role);
        const requirementEpisodeId = requirement.subject?.episodeId
          ?? (requirement.subject?.sceneId ? episodeIdBySceneId.get(requirement.subject.sceneId) : undefined);
        const outsideCurrentMilestone = currentMilestoneEpisodeIds.size > 0
          && requirementEpisodeId !== undefined
          && !currentMilestoneEpisodeIds.has(requirementEpisodeId);
        if (requirement.required === false
          || (requirement.milestoneId && requirement.milestoneId !== currentMilestoneId)
          || outsideCurrentMilestone) {
          return {
            id: requirement.id,
            label,
            role: requirement.role,
            status: "NOT_DUE",
            reason: "不属于当前里程碑。",
          };
        }

        const explicitAssetIds = requirement.bindingAssetIds ?? [];
        const usesExplicitBindings = explicitAssetIds.length > 0;
        const explicitlyBound = explicitAssetIds
          .map((assetId) => rawAssets.find((asset) => asset.assetId === assetId))
          .filter((asset): asset is RawAssetBinding => Boolean(asset));
        const candidates = usesExplicitBindings
          ? explicitlyBound
          : rawAssets.filter((asset) => asset.role === requirement.role && subjectMatches(requirement, asset));
        if (!candidates.length) {
          return {
            id: requirement.id,
            label,
            role: requirement.role,
            status: usesExplicitBindings ? "BLOCKED" : "MISSING",
            reason: usesExplicitBindings ? "显式绑定的素材登记不存在。" : "没有可用绑定。",
            ...(usesExplicitBindings ? { reasonCode: "MISSING_FILE" as const } : {}),
          };
        }

        const resultBase = {
          id: requirement.id,
          label,
          role: requirement.role,
        };
        if (usesExplicitBindings && explicitlyBound.length !== explicitAssetIds.length) {
          return { ...resultBase, status: "BLOCKED", reason: "部分显式绑定的素材登记不存在。", reasonCode: "MISSING_FILE" };
        }
        const roleConflict = candidates.find((asset) => asset.role !== requirement.role);
        const subjectConflict = candidates.find((asset) => !subjectMatches(requirement, asset));
        const conflicting = roleConflict ?? subjectConflict;
        if (conflicting) {
          const asset = linkedAssets.get(conflicting.assetId);
          return { ...resultBase, ...(asset ? { asset } : {}), status: "BLOCKED", reason: "当前绑定与所需职责、人物、造型或场景主体不匹配。", reasonCode: "SUBJECT_CONFLICT" };
        }
        const bindingConflict = candidates.find((asset) => asset.bindingState);
        if (bindingConflict) {
          const asset = linkedAssets.get(bindingConflict.assetId);
          const suggested = sortedAssets(rawAssets).find((candidate) =>
            candidate.assetId !== bindingConflict.assetId
            && candidate.role === requirement.role
            && subjectMatches(requirement, candidate)
            && isReadyAsset(candidate),
          );
          return {
            ...resultBase,
            ...(asset ? { asset } : {}),
            status: "BLOCKED",
            reason: bindingConflict.bindingState === "STALE_BINDING" ? "当前仍绑定旧素材，可改绑但不会自动替换。" : "当前绑定存在冲突。",
            reasonCode: bindingConflict.bindingState === "STALE_BINDING" ? "STALE_BINDING" : "STATUS_CONFLICT",
            ...(suggested ? { suggestedAsset: linkedAssets.get(suggested.assetId) } : {}),
          };
        }

        const accepted = sortedAssets(candidates).find(isReadyAsset);
        if (accepted) {
          const asset = linkedAssets.get(accepted.assetId);
          return { ...resultBase, ...(asset ? { asset } : {}), status: "READY", reason: "绑定文件存在，职责匹配且已验收。" };
        }
        const unavailable = sortedAssets(candidates).find((asset) => assetProblems.has(asset.assetId));
        if (unavailable) {
          const linked = linkedAssets.get(unavailable.assetId);
          const reasonCode = assetProblems.get(unavailable.assetId) ?? "MISSING_FILE";
          return {
            ...resultBase,
            ...(linked ? { asset: linked } : {}),
            status: "BLOCKED",
            reason: reasonCode === "INVALID_PATH"
              ? "绑定路径超出当前项目素材库，已拒绝。"
              : reasonCode === "HASH_MISMATCH"
                ? "绑定文件内容与登记的 SHA-256 不一致。"
                : "绑定文件缺失。",
            reasonCode,
          };
        }
        const rejected = sortedAssets(candidates).find((asset) => isDiscardedStatus(asset.status));
        if (rejected) {
          const asset = linkedAssets.get(rejected.assetId);
          return { ...resultBase, ...(asset ? { asset } : {}), status: "BLOCKED", reason: `绑定素材状态为 ${rejected.status}。`, reasonCode: "STATUS_CONFLICT" };
        }
        const selected = sortedAssets(candidates)[0];
        const linked = linkedAssets.get(selected.assetId);
        return { ...resultBase, ...(linked ? { asset: linked } : {}), status: "IN_PROGRESS", reason: `已有素材，当前状态为 ${selected.status}。` };
      }

      function matchingRequirement(role: string, subject: RawSubject, sceneId: string, episodeId: string) {
        const keys = subjectKeysByRole[role]
          ?? (["characterId", "lookId", "episodeId", "sceneId", "locationId", "propId", "shotId"] satisfies Array<keyof RawSubject>);
        return requirements.find((candidate) => candidate.role === role
          && candidate.required !== false
          && (!candidate.milestoneId || candidate.milestoneId === currentMilestoneId)
          && (!candidate.subject?.sceneId || candidate.subject.sceneId === sceneId)
          && (!candidate.subject?.episodeId || candidate.subject.episodeId === episodeId)
          && keys.every((key) => candidate.subject?.[key] === subject[key]));
      }

      function rawRequirementsForScene(episodeId: string, scene: RawScene) {
        const selected = new Map<string, RawRequirement>();
        for (const requirementId of scene.requirementIds ?? []) {
          const requirement = requirements.find((candidate) => candidate.id === requirementId);
          selected.set(requirementId, requirement ?? {
            id: requirementId,
            label: `缺失的需求登记 ${requirementId}`,
            role: "missing-requirement-registration",
            subject: { episodeId, sceneId: scene.id },
            bindingAssetIds: [`MISSING:${requirementId}`],
          });
        }
        for (const requirement of requirements.filter((candidate) => candidate.subject?.sceneId === scene.id)) {
          selected.set(requirement.id, requirement);
        }

        const addExpected = (suffix: string, role: string, label: string, subject: RawSubject) => {
          const existing = matchingRequirement(role, subject, scene.id, episodeId);
          const requirement = existing ?? {
            id: `INFERRED:${scene.id}:${suffix}`,
            label,
            role,
            subject: { ...subject, episodeId, sceneId: scene.id },
            required: true,
          };
          selected.set(requirement.id, requirement);
        };

        if (scene.locationId) {
          const locationId = canonicalLocationId(scene.locationId);
          addExpected(`LOCATION:${locationId}`, "scene-master", `${scene.locationName ?? scene.locationId}场景母版`, { locationId });
        }
        for (const member of scene.cast ?? []) {
          const characterName = rawCharacters.find((character) => character.id === member.characterId)?.name ?? member.characterId;
          if (member.lookId) {
            addExpected(`LOOK:${member.characterId}:${member.lookId}`, "character-standard", `${characterName}本场造型`, {
              characterId: member.characterId,
              lookId: member.lookId,
            });
          } else {
            selected.set(`INFERRED:${scene.id}:LOOK:${member.characterId}:UNASSIGNED`, {
              id: `INFERRED:${scene.id}:LOOK:${member.characterId}:UNASSIGNED`,
              label: `${characterName}本场造型未指定`,
              role: "character-standard",
              subject: { episodeId, sceneId: scene.id, characterId: member.characterId, lookId: "UNASSIGNED" },
              required: true,
            });
          }
          if (member.speaks === true) {
            addExpected(`VOICE:${member.characterId}`, "voice-anchor", `${characterName}对白声音`, { characterId: member.characterId });
          }
        }
        for (const propId of scene.propIds ?? []) {
          addExpected(`PROP:${propId}`, "prop-standard", `${propId}关键道具`, { propId });
        }
        return [...selected.values()];
      }

      function requirementsForScene(episodeId: string, scene: RawScene) {
        return rawRequirementsForScene(episodeId, scene).map(evaluateRequirement);
      }

      const allSceneRequirements = new Map<string, RawRequirement>();
      for (const episode of rawEpisodes) {
        for (const scene of episode.scenes ?? []) {
          for (const requirement of rawRequirementsForScene(episode.id, scene)) {
            allSceneRequirements.set(requirement.id, requirement);
          }
        }
      }

      const registeredPaths = new Set([
        ...rawAssets.map((asset) => asset.path),
        ...rawDocuments.map(({ binding }) => binding.path),
      ]);
      const libraryRoot = await workspace.resolveMaterialPath(projectId);
      const unregisteredFiles = (await walkFiles(libraryRoot))
        .map((filePath) => ({ filePath, path: relative(libraryRoot, filePath).split(sep).join("/") }))
        .filter(({ path }) => !registeredPaths.has(path));
      const unregisteredAssets: StoryAssetLink[] = (await Promise.all(unregisteredFiles.map(async ({ filePath, path }) => ({
        path,
        updatedAt: (await lstat(filePath)).mtime.toISOString(),
      }))))
        .sort((left, right) => left.path.localeCompare(right.path, "zh-CN", { numeric: true }))
        .map(({ path, updatedAt }) => ({
          assetId: `UNREGISTERED:${path}`,
          materialType: "unregistered",
          path,
          name: basename(path),
          kind: kindForPath(path),
          url: `/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`,
          updatedAt,
          status: "UNREGISTERED",
          legacyPath: false,
        }));

      const documentEntries = (storyIndex.documentBindings ?? []).map((binding, index) => ({
        binding,
        link: linkedDocuments.get(`DOCUMENT:${index + 1}`),
      }));
      function documentScope(binding: RawDocumentBinding) {
        if (binding.subject?.sceneId) return { kind: "scene" as const, id: binding.subject.sceneId };
        if (binding.subject?.episodeId) return { kind: "episode" as const, id: binding.subject.episodeId };
        if (binding.subject?.characterId) return { kind: "character" as const, id: binding.subject.characterId };
        if (binding.subject?.locationId) return { kind: "location" as const, id: binding.subject.locationId };
        return { kind: "project" as const, id: undefined };
      }
      function documentsFor(kind: "project" | "character" | "location" | "episode" | "scene", id?: string) {
        return documentEntries
          .filter(({ binding }) => {
            const scope = documentScope(binding);
            return scope.kind === kind && (id === undefined || scope.id === id);
          })
          .map(({ link }) => link)
          .filter((link): link is StoryAssetLink => Boolean(link) && isCurrentStoryAsset(link));
      }

      function assetCollectionStatus(assets: StoryAssetLink[]): StoryObjectStatus {
        if (assets.some((asset) => asset.status === "ACCEPTED" && asset.url && !asset.bindingState)) return "READY";
        if (assets.some((asset) => asset.bindingState || !asset.url || isDiscardedStatus(asset.status))) return "BLOCKED";
        return assets.length ? "IN_PROGRESS" : "MISSING";
      }

      function preferredRawAsset(assets: RawAssetBinding[]) {
        const ordered = sortedAssets(assets).filter((asset) => asset.materialType !== "media.reference"
          && asset.status !== "REFERENCE"
          && !isDiscardedStatus(asset.status));
        return ordered.find(isReadyAsset)
          ?? ordered.find((asset) => linkedAssets.get(asset.assetId)?.url && !linkedAssets.get(asset.assetId)?.bindingState)
          ?? ordered[0];
      }

      function preferredAsset(assets: RawAssetBinding[]) {
        const selected = preferredRawAsset(assets);
        return selected ? linkedAssets.get(selected.assetId) : undefined;
      }

      function lookStatus(look: RawLook, assets: StoryAssetLink[]): StoryObjectStatus {
        const milestoneEpisodes = new Set(storyIndex.currentMilestone?.episodeIds ?? []);
        const due = look.kind === "primary"
          || (look.kind === "story-required" && (!look.applicableEpisodeIds?.length || look.applicableEpisodeIds.some((episodeId) => milestoneEpisodes.has(episodeId))));
        if (!due) return "NOT_DUE";
        return assetCollectionStatus(assets);
      }

      const characters: CharacterReadModel[] = rawCharacters.map((character) => {
        const appearances = (storyIndex.episodes ?? []).flatMap((episode) =>
          (episode.scenes ?? []).filter((scene) => scene.cast?.some((member) => member.characterId === character.id)).map((scene) => ({ episodeId: episode.id, sceneId: scene.id })),
        );
        const hasExplicitCardImage = Boolean(character.cardImageAssetId);
        const defaultLookCardCandidates = !hasExplicitCardImage && character.defaultLookId
          ? rawAssets.filter((asset) => asset.materialType === "image.character"
            && asset.role === "character-standard"
            && asset.subject?.characterId === character.id
            && asset.subject.lookId === character.defaultLookId)
          : [];
        const rawCardImage = hasExplicitCardImage
          ? rawAssets.find((asset) => asset.assetId === character.cardImageAssetId)
          : preferredRawAsset(defaultLookCardCandidates);
        const cardMatchesCharacter = Boolean(rawCardImage
          && rawCardImage.materialType === "image.character"
          && rawCardImage.role === "character-standard"
          && rawCardImage.subject?.characterId === character.id);
        const linkedCardImage = rawCardImage ? linkedAssets.get(rawCardImage.assetId) : undefined;
        const cardImageProblem = rawCardImage ? assetProblems.get(rawCardImage.assetId) : undefined;
        const rawVoiceAssets = rawAssets.filter((asset) => asset.materialType === "audio.voice"
          && asset.subject?.characterId === character.id);
        const voiceAssets = rawVoiceAssets
          .map((asset) => linkedAssets.get(asset.assetId))
          .filter((asset): asset is StoryAssetLink => Boolean(asset) && isCurrentStoryAsset(asset));
        const selectedVoice = preferredAsset(rawVoiceAssets);
        const characterRequirements = new Map<string, RawRequirement>();
        for (const requirement of requirements) {
          if (requirement.subject?.characterId === character.id) characterRequirements.set(requirement.id, requirement);
        }
        for (const requirement of allSceneRequirements.values()) {
          if (requirement.subject?.characterId === character.id) characterRequirements.set(requirement.id, requirement);
        }
        const evaluatedCharacterRequirements = [...characterRequirements.values()].map(evaluateRequirement);
        const cardImageStatus: StoryObjectStatus = !rawCardImage
          ? hasExplicitCardImage ? "BLOCKED" : "MISSING"
          : !cardMatchesCharacter || linkedCardImage?.bindingState || !isCurrentStoryAsset(linkedCardImage) || !linkedCardImage.url
            ? "BLOCKED"
            : rawCardImage.status === "ACCEPTED"
              ? "READY"
              : "IN_PROGRESS";
        const cardImageReason = !rawCardImage
          ? hasExplicitCardImage
            ? "角色卡绑定的素材登记不存在。"
            : character.defaultLookId
              ? "默认主造型还没有人物标准图候选。"
              : "尚未设置角色卡图片或默认主造型。"
            : !cardMatchesCharacter
              ? "角色卡绑定与当前角色或人物图片职责不匹配。"
              : linkedCardImage?.bindingState
                ? cardImageProblem === "HASH_MISMATCH" ? "角色卡图片内容与登记的 SHA-256 不一致。" : "角色卡图片绑定存在冲突。"
                : rawCardImage.status === "REFERENCE"
                  ? "角色卡图片仅为参考，不作为当前人物图。"
                  : isDiscardedStatus(rawCardImage.status)
                    ? `角色卡图片状态为 ${rawCardImage.status}。`
                    : !linkedCardImage?.url
                      ? "角色卡图片路径不可用。"
                      : rawCardImage.status === "ACCEPTED"
                        ? hasExplicitCardImage ? "角色卡图片已验收。" : "已从默认主造型选择验收图片。"
                        : hasExplicitCardImage ? `角色卡图片状态为 ${rawCardImage.status}。` : `默认主造型候选状态为 ${rawCardImage.status}。`;
        return {
          id: character.id,
          name: character.name,
          kind: character.kind,
          storyRole: character.storyRole,
          oneLineSetting: character.oneLineSetting,
          personality: character.personality,
          biography: character.biography,
          ...(character.defaultLookId ? { defaultLookId: character.defaultLookId } : {}),
          ...(rawCardImage && cardMatchesCharacter && !linkedCardImage?.bindingState
            && isCurrentStoryAsset(linkedCardImage)
            ? { cardImage: linkedCardImage }
            : {}),
          cardImageStatus,
          cardImageReason,
          looks: (character.looks ?? []).map((look) => {
            const rawLookAssets = rawAssets
              .filter((asset) => asset.materialType === "image.character"
                && asset.role === "character-standard"
                && asset.subject?.characterId === character.id
                && asset.subject.lookId === look.id);
            const assets = rawLookAssets
              .map((asset) => linkedAssets.get(asset.assetId))
              .filter((asset): asset is StoryAssetLink => Boolean(asset) && isCurrentStoryAsset(asset));
            const selectedAsset = preferredAsset(rawLookAssets);
            return {
              id: look.id,
              name: look.name,
              kind: look.kind,
              applicableEpisodeIds: look.applicableEpisodeIds ?? [],
              assets,
              ...(selectedAsset ? { preferredAsset: selectedAsset } : {}),
              status: lookStatus(look, assets),
            };
          }),
          voiceAssets,
          ...(selectedVoice ? { preferredVoice: selectedVoice } : {}),
          episodeIds: [...new Set(appearances.map((appearance) => appearance.episodeId))],
          sceneCount: appearances.length,
          relatedFiles: documentsFor("character", character.id),
          requirements: evaluatedCharacterRequirements,
          completion: aggregateCompletion(evaluatedCharacterRequirements),
        };
      });

      const locationSeeds = new Map<string, RawLocation>();
      for (const location of rawLocations) locationSeeds.set(location.id, location);
      for (const episode of rawEpisodes) {
        for (const scene of episode.scenes ?? []) {
          if (!scene.locationId) continue;
          const locationId = canonicalLocationId(scene.locationId);
          if (locationSeeds.has(locationId)) continue;
          locationSeeds.set(locationId, {
            id: locationId,
            name: scene.locationName ?? scene.locationId,
          });
        }
      }
      for (const asset of rawAssets) {
        const locationId = asset.subject?.locationId ? canonicalLocationId(asset.subject.locationId) : undefined;
        if (locationId && !locationSeeds.has(locationId)) locationSeeds.set(locationId, { id: locationId, name: locationId });
      }
      for (const binding of storyIndex.documentBindings ?? []) {
        const locationId = binding.subject?.locationId ? canonicalLocationId(binding.subject.locationId) : undefined;
        if (locationId && !locationSeeds.has(locationId)) locationSeeds.set(locationId, { id: locationId, name: locationId });
      }

      const locations: LocationReadModel[] = [...locationSeeds.values()].map((location) => {
        const appearances = rawEpisodes.flatMap((episode) => (episode.scenes ?? [])
          .filter((scene) => scene.locationId && canonicalLocationId(scene.locationId) === location.id)
          .map((scene) => ({ episodeId: episode.id, sceneId: scene.id })));
        const rawImages = rawAssets.filter((asset) => asset.materialType === "image.scene"
          && asset.subject?.locationId === location.id);
        const images = rawImages
          .map((asset) => linkedAssets.get(asset.assetId))
          .filter((asset): asset is StoryAssetLink => Boolean(asset) && isCurrentStoryAsset(asset));
        const hasExplicitCardImage = Boolean(location.cardImageAssetId);
        const rawCardImage = hasExplicitCardImage
          ? rawAssets.find((asset) => asset.assetId === location.cardImageAssetId)
          : preferredRawAsset(rawImages);
        const linkedCardImage = rawCardImage ? linkedAssets.get(rawCardImage.assetId) : undefined;
        const cardMatchesLocation = Boolean(rawCardImage
          && rawCardImage.materialType === "image.scene"
          && rawCardImage.subject?.locationId === location.id);
        const rawAmbientAudio = rawAssets.filter((asset) => asset.materialType === "audio.ambient"
          && asset.subject?.locationId === location.id);
        const ambientAudio = rawAmbientAudio
          .map((asset) => linkedAssets.get(asset.assetId))
          .filter((asset): asset is StoryAssetLink => Boolean(asset) && isCurrentStoryAsset(asset));
        const selectedAmbientAudio = preferredAsset(rawAmbientAudio);
        const cardImageStatus: StoryObjectStatus = !rawCardImage
          ? hasExplicitCardImage ? "BLOCKED" : "MISSING"
          : !cardMatchesLocation || linkedCardImage?.bindingState || !linkedCardImage?.url
              || !isCurrentStoryAsset(linkedCardImage)
            ? "BLOCKED"
            : rawCardImage.status === "ACCEPTED" ? "READY" : "IN_PROGRESS";
        const cardImageReason = !rawCardImage
          ? hasExplicitCardImage ? "场景卡绑定的素材登记不存在。" : "尚未登记场景母版图片。"
          : !cardMatchesLocation
            ? "场景卡绑定与当前场景或场景图片职责不匹配。"
            : linkedCardImage?.bindingState
              ? "场景卡图片绑定存在冲突。"
              : rawCardImage.status === "REFERENCE"
                ? "场景卡图片仅为参考，不作为当前场景图。"
                : isDiscardedStatus(rawCardImage.status)
                  ? `场景卡图片状态为 ${rawCardImage.status}。`
                  : !linkedCardImage?.url
                    ? "场景卡图片路径不可用。"
                    : rawCardImage.status === "ACCEPTED" ? "场景母版图片已验收。" : `场景母版图片状态为 ${rawCardImage.status}。`;
        return {
          id: location.id,
          name: location.name,
          ...(location.oneLineSetting ? { oneLineSetting: location.oneLineSetting } : {}),
          ...(location.description ? { description: location.description } : {}),
          ...(rawCardImage && cardMatchesLocation && !linkedCardImage?.bindingState
            && isCurrentStoryAsset(linkedCardImage)
            ? { cardImage: linkedCardImage }
            : {}),
          cardImageStatus,
          cardImageReason,
          images,
          ambientAudio,
          ...(selectedAmbientAudio ? { preferredAmbientAudio: selectedAmbientAudio } : {}),
          relatedFiles: documentsFor("location", location.id),
          episodeIds: [...new Set(appearances.map((appearance) => appearance.episodeId))],
          sceneCount: appearances.length,
        };
      });

      const episodeRequirements = (episode: RawEpisode) => {
        const sceneIds = new Set((episode.scenes ?? []).map((scene) => scene.id));
        const selected = new Map<string, RawRequirement>();
        for (const requirement of requirements.filter((candidate) =>
          candidate.subject?.episodeId === episode.id || (candidate.subject?.sceneId && sceneIds.has(candidate.subject.sceneId)))) {
          selected.set(requirement.id, requirement);
        }
        for (const scene of episode.scenes ?? []) {
          for (const requirement of rawRequirementsForScene(episode.id, scene)) selected.set(requirement.id, requirement);
        }
        return [...selected.values()];
      };
      const episodes: EpisodeSummaryReadModel[] = rawEpisodes.map((episode) => {
        const evaluated = episodeRequirements(episode)
          .map(evaluateRequirement);
        return {
          id: episode.id,
          title: episode.title,
          summary: episode.summary,
          summaryStatus: episode.summaryStatus ?? "DRAFT_SUMMARY",
          sceneCount: episode.scenes?.length ?? 0,
          characterIds: [...new Set((episode.scenes ?? []).flatMap((scene) => scene.cast?.map((member) => member.characterId) ?? []))],
          locationIds: [...new Set((episode.scenes ?? []).flatMap((scene) => scene.locationId ? [canonicalLocationId(scene.locationId)] : []))],
          requirements: evaluated,
          completion: aggregateCompletion(evaluated),
        };
      });
      const projectRequirements = new Map<string, RawRequirement>();
      for (const requirement of requirements) projectRequirements.set(requirement.id, requirement);
      for (const requirement of allSceneRequirements.values()) projectRequirements.set(requirement.id, requirement);
      const currentMilestoneCompletion = aggregateCompletion([...projectRequirements.values()].map(evaluateRequirement));

      const usableDocument = (
        episodeId: string,
        materialType: string,
        options: { acceptedOnly?: boolean; episodeLevelOnly?: boolean } = {},
      ) => documentEntries.some(({ binding, link }) =>
        binding.materialType === materialType
        && binding.subject?.episodeId === episodeId
        && (!options.episodeLevelOnly || (!binding.subject?.sceneId && !binding.subject?.shotId))
        && Boolean(link?.url)
        && !link?.bindingState
        && link?.status !== "BLOCKED"
        && !isDiscardedStatus(link?.status ?? "")
        && (!options.acceptedOnly || link?.status === "ACCEPTED"));
      const usableEpisodeAssets = (episodeId: string, materialType: string) => rawAssets.filter((asset) => {
        const linked = linkedAssets.get(asset.assetId);
        const boundEpisodeId = asset.subject?.episodeId
          ?? (asset.subject?.sceneId ? episodeIdBySceneId.get(asset.subject.sceneId) : undefined);
        return boundEpisodeId === episodeId
          && asset.materialType === materialType
          && Boolean(linked?.url)
          && !linked?.bindingState
          && !["BLOCKED", "REFERENCE"].includes(linked?.status ?? "")
          && !isDiscardedStatus(linked?.status ?? "");
      });
      const productionEpisodes = rawEpisodes.map((rawEpisode) => {
        const scriptReady = usableDocument(rawEpisode.id, "story.episode-script", { acceptedOnly: true });
        const storyboardReady = usableDocument(rawEpisode.id, "prompt.video", { episodeLevelOnly: true });
        const shotAssets = usableEpisodeAssets(rawEpisode.id, "video.shot");
        const finalAssets = usableEpisodeAssets(rawEpisode.id, "video.final");
        const finalAccepted = finalAssets.some((asset) => {
          const linked = linkedAssets.get(asset.assetId);
          return asset.status === "ACCEPTED" && linked?.verification?.kind === "human-playback";
        });
        const stage: EpisodeProductionStage = finalAccepted
          ? "COMPLETED"
          : finalAssets.length > 0
            ? "FINAL_REVIEW"
            : shotAssets.length > 0
              ? "SHOT_PRODUCTION"
              : currentMilestoneEpisodeIds.has(rawEpisode.id)
                ? "PREPRODUCTION"
                : storyboardReady
                  ? "STORYBOARD_DRAFT"
                  : scriptReady
                    ? "SCRIPT_READY"
                    : "NOT_STARTED";
        return {
          id: rawEpisode.id,
          title: rawEpisode.title,
          stage,
          current: currentMilestoneEpisodeIds.has(rawEpisode.id),
          scriptReady,
          storyboardReady,
          shotProduced: shotAssets.length > 0,
          finalAccepted,
        };
      });
      const stageCounts: Record<EpisodeProductionStage, number> = {
        NOT_STARTED: Math.max(storyIndex.story.totalEpisodes - productionEpisodes.length, 0),
        SCRIPT_READY: 0,
        STORYBOARD_DRAFT: 0,
        PREPRODUCTION: 0,
        SHOT_PRODUCTION: 0,
        FINAL_REVIEW: 0,
        COMPLETED: 0,
      };
      for (const episodeProgress of productionEpisodes) stageCounts[episodeProgress.stage] += 1;
      const completedEpisodes = stageCounts.COMPLETED;
      const production = {
        completedEpisodes,
        totalEpisodes: storyIndex.story.totalEpisodes,
        percentage: storyIndex.story.totalEpisodes > 0
          ? Math.round((completedEpisodes / storyIndex.story.totalEpisodes) * 100)
          : 0,
        pipeline: {
          scriptReady: productionEpisodes.filter((episodeProgress) => episodeProgress.scriptReady).length,
          storyboardReady: productionEpisodes.filter((episodeProgress) => episodeProgress.storyboardReady).length,
          shotProduced: productionEpisodes.filter((episodeProgress) => episodeProgress.shotProduced).length,
          finalAccepted: productionEpisodes.filter((episodeProgress) => episodeProgress.finalAccepted).length,
        },
        stageCounts,
        episodes: productionEpisodes.map(({ id, title, stage, current }) => ({ id, title, stage, current })),
      };

      const reusableMaterialTypes = new Set([
        "image.character",
        "audio.voice",
        "image.scene",
        "audio.ambient",
        "image.prop",
      ]);

      let episode: EpisodeDetailReadModel | undefined;
      if (selection?.episodeId) {
        const rawEpisode = rawEpisodes.find((candidate) => candidate.id === selection.episodeId);
        const summary = episodes.find((candidate) => candidate.id === selection.episodeId);
        if (!rawEpisode || !summary) throw new ProjectWorkspaceError("material_not_found", "分集不存在。");
        const scenes: SceneReadModel[] = (rawEpisode.scenes ?? []).map((scene) => {
          const sceneRequirements = requirementsForScene(rawEpisode.id, scene);
          return {
            id: scene.id,
            heading: scene.heading,
            ...(scene.summary ? { summary: scene.summary } : {}),
            ...(scene.locationId ? { locationId: scene.locationId } : {}),
            ...(scene.locationName ? { locationName: scene.locationName } : {}),
            ...(scene.scriptExcerpt ? { scriptExcerpt: scene.scriptExcerpt } : {}),
            cast: (scene.cast ?? []).map((member) => {
              const character = characters.find((candidate) => candidate.id === member.characterId);
              const look = character?.looks.find((candidate) => candidate.id === member.lookId);
              return {
                characterId: member.characterId,
                characterName: character?.name ?? member.characterId,
                ...(member.lookId ? { lookId: member.lookId } : {}),
                ...(look ? { lookName: look.name } : {}),
                speaks: member.speaks === true,
              };
            }),
            propIds: scene.propIds ?? [],
            props: (scene.propIds ?? []).map((propId) => {
              const candidates = rawAssets.filter((asset) => asset.materialType === "image.prop"
                && asset.role === "prop-standard"
                && asset.subject?.propId === propId
                && assetAppliesToEpisodeScene(asset, rawEpisode.id, scene.id));
              const assets = candidates
                .map((asset) => linkedAssets.get(asset.assetId))
                .filter((asset): asset is StoryAssetLink => Boolean(asset) && isCurrentStoryAsset(asset));
              const asset = preferredAsset(candidates);
              return {
                id: propId,
                status: assetCollectionStatus(assets),
                assets,
                ...(asset ? { asset } : {}),
              };
            }),
            requirements: sceneRequirements,
            completion: aggregateCompletion(sceneRequirements),
            assets: rawAssets
              .filter((asset) => asset.subject?.sceneId === scene.id && !reusableMaterialTypes.has(asset.materialType))
              .map((asset) => linkedAssets.get(asset.assetId))
              .filter((asset): asset is StoryAssetLink => Boolean(asset) && isCurrentStoryAsset(asset)),
            derivedAssets: rawAssets
              .filter((asset) => asset.subject?.sceneId === scene.id && (asset.materialType === "image.derived" || asset.materialType === "video.shot"))
              .map((asset) => linkedAssets.get(asset.assetId))
              .filter((asset): asset is StoryAssetLink => Boolean(asset) && isCurrentStoryAsset(asset)),
            relatedFiles: documentsFor("scene", scene.id),
          };
        });
        const scriptIndex = (storyIndex.documentBindings ?? []).findIndex((binding) =>
          binding.materialType === "story.episode-script" && binding.subject?.episodeId === rawEpisode.id,
        );
        const script = scriptIndex >= 0 ? linkedDocuments.get(`DOCUMENT:${scriptIndex + 1}`) : undefined;
        episode = {
          ...summary,
          ...(script?.url && isCurrentStoryAsset(script) ? { script } : {}),
          relatedFiles: documentsFor("episode", rawEpisode.id)
            .filter((file) => file.materialType !== "story.episode-script" || !file.url),
          assets: rawAssets
            .filter((asset) => asset.subject?.episodeId === rawEpisode.id
              && !asset.subject?.sceneId
              && !reusableMaterialTypes.has(asset.materialType))
            .map((asset) => linkedAssets.get(asset.assetId))
            .filter((asset): asset is StoryAssetLink => Boolean(asset) && isCurrentStoryAsset(asset)),
          scenes,
        };
      }

      const sourceIndex = (storyIndex.sourceBindings ?? []).findIndex((binding) => binding.materialType === "story.source");
      const source = sourceIndex >= 0 ? linkedDocuments.get(`SOURCE:${sourceIndex + 1}`) : undefined;
      const allAssets = [
        ...linkedAssets.values(),
        ...linkedDocuments.values(),
      ].filter(isCurrentStoryAsset);

      return {
        project: {
          id: project.id,
          name: project.name,
          ...(project.description ? { description: project.description } : {}),
        },
        story: { ...publicStoryMetadata(storyIndex.story), ...(source?.url && isCurrentStoryAsset(source) ? { source } : {}) },
        currentMilestone: storyIndex.currentMilestone
          ? {
              id: storyIndex.currentMilestone.id,
              ...(storyIndex.currentMilestone.name ? { name: storyIndex.currentMilestone.name } : {}),
              episodeIds: storyIndex.currentMilestone.episodeIds,
            }
          : { id: "UNSPECIFIED", episodeIds: [] },
        currentMilestoneCompletion,
        production,
        characters,
        locations,
        episodes,
        ...(episode ? { episode } : {}),
        relatedFiles: documentsFor("project"),
        unregisteredAssets,
        assets: allAssets,
      };
    },
  };
}
