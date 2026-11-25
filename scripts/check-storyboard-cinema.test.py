#!/usr/bin/env python3
"""Unit tests for scripts/check-storyboard-cinema.py."""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve().parent / "check-storyboard-cinema.py"
spec = importlib.util.spec_from_file_location("check_storyboard_cinema", SCRIPT_PATH)
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)


def write_temp_prompt(tmpdir: Path, name: str, content: str) -> Path:
    p = tmpdir / name
    p.write_text(content.strip() + "\n", encoding="utf-8")
    return p


class CinemaGateTests(unittest.TestCase):
    def test_catches_long_static_talking_head_ppt(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = write_temp_prompt(
                Path(td),
                "U04.md",
                """
**总时长：15秒｜画幅：9:16｜现场原声对白、无配乐和字幕｜场景：秋实工作室·日**

**人物资产：**
- {{Node i-1}}｜霍景深｜黑西装｜镜头1｜延续身份

[整体场景与氛围]
午后工作室柔和日光。

【多分镜时间轴】

### 0.0s–15.0s｜镜头1：干念长词
**景别与镜头运动：** 单人肩上近景，固定机位稳住眼睛的焦点。
**画面与动作：** 霍景深眼眶泛红，嘴唇微张开口。霍景深：「霍氏的钱足够养你十辈子！你为什么就不能乖乖躲在我的身后？」说完合上嘴目光停在原处。
**光影表现：** 柔和窗光落在眼周。
**音效：** 霍景深固定音色。
""",
            )
            rep = mod.run_check([p], profile="balanced")
            codes = [(i["severity"], i["code"]) for i in rep["issues"]]
            self.assertIn(("FAIL", "PPT_STATIC_TALKING_HEAD"), codes)
            self.assertFalse(rep["summary"]["passed"])

    def test_allows_motivated_long_take_with_blocking_and_camera_motion(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = write_temp_prompt(
                Path(td),
                "U06.md",
                """
**总时长：14秒｜画幅：9:16｜现场原声对白、无配乐和字幕｜场景：秋实工作室·日**

**人物资产：**
- {{Node i-1}}｜江砚秋｜黑裙｜镜头1｜延续身份

[整体场景与氛围]
午后工作室，长桌与玻璃出口在画面纵深两端。

【多分镜时间轴】

### 0.0s–14.0s｜镜头1：抱账本离开
**景别与镜头运动：** 中景侧45度机位，随江砚秋起身转身缓慢横移并小幅摇向玻璃门出口。
**画面与动作：** 江砚秋合上墨绿文件夹抱进怀里，直起身绕过桌沿走向出口，边走边沉声开口。江砚秋：「从今天起，你我两清。」推开玻璃门步入走廊。
**光影表现：** 拱窗柔光掠过肩线与走廊玻璃。
**音效：** 文件夹合拢声、鞋跟步幅与江砚秋固定音色。
""",
            )
            rep = mod.run_check([p], profile="balanced")
            self.assertTrue(rep["summary"]["passed"])
            self.assertEqual(rep["summary"]["fail"], 0)

    def test_allows_long_static_shot_when_rich_business_present(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = write_temp_prompt(
                Path(td),
                "U02.md",
                """
**总时长：11秒｜画幅：9:16｜现场原声对白｜场景：书房·夜**

**人物资产：**
- {{Node i-1}}｜江砚秋｜黑裙｜镜头1｜延续身份

[整体场景与氛围]
书房暖台灯照亮桌面。

【多分镜时间轴】

### 0.0s–11.0s｜镜头1：摘戒推纸
**景别与镜头运动：** 中景侧45度固定机位，人物双手与桌面完整入画。
**画面与动作：** 江砚秋垂眼摘下左手钻戒，稳稳压在声明纸上推向桌面另一侧，指尖收回后抬眼直视画外。江砚秋：「这枚戒指和这份协议，我今天一并还你。」
**光影表现：** 台灯侧光在金属戒面与纸沿拉出投影。
**音效：** 钻戒轻碰纸面脆响与江砚秋固定音色。
""",
            )
            rep = mod.run_check([p], profile="balanced")
            self.assertTrue(rep["summary"]["passed"])

    def test_catches_meta_leaks_and_offscreen_name_and_relation_missing(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p1 = write_temp_prompt(
                Path(td),
                "U01.md",
                """
**总时长：6秒｜画幅：9:16｜现场原声｜场景：会客室**

**人物资产：**
- {{Node i-1}}｜江砚秋｜黑裙｜镜头1｜延续身份

[整体场景与氛围]
按 E04 权力几何设计，J-cut 切入。

【多分镜时间轴】

### 0.0s–6.0s｜镜头1：质问
**景别与镜头运动：** 固定近景。
**画面与动作：** 江砚秋直视画外霍景深的方向，推回文件夹。江砚秋：「你到底想干什么？」
**光影表现：** 窗光侧照。
**音效：** 对白清晰。
""",
            )
            rep = mod.run_check([p1], profile="balanced", extra_characters=["江砚秋", "霍景深"])
            codes = {i["code"] for i in rep["issues"]}
            self.assertIn("META_LEAK", codes)
            self.assertIn("OFFSCREEN_NAME_LEAK", codes)
            self.assertFalse(rep["summary"]["passed"])


if __name__ == "__main__":
    unittest.main()
