import { Clapperboard } from "lucide-react";
import { Link } from "react-router-dom";

export function VideoPracticeNavLink({ compact = false }: { compact?: boolean }) {
  return <Link className="course-link" to="/ai-video-practice"><Clapperboard size={18} /><span className={compact ? "responsive-action-label" : undefined} data-compact-label={compact ? "练习室" : undefined}>原片拆解训练</span></Link>;
}
