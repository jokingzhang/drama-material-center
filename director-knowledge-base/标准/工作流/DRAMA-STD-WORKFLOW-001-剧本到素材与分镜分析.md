# DRAMA-STD-WORKFLOW-001｜剧本到素材与分镜分析 v0.1.1

## 适用范围

本标准规定 AI 导演收到剧本、场景或分集文本后，怎样使用项目知识库输出 `世界观/类型 → 图片素材 → 分镜提示词构建` 的可审查分析。它不授权生成图片、写 LibTV、运行节点、付费或发布。

## 输入

- 精确剧本文件或用户提供文本、版本、状态和请求范围；
- 用户明确决定、项目规则、已批准世界观和连续性；
- 当前素材清单和实际资产状态；
- `ACTIVE` 图片与镜头标准；
- 目标格式、画幅、时长和模型信息；未知项必须保留。

## 决策规则

按以下顺序工作：

1. 绑定来源与权限，区分 `SCRIPT_FACT`、`USER_DECISION`、`AI_DIRECTOR_DECISION`、`UNKNOWN`。
2. 建立 `WorldGenreProfile`：时代、空间、规则、类型承诺、现实度、视觉阶段、角色/生物/道具/状态和声音。
3. 把剧本拆为 generation units：每单元一个新信息或核心因果；每单元选择恰好一个 primary shot type。
4. 先输出 reusable masters 和直接输入的 AssetPlan，再输出逐镜 ReferenceResponsibilityMatrix；不从现成引用反推需求。
5. 依据 shot type 填 ShotPromptPlan 的特有字段、统一外层、时长适配和验收。
6. 分开记录交付总长、unit 暂定预算和实时节点精确时长；未知模型/节点时长时保留节拍顺序但不伪造时间码。
7. 标明 ready、blocked、representative-test-required；不能因计划完整就声称 prompt-ready 或 production-ready。
8. 用户要求最终创意提示词且导演合同已批准时，才交给 `$doubao-creative-studio`；AI 导演验证事实而不二次改写其创意 prose。

世界观和类型只用于确定可见规律、表演语汇、空间、材质、声音、节奏和禁区，不得用类型套路补写剧本没有授权的剧情事实。

## 输出合同

输出 `ScriptProductionAnalysis v1`：

1. `sourceBinding`：来源、版本、范围、状态、读取日期、失效条件；
2. `worldGenreProfile`：事实、用户决定、AI 决定和未知项；
3. `continuityStates`：人物 look/伤情/变身、地点、时间、道具和声音状态；
4. `generationUnits[]`：locator、storyFunction、audienceEffect、start/end、primaryShotType、modifiers、visibleEntities、dialogue、deliveryTotalDuration、unitDurationBudget、nodeDurationStatus、拆分理由；
5. `assetPlan.assets[]`：assetId、type、entity/state、scope、required/forbidden、status、usedBy、acceptance、knowledgeRefs；
6. `assetPlan.referenceMatrix[]`：每个镜头的预期职责、asset/MISSING、disposition、原因、冲突和预算；
7. `shotPromptPlans[]`：类型必填字段、beats、可用时的精确 timeboxes、轴线/接触/反应/终态、对白/嘴部/声音、剪辑出口、失败信号、fallback、acceptance；
8. `handoff`：ready/blocked units、immutable facts、hard constraints、creative latitude、prompt author；
9. `unknowns`、approval points 和 `knowledgeUsed`，含标准 policy/evidence 双状态与知识卡成熟度。

输出允许是 `DRAFT`，但不能省略缺失项。不存在的资产使用稳定的规划 ID 和 `MISSING`，不得伪造本地路径、URL、Node key 或已验收状态。资产存在状态与引用 disposition 必须分开；具名人物需要但尚不存在的三视图写 `asset: MISSING`、`disposition: CONFLICT`，不得把 `MISSING` 作为三视图 disposition。

## 验收

- 每个可见剧本事实都能追到 AssetPlan 或明确的非图片承载方式；
- 每个 generation unit 恰好一个 primary shot type，并通过时长与任务容量检查；
- unit 暂定预算与剪辑过渡能回算到交付总长；实时节点时长未知时没有伪造精确时间盒；
- 每个具名人物的身份、当前造型和三视图职责有明确 disposition；
- 关键场景、道具、关系、状态变化和连续性没有无说明缺席；
- 所有知识引用包含标准版本、policyStatus、evidenceStatus 或卡片 maturity；
- ready 状态与缺失、冲突和代表试片要求一致；
- AI 导演决定均有 `DIR-*` ID、理由和失效条件。

## 停止条件

- 剧本版本或工作 canon 不明确；
- 世界规则、人物状态或关键剧情事实互相冲突；
- 用户必须选择的创作分支会改变资产体系或镜头结构；
- 图片、对白、声音或模型合同缺失，却试图标为 prompt-ready；
- ACTIVE 标准或知识库校验失败；
- 当前请求只授权分析，却准备生成、写画布或付费执行。

## 证据与成熟度

- `policyStatus`: `ACTIVE`
- `evidenceStatus`: `REUSABLE`
- 主要证据卡：`DRAMA-PAT-101`、`DRAMA-PAT-201`、`DRAMA-RISK-101`、`DRAMA-RISK-201`
- 该工作流的结构检查可以自动验证；最终质量仍需实际图片验收、视频连续播放/试听和人类接受。
