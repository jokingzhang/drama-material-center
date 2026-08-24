import { File, FileText, Image, Music2, SearchX, Video } from "lucide-react";
import type { KeyboardEvent } from "react";
import { formatBytes, formatDate } from "../lib/materials";
import { episodeLabel, kindLabel, productionMetaFor, productionStageLabel } from "../lib/production";
import type { MaterialAsset } from "../types";

export type AssetDisplay = "list" | "grid";

interface FileListProps {
  assets: MaterialAsset[];
  selectedId?: string;
  display: AssetDisplay;
  snippets?: ReadonlyMap<string, string>;
  emptySearch?: boolean;
  onSelect: (asset: MaterialAsset) => void;
}

function FileIcon({ asset, size = 20 }: { asset: MaterialAsset; size?: number }) {
  if (asset.kind === "video") return <Video size={size} />;
  if (asset.kind === "image") return <Image size={size} />;
  if (asset.kind === "audio") return <Music2 size={size} />;
  if (asset.mimeType.includes("markdown")) return <FileText size={size} />;
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
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  assets: MaterialAsset[],
  onSelect: (asset: MaterialAsset) => void,
) {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const columns = event.currentTarget.closest(".file-grid") ? 3 : 1;
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
  const controls = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(".file-row, .asset-card");
  controls?.[nextIndex]?.focus();
}

function AssetThumbnail({ asset }: { asset: MaterialAsset }) {
  if (asset.kind === "image") {
    return <img src={asset.url} alt="" loading="lazy" decoding="async" />;
  }
  if (asset.kind === "video") {
    return <video src={asset.url} preload="metadata" muted aria-label={`${asset.name} 视频缩略预览`} />;
  }
  return <span className={`asset-card-placeholder kind-${asset.kind}`}><FileIcon asset={asset} size={34} /></span>;
}

export function FileList({ assets, selectedId, display, snippets = new Map(), emptySearch = false, onSelect }: FileListProps) {
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
    return (
      <div className="file-grid" role="listbox" aria-label="素材缩略图">
        {assets.map((asset, index) => (
          <button
            className={selectedId === asset.id ? "asset-card selected" : "asset-card"}
            type="button"
            role="option"
            aria-selected={selectedId === asset.id}
            key={asset.id}
            onClick={() => onSelect(asset)}
            onKeyDown={(event) => moveSelection(event, index, assets, onSelect)}
          >
            <span className="asset-card-media"><AssetThumbnail asset={asset} /><span className="asset-kind-chip">{kindLabel(asset.kind)}</span></span>
            <span className="asset-card-copy">
              <b title={asset.name}>{asset.name}</b>
              <AssetTags asset={asset} />
              {snippets.get(asset.path) && <mark className="search-snippet">{snippets.get(asset.path)}</mark>}
              <small title={asset.folder}>{asset.folder || "项目根目录"}</small>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="file-table" aria-label="素材文件">
      <div className="file-table-head" aria-hidden="true">
        <span>名称与生产信息</span>
        <span>来源</span>
        <span>更新时间</span>
      </div>
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
                <b title={asset.name}>{asset.name}</b>
                <AssetTags asset={asset} />
                {snippets.get(asset.path) && <mark className="search-snippet">{snippets.get(asset.path)}</mark>}
              </span>
            </span>
            <span className="file-folder" title={asset.folder}>{asset.folder || "项目根目录"}<small>{formatBytes(asset.size)}</small></span>
            <span className="file-updated" title={new Date(asset.updatedAt).toLocaleString("zh-CN")}>{formatDate(asset.updatedAt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
