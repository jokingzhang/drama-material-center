import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createProjectWorkspace } from "./projectWorkspace";

const temporaryRoots: string[] = [];

async function temporaryWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "drama-material-center-"));
  temporaryRoots.push(root);
  return root;
}

async function seedProject(root: string, id: string, manifest: unknown) {
  const projectRoot = join(root, id);
  await mkdir(join(projectRoot, "library"), { recursive: true });
  await writeFile(join(projectRoot, "project.json"), JSON.stringify(manifest), "utf8");
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project workspace", () => {
  it("lists valid project manifests and ignores unrelated folders", async () => {
    const root = await temporaryWorkspace();
    await seedProject(root, "zero-boundary", {
      schemaVersion: 1,
      name: "零界空间",
      description: "第一部短剧",
    });
    await mkdir(join(root, "downloads"));

    const workspace = createProjectWorkspace(root);

    await expect(workspace.listProjects()).resolves.toEqual([
      {
        id: "zero-boundary",
        name: "零界空间",
        description: "第一部短剧",
      },
    ]);
  });

  it("creates a project with the standard material directories", async () => {
    const root = await temporaryWorkspace();
    const workspace = createProjectWorkspace(root);

    await expect(workspace.createProject({
      id: "new-drama",
      name: "我的新短剧",
      description: "筹备中",
    })).resolves.toEqual({
      id: "new-drama",
      name: "我的新短剧",
      description: "筹备中",
    });

    const createdDirectories = await readdir(join(root, "new-drama", "library"), { recursive: true });
    expect(createdDirectories.sort()).toEqual([
      "剧情",
      "图片",
      "视频",
      "图片/人物",
      "图片/场景",
      "视频/成片",
    ].sort());
    await expect(workspace.listProjects()).resolves.toEqual([
      { id: "new-drama", name: "我的新短剧", description: "筹备中" },
    ]);
  });

  it("resolves an existing material through the selected project", async () => {
    const root = await temporaryWorkspace();
    const workspace = createProjectWorkspace(root);
    await workspace.createProject({ id: "safe-drama", name: "安全测试" });
    const materialPath = join(root, "safe-drama", "library", "剧情", "EP01.md");
    await writeFile(materialPath, "# 第一集\n", "utf8");

    await expect(workspace.resolveMaterialPath("safe-drama", "剧情/EP01.md")).resolves.toBe(await realpath(materialPath));
  });

  it("does not expose folders that are not registered projects", async () => {
    const root = await temporaryWorkspace();
    const materialPath = join(root, "downloads", "library", "剧情", "private.md");
    await mkdir(join(root, "downloads", "library", "剧情"), { recursive: true });
    await writeFile(materialPath, "private", "utf8");
    const workspace = createProjectWorkspace(root);

    await expect(workspace.resolveMaterialPath("downloads", "剧情/private.md")).rejects.toMatchObject({
      code: "project_not_found",
    });
  });

  it("rejects traversal paths and symlinks that escape a project library", async () => {
    const root = await temporaryWorkspace();
    const workspace = createProjectWorkspace(root);
    await workspace.createProject({ id: "safe-drama", name: "安全测试" });
    const outsidePath = join(root, "outside.md");
    await writeFile(outsidePath, "private", "utf8");
    await symlink(outsidePath, join(root, "safe-drama", "library", "剧情", "external.md"));

    await expect(workspace.resolveMaterialPath("safe-drama", "../../outside.md")).rejects.toMatchObject({
      code: "invalid_path",
    });
    await expect(workspace.resolveMaterialPath("safe-drama", "剧情/external.md")).rejects.toMatchObject({
      code: "invalid_path",
    });
  });
});
