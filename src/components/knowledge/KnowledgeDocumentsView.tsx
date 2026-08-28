import { AlertTriangle, ArrowRight, BookOpenText, Clapperboard, FileText, Images, Lightbulb, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
  getKnowledgeDocument,
  knowledgeAreas,
  listKnowledgeDocuments,
  normalizeKnowledgeDocumentPath,
  type KnowledgeAreaId,
  type KnowledgeDocument,
} from "../../lib/knowledgeDocuments";
import { knowledgeAreaPath } from "../../lib/routes";

const areaIcons: Record<KnowledgeAreaId, LucideIcon> = {
  script: Lightbulb,
  "image-asset": Images,
  "shot-prompt": Clapperboard,
};

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

function MarkdownLink({ area, currentPath, href, children }: { area: KnowledgeAreaId; currentPath: string; href?: string; children: ReactNode }) {
  if (!href) return <span>{children}</span>;
  if (/^(?:https?:|mailto:)/i.test(href)) return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
  const resolved = normalizeKnowledgeDocumentPath(currentPath, href);
  if (!resolved || !getKnowledgeDocument(area, resolved.path)) return <span className="knowledge-unavailable-link">{children}</span>;
  const hash = resolved.hash ? `#${encodeURIComponent(resolved.hash)}` : "";
  return <Link to={`${knowledgeAreaPath(area, resolved.path)}${hash}`}>{children}</Link>;
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
          {body && <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              a({ href, children }) {
                return <MarkdownLink area={area} currentPath={document.path} href={href}>{children}</MarkdownLink>;
              },
            }}
          >{body}</ReactMarkdown>}
        </article>
      </div>
    </main>
  );
}
