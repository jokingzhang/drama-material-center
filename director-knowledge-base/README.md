# AI 导演项目知识库

本目录是 `drama-material-center` 的项目级导演知识库，由 `.agents/skills/ai-director/` 检索和维护。

它保存三种不同层次的信息：

- `标准/`：本项目当前采用的规划规范，以 `policyStatus` 表示是否启用；
- `知识卡/`：从外部案例或自有生产得到的机制与风险，以 `OBSERVED / REUSABLE / VALIDATED` 表示证据成熟度；
- `案例/`：可追溯的来源、节点、媒体检查与未知项。

`ACTIVE` 只表示当前项目采用，不表示已经保证成片。只有经过自有生产、实际播放或试听并由人确认的记录，才能把知识提升到 `VALIDATED`。

标准的整体证据成熟度也不能遮住局部弱证据。`.ai-director/index.json` 中的 `evidenceOverrides` 会单独标出仍为 `OBSERVED`、必须先做代表试片的镜头子类型。当前没有独立 `workflow` 域知识卡；这是公开的证据缺口，不通过创建无实证卡片来填数。

图片、视频、音频、接触表和下载缓存不得进入本目录；它们继续保存在 Git 忽略的 `.qa/` 或项目素材工作区。这里仅保存 Markdown、URL、节点键、事实摘要和验证记录。

校验：

```bash
node .agents/skills/ai-director/scripts/director_kb.mjs validate \
  --root "$(git rev-parse --show-toplevel)/director-knowledge-base"
```

读取当前标准：

```bash
node .agents/skills/ai-director/scripts/director_kb.mjs standards \
  --root "$(git rev-parse --show-toplevel)/director-knowledge-base" \
  --policy-status ACTIVE
```
