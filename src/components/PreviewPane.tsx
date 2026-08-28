import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileQuestion, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { revealMaterial } from "../lib/materials";
import { episodeLabel, productionMetaFor, productionStageLabel } from "../lib/production";
import type { MaterialAsset } from "../types";
import { MarkdownPreview } from "./MarkdownPreview";
import { AudioPreview, VideoPreview } from "./MediaPreview";

interface PreviewPaneProps {
  projectId: string;
  asset: MaterialAsset;
  hasPrevious: boolean;
  hasNext: boolean;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenMaterial: (path: string) => void;
  presentation?: "workspace" | "dialog";
}

function scrollStorageKey(projectId: string, assetPath: string) {
  return `material-center:scroll:${projectId}:${assetPath}`;
}

export function PreviewPane({
  projectId,
  asset,
  hasPrevious,
  hasNext,
  onBack,
  onPrevious,
  onNext,
  onOpenMaterial,
  presentation = "workspace",
}: PreviewPaneProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const meta = productionMetaFor(asset);

  useEffect(() => {
    let cancelled = false;
    setText("");
    setError("");
    if (!asset.mimeType.startsWith("text/")) return () => { cancelled = true; };

    fetch(asset.url, { cache: "no-store" })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error("文件读取失败")))
      .then((value) => { if (!cancelled) setText(value); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "文件读取失败"); });
    return () => { cancelled = true; };
  }, [asset]);

  useEffect(() => {
    if (asset.mimeType.startsWith("text/") && !text) return;
    const frame = window.requestAnimationFrame(() => {
      const stored = window.sessionStorage.getItem(scrollStorageKey(projectId, asset.path));
      if (bodyRef.current) bodyRef.current.scrollTop = stored ? Number(stored) : 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [asset, projectId, text]);

  async function reveal() {
    try {
      await revealMaterial(projectId, asset.path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法打开 Finder");
    }
  }

  return (
    <aside className={`preview-pane${presentation === "dialog" ? " preview-pane-dialog" : ""}`} aria-label="文件预览">
      <header>
        <div className="preview-heading">
          <button className="preview-folder-back" type="button" onClick={onBack}>
            {presentation === "dialog" ? <X size={18} /> : <ArrowLeft size={18} />}
            {presentation === "dialog" ? "关闭预览" : "返回文件夹"}
          </button>
          <div>
            <b>文件预览</b>
            <span title={asset.path}>{asset.name}</span>
            {meta && (
              <small className="preview-production-meta">
                {meta.episode !== undefined && <i>{episodeLabel(meta.episode)}</i>}
                {meta.shot && <i>{meta.shot}</i>}
                <i>{productionStageLabel(meta.stage)}</i>
                {meta.version && <i>{meta.version}</i>}
                {meta.pathMarker && <i title="路径命名标记，不代表已经完成实际验收">路径:{meta.pathMarker}</i>}
              </small>
            )}
          </div>
        </div>
        <div className="preview-actions">
          <span className="preview-sequence-actions">
            <button type="button" disabled={!hasPrevious} onClick={onPrevious} title="上一个文件"><ChevronLeft size={16} />上一项</button>
            <button type="button" disabled={!hasNext} onClick={onNext} title="下一个文件">下一项<ChevronRight size={16} /></button>
          </span>
          <button type="button" onClick={reveal}>在 Finder 中查看 <ExternalLink size={14} /></button>
        </div>
      </header>

      <div
        ref={bodyRef}
        className="preview-body"
        onScroll={(event) => {
          window.sessionStorage.setItem(scrollStorageKey(projectId, asset.path), String(event.currentTarget.scrollTop));
        }}
      >
        {asset.kind === "image" && <img src={asset.url} alt={asset.name} />}
        {asset.kind === "video" && <VideoPreview src={asset.url} name={asset.name} />}
        {asset.kind === "audio" && <AudioPreview src={asset.url} name={asset.name} />}
        {asset.mimeType.startsWith("text/") && !text && !error && <p className="preview-loading">正在读取文档…</p>}
        {asset.mimeType.startsWith("text/") && text && (
          <MarkdownPreview source={text} projectId={projectId} assetPath={asset.path} onOpenMaterial={onOpenMaterial} />
        )}
        {asset.kind === "other" && !asset.mimeType.startsWith("text/") && (
          <div className="preview-empty"><FileQuestion size={32} strokeWidth={1.35} /><p>该文件暂不支持网页预览，请在 Finder 中查看。</p></div>
        )}
        {error && <p className="preview-error" role="alert">{error}</p>}
      </div>
    </aside>
  );
}
