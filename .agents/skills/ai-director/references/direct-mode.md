# Direct mode

Direct mode turns an approved dramatic intention into scale-appropriate choices that downstream creators and tools can execute and reviewers can test.

For a request that starts from a script and asks for image materials or storyboard/video prompts, read [script-to-production.md](script-to-production.md) and produce its WorldGenreProfile, AssetPlan, ShotTypePlan, and ShotPromptPlan before authoring any creative prompt.

Use [creative-dialogue.md](creative-dialogue.md) when a directing choice exposes weak causality, contradictory goals, avoidable complexity, or materially different staging options. At bounded shot scale prefer a concise recommendation; at project scale resolve consequential branches collaboratively.

## Choose the directing scale first

Use the highest unresolved scale and stop at the smallest deliverable the user needs:

- **Project, film, season, or dungeon** — produce a Director Bible: audience promise, narrative and performance system, visual/material/space system, shot/edit/sound grammar, continuity policy, production design, and risk-test portfolio.
- **Act or episode** — produce an Episode Brief and scene sequence: function, escalation, character choices, reveals, continuity changes, hooks, and representative risks.
- **Scene** — produce a Scene Brief: irreversible change, playable actions, blocking, information order, shot and sound strategy, and edit boundaries.
- **Shot or generation task** — produce an executable Shot Contract with one new piece of information or one causal action.

Do not expand a project or long-form source into a full shot list while upstream decisions remain unresolved. A bounded high-risk test may go directly to shot scale, but it does not approve or certify unrelated scales.

## Bind sources and readiness

Record the exact approved development package, script, rules, asset and continuity contracts, versions, statuses, and read date. State the working canon, superseded sources, unknowns, and what upstream change would invalidate the directing artifact.

Assess readiness separately; never collapse it into one “ready” claim:

- story and canon are directable;
- directing decisions are approved;
- assets, continuity, dialogue, voice, and references are prompt-ready;
- model, schema, test, cost, and execution gates are production-ready;
- actual playback or listening and human approval are complete.

A missing downstream contract may leave a Director Bible or Brief as a useful `DRAFT`; it must be named as a blocker before prompt or production handoff.

## Establish the dramatic contract

Read only the inputs relevant to the chosen scale. These may include the current script, project rules, accepted character and scene assets, continuity contract, dialogue and voice contract, previous shot end state, target model constraints, duration, and delivery format. Explicit user decisions and current project facts outrank the knowledge base.

Before choosing shots, answer at the current scale:

- What must the audience feel, understand, anticipate, or misread by the end?
- What does each character want now, what blocks them, what choice do they make, and what changes or costs them?
- What is the single irreversible change of this unit?
- What information must be visible, audible, delayed, or withheld?

## Design the minimum sufficient reference strategy

Assign every visible fact to one primary reference responsibility before writing prompts:

- use an identity anchor for the face and recognizability;
- use the current continuity input for visible costume, hair, injury, age state, and scene-specific detail;
- use a matching turnaround for body proportion, silhouette, and the front, strict side, and back structure of that exact look;
- use a keyframe for composition, blocking, gaze, contact, and spatial relationships;
- use a prop or environment reference for plot facts that must be visibly correct;
- use the approved voice or sound reference only for its declared audio responsibility.

Treat a complete avatar-plus-turnaround package as a character-asset best practice, but decide direct generation use at shot scale. Favor a matching turnaround when full-body shape, turning, back view, movement, angle change, or cross-shot bodily continuity matters. It may add little to a face close-up or plot-prop insert. Never use an old or conflicting look merely because a turnaround exists.

Do not use reference count as a quality proxy. Choose the smallest compatible set that still carries every audience-visible fact. When the model limit forces a tradeoff, preserve the references that carry the shot's irreversible information and approved staging, record every omitted responsibility and reason, and return the conflict for approval when the choice would change the shot.

When a combined turnaround sheet is used directly, carry an explicit constraint to use only anatomy, hair, silhouette, and look structure while ignoring panel layout and neutral presentation. Treat duplicated people, triptych or storyboard composition, copied labels, and studio-background leakage as known failure signals.

Classify direct turnaround use as a testable production assumption until representative generated footage is actually reviewed. A correct node mapping proves only that the reference was supplied; it does not prove that the model followed it or that the shot improved.

The project knowledge base may define an `ACTIVE` image standard, but policy activation is not evidence maturity. Apply its required fields as the current planning baseline while reporting whether the supporting mechanism is `OBSERVED`, `REUSABLE`, or `VALIDATED`.

## Retrieve and challenge knowledge

Search only relevant domains. For each candidate card:

1. compare its applicable and inapplicable conditions with the current problem;
2. state its maturity;
3. accept, adapt, or reject it;
4. explain the current evidence, not just the card title.

Do not force a card into the artifact merely because it ranked highly. An `OBSERVED` card can justify a testable hypothesis, not a production guarantee.

## Produce the directing artifact

Use the compact structures in [director-rubric.md](director-rubric.md). Resolve only the fields required by the chosen scale. At shot scale, keep one new piece of information or one causal action per generation task and make continuity and reference responsibilities one-to-one.

Give every original decision a stable `DIR-<scope>-###` ID and mark it `AI_DIRECTOR_DECISION`, never as user language. Preserve those IDs downstream so Review can identify whether the decision, translation, reference, model, or post-production failed.

The artifact remains `DRAFT` until the user authorizes autonomous direction within named boundaries or approves it. Only an `APPROVED` artifact may enter downstream hard constraints. Approval at one scale does not approve lower-scale briefs, prompts, or execution.

For script-to-production work, use the dedicated analysis artifact in [director-rubric.md](director-rubric.md). Do not call it complete until every visible script fact has an asset responsibility and every generation unit has a primary shot type with a duration-fit check.

## Build a representative risk-test portfolio

Group materially independent risks instead of naming only the single hardest shot. For each high-risk class record:

- the assumption and intended audience effect;
- the smallest representative test;
- what passing proves and does not prove;
- frozen facts and permitted variation;
- observable acceptance, fallback, and stop condition.

One test may cover several risks only when the same mechanism and acceptance evidence genuinely exercise them. Do not let an easy establishing shot certify dialogue, multi-character contact, identity transformation, complex effects, or a different duration/model regime.

## Creative prompt authoring and handoff

When the user requests screenplay-derived production text or prompts:

1. freeze the approved artifact, exact current facts, and decision IDs;
2. separate immutable director decisions and hard constraints from bounded creative latitude;
3. let the responsible Writer, Art, or Director role author the creative text by default using the project's required template;
4. use the exact canonical full character name for every operational mention in camera, framing, body-part, blocking, action, gaze, speaker, sound, and reference instructions; never use surname-only shorthand such as `江` or `霍`, initials, role labels, or pronouns in place of the named subject;
5. invoke `$doubao-creative-studio` only when the user's current request explicitly asks for Doubao; then package only the minimum relevant facts and put only verbatim user language in `userCreativeDirectives`;
6. validate factual identity, continuity, dialogue, expected reference responsibilities and dispositions, actual reference mapping, model limits, required fields, canonical naming, and preservation of approved decisions;
7. return creative defects to the same author; when Doubao was explicitly selected, use a new bounded Doubao repair task and do not rewrite its prose;
8. use a fresh read-only reviewer before production, because an author may not approve its own production text;
9. execute only with separate authorization and production gates.

Reference mappings must come from actual assets and shot facts, never from a knowledge card. When no prompts or execution are requested, stop at the directing artifact.
