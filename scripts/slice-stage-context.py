#!/usr/bin/env python3
"""
Stage Context Slicer for ai-director four-stage pipeline.

Returns the exact authoritative rule files to read for a given stage
(S1/S2/S3/S4) and optional combat tier (none/R1/R2/R3), preventing both
context overload and silent rule skipping.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

STAGE_FILES: dict[str, list[str]] = {
    "S1": [
        ".agents/skills/ai-director/SKILL.md",
        ".agents/skills/ai-director/references/stage1-decision.md",
    ],
    "S2": [
        ".agents/skills/ai-director/references/stage2-staging-acting.md",
        ".agents/skills/ai-director/references/stage2-camera-editing.md",
        ".agents/skills/ai-director/references/stage2-preview-template.md",
    ],
    "S3": [
        ".agents/skills/ai-director/references/stage3-asset-pipeline.md",
    ],
    "S4": [
        ".agents/skills/ai-director/references/shot-block-format.md",
        ".agents/skills/ai-director/references/review-mode.md",
        ".agents/skills/ai-director/references/workflow-contract.md",
    ],
}

COMBAT_FILES: dict[str, list[str]] = {
    "none": [],
    "R1": [
        ".agents/skills/ai-director/references/combat/combat-router.md",
        ".agents/skills/ai-director/references/combat/r1-real-combat.md",
    ],
    "R2": [
        ".agents/skills/ai-director/references/combat/combat-router.md",
        ".agents/skills/ai-director/references/combat/r2-r3-stylized-combat.md",
    ],
    "R3": [
        ".agents/skills/ai-director/references/combat/combat-router.md",
        ".agents/skills/ai-director/references/combat/r2-r3-stylized-combat.md",
    ],
}


def resolve_stage_files(stage: str, combat: str = "none") -> list[Path]:
    rels = list(STAGE_FILES[stage])
    if stage in ("S1", "S2") and combat != "none":
        for c in COMBAT_FILES[combat]:
            if c not in rels:
                rels.append(c)
    return [REPO_ROOT / r for r in rels]


def self_test() -> int:
    missing: list[str] = []
    checked = 0
    for stage in STAGE_FILES:
        for combat in COMBAT_FILES:
            for p in resolve_stage_files(stage, combat):
                checked += 1
                if not p.is_file():
                    missing.append(str(p.relative_to(REPO_ROOT)))
    if missing:
        print(f"FAIL: 缺失规则文件: {sorted(set(missing))}", file=sys.stderr)
        return 1
    print(f"PASS: slice-stage-context self-test checked {checked} stage-combat mappings, 0 missing.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Slice authoritative rule files for ai-director stages.")
    parser.add_argument("--stage", choices=["S1", "S2", "S3", "S4"], help="Target stage.")
    parser.add_argument("--combat", choices=["none", "R1", "R2", "R3"], default="none", help="Optional combat tier.")
    parser.add_argument("--json", action="store_true", help="Output JSON metadata.")
    parser.add_argument("--self-test", action="store_true", help="Verify all referenced rule files exist.")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if not args.stage:
        parser.error("请提供 --stage <S1|S2|S3|S4> 或 --self-test。")

    files = resolve_stage_files(args.stage, args.combat)
    missing = [str(f.relative_to(REPO_ROOT)) for f in files if not f.is_file()]
    if missing:
        print(f"ERROR: 缺失规则文件: {missing}", file=sys.stderr)
        return 1

    items = []
    total_chars = 0
    for f in files:
        chars = len(f.read_text(encoding="utf-8"))
        total_chars += chars
        items.append({"path": str(f.relative_to(REPO_ROOT)), "chars": chars})

    payload = {
        "stage": args.stage,
        "combat": args.combat,
        "files": items,
        "totalChars": total_chars,
        "approxTokens": int(total_chars * 1.2),
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"[stage:{args.stage} combat:{args.combat}] total={total_chars} chars (~{payload['approxTokens']} tokens)")
        for it in items:
            print(f"  - {it['path']} ({it['chars']} chars)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
