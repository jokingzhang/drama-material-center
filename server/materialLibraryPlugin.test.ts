import { describe, expect, it } from "vitest";
import { kindFor } from "./materialLibraryPlugin";

describe("material kind detection", () => {
  it("uses the real file type when production folders mix media", () => {
    expect(kindFor("视频/试片/dailies/filmstrip-001.jpg")).toBe("image");
    expect(kindFor("图片/审片/videos/review.mp4")).toBe("video");
    expect(kindFor("图片/审片/audio/reference.wav")).toBe("audio");
    expect(kindFor("音频/剧情/EP05-CREDITS.md")).toBe("story");
    expect(kindFor("视频/试片/metadata.json")).toBe("other");
  });
});
