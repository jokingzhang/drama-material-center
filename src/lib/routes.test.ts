import { describe, expect, it } from "vitest";
import {
  knowledgeAreaPath,
  knowledgeEntryPath,
  knowledgeSourcePath,
  knowledgeUsagePath,
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
  it("uses stable IDs and encodes source and analysis identifiers", () => {
    expect(knowledgeAreaPath("image-asset")).toBe("/knowledge/areas/image-asset");
    expect(knowledgeEntryPath("DRAMA-STD-ASSET-001")).toBe("/knowledge/items/DRAMA-STD-ASSET-001");
    expect(knowledgeSourcePath("scripts", "SCRIPT-短剧库-001")).toBe(
      "/knowledge/sources/scripts/SCRIPT-%E7%9F%AD%E5%89%A7%E5%BA%93-001",
    );
    expect(knowledgeUsagePath("limited-marriage-rivals", "analysis 01")).toBe(
      "/knowledge/usage/limited-marriage-rivals/analysis%2001",
    );
  });
});
