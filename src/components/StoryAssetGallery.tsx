import {
  BookOpenText,
  Check,
  Copy,
  FileText,
  Film,
  ImageOff,
  Pause,
  Play,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { getMaterialSummary } from "../lib/materials";
import {
  assetVersionTag,
  deduplicateCurrentStoryAssets,
  readableAssetTitle,
  sceneViewBadge,
  shotPromptDuration,
  shotUnitCode,
} from "../lib/storyAssets";
import { updateSpotlightPosition } from "../lib/studioMotion";
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
  "image.character": "人物标准图",
  "image.scene": "场景参考",
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

function promptReadableExcerpt(value: string) {
  const timelineIndex = value.search(/【多分镜时间轴】|###\s+\d|\[整体场景/);
  const target = timelineIndex >= 0 ? value.slice(timelineIndex) : value;
  const cleaned = target
    .replace(/^\*\*总时长[^\n]*\*\*\s*/m, "")
    .replace(/【多分镜时间轴】/g, "")
    .replace(/\[整体场景与氛围\]/g, "")
    .replace(/\{\{\s*(?:Node\s+[a-zA-Z0-9_-]+|Mixed\s+\d+)\s*\}\}\s*[｜|]?\s*/gi, "")
    .replace(/\*\*[^*\n]{1,14}[：:]\*\*/g, "");
  const summary = plainSummary(cleaned);
  return (summary.length >= 12 ? summary : plainSummary(value)).slice(0, 170);
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function useQuickCopyAsset(asset: StoryAssetLink) {
  const [state, setState] = useState<"idle" | "copying" | "copied">("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timeout = window.setTimeout(() => setState("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [state]);

  async function copy(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!asset.url || state === "copying") return;
    setState("copying");
    try {
      const response = await fetch(asset.url, { cache: "no-store" });
      if (!response.ok) throw new Error("fetch failed");
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("idle");
    }
  }

  return { state, copy };
}

function visualAspectClass(asset: StoryAssetLink, forcedAspect?: StoryGalleryAspect) {
  if (forcedAspect && forcedAspect !== "auto") return `aspect-${forcedAspect}`;
  if (asset.kind !== "image") return "";
  if (asset.materialType === "image.scene") return "aspect-landscape";
  if (asset.materialType === "image.character") return "aspect-portrait";
  return "aspect-contain";
}

function StoryAudioCard({ asset, label, index = 0 }: { asset: StoryAssetLink; label?: string; index?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

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

  function seekTo(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const displayTitle = label ?? asset.name.replace(/\.[^.]+$/, "");
  const kindCopy = materialTypeCopy[asset.materialType] ?? "音频";
  const showKind = !displayTitle.includes(kindCopy);

  return (
    <article
      className={`story-audio-strip spotlight-card${playing ? " is-playing" : ""}`}
      data-reveal=""
      style={{ "--stagger": Math.min(index, 6) } as CSSProperties}
      onPointerMove={updateSpotlightPosition}
    >
      <button
        type="button"
        className="story-audio-play"
        onClick={() => void togglePlayback()}
        disabled={!asset.url}
        aria-pressed={playing}
        aria-label={playing ? `暂停 ${displayTitle}` : `播放 ${displayTitle}`}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>

      <div className="story-audio-main">
        <div className="story-audio-top">
          <div className="story-audio-title-group">
            {playing ? (
              <span className="studio-eq-bars" aria-hidden="true">
                <i /><i /><i /><i />
              </span>
            ) : (
              <Volume2 size={14} className="story-audio-icon" aria-hidden="true" />
            )}
            <strong title={displayTitle}>{displayTitle}</strong>
            {showKind && <span className="story-audio-kind">{kindCopy}</span>}
          </div>
          <span className={`story-state-pill state-${asset.status.toLowerCase()}`}>
            <i className="state-dot" />
            {assetStatusCopy[asset.status] ?? asset.status}
          </span>
        </div>

        <div className="story-audio-progress-row">
          <div
            className="story-audio-track"
            role="presentation"
            onClick={seekTo}
            title="点击跳转播放进度"
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="story-audio-time">
            {playing || currentTime > 0 ? `${formatDuration(currentTime)} / ` : ""}
            {duration > 0 ? formatDuration(duration) : "--:--"}
          </span>
        </div>
      </div>

      {asset.url && (
        <audio
          ref={audioRef}
          data-story-audio
          src={asset.url}
          preload="metadata"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}
    </article>
  );
}

function StoryPromptCard({
  projectId,
  asset,
  label,
  index = 0,
  onOpen,
}: {
  projectId: string;
  asset: StoryAssetLink;
  label?: string;
  index?: number;
  onOpen: (asset: StoryAssetLink) => void;
}) {
  const [preview, setPreview] = useState({ summary: "", duration: "" });
  const { state: copyState, copy } = useQuickCopyAsset(asset);
  const unitCode = shotUnitCode(asset);
  const version = assetVersionTag(asset.name);
  const isPrompt = asset.materialType === "prompt.video";

  useEffect(() => {
    if (!asset.url) return;
    const controller = new AbortController();
    getMaterialSummary(projectId, asset.path, controller.signal)
      .then((result) => setPreview({
        summary: isPrompt ? promptReadableExcerpt(result.content) : plainSummary(result.content).slice(0, 160),
        duration: isPrompt ? shotPromptDuration(result.content) ?? "" : "",
      }))
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setPreview({ summary: "", duration: "" });
      });
    return () => controller.abort();
  }, [asset.path, asset.url, isPrompt, projectId]);

  const title = label || asset.name.replace(/\.[^.]+$/, "");

  return (
    <article
      className="story-doc-card spotlight-card"
      data-reveal=""
      style={{ "--stagger": Math.min(index, 7) } as CSSProperties}
      onPointerMove={updateSpotlightPosition}
    >
      <button
        type="button"
        className="story-doc-card-trigger"
        onClick={() => onOpen(asset)}
        disabled={!asset.url}
        aria-label={`查看${title}详情`}
      >
        <div className="story-doc-card-head">
          <div className="story-doc-badges">
            {unitCode ? (
              <span className="story-unit-badge">{unitCode}</span>
            ) : (
              <span className="story-doc-type-chip"><FileText size={13} aria-hidden="true" />{materialTypeCopy[asset.materialType] ?? asset.materialType}</span>
            )}
            {preview.duration && (
              <span className="story-duration-pill" aria-label={`总时长 ${preview.duration}`}>{preview.duration}</span>
            )}
            {version && <span className="story-version-pill">{version}</span>}
          </div>
          <span className={`story-state-pill state-${asset.status.toLowerCase()}`}>
            <i className="state-dot" />
            {assetStatusCopy[asset.status] ?? asset.status}
          </span>
        </div>

        <strong className="story-doc-title" title={title}>{title}</strong>
        <p className="story-doc-excerpt">{preview.summary || "点击查看文档内容与完整详情"}</p>

        <div className="story-doc-foot">
          <AssetModifiedTime updatedAt={asset.updatedAt} />
          <span className="story-doc-filename" title={asset.name}>{asset.name}</span>
        </div>
      </button>

      {asset.url && (
        <button
          type="button"
          className={`story-card-copy-btn${copyState === "copied" ? " is-copied" : ""}`}
          onClick={(event) => void copy(event)}
          title="一键复制全文"
          aria-label={`复制 ${title}`}
        >
          {copyState === "copied" ? <Check size={13} /> : <Copy size={13} />}
          <span>{copyState === "copied" ? "已复制" : "复制"}</span>
        </button>
      )}
    </article>
  );
}

export function StoryScriptBanner({
  projectId,
  asset,
  onOpen,
}: {
  projectId: string;
  asset: StoryAssetLink;
  onOpen: StoryAssetOpenHandler;
}) {
  const [excerpt, setExcerpt] = useState("");
  const { state: copyState, copy } = useQuickCopyAsset(asset);
  const version = assetVersionTag(asset.name);

  useEffect(() => {
    if (!asset.url) return;
    const controller = new AbortController();
    getMaterialSummary(projectId, asset.path, controller.signal)
      .then((result) => setExcerpt(plainSummary(result.content).slice(0, 260)))
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setExcerpt("");
      });
    return () => controller.abort();
  }, [asset.path, asset.url, projectId]);

  const title = asset.name.replace(/\.[^.]+$/, "");

  return (
    <article
      className="story-script-banner spotlight-card"
      data-reveal=""
      onPointerMove={updateSpotlightPosition}
    >
      <div className="story-script-banner-body" onClick={() => asset.url && onOpen(asset, [asset])} role="button" tabIndex={0} onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && asset.url) {
          event.preventDefault();
          onOpen(asset, [asset]);
        }
      }}>
        <div className="story-script-banner-icon" aria-hidden="true">
          <BookOpenText size={19} />
        </div>
        <div className="story-script-banner-copy">
          <div className="story-script-banner-meta">
            <span className="story-doc-type-chip">分集剧本</span>
            {version && <span className="story-version-pill">{version}</span>}
            <span className={`story-state-pill state-${asset.status.toLowerCase()}`}>
              <i className="state-dot" />
              {assetStatusCopy[asset.status] ?? asset.status}
            </span>
            <AssetModifiedTime updatedAt={asset.updatedAt} />
          </div>
          <strong title={asset.name}>{title}</strong>
          <p>{excerpt || "点击打开阅读本集完整剧本正文。"}</p>
        </div>
      </div>

      <div className="story-script-banner-actions">
        <button
          type="button"
          className={`studio-subtle-btn${copyState === "copied" ? " is-copied" : ""}`}
          disabled={!asset.url}
          onClick={(event) => void copy(event)}
        >
          {copyState === "copied" ? <Check size={14} /> : <Copy size={14} />}
          {copyState === "copied" ? "已复制" : "复制剧本"}
        </button>
        <button
          type="button"
          className="studio-primary-btn"
          disabled={!asset.url}
          onClick={() => onOpen(asset, [asset])}
        >
          阅读全文
        </button>
      </div>
    </article>
  );
}

function StoryVisualCard({
  asset,
  label,
  aspect,
  index = 0,
  onOpen,
}: {
  asset: StoryAssetLink;
  label?: string;
  aspect?: StoryGalleryAspect;
  index?: number;
  onOpen: (asset: StoryAssetLink) => void;
}) {
  const version = assetVersionTag(asset.name);
  const sceneView = asset.materialType === "image.scene" ? sceneViewBadge(asset.name) : undefined;
  const title = readableAssetTitle(asset, label);
  const aspectClass = visualAspectClass(asset, aspect);

  return (
    <article
      className="story-media-card spotlight-card"
      data-reveal=""
      style={{ "--stagger": Math.min(index, 7) } as CSSProperties}
      onPointerMove={updateSpotlightPosition}
    >
      <button type="button" onClick={() => onOpen(asset)} disabled={!asset.url} aria-label={`查看${title}详情`}>
        <span className={`story-media-frame kind-${asset.kind} ${aspectClass}`}>
          {asset.kind === "image" && asset.url ? (
            <img src={asset.url} alt="" loading="lazy" decoding="async" />
          ) : asset.kind === "video" && asset.url ? (
            <video src={asset.url} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
          ) : (
            <span className="story-asset-placeholder">{asset.kind === "video" ? <Film size={26} /> : <ImageOff size={26} />}<small>暂无可用预览</small></span>
          )}
          <span className={`story-state-pill overlay state-${asset.status.toLowerCase()}`}>
            <i className="state-dot" />
            {assetStatusCopy[asset.status] ?? asset.status}
          </span>
          {sceneView && <span className="story-view-chip">{sceneView}</span>}
        </span>

        <span className="story-media-copy">
          <span className="story-media-title-row">
            <strong title={title}>{title}</strong>
            {version && <span className="story-version-pill">{version}</span>}
          </span>
          <span className="story-media-meta-row">
            <span className="story-media-type">{materialTypeCopy[asset.materialType] ?? asset.materialType}</span>
            <AssetModifiedTime updatedAt={asset.updatedAt} />
          </span>
        </span>
      </button>
    </article>
  );
}

export type StoryGalleryAspect = "auto" | "portrait" | "landscape" | "contain";

interface StoryAssetGalleryProps {
  projectId: string;
  assets: StoryAssetLink[];
  onOpen: StoryAssetOpenHandler;
  labels?: Record<string, string>;
  emptyCopy?: string;
  showEmpty?: boolean;
  aspect?: StoryGalleryAspect;
}

export type StoryAssetOpenHandler = (asset: StoryAssetLink, siblingAssets: StoryAssetLink[]) => void;

export function StoryAssetGallery({
  projectId,
  assets,
  onOpen,
  labels = {},
  emptyCopy = "暂未登记素材。",
  showEmpty = false,
  aspect = "auto",
}: StoryAssetGalleryProps) {
  const uniqueAssets = deduplicateCurrentStoryAssets(assets);
  const audioAssets = uniqueAssets.filter((asset) => asset.kind === "audio");
  const docAssets = uniqueAssets.filter((asset) => asset.kind === "story");
  const visualAssets = uniqueAssets.filter((asset) => asset.kind !== "audio" && asset.kind !== "story");

  if (!uniqueAssets.length) return showEmpty ? <p className="story-empty-copy">{emptyCopy}</p> : null;

  const isLandscapeGrid = aspect === "landscape"
    || (aspect === "auto" && visualAssets.length > 0 && visualAssets.every((asset) => asset.materialType === "image.scene"));

  return (
    <div className="story-asset-gallery-wrap">
      {visualAssets.length > 0 && (
        <div className={`story-media-grid${isLandscapeGrid ? " is-landscape" : ""}`}>
          {visualAssets.map((asset, index) => (
            <StoryVisualCard
              key={asset.assetId}
              asset={asset}
              label={labels[asset.assetId]}
              aspect={aspect}
              index={index}
              onOpen={(selectedAsset) => onOpen(selectedAsset, visualAssets)}
            />
          ))}
        </div>
      )}

      {docAssets.length > 0 && (
        <div className="story-doc-grid">
          {docAssets.map((asset, index) => (
            <StoryPromptCard
              key={asset.assetId}
              projectId={projectId}
              asset={asset}
              label={labels[asset.assetId]}
              index={index}
              onOpen={(selectedAsset) => onOpen(selectedAsset, docAssets)}
            />
          ))}
        </div>
      )}

      {audioAssets.length > 0 && (
        <div className="story-audio-strip-list">
          {audioAssets.map((asset, index) => (
            <StoryAudioCard key={asset.assetId} asset={asset} label={labels[asset.assetId]} index={index} />
          ))}
        </div>
      )}
    </div>
  );
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
