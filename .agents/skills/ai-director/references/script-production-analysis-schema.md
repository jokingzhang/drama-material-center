# ScriptProductionAnalysis v1 persistence contract

Use this contract only for a durable, project-bound `剧本 → 图片素材 → 分镜提示词` analysis. The Web application reads only explicitly indexed JSON; it never infers `knowledgeUsed` from ordinary Markdown or conversation.

## Authorization and binding

Persist only when all durable-binding conditions in [script-to-production.md](script-to-production.md) pass. Resolve the repository root, then resolve the actual material-center workspace from `.env.local` `MATERIAL_CENTER_WORKSPACE`; a relative value is relative to the repository root, and the fallback when the setting is absent is `<repo-root>/workspace`. Verify `<workspace>/<project-id>/project.json` and the exact source file before writing.

Do not persist an ordinary consultation, hypothetical example, review-only answer, unbound pasted script, ambiguous project, or explicitly non-persistent request. Do not copy a pasted script into the project just to create a binding. In those cases return a non-persistent `DRAFT` and identify what prevents registration.

`sourceBinding.relativePath` is relative to the project root. It must name the exact existing script source, must not be absolute, and must not contain a `..` segment. Record its SHA-256 when the source is a local file. Additional binding fields such as source version, requested scope, approval status, read date, and invalidation conditions may be included, but they do not replace `relativePath`.

## Project-local files

Use only these project-local paths:

```text
<workspace>/<project-id>/.ai-director/
├── analysis-index.json
└── analyses/
    └── <analysisId>.json
```

`analysisId` must match `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`, be unique in the index, and include a version rather than replacing an earlier result, for example `SPA-EP01-v01`. The index is:

```json
{
  "schemaVersion": 1,
  "analyses": [
    {
      "analysisId": "SPA-EP01-v01",
      "path": ".ai-director/analyses/SPA-EP01-v01.json"
    }
  ]
}
```

Index paths are project-relative, never absolute, and must not traverse outside the project. Preserve all existing valid entries. Write the new versioned analysis file first and update the index last. If the index is malformed, an ID/path conflicts, or the project/source cannot be verified, stop and report the problem; do not overwrite, delete, normalize, or silently rebuild existing records.

## Analysis JSON

The Web reader requires these root fields; the directing sections shown below are the stable payload expected from the workflow:

```json
{
  "schemaVersion": 1,
  "kind": "ScriptProductionAnalysis",
  "analysisId": "SPA-EP01-v01",
  "projectId": "sample-project",
  "createdAt": "2026-08-28T06:00:00.000Z",
  "title": "EP01 剧本到素材与分镜分析",
  "status": "DRAFT",
  "sourceBinding": {
    "relativePath": "library/剧情/EP01.md",
    "sha256": "<64-character SHA-256>",
    "version": "v01",
    "scope": "EP01",
    "readAt": "2026-08-28T06:00:00.000Z"
  },
  "worldGenreProfile": {},
  "continuityStates": [],
  "generationUnits": [],
  "assetPlan": {
    "assets": [],
    "referenceMatrix": []
  },
  "shotPromptPlans": [],
  "handoff": {},
  "unknowns": [],
  "approvalPoints": [],
  "knowledgeUsed": []
}
```

`schemaVersion`, `kind`, `analysisId`, `projectId`, `createdAt`, `sourceBinding.relativePath`, and `knowledgeUsed` are parser-required. `createdAt` must be a valid date-time, `analysisId` must exactly equal its index entry, and `projectId` must exactly equal the target project's stable ID and match `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`. Keep the directing sections even when blocked; use explicit empty arrays, `UNKNOWN`, `MISSING`, or a blocking reason instead of fabricated facts or paths.

## knowledgeUsed records

Record every standard, card, or case that materially changed, constrained, rejected, or was overridden during the analysis. The `entryId` must exist in the current director knowledge catalog and `entryKind` must match that entry.

Every record contains all common fields:

```json
{
  "entryId": "DRAMA-PAT-101",
  "entryKind": "card",
  "disposition": "ADOPTED",
  "reason": "人物身份与当前造型承担不同引用职责。",
  "matchedTriggers": ["镜头中有可见具名人物"],
  "matchedExclusions": [],
  "missingInputs": [],
  "outputRefs": [
    {
      "artifact": "AssetPlan",
      "locator": "assetPlan.referenceMatrix[EP01-U01].identity"
    }
  ],
  "entrySnapshot": {
    "title": "人物身份与连续性职责",
    "maturity": "REUSABLE"
  }
}
```

All four arrays exist even when empty. `reason` and `entrySnapshot.title` are non-empty. `outputRefs` use stable artifact names such as `WorldGenreProfile`, `AssetPlan`, `ShotTypePlan`, or `ShotPromptPlan` and a locator that identifies the affected field or stable item ID.

Snapshot requirements depend on `entryKind`:

- `standard`: `title`, `version`, `policyStatus`, and `evidenceStatus` are required.
- `card`: `title` and `maturity` are required.
- `case`: `title` and a valid date-time or date in `updatedAt` are required.

Copy snapshot values from the current entry at analysis time. They are immutable history, not live fields to rewrite when the knowledge entry changes.

Disposition rules:

- `ADOPTED`: explain why the conditions match and include at least one `outputRefs` item. Do not claim adoption when no output changed.
- `REJECTED_CONDITION`: include at least one concrete `matchedExclusions` or `missingInputs` item. An empty reason such as “not used” is insufficient.
- `OVERRIDDEN_BY_HIGHER_PRIORITY`: add `override` with `authority` equal to `USER_DECISION`, `PROJECT_FACT`, or `APPROVED_CONTRACT`, plus a meaningful `locator` and `summary`:

```json
{
  "entryId": "DRAMA-PAT-203",
  "entryKind": "card",
  "disposition": "OVERRIDDEN_BY_HIGHER_PRIORITY",
  "reason": "已批准的单镜头合同优先于通用拆镜建议。",
  "matchedTriggers": ["包含两个动作节拍"],
  "matchedExclusions": [],
  "missingInputs": [],
  "outputRefs": [],
  "entrySnapshot": {
    "title": "复杂动作拆镜",
    "maturity": "OBSERVED"
  },
  "override": {
    "authority": "APPROVED_CONTRACT",
    "locator": "DirectorBrief:DIR-EP01-004",
    "summary": "用户已批准该单元保持一个连续镜头。"
  }
}
```

Do not collapse these decisions into a list of IDs. Do not mark a mismatch as adopted merely to increase usage counts. Knowledge not retrieved or not material to the result does not need a record.

## Readback and meaning

After updating the index, verify both the analysis list and detail through the current local application:

```text
GET /api/projects/<project-id>/analyses
GET /api/projects/<project-id>/analyses/<analysisId>
```

The list must contain the new ID and the detail must return the same source binding and `knowledgeUsed` dispositions, snapshots, and output references. If readback is unavailable, say `Web readback: UNVERIFIED`; if it fails, leave prior records intact and report the exact failure instead of claiming success.

An indexed record is still `DRAFT` unless the user explicitly approved the directing decisions. Indexing does not promote a knowledge entry, accept images or prompts, authorize a creative prompt handoff, generate media, write LibTV, spend credits, publish, or establish playback/human acceptance.
