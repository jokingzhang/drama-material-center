import type { SceneReadModel, StoryAssetLink } from "../types/story";

const naturalCollator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const shotTokenPattern = /(?:^|[-_/])U(\d+)([A-Z]?)(?=[-_.]|$)/i;

function isCurrentAsset(asset: StoryAssetLink | undefined): asset is StoryAssetLink {
  return Boolean(asset)
    && asset?.materialType !== "media.reference"
    && asset?.status !== "REFERENCE"
    && asset?.status !== "SUPERSEDED"
    && !asset?.status.startsWith("REJECTED");
}

export function deduplicateCurrentStoryAssets(assets: Array<StoryAssetLink | undefined>) {
  const unique = new Map<string, StoryAssetLink>();
  for (const asset of assets) {
    if (!isCurrentAsset(asset)) continue;
    unique.set(asset.assetId, asset);
  }
  return [...unique.values()];
}

function shotTokenFor(asset: StoryAssetLink) {
  const match = `${asset.path}/${asset.name}`.match(shotTokenPattern);
  if (!match) return undefined;
  return { number: Number.parseInt(match[1], 10), suffix: match[2].toUpperCase(), token: `U${match[1]}${match[2].toUpperCase()}` };
}

export function shotPromptLabel(asset: StoryAssetLink) {
  const token = shotTokenFor(asset)?.token;
  return token ? `片段 ${token}` : "分镜提示词";
}

export function sortCurrentShotPrompts(assets: Array<StoryAssetLink | undefined>) {
  return deduplicateCurrentStoryAssets(assets)
    .filter((asset) => asset.materialType === "prompt.video")
    .sort((left, right) => {
      const leftToken = shotTokenFor(left);
      const rightToken = shotTokenFor(right);
      if (leftToken && rightToken) {
        if (leftToken.number !== rightToken.number) return leftToken.number - rightToken.number;
        const suffixOrder = naturalCollator.compare(leftToken.suffix, rightToken.suffix);
        if (suffixOrder !== 0) return suffixOrder;
      } else if (leftToken) {
        return -1;
      } else if (rightToken) {
        return 1;
      }
      return naturalCollator.compare(left.path, right.path);
    });
}

type SceneDedicatedSource = Pick<SceneReadModel, "relatedFiles" | "assets" | "derivedAssets" | "props">;

export function collectSceneDedicatedAssets(scene: SceneDedicatedSource) {
  const textAssets = sortCurrentShotPrompts(scene.relatedFiles);
  const imageAssets = deduplicateCurrentStoryAssets([
    ...deduplicateCurrentStoryAssets([...scene.derivedAssets, ...scene.assets])
      .filter((asset) => asset.materialType === "image.derived" && asset.kind === "image"),
    ...scene.props.flatMap((prop) => prop.assets)
      .filter((asset) => asset.materialType === "image.prop" && asset.kind === "image"),
  ]);
  const textLabels = Object.fromEntries(textAssets.map((asset) => [asset.assetId, shotPromptLabel(asset)]));
  return { textAssets, textLabels, imageAssets };
}
