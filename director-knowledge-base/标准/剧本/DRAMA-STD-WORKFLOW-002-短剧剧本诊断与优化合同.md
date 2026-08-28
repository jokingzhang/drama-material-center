# DRAMA-STD-WORKFLOW-002｜短剧剧本诊断与优化合同 v0.1.0

## 适用范围

本标准规定 AI 导演收到想法、故事大纲、角色设定、分集正文或现有剧本后，怎样使用导演知识库形成可审查的诊断、选项和优化 Brief。它不授权复制案例、直接替用户决定关键创作分支、生成媒体、外部写入、付费或发布。

## 输入

- 精确输入文本或文件、版本、状态和请求范围；
- `DEVELOP` 或 `ADAPT` 模式、目标受众、格式、集数/时长与优化目标；
- 用户决定、保护内容、允许改动范围和项目规则；
- 已验证知识库、全部 `ACTIVE` script 标准与按问题检索的知识卡；
- 未知项、权利边界和需要专业核验的内容。

## 决策规则

1. 绑定事实源，分开 `SCRIPT_FACT`、`USER_DECISION`、`AI_DIRECTOR_DECISION` 和 `UNKNOWN`。
2. 先检查类型承诺、主角欲望、对抗力、不可逆选择、赌注、期限和不确定性，再检查局部台词。
3. 高概念建立规则合同；能力建立选择—代价—局面变化链；关系建立双方目标与解释矩阵。
4. 把前五集或目标范围写成 `episodeLadder`，逐集登记新信息、选择、可见结果、尾钩和下一行动。
5. 所有问题写入带 locator 的 `problemLedger`；决策级问题提供二至三个选项、代价和 AI 导演推荐。
6. 当前项目事实、用户决定和项目规则高于外部案例。适用知识被拒绝或覆盖时必须写 canonical `knowledgeUsed` 记录。
7. 外部案例只做机制参照，不复制独特人物、情节、台词、顺序或包装；`OBSERVED` 只支持假设和风险提示。
8. 用户批准方向性 `DEV-*` 决定后，才形成 change plan；需要实际创意 prose 时才把批准 Brief 交给 `$doubao-creative-studio`。

## 输出合同

输出 `ScriptDevelopmentAnalysis v1`：

1. `sourceBinding` 与 `taskContract`；
2. `storyEngine`，含类型承诺、欲望、对抗、不可逆选择、赌注、期限、规则与不确定性；
3. `characterEngines[]` 与 `relationshipMatrix`；
4. `episodeLadder[]`，含 startPressure、newInformation、choice、visibleConsequence、endHook、nextActionOpened；
5. `problemLedger[]`，含 ID、严重度、locator、症状、因果诊断、观众代价、知识引用和置信度；
6. `options[]` 与 AI Director 推荐，方向性选择保持待用户批准；
7. `changePlan[]`，只包含批准决定、受影响 locator、不可变事实、目标效果与验收；
8. `knowledgeUsed[]`，记录 adopted、condition rejected 或 higher-priority override；
9. `doubaoHandoff`：`NOT_REQUIRED`、`BLOCKED_PENDING_DECISION` 或 `READY_FOR_CREATIVE_PROSE`。

## 验收

- 每项诊断能追到输入 locator、事实或明确分析推断；
- 高概念规则、主角能动性、关系冲突、信息阶梯和尾钩按适用性检查，不机械套模板；
- 每个方向性修改有二至三个真实选项、代价和待用户决定点；
- 所有采用或拒绝的知识条目记录触发、排除、缺失输入、成熟度和输出位置；
- 外部案例没有被复制，市场页面没有被误报为效果或授权证据；
- 只有批准 Brief 可进入豆包创作，返回稿仍需按 Brief 复核并由用户接受。

## 停止条件

- 输入版本、canon、目标范围或改动权限不明确；
- 类型方向、主角能动性、结局或核心关系存在多个会改变项目方向的选项但用户未选择；
- applicable standard 的 required input 缺失；
- 知识库校验失败或知识成熟度被夸大；
- 请求要求抄用来源剧本、绕过权利审查或把分析授权扩大为生成、发布或付费执行。

## 证据与成熟度

- `policyStatus`: `ACTIVE`
- `evidenceStatus`: `OBSERVED`
- 来源知识卡：`DRAMA-PAT-001` 至 `DRAMA-PAT-006`、`DRAMA-RISK-001` 至 `DRAMA-RISK-003`
- 当前证据来自十二部外部剧本的页面资料与前五集，能够支撑诊断问题与候选机制，不能证明留存、商业效果或通用最优。
- 提升成熟度需自有项目的结构化使用记录、完成稿/生产结果、实际观看或试听以及明确人工接受。
