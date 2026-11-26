#!/usr/bin/env python3
"""Unit tests for scripts/check-episode-local.py."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve().parent / "check-episode-local.py"
SPEC = importlib.util.spec_from_file_location("check_episode_local", SCRIPT_PATH)
assert SPEC and SPEC.loader
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class CheckEpisodeLocalTests(unittest.TestCase):
    def _build_fixture(
        self,
        root: Path,
        *,
        include_plan_role: bool = True,
        use_bad_prompt_field: bool = False,
        bare_path_in_prompt: bool = False,
        wrong_asset_id: bool = False,
        include_blocking: bool = False,
        unit_count: int = 1,
        single_bg_all_units: bool = False,
        multi_bg_in_unit: bool = False,
    ) -> Path:
        project = root / "demo-drama"
        (project / "production").mkdir(parents=True)
        (project / "library/剧情/分集/EP01/分镜").mkdir(parents=True)
        (project / "library/图片/人物/CHAR-001").mkdir(parents=True)
        (project / "library/图片/场景/LOC-HALL").mkdir(parents=True)
        (project / "library/图片/参考").mkdir(parents=True)

        char_path = project / "library/图片/人物/CHAR-001/CHAR-001-v01.png"
        char_bytes = b"fake-png-char"
        char_path.write_bytes(char_bytes)
        char_hash = sha256_bytes(char_bytes)

        blocking_path = project / "library/图片/参考/DEMO-EP01-U01-BLOCKING-CAMERA-v01.png"
        blocking_bytes = b"fake-png-blocking"
        blocking_path.write_bytes(blocking_bytes)
        blocking_hash = sha256_bytes(blocking_bytes)

        bg_entries: list[tuple[str, str, str]] = []
        bg_needed = 1 if single_bg_all_units else max(unit_count, 2 if multi_bg_in_unit else 1)
        for idx in range(1, bg_needed + 1):
            p = project / f"library/图片/场景/LOC-HALL/LOC-HALL-VIEW-{idx}-v01.png"
            b = f"fake-png-bg-{idx}".encode("utf-8")
            p.write_bytes(b)
            bg_entries.append((f"ASSET-BG-{idx}", f"library/图片/场景/LOC-HALL/LOC-HALL-VIEW-{idx}-v01.png", sha256_bytes(b)))

        asset_records: list[dict] = [
            {
                "assetId": "ASSET-CHAR-001",
                "materialType": "image.character",
                "role": "character-standard",
                "path": "library/图片/人物/CHAR-001/CHAR-001-v01.png",
                "sha256": char_hash,
                "status": "ACCEPTED",
            },
            {
                "assetId": "ASSET-BLOCKING-001",
                "materialType": "media.reference",
                "role": "blocking-camera-reference",
                "path": "library/图片/参考/DEMO-EP01-U01-BLOCKING-CAMERA-v01.png",
                "sha256": blocking_hash,
                "status": "DRAFT",
            },
        ]
        for aid, rel, h in bg_entries:
            asset_records.append(
                {
                    "assetId": aid,
                    "materialType": "image.scene",
                    "role": "shot-background-reference",
                    "path": rel,
                    "sha256": h,
                    "status": "ACCEPTED",
                }
            )

        units = []
        doc_bindings = []

        for idx in range(1, unit_count + 1):
            uid = f"EP01-S01-U{idx:02d}"
            prompt_rel = f"library/剧情/分集/EP01/分镜/{uid}-VIDEO-SHOT-PROMPT-v01.md"
            prompt_file = project / prompt_rel

            lines = [
                "**总时长：10秒｜画幅：9:16｜无配乐｜场景：大厅·日**",
                "",
                "**人物资产：**",
                "- library/图片/人物/CHAR-001/CHAR-001-v01.png｜主角"
                if bare_path_in_prompt
                else "- {{Mixed 1}}｜主角｜镜头1｜保持造型",
                "",
                "**环境资产：**",
                "- {{Mixed 2}}｜大厅视角｜镜头1｜背景",
            ]
            ref_assets = [
                {
                    "assetId": "ASSET-WRONG-ID" if wrong_asset_id else "ASSET-CHAR-001",
                    "path": "library/图片/人物/CHAR-001/CHAR-001-v01.png",
                    "category": "人物",
                    "role": "character-standard",
                    "materialType": "image.character",
                    "sha256": char_hash,
                    "logicalReference": "{{Mixed 1}}",
                },
                {
                    "assetId": bg_entries[0 if single_bg_all_units else idx - 1][0],
                    "path": bg_entries[0 if single_bg_all_units else idx - 1][1],
                    "category": "环境",
                    "role": "shot-background-reference",
                    "materialType": "image.scene",
                    "sha256": bg_entries[0 if single_bg_all_units else idx - 1][2],
                    "logicalReference": "{{Mixed 2}}",
                },
            ]

            next_mixed = 3
            if multi_bg_in_unit and idx == 1:
                lines.append(f"- {{{{Mixed {next_mixed}}}}}｜第二视角｜镜头2｜背景")
                ref_assets.append(
                    {
                        "assetId": bg_entries[1][0],
                        "path": bg_entries[1][1],
                        "category": "环境",
                        "role": "shot-background-reference",
                        "materialType": "image.scene",
                        "sha256": bg_entries[1][2],
                        "logicalReference": f"{{{{Mixed {next_mixed}}}}}",
                    }
                )
                next_mixed += 1

            if include_blocking and idx == 1:
                lines.append(f"- {{{{Mixed {next_mixed}}}}}｜俯视调度图｜镜头1｜调度参考")
                ref_assets.append(
                    {
                        "assetId": "ASSET-BLOCKING-001",
                        "path": "library/图片/参考/DEMO-EP01-U01-BLOCKING-CAMERA-v01.png",
                        "category": "参考",
                        "role": "blocking-camera-reference",
                        "materialType": "media.reference",
                        "sha256": blocking_hash,
                        "logicalReference": f"{{{{Mixed {next_mixed}}}}}",
                    }
                )

            prompt_text = "\n".join(lines) + "\n"
            prompt_file.write_text(prompt_text, encoding="utf-8")
            prompt_hash = sha256_bytes(prompt_text.encode("utf-8"))

            unit_obj: dict = {
                "unitId": uid,
                "referencePlan": {"assets": ref_assets},
            }
            if use_bad_prompt_field:
                unit_obj["promptFile"] = prompt_rel
            else:
                unit_obj["promptPath"] = prompt_rel
                unit_obj["promptSha256"] = prompt_hash
            units.append(unit_obj)

            doc_bindings.append(
                {
                    "assetId": f"DOC-PROMPT-{idx}",
                    "materialType": "prompt.video",
                    "path": prompt_rel,
                    "sha256": prompt_hash,
                    "status": "DRAFT",
                    "subject": {"episodeId": "EP01", "sceneId": "EP01-S01"},
                }
            )

        plan_rel = "library/剧情/分集/EP01/分镜/EP01-REFERENCE-PLAN-v01.json"
        plan_file = project / plan_rel
        plan_bytes = json.dumps({"schemaVersion": 1, "episodeId": "EP01", "units": units}, ensure_ascii=False, indent=2).encode("utf-8")
        plan_file.write_bytes(plan_bytes)
        plan_hash = sha256_bytes(plan_bytes)

        plan_record: dict = {
            "assetId": "ASSET-EP01-REFPLAN-V01",
            "materialType": "plan.shot",
            "path": plan_rel,
            "sha256": plan_hash,
            "status": "DRAFT",
            "subject": {"episodeId": "EP01"},
        }
        if include_plan_role:
            plan_record["role"] = "reference-plan"
        asset_records.append(plan_record)

        (project / "production/asset-bindings.v1.json").write_text(
            json.dumps({"schemaVersion": 1, "assets": asset_records}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (project / "production/story-index.v1.json").write_text(
            json.dumps({"schemaVersion": 1, "documentBindings": doc_bindings}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return project

    def test_valid_episode_passes(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            project = self._build_fixture(Path(td), unit_count=3)
            res = MOD.validate_episode(project, "EP01")
            self.assertTrue(res["ok"], res)
            self.assertEqual(res["errors"], [])
            self.assertEqual(res["warnings"], [])

    def test_missing_reference_plan_role_fails(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            project = self._build_fixture(Path(td), include_plan_role=False)
            res = MOD.validate_episode(project, "EP01")
            self.assertFalse(res["ok"])
            self.assertIn("MISSING_REFERENCE_PLAN_ROLE", {e["code"] for e in res["errors"]})

    def test_unsupported_prompt_file_field_fails(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            project = self._build_fixture(Path(td), use_bad_prompt_field=True)
            res = MOD.validate_episode(project, "EP01")
            self.assertFalse(res["ok"])
            codes = {e["code"] for e in res["errors"]}
            self.assertIn("UNSUPPORTED_PROMPT_FIELD", codes)
            self.assertIn("MISSING_PROMPT_PATH", codes)

    def test_bare_path_in_prompt_fails(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            project = self._build_fixture(Path(td), bare_path_in_prompt=True)
            res = MOD.validate_episode(project, "EP01")
            self.assertFalse(res["ok"])
            self.assertIn("BARE_PATH_IN_PROMPT", {e["code"] for e in res["errors"]})

    def test_wrong_asset_id_fails(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            project = self._build_fixture(Path(td), wrong_asset_id=True)
            res = MOD.validate_episode(project, "EP01")
            self.assertFalse(res["ok"])
            self.assertIn("UNREGISTERED_ASSET_ID", {e["code"] for e in res["errors"]})

    def test_blocking_diagram_blocked_by_default_and_allowed_with_flag(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            project = self._build_fixture(Path(td), include_blocking=True)
            res_default = MOD.validate_episode(project, "EP01", allow_blocking_binding=False)
            self.assertFalse(res_default["ok"])
            self.assertIn("BLOCKING_DIAGRAM_BOUND", {e["code"] for e in res_default["errors"]})

            res_allowed = MOD.validate_episode(project, "EP01", allow_blocking_binding=True)
            self.assertTrue(res_allowed["ok"])
            self.assertIn("BLOCKING_DIAGRAM_BOUND", {w["code"] for w in res_allowed["warnings"]})

    def test_single_scene_and_multi_scene_warnings(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p1 = self._build_fixture(Path(td) / "a", unit_count=3, single_bg_all_units=True)
            res1 = MOD.validate_episode(p1, "EP01")
            self.assertTrue(res1["ok"])
            self.assertIn("SINGLE_SCENE_FOR_WHOLE_EPISODE", {w["code"] for w in res1["warnings"]})

            p2 = self._build_fixture(Path(td) / "b", unit_count=1, multi_bg_in_unit=True)
            res2 = MOD.validate_episode(p2, "EP01")
            self.assertTrue(res2["ok"])
            self.assertIn("MULTI_SCENE_IN_ONE_UNIT", {w["code"] for w in res2["warnings"]})

    def test_intercut_requires_distinct_declared_locations_and_disjoint_shot_coverage(self) -> None:
        scene = {"locationId": "LOC-HALL", "intercutLocationIds": ["LOC-STREET"]}
        backgrounds = [("LOC-STREET", [1]), ("LOC-HALL", [2])]
        self.assertTrue(MOD.is_declared_scene_intercut(backgrounds, scene, 2))
        self.assertFalse(MOD.is_declared_scene_intercut(backgrounds, scene, 3))
        self.assertFalse(MOD.is_declared_scene_intercut(backgrounds, {"locationId": "LOC-HALL"}, 2))
        self.assertFalse(MOD.is_declared_scene_intercut([("LOC-STREET", [1]), ("LOC-HALL", [1])], scene, 2))
        self.assertFalse(MOD.is_declared_scene_intercut([("LOC-HALL", [1]), ("LOC-HALL", [2])], scene, 2))


if __name__ == "__main__":
    unittest.main()
