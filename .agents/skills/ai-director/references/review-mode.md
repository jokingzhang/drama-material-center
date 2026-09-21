# Main-session review

This is the default review entry. The author’s final read is the main-session check, before formal binding. Do not add a Reviewer, Coordinator approval, fresh task, scorecard or second full read to document the same conclusion. For repairs, check the changed content and its actual continuity consequences; preserve valid coverage elsewhere.

## Bind the review target

Use the current artifact, sources, user choices and existing record. Distinguish prompt review from image/video/audio QA without requiring a new field or packet. A new batch needs all new or unverified content read; a resumed batch needs its missing coverage, not just the last edit and not the already-checked remainder. Missing an old review report is not a reason to block work.

Finish names, exact dialogue, shot format, timing and declared-reference checks before switching formal bindings. Use the existing read-only [structural validator](../../doubao-creative-studio/scripts/validate-shot-prompt.mjs) where applicable; it checks format, timing and declared references, not story or media quality. Inspect suspected operational pronouns in context; never globally replace words inside approved speech or source quotations.

## Prompt preflight

Read the actual final body with its declared inputs. Check the following in that same read, without writing proof for every passing item:

- Current story, exact dialogue, speaker/action ownership, look and required visible information agree with the sources.
- Consequential user choices, including new information from the discussion, reach the actual viewing order, performance, framing, sound or edit. A technique name in the design table is insufficient; conversely, no technique quota or additional aesthetic approval is required when the intended scene works.
- Necessary action is visible within the crop; camera side, reference geography, props and start-to-end causal changes are compatible. Essential revelations and reactions are in the model body, not only in a separate design table.
- Speech, breathing, turn-taking, sequential or overlapping actions and listener response plausibly fit. Average character rate alone is insufficient; unperformed timing remains an estimate, not a demand to generate audio for text review.
- Abstract emotion or camera labels do not stand alone as execution. When words such as `softens`, `angry`, `tense`, `cinematic` or `slowly` carry a necessary result, the body also states the observable performance change or the camera's usable start, side, path, speed behavior and landing. Natural-language intent may remain; do not demand arbitrary numbers where a clear physical relation is enough.
- A meaningful emotional turn does not reset merely because the line or peak action ends. Check whether breath, muscle tension, gesture, gaze or posture has a causal residual/recovery state that the ending and affected cut can inherit, unless an abrupt interruption, deliberate mask or cut-off is itself the design. This is one causal continuity check, not a mandatory extra beat, close-up or inner timestamp.
- Apply the [current shot format](shot-block-format.md), [full-name rule](../SKILL.md#use-canonical-full-character-names), exact dialogue and actual model constraints. Choose one or several complete timed shots according to the scene and relevant independent skill. Check that the chosen cuts or uninterrupted motion are coherent; do not impose a two-shot minimum or disguise beat timings as cuts. Preserve the stated H3 exception and already usable historical media.
- Read the sequence as an assembled scene: each consequential cut needs a viewing purpose and a usable connection; a separate generation task needs an actual production or dramatic reason. Check near-identical independent framings for unintended jump cuts, action overlap for compatible direction/phase and a single retained action, and speech/reaction for unbroken meaning. Use [SOP continuity-first](../../../../PRODUCTION_SOP.md#continuity-first), without a new checklist or per-shot proof. A compatible empty set reference does not establish inherited actor/prop positions or exposure.
- References contain compatible facts and serve their declared consumers. Missing/rejected/INTERNAL or conflicting inputs cannot be supplied as valid generation inputs. A label cannot hide conflicting pixels.

Consult the relevant directing method only when needed to make or repair a decision; use [Director inputs](director-role.md#inputs) to find it. Do not load every topic or a long scoring sheet again at final check. Keep audit/status prose out of the model body. Scripts may package or verify authored text, not compose it from boilerplate.

## Decide what actually blocks

| Finding | Action |
| --- | --- |
| Concrete source, text, reference or model conflict, or violated explicit hard requirement | Locate the fault and consequence; repair only affected work, or stop that dependent action if no authorized fix is available. |
| Future model behavior is uncertain, with no evidenced input conflict | Note what an authorized trial must establish; do not keep expanding prompts to promise natural performance or stable pixels. |
| Sound deferred by the user, future continuity frame or Node not yet available | Complete accurately scoped text work; enforce the missing condition before its actual consumer runs. Never invent inputs or claim production readiness that is not established. |
| Index, path, hash or node mismatch | Repair and repeat the failed execution checks under [execution reuse](workflow-contract.md#review-scope-and-execution-reuse); no new creative review for an equivalent restoration. |
| Optional expression, pause, camera or aesthetic improvement | Non-blocking note; no automatic rewrite, extra candidate or generation. |

A blocker needs a concrete locator and narrative/execution consequence or explicit hard-rule violation. Style preferences, missing paperwork and a future unobserved take are insufficient. Preserve requested direction/acceptance checkpoints; `DRAFT` or pending human acceptance alone does not require another “continue” at each responsibility.

## Media QA

Actually open images, continuously play videos and listen to audio. Follow the repository’s media acceptance standard for the current use: story legibility, identity/look/props, action and spatial continuity, edit usability, necessary text, speaker/dialogue/sound and visible artifacts. Technical integrity checks do not replace these observations.

For a state-changing action, continuously inspect the contact-to-completion window and sufficient intermediate frames. Judge against the story and usable edit, not literal perfection against every prompt adjective. Keep `HARD_REJECT`, `PASS_WITH_NOTES` and unobserved checks distinct from user acceptance. Preserve accepted choices; optional polish does not reopen them. A newly evidenced hard fault must include its location and effect.

Check adjacent clips at usable in/out points, using a temporary rough assembly when needed. Remove duplicated overlap before judging the join; inspect motion restart/omission, pose and exposure jumps, and the sound bridge. Separately passing clips do not establish an assembled pass. Reuse valid media and acceptance; this rule does not authorize new generation or optional polish.

## Review reference effect, not reference presence

Inspect actual reference content before use. After generation assess its declared effect only for what was really viewed/heard: followed, ignored, conflicted or contaminated. For character turnarounds, include duplication, pose/panel/text/background leakage and identity/look continuity. Uploads, edges and node text do not establish generated benefit. A baseline is needed before claiming that a reference caused an improvement or recommending broader reuse.

## Repair and continue

Record one short finding in the existing record: scope/version, concrete faults or none, necessary repair and result. Evidence locates actual issues; do not add a report per unit or a table of all passing dimensions. Detailed scoring is optional only on the user’s request; find it through the [knowledge review entry](../../../../director-knowledge-base/分镜提示词/分镜提示词生产与交付前审查.md).

Follow the selected author for authorized repairs; review-only stays read-only. Fix the earliest faulty layer and recheck the changed part and affected cuts. Stop searching for optional improvements when no major problem remains. If a fault persists without a feasible authorized correction, report it and continue unaffected work, rather than repeat the same attempt.

Complete [local publication and execution checks](workflow-contract.md#local-first-libtv-order) when applicable. No new semantic review merely for verified token substitution or resuming execution; run-time readback is still required. Routine passes need no extra acknowledgment. Generation/spending authority and actual media/human acceptance remain separate.
