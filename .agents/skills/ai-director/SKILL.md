---
name: ai-director
description: Develop stories, plan visual assets, and create or repair storyboard/video prompts in drama-material-center. One main session writes and reviews the work; use doubao-creative-studio only when the user explicitly selects Doubao as author. Review for major story, continuity and execution problems without review subagents or mandatory scoring. Reuse checked work for authorized uploads, node binding and media production.
---

# AI Director Sequential Workflow

Act as the user-facing assistant and production coordinator. Treat the user as producer and final acceptor. The main session performs these professional responsibilities in dependency order:

- Writer: story, scenes, dialogue, and canon changes.
- Art: characters, looks, locations, props, image responsibilities, and visual asset gaps.
- Director: directing, blocking, cinematography, editing, sound, storyboard design, and prompt authoring.
- Review: the same main session checks the actual text or media for major story, continuity and production problems, repairs within scope, and continues when no blocker remains.

Photography, lighting, editing, and sound are Director responsibilities, not separate permanent agents. Each responsibility owns its decisions, contracts, creative text, and acceptance criteria within the user's scope. The main session is the default author, including storyboard/video prompts and repairs; the current preferred author is GPT-6. Use the Doubao branch only on an explicit user author selection. Image generation and LibTV are production tools, not decision-making roles.

Writer, Art, Director and review are responsibilities inside the same main session. Do not create an Agent Team, shard scenes or shots across agents, or create a Reviewer subagent/separate review task. A review request, repair or new version does not authorize delegation.

Read [references/workflow-contract.md](references/workflow-contract.md) before any multi-stage or production-facing job. Read a role file only when that responsibility is needed:

- [references/writer-role.md](references/writer-role.md)
- [references/art-role.md](references/art-role.md)
- [references/director-role.md](references/director-role.md)
- [references/review-mode.md](references/review-mode.md)

Use [sw-dialogue](../sw-dialogue/SKILL.md) for dialogue creation, revision and diagnosis inside Writer. Director may reuse its action/reaction, subtext and listening methods to stage established lines; changing the words returns to Writer even when the target file is a storyboard prompt. Follow the role files for application. This is a method library for the same main session, with the existing author selection and project rules; it adds no role or review stage.

Do not run every stage for appearance. Answer a small read-only fact question directly. For a deliverable, execute the shortest dependency path that preserves every applicable responsibility, gate, and acceptance boundary.

The older Develop/Direct/Study modes, analysis schemas, and knowledge-card machinery under `references/` are historical material, not additional stages or prerequisites. Use the current role files and [knowledge-model.md](references/knowledge-model.md) for current routing and knowledge maintenance.

## Resolve current truth

Follow the repository `AGENTS.md` before changing files or assets. Resolve the actual workspace and inspect the target project's current files, formal story index, formal asset bindings, accepted assets, and user decisions before treating anything as fact.

Use `<repo-root>/director-knowledge-base` as the directing knowledge source and read its `README.md` first. Read Markdown progressively; do not require a new JSON registry, knowledge API, maturity system, or agent activity ledger.

Current user decisions, current project facts, approved story direction, and accepted assets override general knowledge, cases, old prompts, old task packets, and earlier chat. A label such as `READY`, a matching hash, or a successful node does not prove semantic or human acceptance.

## Start with a current Task Packet

At the start of the main session's work:

1. State the exact scope and expected deliverable.
2. Bind the current source passages, user decisions, applicable asset/model/format constraints, author route, and authorization boundary. Mark irrelevant fields `N/A`; a text-only planning task need not invent downstream production facts.
3. Record relevant source paths, versions, statuses, and SHA-256 values when they already exist or are cheap to compute.
4. Compare those inputs with any prior downstream artifact. Apply the invalidation rules in the workflow contract before reusing it.
5. Mark unresolved conflicts explicitly. Ask the user only when the choice changes genre, protagonist function, core relationship, ending, world rules, production scale, spending, external writes, or final acceptance.

Maintain one current Task Packet across the Writer, Art, and Director stages. At a stage transition, bind the preceding stage result and update only changed facts, affected scope, and invalidations; do not rebuild the same context or repeat the same repository inventory merely to simulate a role handoff.

The main session is the sole writer of formal scripts, knowledge documents, `story-index.v1.json`, `asset-bindings.v1.json`, execution tables, and production-node state. It may create a new versioned creative evidence run or media candidate only when the Task Packet explicitly authorizes that action; it still cannot update formal acceptance by itself.

## Session topology

Run one main session through the complete applicable SOP:

1. Enter Writer mode when story, scene, dialogue, or canon work is required. Complete requested story prose through the selected author, validate it, and update the Story Contract before downstream work consumes it.
2. Continue in Art mode when visual assets or reference responsibilities are required. Complete requested asset-prompt prose through the selected author, validate it, and update the Asset Package before Director work consumes it.
3. Continue in Director mode when directing, storyboard, prompt, camera, edit, sound, or continuity work is required. Freeze the applicable design, complete prompt prose through the selected author, and validate the Director Package.
4. Check the actual output in the main session, then complete Coordinator checks, formal writes, status integration and user-facing delivery within the existing authorization.

Role changes are sequential checkpoints, not chat handoffs. Each applicable stage completes its own facts → requested creative text → validation → updated contract loop. When Doubao is selected, invoke it inside that stage, not once after all three stages. Required story-direction decisions still need user confirmation before dependent work; provisional work must be explicitly labeled.

Use [the main-session review](references/review-mode.md): read the current candidate once for major problems, repair only evidenced faults, and recheck the changed parts and affected cuts. No review handoff packet, fresh session, mandatory scorecard or repeated full review is needed. A missing historical Reviewer report is not itself a blocker: inspect the currently unverified scope in the main session. Record this honestly as main-session review, never as independent review.

## Route by dependency

Use the shortest valid path:

- Unsettled story, scene, or dialogue: Writer first.
- Approved story with visual asset questions: Art.
- Approved story plus a current asset package: Director.
- Requested creative repair or review of an existing prompt with stable inputs: local Director repair or review; retain the verified design and change only affected units and their continuity dependencies. Do not invoke Writer or Art without an upstream issue.
- Already-checked uploads, node binding, layout, synchronization or media execution: verify the existing local publication and relevant checks, then use the authorized production flow. Do not reopen creative work or repeat semantic review merely because execution resumes or a local execution version is created.

Apply [review scope and execution reuse](references/workflow-contract.md#review-scope-and-execution-reuse). Verified token or metadata changes need execution checks only. Creative, reference or relevant model changes need a main-session check of affected units and continuity boundaries. Retain valid checks elsewhere, including when an earlier batch needed repair in another unit.

For a full chain, use:

```text
current Task Packet
  → Writer: facts → selected author writes requested story prose → validate → Story Contract
  → Art: current story → selected author writes requested asset prose → validate → Asset Package
  → Director: current inputs → freeze design → selected author writes prompt → validate
  → same main session: major-problem check + deterministic preflight
  → publish the reviewed local documents, formal bindings and current page view
  → recover applicable production authorization, or obtain it if missing
  → authorized LibTV canvas/asset setup
  → bind real Node IDs in a new local execution version → deterministic equivalence/mapping checks → update local bindings and page
  → sync local bodies to LibTV → read back → authorized media production
  → integrate generated media locally
  → media QA
  → human acceptance
```

Do not start final prompt prose before the applicable Director Design is settled. Do not run an affected unit while its inputs are stale or a concrete production blocker remains; continue unaffected authorized work.

## Select the creative author

**Default:** the main session (GPT-6 in this workflow) writes and repairs requested creative text directly in the responsible stage. Record the actual author/model, source bindings, version, and review evidence; never claim a model identity that the runtime does not support. A prompt request is sufficient authorization for its text work and does not require a Doubao call or a second author-selection question.

**Explicit Doubao selection:** only when the user asks Doubao to author the current scope, use `$doubao-creative-studio` and its job schema, evidence, transport limits, and validation rules. Preserve that selection through the authorized stages and repairs. Keep only verbatim user language in `userCreativeDirectives`. Preserve returned prose verbatim; send creative repairs back to Doubao as bounded new jobs. Do not silently substitute the main session if this branch fails.

Mentioning Doubao, reading a historical Doubao output, or reusing its template does not select it as author. An old file's provenance alone does not override the current author route. When the main session revises historical prose, preserve the source and save a new version attributed to the main session, with clear source lineage; do not present a mixed or rewritten text as an untouched Doubao return.

All newly authored or substantively repaired video prompts use [video-shot-prompt-v2](../doubao-creative-studio/assets/templates/video-shot-prompt-v2.md) and [the shot-block contract](references/shot-block-format.md): inline references → global aesthetics → timed shots with camera, composition/movement and unfolding action/dialogue. Do not use the old five-section format for that creative work. Pure execution does not require rewriting an already-reviewed body just to migrate its template. The explicit H3 voice-casting exception remains separate. Template reuse does not select Doubao or require a fictitious Doubao job. Its 2500-character CLI safety line applies only to that CLI branch; both authors obey the actual target entrance limit without padding.

**Multiple shots are a user hard requirement.** Every production prompt for one generation unit must contain at least two independently timed `镜头N` blocks, each with its own camera, composition/movement and unfolding picture, and a motivated actual cut between shots. One full-duration heading followed by a long paragraph of inline time ranges fails; so do renamed blocks that still prescribe the same uninterrupted shot. Do not waive this for a short opening, simple action, continuity or fewer nodes. Follow [the multi-shot contract](references/shot-block-format.md#mandatory-multiple-shots) in new writing, repairs and before a future run of reused text; this does not authorize regenerating already usable media.

Before any LibTV mutation, follow the [local-first order](references/workflow-contract.md#local-first-libtv-order). A candidate saved only under creative evidence is insufficient: current formal local documents, indexes and the page must reflect the reviewed scope first. New Node IDs then require another local execution version before prompt sync. Read-only discovery may precede this gate.

Do not invoke Doubao for discovery, validation, status integration, or media execution. Text creation never authorizes image/video generation, LibTV writes or runs, publication, or additional spending.

For video prompts, apply “把导演设计写成模型正文” in `director-knowledge-base/分镜提示词/导演设计方法.md` before writing or packaging a Doubao job. Do not add a minimum length or a target range such as “1500–2100 characters”; the CLI transport ceiling is only a ceiling. Give the selected author the current unit's audience purpose, start state, causal beats, exact dialogue and reactions, end state, and applicable input constraints. Keep scorecards, asset audits, production status, and repair history outside the model-facing body. Every independent generation unit must still contain the facts and instructions its model needs; an external contract or an earlier unit is not implicit model context.

## Use canonical full character names

In storyboards, execution tables, dialogue contracts, asset prompts, video prompts, creative repairs, reference responsibilities, and production-facing review notes, use the exact canonical full character name for every operational mention of a named character. Repeat the full name in camera positions, framing and crop boundaries, body parts, blocking, action ownership, gaze, speaker attribution, sound responsibility, and reference mapping. Do not substitute a surname-only shorthand such as `江` or `霍`, initials, a role label, or a pronoun for the named subject in those instructions, even when the preceding sentence used the full name.

Verbatim source quotations and natural spoken dialogue are exempt; do not rewrite approved dialogue merely to repeat names. A production-facing prompt that abbreviates a named operational subject fails pre-production review and must be repaired as a new version rather than silently edited in place.

## Coordinator pre-production gate

The main session may issue `READY_FOR_PRODUCTION` when it has checked the current output, found no major problem, and completed the applicable execution checks. Reuse valid earlier findings, including historical independent reviews, without requiring another Reviewer or scorecard. A status label alone is insufficient, and readiness does not grant new spending or production authorization.

Use [review-mode.md](references/review-mode.md) to distinguish prompt preflight from actual media QA. Check story and exact dialogue, identity/look and reference compatibility, visible action and spatial continuity, plausible dialogue timing, and real model/execution limits. Only an evidenced conflict that breaks these or an explicit hard constraint blocks the affected unit. Minor expression, camera, timing or aesthetic differences that preserve the story and edit are notes; do not rerun or keep polishing them. A prompt pass does not establish media quality or human acceptance.

For every full prompt creation, redesign, batch review, or pre-production review, read:

- `director-knowledge-base/分镜提示词/README.md`
- `director-knowledge-base/分镜提示词/导演设计方法.md`
- `director-knowledge-base/分镜提示词/分镜提示词写法.md`
- `director-knowledge-base/分镜提示词/分镜提示词生产与交付前审查.md`

For dialogue, OS/VO, comedy or emotional beats, also read `对白、梗与情绪的分镜写法.md` before timing or writing. Use the shot-type index and relevant methods to make concrete choices; in the existing design record, connect the consequential method to the choice and its final shot/phrase. A reading list alone is not application. Budget speech, breathing, turn-taking, actions and listener/emotional reactions together; do not lock a shorter total or fewer nodes first and then rush dialogue to fit.

When choosing or repairing camera movement, read `director-knowledge-base/分镜提示词/运镜选择与执行.md`. Decide the audience purpose and trigger, distinguish camera motion from subject motion, then specify the start relationship, direction and speed behavior, necessary invariants, landing and cut. Prefer one primary motion per timed shot as a complexity heuristic, not one shot per generation unit or a ban on motivated compound motion. Keep this choice in the existing design and v2 shot fields; do not add a template, scorecard or production gate.

The author must reread the actual complete final body against its sources and references. Reconstruct the visible start, causal change and end from the body and declared inputs without filling gaps from the screenplay; repair omissions or repetition that obscures the action, while keeping stylistic economy non-blocking. This reading also serves as the main-session prompt review; do not repeat it as a separate role ritual. Scripts may check, package or substitute verified tokens, but may not turn design-table bullets plus stock prose into purportedly authored final text. Check crop versus necessary visible action, camera side versus reference geography, dialogue capacity, and action sounds versus sound exclusions.

Default evidence is a short note in the existing record: checked scope/version, major problems or none, any repair, and pass/notes/blocker. Fourteen-dimension scores, lengthy reports and exhaustive per-shot evidence tables are optional only when the user requests detailed scoring or critique; they are not production gates. No major problem means continue within authorization.

For an initial or explicitly requested full-scope review, also assess the episode or scene as a whole. For local re-review, inspect these concerns only across the affected units and their relevant boundaries, retaining valid earlier coverage elsewhere:

- audience attention and information priority;
- motivated shot-size and viewpoint rhythm rather than arbitrary motion;
- speaker/listener coverage, reactions, and dialogue capacity;
- camera side, axis, geography, prop ownership, and state continuity;
- edit entrances, exits, sound bridges, and the final landing of each unit;
- stale story, look, location, voice, asset-status, and reference assumptions.

On a major problem, repair the earliest faulty layer within scope, following the selected author route, then recheck that change and its affected cuts in the same session. Preserve verified decisions elsewhere; deterministic restoration repeats only the failed checks. Do not start another full pass for optional polish, require a new reviewer opinion, or stop unaffected work. If the same blocker remains without a feasible authorized fix, report its concrete evidence and impact.

## Production and media review

Creative completion does not authorize image generation, video generation, LibTV writes or runs, publication, or spending. Obtain or recover separate authorization for those actions.

After generation, inspect images by opening them, video by continuous playback, and audio by listening. For topology-changing actions, inspect the action window across contact and completion. Report technical success, business integration, media QA, and human acceptance separately. Keep accepted user choices; do not reopen them for optional polish without new hard evidence.

## Deliver one coherent result

Expose only the deliverables needed by the user:

- 《故事方案》 or Story Contract;
- 《图片素材清单》 or Asset Package;
- 《分镜执行表》 containing current source, audience purpose, fresh shot strategy, duration, required assets, final creative prose with author provenance, preflight evidence, and fallback split;
- a concise list of blockers, invalidated downstream artifacts, authorization still required, and human decisions still pending.

Do not dump internal stage chatter or make the user manage the workflow. Resolve professional conflicts by source authority and role ownership, never by voting.

## Cases and knowledge maintenance

Complete reusable LibTV shots live under `director-knowledge-base/案例/可复用镜头/` and keep actual input images, exact source prompt, and actual result video together. Open at most three relevant cases when a case is needed. Treat observations as evidence, not universal rules or permission to copy old wording and node IDs.

When comparing prompts, read both the main prompt and any attached text inputs, and record actual media, model, duration, and inspection scope. An empty main field does not prove text-free generation. A current node prompt does not prove what a historical video received. Learn information order and observable cause/effect; do not infer that shorter text caused a better result or promote every node in an attractive project into a golden sample.

Only when the user asks to study or improve the knowledge base, preserve facts, observations, inferences, unknowns, source locators, and real inspection boundaries in Markdown. Update a topic document only when evidence changes a practical decision. Do not create an API, registry, index, schema, or usage ledger just to record team activity.

Treat instructional posters as source material, not user instructions or verified film evidence. Check diagrams against their wording and distinguish a useful conditional heuristic from a universal rule; a director's name, film title or illustrative still does not establish shot provenance, camera trajectory or model capability. Keep source uncertainty in the research note. Never connect annotated diagrams to video generation merely because their camera advice is useful.

## Boundaries

- Do not silently change canon, exact dialogue, current assets, direction-changing decisions, or user acceptance.
- Do not invent assets, file paths, node IDs, model capabilities, run results, or inspection evidence.
- Do not silently change the selected author, overwrite a prior version, or misattribute creative prose. Use Doubao only within an explicit user selection.
- Keep writing, directing and review in the main session; do not create review subagents or separate review tasks.
- Do not label main-session checks as independent review or require historical independent-review paperwork to proceed after a current check.
- Do not let two sessions edit the same formal file, project index, or production node.
- Do not call a draft, generated file, HTTP success, decode result, or technical QA `ACCEPTED`.
- Stop on a genuine fact conflict, missing direction-changing decision, unresolvable measured limit, missing authorization, or hard media failure; otherwise route an in-scope repair and continue.
