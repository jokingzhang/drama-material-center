import { afterEach, describe, expect, it } from "vitest";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const repositoryRoot = process.cwd();
const knowledgeRoot = join(repositoryRoot, "director-knowledge-base");
const validator = join(repositoryRoot, ".agents", "skills", "ai-director", "scripts", "director_kb.mjs");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function validate(root: string) {
  return spawnSync(process.execPath, [validator, "validate", "--root", root, "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

describe("legacy AI Director research archive validator", () => {
  it("keeps the archived structured research readable without fixing its live counts", async () => {
    const index = JSON.parse(await readFile(join(knowledgeRoot, ".ai-director", "index.json"), "utf8")) as {
      schemaVersion: number;
      standards: Array<Record<string, unknown>>;
      cards: Array<Record<string, unknown>>;
      cases: Array<Record<string, unknown>>;
    };

    expect(index.schemaVersion).toBe(2);
    expect([...index.standards, ...index.cards, ...index.cases].every((entry) => Array.isArray(entry.knowledgeAreas))).toBe(true);
    expect([...index.standards, ...index.cards].every((entry) => Boolean(entry.usageContract))).toBe(true);
    const result = validate(knowledgeRoot);
    expect(result.status, result.stdout || result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({
      ok: true,
      standards: index.standards.length,
      cards: index.cards.length,
      cases: index.cases.length,
    }));
  });

  it("fails closed when a v2 usage contract loses a required field", async () => {
    const root = await mkdtemp(join(tmpdir(), "director-validator-"));
    temporaryRoots.push(root);
    await cp(knowledgeRoot, root, { recursive: true });
    const indexPath = join(root, ".ai-director", "index.json");
    const index = JSON.parse(await readFile(indexPath, "utf8")) as {
      standards: Array<{ usageContract: Record<string, unknown> }>;
    };
    delete index.standards[0].usageContract.stopConditions;
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

    const result = validate(root);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("usageContract.stopConditions")]),
    }));
  });
});
