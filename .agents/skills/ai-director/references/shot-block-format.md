# Shot-block prompt contract

Use the current [video-shot-prompt-v2 template](../../doubao-creative-studio/assets/templates/video-shot-prompt-v2.md) for new and revised video prompts, regardless of author. The template path is stable; its current content follows the user's cake-shop example. Historical `【全局美学设定】 / 相机 / 构图 / 运镜 / 画面` and `timedBeats` formats are superseded for new writing. Do not migrate accepted media or unchanged upload-only work solely for formatting.

## Current required form

1. One bold summary: total duration, aspect ratio, relevant visual and sound constraints, and location. Use current project facts, not the example's duration, handheld camera, film grain, lenses or cake-shop setting.
2. Verified reference tokens on separate lines with subjects and responsibilities. Keep audit hashes, statuses and Node readiness outside the model body. Reference source-duration facts are not a shot timeline.
3. Real shots in order, separated by horizontal rules. The exact heading form is `### 0.0s–2.0s｜镜头1：镜头标题`.
4. Each shot has exactly three ordered fields: `**画面提示词：**`, `**镜头：**`, `**音效：**`.
5. Picture prose contains a complete action and result, verbatim dialogue with named speakers, simultaneous listener response and continuity. Camera prose combines focal length, framing, composition, camera side and movement. Sound prose states ambience, synchronized sounds and voice bridges without duplicating the dialogue transcript.

<a id="readable-paragraphs"></a>
## Readable paragraphs

**One shot has one time range only.** Do not add inner timestamps, numbered performance beats, subshots, second-by-second instructions or dialogue time tables. Dialogue can have ordinary paragraph breaks for readability, without extra times or headings. Continuous actions and subtle expressions unfold naturally in complete prose. State necessary simultaneity with words such as “while speaking”; write actions, reactions and completion in causal order. Do not split every utterance or action into a new shot merely to satisfy the format.

## Story-driven shot count

A generation unit may contain one or multiple real shots. Use a new timed heading only when the camera actually cuts to changed coverage, viewpoint or subject. Reaction and detail cuts must have visible photographic choices and a narrative purpose. A one-take movement, door crossing, object transfer or restrained performance can remain one shot; do not invent a cut or multiply headings for its steps.

An authorized redesign may change shot count. Update the current shot plan, clip map and affected consumers together; preserve the previous accepted version and its acceptance history. The revised design remains pending human acceptance. Preserve established story, exact dialogue, asset identity and locked media. Do not infer new spending or generation authority.

## Time and validation

Only the shot headings carry time ranges. Each unit begins at 0.0s; later shots use cumulative seconds without resetting. Intervals touch exactly, stay positive and end at the declared total duration. Episode assembly time belongs in the clip map, not the model prompt. Timing remains an estimate until performed.

Use `format: "single-level-shots"` in the structural validator contract, with durationSeconds, aspectRatio and referencePlan.assets. Validate every current prompt for the summary, three fields, cumulative coverage and absence of inner timelines. The author also reads every shot for coherent cuts, exact dialogue, feasible performance and compatible references; a machine pass does not establish media quality or human acceptance. The old `timedBeats: true` option is historical only and must not be used to author or validate new-format work.

## Local-first publication

Save a versioned local prompt and update formal indexes, clip mapping, any revised shot plan and hashes. Verify API and actual page display before authorized remote synchronization. Use the same local body for text and video nodes; never transform the prompt during upload. Real Node mappings and execution conditions still follow the [local-first workflow](workflow-contract.md#local-first-libtv-order). No remote operation or paid generation is implied by a prompt rewrite.
