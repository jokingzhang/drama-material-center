import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [projectId, manifestPath] = process.argv.slice(2);

if (!projectId || !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(projectId) || !manifestPath) {
  console.error("用法：npm run audit:story-assets -- <project-id> <项目内候选清单相对路径>");
  process.exit(1);
}

function envValue(name) {
  const envPath = resolve(repositoryRoot, ".env.local");
  if (!existsSync(envPath)) return undefined;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match || match[1].trim() !== name) continue;
    return match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return undefined;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function inside(root, candidate) {
  const child = relative(root, candidate);
  return child && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

const configuredWorkspace = envValue("MATERIAL_CENTER_WORKSPACE") ?? "workspace";
const workspaceRoot = resolve(repositoryRoot, configuredWorkspace);
const projectRoot = realpathSync(resolve(workspaceRoot, projectId));
const resolvedManifest = resolve(projectRoot, manifestPath);
if (!inside(projectRoot, resolvedManifest)) {
  console.error("候选清单必须位于目标项目内。");
  process.exit(1);
}

const manifest = readJson(resolvedManifest);
const storyIndex = readJson(resolve(projectRoot, "production/story-index.v1.json"));
const bindingIndex = readJson(resolve(projectRoot, "production/asset-bindings.v1.json"));
const candidates = (manifest.assets ?? []).filter((asset) => asset.proposedRole === "TARGET_CANDIDATE");
const formalById = new Map((bindingIndex.assets ?? []).map((asset) => [asset.assetId, asset]));
const formalByPath = new Map((bindingIndex.assets ?? []).map((asset) => [asset.path, asset]));
const characters = new Map((storyIndex.characters ?? []).map((character) => [character.id, character]));
const locations = new Set((storyIndex.locations ?? []).map((location) => location.id));
const usedPropIds = new Set((storyIndex.episodes ?? []).flatMap((episode) =>
  (episode.scenes ?? []).flatMap((scene) => scene.propIds ?? []),
));
const expectedRoles = {
  "image.character": "character-standard",
  "image.scene": "scene-master",
  "image.prop": "prop-standard",
};
const errors = [];

function expandEpisodeBindings(values) {
  const episodeIds = new Set();
  for (const value of values ?? []) {
    for (const match of String(value).matchAll(/EP(\d{2})(?:-EP(\d{2}))?/g)) {
      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);
      for (let episode = start; episode <= end; episode += 1) {
        episodeIds.add(`EP${String(episode).padStart(2, "0")}`);
      }
    }
  }
  return [...episodeIds].sort();
}

for (const candidate of candidates) {
  const label = candidate.path ?? candidate.assetId ?? "UNKNOWN";
  const formalPath = candidate.path?.replace(/^library\//, "");
  const binding = formalById.get(candidate.assetId) ?? formalByPath.get(formalPath);
  if (!candidate.assetId || !binding) {
    errors.push(`${label}: 正式 asset binding 缺失。`);
    continue;
  }
  const expectedRole = expectedRoles[candidate.materialType];
  if (!expectedRole || candidate.role !== expectedRole || binding.role !== expectedRole) {
    errors.push(`${label}: role 未正确登记。`);
  }
  if (binding.path !== formalPath || binding.materialType !== candidate.materialType || binding.sha256 !== candidate.sha256) {
    errors.push(`${label}: 正式路径、类型或 SHA-256 与候选清单不一致。`);
  }
  const expectedStatus = candidate.status === "DRAFT_WITH_ISSUES" ? "DRAFT_WITH_ISSUES" : "DRAFT";
  if (binding.status !== expectedStatus || binding.status === "ACCEPTED") {
    errors.push(`${label}: 正式状态必须保持 ${expectedStatus}，不得由机器提升为 ACCEPTED。`);
  }
  const materialFile = resolve(projectRoot, "library", formalPath ?? "");
  if (!inside(resolve(projectRoot, "library"), materialFile) || !existsSync(materialFile)) {
    errors.push(`${label}: 正式素材文件不存在或越出 library。`);
  } else if (sha256(materialFile) !== candidate.sha256) {
    errors.push(`${label}: 磁盘文件 SHA-256 与登记不一致。`);
  }

  if (candidate.materialType === "image.character") {
    const { characterId, lookId } = candidate.subject ?? {};
    const character = characters.get(characterId);
    if (!characterId || !lookId || binding.subject?.characterId !== characterId || binding.subject?.lookId !== lookId
      || !(character?.looks ?? []).some((look) => look.id === lookId)) {
      errors.push(`${label}: 人物 characterId / lookId 未接入 story-index。`);
    }
  } else if (candidate.materialType === "image.scene") {
    const { locationId } = candidate.subject ?? {};
    if (!locationId || binding.subject?.locationId !== locationId || !locations.has(locationId)) {
      errors.push(`${label}: 场景 locationId 未接入 story-index 地点家族。`);
    }
  } else if (candidate.materialType === "image.prop") {
    const { propId, state } = candidate.subject ?? {};
    if (!propId || !state || binding.subject?.propId !== propId || binding.subject?.state !== state || !usedPropIds.has(propId)) {
      errors.push(`${label}: 道具 propId 未接入任何剧本场次。`);
    }
    const expectedEpisodeIds = expandEpisodeBindings(candidate.storyBinding?.proposed);
    const boundEpisodeIds = [...new Set(binding.subject?.episodeIds ?? [])].sort();
    if (!expectedEpisodeIds.length || JSON.stringify(boundEpisodeIds) !== JSON.stringify(expectedEpisodeIds)) {
      errors.push(`${label}: 道具 state / episodeIds 与候选清单适用范围不一致。`);
    }
  }
}

if (!candidates.length) errors.push("候选清单中没有 TARGET_CANDIDATE。");
if (errors.length) {
  console.error(`剧本素材接入审计失败（${errors.length} 项）：\n${errors.join("\n")}`);
  process.exit(1);
}

console.log(`剧本素材接入审计通过：${candidates.length} 个最终候选均已落盘、正式绑定并接入业务主体；状态仍受人工验收闸门约束。`);
