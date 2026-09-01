import { BookOpenText, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { projectLibraryPath, projectStoryOverviewPath } from "../lib/routes";

export function ProjectViewTabs({ projectId, active }: { projectId: string; active: "story" | "library" }) {
  return (
    <nav className="project-view-tabs" aria-label="项目视图">
      <Link className={active === "story" ? "active" : ""} to={projectStoryOverviewPath(projectId)}><BookOpenText size={17} />剧本</Link>
      <Link className={active === "library" ? "active" : ""} to={projectLibraryPath(projectId)}><FolderOpen size={17} />素材文件</Link>
    </nav>
  );
}
