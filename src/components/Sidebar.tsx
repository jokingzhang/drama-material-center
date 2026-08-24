import { ChevronRight, Clapperboard, FileText, Folder, FolderOpen, Image, Library, ListTree, Music2, Video } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { episodeLabel, naturalProductionCompare, productionMetaFor } from "../lib/production";
import type { MaterialAsset, MaterialDirectory } from "../types";

export type WorkspaceMode = "directory" | "episode";

interface SidebarProps {
  assets: MaterialAsset[];
  directories: MaterialDirectory[];
  selectedPath: string;
  mode: WorkspaceMode;
  selectedEpisode?: number;
  onSelectPath: (path: string) => void;
  onModeChange: (mode: WorkspaceMode) => void;
  onSelectEpisode: (episode: number) => void;
}

function includesPath(filePath: string, directoryPath: string) {
  return !directoryPath || filePath.startsWith(`${directoryPath}/`);
}

function iconFor(directory: MaterialDirectory): LucideIcon {
  if (directory.parentPath) return Folder;
  if (directory.name === "剧情") return FileText;
  if (directory.name === "图片") return Image;
  if (directory.name === "视频") return Video;
  if (directory.name === "音频") return Music2;
  return Folder;
}

function moveTreeFocus(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(".directory-select, .episode-select")];
  const current = controls.indexOf(document.activeElement as HTMLElement);
  if (current < 0 || !controls.length) return;
  event.preventDefault();
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? controls.length - 1
      : Math.max(0, Math.min(controls.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
  controls[nextIndex]?.focus();
}

export function Sidebar({
  assets,
  directories,
  selectedPath,
  mode,
  selectedEpisode,
  onSelectPath,
  onModeChange,
  onSelectEpisode,
}: SidebarProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(["剧情", "图片", "视频", "音频"]));

  const childrenByParent = useMemo(() => {
    const result = new Map<string, MaterialDirectory[]>();
    directories.forEach((directory) => {
      const children = result.get(directory.parentPath) ?? [];
      children.push(directory);
      result.set(directory.parentPath, children);
    });
    const rootOrder = new Map([["剧情", 0], ["图片", 1], ["视频", 2], ["音频", 3]]);
    result.forEach((children, parentPath) => children.sort((left, right) => {
      if (!parentPath) {
        const leftOrder = rootOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = rootOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      }
      return naturalProductionCompare(left.name, right.name);
    }));
    return result;
  }, [directories]);

  const fileCounts = useMemo(() => {
    const counts = new Map<string, number>();
    directories.forEach((directory) => counts.set(
      directory.path,
      assets.filter((asset) => includesPath(asset.path, directory.path)).length,
    ));
    return counts;
  }, [assets, directories]);

  const episodes = useMemo(() => {
    const counts = new Map<number, { total: number; image: number; video: number }>();
    assets.forEach((asset) => {
      const episode = productionMetaFor(asset).episode;
      if (episode === undefined) return;
      const current = counts.get(episode) ?? { total: 0, image: 0, video: 0 };
      current.total += 1;
      if (asset.kind === "image") current.image += 1;
      if (asset.kind === "video") current.video += 1;
      counts.set(episode, current);
    });
    return [...counts.entries()].sort(([left], [right]) => left - right);
  }, [assets]);

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

      return (
        <div className="directory-branch" role="none" key={directory.path}>
          <div
            className={`directory-row${active ? " active" : ""}`}
            role="treeitem"
            aria-expanded={children.length ? expanded : undefined}
            aria-selected={active}
            style={{ "--tree-depth": depth } as React.CSSProperties}
          >
            {children.length ? (
              <button
                className="directory-toggle"
                type="button"
                tabIndex={-1}
                aria-label={`${expanded ? "收起" : "展开"}${directory.name}`}
                onClick={() => toggle(directory.path)}
              >
                <ChevronRight size={15} className={expanded ? "expanded" : ""} />
              </button>
            ) : <span className="directory-toggle-spacer" />}
            <button
              className="directory-select"
              type="button"
              title={directory.path.replaceAll("/", " / ")}
              onClick={() => onSelectPath(directory.path)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" && children.length && !expanded) {
                  event.preventDefault();
                  toggle(directory.path);
                }
                if (event.key === "ArrowLeft" && children.length && expanded) {
                  event.preventDefault();
                  toggle(directory.path);
                }
              }}
            >
              {expanded && children.length ? <FolderOpen size={18} /> : <Icon size={18} />}
              <span className="directory-name">{directory.name}</span>
              <small aria-label={`${fileCounts.get(directory.path) ?? 0} 个文件`}>{fileCounts.get(directory.path) ?? 0}</small>
            </button>
          </div>
          {expanded && children.length > 0 && <div role="group">{renderDirectories(directory.path, depth + 1)}</div>}
        </div>
      );
    });
  }

  return (
    <aside className="library-sidebar" aria-label="素材导航" onKeyDown={moveTreeFocus}>
      <div className="sidebar-mode-switch" aria-label="素材浏览方式">
        <button type="button" aria-pressed={mode === "directory"} onClick={() => onModeChange("directory")}>
          <ListTree size={16} />目录
        </button>
        <button type="button" aria-pressed={mode === "episode"} onClick={() => onModeChange("episode")}>
          <Clapperboard size={16} />分集台
        </button>
      </div>

      {mode === "directory" ? (
        <nav className="directory-tree" aria-label="素材文件夹" role="tree">
          <div className={`directory-row root-row${selectedPath ? "" : " active"}`} role="treeitem" aria-selected={!selectedPath}>
            <span className="directory-toggle-spacer" />
            <button className="directory-select" type="button" onClick={() => onSelectPath("")}>
              <Library size={18} /><span className="directory-name">全部素材</span><small>{assets.length}</small>
            </button>
          </div>
          {renderDirectories()}
        </nav>
      ) : (
        <nav className="episode-tree" aria-label="分集工作台">
          <div className="episode-tree-heading">
            <strong>按集推进</strong>
            <span>{episodes.length} 集已识别</span>
          </div>
          {episodes.map(([episode, counts]) => (
            <button
              className={`episode-select${selectedEpisode === episode ? " active" : ""}`}
              type="button"
              aria-current={selectedEpisode === episode ? "page" : undefined}
              key={episode}
              onClick={() => onSelectEpisode(episode)}
            >
              <span className="episode-number">{episodeLabel(episode)}</span>
              <span className="episode-counts">
                <b>{counts.total}</b>
                <small><Image size={12} />{counts.image}</small>
                <small><Video size={12} />{counts.video}</small>
              </span>
            </button>
          ))}
        </nav>
      )}

      <p className="directory-hint">
        {mode === "directory"
          ? "目录保持本地真实结构；方向键可连续浏览。"
          : "分集台只做虚拟聚合，不移动或改名任何素材。"}
      </p>
    </aside>
  );
}
