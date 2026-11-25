import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FileQuestion, X } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const meta = productionMetaFor(asset);
  const isTextAsset = asset.mimeType.startsWith("text/");
  const displayName = asset.name.replace(/\.[^.]+$/, "");

  useEffect(() => {
    let cancelled = false;
    setText("");
    setError("");
    setCopied(false);
    if (!isTextAsset) return () => { cancelled = true; };

    fetch(asset.url, { cache: "no-store" })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error("文件读取失败")))
      .then((value) => { if (!cancelled) setText(value); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "文件读取失败"); });
    return () => { cancelled = true; };
  }, [asset, isTextAsset]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (isTextAsset && !text) return;
    const frame = window.requestAnimationFrame(() => {
      const stored = presentation === "workspace"
        ? window.sessionStorage.getItem(scrollStorageKey(projectId, asset.path))
        : undefined;
      if (bodyRef.current) bodyRef.current.scrollTop = stored ? Number(stored) : 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [asset.path, isTextAsset, presentation, projectId, text]);

  useEffect(() => {
    if (presentation !== "dialog") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowLeft" && hasPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasNext, hasPrevious, onNext, onPrevious, presentation]);

  async function copyFullText() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

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
          {presentation === "workspace" && (
            <button className="preview-folder-back" type="button" onClick={onBack}>
              <ArrowLeft size={16} />返回文件夹
            </button>
          )}
          <div>
            <b title={asset.name}>{displayName}</b>
            {meta ? (
              <small className="preview-production-meta">
                {meta.episode !== undefined && <i>{episodeLabel(meta.episode)}</i>}
                {meta.shot && <i>{meta.shot}</i>}
                <i>{productionStageLabel(meta.stage)}</i>
                {meta.version && <i>{meta.version}</i>}
                {meta.pathMarker && <i title="路径命名标记，不代表已经完成实际验收">路径:{meta.pathMarker}</i>}
                <span className="preview-filename-sub" title={asset.path}>{asset.name}</span>
              </small>
            ) : (
              <span title={asset.path}>{asset.name}</span>
            )}
          </div>
        </div>
        <div className="preview-actions">
          {isTextAsset && text && (
            <button
              type="button"
              className={`preview-copy-button${copied ? " is-copied" : ""}`}
              onClick={() => void copyFullText()}
              title="复制整篇文档正文"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "已复制" : "复制全文"}
            </button>
          )}
          {(hasPrevious || hasNext) && (
            <span className="preview-sequence-actions">
              <button type="button" disabled={!hasPrevious} onClick={onPrevious} title="上一个同级内容（快捷键 ←）">
                <ChevronLeft size={15} />上一项
              </button>
              <button type="button" disabled={!hasNext} onClick={onNext} title="下一个同级内容（快捷键 →）">
                下一项<ChevronRight size={15} />
              </button>
            </span>
          )}
          <button type="button" onClick={reveal} title="在 Finder 中显示原文件">
            <ExternalLink size={14} />Finder
          </button>
          {presentation === "dialog" && (
            <button className="preview-close-icon" type="button" onClick={onBack} aria-label="关闭预览" title="关闭预览 (ESC)">
              <X size={17} />
            </button>
          )}
        </div>
      </header>

      <div
        ref={bodyRef}
        className="preview-body"
        onScroll={(event) => {
          if (presentation === "workspace") {
            window.sessionStorage.setItem(scrollStorageKey(projectId, asset.path), String(event.currentTarget.scrollTop));
          }
        }}
      >
        {asset.kind === "image" && <img src={asset.url} alt={asset.name} />}
        {asset.kind === "video" && <VideoPreview src={asset.url} name={asset.name} />}
        {asset.kind === "audio" && <AudioPreview src={asset.url} name={asset.name} />}
        {isTextAsset && !text && !error && <p className="preview-loading">正在读取文档…</p>}
        {isTextAsset && text && (
          <MarkdownPreview key={`${projectId}:${asset.path}`} source={text} projectId={projectId} assetPath={asset.path} onOpenMaterial={onOpenMaterial} />
        )}
        {asset.kind === "other" && !isTextAsset && (
          <div className="preview-empty"><FileQuestion size={32} strokeWidth={1.35} /><p>该文件暂不支持网页预览，请在 Finder 中查看。</p></div>
        )}
        {error && <p className="preview-error" role="alert">{error}</p>}
      </div>
    </aside>
  );
}
