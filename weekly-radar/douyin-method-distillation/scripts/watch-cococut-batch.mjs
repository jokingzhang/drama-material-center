#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('Usage: node watch-cococut-batch.mjs <video-id>...');
  process.exit(2);
}

const readClipboard = () => execFileSync('pbpaste', { encoding: 'utf8' }).trim();
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const isDouyinMediaUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)douyinvod\.com$/.test(url.hostname);
  } catch {
    return false;
  }
};
let previous = readClipboard();

for (const videoId of ids) {
  const inbox = resolve(root, 'weekly-radar/.local/douyin-method-distillation/inbox', videoId);
  let capturesNeeded = ['video', 'audio'].filter((kind) => !existsSync(resolve(inbox, `${kind}.mp4`))).length;
  while (capturesNeeded > 0) {

    let current = previous;
    while (!current || current === previous || !isDouyinMediaUrl(current)) {
      await sleep(250);
      current = readClipboard();
    }
    previous = current;

    const result = spawnSync(
      process.execPath,
      [resolve(root, 'weekly-radar/douyin-method-distillation/scripts/save-cococut-url.mjs'), '--video-id', videoId, '--kind', 'auto'],
      { cwd: root, encoding: 'utf8' },
    );
    if (result.status !== 0) {
      process.stderr.write(result.stderr || result.stdout);
      process.exit(result.status ?? 1);
    }
    process.stdout.write(result.stdout);
    capturesNeeded -= 1;
  }
}
