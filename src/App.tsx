import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { projectLibraryPath } from "./lib/routes";
import { ProjectLibraryPage } from "./pages/ProjectLibraryPage";
import { NotFoundPage, ProjectsPage } from "./pages/ProjectsPage";

const DirectorKnowledgePage = lazy(() => import("./pages/DirectorKnowledgePage").then((module) => ({ default: module.DirectorKnowledgePage })));

function ProjectRedirect() {
  const { projectId = "" } = useParams();
  return <Navigate to={projectLibraryPath(projectId)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/knowledge/*" element={<Suspense fallback={<div className="route-error-page"><p>正在打开导演知识库…</p></div>}><DirectorKnowledgePage /></Suspense>} />
      <Route path="/projects/:projectId" element={<ProjectRedirect />} />
      <Route path="/projects/:projectId/library/*" element={<ProjectLibraryPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
