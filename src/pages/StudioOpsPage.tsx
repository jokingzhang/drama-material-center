import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  Check,
  Clock3,
  Coffee,
  Compass,
  FileText,
  Flame,
  HelpCircle,
  Hourglass,
  Layers,
  RefreshCw,
  Target,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useSearchParams } from "react-router-dom";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { projectStoryOverviewPath } from "../lib/routes";
import {
  formatDaysUntil,
  getStudioOpsDocument,
  getStudioOpsOverview,
  updateStudioOpsTodoStatus,
  type StudioOpsColor,
  type StudioOpsDocumentDetail,
  type StudioOpsDocumentSummary,
  type StudioOpsOverview,
  type StudioOpsTodo,
  type StudioOpsTodoBucket,
  type StudioOpsTodoTimeSlot,
  type StudioOpsTone,
} from "../lib/studioOps";
import "../studioOps.css";

type OpsTab = "todos" | "accounts" | "docs";

const BUCKET_META: Array<{
  key: StudioOpsTodoBucket;
  label: string;
  description: string;
  icon: typeof Flame;
}> = [
  { key: "now", label: "近期必做", description: "已经确定、当前最值得先推的事项", icon: Flame },
  { key: "waiting", label: "外部等待", description: "等待审核意见、平台反馈或前置条件", icon: Hourglass },
  { key: "decide", label: "待调研 / 拍板", description: "先调研或想清楚再重投入", icon: HelpCircle },
  { key: "later", label: "中长期池", description: "先记下来不遗漏，暂不占当下精力", icon: Layers },
];

const TIME_SLOT_LABELS: Record<StudioOpsTodoTimeSlot, string> = {
  fragment: "摸鱼碎片 10~20m",
  deep: "整块时间 1~2h",
  any: "随时可做",
};

function resolveTodoColor(item: StudioOpsTodo): StudioOpsColor {
  if (item.color) return item.color;
  const label = (item.category ?? "").toLowerCase();
  if (label.includes("短剧") || label.includes("剧") || label.includes("制作")) return "purple";
  if (label.includes("调研") || label.includes("对标") || label.includes("研究")) return "blue";
  if (label.includes("账号") || label.includes("运营")) return "amber";
  if (label.includes("宣发") || label.includes("引流") || label.includes("变现")) return "green";
  if (label.includes("审核") || label.includes("版权") || label.includes("平台")) return "rose";
  return "neutral";
}

function toneClass(tone?: StudioOpsTone) {
  return `ops-tone-${tone ?? "neutral"}`;
}

function formatUpdatedAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function parseTab(value: string | null): OpsTab {
  if (value === "accounts" || value === "docs") return value;
  return "todos";
}

export function StudioOpsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const requestedDocPath = searchParams.get("doc") ?? "";

  const [overview, setOverview] = useState<StudioOpsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingTodoId, setSavingTodoId] = useState("");

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bucketFilter, setBucketFilter] = useState<StudioOpsTodoBucket | "all">("all");
  const [slotFilter, setSlotFilter] = useState<StudioOpsTodoTimeSlot | "all">("all");
  const [hideDone, setHideDone] = useState(false);

  const [docDetail, setDocDetail] = useState<StudioOpsDocumentDetail | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await getStudioOpsOverview();
      setOverview(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取运营管家数据");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getStudioOpsOverview(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setOverview(next);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "无法读取运营管家数据");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const selectedDocPath = useMemo(() => {
    const docs = overview?.documents ?? [];
    if (!docs.length) return "";
    if (requestedDocPath && docs.some((doc) => doc.path === requestedDocPath)) {
      return requestedDocPath;
    }
    const roadmap = docs.find((doc) => doc.path === "roadmap.md");
    return roadmap?.path ?? docs[0].path;
  }, [overview?.documents, requestedDocPath]);

  useEffect(() => {
    if (activeTab !== "docs" || !selectedDocPath || !overview?.available) {
      return;
    }
    const controller = new AbortController();
    setDocLoading(true);
    setDocError("");
    getStudioOpsDocument(selectedDocPath, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) setDocDetail(detail);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setDocError(reason instanceof Error ? reason.message : "读取文档失败");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDocLoading(false);
      });
    return () => controller.abort();
  }, [activeTab, selectedDocPath, overview?.available, overview?.state.updatedAt]);

  function switchTab(nextTab: OpsTab, docPath?: string) {
    const params = new URLSearchParams();
    params.set("tab", nextTab);
    if (nextTab === "docs" && docPath) {
      params.set("doc", docPath);
    }
    setSearchParams(params);
  }

  function openDocument(docPath: string) {
    switchTab("docs", docPath);
  }

  async function toggleTodo(item: StudioOpsTodo) {
    const nextStatus = item.status === "done" ? "todo" : "done";
    setSavingTodoId(item.id);
    setError("");
    try {
      const updated = await updateStudioOpsTodoStatus(item.id, nextStatus);
      setOverview((current) => {
        if (!current) return current;
        return {
          ...current,
          todos: {
            ...current.todos,
            updatedAt: new Date().toISOString(),
            items: current.todos.items.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
          },
        };
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新待办状态失败");
    } finally {
      setSavingTodoId("");
    }
  }

  const accountNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of overview?.state.accounts ?? []) {
      map.set(account.id, account.name);
    }
    return map;
  }, [overview?.state.accounts]);

  const categories = useMemo(() => {
    const seen = new Map<string, StudioOpsColor>();
    for (const item of overview?.todos.items ?? []) {
      const label = item.category || "未分类";
      if (!seen.has(label)) {
        seen.set(label, resolveTodoColor(item));
      }
    }
    return Array.from(seen.entries()).map(([label, color]) => ({ label, color }));
  }, [overview?.todos.items]);

  const filteredTodos = useMemo(() => {
    const items = overview?.todos.items ?? [];
    return items.filter((item) => {
      const itemCategory = item.category || "未分类";
      if (categoryFilter !== "all" && itemCategory !== categoryFilter) return false;
      if (bucketFilter !== "all" && item.bucket !== bucketFilter) return false;
      if (slotFilter !== "all" && item.timeSlot !== slotFilter) return false;
      if (hideDone && item.status === "done") return false;
      return true;
    });
  }, [overview?.todos.items, categoryFilter, bucketFilter, slotFilter, hideDone]);

  const openTodoCount = useMemo(
    () => (overview?.todos.items ?? []).filter((item) => item.status !== "done").length,
    [overview?.todos.items],
  );

  const groupedDocs = useMemo(() => {
    const groups = new Map<string, StudioOpsDocumentSummary[]>();
    for (const doc of overview?.documents ?? []) {
      const list = groups.get(doc.category) ?? [];
      list.push(doc);
      groups.set(doc.category, list);
    }
    return Array.from(groups.entries());
  }, [overview?.documents]);

  const researchDocs = useMemo(
    () => (overview?.documents ?? []).filter((doc) => doc.path.startsWith("accounts/") || doc.path.startsWith("research/")),
    [overview?.documents],
  );

  return (
    <div className="app-shell ops-shell">
      <header className="app-header">
        <div className="brand-block">
          <BrandMark />
          <div>
            <strong>{overview?.available ? overview.state.studioName : "运营管家"}</strong>
            <span>{overview?.state.tagline || "本地私有规划与待办 · 以对话维护为主 · 不上传 GitHub"}</span>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <Link className="course-link" to="/knowledge">
            <BrainCircuit size={18} />
            <span className="responsive-action-label" data-compact-label="知识库">导演知识库</span>
          </Link>
          <Link className="course-link" to="/">
            <ArrowLeft size={18} />
            <span className="responsive-action-label" data-compact-label="项目">所有项目</span>
          </Link>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={18} className={loading ? "spinning" : ""} />
            <span className="responsive-action-label" data-compact-label="刷新">刷新</span>
          </button>
        </div>
      </header>

      <main className="ops-page">
        <div className="ops-container">
          {error && <div className="library-error" role="alert">{error}</div>}
          {overview?.issues.map((issue) => (
            <div className="library-error" key={issue} role="status">{issue}</div>
          ))}

          {loading && !overview ? (
            <div className="projects-loading"><RefreshCw size={24} className="spinning" />正在读取本地运营数据…</div>
          ) : !overview?.available ? (
            <section className="ops-empty-state">
              <Compass size={38} strokeWidth={1.45} />
              <strong>本地运营数据目录尚未初始化</strong>
              <p>
                当前 <code>ops-workspace/</code> 不存在或为空，因此首页已自动隐藏「运营管家」入口。
                从移动硬盘导入私人数据目录，或在对话中调用 <code>studio-ops-assistant</code> 初始化后即可启用。
              </p>
              <Link className="primary-button" to="/"><ArrowLeft size={17} />返回所有项目</Link>
            </section>
          ) : (
            <>
              <nav className="ops-tabs-bar" aria-label="运营管家板块切换">
                <div className="ops-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "todos"}
                    className={`ops-tab${activeTab === "todos" ? " is-active" : ""}`}
                    onClick={() => switchTab("todos")}
                  >
                    <Target size={16} />
                    TODO
                    <span className="ops-tab-count">{openTodoCount}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "accounts"}
                    className={`ops-tab${activeTab === "accounts" ? " is-active" : ""}`}
                    onClick={() => switchTab("accounts")}
                  >
                    <Users size={16} />
                    账号运营
                    <span className="ops-tab-count">{overview.state.accounts.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "docs"}
                    className={`ops-tab${activeTab === "docs" ? " is-active" : ""}`}
                    onClick={() => switchTab("docs", selectedDocPath)}
                  >
                    <FileText size={16} />
                    规划与档案
                    <span className="ops-tab-count">{overview.documents.length}</span>
                  </button>
                </div>

                {overview.todos.updatedAt && (
                  <span className="ops-tabs-meta">
                    本地数据 · 更新于 {formatUpdatedAt(overview.todos.updatedAt)}
                  </span>
                )}
              </nav>

              {activeTab === "todos" && (
                <section className="ops-bucket-stack" aria-label="TODO 清单">
                  <div className="ops-filter-panel">
                    {categories.length > 0 && (
                      <div className="ops-filter-row">
                        <div className="ops-filter-group" aria-label="按事项类型筛选">
                          <button
                            type="button"
                            className={`ops-chip-btn${categoryFilter === "all" ? " is-active" : ""}`}
                            onClick={() => setCategoryFilter("all")}
                          >
                            全部类型
                          </button>
                          {categories.map((cat) => (
                            <button
                              key={cat.label}
                              type="button"
                              className={`ops-chip-btn ops-cat-chip ops-cat-${cat.color}${categoryFilter === cat.label ? " is-active" : ""}`}
                              onClick={() => setCategoryFilter(cat.label)}
                            >
                              <span className="ops-cat-dot" aria-hidden="true" />
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="ops-filter-row">
                      <div className="ops-filter-group" aria-label="按分组筛选">
                        <button
                          type="button"
                          className={`ops-chip-btn${bucketFilter === "all" ? " is-active" : ""}`}
                          onClick={() => setBucketFilter("all")}
                        >
                          全部阶段
                        </button>
                        {BUCKET_META.map((bucket) => (
                          <button
                            key={bucket.key}
                            type="button"
                            className={`ops-chip-btn${bucketFilter === bucket.key ? " is-active" : ""}`}
                            onClick={() => setBucketFilter(bucket.key)}
                          >
                            {bucket.label}
                          </button>
                        ))}
                      </div>
                      <div className="ops-filter-group" aria-label="按时段和完成状态筛选">
                        <button
                          type="button"
                          className={`ops-chip-btn${slotFilter === "all" ? " is-active" : ""}`}
                          onClick={() => setSlotFilter("all")}
                        >
                          全部时段
                        </button>
                        <button
                          type="button"
                          className={`ops-chip-btn${slotFilter === "fragment" ? " is-active" : ""}`}
                          onClick={() => setSlotFilter("fragment")}
                        >
                          <Coffee size={13} /> 摸鱼碎片
                        </button>
                        <button
                          type="button"
                          className={`ops-chip-btn${slotFilter === "deep" ? " is-active" : ""}`}
                          onClick={() => setSlotFilter("deep")}
                        >
                          <Clock3 size={13} /> 整块时间
                        </button>
                        <button
                          type="button"
                          className={`ops-chip-btn${hideDone ? " is-active" : ""}`}
                          onClick={() => setHideDone((prev) => !prev)}
                        >
                          {hideDone ? "已隐藏完成项" : "隐藏已完成"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {filteredTodos.length === 0 ? (
                    <div className="ops-empty-state">
                      <Check size={32} />
                      <strong>当前筛选下没有待办事项</strong>
                      <p>可以切换筛选条件，或者在对话里让运营助理帮你安排接下来的事项。</p>
                    </div>
                  ) : (
                    BUCKET_META.filter((bucket) => bucketFilter === "all" || bucketFilter === bucket.key).map((bucket) => {
                      const items = filteredTodos.filter((item) => item.bucket === bucket.key);
                      if (!items.length) return null;
                      const Icon = bucket.icon;
                      return (
                        <article className="ops-bucket-card" key={bucket.key}>
                          <header className="ops-bucket-header">
                            <div className="ops-bucket-title">
                              <Icon size={17} />
                              <h2>{bucket.label}</h2>
                              <span>{bucket.description}</span>
                            </div>
                            <span className="ops-tag">{items.length} 项</span>
                          </header>
                          <ul className="ops-todo-list">
                            {items.map((item) => {
                              const isDone = item.status === "done";
                              const color = resolveTodoColor(item);
                              const categoryLabel = item.category || "未分类";
                              const countdown = !isDone ? formatDaysUntil(item.dueDate) : undefined;
                              const linkedAccount = item.accountId ? accountNames.get(item.accountId) : undefined;
                              return (
                                <li
                                  className={`ops-todo-item ops-cat-${color}${isDone ? " is-done" : ""}`}
                                  key={item.id}
                                >
                                  <button
                                    type="button"
                                    className={`ops-todo-check${isDone ? " is-done" : ""}`}
                                    aria-label={isDone ? `恢复待办：${item.title}` : `标记完成：${item.title}`}
                                    aria-pressed={isDone}
                                    disabled={savingTodoId === item.id}
                                    onClick={() => void toggleTodo(item)}
                                  >
                                    <Check size={14} strokeWidth={3} />
                                  </button>
                                  <div className="ops-todo-body">
                                    <div className="ops-todo-head">
                                      <span className={`ops-cat-pill ops-cat-${color}`}>
                                        <span className="ops-cat-dot" aria-hidden="true" />
                                        {categoryLabel}
                                      </span>
                                      <span className="ops-todo-title">{item.title}</span>
                                      {item.status === "in_progress" && (
                                        <span className="ops-badge ops-tone-info">进行中</span>
                                      )}
                                      {countdown && (
                                        <span className={`ops-badge ${countdown.overdue ? "ops-tone-danger" : "ops-tone-warning"}`}>
                                          <CalendarClock size={11} />
                                          {item.dueDate} · {countdown.label}
                                        </span>
                                      )}
                                    </div>
                                    {item.detail && <p className="ops-todo-detail">{item.detail}</p>}
                                    <div className="ops-todo-meta">
                                      {item.timeSlot && (
                                        <span className="ops-tag">{TIME_SLOT_LABELS[item.timeSlot]}</span>
                                      )}
                                      {linkedAccount && <span className="ops-tag">账号 · {linkedAccount}</span>}
                                      {item.workspaceProjectId && (
                                        <Link
                                          className="ops-tag ops-tag-link"
                                          to={projectStoryOverviewPath(item.workspaceProjectId)}
                                        >
                                          去短剧页 <ArrowRight size={11} />
                                        </Link>
                                      )}
                                      {item.tags?.map((tag) => (
                                        <span className="ops-tag" key={tag}>{tag}</span>
                                      ))}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </article>
                      );
                    })
                  )}
                </section>
              )}

              {activeTab === "accounts" && (
                <section className="ops-bucket-stack" aria-label="账号运营">
                  {overview.state.accounts.length === 0 ? (
                    <div className="ops-empty-state">
                      <Users size={34} />
                      <strong>还没有登记中的自媒体账号</strong>
                      <p>可以在对话中让助理向 <code>ops-workspace/state.json</code> 增减任意数量的账号（1、2、3、4…）。</p>
                    </div>
                  ) : (
                    <div className="ops-card-grid">
                      {overview.state.accounts.map((account, index) => (
                        <article className="ops-entity-card" key={account.id}>
                          <header className="ops-entity-head">
                            <div className="ops-account-title-wrap">
                              <span className="ops-account-index">{String(index + 1).padStart(2, "0")}</span>
                              <div>
                                <h2>{account.name}</h2>
                                <p className="ops-entity-sub">
                                  {account.role}
                                  {account.platforms.length > 0 ? ` · ${account.platforms.join(" / ")}` : ""}
                                </p>
                              </div>
                            </div>
                            <span className={`ops-badge ${toneClass(account.tone)}`}>{account.status}</span>
                          </header>

                          <dl className="ops-kv-list">
                            {account.followers && (
                              <div className="ops-kv-row"><dt>当前体量</dt><dd>{account.followers}</dd></div>
                            )}
                            <div className="ops-kv-row"><dt>账号定位</dt><dd>{account.positioning}</dd></div>
                            {account.monetization && (
                              <div className="ops-kv-row"><dt>变现路径</dt><dd>{account.monetization}</dd></div>
                            )}
                          </dl>

                          {account.nextAction && (
                            <div className="ops-callout-box is-next">
                              <strong>近期动作</strong>
                              <span>{account.nextAction}</span>
                            </div>
                          )}

                          {account.docPath && (
                            <footer className="ops-entity-actions">
                              <button type="button" className="ops-inline-btn" onClick={() => openDocument(account.docPath!)}>
                                <FileText size={14} /> 查看账号档案与策略
                              </button>
                            </footer>
                          )}
                        </article>
                      ))}
                    </div>
                  )}

                  {researchDocs.length > 0 && (
                    <div className="ops-bucket-card">
                      <header className="ops-bucket-header">
                        <div className="ops-bucket-title">
                          <FileText size={17} />
                          <h2>对标拆解与账号专题文档</h2>
                          <span>所有放到 accounts/ 或 research/ 下的 Markdown 都会自动汇总到这里</span>
                        </div>
                        <span className="ops-tag">{researchDocs.length} 份</span>
                      </header>
                      <ul className="ops-todo-list">
                        {researchDocs.map((doc) => (
                          <li className="ops-todo-item ops-cat-blue" key={doc.path}>
                            <div className="ops-todo-body">
                              <div className="ops-todo-head">
                                <span className="ops-todo-title">{doc.title}</span>
                                <span className="ops-tag">{doc.category}</span>
                              </div>
                              <p className="ops-todo-detail"><code>{doc.path}</code> · 更新于 {formatUpdatedAt(doc.updatedAt)}</p>
                            </div>
                            <button type="button" className="ops-inline-btn" onClick={() => openDocument(doc.path)}>
                              阅读 <ArrowRight size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {activeTab === "docs" && (
                <section className="ops-docs-layout" aria-label="规划与档案阅读器">
                  <aside className="ops-docs-sidebar">
                    {groupedDocs.length === 0 ? (
                      <p className="ops-todo-detail">目录里还没有 Markdown 档案。</p>
                    ) : (
                      groupedDocs.map(([category, docs]) => (
                        <div className="ops-doc-group" key={category}>
                          <span className="ops-doc-group-label">{category}</span>
                          {docs.map((doc) => (
                            <button
                              key={doc.path}
                              type="button"
                              className={`ops-doc-nav-btn${selectedDocPath === doc.path ? " is-active" : ""}`}
                              onClick={() => openDocument(doc.path)}
                            >
                              <strong>{doc.title}</strong>
                              <small>{doc.path}</small>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </aside>

                  <article className="ops-doc-reader">
                    {docLoading ? (
                      <div className="projects-loading"><RefreshCw size={22} className="spinning" />正在读取文档…</div>
                    ) : docError ? (
                      <div className="library-error" role="alert">{docError}</div>
                    ) : docDetail ? (
                      <>
                        <header className="ops-doc-reader-header">
                          <span className="ops-badge ops-tone-info">{docDetail.category}</span>
                          <code>{docDetail.path}</code>
                          <span className="ops-updated-at">更新于 {formatUpdatedAt(docDetail.updatedAt)}</span>
                        </header>
                        <div className="ops-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{docDetail.content}</ReactMarkdown>
                        </div>
                      </>
                    ) : (
                      <div className="ops-empty-state">
                        <FileText size={32} />
                        <strong>选择左侧任意文档阅读</strong>
                      </div>
                    )}
                  </article>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
