import { ChevronRight, FileText, Folder, FolderOpen, Image, Library, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { MaterialAsset, MaterialDirectory } from "../types";

interface SidebarProps {
  assets: MaterialAsset[];
  directories: MaterialDirectory[];
  selectedPath: string;
  onSelectPath: (path: string) => void;
}

function includesPath(filePath: string, directoryPath: string) {
  return !directoryPath || filePath.startsWith(`${directoryPath}/`);
}

function iconFor(directory: MaterialDirectory): LucideIcon {
  if (directory.parentPath) return Folder;
  if (directory.name === "剧情") return FileText;
  if (directory.name === "图片") return Image;
  if (directory.name === "视频") return Video;
  return Folder;
}

export function Sidebar({ assets, directories, selectedPath, onSelectPath }: SidebarProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(["剧情", "图片", "视频"]));
  const collator = useMemo(() => new Intl.Collator("zh-CN", { numeric: true }), []);

  const childrenByParent = useMemo(() => {
    const result = new Map<string, MaterialDirectory[]>();
    directories.forEach((directory) => {
      const children = result.get(directory.parentPath) ?? [];
      children.push(directory);
      result.set(directory.parentPath, children);
    });
    const rootOrder = new Map([["剧情", 0], ["图片", 1], ["视频", 2]]);
    result.forEach((children, parentPath) => children.sort((left, right) => {
      if (!parentPath) {
        const leftOrder = rootOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = rootOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      }
      return collator.compare(left.name, right.name);
    }));
    return result;
  }, [collator, directories]);

  useEffect(() => {
    if (!selectedPath) return;
    const parts = selectedPath.split("/");
    setExpandedPaths((current) => {
      const next = new Set(current);
      parts.slice(0, -1).forEach((_, index) => next.add(parts.slice(0, index + 1).join("/")));
      return next;
    });
  }, [selectedPath]);

  function toggle(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderDirectories(parentPath = "", depth = 0): React.ReactNode {
    return childrenByParent.get(parentPath)?.map((directory) => {
      const children = childrenByParent.get(directory.path) ?? [];
      const expanded = expandedPaths.has(directory.path);
      const active = selectedPath === directory.path;
      const Icon = iconFor(directory);
      const fileCount = assets.filter((asset) => includesPath(asset.path, directory.path)).length;

      return (
        <div className="directory-branch" key={directory.path}>
          <div className={`directory-row${active ? " active" : ""}`} style={{ "--tree-depth": depth } as React.CSSProperties}>
            {children.length ? (
              <button
                className="directory-toggle"
                type="button"
                aria-label={`${expanded ? "收起" : "展开"}${directory.name}`}
                aria-expanded={expanded}
                onClick={() => toggle(directory.path)}
              >
                <ChevronRight size={15} className={expanded ? "expanded" : ""} />
              </button>
            ) : <span className="directory-toggle-spacer" />}
            <button className="directory-select" type="button" onClick={() => onSelectPath(directory.path)}>
              {expanded && children.length ? <FolderOpen size={18} /> : <Icon size={18} />}
              <span>{directory.name}</span>
              <small>{fileCount}</small>
            </button>
          </div>
          {expanded && children.length > 0 && <div>{renderDirectories(directory.path, depth + 1)}</div>}
        </div>
      );
    });
  }

  return (
    <aside className="library-sidebar" aria-label="素材目录">
      <nav className="directory-tree" aria-label="素材文件夹">
        <div className={`directory-row root-row${selectedPath ? "" : " active"}`}>
          <span className="directory-toggle-spacer" />
          <button className="directory-select" type="button" onClick={() => onSelectPath("")}>
            <Library size={18} /><span>全部素材</span><small>{assets.length}</small>
          </button>
        </div>
        {renderDirectories()}
      </nav>
      <p className="directory-hint">新增文件夹后点击刷新，目录会自动出现。</p>
    </aside>
  );
}
