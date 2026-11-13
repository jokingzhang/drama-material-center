import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("portrait lookup and project import preserve boundaries in isolated fixtures", () => {
  const result = spawnSync("python3", [fileURLToPath(new URL("./test_atlas.py", import.meta.url))], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
