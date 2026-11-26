#!/usr/bin/env python3
"""
Local episode storyboard & reference-binding validator.

Mirrors the exact resolution contract of server/promptReferences.ts and adds
proactive checks for:
  1. Active reference-plan registration (role="reference-plan" + disk SHA-256)
  2. Unit prompt identity fields (promptPath/promptSha256, rejecting unsupported promptFile)
  3. Formal prompt.video binding hashes in asset-bindings.v1.json and story-index.v1.json
  4. Placeholder parity ({{Mixed N}} / {{Node ...}} vs referencePlan.assets, rejecting bare library/ paths)
  5. Asset identity parity (assetId, path, version, sha256 against asset-bindings.v1.json + disk)
  6. Blocking/camera diagram misuse check (diagrams are director-internal by default, not video inputs)
  7. Scene background viewpoint hygiene warnings (single-master overuse & conflicting views in one unit)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

DIGEST_RE = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)
TOKEN_RE = re.compile(r"^\{\{(?:Mixed\s+\d+|Node\s+[a-zA-Z0-9_-]+)\}\}$")
TOKEN_FIND_RE = re.compile(r"\{\{(?:Mixed\s+\d+|Node\s+[a-zA-Z0-9_-]+)\}\}")
BARE_LIB_PATH_RE = re.compile(r"(?:^|[\s｜|(:`'\"])(library/[^\s｜|)`'\"，。；]+)")

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}
VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm"}

UNSUPPORTED_PROMPT_FIELDS = ("promptFile", "file", "prompt_path", "bodyFile")
BLOCKING_NAME_RE = re.compile(r"(blocking[-_ ]?camera|俯视站位|镜头调度图)", re.IGNORECASE)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def is_current(binding: dict[str, Any]) -> bool:
    status = str(binding.get("status") or binding.get("decisionStatus") or "")
    return status != "SUPERSEDED" and not status.startswith("REJECTED")


def normalize_library_path(value: Any, allow_prefix: bool = True) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    p = value[len("library/") :] if allow_prefix and value.startswith("library/") else value
    if not p or os.path.isabs(p) or "\\" in p:
        return None
    parts = p.split("/")
    if any(part in ("", ".", "..") or part.startswith(".") for part in parts):
        return None
    return p


def same_library_path(value: Any, expected_lib_rel: str) -> bool:
    return normalize_library_path(value) == expected_lib_rel


def strict_project_file(project_root: Path, rel_path: str) -> tuple[Path | None, str | None]:
    """Resolve rel_path strictly inside project_root without symlinks."""
    resolved_root = project_root.resolve()
    cursor = resolved_root
    parts = rel_path.split("/")
    for idx, part in enumerate(parts):
        if part in ("", ".", ".."):
            return None, f"非法路径段: {rel_path}"
        cursor = cursor / part
        if not cursor.exists() and not cursor.is_symlink():
            return None, f"文件缺失: {rel_path}"
        if cursor.is_symlink():
            return None, f"路径包含符号链接: {rel_path}"
        if idx == len(parts) - 1:
            if not cursor.is_file():
                return None, f"目标不是普通文件: {rel_path}"
        else:
            if not cursor.is_dir():
                return None, f"路径中间段不是目录: {rel_path}"
    actual = cursor.resolve()
    try:
        actual.relative_to(resolved_root)
    except ValueError:
        return None, f"路径超出当前项目目录: {rel_path}"
    return actual, None


def media_kind(binding: dict[str, Any], path_str: str | None = None) -> str:
    mtype = str(binding.get("materialType") or binding.get("mediaType") or "")
    if mtype.startswith("image."):
        return "image"
    if mtype.startswith("audio."):
        return "audio"
    if mtype.startswith("video."):
        return "video"
    ext = Path(path_str or "").suffix.lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in AUDIO_EXTS:
        return "audio"
    if ext in VIDEO_EXTS:
        return "video"
    return "other"


def extract_prompt_identities(unit: dict[str, Any]) -> list[tuple[Any, Any]]:
    prompt_obj = unit.get("prompt") if isinstance(unit.get("prompt"), dict) else {}
    return [
        (unit.get("bodyPath"), unit.get("bodySha256")),
        (unit.get("promptPath"), unit.get("promptSha256")),
        (prompt_obj.get("path"), prompt_obj.get("sha256")),
        (unit.get("path"), unit.get("sha256")),
    ]


def extract_unit_references(unit: dict[str, Any]) -> list[dict[str, Any]] | None:
    rp = unit.get("referencePlan")
    if isinstance(rp, dict) and isinstance(rp.get("assets"), list):
        return [item for item in rp["assets"] if isinstance(item, dict)]
    refs = unit.get("references")
    if isinstance(refs, list) and all(isinstance(item, dict) for item in refs):
        return refs
    return None


def pick_reference_token(ref: dict[str, Any], body: str) -> str | None:
    tokens: list[str] = []
    for key in ("reference", "token", "logicalReference", "logicalToken"):
        val = ref.get(key)
        if isinstance(val, str) and TOKEN_RE.match(val):
            tokens.append(val)
    for tok in tokens:
        if tok in body:
            return tok
    return tokens[0] if tokens else None


def is_blocking_reference(ref: dict[str, Any], binding: dict[str, Any] | None) -> bool:
    roles = {str(ref.get("role") or ""), str((binding or {}).get("role") or "")}
    if "blocking-camera-reference" in roles:
        return True
    for candidate in (
        ref.get("path"),
        ref.get("subject"),
        ref.get("responsibility"),
        (binding or {}).get("path"),
    ):
        if isinstance(candidate, str) and BLOCKING_NAME_RE.search(candidate):
            return True
    return False


def is_scene_reference(ref: dict[str, Any], binding: dict[str, Any] | None) -> bool:
    mtypes = {
        str(ref.get("materialType") or ""),
        str((binding or {}).get("materialType") or ""),
    }
    if "image.scene" in mtypes:
        return True
    cat = str(ref.get("category") or "")
    role = str(ref.get("role") or "")
    return cat == "环境" or role in ("scene-master", "shot-background-reference")


def is_declared_scene_intercut(
    backgrounds: list[tuple[Any, Any]],
    scene: dict[str, Any],
    shot_count: Any,
) -> bool:
    intercuts = scene.get("intercutLocationIds")
    main_location = scene.get("locationId")
    if not main_location or not isinstance(intercuts, list) or not intercuts or type(shot_count) is not int:
        return False
    locations: set[str] = set()
    covered: set[int] = set()
    for location, shots in backgrounds:
        if (not isinstance(location, str) or location in locations
                or (location != main_location and location not in intercuts)
                or not isinstance(shots, list) or not shots
                or any(type(shot) is not int for shot in shots)
                or len(shots) != len(set(shots)) or covered.intersection(shots)):
            return False
        locations.add(location)
        covered.update(shots)
    return main_location in locations and covered == set(range(1, shot_count + 1))


def validate_episode(
    project_dir: Path,
    episode_id: str,
    allow_blocking_binding: bool = False,
) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    unit_summaries: list[dict[str, Any]] = []

    def add_error(code: str, message: str, unit_id: str | None = None) -> None:
        item: dict[str, Any] = {"code": code, "message": message}
        if unit_id:
            item["unitId"] = unit_id
        errors.append(item)

    def add_warning(code: str, message: str, unit_id: str | None = None) -> None:
        item: dict[str, Any] = {"code": code, "message": message}
        if unit_id:
            item["unitId"] = unit_id
        warnings.append(item)

    if not project_dir.is_dir():
        add_error("PROJECT_NOT_FOUND", f"项目目录不存在: {project_dir}")
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    asset_index_file, err = strict_project_file(project_dir, "production/asset-bindings.v1.json")
    if err or asset_index_file is None:
        add_error("MISSING_ASSET_INDEX", err or "缺少 production/asset-bindings.v1.json")
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    story_index_file, err = strict_project_file(project_dir, "production/story-index.v1.json")
    if err or story_index_file is None:
        add_error("MISSING_STORY_INDEX", err or "缺少 production/story-index.v1.json")
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    try:
        asset_index = json.loads(asset_index_file.read_text(encoding="utf-8"))
        story_index = json.loads(story_index_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        add_error("INVALID_INDEX_JSON", f"正式索引 JSON 解析失败: {exc}")
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    if asset_index.get("schemaVersion") != 1 or story_index.get("schemaVersion") != 1:
        add_error("INVALID_SCHEMA_VERSION", "asset-bindings.v1.json 或 story-index.v1.json 的 schemaVersion 不等于 1")
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    assets: list[dict[str, Any]] = [
        a for a in (asset_index.get("assets") or []) if isinstance(a, dict)
    ]
    doc_bindings: list[dict[str, Any]] = [
        d for d in (story_index.get("documentBindings") or []) if isinstance(d, dict)
    ]
    scenes = {
        scene["id"]: scene
        for episode in (story_index.get("episodes") or [])
        if isinstance(episode, dict) and episode.get("id") == episode_id
        for scene in (episode.get("scenes") or [])
        if isinstance(scene, dict) and isinstance(scene.get("id"), str)
    }

    # 1. Locate active reference-plan bindings for this episode
    ep_plans = [
        a
        for a in assets
        if a.get("role") == "reference-plan"
        and is_current(a)
        and isinstance(a.get("subject"), dict)
        and a["subject"].get("episodeId") == episode_id
    ]

    if not ep_plans:
        # Check if there is a binding pointing to a REFERENCE-PLAN file missing role="reference-plan"
        suspected = [
            a
            for a in assets
            if is_current(a)
            and isinstance(a.get("subject"), dict)
            and a["subject"].get("episodeId") == episode_id
            and isinstance(a.get("path"), str)
            and "REFERENCE-PLAN" in a["path"].upper()
        ]
        if suspected:
            add_error(
                "MISSING_REFERENCE_PLAN_ROLE",
                f"{episode_id} 存在引用计划绑定（{suspected[0].get('path')}），但缺少 \"role\": \"reference-plan\"，前端将无法解析预览。",
            )
        else:
            add_error(
                "MISSING_REFERENCE_PLAN_BINDING",
                f"asset-bindings.v1.json 中未找到 {episode_id} 当前生效的 role=\"reference-plan\" 绑定。",
            )
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    if len(ep_plans) > 1:
        paths = [str(p.get("path")) for p in ep_plans]
        add_error(
            "MULTIPLE_ACTIVE_REFERENCE_PLANS",
            f"{episode_id} 存在多个未标 SUPERSEDED 的 reference-plan 绑定: {paths}，旧版请标为 SUPERSEDED。",
        )

    plan_binding = ep_plans[0]
    plan_lib_rel = normalize_library_path(plan_binding.get("path"))
    if not plan_lib_rel:
        add_error("INVALID_PLAN_PATH", f"引用计划路径无效: {plan_binding.get('path')}")
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    plan_file, err = strict_project_file(project_dir, f"library/{plan_lib_rel}")
    if err or plan_file is None:
        add_error("MISSING_PLAN_FILE", err or f"引用计划文件缺失: library/{plan_lib_rel}")
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    expected_plan_hash = str(plan_binding.get("sha256") or "").lower()
    actual_plan_hash = sha256_file(plan_file)
    if not DIGEST_RE.match(expected_plan_hash) or expected_plan_hash != actual_plan_hash:
        add_error(
            "PLAN_HASH_MISMATCH",
            f"引用计划 {plan_lib_rel} 哈希与 asset-bindings.v1.json 不一致（索引={expected_plan_hash[:12]}… 磁盘={actual_plan_hash[:12]}…）。",
        )

    try:
        plan_data = json.loads(plan_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        add_error("INVALID_PLAN_JSON", f"引用计划 JSON 解析失败: {exc}")
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    units = [u for u in (plan_data.get("units") or []) if isinstance(u, dict)]
    if not units:
        add_error("EMPTY_UNITS", f"引用计划 {plan_lib_rel} 中没有 units。")
        return {"ok": False, "episodeId": episode_id, "errors": errors, "warnings": warnings, "units": []}

    # Index assets by assetId for fast lookup
    assets_by_id: dict[str, list[dict[str, Any]]] = {}
    for a in assets:
        aid = a.get("assetId")
        if isinstance(aid, str) and aid:
            assets_by_id.setdefault(aid, []).append(a)

    # Track scene backgrounds across the whole episode for viewpoint hygiene check
    episode_scene_paths: set[str] = set()
    units_with_scene: int = 0
    seen_prompt_paths: set[str] = set()

    for unit in units:
        uid = str(unit.get("unitId") or unit.get("id") or "<unknown>")

        # Check unsupported prompt identity fields
        for bad_field in UNSUPPORTED_PROMPT_FIELDS:
            if bad_field in unit:
                add_error(
                    "UNSUPPORTED_PROMPT_FIELD",
                    f"单元使用了服务端不支持的字段 '{bad_field}'，请改用 'promptPath' + 'promptSha256'。",
                    uid,
                )

        # Resolve prompt identity
        identities = [
            (normalize_library_path(p), str(h).lower() if isinstance(h, str) else "")
            for p, h in extract_prompt_identities(unit)
            if p is not None
        ]
        valid_identities = [(p, h) for p, h in identities if p is not None]
        if not valid_identities:
            add_error(
                "MISSING_PROMPT_PATH",
                "单元缺少有效的 promptPath（或 bodyPath）字段。",
                uid,
            )
            continue

        prompt_lib_rel, declared_prompt_hash = valid_identities[0]
        if prompt_lib_rel in seen_prompt_paths:
            add_error(
                "DUPLICATE_PROMPT_UNIT",
                f"多个引用单元指向同一提示词文件: {prompt_lib_rel}。",
                uid,
            )
        seen_prompt_paths.add(prompt_lib_rel)

        prompt_file, err = strict_project_file(project_dir, f"library/{prompt_lib_rel}")
        if err or prompt_file is None:
            add_error("MISSING_PROMPT_FILE", err or f"提示词文件缺失: library/{prompt_lib_rel}", uid)
            continue

        body_bytes = prompt_file.read_bytes()
        body = body_bytes.decode("utf-8")
        actual_prompt_hash = hashlib.sha256(body_bytes).hexdigest()

        if not DIGEST_RE.match(declared_prompt_hash) or declared_prompt_hash != actual_prompt_hash:
            add_error(
                "PROMPT_HASH_MISMATCH",
                f"单元声明的 promptSha256 与磁盘正文不一致（计划={declared_prompt_hash[:12]}… 磁盘={actual_prompt_hash[:12]}…）。",
                uid,
            )

        # Check formal prompt.video bindings in both indexes (exact match with promptReferences.ts)
        prompt_bindings = [
            b
            for b in (*assets, *doc_bindings)
            if b.get("materialType") == "prompt.video" and same_library_path(b.get("path"), prompt_lib_rel)
        ]
        if not prompt_bindings:
            add_error(
                "UNREGISTERED_PROMPT",
                f"提示词 {prompt_lib_rel} 未在 asset-bindings.v1.json 或 story-index.v1.json 中以 materialType=\"prompt.video\" 登记。",
                uid,
            )
        else:
            for pb in prompt_bindings:
                pb_hash = str(pb.get("sha256") or "").lower()
                if pb_hash != actual_prompt_hash:
                    add_error(
                        "INDEX_PROMPT_HASH_MISMATCH",
                        f"正式索引中提示词 {prompt_lib_rel} 的 sha256 与磁盘正文不一致，前端会返回 CONFLICT。",
                        uid,
                    )
            ep_ids = {
                b["subject"]["episodeId"]
                for b in prompt_bindings
                if isinstance(b.get("subject"), dict) and isinstance(b["subject"].get("episodeId"), str)
            }
            if len(ep_ids) > 1:
                add_error(
                    "CONFLICTING_PROMPT_EPISODE",
                    f"提示词 {prompt_lib_rel} 同时绑定了多个分集: {sorted(ep_ids)}。",
                    uid,
                )

        # Check for bare library/ paths in prompt body (common mistake instead of {{Mixed N}})
        bare_paths = BARE_LIB_PATH_RE.findall(body)
        if bare_paths:
            add_error(
                "BARE_PATH_IN_PROMPT",
                f"提示词正文包含裸路径 {bare_paths[:3]}，资产引用必须使用 {{{{Mixed N}}}} 或 {{{{Node ...}}}} 占位符。",
                uid,
            )

        refs = extract_unit_references(unit)
        if refs is None:
            add_error("MISSING_REFERENCE_LIST", "单元缺少 referencePlan.assets 数组。", uid)
            continue

        seen_tokens: set[str] = set()
        unit_scene_paths: set[str] = set()
        unit_backgrounds: list[tuple[Any, Any]] = []
        resolved_count = 0

        for ref in refs:
            tok = pick_reference_token(ref, body)
            if not tok:
                add_error(
                    "MISSING_REFERENCE_TOKEN",
                    f"引用项缺少合法的 {{{{Mixed N}}}} / {{{{Node ...}}}} 标记: {ref.get('assetId') or ref.get('subject')}",
                    uid,
                )
                continue
            if tok in seen_tokens:
                add_error("DUPLICATE_REFERENCE_TOKEN", f"素材标记 {tok} 在同一单元中重复映射。", uid)
                continue
            seen_tokens.add(tok)

            if tok not in body:
                add_warning(
                    "UNUSED_REFERENCE_TOKEN",
                    f"引用计划声明了 {tok}（{ref.get('subject') or ref.get('assetId')}），但提示词正文未引用该标记。",
                    uid,
                )

            aid = ref.get("assetId")
            if not isinstance(aid, str) or not aid or aid not in assets_by_id:
                add_error(
                    "UNREGISTERED_ASSET_ID",
                    f"{tok} 的 assetId='{aid}' 未在 asset-bindings.v1.json 登记（禁止手写新 ID）。",
                    uid,
                )
                continue

            candidates = assets_by_id[aid]
            if len(candidates) > 1:
                add_error("DUPLICATE_ASSET_ID", f"{tok} 的 assetId='{aid}' 在索引中存在多个正式绑定。", uid)
                continue

            current_binding = candidates[0]
            ref_lib_rel = normalize_library_path(ref.get("path"))
            if not ref_lib_rel:
                add_error("INVALID_ASSET_PATH", f"{tok} ({aid}) 的路径无效: {ref.get('path')}", uid)
                continue

            ref_hash = str(ref.get("sha256") or "").lower()
            cur_hash = str(current_binding.get("sha256") or "").lower()
            matches_current = same_library_path(current_binding.get("path"), ref_lib_rel) and ref_hash == cur_hash

            binding = current_binding
            if not matches_current:
                hist = [
                    h
                    for h in (current_binding.get("versionHistory") or [])
                    if isinstance(h, dict)
                    and same_library_path(h.get("path"), ref_lib_rel)
                    and str(h.get("sha256") or "").lower() == ref_hash
                ]
                if len(hist) > 1:
                    add_error("CONFLICT_VERSION_HISTORY", f"{tok} ({aid}) 匹配到多个历史版本记录。", uid)
                    continue
                if len(hist) == 1:
                    binding = {**current_binding, **hist[0], "bindingState": None}

            # Check path parity
            bind_lib_rel = normalize_library_path(binding.get("path"))
            if ref_lib_rel != bind_lib_rel:
                add_error(
                    "ASSET_PATH_MISMATCH",
                    f"{tok} ({aid}) 路径与正式绑定不一致（计划={ref_lib_rel}，索引={bind_lib_rel}）。",
                    uid,
                )
                continue

            # Check hash parity
            bind_hash = str(binding.get("sha256") or "").lower()
            if not DIGEST_RE.match(ref_hash) or not DIGEST_RE.match(bind_hash) or ref_hash != bind_hash:
                add_error(
                    "ASSET_HASH_MISMATCH",
                    f"{tok} ({aid}) sha256 与正式绑定不一致或缺失。",
                    uid,
                )
                continue

            # Check version parity if both present
            if ref.get("version") and binding.get("version") and ref["version"] != binding["version"]:
                add_error(
                    "ASSET_VERSION_MISMATCH",
                    f"{tok} ({aid}) 版本号不一致（计划={ref['version']}，索引={binding['version']}）。",
                    uid,
                )
                continue

            if binding.get("bindingState") in ("CONFLICT", "STALE_BINDING"):
                add_error(
                    "STALE_OR_CONFLICT_BINDING",
                    f"{tok} ({aid}) 正式绑定状态为 {binding.get('bindingState')}。",
                    uid,
                )
                continue

            # Check disk file & hash
            media_file, merr = strict_project_file(project_dir, f"library/{ref_lib_rel}")
            if merr or media_file is None:
                add_error("MISSING_ASSET_FILE", f"{tok} ({aid}) {merr}", uid)
                continue

            disk_hash = sha256_file(media_file)
            if disk_hash != ref_hash:
                add_error(
                    "ASSET_DISK_HASH_MISMATCH",
                    f"{tok} ({aid}) 磁盘文件哈希与引用计划不一致。",
                    uid,
                )
                continue

            if media_kind(binding, binding.get("path")) == "other":
                add_error("UNSUPPORTED_MEDIA_KIND", f"{tok} ({aid}) 文件类型暂不支持媒体预览。", uid)
                continue

            # Check blocking/camera diagram misuse (director-internal by default)
            if is_blocking_reference(ref, binding):
                msg = (
                    f"{tok} ({ref_lib_rel}) 是站位/运镜调度图。按最新 SOP，调度图仅用于导演内部理解与排演，"
                    "生成视频时不需要绑定到视频参考素材（如确属用户特批例外，可传 --allow-blocking-binding）。"
                )
                if allow_blocking_binding:
                    add_warning("BLOCKING_DIAGRAM_BOUND", msg, uid)
                else:
                    add_error("BLOCKING_DIAGRAM_BOUND", msg, uid)

            if is_scene_reference(ref, binding):
                unit_scene_paths.add(ref_lib_rel)
                episode_scene_paths.add(ref_lib_rel)
                subject = binding.get("subject")
                location = subject.get("locationId") if isinstance(subject, dict) else None
                unit_backgrounds.append((location, ref.get("shotNumbers")))

            resolved_count += 1

        # Check prompt tokens that have no entry in referencePlan.assets
        body_tokens = set(TOKEN_FIND_RE.findall(body))
        orphan_tokens = sorted(body_tokens - seen_tokens)
        for otok in orphan_tokens:
            add_error(
                "UNMAPPED_PROMPT_TOKEN",
                f"提示词正文引用了 {otok}，但 referencePlan.assets 中缺少对应映射。",
                uid,
            )

        # Scene background per-unit hygiene
        if len(unit_scene_paths) == 0:
            add_warning(
                "NO_SCENE_BACKGROUND",
                "单元未绑定任何场景背景图（纯局部/特写不入画背景可忽略，否则请补齐对应视角场景图）。",
                uid,
            )
        else:
            units_with_scene += 1
            scene_id = unit.get("sceneId")
            scene = scenes.get(scene_id, {}) if isinstance(scene_id, str) else {}
            if len(unit_scene_paths) > 1 and not is_declared_scene_intercut(
                unit_backgrounds, scene, unit.get("shotCount")
            ):
                add_warning(
                    "MULTI_SCENE_IN_ONE_UNIT",
                    f"同一单元混绑了 {len(unit_scene_paths)} 张场景背景图（{sorted(unit_scene_paths)}），请确认当前模型能按镜头分配且不存在正反打视角冲突，否则建议拆单元。",
                    uid,
                )

        unit_summaries.append(
            {
                "unitId": uid,
                "promptPath": prompt_lib_rel,
                "referenceCount": len(refs),
                "resolvedCount": resolved_count,
                "sceneBackgrounds": sorted(unit_scene_paths),
            }
        )

    # Episode-wide single-background warning
    if units_with_scene >= 3 and len(episode_scene_paths) == 1:
        only_bg = next(iter(episode_scene_paths))
        add_warning(
            "SINGLE_SCENE_FOR_WHOLE_EPISODE",
            f"全集 {units_with_scene} 个带场景单元全部只绑定了同 1 张背景图（{only_bg}），请按 SOP 核查是否存在不同机位/正反打共用一张全景母版的问题。",
        )

    return {
        "ok": len(errors) == 0,
        "episodeId": episode_id,
        "planPath": plan_lib_rel,
        "unitCount": len(units),
        "units": unit_summaries,
        "errors": errors,
        "warnings": warnings,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate local episode prompt bindings, reference plans, and viewpoint hygiene."
    )
    parser.add_argument("--project-dir", required=True, help="Path to the drama project directory")
    parser.add_argument("--episode", required=True, help="Episode ID, e.g. EP47")
    parser.add_argument(
        "--allow-blocking-binding",
        action="store_true",
        help="Downgrade bound blocking/camera diagrams from error to warning (for approved exceptions or legacy audits)",
    )
    parser.add_argument(
        "--strict-warnings",
        action="store_true",
        help="Exit non-zero if any warnings are present",
    )
    parser.add_argument("--json", action="store_true", help="Output full machine-readable JSON")
    args = parser.parse_args(argv)

    result = validate_episode(
        project_dir=Path(args.project_dir),
        episode_id=args.episode,
        allow_blocking_binding=args.allow_blocking_binding,
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        status = "PASS" if result["ok"] else "FAIL"
        print(
            f"[{status}] {result['episodeId']} | plan={result.get('planPath', 'N/A')} | "
            f"units={result.get('unitCount', 0)} | errors={len(result['errors'])} | warnings={len(result['warnings'])}"
        )
        for u in result.get("units", []):
            print(
                f"  - {u['unitId']}: {u['resolvedCount']}/{u['referenceCount']} resolved | "
                f"bg={len(u['sceneBackgrounds'])}"
            )
        if result["errors"]:
            print("\nErrors:")
            for e in result["errors"]:
                prefix = f"[{e['unitId']}] " if "unitId" in e else ""
                print(f"  ✗ {prefix}{e['code']}: {e['message']}")
        if result["warnings"]:
            print("\nWarnings:")
            for w in result["warnings"]:
                prefix = f"[{w['unitId']}] " if "unitId" in w else ""
                print(f"  ! {prefix}{w['code']}: {w['message']}")

    if not result["ok"]:
        return 1
    if args.strict_warnings and result["warnings"]:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
