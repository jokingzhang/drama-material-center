import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Film, FolderOpen, Play } from "lucide-react";

interface LocalReferenceSource {
  url: string;
  filename: string;
}

interface ReferencePlayerContextValue {
  source: LocalReferenceSource | null;
  selectionError: string;
  selectFile: (file: File) => void;
}

const ReferencePlayerContext = createContext<ReferencePlayerContextValue | null>(null);

/** Keeps one local browser file available while navigating between the list and details. */
export function PracticeReferencePlayerProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<LocalReferenceSource | null>(null);
  const [selectionError, setSelectionError] = useState("");

  useEffect(() => {
    if (!source) return;
    return () => URL.revokeObjectURL(source.url);
  }, [source]);

  const selectFile = useCallback((file: File) => {
    if ((!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|ogv|ogg|avi|mkv)$/i.test(file.name)) || file.size === 0) {
      setSelectionError("请选择非空的视频文件，例如 MP4、MOV 或 WebM。当前已选文件仍保留。");
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      setSource({ url, filename: file.name });
      setSelectionError("");
    } catch {
      setSelectionError("浏览器无法打开这个本地文件，请重新选择。文件没有上传。");
    }
  }, []);

  return <ReferencePlayerContext.Provider value={{ source, selectionError, selectFile }}>{children}</ReferencePlayerContext.Provider>;
}

function clockLabel(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function PracticeReferencePlayer({ start = 0, end, label = "回看原片" }: { start?: number; end?: number; label?: string }) {
  const context = useContext(ReferencePlayerContext);
  if (!context) throw new Error("PracticeReferencePlayer must be rendered inside PracticeReferencePlayerProvider.");
  const { source, selectionError, selectFile } = context;
  const fileInputId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const segmentActive = useRef(false);
  const playbackRequest = useRef(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [mode, setMode] = useState<"segment" | "full">("full");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDuration(null);
    setPlaybackError("");
    setMediaError("");
    setMode("full");
    setMessage("");
    segmentActive.current = false;
    playbackRequest.current += 1;
  }, [source?.url]);

  useEffect(() => {
    segmentActive.current = false;
    setMode("full");
    setMessage("");
    setPlaybackError("");
    playbackRequest.current += 1;
    videoRef.current?.pause();
  }, [start, end]);

  useEffect(() => () => { playbackRequest.current += 1; }, []);

  const validRange = Number.isFinite(start) && start >= 0 && (end === undefined || (Number.isFinite(end) && end > start));
  let rangeError = "";
  if (!validRange) {
    rangeError = "本项片段时间范围无效，可使用全片模式观看。";
  } else if (duration !== null && (start >= duration || (end !== undefined && end > duration + 0.05))) {
    rangeError = `当前文件时长 ${clockLabel(duration)}，不足以覆盖 ${clockLabel(start)}${end === undefined ? "之后" : `–${clockLabel(end)}`}。请确认选择的是完整原片；仍可使用全片模式观看当前文件。`;
  }

  async function replaySegment() {
    const video = videoRef.current;
    if (!video || duration === null || rangeError || mediaError) return;
    const requestId = ++playbackRequest.current;
    setPlaybackError("");
    setMessage("");
    segmentActive.current = true;
    setMode("segment");
    try {
      video.currentTime = start;
      await video.play();
      if (requestId !== playbackRequest.current) return;
      setMessage(end === undefined ? `从 ${clockLabel(start)} 开始回看。` : `正在回看 ${clockLabel(start)}–${clockLabel(end)}，到片段末尾自动暂停。`);
    } catch (reason) {
      if (requestId !== playbackRequest.current) return;
      const blocked = reason instanceof DOMException && reason.name === "NotAllowedError";
      setPlaybackError(blocked ? "浏览器拦截了自动播放，请点击视频自身的播放按钮。片段定位与结束暂停仍有效。" : "片段播放未成功，请点击视频自身的播放按钮重试；若仍无法播放，请重新选择兼容的视频文件。");
    }
  }

  function switchToFull() {
    playbackRequest.current += 1;
    segmentActive.current = false;
    setMode("full");
    setPlaybackError("");
    setMessage("全片模式：可拖动进度条自由观看，不会在专项片段末尾暂停。");
  }

  function stopAtSegmentEnd() {
    const video = videoRef.current;
    if (!video || !segmentActive.current || end === undefined || video.currentTime < end) return;
    video.pause();
    if (Math.abs(video.currentTime - end) > 0.02) video.currentTime = end;
    setMessage(`已到 ${clockLabel(end)}，片段回看暂停。可以再次回看，或切换全片模式继续。`);
  }

  return <section className="practice-reference-player" aria-label={label}>
    <header className="practice-reference-player-header">
      <div><h3><Film size={18} />{label}</h3><p>{validRange ? `${clockLabel(start)}${end === undefined ? " 起" : `–${clockLabel(end)}`}` : "全片回看"} · 本地原片对照</p></div>
      <label className="secondary-button practice-reference-file-picker" htmlFor={fileInputId}><FolderOpen size={16} />{source ? "更换本地原片" : "选择本地原片"}<input id={fileInputId} type="file" accept="video/*,.mp4,.mov,.m4v,.webm" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) selectFile(file);
        event.currentTarget.value = "";
      }} /></label>
    </header>
    <p className="practice-reference-player-meta">{source ? `已选择：${source.filename}` : "选择已经保存在电脑上的完整原片，即可按本项时间段回看。"} 文件只在当前浏览器打开，不上传；页面间切换可复用，刷新后需重新选择。</p>

    {source && <video
      key={source.url}
      ref={videoRef}
      className="practice-reference-video"
      src={source.url}
      controls
      preload="metadata"
      playsInline
      aria-label={`${label}：${source.filename}`}
      onLoadedMetadata={(event) => {
        const length = event.currentTarget.duration;
        if (Number.isFinite(length) && length > 0) {
          setDuration(length);
          setMediaError("");
        } else {
          setDuration(null);
          setMediaError("未能读到有效视频时长，暂时无法定位片段。请确认文件完整并使用浏览器支持的格式。");
        }
      }}
      onTimeUpdate={stopAtSegmentEnd}
      onError={() => {
        playbackRequest.current += 1;
        setDuration(null);
        setMediaError("当前视频无法解码或读取，请重新选择完整且浏览器支持的原片。未上传文件，也未修改原文件。");
      }}
    />}

    <div className="practice-reference-player-controls">
      <button className="primary-button" type="button" disabled={!source || duration === null || Boolean(rangeError || mediaError)} onClick={() => void replaySegment()}><Play size={15} />回看片段</button>
      <button className="secondary-button" type="button" disabled={!source} aria-pressed={mode === "full"} onClick={switchToFull}>全片模式</button>
      {source && <span className="practice-reference-player-meta">{duration === null ? "等待视频元数据" : `原片 ${clockLabel(duration)}`} · {mode === "segment" ? "片段模式" : "全片模式"}</span>}
    </div>
    {[selectionError, mediaError, rangeError, playbackError].filter(Boolean).map((error) => <p className="practice-reference-player-message is-error" role="alert" key={error}>{error}</p>)}
    {message && <p className="practice-reference-player-message" role="status">{message}</p>}
  </section>;
}
