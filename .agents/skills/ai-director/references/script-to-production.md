# Script to production analysis

Use this workflow when the input is a script, screenplay, scene, episode, or approved story package and the requested output includes image materials or storyboard/video prompt construction.

## Bind before expanding

Record the exact source, version, approval status, requested scope, delivery format, aspect ratio, model assumptions, and read date. Do not infer portrait framing from landscape LibTV examples. If the format is unknown, keep aspect-ratio-dependent composition decisions open while still completing aspect-independent asset and shot-function analysis.

Separate four ledgers:

- `SCRIPT_FACT`: explicit world, character, plot, dialogue, time, place, costume, prop, injury, and state facts;
- `USER_DECISION`: the user's explicit production or creative choice;
- `AI_DIRECTOR_DECISION`: a reversible proposal with a stable `DIR-*` ID, rationale, tradeoff, and invalidation condition;
- `UNKNOWN`: a missing fact that could change assets, blocking, sound, duration, or shot type.

## 1. Build the WorldGenreProfile

Extract only what affects screen construction:

- world period, geography, social order, technology or magic rules, and prohibited contradictions;
- genre promise, tone, audience, realism level, spectacle scale, rhythm, and violence or intimacy boundary;
- reusable locations, visual phases, material and color families, weather and time states;
- named characters, creatures, factions, costume states, injuries, transformations, signature props, and voices;
- episode, scene, and beat objectives, reversals, reveals, causal actions, emotional turns, and end hooks.

If prose expresses an internal idea that has no observable action, image, sound, object, spatial consequence, or deliberate omission, flag it for Directing externalization rather than hiding it in a prompt adjective.

## 2. Retrieve standards and cards

Validate the project knowledge base, list applicable `ACTIVE` standards, and read them in full. Search `visual-material` using the entities, states, relationships, locations, props, transformations, and continuity risks found above. Search `cinematography` using the scene functions and candidate shot types. Search `workflow` for mapping, duration, reference-budget, or acceptance risks.

For every used item report:

- standard ID, version, and `policyStatus`;
- evidence status or card maturity;
- why its trigger conditions match;
- whether it is adopted, rejected because an exclusion or required input applies, or overridden by a named user decision, project fact, or approved contract;
- the exact output fields affected when it is adopted;
- what current evidence would falsify it.

Current project facts and accepted assets outrank all standards and cards.

## 3. Produce the AssetPlan

Do not start with a fixed image count. First assign every audience-visible fact one primary responsibility, then choose the smallest compatible file set.

For every reusable master or shot-specific asset record:

- asset ID and type;
- story responsibility and scenes or shots that consume it;
- exact character, look, state, location, prop, relationship, or composition represented;
- required views, cleanliness, resolution intent, and prohibited contamination;
- upstream source or master and whether this is `INTERNAL` or a clean `GEN_INPUT`;
- version, continuity scope, status, and supersession relationship;
- observable image acceptance and failure signals;
- whether the asset exists, needs inspection, needs generation, or is blocked by an unresolved decision.

Keep reusable master assets separate from direct per-shot inputs. A character identity asset, current-look turnaround, composition keyframe, interaction pose, scene plate, prop state, and previous accepted frame have different responsibilities even when several are compressed into one file.

Then produce a per-shot `ReferenceResponsibilityMatrix`:

| Shot | Visible fact | Expected responsibility | Asset | Disposition | Why needed | Conflict or contamination risk |
| --- | --- | --- | --- | --- | --- | --- |

Asset availability and production disposition are separate. General dispositions are `CONNECTED`, `NOT_APPLICABLE`, `BUDGET_EXCLUDED`, `MISSING`, and `CONFLICT`; never silently omit an expected responsibility. For a visible named character's turnaround responsibility, the disposition is restricted to `CONNECTED`, `NOT_APPLICABLE`, `BUDGET_EXCLUDED`, or `CONFLICT`. If a required turnaround does not exist, record `asset: MISSING` with `disposition: CONFLICT`; do not use `MISSING` as the turnaround disposition. `MISSING` remains available for other DRAFT responsibilities and always blocks prompt readiness.

## 4. Produce the ShotTypePlan

Split the script into generation units by causal action, new information, continuity boundary, and model risk. Give each unit one primary shot type from the active shot standard. A secondary modifier such as `dialogue`, `continuous`, `montage`, or `repair` may refine it but cannot replace the primary type.

For every generation unit record:

- shot ID, scene and script locator;
- audience effect and one new piece of information or one causal action;
- primary shot type and reason;
- start state, beats, turning or contact point, reaction, and end state;
- intended duration and whether the beats fit it;
- performance, blocking, axis, gaze, contact, camera, edit, dialogue, and sound requirements;
- risk class, smallest representative test, fallback split, and stop condition.

Carry duration at three separate levels: the requested scene or delivery total, a provisional generation-unit allocation, and the exact duration supported by the selected model/node. Unit allocations plus intended edit transitions must reconcile with the total. If model or node duration is unknown, keep beat order and a provisional range, mark exact timeboxes `UNKNOWN`, and block prompt readiness; do not invent second ranges merely to make the plan look complete.

Split the task when it combines independent high-risk mechanisms such as dialogue, transformation, multi-character contact, crowd action, complex effects, or a major transition that cannot all receive readable time.

## 5. Produce the ShotPromptPlan

The ShotPromptPlan is a directing contract, not final creative prose. For each shot provide:

- `shotType`, total-duration context, provisional unit budget, exact node duration status, aspect ratio, model assumptions, and related `DIR-*` IDs;
- one-to-one `referencePlan` using exact assets or explicit missing placeholders;
- global continuity locks;
- ordered beats containing frame/angle, camera movement, subject action or performance, spatial relationship, contact/result, light/effect, and audio as applicable; once `nodeDuration` is known, convert them into unambiguous second-based timeboxes that cover it exactly, otherwise keep the timeboxes `UNKNOWN`;
- exact dialogue, speaker, intent, voice responsibility, time interval, and mouth visibility when dialogue exists;
- final state and edit exit;
- only risk-targeted exclusions;
- factual validation, duration-fit validation, reference-role validation, and observable playback acceptance.

Use `0.0–2.4s` style intervals. Reject ambiguous time notation, aspect-ratio contradictions, role-to-node mismatches, duplicated global blocks, contradictory costume or state descriptions, and undefined tail duration.

Every operational mention of a named character must use the exact canonical full character name, including camera placement, framing and crop boundaries, body parts, blocking, action ownership, gaze, speaker attribution, sound responsibility, and reference mapping. Do not shorten names to a surname such as `江` or `霍`, initials, role labels, or pronouns. Verbatim source quotations and natural spoken dialogue are exempt.

## 6. Emit and, when authorized, register the structured analysis

Keep the human-readable plan and its machine-readable record semantically identical. The structured record is `ScriptProductionAnalysis v1`; read [script-production-analysis-schema.md](script-production-analysis-schema.md) and use its exact root fields, `knowledgeUsed` dispositions, snapshots, output references, project paths, and index format.

Treat the result as project-bound and durable only when all of these are true:

- the request is the full script-to-production analysis for a named, existing material-center project rather than advice, comparison, or review alone;
- the repository-configured workspace and project `project.json` have been resolved and checked;
- `sourceBinding.relativePath` points to the exact existing script file under that project, and the requested version and scope are known;
- the user has not requested a non-persistent answer or prohibited writes.

For that durable case, announce the project ID and target paths, create a new versioned analysis file without replacing an earlier analysis, and register it in `.ai-director/analysis-index.json`. Write the analysis file before updating the index so a failed draft cannot break the currently visible catalog. Preserve every existing index entry, reject duplicate IDs or unsafe paths, and stop rather than repairing or replacing a malformed index without separate authorization. After registration, read the analysis back through the current local application's analysis list and detail API; if that readback is unavailable or fails, report registration as unverified rather than claiming Web visibility.

For every standard, card, or case that materially influenced the plan, populate `knowledgeUsed` from the current knowledge entry. Record adopted rules, condition-based rejections, and higher-priority overrides rather than listing only successful matches. Snapshot the version/status/maturity values at analysis time; do not rewrite older analyses when the knowledge base later changes.

If any durable binding condition is missing, return a non-persistent `DRAFT` and name the missing binding. Do not create `.ai-director`, save the supplied script, invent a placeholder path, or register a conversational answer merely to make the Web page non-empty.

## Handoff and stopping point

Return the analysis as `DRAFT` when assets are missing or material choices remain unresolved. If final generation prompt prose is requested, the Director role authors it by default from the approved WorldGenreProfile, AssetPlan, ShotTypePlan, exact dialogue, reference responsibilities, hard constraints, bounded creative latitude, and decision IDs. Invoke `$doubao-creative-studio` only when the user's current request explicitly asks for Doubao; preserve its return verbatim and route defects through a new bounded Doubao task. In either mode validate the result against this plan and use a fresh read-only reviewer before production.

Analysis registration does not change its approval state. Planning and registration never authorize image/video generation, LibTV writes, paid runs, retries, asset replacement, or knowledge promotion.
