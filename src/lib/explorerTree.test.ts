import { describe, expect, it } from "vitest";
import type { MaterialAsset, MaterialDirectory } from "../types";
import {
  assetsAtDirectory,
  assetsWithinDirectory,
  buildExplorerTree,
  directoriesAtDirectory,
  flattenVisibleExplorerNodes,
  normalizeLegacyLibraryLocation,
  normalizeLegacyLibrarySearch,
} from "./explorerTree";

const directories: MaterialDirectory[] = [
  { path: "图片", name: "图片", parentPath: "" },
  { path: "图片/人物", name: "人物", parentPath: "图片" },
];

function asset(path: string, kind: MaterialAsset["kind"]): MaterialAsset {
  const name = path.split("/").at(-1) ?? path;
  return {
    id: path,
    path,
    name,
    folder: path.split("/").slice(0, -1).join(" / "),
    kind,
    size: 1,
    updatedAt: "2026-08-28T00:00:00.000Z",
    mimeType: kind === "image" ? "image/png" : "text/markdown",
    url: `/fixture/${encodeURIComponent(path)}`,
  };
}

describe("buildExplorerTree", () => {
  it("places directories before files while preserving the real hierarchy", () => {
    const tree = buildExplorerTree(directories, [
      asset("README.md", "story"),
      asset("图片/人物/女主.png", "image"),
      asset("图片/说明.md", "story"),
    ]);

    expect(tree.map((node) => [node.type, node.path])).toEqual([
      ["directory", "图片"],
      ["file", "README.md"],
    ]);
    expect(tree[0]?.children.map((node) => [node.type, node.path])).toEqual([
      ["directory", "图片/人物"],
      ["file", "图片/说明.md"],
    ]);
    expect(tree[0]?.children[0]?.children[0]?.path).toBe("图片/人物/女主.png");
  });

  it("does not flatten children of collapsed folders", () => {
    const tree = buildExplorerTree(directories, [asset("图片/人物/女主.png", "image")]);
    expect(flattenVisibleExplorerNodes(tree, new Set()).map((node) => node.path)).toEqual(["图片"]);
    expect(flattenVisibleExplorerNodes(tree, new Set(["图片"])).map((node) => node.path)).toEqual([
      "图片",
      "图片/人物",
    ]);
  });

  it("keeps the production root order stable", () => {
    const tree = buildExplorerTree([
      { path: "音频", name: "音频", parentPath: "" },
      { path: "视频", name: "视频", parentPath: "" },
      { path: "图片", name: "图片", parentPath: "" },
      { path: "剧情", name: "剧情", parentPath: "" },
    ], []);

    expect(tree.map((node) => node.path)).toEqual(["剧情", "图片", "视频", "音频"]);
  });
});

describe("directory browsing", () => {
  it("returns only immediate files and folders for the current level", () => {
    const nestedDirectories: MaterialDirectory[] = [
      ...directories,
      { path: "图片/场景", name: "场景", parentPath: "图片" },
    ];
    const assets = [
      asset("图片/说明.md", "story"),
      asset("图片/人物/女主.png", "image"),
    ];

    expect(directoriesAtDirectory(nestedDirectories, "图片").map((directory) => directory.path)).toEqual([
      "图片/场景",
      "图片/人物",
    ]);
    expect(assetsAtDirectory(assets, "图片").map((item) => item.path)).toEqual(["图片/说明.md"]);
  });

  it("returns every file below the current directory for the material overview", () => {
    const assets = [
      asset("图片/说明.md", "story"),
      asset("图片/人物/女主.png", "image"),
      asset("视频/预告.mp4", "video"),
    ];

    expect(assetsWithinDirectory(assets, "图片").map((item) => item.path)).toEqual([
      "图片/说明.md",
      "图片/人物/女主.png",
    ]);
    expect(assetsWithinDirectory(assets, "")).toEqual(assets);
  });
});

describe("normalizeLegacyLibrarySearch", () => {
  it("removes episode-workbench parameters but preserves explorer state", () => {
    const result = normalizeLegacyLibrarySearch(new URLSearchParams(
      "mode=episode&episode=7&scope=episode&stage=prompt&search=霍总&content=1&sort=name&display=list&file=a",
    ));

    expect(result.changed).toBe(true);
    expect(result.search.toString()).toBe("search=%E9%9C%8D%E6%80%BB&content=1&sort=name&display=list&file=a");
  });

  it("leaves current explorer URLs untouched", () => {
    const result = normalizeLegacyLibrarySearch(new URLSearchParams("scope=project&display=grid"));
    expect(result.changed).toBe(false);
    expect(result.search.toString()).toBe("scope=project&display=grid");
  });

  it("moves a legacy file link to its real parent directory", () => {
    const selected = asset("图片/人物/女主.png", "image");
    const result = normalizeLegacyLibraryLocation(new URLSearchParams(`mode=episode&episode=7&file=${encodeURIComponent(selected.id)}`), [selected]);
    expect(result.directoryPath).toBe("图片/人物");
    expect(result.search.get("file")).toBe(selected.id);
  });

  it("moves a legacy link without a valid file back to the project root", () => {
    const result = normalizeLegacyLibraryLocation(new URLSearchParams("mode=episode&episode=7&file=missing"), []);
    expect(result.directoryPath).toBe("");
    expect(result.search.has("file")).toBe(false);
  });
});
