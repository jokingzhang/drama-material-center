import { ArrowRight, FolderKanban, Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { createProject, getProjects } from "../lib/materials";
import { projectLibraryPath } from "../lib/routes";
import type { ProjectSummary } from "../types";

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [description, setDescription] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProjects((await getProjects()).projects);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取项目列表");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function closeCreateDialog() {
    if (submitting) return;
    setCreating(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const project = await createProject({ id, name, ...(description.trim() ? { description } : {}) });
      navigate(projectLibraryPath(project.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法创建项目");
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell projects-shell">
      <header className="app-header">
        <div className="brand-block">
          <BrandMark />
          <div><strong>AI 短剧素材中心</strong><span>多个项目 · 本地文件 · 不上传云端</span></div>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={18} className={loading ? "spinning" : ""} />刷新
          </button>
          <button className="primary-button" type="button" onClick={() => setCreating(true)}><Plus size={18} />新建项目</button>
        </div>
      </header>

      <main className="projects-page">
        <header className="projects-heading">
          <div><h1>所有短剧项目</h1><p>选择一个项目继续整理剧本、图片和视频素材。</p></div>
          <span>{projects.length} 个项目</span>
        </header>

        {error && !creating && <div className="library-error" role="alert">{error}</div>}
        {loading && !projects.length ? (
          <div className="projects-loading"><RefreshCw size={25} className="spinning" />正在读取本地项目…</div>
        ) : projects.length ? (
          <div className="project-list" aria-label="短剧项目列表">
            {projects.map((project) => (
              <Link className="project-row" key={project.id} to={projectLibraryPath(project.id)}>
                <span className="project-icon"><FolderKanban size={22} /></span>
                <span className="project-copy">
                  <strong>{project.name}</strong>
                  <small>{project.description || "本地短剧素材项目"}</small>
                </span>
                <code>{project.id}</code>
                <ArrowRight size={20} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="projects-empty">
            <FolderKanban size={38} strokeWidth={1.35} />
            <strong>还没有短剧项目</strong>
            <p>创建第一个项目后，程序会在本地工作区生成标准素材目录。</p>
            <button className="primary-button" type="button" onClick={() => setCreating(true)}><Plus size={18} />新建项目</button>
          </div>
        )}
      </main>

      {creating && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={closeCreateDialog}>
          <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="create-project-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><h2 id="create-project-title">新建短剧项目</h2><p>只创建本地目录，不会提交任何项目资源。</p></div><button type="button" aria-label="关闭" onClick={closeCreateDialog}><X size={19} /></button></header>
            <form onSubmit={(event) => void submit(event)}>
              <label><span>项目名称</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：长生喜宴" /></label>
              <label><span>项目标识</span><input required pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?" value={id} onChange={(event) => setId(event.target.value.toLowerCase())} placeholder="例如：longevity-banquet" /><small>用于网址和文件夹名，只能包含小写字母、数字和连字符。</small></label>
              <label><span>项目说明（可选）</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="记录当前阶段或项目简介" /></label>
              {error && <div className="library-error" role="alert">{error}</div>}
              <footer><button className="secondary-button" type="button" disabled={submitting} onClick={closeCreateDialog}>取消</button><button className="primary-button" type="submit" disabled={submitting}>{submitting ? <RefreshCw size={17} className="spinning" /> : <Plus size={17} />}{submitting ? "正在创建" : "创建项目"}</button></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="route-error-page">
      <BrandMark />
      <h1>页面不存在</h1>
      <p>这个地址没有对应的项目或素材页面。</p>
      <Link className="primary-button" to="/">返回所有项目</Link>
    </div>
  );
}
