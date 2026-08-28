# Director knowledge model

The skill is stable methodology. The knowledge base is the growing body of cases, evidence, cards, and practice records.

## Storage layout

```text
<kb-root>/
├── .ai-director/
│   └── index.json
├── README.md
├── 标准/
│   ├── 图片素材/
│   ├── 分镜提示词/
│   └── 工作流/
├── 知识卡索引.md
├── 案例/
│   └── <case-id>/
│       ├── 案例档案.md
│       └── 证据账本.md
├── 知识卡/
│   ├── 剧情/
│   ├── 画面与素材/
│   ├── 分镜与运镜/
│   └── 工作流/
└── 验证/
    └── 验证记录.md
```

Study reports use five evidence layers: narrative, visual/material, cinematography, prompt translation, and workflow. The stable card model keeps four domains. Prompt wording is model- and version-sensitive evidence; normalize only durable directing-to-prompt mechanisms into `cinematography` or `workflow` cards.

Keep the original long-form case report as a source document. The case dossier indexes it and records only normalized conclusions and limitations. Do not delete, move, or overwrite source reports or media. Machine metadata lives in the hidden `.ai-director/index.json` so the material-center Markdown preview stays clean.

## Project standard contract

Standards and evidence cards are separate layers. A standard answers “what this project currently requires”; a card answers “how mature the supporting evidence is.” Register standards in `.ai-director/index.json` under `standards`:

```json
{
  "schemaVersion": 1,
  "id": "DRAMA-STD-ASSET-001",
  "kind": "standard",
  "title": "Standard title",
  "path": "标准/图片素材/DRAMA-STD-ASSET-001-title.md",
  "domain": "visual-material",
  "policyStatus": "ACTIVE",
  "evidenceStatus": "REUSABLE",
  "version": "0.1.0",
  "sourceCardIds": ["DRAMA-PAT-101"],
  "evidenceOverrides": [
    {
      "feature": "A_NEW_SUBTYPE",
      "evidenceStatus": "OBSERVED",
      "reason": "The subtype boundary currently comes from one external case.",
      "representativeTestRequired": true,
      "sourceCardIds": ["DRAMA-PAT-101"]
    }
  ],
  "createdAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD"
}
```

Allowed `policyStatus` values are `DRAFT`, `ACTIVE`, and `RETIRED`. `evidenceStatus` uses `OBSERVED`, `REUSABLE`, or `VALIDATED` and cannot exceed the strongest defensible supporting evidence. Use these required headings:

- `## 适用范围`
- `## 输入`
- `## 决策规则`
- `## 输出合同`
- `## 验收`
- `## 停止条件`
- `## 证据与成熟度`

An `ACTIVE` standard is mandatory for project planning unless current explicit user decisions or project facts conflict. It is not a quality guarantee. When a standard contains a feature or subtype whose evidence is weaker than the aggregate standard, register it in `evidenceOverrides`; retrieval must surface the override beside the standard instead of letting the aggregate maturity hide it. If an active standard or feature has only `OBSERVED` evidence, apply it as an explicit project policy and schedule representative testing; do not describe it as proven.

## Case contract

Register every `案例档案.md` in `.ai-director/index.json` under `cases`. New or materially revised dossiers use case schema v2:

```json
{
  "schemaVersion": 2,
  "id": "CASE-YYYYMMDD-SHORT-NAME",
  "kind": "case",
  "origin": "external-work",
  "title": "Case title",
  "path": "案例/CASE-.../案例档案.md",
  "studiedAt": "YYYY-MM-DD",
  "sourceUrl": "https://example.com",
  "sourceMedia": "/absolute/read-only/source/path.mp4",
  "sourceMediaSha256": "optional sha256",
  "sourceDocument": "relative/path/from/kb/root.md",
  "evidenceDocument": "案例/CASE-.../证据账本.md",
  "domains": ["narrative", "visual-material", "cinematography", "workflow"],
  "derivedCardIds": ["DRAMA-PAT-001"]
}
```

Allowed `origin` values are `external-work` and `own-production`.

Schema v2 requires:

- `## 案例定位`
- `## 证据状态`
- `## 五层结论`, with `### 剧情`, `### 画面与素材`, `### 分镜、景别与运镜`, `### 提示词转译`, and `### 工作流`
- `## 知识增量`, with `### 新发现`, `### 重复验证`, and `### 相互冲突`; state `无` when a category is empty
- `## 未确认`
- `## 原始拆解`

Legacy schema v1 dossiers with `## 四领域结论` and `## 知识卡` remain valid and do not need a forced migration. Their evidence ledgers must still contain at least one entry, the five core evidence fields, valid types, unique IDs, and a global read date. Use v2 for the next case and migrate an old dossier only when it is materially revised for another reason.

Keep `evidenceDocument`, case dossiers, and cards inside the resolved knowledge-base root; symbolic links or relative traversal must not escape it. `sourceDocument` may point to the original report inside the knowledge root or its immediate parent library root, but not beyond that boundary. In `证据账本.md`, give each item a globally unique heading such as `### EV-<CASE-SHORT>-FILM-001`; include a case prefix so two ledgers cannot create an ambiguous card reference. Record type (`DIRECT_FACT`, `ANALYTICAL_INFERENCE`, or `UNKNOWN`), source locator or timecode, inspection method, observation, confidence, and read date. A mutable online canvas always needs an item-level read date. Prompt evidence also records the target model/version, mode, duration, aspect ratio, and reference responsibilities when known; missing fields remain `UNKNOWN`, not guessed.

## Knowledge-card contract

Register every card in `.ai-director/index.json` under `cards`:

```json
{
  "schemaVersion": 1,
  "id": "DRAMA-PAT-001",
  "kind": "pattern",
  "title": "Card title",
  "path": "知识卡/剧情/DRAMA-PAT-001-title.md",
  "domain": "narrative",
  "status": "OBSERVED",
  "tags": ["tag"],
  "sourceCaseIds": ["CASE-YYYYMMDD-SHORT-NAME"],
  "evidenceRefs": ["EV-FILM-001"],
  "evidenceStrength": "HIGH",
  "sourceCount": 1,
  "ownProductionUses": 0,
  "ownAcceptedUses": 0,
  "createdAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD"
}
```

Allowed values:

- `kind`: `pattern` or `risk`.
- `domain`: `narrative`, `visual-material`, `cinematography`, or `workflow`.
- `status`: `OBSERVED`, `REUSABLE`, `VALIDATED`, or `RETIRED`.
- `evidenceStrength`: `LOW`, `MEDIUM`, or `HIGH`.

Use these required headings:

- `## 问题`
- `## 银幕事实`
- `## 机制`
- `## 适用条件`
- `## 不适用条件`
- `## AI 制作转译`
- `## 验收`
- `## 失败信号`
- `## 证据`
- `## 实践记录`

Write the mechanism as an inference, not a fact. Name the condition that would falsify the card. A card without an inapplicable condition or observable acceptance test is only a note, not reusable directing knowledge.

## Knowledge delta

Compare every studied case with current cards before creating or editing cards:

- `新发现`: no current card expresses the mechanism under the observed conditions; create the smallest atomic `OBSERVED` card.
- `重复验证`: append the new case and evidence to the existing card; do not create a synonym card or automatically promote it.
- `相互冲突`: preserve both observations, name the conflicting card IDs and evidence, and state the condition or missing evidence that may decide between them.

Do not call title similarity repeated validation. The mechanism, applicable conditions, and observable effect must match.

## Maturity and promotion

- `OBSERVED`: direct evidence from at least one inspected external work or own-production artifact. It may inspire a choice but cannot overrule current project facts. An unexecuted Director decision is not observed evidence.
- `REUSABLE`: the same mechanism appears in at least two independent cases, or one own-production controlled use passed its intended acceptance test.
- `VALIDATED`: at least two own-production uses passed actual human viewing or listening acceptance, with acceptable cost and side effects.
- `RETIRED`: evidence contradicts the mechanism or its cost exceeds its value. Preserve it for audit.

Never promote on Agent judgment alone. Append the same structured record to `验证/验证记录.md` and the card's `## 实践记录`:

```text
### PRACTICE-YYYYMMDD-PROJECT-SHOT
- 日期：
- 项目 / 集数 / 镜头：
- 决策 ID：
- 知识卡 ID 与版本：
- 预期观众效果：
- 实际执行与结果：
- 实际播放 / 试听证据：
- 人工结论：
- 确认人：
- 计入人工接受：`YES` / `NO`
- 成本与副作用：
- 状态决定：
- 证据路径：
```

All fields must be non-empty. The practice ID uses `PRACTICE-YYYYMMDD-PROJECT-SHOT`; its date segment matches a real `日期` in `YYYY-MM-DD`. `决策 ID` exactly binds a real `DEV-<scope>-###` or `DIR-<scope>-###` decision. `知识卡 ID 与版本` exactly names the current card as `<card-id> v<number>` or `<card-id>@v<number>`. `确认人` identifies a human, never an Agent or automation. The same practice ID and identical fields must appear once in both places; the validation ledger must not contain an orphan practice. A card cannot count the same project/episode/shot twice as independent use.

Update counters and dates only after that record exists. `ownProductionUses` equals the number of structured practice records for the card; `ownAcceptedUses` equals the number explicitly marked `YES`. A `YES` record requires explicit actual playback, viewing, or listening evidence and a non-pending human conclusion. “待人工播放”, “待人工验收”, a machine pass, task success, or Agent-only judgment must be marked `NO`.

## Retrieval rules

- Read applicable `ACTIVE` standards before searching cards. Use cards to understand evidence, conditions, exceptions, conflicts, and tests behind the standard.
- Retrieve by the current directing problem, not by title similarity alone.
- Prefer domain and condition matches; reject cards whose `不适用条件` match the project.
- Show card ID and status beside every recommendation.
- A collection of `OBSERVED` cards is a hypothesis set, not consensus.
- Contradictions are useful. Keep both cards and state the condition deciding between them.
- Keep untested `DEV-*` and `DIR-*` choices in project artifacts; do not use the knowledge base as a storage place for speculative decisions.
