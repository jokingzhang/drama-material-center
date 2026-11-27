#!/usr/bin/env python3
"""Safe bidirectional incremental sync between local ops-workspace and an external drive."""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import sys
from pathlib import Path

IGNORED_NAMES = {".DS_Store", ".gitkeep", "Thumbs.db"}


def resolve_local_ops_dir(repo_root: Path) -> Path:
    env_file = repo_root / ".env.local"
    configured = None
    if env_file.is_file():
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() == "MATERIAL_CENTER_OPS_DIR":
                configured = value.strip().strip('"').strip("'")
                break
    return (repo_root / (configured or "ops-workspace")).resolve()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_files(root: Path) -> dict[Path, Path]:
    files: dict[Path, Path] = {}
    if not root.exists():
        return files
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        current = Path(dirpath)
        for name in filenames:
            if name in IGNORED_NAMES or name.startswith("."):
                continue
            full = current / name
            if full.is_symlink() or not full.is_file():
                continue
            files[full.relative_to(root)] = full
    return files


def main() -> int:
    parser = argparse.ArgumentParser(description="Incrementally sync private ops-workspace with PortableSSD.")
    parser.add_argument("--direction", choices=["push", "pull"], required=True, help="push: local->drive, pull: drive->local")
    parser.add_argument("--drive-root", default="/Volumes/PortableSSD/ops-workspace", help="Target directory on external drive")
    parser.add_argument("--apply", action="store_true", help="Actually copy files (default is dry-run preview)")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[4]
    local_dir = resolve_local_ops_dir(repo_root)
    drive_dir = Path(args.drive_root).expanduser().resolve()

    if args.direction == "push":
        src_dir, dst_dir = local_dir, drive_dir
    else:
        src_dir, dst_dir = drive_dir, local_dir

    if not src_dir.is_dir():
        print(f"ERROR: 源目录不存在：{src_dir}", file=sys.stderr)
        return 1

    if args.direction == "push" and not drive_dir.parent.exists():
        print(f"ERROR: 移动硬盘挂载点不存在：{drive_dir.parent}", file=sys.stderr)
        return 1

    src_files = collect_files(src_dir)
    dst_files = collect_files(dst_dir)

    to_add: list[Path] = []
    to_update: list[Path] = []
    same_count = 0

    for rel, src_path in sorted(src_files.items()):
        dst_path = dst_files.get(rel)
        if dst_path is None:
            to_add.append(rel)
        elif sha256_file(src_path) != sha256_file(dst_path):
            to_update.append(rel)
        else:
            same_count += 1

    dst_only = sorted(rel for rel in dst_files if rel not in src_files)

    print(f"方向: {args.direction} ({src_dir} -> {dst_dir})")
    print(f"一致: {same_count} | 新增: {len(to_add)} | 变更: {len(to_update)} | 目标端独有(保留不删): {len(dst_only)}")
    for rel in to_add:
        print(f"  + {rel}")
    for rel in to_update:
        print(f"  ~ {rel}")

    if not to_add and not to_update:
        print("NO_CHANGES: 两侧内容一致，无需复制。")
        return 0

    if not args.apply:
        print("DRY_RUN: 仅预览，未写入文件。确认后加 --apply 执行。")
        return 0

    dst_dir.mkdir(parents=True, exist_ok=True)
    for rel in to_add + to_update:
        src_path = src_files[rel]
        dst_path = dst_dir / rel
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_path, dst_path)
        if sha256_file(src_path) != sha256_file(dst_path):
            print(f"ERROR: SHA-256 校验失败：{rel}", file=sys.stderr)
            return 1

    print(f"DONE: 已安全同步 {len(to_add) + len(to_update)} 个文件并通过 SHA-256 校验。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
