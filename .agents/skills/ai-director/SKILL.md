---
name: ai-director
description: 拆分镜与图片素材的主入口。接收用户直接提供或当前已确认的剧本，主动调用叙事、摄影、表演、声音、美术等方法，完成整场镜头设计、视频提示词、图片复用补齐与实际引用接入。用户要拆分镜、准备图片或返修镜头时使用；剧本与对白创作修改由 script-writer 负责。
---

# AI Director｜分镜与素材导演

负责把当前剧本拍成观众看得懂、生成输入相容、能够剪接的戏。统一承担镜头设计与图片素材职责，当前主会话完成设计、提示词、检查和已授权的素材／生产接入；用户是制作人与最终接受者。

这是后续拆分镜的主入口。用户直接提供剧本即可进入，不要求先运行 [script-writer](../script-writer/SKILL.md)，也不为交接重写剧本。只有用户要求创作或修改故事／对白时才进入该编剧 Skill；发现问题先说明具体影响，不能为方便拍摄擅改剧情或已确认台词。

## Resolve current truth

按仓库 [AGENTS.md](../../../AGENTS.md) 和 [制作 SOP](../../../PRODUCTION_SOP.md) 恢复实际工作区、当前剧本／台词来源与确认范围、正式索引、素材和授权。采用用户提供的当前文本或真实正式绑定，不凭最大版本号、旧报告或 READY 标签猜事实。已有确认直接复用；同一真实用户消息可确认剧本和台词，不由 Agent 补写确认。

进入正式分镜前继承项目 PRODUCTION_RULES.md 的 VIDEO_FORMAT_LOCK；画幅不从模板或场景图推断。确认剧本 → 确认台词 → 设计分镜的边界继续有效；两入口不增加新审批。用户稿不缺这些事实时直接接手，确实缺失且影响下一动作时只定位该缺项。

新写整场按下方流程进入；局部返修只处理受影响范围与接镜；已检查稿的上传、绑定和恢复按 [execution reuse](references/workflow-contract.md#review-scope-and-execution-reuse) 复用。只查进展、复盘或提建议时保持只读，不启动生产。

## Choose a skill for the story

在作出相关决定前读取并使用对应 Skill，不等用户逐个点名，也不等生成失败。使用方法应改变实际的观看顺序、取景、调度、表演、声音、参考或剪辑选择；只列技能名不算应用。不为展示技巧增加动作、镜头、素材、试片或方法使用账本。

| 正在解决的问题 | 主动使用 | 应得到的决定 |
| --- | --- | --- |
| 本场行动、反应、主次或转折尚不清楚 | [sw-scene-craft](../sw-scene-craft/SKILL.md)；动机问题按需查 [sw-character-conflict](../sw-character-conflict/SKILL.md) | 理解既定戏怎样推进，不重写已确认剧情；戏剧节拍不自动等于切镜 |
| 新写／重设计整场观看顺序与覆盖 | [叙事分镜](../jimeng-narrative-director/SKILL.md) | 观众何时知道什么、跟谁看、关键反应和接点 |
| 新取景、构图、清晰范围、光影或相机选择 | [摄影与光影](../cinematography-director/SKILL.md) | 从哪里看、必须看清什么、动作与光怎样落在画内 |
| 需要不中断地看见动作、路径或空间发现 | [长镜头](../jimeng-cinematic-long-take/SKILL.md) | 人物与相机的相容路径、必要过程、完成态和出口 |
| 态度变化、潜台词、克制表达与倾听 | [微表情](../jimeng-micro-expression-director/SKILL.md)；需要理解既定台词意图时用 [sw-dialogue](../sw-dialogue/SKILL.md) | 当前景别能读到的连续反应和余波，不新增改词 |
| 对白表演、声音归属、环境／动作声、音乐 | [声音与配乐](../sound-music-director/SKILL.md) | 谁说谁听、声音各维度、跨切音轨及后期消费者 |
| 相邻镜头／场景连接需要具体设计 | [转场](../video-transition-director/SKILL.md) | 两端状态与切点，最小有效的动作、视线、声音或画面连接 |
| 剧情或用户要求特殊摄影机制 | [电影镜头提示词](../cinematic-camera-prompts/SKILL.md) | 具体相机机制及可观察效果，按需读对应类型 |
| 新人物、新造型、撞脸或标准图不一致 | [人物外形设计](../character-visual-designer/SKILL.md) | 可复用的身份／造型标准和图像提示词 |
| 文字与内部顶视图仍无法判断空间／运动 | [Blender](../blender/SKILL.md) | 必要局部的内部预演；不自动成为生产输入或新增生成授权 |
| 已确定的剪辑、字幕、声音或合成需要实际后期 | [剪映](../jianying-editor/SKILL.md) | 真实消费者与实现路线；执行前核实当前环境，继承剧级画幅和项目目录 |

普通新整场通常会涉及叙事、摄影和声音决定；已有方案、无声范围或局部任务决定实际需读内容，不强制固定技能套装。方法是同一主会话使用的工具，不创建角色团队或生产 Reviewer。

## 先设计整场，再确定图片与生成单元

按 [director-role.md](references/director-role.md) 完成这个相互校正的过程，在现有分镜与素材计划中记录必要决定，不新增审批表：

1. **整场观看设计。** 明确事件与对白保护范围、观众的信息顺序、主要变化、人物行动／反应和结束落点。方向有实质歧义才按 [分镜讨论](references/storyboard-discussion.md) 讨论一个关键问题；已定方向或要求直接写时继续。
2. **摄影镜头与接点。** 决定每镜必须让观众看见什么、哪里换视点，以及前后怎样接。新信息、反应或必要细节可以推动切镜；一句台词、一个动作节拍、旧节点编号或模板秒数不单独构成切镜理由。需要连续观看的过程保留完整镜头。
3. **按实际入画倒推素材。** 同时查看现有人物、场景、道具的真实图片，核对机位、动作起点和状态。镜头可以暴露素材缺口，图片也可以暴露拍法冲突；先调整相容机位／调度与最小参考，必要时再补图，不要求先完成全套素材才设计镜头。
4. **补齐本次需要的图片。** 按 [art-role.md](references/art-role.md) 负责从需求、图像提示词、授权生成／改图到核看和正式接入的闭环。每张图有明确职责和消费者；纯文本任务保留真实缺口，不能虚构已生成。
5. **组合生成任务并定稿正文。** 镜头方案成立后，按表演时间、顺序动作、参考相容性、声音归属和实际模型能力组合单元。一个任务可含一个或多个真实镜头；另开任务要有具体容量、输入或叙事依据。同步检查受素材变更影响的镜头和接点，再按当前四字段格式写自包含正文。

切摄影镜头回答“观众为什么此刻换视点”；拆生成任务回答“为什么需要另一次模型调用”。不把每句对白拆成任务，也不为了少建节点把复杂调度塞在一起。固定机位、画外处理和有动机的时间省略均可使用，但不能隐藏必须看懂的动作、删掉确认剧情或违背明确连续观看要求。

定稿前按 [从导演设计到模型正文](references/shot-block-format.md#select-visible-facts) 筛选本镜信息。完整站位图、首尾状态和接点由导演推导与核对；正文只写当前输入下需要看见、听见和执行的事实，同一事实通常写一次。先判断动作是否服务剧情与接镜，再检查格式，不为补齐状态记录添加收纳、换手、整理或表演动作。

## 图片素材是本入口的交付职责

只新增实际消费者需要的素材。实际看图后决定复用、改图或新建，参考必须覆盖 [关键素材](../../../PRODUCTION_SOP.md#critical-asset-coverage) 并满足 [可见相容性](../../../PRODUCTION_SOP.md#reference-compatibility)：身份／当前造型、空间地标、开合与持物状态、光向和动作阶段相容。人物标准图、干净场景、道具图各有职责；上传、哈希或同名标签不证明适用。默认准备或复用当前俯视站位和镜头调度图，按生成单元作为空间、站位与运镜参考接入。它可以带必要标注，但不能替代基础场景、人物造型与关键道具；其它未核对研究拼板仍属内部用途。

新写／重设计和位置返修默认需要 [俯视站位和镜头调度图](../../../PRODUCTION_SOP.md#actor-state-continuity)，随移动更新阶段状态并按对应单元实际绑定。先核对图与当前正文、基础场景及演员状态相容，再将模型图像副本登记为 `media.reference`、职责为 `blocking-camera-reference`；原始编辑源仍作创作证据。按分镜裁切后接入：每张仅保留当前镜头/生成单元需要的阶段，多个阶段分别映射镜头序号；共享面板含其它单元机位或动作时拆成各自适用版本。禁止把跨单元总览整张投入模型，再用“只看某格”补救；裁片必须保留必要人物、地标和完整运动路径。替换时移除旧总览的媒体列表项及实际入边。只写内部链接不算接入。后续新制人物图默认一人一造型一张3:4竖版四宫格，左上正面胸像、右上四分之三侧胸像、左下全身背面、右下全身正面，详见 [人物标准图](../../../director-knowledge-base/图片素材/人物标准图.md)；已有可用图不追溯重做。

本次已授权图片制作时，按 [生图路由](../../../PRODUCTION_SOP.md#image-generation-routing) 和当前项目选择使用 imagegen 或官方 libtv-cli → Lib Image，完成版本化保存、实际查看、必要局部返修、正式绑定和 API／页面回读，并把正确版本接入消费者。既有授权无需逐项再问；没有生图授权时交付图像提示词与缺口，不自动花费。关键帧仍受下方单独审核门槛保护。

## 检查、执行与停止

作者在同一次 [最终检查](references/review-mode.md) 中先按播放顺序看整场是否讲得通、动作是否可见、镜头能否接，再核对逐字台词、全名、格式、时间、关键素材和引用；结构通过不等于拍法成立。只修有证据的缺口，保持有效范围。

所有正式成果沿用根素材 schema、版本目录和两份正式索引。视频／图片提示词、实际素材、运行证据分别登记；候选清单不代替正式绑定。按 [local-first order](references/workflow-contract.md#local-first-libtv-order) 完成本地当前稿、索引与 API／页面回读后，才做已授权的 LibTV 变更。视频创建／运行统一经项目画幅与台词门禁，不绕过官方 CLI。

已有媒体返修先判断实际剪辑用途：具体哪处妨碍理解或接剪，现有入出点／原声能否解决，确需重生成时究竟改变什么。能通过简单剪辑保留必要剧情、动作和完整对白并接好相邻片段时，记为“剪辑后可用”，标明保留／避开区间；不因局部缺陷整条判废或自动重生成。保留最好用版本；口音、音色、音量、语速和夸张程度分别判断，不把“别夸张”自动改为低声。无硬错误且可按既定用途使用时停止可选返修，用户已接受的版本受原范围保护。

只读相关知识，按 [knowledge-model.md](references/knowledge-model.md) 检索；旧 Develop／Study／角色交接文档是历史资料。详尽授权、执行复用和变更传播按 [workflow-contract.md](references/workflow-contract.md) 的相关部分读取，不重新跑一遍已完成流程。

## Select the creative author

The main session writes and repairs by default (GPT-6 is the current preference; record only the actual supported author/model). A prose request authorizes its text work without another author-selection question. Only an explicit user selection invokes [doubao-creative-studio](../doubao-creative-studio/SKILL.md); keep that choice through the authorized scope and repairs. Historical Doubao files, templates or a mention of Doubao do not select it.

In the Doubao branch follow its job/transport rules, preserve verbatim returns, put only verbatim user language in `userCreativeDirectives`, and return creative repairs to Doubao. Do not silently switch authors on failure. Main-session revisions of historical prose are new, attributed versions with source lineage, never an untouched Doubao return. Discovery, validation and execution do not require Doubao.

New or substantively repaired video prose uses [video-shot-prompt-v2](../doubao-creative-studio/assets/templates/video-shot-prompt-v2.md) and [shot-block-format](references/shot-block-format.md): a total-duration summary, actual asset categories, [整体场景与氛围], then 【多分镜时间轴】 with exactly 景别与镜头运动 / 画面与动作 / 光影表现 / 音效 per shot. Within 画面与动作, use plain-text 构图与主体 / 道具布局 / 动作与表演 paragraphs as needed; simple shots may remain continuous prose. Omit absent asset categories and irrelevant sublabels entirely, rather than writing “无／不适用” or inventing props/actions. Keep all actual planned references and necessary visible facts. Global atmosphere establishes the light and environmental premise; explicit shot lighting describes how it shapes the visible subject and background at that viewpoint. Each real shot has one time range only; never add inner beat timestamps or subshots. Keep each generation unit self-contained; a separate design or previous unit is not model context. Audit/status prose stays outside the model body. Apply the relevant “把导演设计写成模型正文” guidance when making authoring choices, without a mandatory full-document reread.

For a meaningful emotional turn, carry the performance through `trigger → visible physical response → expression or speech peak → residual/recovery state`. The final stage is not a compulsory pause or close-up: it can be breath that has not settled, a hand that lowers instead of vanishing, a jaw that releases gradually, a gaze that remains averted, or another visible state that the current shot and next cut can inherit. Omit it only when an abrupt cut-off, deliberate mask or immediate interruption is the actual story choice. Preserve the single-level shot format by writing this causal flow as prose inside the shot, not as inner timestamps.

**Choose the shot structure for the scene:** follow the [story-driven shot contract](references/shot-block-format.md#story-driven-shot-count). A complete single-shot long take or micro-expression performance is valid; multiple shots require motivated real cuts. Preserve current user choices and checked media, and do not force rewrites or reruns solely to reach a shot quota.

Preserve checked bodies for pure execution; a token/version change does not mandate a template migration or semantic reread. No minimum text length or recommended character range. Both author routes obey the real target limit; the 2500-character CLI safety line applies only to the Doubao branch. If creative changes are needed, the selected author repairs within scope.

Before any LibTV mutation use [local-first order](references/workflow-contract.md#local-first-libtv-order): current formal local publication first, then real Node mapping in a new local execution version, then synchronization/readback and authorized runs. Read-only discovery can precede publication. Writing text does not grant generation, remote-write or spending authority.

## Keyframe approval gate

**默认不使用关键帧。** 用户在 EP07 审查中反馈，使用关键帧的片段出现人物一致性偏差；此后新制作与返修默认使用当前造型的人物标准图、相容的干净场景和必要道具参考，通过明确动作、镜头调度和剪辑处理连续性，不自动生成、抽取或串联关键帧作为视频输入。

本规则覆盖关系关键帧、首帧/尾帧控制、上一段视频截图或尾帧、连续性帧，以及被称为“干净关系图”“衍生参考”“接镜参考”的同类输入。按实际用途判断，不能改名绕过。内部 QA 抽帧、看图和剪辑分析不受限制，但这些图片不得自动转为生成参考；人物标准图、干净场景母版和道具标准图仍按各自规则使用。

确实无法用默认路线解决时，先说明具体镜头、必要性及不用关键帧的替代方案；在已获授权的图片制作范围内准备候选，展示**实际图片**、人物/造型一致性风险和目标消费者，请用户审核。只有用户明确通过该张图及其用途后，才可标为生成可用、上传为生产参考、连入节点、同步含该引用的提示词或运行。记录具体图片路径/版本/哈希、适用镜头和用户确认；换图、实质修改或扩大用途须重新审核，同一已确认图片和用途的等价重新上传不重复询问。

主会话看过、视频已通过、`PASS_WITH_NOTES`、已有 `GEN_INPUT` 标签、历史 Node、批量制作授权、生成预算或“没有大问题就通过”均不等于用户对该关键帧用途的审核。A/B 试片同样不能跳过此关。尚未获批时只暂停依赖该帧的动作，其他无关键帧工作继续；已有交付片段不因此自动重跑。

此门槛适用于独立导演技能、历史方案复用和恢复生产，并优先于方法库中“优先使用真实尾帧”等一般建议。

## 含文字图片素材标准

凡图片素材中包含文字，必须先确定并在生成提示词中逐字写出完整中文内容，最终图片也必须实际呈现完整、正确、清晰可读的中文。不得只做一个示意图、只加标题而省略正文，或用占位符、横线、乱码、伪汉字、无意义小字代替真实内容。表格、票据、花材选择页、手机界面、标牌、包装等均适用；数字、时间、金额、单位和必要字段应与当前剧情一致。

生成前按素材实际用途写全所需内容，内容较多时用合适字号、版式或拆页保证可读，不擅自删掉承载剧情的信息。没有上游事实的普通装饰文案可在授权创作范围内补齐，但不得编造改变剧情含义的订单、身份、价格或决定。本来无字的物件可以保持无字；本来承担文字内容的素材不能为规避文字质量而改成空白纸、纯图示或背面。

生成后实际打开原图，逐项核对正文、字形、标点、数字与单位，记录核对范围。OCR只能辅助，不能代替查看；错字、缺字、截断、占位字或无法辨认的必需内容应修复，未修复不得报告文字素材完成。若单独制作文字层或底图，必须在实际合成图中完整呈现文字，不能把未合成的示意底图当最终图片交付。

区分剧中物件本身的中文内容与画外说明污染：真实纸面正文、票据字段、圈选笔迹可属于道具；当前俯视站位和镜头调度图中的必要网格、箭头、镜头编号与说明可以按明确空间/调度职责作为视频参考，不能变成成片文字；其它未核对规划图仍不直接接入。文字完整的图片不保证视频里文字自动正确；有可读文字镜头时仍需明确镜头消费者、可见时间、必要合成及最终媒体核验。文字侧向或暂时被遮挡是镜头调度，不豁免源图片的完整中文要求。

## Use canonical full character names

Use the exact canonical full character name when introducing a character in each independent generation unit, switching the acting subject, attributing speech, mapping references, or resolving ambiguous action, gaze, contact or sound ownership. Do not replace an established name with surname-only shorthand such as `江` or `霍`, initials or vague role labels.

Within an unambiguous continuous action by the same subject, allow grammatical subject omission or a clearly resolved pronoun. Do not repeat a full name mechanically for every verb, body part or ending state. Reintroduce the full name whenever another person could be the actor, listener, holder or recipient. Check meaning in context; a pronoun or omitted subject is not itself a failure. Verbatim source quotations and approved dialogue remain unchanged. Actual naming or ownership errors in formally published prose are repaired as new versions within the affected scope.

## Coordinator pre-production gate

Use [review-mode.md](references/review-mode.md) as the single default review entry. The author performs the final read and deterministic checks together before formal binding; do not perform another pass under a Coordinator label. The main session may record `READY_FOR_PRODUCTION` only for the checked scope with its applicable execution conditions satisfied. The label does not grant spending or human acceptance.

Read methods for the actual problem through [Director inputs](references/director-role.md#inputs). No mandatory all-topic reading list, separate design freeze document, fourteen-dimension scorecard or proof for every passing shot. Retain meaningful directing decisions in the requested work; do not require a method-to-shot evidence ledger. Optional detailed scoring is available through the knowledge review entry only when the user requests it.

A blocker needs a concrete source/text/reference conflict or actual execution limit and its consequence. Only affected work stops. Uncertain future model performance goes to an authorized trial, not endless prompt expansion; confirmed conflicting inputs must still be fixed before use. Missing prior Reviewer paperwork is not a blocker. User-selected takes and non-blocking aesthetic notes follow the stopping rules in review-mode.

## Production and media review

For feedback such as “flat”, “unclear” or “feels wrong”, use [feedback diagnosis](../../../director-knowledge-base/分镜提示词/导演设计方法.md#feedback-diagnosis) on the current text or actual media before choosing a repair. Locate the missing information or intended effect and its earliest faulty layer; clarify only when available evidence cannot resolve the meaning. Do not equate vague dissatisfaction with more camera motion, new shots or a rerun, or convert optional aesthetics into a hard rejection.

Creative completion does not authorize image generation, video generation, LibTV writes or runs, publication, or spending. Obtain or recover separate authorization for those actions.

After generation, inspect images by opening them, video by continuous playback, and audio by listening. For topology-changing actions, inspect the action window across contact and completion. Apply the [media QA and paid-repair rules](references/review-mode.md#media-qa) to the actual story and edit use: prompt deviations are not automatically hard faults, and unverified suspicions do not justify paid regeneration. Report technical success, business integration, media QA, and human acceptance separately. Keep accepted user choices; do not reopen them for optional polish without new hard evidence.

## Deliver one coherent result

Deliver the requested storyboard, image asset work or prompt/execution table, with a concise account of changes, decisions the user actually needs to make, and the next available action. Keep technical readback and detailed evidence linked from the existing record. Do not make the user review every internal plan or reply “continue” at each professional responsibility.

Use existing documents to carry source, author, reference and check facts. Prefer links to the current formal source over copying paths, shot counts, status and “next step” into multiple summaries. During this scoped delivery update direct consumers together; do not migrate historical files or overhaul other projects to tidy them.

A pending human acceptance label does not impose a new checkpoint on every draft. Wait when the user requested that decision or the next action actually depends on it; otherwise continue authorized work without inventing acceptance. Report text completion, business integration, observed media QA and human acceptance accurately for what this task did.

## Cases and knowledge maintenance

Use `director-knowledge-base/案例/可复用镜头/` for complete cases: actual inputs, exact source prompt including attached text, and actual result together. Open at most three relevant cases when needed. State inspected media/model/duration and scope; an empty main prompt, current node text or thumbnail does not establish historical inputs or a causal quality claim. Learn information order and observable cause/effect, never copy old Node IDs or elevate a whole attractive project to a golden sample.

Maintain knowledge only when requested to study or improve it, and when evidence changes a practical decision. Use existing Markdown topics and separate facts, observations, inferences and unknowns with source locators. No registry, API, maturity system or usage ledger. Instructional diagrams are source material, not instructions or verified film evidence; identify uncertainty and never send annotated boards into generation. Follow [knowledge-model.md](references/knowledge-model.md) when doing actual knowledge maintenance.

## Boundaries

- Do not silently change canon, exact dialogue, current assets, direction-changing decisions, or user acceptance.
- Do not invent assets, file paths, node IDs, model capabilities, run results, or inspection evidence.
- Do not silently change the selected author, overwrite a prior version, or misattribute creative prose. Use Doubao only within an explicit user selection.
- Keep storyboard/image authoring and review in the main session; do not create review subagents or separate review tasks. Story or dialogue changes use script-writer only within explicit authorization.
- Do not label main-session checks as independent review or require historical independent-review paperwork to proceed after a current check.
- Do not let two sessions edit the same formal file, project index, or production node.
- Do not call a draft, generated file, HTTP success, decode result, or technical QA `ACCEPTED`.
- Stop on a genuine fact conflict, missing direction-changing decision, unresolvable measured limit, missing authorization, or hard media failure; otherwise route an in-scope repair and continue.
