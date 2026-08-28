export type KnowledgeAreaId = "script" | "image-asset" | "shot-prompt";

export interface KnowledgeAreaInfo {
  id: KnowledgeAreaId;
  directory: string;
  title: string;
  question: string;
  result: string;
}

export interface KnowledgeDocument {
  area: KnowledgeAreaId;
  path: string;
  title: string;
  isOverview: boolean;
  load: () => Promise<string>;
}

type MarkdownLoader = () => Promise<string>;

export const knowledgeAreas: KnowledgeAreaInfo[] = [
  {
    id: "script",
    directory: "剧本",
    title: "剧本知识",
    question: "怎样把想法、梗概或现有剧本推进成能拍的故事？",
    result: "故事方案与需要确认的关键方向",
  },
  {
    id: "image-asset",
    directory: "图片素材",
    title: "图片素材知识",
    question: "这部剧应该准备哪些图片，每张图片必须长什么样？",
    result: "图片素材清单与生成标准",
  },
  {
    id: "shot-prompt",
    directory: "分镜提示词",
    title: "分镜提示词知识",
    question: "这一段属于什么镜头任务，怎样拆镜并写成提示词？",
    result: "分镜执行表与最终提示词",
  },
];

const markdownModules: Record<string, MarkdownLoader> = {
  ...import.meta.glob<string>("../../director-knowledge-base/剧本/**/*.md", { query: "?raw", import: "default" }),
  ...import.meta.glob<string>("../../director-knowledge-base/图片素材/**/*.md", { query: "?raw", import: "default" }),
  ...import.meta.glob<string>("../../director-knowledge-base/分镜提示词/**/*.md", { query: "?raw", import: "default" }),
};

function titleFromPath(path: string) {
  const fileName = path.split("/").at(-1) ?? path;
  return fileName === "README.md" ? "从这里开始" : fileName.replace(/\.md$/i, "");
}

function documentFromModule(modulePath: string, load: MarkdownLoader): KnowledgeDocument | undefined {
  const area = knowledgeAreas.find((candidate) => modulePath.includes(`/director-knowledge-base/${candidate.directory}/`));
  if (!area) return undefined;
  const marker = `/director-knowledge-base/${area.directory}/`;
  const path = modulePath.slice(modulePath.indexOf(marker) + marker.length);
  if (!path || path.startsWith("/") || path.split("/").includes("..")) return undefined;
  return {
    area: area.id,
    path,
    title: titleFromPath(path),
    isOverview: path === "README.md",
    load,
  };
}

const knowledgeDocuments = Object.entries(markdownModules)
  .map(([path, load]) => documentFromModule(path, load))
  .filter((document): document is KnowledgeDocument => Boolean(document))
  .sort((left, right) => {
    if (left.area !== right.area) return knowledgeAreas.findIndex((area) => area.id === left.area) - knowledgeAreas.findIndex((area) => area.id === right.area);
    if (left.isOverview !== right.isOverview) return left.isOverview ? -1 : 1;
    return left.title.localeCompare(right.title, "zh-CN");
  });

export function getKnowledgeArea(areaId: string) {
  return knowledgeAreas.find((area) => area.id === areaId);
}

export function listKnowledgeDocuments(areaId: KnowledgeAreaId) {
  return knowledgeDocuments.filter((document) => document.area === areaId);
}

export function getKnowledgeDocument(areaId: KnowledgeAreaId, path: string) {
  return knowledgeDocuments.find((document) => document.area === areaId && document.path === path);
}

export function normalizeKnowledgeDocumentPath(currentPath: string, href: string) {
  const [rawPath, hash = ""] = href.split("#", 2);
  if (!rawPath) return { path: currentPath, hash };
  if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(rawPath)) return undefined;

  const stack = currentPath.split("/").slice(0, -1).filter(Boolean);
  for (const segment of rawPath.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) return undefined;
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  const path = stack.join("/");
  if (!path || !path.toLocaleLowerCase().endsWith(".md")) return undefined;
  return { path, hash };
}
