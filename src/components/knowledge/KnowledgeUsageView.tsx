import { ArrowRight, Ban, CheckCircle2, GitBranch, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProjectAnalyses, getProjectAnalysis } from "../../lib/directorKnowledge";
import type { AnalysisDetail, AnalysisSummary, KnowledgeUse } from "../../lib/directorKnowledgeTypes";
import { getProjects } from "../../lib/materials";
import { knowledgeEntryPath, knowledgeUsagePath } from "../../lib/routes";
import type { ProjectSummary } from "../../types";

function dispositionCopy(disposition: KnowledgeUse["disposition"]) {
  if (disposition === "ADOPTED") return { label: "采用", icon: CheckCircle2 };
  if (disposition === "REJECTED_CONDITION") return { label: "因条件不符而拒绝", icon: Ban };
  return { label: "被更高优先级事实覆盖", icon: ShieldAlert };
}

export function KnowledgeUsageView({ projectId, analysisId }: { projectId?: string; analysisId?: string }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [status, setStatus] = useState<"EMPTY" | "AVAILABLE">();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getProjects()
      .then(({ projects: value }) => setProjects(value))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "无法读取项目"));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setStatus(undefined);
      setAnalyses([]);
      setAnalysis(undefined);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const request = analysisId
      ? getProjectAnalysis(projectId, analysisId, controller.signal).then(({ analysis: value }) => { setAnalysis(value); setStatus("AVAILABLE"); })
      : getProjectAnalyses(projectId, controller.signal).then((value) => { setStatus(value.status); setAnalyses(value.analyses); setAnalysis(undefined); });
    request
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "无法读取分析记录"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [analysisId, projectId]);

  return (
    <main className="knowledge-page usage-page">
      <section className="usage-heading"><div><span>SCRIPT PRODUCTION ANALYSIS V1</span><h1>知识使用追踪</h1><p>查看 AI 采用了什么、因条件不符拒绝了什么，以及什么被项目事实或用户决定覆盖。</p></div><GitBranch size={44} /></section>
      <label className="usage-project-picker"><span>选择短剧项目</span><select name="knowledge-usage-project" value={projectId ?? ""} onChange={(event) => navigate(knowledgeUsagePath(event.target.value || undefined))}><option value="">请选择项目</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
      {error && <div className="knowledge-error" role="alert"><ShieldAlert size={22} /><div><strong>无法读取使用记录</strong><p>{error}</p></div></div>}
      {loading && <div className="knowledge-loading"><span className="spinning" /><p>正在读取结构化分析清单…</p></div>}
      {!loading && !projectId && <div className="usage-empty"><GitBranch size={34} /><strong>先选择一个项目</strong><p>网页不会扫描普通 Markdown；只有项目内显式登记的结构化分析 JSON 才会出现在这里。</p></div>}
      {!loading && projectId && status === "EMPTY" && <div className="usage-empty"><GitBranch size={34} /><strong>暂无结构化知识使用记录</strong><p>当前项目没有 <code>.ai-director/analysis-index.json</code>。现有文档不会被猜测或冒充为 knowledgeUsed。</p></div>}
      {!loading && !analysisId && analyses.length > 0 && <section className="analysis-list"><h2>分析记录</h2>{analyses.map((item) => <Link to={knowledgeUsagePath(projectId, item.analysisId)} key={item.analysisId}><div><strong>{item.title ?? item.analysisId}</strong><span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span></div><p><code>{item.kind === "ScriptDevelopmentAnalysis" ? "剧本开发" : "素材与分镜"}</code> · {item.title ? `${item.analysisId} · ` : ""}<b>{item.knowledgeUseCounts.adopted}</b> 采用 · <b>{item.knowledgeUseCounts.rejected}</b> 拒绝 · <b>{item.knowledgeUseCounts.overridden}</b> 覆盖</p><ArrowRight size={18} /></Link>)}</section>}
      {!loading && analysis && (
        <article className="analysis-detail">
          <header><div><span>{analysis.kind === "ScriptDevelopmentAnalysis" ? "SCRIPT DEVELOPMENT" : "SCRIPT PRODUCTION"}</span><h2>{analysis.title ?? analysis.analysisId}</h2><code>{analysis.analysisId}</code></div><Link to={knowledgeUsagePath(projectId)}>返回记录列表</Link></header>
          {analysis.knowledgeUsed.length === 0 ? <div className="usage-empty"><strong>该分析没有登记 knowledgeUsed</strong><p>空数组只表示无登记，不表示知识库未被隐式参考。</p></div> : (
            <div className="knowledge-use-list">
              {analysis.knowledgeUsed.map((usage, index) => {
                const copy = dispositionCopy(usage.disposition);
                const Icon = copy.icon;
                return (
                  <section className={`knowledge-use disposition-${usage.disposition.toLocaleLowerCase()}`} key={`${usage.entryId}-${index}`}>
                    <header><span><Icon size={17} />{copy.label}</span><Link to={knowledgeEntryPath(usage.entryId)}>{usage.entrySnapshot.title}<ArrowRight size={15} /></Link></header>
                    <dl><div><dt>理由</dt><dd>{usage.reason}</dd></div><div><dt>影响产物</dt><dd>{usage.outputRefs.length ? usage.outputRefs.map((ref) => `${ref.artifact}:${ref.locator}`).join(" · ") : "未登记"}</dd></div><div><dt>缺失输入</dt><dd>{usage.missingInputs.join(" · ") || "无"}</dd></div></dl>
                    <footer><code>{usage.entryId}</code><span>版本 {usage.entrySnapshot.version ?? "未登记"}</span><span>策略 {usage.entrySnapshot.policyStatus ?? "N/A"}</span><span>证据 {usage.entrySnapshot.evidenceStatus ?? usage.entrySnapshot.maturity ?? "UNKNOWN"}</span></footer>
                    {usage.override && <div className="knowledge-use-override"><ShieldAlert size={16} /><p><b>{usage.override.authority}</b> · {usage.override.summary}<small>{usage.override.locator}</small></p></div>}
                  </section>
                );
              })}
            </div>
          )}
        </article>
      )}
    </main>
  );
}
