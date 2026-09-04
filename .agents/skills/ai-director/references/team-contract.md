# AI Director Team Contract

Use this contract for every delegated or multi-stage `$ai-director` task. It is an internal Markdown handoff, not a new project registry or business schema.

## Contents

- Authority order
- Task Packet and role return
- Single-writer rule
- Change impact and invalidation
- Stage gates
- Repair routing

## Authority order

Resolve conflicts in this order:

1. current explicit user decision;
2. current repository and target-project rules;
3. current formal story and asset indexes plus inspected files;
4. approved upstream role artifact from this run;
5. directing knowledge and verified complete cases;
6. old prompts, historical task packets, earlier chat, and assumptions.

Do not use agent voting to override ownership or evidence.

## Task Packet

Send every role a compact packet containing:

```text
taskId:
role:
scope:
expectedDeliverable:
authority: read-only | versioned-creative-run | candidate-media | external-write
sourceBindings: current paths, versions, statuses, and hashes
frozenFacts:
userDecisions:
actualAssetState:
modelDurationFormat:
upstreamArtifact:
unknownsOrConflicts:
forbiddenActions:
acceptanceCriteria:
```

Use exact current sources. Do not forward the entire conversation as a substitute. An upstream artifact is usable only when its inputs still match the packet.

## Role return

Require each role to return:

```text
status: READY_FOR_REVIEW | NEEDS_REPAIR | BLOCKED | STALE_BY_UPSTREAM_CHANGE
deliverable:
evidence:
assumptions:
unresolvedFacts:
changedFacts:
affectedScope:
invalidates:
repairOwner:
consultedDocuments:
```

`READY_FOR_REVIEW` means the role completed its own responsibility. It never means production or human acceptance is authorized.

## Single-writer rule

- Professional roles are read-only by default and return drafts in their response.
- The coordinator alone edits formal scripts, indexes, bindings, execution tables, knowledge documents, and production nodes.
- Doubao is the author of creative prose; the coordinator may save it verbatim but may not rewrite it.
- A separately authorized role may create a new versioned evidence run or candidate media file, never overwrite an earlier version or promote its own acceptance.
- Only one actor may hold an external-write scope for the same project or canvas at a time.
- A reviewer never modifies the object being reviewed.

## Change impact and invalidation

Apply impact analysis whenever `changedFacts` is non-empty or a bound path, version, status, or hash differs.

| Upstream change | Mark these affected outputs stale |
| --- | --- |
| Story, scene, causality, dialogue, or character-state change | Art requirements, Director Design, prompts, scorecards, execution tables, reference plans, and node sync for the affected scope |
| Character identity/look, location, prop, voice, or accepted visual fact change | Director Design, prompts, scorecards, execution tables, reference plans, and node sync for every consuming unit |
| Asset status becomes `INTERNAL`, `REJECTED`, `SUPERSEDED`, missing, or hash-mismatched | Every task that uses the asset as generation input |
| Model, duration, aspect ratio, media-count limit, or node schema change | Timing, shot count, camera plan where constrained, reference plan, prompt, validation, and production sync |
| User changes the acceptance contract | Affected review verdicts and optional repairs; do not silently rewrite accepted canon |
| A generated take is accepted for continuity | Downstream units that inherit its real frame or state; do not retroactively alter story canon |

Use `STALE_BY_UPSTREAM_CHANGE` only as an internal team verdict. Preserve existing project material statuses. Remove `READY_FOR_PRODUCTION` from affected work until it is rebuilt and reviewed.

Rebuild the smallest affected scope. A global look, world rule, voice, delivery, or model change may invalidate an episode or batch; a local prop or line change normally invalidates only its consumers.

## Stage gates

Use these meanings without collapsing them:

```text
DRAFT
→ STORY_LOCKED_BY_USER when direction required confirmation
→ ASSET_PACKAGE_CURRENT
→ DIRECTOR_DESIGN_FROZEN
→ READY_FOR_REVIEW
→ PROMPT_PREFLIGHT_PASS / READY_FOR_PRODUCTION
→ GENERATION_AUTHORIZED
→ GENERATED
→ BUSINESS_INTEGRATED
→ MEDIA_QA_PASS | PASS_WITH_NOTES | HARD_REJECT
→ HUMAN_ACCEPTANCE_PENDING
→ ACCEPTED_BY_USER
```

The internal stages need not be written into formal project indexes. They exist to prevent one kind of evidence from impersonating another.

## Repair routing

- Fact or user-decision conflict: coordinator, then user only when direction changes.
- Story causality, scene function, or exact-dialogue problem: Writer.
- Missing or conflicting visual asset responsibility: Art.
- Blocking, camera, timing, edit, sound, spatial continuity, or overload problem: Director.
- Correct design translated incorrectly into prose: project `$doubao-creative-studio` repair.
- Template, hash, reference, or node mismatch: coordinator stops execution and repairs the deterministic layer.
- Media hard failure: preserve evidence and route a bounded repair; never spend or rerun automatically.

Keep `observed problem`, `evidence`, `must correct`, and `must preserve` in every repair brief. Return to the earliest faulty layer instead of appending generic camera or negative-prompt words downstream.
