import { ImageOff, Maximize2, Minimize2, Play, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isPlayablePromptReference, promptReferenceKindLabel, promptReferenceStatusLabel, type PromptReference } from "./PromptReferenceStrip";
import "./ReferenceMedia.css";

interface ReferenceMediaDialogProps {
  reference: PromptReference;
  trigger?: HTMLElement | null;
  autoPlay?: boolean;
  onClose: () => void;
}

function outsideDialog(dialog: HTMLDialogElement, x: number, y: number) {
  const bounds = dialog.getBoundingClientRect();
  return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
}

function pauseOtherMedia(active: HTMLMediaElement) {
  document.querySelectorAll<HTMLMediaElement>("audio, video").forEach((media) => {
    if (media !== active && !media.paused) media.pause();
  });
}

export function ReferenceMediaDialog({ reference, trigger, autoPlay = false, onClose }: ReferenceMediaDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pointerStartedOutside = useRef(false);
  const audioRequest = useRef(0);
  const [originalSize, setOriginalSize] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [dimensions, setDimensions] = useState("");
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const available = isPlayablePromptReference(reference);
  const name = reference.label || reference.reference;
  const status = reference.assetStatus ?? "";
  const caution = /^(?:REJECTED|SUPERSEDED|BLOCKED)/.test(status);

  useEffect(() => {
    const dialog = dialogRef.current;
    const focused = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    if (dialog && !dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    };
  }, [trigger]);

  const loadAndPlayAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || reference.kind !== "audio" || !reference.url || !isPlayablePromptReference(reference)) return;
    const request = ++audioRequest.current;
    if (audio.getAttribute("src") !== reference.url) audio.src = reference.url;
    setAudioLoaded(true);
    setAudioError("");
    pauseOtherMedia(audio);
    try {
      await audio.play();
    } catch {
      if (audioRef.current === audio && request === audioRequest.current) {
        setAudioError("暂未开始播放，请点击播放器的播放按钮。");
      }
    }
  }, [reference.kind, reference.resolution, reference.url]);

  useEffect(() => {
    setOriginalSize(false);
    setImageFailed(false);
    setDimensions("");
    setAudioLoaded(false);
    setAudioError("");
    if (autoPlay && reference.kind === "audio" && available) void loadAndPlayAudio();
    const audio = audioRef.current;
    return () => {
      audioRequest.current += 1;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, [autoPlay, available, loadAndPlayAudio, reference.kind, reference.url]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`reference-media-dialog${reference.kind === "audio" ? " reference-media-dialog-audio" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onPointerDown={(event) => {
        pointerStartedOutside.current = event.target === event.currentTarget && outsideDialog(event.currentTarget, event.clientX, event.clientY);
      }}
      onPointerCancel={() => { pointerStartedOutside.current = false; }}
      onClick={(event) => {
        const shouldClose = pointerStartedOutside.current && event.target === event.currentTarget && outsideDialog(event.currentTarget, event.clientX, event.clientY);
        pointerStartedOutside.current = false;
        if (shouldClose) onClose();
      }}
    >
      <div className="reference-media-content">
        <header className="reference-media-header">
          <div className="reference-media-heading">
            <span className="reference-media-kind">{[reference.reference, promptReferenceKindLabel(reference)].filter(Boolean).join(" · ")}</span>
            <h2 id={titleId}>{name}</h2>
            <p id={descriptionId} className="reference-media-meta">
              {reference.version && <span>{reference.version}</span>}
              {reference.assetStatus && <span className={caution ? "reference-media-status is-caution" : "reference-media-status"}>{promptReferenceStatusLabel(reference.assetStatus)}</span>}
              {dimensions && <span>{dimensions}</span>}
            </p>
          </div>
          <button ref={closeRef} className="reference-media-close" type="button" onClick={onClose} aria-label="关闭素材预览">
            <X size={18} aria-hidden="true" />关闭
          </button>
        </header>

        {reference.responsibility && <p className="reference-media-responsibility">{reference.responsibility}</p>}

        {!available
          ? <p className="reference-media-error" role="status">{reference.reason ?? "此引用暂不可预览。"}</p>
          : reference.kind === "image"
            ? <>
              <div className="reference-media-image-tools">
                <span>{originalSize ? "原始尺寸 · 可滚动查看细节" : "完整显示参考图"}</span>
                <button type="button" disabled={imageFailed} onClick={() => setOriginalSize((value) => !value)} aria-pressed={originalSize}>
                  {originalSize ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
                  {originalSize ? "适应窗口" : "原始尺寸"}
                </button>
              </div>
              <div className={`reference-media-image-viewport${originalSize ? " is-original-size" : ""}`} tabIndex={originalSize ? 0 : undefined} role={originalSize ? "region" : undefined} aria-label={originalSize ? "原始尺寸图片，可滚动查看" : undefined}>
                {imageFailed
                  ? <p className="reference-media-image-error" role="alert"><ImageOff size={32} aria-hidden="true" />图片未能加载，请关闭后重试。</p>
                  : <img src={reference.url} alt={name} onError={() => setImageFailed(true)} onLoad={(event) => setDimensions(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)} />}
              </div>
            </>
            : <section className="reference-media-audio" aria-label={`${name} 音频试听`}>
              <div className="reference-media-audio-symbol" aria-hidden="true"><Volume2 size={34} /></div>
              {!audioLoaded && <button className="reference-media-load-audio" type="button" onClick={() => void loadAndPlayAudio()}><Play size={18} aria-hidden="true" />播放音频</button>}
              <audio
                ref={audioRef}
                controls
                preload="none"
                aria-label={`${name} 播放器`}
                onPlay={(event) => { pauseOtherMedia(event.currentTarget); setAudioError(""); }}
                onError={() => { if (audioRef.current?.getAttribute("src")) setAudioError("音频未能加载，请关闭后重试。"); }}
              >你的浏览器无法播放此音频。</audio>
              {audioError && <p className="reference-media-error" role="status">{audioError}</p>}
              <p className="reference-media-audio-note">试听不会改变素材的验收状态。</p>
            </section>}
      </div>
    </dialog>,
    document.body,
  );
}
