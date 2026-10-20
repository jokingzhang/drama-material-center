# AI Director Workflow Contract

Consult the relevant section for source authority, changed inputs, formal publication or resumed execution. This is an internal reference, not a fixed orchestration, task registry or form to complete before work.

## Contents

- Entry points and direct scripts
- Authority order
- Task Packet and stage checkpoint
- Single-session topology
- Review scope and execution reuse
- Main-session review contract
- Local-first LibTV order
- Change impact and invalidation
- Stage gates
- Repair routing

## Entry points and direct scripts

[script-writer](../../script-writer/SKILL.md) owns requested screenplay, story and dialogue creation or revision. [ai-director](../SKILL.md) owns storyboards and image assets, including prompts, authorized image preparation, reference compatibility and actual consumer integration. These are two business entrances used by the same main session, not three sequential roles or new chats.

A user-supplied script can enter ai-director directly. Recover its actual source, version and confirmation scope; do not require script-writer to rewrite it or manufacture a Story Contract handoff first. Existing script/dialogue confirmations remain valid. If a new story or line change is required, explain the concrete issue and use script-writer only within the user's writing authorization; a directing or image repair does not unlock confirmed text.

Within ai-director, settle scene/shot intentions, derive image needs from visible consumers, inspect actual references and revise the affected design or images, then finalize prompts and generation units. Art and directing inform one another; there is no requirement to finish a whole asset package before shot design. Existing records and formal indexes carry these facts without a new approval or parallel registry.

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

Keep a compact context in the existing task record: scope and requested deliverable, authoritative sources and protected user choices, relevant constraints, and the actions the user authorized. Reuse current paths, versions and available hashes for the checks that need them. Omit unrelated fields; no separate packet, prescribed JSON schema or `N/A` inventory is required.

A user instruction grants authority; recording it does not create another approval. Story/Asset/Director contracts name information, not mandatory additional files. Existing scripts, execution tables and formal bindings may already carry it. Do not label an assistant proposal as a user decision, or assume current facts solely from old chat.

For new prose bind the minimum factual brief and creative latitude, then use the [selected author](../SKILL.md#select-the-creative-author). Pending downstream sound, frames or nodes can remain explicit conditions while an accurately scoped text/design task completes.

## Stage checkpoint

A responsibility change is not a new review or user checkpoint. The user's required upstream sequence still applies: confirmed script → confirmed dialogue → storyboard. Reuse existing explicit confirmation for the same version/scope; a main-session check cannot invent a missing user decision. Record only changed facts, affected consumers and any decision needed in the existing record. `READY_FOR_REVIEW` in older records means unchecked content, not a required new Reviewer or report.

Complete names, exact dialogue, format, timing and declared-reference checks before formal binding, alongside the author's final read. Gather the directly affected bindings, execution links and current summaries for this delivery before writing them, then perform applicable API/page readback. Do not postpone a requested partial delivery until unrelated work is complete, overwrite an old version, or rebuild every document to match one version number.

Apply [current-state maintenance](../../../../PRODUCTION_SOP.md#current-production-state) when publishing: the active summary must agree with the selected versions, shot counts, durations, reference links and actual pending work. Update affected existing sections in the new version; keep superseded conclusions in history rather than append conflicting precedence notes. Before merging scoped changes, re-read the latest formal indexes and preserve unrelated updates. If the base changed, reconcile the scoped difference before writing; a task-start snapshot is backup evidence, not a safe whole-index replacement. Maintain one writer for each shared formal file/node.

## Single-session topology

- One main session uses script-writer for authorized writing and ai-director for storyboards/image assets, retaining the same current facts and user decisions. Switching Skills does not require another chat, inventory, approval or handoff packet.
- Review stays in that main session. Do not create production review subagents, role teams or separate Reviewer tasks, or shard episodes, scenes, shots and formal documents among them.
- Inside ai-director, Director and Art are responsibilities in one design loop, not fixed sequential modes. Preserve unchanged checked work and update only actual differences and consumers.
- The main session alone edits shared formal scripts, indexes, bindings, execution tables, knowledge documents and production nodes. Keep one writer for each shared formal file/node.
- The selected author writes the requested prose within its approved scope. Default main-session writing and explicit Doubao writing share the same factual and review boundaries; preserve Doubao returns and return its creative repairs to that author.
- Authorized production may create new versioned evidence or media, not overwrite earlier versions or promote its own acceptance. Only one actor holds external-write scope for the same project/canvas at a time.

## Review scope and execution reuse

Choose the route from the actual change, not the task phase, version number, file hash alone or number of uploads:

| Current work | Required route |
| --- | --- |
| Newly authored prompts or a requested redesign | Main session reads the actual final body for major problems once; that reading is both author self-check and prompt review |
| Changed story/dialogue, action, camera/crop, edit, sound responsibility, reference content/use or a model parameter that changes the reviewed design assumptions | Same-session check of changed units and affected consumers/continuity boundaries; repair only evidenced problems |
| Upload/re-upload of the same assets, verified Mixed/Node substitution, canvas layout, or administrative metadata outside the model body | Main-session equivalence and execution checks; no repeated semantic review or scoring |
| A node, edge, metadata or normalization error whose correction restores the exact reviewed contract | Repair that deterministic layer and repeat the failed checks; no new semantic review |
| Requested generation using current checked inputs | Authorized production flow and actual media QA in the main session; no automatic return to creative stages |

For execution reuse, record concise evidence in the existing execution/production record, not a new registry:

1. Locate the source candidate and applicable check, including version/hash and scope. A previous main-session check, still-valid historical independent review or explicit user acceptance can supply relevant evidence. If coverage is missing, check that scope now in the main session; do not block solely for missing Reviewer paperwork or fourteen-dimension scores. Verify current story facts, reference responsibilities and input eligibility. A bare `READY` label is insufficient.
2. Prove that the standalone model body is unchanged after inverse one-to-one reference-token mapping and only the already-recorded UTF-8/LF/end-of-file whitespace extraction rules. Record source/current file and body hashes and the exact transformation. Do not normalize away word, punctuation, timing, field-order or other creative changes. Metadata outside the body may change without adding instructions to the model.
3. Verify the actual reference asset IDs, file hashes, roles and consumers match the reviewed plan, and each new Node contains the intended media. Layout coordinates may change; a mistaken edge, different media file or new reference responsibility is not equivalent. Check the actual model, mode and parameters against the reviewed contract; merely versioning the contract is not evidence of compatibility.
4. Save any changed local execution text/metadata as a new version and update applicable formal bindings/API/page before sync. Retain the source check as source evidence; label current checks as execution validation, never as a new independent verdict. Re-read local/text/video bodies, actual media and incoming edges before each authorized run.

If equivalence fails, stop the affected write/run and locate the difference. Restore the intended checked content/mapping when it is an execution error. A substantive change needs a same-session check of its affected scope. Missing/rejected inputs or unverified hashes remain blockers; this route does not grant generation, spending or acceptance authority.

Execution reuse requires the current task's facts and real constraints. Follow the [story-driven shot structure](shot-block-format.md#story-driven-shot-count): single-shot and multi-shot bodies may both be reused when suitable. Do not force a rewrite, additional approval or rerun solely to reach two shots. Recheck changed creative choices and affected continuity only; preserve usable media and spending boundaries.

For a local repair, retain valid findings for unchanged units, even if the previous batch needed repair elsewhere. Reuse current context and records; do not rebuild review packets or rescore unaffected units. Widen only for an explicit full-review request or evidenced shared impact; missing coverage gets a check of the missing scope. New concrete hard faults warrant checking their consumers, not a search for more optional polish.

## Main-session review contract

[review-mode.md](review-mode.md) owns the default check, severity and stopping rules. The author's final read supplies that check; there is no second Coordinator verdict or mandatory scorecard. Reuse valid context and findings, and inspect only missing or changed coverage and its actual continuity consequences.

Keep one short finding in the existing record: scope/version, concrete problems or none, repair and conclusion. Record evidence for a fault; do not prove every passing dimension. Existing statuses are descriptive, not a new required state machine. Routine passes do not require user acknowledgment; explicit direction/acceptance checkpoints and production authority still apply.

## Local-first LibTV order

Apply this order to creation, redesign, repair and resumed production. Existing authorization permits the scoped actions; it does not permit reversing their dependencies. In resumed production, verify and reuse already-completed local creative/publication stages. Uploading, binding or running an already-checked scope does not restart those stages or require another semantic pass.

Before reference publication or remote setup, apply the [keyframe approval gate](../SKILL.md#keyframe-approval-gate). Default to no keyframes. User approval must cover the actual frame and consumer before promoting it to generation input, uploading it as a production reference, connecting/syncing it or running. Historical acceptance, execution reuse and broad production authority do not bypass this gate.

1. **Discover read-only.** Inspect current local truth and, when needed, the remote canvas, actual model schema and existing nodes. Do not create or change a canvas, upload assets, edit nodes/edges, sync prompts or run nodes yet.
2. **Complete or verify the local creative scope.** Before directing, recover the locked project orientation and the user's script/dialogue confirmations. Then settle design, author the full shot-block bodies without changing confirmed words/speakers/order, inspect references and check the output in the main session. For already-checked work, verify reusable evidence and proceed. A requested creative batch must be complete locally before its remote writes; a production request does not reopen that batch. Local repairs affect only changed units and dependencies.
3. **Publish current local truth.** Save any explicitly authorized script/dialogue changes through script-writer, plus the current shot plan/execution table, applicable dialogue contract, image prompts/assets and video prompt bodies in their standard `library/` locations. Update applicable stable story/asset bindings and hashes, keeping draft/review/acceptance states truthful. Verify the local story API, episode API and actual page show the new versions, shot count and dialogue coverage. A candidate manifest, creative-evidence folder or a plan to update indexes later does not satisfy this step. For a text-only task, deliver here with future production conditions explicit.
4. **Set up authorized remote assets.** Only after step 3, create the intended canvas if needed and upload the verified current local assets through `libtv-cli`, following the requested layout. If a new canvas has no Node IDs yet, steps 2–3 use a local reference plan binding each logical `{{Mixed N}}` to a stable asset ID, project-relative path, version, hash and responsibility. Label it `NODE_BINDING_PENDING` in supporting records, never inside the model body. This is a local ordering token, not a claim that a remote node exists. Never fabricate Node IDs or upload first merely to obtain them. Missing actual media remains an explicit blocker, not a fake mapping.
5. **Bind locally before syncing.** Read actual uploaded/existing Node IDs. Record the one-to-one mapping, then create a new local execution version containing the real `{{Node …}}` tokens and updated referencePlan. Do not rewrite prose in the sync command. For verified substitution of the same inputs, perform execution-reuse checks and retain the source findings. Substantive changes get a scoped main-session check. Update formal local bindings and verify the page; the exact validated local execution version is the sync source.
6. **Sync, read back, then run.** Run the combined project-format/dialogue `check` before syncing. Read each standalone UTF-8 prompt body from disk into both its text node and video `data.params.prompt`. Verify both equal the local bytes and record all three hashes plus the actual media list and edges. Use the combined gate for video creation and every authorized run; it checks confirmed dialogue and repeats live readback before spending. If the correct local source is unchanged, restore remote mismatches from that source and recheck; if local content must change, version and validate it before sync, using the change classification above. Never make the remote canvas the source of a repair.

Record the local version/hash and formal API/page verification before the first remote mutation, then the node-binding version and remote readback, in the existing production evidence. Do not invent a parallel project registry. If a task was interrupted or the page still shows an earlier execution plan, restore the applicable local gate before further remote mutations; do not automatically resume runs. A local-page integration fault is a local repair to complete, not a reason to update LibTV ahead of it.

Do not create future continuity-frame dependencies by default. For a user-reviewed keyframe exception, the candidate may only exist after generation; keep it explicitly pending and do not invent approval. Once the user has seen and explicitly approved that exact frame and intended use, integrate it locally and check compatibility with consuming units. A newly selected media input is not merely a Node substitution: review the affected reference/continuity scope, then republish locally and sync the affected nodes. Re-uploading that same already-reviewed input uses execution checks. Local-first does not mean inventing future media or declaring final acceptance early.

## Canonical character naming

Apply [the full-name rule](../SKILL.md#use-canonical-full-character-names) to production-facing text before formal publication, exempting verbatim speech and source quotations. Use canonical names to establish identity, mark subject changes and disambiguate ownership; continuous actions may use clear subject omission or pronouns. Their presence alone is not a violation. Repair actual identity or ownership errors as new versions and check the changed meaning, without global replacements or reopening unrelated creative decisions.

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

Stage labels describe what the current evidence establishes. They do not prescribe a complete run or require fields in the formal index. Distinguish authored text, checked text, current local publication, synchronized execution, generated media, observed QA and user acceptance. A later unmet condition does not negate an earlier completed deliverable.

Use only applicable dependencies. Local-first order and run-time readback remain required for authorized remote production. Missing required inputs stop their consumers, while deferred or future inputs do not block independent text work. `DRAFT` or pending human acceptance alone does not create a new pause: preserve user-requested checkpoints and wait only where a required decision or authorization is missing. Never relabel a draft as accepted merely to continue.

## Repair routing

- Fact or user-decision conflict: recover current authority in the main session; ask only where an unresolved consequential decision is actually needed.
- Story, causality, dialogue or canon problem: identify the concrete effect; use script-writer for authorized writing/diagnosis. A problem does not authorize changing confirmed lines; update source/contract and affected shots only within the user's explicit change scope.
- Missing or conflicting visual asset: ai-director checks the real shot consumer, reference and design together, then repairs the smallest affected image/design scope.
- Blocking, camera, timing, edit, sound, spatial continuity or overload: ai-director applies the relevant method and updates affected shots, image consumers and joins.
- Correct contract or design translated incorrectly into creative prose: the selected author produces a bounded new version. Default: main-session repair. Explicit Doubao mode: new bounded Doubao job, with no main-session creative patching.
- Hash, metadata, reference-token, node or edge mismatch: main session stops affected execution, restores the intended reviewed contract and repeats the failed deterministic checks. Substantive template rewrites or reference-content/use changes return the affected scope to creative review.
- Media hard failure: preserve evidence and repair/rerun only within existing authorization and budget; never extend that authority for optional polish.

For a major fault, note the observation, evidence, necessary fix and preserved decisions in the existing record. Repair the earliest faulty layer, then recheck the change in the same session. An execution-only repair repeats the failed deterministic checks. No separate repair brief or review report is needed for a straightforward in-scope fix.

Distinguish a requested redesign from a local repair. Keep valid choices outside the failed dependency and recheck only affected content and cuts. Stop reviewing once no major problem remains. Optional polish does not trigger repeated repair cycles; when the same blocker recurs without a feasible authorized correction, report it instead of repeating the unchanged attempt.
