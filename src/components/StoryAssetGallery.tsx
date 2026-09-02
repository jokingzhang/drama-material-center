import {
  FileText,
  Film,
  ImageOff,
  Pause,
  Play,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMaterialSummary } from "../lib/materials";
import { deduplicateCurrentStoryAssets } from "../lib/storyAssets";
import type { MaterialAsset } from "../types";
import type { StoryAssetLink } from "../types/story";
import { AssetModifiedTime } from "./AssetModifiedTime";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { PreviewPane } from "./PreviewPane";

const materialTypeCopy: Record<string, string> = {
  "story.source": "全剧剧本",
  "story.summary": "故事简介",
  "story.character-setting": "人物设定",
  "story.episode-script": "分集剧本",
  "plan.asset-project": "全剧素材计划",
  "plan.asset-episode": "本集素材计划",
  "plan.shot": "分镜计划",
  "contract.dialogue": "台词合同",
  "prompt.image": "图片提示词",
  "prompt.video": "分镜提示词",
  "prompt.voice": "声音提示词",
  "image.character": "人物图片",
  "image.scene": "场景图片",
  "image.prop": "道具图片",
  "image.derived": "关键帧 / 衍生图",
  "audio.voice": "人物声音",
  "audio.scene": "场次声音",
  "audio.ambient": "环境声音",
  "audio.bgm": "配乐",
  "video.shot": "镜头视频",
  "video.final": "分集成片",
  "media.reference": "参考素材",
};

const assetStatusCopy: Record<string, string> = {
  ACCEPTED: "已验收",
  DRAFT: "草稿",
  INTERNAL: "内部参考",
  GEN_INPUT: "生成输入",
  REJECTED: "已拒绝",
  SUPERSEDED: "历史版本",
  BLOCKED: "不可用",
  UNREGISTERED: "待归档",
};

function plainSummary(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+]\([^)]*\)/g, (match) => match.replace(/^\[|]\([^)]*\)$/g, ""))
    .replace(/^[\s>*#\-|`_~]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function DocumentSummary({ projectId, asset }: { projectId: string; asset: StoryAssetLink }) {
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (!asset.url) return;
    const controller = new AbortController();
    getMaterialSummary(projectId, asset.path, controller.signal)
      .then((result) => setSummary(plainSummary(result.content).slice(0, 150)))
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setSummary("");
      });
    return () => controller.abort();
  }, [asset.path, asset.url, projectId]);

  return <p>{summary || "点击查看文档内容与完整详情"}</p>;
}

function AssetVisual({ projectId, asset }: { projectId: string; asset: StoryAssetLink }) {
  if (asset.kind === "image" && asset.url) {
    return <img src={asset.url} alt="" loading="lazy" decoding="async" />;
  }
  if (asset.kind === "video" && asset.url) {
    return <video src={asset.url} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />;
  }
  if (asset.kind === "story") {
    return <span className="story-asset-document"><FileText size={27} aria-hidden="true" /><DocumentSummary projectId={projectId} asset={asset} /></span>;
  }
  return <span className="story-asset-placeholder">{asset.kind === "video" ? <Film size={28} /> : <ImageOff size={28} />}<small>暂无可用预览</small></span>;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value)) return "--:--";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function StoryAudioCard({ asset, label }: { asset: StoryAssetLink; label?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !asset.url) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    document.querySelectorAll<HTMLAudioElement>("audio[data-story-audio]").forEach((candidate) => {
      if (candidate !== audio) candidate.pause();
    });
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }

  return (
    <article className={`story-asset-card story-audio-card${playing ? " is-playing" : ""}`}>
      <button type="button" onClick={() => void togglePlayback()} disabled={!asset.url} aria-pressed={playing}>
        <span className="story-audio-visual" aria-hidden="true">
          <span>{playing ? <Pause size={24} /> : <Play size={24} />}</span>
          <Volume2 size={20} />
        </span>
        <span className="story-asset-copy">
          <span className="story-asset-type">{materialTypeCopy[asset.materialType] ?? asset.materialType}</span>
          <strong title={label ?? asset.name}>{label ?? asset.name}</strong>
          <small>{playing ? "播放中，再次点击暂停" : asset.url ? "点击卡片直接播放" : "文件不可用"} · {formatDuration(duration)}</small>
          <AssetModifiedTime updatedAt={asset.updatedAt} />
        </span>
        <span className={`story-asset-state state-${asset.status.toLowerCase()}`}>{assetStatusCopy[asset.status] ?? asset.status}</span>
      </button>
      {asset.url && (
        <audio
          ref={audioRef}
          data-story-audio
          src={asset.url}
          preload="metadata"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
    </article>
  );
}

function StoryPreviewCard({
  projectId,
  asset,
  label,
  onOpen,
}: {
  projectId: string;
  asset: StoryAssetLink;
  label?: string;
  onOpen: (asset: StoryAssetLink) => void;
}) {
  return (
    <article className="story-asset-card">
      <button type="button" onClick={() => onOpen(asset)} disabled={!asset.url} aria-label={`查看${label ?? asset.name}详情`}>
        <span className={`story-asset-visual kind-${asset.kind}`}><AssetVisual projectId={projectId} asset={asset} /></span>
        <span className="story-asset-copy">
          <span className="story-asset-type">{materialTypeCopy[asset.materialType] ?? asset.materialType}</span>
          <strong title={label ?? asset.name}>{label ?? asset.name}</strong>
          <small title={asset.name}>{asset.name}</small>
          <AssetModifiedTime updatedAt={asset.updatedAt} />
        </span>
        <span className={`story-asset-state state-${asset.status.toLowerCase()}`}>{assetStatusCopy[asset.status] ?? asset.status}</span>
      </button>
    </article>
  );
}

interface StoryAssetGalleryProps {
  projectId: string;
  assets: StoryAssetLink[];
  onOpen: StoryAssetOpenHandler;
  labels?: Record<string, string>;
  emptyCopy?: string;
  showEmpty?: boolean;
}

export type StoryAssetOpenHandler = (asset: StoryAssetLink, siblingAssets: StoryAssetLink[]) => void;

export function StoryAssetGallery({
  projectId,
  assets,
  onOpen,
  labels = {},
  emptyCopy = "暂未登记素材。",
  showEmpty = false,
}: StoryAssetGalleryProps) {
  const uniqueAssets = deduplicateCurrentStoryAssets(assets);

  const renderCard = (asset: StoryAssetLink) => asset.kind === "audio"
    ? <StoryAudioCard key={asset.assetId} asset={asset} label={labels[asset.assetId]} />
    : <StoryPreviewCard key={asset.assetId} projectId={projectId} asset={asset} label={labels[asset.assetId]} onOpen={(selectedAsset) => onOpen(selectedAsset, uniqueAssets)} />;

  if (!uniqueAssets.length) return showEmpty ? <p className="story-empty-copy">{emptyCopy}</p> : null;
  return <div className="story-asset-gallery-wrap"><div className="story-asset-gallery">{uniqueAssets.map(renderCard)}</div></div>;
}

function mimeTypeFor(asset: StoryAssetLink) {
  const extension = asset.name.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    md: "text/markdown",
    txt: "text/plain",
    json: "text/plain",
    yaml: "text/plain",
    yml: "text/plain",
    csv: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  return mimeTypes[extension ?? ""] ?? "application/octet-stream";
}

export function storyAssetToMaterialAsset(asset: StoryAssetLink): MaterialAsset | undefined {
  if (!asset.url) return undefined;
  const separator = asset.path.lastIndexOf("/");
  return {
    id: asset.assetId,
    path: asset.path,
    name: asset.name,
    folder: separator >= 0 ? asset.path.slice(0, separator) : "",
    kind: asset.kind,
    size: 0,
    updatedAt: asset.updatedAt ?? "",
    mimeType: mimeTypeFor(asset),
    url: asset.url,
  };
}

interface StoryAssetModalProps {
  projectId: string;
  asset: StoryAssetLink;
  assets: StoryAssetLink[];
  onClose: () => void;
  onOpen: (asset: StoryAssetLink) => void;
  onOpenPath: (path: string) => void;
}

export function StoryAssetModal({ projectId, asset, assets, onClose, onOpen, onOpenPath }: StoryAssetModalProps) {
  const materialAsset = storyAssetToMaterialAsset(asset);
  const previewableAssets = useMemo(() => deduplicateCurrentStoryAssets(assets)
    .filter((candidate) => candidate.kind !== "audio" && candidate.url), [assets]);
  const selectedIndex = previewableAssets.findIndex((candidate) => candidate.assetId === asset.assetId);

  if (!materialAsset || asset.kind === "audio") return null;
  return (
    <FilePreviewDialog assetName={asset.name} onClose={onClose}>
      <PreviewPane
        projectId={projectId}
        asset={materialAsset}
        hasPrevious={selectedIndex > 0}
        hasNext={selectedIndex >= 0 && selectedIndex < previewableAssets.length - 1}
        onBack={onClose}
        onPrevious={() => {
          const previous = previewableAssets[selectedIndex - 1];
          if (previous) onOpen(previous);
        }}
        onNext={() => {
          const next = previewableAssets[selectedIndex + 1];
          if (next) onOpen(next);
        }}
        onOpenMaterial={onOpenPath}
        presentation="dialog"
      />
    </FilePreviewDialog>
  );
}
