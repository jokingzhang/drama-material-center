import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const writers = [
  ["apply-reviewed-distillations.mjs", /旧批量摘要写入器已停用/],
  ["write-detailed-method-notes.mjs", /DISABLED_UNVERIFIED_DISTILLATION_WRITER/],
];

for (const [filename, reason] of writers) {
  test(`${filename} refuses execution without overwriting notes or promoting status`, (t) => {
    const fixture = mkdtempSync(path.join(tmpdir(), "distillation-writer-"));
    t.after(() => rmSync(fixture, { recursive: true, force: true }));
    const outputDir = "weekly-radar/.local/douyin-method-distillation/li-yifan/7660904900789128057/v01";
    const queuePath = path.join(fixture, "weekly-radar/douyin-method-distillation/queue.json");
    const notePath = path.join(fixture, outputDir, "method-notes.md");
    mkdirSync(path.dirname(queuePath), { recursive: true });
    mkdirSync(path.dirname(notePath), { recursive: true });
    const queue = JSON.stringify({ videos: [{ videoId: "7660904900789128057", outputDir, status: { stage: "transcribed", note: "source review pending" } }] });
    const note = "# Existing version\n\nKeep this historical note unchanged.\n";
    writeFileSync(queuePath, queue);
    writeFileSync(notePath, note);
    const before = readdirSync(fixture, { recursive: true }).sort();

    const result = spawnSync(process.execPath, [fileURLToPath(new URL(filename, import.meta.url))], {
      cwd: fixture,
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, reason);
    assert.equal(readFileSync(queuePath, "utf8"), queue);
    assert.equal(readFileSync(notePath, "utf8"), note);
    assert.deepEqual(readdirSync(fixture, { recursive: true }).sort(), before);
  });
}
