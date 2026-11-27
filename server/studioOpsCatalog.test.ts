import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStudioOpsCatalog, StudioOpsError } from "./studioOpsCatalog.ts";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "studio-ops-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("studioOpsCatalog", () => {
  it("reports unavailable when ops-workspace does not exist or only contains ignored files", async () => {
    const dir = await makeTempDir();
    const missing = createStudioOpsCatalog(join(dir, "missing"));
    expect(await missing.getStatus()).toEqual({ available: false });
    expect((await missing.getOverview()).available).toBe(false);

    const emptyRoot = join(dir, "empty");
    await mkdir(emptyRoot);
    await writeFile(join(emptyRoot, ".gitkeep"), "", "utf8");
    await writeFile(join(emptyRoot, ".DS_Store"), "", "utf8");

    const emptyCatalog = createStudioOpsCatalog(emptyRoot);
    expect(await emptyCatalog.getStatus()).toEqual({ available: false });
    expect((await emptyCatalog.getOverview()).available).toBe(false);
  });

  it("loads arbitrary dynamic projects, accounts, metrics, todos, and markdown docs", async () => {
    const root = await makeTempDir();
    await mkdir(join(root, "projects"), { recursive: true });
    await mkdir(join(root, "accounts"), { recursive: true });

    await writeFile(
      join(root, "state.json"),
      JSON.stringify({
        schemaVersion: 1,
        studioName: "测试工作台",
        focusSummary: "先跑通单平台再扩矩阵",
        updatedAt: "2026-11-27T10:00:00Z",
        metrics: [{ id: "credits", label: "本月剩余额度", value: "10,000", dueDate: "2026-12-19", tone: "warning" }],
        projects: [
          { id: "p1", name: "剧一", stage: "审核中", summary: "等意见", platforms: ["红果"] },
          { id: "p2", name: "剧二", stage: "筹备中", summary: "定大纲" },
          { id: "p3", name: "剧三", stage: "概念", summary: "储备题材" },
        ],
        accounts: [
          { id: "a1", name: "主号", role: "教程IP", status: "清理中", platforms: ["抖音", "小红书"], positioning: "一人剧组" },
        ],
      }),
      "utf8",
    );
    await writeFile(
      join(root, "todos.json"),
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: "2026-11-27T10:00:00Z",
        items: [
          {
            id: "t1",
            title: "隐藏旧帖",
            category: "账号运营",
            color: "amber",
            bucket: "now",
            status: "todo",
            timeSlot: "fragment",
            workspaceProjectId: "example-drama",
          },
          { id: "t2", title: "等红果审核", category: "平台审核", color: "rose", bucket: "waiting", status: "in_progress" },
        ],
      }),
      "utf8",
    );
    await writeFile(join(root, "roadmap.md"), "# 中长期规划\n\n内容", "utf8");
    await writeFile(join(root, "projects", "p1.md"), "# 剧一档案\n\n详情", "utf8");
    await writeFile(join(root, "accounts", "benchmarks.md"), "# 对标拆解\n\n笔记", "utf8");

    const catalog = createStudioOpsCatalog(root);
    expect(await catalog.getStatus()).toEqual({ available: true });

    const overview = await catalog.getOverview();
    expect(overview.available).toBe(true);
    expect(overview.state.projects).toHaveLength(3);
    expect(overview.state.accounts).toHaveLength(1);
    expect(overview.todos.items).toHaveLength(2);
    expect(overview.todos.items[0]).toMatchObject({
      category: "账号运营",
      color: "amber",
      workspaceProjectId: "example-drama",
    });
    expect(overview.documents.map((doc) => doc.path)).toEqual(["accounts/benchmarks.md", "projects/p1.md", "roadmap.md"]);

    const doc = await catalog.readDocument("projects/p1.md");
    expect(doc.title).toBe("剧一档案");
    expect(doc.category).toBe("项目档案");
    expect(doc.content).toContain("详情");
  });

  it("updates todo status atomically in todos.json", async () => {
    const root = await makeTempDir();
    await writeFile(
      join(root, "todos.json"),
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: "2026-11-27T10:00:00Z",
        items: [{ id: "t1", title: "做对标调研", bucket: "decide", status: "todo" }],
      }),
      "utf8",
    );

    const catalog = createStudioOpsCatalog(root);
    const done = await catalog.updateTodoStatus("t1", "done");
    expect(done.status).toBe("done");
    expect(done.completedAt).toBeTruthy();

    const reopened = await catalog.updateTodoStatus("t1", "todo");
    expect(reopened.status).toBe("todo");
    expect(reopened.completedAt).toBeUndefined();
  });

  it("rejects path traversal, non-markdown reads, and symlinks", async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    await writeFile(join(outside, "secret.md"), "# secret", "utf8");
    await writeFile(join(root, "state.json"), JSON.stringify({ schemaVersion: 1, studioName: "x", focusSummary: "", updatedAt: "", metrics: [], projects: [], accounts: [] }), "utf8");
    await symlink(join(outside, "secret.md"), join(root, "escape.md"));

    const catalog = createStudioOpsCatalog(root);
    await expect(catalog.readDocument("../secret.md")).rejects.toBeInstanceOf(StudioOpsError);
    await expect(catalog.readDocument("state.json")).rejects.toBeInstanceOf(StudioOpsError);
    await expect(catalog.readDocument("escape.md")).rejects.toBeInstanceOf(StudioOpsError);
  });
});
