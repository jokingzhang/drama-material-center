# Main-session review

Review in the current main session. Do not create a Reviewer subagent, separate review task or history-free handoff. Read the actual requested scope once for major problems; the author's final reread can serve this purpose. A repair needs only a recheck of the changed parts and affected cuts.

First apply [review scope and execution reuse](workflow-contract.md#review-scope-and-execution-reuse). Same-asset uploads, verified reference-token substitutions, layout and administrative metadata changes need execution checks only. Reuse valid earlier findings; missing old Reviewer reports or scorecards do not prevent checking the current scope yourself.

Review the artifact that actually exists and declare `reviewTargetType: prompt | media`. Prompt review does not require a generated video. Media review requires actual viewing, continuous playback, or listening for the relevant modality; task status, thumbnails, decoding, and node text cannot replace those observations.

## Bind the review target

Use the existing Task Packet and record to identify the current file/node, version, scope and relevant facts. Do not duplicate the packet or create a report per round. Preserve selected and accepted takes. For new writing check the requested batch; for repairs check changed units and their affected continuity.

Keep a short conclusion: scope/version, major problems or none, repairs and pass/notes/blocker. No fourteen-dimension scores or exhaustive per-shot evidence tables by default. Use detailed scoring only when the user requests it, still in this session; a score does not automatically authorize rewriting or rerunning an accepted take.

## Prompt preflight

For `reviewTargetType: prompt`, apply the quick-check route in `director-knowledge-base/分镜提示词/分镜提示词生产与交付前审查.md`. Focus on wrong story or dialogue, wrong identity/look or references, impossible/conflicting visible actions and geography, clearly overfull dialogue timing, and actual model/execution limits. A blocker needs a concrete text/reference locator and a story or execution consequence. A less elegant cut, underspecified aesthetic preference or minor performance variation is not enough to reject.

Read [the current shot-block format](shot-block-format.md) and verify the actual final body follows it; reject new candidates that retain the old five-section template. Verify continuous timing, canonical operational names, exact dialogue against the local dialogue contract, speaking/voice/mouth responsibilities in the timed scene and the reference mapping. Do not require a duplicate global sound section. Check only claims the evidence can establish: a compatible reference is not proof the future model will follow it. A missing future take or unperformed media QA does not by itself fail prompt semantics. Record real missing inputs or unverified execution capabilities separately; do not invent references to make the packet pass.

Multiple shots are a current hard constraint: require at least two complete timed blocks with actual motivated cuts. A single full-duration block with many inline times, or multiple headings that still prescribe one uninterrupted composition, fails preflight. Check this during the existing final read, not an additional review round; preserve usable historical media as specified by [the multi-shot contract](shot-block-format.md#mandatory-multiple-shots).

When dialogue, OS/VO, comedy or emotion is present, read `对白、梗与情绪的分镜写法.md`. Reconstruct the performed exchange from the final shot blocks: line onset/end, breathing and turn changes, overlapping versus sequential action, listener response and final emotional landing. Reject an evidenced overfull interval; a low average character rate does not excuse unsupported instantaneous answers or an omitted necessary reaction. Unmeasured timing is an estimate, not a performed test. Do not impose a universal pause length or invent new dialogue.

Compare the final words with the necessary visible action, camera geography, dialogue and sound. A design table cannot supply a critical fact missing from the model body. Cite evidence for concrete problems rather than write proof for every passing dimension. Keep local publication and real Node binding as separate execution conditions; a text pass with pending Node IDs does not permit premature prompt sync or generation.

Return `REVIEW_PASS` or non-blocking notes when no major problem remains, with media QA and unresolved execution conditions kept separate. Continue within existing authorization; do not wait for another review opinion or a user acknowledgment of a routine pass. A text pass does not grant new production authorization or media acceptance.

## Media QA

For `reviewTargetType: media`, judge the actual candidate against the current use and the repository's media acceptance rules:

1. **Technical integrity** — dimensions, duration, decoding, missing frames, broken audio, and obvious corruption.
2. **Story legibility** — objective, threat, causal action, result, information order, and hook.
3. **Performance and blocking** — gaze, intention, reaction, contact, weight, timing, and spatial relationships.
4. **Image and material** — identity, costume, injury, prop, location, light, texture, unwanted text, and clean-frame suitability.
5. **Shot and edit** — shot size, axis, camera motivation, action readability, entrance and exit, rhythm, and match continuity.
6. **Sound** — speaker, exact dialogue, emotion, lip visibility, ambience, effects, music, noise, clipping, and mix. Mark subjective listening pending if it was not actually performed.
7. **AI failure** — morphing, duplicated subjects, sliding contact, temporal reset, reference conflict, model artifacts, or excessive task complexity.

For production-facing storyboards, prompts, contracts, and repair text, verify that every operational mention of a named character uses the exact canonical full character name. Surname-only shorthand such as `江` or `霍`, initials, role labels, or pronouns may not replace the subject in camera placement, framing, body parts, blocking, action ownership, gaze, speaker, sound, or reference mapping. Verbatim source quotations and natural spoken dialogue are exempt. Any violation fails pre-production review and requires a new version.

For state-changing actions continuously play the contact-to-completion window and inspect enough intermediate frames to establish the transition. Report `HARD_REJECT`, `PASS_WITH_NOTES`, or passing QA for the observed scope; keep optional polish non-blocking. An unperformed required viewing/listening check remains pending. Never convert media QA into human acceptance or reopen an accepted choice for optional polish.

## Review reference effect, not reference presence

In media QA, compare each supplied reference with its declared responsibility and the actual output. Record whether it was followed, ignored, conflicted, or contaminated the result. For a directly supplied turnaround, inspect identity and body consistency across relevant views and movement, and check for repeated people, panel layout, neutral-pose copying, labels, or studio-background leakage. In prompt review, inspect reference content and compatibility only.

Do not infer generated benefit from upload, input edges, prompt mentions, or successful tasks. Without actual playback, claims about generated reference effect and video quality remain unvalidated; this restriction does not prevent a prompt semantic verdict. When evidence exists, compare against a relevant baseline before recommending broader reuse.

## Repair and continue

For a concrete major fault, note its text locator or media timecode, narrative/execution impact and smallest fix. Repair the earliest faulty layer rather than add generic adjectives or rerun unchanged inputs. The same main session may make authorized edits; a review-only request still does not authorize a rewrite. Text repairs follow the selected author: main-session writing by default, or bounded Doubao repair when explicitly selected.

Recheck the changed content and affected cuts once the repair is ready. Keep earlier valid findings elsewhere and continue when no major problem remains. Non-blocking notes and optional polish do not trigger another pass or generation. If a major fault cannot be fixed within current authority, report it while continuing unaffected work.

Use the [main-session review contract](workflow-contract.md#main-session-review-contract) for concise findings and truthful statuses. Do not create knowledge ledgers, new registries or score reports just to document routine checks. Keep prompt review, actual media QA and human acceptance distinct.
