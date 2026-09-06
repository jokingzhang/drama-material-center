# AI Director Sequential Workflow Contract

Use this contract for every multi-stage or production-facing `$ai-director` task. It is an internal Markdown workflow contract, not a project registry or business schema.

## Contents

- Authority order
- Task Packet and stage checkpoint
- Single-session topology
- Review scope and execution reuse
- Main-session review contract
- Local-first LibTV order
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
creativeAuthor: main-session | doubao-creative-studio
authorModel: actual runtime/requested model, with evidence when available
authorSelection: default main-session, or explicit user selection with its scope
upstreamArtifact:
unknownsOrConflicts:
forbiddenActions:
acceptanceCriteria:
```

Use exact current sources. Do not use the entire conversation as a substitute. Maintain this packet across stages and update only current facts, the upstream artifact, changed facts, affected scope, and invalidations. An upstream artifact is usable only while its inputs still match the packet.

For creative prose, bind the minimum factual brief, protected decisions, hard constraints, acceptance criteria, and creative latitude. The default author is the main session (GPT-6 in this workflow); only an explicit user choice selects Doubao. Follow the author selection rules in [SKILL.md](../SKILL.md#select-the-creative-author), including scoped repairs and provenance. Do not label the main session's proposals as user decisions. Mark facts irrelevant to the deliverable `N/A`; unresolved downstream production facts do not prevent an accurately scoped planning draft.

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

`READY_FOR_REVIEW` is a legacy/internal marker for output awaiting the main session's check, not a request to create or wait for a Reviewer. Reuse existing record fields; no new checkpoint file is required. A checked stage does not authorize new spending or human acceptance.

## Single-session topology

- One main session owns Coordinator, Writer, Art, and Director responsibilities and performs only the stages required by dependency.
- Review also stays in that main session. Do not create a review subagent, independent Reviewer task or fresh handoff packet.
- Writer, Art, and Director are sequential modes, not subagents, separate tasks, or parallel workers. Do not shard episodes, scenes, shots, or documents among them.
- A stage change does not cause a new repository inventory or a rewritten handoff packet. Reuse the current verified context, then check the preceding stage result and any invalidation before continuing.
- The main session alone edits formal scripts, indexes, bindings, execution tables, knowledge documents, and production nodes.
- The selected author writes inside each applicable stage: bind facts → write requested prose → validate → update that stage's contract. Default main-session writing and explicit Doubao writing share the same factual and review gates. In Doubao mode preserve its return verbatim and route creative repairs back to Doubao; in default mode the main session writes new versions with its own provenance.
- A separately authorized production action may create a new versioned evidence run or candidate media file, but it may not overwrite an earlier version or promote its own acceptance.
- Only one actor may hold external-write scope for the same project or canvas at a time.

## Review scope and execution reuse

Choose the route from the actual change, not the task phase, version number, file hash alone or number of uploads:

| Current work | Required route |
| --- | --- |
| Newly authored prompts or a requested redesign | Main session reads the actual final body for major problems once; that reading is both author self-check and prompt review |
| Changed story/dialogue, action, camera/crop, edit, sound responsibility, reference content/use or a model parameter that changes the reviewed design assumptions | Same-session check of changed units and affected consumers/continuity boundaries; repair only evidenced problems |
| Upload/re-upload of the same assets, verified Mixed/Node substitution, canvas layout, or administrative metadata outside the model body | Coordinator equivalence and execution checks; no repeated semantic review or scoring |
| A node, edge, metadata or normalization error whose correction restores the exact reviewed contract | Repair that deterministic layer and repeat the failed checks; no new semantic review |
| Requested generation using current checked inputs | Authorized production flow and actual media QA in the main session; no automatic return to creative stages |

For execution reuse, record concise evidence in the existing execution/production record, not a new registry:

1. Locate the source candidate and applicable check, including version/hash and scope. A previous main-session check, still-valid historical independent review or explicit user acceptance can supply relevant evidence. If coverage is missing, check that scope now in the main session; do not block solely for missing Reviewer paperwork or fourteen-dimension scores. Verify current story facts, reference responsibilities and input eligibility. A bare `READY` label is insufficient.
2. Prove that the standalone model body is unchanged after inverse one-to-one reference-token mapping and only the already-recorded UTF-8/LF/end-of-file whitespace extraction rules. Record source/current file and body hashes and the exact transformation. Do not normalize away word, punctuation, timing, field-order or other creative changes. Metadata outside the body may change without adding instructions to the model.
3. Verify the actual reference asset IDs, file hashes, roles and consumers match the reviewed plan, and each new Node contains the intended media. Layout coordinates may change; a mistaken edge, different media file or new reference responsibility is not equivalent. Check the actual model, mode and parameters against the reviewed contract; merely versioning the contract is not evidence of compatibility.
4. Save any changed local execution text/metadata as a new version and update applicable formal bindings/API/page before sync. Retain the source check as source evidence; label current checks as execution validation, never as a new independent verdict. Re-read local/text/video bodies, actual media and incoming edges before each authorized run.

If equivalence fails, stop the affected write/run and locate the difference. Restore the intended checked content/mapping when it is an execution error. A substantive change needs a same-session check of its affected scope. Missing/rejected inputs or unverified hashes remain blockers; this route does not grant generation, spending or acceptance authority.

Execution reuse also requires current hard constraints. Before a future production run, an unchanged single-shot body must be revised locally to meet [the user's multi-shot requirement](shot-block-format.md#mandatory-multiple-shots); an old pass or matching hashes cannot exempt it. Check only the affected prompt and cuts, retaining valid work elsewhere. This requirement does not reopen already usable videos or authorize their regeneration.

For a local repair, retain valid findings for unchanged units, even if the previous batch needed repair elsewhere. Reuse current context and records; do not rebuild review packets or rescore unaffected units. Widen only for an explicit full-review request or evidenced shared impact; missing coverage gets a check of the missing scope. New concrete hard faults warrant checking their consumers, not a search for more optional polish.

## Main-session review contract

Use [review-mode.md](review-mode.md) in the current main session. Review is a focused reading/viewing step, not another agent, role handoff or mandatory scoring round. Reuse current source knowledge and evidence; read only changed inputs again.

The default bar is no major story error, obvious continuity/identity problem or concrete execution blocker. Check exact dialogue and plausible performance time, action ownership and spatial transitions, compatible references, required visible information and actual model constraints. Minor aesthetic or performance differences that preserve the story and edit are non-blocking notes. Detailed fourteen-dimension scoring is optional only when the user requests it; no numerical score is a routine production gate.

Keep one short finding in the existing record: target/scope/version, major problems or none, necessary repair and conclusion. Use existing statuses such as `REVIEW_PASS`, `PASS_WITH_NOTES`, `NEEDS_REPAIR` or `BLOCKED`, identify the method as main-session review, and distinguish unobserved media checks. Do not require a new schema, report file, score table or handoff packet just to show that a review happened.

When no major problem remains, continue the authorized workflow without another review or permission checkpoint. For a concrete fault, fix it within scope and recheck only the change and affected cuts. If it cannot be resolved within authorization, report the evidence and impact while continuing independent work. User requests for detailed critique or scoring do not by themselves authorize subagents, production reruns or changing an accepted take.

Prompt review can pass from actual text, current facts and compatible references before generation. Missing real inputs remain execution blockers; actual media quality still requires viewing/playback/listening. Main-session review never impersonates independent review or human acceptance.

## Local-first LibTV order

Apply this order to creation, redesign, repair and resumed production. Existing authorization permits the scoped actions; it does not permit reversing their dependencies. In resumed production, verify and reuse already-completed local creative/publication stages. Uploading, binding or running an already-checked scope does not restart those stages or require another semantic pass.

1. **Discover read-only.** Inspect current local truth and, when needed, the remote canvas, actual model schema and existing nodes. Do not create or change a canvas, upload assets, edit nodes/edges, sync prompts or run nodes yet.
2. **Complete or verify the local creative scope.** For new/substantive work, settle design and exact dialogue, author the full shot-block bodies, inspect references and check the output in the main session. For already-checked work, verify reusable evidence and proceed. A requested creative batch must be complete locally before its remote writes; a production request does not reopen that batch. Local repairs affect only changed units and dependencies.
3. **Publish current local truth.** Save versioned formal script changes if any, the shot plan/execution table, dialogue contract and prompt bodies in their standard `library/` locations. Update applicable stable story/asset bindings and hashes, keeping draft/review/acceptance states truthful. Verify the local story API, episode API and actual page show the new versions, shot count and dialogue coverage. A candidate manifest, creative-evidence folder or a plan to update indexes later does not satisfy this step. For a text-only task, deliver here with future production conditions explicit.
4. **Set up authorized remote assets.** Only after step 3, create the intended canvas if needed and upload the verified current local assets through `libtv-cli`, following the requested layout. If a new canvas has no Node IDs yet, steps 2–3 use a local reference plan binding each logical `{{Mixed N}}` to a stable asset ID, project-relative path, version, hash and responsibility. Label it `NODE_BINDING_PENDING` in supporting records, never inside the model body. This is a local ordering token, not a claim that a remote node exists. Never fabricate Node IDs or upload first merely to obtain them. Missing actual media remains an explicit blocker, not a fake mapping.
5. **Bind locally before syncing.** Read actual uploaded/existing Node IDs. Record the one-to-one mapping, then create a new local execution version containing the real `{{Node …}}` tokens and updated referencePlan. Do not rewrite prose in the sync command. For verified substitution of the same inputs, perform execution-reuse checks and retain the source findings. Substantive changes get a scoped main-session check. Update formal local bindings and verify the page; the exact validated local execution version is the sync source.
6. **Sync, read back, then run.** Read each standalone UTF-8 prompt body from disk into both its text node and video `data.params.prompt`. Verify both equal the local bytes and record all three hashes plus the actual media list and edges. Immediately before every authorized run repeat that readback. If the correct local source is unchanged, restore remote mismatches from that source and recheck; if local content must change, version and validate it before sync, using the change classification above. Never make the remote canvas the source of a repair.

Record the local version/hash and formal API/page verification before the first remote mutation, then the node-binding version and remote readback, in the existing production evidence. Do not invent a parallel project registry. If a task was interrupted or the page still shows an earlier execution plan, restore the applicable local gate before further remote mutations; do not automatically resume runs. A local-page integration fault is a local repair to complete, not a reason to update LibTV ahead of it.

New continuity frames or media may only exist after generation. Mark those future dependencies honestly in the already-published plan. As each becomes available and is actually accepted for its intended use, integrate it locally and check its compatibility with consuming units. A newly selected media input is not merely a Node substitution: review the affected reference/continuity scope, then republish locally and sync the affected nodes. Re-uploading that same already-reviewed input uses execution checks. Local-first does not mean inventing future media or declaring final acceptance early.

## Canonical character naming

Production-facing storyboards, execution tables, dialogue contracts, asset prompts, video prompts, repair prose, and review notes must use the exact canonical full name for every operational mention of a named character. Never use surname-only forms such as `江` or `霍`, initials, role labels, or pronouns in place of the subject for camera placement, framing, body parts, blocking, action ownership, gaze, speaker, sound, or reference mapping. Verbatim source quotations and natural spoken dialogue are exempt. Treat a violation as a pre-production failure and repair it in a new version.

## Change impact and invalidation

Apply impact analysis whenever `changedFacts` is non-empty or a bound path, version, status, or hash differs. First classify the actual difference under review scope and execution reuse; administrative or verified representation changes do not automatically make semantic evidence stale. Unexplained media hash differences and ineligible inputs still stop their consumers.

| Upstream change | Mark these affected outputs stale |
| --- | --- |
| Story, scene, causality, dialogue, or character-state change | Art requirements, Director Design, prompts, applicable check findings, execution tables, reference plans, and node sync for the affected scope |
| Character identity/look, location, prop, voice, or accepted visual fact change | Director Design, prompts, applicable check findings, execution tables, reference plans, and node sync for every consuming unit |
| Asset status becomes `INTERNAL`, `REJECTED`, `SUPERSEDED`, missing, or hash-mismatched | Every task that uses the asset as generation input |
| Model, duration, aspect ratio, media-count limit, or node schema change | Recheck affected constraints and production sync; invalidate semantic scope only where the change alters reviewed assumptions or requires creative/reference changes |
| User changes the acceptance contract | Affected review verdicts and optional repairs; do not silently rewrite accepted canon |
| A generated take is accepted for continuity | Downstream units that inherit its real frame or state; do not retroactively alter story canon |

Use `STALE_BY_UPSTREAM_CHANGE` only as an internal workflow verdict. Preserve existing project material statuses. Remove `READY_FOR_PRODUCTION` from blocked work until the affected contract is restored and revalidated, or the main session checks the substantive changes. A new execution version with proven equivalence retains valid source findings.

Rebuild the smallest affected scope. A global look, world rule, voice, delivery, or model change may invalidate an episode or batch; a local prop or line change normally invalidates only its consumers.

## Stage gates

Use these meanings without collapsing them:

```text
DRAFT
→ Writer: requested story prose authored and validated → current Story Contract
→ STORY_LOCKED_BY_USER when direction required confirmation
→ Art: requested asset prose authored and validated → ASSET_PACKAGE_CURRENT
→ Director: DIRECTOR_DESIGN_FROZEN → requested prompt authored and validated
→ main-session check: PROMPT_PREFLIGHT_PASS or non-blocking notes
→ LOCAL_DOCUMENTS_CURRENT (formal files, bindings, API and page)
→ authorized canvas/asset setup if needed
→ NODE_BINDING_CURRENT in a new local version + equivalence/mapping checks + local publication
→ READY_FOR_PRODUCTION + verified remote sync
→ GENERATION_AUTHORIZED
→ GENERATED
→ BUSINESS_INTEGRATED
→ MEDIA_QA_PASS | PASS_WITH_NOTES | HARD_REJECT
→ HUMAN_ACCEPTANCE_PENDING
→ ACCEPTED_BY_USER
```

Run only applicable stages; completed stages with current evidence are reused. Substantive changes at node binding receive only a scoped main-session check. Authoring stays inside the relevant stage. These internal stages do not require separate reports or formal-index fields. Carry valid authorization forward; the diagram does not require asking for it again.

## Repair routing

- Fact or user-decision conflict: main session in Coordinator mode, then user only when direction changes.
- Story causality, scene function, dialogue contract, or canon problem: main session in Writer mode.
- Missing or conflicting visual asset responsibility: main session in Art mode.
- Blocking, camera, timing, edit, sound, spatial continuity, or overload problem: main session in Director mode.
- Correct contract or design translated incorrectly into creative prose: the selected author produces a bounded new version. Default: main-session repair. Explicit Doubao mode: new bounded Doubao job, with no main-session creative patching.
- Hash, metadata, reference-token, node or edge mismatch: main session in Coordinator mode stops affected execution, restores the intended reviewed contract and repeats the failed deterministic checks. Substantive template rewrites or reference-content/use changes return the affected scope to creative review.
- Media hard failure: preserve evidence and repair/rerun only within existing authorization and budget; never extend that authority for optional polish.

For a major fault, note the observation, evidence, necessary fix and preserved decisions in the existing record. Repair the earliest faulty layer, then recheck the change in the same session. An execution-only repair repeats the failed deterministic checks. No separate repair brief or review report is needed for a straightforward in-scope fix.

Distinguish a requested redesign from a local repair. Keep valid choices outside the failed dependency and recheck only affected content and cuts. Stop reviewing once no major problem remains. Optional polish does not trigger repeated repair cycles; when the same blocker recurs without a feasible authorized correction, report it instead of repeating the unchanged attempt.
