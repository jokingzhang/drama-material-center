import { describe, expect, it } from "vitest";
import type { StoryAssetLink } from "../types/story";
import {
  assetVersionTag,
  collectSceneDedicatedAssets,
  readableAssetTitle,
  sceneViewBadge,
  shotPromptDuration,
  shotUnitCode,
  sortCurrentShotPrompts,
} from "./storyAssets";

function asset(assetId: string, path: string, materialType: string, status = "DRAFT", kind: StoryAssetLink["kind"] = "story"): StoryAssetLink {
  return { assetId, path, name: path.split("/").at(-1) ?? path, materialType, status, kind, legacyPath: false, url: `/file/${assetId}` };
}

describe("episode dedicated story assets", () => {
  it("extracts the visible duration from a shot prompt", () => {
    expect(shotPromptDuration("**总时长：10秒｜画幅：9:16**")).toBe("10 秒");
    expect(shotPromptDuration("总时长: 9.8 秒｜竖屏")).toBe("9.8 秒");
    expect(shotPromptDuration("没有登记时长")).toBeUndefined();
  });

  it("keeps current draft prompts, rejects discarded versions, and sorts by shot sequence", () => {
    const prompts = sortCurrentShotPrompts([
      asset("u10", "EP01-S01-U10-v01.md", "prompt.video"),
      asset("plan", "EP01-S01-plan.md", "plan.shot"),
      asset("u02", "EP01-S01-U02-v01.md", "prompt.video"),
      asset("u01", "EP01-S01-U01-v01.md", "prompt.video", "READY"),
      asset("u01b", "EP01-S01-U01B-v01.md", "prompt.video", "READY"),
      asset("u01a", "EP01-S01-U01A-v01.md", "prompt.video"),
      asset("transition", "EP01-T01-U01-v01.md", "prompt.video"),
      asset("old", "EP01-S01-U03-v01.md", "prompt.video", "SUPERSEDED"),
      asset("rejected", "EP01-S01-U04-v01.md", "prompt.video", "REJECTED_CONTINUITY"),
    ]);

    expect(prompts.map((item) => item.assetId)).toEqual(["u01", "u01a", "u01b", "u02", "u10", "transition"]);
    expect(prompts.find((item) => item.assetId === "u02")?.status).toBe("DRAFT");
  });

  it("separates only prompts into text and only keyframes plus props into images", () => {
    const keyframe = asset("keyframe", "KF-EP01-S01-ENTRY-v01.png", "image.derived", "DRAFT", "image");
    const prop = asset("prop", "PROP-PARKING-CARD-v01.png", "image.prop", "ACCEPTED", "image");
    const groups = collectSceneDedicatedAssets({
      relatedFiles: [
        asset("u02", "EP01-S01-U02-v01.md", "prompt.video"),
        asset("u01", "EP01-S01-U01-v01.md", "prompt.video", "READY"),
        asset("plan", "EP01-S01-plan.md", "plan.shot"),
      ],
      assets: [keyframe, asset("video", "EP01-S01-U01.mp4", "video.shot", "DRAFT", "video")],
      derivedAssets: [keyframe],
      props: [{ id: "PROP-PARKING-CARD", status: "READY", assets: [prop], asset: prop }],
    });

    expect(groups.textAssets.map((item) => item.assetId)).toEqual(["u01", "u02"]);
    expect(groups.textLabels).toEqual({ u01: "片段 U01", u02: "片段 U02" });
    expect(groups.imageAssets.map((item) => item.assetId)).toEqual(["keyframe", "prop"]);
  });

  it("extracts version tags, camera view badges, and unit codes for readable cards", () => {
    expect(assetVersionTag("SCENE-QIUSHI-STUDIO-OBLIQUE45-v04.png")).toBe("v04");
    expect(sceneViewBadge("SCENE-QIUSHI-STUDIO-OBLIQUE45-v04.png")).toBe("斜向 45°");
    expect(sceneViewBadge("SCENE-QIUSHI-STUDIO-REVERSE-v04.png")).toBe("反向视角");
    expect(sceneViewBadge("SCENE-QIUSHI-STUDIO-NIGHT-WORK-v02.png")).toBe("夜班氛围");
    const sceneAsset = asset("s1", "SCENE-QIUSHI-STUDIO-FRONT-v04.png", "image.scene", "ACCEPTED", "image");
    expect(readableAssetTitle(sceneAsset, "秋实工作室 · 场景图片")).toBe("秋实工作室 · 正面主视角");
    expect(shotUnitCode(asset("u5", "EP52-S01-U05-VIDEO-SHOT-PROMPT-v04.md", "prompt.video"))).toBe("U05");
  });
});
