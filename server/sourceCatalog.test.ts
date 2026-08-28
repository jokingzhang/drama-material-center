import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSourceCatalog } from "./sourceCatalog";

const temporaryRoots: string[] = [];

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function temporaryRoot(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("director source catalog", () => {
  it("builds the catalog lazily but refuses a readable document with no declared hash", async () => {
    const workspaceRoot = await temporaryRoot("director-source-workspace-");
    const knowledgeRoot = await temporaryRoot("director-source-knowledge-");
    const snapshotPath = join(workspaceRoot, "archives", "snapshot-lazy");
    const itemPath = join(snapshotPath, "yuewen-dramabuddy", "Lazy__one");
    await mkdir(join(knowledgeRoot, ".ai-director"), { recursive: true });
    await mkdir(itemPath, { recursive: true });
    await writeFile(join(knowledgeRoot, ".ai-director", "source-registry.json"), JSON.stringify({
      schemaVersion: 1,
      snapshots: [{
        snapshotId: "SCRIPT-MARKET-LAZY",
        sourceType: "SCRIPT_SAMPLE",
        workspaceRelativePath: "archives/snapshot-lazy",
        indexFile: "index.json",
        checksumFile: "SHA256SUMS",
        providers: ["yuewen-dramabuddy"],
      }],
      pendingSources: [{
        sourceId: "CANVAS-example",
        sourceType: "COMPLETED_WORK_CANVAS",
        provider: "liblib",
        title: "Example Canvas",
        sourceUrl: "https://www.liblib.tv/canvas?spaceId=space-1&projectId=project-1",
        importStatus: "MEDIA_NOT_IMPORTED",
        researchStatus: "MEDIA_STUDIED",
        inspectionDepth: "GRAPH_AND_MEDIA_SAMPLED",
        freshness: { basis: "STUDIED_AT", asOf: "2026-08-28", revalidationStatus: "NOT_REVALIDATED" },
        claimTypes: ["OBSERVED_ARTIFACT"],
        relatedCaseIds: ["CASE-example"],
        relatedKnowledgeIds: ["DRAMA-PAT-101"],
      }],
    }), "utf8");
    await writeFile(join(snapshotPath, "index.json"), JSON.stringify({
      schemaVersion: 1,
      generatedAt: "2026-08-28T05:04:37.192Z",
      platforms: [{
        site: "yuewen-dramabuddy",
        marketCount: 1,
        archivedCount: 1,
        fullFiveCount: 0,
        zeroEpisodeCount: 1,
        savedEpisodeCount: 0,
        entries: [{ id: "one", title: "Lazy", episodes: 0 }],
      }],
      unavailable: [],
    }), "utf8");
    await writeFile(join(itemPath, "source.json"), JSON.stringify({
      schemaVersion: 1,
      site: "yuewen-dramabuddy",
      id: "one",
      title: "Lazy",
      sourceUrl: "https://example.com/item/one",
      capturedAt: "2026-08-28T04:53:48.596Z",
      accessScope: "logged-in-visible-preview",
      requestedEpisodeLimit: 5,
      capturedEpisodeCount: 0,
      availableFields: ["title"],
    }), "utf8");
    await writeFile(join(itemPath, "剧本资料.md"), "# Lazy", "utf8");
    // The raw document is deliberately declared but absent, while the readable
    // summary is deliberately absent from the manifest. Catalog loading remains
    // lazy, but an explicit read must fail closed in both cases.
    await writeFile(join(snapshotPath, "SHA256SUMS"), [
      `${"0".repeat(64)}  yuewen-dramabuddy/Lazy__one/source.json`,
      `${"2".repeat(64)}  yuewen-dramabuddy/Lazy__one/原始页面文本.txt`,
      "",
    ].join("\n"), "utf8");

    const catalog = await createSourceCatalog({ workspaceRoot, knowledgeRoot });

    const scriptCatalog = catalog.list({ sourceType: "SCRIPT_SAMPLE" });
    expect(scriptCatalog).toEqual(expect.objectContaining({ filteredTotal: 1 }));
    expect(scriptCatalog.sources[0]).toEqual(expect.objectContaining({
      captureCoverage: "METADATA_ONLY",
      researchStatus: "UNSTUDIED",
      inspectionDepth: "METADATA_ONLY",
      freshness: {
        basis: "CAPTURED_AT",
        asOf: "2026-08-28T04:53:48.596Z",
        revalidationStatus: "NOT_REVALIDATED",
      },
      claimTypes: ["OBSERVED_ARTIFACT"],
    }));
    expect(scriptCatalog.sources[0].files).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "summary", integrity: "UNVERIFIED" }),
      expect.objectContaining({ key: "raw", integrity: "DECLARED" }),
    ]));
    await expect(catalog.readDocument("SCRIPT-yuewen-dramabuddy-one", "summary"))
      .rejects.toMatchObject({ code: "SOURCE_DOCUMENT_INTEGRITY_FAILED" });
    await expect(catalog.readDocument("SCRIPT-yuewen-dramabuddy-one", "raw"))
      .rejects.toMatchObject({ code: "SOURCE_DOCUMENT_NOT_FOUND" });
    expect(catalog.list({ sourceType: "COMPLETED_WORK_CANVAS" })).toEqual(expect.objectContaining({
      filteredTotal: 1,
      summary: expect.objectContaining({ total: 1, unavailable: 0 }),
      sources: [expect.objectContaining({
        sourceId: "CANVAS-example",
        provider: "liblib",
        captureCoverage: "NOT_APPLICABLE",
        importStatus: "MEDIA_NOT_IMPORTED",
        researchStatus: "MEDIA_STUDIED",
        inspectionDepth: "GRAPH_AND_MEDIA_SAMPLED",
        freshness: { basis: "STUDIED_AT", asOf: "2026-08-28", revalidationStatus: "NOT_REVALIDATED" },
        claimTypes: ["OBSERVED_ARTIFACT"],
        relatedCaseIds: ["CASE-example"],
        relatedKnowledgeIds: ["DRAMA-PAT-101"],
        rights: {
          accessScope: "not-imported",
          status: "RIGHTS_UNKNOWN",
          gate: "RIGHTS_REVIEW_REQUIRED",
        },
      })],
    }));
  });

  it("normalizes a registered market snapshot without exposing targetDir", async () => {
    const workspaceRoot = await temporaryRoot("director-source-workspace-");
    const knowledgeRoot = await temporaryRoot("director-source-knowledge-");
    const snapshotPath = join(workspaceRoot, "archives", "snapshot-1");
    const itemPath = join(snapshotPath, "reelmate-wondershare", "Example__abc");
    await mkdir(join(knowledgeRoot, ".ai-director"), { recursive: true });
    await mkdir(itemPath, { recursive: true });
    await writeFile(join(knowledgeRoot, ".ai-director", "source-registry.json"), JSON.stringify({
      schemaVersion: 1,
      snapshots: [{
        snapshotId: "SCRIPT-MARKET-20260828-123012",
        sourceType: "SCRIPT_SAMPLE",
        workspaceRelativePath: "archives/snapshot-1",
        indexFile: "index.json",
        checksumFile: "SHA256SUMS",
        providers: ["reelmate-wondershare"],
        expectedCatalog: {
          marketTotal: 1,
          archivedTotal: 1,
          unavailableTotal: 0,
          capturedFiveTotal: 1,
          metadataOnlyTotal: 0,
          providers: [{
            provider: "reelmate-wondershare",
            marketCount: 1,
            archivedCount: 1,
            unavailableCount: 0,
            capturedFiveCount: 1,
            metadataOnlyCount: 0,
          }],
        },
      }],
      sourceStudies: [{
        sourceId: "SCRIPT-reelmate-wondershare-abc",
        researchStatus: "SOURCE_STUDIED",
        relatedCaseIds: ["CASE-20260828-EXAMPLE"],
        relatedKnowledgeIds: ["DRAMA-PAT-001"],
        inspectionDepth: "METADATA_AND_EPISODE_SAMPLE",
        studiedAt: "2026-08-28",
        claimTypes: ["OBSERVED_ARTIFACT", "ILLUSTRATIVE_EXAMPLE"],
      }],
      pendingSources: [],
    }), "utf8");
    await writeFile(join(snapshotPath, "index.json"), JSON.stringify({
      schemaVersion: 1,
      generatedAt: "2026-08-28T05:04:37.192Z",
      platforms: [{
        site: "reelmate-wondershare",
        marketCount: 1,
        archivedCount: 1,
        fullFiveCount: 1,
        zeroEpisodeCount: 0,
        savedEpisodeCount: 5,
        entries: [{
          id: "abc",
          title: "Example",
          url: "https://example.com/item/abc",
          episodes: 5,
          targetDir: "/Users/private/secret/Example__abc",
        }],
      }],
      unavailable: [],
    }), "utf8");
    await writeFile(join(itemPath, "source.json"), JSON.stringify({
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
      "# Example",
      "封面：https://cdn.example.com/cover.png?Expires=9&Signature=secret",
      "本地：/Users/private/secret/source.md",
      "",
      "## 世界观",
      "一座雨城。",
      "### 规则",
      "雨停时钟会倒转。",
      "",
      "## 人物",
      "阿青。",
    ].join("\n");
    const rawContent = "Example";
    const summaryHash = sha256(summaryContent);
    const rawHash = sha256(rawContent);
    await writeFile(join(itemPath, "剧本资料.md"), summaryContent, "utf8");
    await writeFile(join(itemPath, "原始页面文本.txt"), rawContent, "utf8");
    await writeFile(join(snapshotPath, "SHA256SUMS"), [
      `${"0".repeat(64)}  reelmate-wondershare/Example__abc/source.json`,
      `${summaryHash}  reelmate-wondershare/Example__abc/剧本资料.md`,
      `${rawHash}  reelmate-wondershare/Example__abc/原始页面文本.txt`,
      "",
    ].join("\n"), "utf8");

    const catalog = await createSourceCatalog({ workspaceRoot, knowledgeRoot });
    const response = catalog.list();

    expect(response.sources).toEqual([expect.objectContaining({
      sourceId: "SCRIPT-reelmate-wondershare-abc",
      snapshotId: "SCRIPT-MARKET-20260828-123012",
      sourceType: "SCRIPT_SAMPLE",
      provider: "reelmate-wondershare",
      title: "Example",
      captureCoverage: "CAPTURED_5",
      fullWorkCompleteness: "UNKNOWN",
      researchStatus: "SOURCE_STUDIED",
      importStatus: "IMPORTED",
      inspectionDepth: "METADATA_AND_EPISODE_SAMPLE",
      freshness: {
        basis: "STUDIED_AT",
        asOf: "2026-08-28",
        revalidationStatus: "NOT_REVALIDATED",
      },
      claimTypes: ["OBSERVED_ARTIFACT", "ILLUSTRATIVE_EXAMPLE"],
      relatedCaseIds: ["CASE-20260828-EXAMPLE"],
      relatedKnowledgeIds: ["DRAMA-PAT-001"],
      rights: {
        accessScope: "logged-in-visible-preview",
        status: "RIGHTS_UNKNOWN",
        gate: "RIGHTS_REVIEW_REQUIRED",
      },
    })]);
    expect(response.summary).toEqual({
      total: 1,
      archived: 1,
      unavailable: 0,
      capturedFive: 1,
      metadataOnly: 0,
      partialEpisodes: 0,
      verifiedFiles: 0,
      failedFiles: 1,
      declaredFiles: 2,
      unverifiedFiles: 0,
    });
    expect(response.filteredTotal).toBe(1);
    expect(JSON.stringify(response)).not.toContain("/Users/private/secret");
    expect(response.sources[0].files.find((file) => file.key === "metadata")?.integrity).toBe("FAILED");
    expect(response.sources[0].files.find((file) => file.key === "summary")?.integrity).toBe("DECLARED");

    await expect(catalog.readDocument("SCRIPT-reelmate-wondershare-abc", "summary")).resolves.toEqual({
      sourceId: "SCRIPT-reelmate-wondershare-abc",
      documentKey: "summary",
      sha256: summaryHash,
      integrity: "VERIFIED",
      locator: {
        sourceId: "SCRIPT-reelmate-wondershare-abc",
        snapshotId: "SCRIPT-MARKET-20260828-123012",
        relativePath: "reelmate-wondershare/Example__abc/剧本资料.md",
        sha256: summaryHash,
        integrity: "VERIFIED",
        section: { kind: "FULL_DOCUMENT", startLine: 1, endLine: 11 },
        rights: {
          accessScope: "logged-in-visible-preview",
          status: "RIGHTS_UNKNOWN",
          gate: "RIGHTS_REVIEW_REQUIRED",
        },
      },
      content: [
        "# Example",
        "封面：https://cdn.example.com/cover.png",
        "本地：[本机路径已隐藏]",
        "",
        "## 世界观",
        "一座雨城。",
        "### 规则",
        "雨停时钟会倒转。",
        "",
        "## 人物",
        "阿青。",
      ].join("\n"),
    });

    await expect(catalog.readDocument("SCRIPT-reelmate-wondershare-abc", "summary", { section: "世界观" }))
      .resolves.toEqual({
        sourceId: "SCRIPT-reelmate-wondershare-abc",
        documentKey: "summary",
        sha256: summaryHash,
        integrity: "VERIFIED",
        locator: {
          sourceId: "SCRIPT-reelmate-wondershare-abc",
          snapshotId: "SCRIPT-MARKET-20260828-123012",
          relativePath: "reelmate-wondershare/Example__abc/剧本资料.md",
          sha256: summaryHash,
          integrity: "VERIFIED",
          section: {
            kind: "MARKDOWN_HEADING",
            heading: "世界观",
            headingLevel: 2,
            startLine: 5,
            bodyStartLine: 6,
            endLine: 9,
          },
          rights: {
            accessScope: "logged-in-visible-preview",
            status: "RIGHTS_UNKNOWN",
            gate: "RIGHTS_REVIEW_REQUIRED",
          },
        },
        content: [
          "## 世界观",
          "一座雨城。",
          "### 规则",
          "雨停时钟会倒转。",
          "",
        ].join("\n"),
      });
    await expect(catalog.readDocument("SCRIPT-reelmate-wondershare-abc", "raw", { section: "世界观" }))
      .rejects.toMatchObject({ code: "SOURCE_SECTION_INVALID" });
    await expect(catalog.readDocument("SCRIPT-reelmate-wondershare-abc", "summary", { section: "世界" }))
      .rejects.toMatchObject({ code: "SOURCE_SECTION_NOT_FOUND" });
    expect(catalog.list({ provider: "yuewen-dramabuddy" })).toEqual(expect.objectContaining({
      sources: [],
      filteredTotal: 0,
      summary: expect.objectContaining({ total: 1 }),
    }));

    await writeFile(join(itemPath, "剧本资料.md"), `${summaryContent}\n篡改`, "utf8");
    await expect(catalog.readDocument("SCRIPT-reelmate-wondershare-abc", "summary"))
      .rejects.toMatchObject({ code: "SOURCE_DOCUMENT_INTEGRITY_FAILED" });

    await writeFile(join(itemPath, "剧本资料.md"), "x".repeat(2 * 1024 * 1024 + 1), "utf8");
    await expect(catalog.readDocument("SCRIPT-reelmate-wondershare-abc", "summary"))
      .rejects.toMatchObject({ code: "SOURCE_DOCUMENT_NOT_FOUND" });
  });
});
