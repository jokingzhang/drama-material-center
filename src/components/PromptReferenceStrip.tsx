import { ChevronDown, ChevronUp, FileQuestion, Film, ImageIcon, ImageOff, Volume2 } from "lucide-react";
import { useId, useState } from "react";
import type { PromptReferencePreview } from "../types/story";
import "./ReferenceMedia.css";

export type PromptReference = PromptReferencePreview["references"][number];

export function promptReferenceKindLabel(reference: PromptReference) {
  if (reference.kind === "image") return "图片";
  if (reference.kind === "audio") return "声音";
  if (reference.kind === "video") return "视频";
  return "素材";
}

export function isPlayablePromptReference(reference: PromptReference) {
  return reference.resolution === "RESOLVED" && Boolean(reference.url)
    && (reference.kind === "image" || reference.kind === "audio");
}

export function promptReferenceStatusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    ACCEPTED: "已验收",
    DRAFT: "草稿",
    INTERNAL: "内部参考",
    GEN_INPUT: "生成输入",
    REJECTED: "已拒绝",
    SUPERSEDED: "历史版本",
    BLOCKED: "不可用",
    UNREGISTERED: "未登记",
    HUMAN_ACCEPTANCE_PENDING: "待人工验收",
  };
  return status ? labels[status] ?? status : "未登记状态";
}

function unavailableLabel(reference: PromptReference) {
  const labels: Record<string, string> = {
    UNREGISTERED: "未正式登记",
    MISSING_FILE: "文件缺失",
    VERSION_MISMATCH: "版本不一致",
    UNSUPPORTED: "暂不支持预览",
    CONFLICT: "引用冲突",
  };
  return labels[reference.resolution] ?? "暂不可预览";
}

function ReferenceCard({ reference, onOpen }: {
  reference: PromptReference;
  onOpen: (reference: PromptReference, trigger: HTMLElement) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const available = isPlayablePromptReference(reference);
  const kind = promptReferenceKindLabel(reference);
  const label = reference.label || reference.reference;
  const duration = typeof reference.durationSeconds === "number" && Number.isFinite(reference.durationSeconds)
    ? `${reference.durationSeconds.toFixed(1)} 秒`
    : undefined;

  return (
    <li className={`prompt-reference-item${available ? "" : " is-unavailable"}`}>
      <button
        type="button"
        className="prompt-reference-card"
        disabled={!available}
        title={available ? `${label} · ${reference.version ?? "未标版本"}` : reference.reason ?? unavailableLabel(reference)}
        aria-label={available ? `${reference.kind === "audio" ? "试听" : "查看"}${kind} ${reference.reference}：${label}` : `${reference.reference}：${label}，${reference.reason ?? unavailableLabel(reference)}`}
        onClick={(event) => onOpen(reference, event.currentTarget)}
      >
        <span className="prompt-reference-visual" aria-hidden="true">
          {available && reference.kind === "image" && !imageFailed
            ? <img src={reference.url} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
            : reference.kind === "audio"
              ? <Volume2 size={27} />
              : reference.kind === "video"
                ? <Film size={27} />
                : reference.kind === "image"
                  ? <ImageOff size={27} />
                  : <FileQuestion size={27} />}
          <span className="prompt-reference-number">{reference.reference}</span>
        </span>
        <span className="prompt-reference-card-copy">
          <strong title={label}>{label}</strong>
          <small>{available ? `${kind}${duration ? ` · ${duration}` : ""}` : unavailableLabel(reference)}</small>
        </span>
      </button>
      {!available && reference.reason && <span className="prompt-reference-unavailable-reason">{reference.reason}</span>}
    </li>
  );
}

export function PromptReferenceStrip({ references, onOpen }: {
  references: PromptReference[];
  onOpen: (reference: PromptReference, trigger: HTMLElement) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const contentId = useId();
  const visibleReferences = showAll ? references : references.slice(0, 6);

  if (!references.length) return null;

  return (
    <section className="prompt-reference-strip" aria-label="提示词引用素材">
      <header className="prompt-reference-strip-heading">
        <button type="button" aria-expanded={!collapsed} aria-controls={contentId} onClick={() => setCollapsed((value) => !value)}>
          <ImageIcon size={16} aria-hidden="true" />
          <strong>引用素材 <span>{references.length} 项</span></strong>
          {collapsed ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
          <span className="sr-only">{collapsed ? "展开引用素材栏" : "收起引用素材栏"}</span>
        </button>
        <span className="prompt-reference-strip-hint">点击看图或试听</span>
      </header>
      <div id={contentId} hidden={collapsed}>
        <ul className="prompt-reference-grid">
          {visibleReferences.map((reference, index) => (
            <ReferenceCard key={`${reference.reference}-${reference.assetId ?? reference.url ?? index}`} reference={reference} onOpen={onOpen} />
          ))}
        </ul>
        {references.length > 6 && (
          <button className="prompt-reference-show-all" type="button" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
            {showAll ? "收起多余素材" : `展开全部 ${references.length} 项`}
            {showAll ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
          </button>
        )}
      </div>
    </section>
  );
}
