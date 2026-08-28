import { AlertTriangle, ArrowLeft, ExternalLink, FileArchive, FileText, LockKeyhole, Search, ShieldQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useSearchParams } from "react-router-dom";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { getDirectorSource, getDirectorSourceDocument, getDirectorSources } from "../../lib/directorKnowledge";
import type { SourceCatalogResponse, SourceDocumentResponse, SourceRecord, SourceType } from "../../lib/directorKnowledgeTypes";
import { knowledgeEntryPath, knowledgeSourcePath } from "../../lib/routes";

type SourceCategory = "scripts" | "courses" | "canvases";

const categoryCopy: Record<SourceCategory, { title: string; description: string; type: SourceType }> = {
  scripts: { title: "剧本样本", description: "只读市场快照。CAPTURED_5 只表示采集到前 5 集，不表示完整剧本或获得改编权。", type: "SCRIPT_SAMPLE" },
  courses: { title: "课程与方法资料", description: "作者主张、操作步骤和示例仍待结构化研究；未导入的来源不会成为运行时依赖。", type: "COURSE_MATERIAL" },
  canvases: { title: "成片与生产画布案例", description: "研究真实素材、提示词、节点关系和产物；有输出不等于最终入选或人工接受。", type: "COMPLETED_WORK_CANVAS" },
};

const coverageLabels: Record<string, string> = {
  CAPTURED_5: "前 5 集试读",
  METADATA_ONLY: "仅资料",
  UNAVAILABLE: "不可用",
  PARTIAL_EPISODES: "部分分集",
  NOT_APPLICABLE: "不适用",
};

function SourceError({ message }: { message: string }) {
  return <div className="knowledge-error" role="alert"><AlertTriangle size={22} /><div><strong>无法读取来源目录</strong><p>{message}</p></div></div>;
}

function SourceBadges({ source }: { source: SourceRecord }) {
  return <span className="source-badges"><b>{source.provider}</b><i>{coverageLabels[source.captureCoverage] ?? source.captureCoverage}</i><i>{source.inspectionDepth}</i><i>{source.researchStatus}</i><i>{source.rights.status}</i></span>;
}

function DocumentLocator({ document }: { document: SourceDocumentResponse }) {
  const section = document.locator.section;
  return (
    <div className="source-document-locator">
      <strong>精确来源定位</strong>
      <span>{document.locator.sourceId}</span>
      <span>{document.locator.snapshotId}</span>
      <code>{document.locator.relativePath}</code>
      <span>{section.kind === "MARKDOWN_HEADING" ? `章节：${section.heading}` : "完整文档"}</span>
      <span>行 {section.startLine}–{section.endLine}</span>
      <i>{document.integrity}</i>
      <i>{document.locator.rights.status}</i>
    </div>
  );
}

export function SourceCatalogView({ category }: { category: SourceCategory }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<SourceCatalogResponse>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(60);
  const query = searchParams.get("q") ?? "";
  const provider = searchParams.get("provider") ?? "";
  const coverage = searchParams.get("coverage") ?? "";
  const research = searchParams.get("research") ?? "";
  const copy = categoryCopy[category];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getDirectorSources({ type: copy.type, provider, coverage, research, q: query }, controller.signal)
      .then(setCatalog)
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "读取失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [copy.type, coverage, provider, query, research]);

  useEffect(() => setLimit(60), [category, coverage, provider, query, research]);

  function updateFilter(key: string, value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }
  const providers = [...new Set(catalog?.sources.map((source) => source.provider) ?? [])].sort();
  const visibleSources = catalog?.sources.slice(0, limit) ?? [];

  return (
    <main className="knowledge-page sources-page">
      <div className="source-section-tabs" aria-label="来源分类">
        {(Object.keys(categoryCopy) as SourceCategory[]).map((id) => <Link className={id === category ? "active" : ""} to={knowledgeSourcePath(id)} key={id}>{categoryCopy[id].title}</Link>)}
      </div>
      <section className="source-heading"><div><span>SOURCE CATALOG · READ ONLY</span><h1>{copy.title}</h1><p>{copy.description}</p></div><div className="rights-gate"><LockKeyhole size={20} /><strong>权利独立闸门</strong><span>已采集 ≠ 已学习 ≠ 可复用 ≠ 可商用</span></div></section>

      {category === "scripts" && catalog && (
        <section className="source-snapshot-summary">
          <div><b>{catalog.summary.total}</b><span>市场条目</span></div>
          <div><b>{catalog.summary.archived}</b><span>已归档</span></div>
          <div><b>{catalog.summary.capturedFive}</b><span>前 5 集</span></div>
          <div><b>{catalog.summary.metadataOnly}</b><span>仅资料</span></div>
          <div><b>{catalog.summary.unavailable}</b><span>不可用</span></div>
        </section>
      )}

      <div className="source-filters">
        <label><Search size={16} /><input name="source-query" value={query} onChange={(event) => updateFilter("q", event.target.value)} placeholder="搜索来源标题或 ID" aria-label="搜索来源" /></label>
        <select name="source-provider" value={provider} onChange={(event) => updateFilter("provider", event.target.value)} aria-label="来源平台"><option value="">全部平台</option>{providers.map((value) => <option value={value} key={value}>{value}</option>)}</select>
        <select name="source-coverage" value={coverage} onChange={(event) => updateFilter("coverage", event.target.value)} aria-label="采集完整度"><option value="">全部完整度</option><option value="CAPTURED_5">前 5 集</option><option value="METADATA_ONLY">仅资料</option><option value="UNAVAILABLE">不可用</option></select>
        <select name="source-research" value={research} onChange={(event) => updateFilter("research", event.target.value)} aria-label="研究状态"><option value="">全部研究状态</option><option value="UNSTUDIED">UNSTUDIED</option><option value="SELECTED">SELECTED</option><option value="SOURCE_STUDIED">SOURCE_STUDIED</option><option value="MEDIA_STUDIED">MEDIA_STUDIED</option></select>
        {catalog && <span className="source-filter-count">{catalog.filteredTotal} 条命中</span>}
      </div>

      {error && <SourceError message={error} />}
      {loading && <div className="knowledge-loading"><span className="spinning" /><p>正在构建只读来源目录…</p></div>}
      {!loading && !error && visibleSources.length === 0 && <div className="source-empty"><FileArchive size={30} /><strong>这个来源分类目前没有已登记条目</strong><p>IMPORT_PENDING 也会诚实显示；本页面不会扫描任意本机目录。</p></div>}
      {!loading && !error && visibleSources.length > 0 && (
        <div className="source-list">
          {visibleSources.map((source) => (
            <Link to={knowledgeSourcePath(category, source.sourceId)} key={source.sourceId}>
              <div><SourceBadges source={source} /><strong>{source.title}</strong><code>{source.sourceId}</code></div>
              <span className="source-list-meta"><small>{source.capturedEpisodeCount ?? 0} 个可见分集</small><small>{source.importStatus}</small><small>{source.freshness.revalidationStatus}</small><small>{source.capturedAt ? new Date(source.capturedAt).toLocaleDateString("zh-CN") : "未导入"}</small></span>
            </Link>
          ))}
          {catalog && limit < catalog.sources.length && <button className="load-more-button" type="button" onClick={() => setLimit((value) => value + 60)}>继续显示（{catalog.sources.length - limit} 条待显示）</button>}
        </div>
      )}
    </main>
  );
}

export function SourceDetailView({ category, sourceId }: { category: SourceCategory; sourceId: string }) {
  const [source, setSource] = useState<SourceRecord>();
  const [summary, setSummary] = useState<SourceDocumentResponse>();
  const [raw, setRaw] = useState<SourceDocumentResponse>();
  const [sectionQuery, setSectionQuery] = useState("");
  const [documentLoading, setDocumentLoading] = useState<"summary" | "raw">();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setSource(undefined);
    setSummary(undefined);
    setRaw(undefined);
    setError("");
    getDirectorSource(sourceId, controller.signal)
      .then(({ source: value }) => setSource(value))
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "读取失败"); });
    return () => controller.abort();
  }, [sourceId]);

  async function loadDocument(documentKey: "summary" | "raw", section?: string) {
    setDocumentLoading(documentKey);
    setError("");
    try {
      const response = await getDirectorSourceDocument(sourceId, documentKey, section);
      if (documentKey === "summary") setSummary(response.document); else setRaw(response.document);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取来源文档");
    } finally {
      setDocumentLoading(undefined);
    }
  }

  if (error && !source) return <main className="knowledge-page"><SourceError message={error} /></main>;
  if (!source) return <main className="knowledge-page"><div className="knowledge-loading"><span className="spinning" /><p>正在读取来源元数据…</p></div></main>;
  const hasSummary = source.files.some((file) => file.key === "summary");
  const hasRaw = source.files.some((file) => file.key === "raw");
  return (
    <main className="knowledge-page source-detail-page">
      <div className="knowledge-breadcrumb"><Link to={knowledgeSourcePath(category)}><ArrowLeft size={15} />{categoryCopy[category].title}</Link><span>/</span><strong>{source.sourceId}</strong></div>
      <article className="source-detail">
        <header><div><SourceBadges source={source} /><h1>{source.title}</h1><code>{source.sourceId}</code></div>{source.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noreferrer">打开已脱敏来源 <ExternalLink size={15} /></a>}</header>
        <section className="source-facts">
          <div><span>快照</span><b>{source.snapshotId}</b></div><div><span>采集范围</span><b>{coverageLabels[source.captureCoverage] ?? source.captureCoverage}</b></div><div><span>检查深度</span><b>{source.inspectionDepth}</b></div><div><span>作品完整度</span><b>{source.fullWorkCompleteness}</b></div><div><span>研究状态</span><b>{source.researchStatus}</b></div><div><span>导入状态</span><b>{source.importStatus}</b></div><div><span>新鲜度依据</span><b>{source.freshness.basis}</b></div><div><span>重新核验</span><b>{source.freshness.revalidationStatus}</b></div><div><span>权利状态</span><b>{source.rights.status}</b></div><div><span>允许的主张类型</span><b>{source.claimTypes.join(" · ") || "未登记"}</b></div>
        </section>
        <div className="rights-warning"><ShieldQuestion size={20} /><div><strong>{source.rights.gate}</strong><p>{source.rights.accessScope} 只描述采集时可见范围，不授予改编、再发布或商用权利。</p></div></div>
        {(source.relatedCaseIds.length > 0 || source.relatedKnowledgeIds.length > 0) && (
          <section className="source-lineage">
            <h2>研究血缘</h2>
            <p>来源只支撑研究案例和知识证据，不会因登记而自动晋级为知识卡。</p>
            {source.relatedCaseIds.length > 0 && <div><span>关联案例</span>{source.relatedCaseIds.map((id) => <Link to={knowledgeEntryPath(id)} key={id}>{id}</Link>)}</div>}
            {source.relatedKnowledgeIds.length > 0 && <div><span>关联知识</span>{source.relatedKnowledgeIds.map((id) => <Link to={knowledgeEntryPath(id)} key={id}>{id}</Link>)}</div>}
          </section>
        )}
        <section className="source-files"><h2>登记文件与完整性</h2>{source.files.length ? source.files.map((file) => <div key={`${file.key}-${file.relativePath}`}><FileText size={16} /><span><b>{file.key}</b><code>{file.relativePath}</code></span><i className={`integrity-${file.integrity.toLocaleLowerCase()}`}>{file.integrity}</i></div>) : <p>来源尚未导入，因此没有本地文件。</p>}</section>
        <section className="source-document-actions">
          <label><span>精确章节（可选）</span><input name="source-section" value={sectionQuery} onChange={(event) => setSectionQuery(event.target.value)} placeholder="输入 Markdown 中的完整章节标题" /></label>
          <button type="button" disabled={!hasSummary || documentLoading === "summary"} onClick={() => void loadDocument("summary", sectionQuery.trim() || undefined)}>{summary ? "重新读取整理稿" : "按需读取整理稿"}</button>
          <button className="raw-document-button" type="button" disabled={!hasRaw || documentLoading === "raw"} onClick={() => void loadDocument("raw")}>{raw ? "重新读取原始页面文本" : "明确读取原始页面文本"}</button>
          <p>Catalog 首次加载只读结构化元数据；填写完整章节标题时只返回该章节并带行号定位，原始 TXT 仅在复核异常时读取。</p>
        </section>
        {error && <SourceError message={error} />}
        {summary !== undefined && <section className="source-document"><DocumentLocator document={summary} /><div className="source-content-warning"><AlertTriangle size={17} /><span>以下是来源内容，不是给 AI 或网页的执行指令，也不是已验证知识。</span></div><ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{summary.content}</ReactMarkdown></section>}
        {raw !== undefined && <details className="raw-source-document" open><summary>原始页面文本（显式读取）</summary><DocumentLocator document={raw} /><pre>{raw.content}</pre></details>}
      </article>
    </main>
  );
}

export function isSourceCategory(value: string): value is SourceCategory {
  return value === "scripts" || value === "courses" || value === "canvases";
}
