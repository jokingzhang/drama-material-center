# 豆包创作任务协议 v1

`run-doubao-creative.mjs` 接收一个 UTF-8 JSON 任务包。文件路径相对任务 JSON 所在目录解析；当 `--job -` 从 stdin 读取时，相对当前工作目录解析。

## 最小示例

```json
{
  "schemaVersion": 1,
  "jobId": "ep08-fight-prompts-v1",
  "kind": "video-prompts",
  "expectedModel": "doubao-seed-2.1-turbo",
  "objective": "根据已确认剧本，为 EP08 一个近身双刀镜头生成可执行的视频提示词。",
  "userCreativeDirectives": [
    "所有创意文本由豆包完成。",
    "重点是近身双刀打斗，不要把 BOSS 写成被动挨打。"
  ],
  "canon": [
    {
      "label": "已确认剧本",
      "path": "../docs/ep08-approved.md"
    }
  ],
  "deliverables": [
    "一条可直接提交的视频提示词",
    "最终创作正文不超过2500个Unicode字符"
  ],
  "hardConstraints": [
    "不得改变胜负和角色动机",
    "所有具名角色必须列出所需身份素材",
    "最终创作正文不超过2500个Unicode字符"
  ],
  "referencePlan": {
    "requiredScenes": ["废弃医院走廊"],
    "requiredCharacters": ["林默", "苏野", "院长"],
    "assets": [
      {
        "assetId": "SC-HOSPITAL-CORRIDOR-v01",
        "subject": "废弃医院走廊",
        "role": "scene",
        "reference": "{{Mixed 1}}",
        "status": "GEN_INPUT"
      },
      {
        "assetId": "CHAR-LM-IDENTITY-v01",
        "subject": "林默",
        "role": "character-identity",
        "reference": "{{Mixed 2}}",
        "status": "ACCEPTED"
      },
      {
        "assetId": "CHAR-SY-IDENTITY-v01",
        "subject": "苏野",
        "role": "character-identity",
        "reference": "{{Mixed 3}}",
        "status": "ACCEPTED"
      },
      {
        "assetId": "CHAR-DEAN-IDENTITY-v01",
        "subject": "院长",
        "role": "character-identity",
        "reference": "{{Mixed 4}}",
        "status": "ACCEPTED"
      },
      {
        "assetId": "KF-EP08-FIGHT-CONTACT-v01",
        "subject": "双刀接触关键帧",
        "role": "keyframe",
        "reference": "{{Mixed 5}}",
        "status": "GEN_INPUT"
      }
    ]
  },
  "template": {
    "id": "video-shot-prompt-v1",
    "variables": {
      "status": "DRAFT",
      "taskId": "EP08 FIGHT-01",
      "title": "近身双刀交锋",
      "version": "v1",
      "durationSeconds": "8",
      "aspectRatio": "9:16"
    }
  },
  "goldenSamples": [],
  "repairFeedback": [],
  "output": {
    "format": "markdown",
    "language": "zh-CN"
  }
}
```

## 顶层字段

| 字段 | 必填 | 说明 |
|---|---:|---|
| `schemaVersion` | 是 | 当前固定为 `1`。 |
| `jobId` | 是 | 稳定任务 ID，只能使用小写字母、数字、点、下划线和连字符，最长 80 字符。 |
| `kind` | 是 | `script`、`story-outline`、`storyboard`、`asset-prompts`、`video-prompts`、`creative-repair` 或 `other`。 |
| `expectedModel` | 是 | 本轮明确使用的豆包模型 ID，必须以 `doubao-` 开头。 |
| `objective` | 是 | 本轮业务目标。只写要解决的问题，不替豆包写创意答案。 |
| `userCreativeDirectives` | 否 | 用户原话或用户明确确认的创意偏好。 |
| `canon` | 否 | 当前事实源列表。每项使用 `path` 或 `text` 二选一。 |
| `deliverables` | 是 | 豆包应返回的完整交付物，至少一项。 |
| `hardConstraints` | 否 | 可客观检查的事实、规格、数量、禁止改变项和授权边界。 |
| `template` | 否 | 内置输出模板 ID 与事实型变量。选择前读取 `template-catalog.md`；模板只固定结构。 |
| `goldenSamples` | 否 | 用户认可的同类输入与输出，用于质量对照。 |
| `repairFeedback` | 否 | 实际失败现象、证据和必须修正的结果；返修时使用。 |
| `referencePlan` | 条件必填 | 使用 `video-shot-prompt-v1` 时必填；声明镜头实际场景、出镜人物和逐项生成输入，供 runner 校验覆盖、职责与引用顺序。 |
| `output` | 是 | `format` 为 `markdown` 或 `json`；`language` 默认为 `zh-CN`。 |

## 文本来源

`canon` 的每一项：

```json
{"label": "人物设定", "path": "../characters.md"}
```

或：

```json
{"label": "用户临时确认", "text": "院长此时仍占主动，林默只能争取撤退窗口。"}
```

脚本只读取显式列出的文件，不遍历目录。单文件上限 256 KiB，全部外部文本合计上限 512 KiB；包含 NUL 字节的文件会被拒绝。
任务 JSON 上限为 1 MiB；物化后的完整提示文本上限为 700,000 个字符，超过时必须按创作责任拆成多个任务。

## 输出模板

模板是可选字段：

```json
{
  "template": {
    "id": "video-shot-prompt-v1",
    "variables": {
      "status": "DRAFT",
      "taskId": "EP05 V01",
      "title": "卷帘门逃生",
      "version": "v18",
      "durationSeconds": "30",
      "aspectRatio": "16:9"
    }
  }
}
```

`id` 必须来自 `run-doubao-creative.mjs --list-templates`。`variables` 只接受字符串；每个模板有自己的必填变量、适用 `kind`、输出格式和结构检查，详见 [template-catalog.md](template-catalog.md)。脚本先把事实变量填进模板，再把渲染后的模板交给豆包；其余创意占位由豆包完成。

## 视频提示词素材合同 `referencePlan`

`referencePlan` 是执行者从当前剧本、人物/场景母版和真实输入列表整理出的确定性合同，不是让豆包猜素材。所有 `video-shot-prompt-v1` 任务都必须提供；`DRAFT` 可把尚未验收的素材标成 `DRAFT`，但不能省略镜头需要的场景、人物或预计输入。

```json
{
  "requiredScenes": ["404病区走廊"],
  "requiredCharacters": ["林默", "苏野", "王奎"],
  "turnaroundDispositions": [
    {"subject": "林默", "status": "CONNECTED", "assetId": "CHAR-LM-TURNAROUND-v01"},
    {"subject": "苏野", "status": "NOT_APPLICABLE", "reason": "本镜头不出现转身或全身动作。"},
    {"subject": "王奎", "status": "BUDGET_EXCLUDED", "reason": "保留剧情关键道具后达到图片上限。"}
  ],
  "assets": [
    {
      "assetId": "SC-WARD404-CORRIDOR-v01",
      "subject": "404病区走廊",
      "role": "scene",
      "reference": "{{Mixed 1}}",
      "status": "GEN_INPUT"
    },
    {
      "assetId": "CHAR-LM-IDENTITY-v01",
      "subject": "林默",
      "role": "character-identity",
      "reference": "{{Mixed 2}}",
      "status": "ACCEPTED"
    },
    {
      "assetId": "CHAR-SY-IDENTITY-v01",
      "subject": "苏野",
      "role": "character-identity",
      "reference": "{{Mixed 3}}",
      "status": "ACCEPTED"
    },
    {
      "assetId": "CHAR-WK-IDENTITY-v01",
      "subject": "王奎",
      "role": "character-identity",
      "reference": "{{Mixed 4}}",
      "status": "ACCEPTED"
    },
    {
      "assetId": "KF-WK-GRAB-LM-v01",
      "subject": "王奎抓肩关键帧",
      "role": "keyframe",
      "reference": "{{Mixed 5}}",
      "status": "GEN_INPUT"
    }
  ]
}
```

字段规则：

- `requiredScenes`：镜头实际使用的场景名称，至少一项；每项必须有同名 `role=scene` 素材。
- `requiredCharacters`：镜头实际出镜的具名人物；无人物镜头必须显式写 `[]`。每项必须有同名 `role=character-identity`，或目标入口明确允许单独承担身份的 `role=character-turnaround` 素材。项目批准时，同一人物可同时有一个身份锚点和一个三视图输入，二者职责必须分开；不得为同一人物重复声明两个身份锚点或两个三视图。
- `assets[].assetId`：稳定素材 ID 或文件名，不得重复。
- `assets[].subject`：该素材负责的场景、人物或局部动作名称；豆包输出时必须在引用附近原样点名，避免“素材已连接但没有与人物关联”。
- `assets[].role`：`scene`、`character-identity`、`character-turnaround`、`state`、`prop`、`audio`、`spatial`、`continuity` 或 `keyframe`。
- `assets[].reference`：目标平台真实引用，如 `{{Mixed 1}}`、`@图片1`、`<Subject 1>` 或 LibTV CLI 的 `{{Node <nodeKey>}}`；不得重复。全部采用 Mixed 时必须从 `{{Mixed 1}}` 按输入顺序连续编号。
- `assets[].status`：`DRAFT`、`INTERNAL`、`GEN_INPUT`、`ACCEPTED`、`REJECTED` 或 `SUPERSEDED`。任何任务都拒绝引用 `INTERNAL`、`REJECTED`、`SUPERSEDED`；`READY` 只接受 `GEN_INPUT` 或 `ACCEPTED`。
- `turnaroundDispositions`：新任务应逐个覆盖 `requiredCharacters`，状态只能为 `CONNECTED`、`NOT_APPLICABLE`、`BUDGET_EXCLUDED` 或 `CONFLICT`。`CONNECTED` 必须用 `assetId` 指向同一人物实际输入的 `character-turnaround`；其它状态不得伪造素材 ID，必须写明 `reason`。旧任务可缺省该字段以保持历史兼容，但不能据此宣称三视图职责已经检查。

`assets` 顺序就是实际输入和 `〖参考〗` 顺序：场景 → 人物身份与三视图输入 → 状态/道具/音频 → 空间/连续帧/关键帧。runner 会检查场景与人物覆盖、状态、重复引用和顺序。`--validate-output` 还会检查每个引用只在 `〖参考〗` 出现一次、与 `subject` 邻近关联；空间板/连续帧/关键帧必须使用“只锁/只参考/仅约束”等局部职责，三视图还必须写明只补充体型、轮廓和同一造型前侧背结构，并带有不复制三联排版、中性站姿、重复人物、文字或影棚背景的边界。项目若把三视图母版登记为 `INTERNAL`，不得直接放入 `referencePlan.assets`；先按项目规则建立有版本和适用范围的 `GEN_INPUT` 引用。

这仍不能替代执行者从事实源逐镜枚举人物：如果执行者把实际出镜角色漏出 `requiredCharacters`，runner 无法凭空知道。因此，`requiredCharacters` 必须来自剧本镜头事实，而不是从已有素材列表反推。

使用同一任务包只读校验已有输出：

```bash
node <skill-directory>/scripts/run-doubao-creative.mjs \
  --job <job.json> \
  --validate-output <creative-output.md>
```

## 黄金样本

每个样本必须同时包含输入和用户认可的输出；两者都使用 `path` 或 `text` 来源：

```json
{
  "label": "豆包 App 已认可打斗样本",
  "input": {"path": "../golden/input.md"},
  "output": {"path": "../golden/output.md"}
}
```

黄金样本是质量目标，不是让执行 Agent 摘抄后自行创作。

## 返修反馈

返修项必须来源于实际文本、素材或成片观察：

```json
{
  "observedFailure": "第二段只有能量光效，没有双刀接触。",
  "evidence": "take-03 的 4.2–6.8 秒双方保持约两米距离。",
  "mustCorrect": "新提示词必须出现至少一次可见的近身格挡、压刀和脱离结果。"
}
```

返修任务还应把上一版创作结果加入 `canon`，以便豆包输出完整修订版。不要由执行 Agent 直接改上一版措辞。

## 输出文件

每次真实运行要求一个尚不存在的 `--out` 目录。成功运行会写入：

- `job.json`：原始任务包；
- `template-rendered.md`：本轮实际交给豆包的模板骨架；未选择模板时不生成；
- `claude-prompt.txt`：实际通过 stdin 发给豆包的完整任务；
- `raw-stdout.txt`：Claude Code 的原始 stdout；
- `raw-response.json`：Claude Code JSON 响应；
- `creative-output.md` 或 `creative-output.json`：豆包原始交付物；
- `run.json`：模型、token、时长、名义成本和文件清单；
- `stderr.log`：仅在 CLI 有诊断输出时写入，常见凭证形态会被脱敏。

运行目录即证据包，不覆盖、不原地返修。CLI 返回成功仍需另做内容验收。
