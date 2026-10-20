import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPromptReferenceResolver } from "./promptReferences";

type Json = Record<string, unknown>;
const roots: string[] = [];
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function seed() {
  const root = await mkdtemp(join(tmpdir(), "prompt-references-"));
  roots.push(root);
  const projectRoot = join(root, "sample");
  const promptPath = "剧情/分集/EP01/分镜/EP01-S01-U101-PROMPT-v01.md";
  const planPath = "剧情/分集/EP01/分镜/EP01-REFERENCE-PLAN-v01.json";
  const imagePath = "图片/人物/CHAR-001/STANDARD-v01.png";
  const voicePath = "音频/人物/CHAR-001/VOICE-v01.wav";
  const body = "人物 {{Mixed 1}}；声音 {{Mixed 2}}。";
  const assets: Json[] = [
    { assetId: "PROMPT", materialType: "prompt.video", path: promptPath, sha256: sha256(body), subject: { episodeId: "EP01" }, status: "DRAFT" },
    { assetId: "PLAN", materialType: "plan.shot", role: "reference-plan", path: planPath, subject: { episodeId: "EP01" }, status: "DRAFT" },
    { assetId: "IMAGE", materialType: "image.character", path: imagePath, sha256: sha256("image-v1"), version: "v01", status: "DRAFT" },
    { assetId: "VOICE", materialType: "audio.voice", path: voicePath, sha256: sha256("voice-v1"), version: "v01", status: "ACCEPTED" },
  ];
  const references: Json[] = [
    { reference: "{{Mixed 2}}", assetId: "VOICE", path: `library/${voicePath}`, sha256: sha256("voice-v1"), subject: "演员音色", durationSeconds: 4.23 },
    { reference: "{{Mixed 1}}", assetId: "IMAGE", path: `library/${imagePath}`, sha256: sha256("image-v1"), subject: "演员造型", responsibility: "保持同一套服装。" },
  ];
  const unit: Json = { unitId: "EP01-S01-U101", bodyPath: `library/${promptPath}`, bodySha256: sha256(body), referencePlan: { assets: references } };
  const plan: Json = { units: [unit] };
  async function put(path: string, contents: string) {
    const file = join(projectRoot, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, contents);
  }
  async function save() {
    const source = JSON.stringify(plan);
    assets[1].sha256 = sha256(source);
    await put(`library/${planPath}`, source);
    await put("production/asset-bindings.v1.json", JSON.stringify({ schemaVersion: 1, assets }));
  }
  await put("project.json", JSON.stringify({ schemaVersion: 1, name: "测试项目" }));
  await put("production/story-index.v1.json", JSON.stringify({ schemaVersion: 1, documentBindings: [] }));
  await put(`library/${promptPath}`, body);
  await put(`library/${imagePath}`, "image-v1");
  await put(`library/${voicePath}`, "voice-v1");
  await save();
  const resolver = createPromptReferenceResolver(root);
  return { root, projectRoot, assets, references, unit, plan, promptPath, planPath, imagePath, voicePath, body, put, save, read: (path = promptPath) => resolver.readPromptReferences("sample", path) };
}

afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("exact prompt reference reads", () => {
  it("resolves in Mixed order without changing draft/accepted states or production files", async () => {
    const fixture = await seed();
    const before = await readFile(join(fixture.projectRoot, "production/asset-bindings.v1.json"), "utf8");
    const result = await fixture.read();
    expect(result).toMatchObject({ state: "RESOLVED", unitId: "EP01-S01-U101", sourcePlanPath: fixture.planPath, promptSha256: sha256(fixture.body) });
    expect(result.references).toEqual([
      expect.objectContaining({ reference: "{{Mixed 1}}", assetId: "IMAGE", label: "演员造型", kind: "image", version: "v01", assetStatus: "DRAFT", resolution: "RESOLVED", responsibility: "保持同一套服装。", url: `/api/projects/sample/file?path=${encodeURIComponent(fixture.imagePath)}` }),
      expect.objectContaining({ reference: "{{Mixed 2}}", assetId: "VOICE", label: "演员音色", kind: "audio", assetStatus: "ACCEPTED", durationSeconds: 4.23, resolution: "RESOLVED" }),
    ]);
    expect(await readFile(join(fixture.projectRoot, "production/asset-bindings.v1.json"), "utf8")).toBe(before);
  });

  it("keeps identical Mixed numbers local to the exact prompt, and ignores unbound newer files", async () => {
    const f = await seed();
    const otherPath = "剧情/分集/EP01/分镜/EP01-S01-U102-PROMPT-v01.md";
    const otherBody = "另一镜头 {{Mixed 1}}。";
    f.assets.push({ assetId: "PROMPT2", materialType: "prompt.video", path: otherPath, sha256: sha256(otherBody), subject: { episodeId: "EP01" } });
    (f.plan.units as Json[]).push({ unitId: "EP01-S01-U102", bodyPath: otherPath, bodySha256: sha256(otherBody), referencePlan: { assets: [{ ...f.references[0], reference: "{{Mixed 1}}" }] } });
    await f.put(`library/${otherPath}`, otherBody);
    await f.put("library/剧情/分集/EP01/分镜/EP01-REFERENCE-PLAN-v999.json", JSON.stringify({ units: [{ ...f.unit, referencePlan: { assets: [] } }] }));
    await f.save();
    expect((await f.read()).references[0].assetId).toBe("IMAGE");
    expect((await f.read(otherPath)).references[0].assetId).toBe("VOICE");
  });

  it.each(["promptPath", "prompt", "path"])("reads the evidenced %s identity alias", async (alias) => {
    const f = await seed();
    delete f.unit.bodyPath;
    delete f.unit.bodySha256;
    if (alias === "prompt") f.unit.prompt = { path: f.promptPath, sha256: sha256(f.body) };
    else {
      f.unit[alias] = f.promptPath;
      f.unit[alias === "path" ? "sha256" : "promptSha256"] = sha256(f.body);
    }
    await f.save();
    expect((await f.read()).state).toBe("RESOLVED");
  });

  it("reads legacy references/token and explicit logicalToken without deriving node numbering", async () => {
    const f = await seed();
    delete f.unit.referencePlan;
    f.unit.references = f.references.map(({ reference, ...entry }) => ({ ...entry, token: `{{Node node-${entry.assetId}}}`, logicalToken: reference }));
    await f.save();
    expect((await f.read()).references.map((reference) => reference.reference)).toEqual(["{{Mixed 1}}", "{{Mixed 2}}"]);
  });

  it("does not map historical files, mismatched unit hashes, or edited prompt bodies to current references", async () => {
    const f = await seed();
    const oldPath = f.promptPath.replace("v01", "v00");
    f.assets.push({ assetId: "OLD-PROMPT", materialType: "prompt.video", path: oldPath, sha256: sha256(f.body), status: "SUPERSEDED" });
    await f.put(`library/${oldPath}`, f.body);
    await f.save();
    expect(await f.read(oldPath)).toMatchObject({ state: "UNAVAILABLE", references: [] });
    f.unit.bodySha256 = sha256("different version");
    await f.save();
    expect(await f.read()).toMatchObject({ state: "UNAVAILABLE", references: [], reason: expect.stringContaining("哈希") });
    await f.put(`library/${f.promptPath}`, `${f.body}改动`);
    expect(await f.read()).toMatchObject({ state: "CONFLICT", references: [] });
  });

  it("exposes exact formal historical references without falling back to the newer current file", async () => {
    const f = await seed();
    f.assets[2] = { ...f.assets[2], path: f.imagePath.replace("v01", "v02"), sha256: sha256("image-v2"), version: "v02", status: "ACCEPTED", versionHistory: [{ path: f.imagePath, sha256: sha256("image-v1"), version: "v01", status: "SUPERSEDED" }] };
    await f.save();
    expect((await f.read()).references[0]).toMatchObject({ resolution: "RESOLVED", version: "v01", assetStatus: "SUPERSEDED", url: `/api/projects/sample/file?path=${encodeURIComponent(f.imagePath)}` });
    await rm(join(f.projectRoot, "library", f.imagePath));
    const missing = (await f.read()).references[0];
    expect(missing.resolution).toBe("MISSING_FILE");
    expect(missing.url).toBeUndefined();
  });

  it("degrades missing, unregistered and stale versions separately and never supplies playable URLs", async () => {
    const f = await seed();
    f.references[1].path = `library/${f.imagePath.replace("v01", "v00")}`;
    await rm(join(f.projectRoot, "library", f.voicePath));
    await f.save();
    const unavailable = (await f.read()).references;
    expect(unavailable).toEqual([
      expect.objectContaining({ resolution: "VERSION_MISMATCH" }),
      expect.objectContaining({ resolution: "MISSING_FILE" }),
    ]);
    expect(unavailable.every((reference) => !reference.url)).toBe(true);
    f.references[1].assetId = "UNKNOWN";
    await f.save();
    const unregistered = (await f.read()).references[0];
    expect(unregistered.resolution).toBe("UNREGISTERED");
    expect(unregistered.url).toBeUndefined();
  });

  it("invalidates verified media digests on a same-size edit with restored mtime", async () => {
    const f = await seed();
    expect((await f.read()).references[0].resolution).toBe("RESOLVED");
    const file = join(f.projectRoot, "library", f.imagePath);
    const before = await stat(file);
    await writeFile(file, "image-v2");
    await utimes(file, before.atime, before.mtime);
    const changed = (await f.read()).references[0];
    expect(changed.resolution).toBe("VERSION_MISMATCH");
    expect(changed.url).toBeUndefined();
  });

  it("reports duplicate token or multiple matching unit mappings instead of choosing one", async () => {
    const f = await seed();
    f.references.push({ ...f.references[1] });
    await f.save();
    expect(await f.read()).toMatchObject({ state: "CONFLICT", references: [] });
    f.references.pop();
    (f.plan.units as Json[]).push({ ...f.unit, unitId: "OTHER" });
    await f.save();
    expect(await f.read()).toMatchObject({ state: "CONFLICT", references: [] });
  });

  it("shows unmapped placeholders, and preserves a verifiable rejected asset's status", async () => {
    const f = await seed();
    f.references.pop();
    f.assets[3].status = "REJECTED_AUDIO";
    await f.save();
    expect((await f.read()).references).toEqual([
      expect.objectContaining({ reference: "{{Mixed 1}}", resolution: "UNREGISTERED" }),
      expect.objectContaining({ reference: "{{Mixed 2}}", resolution: "RESOLVED", assetStatus: "REJECTED_AUDIO" }),
    ]);
  });

  it("does not treat plain Markdown, unsupported plan structures or a changed plan as mapped", async () => {
    const f = await seed();
    await f.put("library/说明.md", f.body);
    expect(await f.read("说明.md")).toMatchObject({ state: "UNAVAILABLE", references: [] });
    delete f.unit.referencePlan;
    f.unit.referenceKeys = ["CHAR"];
    await f.save();
    expect(await f.read()).toMatchObject({ state: "UNAVAILABLE", references: [] });
    await f.put(`library/${f.planPath}`, JSON.stringify({ units: [{ ...f.unit, references: [] }] }));
    expect(await f.read()).toMatchObject({ state: "UNAVAILABLE", references: [] });
  });

  it("rejects request traversal and symlink paths, including a same-project media symlink", async () => {
    const f = await seed();
    for (const path of ["../sample/library/说明.md", "/etc/passwd", "图片//a.png", "library/../project.json", ".secret.md"]) {
      await expect(f.read(path)).rejects.toMatchObject({ code: "invalid_path" });
    }
    const imageFile = join(f.projectRoot, "library", f.imagePath);
    const targetFile = `${imageFile}.original`;
    await writeFile(targetFile, "image-v1");
    await rm(imageFile);
    await symlink(targetFile, imageFile);
    const linked = (await f.read()).references[0];
    expect(linked.resolution).toBe("CONFLICT");
    expect(linked.url).toBeUndefined();
    f.references[1].path = "library/../another-project/library/image.png";
    await f.save();
    const outside = (await f.read()).references[0];
    expect(outside.resolution).toBe("CONFLICT");
    expect(outside.url).toBeUndefined();
  });
});
