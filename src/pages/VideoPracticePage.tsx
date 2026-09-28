import { ArrowLeft, ArrowRight, BookOpenText, Check, ChevronRight, Clapperboard, ExternalLink, Search } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { PracticeConcepts } from "../components/practice/PracticeConcepts";
import { PracticeRounds } from "../components/practice/PracticeRounds";
import { PracticeReferencePlayer } from "../components/practice/PracticeReferencePlayer";
import { practiceExercises, practiceTracks } from "../data/videoPracticeCurriculum";
import { knowledgeAreaPath } from "../lib/routes";
import { isReadyPracticeExercise, safePracticeUrl, type PracticeExercise } from "../lib/videoPractice";
import "../practice.css";

const basePath = "/ai-video-practice";
const originalUrl = "https://www.douyin.com/video/7672693169921723684";
const exercisePath = (id: string) => `${basePath}/${encodeURIComponent(id)}`;
const stamp = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
const readyExercises = () => practiceExercises.filter(isReadyPracticeExercise);

function PracticeShell({ children }: { children: ReactNode }) {
  return <div className="app-shell practice-shell">
    <header className="app-header practice-header">
      <Link className="practice-brand" to={basePath}><strong>原片拆解 · AI 练习</strong><span>我的妹妹不可爱</span></Link>
      <nav className="practice-header-nav" aria-label="工作台导航">
        <Link to="/knowledge">导演知识库</Link><Link to="/ai-video-radar">历史雷达</Link><Link to="/">所有项目</Link><ThemeToggle />
      </nav>
    </header>{children}
  </div>;
}

function Workflow() {
  return <ol className="practice-workflow" aria-label="练习流程">{["看原片段落", "理解创作选择", "AI 短样验证", "完成原创短片"].map((stage, index) => <li key={stage}><span>{index + 1}</span>{stage}{index < 3 && <ArrowRight size={18} aria-hidden="true" />}</li>)}</ol>;
}

export function VideoPracticeListPage() {
  const [params, setParams] = useSearchParams();
  const track = params.get("track") ?? "";
  const query = params.get("q") ?? "";
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const eligible = readyExercises();
  const exercises = eligible.filter((item) => (!track || item.trackId === track) && (!normalizedQuery || [item.title, item.summary, item.goal, item.film.title, item.science?.filmChoice].join(" ").toLocaleLowerCase().includes(normalizedQuery)));
  function filter(key: string, value: string) { setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: key === "q" }); }
  useEffect(() => { document.title = "我的妹妹不可爱 · 原片拆解训练"; }, []);
  return <PracticeShell><div className="practice-layout">
    <aside className="practice-track-nav" aria-label="专项分类">
      <button className={!track ? "is-active" : ""} onClick={() => filter("track", "")} aria-pressed={!track}>全部专项 <span>{eligible.length}</span></button>
      {practiceTracks.map((item) => <button key={item.id} className={track === item.id ? "is-active" : ""} aria-pressed={track === item.id} onClick={() => filter("track", item.id)}>{item.title}<span>{eligible.filter((exercise) => exercise.trackId === item.id).length}</span></button>)}
      <p>一部原片，几个值得拆开的创作选择。每次选一项，用 AI 完成自己的作品。</p>
      <a className="practice-source-link" href={originalUrl} target="_blank" rel="noreferrer">去抖音看原片 <ExternalLink size={14} /></a>
    </aside>
    <main className="practice-catalog">
      <div className="practice-intro"><span className="practice-subtle-label">罗臣臣 · 第 1 集 · 06:43 版本</span><h1>《我的妹妹不可爱》<br />拆解训练项目</h1><p>从原片的具体段落出发，理解方法，再生成一支 1–2 分钟的原创短片。</p></div>
      <Workflow />
      <div className="practice-project-reading"><strong>先理解这部片的质感</strong><p>2008 年小城生活的写实底色，结合夸张喜剧与浪漫化人物亮相。年代来自美术与生活细节；不同段落的光线、表演和节奏各有目的。</p><small>这是基于画面的分析判断，并非原作者公布的摄影方案或模型配方。</small></div>
      <div className="practice-recommended"><strong>可以先看</strong>{eligible.filter((item) => item.recommended).map((item) => <Link key={item.id} to={exercisePath(item.id)}>{item.title}<ChevronRight size={15} /></Link>)}</div>
      <label className="practice-search"><Search size={18} /><input type="search" aria-label="搜索专项" placeholder="搜索风格、表演、揭示或剪辑" value={query} onChange={(event) => filter("q", event.target.value)} /></label>
      <div className="practice-result-summary" role="status"><span>每项都有：原片段落 → 通识比较 → 本片选择 → AI 练习 → 成片与教程</span><span>{exercises.length} 个专项</span></div>
      <div className="practice-case-list">{exercises.map((item) => <article className="practice-case-row" key={item.id}>
        <span className="practice-number">{String(item.number).padStart(2, "0")}</span>
        <div className="practice-exercise-title"><Link to={`${exercisePath(item.id)}${params.size ? `?${params}` : ""}`}><h2>{item.title}</h2></Link><p>{item.summary}</p><div className="practice-case-meta"><span>{item.segment ? `${stamp(item.segment.start)}–${stamp(item.segment.end)}` : "原片片段"}</span><span>{item.segment?.label.split("·").slice(1).join("·").trim()}</span></div></div>
        <div className="practice-film-title"><small>原创练习提案</small>{item.film.title}<small>{item.film.duration} · {item.level}</small></div>
        <Link className="practice-case-open" aria-label={`拆解${item.title}`} to={`${exercisePath(item.id)}${params.size ? `?${params}` : ""}`}>拆解<ArrowRight size={17} /></Link>
      </article>)}</div>
      {!exercises.length && <div className="practice-empty"><h2>没有匹配的专项</h2><button className="secondary-button" onClick={() => setParams({})}>显示全部专项</button></div>}
      <footer className="practice-catalog-note">时间码以用户提供的 06:43 本地版为准，是回看范围，不是逐帧剪辑点。各项共用同一原作，练习故事为候选。已核对原发布页和画面；未据抽帧推断原作者的模型、提示词、成本或完整声音设计。</footer>
    </main>
  </div></PracticeShell>;
}

function TextList({ items, ordered = false }: { items: string[]; ordered?: boolean }) { return ordered ? <ol className="practice-text-list">{items.map((text) => <li key={text}>{text}</li>)}</ol> : <ul className="practice-text-list">{items.map((text) => <li key={text}>{text}</li>)}</ul>; }
function SectionHeading({ number, children }: { number: string; children: ReactNode }) { return <div className="practice-section-heading"><span>{number}</span><h2>{children}</h2></div>; }

function ExerciseContent({ exercise }: { exercise: PracticeExercise }) {
  const { experiment, science, segment } = exercise;
  return <div className="practice-detail-grid"><div className="practice-lesson">
    <section id="reference"><SectionHeading number="01">先看原片这一段</SectionHeading>
      {exercise.references.filter((reference) => reference.status === "verified").map((reference) => <div className="practice-source-card" key={reference.id}>
        <span className="practice-subtle-label">{reference.platform}原作 · {reference.author} · {reference.durationLabel}</span>
        <h3><a href={safePracticeUrl(reference.url) ?? undefined} target="_blank" rel="noreferrer">{reference.title}<ExternalLink size={15} /></a></h3>
        <p><strong>回看位置：</strong>{reference.locate}</p><p><strong>对照重点：</strong>{reference.focus}</p>
        <details><summary>来源与分析范围</summary><p>{reference.evidence}</p><p>来源核对日期：{reference.verifiedAt}。外部链接打开原作，不会自动跳到片段。</p></details>
      </div>)}
      <PracticeReferencePlayer start={segment?.start} end={segment?.end} label={segment?.label} />
      {segment && <><h3>画面中能直接看到什么</h3><TextList items={segment.observations} /><div className="practice-interpretation"><strong>这段为什么值得练 · 分析判断</strong><p>{segment.mechanism}</p></div></>}
    </section>
    {science && <section id="science"><SectionHeading number="02">先补这项通识</SectionHeading><p className="practice-goal">{science.question}</p>
      <PracticeConcepts concepts={science.concepts} />
      <div className="practice-film-choice"><h3>本片这次选择了什么</h3><p>{science.filmChoice}</p><p>{science.evidence}</p></div><h3>换成 AI 生成，要控制什么</h3><TextList items={science.generationTranslation} /><p className="practice-form-hint">{science.boundary}</p>
    </section>}
    <section id="principles"><SectionHeading number="03">本专项要练到什么</SectionHeading><p className="practice-goal">{exercise.goal}</p><TextList items={exercise.principles} /></section>
    <section id="experiment"><SectionHeading number="04">先验证一个短样</SectionHeading><p>目标确定后，用一小段生成验证关键效果，再展开成片。</p><div className="practice-variable"><strong>重点变量</strong><span>{experiment.variable}</span></div><div className="practice-ab"><div><span>A · 对照</span><p>{experiment.baseline}</p></div><div><span>B · 尝试</span><p>{experiment.variant}</p></div></div><dl className="practice-facts"><div><dt>保持一致</dt><dd>{experiment.fixed}</dd></div><div><dt>观察结果</dt><dd>{experiment.inspect}</dd></div><div><dt>何时停止</dt><dd>{experiment.stop}</dd></div></dl></section>
    <section id="film"><SectionHeading number="05">这次可以做成什么</SectionHeading><div className="practice-film-proposal"><span className="practice-subtle-label">原创候选 · {exercise.film.duration}</span><h3>《{exercise.film.title.replace(/[《》]/g, "")}》</h3><p>{exercise.film.premise}</p><p className="practice-scope">{exercise.film.scope}</p><TextList items={exercise.film.beats} ordered /><p className="practice-form-hint">提案用于讨论。进入“本轮作品”确定要学的效果、故事与画幅，再设计试片。原作人物、对白和音乐不直接移植到练习里。</p></div></section>
    <section id="acceptance"><SectionHeading number="06">怎样判断练到了</SectionHeading><ul className="practice-checklist">{exercise.acceptance.map((text) => <li key={text}><Check size={17} /><span>{text}</span></li>)}</ul><h3>容易练偏的地方</h3><TextList items={exercise.pitfalls} /></section>
    <section id="publishing"><SectionHeading number="07">成片与教程怎么分享</SectionHeading><div className="practice-publishing"><div><Clapperboard size={20} /><span>作品方向</span><h3>{exercise.publishing.workTitle}</h3><p>用自己的原创故事呈现这次练到的效果。</p></div><div><BookOpenText size={20} /><span>教程方向</span><h3>{exercise.publishing.tutorialTitle}</h3><TextList items={exercise.publishing.outline} /></div></div></section>
  </div><aside className="practice-detail-aside"><nav aria-label="专项详情目录"><strong>这一项怎么练</strong>{[["reference", "原片段落与拆解"], ["science", "通识与本片选择"], ["principles", "训练目标"], ["experiment", "AI 短样"], ["film", "原创成片提案"], ["acceptance", "验收与复盘"], ["publishing", "作品与教程"]].map(([id, title]) => <a key={id} href={`#${id}`}>{title}<ChevronRight size={14} /></a>)}</nav><div className="practice-knowledge-links"><strong>对应资料库</strong>{exercise.sources.map((source) => <Link key={`${source.area}/${source.path}`} to={knowledgeAreaPath(source.area, source.path)}><BookOpenText size={17} /><span><b>{source.path.replace(/\.md$/, "")}</b><small>{source.why}</small></span><ChevronRight size={14} /></Link>)}</div></aside></div>;
}

export function VideoPracticeDetailPage() {
  const { exerciseId } = useParams();
  const [params, setParams] = useSearchParams();
  const exercise = readyExercises().find((item) => item.id === exerciseId);
  const showRounds = params.get("tab") === "rounds";
  const returnParams = new URLSearchParams(params); returnParams.delete("tab");
  const backPath = `${basePath}${returnParams.size ? `?${returnParams}` : ""}`;
  useEffect(() => {
    document.title = exercise ? `${exercise.title} · 我的妹妹不可爱拆解` : "专项不存在 · 原片拆解";
    const section = document.getElementById(window.location.hash.slice(1));
    if (section) section.scrollIntoView();
    else document.querySelector(".practice-shell")?.scrollTo(0, 0);
  }, [exercise]);
  function switchTab(rounds: boolean) { setParams((current) => { const next = new URLSearchParams(current); if (rounds) next.set("tab", "rounds"); else next.delete("tab"); return next; }); }
  if (!exercise) return <PracticeShell><main className="practice-empty"><h1>这项练习尚未开放</h1><p>只有关联具体原片段落的专项才会出现在这里。</p><Link className="primary-button" to={basePath}>返回原片项目</Link></main></PracticeShell>;
  return <PracticeShell><main className="practice-detail" key={exercise.id}><Link className="practice-back" to={backPath}><ArrowLeft size={16} />《我的妹妹不可爱》全部专项</Link><header className="practice-detail-heading"><div><p>专项 {String(exercise.number).padStart(2, "0")} · {exercise.segment ? `${stamp(exercise.segment.start)}–${stamp(exercise.segment.end)}` : "原片拆解"}</p><h1>{exercise.title}</h1><span>{exercise.summary}</span></div><button className="primary-button" onClick={() => switchTab(true)}>规划本轮作品<ArrowRight size={16} /></button></header>
    <nav className="practice-tabs" aria-label="专项内容"><button aria-pressed={!showRounds} onClick={() => switchTab(false)}>原片拆解与练习</button><button aria-pressed={showRounds} onClick={() => switchTab(true)}>本轮作品</button></nav><div>{showRounds ? <PracticeRounds exercise={exercise} /> : <ExerciseContent exercise={exercise} />}</div>
  </main></PracticeShell>;
}
