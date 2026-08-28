import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDirectorKnowledgeMiddleware } from "./directorKnowledgeApi";

const temporaryRoots: string[] = [];
const servers: Server[] = [];

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function temporaryRoot(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("director knowledge HTTP interface", () => {
  it("returns an exact registered Markdown section with a complete source locator", async () => {
    const workspaceRoot = await temporaryRoot("director-api-workspace-");
    const knowledgeRoot = await temporaryRoot("director-api-knowledge-");
    const snapshotRoot = join(workspaceRoot, "archives", "snapshot-1");
    const itemRoot = join(snapshotRoot, "reelmate-wondershare", "Example__abc");
    await mkdir(join(knowledgeRoot, ".ai-director"), { recursive: true });
    await mkdir(itemRoot, { recursive: true });
    await writeFile(join(knowledgeRoot, ".ai-director", "index.json"), JSON.stringify({
      schemaVersion: 2, standards: [], cards: [], cases: [],
    }), "utf8");
    await writeFile(join(knowledgeRoot, ".ai-director", "source-registry.json"), JSON.stringify({
      schemaVersion: 1,
      snapshots: [{
        snapshotId: "SCRIPT-MARKET-ONE",
        sourceType: "SCRIPT_SAMPLE",
        workspaceRelativePath: "archives/snapshot-1",
        indexFile: "index.json",
        checksumFile: "SHA256SUMS",
        providers: ["reelmate-wondershare"],
      }],
      pendingSources: [],
    }), "utf8");
    await writeFile(join(snapshotRoot, "index.json"), JSON.stringify({
      schemaVersion: 1,
      generatedAt: "2026-08-28T05:04:37.192Z",
      platforms: [{
        site: "reelmate-wondershare", marketCount: 1, archivedCount: 1,
        fullFiveCount: 1, zeroEpisodeCount: 0, savedEpisodeCount: 5,
        entries: [{ id: "abc", title: "Example", episodes: 5 }],
      }],
      unavailable: [],
    }), "utf8");
    await writeFile(join(itemRoot, "source.json"), JSON.stringify({
      schemaVersion: 1,
      site: "reelmate-wondershare",
      id: "abc",
      title: "Example",
      sourceUrl: "https://example.com/item/abc",
      capturedAt: "2026-08-28T04:53:48.596Z",
      accessScope: "logged-in-visible-preview",
      requestedEpisodeLimit: 5,
      capturedEpisodeCount: 5,
      availableFields: ["title", "episodes"],
    }), "utf8");
    const summaryContent = [
      "# Example", "", "## 世界观", "雨城。", "", "## 人物", "阿青。",
    ].join("\n");
    const rawContent = "Example";
    const summaryHash = sha256(summaryContent);
    const rawHash = sha256(rawContent);
    await writeFile(join(itemRoot, "剧本资料.md"), summaryContent, "utf8");
    await writeFile(join(itemRoot, "原始页面文本.txt"), rawContent, "utf8");
    await writeFile(join(snapshotRoot, "SHA256SUMS"), [
      `${"0".repeat(64)}  reelmate-wondershare/Example__abc/source.json`,
      `${summaryHash}  reelmate-wondershare/Example__abc/剧本资料.md`,
      `${rawHash}  reelmate-wondershare/Example__abc/原始页面文本.txt`,
      "",
    ].join("\n"), "utf8");

    const middleware = createDirectorKnowledgeMiddleware({ workspaceRoot, knowledgeRoot });
    const server = createServer((request, response) => middleware(request, response, () => {
      response.statusCode = 404;
      response.end();
    }));
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");

    const endpoint = `http://127.0.0.1:${address.port}/api/director/sources/SCRIPT-reelmate-wondershare-abc/documents/summary?section=${encodeURIComponent("世界观")}`;
    const response = await fetch(endpoint);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      document: expect.objectContaining({
        content: "## 世界观\n雨城。\n",
        locator: {
          sourceId: "SCRIPT-reelmate-wondershare-abc",
          snapshotId: "SCRIPT-MARKET-ONE",
          relativePath: "reelmate-wondershare/Example__abc/剧本资料.md",
          sha256: summaryHash,
          integrity: "VERIFIED",
          section: {
            kind: "MARKDOWN_HEADING",
            heading: "世界观",
            headingLevel: 2,
            startLine: 3,
            bodyStartLine: 4,
            endLine: 5,
          },
          rights: {
            accessScope: "logged-in-visible-preview",
            status: "RIGHTS_UNKNOWN",
            gate: "RIGHTS_REVIEW_REQUIRED",
          },
        },
      }),
    });

    await writeFile(join(itemRoot, "剧本资料.md"), `${summaryContent}\n篡改`, "utf8");
    const tampered = await fetch(endpoint);
    expect(tampered.status).toBe(409);
    expect(await tampered.json()).toEqual({
      error: "导演来源文档完整性校验失败，已拒绝读取。",
      code: "SOURCE_DOCUMENT_INTEGRITY_FAILED",
    });
  });

  it("does not permanently cache an invalid knowledge index after the file is repaired", async () => {
    const workspaceRoot = await temporaryRoot("director-api-workspace-");
    const knowledgeRoot = await temporaryRoot("director-api-knowledge-");
    await mkdir(join(knowledgeRoot, ".ai-director"), { recursive: true });
    const indexPath = join(knowledgeRoot, ".ai-director", "index.json");
    await writeFile(indexPath, JSON.stringify({ schemaVersion: 2, standards: "invalid", cards: [], cases: [] }), "utf8");
    const middleware = createDirectorKnowledgeMiddleware({ workspaceRoot, knowledgeRoot });
    const server = createServer((request, response) => middleware(request, response, () => {
      response.statusCode = 404;
      response.end();
    }));
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    const endpoint = `http://127.0.0.1:${address.port}/api/director/overview`;

    expect((await fetch(endpoint)).status).toBe(500);
    await writeFile(indexPath, JSON.stringify({ schemaVersion: 2, standards: [], cards: [], cases: [] }), "utf8");
    const repaired = await fetch(endpoint);
    expect(repaired.status).toBe(200);
    expect(await repaired.json()).toEqual(expect.objectContaining({ status: "VALID" }));
  });

  it("serves the knowledge overview from the fixed repository knowledge root", async () => {
    const workspaceRoot = await temporaryRoot("director-api-workspace-");
    const knowledgeRoot = await temporaryRoot("director-api-knowledge-");
    await mkdir(join(knowledgeRoot, ".ai-director"), { recursive: true });
    await writeFile(join(knowledgeRoot, ".ai-director", "index.json"), JSON.stringify({
      schemaVersion: 2,
      standards: [],
      cards: [],
      cases: [],
    }), "utf8");
    await writeFile(join(knowledgeRoot, ".ai-director", "source-registry.json"), JSON.stringify({
      schemaVersion: 1,
      snapshots: [],
      pendingSources: [],
    }), "utf8");
    const middleware = createDirectorKnowledgeMiddleware({ workspaceRoot, knowledgeRoot });
    const server = createServer((request, response) => middleware(request, response, () => {
      response.statusCode = 404;
      response.end();
    }));
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/director/overview`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ status: "VALID" }));
    expect(JSON.stringify(body)).not.toContain(knowledgeRoot);
    expect(JSON.stringify(body)).not.toContain(workspaceRoot);

    const filtered = await (await fetch(`http://127.0.0.1:${address.port}/api/director/knowledge?area=script&layer=case`)).json();
    expect(filtered).toEqual({ entries: [] });

    const malformed = await fetch(`http://127.0.0.1:${address.port}/api/director/knowledge/%E0%A4%A`);
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "请求参数无效。", code: "INVALID_QUERY" });
  });

  it("serves an empty source catalog and honest empty project analysis state", async () => {
    const workspaceRoot = await temporaryRoot("director-api-workspace-");
    const knowledgeRoot = await temporaryRoot("director-api-knowledge-");
    await mkdir(join(knowledgeRoot, ".ai-director"), { recursive: true });
    await writeFile(join(knowledgeRoot, ".ai-director", "index.json"), JSON.stringify({
      schemaVersion: 2,
      standards: [], cards: [], cases: [],
    }), "utf8");
    await writeFile(join(knowledgeRoot, ".ai-director", "source-registry.json"), JSON.stringify({
      schemaVersion: 1,
      snapshots: [],
      pendingSources: [
        {
          sourceId: "COURSE-one", sourceType: "COURSE_MATERIAL", provider: "bilibili", title: "Course",
          importStatus: "IMPORT_PENDING", researchStatus: "SELECTED",
          inspectionDepth: "REGISTERED_CANDIDATE_ONLY",
          freshness: { basis: "REGISTRY_ONLY", revalidationStatus: "NOT_IMPORTED" },
          claimTypes: ["CREATOR_CLAIM", "DOCUMENTED_PROCEDURE"],
        },
        {
          sourceId: "CANVAS-one", sourceType: "COMPLETED_WORK_CANVAS", provider: "libtv", title: "Canvas",
          importStatus: "MEDIA_NOT_IMPORTED", researchStatus: "MEDIA_STUDIED",
          inspectionDepth: "GRAPH_AND_MEDIA_SAMPLED",
          freshness: { basis: "STUDIED_AT", asOf: "2026-08-28", revalidationStatus: "NOT_REVALIDATED" },
          claimTypes: ["OBSERVED_ARTIFACT"],
        },
      ],
    }), "utf8");
    await mkdir(join(workspaceRoot, "sample-project", "library"), { recursive: true });
    await writeFile(join(workspaceRoot, "sample-project", "project.json"), JSON.stringify({ schemaVersion: 1, name: "Sample" }), "utf8");
    const middleware = createDirectorKnowledgeMiddleware({ workspaceRoot, knowledgeRoot });
    const server = createServer((request, response) => middleware(request, response, () => {
      response.statusCode = 404;
      response.end();
    }));
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    const origin = `http://127.0.0.1:${address.port}`;

    const sources = await (await fetch(`${origin}/api/director/sources?type=SCRIPT_SAMPLE`)).json();
    const filteredSources = await (await fetch(`${origin}/api/director/sources?type=COURSE_MATERIAL&provider=libtv`)).json();
    const analyses = await (await fetch(`${origin}/api/projects/sample-project/analyses`)).json();

    expect(sources).toEqual({
      sources: [],
      filteredTotal: 0,
      summary: {
        total: 0, archived: 0, unavailable: 0, capturedFive: 0, metadataOnly: 0,
        partialEpisodes: 0, verifiedFiles: 0, failedFiles: 0, declaredFiles: 0, unverifiedFiles: 0,
      },
    });
    expect(filteredSources).toEqual(expect.objectContaining({
      sources: [],
      filteredTotal: 0,
      summary: expect.objectContaining({ total: 1, unavailable: 0 }),
    }));
    expect(analyses).toEqual({ status: "EMPTY", analyses: [] });

    const invalidFilter = await fetch(`${origin}/api/director/sources?coverage=EVERYTHING`);
    expect(invalidFilter.status).toBe(400);
    expect(await invalidFilter.json()).toEqual({ error: "请求参数无效。", code: "INVALID_QUERY" });

    const rawSection = await fetch(`${origin}/api/director/sources/COURSE-one/documents/raw?section=世界观`);
    expect(rawSection.status).toBe(400);
    expect(await rawSection.json()).toEqual({ error: "请求参数无效。", code: "INVALID_QUERY" });

    const emptySection = await fetch(`${origin}/api/director/sources/COURSE-one/documents/summary?section=`);
    expect(emptySection.status).toBe(400);
    expect(await emptySection.json()).toEqual({ error: "请求参数无效。", code: "INVALID_QUERY" });

    const repeatedSection = await fetch(`${origin}/api/director/sources/COURSE-one/documents/summary?section=人物&section=世界观`);
    expect(repeatedSection.status).toBe(400);

    const unknownDocumentParameter = await fetch(`${origin}/api/director/sources/COURSE-one/documents/summary?path=elsewhere`);
    expect(unknownDocumentParameter.status).toBe(400);
  });
});
