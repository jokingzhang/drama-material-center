import { ArrowLeft, BookOpenText, BrainCircuit, GitBranch, LibraryBig } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandMark } from "../BrandMark";
import { ThemeToggle } from "../ThemeToggle";

export function KnowledgeShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const section = pathname.startsWith("/knowledge/sources")
    ? "sources"
    : pathname.startsWith("/knowledge/usage")
      ? "usage"
      : "map";

  return (
    <div className="knowledge-shell">
      <header className="app-header knowledge-header">
        <div className="brand-block">
          <BrandMark />
          <div><strong>导演知识库</strong><span>剧本分支 → AssetPlan + ShotTypePlan → ShotPromptPlan</span></div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <Link className="course-link" to="/"><ArrowLeft size={18} />项目素材</Link>
        </div>
      </header>
      <nav className="knowledge-primary-nav" aria-label="导演知识库导航">
        <Link className={section === "map" ? "active" : ""} to="/knowledge"><BrainCircuit size={17} />知识地图</Link>
        <Link className={section === "sources" ? "active" : ""} to="/knowledge/sources/scripts"><LibraryBig size={17} />来源与研究</Link>
        <Link className={section === "usage" ? "active" : ""} to="/knowledge/usage"><GitBranch size={17} />知识使用追踪</Link>
        <span><BookOpenText size={15} />只读 · 项目级事实与用户决定优先</span>
      </nav>
      {children}
    </div>
  );
}
