# AI Director Sequential Workflow Contract

Use this contract for every multi-stage or production-facing `$ai-director` task. It is an internal Markdown workflow contract, not a project registry or business schema.

## Contents

- Authority order
- Task Packet and stage checkpoint
- Single-session topology
- Fresh Reviewer contract
- Change impact and invalidation
- Stage gates
- Repair routing

## Authority order

Resolve conflicts in this order:

1. current explicit user decision;
2. current repository and target-project rules;
3. current formal story and asset indexes plus inspected files;
4. current approved upstream stage artifact;
5. directing knowledge and verified complete cases;
6. old prompts, historical task packets, earlier chat, and assumptions.

Do not use agent voting, prose quality, or an inherited status label to override ownership or evidence.

## Task Packet

The main session creates one compact current packet:

```text
taskId:
activeStage: Coordinator | Writer | Art | Director
scope:
expectedDeliverable:
authority: read-only | versioned-creative-run | candidate-media | external-write
sourceBindings: current paths, versions, statuses, and hashes
frozenFacts:
userDecisions:
actualAssetState:
modelDurationFormat:
creativeAuthor: doubao-creative-studio
upstreamArtifact:
unknownsOrConflicts:
forbiddenActions:
acceptanceCriteria:
```

Use exact current sources. Do not use the entire conversation as a substitute. Maintain this packet across stages and update only current facts, the upstream artifact, changed facts, affected scope, and invalidations. An upstream artifact is usable only while its inputs still match the packet.

For creative prose, the responsible Writer, Art, or Director stage adds the minimum factual brief, protected decisions, hard constraints, acceptance criteria, and bounded creative latitude required by `$doubao-creative-studio`. Do not add the main session's aesthetic wording as if it came from the user.

## Stage checkpoint

The main session records each applicable responsibility checkpoint with:

```text
stage:
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

`READY_FOR_REVIEW` means that stage completed its own responsibility. It never means production or human acceptance is authorized.

## Single-session topology

- One main session owns Coordinator, Writer, Art, and Director responsibilities and performs only the stages required by dependency.
- Writer, Art, and Director are sequential modes, not subagents, separate tasks, or parallel workers. Do not shard episodes, scenes, shots, or documents among them.
- A stage change does not cause a new repository inventory or a rewritten handoff packet. Reuse the current verified context, then check the preceding stage result and any invalidation before continuing.
- The main session alone edits formal scripts, indexes, bindings, execution tables, knowledge documents, and production nodes.
- `$doubao-creative-studio` is the sole creative-text author. The main session packages facts, invokes it, saves every new version and evidence run, preserves returned prose verbatim, and performs hard validation. It does not polish, splice, compress, continue, or silently repair Doubao prose.
- A separately authorized production action may create a new versioned evidence run or candidate media file, but it may not overwrite an earlier version or promote its own acceptance.
- Only one actor may hold external-write scope for the same project or canvas at a time.

## Fresh Reviewer contract

Every independent semantic review round uses one newly created read-only Reviewer session. Start it with no inherited turns or conversation history (`fork_turns: "none"` or equivalent). Never reuse an earlier Reviewer, continue it after a repair, or ask it to edit the reviewed object.

Give the fresh Reviewer only:

- [review-mode.md](review-mode.md) and the applicable review rubric;
- the exact frozen Task Packet fields needed for review;
- current source bindings and approved upstream artifacts;
- the exact candidate version, path, and hash;
- acceptance criteria, model/duration/format constraints, and actual reference mapping;
- actual inspection evidence when media is in scope.

Do not forward the full main-session conversation, an earlier Reviewer's reasoning, stale candidates, or rejected references as ambient context. If a rejected alternative is itself an active constraint, state that constraint explicitly in the packet.

Require one final return:

```text
status: REVIEW_PASS | NEEDS_REPAIR | BLOCKED | STALE_BY_UPSTREAM_CHANGE
reviewedTarget: exact version, path, and hash
scorecard:
observedProblems:
evidence:
mustCorrect:
mustPreserve:
repairOwner:
unresolvedFacts:
```

The Reviewer performs independent semantic review and may return a bounded repair brief. It never writes files, rewrites creative prose, changes formal status, invokes Doubao, or approves media on the user's behalf. A candidate change invalidates its verdict; re-review requires another new history-free Reviewer session. If a fresh Reviewer cannot be created, keep the candidate at `READY_FOR_REVIEW`.

## Canonical character naming

Production-facing storyboards, execution tables, dialogue contracts, asset prompts, video prompts, repair prose, and review notes must use the exact canonical full name for every operational mention of a named character. Never use surname-only forms such as `江` or `霍`, initials, role labels, or pronouns in place of the subject for camera placement, framing, body parts, blocking, action ownership, gaze, speaker, sound, or reference mapping. Verbatim source quotations and natural spoken dialogue are exempt. Treat a violation as a pre-production failure and repair it in a new version.

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

Use `STALE_BY_UPSTREAM_CHANGE` only as an internal workflow verdict. Preserve existing project material statuses. Remove `READY_FOR_PRODUCTION` from affected work until it is rebuilt and independently reviewed.

Rebuild the smallest affected scope. A global look, world rule, voice, delivery, or model change may invalidate an episode or batch; a local prop or line change normally invalidates only its consumers.

## Stage gates

Use these meanings without collapsing them:

```text
DRAFT
→ STORY_LOCKED_BY_USER when direction required confirmation
→ ASSET_PACKAGE_CURRENT
→ DIRECTOR_DESIGN_FROZEN
→ DOUBAO_CREATIVE_RETURNED when creative prose is requested
→ READY_FOR_REVIEW
→ REVIEW_PASS + PROMPT_PREFLIGHT_PASS / READY_FOR_PRODUCTION
→ GENERATION_AUTHORIZED
→ GENERATED
→ BUSINESS_INTEGRATED
→ MEDIA_QA_PASS | PASS_WITH_NOTES | HARD_REJECT
→ HUMAN_ACCEPTANCE_PENDING
→ ACCEPTED_BY_USER
```

The internal stages need not be written into formal project indexes. They exist to prevent one kind of evidence from impersonating another.

## Repair routing

- Fact or user-decision conflict: main session in Coordinator mode, then user only when direction changes.
- Story causality, scene function, dialogue contract, or canon problem: main session in Writer mode.
- Missing or conflicting visual asset responsibility: main session in Art mode.
- Blocking, camera, timing, edit, sound, spatial continuity, or overload problem: main session in Director mode.
- Correct contract or design translated incorrectly into creative prose: new bounded `$doubao-creative-studio` repair job; the main session does not patch the text.
- Template, hash, reference, or node mismatch: main session in Coordinator mode stops execution and repairs the deterministic layer.
- Media hard failure: preserve evidence and route a bounded repair; never spend or rerun automatically.

Keep `observed problem`, `evidence`, `must correct`, and `must preserve` in every repair brief. Return to the earliest faulty layer instead of appending generic camera or negative-prompt words downstream. After any candidate repair, use a new history-free Reviewer session for the next independent review.
