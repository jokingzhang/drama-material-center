---
name: ruic-character-reference
description: 从 RuiC-PoseAtlas 人像图库为女性角色检索、查看和比较脸部或造型参考，按需将选中原图导入当前短剧，再衔接人物外形设计。用于新女性角色选脸、指定图库 ID 或图库辅助造型；已有角色换装沿用已选身份。
---

# 女性角色图库选型

由当前主会话执行，可由 [人物外形设计](../character-visual-designer/SKILL.md) 按需调用。图库提供参考候选；人物身份、剧情与用户选择沿用实际项目，不从图库反推人物性格，不替代人物设计。素材目录、生成与验收仍执行 [AGENTS.md](../../../AGENTS.md#31-项目素材-schema创建前必读) 和 [制作 SOP](../../../PRODUCTION_SOP.md)。

## 检索与实际看图

先恢复角色全名、`characterId`、已有脸和 `lookId`、剧情可见要求及同场易混淆角色。已有用户选脸直接复用；换装只找必要的发型／造型灵感，不重新选身份。当前任务仅要求封装技能、分析或检索时，不自动生图、上传或运行视频。

使用 [scripts/atlas.py](scripts/atlas.py)，从仓库根目录运行。图库位置按 `--atlas-root` → `RUIC_ATLAS_ROOT` 环境变量 → 仓库同级 `RuiC-PoseAtlas/` 定位；缺失时报告需要配置的实际路径，不另行克隆或搬动全库。`doctor / search / show` 只读、离线，不下载图片。

```bash
python3 .agents/skills/ruic-character-reference/scripts/atlas.py doctor
python3 .agents/skills/ruic-character-reference/scripts/atlas.py search --section face --hair long --limit 12
python3 .agents/skills/ruic-character-reference/scripts/atlas.py search --query '短发' --offset 12 --limit 12
python3 .agents/skills/ruic-character-reference/scripts/atlas.py show --id f000fa12e8d
# 改图库位置时，全局参数放在子命令前：
python3 .agents/skills/ruic-character-reference/scripts/atlas.py --atlas-root /path/to/RuiC-PoseAtlas doctor
```

- 数据只有分区、发型、部分发型细节、尺寸和图片位置等字段。脸型、年龄感、气质及与既有角色的差异，必须实际打开候选图判断，明确为本次视觉观察；没有语义标签、性别标签、原始生成提示词或人脸相似度服务。字段细节及来源按需读 [数据与来源](references/data-and-sources.md)。
- 先用元数据缩小范围，分批查看脚本返回的本地缩略图，给出有区别且与剧情相关的候选和具体理由。数量随任务，不默认通读全库、下载全库或要求用户填筛选表。无关键词命中时调整真实可用的筛选维度，不能编造命中结果。
- 缩略图适合初选，不证明原图细节合格。最终使用前查看选中原图；未知侧脸、背面、身体和衣服结构由人物设计补成候选，不说图库已经提供了这些视图。
- `face` 主要参考身份，`styling` 主要参考发型、服饰与整体感觉。不同 ID 不默认是同一个人；同一张脸也不保证后续模型锁脸。若图中服装、姿态或背景与消费者冲突，应清理参考或调整输入方案，不只写“忽略原衣服”。

## 选中后导入当前短剧

脚本从本仓库 `.env.local` 的 `MATERIAL_CENTER_WORKSPACE` 解析实际工作区，未配置时使用 `workspace/`。创建项目前先核对配置、项目 `project.json`、正式索引、目标目录及 Git 状态；按根规则声明五字段。导入图为 `media.reference`、主体为当前角色／造型、目录为 `library/图片/参考/`、版本为 `vNN`，`storyBinding=false`；导入记录为 `record.creative`，在 `创作记录/ruic-character-reference/selection/<run-id>/`，`version=v01`，`storyBinding=false`。参考的真实消费者须明确到当前角色造型的标准图或设计任务。

```bash
# 示例中的业务 ID 须换成本次核实或明确设计的新造型 ID；先预览：
python3 .agents/skills/ruic-character-reference/scripts/atlas.py import \
  --id f000fa12e8d --project-id your-drama \
  --character-id CHAR-001 --look-id LOOK-FIRST-APPEARANCE \
  --role face --consumer 'CHAR-001 / LOOK-FIRST-APPEARANCE 人物标准图' --version v01
# 已授权导入时加 --apply；本地没有原图且允许按 ID 下载时再加 --allow-download。
```

导入只复制选中的原图；本地没有时可从该条 `full_remote` 下载到目标项目，不写回外部图库。拒绝覆盖、符号链接、越界路径及字节数／PNG 尺寸／结构校验不符，保留源文件。清单记录项目内路径、来源 ID／URL、图库版本与数据哈希、原图 SHA-256、职责和消费者。参考保持 `DRAFT / NOT_REVIEWED`，文件校验不等于视觉或人工接受。失败时按记录修复，只补缺项，不清理旧文件。

后续提示词、任务、节点和正式绑定只引用当前短剧内的副本；外部图库路径仅供读取来源，不能成为生产依赖。图册编号和比较说明仅供选型，不作为模型参考。导入命令不修改正式索引；生成的人物标准图需要按现有流程登记 `image.character` 和完整主体、哈希，并经 API／页面回读。导入参考不算完成角色制作。

## 人物设计与生成入口

将选中的参考交给 [人物外形设计](../character-visual-designer/SKILL.md)，分清固定脸部身份、当前服装发型和镜头表演。人物标准图继续使用 [3:4 四宫格规范](../../../director-knowledge-base/图片素材/人物标准图.md)，不是照搬图库人像的4:5比例；每个角色每套造型默认一张，已有可用素材不追溯重做。

**默认使用已安装的 `$imagegen` Skill 和 Codex 内置 `image_gen` 工具**，主要角色也不自动切到 Lib Image。用户明确指定 LibTV 时使用已安装的 `$libtv-cli` Skill，经官方 `libtv` CLI 选择和核实本次模型／参考能力，再执行获授权的图片任务。`libtv-cli` 是入口，不是模型名称；用户只指定入口时，不把某个示例模型视为用户指定。

现有针对当前范围的工具、模型、预算和输入方式选择继续有效。内置工具失败时说明失败，不自动改走 LibTV、OpenAI API 或自制生图脚本。支持指定 LibTV 不等于已经授权本次远端写入或花费。

允许图片参考时先实际查看项目内原图，再按所选工具绑定确切副本与参考职责；用户要求纯文生时只把观察转成文字，不传图片。生成后将选中输出复制到标准业务目录，原尺寸检查四格身份、造型和小脸一致性，完成正式绑定和 API／页面回读。报告检索／导入、媒体生成、实际查看、业务接入与人工接受的各自状态；视频试片仍按 SOP 和独立授权执行。
