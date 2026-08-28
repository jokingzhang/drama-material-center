import { describe, expect, it } from "vitest";
import {
  getKnowledgeArea,
  getKnowledgeDocument,
  knowledgeAreas,
  listKnowledgeDocuments,
  normalizeKnowledgeDocumentPath,
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
    expect(getKnowledgeArea("unknown")).toBeUndefined();
  });

  it("resolves relative Markdown links but refuses to escape the current area", () => {
    expect(normalizeKnowledgeDocumentPath("README.md", "人物标准图.md")).toEqual({ path: "人物标准图.md", hash: "" });
    expect(normalizeKnowledgeDocumentPath("主题/说明.md", "../README.md#开始")).toEqual({ path: "README.md", hash: "开始" });
    expect(normalizeKnowledgeDocumentPath("README.md", "../案例/案例.md")).toBeUndefined();
    expect(normalizeKnowledgeDocumentPath("README.md", "https://example.com/a.md")).toBeUndefined();
  });
});
