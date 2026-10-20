import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";
import { kindFor, materialLibraryPlugin, readMaterialSummary } from "./materialLibraryPlugin";

type TestMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) => Promise<void>;

function middlewareFor(workspaceRoot: string) {
  let middleware: TestMiddleware | undefined;
  const plugin = materialLibraryPlugin({ workspaceRoot });
  if (typeof plugin.configureServer !== "function") throw new Error("material server hook was not registered");
  const configureServer = plugin.configureServer as (server: ViteDevServer) => void;
  configureServer({
    middlewares: {
      use(value: TestMiddleware) {
        middleware = value;
      },
    },
  } as unknown as ViteDevServer);
  if (!middleware) throw new Error("material middleware was not registered");
  return middleware;
}

async function requestJson(middleware: TestMiddleware, url: string) {
  let body = "";
  const response = {
    statusCode: 0,
    setHeader() {},
    end(value: string) { body = value; },
  } as unknown as ServerResponse;
  await middleware({ method: "GET", url } as IncomingMessage, response, () => undefined);
  return { status: response.statusCode, body: JSON.parse(body) as Record<string, unknown> };
}

describe("material kind detection", () => {
  it("uses the real file type when production folders mix media", () => {
    expect(kindFor("视频/试片/dailies/filmstrip-001.jpg")).toBe("image");
    expect(kindFor("图片/审片/videos/review.mp4")).toBe("video");
    expect(kindFor("图片/审片/audio/reference.wav")).toBe("audio");
    expect(kindFor("音频/剧情/EP05-CREDITS.md")).toBe("story");
    expect(kindFor("视频/试片/metadata.json")).toBe("other");
  });
});

describe("bounded material summaries", () => {
  it("never reads more than the summary byte budget", async () => {
    const root = await mkdtemp(join(tmpdir(), "material-summary-"));
    const file = join(root, "large.md");
    try {
      await writeFile(file, "文".repeat(100_000));
      const preview = await readMaterialSummary(file);
      expect(preview.bytesRead).toBe(64 * 1024);
      expect(preview.truncated).toBe(true);
      expect(Buffer.byteLength(preview.content)).toBeLessThanOrEqual(64 * 1024 + 2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("material media HTTP streaming", () => {
  it("supplies finite lengths and supports full, HEAD, partial and invalid range responses", async () => {
    const root = await mkdtemp(join(tmpdir(), "material-stream-api-"));
    const projectRoot = join(root, "stream-demo");
    await mkdir(join(projectRoot, "library"), { recursive: true });
    await Promise.all([
      writeFile(join(projectRoot, "project.json"), JSON.stringify({ schemaVersion: 1, name: "流测试" })),
      writeFile(join(projectRoot, "library/voice.wav"), "0123456789"),
    ]);
    const middleware = middlewareFor(root);
    const server = createServer((request, response) => {
      void middleware(request, response, () => { response.statusCode = 404; response.end(); });
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("test server did not bind");
      const url = `http://127.0.0.1:${address.port}/api/projects/stream-demo/file?path=voice.wav`;
      const full = await fetch(url);
      expect(full.status).toBe(200);
      expect(full.headers.get("Content-Type")).toBe("audio/wav");
      expect(full.headers.get("Content-Length")).toBe("10");
      expect(full.headers.get("Accept-Ranges")).toBe("bytes");
      expect(await full.text()).toBe("0123456789");
      const head = await fetch(url, { method: "HEAD" });
      expect(head.status).toBe(200);
      expect(head.headers.get("Content-Length")).toBe("10");
      expect(await head.text()).toBe("");
      for (const [requested, expectedBody, expectedRange] of [
        ["bytes=2-5", "2345", "bytes 2-5/10"],
        ["bytes=8-", "89", "bytes 8-9/10"],
        ["bytes=-3", "789", "bytes 7-9/10"],
        ["bytes=7-99", "789", "bytes 7-9/10"],
      ]) {
        const partial = await fetch(url, { headers: { Range: requested } });
        expect(partial.status).toBe(206);
        expect(partial.headers.get("Content-Range")).toBe(expectedRange);
        expect(partial.headers.get("Content-Length")).toBe(String(expectedBody.length));
        expect(await partial.text()).toBe(expectedBody);
      }
      const partialHead = await fetch(url, { method: "HEAD", headers: { Range: "bytes=2-5" } });
      expect(partialHead.status).toBe(206);
      expect(partialHead.headers.get("Content-Range")).toBe("bytes 2-5/10");
      expect(partialHead.headers.get("Content-Length")).toBe("4");
      expect(await partialHead.text()).toBe("");
      for (const range of ["bytes=10-", "bytes=5-2", "bytes=0-1,4-5", "bytes=-0", "invalid"]) {
        const invalid = await fetch(url, { headers: { Range: range } });
        expect(invalid.status).toBe(416);
        expect(invalid.headers.get("Content-Range")).toBe("bytes */10");
        expect(await invalid.text()).toBe("");
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("project story HTTP reads", () => {
  it("serves exact prompt references through a read-only API and rejects traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "material-references-api-"));
    const projectRoot = join(root, "story-demo");
    const hash = (value: string) => createHash("sha256").update(value).digest("hex");
    try {
      await Promise.all([
        mkdir(join(projectRoot, "library"), { recursive: true }),
        mkdir(join(projectRoot, "production"), { recursive: true }),
      ]);
      const body = "人物资产：{{Mixed 1}}";
      const plan = JSON.stringify({ units: [{ unitId: "U1", bodyPath: "library/prompt.md", bodySha256: hash(body), referencePlan: { assets: [{ reference: "{{Mixed 1}}", assetId: "IMAGE", path: "library/image.png", sha256: hash("image") }] } }] });
      await Promise.all([
        writeFile(join(projectRoot, "project.json"), JSON.stringify({ schemaVersion: 1, name: "接口样板" })),
        writeFile(join(projectRoot, "library/prompt.md"), body),
        writeFile(join(projectRoot, "library/image.png"), "image"),
        writeFile(join(projectRoot, "library/plan.json"), plan),
        writeFile(join(projectRoot, "production/story-index.v1.json"), JSON.stringify({ schemaVersion: 1, documentBindings: [] })),
        writeFile(join(projectRoot, "production/asset-bindings.v1.json"), JSON.stringify({ schemaVersion: 1, assets: [
          { assetId: "PROMPT", materialType: "prompt.video", path: "prompt.md", sha256: hash(body), status: "DRAFT" },
          { assetId: "PLAN", role: "reference-plan", path: "plan.json", sha256: hash(plan), status: "DRAFT" },
          { assetId: "IMAGE", materialType: "image.character", path: "image.png", sha256: hash("image"), status: "DRAFT" },
        ] })),
      ]);
      const middleware = middlewareFor(root);
      expect(await requestJson(middleware, "/api/projects/story-demo/prompt-references?path=prompt.md")).toMatchObject({
        status: 200,
        body: { state: "RESOLVED", promptSha256: hash(body), references: [expect.objectContaining({ assetId: "IMAGE", kind: "image", assetStatus: "DRAFT", resolution: "RESOLVED", url: "/api/projects/story-demo/file?path=image.png" })] },
      });
      expect(await requestJson(middleware, "/api/projects/story-demo/prompt-references?path=..%2Fproject.json")).toMatchObject({ status: 404, body: { code: "invalid_path" } });
      expect(await requestJson(middleware, "/api/projects/story-demo/prompt-references")).toMatchObject({ status: 404, body: { code: "invalid_path" } });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serves the story index and one requested episode through stable URLs", async () => {
    const root = await mkdtemp(join(tmpdir(), "material-story-api-"));
    const projectRoot = join(root, "story-demo");
    try {
      await Promise.all([
        mkdir(join(projectRoot, "library"), { recursive: true }),
        mkdir(join(projectRoot, "production"), { recursive: true }),
      ]);
      await writeFile(join(projectRoot, "project.json"), JSON.stringify({ schemaVersion: 1, name: "API 样板剧" }));
      await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
        schemaVersion: 1,
        story: { title: "API 剧本", genre: ["现代"], totalEpisodes: 1, logline: "测试稳定 URL。", synopsis: "按集读取详情。", summaryStatus: "ACCEPTED" },
        currentMilestone: { id: "EP01", episodeIds: ["EP01"] },
        requirements: [],
        characters: [],
        episodes: [{ id: "EP01", title: "第一集", summary: "只加载这一集。", scenes: [{ id: "EP01-S01", heading: "内·大厅·日", cast: [] }] }],
      }));
      await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({ schemaVersion: 1, assets: [] }));
      const middleware = middlewareFor(root);

      const overview = await requestJson(middleware, "/api/projects/story-demo/story");
      const episode = await requestJson(middleware, "/api/projects/story-demo/story/episodes/EP01");

      expect(overview).toEqual(expect.objectContaining({
        status: 200,
        body: expect.objectContaining({ story: expect.objectContaining({ title: "API 剧本" }) }),
      }));
      expect((overview.body as { episode?: unknown }).episode).toBeUndefined();
      expect(episode).toEqual(expect.objectContaining({
        status: 200,
        body: expect.objectContaining({ episode: expect.objectContaining({ id: "EP01" }) }),
      }));

      const assetIndexPath = join(projectRoot, "production", "asset-bindings.v1.json");
      await writeFile(assetIndexPath, JSON.stringify({
        schemaVersion: 1,
        assets: [
          { assetId: "DUPLICATE", materialType: "image.character", path: "missing-a.png", role: "character-standard", status: "DRAFT" },
          { assetId: "DUPLICATE", materialType: "image.character", path: "missing-b.png", role: "character-standard", status: "DRAFT" },
        ],
      }));
      const invalidIndex = await requestJson(middleware, "/api/projects/story-demo/story");
      expect(invalidIndex).toEqual({
        status: 422,
        body: { error: "assetId 必须存在且保持唯一。", code: "invalid_index" },
      });

      await writeFile(assetIndexPath, JSON.stringify({ schemaVersion: 1, assets: [] }));
      await writeFile(join(projectRoot, "production", "story-index.v1.json"), "{");
      const unreadable = await requestJson(middleware, "/api/projects/story-demo/story");
      expect(unreadable).toEqual({
        status: 500,
        body: { error: "读取本地素材失败", code: "MATERIAL_READ_FAILED" },
      });
      expect(JSON.stringify(unreadable)).not.toContain(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
