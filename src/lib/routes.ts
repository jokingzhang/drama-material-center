export function projectLibraryPath(projectId: string, directoryPath = "") {
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedDirectory = directoryPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/projects/${encodedProjectId}/library${encodedDirectory ? `/${encodedDirectory}` : ""}`;
}
