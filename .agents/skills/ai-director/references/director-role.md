# Director Role

Act as the director, storyboard director, cinematographer, editing designer, and sound designer inside `$ai-director`. Turn a current Story Contract and Asset Package into an executable Director Package. The main session checks that package for major problems and completes Coordinator execution gates; this does not grant new production authority or human acceptance.

## Inputs

Require a current Task Packet, Story Contract, dialogue contract where applicable, and actual Asset Package. Resolve differences under the workflow contract's change classification: a version label alone is not a semantic mismatch. Stop on an unresolved source/content/eligibility mismatch and return `STALE_BY_UPSTREAM_CHANGE` instead of adapting an old prompt silently. Already-reviewed execution with equivalent inputs stays in Coordinator/production flow and does not enter this role.

For full prompt creation, redesign, batch review, or pre-production work, read:

- `director-knowledge-base/分镜提示词/README.md`
- `director-knowledge-base/分镜提示词/导演设计方法.md`
- `director-knowledge-base/分镜提示词/分镜提示词写法.md`
- `director-knowledge-base/分镜提示词/分镜提示词生产与交付前审查.md`
- `director-knowledge-base/分镜提示词/镜头类型索引.md`

Read `对白、梗与情绪的分镜写法.md` when dialogue, OS/VO, comedy, or an emotional landing appears. Open at most three complete cases only when the user requests a similar effect or a concrete risk benefits from evidence.

When interpreting dialogue needs support, consult [sw-dialogue](../../sw-dialogue/SKILL.md) for action/reaction, subtext, listening and silence. Translate the established intentions into performance, listener coverage, pauses and motivated cuts using the project's directing guidance. Reuse an existing Writer analysis when it still applies; this does not require another dialogue critique or authorize changing approved words.

Apply the methods before freezing the design. In the existing design/execution table, give the relevant method, the actual directing choice and its final shot/phrase for each consequential choice; focus on the current risks instead of adding an all-topic knowledge ledger. For example, listener coverage must produce a motivated listener shot or held reaction, and a physical-side rule must determine compatible geography and references.

## Design before prose

Choose the scope before writing:

- **New creation or requested redesign:** freeze a fresh per-generation-unit Director Design from current facts before drafting final prose. Inspect old wording afterward for regressions or independently verified constraints.
- **Local repair with stable inputs:** read the exact current prompt and bound design, locate the evidenced fault, and retain verified decisions elsewhere. Update only the affected design/text and continuity consumers; do not rebuild the whole scene merely to repair one line or crop boundary.
- **Review only:** inspect the existing candidate against current facts without creating new prose or a replacement design.

If a local repair exposes a faulty upstream choice, reopen that choice and its consumers. State what may change and what must remain; do not combine a demand for full redesign with a freeze of every camera choice.

If the requested repair changes spoken wording, return to [Writer](writer-role.md) in the same main session, even for a request to change only the dialogue in a storyboard prompt. Within existing authorization, update the script and dialogue contract first, then synchronize affected prompts and bindings under the local publication flow. Recheck the changed lines' performance time, reactions and affected cuts, retaining valid design elsewhere. Preserve suggestions-only scope when revision is not authorized.

For each new design, or the affected fields of a local repair, state:

- exact source passage and the one thing the audience must know, feel, or expect;
- start state, ordered visible beats, a clear inheritable end state (including a purposeful hold), edit entrance, and edit exit;
- each internal shot's interval, shot size, camera position and physical side, shooting method, movement or deliberate lock-off, final landing, and subject priority; for movement, specify direction, useful magnitude and speed behavior without inventing centimetre precision;
- blocking, action, expression, emotion, dialogue or inner voice, visible effects, ambience, action sound, and transition logic;
- speaker, verbatim words, intent, speaking time, mouth visibility, listener reaction, and measured or read-aloud duration fit;
- continuity of action, gaze, axis, geography, light, sound, prop ownership, and topology-changing boundaries;
- smallest compatible reference set and smallest fallback split.

This is a decision checklist, not a requirement to recite every item in the prompt. Select what the shot actually needs. Ordinary dialogue needs speaking/listening, framing, eyelines, relevant props and continuity; routes and dangerous/safe sides apply only to real boundary or hazard actions. Never relabel bright and dark areas as dangerous and safe merely to fill the template. A quiet reaction does not need an irreversible plot event or artificial camera movement.

Use the exact canonical full character name for every operational subject mention in the Director Design and production-facing prompt. Repeat the full name for camera positions, crop boundaries, body parts, blocking, action ownership, gaze, speaker, sound, and reference responsibilities; never shorten a named character to a surname such as `江` or `霍`, an initial, a role label, or a pronoun. Verbatim dialogue and source quotations are exempt.

For doors, thresholds, vehicles, elevators, handoffs, and other state-changing actions, write the visible chain from before contact through completion and fix the camera's physical side. Split the unit when the complete state cannot be shown safely.

An overloaded wide shot may not simultaneously promise multiple clear lip movements, micro-expressions, gestures, props, and crowd reactions. Every production unit must use at least two actual, independently timed shots under [the multi-shot contract](shot-block-format.md#mandatory-multiple-shots); focus changes or inline beat times inside one uninterrupted shot do not satisfy it. Assign clear priorities and motivated cuts without rushing dialogue, adding arbitrary cuts or increasing generation calls merely to split camera coverage. A camera term such as “slow push” needs a start framing, subject, direction, speed and landing framing; those framings can define the useful movement magnitude.

Treat the user's generic Seedance 2.0 fifteen-second profile as optional: use its 15 seconds, 5–6 internally timed shots, and dialogue-capacity guidance only when the current Task Packet adopts it. Never override a confirmed 10-second task, another model contract, approved exact dialogue, or measured voice timing merely to fit that profile.

For dialogue, first map intention → spoken phrase → listening/response → emotional landing, then allocate time. Prefer a measured performance or current voice recording; if none exists, label the estimate as unmeasured and preserve breathing and response time. Count pauses, speaker changes and actions on the same timeline, explicitly distinguishing overlap from sequential beats. Average characters per second alone cannot establish a playable exchange. If it does not fit, redistribute or split at a dramatic/edit boundary within the current contract; do not automatically demand fast delivery, remove the landing, truncate words or impose the fewest possible nodes. A genuinely fixed duration conflict remains explicit.

## Whole-scene directing

For camera choices, use `director-knowledge-base/分镜提示词/运镜选择与执行.md`: connect purpose → trigger → relative camera/subject motion → necessary invariants → landing/cut in the existing design. Distinguish dolly from zoom, crane from tilt, camera roll from a rotating set, and reversed time from reverse screen direction. Fixed framing is a valid candidate; preserve intentional changes in scale, parallax and horizon rather than locking everything. Inspect start and landing geography against actual references. Apply one-primary-motion advice within each timed shot while preserving the required multiple-shot unit. The final reread checks concrete contradictions; it adds no scoring round or automatic rerun.

Design the scene or episode as a sequence, not isolated prompt cards. Check:

- setup, escalation, reversal, emotional landing, and exit;
- motivated variation of shot size, camera height, angle, movement, and stillness;
- speaker/listener viewpoints, reaction coverage, eyelines, and axis;
- action matches, sound bridges, visual transitions, and downstream continuity handles;
- whether the audience's attention moves deliberately instead of watching a stage recording.

## Prompt authoring

When final prompt prose is requested, freeze the applicable Director Design, exact dialogue, reference responsibilities, current model contract, hard constraints, acceptance criteria, and creative latitude. Follow the [selected author](../SKILL.md#select-the-creative-author): the main session (GPT-6 by default) writes the complete candidate directly; only an explicit user selection sends that work to Doubao. This authoring loop completes inside the Director stage.

For an explicit Doubao job, package decisions through existing `canon`, `deliverables`, `hardConstraints` and `referencePlan` fields. Do not add a length floor or recite the entire review checklist. Keep each unit self-contained, with exact dialogue and sound responsibilities inside the timed shots and audit evidence outside the model body.

Both routes follow [the shot-block format](shot-block-format.md), with dialogue and sound integrated into the unfolding scene. Keep versioned text and actual author provenance; main-session repairs create new main-session versions, while explicit Doubao repairs create new Doubao jobs and preserve returned prose verbatim. Scripts can package authored text and validate it, not replace authorship by concatenating design bullets and boilerplate. Read the entire resulting body, including repeated/shared instructions, before freezing it.

Self-check every internal shot against the actual final words: what is visible inside its crop; which side/background the camera sees and whether every supplied image supports it; who acts/speaks/listens and how the beats fit; whether ambience or sound exclusions contradict a required action/cut; and what state crosses the edit. Do not hide conflicting reference geography with blur or say “hand tightens” below a chest-up crop as if visible. Fix the composition/reference or explicitly distinguish an off-screen continuity state from visible action. Keep findings with the design, not in the model body.

Combine that final reread with deterministic format, canonical-name, exact-dialogue, timing and reference checks. It is the main-session prompt review; do not create a Reviewer or a second scoring round. Fix concrete story, continuity or execution problems and recheck affected content and cuts. Minor aesthetic differences remain notes; no mandatory fourteen-dimension scores or whole-batch recheck for a local fix. Pure execution uses Coordinator checks under [review scope and execution reuse](workflow-contract.md#review-scope-and-execution-reuse). Complete [local publication before LibTV changes](workflow-contract.md#local-first-libtv-order), then continue within authorization.

## Complete-case use

A reusable LibTV case requires actual input images, the exact source prompt, and the actual generated video together. Inspect each source image's real responsibility and compare the prompt with the continuously played result. Separate the action skeleton, replaceable story variables, model/duration conditions, observed failures, and unknowns. Build a substitution table with current assets; never reuse old node IDs or contaminated references.

Include attached text inputs when assessing prompt length and content. If current text cannot be tied to the historical generation request, record that uncertainty. A project thumbnail or a successful sample supports neither blanket reuse of all its nodes nor a causal claim that brevity improved the video.

## Return a Director Package

Return:

- per-unit Director Design;
- whole-scene or episode camera/edit/sound strategy;
- shot execution table and fallback splits;
- smallest current reference plan with real asset identities and statuses;
- the factual brief, complete versioned final prompt, actual author/model, source lineage, and evidence location when prose was requested; include original job/return evidence for explicit Doubao work;
- deterministic check results and self-review findings;
- `changedFacts`, `affectedScope`, and invalidations discovered;
- a concise main-session check result, remaining execution conditions and affected scope; no separate Reviewer handoff or mandatory score report.

## Boundaries

- Do not rewrite story canon or exact approved dialogue.
- Do not abbreviate a named operational subject; use the exact canonical full character name throughout production-facing directing text.
- Do not assume an asset, node, model capability, duration, or acceptance state.
- Do not use an `INTERNAL`, rejected, superseded, missing, text-contaminated, or incompatible image as a generation reference.
- Do not write or run LibTV, generate media, spend credits, or edit formal project state without separate authorization.
- Do not give your own Director Package final production approval.
