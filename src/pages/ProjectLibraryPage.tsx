import {
  ArrowLeft,
  BookOpen,
  Columns3,
  FolderOpen,
  Grid2X2,
  List,
  PanelRightOpen,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { EpisodeSummary, type StageFilter } from "../components/EpisodeSummary";
import { FileList, type AssetDisplay } from "../components/FileList";
import { PreviewPane } from "../components/PreviewPane";
import { Sidebar, type WorkspaceMode } from "../components/Sidebar";
import { ThemeToggle } from "../components/ThemeToggle";
import { getMaterials, getProjects, revealMaterial, searchMaterialText } from "../lib/materials";
import { naturalProductionCompare, productionMetaFor, productionStageIndex } from "../lib/production";
import { projectLibraryPath } from "../lib/routes";
import type { MaterialAsset, MaterialDirectory, ProjectSummary } from "../types";

type SortMode = "updated" | "name" | "production";
type SearchScope = "current" | "episode" | "project";
type ResizeTarget = "sidebar" | "browser";

const DEFAULT_SIDEBAR_WIDTH = 284;
const DEFAULT_BROWSER_WIDTH = 470;
const MIN_SIDEBAR_WIDTH = 238;
const MAX_SIDEBAR_WIDTH = 410;
const MIN_BROWSER_WIDTH = 360;
const MIN_PREVIEW_WIDTH = 430;
const RESIZER_WIDTH = 10;
const RESIZE_STEP = 24;
const stageFilters = new Set<StageFilter>(["all", "story", "board", "character", "scene", "prop", "keyframe", "prompt", "take", "audio", "final", "other"]);

function belongsToDirectory(asset: MaterialAsset, directoryPath: string) {
  return !directoryPath || asset.path.startsWith(`${directoryPath}/`);
}

function storedWidth(key: string, fallback: number) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function directoryForAsset(assetPath: string) {
  return assetPath.split("/").slice(0, -1).join("/");
}

export function ProjectLibraryPage() {
  const params = useParams();
  const projectId = params.projectId ?? "";
  const selectedPath = (params["*"] ?? "").split("/").filter(Boolean).join("/");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("file") ?? undefined;
  const query = searchParams.get("search") ?? "";
  const sortMode: SortMode = searchParams.get("sort") === "name"
    ? "name"
    : searchParams.get("sort") === "production"
      ? "production"
      : "updated";
  const mode: WorkspaceMode = searchParams.get("mode") === "episode" ? "episode" : "directory";
  const requestedEpisode = Number(searchParams.get("episode"));
  const requestedStage = searchParams.get("stage") as StageFilter | null;
  const stage: StageFilter = requestedStage && stageFilters.has(requestedStage) ? requestedStage : "all";
  const requestedScope = searchParams.get("scope");
  const searchScope: SearchScope = requestedScope === "project" || requestedScope === "episode"
    ? requestedScope
    : mode === "episode"
      ? "episode"
      : "current";
  const includeContent = searchParams.get("content") === "1";
  const requestedDisplay = searchParams.get("display");

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assets, setAssets] = useState<MaterialAsset[]>([]);
  const [directories, setDirectories] = useState<MaterialDirectory[]>([]);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => storedWidth("material-center:sidebar-width", DEFAULT_SIDEBAR_WIDTH));
  const [browserWidth, setBrowserWidth] = useState(() => storedWidth("material-center:browser-width", DEFAULT_BROWSER_WIDTH));
  const [textMatches, setTextMatches] = useState<Map<string, string>>(new Map());
  const [textSearchLoading, setTextSearchLoading] = useState(false);
  const [textSearchError, setTextSearchError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const layoutRef = useRef<HTMLElement>(null);
  const resizeStart = useRef({ pointerX: 0, sidebarWidth: DEFAULT_SIDEBAR_WIDTH, browserWidth: DEFAULT_BROWSER_WIDTH, target: "browser" as ResizeTarget });
  const resizing = useRef(false);

  const episodes = useMemo(() => {
    const values = new Set<number>();
    assets.forEach((asset) => {
      const episode = productionMetaFor(asset).episode;
      if (episode !== undefined) values.add(episode);
    });
    return [...values].sort((left, right) => left - right);
  }, [assets]);
  const selectedEpisode = Number.isFinite(requestedEpisode) && requestedEpisode > 0 ? requestedEpisode : episodes[0];

  const constrainWidths = useCallback((nextSidebar: number, nextBrowser: number) => {
    const available = layoutRef.current?.clientWidth ?? window.innerWidth;
    const constrainedSidebar = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, nextSidebar));
    const maximumBrowser = Math.max(MIN_BROWSER_WIDTH, available - constrainedSidebar - MIN_PREVIEW_WIDTH - (RESIZER_WIDTH * 2));
    return {
      sidebar: Math.min(constrainedSidebar, Math.max(MIN_SIDEBAR_WIDTH, available - MIN_BROWSER_WIDTH - MIN_PREVIEW_WIDTH - (RESIZER_WIDTH * 2))),
      browser: Math.max(MIN_BROWSER_WIDTH, Math.min(nextBrowser, maximumBrowser)),
    };
  }, []);

  useEffect(() => {
    const constrainOnResize = () => {
      const next = constrainWidths(sidebarWidth, browserWidth);
      setSidebarWidth(next.sidebar);
      setBrowserWidth(next.browser);
    };
    constrainOnResize();
    window.addEventListener("resize", constrainOnResize);
    return () => {
      window.removeEventListener("resize", constrainOnResize);
      document.body.classList.remove("is-resizing-panels");
    };
  }, [browserWidth, constrainWidths, sidebarWidth]);

  useEffect(() => window.localStorage.setItem("material-center:sidebar-width", String(Math.round(sidebarWidth))), [sidebarWidth]);
  useEffect(() => window.localStorage.setItem("material-center:browser-width", String(Math.round(browserWidth))), [browserWidth]);

  function startResize(event: ReactPointerEvent<HTMLDivElement>, target: ResizeTarget) {
    resizing.current = true;
    resizeStart.current = { pointerX: event.clientX, sidebarWidth, browserWidth, target };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing-panels");
  }

  function resizePanels(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizing.current) return;
    const delta = event.clientX - resizeStart.current.pointerX;
    const next = resizeStart.current.target === "sidebar"
      ? constrainWidths(resizeStart.current.sidebarWidth + delta, resizeStart.current.browserWidth)
      : constrainWidths(resizeStart.current.sidebarWidth, resizeStart.current.browserWidth + delta);
    setSidebarWidth(next.sidebar);
    setBrowserWidth(next.browser);
  }

  function stopResize() {
    resizing.current = false;
    document.body.classList.remove("is-resizing-panels");
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const projectResponse = await getProjects();
      setProjects(projectResponse.projects);
      const materialResponse = await getMaterials(projectId);
      setAssets(materialResponse.assets);
      setDirectories(materialResponse.directories);
    } catch (reason) {
      setAssets([]);
      setDirectories([]);
      setError(reason instanceof Error ? reason.message : "无法读取本地素材目录");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const normalized = query.trim();
    if (!includeContent || normalized.length < 2) {
      setTextMatches(new Map());
      setTextSearchError("");
      setTextSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setTextSearchLoading(true);
      setTextSearchError("");
      searchMaterialText(projectId, normalized, controller.signal)
        .then(({ results }) => setTextMatches(new Map(results.map((result) => [result.path, result.snippet]))))
        .catch((reason: unknown) => {
          if (!(reason instanceof DOMException && reason.name === "AbortError")) {
            setTextSearchError(reason instanceof Error ? reason.message : "无法搜索文档正文");
          }
        })
        .finally(() => { if (!controller.signal.aborted) setTextSearchLoading(false); });
    }, 260);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [includeContent, projectId, query]);

  const episodeAssets = useMemo(
    () => selectedEpisode === undefined ? [] : assets.filter((asset) => productionMetaFor(asset).episode === selectedEpisode),
    [assets, selectedEpisode],
  );

  const scopedAssets = useMemo(() => {
    if (searchScope === "project") return assets;
    if (searchScope === "episode") return episodeAssets;
    return assets.filter((asset) => belongsToDirectory(asset, selectedPath));
  }, [assets, episodeAssets, searchScope, selectedPath]);

  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return [...scopedAssets]
      .filter((asset) => mode !== "episode" || stage === "all" || productionMetaFor(asset).stage === stage)
      .filter((asset) => !normalizedQuery
        || `${asset.name} ${asset.folder}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
        || (includeContent && textMatches.has(asset.path)))
      .sort((left, right) => {
        if (sortMode === "updated") return right.updatedAt.localeCompare(left.updatedAt);
        if (sortMode === "name") return naturalProductionCompare(left.name, right.name);
        const leftMeta = productionMetaFor(left);
        const rightMeta = productionMetaFor(right);
        return (leftMeta.episode ?? Number.MAX_SAFE_INTEGER) - (rightMeta.episode ?? Number.MAX_SAFE_INTEGER)
          || productionStageIndex(leftMeta.stage) - productionStageIndex(rightMeta.stage)
          || (leftMeta.shot ?? "").localeCompare(rightMeta.shot ?? "", "zh-CN", { numeric: true })
          || naturalProductionCompare(left.name, right.name);
      });
  }, [includeContent, mode, query, scopedAssets, sortMode, stage, textMatches]);

  const selectedAsset = assets.find((asset) => asset.id === selectedId)
    ?? (!selectedId ? visibleAssets[0] : undefined);

  useEffect(() => {
    if (loading) return;
    if (selectedId && assets.some((asset) => asset.id === selectedId)) return;
    const nextId = visibleAssets[0]?.id;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextId) next.set("file", nextId);
      else next.delete("file");
      return next;
    }, { replace: true });
  }, [assets, loading, selectedId, setSearchParams, visibleAssets]);

  function updateSearchParam(name: string, value?: string, replace = false) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    }, { replace });
  }

  function selectDirectory(path: string) {
    const next = new URLSearchParams(searchParams);
    next.delete("file");
    next.delete("search");
    next.delete("content");
    next.delete("mode");
    next.delete("episode");
    next.delete("stage");
    if (next.get("scope") === "episode") next.delete("scope");
    navigate({ pathname: projectLibraryPath(projectId, path), search: next.size ? `?${next}` : "" });
  }

  function selectEpisode(episode: number) {
    const next = new URLSearchParams(searchParams);
    next.set("mode", "episode");
    next.set("episode", String(episode));
    next.set("scope", "episode");
    next.delete("file");
    next.delete("search");
    next.delete("content");
    next.delete("stage");
    navigate({ pathname: projectLibraryPath(projectId), search: `?${next}` });
  }

  function changeMode(nextMode: WorkspaceMode) {
    if (nextMode === "episode") {
      selectEpisode(selectedEpisode ?? episodes[0] ?? 1);
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("mode");
    next.delete("episode");
    next.delete("stage");
    if (next.get("scope") === "episode") next.delete("scope");
    next.delete("file");
    navigate({ pathname: projectLibraryPath(projectId, selectedPath), search: next.size ? `?${next}` : "" });
  }

  function selectAsset(asset: MaterialAsset) {
    updateSearchParam("file", asset.id);
  }

  function openMaterial(path: string) {
    const target = assets.find((asset) => asset.path === path);
    if (!target) {
      setError(`链接目标“${path}”不在当前素材库中。`);
      return;
    }
    if (mode === "episode") {
      updateSearchParam("file", target.id);
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("file", target.id);
    next.delete("search");
    next.delete("content");
    navigate({ pathname: projectLibraryPath(projectId, directoryForAsset(target.path)), search: `?${next}` });
  }

  async function openLibrary() {
    try {
      await revealMaterial(projectId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法打开素材文件夹");
    }
  }

  const autoGrid = visibleAssets.length > 0
    && visibleAssets.length <= 80
    && visibleAssets.every((asset) => asset.kind === "image" || asset.kind === "video");
  const display: AssetDisplay = requestedDisplay === "grid" || requestedDisplay === "list"
    ? requestedDisplay
    : autoGrid
      ? "grid"
      : "list";
  const selectedIndex = selectedAsset ? visibleAssets.findIndex((asset) => asset.id === selectedAsset.id) : -1;
  const project = projects.find((candidate) => candidate.id === projectId);
  const selectedDirectory = directories.find((directory) => directory.path === selectedPath);
  const directoryMissing = !loading && mode === "directory" && Boolean(selectedPath) && !selectedDirectory;
  const title = mode === "episode"
    ? `EP${String(selectedEpisode ?? 0).padStart(2, "0")} 分集工作台`
    : selectedDirectory?.name ?? (selectedPath.split("/").at(-1) || "全部素材");
  const description = mode === "episode"
    ? "剧情、分镜、生成输入、试片、音频和成片的只读聚合"
    : selectedPath
      ? `查看“${selectedPath.replaceAll("/", " / ")}”及其子目录中的文件`
      : "剧情、图片、视频和音频中的全部本地文件";
  const breadcrumbParts = selectedPath ? selectedPath.split("/") : [];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <BrandMark />
          <div><strong>{project?.name ?? projectId ?? "短剧素材库"}</strong><span>AI 短剧素材中心 · 创作工作台</span></div>
        </div>
        <div className="header-actions">
          {projects.length > 0 && (
            <select className="project-switcher" aria-label="切换短剧项目" value={projectId} onChange={(event) => navigate(projectLibraryPath(event.target.value))}>
              {projects.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          )}
          <ThemeToggle />
          <Link className="course-link" to="/"><ArrowLeft size={18} />所有项目</Link>
          <button className="primary-button" type="button" onClick={openLibrary}><FolderOpen size={18} />打开素材文件夹</button>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={18} className={loading ? "spinning" : ""} />刷新
          </button>
        </div>
      </header>

      <div className="path-bar" aria-label="当前位置与布局">
        <div className="breadcrumbs">
          <Link to="/">所有项目</Link><i>/</i>
          <button type="button" className={!selectedPath && mode === "directory" ? "current" : ""} onClick={() => selectDirectory("")}>{project?.name ?? projectId}</button>
          {mode === "episode" ? (
            <><i>/</i><button type="button" className="current">分集台 · EP{String(selectedEpisode ?? 0).padStart(2, "0")}</button></>
          ) : breadcrumbParts.map((part, index) => {
            const path = breadcrumbParts.slice(0, index + 1).join("/");
            const current = index === breadcrumbParts.length - 1;
            return <span className="breadcrumb-part" key={path}><i>/</i><button type="button" className={current ? "current" : ""} onClick={() => selectDirectory(path)}>{part}</button></span>;
          })}
        </div>
        <div className="layout-presets" aria-label="工作区布局">
          <button type="button" onClick={() => { setPreviewExpanded(false); setPreviewCollapsed(false); setSidebarWidth(320); setBrowserWidth(560); }} title="扩大目录和文件列表"><Columns3 size={15} />整理</button>
          <button
            type="button"
            title="将目录栏和文件栏同时收窄到左侧"
            onClick={() => {
              setPreviewExpanded(false);
              setPreviewCollapsed(false);
              setSidebarWidth(MIN_SIDEBAR_WIDTH);
              setBrowserWidth(MIN_BROWSER_WIDTH);
            }}
          >
            <Columns3 size={15} />收拢
          </button>
          <button type="button" onClick={() => { setPreviewCollapsed(false); setPreviewExpanded(true); }}><BookOpen size={15} />阅读</button>
        </div>
      </div>

      <main
        ref={layoutRef}
        className={`library-layout${previewExpanded ? " preview-expanded" : ""}${previewCollapsed ? " preview-collapsed" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px`, "--file-browser-width": `${browserWidth}px` } as CSSProperties}
      >
        {!previewExpanded && (
          <>
            <Sidebar
              assets={assets}
              directories={directories}
              selectedPath={selectedPath}
              mode={mode}
              selectedEpisode={selectedEpisode}
              onSelectPath={selectDirectory}
              onModeChange={changeMode}
              onSelectEpisode={selectEpisode}
            />
            <div
              className="panel-resizer sidebar-resizer"
              role="separator"
              aria-label="调整素材导航宽度"
              aria-orientation="vertical"
              aria-valuemin={MIN_SIDEBAR_WIDTH}
              aria-valuemax={MAX_SIDEBAR_WIDTH}
              aria-valuenow={Math.round(sidebarWidth)}
              tabIndex={0}
              title="左右拖动调整素材导航宽度，双击恢复默认"
              onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const next = constrainWidths(sidebarWidth + (event.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP), browserWidth);
                setSidebarWidth(next.sidebar);
              }}
              onPointerDown={(event) => startResize(event, "sidebar")}
              onPointerMove={resizePanels}
              onPointerUp={stopResize}
              onPointerCancel={stopResize}
              onLostPointerCapture={stopResize}
            />

            <section className="file-browser">
              <header className="browser-heading">
                <div><h1>{title}</h1><p title={description}>{description}</p></div>
                <span>{query ? `${visibleAssets.length} / ${scopedAssets.length}` : visibleAssets.length} 个文件</span>
              </header>

              {mode === "episode" && selectedEpisode !== undefined && (
                <EpisodeSummary episode={selectedEpisode} assets={episodeAssets} stage={stage} onStageChange={(nextStage) => updateSearchParam("stage", nextStage === "all" ? undefined : nextStage)} />
              )}

              <div className="browser-toolbar">
                <label className="file-search">
                  <Search size={17} aria-hidden="true" />
                  <span className="sr-only">搜索素材</span>
                  <input value={query} onChange={(event) => updateSearchParam("search", event.target.value, true)} placeholder="搜索文件名、路径或正文" />
                  {query && <button type="button" aria-label="清空搜索" onClick={() => updateSearchParam("search", undefined, true)}><X size={15} /></button>}
                </label>
                <label className="scope-control"><span>范围</span>
                  <select value={searchScope} onChange={(event) => updateSearchParam("scope", event.target.value === (mode === "episode" ? "episode" : "current") ? undefined : event.target.value)}>
                    <option value="current">当前目录</option>
                    {selectedEpisode !== undefined && <option value="episode">当前集</option>}
                    <option value="project">全项目</option>
                  </select>
                </label>
                <button className="content-search-toggle" type="button" aria-pressed={includeContent} onClick={() => updateSearchParam("content", includeContent ? undefined : "1")} title="同时搜索 Markdown 和文本正文">
                  正文
                </button>
                <label className="sort-control"><span>排序</span>
                  <select value={sortMode} onChange={(event) => updateSearchParam("sort", event.target.value === "updated" ? undefined : event.target.value)}>
                    <option value="production">生产顺序</option>
                    <option value="updated">最近修改</option>
                    <option value="name">文件名称</option>
                  </select>
                </label>
                <span className="display-switch" aria-label="文件显示方式">
                  <button type="button" aria-pressed={display === "list"} onClick={() => updateSearchParam("display", "list")} title="列表视图"><List size={16} /></button>
                  <button type="button" aria-pressed={display === "grid"} onClick={() => updateSearchParam("display", "grid")} title="缩略图视图"><Grid2X2 size={16} /></button>
                </span>
                {previewCollapsed && (
                  <button className="show-preview-button" type="button" onClick={() => setPreviewCollapsed(false)}><PanelRightOpen size={17} />显示预览</button>
                )}
              </div>

              {textSearchLoading && <p className="inline-search-status"><RefreshCw size={13} className="spinning" />正在搜索文档正文…</p>}
              {textSearchError && <p className="inline-search-error" role="alert">{textSearchError}</p>}
              {(error || directoryMissing) && <div className="library-error" role="alert">{error || `目录“${selectedPath}”不存在。`}</div>}
              {loading && !assets.length
                ? <div className="loading-state"><RefreshCw size={24} className="spinning" />正在扫描本地文件夹…</div>
                : <FileList
                    assets={directoryMissing ? [] : visibleAssets}
                    selectedId={selectedAsset?.id}
                    display={display}
                    snippets={textMatches}
                    emptySearch={Boolean(query)}
                    onSelect={selectAsset}
                  />}
            </section>
          </>
        )}

        {!previewCollapsed && !previewExpanded && (
          <div
            className="panel-resizer browser-resizer"
            role="separator"
            aria-label="调整文件列表与预览区域宽度"
            aria-orientation="vertical"
            aria-valuemin={MIN_BROWSER_WIDTH}
            aria-valuenow={Math.round(browserWidth)}
            tabIndex={0}
            title="左右拖动调整文件列表宽度，双击恢复默认"
            onDoubleClick={() => setBrowserWidth(DEFAULT_BROWSER_WIDTH)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const next = constrainWidths(sidebarWidth, browserWidth + (event.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP));
              setBrowserWidth(next.browser);
            }}
            onPointerDown={(event) => startResize(event, "browser")}
            onPointerMove={resizePanels}
            onPointerUp={stopResize}
            onPointerCancel={stopResize}
            onLostPointerCapture={stopResize}
          />
        )}

        {!previewCollapsed && (
          <PreviewPane
            projectId={projectId}
            asset={directoryMissing ? undefined : selectedAsset}
            expanded={previewExpanded}
            hasPrevious={selectedIndex > 0}
            hasNext={selectedIndex >= 0 && selectedIndex < visibleAssets.length - 1}
            onToggleExpanded={() => setPreviewExpanded((expanded) => !expanded)}
            onCollapse={() => { setPreviewExpanded(false); setPreviewCollapsed(true); }}
            onPrevious={() => { const asset = visibleAssets[selectedIndex - 1]; if (asset) selectAsset(asset); }}
            onNext={() => { const asset = visibleAssets[selectedIndex + 1]; if (asset) selectAsset(asset); }}
            onOpenMaterial={openMaterial}
          />
        )}
      </main>
    </div>
  );
}
