import {
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clapperboard,
  FileCheck2,
  Film,
  Images,
  MapPin,
  PackageSearch,
  RefreshCw,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { ProjectViewTabs } from "../components/ProjectViewTabs";
import { StoryAssetGallery, StoryAssetModal, type StoryAssetOpenHandler } from "../components/StoryAssetGallery";
import { ThemeToggle } from "../components/ThemeToggle";
import { getProjects } from "../lib/materials";
import { getProjectStory, storyAssetLibraryPath } from "../lib/projectStory";
import { collectSceneDedicatedAssets, deduplicateCurrentStoryAssets as deduplicateAssets } from "../lib/storyAssets";
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
  PREPRODUCTION: "前期制作",
  SHOT_PRODUCTION: "正式镜头",
  FINAL_REVIEW: "成片待验收",
  COMPLETED: "已完成",
};

const productionStageOrder: EpisodeProductionStage[] = [
  "PREPRODUCTION",
  "STORYBOARD_DRAFT",
  "SHOT_PRODUCTION",
  "FINAL_REVIEW",
  "SCRIPT_READY",
  "COMPLETED",
  "NOT_STARTED",
];

const storySections: Array<{ id: ProjectStorySection; label: string }> = [
  { id: "overview", label: "故事大概" },
  { id: "characters", label: "人物设定" },
  { id: "locations", label: "场景设定" },
  { id: "episodes", label: "分集视角" },
];

function StatusBadge({ status, detail }: { status: StoryObjectStatus; detail?: string }) {
  const icon = status === "READY"
    ? <CheckCircle2 size={14} />
    : status === "BLOCKED"
      ? <AlertTriangle size={14} />
      : <CircleDashed size={14} />;
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
  return <span className="story-image-placeholder"><Images size={28} /><span>暂无图片</span></span>;
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
}) {
  if (!assets.length && !showEmpty) return null;
  const Heading = headingLevel;
  return (
    <section className="story-material-section">
      <header>
        <div>{eyebrow && <span className="story-eyebrow">{eyebrow}</span>}<Heading>{title}</Heading>{description && <p>{description}</p>}</div>
        <strong>{assets.length} 项</strong>
      </header>
      <StoryAssetGallery projectId={projectId} assets={assets} labels={labels} onOpen={onOpen} showEmpty={showEmpty} emptyCopy={emptyCopy} />
    </section>
  );
}

function ProductionDashboard({ story }: { story: ProjectStoryReadModel }) {
  const { production, currentMilestoneCompletion } = story;
  const pipeline = [
    { key: "script", label: "剧本定稿", value: production.pipeline.scriptReady, icon: <FileCheck2 size={17} /> },
    { key: "storyboard", label: "分镜准备", value: production.pipeline.storyboardReady, icon: <BookOpenText size={17} /> },
    { key: "shots", label: "正式镜头", value: production.pipeline.shotProduced, icon: <Film size={17} /> },
    { key: "final", label: "成片验收", value: production.pipeline.finalAccepted, icon: <Clapperboard size={17} /> },
  ];
  const visibleStages = productionStageOrder.filter((stage) => production.stageCounts[stage] > 0 || stage === "COMPLETED");
  const milestonePercentage = currentMilestoneCompletion.required > 0
    ? Math.round((currentMilestoneCompletion.ready / currentMilestoneCompletion.required) * 100)
    : 0;
  return (
    <section className="story-command-center" aria-labelledby="story-production-title">
      <header className="story-command-header">
        <div>
          <h1 className="sr-only" id="story-production-title">全剧总览</h1>
          <div className="story-meta-row">
            {story.story.genre.map((genre) => <span key={genre}>{genre}</span>)}
            <span>共 {story.story.totalEpisodes} 集</span>
          </div>
          {story.story.productionScope && <p className="story-production-scope">{story.story.productionScope}</p>}
        </div>
      </header>
      <div className="story-production-grid">
        <section className="story-overall-progress">
          <h2>全剧完成进度</h2>
          <div className="story-progress-ring" role="progressbar" aria-label="全剧已验收成片进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={production.percentage} style={{ background: `conic-gradient(var(--blue) ${production.percentage}%, var(--surface-soft) 0)` }}>
            <span><b>{production.percentage}%</b></span>
          </div>
          <strong>{production.completedEpisodes} / {production.totalEpisodes} 集已完成</strong>
          <p>完成仅以已登记验收证据的成片计。</p>
        </section>
        <section className="story-pipeline-chart" aria-label="全剧生产流程">
          <h2>生产流程 <small>全剧 {production.totalEpisodes} 集</small></h2>
          <div>{pipeline.map((stage) => {
            const percentage = production.totalEpisodes > 0 ? (stage.value / production.totalEpisodes) * 100 : 0;
            return <span className="story-pipeline-row" key={stage.key}><i>{stage.icon}</i><b>{stage.label}</b><span className="story-pipeline-track"><span style={{ width: `${percentage}%` }} /></span><strong>{stage.value}/{production.totalEpisodes}</strong></span>;
          })}</div>
        </section>
        <section className="story-stage-summary">
          <h2>分集阶段分布 <small>{production.totalEpisodes} 集</small></h2>
          <ul>{visibleStages.map((stage) => <li key={stage}><i className={`stage-dot stage-${stage.toLowerCase().replaceAll("_", "-")}`} /><span>{productionStageCopy[stage]}</span><b>{production.stageCounts[stage]}</b></li>)}</ul>
          <div className="story-current-focus">
            <span>当前焦点</span>
            <strong>{story.currentMilestone.episodeIds.join("、") || "未指定"} · {story.currentMilestone.name ?? story.currentMilestone.id}</strong>
            <small>局部基础素材 {currentMilestoneCompletion.ready}/{currentMilestoneCompletion.required}</small>
            <span className="story-focus-track"><span style={{ width: `${milestonePercentage}%` }} /></span>
            {currentMilestoneCompletion.blocked > 0 && <b><AlertTriangle size={14} />{currentMilestoneCompletion.blocked} 项阻塞</b>}
          </div>
        </section>
      </div>
      <section className="story-episode-stage-board" aria-label={`${production.totalEpisodes} 集生产阶段总览`}>
        <header><h2>{production.totalEpisodes} 集生产阶段总览</h2><span>横向查看全部分集</span></header>
        <div className="story-episode-stage-rail">{production.episodes.map((episode) => (
          <Link className={`episode-stage-cell stage-${episode.stage.toLowerCase().replaceAll("_", "-")}${episode.current ? " current" : ""}`} key={episode.id} to={projectEpisodePath(story.project.id, episode.id)} title={`${episode.id} ${episode.title} · ${productionStageCopy[episode.stage]}`}>
            <b>{episode.id}</b><span>{productionStageCopy[episode.stage]}</span>
          </Link>
        ))}</div>
      </section>
    </section>
  );
}

function StoryHeader({ story, projects, projectId }: { story?: ProjectStoryReadModel; projects: ProjectSummary[]; projectId: string }) {
  const navigate = useNavigate();
  return (
    <>
      <header className="app-header story-app-header">
        <div className="brand-block"><BrandMark /><div><strong>{story?.project.name ?? "短剧剧本"}</strong><span>AI 短剧素材中心 · 剧本业务视图</span></div></div>
        <div className="header-actions story-header-actions">
          {projects.length > 0 && projectId && (
            <select name="story-project-switcher" className="project-switcher" aria-label="切换短剧项目" value={projectId} onChange={(event) => navigate(projectStoryOverviewPath(event.target.value))}>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          )}
          <ThemeToggle />
          <Link className="course-link" to="/knowledge"><BrainCircuit size={18} /><span className="responsive-action-label" data-compact-label="知识库">导演知识库</span></Link>
          <Link className="course-link" to="/"><ArrowLeft size={18} /><span className="responsive-action-label" data-compact-label="项目">所有项目</span></Link>
        </div>
      </header>
      {projectId && <ProjectViewTabs projectId={projectId} active="story" />}
    </>
  );
}

function StoryOutline({ story, activeSection, activeEpisodeId }: { story: ProjectStoryReadModel; activeSection: ProjectStorySection; activeEpisodeId?: string }) {
  return (
    <aside className="story-outline" aria-label="剧本目录">
      <strong>剧本目录</strong>
      {storySections.map((section) => <Link className={activeSection === section.id ? "active" : ""} aria-current={!activeEpisodeId && activeSection === section.id ? "page" : undefined} key={section.id} to={projectStorySectionPath(story.project.id, section.id)}>{section.label}</Link>)}
      <span>分集</span>
      {story.episodes.map((episode) => <Link className={activeEpisodeId === episode.id ? "active" : ""} aria-current={activeEpisodeId === episode.id ? "page" : undefined} key={episode.id} to={projectEpisodePath(story.project.id, episode.id)}><b>{episode.id}</b>{episode.title}</Link>)}
    </aside>
  );
}

function MobileStorySections({ projectId, activeSection }: { projectId: string; activeSection: ProjectStorySection }) {
  return <nav className="story-mobile-sections" aria-label="剧本章节">{storySections.map((section) => <Link className={activeSection === section.id ? "active" : ""} key={section.id} to={projectStorySectionPath(projectId, section.id)}>{section.label}</Link>)}</nav>;
}

function StoryContentTabs({ projectId, activeSection }: { projectId: string; activeSection: ProjectStorySection }) {
  return (
    <nav className="story-content-tabs" aria-label="全局总览内容">
      {storySections.map((section) => {
        const icon = section.id === "overview"
          ? <BookOpenText size={17} />
          : section.id === "characters"
            ? <Users size={17} />
            : section.id === "locations"
              ? <MapPin size={17} />
              : <Clapperboard size={17} />;
        return <Link className={activeSection === section.id ? "active" : ""} key={section.id} to={projectStorySectionPath(projectId, section.id)}>{icon}{section.label}</Link>;
      })}
    </nav>
  );
}

function CharacterCard({ projectId, character }: { projectId: string; character: CharacterReadModel }) {
  const imageCount = character.looks.reduce((count, look) => count + look.assets.length, 0);
  return (
    <article className="story-character-card entity-card">
      <Link to={projectCharacterPath(projectId, character.id)} aria-label={`查看人物：${character.name}`}>
        <div className="character-card-image"><AssetImage asset={character.cardImage} alt={`${character.name}当前人物图`} /><StatusBadge status={character.cardImageStatus} detail={character.cardImageReason} /></div>
        <div className="character-card-copy"><span className="story-eyebrow">{character.storyRole} · {character.id}</span><h3>{character.name}</h3><p>{character.oneLineSetting}</p><span className="keyword-row">{character.personality.map((keyword) => <i key={keyword}>{keyword}</i>)}</span><small>{imageCount} 张图片 · {character.voiceAssets.length} 条声音</small><span className="card-open-link">查看设定、图片与声音<ChevronRight size={16} /></span></div>
      </Link>
    </article>
  );
}

function LocationCard({ projectId, location }: { projectId: string; location: LocationReadModel }) {
  return (
    <article className="story-location-card entity-card">
      <Link to={projectLocationPath(projectId, location.id)} aria-label={`查看场景：${location.name}`}>
        <div className="character-card-image"><AssetImage asset={location.cardImage} alt={`${location.name}场景母版`} /><StatusBadge status={location.cardImageStatus} detail={location.cardImageReason} /></div>
        <div className="character-card-copy"><span className="story-eyebrow">LOCATION · {location.id}</span><h3>{location.name}</h3><p>{location.oneLineSetting ?? "通用场景素材，可在多集场次中复用。"}</p><small>{location.images.length} 张图片 · {location.ambientAudio.length} 条环境声音</small><span className="card-open-link">查看设定、图片与声音<ChevronRight size={16} /></span></div>
      </Link>
    </article>
  );
}

function EpisodeCard({ story, episode }: { story: ProjectStoryReadModel; episode: EpisodeSummaryReadModel }) {
  const cast = episode.characterIds.map((id) => story.characters.find((character) => character.id === id)).filter((character): character is CharacterReadModel => Boolean(character));
  return (
    <article className="story-episode-card"><Link to={projectEpisodePath(story.project.id, episode.id)}><header><span>{episode.id}</span><StatusBadge status={episode.completion.status} /></header><h3>{episode.title}</h3><p>{episode.summary}</p><div className="episode-card-meta"><span>{episode.sceneCount} 场</span><span>{episode.locationIds.length} 个场景</span></div><span className="cast-avatar-row">{cast.slice(0, 4).map((character) => <span key={character.id} title={character.name}><AssetImage asset={character.cardImage} alt={character.name} /><b>{character.name}</b></span>)}</span><CompletionLine completion={episode.completion} /><span className="card-open-link">查看本集全部素材<ChevronRight size={16} /></span></Link></article>
  );
}

function StoryOverview({ story, activeSection, onOpen }: { story: ProjectStoryReadModel; activeSection: ProjectStorySection; onOpen: StoryAssetOpenHandler }) {
  const projectDocuments = deduplicateAssets([story.story.source, ...story.relatedFiles]);
  const content = activeSection === "characters"
    ? <section className="story-content-panel"><header className="story-panel-heading"><div><h2>人物设定</h2><p>人物详情保持简单：设定、图片、声音，不展示反向关联。</p></div><strong>{story.characters.length} 位人物</strong></header><div className="story-character-grid">{story.characters.map((character) => <CharacterCard key={character.id} projectId={story.project.id} character={character} />)}</div></section>
    : activeSection === "locations"
      ? <section className="story-content-panel"><header className="story-panel-heading"><div><h2>场景设定</h2><p>项目级通用场景，与人物一样集中管理，可供多集复用。</p></div><strong>{story.locations.length} 个场景</strong></header><div className="story-location-grid">{story.locations.map((storyLocation) => <LocationCard key={storyLocation.id} projectId={story.project.id} location={storyLocation} />)}</div></section>
      : activeSection === "episodes"
        ? <section className="story-content-panel"><header className="story-panel-heading"><div><h2>分集视角</h2><p>进入单集后，按文案、通用素材、单集素材与场次依次阅读。</p></div><strong>{story.episodes.length} / {story.story.totalEpisodes} 集已索引</strong></header><div className="story-episode-grid">{story.episodes.map((episode) => <EpisodeCard key={episode.id} story={story} episode={episode} />)}</div></section>
        : (
          <article className="story-content-panel story-overview-page">
            <h2 className="sr-only">故事大概</h2>
            <blockquote className="story-logline">{story.story.logline}</blockquote>
            <div className="story-prose"><p>{story.story.synopsis}</p></div>
            {(story.story.coreConflict || story.story.relationshipArc || story.story.worldRules?.length) && <div className="story-fact-grid">{story.story.coreConflict && <section><span>核心矛盾</span><p>{story.story.coreConflict}</p></section>}{story.story.relationshipArc && <section><span>关系主线</span><p>{story.story.relationshipArc}</p></section>}{story.story.worldRules?.length && <section><span>世界规则</span><p>{story.story.worldRules.join("；")}</p></section>}</div>}
            <MaterialSection projectId={story.project.id} eyebrow="DOCUMENTS" title="故事文案" description="卡片先展示摘要，点击后在当前页面弹窗阅读全文。" assets={projectDocuments} onOpen={onOpen} showEmpty emptyCopy="当前项目还没有绑定故事文案。" />
          </article>
        );
  return (
    <>
      <ProductionDashboard story={story} />
      <section className="story-content-switcher">
        <StoryContentTabs projectId={story.project.id} activeSection={activeSection} />
        {content}
      </section>
    </>
  );
}

function CharacterDetail({ story, character, onOpen }: { story: ProjectStoryReadModel; character: CharacterReadModel; onOpen: StoryAssetOpenHandler }) {
  const imageAssets = character.looks.flatMap((look) => look.assets);
  const imageLabels = Object.fromEntries(character.looks.flatMap((look) => look.assets.map((asset) => [asset.assetId, `${look.name} · ${lookKindCopy[look.kind]}`])));
  const voiceLabels = Object.fromEntries(character.voiceAssets.map((asset) => [asset.assetId, `${character.name} · 人物声音`]));
  return (
    <article className="story-detail-page">
      <Link className="story-back-link" to={projectStorySectionPath(story.project.id, "characters")}><ArrowLeft size={16} />返回人物设定</Link>
      <header className="detail-heading"><div><span className="story-eyebrow">{character.storyRole} · {character.id}</span><h1>{character.name}</h1><p>{character.oneLineSetting}</p></div></header>
      <section className="entity-setting"><h2>人物设定</h2><p>{character.biography || "尚未登记人物小传。"}</p>{character.personality.length > 0 && <span className="keyword-row">{character.personality.map((keyword) => <i key={keyword}>{keyword}</i>)}</span>}</section>
      <MaterialSection projectId={story.project.id} eyebrow="SETTING" title="设定文档" description="点击卡片在弹窗中查看完整设定。" assets={character.relatedFiles} onOpen={onOpen} showEmpty emptyCopy="当前人物没有单独绑定设定文档，以上方索引设定为准。" />
      <MaterialSection projectId={story.project.id} eyebrow="IMAGES" title="人物图片" description="只展示仍在使用或等待验收的当前图片。" assets={imageAssets} labels={imageLabels} onOpen={onOpen} showEmpty emptyCopy="尚未登记人物图片。" />
      <MaterialSection projectId={story.project.id} eyebrow="VOICE" title="人物声音" description="音频不打开弹窗，点击卡片即可直接播放或暂停。" assets={character.voiceAssets} labels={voiceLabels} onOpen={onOpen} showEmpty emptyCopy="尚未登记人物声音。" />
    </article>
  );
}

function LocationDetail({ story, storyLocation, onOpen }: { story: ProjectStoryReadModel; storyLocation: LocationReadModel; onOpen: StoryAssetOpenHandler }) {
  const imageLabels = Object.fromEntries(storyLocation.images.map((asset) => [asset.assetId, `${storyLocation.name} · 场景图片`]));
  const audioLabels = Object.fromEntries(storyLocation.ambientAudio.map((asset) => [asset.assetId, `${storyLocation.name} · 环境声音`]));
  return (
    <article className="story-detail-page">
      <Link className="story-back-link" to={projectStorySectionPath(story.project.id, "locations")}><ArrowLeft size={16} />返回场景设定</Link>
      <header className="detail-heading"><div><span className="story-eyebrow">LOCATION · {storyLocation.id}</span><h1>{storyLocation.name}</h1><p>{storyLocation.oneLineSetting ?? "项目级通用场景，可在不同分集和场次中复用。"}</p></div></header>
      <section className="entity-setting"><h2>场景设定</h2><p>{storyLocation.description ?? "当前索引已登记场景名称和稳定 ID，尚未补充独立场景设定说明。"}</p></section>
      <MaterialSection projectId={story.project.id} eyebrow="SETTING" title="设定文档" description="点击卡片在弹窗中查看完整设定。" assets={storyLocation.relatedFiles} onOpen={onOpen} showEmpty emptyCopy="当前场景没有单独绑定设定文档。" />
      <MaterialSection projectId={story.project.id} eyebrow="IMAGES" title="场景图片" description="只展示当前场景图片，可供多集复用。" assets={storyLocation.images} labels={imageLabels} onOpen={onOpen} showEmpty emptyCopy="尚未登记场景图片。" />
      <MaterialSection projectId={story.project.id} eyebrow="AMBIENCE" title="环境声音" description="点击音频卡片直接播放或暂停。" assets={storyLocation.ambientAudio} labels={audioLabels} onOpen={onOpen} showEmpty emptyCopy="尚未登记环境声音。" />
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
        <header><div><span className="story-eyebrow">EPISODE ASSETS</span><h3 id={`${scene.id}-dedicated-title`}>本场专属资源</h3><p>只展示当前有效版本；分镜提示词按片段顺序排列，图片集中查看关键帧与道具。</p></div><strong>{dedicatedCount} 项</strong></header>
        <div className="scene-dedicated-groups">
          <MaterialSection projectId={story.project.id} eyebrow="TEXT" title="文本类 · 分镜提示词" description="按 U01、U02… 顺序排列；点击卡片查看完整提示词。" assets={dedicatedAssets.textAssets} labels={dedicatedAssets.textLabels} onOpen={onOpen} headingLevel="h4" showEmpty emptyCopy="当前场次尚未登记分镜提示词。" />
          <MaterialSection projectId={story.project.id} eyebrow="IMAGES" title="图片类 · 分镜关键帧与道具" description="关键帧在前，道具在后；只展示仍在使用或等待验收的版本。" assets={dedicatedAssets.imageAssets} onOpen={onOpen} headingLevel="h4" showEmpty emptyCopy="当前场次尚未登记关键帧或道具图片。" />
        </div>
      </section>
      {issues.length > 0 && <details className="scene-production-state" open={focused}><summary>本场待处理 {issues.length} 项</summary><RequirementSummary requirements={issues} /></details>}
      {!focused && <Link className="scene-deep-link" to={projectScenePath(story.project.id, episodeId, scene.id)}>单独打开本场<ChevronRight size={15} /></Link>}
    </article>
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
    if (speakingCharacterIds.has(characterId)) for (const asset of character.voiceAssets) {
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
      locationAssets.push(asset);
      locationLabels[asset.assetId] = `${storyLocation.name} · ${asset.kind === "audio" ? "环境声音" : "场景图片"}`;
    }
  }
  return { characterAssets, characterLabels, locationAssets, locationLabels };
}

type EpisodeReusableAssetGroups = ReturnType<typeof collectEpisodeReusableAssets>;

function EpisodeReusableAssets({ story, groups, onOpen }: { story: ProjectStoryReadModel; groups: EpisodeReusableAssetGroups; onOpen: StoryAssetOpenHandler }) {
  return (
    <section className="episode-reusable-section">
      <header><div><span className="story-eyebrow">REUSABLE</span><h2>本集调用的通用资源</h2><p>这里只展示可跨场次或跨集复用的人物、声音与场景；道具归入对应场次的专属图片。</p></div></header>
      <MaterialSection projectId={story.project.id} title="人物与声音" description="本集实际出场造型；有对白的人物同时带出声音。" assets={groups.characterAssets} labels={groups.characterLabels} onOpen={onOpen} showEmpty emptyCopy="本集尚未绑定人物通用素材。" />
      <MaterialSection projectId={story.project.id} title="场景" description="当前场景母版与环境声音。" assets={groups.locationAssets} labels={groups.locationLabels} onOpen={onOpen} showEmpty emptyCopy="本集尚未绑定场景通用素材。" />
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
      <p>这里只关联当前生产素材，不展示参考、已拒绝或已废弃版本。统计以业务索引为准；未登记的剧本需求不会被自动算作齐套。</p>
      {gaps.length > 0 && <details><summary>查看 {gaps.length} 项明确缺口</summary><RequirementSummary requirements={gaps} /></details>}
    </section>
  );
}

function EpisodeDetail({ story, sceneId, onOpen }: { story: ProjectStoryReadModel; sceneId?: string; onOpen: StoryAssetOpenHandler }) {
  const episode = story.episode;
  if (!episode) return null;
  const selectedScene = sceneId ? episode.scenes.find((scene) => scene.id === sceneId) : undefined;
  const scenes = sceneId ? (selectedScene ? [selectedScene] : []) : episode.scenes;
  const documents = deduplicateAssets([episode.script, ...episode.relatedFiles]);
  const reusableGroups = collectEpisodeReusableAssets(story, episode);
  const dedicatedAssets = episode.scenes.map(collectSceneDedicatedAssets);
  const acceptanceAssets = deduplicateAssets([
    ...documents,
    ...reusableGroups.characterAssets,
    ...reusableGroups.locationAssets,
    ...episode.assets,
    ...dedicatedAssets.flatMap((group) => [...group.textAssets, ...group.imageAssets]),
  ]);
  return (
    <article className="story-detail-page episode-detail-page">
      <Link className="story-back-link" to={sceneId ? projectEpisodePath(story.project.id, episode.id) : projectStorySectionPath(story.project.id, "episodes")}><ArrowLeft size={16} />{sceneId ? `返回 ${episode.id}` : "返回分集"}</Link>
      <header className="detail-heading"><div><span className="story-eyebrow">{episode.id}</span><h1>{sceneId ? selectedScene?.heading ?? "场次不存在" : episode.title}</h1><p>{sceneId ? selectedScene?.summary ?? "这个场次不在当前分集索引中。" : episode.summary}</p></div>{sceneId && selectedScene && <CompletionLine completion={selectedScene.completion} />}</header>
      {!sceneId && <div className="episode-fact-row"><span><Users size={16} />{episode.characterIds.length} 位人物</span><span><MapPin size={16} />{episode.locationIds.length} 个场景</span><span><BookOpenText size={16} />{episode.sceneCount} 场</span></div>}
      {!sceneId && <EpisodeReusableAssets story={story} groups={reusableGroups} onOpen={onOpen} />}
      {!sceneId && <EpisodeAcceptanceSummary episode={episode} assets={acceptanceAssets} />}
      {!sceneId && <MaterialSection projectId={story.project.id} eyebrow="COPY" title="本集文案" description="卡片显示摘要；点击后在同页弹窗查看剧本与素材计划全文。" assets={documents} onOpen={onOpen} showEmpty emptyCopy="本集还没有绑定文案文件。" />}
      <section className="episode-scenes-section"><header><div><span className="story-eyebrow">SCENES</span><h2>{sceneId ? "场次详情" : "场次与逐镜提示词"}</h2><p>{sceneId ? "查看本场剧本、人物和专属制作资源。" : "已按场次自动关联分镜提示词；每场依次展示当前有效的 U01、U02…，再展示关键帧与道具。"}</p></div></header><div className="scene-list">{scenes.map((scene) => <SceneCard key={scene.id} story={story} episodeId={episode.id} scene={scene} focused={Boolean(sceneId)} onOpen={onOpen} />)}</div></section>
      {!sceneId && <MaterialSection projectId={story.project.id} eyebrow="EPISODE OUTPUT" title="本集成片与声音" description="本集级成片、BGM 与其他直接绑定到分集的产物。" assets={episode.assets} onOpen={onOpen} showEmpty emptyCopy="本集尚未登记分集级成片或声音。" />}
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
  const story = storyResult?.key === requestKey ? storyResult.story : undefined;
  const error = errorResult?.key === requestKey ? errorResult.message : "";

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

  if (!story && !error) return <div className="app-shell story-shell"><StoryHeader projects={projects} projectId={projectId} /><div className="story-loading"><RefreshCw size={24} className="spinning" />正在读取剧本业务索引…</div></div>;
  if (!story || error) return <div className="app-shell story-shell"><StoryHeader projects={projects} projectId={projectId} /><main className="story-unavailable"><PackageSearch size={38} /><h1>剧本业务索引尚不可用</h1><p>{error || "当前项目还没有 story-index.v1.json。"}</p><Link className="primary-button" to={projectLibraryPath(projectId)}>继续查看素材文件</Link></main></div>;

  return (
    <div className="app-shell story-shell">
      <StoryHeader story={story} projects={projects} projectId={projectId} />
      <div className="story-scroll">
        <MobileStorySections projectId={projectId} activeSection={activeSection} />
        <main className="story-page">
          <div className="story-layout">
            <StoryOutline story={story} activeSection={activeSection} activeEpisodeId={episodeId} />
            <div className="story-main-content">
              {characterId
                ? character
                  ? <CharacterDetail story={story} character={character} onOpen={(asset, siblingAssets) => setPreview(asset, false, siblingAssets)} />
                  : <div className="story-inline-error" role="alert">人物 {characterId} 不存在。<Link to={projectStorySectionPath(projectId, "characters")}>返回人物设定</Link></div>
                : locationId
                  ? storyLocation
                    ? <LocationDetail story={story} storyLocation={storyLocation} onOpen={(asset, siblingAssets) => setPreview(asset, false, siblingAssets)} />
                    : <div className="story-inline-error" role="alert">场景 {locationId} 不存在。<Link to={projectStorySectionPath(projectId, "locations")}>返回场景设定</Link></div>
                  : episodeId
                    ? <EpisodeDetail story={story} sceneId={sceneId} onOpen={(asset, siblingAssets) => setPreview(asset, false, siblingAssets)} />
                    : <StoryOverview story={story} activeSection={activeSection} onOpen={(asset, siblingAssets) => setPreview(asset, false, siblingAssets)} />}
            </div>
          </div>
        </main>
      </div>
      {previewAsset && previewAsset.kind !== "audio" && <StoryAssetModal projectId={projectId} asset={previewAsset} assets={previewAssets} onClose={() => setPreview(undefined, true)} onOpen={(asset) => setPreview(asset, true)} onOpenPath={openPath} />}
    </div>
  );
}
