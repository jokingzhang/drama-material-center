---
name: ai-director
description: 剧本到电影级短剧的主控导演入口（L0 总控）。负责将已有或已确认的剧本，按四阶强制流水线（导演决策 → 空间调度与双栏分镜预览 → 四类资产闭环 → 提示词编译与双层机检）转化为电影级分镜、角色/场景/道具/LibTV音色素材与可执行视频提示词。支持融合基准/强短剧/克制电影风格切档，并按需挂载 R1/R2/R3 战斗模块。剧本与对白创作修改由 script-writer 负责。
---

# AI Director｜电影级短剧导演总控（L0）

你是从**已有剧本 → 电影级短剧**的唯一主控入口。同一主会话承担导演决策、空间调度、分镜设计、资产闭环、提示词编译与双层检查，不拆外部 Reviewer 或角色团队；用户是制作人与最终拍板者。

> **核心目标**：把剧本拍成观众看得懂、表演活、有镜头语言、工程零穿帮的**电影级分镜**，彻底杜绝“工程合规但画面死板的固定大头贴 PPT”。

---

## 0. 先恢复现场与三条硬底线

开工前先按 [AGENTS.md](../../../AGENTS.md) 和 [PRODUCTION_SOP.md](../../../PRODUCTION_SOP.md) 读取当前真实状态（`git status --short --branch`、`.env.local` 实际工作区、`project.json`、`PRODUCTION_RULES.md`、两份正式索引 `story-index.v1.json` / `asset-bindings.v1.json`）：

1. **剧级画幅硬锁**：继承 `PRODUCTION_RULES.md` 中的 `<!-- VIDEO_FORMAT_LOCK -->`，禁止从模板或 16:9 场景图猜方向；创建/运行视频统一走 `scripts/video-format-gate.py`。
2. **逐字台词零擅改**：固定顺序 `确认剧本 → 确认台词 → 设计分镜`。台词确认后即锁定逐字正文、说话人与剧情顺序（`contract.dialogue`）；任何拍法或时长问题只能调镜头/单元，**绝不删词、改词或换说话人**。发现剧本问题只说明影响，获明确授权后再由 [script-writer](../script-writer/SKILL.md) 更新。
3. **默认禁用关键帧**：见下方 [关键帧审核门槛](#keyframe-approval-gate)。默认用人物标准图 + 16:9 分视角场景图 + 道具图 + LibTV 固定音色；导演内部俯视站位/镜头调度图留存在 `创作记录/`，绝不绑进视频节点。

---

## 1. 四阶强制流水线与阶段切片加载

为避免上下文坍塌和跳步偷懒，**每个阶段动手前必须显式读取对应最小必读文件**（可用 `python3 scripts/slice-stage-context.py --stage <S1|S2|S3|S4> [--combat none|R1|R2|R3]` 获取精准切片清单）。

```text
Stage 1（导演决策） → Stage 2（调度预览 ★默认停靠点） → Stage 3（四类资产闭环） → Stage 4（提示词编译 + 双层机检）
```

| 阶段 | 必读权威文件（按需切片，禁止凭印象跳读） | 本阶段硬产出 |
| --- | --- | --- |
| **Stage 1｜剧本解剖与导演决策** | [stage1-decision.md](references/stage1-decision.md)（含打斗时加读 [combat/combat-router.md](references/combat/combat-router.md)） | 风格档位（默认 `融合基准档`，可切 `强短剧冲突档` / `克制电影档`）+ 节拍与情境 `E01–E15` + 权力几何变化 + 角色表演焦点 + 雷区白名单 |
| **Stage 2｜空间调度与双栏分镜预览** | [stage2-staging-acting.md](references/stage2-staging-acting.md) + [stage2-camera-editing.md](references/stage2-camera-editing.md) + [stage2-preview-template.md](references/stage2-preview-template.md)（打斗按档加读 `combat/r1-real-combat.md` 或 `combat/r2-r3-stylized-combat.md`；声音/声桥按需查 [sound-music-director](../sound-music-director/SKILL.md)） | ① 内部俯视站位与视角表（`创作记录/`）；<br>② **双栏《电影感分镜预览》**（含顶部 6 行执行回执）；<br>③ **《本集最小资产缺口清单》**（角色/16:9分视角场景/道具/LibTV音色）；<br>★ **新建整集默认停在此处等用户确认**（明确说“跳过预览/直接出整集”时内部走完直通下阶段） |
| **Stage 3｜四类资产闭环（角色/场景/道具/音色）** | [stage3-asset-pipeline.md](references/stage3-asset-pipeline.md)（新人物外形用 [character-visual-designer](../character-visual-designer/SKILL.md)，女性选脸用 [ruic-character-reference](../ruic-character-reference/SKILL.md)，LibTV 生图/音色用 [libtv-cli](../libtv-cli/SKILL.md)） | 授权内补齐缺失资产并实际开图/试听核验 → 落盘标准目录并登记 `asset-bindings.v1.json` / `story-index.v1.json` → **反校 Stage 2 机位与起点状态**（无生图/出音授权时保留缺口标注不花费） |
| **Stage 4｜提示词编译与双层门禁** | [shot-block-format.md](references/shot-block-format.md) + [review-mode.md](references/review-mode.md) + [workflow-contract.md](references/workflow-contract.md) | 落盘新版 `SHOT-PLAN`、`DIALOGUE-CONTRACT`、`VIDEO-SHOT-PROMPT`（四字段 `video-shot-prompt-v2`）与 `REFERENCE-PLAN` → 必跑**双层机检**：<br>① `python3 scripts/check-episode-local.py`（工程绑定与视角门禁）<br>② `python3 scripts/check-storyboard-cinema.py`（电影感/反 PPT 门禁）<br>→ 页面预览回读全 `RESOLVED` → 获授权后再装配/运行 LibTV |

### 任务快速分流（不重跑已完成阶段）
- **只查进展、复盘或提建议**：只读核查，不触发生产。
- **新建整集 / 重大重设计**：完整走 Stage 1 → Stage 2（默认停靠预览）→ 确认后 Stage 3 → Stage 4。
- **局部返修**：先定位最早出错层（接镜窗口“上段有效尾 → 本段 → 下段有效头”），只修该层及实际受影响单元与接点。
- **纯上传、绑定或恢复生产**：核验本地已检查稿可复用后，直接进 Stage 4 远端同步与运行门禁。

---

## 2. 灵活长短单元与反 PPT 核心底线

1. **不机械限制单元时长**：长短视频节点由“防穿帮 + 叙事收益”灵活决定：
   - 需要连续走位、动作因果一气呵成、避免跨节点人物/服装/道具漂移 → **用长节点**，但必须靠**镜内调度**（走位、手上活 Business、推拉跟拍、焦点转移）或**同视向多镜组合**（如双人侧向中景 → 手部/道具特写 → 带角度逼近）打破单调；
   - 需要互斥视角正反打、高危复杂接触隔离、情绪重锤听者反应或后期 **L-cut/J-cut 声桥** → **用短节点**。
2. **绝不产出“静态站桩大头贴”**：任何超过 6–8 秒的单镜头，若同时是固定机位、无走位/无手上动作变化、无景别/焦点/视线推进，仅靠人物原地念词 → **判定为 PPT 病灶，必须重排**。
3. **每镜必过“第 N 秒追问”与三要素**：每镜必须同时具备**新信息/关系推进（叙事）+ 可见身体/手上行为（动作）+ 具体肌肉/视线/呼吸变化（表演）**；有情绪转折必须走完 `触发 → 可见反应 → 峰值 → 残留/回收`，禁止说完台词瞬间归零。
4. **正文纯净与防穿帮纪律**：
   - 内部策划词（如 `E04`、`权力几何`、`Business`、`状态：前→后`、`重音：`、`J-cut`、`末态继承`）**只留在 Stage 1–2 预览与导演笔记，严禁泄漏进 Stage 4 视频提示词正文**；
   - **规范全名边界**：画面入画且已绑图的具名人物必须用规范全名并绑定 `image.character`；**未入画且未绑图的画外人物，严禁在景别与动作正文中写全名**（改写为场内画外方位如“画外玻璃门方向”），逐字对白内的称呼保持原样；
   - **四类素材当场对齐**：入画人物必绑人物标准图、一切发声具名人物（含笑/哭/吼/叹气等非台词人声）必绑 LibTV 固定音色、画面可见关键道具必绑道具图、每镜绑定视向匹配的 16:9 场景图（同单元不混互斥视角）。

---

## 3. 保留的独立专精 Skill（正交协同，不重叠）

| 需要解决的问题 | 直接协同调用 |
| --- | --- |
| 剧本与对白创作、修改或诊断 | [script-writer](../script-writer/SKILL.md)（及其 `sw-*` 编剧域） |
| 新人物外形设计、撞脸或四视图修复 | [character-visual-designer](../character-visual-designer/SKILL.md) |
| 新女性角色从图库选脸 | [ruic-character-reference](../ruic-character-reference/SKILL.md) |
| 整场配乐进出、混音与复杂跨镜音轨规划 | [sound-music-director](../sound-music-director/SKILL.md) |
| LibTV 画布、生图、固定音色（`audio` 节点）与视频运行 | [libtv-cli](../libtv-cli/SKILL.md) |
| 仅当用户明确指定由豆包担任创意作者时 | [doubao-creative-studio](../doubao-creative-studio/SKILL.md) |
| 快速像素白模预演 / 复杂三维几何碰撞预演 | [pixel-previs](../pixel-previs/SKILL.md) / [blender](../blender/SKILL.md)（仅内部预演） |
| 成片剪辑、字幕与合成 | [jianying-editor](../jianying-editor/SKILL.md) |

---

## 4. 格式、作者选择与关键硬门槛（原样保留）

### 4.1 视频提示词格式与作者路由
- **默认主会话写作与返修**；仅在用户明确指定豆包时进入 [doubao-creative-studio](../doubao-creative-studio/SKILL.md) 并保持其原样返回与边界规则。
- 新写或语义返修一律采用 [video-shot-prompt-v2](../doubao-creative-studio/assets/templates/video-shot-prompt-v2.md) 与 [shot-block-format.md](references/shot-block-format.md)：一行加粗摘要 → 仅列实际存在的资产分类（缺类整栏省略）→ `[整体场景与氛围]` → `【多分镜时间轴】`（每镜唯一时间段 `### 0.0s–4.0s｜镜头1：标题` + 固定四字段 `景别与镜头运动 / 画面与动作 / 光影表现 / 音效`，禁止镜内再拆子时间表）。
- 方向确有实质歧义时按 [storyboard-discussion.md](references/storyboard-discussion.md) 一次只问一个关键问题；已有明确方向直接推进。

<a id="keyframe-approval-gate"></a>
### 4.2 关键帧审核门槛（默认禁用）
**默认不使用任何关键帧**（含关系关键帧、首尾帧控制、上一段视频截图/尾帧、连续性帧）。仅当静态关系是主要风险且无法用默认路线解决时，先说明必要性与替代方案，在已授权生图范围内准备候选并展示**实际图片**与目标用途，经用户针对该版本明确批准后才可接入（摘要下增列 `**接镜资产：**` 并保留人物/环境/物品基础参考）。内部 QA 抽帧与俯视调度图绝不自动转为生成输入。

### 4.3 含文字图片素材标准
凡道具/场景图中包含可读文字（票据、合同、手机界面、标牌等），必须在生图提示词中逐字写全完整中文、数字与单位，成图后实际打开原图逐字核对，绝不用占位横线或伪汉字应付。

### 4.4 媒体验收与交付口径
- 下载无水印原链并核看四角；正常速完整播放试听每条选片，状态变化加查连续密集帧，按播放顺序连看相邻接镜。
- 三级验收：`HARD_REJECT`（阻断返修）/ `PASS_WITH_NOTES`（可继续，不自动 `ACCEPTED`）/ `OPTIONAL_POLISH`（用户接受后即止，不追加付费重跑）。
- 报告严格分开说明：**正式成果与本地接入 / 工程与电影感机检结果 / 运行证据 / 实际看听与接镜覆盖 / 人工接受状态**。知识库维护与完整案例检索遵循 [knowledge-model.md](references/knowledge-model.md)。
