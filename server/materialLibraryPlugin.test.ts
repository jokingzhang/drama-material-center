import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kindFor, readMaterialSummary } from "./materialLibraryPlugin";

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
