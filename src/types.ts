export type MaterialKind = "story" | "image" | "video" | "other";

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
}

export interface ProjectsResponse {
  projects: ProjectSummary[];
}

export interface CreateProjectInput {
  id: string;
  name: string;
  description?: string;
}

export interface MaterialAsset {
  id: string;
  path: string;
  name: string;
  folder: string;
  kind: MaterialKind;
  size: number;
  updatedAt: string;
  mimeType: string;
  url: string;
}

export interface MaterialDirectory {
  path: string;
  name: string;
  parentPath: string;
}

export interface MaterialResponse {
  assets: MaterialAsset[];
  directories: MaterialDirectory[];
}
