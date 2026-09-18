import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateShotBlockPrompt } from "../scripts/validate-shot-prompt.mjs";

const scripts = fileURLToPath(new URL("../scripts/", import.meta.url));
const contract = {
  durationSeconds: "12",
  aspectRatio: "9:16",
  referencePlan: {
    requiredScenes: ["走廊"],
    requiredCharacters: ["林默", "苏野"],
    assets: [
      { assetId: "SC-01", subject: "走廊", role: "scene", reference: "{{Mixed 1}}", status: "GEN_INPUT" },
      { assetId: "CHAR-01", subject: "林默", role: "character-identity", reference: "{{Mixed 2}}", status: "GEN_INPUT" },
      { assetId: "CHAR-02", subject: "苏野", role: "character-identity", reference: "{{Mixed 3}}", status: "GEN_INPUT" },
    ],
  },
};
// A structural fixture, not evidence of dialogue performance or media acceptance.
const body = `{{Mixed 1}} 走廊。 {{Mixed 2}} 林默。 {{Mixed 3}} 苏野。
【全局美学设定】
画幅：9:16，写实竖屏
影调：低饱和，窗外阴天散射光
摄影：从走廊西侧观察，固定机位等待表演
地点：走廊，两人分处门的同一侧

正文：分镜执行动作
第一场：等一个回答

镜头1｜00:00.0—00:05.0｜5秒
相机：50mm，平视双人中近景，位于走廊西侧
构图／运镜：林默在左，苏野在右，门框位于后景。固定机位。
画面：林默先看苏野，再把视线移到门上。林默嘴部可见，轻声试探：
“你真的要走？”
苏野没有立刻回答。走廊低沉的通风声持续，林默等待苏野回头。

镜头2｜00:05.0—00:12.0｜7秒
相机：85mm，苏野侧面近景，仍在走廊西侧
构图／运镜：苏野位于右侧，林默的虚焦肩留在左前景。固定。
画面：苏野吸气，回看林默，嘴部可见：
“我会回来。”
苏野说完仍看着林默，等林默略微放松肩膀，才把目光转回门上。通风声延续，按视线切出。
`;

// A continuous take remains one shot even when its prose contains several timed beats.
const singleShotBody = body.slice(0, body.indexOf("\n镜头2｜"))
  .replace("00:05.0｜5秒", "00:12.0｜12秒")
  + "\n00:05.0—00:08.0，苏野回看林默，低声回答。\n00:08.0—00:12.0，林默放松肩膀，苏野转回门上。\n";

test("v2 accepts example-style shots with integrated dialogue", () => {
  assert.deepEqual(validateShotBlockPrompt(body, contract), []);
});

test("v2 accepts one full-duration shot with inline performance beats", () => {
  assert.deepEqual(validateShotBlockPrompt(singleShotBody, contract), []);
});

test("v2 still requires a complete shot header and fields for a continuous take", () => {
  const noHeader = singleShotBody.replace(/^镜头1[^\n]*\n/m, "");
  assert.match(validateShotBlockPrompt(noHeader, contract).join("; "), /at least one complete timed shot block/);
  const noCamera = singleShotBody.replace(/^相机：[^\n]*\n/m, "");
  assert.match(validateShotBlockPrompt(noCamera, contract).join("; "), /ordered 相机/);
  const wrongEnd = singleShotBody.replace("00:12.0｜12秒", "00:11.0｜11秒");
  assert.match(validateShotBlockPrompt(wrongEnd, contract).join("; "), /end at 12s/);
});

test("v2 accepts split composition/movement and repeated planned references", () => {
  const modified = body.replace("构图／运镜：林默在左，苏野在右，门框位于后景。固定机位。",
    "构图：林默在左，苏野在右，门框位于后景。\n运镜：固定机位。")
    .replace("画面：林默先看苏野", "画面：林默 {{Mixed 2}} 先看苏野");
  assert.deepEqual(validateShotBlockPrompt(modified, contract), []);
});

test("v2 allows a prop reference within its action and grouped captions", () => {
  const value = structuredClone(contract);
  value.referencePlan.assets.push(
    { reference: "{{Mixed 4}}", subject: "腕带" },
    { reference: "{{Mixed 5}}", subject: "群像" },
    { reference: "{{Mixed 6}}", subject: "群像" },
  );
  const modified = body.replace("【全局美学设定】", "{{Mixed 5}} {{Mixed 6}} 群像。\n【全局美学设定】")
    .replace("林默等待苏野回头。", "林默等待苏野回头。腕带：{{Mixed 4}} 。");
  assert.deepEqual(validateShotBlockPrompt(modified, value), []);
});

const failures = [
  ["legacy sections", body + "\n〖声音〗无其它声音。", /legacy five-section/],
  ["status metadata", "# READY｜EP01｜测试 v01\n" + body, /metadata belongs outside/],
  ["wrong frame ratio", body.replace("画幅：9:16", "画幅：21:9"), /contracted ratio/],
  ["missing camera", body.replace("相机：50mm，平视双人中近景，位于走廊西侧", ""), /ordered 相机/],
  ["malformed time", body.replace("00:05.0—00:12.0", "00:65.0—00:12.0"), /malformed shot header/],
  ["printed duration", body.replace("｜7秒", "｜3秒"), /printed duration/],
  ["overlap", body.replace("00:05.0—00:12.0｜7秒", "00:04.0—00:12.0｜8秒"), /gap or overlap/],
  ["gap", body.replace("00:05.0—00:12.0｜7秒", "00:06.0—00:12.0｜6秒"), /gap or overlap/],
  ["absolute episode time", body.replace("00:00.0—00:05.0", "01:00.0—01:05.0"), /start at 00:00.0/],
  ["wrong total", body.replace("00:12.0｜7秒", "00:11.0｜6秒"), /end at 12s/],
  ["unplanned reference", body + "\n{{Node i-unknown}} 窗户。", /unplanned reference/],
  ["missing reference", body.replace("{{Mixed 3}} 苏野。", ""), /missing planned reference/],
  ["swapped identities", body.replace("{{Mixed 2}} 林默。 {{Mixed 3}} 苏野。", "{{Mixed 2}} 苏野。 {{Mixed 3}} 林默。"), /associated with subject/],
];
for (const [name, modified, pattern] of failures) {
  test(`v2 rejects ${name}`, () => assert.match(validateShotBlockPrompt(modified, contract).join("; "), pattern));
}

test("author-neutral CLI checks a body without a Doubao job or model", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "shot-block-cli-"));
  try {
    writeFileSync(path.join(directory, "body.md"), body);
    writeFileSync(path.join(directory, "contract.json"), JSON.stringify(contract));
    const result = spawnSync(process.execPath, [path.join(scripts, "validate-shot-prompt.mjs"),
      "--prompt", path.join(directory, "body.md"), "--contract", path.join(directory, "contract.json")], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).ok, true);
    assert.equal(existsSync(path.join(directory, "job.json")), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("author-neutral CLI accepts a complete single-shot body without altering it", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "single-shot-cli-"));
  try {
    writeFileSync(path.join(directory, "body.md"), singleShotBody);
    writeFileSync(path.join(directory, "contract.json"), JSON.stringify(contract));
    const result = spawnSync(process.execPath, [path.join(scripts, "validate-shot-prompt.mjs"),
      "--prompt", path.join(directory, "body.md"), "--contract", path.join(directory, "contract.json")], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.deepEqual(report.errors, []);
    assert.equal(readFileSync(path.join(directory, "body.md"), "utf8"), singleShotBody);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Doubao v2 runner passes the new template to a stub and preserves exact returned bytes", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "shot-block-runner-"));
  try {
    const job = {
      schemaVersion: 1, jobId: "v2-stub", kind: "video-prompts", expectedModel: "doubao-test-stub",
      objective: "模板接线测试", deliverables: ["完整提示词"],
      template: { id: "video-shot-prompt-v2", variables: {
        status: "DRAFT", taskId: "TEST-01", title: "等一个回答", version: "v01",
        durationSeconds: contract.durationSeconds, aspectRatio: contract.aspectRatio,
      } },
      referencePlan: contract.referencePlan, output: { format: "markdown", language: "zh-CN" },
    };
    const fakeClaude = path.join(directory, "claude");
    writeFileSync(fakeClaude, `#!/usr/bin/env node
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  if (!input.includes('**总时长：') || !input.includes('**画面提示词：**') || !input.includes('**音效：**') || input.includes('〖时间轴〗')) process.exit(7);
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: ${JSON.stringify(body)} }));
});
`);
    chmodSync(fakeClaude, 0o755);
    const jobPath = path.join(directory, "job.json");
    writeFileSync(jobPath, JSON.stringify(job));
    const outputDir = path.join(directory, "run");
    const result = spawnSync(process.execPath, [path.join(scripts, "run-doubao-creative.mjs"),
      "--job", jobPath, "--out", outputDir], {
      encoding: "utf8", env: { ...process.env, PATH: [directory, process.env.PATH].join(path.delimiter) },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(outputDir, "creative-output.md"), "utf8"), body);
    assert.equal(JSON.parse(readFileSync(path.join(outputDir, "run.json"), "utf8")).status, "success");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const timedBody = body.slice(0, body.indexOf('镜头1｜')) + `镜头 1｜00:00—00:05｜5 秒
相机：50mm。
构图：双人中景。
运镜：固定。
画面：

**00:00—00:03｜林默嘴部可见：**
“你真的要走？”

**00:03—00:05｜苏野无对白反应：**
苏野看向门边。

镜头 2｜00:05—00:12｜7 秒
相机：85mm。
构图：苏野近景。
运镜：固定。
画面：

**00:05—00:08｜苏野嘴部可见：**
“我会回来。”

**00:08—00:12｜苏野无对白反应：**
苏野等林默放松肩膀，才把目光转回门边。
`;
const timedContract = { ...contract, timedBeats: true };
test('cumulative beats accept complete dialogue and reaction coverage across a cut', () => {
  assert.deepEqual(validateShotBlockPrompt(timedBody, timedContract), []);
});
for (const [name, from, to] of [
  ['second shot resets to zero', '**00:05—00:08', '**00:00—00:03'],
  ['uncovered pause', '**00:03—00:05', '**00:04—00:05'],
  ['overlapping reaction', '**00:03—00:05', '**00:02—00:05'],
  ['reaction past cut', '**00:03—00:05', '**00:03—00:06'],
  ['missing ending hold', '**00:08—00:12', '**00:08—00:11'],
  ['malformed beat time', '**00:08—00:12', '**00:68—00:12'],
]) {
  test(`cumulative beats reject ${name}`, () => {
    assert.ok(validateShotBlockPrompt(timedBody.replace(from, to), timedContract).length > 0);
  });
}

const singleLevelBody = `**总时长：12秒｜9:16｜无背景音乐｜场景：走廊**
{{Mixed 1}} 走廊。 {{Mixed 2}} 林默。 {{Mixed 3}} 苏野。

### 0.0s–5.0s｜镜头1：问一个问题

**画面提示词：** 林默看苏野，轻声问：“你真的要走？”苏野没有立刻回答。

**镜头：** 50mm，走廊西侧双人中近景，固定。

**音效：** 林默现场对白与低沉通风声，问完自然等待。

---

### 5.0s–12.0s｜镜头2：得到回答

**画面提示词：** 苏野回看林默，低声说：“我会回来。”说完仍看着林默。

**镜头：** 85mm，切同侧苏野近景，固定。

**音效：** 苏野现场对白，通风声连续。
`;
const singleLevelContract = { ...contract, format: 'single-level-shots' };
test('single-level shots accept one timing range and three fields per real shot', () => {
  assert.deepEqual(validateShotBlockPrompt(singleLevelBody, singleLevelContract), []);
});
for (const [name, from, to] of [
  ['inner cumulative timeline', '林默看苏野', '00:00—00:03｜林默看苏野'],
  ['inner seconds timeline', '林默看苏野', '0—3秒林默看苏野'],
  ['inner numbered hold', '林默看苏野', '林默停2秒后看苏野'],
  ['second shot time reset', '### 5.0s–12.0s', '### 0.0s–7.0s'],
  ['gap between shots', '### 5.0s–12.0s', '### 6.0s–12.0s'],
  ['missing sound field', '**音效：** 林默', '林默'],
  ['duplicate camera field', '**音效：** 林默', '**镜头：** 固定。\n\n**音效：** 林默'],
  ['wrong total', '**总时长：12秒', '**总时长：11秒'],
]) {
  test(`single-level shots reject ${name}`, () => {
    assert.ok(validateShotBlockPrompt(singleLevelBody.replace(from, to), singleLevelContract).length > 0);
  });
}
