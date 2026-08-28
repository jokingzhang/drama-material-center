import { ChevronRight, FileText, Folder, Image, Music2, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AssetDisplay } from "./FileList";
import type { MaterialDirectory } from "../types";

export interface DirectoryListItem extends MaterialDirectory {
  fileCount: number;
}

interface DirectoryListProps {
  directories: DirectoryListItem[];
  display: AssetDisplay;
  onSelect: (path: string) => void;
}

function iconFor(directory: MaterialDirectory): LucideIcon {
  if (directory.name === "剧情") return FileText;
  if (directory.name === "图片") return Image;
  if (directory.name === "视频") return Video;
  if (directory.name === "音频") return Music2;
  return Folder;
}

export function DirectoryList({ directories, display, onSelect }: DirectoryListProps) {
  if (!directories.length) return null;

  return (
    <section className={`directory-section directory-${display}`} aria-labelledby="directory-section-title">
      <div className="browser-section-heading">
        <h2 id="directory-section-title">文件夹</h2>
        <span>{directories.length} 个</span>
      </div>
      <div className="directory-list">
        {directories.map((directory) => {
          const Icon = iconFor(directory);
          return (
            <button
              className="directory-card"
              type="button"
              key={directory.path}
              title={directory.path.replaceAll("/", " / ")}
              onClick={() => onSelect(directory.path)}
            >
              <span className="directory-card-icon"><Icon size={24} aria-hidden="true" /></span>
              <span className="directory-card-copy">
                <b>{directory.name}</b>
                <small>{directory.fileCount} 个文件</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
