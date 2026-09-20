import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CalendarRange,
  ExternalLink,
  GraduationCap,
  History,
  Radar,
  RefreshCw,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { weeklyRadarPath, weeklyRadarReportPath } from "../lib/routes";
import {
  getWeeklyRadarReports,
  weeklyRadarEmbedUrl,
  type WeeklyRadarReportSummary,
  type WeeklyRadarReportsResponse,
} from "../lib/weeklyRadar";

function displayDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(`${value}T00:00:00+08:00`));
}

function displayGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function reportWindow(report: WeeklyRadarReportSummary) {
  return `${displayDate(report.period.start)} — ${displayDate(report.period.end)}`;
}

function RadarHeader({ onRefresh, refreshing = false }: { onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <header className="app-header radar-app-header">
      <Link className="brand-block radar-brand" to={weeklyRadarPath()} aria-label="返回 AI 视频一周雷达历史列表">
        <BrandMark />
        <div><strong>AI 视频一周雷达</strong><span>爆款复刻 · 教学选题 · 本地历史报告</span></div>
      </Link>
      <div className="header-actions radar-header-actions">
        <ThemeToggle />
        <Link className="course-link" to="/knowledge"><BrainCircuit size={18} /><span className="responsive-action-label" data-compact-label="知识库">导演知识库</span></Link>
        <Link className="course-link" to="/"><ArrowLeft size={18} /><span className="responsive-action-label" data-compact-label="项目">所有项目</span></Link>
        {onRefresh && (
          <button className="secondary-button" type="button" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={18} className={refreshing ? "spinning" : ""} /><span className="responsive-action-label" data-compact-label="刷新">刷新历史</span>
          </button>
        )}
      </div>
    </header>
  );
}

function useReports() {
  const [result, setResult] = useState<WeeklyRadarReportsResponse>({ reports: [], issues: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await getWeeklyRadarReports());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取 AI 视频周报历史。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getWeeklyRadarReports(controller.signal)
      .then(setResult)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "无法读取 AI 视频周报历史。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { ...result, loading, error, refresh };
}

function ReportCounts({ report }: { report: WeeklyRadarReportSummary }) {
  const entries = [
    [report.counts.strictWeekSamples, "7 天样本"],
    [report.counts.detailVerified, "详情复核"],
    [report.counts.shortCandidates, "短片候选"],
    [report.counts.teachingTopics, "教学题"],
  ] as const;
  return (
    <dl className="radar-report-counts">
      {entries.map(([value, label]) => <div key={label}><dt>{value}</dt><dd>{label}</dd></div>)}
    </dl>
  );
}

export function WeeklyRadarListPage() {
  const { reports, issues, loading, error, refresh } = useReports();
  const latest = reports[0];

  return (
    <div className="app-shell radar-shell radar-list-shell">
      <RadarHeader onRefresh={() => void refresh()} refreshing={loading} />
      <main className="radar-page">
        <section className="radar-page-intro">
          <div>
            <span><Radar size={15} /> WEEKLY SIGNAL DESK</span>
            <h1>每周选题与学习档案</h1>
            <p>把“最近什么火”收敛成能复刻的练习，再延展成一条教学内容。每次报告保留当周证据边界，不把搜索抽样冒充平台全量榜单。</p>
          </div>
          <aside className="radar-skill-callout">
            <Sparkles size={19} />
            <div><strong>下周继续跑同一套流程</strong><p>调用项目 Skill <code>$ai-video-weekly-radar</code>，新周报会作为新版本进入历史列表。</p></div>
          </aside>
        </section>

        {error && <div className="library-error" role="alert">{error}</div>}
        {issues.length > 0 && <div className="radar-history-warning" role="status">有 {issues.length} 份历史周报未通过清单或哈希校验，已从列表中隔离。</div>}

        {loading && !reports.length ? (
          <div className="radar-history-state"><RefreshCw className="spinning" size={24} /><span>正在读取周报历史…</span></div>
        ) : !reports.length ? (
          <div className="radar-history-state"><History size={34} /><strong>还没有周报</strong><span>运行项目 Skill 后，第一份报告会出现在这里。</span></div>
        ) : (
          <>
            {latest && (
              <section className="radar-latest-strip" aria-label="最新周报摘要">
                <div><span>最新一期</span><strong>{reportWindow(latest)}</strong><small>{latest.evidenceNote}</small></div>
                <div><span>本周主选</span><strong>{latest.picks.primary.title}</strong><small>{latest.picks.primary.angle}</small></div>
                <ReportCounts report={latest} />
              </section>
            )}

            <section className="radar-history-section">
              <header><div><History size={19} /><div><h2>历史报告</h2><p>按观察窗口倒序保留；同一周返修会生成新的 vNN，不覆盖旧版。</p></div></div><span>{reports.length} 期</span></header>
              <div className="radar-report-list">
                {reports.map((report, index) => (
                  <article className={`radar-report-card${index === 0 ? " is-latest" : ""}`} key={report.id}>
                    <div className="radar-report-card-top">
                      <div className="radar-report-date"><CalendarRange size={18} /><span><b>{reportWindow(report)}</b><small>{report.period.timezone}</small></span></div>
                      <div className="radar-report-badges">{index === 0 && <span>最新</span>}<code>{report.id.match(/v\d{2}$/)?.[0] ?? "v01"}</code></div>
                    </div>
                    <div className="radar-report-copy">
                      <h3>{report.title}</h3>
                      <p>{report.summary}</p>
                    </div>
                    <div className="radar-report-picks">
                      <div><ScanSearch size={16} /><span>复刻主选</span><strong>{report.picks.primary.title}</strong></div>
                      <div><GraduationCap size={16} /><span>可延展教学</span><strong>{report.picks.secondary?.title ?? "见报告内教学地图"}</strong></div>
                    </div>
                    <ReportCounts report={report} />
                    <footer>
                      <span>生成于 {displayGeneratedAt(report.generatedAt)}</span>
                      <Link to={weeklyRadarReportPath(report.id)}>打开详情<ArrowRight size={17} /></Link>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export function WeeklyRadarDetailPage() {
  const { reportId = "" } = useParams();
  const { reports, loading, error } = useReports();
  const [frameLoading, setFrameLoading] = useState(true);
  const report = useMemo(() => reports.find((candidate) => candidate.id === reportId), [reportId, reports]);

  return (
    <div className="app-shell radar-shell radar-detail-shell">
      <RadarHeader />
      {loading ? (
        <main className="radar-history-state radar-detail-state"><RefreshCw className="spinning" size={24} /><span>正在打开周报…</span></main>
      ) : error ? (
        <main className="radar-history-state radar-detail-state"><strong>周报读取失败</strong><span>{error}</span><Link className="primary-button" to={weeklyRadarPath()}>返回历史报告</Link></main>
      ) : !report ? (
        <main className="radar-history-state radar-detail-state"><strong>这份周报不存在或未通过校验</strong><span>请从历史列表选择一份可用报告。</span><Link className="primary-button" to={weeklyRadarPath()}>返回历史报告</Link></main>
      ) : (
        <main className="radar-detail-page">
          <nav className="radar-detail-toolbar" aria-label="周报详情导航">
            <Link to={weeklyRadarPath()}><ArrowLeft size={17} />历史报告</Link>
            <div><strong>{reportWindow(report)}</strong><span>{report.title}</span></div>
            <a href={report.reportUrl} target="_blank" rel="noreferrer">单独打开<ExternalLink size={15} /></a>
          </nav>
          <section className="radar-report-frame-shell" aria-label={`${report.title}详情`}>
            {frameLoading && <div className="radar-frame-loading"><RefreshCw className="spinning" size={22} />正在载入报告…</div>}
            <iframe
              className={frameLoading ? "is-loading" : ""}
              src={weeklyRadarEmbedUrl(report)}
              title={`${report.title} · ${reportWindow(report)}`}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => setFrameLoading(false)}
            />
          </section>
        </main>
      )}
    </div>
  );
}
