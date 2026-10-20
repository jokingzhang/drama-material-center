# Shot-block prompt contract

Use the current [video-shot-prompt-v2 template](../../doubao-creative-studio/assets/templates/video-shot-prompt-v2.md) for new and revised video prompts, regardless of author. The stable template path now incorporates the user's asset categories, overall atmosphere and explicit shot lighting. Historical three-field shots, `【全局美学设定】 / 相机 / 构图 / 运镜 / 画面` and `timedBeats` formats are superseded for new writing. Do not migrate accepted media or unchanged upload-only work solely for formatting.

## Current required form

1. One bold summary: total duration, aspect ratio, relevant speech/music/subtitle constraints, and location/time. Use current project facts, not an example's duration, aspect ratio or aesthetic.
2. Include asset categories only for actual references, in character/environment/prop order when present: `**人物资产：**`, `**环境资产：**`, `**物品资产：**`. List verified references with subjects, current look/state and responsibilities. Omit absent categories entirely, rather than writing “无” or “不适用”; do not make assets to fill the template. Add sound/video categories only for actual inputs. Omitting a heading does not permit dropping planned references or necessary scene facts. Keep audit hashes, statuses and Node readiness outside the model body. Reference source-duration facts are not a shot timeline.
3. One `[整体场景与氛围]` section establishes layout/start state, mood, physical light sources and direction, softness/contrast/color relationships, relevant material qualities and motivated environmental motion. Choose these for the story and compatible references; do not impose backlight, halation, grain or cool color on every scene.
4. One `【多分镜时间轴】` introduces real shots in order, separated by horizontal rules. The exact shot heading is `### 0.0s–2.0s｜镜头1：镜头标题`.
5. Each shot has exactly four ordered fields: `**景别与镜头运动：**`, `**画面与动作：**`, `**光影表现：**`, `**音效：**`.
6. Camera prose combines focal length, framing, composition, camera side and movement. Picture prose contains a complete action and result, verbatim dialogue with named speakers, simultaneous listener response and continuity. Lighting prose specifies how the established sources illuminate and shade the visible subject, with relevant skin/material response and background separation. Sound prose states ambience, synchronized sounds and voice bridges without duplicating the dialogue transcript.

## Global atmosphere and shot lighting

Global atmosphere establishes the shared visual premise; the shot lighting field makes it visible at the chosen viewpoint. Write the concrete relationship that matters, such as window light shaping one cheek while reflected room light retains detail in the other. Follow the source's physical location across cuts, rather than preserving an incompatible screen-left label. Movement into shadow or a changed light needs a cause. Ordinary stable lighting can be concise; do not fill every shot with a technical checklist, arbitrary numeric values or unrelated effects. A heading or structural pass cannot establish beautiful or physically coherent lighting in the generated result.

<a id="readable-paragraphs"></a>
## Readable paragraphs

Inside `画面与动作`, use the plain-text labels `构图与主体：`, `道具布局：`, `动作与表演：` when they help. The first describes visible positions, orientation, posture and foreground/background relationships without repeating lens or movement parameters. Props describe relevant location, ownership and current state; action/performance then carries changes, exact dialogue, visible reactions and the final state in causal order. Omit irrelevant labels and paragraphs, especially props when none matter; simple shots may use continuous prose. Do not write empty “无／不适用” sections or invent props, gestures or extra actions to fill them. These are ordinary paragraphs, not bold outer fields, Markdown headings, numbered beats or additional shots. More detail clarifies existing work; it does not increase available performance time.

**One shot has one time range only.** Do not add inner timestamps, numbered performance beats, subshots, second-by-second instructions or dialogue time tables. Dialogue can have ordinary paragraph breaks for readability, without extra times or headings. Continuous actions and subtle expressions unfold naturally in complete prose. State necessary simultaneity with words such as “while speaking”; write actions, reactions and completion in causal order. Do not split every utterance or action into a new shot merely to satisfy the format.

<a id="select-visible-facts"></a>
## From continuity design to model prose

Use the INTERNAL top view and state rows under [actor state continuity](../../../../PRODUCTION_SOP.md#actor-state-continuity) to work out the whole scene, including off-screen actors, prop ownership and adjacent cuts. The model receives only the text and media actually submitted for the current request; do not assume it sees the diagram, preceding task or director's records.

Select the necessary facts for the current framing and action before writing:

- Include the visible or audible subjects, relevant starting conditions, causal action, exact speech and readable response. Include off-screen relationships only when they affect this shot. Translate world-map labels and axis decisions into the chosen camera's visible foreground/background, screen positions and eyelines.
- State each fact where it serves its purpose: references identify assets, atmosphere establishes the shared premise, and shot prose describes the visible event. Do not re-list unchanged hands, positions or props at the end when the action already makes the result clear. Emphasize an ending pose or state when it is needed for the shot's meaning or usable cut.
- Choose actions for the story and edit. Do not add handling, tidying, hand changes or gestures merely to complete a state table. Resolve unnecessary complexity through framing, blocking and motivated cuts or ellipses; keep story-bearing transfers and boundary crossings causally legible.

The picture field does not require `站位锁定：` or `位置承接：`. Write the necessary facts as natural action prose. For example, `林特助右手拿着一张支票，左臂托住打开的公文包。将支票甩向狗仔甲，纸张碰脸后落到鞋前。` already expresses the transfer and result; a second full ending-state inventory is unnecessary. Keep the complete state record for checking the next shot. This selection is about relevance, not a word limit or permission to omit confirmed dialogue or required actions.

## Story-driven shot count

A generation unit may contain one or multiple real shots. Use a new timed heading only when the camera actually cuts to changed coverage, viewpoint or subject. Reaction and detail cuts must have visible photographic choices and a narrative purpose. A one-take movement, door crossing, object transfer or restrained performance can remain one shot; do not invent a cut or multiply headings for its steps.

Choose how the assembled scene connects before packaging units; follow [SOP continuity-first](../../../../PRODUCTION_SOP.md#continuity-first). A motivated change of shot size/angle or matching action can connect independent clips without pretending they are one take. When matching action across clips, allow overlapping source action, specify the intended cut in the edit notes, and count that action only once in the assembly. Real input/duration limits constrain execution; template seconds, old node counts and a beat change do not independently justify a new generation task.

An authorized redesign may change shot count. Update the current shot plan, clip map and affected consumers together; preserve the previous accepted version and its acceptance history. The revised design remains pending human acceptance. Preserve established story, exact dialogue, asset identity and locked media. Do not infer new spending or generation authority.

## Time and validation

Only the shot headings carry time ranges. Each unit begins at 0.0s; later shots use cumulative seconds without resetting. Intervals touch exactly, stay positive and end at the declared total duration. Episode assembly time belongs in the clip map, not the model prompt. Timing remains an estimate until performed.

Use `format: "single-level-shots-lighting"` in the structural validator contract, with durationSeconds, aspectRatio and referencePlan.assets. Validate every current prompt for the summary, any included asset categories, overall atmosphere, four outer fields, cumulative coverage and absence of inner timelines. Asset headings and picture sublabels are not all required; declared references still must be covered. The author also reads every shot for coherent cuts, exact dialogue, feasible performance, physically consistent lighting and compatible references; a machine pass does not establish media quality or human acceptance. `single-level-shots` remains available for historical three-field outputs; `timedBeats: true` is also historical only. Neither is the format for new writing or semantic revisions.

## Local-first publication

Save a versioned local prompt and update formal indexes, clip mapping, any revised shot plan and hashes. Verify API and actual page display before authorized remote synchronization. Use the same local body for text and video nodes; never transform the prompt during upload. Real Node mappings and execution conditions still follow the [local-first workflow](workflow-contract.md#local-first-libtv-order). No remote operation or paid generation is implied by a prompt rewrite.
