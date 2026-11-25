#!/usr/bin/env python3
"""
Cinema & Anti-PPT Storyboard Quality Gate for drama-material-center.

Complements scripts/check-episode-local.py (engineering & binding gate) by
checking video-shot-prompt-v2 prompts for cinematic craft and anti-PPT defects:
  1. META_LEAK (FAIL): Internal planning terms / workflow labels leaked into prompt body
  2. TIMELINE_INTEGRITY (FAIL): Shot timestamp coverage, contiguity, and no inner timestamps
  3. PPT_STATIC_TALKING_HEAD (FAIL/WARN): Long static talking-head shots with zero blocking,
     zero hand/prop Business, and zero camera/focus motion (allows motivated long takes!)
  4. ABSTRACT_EMOTION_ONLY (WARN): Abstract emotion adjectives without physical/visible anchors
  5. CONSECUTIVE_FLAT_SHOTS (WARN): 3+ consecutive static shots with identical framing
  6. EPISODE_FIXED_CAMERA_RATIO (WARN): Over-reliance on static framing across an episode
  7. LONG_DIALOGUE_NO_RELATION_SHOT (WARN): Multi-speaker dialogue episode with zero two-shot/OTS
  8. OFFSCREEN_NAME_LEAK (WARN): Unbound off-screen character full name in non-dialogue prose
  9. POSTURE_REGRESSION (WARN): Sudden posture reversion across consecutive shots without transition
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SHOT_HEADING_RE = re.compile(
    r"^###\s*(\d+(?:\.\d+)?)s\s*[–—\-~至到]\s*(\d+(?:\.\d+)?)s\s*[｜|]\s*镜头\s*(\d+)\s*[：:]\s*(.+?)\s*$"
)
TOTAL_DURATION_RE = re.compile(r"总时长[：:]\s*(\d+(?:\.\d+)?)\s*秒")
FIELD_RE = re.compile(
    r"^\*\*(景别与镜头运动|画面与动作|光影表现|音效)[：:]\*\*\s*(.*)$"
)
INNER_TIMESTAMP_RE = re.compile(
    r"(?:^|\n)\s*(?:[-*]\s*)?\d+(?:\.\d+)?s?\s*[–—\-~至]\s*\d+(?:\.\d+)?s\s*[：:｜|]"
)
ASSET_CHAR_LINE_RE = re.compile(r"^\s*-\s*\{\{[^}]+\}\}\s*[｜|]\s*([^｜|\n]+)")
DIALOGUE_QUOTE_RE = re.compile(r"[「“\"]([^」”\"\n]{2,})[」”\"]")
SPEAKER_RE = re.compile(r"([\u4e00-\u9fff]{2,5})\s*[：:]\s*[「“\"]")

META_LEAK_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("情境映射代码(E01-E15)", re.compile(r"(?<![A-Za-z0-9])E(?:0[1-9]|1[0-5])(?![A-Za-z0-9])")),
    ("内部规划术语", re.compile(r"(?:权力几何|执行回执|末态继承|拼接节点|情绪锚点表|单镜头模板|分镜预览|雷区白名单|情境映射)")),
    ("内部英文/转场术语", re.compile(r"\b(?:Business|Proxemics|J-cut|L-cut|Match\s*Cut|Whip\s*Pan|Sound\s*Bridge|Hit-Stop)\b", re.IGNORECASE)),
    ("规划层元标签", re.compile(r"(?:^|\n)\s*(?:状态|重音)[：:]")),
    ("敷衍占位词", re.compile(r"(?:同上|其余同理|格式参照前文|继承上一镜|详见上文)")),
]

STATIC_CAMERA_RE = re.compile(r"(?:固定机位|固定镜头|固定反打|固定正打|固定拍|固定肩上|稳住[^，。；]*焦点|保持固定|静止机位)")
CAMERA_MOTION_RE = re.compile(
    r"(?:缓推|慢推|推近|推进|推镜|拉远|后拉|拉镜|横移|侧移|跟拍|跟随|摇向|摇镜|微摇|急摇|甩镜|环绕|绕行|升降|升镜|降镜|手持|呼吸感晃动|变焦|移焦|焦点从|焦点转|焦点移|焦点切|跟移|轨道|俯冲)"
)

BLOCKING_ACTION_RE = re.compile(
    r"(?:起身|站起|坐下|坐回|转身|迈步|走向|走近|走去|走过|绕过|跨过|退步|后退|退后|退开|逼近|前压|上前半步|上前|跨入|冲入|扑向|弯腰|蹲下|跪下|离席|进门|出门|推门|拉门|关门)"
)
BUSINESS_ACTION_RE = re.compile(
    r"(?:推回|推向|递给|递出|接过|拿起|放下|合上(?!嘴|双唇|口|眼|双眼|眼皮)|打开(?!嘴|口)|翻开|翻页|抱起|抱着|拍桌|拍案|按住|按在|双掌按|甩向|甩出|撕开|撕碎|倒茶|倒水|擦拭|摘下|戴上|扣上|解开|敲击|敲桌|握紧|攥紧|捏住|指向|敲了敲|放回|塞进|抽出|拔出|挥出|挥拳|格挡|闪避|劈|斩|踢|踹|抓起|拎起|刷卡|签字|落笔|划掉|点开|熄屏|亮屏|挂断)"
)

ABSTRACT_EMOTION_RE = re.compile(
    r"(?:略带怒意|很生气|非常愤怒|十分紧张|悲伤地|伤心地|开心地|得意地|冷漠地|愤怒地|惊讶地|心虚地|平静地说|无奈地|痛苦地|激动地说)"
)
VISIBLE_BODY_RE = re.compile(
    r"(?:眼|瞳|眉|睫|唇|嘴|下颌|咬肌|喉|肩|胸|呼吸|换气|吸气|呼气|手|指|掌|拳|腕|步|腰|背|颈|头|泪|发红|泛红|颤|绷紧|抿|吞咽|耸|垂|抬眼|瞥|盯|凝视|转身|前倾|后撤)"
)

SHOT_SIZE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("大特写", re.compile(r"(?:大特写|极端特写|微距)")),
    ("特写", re.compile(r"特写")),
    ("中近景", re.compile(r"中近景")),
    ("近景", re.compile(r"(?:近景|肩上|胸像|肩部以上)")),
    ("中全景", re.compile(r"中全景")),
    ("中景", re.compile(r"(?:中景|半身)")),
    ("远景", re.compile(r"(?:大远景|远景|中远景)")),
    ("全景", re.compile(r"全景")),
]

RELATION_SHOT_RE = re.compile(
    r"(?:双人|两人|二人|同框|过肩|越过[^，。；]{1,8}肩|越[^，。；]{1,6}肩|前景[^，。；]{0,12}(?:肩|侧脸|背影)|三人|群像|双方)"
)

STAND_UP_RE = re.compile(r"(?:起身|站起|站直|从椅子上站起|撑起)")
LYING_SITTING_RE = re.compile(r"(?:平躺|躺在|卧在|蜷缩|坐在|坐着)")
POSTURE_TRANSITION_RE = re.compile(r"(?:坐下|坐回|跌回|躺回|倒回|退坐|瘫坐|跌坐)")

PROFILES: dict[str, dict[str, float]] = {
    "balanced": {
        "ppt_warn_sec": 7.0,
        "ppt_fail_sec": 10.0,
        "max_static_ratio": 0.70,
    },
    "punchy": {
        "ppt_warn_sec": 6.0,
        "ppt_fail_sec": 8.0,
        "max_static_ratio": 0.55,
    },
    "restrained": {
        "ppt_warn_sec": 10.0,
        "ppt_fail_sec": 14.0,
        "max_static_ratio": 0.85,
    },
}


@dataclass
class Issue:
    severity: str  # FAIL | WARN
    code: str
    location: str
    message: str


@dataclass
class Shot:
    index: int
    start: float
    end: float
    title: str
    camera: str = ""
    picture: str = ""
    lighting: str = ""
    sound: str = ""

    @property
    def duration(self) -> float:
        return round(self.end - self.start, 3)


@dataclass
class ParsedUnit:
    path: Path
    declared_duration: float | None
    bound_characters: list[str]
    atmosphere: str
    shots: list[Shot]
    raw_text: str


def detect_shot_size(camera_text: str) -> str:
    for label, pattern in SHOT_SIZE_PATTERNS:
        if pattern.search(camera_text):
            return label
    return "未知"


def strip_dialogue(text: str) -> str:
    return DIALOGUE_QUOTE_RE.sub("「」", text)


def parse_prompt_file(path: Path) -> ParsedUnit:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    declared_duration: float | None = None
    first_lines = "\n".join(lines[:5])
    dur_match = TOTAL_DURATION_RE.search(first_lines)
    if dur_match:
        declared_duration = float(dur_match.group(1))

    bound_characters: list[str] = []
    in_char_section = False
    in_atmosphere = False
    in_timeline = False
    atmosphere_lines: list[str] = []
    shots: list[Shot] = []
    current_shot: Shot | None = None
    current_field: str | None = None

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("**人物资产"):
            in_char_section = True
            in_atmosphere = False
            continue
        if stripped.startswith("**") and stripped.endswith("**") and "资产" in stripped:
            in_char_section = False
            continue
        if stripped.startswith("[整体场景与氛围]"):
            in_char_section = False
            in_atmosphere = True
            in_timeline = False
            continue
        if stripped.startswith("【多分镜时间轴】"):
            in_char_section = False
            in_atmosphere = False
            in_timeline = True
            continue

        if in_char_section:
            m_char = ASSET_CHAR_LINE_RE.match(line)
            if m_char:
                name = m_char.group(1).strip()
                if name and name not in bound_characters:
                    bound_characters.append(name)
            continue

        if in_atmosphere:
            atmosphere_lines.append(line)
            continue

        if in_timeline:
            m_shot = SHOT_HEADING_RE.match(stripped)
            if m_shot:
                current_shot = Shot(
                    index=int(m_shot.group(3)),
                    start=float(m_shot.group(1)),
                    end=float(m_shot.group(2)),
                    title=m_shot.group(4).strip(),
                )
                shots.append(current_shot)
                current_field = None
                continue

            if current_shot is not None:
                m_field = FIELD_RE.match(stripped)
                if m_field:
                    fname = m_field.group(1)
                    fval = m_field.group(2).strip()
                    current_field = fname
                    if fname == "景别与镜头运动":
                        current_shot.camera = fval
                    elif fname == "画面与动作":
                        current_shot.picture = fval
                    elif fname == "光影表现":
                        current_shot.lighting = fval
                    elif fname == "音效":
                        current_shot.sound = fval
                elif stripped and stripped != "---" and current_field:
                    if current_field == "景别与镜头运动":
                        current_shot.camera = (current_shot.camera + "\n" + stripped).strip()
                    elif current_field == "画面与动作":
                        current_shot.picture = (current_shot.picture + "\n" + stripped).strip()
                    elif current_field == "光影表现":
                        current_shot.lighting = (current_shot.lighting + "\n" + stripped).strip()
                    elif current_field == "音效":
                        current_shot.sound = (current_shot.sound + "\n" + stripped).strip()

    return ParsedUnit(
        path=path,
        declared_duration=declared_duration,
        bound_characters=bound_characters,
        atmosphere="\n".join(atmosphere_lines).strip(),
        shots=shots,
        raw_text=text,
    )


def is_static_camera(camera_text: str) -> bool:
    if CAMERA_MOTION_RE.search(camera_text):
        return False
    return True if (STATIC_CAMERA_RE.search(camera_text) or not CAMERA_MOTION_RE.search(camera_text)) else False


def check_unit(
    unit: ParsedUnit,
    profile_cfg: dict[str, float],
    known_characters: set[str],
) -> tuple[list[Issue], dict[str, Any]]:
    issues: list[Issue] = []
    unit_name = unit.path.name

    # 1. Timeline integrity
    if not unit.shots:
        issues.append(
            Issue("FAIL", "TIMELINE_INTEGRITY", unit_name, "未解析到【多分镜时间轴】下的标准镜头块（### 0.0s–Xs｜镜头N：标题）。")
        )
        return issues, {"shots": 0, "static_shots": 0, "dialogue_shots": 0, "relation_shots": 0, "speakers": set()}

    prev_end = 0.0
    for idx, shot in enumerate(unit.shots):
        loc = f"{unit_name}::镜头{shot.index}({shot.start:.1f}s–{shot.end:.1f}s)"
        if shot.end <= shot.start:
            issues.append(Issue("FAIL", "TIMELINE_INTEGRITY", loc, f"镜头结束时间 {shot.end}s 必须大于开始时间 {shot.start}s。"))
        if idx == 0 and abs(shot.start - 0.0) > 0.05:
            issues.append(Issue("FAIL", "TIMELINE_INTEGRITY", loc, f"首镜必须从 0.0s 起算，当前为 {shot.start}s。"))
        elif idx > 0 and abs(shot.start - prev_end) > 0.05:
            issues.append(Issue("FAIL", "TIMELINE_INTEGRITY", loc, f"时间轴断档或重叠：上镜结束 {prev_end}s，本镜开始 {shot.start}s。"))
        prev_end = shot.end

        if INNER_TIMESTAMP_RE.search(shot.picture):
            issues.append(Issue("FAIL", "TIMELINE_INTEGRITY", loc, "画面与动作正文内检测到嵌套时间段/镜内节拍表，违反单层镜头格式。"))

    if unit.declared_duration is not None and abs(prev_end - unit.declared_duration) > 0.1:
        issues.append(
            Issue(
                "FAIL",
                "TIMELINE_INTEGRITY",
                unit_name,
                f"镜头累计时长 {prev_end:.1f}s 与摘要声明总时长 {unit.declared_duration:.1f}s 不一致。",
            )
        )

    # 2. Meta-language / planning term leaks
    body_for_meta = unit.atmosphere + "\n" + "\n".join(
        f"{s.camera}\n{s.picture}\n{s.lighting}\n{s.sound}" for s in unit.shots
    )
    for label, pattern in META_LEAK_PATTERNS:
        m = pattern.search(body_for_meta)
        if m:
            issues.append(
                Issue("FAIL", "META_LEAK", unit_name, f"检测到{label}泄漏进视频模型正文：「{m.group(0).strip()}」。内部规划词不得写入执行正文。")
            )

    # 3. Shot-level checks
    static_count = 0
    dialogue_count = 0
    relation_count = 0
    speakers: set[str] = set()
    shot_meta_seq: list[tuple[str, bool, str]] = []
    unit_stood_up = False

    for shot in unit.shots:
        loc = f"{unit_name}::镜头{shot.index}({shot.start:.1f}s–{shot.end:.1f}s)"
        static_cam = is_static_camera(shot.camera)
        if static_cam:
            static_count += 1

        shot_size = detect_shot_size(shot.camera)
        shot_meta_seq.append((shot_size, static_cam, loc))

        has_dialogue = bool(DIALOGUE_QUOTE_RE.search(shot.picture))
        if has_dialogue:
            dialogue_count += 1
            for sp in SPEAKER_RE.findall(shot.picture):
                speakers.add(sp)

        if RELATION_SHOT_RE.search(shot.camera) or RELATION_SHOT_RE.search(shot.picture):
            relation_count += 1

        # 3a. Anti-PPT static talking head (smart: allows motivated long takes!)
        non_dialogue_pic = strip_dialogue(shot.picture)
        has_blocking = bool(BLOCKING_ACTION_RE.search(non_dialogue_pic))
        has_business = bool(BUSINESS_ACTION_RE.search(non_dialogue_pic))
        if has_dialogue and static_cam and not has_blocking and not has_business:
            if shot.duration >= profile_cfg["ppt_fail_sec"]:
                issues.append(
                    Issue(
                        "FAIL",
                        "PPT_STATIC_TALKING_HEAD",
                        loc,
                        f"单镜长达 {shot.duration:.1f}s 且为固定机位站桩念词（无走位调度、无手上活 Business、无运镜/焦点推进）。请改为：同视向拆多镜、增加镜内走位/手上活/运镜，或切听者反应+声桥。",
                    )
                )
            elif shot.duration >= profile_cfg["ppt_warn_sec"]:
                issues.append(
                    Issue(
                        "WARN",
                        "PPT_STATIC_TALKING_HEAD",
                        loc,
                        f"单镜 {shot.duration:.1f}s 为固定机位站桩念词，缺少走位、手上活或运镜变化，存在 PPT 感风险。",
                    )
                )

        # 3b. Abstract emotion without visible physical anchors
        m_abs = ABSTRACT_EMOTION_RE.search(non_dialogue_pic)
        if m_abs and not VISIBLE_BODY_RE.search(non_dialogue_pic):
            issues.append(
                Issue(
                    "WARN",
                    "ABSTRACT_EMOTION_ONLY",
                    loc,
                    f"出现抽象情绪词「{m_abs.group(0)}」但缺少可见身体/微表情落点（眼/眉/下颌/呼吸/手势）。",
                )
            )

        # 3c. Off-screen unbound full name leak
        if known_characters and unit.bound_characters:
            unbound = known_characters - set(unit.bound_characters)
            non_dialogue_combined = shot.camera + "\n" + non_dialogue_pic
            for uname in sorted(unbound):
                if len(uname) >= 2 and uname in non_dialogue_combined:
                    issues.append(
                        Issue(
                            "WARN",
                            "OFFSCREEN_NAME_LEAK",
                            loc,
                            f"画外未绑图角色「{uname}」全名出现在非对白画面/景别正文中，易诱导模型凭空画入画面；建议改为场内画外方向。",
                        )
                    )

        # 3d. Intra-unit posture regression
        if unit_stood_up and LYING_SITTING_RE.search(non_dialogue_pic) and not POSTURE_TRANSITION_RE.search(non_dialogue_pic):
            issues.append(
                Issue(
                    "WARN",
                    "POSTURE_REGRESSION",
                    loc,
                    "前镜已起身/站起，本镜又出现坐/躺态且缺少坐回/跌回过渡交代，存在姿态回退风险。",
                )
            )
        if STAND_UP_RE.search(non_dialogue_pic):
            unit_stood_up = True

    # 3e. Consecutive flat identical shots within unit
    for i in range(len(shot_meta_seq) - 2):
        s1, st1, _ = shot_meta_seq[i]
        s2, st2, _ = shot_meta_seq[i + 1]
        s3, st3, loc3 = shot_meta_seq[i + 2]
        if st1 and st2 and st3 and s1 != "未知" and s1 == s2 == s3:
            issues.append(
                Issue(
                    "WARN",
                    "CONSECUTIVE_FLAT_SHOTS",
                    loc3,
                    f"连续 3 镜均为固定机位「{s1}」，景别与运镜缺乏变化。",
                )
            )

    stats = {
        "shots": len(unit.shots),
        "static_shots": static_count,
        "dialogue_shots": dialogue_count,
        "relation_shots": relation_count,
        "speakers": speakers,
    }
    return issues, stats


def resolve_episode_prompt_files(project_dir: Path, episode: str) -> list[Path]:
    bindings_path = project_dir / "production" / "asset-bindings.v1.json"
    ep_upper = episode.upper()

    # Try active reference-plan first
    if bindings_path.is_file():
        try:
            data = json.loads(bindings_path.read_text(encoding="utf-8"))
            assets = data.get("assets") or data.get("bindings") or []
            ref_plans = [
                a for a in assets
                if isinstance(a, dict)
                and a.get("role") == "reference-plan"
                and str(a.get("status") or "") not in ("SUPERSEDED", "REJECTED")
                and ep_upper in str(a.get("path") or a.get("relativePath") or "").upper()
            ]
            if ref_plans:
                rp_rel = str(ref_plans[-1].get("path") or ref_plans[-1].get("relativePath") or "")
                rp_file = project_dir / rp_rel
                if not rp_file.is_file():
                    rp_file = project_dir / "library" / rp_rel
                if rp_file.is_file():
                    rp_data = json.loads(rp_file.read_text(encoding="utf-8"))
                    units = rp_data.get("units") or []
                    found: list[Path] = []
                    for u in units:
                        pp = u.get("promptPath")
                        if pp:
                            candidate = project_dir / pp
                            if not candidate.is_file():
                                candidate = project_dir / "library" / pp
                            if candidate.is_file():
                                found.append(candidate)
                    if found:
                        return found
        except Exception:
            pass

    # Fallback: latest version per unit in library/剧情/分集/<EP>/分镜/
    sb_dir = project_dir / "library" / "剧情" / "分集" / ep_upper / "分镜"
    if not sb_dir.is_dir():
        return []
    latest_by_unit: dict[str, Path] = {}
    ver_re = re.compile(r"^(.*?)-VIDEO-SHOT-PROMPT-v(\d+)\.md$", re.IGNORECASE)
    for p in sorted(sb_dir.glob("*-VIDEO-SHOT-PROMPT-*.md")):
        m = ver_re.match(p.name)
        if not m:
            continue
        unit_key, ver = m.group(1), int(m.group(2))
        prev = latest_by_unit.get(unit_key)
        if prev is None:
            latest_by_unit[unit_key] = p
        else:
            pm = ver_re.match(prev.name)
            if pm and ver > int(pm.group(2)):
                latest_by_unit[unit_key] = p
    return [latest_by_unit[k] for k in sorted(latest_by_unit.keys())]


def run_check(
    files: list[Path],
    profile: str = "balanced",
    extra_characters: list[str] | None = None,
) -> dict[str, Any]:
    profile_cfg = PROFILES[profile]
    parsed_units = [parse_prompt_file(f) for f in files]

    known_characters: set[str] = set(extra_characters or [])
    for u in parsed_units:
        known_characters.update(u.bound_characters)

    all_issues: list[Issue] = []
    total_shots = 0
    total_static = 0
    total_dialogue = 0
    total_relation = 0
    all_speakers: set[str] = set()

    for unit in parsed_units:
        u_issues, stats = check_unit(unit, profile_cfg, known_characters)
        all_issues.extend(u_issues)
        total_shots += stats["shots"]
        total_static += stats["static_shots"]
        total_dialogue += stats["dialogue_shots"]
        total_relation += stats["relation_shots"]
        all_speakers.update(stats["speakers"])

    # Episode-level anti-PPT checks
    if total_shots >= 4:
        static_ratio = total_static / total_shots
        if static_ratio > profile_cfg["max_static_ratio"]:
            all_issues.append(
                Issue(
                    "WARN",
                    "EPISODE_FIXED_CAMERA_RATIO",
                    f"EP_SUMMARY({len(parsed_units)}单元/{total_shots}镜)",
                    f"全集固定机位占比 {static_ratio:.0%}（{total_static}/{total_shots}镜），超过「{profile}」档建议上限 {profile_cfg['max_static_ratio']:.0%}；建议在情绪推进或走位处补入有动机的运镜或焦段变化。",
                )
            )

    if total_dialogue >= 4 and len(all_speakers) >= 2 and total_relation == 0:
        all_issues.append(
            Issue(
                "WARN",
                "LONG_DIALOGUE_NO_RELATION_SHOT",
                f"EP_SUMMARY({total_dialogue}句对白镜/{len(all_speakers)}位说话人)",
                "多轮双人对白全程均为孤立单人镜头，缺少双人同框或过肩关系镜，容易显得各自念稿；建议至少补入 1 处双人关系镜。",
            )
        )

    fail_count = sum(1 for i in all_issues if i.severity == "FAIL")
    warn_count = sum(1 for i in all_issues if i.severity == "WARN")
    return {
        "profile": profile,
        "filesChecked": [str(f) for f in files],
        "summary": {
            "units": len(parsed_units),
            "shots": total_shots,
            "staticShots": total_static,
            "staticRatio": round(total_static / total_shots, 3) if total_shots else 0.0,
            "dialogueShots": total_dialogue,
            "relationShots": total_relation,
            "speakers": sorted(all_speakers),
            "fail": fail_count,
            "warn": warn_count,
            "passed": fail_count == 0,
        },
        "issues": [
            {
                "severity": i.severity,
                "code": i.code,
                "location": i.location,
                "message": i.message,
            }
            for i in all_issues
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Cinema & anti-PPT quality check for video-shot-prompt-v2.")
    parser.add_argument("--project-dir", type=Path, help="Project directory inside workspace.")
    parser.add_argument("--episode", type=str, help="Episode ID, e.g. EP52.")
    parser.add_argument("--file", dest="files", action="append", type=Path, help="Prompt markdown file(s) to check.")
    parser.add_argument("--profile", choices=sorted(PROFILES.keys()), default="balanced", help="Visual style profile.")
    parser.add_argument("--character", dest="characters", action="append", default=[], help="Known character names.")
    parser.add_argument("--json", action="store_true", help="Output JSON report.")
    args = parser.parse_args()

    target_files: list[Path] = []
    if args.files:
        target_files.extend(args.files)
    elif args.project_dir and args.episode:
        target_files = resolve_episode_prompt_files(args.project_dir, args.episode)
    else:
        parser.error("请指定 --file <提示词.md> 或同时指定 --project-dir 与 --episode。")

    missing = [f for f in target_files if not f.is_file()]
    if missing or not target_files:
        print(f"ERROR: 未找到可检查的提示词文件: {missing or target_files}", file=sys.stderr)
        return 2

    report = run_check(target_files, profile=args.profile, extra_characters=args.characters)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        s = report["summary"]
        status = "PASS" if s["passed"] else "FAIL"
        print(
            f"[cinema-gate:{status}] profile={report['profile']} | "
            f"units={s['units']} shots={s['shots']} static={s['staticShots']}/{s['shots']} ({s['staticRatio']:.0%}) "
            f"relation={s['relationShots']} | FAIL={s['fail']} WARN={s['warn']}"
        )
        for item in report["issues"]:
            print(f"  [{item['severity']}] {item['code']} @ {item['location']}: {item['message']}")

    return 0 if report["summary"]["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
