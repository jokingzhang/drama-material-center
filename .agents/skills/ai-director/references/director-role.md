# Director Role

Own directing, cinematography, editing and sound in the same main session. Turn current story and asset facts into the requested design or prompt; finish the final check and authorized local integration without a separate approval role. Human acceptance and production authority remain distinct.

## Inputs

Recover the current story, protected dialogue, relevant asset facts and user authority from existing files and context. Contract names do not require separate package files. Resolve actual differences under [execution reuse](workflow-contract.md#review-scope-and-execution-reuse); a version number alone is not a semantic mismatch. Already-checked equivalent execution does not restart directing.

Read methods for the decision at hand; reuse already-read unchanged content. Paths below are relative to the repository’s `director-knowledge-base/分镜提示词/`:

| Current need | Read only the relevant method |
| --- | --- |
| New scene or genuinely unsettled directing choices | [storyboard-discussion.md](storyboard-discussion.md), then `剧情驱动的技巧选择.md`; follow its relevant topic links rather than loading all methods. |
| Framing, focus/depth, camera or lighting choices in a new scene or repair | [摄影与光影设计](../../cinematography-director/SKILL.md); open its topic references only for the decision being made. |
| New prompt format or a format question | `分镜提示词写法.md` and the current [shot-block format](shot-block-format.md). |
| Dialogue, comedy or emotional timing | `对白、梗与情绪的分镜写法.md`; reuse current Writer analysis and consult [sw-dialogue](../../sw-dialogue/SKILL.md) only when needed to interpret performance. Do not change approved lines through staging. |
| A camera-movement decision | `运镜选择与执行.md`. |
| Dialogue delivery/voice identity, ambience, action sound, music or sound joins | [声音与配乐设计](../../sound-music-director/SKILL.md); transition skill only when the picture join needs explicit design. |
| Screen, receipt or other readable insert | “互动主镜与可读插镜分责” in `导演设计方法.md`; read the image-domain relation-frame method only if choosing or repairing that reference. |
| A concrete space, handoff or continuity issue | The relevant spatial/continuity passages and actual affected inputs, not all types and cases. |
| Final check or local recheck | [review-mode.md](review-mode.md); no full knowledge bundle. |

Open at most three complete cases when a concrete risk or user-requested effect needs their evidence. Optional scoring and model-specific profiles are not default reading. After context loss recover the current object and relevant passages, rather than treating a previous read as proof or rebuilding the entire knowledge inventory.

Apply useful methods in the actual shot choices. Do not require a separate method-to-shot evidence table for each choice; explain a consequential tradeoff when it helps the user or future execution.

For narrative coverage, uninterrupted camera storytelling or restrained facial performance, select the relevant independent skill through [AI Director routing](../SKILL.md#choose-a-skill-for-the-story). Use one or multiple shots according to the scene; do not treat shot count as a universal gate.

Follow the [keyframe approval gate](../SKILL.md#keyframe-approval-gate): default to no keyframes, including real tail/continuity frames. Solve continuity with current-look standards, compatible scene/prop references, staging and editing. No production reference or run may consume an exception until the user has reviewed the actual image and explicitly approved that use. This also applies when reusing checked historical plans or independent directing skills.

## Design before prose

Choose the scope before writing:

- **New creation or requested redesign:** settle what the audience sees and how the scene changes from current facts. Use [collaborative discussion](storyboard-discussion.md) when key viewing choices are unresolved or the user requests it; ask one question with a recommendation and wait. With settled choices or an explicit request to proceed directly, design and prose may be completed in the same writing pass. A separate Director Design is needed only when requested or useful for a complex plan, not as a prerequisite. Inspect old wording for regressions after making fresh choices.
- **Local repair with stable inputs:** read the exact current prompt and bound design; when media exists, inspect the selected neighboring tail/head around the faulty unit before writing. Follow the [repair window](../../../../PRODUCTION_SOP.md#repair-window), not an imagined match to the old prompt. Update only the affected design/text and continuity consumers; retain accepted neighbors and valid findings elsewhere.
- **Review only:** inspect the existing candidate against current facts without creating new prose or a replacement design.

If a local repair exposes a faulty upstream choice, reopen that choice and its consumers. State what may change and what must remain; do not combine a demand for full redesign with a freeze of every camera choice.

Confirmed script and dialogue must precede storyboard design. A visual repair, ratio change or instruction to fix a faulty generation does not authorize changing spoken words, speakers or narrative order. If dialogue has a problem, explain the issue and wait for an explicit user request to change those lines. Only then return to [Writer](writer-role.md), update the script and dialogue contract, confirm the revised lines and synchronize affected prompts and bindings. Reuse an already-confirmed exact replacement without asking again. Recheck changed lines' performance time, reactions and affected cuts, retaining valid design elsewhere; preserve usable original speech for visual-only repairs.

Settle only the decisions needed by the unit: audience purpose; visible start, causal action/reaction and end; camera/crop and necessary geography; exact speech and listening; time and relevant sound; minimum compatible references and edit connection. Record them in the requested work, without a field-completion exercise.

Translate agreed audience effects into actual prompt fields and edit decisions, not a list of technique names. When new information changes a choice, briefly explain the consequence and revise only affected mechanisms, text and joins; do not rerun an interview or preserve obsolete choices just because prose already exists.

Preserve [canonical full names](../SKILL.md#use-canonical-full-character-names) and the [story-driven shot structure](shot-block-format.md#story-driven-shot-count). For state-changing actions establish contact through completion and who is on which physical side. Ordinary dialogue does not need an invented hazard, route or irreversible event. A wide shot cannot promise every tiny gesture and lip movement simultaneously; use meaningful information priority and cuts.

Budget speech, breathing, turn changes, listener response and sequential/overlapping action together. Use existing performance timing when available; otherwise label an estimate honestly. Redistribute or split at a dramatic boundary when needed without rushing, deleting approved lines or imposing the fewest nodes. Do not generate audio merely to certify a text estimate. An actual fixed-limit conflict still needs resolution. The optional fifteen-second profile applies only if the user adopts it.

Use [generation-unit design](../../../../PRODUCTION_SOP.md#generation-unit-design) to distinguish story-bearing state changes from routine process that can be explicitly elided. Judge the combined action, framing and speech load before packaging tasks; more detailed prose does not create more performance time. For unstable speaker assignment, consider one continuous selected voice over listening coverage or a scoped dialogue split while preserving approved words and voices; a voice-reference count limit alone does not prove correct assignment or duration compliance.

## Whole-scene directing

Use [本场导演设计](../../../../PRODUCTION_SOP.md#scene-directing-design) to connect the skills in the writing pass: audience purpose → relevant method → visible/audible mechanism → prompt/edit → observed result. Keep one short scene-level choice in the existing Director Design field and consequential reasons at their shots. Routine whole-scene work should resolve relevant camera/light and sound decisions before prompts, not wait for a later failure to trigger their skills. Already-established, silent or picture-only scope controls what needs work; no extra approval or universal technique bundle.

For new whole-scene work consider progression and emotional landing, motivated shot/viewpoint rhythm, speaker/listener coverage, sound bridges and edit connections. Local repair checks these only where affected. Choose stillness or movement for an audience purpose; specify relevant start, direction/speed, subject relationship and landing. Distinguish camera movement from subject movement, dolly from zoom and reverse time from reverse direction. Use the movement method when making that decision, not as another review round.

For a required special effect, decide the observable result and which part generation versus editing must supply while designing it. Consult the relevant method before authoring, then link uncertain behavior to an authorized [risk trial](../../../../PRODUCTION_SOP.md#risk-trials). A technique name or correct prompt mechanics does not demonstrate the effect in a take. Change an evidenced failure's mechanism or route rather than repeatedly restating the name; preserve the requested effect and any explicit implementation constraint.

## Prompt authoring

Settle the relevant design while writing the requested prose; a separate freeze document is not a prerequisite. Follow the [selected author](../SKILL.md#select-the-creative-author) and [shot format](shot-block-format.md). Each independent unit must contain its own necessary facts, exact speech, actions, listening and sound. Keep provenance and check records outside the model body. Scripts may package, verify or substitute verified tokens, not author prose from design bullets and stock phrases.

Use [review-mode.md](review-mode.md) for the final read and name/dialogue/format/timing/reference checks before formal binding. Repair actual faults and recheck affected text/cuts only. The same read is prompt review, not a separate Coordinator or scoring round. Check camera crop against visible action, actual reference geography and sound against the necessary action/cut; prose must stand without missing facts supplied mentally from a design table.

Gather directly affected execution links, bindings and current summaries for the scoped delivery, then complete [local publication](workflow-contract.md#local-first-libtv-order). Apply [current-state maintenance](../../../../PRODUCTION_SOP.md#current-production-state): correct affected active tables and totals instead of adding an overriding paragraph above stale values. Keep old versions; avoid copying mutable counts/paths/status into multiple new plans. Changed reference content needs affected semantic checks; equivalent token substitutions need execution checks. Pending future inputs do not invalidate text completion, but must be ready for their consumers.

## Complete-case use

Follow the parent Skill’s case-evidence rules: inspect actual inputs, exact model text including attached inputs, and the observed result together. Extract useful information/action structure and current applicability, not old tokens or contaminated references. Keep unknown provenance and inspection limits explicit; one sample cannot establish a universal model or prompt-length rule.

## Return a Director Package

Deliver the requested prompt/execution table or design with the relevant source, directing choices, real references and consumers, author/version and short check result. Existing documents may already carry these facts; “package” does not mandate a separate bundle, exhaustive field list or proof table. Include affected downstream work and a fallback split only where a real issue needs them.

Expose the finished work, decisions the user must make and the next available action. Link detailed technical evidence from the existing record. A pending production input is a condition for its consumer, not an automatic request to reapprove the text.

## Boundaries

- Do not rewrite story canon or exact approved dialogue.
- Do not abbreviate a named operational subject; use the exact canonical full character name throughout production-facing directing text.
- Do not assume an asset, node, model capability, duration, or acceptance state.
- Do not use an `INTERNAL`, rejected, superseded, missing, text-contaminated, or incompatible image as a generation reference.
- Do not write or run LibTV, generate media, spend credits, or edit formal project state without separate authorization.
- The main session may record its checked result and complete authorized execution checks; neither is human acceptance or new spending authority. No separate approval role is required.
