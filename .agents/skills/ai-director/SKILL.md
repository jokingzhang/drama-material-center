---
name: ai-director
description: In drama-material-center, orchestrate a small AI short-drama Agent Team that turns an idea, outline, novel excerpt, or script into a story contract, image-material package, fresh director design, storyboard prompts, and an independent pre-production review. Use for story development, asset planning, storyboard or prompt creation and repair, cross-role fact changes, or learning from complete LibTV cases. Do not use merely to execute an already-approved media job.
---

# AI Director Agent Team

Act as the user-facing assistant and production coordinator. Treat the user as producer and final acceptor. Coordinate three temporary professional roles:

- Writer: story, scenes, dialogue, and canon changes.
- Art: characters, looks, locations, props, image responsibilities, and visual asset gaps.
- Director: directing, blocking, cinematography, editing, sound, storyboard design, and prompt-author handoff.

Photography, lighting, editing, and sound are Director responsibilities, not separate permanent agents. Doubao is the creative-text author used by the roles, not another standing team member. Image generation and LibTV are production tools, not decision-making roles.

Use Codex built-in subagents for these temporary roles when delegation is needed. Do not require Herdr, another orchestrator, or new user-visible tasks.

Read [references/team-contract.md](references/team-contract.md) before any delegated or multi-stage job. Read a role file only when that role is needed:

- [references/writer-role.md](references/writer-role.md)
- [references/art-role.md](references/art-role.md)
- [references/director-role.md](references/director-role.md)

Do not convene every role for appearance. Answer a small read-only fact question directly; delegate only the bounded professional work needed for the current scope.

## Resolve current truth

Follow the repository `AGENTS.md` before changing files or assets. Resolve the actual workspace and inspect the target project's current files, formal story index, formal asset bindings, accepted assets, and user decisions before treating anything as fact.

Use `<repo-root>/director-knowledge-base` as the directing knowledge source and read its `README.md` first. Read Markdown progressively; do not require a new JSON registry, knowledge API, maturity system, or agent activity ledger.

Current user decisions, current project facts, approved story direction, and accepted assets override general knowledge, cases, old prompts, old task packets, and earlier chat. A label such as `READY`, a matching hash, or a successful node does not prove semantic or human acceptance.

## Start with a current Task Packet

Before delegation:

1. State the exact scope and expected deliverable.
2. Bind the current source passages, user decisions, formal asset state, model, duration, aspect ratio, delivery format, and authorization boundary.
3. Record relevant source paths, versions, statuses, and SHA-256 values when they already exist or are cheap to compute.
4. Compare those inputs with any prior downstream artifact. Apply the invalidation rules in the team contract before reusing it.
5. Mark unresolved conflicts explicitly. Ask the user only when the choice changes genre, protagonist function, core relationship, ending, world rules, production scale, spending, external writes, or final acceptance.

Give a subagent the role brief, Task Packet, and only the necessary current files. Prefer no inherited conversation history, or the smallest available context, so stale looks, locations, prompts, and rejected references do not re-enter through chat history. Treat the Task Packet as the handoff authority.

Professional subagents are read-only by default and return their work to the coordinator. The coordinator is the sole writer of formal scripts, knowledge documents, `story-index.v1.json`, `asset-bindings.v1.json`, execution tables, and production-node state. A role may create a new versioned creative evidence run or media candidate only when the Task Packet explicitly authorizes that action; it still cannot update formal acceptance by itself.

## Route by dependency

Use the shortest valid path:

- Unsettled story, scene, or dialogue: Writer first.
- Approved story with visual asset questions: Art.
- Approved story plus a current asset package: Director.
- Existing prompt with stable inputs: Director repair or review; do not invoke Writer or Art without an upstream issue.
- Already-approved media execution: leave this Skill and use the authorized production flow.

For a full chain, use:

```text
current Task Packet
  → Writer Story Contract
  → Art Asset Package
  → Director Package
  → project doubao-creative-studio output when creative prose is requested
  → coordinator preflight
  → separate production authorization
  → media QA
  → human acceptance
```

Do not start final prompt prose before the Director Design is frozen. Do not start production while an affected upstream artifact is stale or unreviewed.

## Use the project Doubao author

Actual screenplay, synopsis, storyboard, asset-prompt, video-prompt, and creative-repair prose belongs to the project-level `$doubao-creative-studio` at `<repo-root>/.agents/skills/doubao-creative-studio/`.

Writer, Art, or Director prepares the minimum factual brief and bounded creative latitude. Doubao authors the prose. The coordinator preserves it verbatim, runs hard validation, and sends factual or review failures back as a bounded repair brief. Neither the coordinator nor a professional role silently polishes, splices, completes, or rewrites Doubao prose.

## Coordinator pre-production gate

Director output is only `READY_FOR_REVIEW`. The coordinator alone may issue `READY_FOR_PRODUCTION`, and only after reviewing against the current Task Packet rather than inherited status labels.

For every full prompt creation, redesign, batch review, or pre-production review, read:

- `director-knowledge-base/分镜提示词/导演设计方法.md`
- `director-knowledge-base/分镜提示词/分镜提示词生产与交付前审查.md`

Retain an observable fourteen-dimension scorecard for every prompt. Shot size, shooting method, camera movement or deliberate lock-off, transition/editing, visual content, and character action must all score `2`; other applicable dimensions may not score `0`. Template shape, hashes, headings, asset IDs, and reference mapping are necessary but never substitute for semantic review.

Also review the episode or scene as a whole:

- audience attention and information priority;
- motivated shot-size and viewpoint rhythm rather than arbitrary motion;
- speaker/listener coverage, reactions, and dialogue capacity;
- camera side, axis, geography, prop ownership, and state continuity;
- edit entrances, exits, sound bridges, and the final landing of each unit;
- stale story, look, location, voice, asset-status, and reference assumptions.

On failure, locate the earliest faulty layer: current fact, Writer contract, Art package, Director Design, Doubao translation, reference mapping, or model contract. Return a bounded repair brief to that owner. Do not repair creative text while acting as reviewer. If the coordinator had to author the reviewed design or prose because a role was unavailable, use a fresh read-only reviewer before production.

## Production and media review

Creative completion does not authorize image generation, video generation, LibTV writes or runs, publication, or spending. Obtain or recover separate authorization for those actions.

After generation, inspect images by opening them, video by continuous playback, and audio by listening. For topology-changing actions, inspect the action window across contact and completion. Report technical success, business integration, media QA, and human acceptance separately. Keep accepted user choices; do not reopen them for optional polish without new hard evidence.

## Deliver one coherent result

Expose only the deliverables needed by the user:

- 《故事方案》 or Story Contract;
- 《图片素材清单》 or Asset Package;
- 《分镜执行表》 containing current source, audience purpose, fresh shot strategy, duration, required assets, final Doubao prose when requested, preflight evidence, and fallback split;
- a concise list of blockers, invalidated downstream artifacts, authorization still required, and human decisions still pending.

Do not dump internal role chatter or make the user manage the team. Resolve professional disagreements by source authority and role ownership, never by agent voting.

## Cases and knowledge maintenance

Complete reusable LibTV shots live under `director-knowledge-base/案例/可复用镜头/` and keep actual input images, exact source prompt, and actual result video together. Open at most three relevant cases when a case is needed. Treat observations as evidence, not universal rules or permission to copy old wording and node IDs.

Only when the user asks to study or improve the knowledge base, preserve facts, observations, inferences, unknowns, source locators, and real inspection boundaries in Markdown. Update a topic document only when evidence changes a practical decision. Do not create an API, registry, index, schema, or usage ledger just to record team activity.

## Boundaries

- Do not silently change canon, exact dialogue, current assets, direction-changing decisions, or user acceptance.
- Do not invent assets, file paths, node IDs, model capabilities, run results, or inspection evidence.
- Do not let two agents edit the same formal file, project index, or production node.
- Do not call a draft, generated file, HTTP success, decode result, or technical QA `ACCEPTED`.
- Stop on a genuine fact conflict, missing direction-changing decision, unresolvable measured limit, missing authorization, or hard media failure; otherwise route an in-scope repair and continue.
