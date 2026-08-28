import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RegisteredReadError } from "./safeRegisteredRead.ts";
import { parseKnowledgeMediaRange, resolveKnowledgeCaseMedia } from "./knowledgeCaseMedia.ts";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createMediaRoot() {
  const root = await mkdtemp(join(tmpdir(), "knowledge-case-media-"));
  temporaryRoots.push(root);
  await mkdir(join(root, "LibTV"));
  await writeFile(join(root, "LibTV", "case.mp4"), "video");
  return root;
}

describe("knowledge case media resolver", () => {
  it("parses open, bounded, and suffix byte ranges", () => {
    expect(parseKnowledgeMediaRange("bytes=0-", 1_000)).toEqual({ start: 0, end: 999 });
    expect(parseKnowledgeMediaRange("bytes=100-199", 1_000)).toEqual({ start: 100, end: 199 });
    expect(parseKnowledgeMediaRange("bytes=-250", 1_000)).toEqual({ start: 750, end: 999 });
    expect(parseKnowledgeMediaRange("bytes=1000-", 1_000)).toBeUndefined();
    expect(parseKnowledgeMediaRange("bytes=-0", 1_000)).toBeUndefined();
    expect(parseKnowledgeMediaRange("bytes=0-1,4-5", 1_000)).toBeUndefined();
  });

  it("resolves only registered MP4 files below the ignored media root", async () => {
    const root = await createMediaRoot();
    await expect(resolveKnowledgeCaseMedia(root, "/knowledge-media/LibTV/case.mp4"))
      .resolves.toBe(await realpath(join(root, "LibTV", "case.mp4")));
  });

  it("rejects traversal, unsupported files, malformed encoding, and symlinks", async () => {
    const root = await createMediaRoot();
    const outside = join(root, "outside.mp4");
    await writeFile(outside, "outside");
    await symlink(outside, join(root, "LibTV", "linked.mp4"));

    for (const pathname of [
      "/knowledge-media/../outside.mp4",
      "/knowledge-media/LibTV/case.txt",
      "/knowledge-media/%E0%A4%A",
      "/knowledge-media/LibTV/linked.mp4",
    ]) {
      await expect(resolveKnowledgeCaseMedia(root, pathname)).rejects.toBeInstanceOf(RegisteredReadError);
    }
  });
});
