import { Radar } from "lucide-react";
import { Link } from "react-router-dom";
import { weeklyRadarPath } from "../lib/routes";

export function WeeklyRadarNavLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="course-link weekly-radar-nav-link" to={weeklyRadarPath()}>
      <Radar size={18} />
      <span className={compact ? "responsive-action-label" : undefined} data-compact-label={compact ? "雷达" : undefined}>
        AI视频一周雷达
      </span>
    </Link>
  );
}
