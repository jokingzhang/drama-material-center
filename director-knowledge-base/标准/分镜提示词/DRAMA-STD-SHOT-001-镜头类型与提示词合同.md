# DRAMA-STD-SHOT-001｜镜头类型与提示词合同 v0.1.2

## 适用范围

本标准用于把剧本的 scene beat 拆成可生成单元，为每个单元选择一个 primary shot type，并形成交给创意提示词作者的 ShotPromptPlan。统一模板只作为外层合同；不同类型有不同必填控制项。

本标准是 `ACTIVE` 项目策略，证据成熟度为 `REUSABLE`。当前案例主要为横屏，类型机制可用于竖屏规划，但竖屏景别、安全区和队形仍需专门案例或代表试片。

## 输入

- 已绑定的剧本事实、世界与类型合同；
- scene/beat 的观众效果、开始状态和不可逆结束状态；
- 已验收或明确缺失的 AssetPlan 与逐镜参考职责；
- 对白、声音、连续性、目标模型、画幅和时长；
- 当前 `ACTIVE` 图片素材标准和相关知识卡。

## 决策规则

### 1. 每个 generation unit 恰好一个 primary type

| Shot type | 选择条件 | 最小素材职责 | 提示词特有必填字段 |
| --- | --- | --- | --- |
| `ESTABLISHING_REVEAL` | 主要信息是空间、尺度、环境变化 | 干净场景；必要的剧情道具 | 信息出现顺序、尺度线索、环境微运动、镜头落点 |
| `ENTRANCE_REVEAL` | 主要信息是人物/怪物如何被看见 | 主体当前状态 + 场景 | 特征揭示顺序、入口、移动路线、观察者反应、终态姿势 |
| `DIALOGUE_PERFORMANCE` | 主要信息由说听关系和表演传递 | 每个可见人物 + 场景 + 逐人声音 | 说话人、逐字台词、意图、时间、嘴部可见、听者反应 |
| `MICRO_EMOTION_REACTION` | 主要信息是微情绪或关系变化 | 人物 + 触发物/对方 + 场景 | 触发、眼神、微动作、对方反应、情绪落点 |
| `SOLO_PERFORMANCE` | 主要信息是一个人物独立完成的身体、舞蹈或仪式表演句 | 当前人物 + 场景；必要时加手持物或起止姿势关键帧 | 表演意图、动作句、重心与节奏、视线与手势、开始姿势、结束姿势 |
| `TWO_SUBJECT_INTERACTION` | 主要信息是两个主体在不以对白或接触为核心时的主动—响应关系 | 两个主体 + 场景 + 关系/尺度关键帧 | 主动者、响应者、距离与尺度、运动路径、视线、避让/呼应、结束关系 |
| `PHYSICAL_CONTACT` | 主要信息是一次接触或喜剧因果 | 人物/物体 + 关系关键帧 | 轴线、路径、接触点、干扰物、反作用、结束状态 |
| `CHASE_FOLLOW` | 主要信息是空间路径和追逐关系 | 主体 + 路线场景 + 关键障碍 | 路径、方向、障碍、相机路线、避让、追逐结果 |
| `FIGHT_IMPACT` | 主要信息是攻防和力量结果 | 战斗者 + 武器 + 场景 + 开场关系 | 武器归属、攻防轴、攻击路径、接触、反作用、结果 |
| `STATE_TRANSITION` | 主要信息是从 A 状态到 B 状态 | before + after；按需 transition | 触发、状态阶梯、传播/操作、完成判据、终态停留 |
| `PROP_OPERATION_INSERT` | 主要信息是物件操作或状态变化 | 道具状态 + 操作者 | 手物关系、操作顺序、特写机位、完成状态 |
| `MONTAGE` | 多个简单插镜共同表达时间、氛围或主题 | 与每个插镜有关的最小资产 | 每镜一个对象、一个运动、一个信息作用、共同光色/声音 |
| `CONTINUITY_REPAIR` | 主要任务是续接前镜或定向修复 | 有效实际帧 + 失败项相关资产 | 必须保持、仅修改、起止状态、接镜出口、复查项 |
| `ENSEMBLE_CHOREOGRAPHY` | 主要事件是领舞与群体队形变化 | 领舞 + 群演类型板 + 场景/阵型关键帧 | 人数、主角唯一性、起止阵型、同步规则、层级、遮挡、声音接点 |

相邻类型按“观众必须读清的主要事件”消歧：逐字说听关系优先 `DIALOGUE_PERFORMANCE`；可见 A→B 变化优先 `STATE_TRANSITION`；攻防、扑咬、格挡或力量胜负优先 `FIGHT_IMPACT`；接触点和接触后果本身是信息时选 `PHYSICAL_CONTACT`；持续路线与追逃关系选 `CHASE_FOLLOW`；没有对白、攻击和接触主任务的双主体主动—响应才选 `TWO_SUBJECT_INTERACTION`。单人动作句是主要信息、另一主体只承担最终反应时选 `SOLO_PERFORMANCE`；双方响应过程都必须读清时改选 `TWO_SUBJECT_INTERACTION`。仍无法确定时拆单元，不靠类型名猜测。

### 2. Modifier 不替代 primary type

- `RITUAL`：故事语义、服装、美术、声音和表演语汇；可修饰出场、状态转换、群体编舞或蒙太奇，不单独作为 primary type。
- `CONTINUOUS_TAKE`、`DIALOGUE`、`CROWD_BACKGROUND`、`SLOW_MOTION`：只添加特定约束。群体只是背景时，primary type 仍按前景主事件选择，例如 `SOLO_PERFORMANCE`。
- `PERFORMANCE_MONTAGE_CANDIDATE`：明确以候选采样为目标；必须声明选片、成本和停止条件，不得称为确定性叙事完成。
- `MULTI_SHOT_CONTAINER`：组织多个低风险镜头；每个子镜仍要有功能和时间，不是万能类型。

### 3. 拆分规则

出现以下任意两项独立高风险机制时，默认拆成多个 generation units，除非代表试片真实覆盖组合风险：逐字对白、复杂变身、近身接触、多人物群舞、群战、巨物尺度、复杂特效、重大转场、精确连续性。

规划节拍预算：对白或细腻表演每个有效节拍约 3–5 秒；高速动作快照约 1.5–3 秒；4–6 秒只保留一个高因果动作；10–15 秒通常保留 3–5 个连续阶段。它们是拆分启发，不是模型保证。

时长采用三层合同：`deliveryTotalDuration` 是整段交付总长，`unitDurationBudget` 是导演为 generation unit 分配的暂定预算，`nodeDuration` 是实时模型和节点实际支持的精确时长。所有 unit 预算与预留剪辑过渡必须能回算到总长；模型或节点未定时只写动作次序和暂定范围，把精确时间盒标为 `UNKNOWN` 并阻止 prompt-ready。模型确定后，才把每个 unit 落为从 0 覆盖到 `nodeDuration` 的秒级时间盒。

### 4. 统一外层合同

所有类型共同包含：

- `shotType`、交付总长上下文、unit 暂定预算、精确 `nodeDuration` 状态、aspect ratio、模型假设、`DIR-*` 决策 ID；
- 一对一 `referencePlan` 与连续性锁；
- 时间段、画面/机位、相机运动、主体动作或表演、空间关系、接触或结果；
- 对白/声音、终态、剪辑出口；
- 只针对当前风险的负面约束；
- 事实、引用、时长、参数、媒体预算和播放验收。

时间码统一为 `0.0–2.4s`，不得使用含义可能是分秒的 `0:00–2:40`。

## 输出合同

每个 `ShotPromptPlan` 至少记录：

- `unitId`、source locator、story function、audience effect；
- `primaryShotType` 与可选 modifiers、选择理由和不适用类型；
- start state、beats、timeboxes 或明确的 `UNKNOWN`、turn/contact、reaction、end state；
- 景别/角度/相机、主体运动、轴线、视线、遮挡、前后景；
- exact dialogue、speaker、intent、voice、mouth visibility；
- `referencePlan`、缺失和预算排除；
- edit entrance/exit、failure signals、fallback split；
- machine checks、actual playback/listening、human approval 三层 acceptance；
- 采用的标准和知识卡成熟度。

ShotPromptPlan 是导演合同，不是最终创意 prose。只有 APPROVED 后才把冻结事实、硬约束和创意余量交给 `$doubao-creative-studio`。

## 验收

- 每个 generation unit 只有一个 primary type，且与主要可见事件相符；
- 所选类型的特有字段完整，不相关模板字段没有硬填；
- 时间轴从 0 覆盖到节点时长，无越界、空尾段或互相矛盾；
- 角色、状态、道具、画幅、模型和引用职责一致；
- 任务容量能在时长内读清主要动作、状态或信息；
- 输出后必须连续播放；声音在范围内时必须试听；最终采用需要人类接受。

## 停止条件

- 无法判断主要镜头职责，只能写“很电影感”；
- 一个单元包含多个不能共同验证的高风险机制；
- 对白、声音、人物或状态合同缺失；
- prompt 与节点在时长、画幅、模型或引用角色上冲突；
- 参考职责映射到错误实际图片或虚构的 Node ID；
- 代表试片未覆盖当前新的画幅、群舞、变身或复杂接触风险。

## 证据与成熟度

- `policyStatus`: `ACTIVE`
- `evidenceStatus`: `REUSABLE`
- 主要证据卡：`DRAMA-PAT-201`、`DRAMA-PAT-202`、`DRAMA-PAT-203`、`DRAMA-PAT-204`、`DRAMA-PAT-205`、`DRAMA-PAT-206`、`DRAMA-PAT-207`、`DRAMA-RISK-201`
- `SOLO_PERFORMANCE`、`TWO_SUBJECT_INTERACTION` 与 `ENSEMBLE_CHOREOGRAPHY` 当前仅有 `OBSERVED` 级的类型边界证据；作为 ACTIVE 类型时必须先代表试片。`RITUAL` 仍只是 modifier。
- 未验证：竖屏构图与队形、跨模型节拍预算、自有成片的两次人工接受。
