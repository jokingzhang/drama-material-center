import { describe, expect, it } from "vitest";
import {
  knowledgeAreaPath,
  projectLibraryPath,
} from "./routes";

describe("project library routes", () => {
  it("encodes every directory segment into a refresh-safe project URL", () => {
    expect(projectLibraryPath("zero-boundary", "剧情/第一集")).toBe(
      "/projects/zero-boundary/library/%E5%89%A7%E6%83%85/%E7%AC%AC%E4%B8%80%E9%9B%86",
    );
  });
});

describe("director knowledge routes", () => {
  it("encodes the area and every Markdown path segment", () => {
    expect(knowledgeAreaPath("image-asset")).toBe("/knowledge/areas/image-asset");
    expect(knowledgeAreaPath("image-asset", "人物/角色 标准图.md")).toBe(
      "/knowledge/areas/image-asset/%E4%BA%BA%E7%89%A9/%E8%A7%92%E8%89%B2%20%E6%A0%87%E5%87%86%E5%9B%BE.md",
    );
  });
});
