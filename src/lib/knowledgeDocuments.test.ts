import { describe, expect, it } from "vitest";
import {
  getKnowledgeArea,
  getKnowledgeCase,
  getKnowledgeDocument,
  knowledgeAreas,
  listKnowledgeCases,
  listKnowledgeDocuments,
  normalizeKnowledgeDocumentPath,
  splitKnowledgeCaseMarkdown,
  summarizeKnowledgeCaseMarkdown,
} from "./knowledgeDocuments";

describe("director knowledge Markdown catalog", () => {
  it("exposes only the three user-facing knowledge areas", () => {
    expect(knowledgeAreas.map((area) => area.id)).toEqual(["script", "image-asset", "shot-prompt"]);
  });

  it("discovers each area overview and the person standard without a JSON index", () => {
    for (const area of knowledgeAreas) {
      expect(listKnowledgeDocuments(area.id).some((document) => document.path === "README.md")).toBe(true);
    }
    expect(getKnowledgeDocument("image-asset", "人物标准图.md")?.title).toBe("人物标准图");
    expect(getKnowledgeDocument("shot-prompt", "对白、梗与情绪的分镜写法.md")?.title).toBe("对白、梗与情绪的分镜写法");
    expect(getKnowledgeArea("unknown")).toBeUndefined();
  });

  it("resolves relative Markdown links but refuses to escape the current area", () => {
    expect(normalizeKnowledgeDocumentPath("README.md", "人物标准图.md")).toEqual({ path: "人物标准图.md", hash: "" });
    expect(normalizeKnowledgeDocumentPath("主题/说明.md", "../README.md#开始")).toEqual({ path: "README.md", hash: "开始" });
    expect(normalizeKnowledgeDocumentPath("README.md", "../案例/案例.md")).toBeUndefined();
    expect(normalizeKnowledgeDocumentPath("README.md", "https://example.com/a.md")).toBeUndefined();
  });

  it("discovers the eight complete LibTV shot cases from one Markdown source", async () => {
    const cases = listKnowledgeCases();
    expect(cases).toHaveLength(8);
    expect(getKnowledgeCase("猫爪挡脸接触喜剧")?.title).toBe("猫爪挡脸接触喜剧");
    expect(getKnowledgeCase("四人依次入镜到战术集结")?.title).toBe("四人依次入镜到战术集结");

    for (const knowledgeCase of cases) {
      const markdown = await knowledgeCase.load();
      const sections = splitKnowledgeCaseMarkdown(markdown);
      const preview = summarizeKnowledgeCaseMarkdown(markdown);
      expect(sections?.inputs).toContain("![");
      expect(sections?.prompt).toContain("```text");
      expect(sections?.result).toContain("/knowledge-media/LibTV/");
      expect(preview?.imageUrl).toMatch(/^https:\/\//);
      expect(preview?.videoUrl).toMatch(/^\/knowledge-media\/LibTV\//);
      expect(preview?.promptExcerpt.length).toBeGreaterThan(20);
    }
  });
});
