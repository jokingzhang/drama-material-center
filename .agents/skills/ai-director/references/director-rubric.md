# Director Bible, Brief, and review rubric

Use the shortest artifact that resolves the current scale. Omit fields that truly do not apply; never omit a decision merely because the generation tool lacks a matching field.

## Shared binding and status

- Artifact type and scope:
- Status: `DRAFT` or `APPROVED`
- Exact source paths or URLs, versions, statuses, and read date:
- Working canon, superseded sources, and unknowns:
- Upstream approvals and invalidation conditions:
- User decisions and `DEV-*` / `DIR-*` AI Director decision IDs:
- Readiness by layer: story/directing, prompt inputs, production gates, actual playback or listening, and human approval:

## Script production analysis

Use when the user asks `剧本 → 图片素材 → 分镜提示词`. Keep this at the requested episode, scene, or bounded shot scope.

### 1. WorldGenreProfile

- Script facts, world rules, genre promise, tone, format, aspect-ratio status, and delivery:
- Named characters, creatures, factions, current looks, state changes, signature props, locations, and voices:
- Scene objectives, reversals, causal actions, emotional turns, information releases, and hooks:
- User decisions, `DIR-*` AI Director decisions, unknowns, and invalidation conditions:

### 2. AssetPlan

- Reusable master asset inventory and gaps:
- Clean direct-generation asset inventory and derivation:
- Asset specifications and observable image acceptance:
- Per-shot ReferenceResponsibilityMatrix with separate asset availability and disposition; visible named-character turnarounds use only `CONNECTED`, `NOT_APPLICABLE`, `BUDGET_EXCLUDED`, or `CONFLICT`, with absent required assets recorded as `asset: MISSING` + `disposition: CONFLICT`:

### 3. ShotTypePlan

For every generation unit:

- shot ID and script locator;
- audience effect and one new information item or causal action;
- primary shot type, secondary modifier, and matching knowledge;
- start state, beats, turning/contact point, reaction, end state, and duration-fit result;
- delivery total, provisional unit budget, exact node-duration status, and whether exact timeboxes are currently allowed;
- independent risk class, representative test, fallback split, and stop condition.

### 4. ShotPromptPlan

- Exact reference responsibilities and continuity locks:
- Timeboxed performance, blocking, camera, spatial, action, effect, dialogue, sound, end-state, and edit fields required by the chosen shot type:
- Factual, mapping, duration, model-schema, contamination, playback, and human-approval gates:
- Prompt handoff facts, hard constraints, bounded creative latitude, and preserved decision IDs:

### 5. Knowledge used

- Active standard ID, version, policy status, evidence status, condition match, and adaptation:
- Supporting or conflicting card ID, maturity, condition match, and falsification evidence:

## Director Bible

Use for a project, film, season, serial arc, or dungeon. Do not expand it into a complete shot list unless the user asks or a bounded test requires it.

### 1. Audience and story system

- Audience promise, genre, tone, format, and delivery:
- Narrative engine, protagonist progression, opposition, relationship engine, and major payoffs:
- Act, episode, sequence, or location spine and irreversible changes:
- Information-release and retention strategy:

### 2. Performance, world, and continuity system

- Character performance and blocking principles:
- Space, geography, entrances, exits, axes, and reusable staging zones:
- Character, costume, injury, prop, location, light, and time-state continuity:
- Minimum sufficient reference policy: identity anchors, current continuity inputs, turnarounds, keyframes, props, sound, internal-only references, and clean generation-input responsibilities:

### 3. Visual, shot, edit, and sound system

- Visual phases, motifs, scale, texture, and phase changes:
- Shot-size logic, camera motivation, movement, and action readability:
- Edit rhythm, transitions, repeated structures, and escalation:
- Dialogue perspective, ambience, effects, silence, music, and post-production policy:

### 4. Production design

- What must be generated, performed, composited, carried by sound, or completed in post:
- Reuse plan and asset, continuity, dialogue, voice, reference, model, and cost gaps:
- Scope boundaries, fallbacks, and downstream stop conditions:

### 5. Risk-test portfolio

For each independent risk class:

- risk ID and related decision IDs;
- assumption and intended audience effect;
- smallest representative test;
- what passing proves and does not prove;
- frozen facts and permitted variation;
- observable acceptance, fallback, and stop condition.

## Director Brief

Use for an act, episode, scene, shot, or generation task.

### 1. Dramatic target

- Audience promise and episode or scene function:
- Start state → irreversible end state:
- Objective / obstacle / choice / cost:
- Emotional curve:
- Information to reveal, delay, or hide:

### 2. Performance and blocking

- Character intention and playable action:
- Gaze, distance, touch, weight, and reaction:
- Space, axis, entrances, exits, and foreground/background use:
- Dialogue and sound intention:

### 3. Visual, shot, edit, and sound grammar

- Visual system and phase change:
- Shot-size logic and camera motivation:
- Edit rhythm and transition logic:
- Sound perspective, ambience, effects, silence, and music policy:

### 4. Executable shot strategy

For each generation task:

- shot ID, related `DIR-*` IDs, and duration range;
- one new piece of information or one causal action;
- start state, action, contact or turning point, reaction, and end state;
- shot size, angle, camera and subject movement;
- continuity facts and one-to-one reference responsibilities;
- per visible character and critical object: expected identity, continuity, turnaround, keyframe, prop, and sound disposition; why each supplied reference is necessary, what risk it introduces, and why any expected responsibility is omitted;
- exact dialogue and mouth visibility when applicable;
- edit entrance and exit;
- failure signals and fallback split.

### 5. AI production gate

- Risk class and highest-risk assumption:
- Representative test or link to the Bible portfolio:
- What passing proves and does not prove:
- Model, duration, reference-format, and media-budget constraints; explicit disposition and approval state for anything excluded:
- What is frozen and what may vary:
- Acceptance, fallback, and stop condition:

### 6. Acceptance

List observable tests for story, performance, continuity, action readability, reference effect and contamination, image cleanliness, edit, and sound. Separate machine checks, actual playback or listening, and human approval. A mapped or uploaded reference is not evidence that the model followed it.

### 7. Knowledge used

For each card: ID, maturity, why its conditions match, adaptation made, related decision IDs, and evidence that would validate or reject it here.

## Review verdict

Use one of:

- `ACCEPTED_FOR_CURRENT_USE` — actual viewing or listening passed the stated use.
- `CONDITIONAL` — usable only under named edit, crop, mute, or downstream constraint.
- `REPAIR_REQUIRED` — bounded fix is known.
- `REJECTED` — not suitable for the current use.
- `UNVERIFIED` — required viewing, listening, evidence, or user judgment is missing.

Never shorten these to “done” when acceptance remains conditional.
