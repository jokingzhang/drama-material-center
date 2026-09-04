#!/usr/bin/env node

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_SOURCE_BYTES = 512 * 1024;
const MAX_JOB_BYTES = 1024 * 1024;
const MAX_PROMPT_CHARACTERS = 700_000;
const MAX_PROCESS_OUTPUT_BYTES = 16 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const SKILL_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_DIRECTORY = path.join(SKILL_DIRECTORY, "assets", "templates");
const VIDEO_SHOT_TEMPLATE_ID = "video-shot-prompt-v1";
const TEMPLATE_ID_ALIASES = new Map([
  ["seedance-shot-prompt-v1", VIDEO_SHOT_TEMPLATE_ID],
]);
const ALLOWED_TEMPLATE_STATUSES = new Set(["DRAFT", "NEEDS_REVISION", "BLOCKED", "READY"]);
const ALLOWED_REFERENCE_ROLES = new Set([
  "scene",
  "character-identity",
  "character-turnaround",
  "state",
  "prop",
  "audio",
  "spatial",
  "continuity",
  "keyframe",
]);
const ALLOWED_REFERENCE_STATUSES = new Set([
  "DRAFT",
  "INTERNAL",
  "GEN_INPUT",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
]);
const READY_REFERENCE_STATUSES = new Set(["GEN_INPUT", "ACCEPTED"]);
const ALLOWED_TURNAROUND_DISPOSITIONS = new Set([
  "CONNECTED",
  "NOT_APPLICABLE",
  "BUDGET_EXCLUDED",
  "CONFLICT",
]);
const REFERENCE_ROLE_PRIORITY = new Map([
  ["scene", 0],
  ["character-identity", 1],
  ["character-turnaround", 1],
  ["state", 2],
  ["prop", 2],
  ["audio", 2],
  ["spatial", 3],
  ["continuity", 3],
  ["keyframe", 3],
]);
const TEMPLATE_DEFINITIONS = new Map([
  [
    VIDEO_SHOT_TEMPLATE_ID,
    {
      description: "统一视频分镜/生成提示词：EP05 结构；与目标视频模型无关，并使用有序 referencePlan",
      fileName: "video-shot-prompt-v1.md",
      outputFormat: "markdown",
      allowedKinds: ["storyboard", "video-prompts", "creative-repair"],
      requiredVariables: ["status", "taskId", "title", "version", "durationSeconds", "aspectRatio"],
    },
  ],
]);
const ALLOWED_KINDS = new Set([
  "script",
  "story-outline",
  "storyboard",
  "asset-prompts",
  "video-prompts",
  "creative-repair",
  "other",
]);
const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "jobId",
  "kind",
  "expectedModel",
  "objective",
  "userCreativeDirectives",
  "canon",
  "deliverables",
  "hardConstraints",
  "template",
  "goldenSamples",
  "repairFeedback",
  "referencePlan",
  "output",
]);

function usage() {
  return `Usage:
  run-doubao-creative.mjs --job <job.json|-> --out <new-directory> [--timeout-ms <ms>]
  run-doubao-creative.mjs --job <job.json|-> --check
  run-doubao-creative.mjs --job <job.json> --validate-output <creative-output>
  run-doubao-creative.mjs --list-templates

The runner invokes Claude Code through stdin, disables all Claude tools, loads only
user settings, and never calls the Plan HTTP endpoint directly.`;
}

function fail(message, exitCode = 2) {
  const error = new Error(message);
  error.exitCode = exitCode;
  throw error;
}

function parseArgs(argv) {
  const options = {
    jobPath: null,
    outputDir: null,
    checkOnly: false,
    listTemplates: false,
    validateOutputPath: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--check") {
      options.checkOnly = true;
    } else if (arg === "--list-templates") {
      options.listTemplates = true;
    } else if (arg === "--validate-output") {
      options.validateOutputPath = argv[++index];
    } else if (arg === "--job") {
      options.jobPath = argv[++index];
    } else if (arg === "--out") {
      options.outputDir = argv[++index];
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = Number(argv[++index]);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (options.help) return options;
  if (options.listTemplates) {
    if (options.jobPath || options.outputDir || options.checkOnly || options.validateOutputPath) {
      fail("--list-templates cannot be combined with --job, --out, --check, or --validate-output");
    }
    return options;
  }
  if (!options.jobPath) fail("--job is required");
  if (options.checkOnly && options.validateOutputPath) fail("--check cannot be combined with --validate-output");
  if (options.validateOutputPath && options.outputDir) fail("--validate-output cannot be combined with --out");
  if (!options.checkOnly && !options.validateOutputPath && !options.outputDir) {
    fail("--out is required unless --check or --validate-output is used");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 30 * 60 * 1_000) {
    fail("--timeout-ms must be an integer between 1000 and 1800000");
  }
  return options;
}

async function readStdin() {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_JOB_BYTES) fail(`stdin job exceeds ${MAX_JOB_BYTES} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
}

function assertString(value, label, { allowEmpty = false, maxLength = 100_000 } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
    fail(`${label} must be a non-empty string`);
  }
  if (value.length > maxLength) fail(`${label} exceeds ${maxLength} characters`);
}

function validateStringArray(value, label, { required = false } = {}) {
  if (value === undefined) {
    if (required) fail(`${label} is required`);
    return [];
  }
  if (!Array.isArray(value) || (required && value.length === 0)) {
    fail(`${label} must be ${required ? "a non-empty" : "an"} array`);
  }
  value.forEach((item, index) => assertString(item, `${label}[${index}]`, { maxLength: 20_000 }));
  return value;
}

function validateTextRef(ref, label) {
  assertPlainObject(ref, label);
  const keys = Object.keys(ref);
  const allowed = new Set(["label", "path", "text"]);
  for (const key of keys) {
    if (!allowed.has(key)) fail(`${label} contains unknown field: ${key}`);
  }
  assertString(ref.label, `${label}.label`, { maxLength: 500 });
  const hasPath = typeof ref.path === "string";
  const hasText = typeof ref.text === "string";
  if (hasPath === hasText) fail(`${label} must contain exactly one of path or text`);
  if (hasPath) assertString(ref.path, `${label}.path`, { maxLength: 4_096 });
  if (hasText) assertString(ref.text, `${label}.text`, { maxLength: MAX_FILE_BYTES });
}

function canonicalTemplateId(templateId) {
  return TEMPLATE_ID_ALIASES.get(templateId) ?? templateId;
}

function getTemplateDefinition(templateId) {
  const canonicalId = canonicalTemplateId(templateId);
  const definition = TEMPLATE_DEFINITIONS.get(canonicalId);
  if (!definition) {
    fail(`unknown template id: ${templateId}; use --list-templates to inspect available templates`);
  }
  return { id: canonicalId, ...definition };
}

function validateTemplateConfig(job) {
  if (job.template === undefined) return;
  assertPlainObject(job.template, "template");
  for (const key of Object.keys(job.template)) {
    if (!new Set(["id", "variables"]).has(key)) fail(`template contains unknown field: ${key}`);
  }
  assertString(job.template.id, "template.id", { maxLength: 100 });
  const definition = getTemplateDefinition(job.template.id);
  if (!definition.allowedKinds.includes(job.kind)) {
    fail(`template ${job.template.id} only supports kind: ${definition.allowedKinds.join(", ")}`);
  }
  if (job.output.format !== definition.outputFormat) {
    fail(`template ${job.template.id} requires output.format=${definition.outputFormat}`);
  }

  assertPlainObject(job.template.variables, "template.variables");
  const allowedVariables = new Set(definition.requiredVariables);
  for (const key of Object.keys(job.template.variables)) {
    if (!allowedVariables.has(key)) fail(`template.variables contains unknown field for ${job.template.id}: ${key}`);
    assertString(job.template.variables[key], `template.variables.${key}`, { maxLength: 500 });
    if (job.template.variables[key].trim() !== job.template.variables[key]) {
      fail(`template.variables.${key} must not have leading or trailing whitespace`);
    }
  }
  for (const key of definition.requiredVariables) {
    if (!(key in job.template.variables)) fail(`template.variables.${key} is required for ${job.template.id}`);
  }

  if (!ALLOWED_TEMPLATE_STATUSES.has(job.template.variables.status)) {
    fail(`template.variables.status must be one of: ${[...ALLOWED_TEMPLATE_STATUSES].join(", ")}`);
  }
  const durationSeconds = Number(job.template.variables.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 600) {
    fail("template.variables.durationSeconds must be a positive number no greater than 600");
  }
  const aspectRatioMatch = job.template.variables.aspectRatio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!aspectRatioMatch || Number(aspectRatioMatch[1]) <= 0 || Number(aspectRatioMatch[2]) <= 0) {
    fail("template.variables.aspectRatio must be a positive ratio such as 16:9 or 9:16");
  }
}

function validatePlatformReference(value, label) {
  assertString(value, label, { maxLength: 500 });
  const patterns = [
    /^\{\{Mixed\s+\d+\}\}$/,
    /^@图片\d+$/,
    /^<Subject\s+\d+>$/i,
    /^\{\{Node\s+[^{}\n]+\}\}$/,
  ];
  if (!patterns.some((pattern) => pattern.test(value))) {
    fail(`${label} must use a supported platform reference such as {{Mixed 1}}, @图片1, <Subject 1>, or {{Node <nodeKey>}}`);
  }
}

function validateReferencePlan(job) {
  const isVideoShotTemplate = job.template
    && canonicalTemplateId(job.template.id) === VIDEO_SHOT_TEMPLATE_ID;
  const templateStatus = job.template?.variables?.status;
  if (job.referencePlan === undefined) {
    if (isVideoShotTemplate) fail(`referencePlan is required when using ${VIDEO_SHOT_TEMPLATE_ID}`);
    return;
  }

  if (!isVideoShotTemplate) {
    fail(`referencePlan is only supported with template.id=${VIDEO_SHOT_TEMPLATE_ID}`);
  }
  assertPlainObject(job.referencePlan, "referencePlan");
  const allowedPlanFields = new Set(["requiredScenes", "requiredCharacters", "assets", "turnaroundDispositions"]);
  for (const key of Object.keys(job.referencePlan)) {
    if (!allowedPlanFields.has(key)) fail(`referencePlan contains unknown field: ${key}`);
  }

  const requiredScenes = validateStringArray(job.referencePlan.requiredScenes, "referencePlan.requiredScenes", { required: true });
  if (!Array.isArray(job.referencePlan.requiredCharacters)) {
    fail("referencePlan.requiredCharacters must be an array; use [] only for a genuinely characterless shot");
  }
  const requiredCharacters = validateStringArray(job.referencePlan.requiredCharacters, "referencePlan.requiredCharacters");
  if (!Array.isArray(job.referencePlan.assets) || job.referencePlan.assets.length === 0) {
    fail("referencePlan.assets must be a non-empty array");
  }

  const duplicateValues = (values) => values.filter((value, index) => values.indexOf(value) !== index);
  const duplicateScenes = [...new Set(duplicateValues(requiredScenes))];
  if (duplicateScenes.length > 0) fail(`referencePlan.requiredScenes contains duplicates: ${duplicateScenes.join(", ")}`);
  const duplicateCharacters = [...new Set(duplicateValues(requiredCharacters))];
  if (duplicateCharacters.length > 0) {
    fail(`referencePlan.requiredCharacters contains duplicates: ${duplicateCharacters.join(", ")}`);
  }

  const assetIds = [];
  const references = [];
  const sceneSubjects = [];
  const characterInputs = new Map();
  const characterInputKeys = [];
  let previousPriority = -1;
  job.referencePlan.assets.forEach((asset, index) => {
    const label = `referencePlan.assets[${index}]`;
    assertPlainObject(asset, label);
    const allowedAssetFields = new Set(["assetId", "subject", "role", "reference", "status"]);
    for (const key of Object.keys(asset)) {
      if (!allowedAssetFields.has(key)) fail(`${label} contains unknown field: ${key}`);
    }
    assertString(asset.assetId, `${label}.assetId`, { maxLength: 500 });
    assertString(asset.subject, `${label}.subject`, { maxLength: 500 });
    assertString(asset.role, `${label}.role`, { maxLength: 100 });
    if (!ALLOWED_REFERENCE_ROLES.has(asset.role)) {
      fail(`${label}.role must be one of: ${[...ALLOWED_REFERENCE_ROLES].join(", ")}`);
    }
    validatePlatformReference(asset.reference, `${label}.reference`);
    assertString(asset.status, `${label}.status`, { maxLength: 100 });
    if (!ALLOWED_REFERENCE_STATUSES.has(asset.status)) {
      fail(`${label}.status must be one of: ${[...ALLOWED_REFERENCE_STATUSES].join(", ")}`);
    }
    if (new Set(["INTERNAL", "REJECTED", "SUPERSEDED"]).has(asset.status)) {
      fail(`${label} cannot reference asset status ${asset.status}`);
    }
    if (templateStatus === "READY" && !READY_REFERENCE_STATUSES.has(asset.status)) {
      fail(`${label}.status must be GEN_INPUT or ACCEPTED when template status is READY`);
    }

    const priority = REFERENCE_ROLE_PRIORITY.get(asset.role);
    if (priority < previousPriority) {
      fail(`${label}.role=${asset.role} is out of order; use scene -> character identity -> state/prop/audio -> spatial/continuity/keyframe`);
    }
    previousPriority = priority;
    assetIds.push(asset.assetId);
    references.push(asset.reference);
    if (asset.role === "scene") sceneSubjects.push(asset.subject);
    if (new Set(["character-identity", "character-turnaround"]).has(asset.role)) {
      const roles = characterInputs.get(asset.subject) ?? new Set();
      roles.add(asset.role);
      characterInputs.set(asset.subject, roles);
      characterInputKeys.push(`${asset.subject}::${asset.role}`);
    }
  });

  const duplicateAssetIds = [...new Set(duplicateValues(assetIds))];
  if (duplicateAssetIds.length > 0) fail(`referencePlan.assets contains duplicate assetId values: ${duplicateAssetIds.join(", ")}`);
  const duplicateReferences = [...new Set(duplicateValues(references))];
  if (duplicateReferences.length > 0) {
    fail(`referencePlan.assets contains duplicate reference values: ${duplicateReferences.join(", ")}`);
  }
  const duplicateCharacterInputs = [...new Set(duplicateValues(characterInputKeys))];
  if (duplicateCharacterInputs.length > 0) {
    fail(`referencePlan.assets contains duplicate character inputs for: ${duplicateCharacterInputs.join(", ")}`);
  }

  const missingScenes = requiredScenes.filter((scene) => !sceneSubjects.includes(scene));
  const extraScenes = sceneSubjects.filter((scene) => !requiredScenes.includes(scene));
  if (missingScenes.length > 0) fail(`referencePlan is missing scene assets for: ${missingScenes.join(", ")}`);
  if (extraScenes.length > 0) fail(`referencePlan contains undeclared scene assets for: ${extraScenes.join(", ")}`);
  const characterSubjects = [...characterInputs.keys()];
  const missingCharacters = requiredCharacters.filter((character) => !characterInputs.has(character));
  const extraCharacters = characterSubjects.filter((character) => !requiredCharacters.includes(character));
  if (missingCharacters.length > 0) {
    fail(`referencePlan is missing character identity assets for: ${missingCharacters.join(", ")}`);
  }
  if (extraCharacters.length > 0) {
    fail(`referencePlan contains undeclared character identity assets for: ${extraCharacters.join(", ")}`);
  }

  if (job.referencePlan.turnaroundDispositions !== undefined) {
    if (!Array.isArray(job.referencePlan.turnaroundDispositions)) {
      fail("referencePlan.turnaroundDispositions must be an array");
    }
    const dispositionSubjects = [];
    for (const [index, disposition] of job.referencePlan.turnaroundDispositions.entries()) {
      const label = `referencePlan.turnaroundDispositions[${index}]`;
      assertPlainObject(disposition, label);
      const allowedDispositionFields = new Set(["subject", "status", "assetId", "reason"]);
      for (const key of Object.keys(disposition)) {
        if (!allowedDispositionFields.has(key)) fail(`${label} contains unknown field: ${key}`);
      }
      assertString(disposition.subject, `${label}.subject`, { maxLength: 500 });
      assertString(disposition.status, `${label}.status`, { maxLength: 100 });
      if (!ALLOWED_TURNAROUND_DISPOSITIONS.has(disposition.status)) {
        fail(`${label}.status must be one of: ${[...ALLOWED_TURNAROUND_DISPOSITIONS].join(", ")}`);
      }
      dispositionSubjects.push(disposition.subject);
      if (disposition.status === "CONNECTED") {
        assertString(disposition.assetId, `${label}.assetId`, { maxLength: 500 });
        const matchingAsset = job.referencePlan.assets.find((asset) => (
          asset.assetId === disposition.assetId
          && asset.subject === disposition.subject
          && asset.role === "character-turnaround"
        ));
        if (!matchingAsset) {
          fail(`${label} CONNECTED assetId must reference the same subject's character-turnaround input`);
        }
      } else {
        if (disposition.assetId !== undefined) {
          fail(`${label}.assetId is only allowed when status is CONNECTED`);
        }
        assertString(disposition.reason, `${label}.reason`, { maxLength: 20_000 });
      }
    }
    const duplicateDispositionSubjects = [...new Set(duplicateValues(dispositionSubjects))];
    if (duplicateDispositionSubjects.length > 0) {
      fail(`referencePlan.turnaroundDispositions contains duplicate subjects: ${duplicateDispositionSubjects.join(", ")}`);
    }
    const missingDispositionSubjects = requiredCharacters.filter((subject) => !dispositionSubjects.includes(subject));
    const extraDispositionSubjects = dispositionSubjects.filter((subject) => !requiredCharacters.includes(subject));
    if (missingDispositionSubjects.length > 0) {
      fail(`referencePlan.turnaroundDispositions is missing subjects: ${missingDispositionSubjects.join(", ")}`);
    }
    if (extraDispositionSubjects.length > 0) {
      fail(`referencePlan.turnaroundDispositions contains undeclared subjects: ${extraDispositionSubjects.join(", ")}`);
    }
    const connectedTurnaroundIds = new Set(job.referencePlan.turnaroundDispositions
      .filter((disposition) => disposition.status === "CONNECTED")
      .map((disposition) => disposition.assetId));
    const undisposedTurnaroundIds = job.referencePlan.assets
      .filter((asset) => asset.role === "character-turnaround" && !connectedTurnaroundIds.has(asset.assetId))
      .map((asset) => asset.assetId);
    if (undisposedTurnaroundIds.length > 0) {
      fail(`referencePlan contains character-turnaround assets without CONNECTED dispositions: ${undisposedTurnaroundIds.join(", ")}`);
    }
  }

  const mixedNumbers = references.map((reference) => reference.match(/^\{\{Mixed\s+(\d+)\}\}$/)?.[1]);
  if (mixedNumbers.every(Boolean)) {
    mixedNumbers.forEach((number, index) => {
      if (Number(number) !== index + 1) {
        fail(`referencePlan.assets[${index}].reference must be {{Mixed ${index + 1}}} to match input order`);
      }
    });
  }
}

function validateJob(job) {
  assertPlainObject(job, "job");
  for (const key of Object.keys(job)) {
    if (!ALLOWED_TOP_LEVEL_FIELDS.has(key)) fail(`job contains unknown field: ${key}`);
  }

  if (job.schemaVersion !== 1) fail("schemaVersion must be 1");
  assertString(job.jobId, "jobId", { maxLength: 80 });
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(job.jobId)) {
    fail("jobId must use lowercase letters, digits, dots, underscores, or hyphens");
  }
  if (!ALLOWED_KINDS.has(job.kind)) fail(`kind must be one of: ${[...ALLOWED_KINDS].join(", ")}`);
  assertString(job.expectedModel, "expectedModel", { maxLength: 200 });
  if (!job.expectedModel.startsWith("doubao-")) fail("expectedModel must start with doubao-");
  assertString(job.objective, "objective", { maxLength: 50_000 });

  job.userCreativeDirectives = validateStringArray(job.userCreativeDirectives, "userCreativeDirectives");
  job.deliverables = validateStringArray(job.deliverables, "deliverables", { required: true });
  job.hardConstraints = validateStringArray(job.hardConstraints, "hardConstraints");

  if (job.canon === undefined) job.canon = [];
  if (!Array.isArray(job.canon)) fail("canon must be an array");
  job.canon.forEach((ref, index) => validateTextRef(ref, `canon[${index}]`));

  if (job.goldenSamples === undefined) job.goldenSamples = [];
  if (!Array.isArray(job.goldenSamples)) fail("goldenSamples must be an array");
  job.goldenSamples.forEach((sample, index) => {
    const label = `goldenSamples[${index}]`;
    assertPlainObject(sample, label);
    for (const key of Object.keys(sample)) {
      if (!new Set(["label", "input", "output"]).has(key)) fail(`${label} contains unknown field: ${key}`);
    }
    assertString(sample.label, `${label}.label`, { maxLength: 500 });
    assertPlainObject(sample.input, `${label}.input`);
    assertPlainObject(sample.output, `${label}.output`);
    validateTextRef({ label: `${sample.label} input`, ...sample.input }, `${label}.input`);
    validateTextRef({ label: `${sample.label} output`, ...sample.output }, `${label}.output`);
  });

  if (job.repairFeedback === undefined) job.repairFeedback = [];
  if (!Array.isArray(job.repairFeedback)) fail("repairFeedback must be an array");
  job.repairFeedback.forEach((item, index) => {
    const label = `repairFeedback[${index}]`;
    assertPlainObject(item, label);
    const allowed = new Set(["observedFailure", "evidence", "mustCorrect"]);
    for (const key of Object.keys(item)) {
      if (!allowed.has(key)) fail(`${label} contains unknown field: ${key}`);
    }
    assertString(item.observedFailure, `${label}.observedFailure`, { maxLength: 20_000 });
    assertString(item.evidence, `${label}.evidence`, { maxLength: 20_000 });
    assertString(item.mustCorrect, `${label}.mustCorrect`, { maxLength: 20_000 });
  });

  assertPlainObject(job.output, "output");
  for (const key of Object.keys(job.output)) {
    if (!new Set(["format", "language"]).has(key)) fail(`output contains unknown field: ${key}`);
  }
  if (!new Set(["markdown", "json"]).has(job.output.format)) {
    fail("output.format must be markdown or json");
  }
  if (job.output.language === undefined) job.output.language = "zh-CN";
  assertString(job.output.language, "output.language", { maxLength: 100 });
  validateTemplateConfig(job);
  validateReferencePlan(job);
}

async function loadJob(jobPath) {
  const fromStdin = jobPath === "-";
  let rawText;
  if (fromStdin) {
    rawText = await readStdin();
  } else {
    const absoluteJobPath = path.resolve(jobPath);
    const stat = await fs.stat(absoluteJobPath);
    if (!stat.isFile()) fail(`job is not a file: ${absoluteJobPath}`);
    if (stat.size > MAX_JOB_BYTES) fail(`job exceeds ${MAX_JOB_BYTES} bytes: ${absoluteJobPath}`);
    rawText = await fs.readFile(absoluteJobPath, "utf8");
  }
  let job;
  try {
    job = JSON.parse(rawText);
  } catch (error) {
    fail(`job is not valid JSON: ${error.message}`);
  }
  validateJob(job);
  const baseDir = fromStdin ? process.cwd() : path.dirname(path.resolve(jobPath));
  return { job, baseDir };
}

function listTemplateDefinitions() {
  return [...TEMPLATE_DEFINITIONS.entries()].map(([id, definition]) => ({
    id,
    description: definition.description,
    outputFormat: definition.outputFormat,
    allowedKinds: definition.allowedKinds,
    requiredVariables: definition.requiredVariables,
  }));
}

async function materializeTemplate(templateConfig) {
  if (!templateConfig) return { template: null, templateBytes: 0 };
  const definition = getTemplateDefinition(templateConfig.id);
  const templatePath = path.join(TEMPLATE_DIRECTORY, definition.fileName);
  const stat = await fs.stat(templatePath);
  if (!stat.isFile()) fail(`template asset is not a file: ${templatePath}`);
  if (stat.size > MAX_FILE_BYTES) fail(`template asset exceeds ${MAX_FILE_BYTES} bytes: ${templatePath}`);
  let content = await fs.readFile(templatePath, "utf8");
  for (const [key, value] of Object.entries(templateConfig.variables)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  for (const key of definition.requiredVariables) {
    if (content.includes(`{{${key}}}`)) fail(`template asset still contains unresolved required variable: ${key}`);
  }
  return {
    template: {
      id: definition.id,
      description: definition.description,
      variables: templateConfig.variables,
      content,
    },
    templateBytes: Buffer.byteLength(content, "utf8"),
  };
}

async function materializeTextRef(ref, baseDir, byteCounter) {
  if (typeof ref.text === "string") {
    const bytes = Buffer.byteLength(ref.text, "utf8");
    if (bytes > MAX_FILE_BYTES) fail(`${ref.label} exceeds ${MAX_FILE_BYTES} bytes`);
    byteCounter.total += bytes;
    if (byteCounter.total > MAX_TOTAL_SOURCE_BYTES) fail(`all source text exceeds ${MAX_TOTAL_SOURCE_BYTES} bytes`);
    return { label: ref.label, source: "inline", content: ref.text };
  }

  const absolutePath = path.isAbsolute(ref.path) ? path.normalize(ref.path) : path.resolve(baseDir, ref.path);
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) fail(`${ref.label} is not a file: ${absolutePath}`);
  if (stat.size > MAX_FILE_BYTES) fail(`${ref.label} exceeds ${MAX_FILE_BYTES} bytes: ${absolutePath}`);
  const buffer = await fs.readFile(absolutePath);
  if (buffer.includes(0)) fail(`${ref.label} appears to be binary: ${absolutePath}`);
  byteCounter.total += buffer.length;
  if (byteCounter.total > MAX_TOTAL_SOURCE_BYTES) fail(`all source text exceeds ${MAX_TOTAL_SOURCE_BYTES} bytes`);
  return { label: ref.label, source: absolutePath, content: buffer.toString("utf8") };
}

async function materializeJob(job, baseDir) {
  const byteCounter = { total: 0 };
  const canon = [];
  for (const ref of job.canon) canon.push(await materializeTextRef(ref, baseDir, byteCounter));

  const goldenSamples = [];
  for (const sample of job.goldenSamples) {
    const input = await materializeTextRef(
      { label: `${sample.label} input`, ...sample.input },
      baseDir,
      byteCounter,
    );
    const output = await materializeTextRef(
      { label: `${sample.label} output`, ...sample.output },
      baseDir,
      byteCounter,
    );
    goldenSamples.push({ label: sample.label, input, output });
  }

  const { template, templateBytes } = await materializeTemplate(job.template);

  return {
    job: {
      ...job,
      canon,
      goldenSamples,
      template,
      goldenSampleStatus: goldenSamples.length > 0 ? "PROVIDED" : "GOLDEN_SAMPLE_PENDING",
    },
    sourceBytes: byteCounter.total,
    templateBytes,
  };
}

function buildPrompt(materializedJob) {
  const formatInstruction = materializedJob.output.format === "json"
    ? "只输出一个合法 JSON 值，不要 Markdown 代码围栏、前言或后记。"
    : "只输出最终 Markdown 交付物，不要写调用过程、免责声明、前言或后记。";
  const templateInstruction = materializedJob.template
    ? "template.content 是本轮强制输出骨架，事实型变量已经填好。严格保留标题和核心段落顺序，用当前任务内容替换所有角括号说明；不要输出模板说明本身。〖禁止〗标为可选，没有高价值风险时删除整段。平台真实引用语法（例如 {{Mixed 1}}、@图片1、<Subject 1>）不是占位说明，应按实际素材保留或替换。"
    : "本轮没有指定输出模板；按 deliverables 选择最清楚的最终交付结构。";
  const referenceInstruction = materializedJob.referencePlan
    ? "referencePlan 是执行者核对后的实际生成输入合同。〖参考〗必须按 assets 顺序逐项使用 reference，每项只出现一次并紧邻 subject；场景负责空间/材质/光色，character-identity 负责脸部身份，可直接输入的 character-turnaround 补充体型、轮廓和同一造型的前侧背结构，state/prop/audio 只负责对应状态或物件，spatial/continuity/keyframe 只能写成局部辅助约束。身份图与同一人物三视图可同时存在但职责不得互换；三视图必须明确忽略三联排版和中性站姿，禁止复制重复人物、拼板、文字或影棚背景。不得引用 INTERNAL 素材。"
    : "本轮没有 referencePlan；若模板状态不是 READY，可先返回 DRAFT，但不得自行宣称素材覆盖已经完成。";

  return [
    "你是本任务唯一负责创作文本的豆包创作代理。调用你的执行代理只负责提供事实、保存结果、硬约束检查和后续执行，不会替你创作或润色。",
    "任务包中的 canon 是事实源；不得静默改变已确认的角色动机、剧情结果、人物身份或用户硬约束。userCreativeDirectives 是用户原始或已确认的创意要求。",
    "goldenSamples 是用户认可的质量样本；学习其因果清晰度、动作可见性、语言质感和可执行程度。不要评价样本，也不要把执行代理当成共同作者。",
    "若 repairFeedback 非空，请根据其中的实际失败现象、证据和必须修正结果，返回完整修订版，不要只给修改建议或差异补丁。",
    templateInstruction,
    referenceInstruction,
    formatInstruction,
    "下面是完整 JSON 任务包：",
    JSON.stringify(materializedJob, null, 2),
  ].join("\n\n");
}

function redactSecrets(text) {
  return text
    .replace(/ark-[A-Za-z0-9_-]{8,}/g, "ark-****")
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/gi, "$1****")
    .replace(/(anthropic_(?:auth_token|api_key)\s*[:=]\s*)[^\s"']+/gi, "$1****");
}

async function runClaude({ prompt, model, timeoutMs }) {
  const isolatedDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "doubao-creative-"));
  const args = [
    "-p",
    "--output-format",
    "json",
    "--tools",
    "",
    "--no-session-persistence",
    "--setting-sources",
    "user",
    "--model",
    model,
  ];
  const startedAt = new Date();

  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn("claude", args, {
        cwd: isolatedDirectory,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const stdoutChunks = [];
      const stderrChunks = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let settled = false;
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
      }, timeoutMs);

      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });
      child.stdout.on("data", (chunk) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_PROCESS_OUTPUT_BYTES) child.kill("SIGTERM");
        else stdoutChunks.push(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderrBytes += chunk.length;
        if (stderrBytes > MAX_PROCESS_OUTPUT_BYTES) child.kill("SIGTERM");
        else stderrChunks.push(chunk);
      });
      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({
          code,
          signal,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          exceededOutputLimit: stdoutBytes > MAX_PROCESS_OUTPUT_BYTES || stderrBytes > MAX_PROCESS_OUTPUT_BYTES,
          timedOut,
        });
      });

      child.stdin.on("error", (error) => {
        if (error.code === "EPIPE" || settled) return;
        settled = true;
        clearTimeout(timeout);
        child.kill("SIGTERM");
        reject(error);
      });
      child.stdin.end(prompt);
    });

    return {
      ...result,
      args,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    };
  } finally {
    await fs.rm(isolatedDirectory, { recursive: true, force: true });
  }
}

async function createOutputDirectory(outputDir) {
  const absolutePath = path.resolve(outputDir);
  try {
    await fs.access(absolutePath);
    fail(`output directory already exists; choose a new versioned path: ${absolutePath}`);
  } catch (error) {
    if (error.exitCode) throw error;
    if (error.code !== "ENOENT") throw error;
  }
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.mkdir(absolutePath);
  return absolutePath;
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseClaudeResponse(stdout) {
  let response;
  try {
    response = JSON.parse(stdout.trim());
  } catch (error) {
    fail(`Claude Code stdout is not valid JSON: ${error.message}`, 3);
  }
  if (response.type !== "result" || response.subtype !== "success" || response.is_error !== false) {
    fail(`Claude Code returned a non-success result: ${response.subtype || response.type || "unknown"}`, 3);
  }
  if (typeof response.result !== "string" || response.result.trim() === "") {
    fail("Claude Code returned an empty creative result", 3);
  }
  return response;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectPlatformReferences(text) {
  return [...text.matchAll(/\{\{Mixed\s+\d+\}\}|@图片\d+|<Subject\s+\d+>|\{\{Node\s+[^{}\n]+\}\}/gi)]
    .map((match) => match[0]);
}

function validateReferencePlanOutput(output, referencePlan) {
  if (!referencePlan) return [];
  const errors = [];
  const referenceHeading = "〖参考〗";
  const referenceStart = output.indexOf(referenceHeading);
  if (referenceStart === -1) return ["referencePlan requires 〖参考〗"];
  const forbiddenStart = output.indexOf("〖禁止〗", referenceStart + referenceHeading.length);
  const referenceEnd = forbiddenStart === -1 ? output.length : forbiddenStart;
  const referenceSection = output.slice(referenceStart + referenceHeading.length, referenceEnd);
  const outsideReference = output.slice(0, referenceStart) + output.slice(referenceEnd);
  const plannedReferences = referencePlan.assets.map((asset) => asset.reference);
  const actualReferences = collectPlatformReferences(referenceSection);
  const allReferences = collectPlatformReferences(output);

  for (const asset of referencePlan.assets) {
    const sectionCount = actualReferences.filter((reference) => reference === asset.reference).length;
    const outsideCount = collectPlatformReferences(outsideReference)
      .filter((reference) => reference === asset.reference).length;
    if (sectionCount !== 1) {
      errors.push(`${asset.reference} for ${asset.subject} must appear exactly once in 〖参考〗`);
      continue;
    }
    if (outsideCount > 0) errors.push(`${asset.reference} for ${asset.subject} must not appear outside 〖参考〗`);

    const tokenIndex = referenceSection.indexOf(asset.reference);
    const context = referenceSection.slice(
      Math.max(0, tokenIndex - 140),
      Math.min(referenceSection.length, tokenIndex + asset.reference.length + 100),
    );
    const nextReferenceIndex = plannedReferences
      .map((reference) => referenceSection.indexOf(reference, tokenIndex + asset.reference.length))
      .filter((index) => index !== -1)
      .reduce((minimum, index) => Math.min(minimum, index), referenceSection.length);
    const scopedResponsibility = referenceSection.slice(
      tokenIndex + asset.reference.length,
      nextReferenceIndex,
    );
    const associationPattern = new RegExp(
      `${escapeRegExp(asset.subject)}[^。；\\n{<@]{0,100}${escapeRegExp(asset.reference)}`,
    );
    if (!associationPattern.test(referenceSection)) {
      errors.push(`${asset.reference} must be explicitly associated with subject ${asset.subject} in 〖参考〗`);
    }

    const roleCues = {
      scene: /场景|空间|材质|光色|构图/,
      "character-identity": /身份|五官|发型|服装|体型|造型/,
      "character-turnaround": /三视图|身份|五官|发型|服装|体型/,
      state: /状态|伤势|形态|变身/,
      prop: /道具|数量|外观|摆放/,
      audio: /声音|音色|对白|语气/,
      spatial: /空间|轴线|方向|站位|分区/,
      continuity: /连续|尾帧|首帧|站位|光色/,
      keyframe: /关键帧|动作|接触|峰值|姿态/,
    };
    if (!roleCues[asset.role].test(context)) {
      errors.push(`${asset.reference} for ${asset.subject} does not state its ${asset.role} responsibility near the reference`);
    }
    if (new Set(["spatial", "continuity", "keyframe"]).has(asset.role)
      && (!/(只|仅)/.test(context) || !/(锁|参考|约束)/.test(context))) {
      errors.push(`${asset.reference} for ${asset.subject} must be limited with wording such as 只锁/只参考/仅约束`);
    }
    if (asset.role === "character-turnaround"
      && (!/(只|仅)/.test(scopedResponsibility) || !/(锁|参考|约束)/.test(scopedResponsibility))) {
      errors.push(`${asset.reference} for ${asset.subject} turnaround must be limited with wording such as 只锁/只参考/仅约束`);
    }
    if (asset.role === "character-turnaround"
      && !/(忽略|不得|不能|不可|禁止)/.test(scopedResponsibility)) {
      errors.push(`${asset.reference} for ${asset.subject} turnaround must state a boundary against copying the sheet presentation`);
    }
  }

  const unplannedReferences = [...new Set(allReferences.filter((reference) => !plannedReferences.includes(reference)))];
  if (unplannedReferences.length > 0) {
    errors.push(`unplanned platform references found: ${unplannedReferences.join(", ")}`);
  }
  if (actualReferences.length === plannedReferences.length
    && !actualReferences.every((reference, index) => reference === plannedReferences[index])) {
    errors.push("references in 〖参考〗 must follow referencePlan.assets order");
  }

  const hasAuxiliaryReference = referencePlan.assets
    .some((asset) => new Set(["spatial", "continuity", "keyframe"]).has(asset.role));
  if (hasAuxiliaryReference && !/(不得|不能|不可)/.test(referenceSection)) {
    errors.push("〖参考〗 must state a negative boundary for spatial/continuity/keyframe references");
  }
  return errors;
}

function validateVideoShotPrompt(output, variables, referencePlan) {
  const errors = [];
  const expectedHeader = `# ${variables.status}｜${variables.taskId}｜${variables.title} ${variables.version}`;
  const firstNonEmptyLine = output.split(/\r?\n/).find((line) => line.trim() !== "")?.trim();
  if (firstNonEmptyLine !== expectedHeader) {
    errors.push(`first line must be exactly: ${expectedHeader}`);
  }

  const coreHeadings = ["〖风格〗", "〖空间与轴线〗", "〖时间轴〗", "〖声音〗", "〖参考〗"];
  const positions = coreHeadings.map((heading) => output.indexOf(heading));
  coreHeadings.forEach((heading, index) => {
    if (positions[index] === -1) errors.push(`missing required section: ${heading}`);
  });
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index - 1] !== -1 && positions[index] !== -1 && positions[index] <= positions[index - 1]) {
      errors.push(`section order is invalid: ${coreHeadings[index - 1]} must precede ${coreHeadings[index]}`);
    }
  }
  const forbiddenPosition = output.indexOf("〖禁止〗");
  const referencePosition = positions[4];
  if (forbiddenPosition !== -1 && referencePosition !== -1 && forbiddenPosition <= referencePosition) {
    errors.push("〖禁止〗 must appear after 〖参考〗");
  }

  if (positions[0] !== -1 && positions[1] !== -1) {
    const styleSection = output.slice(positions[0], positions[1]);
    const durationPattern = new RegExp(`${escapeRegExp(variables.durationSeconds)}\\s*秒`);
    if (!durationPattern.test(styleSection)) errors.push(`〖风格〗 must contain ${variables.durationSeconds} 秒`);
    if (!styleSection.includes(variables.aspectRatio)) errors.push(`〖风格〗 must contain ${variables.aspectRatio}`);
  }

  if (positions[2] !== -1 && positions[3] !== -1) {
    const timelineSection = output.slice(positions[2] + coreHeadings[2].length, positions[3]);
    const ranges = [...timelineSection.matchAll(/`(\d+(?:\.\d+)?)s?\s*[–—-]\s*(\d+(?:\.\d+)?)s`/g)]
      .map((match) => ({ start: Number(match[1]), end: Number(match[2]) }));
    if (ranges.length === 0) {
      errors.push("〖时间轴〗 must contain backticked ranges such as `0–4s` or `0s–4s`");
    } else {
      if (Math.abs(ranges[0].start) > 0.000_001) errors.push("timeline must start at 0s");
      for (let index = 0; index < ranges.length; index += 1) {
        const range = ranges[index];
        if (range.end <= range.start) errors.push(`timeline range ${index + 1} must end after it starts`);
        if (index > 0 && Math.abs(range.start - ranges[index - 1].end) > 0.000_001) {
          errors.push(`timeline ranges ${index} and ${index + 1} must touch without gaps or overlap`);
        }
      }
      const expectedEnd = Number(variables.durationSeconds);
      if (Math.abs(ranges.at(-1).end - expectedEnd) > 0.000_001) {
        errors.push(`timeline must end at ${variables.durationSeconds}s`);
      }
    }
  }

  const unresolvedAngles = [...output.matchAll(/<([^>\n]+)>/g)]
    .map((match) => match[0])
    .filter((token) => !/^<Subject\s+\d+>$/i.test(token));
  if (unresolvedAngles.length > 0) {
    errors.push(`unresolved template instructions remain: ${[...new Set(unresolvedAngles)].join(", ")}`);
  }
  errors.push(...validateReferencePlanOutput(output, referencePlan));
  return errors;
}

function validateTemplateOutput(output, template, referencePlan) {
  if (!template) return [];
  if (canonicalTemplateId(template.id) === VIDEO_SHOT_TEMPLATE_ID) {
    return validateVideoShotPrompt(output, template.variables, referencePlan);
  }
  fail(`no output validator registered for template: ${template.id}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (options.listTemplates) {
    process.stdout.write(`${JSON.stringify({ templates: listTemplateDefinitions() }, null, 2)}\n`);
    return;
  }

  const { job, baseDir } = await loadJob(options.jobPath);
  const { job: materializedJob, sourceBytes, templateBytes } = await materializeJob(job, baseDir);
  const prompt = buildPrompt(materializedJob);
  if (prompt.length > MAX_PROMPT_CHARACTERS) {
    fail(`materialized prompt exceeds ${MAX_PROMPT_CHARACTERS} characters; split the creative job`);
  }

  if (options.validateOutputPath) {
    const outputPath = path.resolve(options.validateOutputPath);
    const stat = await fs.stat(outputPath);
    if (!stat.isFile()) fail(`validation target is not a file: ${outputPath}`);
    if (stat.size > MAX_PROCESS_OUTPUT_BYTES) {
      fail(`validation target exceeds ${MAX_PROCESS_OUTPUT_BYTES} bytes: ${outputPath}`);
    }
    const existingOutput = await fs.readFile(outputPath, "utf8");
    if (existingOutput.trim() === "") fail(`validation target is empty: ${outputPath}`, 4);
    const validationErrors = validateTemplateOutput(
      existingOutput,
      materializedJob.template,
      materializedJob.referencePlan,
    );
    if (job.output.format === "json") {
      try {
        JSON.parse(existingOutput);
      } catch (error) {
        validationErrors.push(`output is not valid JSON: ${error.message}`);
      }
    }
    if (validationErrors.length > 0) {
      fail(`existing output failed validation: ${validationErrors.join("; ")}`, 4);
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: "validate-output",
      jobId: job.jobId,
      outputPath,
      templateId: materializedJob.template?.id ?? null,
      templateValidation: materializedJob.template ? "passed" : null,
      referencePlanValidation: materializedJob.referencePlan ? "passed" : null,
    }, null, 2)}\n`);
    return;
  }

  if (options.checkOnly) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: "check",
      jobId: job.jobId,
      expectedModel: job.expectedModel,
      sourceBytes,
      templateBytes,
      templateId: materializedJob.template?.id ?? null,
      templateVariables: materializedJob.template?.variables ?? null,
      referencePlan: materializedJob.referencePlan
        ? {
            requiredScenes: materializedJob.referencePlan.requiredScenes,
            requiredCharacters: materializedJob.referencePlan.requiredCharacters,
            assetCount: materializedJob.referencePlan.assets.length,
            turnaroundDispositionCount: materializedJob.referencePlan.turnaroundDispositions?.length ?? null,
            validation: "passed",
          }
        : null,
      promptCharacters: prompt.length,
      goldenSampleStatus: materializedJob.goldenSampleStatus,
    }, null, 2)}\n`);
    return;
  }

  const outputDir = await createOutputDirectory(options.outputDir);
  await writeJson(path.join(outputDir, "job.json"), job);
  if (materializedJob.template) {
    await fs.writeFile(path.join(outputDir, "template-rendered.md"), materializedJob.template.content, "utf8");
  }
  await fs.writeFile(path.join(outputDir, "claude-prompt.txt"), `${prompt}\n`, "utf8");

  let commandResult;
  try {
    commandResult = await runClaude({ prompt, model: job.expectedModel, timeoutMs: options.timeoutMs });
  } catch (error) {
    const failure = {
      schemaVersion: 1,
      status: "transport_error",
      jobId: job.jobId,
      expectedModel: job.expectedModel,
      error: redactSecrets(error.message),
    };
    await writeJson(path.join(outputDir, "run.json"), failure);
    fail(`Claude Code transport failed; evidence saved to ${outputDir}: ${redactSecrets(error.message)}`, 3);
  }

  const sanitizedStderr = redactSecrets(commandResult.stderr);
  if (sanitizedStderr.trim()) await fs.writeFile(path.join(outputDir, "stderr.log"), sanitizedStderr, "utf8");
  if (commandResult.stdout.trim()) await fs.writeFile(path.join(outputDir, "raw-stdout.txt"), commandResult.stdout, "utf8");

  if (commandResult.exceededOutputLimit) {
    await writeJson(path.join(outputDir, "run.json"), {
      schemaVersion: 1,
      status: "output_limit_exceeded",
      jobId: job.jobId,
      expectedModel: job.expectedModel,
    });
    fail(`Claude Code output exceeded ${MAX_PROCESS_OUTPUT_BYTES} bytes; evidence saved to ${outputDir}`, 3);
  }
  if (commandResult.timedOut) {
    await writeJson(path.join(outputDir, "run.json"), {
      schemaVersion: 1,
      status: "timeout",
      jobId: job.jobId,
      expectedModel: job.expectedModel,
      timeoutMs: options.timeoutMs,
    });
    fail(`Claude Code timed out after ${options.timeoutMs} ms; evidence saved to ${outputDir}`, 3);
  }
  if (commandResult.code !== 0) {
    await writeJson(path.join(outputDir, "run.json"), {
      schemaVersion: 1,
      status: "cli_error",
      jobId: job.jobId,
      expectedModel: job.expectedModel,
      exitCode: commandResult.code,
      signal: commandResult.signal,
    });
    fail(`Claude Code exited with code ${commandResult.code}; evidence saved to ${outputDir}`, 3);
  }

  let response;
  try {
    response = parseClaudeResponse(commandResult.stdout);
  } catch (error) {
    await writeJson(path.join(outputDir, "run.json"), {
      schemaVersion: 1,
      status: "response_error",
      jobId: job.jobId,
      expectedModel: job.expectedModel,
      error: error.message,
    });
    fail(`${error.message}; evidence saved to ${outputDir}`, 3);
  }

  await writeJson(path.join(outputDir, "raw-response.json"), response);
  const modelsUsed = Object.keys(response.modelUsage || {});

  const templateErrors = validateTemplateOutput(
    response.result,
    materializedJob.template,
    materializedJob.referencePlan,
  );
  if (templateErrors.length > 0) {
    await fs.writeFile(path.join(outputDir, "creative-output.invalid-template.md"), response.result, "utf8");
    await writeJson(path.join(outputDir, "run.json"), {
      schemaVersion: 1,
      status: "template_validation_failed",
      jobId: job.jobId,
      expectedModel: job.expectedModel,
      modelsUsed,
      templateId: materializedJob.template.id,
      templateErrors,
    });
    fail(`creative result failed template validation; evidence saved to ${outputDir}: ${templateErrors.join("; ")}`, 4);
  }

  if (job.output.format === "json") {
    try {
      JSON.parse(response.result);
    } catch (error) {
      await fs.writeFile(path.join(outputDir, "creative-output.invalid.txt"), response.result, "utf8");
      await writeJson(path.join(outputDir, "run.json"), {
        schemaVersion: 1,
        status: "invalid_creative_json",
        jobId: job.jobId,
        expectedModel: job.expectedModel,
        modelsUsed,
        error: error.message,
      });
      fail(`creative result is not valid JSON; evidence saved to ${outputDir}`, 4);
    }
  }

  const creativeFileName = job.output.format === "json" ? "creative-output.json" : "creative-output.md";
  await fs.writeFile(path.join(outputDir, creativeFileName), response.result, "utf8");

  const runRecord = {
    schemaVersion: 1,
    status: "success",
    jobId: job.jobId,
    expectedModel: job.expectedModel,
    modelsUsed,
    goldenSampleStatus: materializedJob.goldenSampleStatus,
    sourceBytes,
    templateBytes,
    templateId: materializedJob.template?.id ?? null,
    templateValidation: materializedJob.template ? "passed" : null,
    referencePlanValidation: materializedJob.referencePlan ? "passed" : null,
    promptCharacters: prompt.length,
    startedAt: commandResult.startedAt,
    finishedAt: commandResult.finishedAt,
    claudeDurationMs: response.duration_ms ?? null,
    claudeApiDurationMs: response.duration_api_ms ?? null,
    reportedCostUsd: response.total_cost_usd ?? null,
    reportedCostMeaning: "Claude Code nominal estimate; not proof of the final Plan invoice",
    usage: response.usage ?? null,
    files: {
      job: "job.json",
      template: materializedJob.template ? "template-rendered.md" : null,
      prompt: "claude-prompt.txt",
      rawResponse: "raw-response.json",
      creativeOutput: creativeFileName,
      stderr: sanitizedStderr.trim() ? "stderr.log" : null,
    },
  };
  await writeJson(path.join(outputDir, "run.json"), runRecord);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    jobId: job.jobId,
    outputDir,
    creativeOutput: path.join(outputDir, creativeFileName),
    modelsUsed,
    templateId: materializedJob.template?.id ?? null,
    referencePlanValidation: materializedJob.referencePlan ? "passed" : null,
    goldenSampleStatus: materializedJob.goldenSampleStatus,
    reportedCostUsd: runRecord.reportedCostUsd,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`ERROR: ${redactSecrets(error.message)}\n`);
  process.exitCode = error.exitCode || 1;
});
