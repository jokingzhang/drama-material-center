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

Preserve facts, not sample values: 21:9, horror styling, 35°/45° angles, nine shots, numerous references and dense 2–4 second intervals are not defaults. Use the current task's ratio, model, duration and story. The user requires multiple shots: at least two, with the actual count and timing determined by narrative and performance capacity rather than the example's quota. Do not fill every available second with speech.

For a single generation node, internal time starts at `00:00.0` and ends at its actual duration; intervals touch without overlap or gaps and each printed duration equals its interval. Whole-episode assembly time and stable shot IDs belong in the execution table. Do not paste an episode's absolute timecodes into a short node and claim they match its duration. A line may continue across a motivated internal cut; identify the continuing speaker, voice continuity and mouth visibility without making the sentence restart.

## Mandatory multiple shots

- Every production generation unit requires at least two complete, separately numbered and timed shot blocks. Each has its own `相机：`, `构图／运镜：` and `画面：`. Beat-level times inside `画面` may locate speech or contact, but do not count as additional shots. A single `镜头1｜00:00.0—00:18.0｜18秒` heading containing the entire performance is a blocking format failure.
- Blocks must describe actual motivated cuts and changed visual coverage, such as relation → speaker → listener, using a meaningful shot-size, viewpoint or subject change. Two headings over the same uninterrupted composition, or whole-unit instructions such as “全程不切镜”, fail the main-session check. Preserve action, spatial relationships and speech across cuts; do not restart a line or rush its landing to manufacture a second shot.
- This is the user's production requirement, not a claim that single shots are universally bad. No automatic exception for openings, simple actions, long takes, continuity, node count or a restrictive model entrance. If the current model/duration cannot execute it, resolve that constraint within authorization before running; do not silently revert to one shot. The separately scoped non-production H3 voice-casting experiment remains outside this contract.
- Apply it to new/rewritten text and reused text before its next production run. An old single-shot pass does not satisfy the current requirement; repair the affected local prompt and publish it before sync/run. Historical prompts and already usable or user-accepted videos remain preserved; the new writing rule does not itself authorize paid reruns or retroactive rejection.

## Keep production records outside the model body

Keep status, stable IDs, version, author, source hashes, duration evidence, the dialogue contract, referencePlan, review notes and local/remote sync receipts in the execution table, sidecar or creative record, using the repository schema. Scores are optional when requested and also stay outside the model body. Do not prepend `# READY｜…`, insert audit fields between shots, or append the old `〖风格〗／〖空间与轴线〗／〖时间轴〗／〖声音〗／〖参考〗` sections to the model input.

Camera side, crop visibility, voice identity and prop responsibility still must be explicit where they matter in the prose. The supporting records cannot silently supply a fact that the generator needs but the prompt omits. The complete approved line appears in the local dialogue contract and at its timed speaking beat in the prompt; repeating it in a second prompt-wide sound paragraph is unnecessary.

Save each model body as a standalone UTF-8 file, with the exact bytes intended for the text and video nodes. Hash that body, not a report containing it. Formatting, reference-token substitution or trimming happens locally as a new version before sync, never inside an upload script. The [local-first workflow](workflow-contract.md#local-first-libtv-order) covers new canvases whose Node IDs do not yet exist.

For read-only structural checking without a Doubao job, use `node ../../doubao-creative-studio/scripts/validate-shot-prompt.mjs --prompt <body.md> --contract <contract.json>` from this reference directory, or resolve that script from the repository root. The contract contains `durationSeconds`, `aspectRatio` and `referencePlan.assets` with each token and subject. This checks the two-block minimum, format, time arithmetic and declared references only. In the same final read, the main session checks that cuts are real in the design, dialogue fits and assets are compatible, then completes local publication. Actual generated cuts still require playback; no review subagent or scoring report is required.
