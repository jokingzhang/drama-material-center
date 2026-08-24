import { Pause, Play, RotateCcw, RotateCw, StepBack, StepForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MediaPreviewProps {
  src: string;
  name: string;
}

export function AudioPreview({ src, name }: MediaPreviewProps) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [waveformError, setWaveformError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let context: AudioContext | undefined;
    setPeaks([]);
    setWaveformError(false);

    fetch(src, { signal: controller.signal })
      .then((response) => response.ok ? response.arrayBuffer() : Promise.reject(new Error("waveform fetch failed")))
      .then(async (buffer) => {
        context = new AudioContext();
        const audio = await context.decodeAudioData(buffer.slice(0));
        const channel = audio.getChannelData(0);
        const bars = 96;
        const block = Math.max(1, Math.floor(channel.length / bars));
        const values = Array.from({ length: bars }, (_, index) => {
          let peak = 0;
          const end = Math.min(channel.length, (index + 1) * block);
          for (let cursor = index * block; cursor < end; cursor += 1) peak = Math.max(peak, Math.abs(channel[cursor]));
          return peak;
        });
        const maximum = Math.max(...values, 0.001);
        setPeaks(values.map((value) => Math.max(0.08, value / maximum)));
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setWaveformError(true);
      });

    return () => {
      controller.abort();
      void context?.close();
    };
  }, [src]);

  return (
    <section className="audio-preview" aria-label={`${name} 音频预览`}>
      <div className="audio-waveform" aria-hidden="true">
        {peaks.length > 0
          ? peaks.map((peak, index) => <i key={index} style={{ "--wave-peak": peak } as React.CSSProperties} />)
          : <span>{waveformError ? "波形暂不可用，仍可播放音频" : "正在分析真实音频波形…"}</span>}
      </div>
      <audio src={src} controls preload="metadata">你的浏览器无法播放这个音频。</audio>
      <p>波形仅用于快速定位响度变化；是否可用仍需实际试听。</p>
    </section>
  );
}

export function VideoPreview({ src, name }: MediaPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [duration, setDuration] = useState(0);
  const [dimensions, setDimensions] = useState("");

  function seek(delta: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + delta));
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play();
    else video.pause();
  }

  return (
    <section className="video-preview" aria-label={`${name} 视频预览`}>
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        loop={looping}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          setDimensions(`${event.currentTarget.videoWidth} × ${event.currentTarget.videoHeight}`);
        }}
      >
        你的浏览器无法播放这个视频。
      </video>
      <div className="video-inspection-bar" aria-label="视频审片工具">
        <button type="button" onClick={() => seek(-1)} title="后退 1 秒"><RotateCcw size={16} />-1s</button>
        <button type="button" onClick={() => seek(-1 / 24)} title="按 24fps 后退一帧"><StepBack size={16} />一帧</button>
        <button type="button" className="video-play-button" onClick={() => void togglePlayback()}>
          {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "暂停" : "播放"}
        </button>
        <button type="button" onClick={() => seek(1 / 24)} title="按 24fps 前进一帧">一帧<StepForward size={16} /></button>
        <button type="button" onClick={() => seek(1)} title="前进 1 秒">+1s<RotateCw size={16} /></button>
        <label>速度
          <select defaultValue="1" onChange={(event) => { if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value); }}>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </label>
        <button type="button" aria-pressed={looping} onClick={() => setLooping((value) => !value)}>循环 {looping ? "开" : "关"}</button>
        <span>{dimensions || "读取尺寸…"}{duration > 0 ? ` · ${duration.toFixed(1)}s` : ""}</span>
      </div>
      <p className="media-acceptance-note">生成完成不等于审片通过；请实际播放并检查动作、连贯性、畸变和首尾帧。</p>
    </section>
  );
}
