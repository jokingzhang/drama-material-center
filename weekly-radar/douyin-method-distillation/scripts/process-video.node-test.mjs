import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chooseMediaPlan, parseArgs, validateQueue } from "./process-video.mjs";

test("queue snapshot contains 29 unique liked videos", () => {
  const queue = validateQueue(
    JSON.parse(readFileSync("weekly-radar/douyin-method-distillation/queue.json", "utf8")),
  );
  assert.equal(queue.videos.length, 29);
  assert.equal(new Set(queue.videos.map((item) => item.videoId)).size, 29);
  assert.equal(queue.scope.observedMatchCount, 29);
});

test("parseArgs applies safe defaults", () => {
  const result = parseArgs(["--video-id", "7664884994812432869", "--video", "/tmp/video.mp4"]);
  assert.equal(result.version, "v01");
  assert.equal(result.queue, "weekly-radar/douyin-method-distillation/queue.json");
  assert.equal(result.updateQueue, true);
});

test("parseArgs rejects an invalid version", () => {
  assert.throws(
    () =>
      parseArgs([
        "--video-id",
        "7664884994812432869",
        "--video",
        "/tmp/video.mp4",
        "--version",
        "final",
      ]),
    /vNN/,
  );
});

test("chooseMediaPlan accepts embedded audio", () => {
  assert.equal(
    chooseMediaPlan({ streams: [{ codec_type: "video" }, { codec_type: "audio" }] }),
    "single-file",
  );
});

test("chooseMediaPlan requires a matching audio stream", () => {
  assert.equal(
    chooseMediaPlan(
      { streams: [{ codec_type: "video" }] },
      { streams: [{ codec_type: "audio" }] },
    ),
    "merge-separate-audio",
  );
  assert.throws(
    () => chooseMediaPlan({ streams: [{ codec_type: "video" }] }, { streams: [] }),
    /No audio stream/,
  );
});
