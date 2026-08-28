import {
  ArrowLeft,
  BrainCircuit,
  FolderOpen,
  Grid2X2,
  List,
  PanelLeftOpen,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { FileList, type AssetDisplay } from "../components/FileList";
import { FilePreviewDialog } from "../components/FilePreviewDialog";
import { PreviewPane } from "../components/PreviewPane";
import { Sidebar } from "../components/Sidebar";
import { ThemeToggle } from "../components/ThemeToggle";
import { normalizeLegacyLibraryLocation, normalizeLegacyLibrarySearch } from "../lib/explorerTree";
import { getMaterials, getProjects, revealMaterial, searchMaterialText } from "../lib/materials";
import { naturalProductionCompare, productionMetaFor, productionStageIndex } from "../lib/production";
import { projectLibraryPath } from "../lib/routes";
import type { MaterialAsset, MaterialDirectory, ProjectSummary } from "../types";

type SortMode = "updated" | "name" | "production";
type SearchScope = "current" | "project";
type PreviewPresentation = "workspace" | "dialog";
const DEFAULT_SIDEBAR_WIDTH = 284;
const MIN_SIDEBAR_WIDTH = 238;
const MAX_SIDEBAR_WIDTH = 410;
const RESIZE_STEP = 24;

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
  const requestedPreview = searchParams.get("preview");
  const previewPresentation: PreviewPresentation = requestedPreview === "dialog" ? "dialog" : "workspace";
  const query = searchParams.get("search") ?? "";
  const sortMode: SortMode = searchParams.get("sort") === "name"
    ? "name"
    : searchParams.get("sort") === "production"
      ? "production"
      : "updated";
  const requestedScope = searchParams.get("scope");
  const searchScope: SearchScope = requestedScope === "project" ? "project" : "current";
  const includeContent = searchParams.get("content") === "1";
  const requestedDisplay = searchParams.get("display");

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assets, setAssets] = useState<MaterialAsset[]>([]);
  const [directories, setDirectories] = useState<MaterialDirectory[]>([]);
  const [treeDrawerOpen, setTreeDrawerOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => storedWidth("material-center:sidebar-width", DEFAULT_SIDEBAR_WIDTH));
  const [textMatches, setTextMatches] = useState<Map<string, string>>(new Map());
  const [textSearchLoading, setTextSearchLoading] = useState(false);
  const [textSearchError, setTextSearchError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const layoutRef = useRef<HTMLElement>(null);
  const resizeStart = useRef({ pointerX: 0, sidebarWidth: DEFAULT_SIDEBAR_WIDTH });
  const resizing = useRef(false);

  const constrainSidebarWidth = useCallback((nextSidebar: number) => {
    const available = layoutRef.current?.clientWidth ?? window.innerWidth;
    return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, available - 520, nextSidebar));
  }, []);

  useEffect(() => {
    const constrainOnResize = () => {
      if (window.innerWidth <= 1180) return;
      setSidebarWidth(constrainSidebarWidth(sidebarWidth));
    };
    constrainOnResize();
    window.addEventListener("resize", constrainOnResize);
    return () => {
      window.removeEventListener("resize", constrainOnResize);
      document.body.classList.remove("is-resizing-panels");
    };
  }, [constrainSidebarWidth, sidebarWidth]);

  useEffect(() => window.localStorage.setItem("material-center:sidebar-width", String(Math.round(sidebarWidth))), [sidebarWidth]);

  useEffect(() => {
    const normalized = normalizeLegacyLibraryLocation(searchParams, assets);
    if (!normalized.changed || loading) return;
    navigate({
      pathname: projectLibraryPath(projectId, normalized.directoryPath ?? ""),
      search: normalized.search.size ? `?${normalized.search}` : "",
    }, { replace: true });
  }, [assets, loading, navigate, projectId, searchParams]);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    resizing.current = true;
    resizeStart.current = { pointerX: event.clientX, sidebarWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing-panels");
  }

  function resizePanels(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizing.current) return;
    const delta = event.clientX - resizeStart.current.pointerX;
    setSidebarWidth(constrainSidebarWidth(resizeStart.current.sidebarWidth + delta));
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

  const scopedAssets = useMemo(() => {
    if (searchScope === "project") return assets;
    return assets.filter((asset) => belongsToDirectory(asset, selectedPath));
  }, [assets, searchScope, selectedPath]);

  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return [...scopedAssets]
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
  }, [includeContent, query, scopedAssets, sortMode, textMatches]);

  const selectedAsset = assets.find((asset) => asset.id === selectedId);

  useEffect(() => {
    if (loading || !selectedAsset || previewPresentation === "dialog") return;
    const parentPath = directoryForAsset(selectedAsset.path);
    if (parentPath === selectedPath) return;
    navigate({
      pathname: projectLibraryPath(projectId, parentPath),
      search: searchParams.size ? `?${searchParams}` : "",
    }, { replace: true });
  }, [loading, navigate, previewPresentation, projectId, searchParams, selectedAsset, selectedPath]);

  useEffect(() => {
    if (loading) return;
    const fileExists = selectedId ? assets.some((asset) => asset.id === selectedId) : false;
    const invalidFile = Boolean(selectedId && !fileExists);
    const orphanPreview = !selectedId && requestedPreview !== null;
    const invalidPreview = requestedPreview !== null && requestedPreview !== "dialog";
    if (!invalidFile && !orphanPreview && !invalidPreview) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (invalidFile) next.delete("file");
      if (orphanPreview || invalidPreview) next.delete("preview");
      return next;
    }, { replace: true });
  }, [assets, loading, requestedPreview, selectedId, setSearchParams]);

  function updateSearchParam(name: string, value?: string, replace = false) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    }, { replace });
  }

  function selectDirectory(path: string) {
    const next = normalizeLegacyLibrarySearch(searchParams).search;
    next.delete("file");
    next.delete("preview");
    setTreeDrawerOpen(false);
    navigate({ pathname: projectLibraryPath(projectId, path), search: next.size ? `?${next}` : "" });
  }

  function selectAsset(asset: MaterialAsset, presentation: PreviewPresentation, replace = false) {
    const next = normalizeLegacyLibrarySearch(searchParams).search;
    next.set("file", asset.id);
    if (presentation === "dialog") next.set("preview", "dialog");
    else next.delete("preview");
    setTreeDrawerOpen(false);
    const directoryPath = presentation === "dialog" ? selectedPath : directoryForAsset(asset.path);
    navigate(
      { pathname: projectLibraryPath(projectId, directoryPath), search: `?${next}` },
      { replace },
    );
  }

  function clearSelectedAsset(replace = false) {
    const next = new URLSearchParams(searchParams);
    next.delete("file");
    next.delete("preview");
    navigate(
      { pathname: projectLibraryPath(projectId, selectedPath), search: next.size ? `?${next}` : "" },
      { replace },
    );
  }

  function openMaterial(path: string, presentation: PreviewPresentation) {
    const target = assets.find((asset) => asset.path === path);
    if (!target) {
      setError(`链接目标“${path}”不在当前素材库中。`);
      return;
    }
    selectAsset(target, presentation, presentation === "dialog");
  }

  async function openLibrary() {
    try {
      await revealMaterial(projectId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法打开素材文件夹");
    }
  }

  const display: AssetDisplay = requestedDisplay === "grid" || requestedDisplay === "list"
    ? requestedDisplay
    : "grid";
  const selectedIndex = selectedAsset ? visibleAssets.findIndex((asset) => asset.id === selectedAsset.id) : -1;
  const dialogAsset = previewPresentation === "dialog" ? selectedAsset : undefined;
  const workspaceAsset = previewPresentation === "workspace" ? selectedAsset : undefined;
  const project = projects.find((candidate) => candidate.id === projectId);
  const selectedDirectory = directories.find((directory) => directory.path === selectedPath);
  const directoryMissing = !loading && Boolean(selectedPath) && !selectedDirectory;
  const title = selectedDirectory?.name ?? (selectedPath.split("/").at(-1) || "全部素材");
  const description = selectedPath
    ? `以缩略图查看“${selectedPath.replaceAll("/", " / ")}”及其子目录中的全部文件`
    : "以缩略图查看项目中的剧情、图片、音频、视频和生产资料";
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
            <select name="project-switcher" className="project-switcher" aria-label="切换短剧项目" value={projectId} onChange={(event) => navigate(projectLibraryPath(event.target.value))}>
              {projects.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          )}
          <ThemeToggle />
          <Link className="course-link knowledge-link" to="/knowledge"><BrainCircuit size={18} /><span className="responsive-action-label" data-compact-label="知识库">导演知识库</span></Link>
          <Link className="course-link all-projects-link" to="/"><ArrowLeft size={18} /><span className="responsive-action-label" data-compact-label="项目">所有项目</span></Link>
          <button className="primary-button open-library-button" type="button" onClick={openLibrary}><FolderOpen size={18} /><span className="responsive-action-label" data-compact-label="素材">打开素材文件夹</span></button>
          <button className="secondary-button refresh-button" type="button" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={18} className={loading ? "spinning" : ""} /><span className="responsive-action-label" data-compact-label="刷新">刷新</span>
          </button>
        </div>
      </header>

      <div className="path-bar" aria-label="当前位置">
        <div className="breadcrumbs">
          <Link to="/">所有项目</Link><i>/</i>
          <button type="button" className={!selectedPath ? "current" : ""} onClick={() => selectDirectory("")}>{project?.name ?? projectId}</button>
          {breadcrumbParts.map((part, index) => {
            const path = breadcrumbParts.slice(0, index + 1).join("/");
            const current = index === breadcrumbParts.length - 1;
            return <span className="breadcrumb-part" key={path}><i>/</i><button type="button" className={current ? "current" : ""} onClick={() => selectDirectory(path)}>{part}</button></span>;
          })}
        </div>
      </div>

      <main
        ref={layoutRef}
        className={`library-layout${workspaceAsset ? " has-selection" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        {treeDrawerOpen && <button className="tree-drawer-backdrop" type="button" aria-label="关闭文件树" onClick={() => setTreeDrawerOpen(false)} />}
        <div className={`tree-pane${treeDrawerOpen ? " open" : ""}`}>
          <button className="tree-drawer-close" type="button" onClick={() => setTreeDrawerOpen(false)} aria-label="关闭文件树"><X size={18} />关闭</button>
          <Sidebar
            key={projectId}
            projectId={projectId}
            assets={assets}
            directories={directories}
            selectedPath={selectedPath}
            selectedFileId={selectedAsset?.id}
            onSelectPath={selectDirectory}
            onSelectAsset={(asset) => selectAsset(asset, "workspace")}
          />
        </div>
        <div
          className="panel-resizer sidebar-resizer"
          role="separator"
          aria-label="调整文件树宽度"
          aria-orientation="vertical"
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          aria-valuenow={Math.round(sidebarWidth)}
          tabIndex={0}
          title="左右拖动调整文件树宽度，双击恢复默认"
          onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setSidebarWidth(constrainSidebarWidth(sidebarWidth + (event.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP)));
          }}
          onPointerDown={startResize}
          onPointerMove={resizePanels}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onLostPointerCapture={stopResize}
        />

        {!workspaceAsset ? (
          <section className="file-browser">
            <header className="browser-heading">
              <button className="tree-drawer-trigger" type="button" onClick={() => setTreeDrawerOpen(true)}><PanelLeftOpen size={18} />文件树</button>
              <div><h1>{title}</h1><p title={description}>{description}</p></div>
              <span>{query ? `${visibleAssets.length} / ${scopedAssets.length}` : visibleAssets.length} 个文件</span>
            </header>

            <div className="browser-toolbar">
              <label className="file-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">搜索素材</span>
                <input name="material-query" value={query} onChange={(event) => updateSearchParam("search", event.target.value, true)} placeholder="搜索文件名、路径或正文" />
                {query && <button type="button" aria-label="清空搜索" onClick={() => updateSearchParam("search", undefined, true)}><X size={15} /></button>}
              </label>
              <label className="scope-control"><span>范围</span>
                <select name="material-scope" value={searchScope} onChange={(event) => updateSearchParam("scope", event.target.value === "current" ? undefined : event.target.value)}>
                  <option value="current">当前目录</option>
                  <option value="project">全项目</option>
                </select>
              </label>
              <button className="content-search-toggle" type="button" aria-pressed={includeContent} onClick={() => updateSearchParam("content", includeContent ? undefined : "1")} title="同时搜索 Markdown 和文本正文">
                正文
              </button>
              <label className="sort-control"><span>排序</span>
                <select name="material-sort" value={sortMode} onChange={(event) => updateSearchParam("sort", event.target.value === "updated" ? undefined : event.target.value)}>
                  <option value="production">生产顺序</option>
                  <option value="updated">最近修改</option>
                  <option value="name">文件名称</option>
                </select>
              </label>
              <span className="display-switch" aria-label="文件显示方式">
                <button type="button" aria-pressed={display === "list"} onClick={() => updateSearchParam("display", "list")} title="列表视图"><List size={16} /></button>
                <button type="button" aria-pressed={display === "grid"} onClick={() => updateSearchParam("display", "grid")} title="缩略图视图"><Grid2X2 size={16} /></button>
              </span>
            </div>

            {textSearchLoading && <p className="inline-search-status"><RefreshCw size={13} className="spinning" />正在搜索文档正文…</p>}
            {textSearchError && <p className="inline-search-error" role="alert">{textSearchError}</p>}
            {(error || directoryMissing) && <div className="library-error" role="alert">{error || `目录“${selectedPath}”不存在。`}</div>}
            {loading && !assets.length
              ? <div className="loading-state"><RefreshCw size={24} className="spinning" />正在扫描本地文件夹…</div>
              : <FileList
                  assets={directoryMissing ? [] : visibleAssets}
                  selectedId={dialogAsset?.id}
                  display={display}
                  snippets={textMatches}
                  emptySearch={Boolean(query)}
                  directoryPath={selectedPath}
                  projectId={projectId}
                  onSelect={(asset) => selectAsset(asset, "dialog")}
                />}
          </section>
        ) : (
          <PreviewPane
            projectId={projectId}
            asset={workspaceAsset}
            hasPrevious={selectedIndex > 0}
            hasNext={selectedIndex >= 0 && selectedIndex < visibleAssets.length - 1}
            onBack={() => clearSelectedAsset(true)}
            onPrevious={() => { const asset = visibleAssets[selectedIndex - 1]; if (asset) selectAsset(asset, "workspace"); }}
            onNext={() => { const asset = visibleAssets[selectedIndex + 1]; if (asset) selectAsset(asset, "workspace"); }}
            onOpenMaterial={(path) => openMaterial(path, "workspace")}
          />
        )}

        {dialogAsset && (
          <FilePreviewDialog assetName={dialogAsset.name} onClose={() => clearSelectedAsset(true)}>
            <PreviewPane
              projectId={projectId}
              asset={dialogAsset}
              presentation="dialog"
              hasPrevious={selectedIndex > 0}
              hasNext={selectedIndex >= 0 && selectedIndex < visibleAssets.length - 1}
              onBack={() => clearSelectedAsset(true)}
              onPrevious={() => { const asset = visibleAssets[selectedIndex - 1]; if (asset) selectAsset(asset, "dialog", true); }}
              onNext={() => { const asset = visibleAssets[selectedIndex + 1]; if (asset) selectAsset(asset, "dialog", true); }}
              onOpenMaterial={(path) => openMaterial(path, "dialog")}
            />
          </FilePreviewDialog>
        )}
      </main>
    </div>
  );
}
