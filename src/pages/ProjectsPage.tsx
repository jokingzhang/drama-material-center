import { ArrowRight, BrainCircuit, FolderKanban, ImagePlus, Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { createProject, getProjects, uploadProjectCover } from "../lib/materials";
import { projectLibraryPath } from "../lib/routes";
import type { ProjectSummary } from "../types";

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverUploading, setCoverUploading] = useState("");
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<File>();
  const [coverPreview, setCoverPreview] = useState("");

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

  useEffect(() => {
    if (!cover) {
      setCoverPreview("");
      return undefined;
    }
    const preview = URL.createObjectURL(cover);
    setCoverPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [cover]);

  function openCreateDialog() {
    setName("");
    setId("");
    setDescription("");
    setCover(undefined);
    setError("");
    setCreating(true);
  }

  function closeCreateDialog() {
    if (submitting) return;
    setCreating(false);
    setCover(undefined);
    setError("");
  }

  async function changeCover(projectId: string, file?: File) {
    if (!file) return;
    setCoverUploading(projectId);
    setError("");
    try {
      await uploadProjectCover(projectId, file);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法保存项目封面");
    } finally {
      setCoverUploading("");
    }
  }

  function selectNewProjectCover(file?: File) {
    if (!file) {
      setCover(undefined);
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setCover(undefined);
      setError("封面仅支持 PNG、JPEG、WebP 或 GIF 图片。");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCover(undefined);
      setError("封面图片不能超过 10 MB。");
      return;
    }
    setError("");
    setCover(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const project = await createProject({ id, name, ...(description.trim() ? { description } : {}) });
      if (cover) {
        try {
          await uploadProjectCover(project.id, cover);
        } catch (reason) {
          setCreating(false);
          setSubmitting(false);
          await refresh();
          const message = reason instanceof Error ? reason.message : "无法保存项目封面";
          setError(`项目已经创建，但封面保存失败：${message}`);
          return;
        }
      }
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
          <ThemeToggle />
          <Link className="course-link" to="/knowledge"><BrainCircuit size={18} />导演知识库</Link>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={18} className={loading ? "spinning" : ""} />刷新
          </button>
          <button className="primary-button" type="button" onClick={openCreateDialog}><Plus size={18} />新建项目</button>
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
          <div className="project-grid" aria-label="短剧项目">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <Link className="project-card-link" to={projectLibraryPath(project.id)} aria-label={`打开项目：${project.name}`}>
                  <div className="project-cover">
                    {project.coverUrl ? (
                      <img src={project.coverUrl} alt={`${project.name}封面`} />
                    ) : (
                      <div className="project-cover-placeholder"><FolderKanban size={34} strokeWidth={1.45} /><span>暂未设置项目封面</span></div>
                    )}
                  </div>
                  <div className="project-card-body">
                    <div className="project-card-title"><h2>{project.name}</h2><code>{project.id}</code></div>
                    <p>{project.description || "本地短剧素材项目"}</p>
                    <span className="open-project">打开项目<ArrowRight size={17} aria-hidden="true" /></span>
                  </div>
                </Link>
                <label className={`project-cover-action${coverUploading === project.id ? " uploading" : ""}`}>
                  {coverUploading === project.id ? <RefreshCw size={15} className="spinning" /> : <ImagePlus size={15} />}
                  <span>{project.coverUrl ? "更换封面" : "添加封面"}</span>
                  <input
                    name={`project-cover-${project.id}`}
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={Boolean(coverUploading)}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      void changeCover(project.id, file);
                    }}
                  />
                </label>
              </article>
            ))}
          </div>
        ) : (
          <div className="projects-empty">
            <FolderKanban size={38} strokeWidth={1.35} />
            <strong>还没有短剧项目</strong>
            <p>创建第一个项目后，程序会在本地工作区生成标准素材目录。</p>
            <button className="primary-button" type="button" onClick={openCreateDialog}><Plus size={18} />新建项目</button>
          </div>
        )}
      </main>

      {creating && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={closeCreateDialog}>
          <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="create-project-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><h2 id="create-project-title">新建短剧项目</h2><p>只创建本地目录，不会提交任何项目资源。</p></div><button type="button" aria-label="关闭" onClick={closeCreateDialog}><X size={19} /></button></header>
            <form onSubmit={(event) => void submit(event)}>
              <label><span>项目名称</span><input name="project-name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：长生喜宴" /></label>
              <label><span>项目标识</span><input name="project-id" required pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?" value={id} onChange={(event) => setId(event.target.value.toLowerCase())} placeholder="例如：longevity-banquet" /><small>用于网址和文件夹名，只能包含小写字母、数字和连字符。</small></label>
              <label><span>项目说明（可选）</span><textarea name="project-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="记录当前阶段或项目简介" /></label>
              <label className="cover-picker">
                <span>项目封面（可选）</span>
                <span className={`cover-picker-preview${coverPreview ? " has-image" : ""}`}>
                  {coverPreview ? <img src={coverPreview} alt="待上传的项目封面预览" /> : <><ImagePlus size={24} /><b>选择一张封面图</b><small>推荐 16:9 横图</small></>}
                </span>
                <input
                  name="new-project-cover"
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    selectNewProjectCover(file);
                  }}
                />
                <small>支持 PNG、JPEG、WebP、GIF，最大 10 MB。封面保存在本地项目资源包中。</small>
              </label>
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
