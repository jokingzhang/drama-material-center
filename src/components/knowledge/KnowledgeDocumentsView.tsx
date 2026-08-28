import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  Clapperboard,
  FileText,
  Images,
  Lightbulb,
  Play,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useSearchParams } from "react-router-dom";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
  getKnowledgeCase,
  getKnowledgeDocument,
  knowledgeAreas,
  listKnowledgeCases,
  listKnowledgeDocuments,
  normalizeKnowledgeDocumentPath,
  splitKnowledgeCaseMarkdown,
  summarizeKnowledgeCaseMarkdown,
  type KnowledgeAreaId,
  type KnowledgeCase,
  type KnowledgeCasePreview,
  type KnowledgeDocument,
} from "../../lib/knowledgeDocuments";
import { knowledgeAreaPath, knowledgeCasePath, type KnowledgeCaseEntry } from "../../lib/routes";

const areaIcons: Record<KnowledgeAreaId, LucideIcon> = {
  script: Lightbulb,
  "image-asset": Images,
  "shot-prompt": Clapperboard,
};

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join("");
  return "";
}

function isLocalCaseVideo(href: string, children: ReactNode) {
  return href.startsWith("/knowledge-media/")
    && /\.mp4(?:[?#].*)?$/i.test(href)
    && textFromChildren(children).includes("播放");
}

function LocalCaseVideo({ href, children }: { href: string; children: ReactNode }) {
  const label = textFromChildren(children) || "播放案例视频";
  return (
    <span className="knowledge-video-embed">
      <video aria-label={label} controls playsInline preload="metadata" src={href} />
      <a href={href} target="_blank" rel="noreferrer"><Play size={15} aria-hidden="true" />{label}</a>
    </span>
  );
}

function MarkdownLink({
  area,
  currentPath,
  href,
  children,
}: {
  area?: KnowledgeAreaId;
  currentPath?: string;
  href?: string;
  children: ReactNode;
}) {
  if (!href) return <span>{children}</span>;
  if (isLocalCaseVideo(href, children)) return <LocalCaseVideo href={href}>{children}</LocalCaseVideo>;
  if (/^(?:https?:|mailto:)/i.test(href)) return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
  if (href.startsWith("/")) return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
  if (!area || !currentPath) return <span className="knowledge-unavailable-link">{children}</span>;

  const resolved = normalizeKnowledgeDocumentPath(currentPath, href);
  if (!resolved || !getKnowledgeDocument(area, resolved.path)) return <span className="knowledge-unavailable-link">{children}</span>;
  const hash = resolved.hash ? `#${encodeURIComponent(resolved.hash)}` : "";
  return <Link to={`${knowledgeAreaPath(area, resolved.path)}${hash}`}>{children}</Link>;
}

function KnowledgeMarkdown({
  body,
  area,
  currentPath,
}: {
  body: string;
  area?: KnowledgeAreaId;
  currentPath?: string;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        a({ href, children }) {
          return <MarkdownLink area={area} currentPath={currentPath} href={href}>{children}</MarkdownLink>;
        },
        img({ src, alt }) {
          return src ? <img loading="lazy" src={src} alt={alt ?? ""} /> : null;
        },
      }}
    >{body}</ReactMarkdown>
  );
}

export function KnowledgeHomeView() {
  return (
    <main className="knowledge-page">
      <section className="knowledge-hero">
        <span>AI DIRECTOR WORK MANUAL</span>
        <h1>你给想法或剧本，AI 负责把它推进到图片和分镜</h1>
        <p>知识库由 AI 维护。你不需要登记知识、理解接口或管理文档，只需要查看结果并确认真正会改变创作方向的选择。</p>
      </section>

      <section className="knowledge-simple-flow" aria-label="AI 导演工作链路">
        <div><b>01</b><strong>想法或剧本</strong><span>一句话、梗概、小说片段或完整剧本都可以</span></div>
        <ArrowRight aria-hidden="true" />
        <div><b>02</b><strong>故事确认</strong><span>先把故事补到能拍，只让你决定关键方向</span></div>
        <ArrowRight aria-hidden="true" />
        <div><b>03</b><strong>图片素材</strong><span>列出要做什么图，以及每张图的标准</span></div>
        <ArrowRight aria-hidden="true" />
        <div><b>04</b><strong>分镜提示词</strong><span>按镜头任务拆分，形成可执行提示词</span></div>
      </section>

      <section className="knowledge-area-grid">
        {knowledgeAreas.map((area) => {
          const Icon = areaIcons[area.id];
          return (
            <article className="knowledge-area-card" key={area.id}>
              <Icon size={24} aria-hidden="true" />
              <span>{area.question}</span>
              <h2>{area.title}</h2>
              <p>输出：{area.result}</p>
              <Link to={knowledgeAreaPath(area.id)}>查看这部分知识 <ArrowRight size={17} /></Link>
            </article>
          );
        })}
      </section>

      <section className="knowledge-plain-note">
        <BookOpenText size={20} aria-hidden="true" />
        <div><strong>渐进式读取</strong><p>AI 每次只读当前问题相关的几篇文档；案例和研究证据只在确实需要时继续展开。</p></div>
      </section>
    </main>
  );
}

function DocumentLink({ area, document }: { area: KnowledgeAreaId; document: KnowledgeDocument }) {
  return (
    <Link className="knowledge-document-link" to={knowledgeAreaPath(area, document.path)}>
      <FileText size={19} aria-hidden="true" />
      <div>
        <strong>{document.title}</strong>
        <span>{document.isOverview ? "先读这一篇，判断接下来需要哪些知识" : "按当前问题需要时再读"}</span>
      </div>
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}

export function KnowledgeAreaDocumentsView({ area }: { area: KnowledgeAreaId }) {
  const areaInfo = knowledgeAreas.find((candidate) => candidate.id === area)!;
  const documents = listKnowledgeDocuments(area);
  const Icon = areaIcons[area];

  return (
    <main className="knowledge-page">
      <div className="knowledge-breadcrumb"><Link to="/knowledge">导演知识库</Link><span>/</span><strong>{areaInfo.title}</strong></div>
      <section className="area-heading">
        <Icon size={30} aria-hidden="true" />
        <div><span>{areaInfo.question}</span><h1>{areaInfo.title}</h1><p>{areaInfo.result}</p></div>
      </section>
      <section className="knowledge-document-list" aria-label={`${areaInfo.title}文档`}>
        {documents.map((document) => <DocumentLink area={area} document={document} key={document.path} />)}
      </section>
    </main>
  );
}

interface LoadedCasePreview {
  knowledgeCase: KnowledgeCase;
  preview: KnowledgeCasePreview;
}

function KnowledgeCaseGallery({ focus }: { focus: KnowledgeCaseEntry }) {
  const [items, setItems] = useState<LoadedCasePreview[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setItems([]);
    setError("");
    Promise.all(listKnowledgeCases().map(async (knowledgeCase) => {
      const markdown = await knowledgeCase.load();
      const preview = summarizeKnowledgeCaseMarkdown(markdown);
      return preview ? { knowledgeCase, preview } : undefined;
    }))
      .then((values) => {
        if (active) setItems(values.filter((value): value is LoadedCasePreview => Boolean(value)));
      })
      .catch(() => {
        if (active) setError("完整案例暂时无法读取。");
      });
    return () => { active = false; };
  }, []);

  return (
    <section className={`knowledge-case-gallery focus-${focus}`} aria-label="完整 LibTV 镜头案例">
      <header>
        <span>{focus === "image-asset" ? "从图片职责进入" : "从分镜骨架进入"}</span>
        <h2>真实镜头案例</h2>
        <p>每张卡都把输入图、原提示词和实际视频放在一起；点开后只改变阅读重点，不复制案例。</p>
      </header>
      {error && <div className="knowledge-error" role="alert"><AlertTriangle size={20} /><div><strong>读取失败</strong><p>{error}</p></div></div>}
      {!items.length && !error && <div className="knowledge-loading compact"><span className="spinning" /><p>正在整理案例…</p></div>}
      <div className="knowledge-case-grid">
        {items.map(({ knowledgeCase, preview }) => (
          <article className="knowledge-case-card" key={knowledgeCase.id}>
            <div className="knowledge-case-media-pair">
              <figure>
                <span>输入图片</span>
                {preview.imageUrl ? <img loading="lazy" src={preview.imageUrl} alt={`${knowledgeCase.title}输入图片`} /> : <div className="knowledge-case-media-missing">未登记预览图</div>}
              </figure>
              <figure>
                <span>实际视频</span>
                {preview.videoUrl
                  ? <video aria-label={`${knowledgeCase.title}实际视频`} controls playsInline preload="metadata" src={preview.videoUrl} />
                  : <div className="knowledge-case-media-missing">没有可播放本地片段</div>}
              </figure>
            </div>
            <div className="knowledge-case-card-body">
              <span>{focus === "image-asset" ? "先看每张图负责什么" : "先看动作骨架怎样执行"}</span>
              <h3>{knowledgeCase.title}</h3>
              <p>{preview.description}</p>
              <div className="knowledge-prompt-preview"><b>原提示词片段</b><p>{preview.promptExcerpt}…</p></div>
              <Link to={knowledgeCasePath(knowledgeCase.id, focus)}>查看图片、提示词和结果 <ArrowRight size={16} /></Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function KnowledgeDocumentView({ area, documentPath }: { area: KnowledgeAreaId; documentPath: string }) {
  const areaInfo = knowledgeAreas.find((candidate) => candidate.id === area)!;
  const document = getKnowledgeDocument(area, documentPath);
  const documents = listKnowledgeDocuments(area);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setBody("");
    setError("");
    if (!document) return () => { active = false; };
    document.load()
      .then((value) => { if (active) setBody(value); })
      .catch(() => { if (active) setError("这篇知识文档暂时无法读取。"); });
    return () => { active = false; };
  }, [document]);

  if (!document) {
    return (
      <main className="knowledge-page">
        <div className="knowledge-error" role="alert"><AlertTriangle size={22} /><div><strong>文档不存在</strong><p>它可能已改名，或这个地址不属于当前知识目录。</p></div></div>
        <Link className="primary-button" to={knowledgeAreaPath(area)}>返回{areaInfo.title}</Link>
      </main>
    );
  }

  return (
    <main className="knowledge-page">
      <div className="knowledge-breadcrumb"><Link to="/knowledge">导演知识库</Link><span>/</span><Link to={knowledgeAreaPath(area)}>{areaInfo.title}</Link><span>/</span><strong>{document.title}</strong></div>
      <div className="knowledge-reading-layout">
        <aside className="knowledge-document-nav" aria-label={`${areaInfo.title}目录`}>
          <strong>{areaInfo.title}</strong>
          {documents.map((item) => <Link className={item.path === document.path ? "active" : ""} to={knowledgeAreaPath(area, item.path)} key={item.path}>{item.title}</Link>)}
        </aside>
        <article className="knowledge-reader">
          {error && <div className="knowledge-error" role="alert"><AlertTriangle size={20} /><div><strong>读取失败</strong><p>{error}</p></div></div>}
          {!body && !error && <div className="knowledge-loading"><span className="spinning" /><p>正在打开文档…</p></div>}
          {body && <KnowledgeMarkdown body={body} area={area} currentPath={document.path} />}
          {body && document.caseFocus && <KnowledgeCaseGallery focus={document.caseFocus} />}
        </article>
      </div>
    </main>
  );
}

function parseCaseEntry(value: string | null): KnowledgeCaseEntry | undefined {
  return value === "image-asset" || value === "shot-prompt" ? value : undefined;
}

function CasePanel({
  title,
  eyebrow,
  body,
  focused,
  className = "",
}: {
  title: string;
  eyebrow: string;
  body: string;
  focused: boolean;
  className?: string;
}) {
  return (
    <section className={`knowledge-case-panel ${focused ? "is-focused" : ""} ${className}`.trim()}>
      <header><span>{eyebrow}</span><h2>{title}</h2></header>
      <div className="knowledge-case-panel-content"><KnowledgeMarkdown body={body} /></div>
    </section>
  );
}

export function KnowledgeCaseView({ caseId }: { caseId: string }) {
  const knowledgeCase = getKnowledgeCase(caseId);
  const [searchParams] = useSearchParams();
  const focus = parseCaseEntry(searchParams.get("from"));
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setBody("");
    setError("");
    if (!knowledgeCase) return () => { active = false; };
    knowledgeCase.load()
      .then((value) => { if (active) setBody(value); })
      .catch(() => { if (active) setError("这条完整案例暂时无法读取。"); });
    return () => { active = false; };
  }, [knowledgeCase]);

  if (!knowledgeCase) {
    return (
      <main className="knowledge-page">
        <div className="knowledge-error" role="alert"><AlertTriangle size={22} /><div><strong>案例不存在</strong><p>它可能已改名，或还没有形成完整的图片、提示词和视频链。</p></div></div>
        <Link className="primary-button" to="/knowledge">返回导演知识库</Link>
      </main>
    );
  }

  const sections = body ? splitKnowledgeCaseMarkdown(body) : undefined;
  const entryArea = focus ? knowledgeAreas.find((area) => area.id === focus) : undefined;
  const entryDocument = focus === "image-asset" ? "真实案例与可复用做法.md" : "LibTV案例模板.md";

  return (
    <main className="knowledge-page knowledge-case-page">
      <div className="knowledge-breadcrumb">
        <Link to="/knowledge">导演知识库</Link><span>/</span>
        {entryArea && <><Link to={knowledgeAreaPath(entryArea.id, entryDocument)}>{entryArea.title}</Link><span>/</span></>}
        <strong>{knowledgeCase.title}</strong>
      </div>
      {error && <div className="knowledge-error" role="alert"><AlertTriangle size={20} /><div><strong>读取失败</strong><p>{error}</p></div></div>}
      {!body && !error && <div className="knowledge-loading"><span className="spinning" /><p>正在打开完整案例…</p></div>}
      {body && !sections && <div className="knowledge-error" role="alert"><AlertTriangle size={20} /><div><strong>案例结构不完整</strong><p>必须同时包含输入图片、原始提示词和实际视频。</p></div></div>}
      {sections && <>
        <article className="knowledge-reader knowledge-case-introduction">
          <KnowledgeMarkdown body={sections.introduction} />
          <div className="knowledge-case-entry-note">
            {focus === "image-asset" && <><Images size={18} aria-hidden="true" /><span>你从图片素材进入：先核对每张图的职责，再结合提示词和视频判断是否可复用。</span></>}
            {focus === "shot-prompt" && <><Clapperboard size={18} aria-hidden="true" /><span>你从分镜提示词进入：先提取动作骨架，再结合输入图和实际视频判断能否替换。</span></>}
            {!focus && <><BookOpenText size={18} aria-hidden="true" /><span>这是同一份完整事实源：图片、提示词和视频必须一起看。</span></>}
          </div>
        </article>
        <div className="knowledge-case-bundle" aria-label="输入图片、原始提示词和实际视频">
          <CasePanel title="输入图片" eyebrow="01 · 素材职责" body={sections.inputs} focused={focus === "image-asset"} className="inputs" />
          <CasePanel title="原始提示词" eyebrow="02 · 来源原文" body={sections.prompt} focused={focus === "shot-prompt"} className="prompt" />
          <CasePanel title="实际视频" eyebrow="03 · 生成结果" body={sections.result} focused={false} className="result" />
        </div>
        {sections.notes && <article className="knowledge-reader knowledge-case-notes"><KnowledgeMarkdown body={sections.notes} /></article>}
        <div className="knowledge-case-backlinks">
          <Link to={knowledgeAreaPath("image-asset", "真实案例与可复用做法.md")}><Images size={16} />从图片素材看全部案例</Link>
          <Link to={knowledgeAreaPath("shot-prompt", "LibTV案例模板.md")}><Clapperboard size={16} />从分镜提示词看全部案例</Link>
          <span title={knowledgeCase.sourcePath}><BookOpenText size={16} />同一份 Markdown 事实源</span>
        </div>
      </>}
    </main>
  );
}
