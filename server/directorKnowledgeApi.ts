import type { IncomingMessage, ServerResponse } from "node:http";
import { createAnalysisCatalog, AnalysisCatalogError } from "./analysisCatalog.ts";
import { createDirectorKnowledgeCatalog, DirectorKnowledgeError } from "./directorKnowledge.ts";
import { createSourceCatalog, SourceCatalogError } from "./sourceCatalog.ts";

interface DirectorKnowledgeMiddlewareOptions {
  workspaceRoot: string;
  knowledgeRoot: string;
}

type Next = (error?: unknown) => void;

class DirectorRequestError extends Error {
  readonly code = "INVALID_QUERY";

  constructor() {
    super("请求参数无效。");
    this.name = "DirectorRequestError";
  }
}

const knowledgeAreas = new Set(["script", "image-asset", "shot-prompt"]);
const knowledgeLayers = new Set(["standard", "pattern", "risk", "case"]);
const knowledgeStatuses = new Set(["DRAFT", "ACTIVE", "OBSERVED", "REUSABLE", "VALIDATED", "RETIRED"]);
const sourceTypes = new Set(["SCRIPT_SAMPLE", "COURSE_MATERIAL", "COMPLETED_WORK_CANVAS"]);
const captureCoverages = new Set(["CAPTURED_5", "METADATA_ONLY", "UNAVAILABLE", "PARTIAL_EPISODES", "NOT_APPLICABLE"]);
const researchStatuses = new Set(["UNSTUDIED", "SELECTED", "SOURCE_STUDIED", "MEDIA_STUDIED"]);

function optionalText(url: URL, name: string, maxLength = 200) {
  const values = url.searchParams.getAll(name);
  if (values.length > 1) throw new DirectorRequestError();
  const value = values[0]?.trim();
  if (!value) return undefined;
  if (value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) throw new DirectorRequestError();
  return value;
}

function optionalEnum<T extends string>(url: URL, name: string, allowed: ReadonlySet<string>) {
  const value = optionalText(url, name, 64);
  if (value === undefined) return undefined;
  if (!allowed.has(value)) throw new DirectorRequestError();
  return value as T;
}

function optionalSection(url: URL) {
  const values = url.searchParams.getAll("section");
  if (values.length === 0) return undefined;
  if (values.length !== 1) throw new DirectorRequestError();
  const section = values[0].trim();
  if (!section || section.length > 200 || /[\u0000-\u001f\u007f]/u.test(section)) throw new DirectorRequestError();
  return section;
}

function assertOnlyQueryParameters(url: URL, allowed: ReadonlySet<string>) {
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) throw new DirectorRequestError();
  }
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new DirectorRequestError();
  }
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(value));
}

function errorStatus(error: DirectorKnowledgeError | SourceCatalogError | AnalysisCatalogError) {
  if (error.code.endsWith("NOT_FOUND")) return 404;
  if (error.code === "SOURCE_SECTION_INVALID") return 400;
  if (error.code === "SOURCE_DOCUMENT_INTEGRITY_FAILED") return 409;
  if (error.code.endsWith("AMBIGUOUS")) return 409;
  if (error.code === "PROJECT_NOT_FOUND") return 404;
  return 500;
}

export function createDirectorKnowledgeMiddleware(options: DirectorKnowledgeMiddlewareOptions) {
  let knowledgeCatalogPromise: ReturnType<typeof createDirectorKnowledgeCatalog> | undefined;
  let sourceCatalogPromise: ReturnType<typeof createSourceCatalog> | undefined;
  const knowledgeCatalog = () => {
    if (!knowledgeCatalogPromise) {
      knowledgeCatalogPromise = createDirectorKnowledgeCatalog(options.knowledgeRoot).catch((error) => {
        knowledgeCatalogPromise = undefined;
        throw error;
      });
    }
    return knowledgeCatalogPromise;
  };
  const sourceCatalog = () => {
    if (!sourceCatalogPromise) {
      sourceCatalogPromise = createSourceCatalog(options).catch((error) => {
        sourceCatalogPromise = undefined;
        throw error;
      });
    }
    return sourceCatalogPromise;
  };

  return async (request: IncomingMessage, response: ServerResponse, next: Next) => {
    if (!request.url) {
      next();
      return;
    }
    const url = new URL(request.url, "http://127.0.0.1");
    const isDirectorRoute = url.pathname.startsWith("/api/director/")
      || /^\/api\/projects\/[^/]+\/analyses(?:\/[^/]+)?$/.test(url.pathname);
    if (!isDirectorRoute) {
      next();
      return;
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/director/overview") {
        sendJson(response, 200, (await knowledgeCatalog()).overview());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/director/knowledge") {
        sendJson(response, 200, {
          entries: (await knowledgeCatalog()).list({
            area: optionalEnum(url, "area", knowledgeAreas),
            layer: optionalEnum(url, "layer", knowledgeLayers),
            status: optionalEnum(url, "status", knowledgeStatuses),
            query: optionalText(url, "q"),
          }),
        });
        return;
      }

      const knowledgeMatch = url.pathname.match(/^\/api\/director\/knowledge\/([^/]+)$/);
      if (request.method === "GET" && knowledgeMatch) {
        sendJson(response, 200, { entry: (await knowledgeCatalog()).get(decodePathSegment(knowledgeMatch[1])) });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/director/sources") {
        sendJson(response, 200, (await sourceCatalog()).list({
          sourceType: optionalEnum(url, "type", sourceTypes),
          provider: optionalText(url, "provider", 100),
          captureCoverage: optionalEnum(url, "coverage", captureCoverages),
          researchStatus: optionalEnum(url, "research", researchStatuses),
          query: optionalText(url, "q"),
        }));
        return;
      }

      const sourceDocumentMatch = url.pathname.match(/^\/api\/director\/sources\/([^/]+)\/documents\/(summary|raw)$/);
      if (request.method === "GET" && sourceDocumentMatch) {
        assertOnlyQueryParameters(url, new Set(["section"]));
        const section = optionalSection(url);
        if (sourceDocumentMatch[2] === "raw" && section !== undefined) throw new DirectorRequestError();
        const document = await (await sourceCatalog()).readDocument(
          decodePathSegment(sourceDocumentMatch[1]),
          sourceDocumentMatch[2] as "summary" | "raw",
          { ...(section === undefined ? {} : { section }) },
        );
        sendJson(response, 200, { document });
        return;
      }

      const sourceMatch = url.pathname.match(/^\/api\/director\/sources\/([^/]+)$/);
      if (request.method === "GET" && sourceMatch) {
        sendJson(response, 200, { source: (await sourceCatalog()).get(decodePathSegment(sourceMatch[1])) });
        return;
      }

      const analysisMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/analyses(?:\/([^/]+))?$/);
      if (request.method === "GET" && analysisMatch) {
        const catalog = await createAnalysisCatalog(
          options.workspaceRoot,
          decodePathSegment(analysisMatch[1]),
          await knowledgeCatalog(),
        );
        if (analysisMatch[2]) {
          sendJson(response, 200, { analysis: catalog.get(decodePathSegment(analysisMatch[2])) });
        } else {
          sendJson(response, 200, catalog.list());
        }
        return;
      }

      sendJson(response, request.method === "GET" ? 404 : 405, {
        error: request.method === "GET" ? "接口不存在" : "请求方法不受支持",
        code: request.method === "GET" ? "NOT_FOUND" : "METHOD_NOT_ALLOWED",
      });
    } catch (error) {
      if (error instanceof DirectorRequestError) {
        sendJson(response, 400, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof DirectorKnowledgeError || error instanceof SourceCatalogError || error instanceof AnalysisCatalogError) {
        sendJson(response, errorStatus(error), { error: error.message, code: error.code });
        return;
      }
      sendJson(response, 500, { error: "读取导演知识失败。", code: "DIRECTOR_READ_FAILED" });
    }
  };
}
