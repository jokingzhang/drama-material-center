import { File, FileText, Image, Music2, SearchX, Video } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatBytes, formatDate, getMaterialSummary } from "../lib/materials";
import { assetDirectoryPath } from "../lib/explorerTree";
import { formatAspectRatio } from "../lib/mediaDimensions";
import { episodeLabel, kindLabel, productionMetaFor, productionStageLabel } from "../lib/production";
import type { MaterialAsset } from "../types";

export type AssetDisplay = "list" | "grid";

interface FileListProps {
  assets: MaterialAsset[];
  selectedId?: string;
  display: AssetDisplay;
  snippets?: ReadonlyMap<string, string>;
  emptySearch?: boolean;
  directoryPath?: string;
  projectId: string;
  onSelect: (asset: MaterialAsset) => void;
}

function FileIcon({ asset, size = 20 }: { asset: MaterialAsset; size?: number }) {
  if (asset.kind === "video") return <Video size={size} />;
  if (asset.kind === "image") return <Image size={size} />;
  if (asset.kind === "audio") return <Music2 size={size} />;
  if (asset.mimeType.includes("markdown") || asset.mimeType.startsWith("text/")) return <FileText size={size} />;
  return <File size={size} />;
}

function AssetTags({ asset }: { asset: MaterialAsset }) {
  const meta = productionMetaFor(asset);
  return (
    <span className="asset-tags" aria-label="生产信息">
      {meta.episode !== undefined && <span>{episodeLabel(meta.episode)}</span>}
      {meta.shot && <span>{meta.shot}</span>}
      <span>{productionStageLabel(meta.stage)}</span>
      {meta.version && <span>{meta.version}</span>}
      {meta.pathMarker && (
        <span className={`path-marker marker-${meta.pathMarker.toLocaleLowerCase()}`} title="来自目录或文件名的路径标记，不代表已经完成实际验收">
          路径:{meta.pathMarker}
        </span>
      )}
    </span>
  );
}

function moveSelection(
  event: KeyboardEvent<HTMLElement>,
  index: number,
  assets: MaterialAsset[],
  onSelect: (asset: MaterialAsset) => void,
) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const grid = Boolean(event.currentTarget.closest(".file-grid"));
  const columns = grid && window.matchMedia("(min-width: 1280px)").matches ? 3 : grid ? 2 : 1;
  const delta = event.key === "ArrowUp"
    ? -columns
    : event.key === "ArrowDown"
      ? columns
      : event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowRight"
          ? 1
          : 0;
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? assets.length - 1
      : Math.max(0, Math.min(assets.length - 1, index + delta));
  const next = assets[nextIndex];
  if (!next) return;
  onSelect(next);
  const controls = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(".file-row, .asset-card");
  controls?.[nextIndex]?.focus();
}

function cleanSummary(value: string) {
  return value
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#>*_`|\[\]]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function TextSummary({ asset, projectId }: { asset: MaterialAsset; projectId: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [visible, setVisible] = useState(false);
  const [summary, setSummary] = useState("等待进入可视区域…");

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "180px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setSummary("正在读取摘要…");
    getMaterialSummary(projectId, asset.path, controller.signal)
      .then((value) => setSummary(cleanSummary(value.content) || "无可用摘要"))
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setSummary("摘要暂不可用");
      });
    return () => controller.abort();
  }, [asset.path, projectId, visible]);

  return <p className="asset-text-summary" ref={ref}>{summary}</p>;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function AspectRatioChip({ width, height }: { width?: number; height?: number }) {
  const label = width && height ? formatAspectRatio(width, height) : undefined;
  if (!label) return null;
  return <span className="asset-ratio-chip" title={`${width} × ${height} 像素`}>{label}</span>;
}

function LazyImageThumbnail({ asset }: { asset: MaterialAsset }) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>();
  return (
    <>
      <img
        src={asset.url}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      />
      <AspectRatioChip width={dimensions?.width} height={dimensions?.height} />
    </>
  );
}

function LazyVideoThumbnail({ asset }: { asset: MaterialAsset }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [duration, setDuration] = useState<string>();
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>();

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "120px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <span className={`asset-video-card${visible ? " loaded" : ""}`} ref={ref}>
      {visible ? (
        <>
          <video
            src={asset.url}
            preload="metadata"
            muted
            playsInline
            aria-label={`${asset.name} 首帧缩略图`}
            onLoadedMetadata={(event) => {
              setDuration(formatDuration(event.currentTarget.duration));
              setDimensions({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight });
              if (event.currentTarget.duration > 0.05) event.currentTarget.currentTime = 0.05;
            }}
          />
          {duration && <small>{duration}</small>}
          <AspectRatioChip width={dimensions?.width} height={dimensions?.height} />
        </>
      ) : <><Video size={34} /><small>进入视口后读取首帧</small></>}
    </span>
  );
}

function AssetThumbnail({ asset, projectId }: { asset: MaterialAsset; projectId: string }) {
  if (asset.kind === "image") return <LazyImageThumbnail asset={asset} />;
  if (asset.kind === "audio") {
    return (
      <span className="asset-audio-card" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <Music2 size={30} />
        <audio
          controls
          preload="none"
          src={asset.url}
          aria-label={`试听 ${asset.name}`}
          onPlay={(event) => {
            document.querySelectorAll<HTMLAudioElement>(".asset-audio-card audio").forEach((audio) => {
              if (audio !== event.currentTarget) audio.pause();
            });
          }}
        />
      </span>
    );
  }
  if (asset.mimeType.startsWith("text/")) return <TextSummary asset={asset} projectId={projectId} />;
  if (asset.kind === "video") return <LazyVideoThumbnail asset={asset} />;
  return <span className={`asset-card-placeholder kind-${asset.kind}`}><FileIcon asset={asset} size={34} /></span>;
}

function relativeFolder(asset: MaterialAsset, directoryPath: string) {
  const parentPath = assetDirectoryPath(asset);
  if (!parentPath) return "项目根目录";
  if (!directoryPath) return parentPath.replaceAll("/", " / ");
  if (parentPath === directoryPath) return "当前文件夹";
  if (parentPath.startsWith(`${directoryPath}/`)) return parentPath.slice(directoryPath.length + 1).replaceAll("/", " / ");
  return parentPath.replaceAll("/", " / ");
}

export function FileList({ assets, selectedId, display, snippets = new Map(), emptySearch = false, directoryPath = "", projectId, onSelect }: FileListProps) {
  const [limit, setLimit] = useState(120);
  useEffect(() => setLimit(120), [assets]);

  if (!assets.length) {
    return (
      <div className="empty-list">
        {emptySearch ? <SearchX size={30} strokeWidth={1.4} /> : <File size={30} strokeWidth={1.4} />}
        <strong>{emptySearch ? "没有匹配的文件" : "这个范围还是空的"}</strong>
        <p>{emptySearch ? "换个关键词、搜索范围，或关闭正文搜索后再试。" : "点击右上角“打开素材文件夹”，放入素材后刷新。"}</p>
      </div>
    );
  }

  if (display === "grid") {
    const renderedAssets = assets.slice(0, limit);
    return (
      <div className="file-grid" role="list" aria-label="文件夹内容缩略图">
        {renderedAssets.map((asset, index) => (
          <article
            className={selectedId === asset.id ? "asset-card selected" : "asset-card"}
            role="listitem"
            aria-current={selectedId === asset.id ? "true" : undefined}
            tabIndex={0}
            key={asset.id}
            onClick={(event) => { if (!(event.target as Element).closest("audio")) onSelect(asset); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                if ((event.target as Element).closest("audio")) return;
                event.preventDefault();
                onSelect(asset);
                return;
              }
              moveSelection(event, index, renderedAssets, onSelect);
            }}
          >
            <span className="asset-card-media"><AssetThumbnail asset={asset} projectId={projectId} /><span className="asset-kind-chip">{kindLabel(asset.kind)}</span></span>
            <span className="asset-card-copy">
              <b title={asset.name}>{asset.name}</b>
              <AssetTags asset={asset} />
              {snippets.get(asset.path) && <mark className="search-snippet">{snippets.get(asset.path)}</mark>}
              <small title={asset.folder}>{relativeFolder(asset, directoryPath)}</small>
            </span>
          </article>
        ))}
        {limit < assets.length && <button className="load-more-button asset-load-more" type="button" onClick={() => setLimit((value) => value + 120)}>继续显示（{assets.length - limit} 个文件待显示）</button>}
      </div>
    );
  }

  return (
    <div className="file-table" aria-label="素材文件">
      <div className="file-table-head" aria-hidden="true"><span>名称与生产信息</span><span>来源</span><span>更新时间</span></div>
      <div className="file-table-body" role="listbox" aria-label="素材文件列表">
        {assets.map((asset, index) => (
          <button
            className={selectedId === asset.id ? "file-row selected" : "file-row"}
            type="button"
            role="option"
            aria-selected={selectedId === asset.id}
            key={asset.id}
            onClick={() => onSelect(asset)}
            onKeyDown={(event) => moveSelection(event, index, assets, onSelect)}
          >
            <span className="file-name">
              <FileIcon asset={asset} />
              <span className="file-primary">
                <b title={asset.name}>{asset.name}</b><AssetTags asset={asset} />
                {snippets.get(asset.path) && <mark className="search-snippet">{snippets.get(asset.path)}</mark>}
              </span>
            </span>
            <span className="file-folder" title={asset.folder}>{relativeFolder(asset, directoryPath)}<small>{formatBytes(asset.size)}</small></span>
            <span className="file-updated" title={new Date(asset.updatedAt).toLocaleString("zh-CN")}>{formatDate(asset.updatedAt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
