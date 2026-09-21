#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, token, index, all) => {
    if (token.startsWith("--") && all[index + 1] && !all[index + 1].startsWith("--")) {
      pairs.push([token.slice(2), all[index + 1]]);
    }
    return pairs;
  }, []),
);

if (!/^\d{10,24}$/.test(args["video-id"] ?? "")) {
  throw new Error("--video-id is required");
}
if (!new Set(["video", "audio", "auto"]).has(args.kind)) {
  throw new Error("--kind must be video, audio, or auto");
}

const clipboard = spawnSync("pbpaste", { encoding: "utf8" }).stdout.trim();
const url = new URL(clipboard);
if (url.protocol !== "https:" || !/(^|\.)douyinvod\.com$/.test(url.hostname)) {
  throw new Error("Clipboard does not contain a validated Douyin media URL");
}

const queue = JSON.parse(
  readFileSync("weekly-radar/douyin-method-distillation/queue.json", "utf8"),
);
const item = queue.videos.find((candidate) => candidate.videoId === args["video-id"]);
if (!item) throw new Error(`videoId is not in queue: ${args["video-id"]}`);

const inbox = path.resolve(
  "weekly-radar/.local/douyin-method-distillation/inbox",
  args["video-id"],
);
mkdirSync(inbox, { recursive: true });
const requestedKind = args.kind;
const partial = path.join(inbox, `capture-${Date.now()}.partial`);

const response = await fetch(url, {
  headers: {
    Referer: `https://www.douyin.com/video/${args["video-id"]}`,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  },
});
if (!response.ok || !response.body) {
  throw new Error(`Download failed with HTTP ${response.status}`);
}
await pipeline(response.body, createWriteStream(partial, { flags: "wx" }));

const probe = spawnSync(
  "ffprobe",
  ["-v", "error", "-show_entries", "stream=codec_type", "-of", "json", partial],
  { encoding: "utf8" },
);
if (probe.status !== 0) throw new Error(probe.stderr || "ffprobe failed");
const streamTypes = JSON.parse(probe.stdout).streams.map((stream) => stream.codec_type);
const detectedKind = streamTypes.includes("video") ? "video" : streamTypes.includes("audio") ? "audio" : null;
if (!detectedKind) throw new Error("Captured resource contains neither video nor audio");
if (requestedKind !== "auto" && detectedKind !== requestedKind) {
  throw new Error(`Captured resource is ${detectedKind}, not ${requestedKind}`);
}
const destination = path.join(inbox, `${detectedKind}.mp4`);
if (existsSync(destination)) throw new Error(`Refusing to overwrite ${destination}`);
renameSync(partial, destination);

const hash = createHash("sha256");
hash.update(readFileSync(destination));
process.stdout.write(
  `${JSON.stringify({ videoId: item.videoId, kind: detectedKind, destination, streamTypes, sha256: hash.digest("hex") })}\n`,
);
