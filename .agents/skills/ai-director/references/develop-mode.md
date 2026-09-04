# Develop / Adapt mode

Develop/Adapt mode turns an idea or non-screen-ready source into an approved, production-aware story package. It resolves story and adaptation decisions before screenplay prose, episode direction, prompts, or media execution.

Use it for an idea, premise, treatment, novel, outline, prose draft, or script whose screen structure is still unsettled. If the current screenplay and its production facts are already approved and the request is about staging, shots, or execution, use Direct mode instead.

Use [creative-dialogue.md](creative-dialogue.md) to challenge material weaknesses and brainstorm alternatives. Resolve discoverable facts first; discuss genuine creative branches one dependency-bearing decision at a time.
Use [script-development.md](script-development.md) for the complete retrieval, diagnosis, option, `knowledgeUsed`, and required Doubao creative-handoff contract. Do not replace that structured analysis with a generic list of screenwriting tips.

## Bind the source and authority

Record the exact source paths or URLs, version, status, read date, user directives, and intended delivery. Separate:

- fixed canon and verbatim user choices;
- material the user permits adaptation to change;
- contradictions and superseded sources;
- unknowns that affect the result.

When a source is `DRAFT`, name the working canon and what change would invalidate downstream work. Do not silently overwrite or reinterpret the source. Give every original story or adaptation choice a stable `DEV-<scope>-###` ID and label it `AI_DIRECTOR_DECISION`.

## Establish the screen contract

Resolve only what the current scope needs:

- audience promise, genre, tone, format, aspect ratio, duration, episode or act shape, and delivery target;
- protagonist objective, obstacle, choice, cost, transformation, relationship engine, and opposition;
- escalation, reversals, payoffs, retention hooks, and the irreversible change of each major unit;
- information that must become visible, audible, delayed, or withheld.

Do not confuse a complete plot with a screen-ready story. Internal thought, explanation, or lore must acquire a playable action, image, sound, object, spatial consequence, or deliberate omission.

## Keep an adaptation ledger

For every material transformation, identify the source fact and classify the screen action as `PRESERVE`, `EXTERNALIZE`, `COMPRESS`, `COMBINE`, `REORDER`, `ADD`, or `DEFER`. Explain the intended audience effect, lost information, new risk, and approval needed. `ADD` and any non-obvious reinterpretation are AI Director decisions, never source facts.

## Test production feasibility early

Estimate the burden created by locations, named characters, crowds, dialogue, identity changes, costume or injury continuity, physical action, dynamic effects, readable text, sound, and post-production. Decide which facts should be performed in-camera, generated as separate tasks, composited, carried by sound, or simplified.

Group materially independent risks. For each high-risk class define the smallest representative test, what it can prove, what it cannot prove, a fallback, and a stop condition. One early or easy test cannot certify later risks of a different kind.

An incomplete asset, continuity, dialogue, voice, or model contract does not prevent a factual `DRAFT` development package. It does prevent declaring the package prompt-ready or production-ready.

## Produce the Development / Adaptation Brief

First produce `ScriptDevelopmentAnalysis v1` from [script-development.md](script-development.md). Use its story engine, character engines, episode ladder, locator-based problem ledger, options, change plan, and canonical `knowledgeUsed` records to make the following brief reviewable:

1. status, scope, source binding, working canon, and invalidation conditions;
2. audience and format contract;
3. story and character engine;
4. act, episode, sequence, or scene spine at the requested scale;
5. adaptation ledger with decision IDs;
6. visual, sound, continuity, asset, and production implications;
7. independent risk classes and representative test portfolio;
8. unknowns, blockers, user approval points, and downstream handoff.

Include a compact decision map: accepted choices, rejected alternatives that affect later branches, unresolved questions, decision owner, and invalidation condition. Do not hide an unresolved creative choice inside polished prose.

If the analysis is bound to a named existing material-center project and an exact project-relative source file, persist it only under [script-development-analysis-schema.md](script-development-analysis-schema.md). An idea pasted into chat, an ambiguous project, ordinary advice, or an explicit no-write request remains a non-persistent `DRAFT`.

The brief remains `DRAFT` until the user approves it or explicitly authorizes autonomous development within named boundaries. Approval of a development package does not authorize prompt creation, media generation, paid work, or publication.

## Handoff to screenplay and direction

When the user requests screenplay or other creative prose, freeze the approved package and let the Writer stage prepare the minimum facts, decisions, requested deliverable, hard constraints, acceptance criteria, and bounded creative latitude for `$doubao-creative-studio`. Doubao is the sole prose author. Preserve its return verbatim, validate canon, structure, identities, dialogue facts, duration, and explicit constraints, and route defects through a new bounded Doubao repair job instead of rewriting them in the main session. Returned prose remains `DRAFT` until the applicable approval gate passes.

Once the story package is approved, Direct mode chooses the next useful scale. Do not jump from a long-form source straight to hundreds of shot prompts when project-, act-, dungeon-, or episode-level decisions are still open.
