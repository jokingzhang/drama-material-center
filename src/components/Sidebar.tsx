import {
  ChevronRight,
  File,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Library,
  Music2,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  assetDirectoryPath,
  buildExplorerTree,
  directoryAncestors,
  flattenVisibleExplorerNodes,
  type ExplorerNode,
} from "../lib/explorerTree";
import type { MaterialAsset, MaterialDirectory } from "../types";

interface SidebarProps {
  projectId: string;
  assets: MaterialAsset[];
  directories: MaterialDirectory[];
  selectedPath: string;
  selectedFileId?: string;
  onSelectPath: (path: string) => void;
  onSelectAsset: (asset: MaterialAsset) => void;
}

const DEFAULT_EXPANDED = ["剧情", "图片", "视频", "音频"];
const ROOT_ID = "directory:";

function storageKey(projectId: string) {
  return `material-center:explorer-expanded:${projectId}`;
}

function initialExpanded(projectId: string) {
  try {
    const stored = window.localStorage.getItem(storageKey(projectId));
    if (stored) {
      const values: unknown = JSON.parse(stored);
      if (Array.isArray(values) && values.every((value) => typeof value === "string")) return new Set(values);
    }
  } catch {
    // A malformed preference must not block the local library.
  }
  return new Set(DEFAULT_EXPANDED);
}

function includesPath(filePath: string, directoryPath: string) {
  return !directoryPath || filePath.startsWith(`${directoryPath}/`);
}

function NodeIcon({ node, expanded }: { node: ExplorerNode; expanded: boolean }) {
  if (node.type === "directory") return expanded ? <FolderOpen size={17} /> : <Folder size={17} />;
  const asset = node.asset;
  if (asset?.kind === "image") return <Image size={16} />;
  if (asset?.kind === "video") return <Video size={16} />;
  if (asset?.kind === "audio") return <Music2 size={16} />;
  if (asset?.mimeType.includes("markdown") || asset?.mimeType.startsWith("text/")) return <FileText size={16} />;
  return <File size={16} />;
}

export function Sidebar({ projectId, assets, directories, selectedPath, selectedFileId, onSelectPath, onSelectAsset }: SidebarProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => initialExpanded(projectId));
  const [focusId, setFocusId] = useState(ROOT_ID);
  const treeRef = useRef<HTMLElement>(null);
  const tree = useMemo(() => buildExplorerTree(directories, assets), [assets, directories]);
  const visibleNodes = useMemo(() => flattenVisibleExplorerNodes(tree, expandedPaths), [expandedPaths, tree]);
  const navigableIds = useMemo(() => [ROOT_ID, ...visibleNodes.map((node) => node.id)], [visibleNodes]);

  const fileCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const directory of directories) {
      counts.set(directory.path, assets.filter((asset) => includesPath(asset.path, directory.path)).length);
    }
    return counts;
  }, [assets, directories]);

  useEffect(() => {
    setExpandedPaths(initialExpanded(projectId));
  }, [projectId]);

  useEffect(() => {
    const targetPath = selectedFileId
      ? (() => {
          const asset = assets.find((candidate) => candidate.id === selectedFileId);
          return asset ? assetDirectoryPath(asset) : selectedPath;
        })()
      : selectedPath;
    if (targetPath) {
      setExpandedPaths((current) => {
        const next = new Set(current);
        for (const ancestor of directoryAncestors(targetPath)) next.add(ancestor);
        return next;
      });
    }
    setFocusId(selectedFileId ? `file:${selectedFileId}` : selectedPath ? `directory:${selectedPath}` : ROOT_ID);
  }, [assets, selectedFileId, selectedPath]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify([...expandedPaths]));
  }, [expandedPaths, projectId]);

  function focusNode(id: string) {
    setFocusId(id);
    window.requestAnimationFrame(() => {
      const controls = treeRef.current?.querySelectorAll<HTMLButtonElement>(".explorer-tree-item");
      [...(controls ?? [])].find((control) => control.dataset.nodeId === id)?.focus();
    });
  }

  function toggle(path: string, force?: boolean) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      const shouldExpand = force ?? !next.has(path);
      if (shouldExpand) next.add(path);
      else next.delete(path);
      return next;
    });
  }

  function selectNode(node?: ExplorerNode) {
    if (!node) onSelectPath("");
    else if (node.type === "directory") onSelectPath(node.path);
    else if (node.asset) onSelectAsset(node.asset);
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, node?: ExplorerNode) {
    const id = node?.id ?? ROOT_ID;
    const currentIndex = navigableIds.indexOf(id);
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? navigableIds.length - 1
          : Math.max(0, Math.min(navigableIds.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
      focusNode(navigableIds[nextIndex] ?? ROOT_ID);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!node) focusNode(visibleNodes[0]?.id ?? ROOT_ID);
      else if (node.type === "directory" && node.children.length > 0) {
        if (!expandedPaths.has(node.path)) toggle(node.path, true);
        else focusNode(node.children[0]?.id ?? node.id);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (node?.type === "directory" && expandedPaths.has(node.path)) toggle(node.path, false);
      else if (node?.parentPath) focusNode(`directory:${node.parentPath}`);
      else if (node) focusNode(ROOT_ID);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectNode(node);
    }
  }

  return (
    <aside className="library-sidebar" aria-label="项目文件树">
      <div className="explorer-heading"><strong>资源管理器</strong><span>{assets.length} 个文件</span></div>
      <nav className="explorer-tree" aria-label="素材文件与文件夹" role="tree" ref={treeRef}>
        <div className={`explorer-tree-row root-row${!selectedPath && !selectedFileId ? " active" : ""}`}>
          <span className="explorer-toggle-spacer" />
          <button
            className="explorer-tree-item"
            type="button"
            role="treeitem"
            aria-level={1}
            aria-expanded="true"
            aria-selected={!selectedPath && !selectedFileId}
            data-node-id={ROOT_ID}
            tabIndex={focusId === ROOT_ID ? 0 : -1}
            onFocus={() => setFocusId(ROOT_ID)}
            onClick={() => selectNode()}
            onKeyDown={(event) => handleKey(event)}
          >
            <Library size={17} /><span className="explorer-node-name">全部素材</span><small>{assets.length}</small>
          </button>
        </div>

        {visibleNodes.map((node) => {
          const expandable = node.type === "directory" && node.children.length > 0;
          const expanded = node.type === "directory" && expandedPaths.has(node.path);
          const active = node.type === "file" ? selectedFileId === node.asset?.id : !selectedFileId && selectedPath === node.path;
          return (
            <div
              className={`explorer-tree-row${active ? " active" : ""}${node.type === "file" ? " file-node" : ""}`}
              style={{ "--tree-depth": node.depth + 1 } as React.CSSProperties}
              key={node.id}
            >
              {expandable ? (
                <button className="explorer-toggle" type="button" tabIndex={-1} aria-label={`${expanded ? "收起" : "展开"}${node.name}`} onClick={() => toggle(node.path)}>
                  <ChevronRight size={15} className={expanded ? "expanded" : ""} />
                </button>
              ) : <span className="explorer-toggle-spacer" />}
              <button
                className="explorer-tree-item"
                type="button"
                role="treeitem"
                aria-level={node.depth + 2}
                aria-expanded={expandable ? expanded : undefined}
                aria-selected={active}
                data-node-id={node.id}
                tabIndex={focusId === node.id ? 0 : -1}
                title={node.path.replaceAll("/", " / ")}
                onFocus={() => setFocusId(node.id)}
                onClick={() => selectNode(node)}
                onDoubleClick={() => { if (node.type === "directory" && expandable) toggle(node.path); }}
                onKeyDown={(event) => handleKey(event, node)}
              >
                <NodeIcon node={node} expanded={expanded} />
                <span className="explorer-node-name">{node.name}</span>
                {node.type === "directory" && <small aria-label={`${fileCounts.get(node.path) ?? 0} 个文件`}>{fileCounts.get(node.path) ?? 0}</small>}
              </button>
            </div>
          );
        })}
      </nav>
      <p className="directory-hint">文件树保持本地真实层级。方向键移动，左右键展开或返回，回车打开。</p>
    </aside>
  );
}
