import { ArrowLeft, FolderOpen, PanelRightOpen, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { FileList } from "../components/FileList";
import { PreviewPane } from "../components/PreviewPane";
import { Sidebar } from "../components/Sidebar";
import { getMaterials, getProjects, revealMaterial } from "../lib/materials";
import { projectLibraryPath } from "../lib/routes";
import type { MaterialAsset, MaterialDirectory, ProjectSummary } from "../types";

type SortMode = "updated" | "name";

const DEFAULT_BROWSER_WIDTH = 360;
const MIN_BROWSER_WIDTH = 320;
const MIN_PREVIEW_WIDTH = 360;
const RESIZE_STEP = 24;

function belongsToDirectory(asset: MaterialAsset, directoryPath: string) {
  return !directoryPath || asset.path.startsWith(`${directoryPath}/`);
}

export function ProjectLibraryPage() {
  const params = useParams();
  const projectId = params.projectId ?? "";
  const selectedPath = (params["*"] ?? "").split("/").filter(Boolean).join("/");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("file") ?? undefined;
  const query = searchParams.get("q") ?? "";
  const sortMode: SortMode = searchParams.get("sort") === "name" ? "name" : "updated";

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assets, setAssets] = useState<MaterialAsset[]>([]);
  const [directories, setDirectories] = useState<MaterialDirectory[]>([]);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [browserWidth, setBrowserWidth] = useState(DEFAULT_BROWSER_WIDTH);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const layoutRef = useRef<HTMLElement>(null);
  const resizeStart = useRef({ pointerX: 0, browserWidth: DEFAULT_BROWSER_WIDTH });
  const resizing = useRef(false);

  const constrainBrowserWidth = useCallback((width: number) => {
    const layout = layoutRef.current;
    const sidebar = layout?.querySelector<HTMLElement>(".library-sidebar");
    const availableWidth = layout && sidebar
      ? layout.clientWidth - sidebar.offsetWidth - MIN_PREVIEW_WIDTH - 10
      : width;
    return Math.max(MIN_BROWSER_WIDTH, Math.min(width, availableWidth));
  }, []);

  useEffect(() => {
    const constrainOnResize = () => setBrowserWidth((width) => constrainBrowserWidth(width));
    constrainOnResize();
    window.addEventListener("resize", constrainOnResize);
    return () => {
      window.removeEventListener("resize", constrainOnResize);
      document.body.classList.remove("is-resizing-panels");
    };
  }, [constrainBrowserWidth]);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    resizing.current = true;
    resizeStart.current = { pointerX: event.clientX, browserWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing-panels");
  }

  function resizePanels(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizing.current) return;
    setBrowserWidth(constrainBrowserWidth(resizeStart.current.browserWidth + event.clientX - resizeStart.current.pointerX));
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scopedAssets = useMemo(
    () => assets.filter((asset) => belongsToDirectory(asset, selectedPath)),
    [assets, selectedPath],
  );

  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return [...scopedAssets]
      .filter((asset) => !normalizedQuery || `${asset.name} ${asset.folder}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
      .sort((left, right) => sortMode === "updated"
        ? right.updatedAt.localeCompare(left.updatedAt)
        : left.name.localeCompare(right.name, "zh-CN", { numeric: true }));
  }, [query, scopedAssets, sortMode]);

  const selectedAsset = visibleAssets.find((asset) => asset.id === selectedId) ?? visibleAssets[0];

  useEffect(() => {
    if (loading) return;
    const nextId = visibleAssets[0]?.id;
    if (selectedId && visibleAssets.some((asset) => asset.id === selectedId)) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextId) next.set("file", nextId);
      else next.delete("file");
      return next;
    }, { replace: true });
  }, [loading, selectedId, setSearchParams, visibleAssets]);

  function updateSearchParam(name: string, value?: string, replace = false) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    }, { replace });
  }

  function selectDirectory(path: string) {
    const nextSearch = new URLSearchParams();
    if (sortMode === "name") nextSearch.set("sort", "name");
    navigate({
      pathname: projectLibraryPath(projectId, path),
      search: nextSearch.size ? `?${nextSearch}` : "",
    });
  }

  async function openLibrary() {
    try {
      await revealMaterial(projectId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法打开素材文件夹");
    }
  }

  const project = projects.find((candidate) => candidate.id === projectId);
  const selectedDirectory = directories.find((directory) => directory.path === selectedPath);
  const directoryMissing = !loading && Boolean(selectedPath) && !selectedDirectory;
  const title = selectedDirectory?.name ?? (selectedPath.split("/").at(-1) || "全部素材");
  const description = selectedPath
    ? `查看“${selectedPath.replaceAll("/", " / ")}”及其子目录中的文件`
    : "剧情、图片和视频中的全部本地文件";
  const breadcrumbParts = selectedPath ? selectedPath.split("/") : [];
  const showFolder = new Set(visibleAssets.map((asset) => asset.folder)).size > 1;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <BrandMark />
          <div><strong>{project?.name ?? projectId ?? "短剧素材库"}</strong><span>AI 短剧素材中心 · 本地文件</span></div>
        </div>
        <div className="header-actions">
          {projects.length > 0 && (
            <select
              className="project-switcher"
              aria-label="切换短剧项目"
              value={projectId}
              onChange={(event) => navigate(projectLibraryPath(event.target.value))}
            >
              {projects.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          )}
          <Link className="course-link" to="/"><ArrowLeft size={18} />所有项目</Link>
          <button className="primary-button" type="button" onClick={openLibrary}><FolderOpen size={18} />打开素材文件夹</button>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={18} className={loading ? "spinning" : ""} />刷新
          </button>
        </div>
      </header>

      <div className="path-bar" aria-label="当前位置">
        <Link to="/">所有项目</Link><i>/</i>
        <button type="button" className={!selectedPath ? "current" : ""} onClick={() => selectDirectory("")}>{project?.name ?? projectId}</button>
        {breadcrumbParts.map((part, index) => {
          const path = breadcrumbParts.slice(0, index + 1).join("/");
          const current = index === breadcrumbParts.length - 1;
          return <span className="breadcrumb-part" key={path}><i>/</i><button type="button" className={current ? "current" : ""} onClick={() => selectDirectory(path)}>{part}</button></span>;
        })}
      </div>

      <main
        ref={layoutRef}
        className={`library-layout${previewExpanded ? " preview-expanded" : ""}${previewCollapsed ? " preview-collapsed" : ""}`}
        style={{ "--file-browser-width": `${browserWidth}px` } as CSSProperties}
      >
        <Sidebar assets={assets} directories={directories} selectedPath={selectedPath} onSelectPath={selectDirectory} />

        <section className="file-browser">
          <header className="browser-heading">
            <div><h1>{title}</h1><p>{description}</p></div>
            <span>{query ? `${visibleAssets.length} / ${scopedAssets.length}` : visibleAssets.length} 个文件</span>
          </header>

          <div className="browser-toolbar">
            <label className="file-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">搜索当前目录</span>
              <input value={query} onChange={(event) => updateSearchParam("q", event.target.value, true)} placeholder="搜索当前目录的文件" />
              {query && <button type="button" aria-label="清空搜索" onClick={() => updateSearchParam("q", undefined, true)}><X size={15} /></button>}
            </label>
            <label className="sort-control">
              <span>排序</span>
              <select value={sortMode} onChange={(event) => updateSearchParam("sort", event.target.value === "name" ? "name" : undefined)}>
                <option value="updated">最近修改</option>
                <option value="name">文件名称</option>
              </select>
            </label>
            {previewCollapsed && (
              <button className="show-preview-button" type="button" onClick={() => setPreviewCollapsed(false)}>
                <PanelRightOpen size={17} />显示预览
              </button>
            )}
          </div>

          {(error || directoryMissing) && <div className="library-error" role="alert">{error || `目录“${selectedPath}”不存在。`}</div>}
          {loading && !assets.length
            ? <div className="loading-state"><RefreshCw size={24} className="spinning" />正在扫描本地文件夹…</div>
            : <FileList
                assets={directoryMissing ? [] : visibleAssets}
                selectedId={selectedAsset?.id}
                showFolder={showFolder}
                emptySearch={Boolean(query)}
                onSelect={(asset) => updateSearchParam("file", asset.id)}
              />}
        </section>

        {!previewCollapsed && !previewExpanded && (
          <div
            className="panel-resizer"
            role="separator"
            aria-label="调整文件目录与预览区域宽度"
            aria-orientation="vertical"
            aria-valuemin={MIN_BROWSER_WIDTH}
            aria-valuenow={Math.round(browserWidth)}
            tabIndex={0}
            title="左右拖动调整宽度，双击恢复默认宽度"
            onDoubleClick={() => setBrowserWidth(constrainBrowserWidth(DEFAULT_BROWSER_WIDTH))}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const delta = event.key === "ArrowLeft" ? -RESIZE_STEP : RESIZE_STEP;
              setBrowserWidth((width) => constrainBrowserWidth(width + delta));
            }}
            onPointerDown={startResize}
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
            onToggleExpanded={() => setPreviewExpanded((expanded) => !expanded)}
            onCollapse={() => {
              setPreviewExpanded(false);
              setPreviewCollapsed(true);
            }}
          />
        )}
      </main>
    </div>
  );
}
