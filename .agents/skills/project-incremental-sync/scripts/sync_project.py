#!/usr/bin/env python3
"""Non-destructive, one-direction-at-a-time project sync using local rsync."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import stat
import subprocess
import sys
import unicodedata
import uuid
from datetime import datetime


class SyncError(Exception):
    pass


def fingerprint(path):
    st = path.lstat()
    if not stat.S_ISREG(st.st_mode):
        raise SyncError(f"不是普通文件：{path}")
    return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)


def digest(path):
    before = fingerprint(path)
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    if fingerprint(path) != before:
        raise SyncError(f"校验期间文件发生变化：{path}")
    return h.hexdigest()


def scan(root):
    files, directories, skipped = {}, set(), 0
    normalized = {}

    def visit(folder):
        nonlocal skipped
        with os.scandir(folder) as entries:
            for entry in entries:
                path = Path(entry.path)
                rel = path.relative_to(root).as_posix()
                key = unicodedata.normalize("NFC", rel).casefold()
                if key in normalized:
                    raise SyncError(f"大小写或 Unicode 路径碰撞：{normalized[key]} / {rel}")
                normalized[key] = rel
                if entry.is_symlink():
                    raise SyncError(f"拒绝符号链接：{path}")
                if entry.is_dir(follow_symlinks=False):
                    directories.add(rel)
                    visit(path)
                elif entry.is_file(follow_symlinks=False):
                    if entry.name == ".DS_Store":
                        skipped += 1
                        continue
                    if entry.name.startswith("._"):
                        with path.open("rb") as stream:
                            if stream.read(4) == b"\x00\x05\x16\x07":
                                skipped += 1
                                continue
                    files[rel] = {"size": entry.stat().st_size, "fp": fingerprint(path)}
                else:
                    raise SyncError(f"拒绝特殊文件：{path}")

    visit(root)
    return files, directories, skipped


def make_plan(source, target, checksum=False, source_wins=False):
    sf, sd, ss = scan(source)
    tf, td, ts = scan(target)
    # macOS volumes may normalize Unicode or compare names case-insensitively.
    src_names = {unicodedata.normalize("NFC", p).casefold(): p for p in sf.keys() | sd}
    dst_names = {unicodedata.normalize("NFC", p).casefold(): p for p in tf.keys() | td}
    for key in src_names.keys() & dst_names.keys():
        a, b = src_names[key], dst_names[key]
        if a != b:
            raise SyncError(f"源目标路径拼写不一致，需先核实：{a} / {b}")
    conflicts = (sf.keys() & td) | (tf.keys() & sd)
    if conflicts:
        raise SyncError("文件/目录类型冲突：" + ", ".join(sorted(conflicts)))
    changes, blocked, equal_content = [], [], 0
    all_hashes = {}
    for rel in sorted(sf):
        s = sf[rel]
        if rel not in tf:
            changes.append({"path": rel, "action": "ADD", "bytes": s["size"]})
            continue
        t = tf[rel]
        same_metadata = s["size"] == t["size"] and s["fp"][3] // 10**9 == t["fp"][3] // 10**9
        if same_metadata and not checksum:
            continue
        source_hash, target_hash = digest(source / rel), digest(target / rel)
        if checksum:
            all_hashes[rel] = source_hash
        if source_hash == target_hash:
            equal_content += 1
            continue
        item = {"path": rel, "action": "REPLACE", "bytes": s["size"],
                "sha256": source_hash, "previousSha256": target_hash}
        if s["fp"][3] // 10**9 <= t["fp"][3] // 10**9 and not source_wins:
            item["conflict"] = "目标较新或同秒内容不同；需要明确源版本为准"
            blocked.append(item)
        changes.append(item)
    plan = {
        "direction": f"{source} -> {target}", "source": str(source), "target": str(target),
        "sourceFiles": len(sf), "sourceBytes": sum(f["size"] for f in sf.values()),
        "newFiles": sum(c["action"] == "ADD" for c in changes),
        "newDirectories": sorted(sd - td),
        "replacedFiles": sum(c["action"] == "REPLACE" for c in changes),
        "copyBytes": sum(c["bytes"] for c in changes),
        "targetOnlyPreserved": len(tf.keys() - sf.keys()),
        "metadataDifferentButContentEqual": equal_content,
        "skippedSystemFiles": {"source": ss, "target": ts},
        "comparison": "full-sha256" if checksum else "size-and-mtime; sha256-for-metadata-differences",
        "conflicts": blocked, "files": changes,
    }
    return plan, sf, tf, all_hashes, sd


def assert_unchanged(root, snapshot, paths):
    for rel in paths:
        if fingerprint(root / rel) != snapshot[rel]["fp"]:
            raise SyncError(f"计划后文件发生变化，停止同步：{root / rel}")


def sync_project(source, target, *, apply=False, checksum=False, source_wins=False):
    source, target = Path(source), Path(target)
    plan, sf, tf, all_hashes, source_directories = make_plan(source, target, checksum, source_wins)
    if not apply:
        plan["status"] = "PREVIEW"
        return plan
    if plan["conflicts"]:
        raise SyncError("存在同名冲突，未执行任何写入：" + json.dumps(plan["conflicts"], ensure_ascii=False))
    if not plan["files"] and not plan["newDirectories"]:
        plan["status"] = "NO_CHANGES"
        return plan
    rsync = shutil.which("rsync")
    if not rsync:
        raise SyncError("找不到 rsync；尚未写入任何项目文件")
    new_dirs = {str(parent) for c in plan["files"] for parent in Path(c["path"]).parents if str(parent) != "."}
    # exFAT's allocation units can make many small files cost more than their bytes.
    unit = os.statvfs(target).f_frsize
    allocated = sum(((c["bytes"] + unit - 1) // unit) * unit for c in plan["files"])
    backup_bytes = sum(((tf[c["path"]]["size"] + unit - 1) // unit) * unit
                       for c in plan["files"] if c["action"] == "REPLACE")
    if shutil.disk_usage(target).free < allocated + backup_bytes + unit * (2 * len(new_dirs) + len(plan["newDirectories"]) + 16):
        raise SyncError("目标剩余空间不足，尚未写入")
    for item in plan["files"]:
        item["sha256"] = digest(source / item["path"])
    assert_unchanged(source, sf, sf)
    assert_unchanged(target, tf, tf)
    run_id = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:8]
    record = target / "生产记录/增量同步/全项目" / run_id
    record.mkdir(parents=True, exist_ok=False)
    manifest = record / "SYNC-MANIFEST-v01.json"
    plan.update({"materialType": "record.production", "subject": {"projectId": source.name},
                 "version": "v01", "storyBinding": False, "targetDir": record.relative_to(target).as_posix(),
                 "status": "STARTED"})

    def save():
        manifest.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    save()
    try:
        for item in plan["files"]:
            rel = item["path"]
            if item["action"] == "REPLACE":
                assert_unchanged(target, tf, [rel])
                backup = record / "backup-v01" / rel
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target / rel, backup)
                if digest(backup) != item["previousSha256"]:
                    raise SyncError(f"备份校验失败：{rel}")
                item["backup"] = backup.relative_to(target).as_posix()
            elif (target / rel).exists():
                raise SyncError(f"目标新增了同名文件，停止而不覆盖：{rel}")
        plan["status"] = "BACKUPS_VERIFIED"
        save()
        changed_paths = {c["path"] for c in plan["files"]}
        assert_unchanged(source, sf, sf)
        assert_unchanged(target, tf, tf)
        if changed_paths or plan["newDirectories"]:
            file_list = record / "FILES-TO-COPY-v01.nul"
            paths = sorted(changed_paths | set(plan["newDirectories"]))
            file_list.write_bytes(b"".join(os.fsencode(p) + b"\0" for p in paths))
            # Explicit file list + nonrecursive directories also preserves empty folders,
            # without accidentally including system sidecars or unplanned children.
            result = subprocess.run([rsync, "-dt", "--ignore-times", "--stats", "--from0", "--files-from=" + str(file_list),
                                     str(source) + "/", str(target) + "/"], capture_output=True)
            (record / "RSYNC-STDOUT-v01.log").write_bytes(result.stdout)
            (record / "RSYNC-STDERR-v01.log").write_bytes(result.stderr)
            plan["rsyncExitCode"] = result.returncode
            if result.returncode:
                raise SyncError(f"rsync 失败（{result.returncode}），请查看 {record}")
        assert_unchanged(source, sf, sf)
        latest_source, latest_directories, _ = scan(source)
        if latest_source.keys() != sf.keys() or latest_directories != source_directories:
            raise SyncError("同步期间源目录新增或删除了文件/目录，请重新预览")
        verified = 0
        for item in plan["files"]:
            rel = item["path"]
            if digest(source / rel) != item["sha256"] or digest(target / rel) != item["sha256"]:
                raise SyncError(f"复制后 SHA-256 不符：{rel}")
            verified += 1
        assert_unchanged(target, tf, tf.keys() - changed_paths)
        post, _, _ = scan(target)
        if sf.keys() - post.keys():
            raise SyncError("复制后目标缺少源文件")
        if sum(post[p]["size"] for p in sf) != plan["sourceBytes"]:
            raise SyncError("复制后源路径总字节数不符")
        if checksum:
            for rel in sf.keys() - changed_paths:
                if digest(source / rel) != all_hashes[rel] or digest(target / rel) != all_hashes[rel]:
                    raise SyncError(f"全量内容复核不符：{rel}")
        remaining, _, _, _, _ = make_plan(source, target, checksum=False, source_wins=source_wins)
        if remaining["files"] or remaining["newDirectories"]:
            raise SyncError("复核仍有未同步差异")
        plan.update({"status": "SYNC_COMPLETE", "verification": {
            "copiedSha256Checked": verified, "backupSha256Checked": plan["replacedFiles"],
            "sourcePathsPresent": len(sf), "sourcePathBytesInTarget": plan["sourceBytes"],
            "nonCopiedTargetFilesUnchanged": len(tf.keys() - changed_paths),
            "remainingTransfers": 0, "fullContentVerified": checksum,
        }})
        save()
        return plan
    except Exception as exc:
        plan.update({"status": "FAILED", "error": str(exc)})
        save()
        raise


def workspace_root(repo):
    value = "workspace"
    env = repo / ".env.local"
    if env.is_file():
        for line in env.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^\s*(?:export\s+)?MATERIAL_CENTER_WORKSPACE\s*=\s*(.*)$", line)
            if match:
                tokens = shlex.split(match.group(1), comments=True)
                if len(tokens) != 1 or "$" in tokens[0] or not tokens[0]:
                    raise SyncError("无法确定 MATERIAL_CENTER_WORKSPACE，请核实 .env.local 的实际路径")
                value = tokens[0]
    root = Path(value)
    return root if root.is_absolute() else repo / root


def reject_symlink_ancestors(path):
    for part in [path, *path.parents]:
        if part.is_symlink():
            raise SyncError(f"路径包含符号链接：{part}")


def resolve_projects(repo, project_id, direction, drive_root):
    if not re.fullmatch(r"[a-z0-9-]{1,64}", project_id):
        raise SyncError("项目 ID 只能包含小写字母、数字、连字符，且不超过 64 位")
    local = workspace_root(repo) / project_id
    drive = Path(drive_root).absolute()
    reject_symlink_ancestors(drive)
    if not drive.is_mount():
        raise SyncError(f"移动硬盘未挂载在指定位置：{drive}")
    remote = drive / project_id
    for root in (local, remote):
        reject_symlink_ancestors(root)
        if not root.is_dir() or not (root / "library").is_dir():
            raise SyncError(f"目标项目必须已存在并包含 library，不自动新建项目：{root}")
        try:
            project = json.loads((root / "project.json").read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise SyncError(f"无法读取项目配置：{root}: {exc}") from exc
        if project.get("schemaVersion") != 1 or not isinstance(project.get("name"), str):
            raise SyncError(f"项目配置无效：{root}")
    local, remote = local.resolve(), remote.resolve()
    if local == remote or local in remote.parents or remote in local.parents:
        raise SyncError("源目标不能相同或相互嵌套")
    return (remote, local) if direction == "pull" else (local, remote)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--direction", choices=["pull", "push"], required=True)
    parser.add_argument("--drive-root", default="/Volumes/PortableSSD")
    parser.add_argument("--apply", action="store_true", help="执行复制；默认只读预览")
    parser.add_argument("--checksum", action="store_true", help="全量内容校验，读取全部同名文件")
    parser.add_argument("--source-wins", action="store_true", help="明确源版本为准，允许备份后替换较新/同秒目标")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[4]
    try:
        git_status = subprocess.check_output(["git", "status", "--short", "--branch"], cwd=repo, text=True)
        source, target = resolve_projects(repo, args.project_id, args.direction, args.drive_root)
        if args.apply:
            local = workspace_root(repo) / args.project_id
            if repo.resolve() in local.resolve().parents:
                subprocess.run(["git", "check-ignore", "--quiet", str(local / "生产记录/增量同步/全项目/probe/SYNC-MANIFEST-v01.json")],
                               cwd=repo, check=True)
        result = sync_project(source, target, apply=args.apply, checksum=args.checksum, source_wins=args.source_wins)
        result["gitStatusBefore"] = git_status.strip()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, SyncError, subprocess.SubprocessError) as exc:
        print(json.dumps({"status": "ERROR", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
