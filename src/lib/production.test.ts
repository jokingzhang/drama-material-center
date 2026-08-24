import { describe, expect, it } from "vitest";
import { episodeForPath, naturalProductionCompare, parseChineseNumber, productionMetaFor } from "./production";

describe("production metadata", () => {
  it("parses Chinese episode numbers and EP tokens", () => {
    expect(parseChineseNumber("八")).toBe(8);
    expect(parseChineseNumber("十六")).toBe(16);
    expect(parseChineseNumber("二十六")).toBe(26);
    expect(episodeForPath("图片/剧情/第八集/镜头.png")).toBe(8);
    expect(episodeForPath("视频/EP06-EP09/EP08-双刀/T02/take.mp4")).toBe(8);
    expect(episodeForPath("图片/第一副本重构EP06-EP09/通用设定.png")).toBeUndefined();
  });

  it("sorts episode folders by production order", () => {
    const values = ["第九集", "第二集", "第十六集", "第一集"];
    expect(values.sort(naturalProductionCompare)).toEqual(["第一集", "第二集", "第九集", "第十六集"]);
  });

  it("extracts explicit path markers without treating them as hidden acceptance", () => {
    expect(productionMetaFor({
      path: "视频/剧情/EP08/T03A/approved-v02/source/EP08-T03A-v02.mp4",
      kind: "video",
    })).toMatchObject({
      episode: 8,
      shot: "T03A",
      version: "v02",
      stage: "take",
      pathMarker: "ACCEPTED",
    });
  });
});
