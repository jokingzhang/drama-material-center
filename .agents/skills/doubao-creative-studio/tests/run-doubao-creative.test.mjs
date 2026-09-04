import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.resolve(TEST_DIRECTORY, "..", "scripts", "run-doubao-creative.mjs");

function referencePlan() {
  return {
    requiredScenes: ["404病区走廊"],
    requiredCharacters: ["林默", "苏野"],
    assets: [
      {
        assetId: "SC-WARD404-CORRIDOR-v01",
        subject: "404病区走廊",
        role: "scene",
        reference: "{{Mixed 1}}",
        status: "GEN_INPUT",
      },
      {
        assetId: "CHAR-LM-IDENTITY-v01",
        subject: "林默",
        role: "character-identity",
        reference: "{{Mixed 2}}",
        status: "ACCEPTED",
      },
      {
        assetId: "CHAR-SY-IDENTITY-v01",
        subject: "苏野",
        role: "character-identity",
        reference: "{{Mixed 3}}",
        status: "ACCEPTED",
      },
      {
        assetId: "KF-WK-GRAB-LM-v01",
        subject: "抓肩关键帧",
        role: "keyframe",
        reference: "{{Mixed 4}}",
        status: "GEN_INPUT",
      },
    ],
  };
}

function job(status = "READY") {
  return {
    schemaVersion: 1,
    jobId: `reference-plan-${status.toLowerCase()}`,
    kind: "video-prompts",
    expectedModel: "doubao-seed-2.1-turbo",
    objective: "生成一条可执行的测试视频提示词。",
    deliverables: ["正文不超过2500个Unicode字符的完整提示词"],
    hardConstraints: ["正文不超过2500个Unicode字符"],
    template: {
      id: "video-shot-prompt-v1",
      variables: {
        status,
        taskId: "EP07 G01",
        title: "走廊抓肩",
        version: "v1",
        durationSeconds: "8",
        aspectRatio: "16:9",
      },
    },
    output: { format: "markdown", language: "zh-CN" },
  };
}

function validOutput() {
  return `# READY｜EP07 G01｜走廊抓肩 v1

〖风格〗写实真人电影质感，8 秒，16:9，冷青灰病区走廊。

〖空间与轴线〗

- 走廊纵深保持稳定，人物沿同一轴线移动。

〖时间轴〗

- \`0–8s\`：林默和苏野沿走廊前进，王奎从后方抓住林默右肩，动作完成后保持对峙。

〖声音〗只有脚步、衣料摩擦和短促喘息；无配乐、旁白和字幕。

〖参考〗场景只锁404病区走廊的空间、材质与光色： {{Mixed 1}} 。角色只锁身份、五官、服装与体型：林默 {{Mixed 2}} ，苏野 {{Mixed 3}} 。抓肩关键帧 {{Mixed 4}} 只参考手部接触和动作峰值，不得照抄错误姿态或覆盖场景与人物母版。

〖禁止〗换脸换装、反轴、字幕和水印。
`;
}

function referencePlanWithTurnaround() {
  const plan = referencePlan();
  plan.assets.splice(3, 0, {
    assetId: "CHAR-LM-TURNAROUND-v01",
    subject: "林默",
    role: "character-turnaround",
    reference: "{{Mixed 4}}",
    status: "GEN_INPUT",
  });
  plan.assets.at(-1).reference = "{{Mixed 5}}";
  plan.turnaroundDispositions = [
    {
      subject: "林默",
      status: "CONNECTED",
      assetId: "CHAR-LM-TURNAROUND-v01",
    },
    {
      subject: "苏野",
      status: "NOT_APPLICABLE",
      reason: "本测试镜头仅验证林默三视图输入。",
    },
  ];
  return plan;
}

function validOutputWithTurnaround() {
  return validOutput().replace(
    "抓肩关键帧 {{Mixed 4}}",
    "林默 {{Mixed 4}} 三视图只锁体型、轮廓和服装前侧背结构，忽略三联排版与中性站姿，不得复制重复人物、文字或影棚背景。抓肩关键帧 {{Mixed 5}}",
  );
}

function runWithFiles(jobValue, outputValue, argsBuilder) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "doubao-creative-test-"));
  try {
    const jobPath = path.join(directory, "job.json");
    writeFileSync(jobPath, `${JSON.stringify(jobValue, null, 2)}\n`, "utf8");
    let outputPath = null;
    if (outputValue !== null) {
      outputPath = path.join(directory, "creative-output.md");
      writeFileSync(outputPath, outputValue, "utf8");
    }
    return spawnSync(process.execPath, [RUNNER, ...argsBuilder(jobPath, outputPath)], {
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("READY video prompt jobs require a referencePlan", () => {
  const result = runWithFiles(job("READY"), null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /referencePlan is required/);
});

test("DRAFT video prompt jobs also require a referencePlan", () => {
  const result = runWithFiles(job("DRAFT"), null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /referencePlan is required/);
});

test("DRAFT jobs may explicitly carry DRAFT assets", () => {
  const plan = referencePlan();
  plan.assets[0].status = "DRAFT";
  const draftJob = { ...job("DRAFT"), referencePlan: plan };
  const result = runWithFiles(draftJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).referencePlan.validation, "passed");
});

test("READY jobs reject DRAFT assets", () => {
  const plan = referencePlan();
  plan.assets[0].status = "DRAFT";
  const readyJob = { ...job("READY"), referencePlan: plan };
  const result = runWithFiles(readyJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must be GEN_INPUT or ACCEPTED/);
});

test("--check rejects INTERNAL assets", () => {
  const plan = referencePlan();
  plan.assets.at(-1).status = "INTERNAL";
  const draftJob = { ...job("DRAFT"), referencePlan: plan };
  const result = runWithFiles(draftJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /cannot reference asset status INTERNAL/);
});

test("--check rejects keyframes placed before character identity inputs", () => {
  const plan = referencePlan();
  plan.assets = [plan.assets[0], plan.assets[3], plan.assets[1], plan.assets[2]];
  plan.assets.forEach((asset, index) => {
    asset.reference = `{{Mixed ${index + 1}}}`;
  });
  const draftJob = { ...job("DRAFT"), referencePlan: plan };
  const result = runWithFiles(draftJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /is out of order/);
});

test("--check rejects a required character without an identity input", () => {
  const plan = referencePlan();
  plan.assets = plan.assets.filter((asset) => asset.subject !== "苏野");
  plan.assets.at(-1).reference = "{{Mixed 3}}";
  const readyJob = { ...job("READY"), referencePlan: plan };
  const result = runWithFiles(readyJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /missing character identity assets for: 苏野/);
});

test("--check validates scene, identity, status, and input order coverage", () => {
  const readyJob = { ...job("READY"), referencePlan: referencePlan() };
  const result = runWithFiles(readyJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.equal(response.referencePlan.validation, "passed");
  assert.equal(response.referencePlan.assetCount, 4);
});

test("--check allows one identity anchor and one turnaround for the same character", () => {
  const readyJob = { ...job("READY"), referencePlan: referencePlanWithTurnaround() };
  const result = runWithFiles(readyJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).referencePlan.assetCount, 5);
});

test("--check rejects duplicate turnarounds for the same character", () => {
  const plan = referencePlanWithTurnaround();
  plan.assets.splice(4, 0, {
    ...plan.assets[3],
    assetId: "CHAR-LM-TURNAROUND-v02",
    reference: "{{Mixed 5}}",
  });
  plan.assets.at(-1).reference = "{{Mixed 6}}";
  const readyJob = { ...job("READY"), referencePlan: plan };
  const result = runWithFiles(readyJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /duplicate character inputs for: 林默::character-turnaround/);
});

test("--check validates explicit budget exclusions without a turnaround asset", () => {
  const plan = referencePlan();
  plan.turnaroundDispositions = plan.requiredCharacters.map((subject) => ({
    subject,
    status: "BUDGET_EXCLUDED",
    reason: "当前镜头保留剧情关键道具后达到图片上限。",
  }));
  const readyJob = { ...job("READY"), referencePlan: plan };
  const result = runWithFiles(readyJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).referencePlan.turnaroundDispositionCount, 2);
});

test("--check rejects an incomplete turnaround disposition matrix", () => {
  const plan = referencePlan();
  plan.turnaroundDispositions = [{
    subject: "林默",
    status: "NOT_APPLICABLE",
    reason: "本镜头不需要。",
  }];
  const readyJob = { ...job("READY"), referencePlan: plan };
  const result = runWithFiles(readyJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /turnaroundDispositions is missing subjects: 苏野/);
});

test("--validate-output accepts EP05-style responsibility mapping", () => {
  const readyJob = { ...job("READY"), referencePlan: referencePlan() };
  const result = runWithFiles(readyJob, validOutput(), (jobPath, outputPath) => [
    "--job",
    jobPath,
    "--validate-output",
    outputPath,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).referencePlanValidation, "passed");
});

test("--validate-output accepts a scoped turnaround beside the identity anchor", () => {
  const readyJob = { ...job("READY"), referencePlan: referencePlanWithTurnaround() };
  const result = runWithFiles(readyJob, validOutputWithTurnaround(), (jobPath, outputPath) => [
    "--job",
    jobPath,
    "--validate-output",
    outputPath,
  ]);
  assert.equal(result.status, 0, result.stderr);
});

test("--validate-output rejects an unrestricted turnaround", () => {
  const readyJob = { ...job("READY"), referencePlan: referencePlanWithTurnaround() };
  const brokenOutput = validOutputWithTurnaround().replace(
    "三视图只锁体型、轮廓和服装前侧背结构，忽略三联排版与中性站姿，不得复制重复人物、文字或影棚背景。",
    "三视图展示人物体型和服装结构。",
  );
  const result = runWithFiles(readyJob, brokenOutput, (jobPath, outputPath) => [
    "--job",
    jobPath,
    "--validate-output",
    outputPath,
  ]);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /turnaround must be limited|turnaround must state a boundary/);
});

test("--validate-output rejects a Mixed reference not associated with its character", () => {
  const readyJob = { ...job("READY"), referencePlan: referencePlan() };
  const brokenOutput = validOutput().replace("林默 {{Mixed 2}}", "陌生人 {{Mixed 2}}");
  const result = runWithFiles(readyJob, brokenOutput, (jobPath, outputPath) => [
    "--job",
    jobPath,
    "--validate-output",
    outputPath,
  ]);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /explicitly associated with subject 林默/);
});

test("--validate-output rejects Mixed references swapped between characters", () => {
  const readyJob = { ...job("READY"), referencePlan: referencePlan() };
  const brokenOutput = validOutput().replace(
    "林默 {{Mixed 2}} ，苏野 {{Mixed 3}}",
    "苏野 {{Mixed 2}} ，林默 {{Mixed 3}}",
  );
  const result = runWithFiles(readyJob, brokenOutput, (jobPath, outputPath) => [
    "--job",
    jobPath,
    "--validate-output",
    outputPath,
  ]);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /explicitly associated with subject 林默|explicitly associated with subject 苏野/);
});

test("--validate-output rejects an unrestricted keyframe", () => {
  const readyJob = { ...job("READY"), referencePlan: referencePlan() };
  const brokenOutput = validOutput().replace(
    "抓肩关键帧 {{Mixed 4}} 只参考手部接触和动作峰值，不得照抄错误姿态或覆盖场景与人物母版。",
    "抓肩关键帧 {{Mixed 4}} 展示手部接触和动作峰值。",
  );
  const result = runWithFiles(readyJob, brokenOutput, (jobPath, outputPath) => [
    "--job",
    jobPath,
    "--validate-output",
    outputPath,
  ]);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /must be limited with wording|negative boundary/);
});

test("--list-templates exposes one model-neutral template", () => {
  const result = spawnSync(process.execPath, [RUNNER, "--list-templates"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.deepEqual(response.templates.map((template) => template.id), ["video-shot-prompt-v1"]);
});

test("legacy Seedance template id resolves to the canonical template", () => {
  const legacyJob = job("DRAFT");
  legacyJob.template.id = "seedance-shot-prompt-v1";
  legacyJob.referencePlan = referencePlan();
  const result = runWithFiles(legacyJob, null, (jobPath) => ["--job", jobPath, "--check"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).templateId, "video-shot-prompt-v1");
});

test("a successful Claude response without model metadata is accepted", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "doubao-creative-model-metadata-test-"));
  try {
    const jobPath = path.join(directory, "job.json");
    const outputDir = path.join(directory, "run");
    const fakeClaudePath = path.join(directory, "claude");
    const storyJob = {
      schemaVersion: 1,
      jobId: "missing-model-metadata",
      kind: "story-outline",
      expectedModel: "doubao-seed-2.1-turbo",
      objective: "生成一行测试剧情。",
      deliverables: ["只输出一行Markdown"],
      output: { format: "markdown", language: "zh-CN" },
    };
    const fakeClaudeSource = [
      "#!/usr/bin/env node",
      "process.stdin.resume();",
      "process.stdin.on('end', () => {",
      "  process.stdout.write(JSON.stringify({",
      "    type: 'result',",
      "    subtype: 'success',",
      "    is_error: false,",
      "    result: '# DRAFT｜测试剧情',",
      "    duration_ms: 1,",
      "    total_cost_usd: 0",
      "  }));",
      "});",
      "",
    ].join("\n");
    writeFileSync(jobPath, `${JSON.stringify(storyJob, null, 2)}\n`, "utf8");
    writeFileSync(fakeClaudePath, fakeClaudeSource, "utf8");
    chmodSync(fakeClaudePath, 0o755);

    const result = spawnSync(process.execPath, [
      RUNNER,
      "--job",
      jobPath,
      "--out",
      outputDir,
    ], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: [directory, process.env.PATH].filter(Boolean).join(path.delimiter),
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).modelsUsed, []);
    const runRecord = JSON.parse(readFileSync(path.join(outputDir, "run.json"), "utf8"));
    assert.equal(runRecord.status, "success");
    assert.deepEqual(runRecord.modelsUsed, []);
    assert.equal(
      readFileSync(path.join(outputDir, "creative-output.md"), "utf8"),
      "# DRAFT｜测试剧情",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
