import {
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FileText,
  ImageOff,
  MapPin,
  Mic2,
  PackageSearch,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { ProjectViewTabs } from "../components/ProjectViewTabs";
import { ThemeToggle } from "../components/ThemeToggle";
import { getProjects } from "../lib/materials";
import { getProjectStory, storyAssetLibraryPath } from "../lib/projectStory";
import {
  projectCharacterPath,
  projectEpisodePath,
  projectLibraryPath,
  projectScenePath,
  projectStoryPath,
} from "../lib/routes";
import type {
  CharacterReadModel,
  EpisodeSummaryReadModel,
  ProjectStoryReadModel,
  SceneReadModel,
  StoryAssetLink,
  StoryCompletion,
  StoryObjectStatus,
  StoryRequirementResult,
} from "../types/story";
import type { ProjectSummary } from "../types";

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

const roleCopy: Record<string, string> = {
  "character-standard": "人物造型",
  "voice-anchor": "角色声音",
  "scene-master": "场景母版",
  "prop-standard": "关键道具",
};

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

function AssetImage({ asset, alt, className = "" }: { asset?: StoryAssetLink; alt: string; className?: string }) {
  if (asset?.kind === "image" && asset.url) {
    return <img className={className} src={asset.url} alt={alt} loading="lazy" />;
  }
  return <span className={`story-image-placeholder ${className}`}><ImageOff size={28} /><span>{asset ? "图片绑定不可用" : "MISSING"}</span></span>;
}

function AssetLink({ projectId, asset, children }: { projectId: string; asset?: StoryAssetLink; children?: ReactNode }) {
  if (!asset?.url) return null;
  return (
    <Link className="story-file-link" to={storyAssetLibraryPath(projectId, asset)}>
      <FileText size={15} />{children ?? asset.name}<ChevronRight size={14} />
    </Link>
  );
}

function AssetEvidence({ asset, label }: { asset?: StoryAssetLink; label: string }) {
  if (!asset) return null;
  const verification = asset.verification;
  return (
    <span className="asset-evidence">
      <b>{label}：</b>
      {verification
        ? `${verification.kind ?? "已登记验收"}${verification.verifiedAt ? ` · ${verification.verifiedAt}` : ""}`
        : `索引状态 ${asset.status} · 未登记独立验收字段`}
    </span>
  );
}

function RelatedFiles({ projectId, files, label = "相关文件" }: { projectId: string; files: StoryAssetLink[]; label?: string }) {
  if (!files.length) return null;
  return (
    <section className="story-related-files" aria-label={label}>
      <strong>{label}</strong>
      <div>{files.map((file) => file.url
        ? <AssetLink key={file.assetId} projectId={projectId} asset={file} />
        : <span className="story-file-unavailable" key={file.assetId}><FileText size={15} />{file.name} · 路径不可用</span>)}</div>
    </section>
  );
}

function RequirementList({ projectId, requirements }: { projectId: string; requirements: StoryRequirementResult[] }) {
  if (!requirements.length) return <p className="story-empty-copy">当前对象没有登记必需素材。</p>;
  return (
    <ul className="requirement-list">
      {requirements.map((requirement) => (
        <li key={requirement.id}>
          <div className="requirement-heading">
            <span><b>{requirement.label}</b><small>{roleCopy[requirement.role] ?? requirement.role}</small></span>
            <StatusBadge status={requirement.status} detail={requirement.reason} />
          </div>
          <p>{requirement.reason}</p>
          {requirement.reasonCode && <code>{requirement.reasonCode}</code>}
          <span className="requirement-assets">
            <AssetLink projectId={projectId} asset={requirement.asset}>当前绑定</AssetLink>
            <AssetLink projectId={projectId} asset={requirement.suggestedAsset}>可改绑素材</AssetLink>
          </span>
          <span className="requirement-evidence">
            <AssetEvidence asset={requirement.asset} label="当前绑定" />
            <AssetEvidence asset={requirement.suggestedAsset} label="建议素材" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function StoryHeader({ story, projects }: { story?: ProjectStoryReadModel; projects: ProjectSummary[] }) {
  const navigate = useNavigate();
  const projectId = story?.project.id ?? "";
  return (
    <>
      <header className="app-header story-app-header">
        <div className="brand-block">
          <BrandMark />
          <div><strong>{story?.project.name ?? "短剧剧本"}</strong><span>AI 短剧素材中心 · 剧本业务视图</span></div>
        </div>
        <div className="header-actions story-header-actions">
          {projects.length > 0 && projectId && (
            <select name="story-project-switcher" className="project-switcher" aria-label="切换短剧项目" value={projectId} onChange={(event) => navigate(projectStoryPath(event.target.value))}>
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

function StoryOutline({ story }: { story: ProjectStoryReadModel }) {
  return (
    <aside className="story-outline" aria-label="剧本目录">
      <strong>剧本目录</strong>
      <Link to={`${projectStoryPath(story.project.id)}#overview`}>故事大概</Link>
      <Link to={`${projectStoryPath(story.project.id)}#characters`}>角色设定</Link>
      <Link to={`${projectStoryPath(story.project.id)}#episodes`}>分集视角</Link>
      <span>分集</span>
      {story.episodes.map((episode) => <Link key={episode.id} to={projectEpisodePath(story.project.id, episode.id)}><b>{episode.id}</b>{episode.title}</Link>)}
    </aside>
  );
}

function StoryContext({ story }: { story: ProjectStoryReadModel }) {
  const dueEpisodes = new Set(story.currentMilestone.episodeIds);
  const dueRequirements = story.episodes.filter((episode) => dueEpisodes.has(episode.id)).flatMap((episode) => episode.requirements);
  const missing = dueRequirements.filter((requirement) => requirement.status === "MISSING" || requirement.status === "BLOCKED");
  return (
    <aside className="story-context" aria-label="当前里程碑和缺口">
      <section>
        <span className="story-context-label">当前里程碑</span>
        <strong>{story.currentMilestone.name ?? story.currentMilestone.id}</strong>
        <p>{story.currentMilestone.episodeIds.length ? story.currentMilestone.episodeIds.join("、") : "尚未指定制作分集"}</p>
      </section>
      <section>
        <span className="story-context-label">明确缺口</span>
        <strong>{missing.length} 项</strong>
        <p>{missing.length ? missing.slice(0, 3).map((requirement) => requirement.label).join("、") : "当前索引未发现阻塞项"}</p>
      </section>
      <section>
        <span className="story-context-label">待归档文件</span>
        <strong>{story.unregisteredAssets.length} 个</strong>
        <p>只增加待归档，不改变故事结构或基础完成度。</p>
      </section>
    </aside>
  );
}

function MobileStorySections({ projectId }: { projectId: string }) {
  return (
    <nav className="story-mobile-sections" aria-label="剧本章节">
      <Link to={`${projectStoryPath(projectId)}#overview`}>故事大概</Link>
      <Link to={`${projectStoryPath(projectId)}#characters`}>角色设定</Link>
      <Link to={`${projectStoryPath(projectId)}#episodes`}>分集视角</Link>
    </nav>
  );
}

function CharacterCard({ projectId, character }: { projectId: string; character: CharacterReadModel }) {
  const defaultLook = character.looks.find((look) => look.id === character.defaultLookId) ?? character.looks[0];
  return (
    <article className="story-character-card">
      <Link to={projectCharacterPath(projectId, character.id)} aria-label={`查看角色：${character.name}`}>
        <div className="character-card-image">
          <AssetImage asset={character.cardImage} alt={`${character.name}当前选定人物图`} />
          <StatusBadge status={character.cardImageStatus} detail={character.cardImageReason} />
        </div>
        <div className="character-card-copy">
          <span className="story-eyebrow">{character.storyRole} · {character.id}</span>
          <h3>{character.name}</h3>
          <p>{character.oneLineSetting}</p>
          <p className="character-biography-preview">{character.biography}</p>
          <span className="keyword-row">{character.personality.map((keyword) => <i key={keyword}>{keyword}</i>)}</span>
          {defaultLook && <small>主造型：{defaultLook.name} · {statusCopy[defaultLook.status]}</small>}
          <CompletionLine completion={character.completion} />
          <span className="card-open-link">角色设定与素材<ChevronRight size={16} /></span>
        </div>
      </Link>
    </article>
  );
}

function EpisodeCard({ story, episode }: { story: ProjectStoryReadModel; episode: EpisodeSummaryReadModel }) {
  const cast = episode.characterIds.map((id) => story.characters.find((character) => character.id === id)).filter((character): character is CharacterReadModel => Boolean(character));
  return (
    <article className="story-episode-card">
      <Link to={projectEpisodePath(story.project.id, episode.id)}>
        <header><span>{episode.id}</span><StatusBadge status={episode.completion.status} /></header>
        <h3>{episode.title}</h3>
        <p>{episode.summary}</p>
        <div className="episode-card-meta"><span>{episode.sceneCount} 场</span><span>{episode.locationIds.length} 个地点</span></div>
        <span className="cast-avatar-row">
          {cast.slice(0, 4).map((character) => (
            <span key={character.id} title={character.name}><AssetImage asset={character.cardImage} alt={character.name} /><b>{character.name}</b></span>
          ))}
        </span>
        <CompletionLine completion={episode.completion} />
      </Link>
    </article>
  );
}

function StoryOverview({ story }: { story: ProjectStoryReadModel }) {
  return (
    <>
      <section className="story-hero" aria-labelledby="story-title">
        <span className="story-eyebrow">故事摘要 · {story.story.summaryStatus}</span>
        <h1 id="story-title">{story.story.title}</h1>
        <div className="story-meta-row">
          {story.story.genre.map((genre) => <span key={genre}>{genre}</span>)}
          <span>{story.story.totalEpisodes} 集</span>
          {story.story.productionScope && <span>{story.story.productionScope}</span>}
        </div>
        <blockquote>{story.story.logline}</blockquote>
        {story.story.source
          ? <div className="story-source-binding"><span>当前剧本 · {story.story.source.name} · {story.story.source.status}{story.story.source.legacyPath ? " · LEGACY PATH" : ""}</span><AssetLink projectId={story.project.id} asset={story.story.source}>打开当前剧本文档</AssetLink></div>
          : <span className="story-source-missing">当前剧本文档未绑定</span>}
        <RelatedFiles projectId={story.project.id} files={story.relatedFiles} label="项目相关文档" />
      </section>

      <section className="story-mobile-context" aria-label="当前制作状态">
        <span><b>{story.currentMilestone.name ?? story.currentMilestone.id}</b><small>当前里程碑</small></span>
        <span><b>{story.unregisteredAssets.length}</b><small>待归档文件</small></span>
      </section>

      <section className="story-section" id="overview">
        <header><span className="story-section-icon"><BookOpenText size={19} /></span><div><span className="story-eyebrow">01 · STORY</span><h2>故事大概</h2></div></header>
        <div className="story-prose"><p>{story.story.synopsis}</p></div>
        {(story.story.coreConflict || story.story.relationshipArc || story.story.worldRules?.length) && (
          <div className="story-fact-grid">
            {story.story.coreConflict && <section><span>核心矛盾</span><p>{story.story.coreConflict}</p></section>}
            {story.story.relationshipArc && <section><span>关系主线</span><p>{story.story.relationshipArc}</p></section>}
            {story.story.worldRules?.length && <section><span>世界规则</span><p>{story.story.worldRules.join("；")}</p></section>}
          </div>
        )}
      </section>

      <section className="story-section" id="characters">
        <header><span className="story-section-icon"><Users size={19} /></span><div><span className="story-eyebrow">02 · CHARACTERS</span><h2>角色设定与图片</h2></div><small>{story.characters.length} 位角色</small></header>
        <div className="story-character-grid">{story.characters.map((character) => <CharacterCard key={character.id} projectId={story.project.id} character={character} />)}</div>
      </section>

      <section className="story-section" id="episodes">
        <header><span className="story-section-icon"><Sparkles size={19} /></span><div><span className="story-eyebrow">03 · EPISODES</span><h2>分集视角</h2></div><small>{story.episodes.length} / {story.story.totalEpisodes} 集已索引</small></header>
        <div className="story-episode-grid">{story.episodes.map((episode) => <EpisodeCard key={episode.id} story={story} episode={episode} />)}</div>
      </section>
    </>
  );
}

function CharacterDetail({ story, character }: { story: ProjectStoryReadModel; character: CharacterReadModel }) {
  return (
    <article className="story-detail-page">
      <Link className="story-back-link" to={`${projectStoryPath(story.project.id)}#characters`}><ArrowLeft size={16} />返回角色设定</Link>
      <header className="detail-heading">
        <div><span className="story-eyebrow">{character.storyRole} · {character.id}</span><h1>{character.name}</h1><p>{character.oneLineSetting}</p></div>
        <CompletionLine completion={character.completion} />
      </header>
      <section className="character-detail-grid">
        <div className="character-detail-image">
          <AssetImage asset={character.cardImage} alt={`${character.name}角色卡展示图`} />
          <StatusBadge status={character.cardImageStatus} detail={character.cardImageReason} />
          <p className="character-card-reason">{character.cardImageReason}</p>
          <AssetEvidence asset={character.cardImage} label="角色卡图片" />
          <AssetLink projectId={story.project.id} asset={character.cardImage}>打开角色卡图片</AssetLink>
        </div>
        <div className="character-biography"><h2>人物小传</h2><p>{character.biography}</p><h3>性格关键词</h3><span className="keyword-row">{character.personality.map((keyword) => <i key={keyword}>{keyword}</i>)}</span><p className="appearance-copy">出现于 {character.episodeIds.length ? character.episodeIds.join("、") : "尚未登记分集"} · 共 {character.sceneCount} 场</p></div>
      </section>
      <RelatedFiles projectId={story.project.id} files={character.relatedFiles} label="角色相关文档" />
      <section className="story-section compact-section"><header><div><span className="story-eyebrow">LOOKS</span><h2>造型与状态</h2></div></header><div className="look-grid">{character.looks.map((look) => {
        const image = look.preferredAsset;
        return <article key={look.id}><div><AssetImage asset={image} alt={`${character.name}${look.name}`} /><StatusBadge status={look.status} /></div><span className="story-eyebrow">{lookKindCopy[look.kind]}</span><h3>{look.name}</h3><code>{look.id}</code>{look.applicableEpisodeIds.length > 0 && <p>适用：{look.applicableEpisodeIds.join("、")}</p>}<AssetLink projectId={story.project.id} asset={image}>打开造型文件</AssetLink></article>;
      })}</div></section>
      <section className="story-section compact-section"><header><span className="story-section-icon"><Mic2 size={18} /></span><div><span className="story-eyebrow">REQUIREMENTS</span><h2>角色素材与缺口</h2></div></header><RequirementList projectId={story.project.id} requirements={character.requirements} /></section>
    </article>
  );
}

function SceneCard({ story, episodeId, scene, focused = false }: { story: ProjectStoryReadModel; episodeId: string; scene: SceneReadModel; focused?: boolean }) {
  return (
    <article className={`story-scene-card${focused ? " focused" : ""}`} id={scene.id}>
      <header>
        <div><span className="story-eyebrow">{scene.id}</span><h2>{scene.heading}</h2>{scene.locationName && <p><MapPin size={14} />{scene.locationName}</p>}</div>
        <StatusBadge status={scene.completion.status} />
      </header>
      {scene.summary && <p className="scene-summary">{scene.summary}</p>}
      {scene.scriptExcerpt && <blockquote className="scene-excerpt">{scene.scriptExcerpt}</blockquote>}
      <section className="scene-cast"><h3>出场人物与本场造型</h3><div>{scene.cast.map((member) => {
        const character = story.characters.find((candidate) => candidate.id === member.characterId);
        return <Link key={`${scene.id}-${member.characterId}`} to={projectCharacterPath(story.project.id, member.characterId)}><AssetImage asset={character?.cardImage} alt={member.characterName} /><span><b>{member.characterName}</b><small>{member.lookName ?? member.lookId ?? "未指定造型"}{member.speaks ? " · 有对白" : ""}</small></span></Link>;
      })}</div></section>
      {scene.props.length > 0 && <section className="scene-props"><h3>关键道具</h3><div>{scene.props.map((prop) => prop.asset?.url
        ? <Link key={prop.id} to={storyAssetLibraryPath(story.project.id, prop.asset)}><PackageSearch size={16} /><span><b>{prop.id}</b><small>{prop.asset?.name}</small></span><StatusBadge status={prop.status} /></Link>
        : <span key={prop.id}><PackageSearch size={16} /><b>{prop.id}</b><StatusBadge status={prop.status} /></span>)}</div></section>}
      <section className="scene-requirements"><h3>基础素材状态</h3><CompletionLine completion={scene.completion} /><RequirementList projectId={story.project.id} requirements={scene.requirements} /></section>
      {(scene.relatedFiles.length > 0 || scene.derivedAssets.length > 0) && (
        <details className="scene-secondary-assets" open={focused}>
          <summary>相关文件与衍生素材（{scene.relatedFiles.length + scene.derivedAssets.length}）</summary>
          <RelatedFiles projectId={story.project.id} files={scene.relatedFiles} label="场次相关文档" />
          <div className="derived-asset-grid">{scene.derivedAssets.map((asset) => <Link key={asset.assetId} to={storyAssetLibraryPath(story.project.id, asset)}><AssetImage asset={asset} alt={asset.name} /><span>{asset.name}</span><small>{asset.status}</small></Link>)}</div>
          <p>关键帧、动作板和连续性帧默认不进入基础完成度。</p>
        </details>
      )}
      {!focused && <Link className="scene-deep-link" to={projectScenePath(story.project.id, episodeId, scene.id)}>打开场次详情<ChevronRight size={15} /></Link>}
    </article>
  );
}

function EpisodeDetail({ story, sceneId }: { story: ProjectStoryReadModel; sceneId?: string }) {
  const episode = story.episode;
  if (!episode) return null;
  const selectedScene = sceneId ? episode.scenes.find((scene) => scene.id === sceneId) : undefined;
  const scenes = sceneId ? (selectedScene ? [selectedScene] : []) : episode.scenes;
  return (
    <article className="story-detail-page episode-detail-page">
      <Link className="story-back-link" to={sceneId ? projectEpisodePath(story.project.id, episode.id) : `${projectStoryPath(story.project.id)}#episodes`}><ArrowLeft size={16} />{sceneId ? `返回 ${episode.id}` : "返回分集视角"}</Link>
      <header className="detail-heading">
        <div><span className="story-eyebrow">{episode.id} · {episode.summaryStatus}</span><h1>{sceneId ? selectedScene?.heading ?? "场次不存在" : episode.title}</h1><p>{sceneId ? selectedScene?.summary ?? "这个场次不在当前分集索引中。" : episode.summary}</p></div>
        <CompletionLine completion={sceneId && selectedScene ? selectedScene.completion : episode.completion} />
      </header>
      {!sceneId && <AssetLink projectId={story.project.id} asset={episode.script}>打开本集剧本文档</AssetLink>}
      {!sceneId && <RelatedFiles projectId={story.project.id} files={episode.relatedFiles} label="本集相关文档" />}
      <div className="episode-fact-row"><span><Users size={16} />{episode.characterIds.length} 位人物</span><span><MapPin size={16} />{episode.locationIds.length} 个地点</span><span><BookOpenText size={16} />{episode.sceneCount} 场</span></div>
      <section className="scene-list" aria-label={`${episode.id} 场次`}>{scenes.map((scene) => <SceneCard key={scene.id} story={story} episodeId={episode.id} scene={scene} focused={Boolean(sceneId)} />)}</section>
      {sceneId && !selectedScene && <div className="story-inline-error" role="alert">场次 {sceneId} 不存在。<Link to={projectEpisodePath(story.project.id, episode.id)}>查看本集全部场次</Link></div>}
    </article>
  );
}

export function ProjectStoryPage() {
  const { projectId = "", characterId, episodeId, sceneId } = useParams();
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
      .then(([nextStory, projectResponse]) => {
        setStoryResult({ key: requestKey, story: nextStory });
        setProjects(projectResponse.projects);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setErrorResult({ key: requestKey, message: reason instanceof Error ? reason.message : "无法读取剧本业务索引" });
        }
      });
    return () => controller.abort();
  }, [episodeId, projectId, requestKey]);

  const character = useMemo(() => story?.characters.find((candidate) => candidate.id === characterId), [characterId, story]);

  if (!story && !error) {
    return <div className="app-shell story-shell"><StoryHeader projects={projects} /><div className="story-loading"><RefreshCw size={24} className="spinning" />正在读取剧本业务索引…</div></div>;
  }

  if (!story || error) {
    return (
      <div className="app-shell story-shell">
        <StoryHeader projects={projects} />
        <main className="story-unavailable"><PackageSearch size={38} /><h1>剧本业务索引尚不可用</h1><p>{error || "当前项目还没有 story-index.v1.json。"}</p><Link className="primary-button" to={projectLibraryPath(projectId)}>继续查看素材文件</Link></main>
      </div>
    );
  }

  return (
    <div className="app-shell story-shell">
      <StoryHeader story={story} projects={projects} />
      <div className="story-scroll">
        <MobileStorySections projectId={projectId} />
        <main className="story-page">
          <div className="story-layout">
            <StoryOutline story={story} />
            <div className="story-main-content">
              {characterId
                ? character
                  ? <CharacterDetail story={story} character={character} />
                  : <div className="story-inline-error" role="alert">角色 {characterId} 不存在。<Link to={`${projectStoryPath(projectId)}#characters`}>返回角色设定</Link></div>
                : episodeId
                  ? <EpisodeDetail story={story} sceneId={sceneId} />
                  : <StoryOverview story={story} />}
            </div>
            <StoryContext story={story} />
          </div>
        </main>
      </div>
    </div>
  );
}
