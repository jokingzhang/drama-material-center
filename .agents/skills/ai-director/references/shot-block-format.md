# Shot-block prompt contract

Use [video-shot-prompt-v2](../../doubao-creative-studio/assets/templates/video-shot-prompt-v2.md) for new video prompts, redesigns and substantively repaired prose, regardless of author or target video model. Pure execution does not force a template migration. The explicit repository H3 voice-casting exception remains separate. `video-shot-prompt-v1` and its five `〖…〗` sections are historical formats, not a fallback for new writing.

## The user's chosen form

The source is the user's pasted example and the [example LibTV canvas](https://www.liblib.tv/canvas?spaceId=6900884&projectId=aec4bc880636452e9ca7207858ef5a79). Read-only inspection found this organization in video prompts including `v-7LPCBZRcHs` and `v-kSs3HalA5U`, with the latter also in text node `t-A4aNsVK1sz`. These IDs locate format evidence only; never import them as production references. Prompt inspection establishes the requested format, not successful media quality or transferable model capability.

Write a directly usable body:

1. Inline references and their named subjects, such as `{{Mixed 1}} 角色全名。` Use only the current verified mapping. A plot prop may also be referenced where it appears in the action.
2. `【全局美学设定】` with `画幅：`, `影调：`, `摄影：`, `地点：`.
3. `正文：分镜执行动作`, optionally followed by the current scene title.
4. Repeated `镜头N｜MM:SS.d—MM:SS.d｜X秒` blocks containing `相机：`, `构图／运镜：`, `画面：`. Separating `构图：` and `运镜：` is also valid when clearer.
5. Inside each block, unfold action, verbatim dialogue with the full speaker name, listening, emotional change, sounds and the cut as connected prose. Dialogue belongs at the moment it happens; no detached dialogue inventory or repeated global sound section.

Preserve facts, not sample values: 21:9, horror styling, 35°/45° angles, nine shots, numerous references and dense 2–4 second intervals are not defaults. Use the current task's ratio, model, duration and story. Choose one or several shots according to narrative, spatial continuity and performance needs, without a fixed minimum of two. Do not fill every available second with speech.

For a single generation node, internal time starts at `00:00.0` and ends at its actual duration; intervals touch without overlap or gaps and each printed duration equals its interval. Whole-episode assembly time and stable shot IDs belong in the execution table. Do not paste an episode's absolute timecodes into a short node and claim they match its duration. A line may continue across a motivated internal cut; identify the continuing speaker, voice continuity and mouth visibility without making the sentence restart.

## Story-driven shot count

- Use one or more complete, numbered and timed shot blocks. Each contains `相机：`, `构图／运镜：` and `画面：`. A continuous long take or micro-expression performance may use one full-duration block with internal beat times; those beats are not extra shots.
- Choose the form through AI Director's [skill routing](../SKILL.md#choose-a-skill-for-the-story). Use cuts for motivated changes of information, viewpoint or rhythm; preserve continuous motion or restrained performance when that better serves the scene. No special approval is needed simply to use one shot.
- In a multi-shot design, each block represents an actual cut and changed coverage. In a one-take design, describe the uninterrupted camera path and transitions between beats. Do not mislabel one as the other or restart dialogue to manufacture a cut.
- Apply a specific shot-count or no-cut restriction only when explicitly required for the current task. Existing checked text does not need rewriting simply because it contains one shot; current facts, real model limits, references and actual media quality still apply. Preserve historical usable media and spending boundaries.

## Keep production records outside the model body

Keep status, stable IDs, version, author, source hashes, duration evidence, the dialogue contract, referencePlan, review notes and local/remote sync receipts in the execution table, sidecar or creative record, using the repository schema. Scores are optional when requested and also stay outside the model body. Do not prepend `# READY｜…`, insert audit fields between shots, or append the old `〖风格〗／〖空间与轴线〗／〖时间轴〗／〖声音〗／〖参考〗` sections to the model input.

Camera side, crop visibility, voice identity and prop responsibility still must be explicit where they matter in the prose. The supporting records cannot silently supply a fact that the generator needs but the prompt omits. The complete approved line appears in the local dialogue contract and at its timed speaking beat in the prompt; repeating it in a second prompt-wide sound paragraph is unnecessary.

Save each model body as a standalone UTF-8 file, with the exact bytes intended for the text and video nodes. Hash that body, not a report containing it. Formatting, reference-token substitution or trimming happens locally as a new version before sync, never inside an upload script. The [local-first workflow](workflow-contract.md#local-first-libtv-order) covers new canvases whose Node IDs do not yet exist.

For read-only structural checking without a Doubao job, use `node ../../doubao-creative-studio/scripts/validate-shot-prompt.mjs --prompt <body.md> --contract <contract.json>` from this reference directory, or resolve that script from the repository root. The contract contains `durationSeconds`, `aspectRatio` and `referencePlan.assets` with each token and subject. This checks at least one complete block, format, time arithmetic and declared references only; it does not choose the artistic shot count. In the same final read, the main session checks that cuts are real in the design, dialogue fits and assets are compatible, then completes local publication. Actual generated cuts still require playback; no review subagent or scoring report is required.
