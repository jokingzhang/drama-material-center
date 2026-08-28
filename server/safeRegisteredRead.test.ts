import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveRegisteredFile, sanitizePublicText } from "./safeRegisteredRead";

const temporaryRoots: string[] = [];

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "director-safe-read-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("registered read safety", () => {
  it("resolves a registered relative file without exposing the root through its interface", async () => {
    const root = await temporaryRoot();
    await mkdir(join(root, "registered"));
    await writeFile(join(root, "registered", "entry.json"), "{}", "utf8");

    await expect(resolveRegisteredFile(root, "registered/entry.json", [".json"]))
      .resolves.toBe(await realpath(join(root, "registered", "entry.json")));
  });

  it("rejects traversal even when the escaped file exists", async () => {
    const root = await temporaryRoot();
    const outside = join(root, "..", `secret-${Date.now()}.json`);
    await writeFile(outside, "{}", "utf8");
    try {
      await expect(resolveRegisteredFile(root, `../${outside.split("/").at(-1)}`, [".json"]))
        .rejects.toMatchObject({ code: "invalid_registered_path" });
    } finally {
      await rm(outside, { force: true });
    }
  });

  it("rejects a registered symlink that resolves outside the fixed root", async () => {
    const root = await temporaryRoot();
    const outsideRoot = await temporaryRoot();
    await mkdir(join(root, "registered"));
    await writeFile(join(outsideRoot, "secret.json"), "{}", "utf8");
    await symlink(join(outsideRoot, "secret.json"), join(root, "registered", "escape.json"));

    await expect(resolveRegisteredFile(root, "registered/escape.json", [".json"]))
      .rejects.toMatchObject({ code: "invalid_registered_path" });
  });

  it("removes signed URL queries and absolute local paths while preserving benign deep links", () => {
    const source = [
      "封面：https://cdn.example.com/cover.png?Expires=9&Signature=secret",
      "画布：https://www.liblib.tv/canvas?projectId=project-1&spaceId=space-1",
      "本地：/Users/example/private/source.md",
    ].join("\n");

    expect(sanitizePublicText(source)).toBe([
      "封面：https://cdn.example.com/cover.png",
      "画布：https://www.liblib.tv/canvas?projectId=project-1&spaceId=space-1",
      "本地：[本机路径已隐藏]",
    ].join("\n"));
  });
});
