import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  KnowledgeAreaDocumentsView,
  KnowledgeDocumentView,
  KnowledgeHomeView,
} from "../components/knowledge/KnowledgeDocumentsView";
import { KnowledgeShell } from "../components/knowledge/KnowledgeShell";
import { getKnowledgeArea } from "../lib/knowledgeDocuments";

export function DirectorKnowledgePage() {
  const wildcard = useParams()["*"] ?? "";
  const segments = wildcard.split("/").filter(Boolean);
  let content: ReactNode;

  if (segments.length === 0) {
    content = <KnowledgeHomeView />;
  } else if (segments[0] === "areas" && segments[1]) {
    const area = getKnowledgeArea(segments[1]);
    if (!area) {
      content = <NotFound />;
    } else {
      const documentPath = segments.slice(2).join("/");
      content = documentPath
        ? <KnowledgeDocumentView area={area.id} documentPath={documentPath} />
        : <KnowledgeAreaDocumentsView area={area.id} />;
    }
  } else {
    content = <NotFound />;
  }

  return <KnowledgeShell>{content}</KnowledgeShell>;
}

function NotFound() {
  return (
    <div className="route-error-page">
      <h1>知识页面不存在</h1>
      <p>这里只展示剧本、图片素材和分镜提示词三类 Markdown 文档。</p>
      <Link className="primary-button" to="/knowledge">返回导演知识库</Link>
    </div>
  );
}
