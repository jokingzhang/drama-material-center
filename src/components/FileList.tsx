import { File, FileText, Image, SearchX, Video } from "lucide-react";
import { formatBytes, formatDate } from "../lib/materials";
import type { MaterialAsset } from "../types";

interface FileListProps {
  assets: MaterialAsset[];
  selectedId?: string;
  showFolder: boolean;
  emptySearch?: boolean;
  onSelect: (asset: MaterialAsset) => void;
}

function FileIcon({ asset }: { asset: MaterialAsset }) {
  if (asset.mimeType.startsWith("video/")) return <Video size={20} />;
  if (asset.mimeType.startsWith("image/")) return <Image size={20} />;
  if (asset.mimeType.includes("markdown")) return <FileText size={20} />;
  return <File size={20} />;
}

export function FileList({ assets, selectedId, showFolder, emptySearch = false, onSelect }: FileListProps) {
  if (!assets.length) {
    return (
      <div className="empty-list">
        {emptySearch ? <SearchX size={30} strokeWidth={1.4} /> : <File size={30} strokeWidth={1.4} />}
        <strong>{emptySearch ? "没有匹配的文件" : "这个文件夹还是空的"}</strong>
        <p>{emptySearch ? "换个关键词，或清空搜索后再试。" : "点击右上角“打开素材文件夹”，把文件放入对应目录后刷新。"}</p>
      </div>
    );
  }

  return (
    <div className={`file-table${showFolder ? " show-folder" : " compact-folder"}`} role="table" aria-label="素材文件">
      <div className="file-table-head" role="row">
        <span role="columnheader">名称</span>
        {showFolder && <span className="file-folder" role="columnheader">所在文件夹</span>}
        <span className="file-size" role="columnheader">大小</span>
        <span className="file-updated" role="columnheader">更新时间</span>
      </div>
      <div className="file-table-body">
        {assets.map((asset) => (
          <button
            className={selectedId === asset.id ? "file-row selected" : "file-row"}
            type="button"
            role="row"
            key={asset.id}
            onClick={() => onSelect(asset)}
          >
            <span className="file-name" role="cell"><FileIcon asset={asset} /><b title={asset.name}>{asset.name}</b></span>
            {showFolder && <span className="file-folder" role="cell">{asset.folder}</span>}
            <span className="file-size" role="cell">{formatBytes(asset.size)}</span>
            <span className="file-updated" role="cell">{formatDate(asset.updatedAt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
