import { Link, useParams } from "react-router-dom";
import { KnowledgeShell } from "../components/knowledge/KnowledgeShell";
import { KnowledgeUsageView } from "../components/knowledge/KnowledgeUsageView";
import { KnowledgeAreaView, KnowledgeEntryView, KnowledgeMapView } from "../components/knowledge/KnowledgeViews";
import { isSourceCategory, SourceCatalogView, SourceDetailView } from "../components/knowledge/SourceViews";
import type { KnowledgeArea } from "../lib/directorKnowledgeTypes";

function isKnowledgeArea(value: string): value is KnowledgeArea {
  return value === "script" || value === "image-asset" || value === "shot-prompt";
}

export function DirectorKnowledgePage() {
  const wildcard = useParams()["*"] ?? "";
  const segments = wildcard.split("/").filter(Boolean);
  let content: React.ReactNode;

  if (segments.length === 0) content = <KnowledgeMapView />;
  else if (segments[0] === "areas" && segments[1] && isKnowledgeArea(segments[1])) content = <KnowledgeAreaView area={segments[1]} />;
  else if (segments[0] === "items" && segments[1]) content = <KnowledgeEntryView entryId={segments[1]} />;
  else if (segments[0] === "sources" && segments[1] && isSourceCategory(segments[1])) {
    content = segments[2] ? <SourceDetailView category={segments[1]} sourceId={segments[2]} /> : <SourceCatalogView category={segments[1]} />;
  } else if (segments[0] === "usage") content = <KnowledgeUsageView projectId={segments[1]} analysisId={segments[2]} />;
  else content = <div className="route-error-page"><h1>知识页面不存在</h1><p>这个深链可能已失效，或知识 ID 尚未登记。</p><Link className="primary-button" to="/knowledge">返回知识地图</Link></div>;

  return <KnowledgeShell>{content}</KnowledgeShell>;
}
