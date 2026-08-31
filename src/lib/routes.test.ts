import { describe, expect, it } from "vitest";
import {
  knowledgeAreaPath,
  knowledgeCasePath,
  projectCharacterPath,
  projectEpisodePath,
  projectLibraryPath,
  projectScenePath,
  projectStoryPath,
} from "./routes";

describe("project library routes", () => {
  it("encodes every directory segment into a refresh-safe project URL", () => {
    expect(projectLibraryPath("zero-boundary", "剧情/第一集")).toBe(
      "/projects/zero-boundary/library/%E5%89%A7%E6%83%85/%E7%AC%AC%E4%B8%80%E9%9B%86",
    );
  });
});

describe("project story routes", () => {
  it("builds stable story, character, episode and scene deep links", () => {
    expect(projectStoryPath("story-demo")).toBe("/projects/story-demo/story");
    expect(projectCharacterPath("story-demo", "CHAR 江")).toBe("/projects/story-demo/story/characters/CHAR%20%E6%B1%9F");
    expect(projectEpisodePath("story-demo", "EP01")).toBe("/projects/story-demo/story/episodes/EP01");
    expect(projectScenePath("story-demo", "EP01", "EP01-S 01")).toBe("/projects/story-demo/story/episodes/EP01/scenes/EP01-S%2001");
  });
});

describe("director knowledge routes", () => {
  it("encodes the area and every Markdown path segment", () => {
    expect(knowledgeAreaPath("image-asset")).toBe("/knowledge/areas/image-asset");
    expect(knowledgeAreaPath("image-asset", "人物/角色 标准图.md")).toBe(
      "/knowledge/areas/image-asset/%E4%BA%BA%E7%89%A9/%E8%A7%92%E8%89%B2%20%E6%A0%87%E5%87%86%E5%9B%BE.md",
    );
  });

  it("keeps one case route while preserving the entry-point focus", () => {
    expect(knowledgeCasePath("猫爪挡脸接触喜剧", "image-asset")).toBe(
      "/knowledge/cases/%E7%8C%AB%E7%88%AA%E6%8C%A1%E8%84%B8%E6%8E%A5%E8%A7%A6%E5%96%9C%E5%89%A7?from=image-asset",
    );
    expect(knowledgeCasePath("灵能引擎启动", "shot-prompt")).toBe(
      "/knowledge/cases/%E7%81%B5%E8%83%BD%E5%BC%95%E6%93%8E%E5%90%AF%E5%8A%A8?from=shot-prompt",
    );
  });
});
