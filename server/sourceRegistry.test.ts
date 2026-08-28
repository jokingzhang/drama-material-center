import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("repository director source registry", () => {
  it("registers seven studied LibTV canvases without changing the script or course baselines", async () => {
    const knowledgeDirectory = join(process.cwd(), "director-knowledge-base", ".ai-director");
    const registry = JSON.parse(await readFile(
      join(knowledgeDirectory, "source-registry.json"),
      "utf8",
    )) as {
      snapshots: Array<{
        sourceType: string;
        expectedCatalog?: {
          marketTotal: number;
          archivedTotal: number;
          unavailableTotal: number;
          capturedFiveTotal: number;
          metadataOnlyTotal: number;
          providers: Array<{
            provider: string;
            marketCount: number;
            archivedCount: number;
            unavailableCount: number;
            capturedFiveCount: number;
            metadataOnlyCount: number;
          }>;
        };
      }>;
      sourceStudies?: Array<{
        sourceId: string;
        researchStatus: string;
        relatedCaseIds: string[];
        relatedKnowledgeIds: string[];
        inspectionDepth: string;
        studiedAt: string;
        claimTypes: string[];
      }>;
      pendingSources: Array<{
        sourceId: string;
        sourceType: string;
        provider: string;
        sourceUrl?: string;
        importStatus: string;
        researchStatus: string;
        rights?: { status: string; gate: string };
        relatedCaseIds?: string[];
        relatedKnowledgeIds?: string[];
        inspectionDepth: string;
        freshness: { basis: string; asOf?: string; revalidationStatus: string };
        claimTypes: string[];
      }>;
    };
    const knowledgeIndex = JSON.parse(await readFile(join(knowledgeDirectory, "index.json"), "utf8")) as {
      cases: Array<{ id: string; sourceUrl: string; derivedCardIds: string[] }>;
    };
    const caseById = new Map(knowledgeIndex.cases.map((caseMeta) => [caseMeta.id, caseMeta]));
    const canvases = registry.pendingSources.filter((source) => source.sourceType === "COMPLETED_WORK_CANVAS");
    const courses = registry.pendingSources.filter((source) => source.sourceType === "COURSE_MATERIAL");
    const scriptStudies = registry.sourceStudies ?? [];

    const scriptSnapshots = registry.snapshots.filter((source) => source.sourceType === "SCRIPT_SAMPLE");
    expect(scriptSnapshots).toHaveLength(1);
    expect(scriptSnapshots[0].expectedCatalog).toEqual({
      marketTotal: 273,
      archivedTotal: 268,
      unavailableTotal: 5,
      capturedFiveTotal: 231,
      metadataOnlyTotal: 37,
      providers: [
        {
          provider: "yuewen-dramabuddy",
          marketCount: 95,
          archivedCount: 90,
          unavailableCount: 5,
          capturedFiveCount: 89,
          metadataOnlyCount: 1,
        },
        {
          provider: "reelmate-wondershare",
          marketCount: 178,
          archivedCount: 178,
          unavailableCount: 0,
          capturedFiveCount: 142,
          metadataOnlyCount: 36,
        },
      ],
    });
    expect(courses).toHaveLength(1);
    expect(canvases).toHaveLength(7);
    expect(scriptStudies).toHaveLength(12);
    expect(new Set(scriptStudies.map((study) => study.sourceId)).size).toBe(12);
    for (const study of scriptStudies) {
      expect(study).toEqual(expect.objectContaining({
        sourceId: expect.stringMatching(/^SCRIPT-/),
        researchStatus: "SOURCE_STUDIED",
        relatedCaseIds: [expect.stringMatching(/^CASE-/)],
        relatedKnowledgeIds: expect.arrayContaining([expect.stringMatching(/^DRAMA-(?:PAT|RISK)-/)]),
        inspectionDepth: "METADATA_AND_EPISODE_SAMPLE",
        studiedAt: "2026-08-28",
        claimTypes: ["OBSERVED_ARTIFACT", "ILLUSTRATIVE_EXAMPLE"],
      }));
      const relatedCase = caseById.get(study.relatedCaseIds[0]);
      expect(relatedCase).toBeDefined();
      expect(study.relatedKnowledgeIds).toEqual(relatedCase?.derivedCardIds);
    }
    expect(courses[0]).toEqual(expect.objectContaining({
      importStatus: "IMPORT_PENDING",
      researchStatus: "SELECTED",
      inspectionDepth: "REGISTERED_CANDIDATE_ONLY",
      freshness: { basis: "REGISTRY_ONLY", revalidationStatus: "NOT_IMPORTED" },
      claimTypes: ["CREATOR_CLAIM", "DOCUMENTED_PROCEDURE", "ILLUSTRATIVE_EXAMPLE"],
    }));
    expect(new Set(canvases.map((source) => source.sourceId)).size).toBe(7);
    for (const source of canvases) {
      expect(source).toEqual(expect.objectContaining({
        provider: "liblib",
        importStatus: "MEDIA_NOT_IMPORTED",
        researchStatus: "MEDIA_STUDIED",
        rights: { status: "RIGHTS_UNKNOWN", gate: "RIGHTS_REVIEW_REQUIRED" },
        relatedCaseIds: [expect.stringMatching(/^CASE-/)],
        relatedKnowledgeIds: expect.arrayContaining([expect.stringMatching(/^DRAMA-(?:PAT|RISK)-/)]),
        inspectionDepth: "GRAPH_AND_MEDIA_SAMPLED",
        freshness: { basis: "STUDIED_AT", asOf: "2026-08-28", revalidationStatus: "NOT_REVALIDATED" },
        claimTypes: ["OBSERVED_ARTIFACT"],
      }));
      expect(source.claimTypes).not.toContain("OBSERVED_RESULT");
      expect(source.claimTypes).not.toContain("HUMAN_ACCEPTED_RESULT");
      const url = new URL(source.sourceUrl ?? "");
      expect(url.origin).toBe("https://www.liblib.tv");
      expect(url.pathname).toBe("/canvas");
      expect([...url.searchParams.keys()].sort()).toEqual(["projectId", "spaceId"]);
      const relatedCase = caseById.get(source.relatedCaseIds?.[0] ?? "");
      expect(relatedCase).toBeDefined();
      expect(source.sourceUrl).toBe(relatedCase?.sourceUrl);
      expect(source.relatedKnowledgeIds).toEqual(relatedCase?.derivedCardIds);
    }
  });
});
