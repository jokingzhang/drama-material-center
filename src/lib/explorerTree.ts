import { naturalProductionCompare } from "./production";
import type { MaterialAsset, MaterialDirectory } from "../types";

export interface ExplorerNode {
  id: string;
  type: "directory" | "file";
  path: string;
  name: string;
  parentPath: string;
  depth: number;
  children: ExplorerNode[];
  asset?: MaterialAsset;
}

const ROOT_DIRECTORY_ORDER = new Map([
  ["剧情", 0],
  ["图片", 1],
  ["视频", 2],
  ["音频", 3],
]);

function compareDirectoryNames(left: MaterialDirectory, right: MaterialDirectory) {
  if (!left.parentPath && !right.parentPath) {
    const leftOrder = ROOT_DIRECTORY_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = ROOT_DIRECTORY_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  }
  return naturalProductionCompare(left.name, right.name);
}

function compareNodes(left: ExplorerNode, right: ExplorerNode) {
  if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
  if (left.type === "directory" && right.type === "directory") return compareDirectoryNames(left, right);
  return naturalProductionCompare(left.name, right.name);
}

export function assetDirectoryPath(asset: Pick<MaterialAsset, "path">) {
  const separator = asset.path.lastIndexOf("/");
  return separator < 0 ? "" : asset.path.slice(0, separator);
}

export function assetsAtDirectory(assets: MaterialAsset[], directoryPath: string) {
  return assets.filter((asset) => assetDirectoryPath(asset) === directoryPath);
}

export function assetsWithinDirectory(assets: MaterialAsset[], directoryPath: string) {
  return assets.filter((asset) => !directoryPath || asset.path.startsWith(`${directoryPath}/`));
}

export function directoriesAtDirectory(directories: MaterialDirectory[], directoryPath: string) {
  return directories
    .filter((directory) => directory.parentPath === directoryPath)
    .sort(compareDirectoryNames);
}

export function buildExplorerTree(
  directories: MaterialDirectory[],
  assets: MaterialAsset[],
): ExplorerNode[] {
  const nodesByPath = new Map<string, ExplorerNode>();

  for (const directory of directories) {
    nodesByPath.set(directory.path, {
      id: `directory:${directory.path}`,
      type: "directory",
      path: directory.path,
      name: directory.name,
      parentPath: directory.parentPath,
      depth: directory.path.split("/").filter(Boolean).length - 1,
      children: [],
    });
  }

  const roots: ExplorerNode[] = [];
  for (const directory of directories) {
    const node = nodesByPath.get(directory.path);
    if (!node) continue;
    const parent = nodesByPath.get(directory.parentPath);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  for (const asset of assets) {
    const parentPath = assetDirectoryPath(asset);
    const node: ExplorerNode = {
      id: `file:${asset.id}`,
      type: "file",
      path: asset.path,
      name: asset.name,
      parentPath,
      depth: parentPath ? parentPath.split("/").length : 0,
      children: [],
      asset,
    };
    const parent = nodesByPath.get(parentPath);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  function sortChildren(nodes: ExplorerNode[]) {
    nodes.sort(compareNodes);
    for (const node of nodes) sortChildren(node.children);
  }
  sortChildren(roots);
  return roots;
}

export function flattenVisibleExplorerNodes(
  nodes: ExplorerNode[],
  expandedPaths: ReadonlySet<string>,
): ExplorerNode[] {
  const visible: ExplorerNode[] = [];
  function visit(items: ExplorerNode[]) {
    for (const node of items) {
      visible.push(node);
      if (node.type === "directory" && expandedPaths.has(node.path)) visit(node.children);
    }
  }
  visit(nodes);
  return visible;
}

export function directoryAncestors(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

const LEGACY_LIBRARY_PARAMS = ["mode", "episode", "stage"] as const;

export function normalizeLegacyLibrarySearch(current: URLSearchParams) {
  const search = new URLSearchParams(current);
  let changed = false;
  for (const key of LEGACY_LIBRARY_PARAMS) {
    if (!search.has(key)) continue;
    search.delete(key);
    changed = true;
  }
  if (search.get("scope") === "episode") {
    search.delete("scope");
    changed = true;
  }
  return { changed, search };
}

export function normalizeLegacyLibraryLocation(current: URLSearchParams, assets: MaterialAsset[]) {
  const normalized = normalizeLegacyLibrarySearch(current);
  if (!normalized.changed) return { ...normalized, directoryPath: undefined as string | undefined };
  const fileId = normalized.search.get("file");
  const selectedAsset = fileId ? assets.find((asset) => asset.id === fileId) : undefined;
  if (fileId && !selectedAsset) normalized.search.delete("file");
  return {
    ...normalized,
    directoryPath: selectedAsset ? assetDirectoryPath(selectedAsset) : "",
  };
}
