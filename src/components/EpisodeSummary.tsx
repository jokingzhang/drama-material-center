import { AlertTriangle, CheckCircle2, CircleDashed, Film, Image, Music2, ScrollText } from "lucide-react";
import { episodeLabel, productionMetaFor, productionStageLabel, type ProductionStage } from "../lib/production";
import type { MaterialAsset } from "../types";

export type StageFilter = ProductionStage | "all";

interface EpisodeSummaryProps {
  episode: number;
  assets: MaterialAsset[];
  stage: StageFilter;
  onStageChange: (stage: StageFilter) => void;
}

const stageSequence: ProductionStage[] = ["story", "board", "keyframe", "prompt", "take", "audio", "final"];

export function EpisodeSummary({ episode, assets, stage, onStageChange }: EpisodeSummaryProps) {
  const stageCounts = new Map<ProductionStage, number>();
  const markerCounts = new Map<string, number>();
  assets.forEach((asset) => {
    const meta = productionMetaFor(asset);
    stageCounts.set(meta.stage, (stageCounts.get(meta.stage) ?? 0) + 1);
    if (meta.pathMarker) markerCounts.set(meta.pathMarker, (markerCounts.get(meta.pathMarker) ?? 0) + 1);
  });

  const images = assets.filter((asset) => asset.kind === "image").length;
  const videos = assets.filter((asset) => asset.kind === "video").length;
  const audio = assets.filter((asset) => asset.kind === "audio").length;
  const documents = assets.filter((asset) => asset.kind === "story").length;

  return (
    <section className="episode-summary" aria-label={`${episodeLabel(episode)} 生产概览`}>
      <div className="episode-summary-title">
        <div>
          <span>分集工作台</span>
          <strong>{episodeLabel(episode)}</strong>
        </div>
        <p>按现有路径和文件名只读聚合；路径标记不替代实际查看、播放与验收。</p>
      </div>

      <div className="episode-metrics" aria-label="素材类型统计">
        <span><ScrollText size={15} /><b>{documents}</b>文档</span>
        <span><Image size={15} /><b>{images}</b>图片</span>
        <span><Film size={15} /><b>{videos}</b>视频</span>
        <span><Music2 size={15} /><b>{audio}</b>音频</span>
      </div>

      <div className="production-chain" aria-label="生产环节筛选">
        <button type="button" className={stage === "all" ? "active" : ""} onClick={() => onStageChange("all")}>
          <CircleDashed size={15} />全部 <b>{assets.length}</b>
        </button>
        {stageSequence.map((item) => (
          <button
            type="button"
            className={stage === item ? "active" : ""}
            key={item}
            onClick={() => onStageChange(item)}
          >
            {productionStageLabel(item)} <b>{stageCounts.get(item) ?? 0}</b>
          </button>
        ))}
      </div>

      {(markerCounts.size > 0) && (
        <div className="path-marker-summary">
          <span><AlertTriangle size={14} />路径标记</span>
          {[...markerCounts.entries()].map(([marker, count]) => (
            <small key={marker} className={`marker-${marker.toLocaleLowerCase()}`}>
              {marker === "ACCEPTED" && <CheckCircle2 size={12} />}{marker} {count}
            </small>
          ))}
        </div>
      )}
    </section>
  );
}
