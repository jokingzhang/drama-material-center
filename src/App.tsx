import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { projectLibraryPath } from "./lib/routes";
import { ProjectLibraryPage } from "./pages/ProjectLibraryPage";
import { NotFoundPage, ProjectsPage } from "./pages/ProjectsPage";

function ProjectRedirect() {
  const { projectId = "" } = useParams();
  return <Navigate to={projectLibraryPath(projectId)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/projects/:projectId" element={<ProjectRedirect />} />
      <Route path="/projects/:projectId/library/*" element={<ProjectLibraryPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
