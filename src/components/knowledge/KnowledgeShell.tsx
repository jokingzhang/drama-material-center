import { ArrowLeft, BookOpenText, Clapperboard, Images, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { knowledgeAreaPath } from "../../lib/routes";
import { BrandMark } from "../BrandMark";
import { ThemeToggle } from "../ThemeToggle";

export function KnowledgeShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="knowledge-shell">
      <header className="app-header knowledge-header">
        <div className="brand-block">
          <BrandMark />
          <div><strong>导演知识库</strong><span>AI 维护 · 你只需要查看和确认</span></div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <Link className="course-link" to="/"><ArrowLeft size={18} />项目素材</Link>
        </div>
      </header>
      <nav className="knowledge-primary-nav" aria-label="导演知识库导航">
        <Link className={pathname === "/knowledge" || pathname === "/knowledge/" ? "active" : ""} to="/knowledge"><BookOpenText size={17} />使用说明</Link>
        <Link className={pathname.startsWith(knowledgeAreaPath("script")) ? "active" : ""} to={knowledgeAreaPath("script")}><Lightbulb size={17} />剧本</Link>
        <Link className={pathname.startsWith(knowledgeAreaPath("image-asset")) ? "active" : ""} to={knowledgeAreaPath("image-asset")}><Images size={17} />图片素材</Link>
        <Link className={pathname.startsWith(knowledgeAreaPath("shot-prompt")) ? "active" : ""} to={knowledgeAreaPath("shot-prompt")}><Clapperboard size={17} />分镜提示词</Link>
        <span>只读 Markdown · 无知识接口</span>
      </nav>
      {children}
    </div>
  );
}
