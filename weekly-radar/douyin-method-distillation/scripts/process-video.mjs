#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  constants as fsConstants,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const DEFAULT_QUEUE = "weekly-radar/douyin-method-distillation/queue.json";
export const DEFAULT_OUTPUT_ROOT = "weekly-radar/.local/douyin-method-distillation";
export const DEFAULT_WHISPER_MODEL = "mlx-community/whisper-small-mlx";

const FLAG_OPTIONS = new Set(["dry-run", "skip-transcribe", "no-queue-update"]);
const VALUE_OPTIONS = new Set([
  "video-id",
  "video",
  "audio",
  "queue",
  "out-root",
  "author-slug",
  "version",
  "whisper-model",
]);

export function parseArgs(argv) {
  const values = {};
  const flags = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }

    const name = token.slice(2);
    if (FLAG_OPTIONS.has(name)) {
      flags.add(name);
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) {
      throw new Error(`Unknown option: --${name}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    values[name] = value;
    index += 1;
  }

  const videoId = values["video-id"];
  if (!videoId || !/^\d{10,24}$/.test(videoId)) {
    throw new Error("--video-id must be a 10-24 digit Douyin video id");
  }
  if (!values.video) {
    throw new Error("--video is required");
  }

  const version = values.version ?? "v01";
  if (!/^v\d{2}$/.test(version)) {
    throw new Error("--version must use vNN, for example v01");
  }

  return {
    videoId,
    video: values.video,
    audio: values.audio,
    queue: values.queue ?? DEFAULT_QUEUE,
    outputRoot: values["out-root"] ?? DEFAULT_OUTPUT_ROOT,
    authorSlug: values["author-slug"],
    version,
    whisperModel: values["whisper-model"] ?? DEFAULT_WHISPER_MODEL,
    dryRun: flags.has("dry-run"),
    skipTranscribe: flags.has("skip-transcribe"),
    updateQueue: !flags.has("no-queue-update"),
  };
}

export function validateQueue(queue) {
  if (!queue || queue.schemaVersion !== 1 || !Array.isArray(queue.videos)) {
    throw new Error("queue.json must use schemaVersion 1 and contain a videos array");
  }

  const seen = new Set();
  for (const item of queue.videos) {
    if (!item || !/^\d{10,24}$/.test(item.videoId ?? "")) {
      throw new Error("Every queue item must have a numeric videoId");
    }
    if (seen.has(item.videoId)) {
      throw new Error(`Duplicate videoId in queue: ${item.videoId}`);
    }
    seen.add(item.videoId);
  }
  return queue;
}

export function chooseMediaPlan(videoProbe, audioProbe) {
  const videoStreams = videoProbe.streams?.filter((stream) => stream.codec_type === "video") ?? [];
  const embeddedAudio = videoProbe.streams?.filter((stream) => stream.codec_type === "audio") ?? [];
  const separateAudio = audioProbe?.streams?.filter((stream) => stream.codec_type === "audio") ?? [];

  if (videoStreams.length === 0) {
    throw new Error("--video does not contain a video stream");
  }
  if (embeddedAudio.length > 0) {
    return "single-file";
  }
  if (separateAudio.length > 0) {
    return "merge-separate-audio";
  }
  throw new Error("No audio stream found; provide the matching --audio file");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} failed${details ? `:\n${details}` : ""}`);
  }
  return result.stdout ?? "";
}

function probe(file) {
  const output = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=index,codec_name,codec_type,sample_rate,channels,width,height,r_frame_rate:format=duration,size",
    "-of",
    "json",
    file,
  ]);
  return JSON.parse(output);
}

async function sha256(file) {
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function copyExclusive(source, destination) {
  copyFileSync(source, destination, fsConstants.COPYFILE_EXCL);
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function repoRelative(absolutePath) {
  return path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
}

function updateQueueFile(queuePath, queue, item, stage, outputDir) {
  item.status = {
    stage,
    note:
      stage === "transcribed"
        ? "媒体已校验并生成本地 Whisper 转写，待人工证据校正和方法蒸馏。"
        : "媒体已校验，转写尚未执行。",
  };
  item.outputDir = outputDir;
  queue.updatedAt = new Date().toISOString();

  const temporary = `${queuePath}.tmp-${process.pid}`;
  writeJson(temporary, queue);
  renameSync(temporary, queuePath);
}

function methodNotesTemplate(item) {
  return `# 方法蒸馏：${item.title}\n\n## 结论\n\n待人工补充。\n\n## 作者实际演示\n\n- 待补充时间范围和步骤。\n\n## 可迁移的提示词方法\n\n- 待补充；归纳内容必须标明不是作者逐字原句。\n\n## 限制与反例\n\n- 待补充工具版本、推广内容、证据不足和转写异常。\n\n## 证据文件\n\n- \`media.mp4\`\n- \`transcript/media.json\`\n- \`evidence-frames/\`\n`;
}

export async function processVideo(options) {
  const queuePath = path.resolve(options.queue);
  const queue = validateQueue(JSON.parse(readFileSync(queuePath, "utf8")));
  const item = queue.videos.find((candidate) => candidate.videoId === options.videoId);
  if (!item) {
    throw new Error(`videoId ${options.videoId} is not present in ${options.queue}`);
  }

  const videoSource = path.resolve(options.video);
  const audioSource = options.audio ? path.resolve(options.audio) : undefined;
  if (!existsSync(videoSource)) throw new Error(`Video source not found: ${videoSource}`);
  if (audioSource && !existsSync(audioSource)) throw new Error(`Audio source not found: ${audioSource}`);

  const authorSlug = options.authorSlug ?? queue.scope?.author?.slug;
  if (!authorSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(authorSlug)) {
    throw new Error("Author slug must be lowercase kebab-case");
  }

  const outputRoot = path.resolve(options.outputRoot);
  const finalDir = path.join(outputRoot, authorSlug, options.videoId, options.version);
  const videoProbe = probe(videoSource);
  const audioProbe = audioSource ? probe(audioSource) : undefined;
  const plan = chooseMediaPlan(videoProbe, audioProbe);

  const preview = {
    videoId: options.videoId,
    title: item.title,
    plan,
    finalDir,
    transcribe: !options.skipTranscribe,
    updateQueue: options.updateQueue,
  };
  if (options.dryRun) return preview;
  if (existsSync(finalDir)) {
    throw new Error(`Output version already exists; choose a new --version: ${finalDir}`);
  }

  const stagingDir = `${finalDir}.partial-${process.pid}`;
  mkdirSync(stagingDir, { recursive: true });
  const videoCopy = path.join(stagingDir, `video-source${path.extname(videoSource) || ".mp4"}`);
  copyExclusive(videoSource, videoCopy);

  let audioCopy;
  if (audioSource) {
    audioCopy = path.join(stagingDir, `audio-source${path.extname(audioSource) || ".mp4"}`);
    copyExclusive(audioSource, audioCopy);
  }

  const media = path.join(stagingDir, "media.mp4");
  if (plan === "single-file") {
    run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      videoCopy,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-c",
      "copy",
      media,
    ]);
  } else {
    run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      videoCopy,
      "-i",
      audioCopy,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c",
      "copy",
      "-shortest",
      media,
    ]);
  }

  run("ffmpeg", ["-hide_banner", "-v", "error", "-i", media, "-f", "null", "-"]);
  const mediaProbe = probe(media);
  writeJson(path.join(stagingDir, "probe.json"), mediaProbe);

  const evidenceDir = path.join(stagingDir, "evidence-frames");
  mkdirSync(evidenceDir, { recursive: true });
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    media,
    "-vf",
    "fps=1/20,scale=384:-1,tile=4x4:padding=4:margin=4",
    "-frames:v",
    "1",
    path.join(evidenceDir, "contact-sheet-20s.jpg"),
  ]);

  let stage = "media_ready";
  if (!options.skipTranscribe) {
    const transcriptDir = path.join(stagingDir, "transcript");
    mkdirSync(transcriptDir, { recursive: true });
    run(
      "uvx",
      [
        "--from",
        "mlx-whisper",
        "mlx_whisper",
        media,
        "--model",
        options.whisperModel,
        "--language",
        "zh",
        "--task",
        "transcribe",
        "--output-dir",
        transcriptDir,
        "--output-format",
        "all",
      ],
      { inherit: true },
    );
    stage = "transcribed";
  }

  const hashes = {
    [path.basename(videoCopy)]: await sha256(videoCopy),
    ...(audioCopy ? { [path.basename(audioCopy)]: await sha256(audioCopy) } : {}),
    "media.mp4": await sha256(media),
  };
  writeJson(path.join(stagingDir, "metadata.json"), {
    schemaVersion: 1,
    videoId: item.videoId,
    author: queue.scope?.author?.name,
    authorSlug,
    title: item.title,
    sourceUrl: item.url,
    generatedAt: new Date().toISOString(),
    mediaPlan: plan,
    fullDecodePassed: true,
    whisperModel: options.skipTranscribe ? null : options.whisperModel,
    sha256: hashes,
  });
  writeFileSync(path.join(stagingDir, "method-notes.md"), methodNotesTemplate(item), {
    encoding: "utf8",
    flag: "wx",
  });

  mkdirSync(path.dirname(finalDir), { recursive: true });
  renameSync(stagingDir, finalDir);
  const outputDir = repoRelative(finalDir);
  if (options.updateQueue) {
    updateQueueFile(queuePath, queue, item, stage, outputDir);
  }

  return { ...preview, stage, outputDir };
}

function usage() {
  return `Usage:
  node process-video.mjs --video-id <id> --video <path> [--audio <path>]

Options:
  --queue <path>          Queue JSON (default: ${DEFAULT_QUEUE})
  --out-root <path>       Local ignored output root
  --author-slug <slug>    Defaults to queue.scope.author.slug
  --version <vNN>         Output version (default: v01)
  --whisper-model <name>  mlx-whisper model
  --skip-transcribe       Stop after media validation
  --no-queue-update       Do not mutate queue.json
  --dry-run               Probe inputs and print the plan without writing
`;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await processVideo(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

