import type { MaterialAsset, MaterialKind } from "../types";

export type ProductionStage =
  | "story"
  | "board"
  | "character"
  | "scene"
  | "prop"
  | "keyframe"
  | "prompt"
  | "take"
  | "audio"
  | "final"
  | "other";

export type PathMarker = "ACCEPTED" | "REJECTED" | "SUPERSEDED" | "DRAFT" | "INTERNAL" | "GEN_INPUT";

export interface ProductionMeta {
  episode?: number;
  shot?: string;
  version?: string;
  stage: ProductionStage;
  pathMarker?: PathMarker;
}

const stageLabels: Record<ProductionStage, string> = {
  story: "剧情",
  board: "分镜",
  character: "角色",
  scene: "场景",
  prop: "道具",
  keyframe: "关键帧",
  prompt: "提示词",
  take: "试片",
  audio: "音频",
  final: "成片",
  other: "其他",
};

const stageOrder: ProductionStage[] = [
  "story",
  "character",
  "scene",
  "prop",
  "board",
  "keyframe",
  "prompt",
  "take",
  "audio",
  "final",
  "other",
];

const chineseDigits = new Map([
  ["零", 0],
  ["〇", 0],
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
]);

export function parseChineseNumber(value: string): number | undefined {
  if (/^\d+$/.test(value)) return Number(value);
  if (!value) return undefined;

  let total = 0;
  let current = 0;
  for (const character of value) {
    if (character === "百") {
      total += (current || 1) * 100;
      current = 0;
      continue;
    }
    if (character === "十") {
      total += (current || 1) * 10;
      current = 0;
      continue;
    }
    const digit = chineseDigits.get(character);
    if (digit === undefined) return undefined;
    current = current * 10 + digit;
  }
  return total + current;
}

function episodeInText(value: string): number | undefined {
  if (/EP\s*0*\d{1,3}\s*[-–—~至]\s*EP?\s*0*\d{1,3}/i.test(value)) return undefined;
  const epMatch = value.match(/(?:^|[^a-z\d])EP\s*0*(\d{1,3})(?!\d)/i);
  if (epMatch) return Number(epMatch[1]);
  const chineseMatch = value.match(/第([零〇一二两三四五六七八九十百\d]+)集/);
  return chineseMatch ? parseChineseNumber(chineseMatch[1]) : undefined;
}

export function episodeForPath(path: string): number | undefined {
  const segments = path.split("/");
  for (const segment of segments.reverse()) {
    const episode = episodeInText(segment);
    if (episode !== undefined) return episode;
  }
  return undefined;
}

export function shotForPath(path: string): string | undefined {
  const matches = [...path.matchAll(/(?:^|[-_/\s])((?:S|T)\d{1,3}[A-Z]?)(?=$|[-_/\s])/gi)];
  return matches.at(-1)?.[1]?.toUpperCase();
}

export function versionForPath(path: string): string | undefined {
  const matches = [...path.matchAll(/(?:^|[-_/\s])(v\d{1,3}(?:-r\d{1,3})?)(?=$|[-_/\s.])/gi)];
  return matches.at(-1)?.[1]?.toLowerCase();
}

function markerForPath(path: string): PathMarker | undefined {
  const normalized = path.toLocaleLowerCase("zh-CN");
  if (/(?:^|\/)(?:rejected|废弃|拒绝)(?:\/|$)/.test(normalized)) return "REJECTED";
  if (/(?:^|\/)(?:superseded|deprecated|archive|归档)(?:\/|$)/.test(normalized)) return "SUPERSEDED";
  if (/(?:^|\/)(?:approved(?:-v\d+)?|accepted|已通过)(?:\/|$)/.test(normalized)) return "ACCEPTED";
  if (/(?:^|\/)(?:drafts?|dailies|candidate|candidates|草稿|候选)(?:\/|$)/.test(normalized)) return "DRAFT";
  if (/(?:^|\/)(?:gen[_-]?input|生成输入)(?:\/|$)/.test(normalized)) return "GEN_INPUT";
  if (/(?:^|\/)(?:boards?|storyboards?|white-model|白模|动作板|分镜板)(?:\/|$)/.test(normalized)) return "INTERNAL";
  return undefined;
}

function stageFor(asset: Pick<MaterialAsset, "path" | "kind">): ProductionStage {
  const normalized = asset.path.toLocaleLowerCase("zh-CN");
  if (/(?:^|\/)(?:成片|final|publish)(?:\/|$)/.test(normalized)) return "final";
  if (asset.kind === "audio") return "audio";
  if (/(?:storyboards?|boards?|分镜|动作板|白模)/.test(normalized)) return "board";
  if (/(?:characters?|人物|角色)/.test(normalized)) return "character";
  if (/(?:scenes?|locations?|场景|空间)/.test(normalized)) return "scene";
  if (/(?:props?|道具)/.test(normalized)) return "prop";
  if (/(?:keyframes?|kf(?:[-_/]|$)|关键帧|首帧|尾帧)/.test(normalized)) return "keyframe";
  if (/(?:prompts?|提示词)/.test(normalized)) return "prompt";
  if (asset.kind === "video" || /(?:take[-_]?\d+|试片|dailies)/.test(normalized)) return "take";
  if (asset.kind === "story") return "story";
  return "other";
}

export function productionMetaFor(asset: Pick<MaterialAsset, "path" | "kind">): ProductionMeta {
  return {
    episode: episodeForPath(asset.path),
    shot: shotForPath(asset.path),
    version: versionForPath(asset.path),
    stage: stageFor(asset),
    pathMarker: markerForPath(asset.path),
  };
}

export function productionStageLabel(stage: ProductionStage) {
  return stageLabels[stage];
}

export function productionStageIndex(stage: ProductionStage) {
  return stageOrder.indexOf(stage);
}

export function episodeLabel(episode: number) {
  return `EP${String(episode).padStart(2, "0")}`;
}

export function naturalProductionCompare(left: string, right: string) {
  const leftEpisode = episodeForPath(left);
  const rightEpisode = episodeForPath(right);
  if (leftEpisode !== undefined || rightEpisode !== undefined) {
    if (leftEpisode === undefined) return 1;
    if (rightEpisode === undefined) return -1;
    if (leftEpisode !== rightEpisode) return leftEpisode - rightEpisode;
  }
  return left.localeCompare(right, "zh-CN", { numeric: true, sensitivity: "base" });
}

export function kindLabel(kind: MaterialKind) {
  if (kind === "story") return "文档";
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  if (kind === "audio") return "音频";
  return "文件";
}
