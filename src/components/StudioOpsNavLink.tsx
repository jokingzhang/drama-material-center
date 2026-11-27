import { Compass } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { studioOpsPath } from "../lib/routes";
import { getStudioOpsStatus } from "../lib/studioOps";

export function StudioOpsNavLink({ compact = false }: { compact?: boolean }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getStudioOpsStatus(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setAvailable(Boolean(result.available));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAvailable(false);
        }
      });
    return () => controller.abort();
  }, []);

  if (!available) return null;

  return (
    <Link className="course-link" to={studioOpsPath()}>
      <Compass size={18} />
      <span className={compact ? "responsive-action-label" : undefined} data-compact-label={compact ? "管家" : undefined}>
        运营管家
      </span>
    </Link>
  );
}
