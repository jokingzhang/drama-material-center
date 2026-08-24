import { ExternalLink, FileQuestion, PanelLeftClose, PanelLeftOpen, PanelRightClose } from "lucide-react";
import { useEffect, useState } from "react";
import { revealMaterial } from "../lib/materials";
import type { MaterialAsset } from "../types";
import { MarkdownPreview } from "./MarkdownPreview";

interface PreviewPaneProps {
  projectId: string;
  asset?: MaterialAsset;
  expanded: boolean;
  onToggleExpanded: () => void;
  onCollapse: () => void;
}

export function PreviewPane({ projectId, asset, expanded, onToggleExpanded, onCollapse }: PreviewPaneProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setText("");
    setError("");
    if (!asset?.mimeType.startsWith("text/")) return () => { cancelled = true; };

    fetch(asset.url, { cache: "no-store" })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error("文件读取失败")))
      .then((value) => { if (!cancelled) setText(value); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "文件读取失败"); });
    return () => { cancelled = true; };
  }, [asset]);

  async function reveal() {
    if (!asset) return;
    try {
      await revealMaterial(projectId, asset.path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法打开 Finder");
    }
  }

  return (
    <aside className="preview-pane" aria-label="文件预览">
      <header>
        <div className="preview-heading">
          <button
            className="directory-panel-toggle"
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? "展开文件目录" : "收起文件目录"}
            title={expanded ? "展开文件目录" : "收起文件目录"}
          >
            {expanded ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
          </button>
          <div><b>文件预览</b>{asset && <span title={asset.name}>{asset.name}</span>}</div>
        </div>
        <div className="preview-actions">
          <button type="button" onClick={onCollapse}><PanelRightClose size={14} />收起预览</button>
          {asset && <button type="button" onClick={reveal}>在 Finder 中查看 <ExternalLink size={14} /></button>}
        </div>
      </header>

      <div className="preview-body">
        {!asset && <div className="preview-empty"><FileQuestion size={32} strokeWidth={1.35} /><p>选择一个文件即可预览</p></div>}
        {asset?.mimeType.startsWith("image/") && <img src={asset.url} alt={asset.name} />}
        {asset?.mimeType.startsWith("video/") && <video src={asset.url} controls preload="metadata">你的浏览器无法播放这个视频。</video>}
        {asset?.mimeType.startsWith("text/") && !text && !error && <p className="preview-loading">正在读取文档…</p>}
        {asset?.mimeType.startsWith("text/") && text && <MarkdownPreview source={text} projectId={projectId} assetPath={asset.path} />}
        {asset && !asset.mimeType.startsWith("text/") && !asset.mimeType.startsWith("image/") && !asset.mimeType.startsWith("video/") && (
          <div className="preview-empty"><FileQuestion size={32} strokeWidth={1.35} /><p>该文件暂不支持网页预览，请在 Finder 中查看。</p></div>
        )}
        {error && <p className="preview-error">{error}</p>}
      </div>
    </aside>
  );
}
