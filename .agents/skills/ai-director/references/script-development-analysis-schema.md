# ScriptDevelopmentAnalysis v1 persistence contract

Use this contract only for a durable, project-bound Develop/Adapt analysis. The Web application reads only explicitly indexed JSON; it never infers knowledge use from ordinary Markdown or conversation.

## Authorization and binding

Persist only when the user names an existing material-center project and the analysis binds an exact existing project-relative idea, outline, treatment, character, or script file. Resolve the actual workspace from `.env.local` `MATERIAL_CENTER_WORKSPACE`; a relative value is relative to the repository root, and the fallback is `<repo-root>/workspace`. Verify `<workspace>/<project-id>/project.json` and the source file before writing.

Do not persist pasted or hypothetical material, ordinary advice, comparison, review-only work, an ambiguous project, or an explicit no-write request. Do not copy chat text into a project merely to create a binding. In those cases return a non-persistent `DRAFT` and state why it was not registered.

`sourceBinding.relativePath` is relative to the project root. It must name the exact source, must not be absolute or contain `..`, and should include the file SHA-256. Record version, scope, read time, status and invalidation conditions when available.

## Project-local files

Use the same append-only project analysis location as production analyses:

```text
<workspace>/<project-id>/.ai-director/
├── analysis-index.json
└── analyses/
    └── <analysisId>.json
```

`analysisId` must match `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`, be unique, and contain a version, for example `SDA-EP01-v01`. Preserve existing index entries. Write the versioned analysis first and update the index last. Stop on a malformed index, conflict or failed binding; never overwrite or rebuild prior records silently.

## Analysis JSON

```json
{
  "schemaVersion": 1,
  "kind": "ScriptDevelopmentAnalysis",
  "analysisId": "SDA-EP01-v01",
  "projectId": "sample-project",
  "createdAt": "2026-08-28T06:00:00.000Z",
  "title": "EP01 剧本诊断与优化",
  "status": "DRAFT",
  "sourceBinding": {
    "relativePath": "library/剧情/EP01.md",
    "sha256": "<64-character SHA-256>",
    "version": "v01",
    "scope": "EP01",
    "readAt": "2026-08-28T06:00:00.000Z"
  },
  "taskContract": {},
  "storyEngine": {},
  "characterEngines": [],
  "relationshipMatrix": {},
  "episodeLadder": [],
  "problemLedger": [],
  "options": [],
  "changePlan": [],
  "unknowns": [],
  "approvalPoints": [],
  "knowledgeUsed": [],
  "doubaoHandoff": {
    "status": "NOT_REQUIRED"
  }
}
```

The parser requires `schemaVersion`, `kind`, `analysisId`, `projectId`, `createdAt`, `sourceBinding.relativePath`, and `knowledgeUsed`. Keep the development sections even when blocked; use explicit empty arrays, `UNKNOWN`, or blocking reasons instead of fabricated facts.

`doubaoHandoff` is retained for compatibility with the Web schema. Use `NOT_REQUIRED` only when no creative prose is requested, `BLOCKED_PENDING_DECISION` while a required story decision remains open, and `READY_FOR_CREATIVE_PROSE` when the approved package can be sent to `$doubao-creative-studio`. Under `$ai-director`, every creative-prose request uses that handoff; the field never authorizes media generation or another external write.

## knowledgeUsed and readback

Use the exact `knowledgeUsed` record and disposition rules in [script-production-analysis-schema.md](script-production-analysis-schema.md). Development output references should use stable artifact names such as `StoryEngine`, `CharacterEngine`, `RelationshipMatrix`, `EpisodeLadder`, `ProblemLedger`, `DevelopmentOption`, or `ChangePlan`.

After updating the index, read back both endpoints:

```text
GET /api/projects/<project-id>/analyses
GET /api/projects/<project-id>/analyses/<analysisId>
```

The detail must return `kind: ScriptDevelopmentAnalysis`, the same source binding, and every knowledge disposition, snapshot and output reference. If readback is unavailable, report `Web readback: UNVERIFIED`; if it fails, preserve prior records and report the exact failure.

Registration leaves the result `DRAFT`. It does not approve a change plan, prove a Doubao result acceptable, promote knowledge, generate media, write LibTV, spend credits or publish.
