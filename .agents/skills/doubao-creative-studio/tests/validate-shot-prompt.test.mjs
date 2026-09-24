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
  if (!input.includes('**总时长：') || !input.includes('**人物资产：**') || !input.includes('[整体场景与氛围]') || !input.includes('**光影表现：**') || !input.includes('**音效：**') || input.includes('〖时间轴〗')) process.exit(7);
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: ${JSON.stringify(lightingBody)} }));
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
    assert.equal(readFileSync(path.join(outputDir, "creative-output.md"), "utf8"), lightingBody);
    assert.equal(JSON.parse(readFileSync(path.join(outputDir, "run.json"), "utf8")).status, "success");
    writeFileSync(fakeClaude, `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on('end', () => process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: ${JSON.stringify(singleLevelBody)} })));
`);
    const historicalOutputDir = path.join(directory, 'historical-return');
    const historicalResult = spawnSync(process.execPath, [path.join(scripts, 'run-doubao-creative.mjs'),
      '--job', jobPath, '--out', historicalOutputDir], {
      encoding: 'utf8', env: { ...process.env, PATH: [directory, process.env.PATH].join(path.delimiter) },
    });
    assert.equal(historicalResult.status, 4, historicalResult.stderr);
    assert.equal(readFileSync(path.join(historicalOutputDir, 'creative-output.invalid-template.md'), 'utf8'), singleLevelBody);
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

const lightingBody = `**总时长：12秒｜画幅：9:16｜无背景音乐｜场景：走廊**

**人物资产：**
林默 {{Mixed 2}} 的身份与当前造型；苏野 {{Mixed 3}} 的身份与当前造型。

**环境资产：**
走廊 {{Mixed 1}} 的布局与门窗关系。

[整体场景与氛围]
阴天走廊，窗外冷调散射光为主要光源，肤色自然，暗部保留层次。环境通风声跨镜连续。

【多分镜时间轴】

### 0.0s–5.0s｜镜头1：问一个问题

**景别与镜头运动：** 50mm，走廊西侧双人中近景，固定。

**画面与动作：** 林默看苏野，林默：“你真的要走？”苏野没有立刻回答。

**光影表现：** 窗侧柔光落在林默脸颊，门框暗部保留纹理，两人受光方向一致。

**音效：** 林默现场对白与低沉通风声，问完自然等待。

---

### 5.0s–12.0s｜镜头2：得到回答

**景别与镜头运动：** 85mm，切同侧苏野近景，固定。

**画面与动作：** 苏野回看林默，苏野：“我会回来。”说完仍看着林默。

**光影表现：** 延续窗侧柔光与冷调阴影，苏野眼部保持可见，肤色与前镜一致。

**音效：** 苏野现场对白，通风声连续。
`;
const lightingContract = { ...contract, format: 'single-level-shots-lighting' };

test('lighting shots accept referenced asset categories without a prop category', () => {
  assert.deepEqual(validateShotBlockPrompt(lightingBody, lightingContract), []);
  assert.deepEqual(validateShotBlockPrompt(lightingBody, contract), []);
});

test('lighting shots allow audio assets and keep historical absence declarations readable', () => {
  const value = structuredClone(lightingContract);
  value.referencePlan.assets.push({ reference: '{{Mixed 4}}', subject: '通风声' });
  const modified = lightingBody.replace('[整体场景与氛围]', '**声音资产：**\n通风声 {{Mixed 4}} 仅用于连续环境底声。\n\n[整体场景与氛围]');
  assert.deepEqual(validateShotBlockPrompt(modified, value), []);
  const withoutRefs = lightingBody.replace(/\{\{Mixed \d+\}\}/g, '').replace('林默  的身份与当前造型；苏野  的身份与当前造型。', '无外部人物参考。')
    .replace('走廊  的布局与门窗关系。', '无外部环境参考。');
  assert.deepEqual(validateShotBlockPrompt(withoutRefs, { ...lightingContract, referencePlan: { assets: [] } }), []);
});

test('lighting shots allow pure text-to-video without any asset headings', () => {
  const withoutAssets = lightingBody.replace(/\*\*(?:人物|环境)资产：\*\*\n[^\n]*\n\n/g, '');
  assert.deepEqual(validateShotBlockPrompt(withoutAssets, { ...lightingContract, referencePlan: { assets: [] } }), []);
  assert.match(validateShotBlockPrompt(withoutAssets, lightingContract).join('; '), /missing planned reference/);
});

test('lighting shots allow a scene reference as the sole asset category', () => {
  const sceneOnly = lightingBody.replace(/\*\*人物资产：\*\*\n[^\n]*\n\n/, '');
  const sceneContract = { ...lightingContract, referencePlan: { assets: [contract.referencePlan.assets[0]] } };
  assert.deepEqual(validateShotBlockPrompt(sceneOnly, sceneContract), []);
});

for (const details of [
  '构图与主体：林默在左，苏野在右，门框留在后景。\n道具布局：门把手位于苏野身后。\n动作与表演：林默看苏野，林默：“你真的要走？”苏野没有立刻回答。',
  '构图与主体：林默在左，苏野在右。\n动作与表演：林默看苏野，林默：“你真的要走？”苏野没有立刻回答。',
  '动作与表演：林默看苏野，林默：“你真的要走？”苏野没有立刻回答。',
]) {
  test(`lighting shots accept optional prose labels: ${details.split('\n').map(line => line.split('：')[0]).join(', ')}`, () => {
    const modified = lightingBody.replace('**画面与动作：** 林默看苏野，林默：“你真的要走？”苏野没有立刻回答。', `**画面与动作：**\n${details}`);
    assert.deepEqual(validateShotBlockPrompt(modified, lightingContract), []);
  });
}

test('lighting shots accept one full-duration shot and nonempty multiline fields', () => {
  const modified = lightingBody.slice(0, lightingBody.indexOf('\n---\n'))
    .replace('### 0.0s–5.0s', '### 0.0s–12.0s')
    .replace('**光影表现：** 窗侧', '**光影表现：**\n窗侧');
  assert.deepEqual(validateShotBlockPrompt(modified, lightingContract), []);
});

for (const [name, from, to, pattern] of [
  ['duplicate asset category', '**人物资产：**', '**人物资产：**\n无。\n**人物资产：**', /exactly one/],
  ['empty prop category', '[整体场景与氛围]', '**物品资产：**\n\n[整体场景与氛围]', /物品资产.*nonempty/],
  ['missing atmosphere', '[整体场景与氛围]', '', /整体场景与氛围/],
  ['empty atmosphere', '阴天走廊，窗外冷调散射光为主要光源，肤色自然，暗部保留层次。环境通风声跨镜连续。', '', /整体场景与氛围.*nonempty/],
  ['missing timeline heading', '【多分镜时间轴】', '', /多分镜时间轴/],
  ['duplicate timeline heading', '【多分镜时间轴】', '【多分镜时间轴】\n【多分镜时间轴】', /exactly one.*多分镜时间轴/],
  ['missing lighting field', '**光影表现：** 窗侧柔光落在林默脸颊，门框暗部保留纹理，两人受光方向一致。', '', /requires exactly/],
  ['empty lighting field', '**光影表现：** 窗侧柔光落在林默脸颊，门框暗部保留纹理，两人受光方向一致。', '**光影表现：**', /nonempty 光影表现/],
  ['empty final field before separator', '**音效：** 林默现场对白与低沉通风声，问完自然等待。', '**音效：**', /nonempty 音效/],
  ['duplicate lighting field', '**光影表现：** 窗侧', '**光影表现：** 柔光。\n\n**光影表现：** 窗侧', /requires exactly/],
  ['old camera field mixed in', '**景别与镜头运动：** 50mm', '**镜头：** 固定。\n\n**景别与镜头运动：** 50mm', /requires exactly/],
  ['old picture field replacing new', '**画面与动作：** 林默', '**画面提示词：** 林默', /requires exactly/],
  ['empty optional picture detail', '**画面与动作：** 林默', '**画面与动作：**\n道具布局：\n动作与表演：林默', /nonempty 道具布局/],
  ['optional picture detail as extra heading', '**画面与动作：** 林默', '**画面与动作：**\n#### 动作与表演：\n林默', /forbidden inner timing or subshots/],
  ['unresolved template instructions', '窗侧柔光落在林默脸颊', '<本镜主光与肤色>', /unresolved template/],
  ['unexpanded template variable', '窗侧柔光落在林默脸颊', '{{lightingDescription}}', /unresolved template/],
  ['inner timing', '林默看苏野', '林默停2秒后看苏野', /forbidden inner timing/],
  ['timeline gap', '### 5.0s–12.0s', '### 6.0s–12.0s', /cumulative interval/],
  ['missing reference', '{{Mixed 3}}', '', /missing planned reference/],
]) {
  test(`lighting shots reject ${name}`, () => {
    assert.match(validateShotBlockPrompt(lightingBody.replace(from, to), lightingContract).join('; '), pattern);
  });
}

test('lighting prelude categories must appear in the documented order', () => {
  const modified = lightingBody.replace('**人物资产：**', '**SWAP：**')
    .replace('**环境资产：**', '**人物资产：**').replace('**SWAP：**', '**环境资产：**');
  assert.match(validateShotBlockPrompt(modified, lightingContract).join('; '), /asset\/atmosphere\/timeline order/);
});

for (const category of ['声音资产', '视频资产']) {
  for (const [name, inserted, pattern] of [
    ['empty', `**${category}：**\n\n`, /nonempty/],
    ['duplicate', `**${category}：**\n历史参考说明。\n**${category}：**\n历史参考说明。\n`, /exactly one/],
  ]) {
    test(`lighting shots reject ${name} optional ${category}`, () => {
      const modified = lightingBody.replace('[整体场景与氛围]', `${inserted}[整体场景与氛围]`);
      assert.match(validateShotBlockPrompt(modified, lightingContract).join('; '), pattern);
    });
  }
}

test('optional reference categories must remain before atmosphere and in category order', () => {
  for (const inserted of [
    '**视频资产：**\n视频参考。\n**声音资产：**\n声音参考。\n[整体场景与氛围]',
    '[整体场景与氛围]\n**声音资产：**\n声音参考。',
  ]) {
    const modified = lightingBody.replace('[整体场景与氛围]', inserted);
    assert.match(validateShotBlockPrompt(modified, lightingContract).join('; '), /asset\/atmosphere\/timeline order/);
  }
});

test('new format cannot fall back to a historical three-field body', () => {
  assert.ok(validateShotBlockPrompt(singleLevelBody, lightingContract).length > 0);
  const inferredNew = singleLevelBody.replace('{{Mixed 1}}', '**人物资产：**\n{{Mixed 1}}');
  assert.ok(validateShotBlockPrompt(inferredNew, contract).length > 0);
  assert.ok(validateShotBlockPrompt(lightingBody, singleLevelContract).length > 0);
  assert.deepEqual(validateShotBlockPrompt(singleLevelBody, singleLevelContract), []);
  assert.deepEqual(validateShotBlockPrompt(singleLevelBody, contract), []);
});

test('an empty historical field cannot consume the next field heading as content', () => {
  const modified = singleLevelBody.replace('**画面提示词：** 林默看苏野，轻声问：“你真的要走？”苏野没有立刻回答。', '**画面提示词：**');
  assert.match(validateShotBlockPrompt(modified, singleLevelContract).join('; '), /nonempty 画面提示词/);
});

test('lighting placeholder checks retain valid Subject references', () => {
  const modified = lightingBody.replaceAll('{{Mixed 2}}', '<Subject 2>');
  const value = structuredClone(lightingContract);
  value.referencePlan.assets[1].reference = '<Subject 2>';
  assert.deepEqual(validateShotBlockPrompt(modified, value), []);
});

test('Doubao validate-output keeps historical v2 bodies readable without new authoring', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'historical-v2-validation-'));
  try {
    const job = {
      schemaVersion: 1, jobId: 'historical-v2', kind: 'video-prompts', expectedModel: 'doubao-test-stub',
      objective: '历史只读验证', deliverables: ['完整提示词'],
      template: { id: 'video-shot-prompt-v2', variables: {
        status: 'DRAFT', taskId: 'TEST-01', title: '等一个回答', version: 'v01',
        durationSeconds: contract.durationSeconds, aspectRatio: contract.aspectRatio,
      } },
      referencePlan: contract.referencePlan, output: { format: 'markdown', language: 'zh-CN' },
    };
    const jobPath = path.join(directory, 'job.json');
    const outputPath = path.join(directory, 'creative-output.md');
    writeFileSync(jobPath, JSON.stringify(job));
    for (const historicalBody of [body, singleLevelBody]) {
      writeFileSync(outputPath, historicalBody);
      const result = spawnSync(process.execPath, [path.join(scripts, 'run-doubao-creative.mjs'), '--job', jobPath, '--validate-output', outputPath], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).mode, 'validate-output');
      assert.equal(readFileSync(outputPath, 'utf8'), historicalBody);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
