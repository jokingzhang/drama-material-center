import {
  ArrowRight,
  BookOpenText,
  Clapperboard,
  FolderOpen,
  MapPin,
  Moon,
  Search,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  projectCharacterPath,
  projectEpisodePath,
  projectLibraryPath,
  projectLocationPath,
  projectStorySectionPath,
} from "../lib/routes";
import { applyTheme, currentTheme, nextTheme } from "../lib/theme";
import type { EpisodeProductionStage, ProjectStoryReadModel } from "../types/story";

interface PaletteItem {
  id: string;
  group: "分集" | "人物" | "场景" | "视图与操作";
  title: string;
  subtitle?: string;
  badge?: string;
  stage?: EpisodeProductionStage;
  keywords: string;
  onSelect: () => void;
}

const stageShortCopy: Record<EpisodeProductionStage, string> = {
  NOT_STARTED: "未开始",
  SCRIPT_READY: "剧本就绪",
  STORYBOARD_DRAFT: "分镜草稿",
  AWAITING_PRODUCTION: "待生产",
  PREPRODUCTION: "前期制作",
  SHOT_PRODUCTION: "正式镜头",
  FINAL_REVIEW: "成片待验收",
  COMPLETED: "已完成",
};

interface StoryCommandPaletteProps {
  open: boolean;
  story?: ProjectStoryReadModel;
  projectId: string;
  onClose: () => void;
}

export function StoryCommandPalette({ open, story, projectId, onClose }: StoryCommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const stageByEpisodeId = useMemo(() => {
    const map = new Map<string, EpisodeProductionStage>();
    for (const item of story?.production.episodes ?? []) map.set(item.id, item.stage);
    return map;
  }, [story]);

  const allItems = useMemo<PaletteItem[]>(() => {
    if (!projectId) return [];
    const items: PaletteItem[] = [];

    for (const episode of story?.episodes ?? []) {
      const stage = stageByEpisodeId.get(episode.id);
      items.push({
        id: `ep:${episode.id}`,
        group: "分集",
        title: `${episode.id} · ${episode.title}`,
        subtitle: episode.summary,
        badge: stage ? stageShortCopy[stage] : undefined,
        stage,
        keywords: `${episode.id} ${episode.id.replace(/^EP0*/i, "")} ${episode.title} ${episode.summary ?? ""}`.toLocaleLowerCase("zh-CN"),
        onSelect: () => navigate(projectEpisodePath(projectId, episode.id)),
      });
    }

    for (const character of story?.characters ?? []) {
      items.push({
        id: `char:${character.id}`,
        group: "人物",
        title: character.name,
        subtitle: character.oneLineSetting,
        badge: character.storyRole,
        keywords: `${character.name} ${character.id} ${character.storyRole} ${character.oneLineSetting}`.toLocaleLowerCase("zh-CN"),
        onSelect: () => navigate(projectCharacterPath(projectId, character.id)),
      });
    }

    for (const loc of story?.locations ?? []) {
      items.push({
        id: `loc:${loc.id}`,
        group: "场景",
        title: loc.name,
        subtitle: loc.oneLineSetting,
        badge: loc.id,
        keywords: `${loc.name} ${loc.id} ${loc.oneLineSetting ?? ""}`.toLocaleLowerCase("zh-CN"),
        onSelect: () => navigate(projectLocationPath(projectId, loc.id)),
      });
    }

    const dark = currentTheme() === "dark";
    items.push(
      {
        id: "nav:overview",
        group: "视图与操作",
        title: "全剧制作总览 · 故事大概",
        subtitle: "查看进度总览与全剧设定",
        keywords: "总览 故事大概 overview dashboard",
        onSelect: () => navigate(projectStorySectionPath(projectId, "overview")),
      },
      {
        id: "nav:characters",
        group: "视图与操作",
        title: "人物设定",
        subtitle: `${story?.characters.length ?? 0} 位人物`,
        keywords: "人物 角色 设定 characters",
        onSelect: () => navigate(projectStorySectionPath(projectId, "characters")),
      },
      {
        id: "nav:locations",
        group: "视图与操作",
        title: "场景设定",
        subtitle: `${story?.locations.length ?? 0} 个场景`,
        keywords: "场景 地点 设定 locations",
        onSelect: () => navigate(projectStorySectionPath(projectId, "locations")),
      },
      {
        id: "nav:episodes",
        group: "视图与操作",
        title: "分集视角",
        subtitle: `${story?.episodes.length ?? 0} 集已索引`,
        keywords: "分集 列表 episodes",
        onSelect: () => navigate(projectStorySectionPath(projectId, "episodes")),
      },
      {
        id: "nav:library",
        group: "视图与操作",
        title: "切换到素材文件浏览器",
        subtitle: "查看项目目录与原始文件",
        keywords: "素材 文件 library files",
        onSelect: () => navigate(projectLibraryPath(projectId)),
      },
      {
        id: "action:theme",
        group: "视图与操作",
        title: dark ? "切换到浅色工作台" : "切换到暗色影棚模式",
        subtitle: "立即切换明暗外观",
        keywords: "主题 暗色 亮色 theme dark light",
        onSelect: () => applyTheme(nextTheme(currentTheme())),
      },
      {
        id: "nav:projects",
        group: "视图与操作",
        title: "返回所有短剧项目",
        subtitle: "切换或新建项目",
        keywords: "所有项目 首页 projects home",
        onSelect: () => navigate("/"),
      },
    );

    return items;
  }, [navigate, projectId, stageByEpisodeId, story]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) {
      const currentEpisodes = allItems.filter((item) => item.group === "分集").slice(-8).reverse();
      const views = allItems.filter((item) => item.group === "视图与操作");
      const characters = allItems.filter((item) => item.group === "人物").slice(0, 4);
      return [...currentEpisodes, ...characters, ...views];
    }
    return allItems.filter((item) => item.keywords.includes(normalized)).slice(0, 24);
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-palette-index="${selectedIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  function runItem(item: PaletteItem | undefined) {
    if (!item) return;
    onClose();
    item.onSelect();
  }

  function groupIcon(item: PaletteItem) {
    if (item.group === "分集") return <Clapperboard size={15} />;
    if (item.group === "人物") return <Users size={15} />;
    if (item.group === "场景") return <MapPin size={15} />;
    if (item.id === "nav:library") return <FolderOpen size={15} />;
    if (item.id === "action:theme") return currentTheme() === "dark" ? <Sun size={15} /> : <Moon size={15} />;
    return <BookOpenText size={15} />;
  }

  return (
    <div className="studio-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="studio-palette"
        role="dialog"
        aria-modal="true"
        aria-label="快速跳转"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) => (filtered.length ? (current + 1) % filtered.length : 0));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((current) => (filtered.length ? (current - 1 + filtered.length) % filtered.length : 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            runItem(filtered[selectedIndex]);
          }
        }}
      >
        <div className="studio-palette-input-row">
          <Search size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索集数（如 52）、人物、场景或视图…"
            aria-label="快速搜索分集、人物、场景或操作"
          />
          {query && (
            <button type="button" className="studio-palette-clear" onClick={() => setQuery("")} aria-label="清空">
              <X size={15} />
            </button>
          )}
          <kbd className="studio-kbd">ESC</kbd>
        </div>

        <div className="studio-palette-list" ref={listRef} role="listbox">
          {filtered.length === 0 ? (
            <p className="studio-palette-empty">未找到与“{query}”匹配的分集、人物或场景</p>
          ) : (
            filtered.map((item, index) => {
              const showGroup = index === 0 || filtered[index - 1]?.group !== item.group;
              return (
                <div key={item.id}>
                  {showGroup && <div className="studio-palette-group">{item.group}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    data-palette-index={index}
                    className={`studio-palette-item${index === selectedIndex ? " is-active" : ""}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => runItem(item)}
                  >
                    <span className="studio-palette-icon" aria-hidden="true">{groupIcon(item)}</span>
                    <span className="studio-palette-copy">
                      <strong>{item.title}</strong>
                      {item.subtitle && <small>{item.subtitle}</small>}
                    </span>
                    {item.badge && (
                      <span className={`studio-palette-badge${item.stage ? ` stage-${item.stage.toLowerCase().replaceAll("_", "-")}` : ""}`}>
                        {item.stage && <i className="stage-dot" />}
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight size={14} className="studio-palette-arrow" aria-hidden="true" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <footer className="studio-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>↵</kbd> 打开</span>
          <span><kbd>⌘K</kbd> 随时唤起</span>
        </footer>
      </section>
    </div>
  );
}
