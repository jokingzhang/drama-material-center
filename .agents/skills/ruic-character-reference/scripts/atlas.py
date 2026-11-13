#!/usr/bin/env python3
"""Offline portrait lookup and non-destructive, project-local reference import."""

import argparse
import binascii
from collections import Counter
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import stat
import struct
import subprocess
import sys
import urllib.request
import uuid


REPO = Path(__file__).resolve().parents[4]
ORIGIN = "https://ai-portrait-gallery.pages.dev"
GALLERY = "https://hruiccc.github.io/RuiC-PoseAtlas/face.html?lang=zh#portrait="
MAX_IMAGE_BYTES = 64 * 1024 * 1024


class AtlasError(Exception):
    pass


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def no_symlinks(path):
    path = Path(os.path.abspath(path))
    for part in (path, *path.parents):
        if part.is_symlink():
            raise AtlasError(f"拒绝符号链接：{part}")
    return path


def inside(root, relative):
    rel = PurePosixPath(relative)
    if not relative or rel.is_absolute() or ".." in rel.parts or "\\" in relative:
        raise AtlasError(f"不是安全相对路径：{relative}")
    target = no_symlinks(root.joinpath(*rel.parts))
    if root not in target.parents:
        raise AtlasError(f"路径越界：{relative}")
    return target


def regular_bytes(path):
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode):
        raise AtlasError(f"不是普通文件：{path}")
    data = path.read_bytes()
    after = path.lstat()
    fields = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
    if any(getattr(before, field) != getattr(after, field) for field in fields):
        raise AtlasError(f"读取期间文件变化：{path}")
    return data


def git_commit(root):
    result = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"],
                            capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


class Catalog:
    def __init__(self, root):
        self.root = no_symlinks(root)
        raw = regular_bytes(inside(self.root, "data/faces.json"))
        self.hash = sha256(raw)
        self.data = json.loads(raw)
        if self.data.get("schema") != 1:
            raise AtlasError("不支持的人像数据 schema；需要核对上游字段")
        self.sections = {s["key"]: s["names"] for s in self.data["sections"]}
        self.hairs = {h["key"]: h["names"] for h in self.data["hairs"]}
        self.images = self.data["images"]
        self.by_id = {}
        for item in self.images:
            item_id = item["id"]
            if not isinstance(item_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]+", item_id):
                raise AtlasError("非法人像 ID")
            if item_id in self.by_id:
                raise AtlasError(f"重复人像 ID：{item_id}")
            if item["sec"] not in self.sections or item["hair"] not in self.hairs:
                raise AtlasError(f"未知分区或发型：{item_id}")
            for key, expected in (("thumb", f"portrait/thumbs/{item_id}.webp"),
                                  ("full", f"portrait/img/{item_id}.png")):
                if item[key] != expected:
                    raise AtlasError(f"图片路径与 ID 不符：{item_id} / {key}")
                inside(self.root, item[key])
            if item["full_remote"] != f"{ORIGIN}/img/full/{item_id}.png":
                raise AtlasError(f"原图地址与已知原站不符：{item_id}")
            for key in ("w", "h", "bytes"):
                if type(item[key]) is not int or item[key] <= 0:
                    raise AtlasError(f"缺少有效尺寸／字节数：{item_id}")
            if item["bytes"] > MAX_IMAGE_BYTES:
                raise AtlasError(f"原图超过单文件读取上限：{item_id}")
            self.by_id[item_id] = item

    def get(self, item_id):
        if item_id not in self.by_id:
            raise AtlasError(f"人像 ID 不存在：{item_id}")
        return self.by_id[item_id]

    def summary(self, item):
        return {
            "id": item["id"], "section": item["sec"], "hair": item["hair"],
            "style": item["style"], "width": item["w"], "height": item["h"],
            "bytes": item["bytes"],
            "thumbnailPath": str(inside(self.root, item["thumb"])),
            "fullPath": str(inside(self.root, item["full"])),
            "thumbnailExists": inside(self.root, item["thumb"]).is_file(),
            "fullExists": inside(self.root, item["full"]).is_file(),
            "originalUrl": item["full_remote"], "galleryUrl": GALLERY + item["id"],
        }

    def search(self, section=None, hair=None, query="", limit=12, offset=0):
        matches = []
        terms = query.casefold().split()
        for item in self.images:
            if section and item["sec"] != section:
                continue
            if hair and item["hair"] != hair:
                continue
            words = [item["id"], item["sec"], item["hair"], item["style"],
                     *self.sections[item["sec"]].values(), *self.hairs[item["hair"]].values()]
            searchable = " ".join(words).casefold()
            if all(term in searchable for term in terms):
                matches.append(item)
        return {"totalMatches": len(matches), "offset": offset, "limit": limit,
                "items": [self.summary(i) for i in matches[offset:offset + limit]]}

    def doctor(self):
        thumbs = sum(inside(self.root, i["thumb"]).is_file() for i in self.images)
        full = sum(inside(self.root, i["full"]).is_file() for i in self.images)
        counts = dict(Counter(i["sec"] for i in self.images))
        declared = self.data.get("totals", {})
        if declared.get("images") != len(self.images) or any(declared.get(k) != v for k, v in counts.items()):
            raise AtlasError("声明数量与实际人像条目不一致")
        return {"status": "OK", "atlasRoot": str(self.root), "atlasCommit": git_commit(self.root),
                "catalogSha256": self.hash, "images": len(self.images), "sections": counts,
                "localThumbnails": thumbs, "localOriginals": full,
                "missingOriginals": len(self.images) - full,
                "scope": "metadata-and-file-presence; no image decode or visual acceptance"}


def workspace_root(repo):
    value = "workspace"
    env = repo / ".env.local"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            match = re.match(r"\s*(?:export\s+)?MATERIAL_CENTER_WORKSPACE\s*=\s*(.*)$", line)
            if match:
                parts = shlex.split(match.group(1), comments=True)
                if len(parts) != 1 or not parts[0].strip() or "$" in parts[0]:
                    raise AtlasError("MATERIAL_CENTER_WORKSPACE 需为明确路径")
                value = parts[0]
    root = Path(value).expanduser()
    return no_symlinks(root if root.is_absolute() else repo / root)


def project_dir(repo, project_id, character_id):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", project_id):
        raise AtlasError("非法项目 ID")
    project = inside(workspace_root(repo), project_id)
    config = json.loads(regular_bytes(inside(project, "project.json")))
    if config.get("schemaVersion") != 1 or not isinstance(config.get("name"), str):
        raise AtlasError("项目配置无效")
    if not inside(project, "library").is_dir():
        raise AtlasError("项目缺少 library；不自动新建项目")
    story = json.loads(regular_bytes(inside(project, "production/story-index.v1.json")))
    if not any(c["id"] == character_id for c in story.get("characters", [])):
        raise AtlasError(f"角色不属于当前项目：{character_id}")
    if repo in project.parents:
        result = subprocess.run(["git", "check-ignore", "--quiet", str(project / "library/图片/参考/probe.png")], cwd=repo)
        if result.returncode:
            raise AtlasError("目标项目未命中 Git 忽略规则")
    return project


def verify_png(data, item):
    if len(data) != item["bytes"] or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AtlasError("原图字节数或 PNG 签名不符，不回退到缩略图")
    offset, seen_data, seen_header = 8, False, False
    while offset + 12 <= len(data):
        size = struct.unpack_from(">I", data, offset)[0]
        end = offset + 12 + size
        if end > len(data):
            raise AtlasError("PNG 块被截断")
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + size]
        checksum = struct.unpack_from(">I", data, end - 4)[0]
        if binascii.crc32(kind + payload) & 0xFFFFFFFF != checksum:
            raise AtlasError("PNG 块 CRC 不符")
        if not seen_header:
            if kind != b"IHDR" or size != 13:
                raise AtlasError("缺少 PNG IHDR")
            if struct.unpack_from(">II", payload) != (item["w"], item["h"]):
                raise AtlasError("原图像素尺寸与目录声明不符")
            seen_header = True
        elif kind == b"IHDR":
            raise AtlasError("重复 PNG IHDR")
        if kind == b"IDAT":
            seen_data = True
        if kind == b"IEND":
            if size or not seen_data or end != len(data):
                raise AtlasError("PNG 结束块不完整")
            return
        offset = end
    raise AtlasError("缺少 PNG 结束块")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise AtlasError("原站下载发生重定向，停止并核对来源")


def download_original(item):
    request = urllib.request.Request(item["full_remote"], headers={"User-Agent": "drama-material-center-reference/1"})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
        return response.read(item["bytes"] + 1)


def import_reference(catalog, *, repo, item_id, project_id, character_id, look_id,
                     role, consumer, version, apply=False, allow_download=False):
    item = catalog.get(item_id)
    if not re.fullmatch(r"CHAR-[A-Z0-9-]+", character_id) or not re.fullmatch(r"LOOK-[A-Z0-9-]+", look_id):
        raise AtlasError("需要合法的 characterId 和 lookId")
    if not re.fullmatch(r"v\d{2,}", version) or int(version[1:]) < 1:
        raise AtlasError("版本应为 v01、v02 等独立新版本")
    if role not in ("face", "hair", "styling") or not consumer.strip():
        raise AtlasError("需明确参考职责和真实消费者")
    project = project_dir(repo, project_id, character_id)
    filename = f"{project_id}-{character_id}-{look_id}-RUIC-{item_id}-{role}-{version}.png"
    if len(filename.encode("utf-8")) > 240:
        raise AtlasError("目标文件名过长，请缩短造型 ID")
    relative = "library/图片/参考/" + filename
    target = inside(project, relative)
    if target.exists():
        raise AtlasError("目标文件已存在，不覆盖；需核对已有导入或使用新版本")
    source = inside(catalog.root, item["full"])
    source_exists = source.is_file()
    plan = {
        "status": "PREVIEW", "materialType": "media.reference",
        "subject": {"projectId": project_id, "characterId": character_id, "lookId": look_id},
        "targetDir": "library/图片/参考/", "path": relative, "version": version,
        "storyBinding": False, "role": role, "consumer": consumer.strip(),
        "sourceId": item_id, "originalUrl": item["full_remote"],
        "expectedBytes": item["bytes"], "width": item["w"], "height": item["h"],
        "sourceMode": "local-original" if source_exists else "download-required",
        "downloadAllowed": allow_download,
    }
    if not apply:
        return plan
    if source_exists:
        data = regular_bytes(source)
    elif allow_download:
        data = download_original(item)
    else:
        raise AtlasError("本地缺少全尺寸原图；允许按选中 ID 下载时加 --allow-download")
    verify_png(data, item)
    digest = sha256(data)
    run_id = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:8]
    record_rel = "创作记录/ruic-character-reference/selection/" + run_id
    record_dir = inside(project, record_rel)
    record_dir.mkdir(parents=True, exist_ok=False)
    manifest = record_dir / "IMPORT-MANIFEST-v01.json"
    record = {
        "materialType": "record.creative", "subject": plan["subject"],
        "targetDir": record_rel, "version": "v01", "storyBinding": False,
        "status": "STARTED", "asset": {**plan, "status": "DRAFT", "sha256": digest,
                                        "visualReview": "NOT_REVIEWED"},
        "source": {"catalogId": item_id, "section": item["sec"], "hair": item["hair"],
                   "style": item["style"], "originalUrl": item["full_remote"],
                   "galleryUrl": GALLERY + item_id,
                   "repositoryUrl": "https://github.com/HRuiCcc/RuiC-PoseAtlas",
                   "atlasCommit": git_commit(catalog.root), "catalogSha256": catalog.hash,
                   "license": catalog.data.get("source", {})},
    }

    def save():
        manifest.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    save()
    try:
        inside(project, relative).parent.mkdir(parents=True, exist_ok=True)
        with inside(project, relative).open("xb") as stream:
            stream.write(data)
        copied = regular_bytes(inside(project, relative))
        if sha256(copied) != digest:
            raise AtlasError("复制后 SHA-256 不符")
        if source_exists and sha256(regular_bytes(source)) != digest:
            raise AtlasError("复制期间来源原图发生变化")
        record.update({"status": "IMPORT_COMPLETE", "verification": {
            "copiedFiles": 1, "copiedBytes": len(copied), "copiedSha256": digest,
            "pngStructureAndCrc": "PASS", "formalBinding": "REFERENCE_ONLY_NOT_FORMALLY_BOUND",
            "visualReview": "NOT_REVIEWED"}})
        save()
    except Exception as exc:
        record.update({"status": "FAILED", "error": str(exc)})
        save()
        raise AtlasError(f"导入失败，保留记录：{record_rel}；{exc}") from exc
    return {**plan, "status": "IMPORT_COMPLETE", "sha256": digest,
            "manifest": record_rel + "/IMPORT-MANIFEST-v01.json",
            "verification": record["verification"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas-root", type=Path, default=None)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="只读检查目录、数据及图片是否在本地")
    search = commands.add_parser("search", help="只搜索真实元数据，不提供气质语义检索")
    search.add_argument("--section", choices=["face", "styling"])
    search.add_argument("--hair", choices=["short", "medium", "semilong", "long"])
    search.add_argument("--query", default="")
    search.add_argument("--limit", type=int, default=12)
    search.add_argument("--offset", type=int, default=0)
    show = commands.add_parser("show", help="查看指定人像 ID 的元数据和本地路径")
    show.add_argument("--id", required=True)
    imp = commands.add_parser("import", help="预览或导入单张原图到当前项目，不修改正式索引")
    for name in ("id", "project-id", "character-id", "look-id", "consumer"):
        imp.add_argument("--" + name, required=True)
    imp.add_argument("--role", choices=["face", "hair", "styling"], required=True)
    imp.add_argument("--version", required=True)
    imp.add_argument("--apply", action="store_true")
    imp.add_argument("--allow-download", action="store_true")
    args = parser.parse_args()
    try:
        root = args.atlas_root or Path(os.environ.get("RUIC_ATLAS_ROOT") or REPO.parent / "RuiC-PoseAtlas")
        catalog = Catalog(root.expanduser())
        if args.command == "doctor":
            result = catalog.doctor()
        elif args.command == "show":
            result = catalog.summary(catalog.get(args.id))
        elif args.command == "search":
            if not 1 <= args.limit <= 100 or args.offset < 0:
                raise AtlasError("limit 需在1—100之间，offset 不得为负")
            result = catalog.search(args.section, args.hair, args.query, args.limit, args.offset)
        else:
            result = import_reference(catalog, repo=REPO, item_id=args.id,
                                      project_id=args.project_id, character_id=args.character_id,
                                      look_id=args.look_id, role=args.role, consumer=args.consumer,
                                      version=args.version, apply=args.apply,
                                      allow_download=args.allow_download)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (AtlasError, OSError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps({"status": "ERROR", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
