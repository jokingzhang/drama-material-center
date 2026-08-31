import type { IncomingMessage, ServerResponse } from "node:http";
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

describe("project story HTTP reads", () => {
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
