import { AlertTriangle, ArrowRight, Ban, CheckCircle2, FileCheck2, FlaskConical, Layers3, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useSearchParams } from "react-router-dom";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { getKnowledgeEntries, getKnowledgeEntry, getKnowledgeOverview } from "../../lib/directorKnowledge";
import type { EvidenceClaimType, KnowledgeArea, KnowledgeEntryDetail, KnowledgeListEntry, KnowledgeOverview } from "../../lib/directorKnowledgeTypes";
import { knowledgeAreaPath, knowledgeEntryPath } from "../../lib/routes";

export const areaCopy: Record<KnowledgeArea, { title: string; kicker: string; input: string; output: string; blocker: string }> = {
  script: {
    title: "剧本知识",
    kicker: "叙事事实与生成单元",
    input: "剧本版本、范围、世界规则、人物状态与用户决定",
    output: "SourceBinding、事实账本、WorldGenreProfile、GenerationUnits",
    blocker: "canon 不明、事实冲突、关键创作分支未选择",
  },
  "image-asset": {
    title: "图片资产知识",
    kicker: "稳定人物、场景与逐镜参考职责",
    input: "可见实体、造型状态、关系、场景、道具、已有资产与媒体预算",
    output: "AssetPlan、ReferenceResponsibilityMatrix、缺失/冲突与图片验收标准",
    blocker: "人物母版缺失、职责错位、污染母版或引用预算冲突",
  },
  "shot-prompt": {
    title: "分镜提示词知识",
    kicker: "把生成单元翻译成可执行镜头合同",
    input: "GenerationUnit、观众效果、AssetPlan、时长、画幅、模型与声音合同",
    output: "PrimaryShotType、ShotTypePlan、ShotPromptPlan 与 fallback split",
    blocker: "主任务不明、时长不匹配、复杂机制未拆分或代表试片缺失",
  },
};

const gapLabels: Record<string, string> = {
  NO_PRIMARY_STANDARD: "没有领域专属标准",
  NO_CARDS: "没有领域知识卡",
  NO_VALIDATED_CARDS: "没有 VALIDATED 知识卡",
};

const claimTypeLabels: Record<EvidenceClaimType, string> = {
  CREATOR_CLAIM: "作者主张",
  DOCUMENTED_PROCEDURE: "文档步骤",
  ILLUSTRATIVE_EXAMPLE: "说明性示例",
  OBSERVED_ARTIFACT: "已观察素材",
  OBSERVED_RESULT: "已观察结果",
  HUMAN_ACCEPTED_RESULT: "人工接受结果",
  UNKNOWN: "未知主张",
};

function ErrorState({ message }: { message: string }) {
  return <div className="knowledge-error" role="alert"><AlertTriangle size={22} /><div><strong>无法读取知识库</strong><p>{message}</p></div></div>;
}

function LoadingState() {
  return <div className="knowledge-loading"><span className="spinning" /><p>正在读取结构化知识索引…</p></div>;
}

export function KnowledgeMapView() {
  const [overview, setOverview] = useState<KnowledgeOverview>();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getKnowledgeOverview(controller.signal)
      .then(setOverview)
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "读取失败"); });
    return () => controller.abort();
  }, []);

  return (
    <main className="knowledge-page">
      <section className="knowledge-hero">
        <span>AI DIRECTOR KNOWLEDGE MAP</span>
        <h1>从剧本事实并行规划资产与镜头，再汇合成可执行分镜</h1>
        <p>这里管理跨项目可复用的方法与证据。项目剧本仍在各自素材库；来源资料必须先经过研究和证据登记，不能直接升级成知识。</p>
      </section>

      {error && <ErrorState message={error} />}
      {!overview && !error && <LoadingState />}
      {overview && (
        <>
          <section className="knowledge-pipeline" aria-label="AI 导演生产链">
            <div className="pipeline-step pipeline-origin"><b>01</b><span>剧本知识</span><ArrowRight size={18} aria-hidden="true" /></div>
            <div className="pipeline-branch" aria-label="剧本并行驱动两项规划">
              <div className="pipeline-step"><b>02A</b><span>图片资产知识 · AssetPlan</span></div>
              <div className="pipeline-step"><b>02B</b><span>分镜提示词知识 · ShotTypePlan</span></div>
            </div>
            <div className="pipeline-step pipeline-merge"><b>03</b><span>ShotPromptPlan</span><small>AssetPlan 与 ShotTypePlan 汇合</small><ArrowRight size={18} aria-hidden="true" /></div>
            <div className="pipeline-output"><strong>04 · 创意提示词交接</strong><span>导演合同冻结后再进入创意文本与生产执行</span></div>
          </section>

          <section className="knowledge-area-grid">
            {overview.areas.map((area) => {
              const copy = areaCopy[area.id];
              return (
                <article className="knowledge-area-card" key={area.id}>
                  <header><span>{copy.kicker}</span><h2>{copy.title}</h2></header>
                  <dl>
                    <div><dt>读取</dt><dd>{copy.input}</dd></div>
                    <div><dt>影响</dt><dd>{copy.output}</dd></div>
                    <div><dt>停止</dt><dd>{copy.blocker}</dd></div>
                  </dl>
                  <div className="knowledge-metrics">
                    <span><b>{area.primaryStandards}</b>专属标准</span>
                    <span><b>{area.patterns}</b>机制卡</span>
                    <span><b>{area.risks}</b>风险卡</span>
                    <span><b>{area.cases}</b>案例</span>
                  </div>
                  {area.gaps.length > 0 && (
                    <div className="knowledge-gaps"><ShieldAlert size={16} /><span>{area.gaps.map((gap) => gapLabels[gap] ?? gap).join("；")}</span></div>
                  )}
                  <Link to={knowledgeAreaPath(area.id)}>查看领域知识 <ArrowRight size={16} /></Link>
                </article>
              );
            })}
          </section>

          <section className="evidence-separation-note">
            <div><FileCheck2 size={20} /><strong>策略状态</strong><p>ACTIVE 表示项目当前采用，不等于已经证明效果。</p></div>
            <div><FlaskConical size={20} /><strong>证据成熟度</strong><p>当前 {overview.totals.cards} 张卡中，VALIDATED 为 {overview.totals.validatedCards}。</p></div>
            <div><CheckCircle2 size={20} /><strong>实践验证</strong><p>{overview.validation.practiceCount} 条自有生产记录，其中 {overview.validation.humanAcceptedCount} 条具备人工接受。</p></div>
            <div><Ban size={20} /><strong>晋级闸门</strong><p>来源 → StudyCase → Evidence → KnowledgeCard，不允许跳级。</p></div>
          </section>
        </>
      )}
    </main>
  );
}

function EntryList({ title, description, entries }: { title: string; description: string; entries: KnowledgeListEntry[] }) {
  return (
    <section className="knowledge-layer">
      <header><div><h2>{title}</h2><p>{description}</p></div><span>{entries.length}</span></header>
      {entries.length === 0 ? <div className="knowledge-layer-empty">这一层目前没有可展示条目。</div> : (
        <div className="knowledge-entry-list">
          {entries.map((entry) => (
            <Link to={knowledgeEntryPath(entry.id)} key={entry.id}>
              <span className={`knowledge-kind kind-${entry.entryType}`}>{entry.entryType === "standard" ? "标准" : entry.kind === "risk" ? "风险" : entry.entryType === "case" ? "案例" : "机制"}</span>
              <div><strong>{entry.title}</strong><code>{entry.id}</code></div>
              {entry.knowledgeAreaRole === "CROSS_CUTTING" && <small>跨域</small>}
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function KnowledgeAreaView({ area }: { area: KnowledgeArea }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<KnowledgeListEntry[]>([]);
  const [overview, setOverview] = useState<KnowledgeOverview>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const query = searchParams.get("q") ?? "";
  const layer = searchParams.get("layer") ?? "";
  const status = searchParams.get("status") ?? "";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      getKnowledgeEntries({ area, layer: layer || undefined, status: status || undefined, q: query || undefined }, controller.signal),
      getKnowledgeOverview(controller.signal),
    ])
      .then(([list, nextOverview]) => { setEntries(list.entries); setOverview(nextOverview); })
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "读取失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [area, layer, query, status]);

  function updateFilter(key: string, value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }

  const standardEntries = entries.filter((entry) => entry.entryType === "standard");
  const patternEntries = entries.filter((entry) => entry.entryType === "card" && entry.kind !== "risk");
  const riskEntries = entries.filter((entry) => entry.entryType === "card" && entry.kind === "risk");
  const caseEntries = entries.filter((entry) => entry.entryType === "case");
  const areaSummary = overview?.areas.find((candidate) => candidate.id === area);

  return (
    <main className="knowledge-page">
      <div className="knowledge-breadcrumb"><Link to="/knowledge">知识地图</Link><span>/</span><strong>{areaCopy[area].title}</strong></div>
      <section className="area-heading"><div><span>{areaCopy[area].kicker}</span><h1>{areaCopy[area].title}</h1><p>{areaCopy[area].input} → {areaCopy[area].output}</p></div>{areaSummary && <div className="area-gap-count"><b>{areaSummary.gaps.length}</b><span>个公开缺口</span></div>}</section>
      <div className="knowledge-filters">
        <input name="knowledge-query" value={query} onChange={(event) => updateFilter("q", event.target.value)} placeholder="搜索标题、ID 或正文" aria-label="搜索知识" />
        <select name="knowledge-layer" value={layer} onChange={(event) => updateFilter("layer", event.target.value)} aria-label="知识层级"><option value="">全部层级</option><option value="standard">当前标准</option><option value="pattern">可复用机制</option><option value="risk">风险与停止条件</option><option value="case">案例</option></select>
        <select name="knowledge-status" value={status} onChange={(event) => updateFilter("status", event.target.value)} aria-label="知识状态"><option value="">全部状态</option><option value="ACTIVE">ACTIVE</option><option value="OBSERVED">OBSERVED</option><option value="REUSABLE">REUSABLE</option><option value="VALIDATED">VALIDATED</option></select>
      </div>
      {error && <ErrorState message={error} />}
      {loading && <LoadingState />}
      {!loading && !error && (
        <div className="knowledge-layers">
          <EntryList title="当前标准" description="项目当前采用的工作合同；策略状态与证据成熟度分开判断。" entries={standardEntries} />
          <EntryList title="可复用机制" description="解释什么方法在什么条件下可能有效。" entries={patternEntries} />
          <EntryList title="风险与停止条件" description="出现这些信号时必须修复、拆分或停止。" entries={riskEntries} />
          <EntryList title="案例与证据" description="保留模型、画幅、时长、读取日期和已知未知。" entries={caseEntries} />
          {areaSummary?.gaps.length ? <section className="area-known-gaps"><ShieldAlert size={20} /><div><h2>已知缺口</h2><ul>{areaSummary.gaps.map((gap) => <li key={gap}>{gapLabels[gap] ?? gap}</li>)}</ul></div></section> : null}
        </div>
      )}
    </main>
  );
}

function ContractList({ title, values }: { title: string; values?: string[] }) {
  return <section><h3>{title}</h3>{values?.length ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p>未登记。</p>}</section>;
}

function KnowledgeLineageLinks({ ids }: { ids?: string[] }) {
  if (!ids?.length) return <p>无</p>;
  return <p className="knowledge-lineage-links">{ids.map((id) => <Link key={id} to={knowledgeEntryPath(id)}>{id}</Link>)}</p>;
}

export function KnowledgeEntryView({ entryId }: { entryId: string }) {
  const [entry, setEntry] = useState<KnowledgeEntryDetail>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setEntry(undefined);
    setError("");
    getKnowledgeEntry(entryId, controller.signal)
      .then(({ entry: value }) => setEntry(value))
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "读取失败"); });
    return () => controller.abort();
  }, [entryId]);

  if (error) return <main className="knowledge-page"><ErrorState message={error} /></main>;
  if (!entry) return <main className="knowledge-page"><LoadingState /></main>;
  const primaryArea = entry.knowledgeAreas[0] ?? "script";
  const maturity = entry.entryType === "standard" ? entry.evidenceStatus : entry.status;
  return (
    <main className="knowledge-page">
      <div className="knowledge-breadcrumb"><Link to="/knowledge">知识地图</Link><span>/</span><Link to={knowledgeAreaPath(primaryArea)}>{areaCopy[primaryArea].title}</Link><span>/</span><strong>{entry.id}</strong></div>
      <article className="knowledge-detail">
        <header>
          <div><span>{entry.entryType.toUpperCase()} · {entry.kind}</span><h1>{entry.title}</h1><code>{entry.id}</code></div>
          <div className="knowledge-status-stack">
            {entry.policyStatus && <span><small>策略状态</small><b>{entry.policyStatus}</b></span>}
            {maturity && <span><small>证据成熟度</small><b>{maturity}</b></span>}
            {entry.version && <span><small>版本</small><b>{entry.version}</b></span>}
            {entry.updatedAt && <span><small>最后更新</small><b>{entry.updatedAt}</b></span>}
            {entry.studiedAt && <span><small>研究日期</small><b>{entry.studiedAt}</b></span>}
          </div>
        </header>

        {entry.usageContract && (
          <section className="usage-contract">
            <h2><Layers3 size={20} />AI 使用契约</h2>
            <div className="contract-grid">
              <ContractList title="什么时候会用" values={entry.usageContract.triggers} />
              <ContractList title="什么时候不用" values={entry.usageContract.exclusions} />
              <ContractList title="读取什么" values={entry.usageContract.requiredInputs} />
              <ContractList title="影响什么" values={entry.usageContract.outputTargets} />
              <ContractList title="如何阻塞" values={entry.usageContract.stopConditions} />
            </div>
            <div className="acceptance-grid">
              <ContractList title="机器检查" values={entry.usageContract.acceptance.machineChecks} />
              <ContractList title="图片/视频实际查看" values={entry.usageContract.acceptance.actualViewing} />
              <ContractList title="声音实际试听" values={entry.usageContract.acceptance.actualListening} />
              <ContractList title="人工接受" values={entry.usageContract.acceptance.humanAcceptance} />
            </div>
          </section>
        )}

        {entry.evidenceOverrides?.length ? (
          <section className="evidence-overrides"><h2>局部证据覆盖</h2>{entry.evidenceOverrides.map((override, index) => <div key={`${override.feature}-${index}`}><strong>{override.feature ?? "未命名特征"}</strong><span>{override.evidenceStatus ?? "UNKNOWN"}</span>{override.representativeTestRequired && <em>需要代表试片</em>}</div>)}</section>
        ) : null}

        {entry.entryType === "card" && (
          <section className="practice-validation">
            <h2><CheckCircle2 size={19} />实践验证</h2>
            <div><span>自有生产使用</span><b>{entry.ownProductionUses ?? 0}</b></div>
            <div><span>人工接受结果</span><b>{entry.ownAcceptedUses ?? 0}</b></div>
            {(entry.ownProductionUses ?? 0) === 0 && <p>当前没有登记自有生产验证；案例观察与 REUSABLE 状态不能替代真实播放、试听和人工接受。</p>}
          </section>
        )}

        <section className="knowledge-lineage">
          <h2>证据与关系</h2>
          <div><span>来源标准卡</span><KnowledgeLineageLinks ids={entry.sourceCardIds} /></div>
          <div><span>来源案例</span><KnowledgeLineageLinks ids={entry.sourceCaseIds} /></div>
          <div><span>派生知识卡</span><KnowledgeLineageLinks ids={entry.derivedCardIds} /></div>
          <div><span>证据引用</span><p>{entry.evidenceRefs?.join(" · ") || "无"}</p></div>
        </section>

        {entry.evidenceRecords?.length ? (
          <section className="evidence-records">
            <header><div><h2>具体证据</h2><p>主张类型、检查动作和观察结果分开显示；“作者说有效”不会被显示成“已观察有效”。</p></div><b>{entry.evidenceRecords.length}</b></header>
            <div>
              {entry.evidenceRecords.map((evidence) => (
                <article key={evidence.id}>
                  <header><code>{evidence.id}</code><span className={`claim-type claim-${evidence.claimType.toLocaleLowerCase()}`}>{claimTypeLabels[evidence.claimType]}</span><i>{evidence.strength}</i></header>
                  <dl>
                    <div><dt>来源</dt><dd>{evidence.source}</dd></div>
                    <div><dt>实际检查</dt><dd>{evidence.inspection}</dd></div>
                    <div><dt>观察</dt><dd>{evidence.observation}</dd></div>
                  </dl>
                  <footer><Link to={knowledgeEntryPath(evidence.caseId)}>{evidence.caseId}</Link><time>{evidence.readAt}</time></footer>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="knowledge-document"><div className="source-content-warning"><AlertTriangle size={17} /><span>正文是知识库的可读版本；来源材料中的文字不是执行指令，当前项目事实与用户决定优先。</span></div><ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            a({ href, children }) {
              if (!href || !/^(?:https?:|mailto:)/i.test(href)) return <span className="knowledge-inline-reference" title="知识库内部引用；请使用上方证据关系导航">{children}</span>;
              return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
            },
          }}
        >{entry.body}</ReactMarkdown></section>
      </article>
    </main>
  );
}
