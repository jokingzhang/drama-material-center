import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BookOpenText,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clapperboard,
  FileCheck2,
  Film,
  FolderOpen,
  Images,
  MapPin,
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import {
  StoryAssetGallery,
  StoryAssetModal,
  StoryScriptBanner,
  type StoryAssetOpenHandler,
} from "../components/StoryAssetGallery";
import { StoryCommandPalette } from "../components/StoryCommandPalette";
import { ThemeToggle } from "../components/ThemeToggle";
import { getProjects } from "../lib/materials";
import {
  compactScheduleDate,
  currentSchedulePhase,
  dateKeyInTimeZone,
  scheduleDateRange,
  schedulePhaseState,
  scheduleTodayLabel,
} from "../lib/productionSchedule";
import { getProjectStory, storyAssetLibraryPath } from "../lib/projectStory";
import { collectSceneDedicatedAssets, deduplicateCurrentStoryAssets as deduplicateAssets } from "../lib/storyAssets";
import {
  updateSpotlightPosition,
  useEpisodeScrollSpy,
  useScrollProgressBar,
  useScrollReveal,
} from "../lib/studioMotion";
import {
  projectCharacterPath,
  projectEpisodePath,
  projectLibraryPath,
  projectLocationPath,
  projectScenePath,
  projectStoryOverviewPath,
  projectStorySectionPath,
  type ProjectStorySection,
} from "../lib/routes";
import type { ProjectSummary } from "../types";
import type {
  CharacterReadModel,
  EpisodeDetailReadModel,
  EpisodeProductionStage,
  EpisodeSummaryReadModel,
  LocationReadModel,
  ProductionScheduleReadModel,
  ProjectStoryReadModel,
  SceneReadModel,
  StoryAssetLink,
  StoryCompletion,
  StoryObjectStatus,
  StoryRequirementResult,
} from "../types/story";

const statusCopy: Record<StoryObjectStatus, string> = {
  READY: "已齐套",
  IN_PROGRESS: "制作中",
  MISSING: "缺失",
  BLOCKED: "已阻塞",
  NOT_DUE: "未到期",
};

const lookKindCopy = {
  primary: "主造型",
  alternate: "备选造型",
  "story-required": "剧情必需造型",
} as const;

const productionStageCopy: Record<EpisodeProductionStage, string> = {
  NOT_STARTED: "未开始",
  SCRIPT_READY: "剧本就绪",
  STORYBOARD_DRAFT: "分镜草稿",
  AWAITING_PRODUCTION: "待生产",
  PREPRODUCTION: "前期制作",
  SHOT_PRODUCTION: "正式镜头",
  FINAL_REVIEW: "成片待验收",
  COMPLETED: "已完成",
};

const storySections: Array<{ id: ProjectStorySection; label: string }> = [
  { id: "overview", label: "故事大概" },
  { id: "characters", label: "人物设定" },
  { id: "locations", label: "场景设定" },
  { id: "episodes", label: "分集视角" },
];

type EpisodeStageFilter = "all" | "active" | "completed" | "not-started";

function StatusBadge({ status, detail }: { status: StoryObjectStatus; detail?: string }) {
  const icon = status === "READY"
    ? <CheckCircle2 size={13} />
    : status === "BLOCKED"
      ? <AlertTriangle size={13} />
      : <CircleDashed size={13} />;
  return <span className={`story-status status-${status.toLowerCase().replace("_", "-")}`} title={detail}>{icon}{statusCopy[status]}</span>;
}

function CompletionLine({ completion }: { completion: StoryCompletion }) {
  if (completion.status === "NOT_DUE") return <span className="completion-line">当前里程碑无必需项</span>;
  return (
    <span className="completion-line">
      <StatusBadge status={completion.status} />
      <span>{completion.ready}/{completion.required} 项就绪</span>
      {completion.missing > 0 && <span>{completion.missing} 项缺失</span>}
      {completion.blocked > 0 && <span>{completion.blocked} 项阻塞</span>}
    </span>
  );
}

function AssetImage({ asset, alt }: { asset?: StoryAssetLink; alt: string }) {
  if (asset?.kind === "image" && asset.url) return <img src={asset.url} alt={alt} loading="lazy" decoding="async" />;
  return <span className="story-image-placeholder"><Images size={26} /><span>暂无图片</span></span>;
}

function MaterialSection({
  projectId,
  eyebrow,
  title,
  description,
  assets,
  labels,
  onOpen,
  headingLevel = "h2",
  showEmpty = false,
  emptyCopy,
  aspect = "auto",
  compact = false,
}: {
  projectId: string;
  eyebrow?: string;
  title: string;
  description?: string;
  assets: StoryAssetLink[];
  labels?: Record<string, string>;
  onOpen: StoryAssetOpenHandler;
  headingLevel?: "h2" | "h3" | "h4";
  showEmpty?: boolean;
  emptyCopy?: string;
  aspect?: "auto" | "portrait" | "landscape" | "contain";
  compact?: boolean;
}) {
  if (!assets.length && !showEmpty) return null;
  const Heading = headingLevel;
  return (
    <section className={`story-material-section${compact ? " is-compact" : ""}`}>
      <header>
        <div>
          {eyebrow && <span className="story-eyebrow">{eyebrow}</span>}
          <Heading>{title}</Heading>
          {description && <p>{description}</p>}
        </div>
        <span className="story-count-pill">{assets.length} 项</span>
      </header>
      <StoryAssetGallery
        projectId={projectId}
        assets={assets}
        labels={labels}
        onOpen={onOpen}
        showEmpty={showEmpty}
        emptyCopy={emptyCopy}
        aspect={aspect}
      />
    </section>
  );
}

function useCurrentDateKey(timeZone: string) {
  const [today, setToday] = useState(() => dateKeyInTimeZone(new Date(), timeZone));
  useEffect(() => {
    const refreshToday = () => setToday(dateKeyInTimeZone(new Date(), timeZone));
    refreshToday();
    const timer = window.setInterval(refreshToday, 60_000);
    return () => window.clearInterval(timer);
  }, [timeZone]);
  return today;
}

function ProductionSchedulePanel({ schedule, today }: { schedule: ProductionScheduleReadModel; today: string }) {
  const firstPhase = schedule.phases[0];
  const lastPhase = schedule.phases.at(-1);
  const fullRange = firstPhase && lastPhase
    ? `${compactScheduleDate(firstPhase.startDate)}–${compactScheduleDate(lastPhase.endDate)}`
    : undefined;

  return (
    <details className="story-production-schedule">
      <summary className="story-schedule-summary">
        <div className="story-schedule-heading">
          <span><CalendarDays size={16} /></span>
          <div><h2 id="story-schedule-title">排期计划</h2><p>{schedule.title}</p></div>
        </div>
        <span className="story-schedule-action">
          {fullRange && <b>{fullRange}</b>}
          <span>查看总计划</span>
          <ChevronRight size={15} />
        </span>
      </summary>
      <section className="story-schedule-timeline" aria-labelledby="story-total-plan-title">
        <header><h3 id="story-total-plan-title">总计划</h3><span>点击上方排期计划可收起</span></header>
        <ol>{schedule.phases.map((phase) => {
          const state = schedulePhaseState(phase, today);
          return (
            <li className={`schedule-phase-${state}`} key={phase.id}>
              <div className="story-schedule-phase-date">
                <b>{scheduleDateRange(phase)}</b>
                <span>{state === "current" ? "今日所在" : state === "past" ? "已过" : "待执行"}</span>
              </div>
              <div className="story-schedule-phase-copy">
                <strong>{phase.title}</strong>
                <ul>{phase.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </li>
          );
        })}</ol>
      </section>
    </details>
  );
}

function TodayOrFocusCard({
  story,
  schedule,
  today,
}: {
  story: ProjectStoryReadModel;
  schedule?: ProductionScheduleReadModel;
  today: string;
}) {
  const phase = schedule ? currentSchedulePhase(schedule.phases, today) : undefined;
  const focusEpisodes = useMemo(() => {
    const inProgress = story.production.episodes.filter(
      (episode) => episode.stage !== "COMPLETED" && episode.stage !== "NOT_STARTED",
    );
    const notStarted = story.production.episodes.filter((episode) => episode.stage === "NOT_STARTED");
    const picked = [...inProgress, ...notStarted].slice(0, 4);
    return picked.length ? picked : story.production.episodes.slice(-3).reverse();
  }, [story.production.episodes]);

  if (phase) {
    return (
      <section className="story-today-summary" aria-labelledby="story-today-plan-title">
        <header>
          <h2 id="story-today-plan-title">今日计划</h2>
          <time dateTime={today}><span>今天</span><b>{scheduleTodayLabel(today)}</b></time>
        </header>
        <div className="story-today-plan-content">
          <span>{scheduleDateRange(phase)}</span>
          <strong>{phase.title}</strong>
          <ul>{phase.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>
    );
  }

  return (
    <section className="story-today-summary" aria-labelledby="story-today-plan-title">
      <header>
        <h2 id="story-today-plan-title">当前推进焦点</h2>
        <time dateTime={today}><b>{scheduleTodayLabel(today)}</b></time>
      </header>
      <div className="story-focus-list">
        {focusEpisodes.map((episode) => (
          <Link
            key={episode.id}
            className="story-focus-row"
            to={projectEpisodePath(story.project.id, episode.id)}
          >
            <span className={`stage-dot stage-${episode.stage.toLowerCase().replaceAll("_", "-")}`} />
            <b>{episode.id}</b>
            <span className="story-focus-title">{episode.title}</span>
            <small>{productionStageCopy[episode.stage]}</small>
            <ArrowUpRight size={13} className="story-focus-arrow" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProgressRing({ percentage, animated }: { percentage: number; animated: boolean }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const displayRatio = animated ? clamped : 0;
  const offset = circumference - (displayRatio / 100) * circumference;

  return (
    <div
      className="story-progress-ring-svg"
      role="progressbar"
      aria-label="全剧完成进度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <svg viewBox="0 0 104 104" aria-hidden="true">
        <circle className="ring-track" cx="52" cy="52" r={radius} />
        <circle
          className="ring-fill"
          cx="52"
          cy="52"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span><b>{clamped}%</b></span>
    </div>
  );
}

function ProductionDashboard({ story }: { story: ProjectStoryReadModel }) {
  const { production } = story;
  const today = useCurrentDateKey(story.productionSchedule?.timezone ?? "Asia/Shanghai");
  const [stageFilter, setStageFilter] = useState<EpisodeStageFilter>("all");
  const [chartsAnimated, setChartsAnimated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setChartsAnimated(true));
    return () => window.cancelAnimationFrame(frame);
  }, [story.project.id]);
  const humanPlaybackCount = production.episodes.filter((episode) => episode.completionEvidence?.kind === "human-playback").length;
  const userConfirmationCount = production.episodes.filter((episode) => episode.completionEvidence?.kind === "user-confirmation").length;

  const activeCount = production.episodes.filter(
    (episode) => episode.stage !== "COMPLETED" && episode.stage !== "NOT_STARTED",
  ).length;
  const completedCount = production.episodes.filter((episode) => episode.stage === "COMPLETED").length;
  const notStartedCount = production.episodes.filter((episode) => episode.stage === "NOT_STARTED").length;

  const filteredEpisodes = useMemo(() => {
    if (stageFilter === "active") {
      return production.episodes.filter((episode) => episode.stage !== "COMPLETED" && episode.stage !== "NOT_STARTED");
    }
    if (stageFilter === "completed") {
      return production.episodes.filter((episode) => episode.stage === "COMPLETED");
    }
    if (stageFilter === "not-started") {
      return production.episodes.filter((episode) => episode.stage === "NOT_STARTED");
    }
    return production.episodes;
  }, [production.episodes, stageFilter]);

  const pipeline = [
    { key: "script", label: "剧本定稿", value: production.pipeline.scriptReady, icon: <FileCheck2 size={15} /> },
    { key: "storyboard", label: "分镜准备", value: production.pipeline.storyboardReady, icon: <BookOpenText size={15} /> },
    { key: "shots", label: "正式镜头", value: production.pipeline.shotProduced, icon: <Film size={15} /> },
    { key: "final", label: "成片验收", value: production.pipeline.finalAccepted, icon: <Clapperboard size={15} /> },
  ];

  return (
    <section className="story-command-center" aria-labelledby="story-production-title">
      <header className="story-command-header">
        <div>
          <div className="story-command-title-row">
            <h1 id="story-production-title">全剧制作总览</h1>
            {story.story.aspectRatio && (
              <span className="story-format-badge">
                <b>{story.story.aspectRatio}</b>
                <small>{story.story.aspectRatio === "16:9" ? "横屏" : "竖屏"}</small>
              </span>
            )}
          </div>
          <div className="story-meta-row">
            {story.story.genre.map((genre) => <span key={genre}>{genre}</span>)}
            <span>共 {story.story.totalEpisodes} 集</span>
            {story.story.productionScope && <span className="story-scope-inline">{story.story.productionScope}</span>}
          </div>
        </div>
      </header>

      {story.productionSchedule && <ProductionSchedulePanel schedule={story.productionSchedule} today={today} />}

      <div className="story-production-grid">
        <section className="story-overall-progress spotlight-card" onPointerMove={updateSpotlightPosition}>
          <h2>全剧完成进度</h2>
          <ProgressRing percentage={production.percentage} animated={chartsAnimated} />
          <strong>{production.completedEpisodes} / {production.totalEpisodes} 集已完成</strong>
          <p>{humanPlaybackCount > 0 || userConfirmationCount > 0
            ? `${humanPlaybackCount} 集成片人审 · ${userConfirmationCount} 集用户确认`
            : "以成片人审或用户确认完成为准"}</p>
        </section>

        <section className="story-pipeline-chart spotlight-card" aria-label="全剧生产流程" onPointerMove={updateSpotlightPosition}>
          <h2>生产流程 <small>{production.totalEpisodes} 集</small></h2>
          <div>{pipeline.map((stage) => {
            const percentage = production.totalEpisodes > 0 ? (stage.value / production.totalEpisodes) * 100 : 0;
            return (
              <span className="story-pipeline-row" key={stage.key}>
                <i>{stage.icon}</i>
                <b>{stage.label}</b>
                <span className="story-pipeline-track"><span style={{ width: `${chartsAnimated ? percentage : 0}%` }} /></span>
                <strong>{stage.value}/{production.totalEpisodes}</strong>
              </span>
            );
          })}</div>
        </section>

        <TodayOrFocusCard story={story} schedule={story.productionSchedule} today={today} />
      </div>

      <section className="story-episode-stage-board" aria-label={`${production.totalEpisodes} 集生产阶段总览`}>
        <div className="story-stage-board-head">
          <h2>{production.totalEpisodes} 集生产阶段总览</h2>
          <div className="story-stage-filters" role="group" aria-label="按阶段筛选集数">
            <button type="button" className={stageFilter === "all" ? "active" : ""} onClick={() => setStageFilter("all")}>
              全部 <b>{production.episodes.length}</b>
            </button>
            <button type="button" className={stageFilter === "active" ? "active" : ""} onClick={() => setStageFilter("active")}>
              进行中 <b>{activeCount}</b>
            </button>
            <button type="button" className={stageFilter === "completed" ? "active" : ""} onClick={() => setStageFilter("completed")}>
              已完成 <b>{completedCount}</b>
            </button>
            {notStartedCount > 0 && (
              <button type="button" className={stageFilter === "not-started" ? "active" : ""} onClick={() => setStageFilter("not-started")}>
                未开始 <b>{notStartedCount}</b>
              </button>
            )}
          </div>
        </div>
        <div className="story-episode-stage-grid">
          {filteredEpisodes.map((episode) => {
            const evidenceLabel = episode.completionEvidence?.kind === "human-playback"
              ? "成片人审通过"
              : episode.completionEvidence?.kind === "user-confirmation"
                ? "用户确认完成"
                : undefined;
            const detail = [episode.id, episode.title, productionStageCopy[episode.stage], evidenceLabel, episode.completionEvidence?.note]
              .filter(Boolean)
              .join(" · ");
            return (
              <Link
                className={`episode-stage-cell stage-${episode.stage.toLowerCase().replaceAll("_", "-")}${episode.current ? " current" : ""}`}
                key={episode.id}
                to={projectEpisodePath(story.project.id, episode.id)}
                title={detail}
              >
                <span className="episode-stage-top">
                  <i className="stage-dot" />
                  <b>{episode.id}</b>
                </span>
                <span>{productionStageCopy[episode.stage]}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function CompactProductionStrip({ story }: { story: ProjectStoryReadModel }) {
  const { production } = story;
  return (
    <div className="story-compact-strip">
      <div className="story-compact-strip-left">
        {story.story.aspectRatio && (
          <span className="story-format-chip">
            {story.story.aspectRatio} {story.story.aspectRatio === "16:9" ? "横屏" : "竖屏"}
          </span>
        )}
        <span className="story-compact-progress">
          全剧进度 <b>{production.completedEpisodes}/{production.totalEpisodes}</b> 集（{production.percentage}%）
        </span>
      </div>
      <Link className="story-compact-overview-link" to={projectStorySectionPath(story.project.id, "overview")}>
        查看制作总览<ChevronRight size={14} />
      </Link>
    </div>
  );
}

function StoryHeader({
  story,
  projects,
  projectId,
  progressBarRef,
  onOpenPalette,
}: {
  story?: ProjectStoryReadModel;
  projects: ProjectSummary[];
  projectId: string;
  progressBarRef?: RefObject<HTMLDivElement | null>;
  onOpenPalette: () => void;
}) {
  const navigate = useNavigate();
  return (
    <header className="studio-topbar">
      <div className="studio-topbar-left">
        <Link className="studio-icon-button" to="/" title="返回所有短剧项目" aria-label="返回所有短剧项目">
          <ArrowLeft size={16} />
        </Link>

        <div className="studio-project-picker">
          <BrandMark />
          {projects.length > 0 && projectId ? (
            <select
              name="story-project-switcher"
              className="studio-project-select"
              aria-label="切换短剧项目"
              value={projectId}
              onChange={(event) => navigate(projectStoryOverviewPath(event.target.value))}
            >
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          ) : (
            <strong className="studio-project-title">{story?.project.name ?? "短剧剧本"}</strong>
          )}
        </div>

        {projectId && (
          <>
            <span className="studio-topbar-divider" aria-hidden="true" />
            <nav className="studio-view-segmented" aria-label="项目视图">
              <Link className="active" to={projectStoryOverviewPath(projectId)}>
                <BookOpenText size={14} />剧本
              </Link>
              <Link to={projectLibraryPath(projectId)}>
                <FolderOpen size={14} />素材文件
              </Link>
            </nav>
          </>
        )}
      </div>

      <div className="studio-topbar-right">
        <button
          type="button"
          className="studio-palette-trigger"
          onClick={onOpenPalette}
          title="快速搜索分集、人物或场景 (⌘K)"
        >
          <Search size={14} aria-hidden="true" />
          <span>跳集 / 搜索</span>
          <kbd>⌘K</kbd>
        </button>

        <Link className="studio-ghost-link" to="/ai-video-practice" title="原片拆解训练">
          <Clapperboard size={15} /><span>拆解</span>
        </Link>
        <Link className="studio-ghost-link" to="/knowledge" title="导演知识库">
          <BrainCircuit size={15} /><span>知识库</span>
        </Link>

        <ThemeToggle iconOnly />
      </div>
      <div ref={progressBarRef} className="studio-scroll-progress" aria-hidden="true" />
    </header>
  );
}

function StoryOutline({
  story,
  activeSection,
  activeEpisodeId,
}: {
  story: ProjectStoryReadModel;
  activeSection: ProjectStorySection;
  activeEpisodeId?: string;
}) {
  const [filter, setFilter] = useState("");
  const episodeListRef = useRef<HTMLDivElement>(null);

  const stageByEpisodeId = useMemo(() => {
    const map = new Map<string, EpisodeProductionStage>();
    for (const item of story.production.episodes) map.set(item.id, item.stage);
    return map;
  }, [story.production.episodes]);

  const filteredEpisodes = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return story.episodes;
    return story.episodes.filter((episode) =>
      `${episode.id} ${episode.id.replace(/^EP0*/i, "")} ${episode.title}`.toLocaleLowerCase("zh-CN").includes(normalized),
    );
  }, [filter, story.episodes]);

  useEffect(() => {
    if (!activeEpisodeId) return;
    const container = episodeListRef.current;
    const activeLink = container?.querySelector<HTMLElement>(`a[data-episode-id="${activeEpisodeId}"]`);
    if (container && activeLink) {
      const targetTop = activeLink.offsetTop - container.offsetTop - container.clientHeight / 2 + activeLink.clientHeight / 2;
      container.scrollTop = Math.max(0, targetTop);
    }
  }, [activeEpisodeId]);

  function sectionIcon(id: ProjectStorySection) {
    if (id === "overview") return <Sparkles size={14} />;
    if (id === "characters") return <Users size={14} />;
    if (id === "locations") return <MapPin size={14} />;
    return <Clapperboard size={14} />;
  }

  function sectionCount(id: ProjectStorySection) {
    if (id === "characters") return story.characters.length;
    if (id === "locations") return story.locations.length;
    if (id === "episodes") return story.episodes.length;
    return undefined;
  }

  return (
    <aside className="story-outline" aria-label="剧本目录">
      <div className="story-outline-sections">
        {storySections.map((section) => {
          const isActive = !activeEpisodeId && activeSection === section.id;
          const count = sectionCount(section.id);
          return (
            <Link
              className={isActive ? "active" : ""}
              aria-current={isActive ? "page" : undefined}
              key={section.id}
              to={projectStorySectionPath(story.project.id, section.id)}
            >
              <span className="story-outline-label">{sectionIcon(section.id)}{section.label}</span>
              {count !== undefined && <small>{count}</small>}
            </Link>
          );
        })}
      </div>

      <div className="story-outline-divider" />

      <div className="story-outline-ep-header">
        <span>分集</span>
        <small>{filteredEpisodes.length}/{story.episodes.length}</small>
      </div>

      <label className="story-outline-search">
        <Search size={13} aria-hidden="true" />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="筛选集数或标题…"
          aria-label="筛选分集"
        />
        {filter && (
          <button type="button" onClick={() => setFilter("")} aria-label="清空筛选">
            <X size={12} />
          </button>
        )}
      </label>

      <div className="story-outline-episodes" ref={episodeListRef}>
        {filteredEpisodes.map((episode) => {
          const stage = stageByEpisodeId.get(episode.id);
          const isCurrent = activeEpisodeId === episode.id;
          return (
            <Link
              key={episode.id}
              data-episode-id={episode.id}
              className={`story-outline-ep-link${isCurrent ? " active" : ""}`}
              aria-current={isCurrent ? "page" : undefined}
              to={projectEpisodePath(story.project.id, episode.id)}
              title={`${episode.id} ${episode.title}${stage ? ` · ${productionStageCopy[stage]}` : ""}`}
            >
              <i className={`stage-dot${stage ? ` stage-${stage.toLowerCase().replaceAll("_", "-")}` : ""}`} />
              <b>{episode.id}</b>
              <span className="story-outline-ep-title">{episode.title}</span>
            </Link>
          );
        })}
        {filteredEpisodes.length === 0 && (
          <p className="story-outline-empty">无匹配分集</p>
        )}
      </div>
    </aside>
  );
}

function MobileStorySections({ projectId, activeSection }: { projectId: string; activeSection: ProjectStorySection }) {
  return <nav className="story-mobile-sections" aria-label="剧本章节">{storySections.map((section) => <Link className={activeSection === section.id ? "active" : ""} key={section.id} to={projectStorySectionPath(projectId, section.id)}>{section.label}</Link>)}</nav>;
}

function CharacterCard({ projectId, character, index = 0 }: { projectId: string; character: CharacterReadModel; index?: number }) {
  const imageCount = character.looks.reduce((count, look) => count + look.assets.length, 0);
  return (
    <article
      className="story-character-card entity-card spotlight-card"
      data-reveal=""
      style={{ "--stagger": Math.min(index, 7) } as CSSProperties}
      onPointerMove={updateSpotlightPosition}
    >
      <Link to={projectCharacterPath(projectId, character.id)} aria-label={`查看人物：${character.name}`}>
        <div className="character-card-image is-portrait">
          <AssetImage asset={character.cardImage} alt={`${character.name}当前人物图`} />
          <StatusBadge status={character.cardImageStatus} detail={character.cardImageReason} />
        </div>
        <div className="character-card-copy">
          <span className="story-eyebrow">{character.storyRole} · {character.id}</span>
          <h3>{character.name}</h3>
          <p>{character.oneLineSetting}</p>
          {character.personality.length > 0 && (
            <span className="keyword-row">{character.personality.map((keyword) => <i key={keyword}>{keyword}</i>)}</span>
          )}
          <div className="entity-card-foot">
            <small>{imageCount} 张图 · {character.voiceAssets.length} 条声音</small>
            <span className="card-open-link">详情<ChevronRight size={14} /></span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function LocationCard({ projectId, location, index = 0 }: { projectId: string; location: LocationReadModel; index?: number }) {
  return (
    <article
      className="story-location-card entity-card spotlight-card"
      data-reveal=""
      style={{ "--stagger": Math.min(index, 7) } as CSSProperties}
      onPointerMove={updateSpotlightPosition}
    >
      <Link to={projectLocationPath(projectId, location.id)} aria-label={`查看场景：${location.name}`}>
        <div className="character-card-image is-landscape">
          <AssetImage asset={location.cardImage} alt={`${location.name}场景母版`} />
          <StatusBadge status={location.cardImageStatus} detail={location.cardImageReason} />
        </div>
        <div className="character-card-copy">
          <span className="story-eyebrow">{location.id}</span>
          <h3>{location.name}</h3>
          <p>{location.oneLineSetting ?? "通用场景素材，可在多集场次中复用。"}</p>
          <div className="entity-card-foot">
            <small>{location.images.length} 张图 · {location.ambientAudio.length} 条环境声</small>
            <span className="card-open-link">详情<ChevronRight size={14} /></span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function EpisodeCard({
  story,
  episode,
  stage,
  index = 0,
}: {
  story: ProjectStoryReadModel;
  episode: EpisodeSummaryReadModel;
  stage?: EpisodeProductionStage;
  index?: number;
}) {
  const cast = episode.characterIds
    .map((id) => story.characters.find((character) => character.id === id))
    .filter((character): character is CharacterReadModel => Boolean(character));

  return (
    <article
      className="story-episode-card spotlight-card"
      data-reveal=""
      style={{ "--stagger": Math.min(index, 7) } as CSSProperties}
      onPointerMove={updateSpotlightPosition}
    >
      <Link to={projectEpisodePath(story.project.id, episode.id)}>
        <header>
          <span className="episode-card-id">
            {stage && <i className={`stage-dot stage-${stage.toLowerCase().replaceAll("_", "-")}`} />}
            {episode.id}
            {stage && <small>{productionStageCopy[stage]}</small>}
          </span>
          <StatusBadge status={episode.completion.status} />
        </header>
        <h3>{episode.title}</h3>
        <p>{episode.summary}</p>
        <div className="episode-card-meta">
          <span>{episode.sceneCount} 场</span>
          <span>{episode.locationIds.length} 个场景</span>
          <span>{episode.characterIds.length} 位人物</span>
        </div>
        {cast.length > 0 && (
          <span className="cast-avatar-row">
            {cast.slice(0, 4).map((character) => (
              <span key={character.id} title={character.name}>
                <AssetImage asset={character.cardImage} alt={character.name} />
                <b>{character.name}</b>
              </span>
            ))}
          </span>
        )}
        <div className="episode-card-foot">
          <CompletionLine completion={episode.completion} />
          <span className="card-open-link">打开<ChevronRight size={14} /></span>
        </div>
      </Link>
    </article>
  );
}

function StoryOverview({ story, activeSection, onOpen }: { story: ProjectStoryReadModel; activeSection: ProjectStorySection; onOpen: StoryAssetOpenHandler }) {
  const projectDocuments = deduplicateAssets([story.story.source, ...story.relatedFiles]);
  const stageByEpisodeId = useMemo(() => {
    const map = new Map<string, EpisodeProductionStage>();
    for (const item of story.production.episodes) map.set(item.id, item.stage);
    return map;
  }, [story.production.episodes]);

  if (activeSection === "characters") {
    return (
      <>
        <CompactProductionStrip story={story} />
        <section className="story-canvas-section">
          <header className="story-panel-heading">
            <div><h1>人物设定</h1></div>
            <span className="story-count-pill">{story.characters.length} 位人物</span>
          </header>
          <div className="story-character-grid">
            {story.characters.map((character, index) => <CharacterCard key={character.id} projectId={story.project.id} character={character} index={index} />)}
          </div>
        </section>
      </>
    );
  }

  if (activeSection === "locations") {
    return (
      <>
        <CompactProductionStrip story={story} />
        <section className="story-canvas-section">
          <header className="story-panel-heading">
            <div><h1>场景设定</h1></div>
            <span className="story-count-pill">{story.locations.length} 个场景</span>
          </header>
          <div className="story-location-grid">
            {story.locations.map((storyLocation, index) => <LocationCard key={storyLocation.id} projectId={story.project.id} location={storyLocation} index={index} />)}
          </div>
        </section>
      </>
    );
  }

  if (activeSection === "episodes") {
    return (
      <>
        <CompactProductionStrip story={story} />
        <section className="story-canvas-section">
          <header className="story-panel-heading">
            <div><h1>分集视角</h1></div>
            <span className="story-count-pill">{story.episodes.length} / {story.story.totalEpisodes} 集</span>
          </header>
          <div className="story-episode-grid">
            {story.episodes.map((episode, index) => (
              <EpisodeCard key={episode.id} story={story} episode={episode} stage={stageByEpisodeId.get(episode.id)} index={index} />
            ))}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <ProductionDashboard story={story} />
      <article className="story-canvas-section story-overview-page" data-reveal="">
        <header className="story-panel-heading">
          <div><h2>故事大概</h2></div>
        </header>
        <blockquote className="story-logline">{story.story.logline}</blockquote>
        <div className="story-prose"><p>{story.story.synopsis}</p></div>
        {(story.story.coreConflict || story.story.relationshipArc || story.story.worldRules?.length) && (
          <div className="story-fact-grid">
            {story.story.coreConflict && <section className="spotlight-card" onPointerMove={updateSpotlightPosition}><span>核心矛盾</span><p>{story.story.coreConflict}</p></section>}
            {story.story.relationshipArc && <section className="spotlight-card" onPointerMove={updateSpotlightPosition}><span>关系主线</span><p>{story.story.relationshipArc}</p></section>}
            {story.story.worldRules?.length && <section className="spotlight-card" onPointerMove={updateSpotlightPosition}><span>世界规则</span><p>{story.story.worldRules.join("；")}</p></section>}
          </div>
        )}
        <MaterialSection
          projectId={story.project.id}
          eyebrow="DOCUMENTS"
          title="故事文案"
          assets={projectDocuments}
          onOpen={onOpen}
          showEmpty
          emptyCopy="当前项目还没有绑定故事文案。"
        />
      </article>
    </>
  );
}

function CharacterDetail({ story, character, onOpen }: { story: ProjectStoryReadModel; character: CharacterReadModel; onOpen: StoryAssetOpenHandler }) {
  const imageAssets = character.looks.flatMap((look) => look.assets);
  const imageLabels = Object.fromEntries(character.looks.flatMap((look) => look.assets.map((asset) => [asset.assetId, `${look.name} · ${lookKindCopy[look.kind]}`])));
  const voiceLabels = Object.fromEntries(character.voiceAssets.map((asset) => [asset.assetId, `${character.name} · 人物声音`]));
  return (
    <article className="story-detail-page story-borderless-page">
      <Link className="story-back-link" to={projectStorySectionPath(story.project.id, "characters")}><ArrowLeft size={15} />返回人物设定</Link>
      <header className="detail-heading">
        <div>
          <span className="story-eyebrow">{character.storyRole} · {character.id}</span>
          <h1>{character.name}</h1>
          <p>{character.oneLineSetting}</p>
        </div>
      </header>
      <section className="entity-setting" data-reveal="">
        <h2>人物小传</h2>
        <p>{character.biography || "尚未登记人物小传。"}</p>
        {character.personality.length > 0 && <span className="keyword-row">{character.personality.map((keyword) => <i key={keyword}>{keyword}</i>)}</span>}
      </section>
      <MaterialSection projectId={story.project.id} eyebrow="IMAGES" title="人物图片" assets={imageAssets} labels={imageLabels} onOpen={onOpen} aspect="portrait" showEmpty emptyCopy="尚未登记人物图片。" />
      <MaterialSection projectId={story.project.id} eyebrow="VOICE" title="人物声音" assets={character.voiceAssets} labels={voiceLabels} onOpen={onOpen} showEmpty emptyCopy="尚未登记人物声音。" />
      <MaterialSection projectId={story.project.id} eyebrow="SETTING" title="设定文档" assets={character.relatedFiles} onOpen={onOpen} showEmpty emptyCopy="当前人物没有单独绑定设定文档，以上方索引设定为准。" />
    </article>
  );
}

function LocationDetail({ story, storyLocation, onOpen }: { story: ProjectStoryReadModel; storyLocation: LocationReadModel; onOpen: StoryAssetOpenHandler }) {
  const imageLabels = Object.fromEntries(storyLocation.images.map((asset) => [asset.assetId, `${storyLocation.name} · 场景图片`]));
  const audioLabels = Object.fromEntries(storyLocation.ambientAudio.map((asset) => [asset.assetId, `${storyLocation.name} · 环境声音`]));
  return (
    <article className="story-detail-page story-borderless-page">
      <Link className="story-back-link" to={projectStorySectionPath(story.project.id, "locations")}><ArrowLeft size={15} />返回场景设定</Link>
      <header className="detail-heading">
        <div>
          <span className="story-eyebrow">LOCATION · {storyLocation.id}</span>
          <h1>{storyLocation.name}</h1>
          <p>{storyLocation.oneLineSetting ?? "项目级通用场景，可在不同分集和场次中复用。"}</p>
        </div>
      </header>
      <section className="entity-setting" data-reveal="">
        <h2>场景设定</h2>
        <p>{storyLocation.description ?? "当前索引已登记场景名称和稳定 ID，尚未补充独立场景设定说明。"}</p>
      </section>
      <MaterialSection projectId={story.project.id} eyebrow="IMAGES" title="场景图片" assets={storyLocation.images} labels={imageLabels} onOpen={onOpen} aspect="landscape" showEmpty emptyCopy="尚未登记场景图片。" />
      <MaterialSection projectId={story.project.id} eyebrow="AMBIENCE" title="环境声音" assets={storyLocation.ambientAudio} labels={audioLabels} onOpen={onOpen} showEmpty emptyCopy="尚未登记环境声音。" />
      <MaterialSection projectId={story.project.id} eyebrow="SETTING" title="设定文档" assets={storyLocation.relatedFiles} onOpen={onOpen} showEmpty emptyCopy="当前场景没有单独绑定设定文档。" />
    </article>
  );
}

function RequirementSummary({ requirements }: { requirements: StoryRequirementResult[] }) {
  if (!requirements.length) return <p className="story-empty-copy">当前场次没有登记基础素材要求。</p>;
  return <ul className="requirement-summary">{requirements.map((requirement) => <li key={requirement.id}><span><b>{requirement.label}</b><small>{requirement.reason}</small></span><StatusBadge status={requirement.status} detail={requirement.reason} /></li>)}</ul>;
}

function SceneCard({ story, episodeId, scene, focused, onOpen }: { story: ProjectStoryReadModel; episodeId: string; scene: SceneReadModel; focused: boolean; onOpen: StoryAssetOpenHandler }) {
  const dedicatedAssets = collectSceneDedicatedAssets(scene);
  const dedicatedCount = dedicatedAssets.textAssets.length + dedicatedAssets.imageAssets.length;
  const issues = scene.requirements.filter((requirement) => !["READY", "NOT_DUE"].includes(requirement.status));
  return (
    <article className={`story-scene-card${focused ? " focused" : ""}`} id={scene.id}>
      <header><div><span className="story-eyebrow">{scene.id}</span><h2>{scene.heading}</h2>{scene.locationId && <Link className="scene-location-link" to={projectLocationPath(story.project.id, scene.locationId)}><MapPin size={14} />{scene.locationName ?? scene.locationId}</Link>}</div><StatusBadge status={scene.completion.status} /></header>
      {scene.summary && <p className="scene-summary">{scene.summary}</p>}
      {scene.scriptExcerpt && <blockquote className="scene-excerpt">{scene.scriptExcerpt}</blockquote>}
      <div className="scene-entity-links">
        {scene.cast.map((member) => <Link key={`${scene.id}-${member.characterId}`} to={projectCharacterPath(story.project.id, member.characterId)}><Users size={15} /><span><b>{member.characterName}</b><small>{member.lookName ?? member.lookId ?? "未指定造型"}{member.speaks ? " · 有对白" : ""}</small></span></Link>)}
        {scene.props.map((prop) => <span key={prop.id}><PackageSearch size={15} /><b>{prop.id}</b><StatusBadge status={prop.status} /></span>)}
      </div>
      <section className="scene-dedicated-resources" aria-labelledby={`${scene.id}-dedicated-title`}>
        <header><div><span className="story-eyebrow">EPISODE ASSETS</span><h3 id={`${scene.id}-dedicated-title`}>本场专属资源</h3><p>分镜提示词按片段顺序排列，图片完整展示关键帧与道具。</p></div><span className="story-count-pill">{dedicatedCount} 项</span></header>
        <div className="scene-dedicated-groups">
          <MaterialSection projectId={story.project.id} eyebrow="TEXT" title="分镜提示词" description="按 U01、U02… 顺序排列；支持卡片直接一键复制。" assets={dedicatedAssets.textAssets} labels={dedicatedAssets.textLabels} onOpen={onOpen} headingLevel="h4" showEmpty emptyCopy="当前场次尚未登记分镜提示词。" />
          <MaterialSection projectId={story.project.id} eyebrow="IMAGES" title="关键帧与道具" description="完整展示不裁切。" assets={dedicatedAssets.imageAssets} onOpen={onOpen} headingLevel="h4" aspect="contain" showEmpty emptyCopy="当前场次尚未登记关键帧或道具图片。" />
        </div>
      </section>
      {issues.length > 0 && <details className="scene-production-state" open={focused}><summary>本场待处理 {issues.length} 项</summary><RequirementSummary requirements={issues} /></details>}
      {!focused && <Link className="scene-deep-link" to={projectScenePath(story.project.id, episodeId, scene.id)}>单独打开本场<ChevronRight size={15} /></Link>}
    </article>
  );
}

function collectEpisodeDedicatedImages(episode: EpisodeDetailReadModel) {
  const assetsByPath = new Map<string, StoryAssetLink>();
  const labels: Record<string, string> = {};
  const add = (asset: StoryAssetLink, label: string) => {
    if (asset.kind !== "image" || !asset.materialType.startsWith("image.")) return;
    if (assetsByPath.has(asset.path)) return;
    assetsByPath.set(asset.path, asset);
    labels[asset.assetId] = label;
  };
  for (const asset of [...episode.relatedFiles, ...episode.assets]) add(asset, "本集 · 图片素材");
  for (const scene of episode.scenes) {
    for (const asset of [...scene.relatedFiles, ...scene.assets, ...scene.derivedAssets]) add(asset, `${scene.id} · 图片素材`);
    for (const prop of scene.props) for (const asset of prop.assets) add(asset, `${scene.id} · 道具图片`);
  }
  return { assets: deduplicateAssets([...assetsByPath.values()]), labels };
}

function EpisodePromptSequence({ story, episode, onOpen }: { story: ProjectStoryReadModel; episode: EpisodeDetailReadModel; onOpen: StoryAssetOpenHandler }) {
  return (
    <div className="episode-prompt-sequence">
      {episode.scenes.map((scene, index) => {
        const prompts = collectSceneDedicatedAssets(scene);
        return (
          <article className="episode-prompt-scene" key={scene.id}>
            <header>
              <span className="episode-sequence-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <div className="episode-prompt-scene-title">
                  <span className="story-eyebrow">{scene.id}</span>
                  <h4>{scene.heading}</h4>
                </div>
                {scene.summary && <p>{scene.summary}</p>}
              </div>
              <span className="story-count-pill">{prompts.textAssets.length} 镜</span>
            </header>
            {scene.scriptExcerpt && (
              <details className="episode-script-excerpt">
                <summary>查看对应剧本段落</summary>
                <blockquote>{scene.scriptExcerpt}</blockquote>
              </details>
            )}
            <StoryAssetGallery
              projectId={story.project.id}
              assets={prompts.textAssets}
              labels={prompts.textLabels}
              onOpen={onOpen}
              showEmpty
              emptyCopy="本场尚未登记分镜提示词。"
            />
          </article>
        );
      })}
    </div>
  );
}

function collectEpisodeReusableAssets(story: ProjectStoryReadModel, episode: EpisodeDetailReadModel) {
  const lookIdsByCharacter = new Map<string, Set<string>>();
  const speakingCharacterIds = new Set<string>();
  for (const scene of episode.scenes) {
    for (const member of scene.cast) {
      const lookIds = lookIdsByCharacter.get(member.characterId) ?? new Set<string>();
      if (member.lookId) lookIds.add(member.lookId);
      lookIdsByCharacter.set(member.characterId, lookIds);
      if (member.speaks) speakingCharacterIds.add(member.characterId);
    }
  }
  const characterAssets: StoryAssetLink[] = [];
  const characterLabels: Record<string, string> = {};
  for (const characterId of episode.characterIds) {
    const character = story.characters.find((candidate) => candidate.id === characterId);
    if (!character) continue;
    const requestedLooks = lookIdsByCharacter.get(characterId);
    const looks = requestedLooks?.size
      ? character.looks.filter((look) => requestedLooks.has(look.id))
      : character.looks.filter((look) => look.id === character.defaultLookId || look.kind === "primary");
    for (const look of looks) for (const asset of look.assets) {
      characterAssets.push(asset);
      characterLabels[asset.assetId] = `${character.name} · ${look.name}`;
    }
    const acceptedVoices = character.voiceAssets.filter((asset) => asset.status === "ACCEPTED");
    const voices = acceptedVoices.length ? acceptedVoices : character.voiceAssets;
    if (speakingCharacterIds.has(characterId)) for (const asset of voices) {
      characterAssets.push(asset);
      characterLabels[asset.assetId] = `${character.name} · 人物声音`;
    }
  }
  const locationAssets: StoryAssetLink[] = [];
  const locationLabels: Record<string, string> = {};
  for (const locationId of episode.locationIds) {
    const storyLocation = story.locations.find((candidate) => candidate.id === locationId);
    if (!storyLocation) continue;
    for (const asset of [...storyLocation.images, ...storyLocation.ambientAudio]) {
      const explicitEpisode = `${asset.path}/${asset.name}`.match(/(?:^|[-_/])(EP\d{2})(?=[-_.]|$)/i)?.[1]?.toUpperCase();
      if (explicitEpisode && explicitEpisode !== episode.id.toUpperCase()) continue;
      locationAssets.push(asset);
      locationLabels[asset.assetId] = `${storyLocation.name} · ${asset.kind === "audio" ? "环境声音" : "场景图片"}`;
    }
  }
  return { characterAssets, characterLabels, locationAssets, locationLabels };
}

type EpisodeReusableAssetGroups = ReturnType<typeof collectEpisodeReusableAssets>;

function EpisodeReusableAssets({ story, groups, onOpen }: { story: ProjectStoryReadModel; groups: EpisodeReusableAssetGroups; onOpen: StoryAssetOpenHandler }) {
  return (
    <section className="story-workspace-block" id="ep-reusable" data-reveal="">
      <header className="story-block-header">
        <div>
          <span className="story-eyebrow">REUSABLE</span>
          <h2>通用资源</h2>
        </div>
      </header>
      <div className="story-block-stack">
        <MaterialSection
          projectId={story.project.id}
          title="人物与声音"
          assets={groups.characterAssets}
          labels={groups.characterLabels}
          onOpen={onOpen}
          headingLevel="h3"
          aspect="portrait"
          compact
          showEmpty
          emptyCopy="本集尚未绑定人物通用素材。"
        />
        <MaterialSection
          projectId={story.project.id}
          title="场景参考"
          assets={groups.locationAssets}
          labels={groups.locationLabels}
          onOpen={onOpen}
          headingLevel="h3"
          aspect="landscape"
          compact
          showEmpty
          emptyCopy="本集尚未绑定场景通用素材。"
        />
      </div>
    </section>
  );
}

function EpisodeAcceptanceSummary({ episode, assets }: { episode: EpisodeDetailReadModel; assets: StoryAssetLink[] }) {
  const currentAssets = deduplicateAssets(assets);
  const accepted = currentAssets.filter((asset) => asset.status === "ACCEPTED" && asset.url).length;
  const blocked = currentAssets.filter((asset) => asset.status === "BLOCKED" || !asset.url).length;
  const pending = currentAssets.length - accepted - blocked;
  const gaps = episode.requirements.filter((requirement) => requirement.status === "MISSING" || requirement.status === "BLOCKED");
  return (
    <section className="episode-acceptance-summary" aria-label="本集素材验收概况">
      <header><div><span className="story-eyebrow">ACCEPTANCE</span><h2>本集素材验收</h2></div><strong>{pending > 0 || blocked > 0 || gaps.length > 0 ? "尚未验收完成" : "当前登记项已验收"}</strong></header>
      <div>
        <span><small>当前素材</small><b>{currentAssets.length}</b></span>
        <span className="accepted"><small>已验收</small><b>{accepted}</b></span>
        <span className="pending"><small>待验收</small><b>{pending}</b></span>
        <span className="blocked"><small>阻塞 / 缺口</small><b>{blocked + gaps.length}</b></span>
      </div>
      <p>仅统计当前有效生产素材，不包含参考图、已拒绝或已废弃版本。</p>
      {gaps.length > 0 && <details><summary>查看 {gaps.length} 项明确缺口</summary><RequirementSummary requirements={gaps} /></details>}
    </section>
  );
}

const episodeAnchorSections = [
  { id: "ep-reusable", label: "通用资源" },
  { id: "ep-script", label: "剧本" },
  { id: "ep-images", label: "专属图片" },
  { id: "ep-prompts", label: "分镜提示词" },
  { id: "ep-secondary", label: "其他资料" },
] as const;

const episodeSectionIds = episodeAnchorSections.map((section) => section.id);

function EpisodeDetail({
  story,
  sceneId,
  scrollRef,
  onOpen,
}: {
  story: ProjectStoryReadModel;
  sceneId?: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  onOpen: StoryAssetOpenHandler;
}) {
  const episode = story.episode;
  const secondaryRef = useRef<HTMLDetailsElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const { pastHero, activeId } = useEpisodeScrollSpy(
    scrollRef,
    heroRef,
    episodeSectionIds,
    Boolean(episode && !sceneId),
    `${story.project.id}:${episode?.id ?? ""}`,
  );
  if (!episode) return null;

  const episodeIndex = story.episodes.findIndex((candidate) => candidate.id === episode.id);
  const previousEpisode = story.episodes[episodeIndex - 1];
  const nextEpisode = episodeIndex >= 0 ? story.episodes[episodeIndex + 1] : undefined;
  const productionEpisode = story.production.episodes.find((candidate) => candidate.id === episode.id);
  const selectedScene = sceneId ? episode.scenes.find((scene) => scene.id === sceneId) : undefined;
  const scenes = sceneId ? (selectedScene ? [selectedScene] : []) : episode.scenes;
  const documents = deduplicateAssets([episode.script, ...episode.relatedFiles]);
  const supportingDocuments = documents.filter((asset) => asset.assetId !== episode.script?.assetId);
  const dedicatedImages = collectEpisodeDedicatedImages(episode);
  const dedicatedImagePaths = new Set(dedicatedImages.assets.map((asset) => asset.path));
  const reusableSource = collectEpisodeReusableAssets(story, episode);
  const reusableGroups = {
    ...reusableSource,
    locationAssets: reusableSource.locationAssets.filter((asset) => !dedicatedImagePaths.has(asset.path)),
  };
  const dedicatedAssets = episode.scenes.map(collectSceneDedicatedAssets);
  const totalPromptsCount = dedicatedAssets.reduce((sum, group) => sum + group.textAssets.length, 0);
  const acceptanceAssets = deduplicateAssets([
    ...documents,
    ...reusableGroups.characterAssets,
    ...reusableGroups.locationAssets,
    ...episode.assets,
    ...dedicatedAssets.flatMap((group) => [...group.textAssets, ...group.imageAssets]),
  ]);
  const acceptedCount = acceptanceAssets.filter((asset) => asset.status === "ACCEPTED" && asset.url).length;
  const blockedCount = acceptanceAssets.filter((asset) => asset.status === "BLOCKED" || !asset.url).length;
  const gapCount = episode.requirements.filter((requirement) => requirement.status === "MISSING" || requirement.status === "BLOCKED").length;
  const allAccepted = acceptanceAssets.length > 0 && acceptedCount === acceptanceAssets.length && blockedCount === 0 && gapCount === 0;

  function jumpToSection(id: string, openDetails = false) {
    if (openDetails && secondaryRef.current) secondaryRef.current.open = true;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <article className="story-detail-page story-borderless-page episode-detail-page">
      {!sceneId && (
        <div className={`episode-sticky-bar${pastHero ? " is-visible" : ""}`} aria-hidden={!pastHero}>
          <div className="episode-sticky-left">
            <span className="story-ep-pill is-compact">{episode.id}</span>
            <strong title={episode.title}>{episode.title}</strong>
            <span className="episode-sticky-pager">
              {previousEpisode ? (
                <Link to={projectEpisodePath(story.project.id, previousEpisode.id)} title={`上一集 ${previousEpisode.id}`} aria-label={`上一集 ${previousEpisode.id}`}>
                  <ChevronLeft size={14} />
                </Link>
              ) : (
                <button type="button" disabled aria-label="无上一集"><ChevronLeft size={14} /></button>
              )}
              {nextEpisode ? (
                <Link to={projectEpisodePath(story.project.id, nextEpisode.id)} title={`下一集 ${nextEpisode.id}`} aria-label={`下一集 ${nextEpisode.id}`}>
                  <ChevronRight size={14} />
                </Link>
              ) : (
                <button type="button" disabled aria-label="无下一集"><ChevronRight size={14} /></button>
              )}
            </span>
          </div>

          <nav className="episode-sticky-nav" aria-label="滚动章节定位">
            {episodeAnchorSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={activeId === section.id ? "is-active" : ""}
                onClick={() => jumpToSection(section.id, section.id === "ep-secondary")}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <div className="episode-detail-toolbar">
        <Link className="story-back-link" to={sceneId ? projectEpisodePath(story.project.id, episode.id) : projectStorySectionPath(story.project.id, "episodes")}>
          <ArrowLeft size={15} />{sceneId ? `返回 ${episode.id}` : "返回分集"}
        </Link>
        {!sceneId && (
          <nav className="episode-detail-navigation" aria-label="切换上下集">
            {previousEpisode
              ? <Link className="studio-nav-btn" to={projectEpisodePath(story.project.id, previousEpisode.id)} title={`${previousEpisode.id} ${previousEpisode.title}`}><ChevronLeft size={15} /><span>{previousEpisode.id}</span></Link>
              : <button className="studio-nav-btn" type="button" disabled><ChevronLeft size={15} /><span>上一集</span></button>}
            {nextEpisode
              ? <Link className="studio-nav-btn" to={projectEpisodePath(story.project.id, nextEpisode.id)} title={`${nextEpisode.id} ${nextEpisode.title}`}><span>{nextEpisode.id}</span><ChevronRight size={15} /></Link>
              : <button className="studio-nav-btn" type="button" disabled><span>下一集</span><ChevronRight size={15} /></button>}
          </nav>
        )}
      </div>

      <header className="detail-heading" ref={heroRef}>
        <div>
          <div className="detail-eyebrow-row">
            <span className="story-ep-pill">{episode.id}</span>
            {productionEpisode && (
              <span className={`story-stage-pill stage-${productionEpisode.stage.toLowerCase().replaceAll("_", "-")}`}>
                <i className="stage-dot" />
                {productionStageCopy[productionEpisode.stage]}
              </span>
            )}
            {story.story.aspectRatio && (
              <span className="story-format-chip">
                {story.story.aspectRatio} {story.story.aspectRatio === "16:9" ? "横屏" : "竖屏"}
              </span>
            )}
          </div>
          <h1>{sceneId ? selectedScene?.heading ?? "场次不存在" : episode.title}</h1>
          <p>{sceneId ? selectedScene?.summary ?? "这个场次不在当前分集索引中。" : episode.summary}</p>
        </div>
        {sceneId && selectedScene && <CompletionLine completion={selectedScene.completion} />}
      </header>

      {!sceneId && (
        <div className="episode-summary-bar">
          <div className="episode-fact-row">
            <span><Users size={13} />{episode.characterIds.length} 位人物</span>
            <span><MapPin size={13} />{episode.locationIds.length} 个场景</span>
            <span><BookOpenText size={13} />{episode.sceneCount} 场 · {totalPromptsCount} 镜</span>
            <button
              type="button"
              className={`episode-acceptance-pill${allAccepted ? " is-ready" : blockedCount + gapCount > 0 ? " is-blocked" : ""}`}
              onClick={() => jumpToSection("ep-secondary", true)}
              title="点击展开验收详情"
            >
              {allAccepted ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
              已验收 {acceptedCount}/{acceptanceAssets.length}
              {blockedCount + gapCount > 0 ? ` · ${blockedCount + gapCount} 缺口` : ""}
            </button>
          </div>

          <nav className="episode-anchor-nav" aria-label="本集快速定位">
            {episodeAnchorSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={activeId === section.id ? "is-active" : ""}
                onClick={() => jumpToSection(section.id, section.id === "ep-secondary")}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {!sceneId && <EpisodeReusableAssets story={story} groups={reusableGroups} onOpen={onOpen} />}

      {!sceneId && (
        <section className="story-workspace-block" id="ep-script" data-reveal="">
          <header className="story-block-header">
            <div>
              <span className="story-eyebrow">SCRIPT</span>
              <h2>分集剧本</h2>
            </div>
          </header>
          {episode.script ? (
            <StoryScriptBanner projectId={story.project.id} asset={episode.script} onOpen={onOpen} />
          ) : (
            <p className="story-empty-copy">本集还没有绑定剧本。</p>
          )}
        </section>
      )}

      {!sceneId && (
        <section className="story-workspace-block" id="ep-images" data-reveal="">
          <header className="story-block-header">
            <div>
              <span className="story-eyebrow">DEDICATED IMAGES</span>
              <h2>本集专属图片</h2>
            </div>
            <span className="story-count-pill">{dedicatedImages.assets.length} 项</span>
          </header>
          <StoryAssetGallery
            projectId={story.project.id}
            assets={dedicatedImages.assets}
            labels={dedicatedImages.labels}
            onOpen={onOpen}
            aspect="contain"
            showEmpty
            emptyCopy="本集尚未登记专属图片素材。"
          />
        </section>
      )}

      {!sceneId && (
        <section className="story-workspace-block" id="ep-prompts" data-reveal="">
          <header className="story-block-header">
            <div>
              <span className="story-eyebrow">STORYBOARD PROMPTS</span>
              <h2>分镜提示词</h2>
            </div>
            <span className="story-count-pill">{totalPromptsCount} 镜</span>
          </header>
          <EpisodePromptSequence story={story} episode={episode} onOpen={onOpen} />
        </section>
      )}

      {sceneId && (
        <section className="story-workspace-block">
          <header className="story-block-header">
            <div><span className="story-eyebrow">SCENE</span><h2>场次详情</h2></div>
          </header>
          <div className="scene-list">{scenes.map((scene) => <SceneCard key={scene.id} story={story} episodeId={episode.id} scene={scene} focused onOpen={onOpen} />)}</div>
        </section>
      )}

      {!sceneId && (
        <details className="episode-secondary-info" id="ep-secondary" ref={secondaryRef} data-reveal="">
          <summary>
            <span>制作状态、台词合同与其他资料</span>
            <small>{supportingDocuments.length} 份资料 · 已验收 {acceptedCount}/{acceptanceAssets.length}</small>
          </summary>
          <div>
            <EpisodeAcceptanceSummary episode={episode} assets={acceptanceAssets} />
            <MaterialSection projectId={story.project.id} title="其他生产资料" assets={supportingDocuments} onOpen={onOpen} compact showEmpty emptyCopy="本集尚未登记其他生产资料。" />
            <MaterialSection projectId={story.project.id} title="成片与声音" assets={episode.assets.filter((asset) => asset.kind === "video" || asset.kind === "audio")} onOpen={onOpen} compact showEmpty emptyCopy="本集尚未登记分集级成片或声音。" />
          </div>
        </details>
      )}

      {sceneId && !selectedScene && <div className="story-inline-error" role="alert">场次 {sceneId} 不存在。<Link to={projectEpisodePath(story.project.id, episode.id)}>查看本集全部场次</Link></div>}
    </article>
  );
}

function requestedSection(search: string): ProjectStorySection {
  const value = new URLSearchParams(search).get("section");
  if (value === "production") return "overview";
  return storySections.some((section) => section.id === value) ? value as ProjectStorySection : "overview";
}

export function ProjectStoryPage() {
  const { projectId = "", characterId, locationId, episodeId, sceneId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection: ProjectStorySection = characterId ? "characters" : locationId ? "locations" : episodeId ? "episodes" : requestedSection(location.search);
  const requestKey = `${projectId}\u0000${episodeId ?? ""}`;
  const [storyResult, setStoryResult] = useState<{ key: string; story: ProjectStoryReadModel }>();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [errorResult, setErrorResult] = useState<{ key: string; message: string }>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const story = storyResult?.key === requestKey ? storyResult.story : undefined;
  const error = errorResult?.key === requestKey ? errorResult.message : "";
  const viewKey = `${projectId}:${activeSection}:${characterId ?? ""}:${locationId ?? ""}:${episodeId ?? ""}:${sceneId ?? ""}:${Boolean(story)}`;

  useScrollProgressBar(scrollRef, progressBarRef, viewKey);
  useScrollReveal(scrollRef, mainContentRef, viewKey);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: "instant" });
  }, [projectId, activeSection, characterId, locationId, episodeId, sceneId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setErrorResult(undefined);
    Promise.all([getProjectStory(projectId, episodeId, controller.signal), getProjects()])
      .then(([nextStory, projectResponse]) => { setStoryResult({ key: requestKey, story: nextStory }); setProjects(projectResponse.projects); })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setErrorResult({ key: requestKey, message: reason instanceof Error ? reason.message : "无法读取剧本业务索引" });
      });
    return () => controller.abort();
  }, [episodeId, projectId, requestKey]);

  const character = useMemo(() => story?.characters.find((candidate) => candidate.id === characterId), [characterId, story]);
  const storyLocation = useMemo(() => story?.locations.find((candidate) => candidate.id === locationId), [locationId, story]);
  const previewSearch = new URLSearchParams(location.search);
  const previewId = previewSearch.get("preview");
  const previewItemIds = previewSearch.getAll("previewItem");
  const previewAsset = useMemo(() => story?.assets.find((asset) => asset.assetId === previewId), [previewId, story]);
  const scopedPreviewAssets = story
    ? previewItemIds.map((assetId) => story.assets.find((asset) => asset.assetId === assetId)).filter((asset): asset is StoryAssetLink => Boolean(asset))
    : [];
  const previewAssets = previewAsset && scopedPreviewAssets.some((asset) => asset.assetId === previewAsset.assetId)
    ? scopedPreviewAssets
    : previewAsset
      ? [previewAsset]
      : [];

  function setPreview(asset?: StoryAssetLink, replace = false, siblingAssets?: StoryAssetLink[]) {
    const search = new URLSearchParams(location.search);
    if (asset && asset.kind !== "audio" && asset.url) {
      search.set("preview", asset.assetId);
      if (siblingAssets) {
        search.delete("previewItem");
        for (const siblingAsset of siblingAssets) search.append("previewItem", siblingAsset.assetId);
      }
    } else {
      search.delete("preview");
      search.delete("previewItem");
    }
    navigate({ pathname: location.pathname, search: search.size ? `?${search}` : "", hash: location.hash }, { replace });
  }

  function openPath(path: string) {
    const asset = story?.assets.find((candidate) => candidate.path === path);
    if (asset && asset.kind !== "audio" && asset.url) setPreview(asset, true, [asset]);
    else navigate(storyAssetLibraryPath(projectId, { path }));
  }

  if (!story && !error) {
    return (
      <div className="app-shell story-shell">
        <StoryHeader projects={projects} projectId={projectId} onOpenPalette={() => setPaletteOpen(true)} />
        <div className="story-loading"><RefreshCw size={22} className="spinning" />正在读取剧本业务索引…</div>
      </div>
    );
  }
  if (!story || error) {
    return (
      <div className="app-shell story-shell">
        <StoryHeader projects={projects} projectId={projectId} onOpenPalette={() => setPaletteOpen(true)} />
        <main className="story-unavailable">
          <PackageSearch size={36} />
          <h1>剧本业务索引尚不可用</h1>
          <p>{error || "当前项目还没有 story-index.v1.json。"}</p>
          <Link className="primary-button" to={projectLibraryPath(projectId)}>继续查看素材文件</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell story-shell">
      <StoryHeader story={story} projects={projects} projectId={projectId} progressBarRef={progressBarRef} onOpenPalette={() => setPaletteOpen(true)} />
      <div className="story-scroll" ref={scrollRef}>
        <MobileStorySections projectId={projectId} activeSection={activeSection} />
        <main className="story-page">
          <div className="story-layout">
            <StoryOutline story={story} activeSection={activeSection} activeEpisodeId={episodeId} />
            <div className="story-main-content story-view-enter" key={viewKey} ref={mainContentRef}>
              {characterId
                ? character
                  ? <CharacterDetail story={story} character={character} onOpen={(asset, siblingAssets) => setPreview(asset, false, siblingAssets)} />
                  : <div className="story-inline-error" role="alert">人物 {characterId} 不存在。<Link to={projectStorySectionPath(projectId, "characters")}>返回人物设定</Link></div>
                : locationId
                  ? storyLocation
                    ? <LocationDetail story={story} storyLocation={storyLocation} onOpen={(asset, siblingAssets) => setPreview(asset, false, siblingAssets)} />
                    : <div className="story-inline-error" role="alert">场景 {locationId} 不存在。<Link to={projectStorySectionPath(projectId, "locations")}>返回场景设定</Link></div>
                  : episodeId
                    ? <EpisodeDetail story={story} sceneId={sceneId} scrollRef={scrollRef} onOpen={(asset, siblingAssets) => setPreview(asset, false, siblingAssets)} />
                    : <StoryOverview story={story} activeSection={activeSection} onOpen={(asset, siblingAssets) => setPreview(asset, false, siblingAssets)} />}
            </div>
          </div>
        </main>
      </div>
      {previewAsset && previewAsset.kind !== "audio" && (
        <StoryAssetModal
          projectId={projectId}
          asset={previewAsset}
          assets={previewAssets}
          onClose={() => setPreview(undefined, true)}
          onOpen={(asset) => setPreview(asset, true)}
          onOpenPath={openPath}
        />
      )}
      <StoryCommandPalette
        open={paletteOpen}
        story={story}
        projectId={projectId}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
