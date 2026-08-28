# Script Development Contract

Use this contract when the user gives an idea, premise, outline, character setup, episode draft, or an existing script and asks the AI Director to diagnose, develop, adapt, or optimize it.

This contract governs analysis and creative decisions. It does not authorize media generation, external writes, paid execution, publication, or copying prose from knowledge-base source cases.

## Entry preflight

1. Bind the exact input, version, scope, mode (`DEVELOP` or `ADAPT`), requested outcome, audience, format, episode count or duration, and user-owned canon.
2. Separate `SCRIPT_FACT`, `USER_DECISION`, `AI_DIRECTOR_DECISION`, and `UNKNOWN`. Never fill a canon gap from a market sample.
3. Validate the repository knowledge base. If validation fails, stop knowledge retrieval and report the invalid entry.
4. Read every `ACTIVE` standard whose `knowledgeAreas` includes `script`, then retrieve only cards and cases whose triggers match the current problem.
5. Check each candidate entry's exclusions, required inputs, maturity, evidence boundary, and conflicts with project rules before adopting it.

## ScriptDevelopmentAnalysis v1

Produce a reviewable analysis before asking for creative prose:

1. `sourceBinding`
   - exact source or user text;
   - version, status, requested range, read date, and invalidation condition.
2. `taskContract`
   - mode, audience, format, episode/duration target, optimization goal, protected content, and permitted change scope.
3. `storyEngine`
   - genre promise and audience expectation;
   - protagonist desire, opposing force, irreversible choice, stakes, deadline, and uncertainty;
   - for high-concept work: rule, trigger, boundary, cost, observable result, counterexample, and escalation space.
4. `characterEngines[]`
   - goal, fear or lack, leverage, concealed information, relationship conflict, action vocabulary, and state change.
5. `episodeLadder[]`
   - episode locator;
   - start pressure;
   - new information or rule test;
   - protagonist choice;
   - visible consequence;
   - end hook;
   - the concrete next action opened by that hook.
6. `problemLedger[]`
   - stable problem ID;
   - severity and exact script locator;
   - observed symptom, causal diagnosis, audience cost, knowledge references, and confidence;
   - do not state a market or retention claim unless corresponding evidence exists.
7. `options[]`
   - two or three materially different fixes for each decision-level problem;
   - trade-offs, canon impact, production impact, and AI Director recommendation;
   - decisions that change the project direction remain pending until the user chooses.
8. `changePlan[]`
   - approved decision ID, affected locators, immutable facts, intended story effect, acceptance check, and fallback.
9. `knowledgeUsed[]`
   - canonical usage records described below.
10. `doubaoHandoff`
    - `NOT_REQUIRED`, `BLOCKED_PENDING_DECISION`, or `READY_FOR_CREATIVE_PROSE`;
    - only the approved brief is handed to `$doubao-creative-studio`.

## Diagnostic order

Use this order so local polish does not hide structural defects:

1. source and canon integrity;
2. genre promise and core story engine;
3. protagonist agency and irreversible choices;
4. world or ability rule clarity;
5. relationship goal conflict;
6. information-release and episode escalation;
7. scene-level action, evidence, and dialogue function;
8. production feasibility and only then prose polish.

## Core tests

### High-concept rule test

Confirm that the premise can answer: what triggers the mechanism, what it permits, what it forbids, what it costs, how the audience sees the result, and how an opponent can test or exploit it. A slogan without these fields is not a working story engine.

### Agency test

For every major ability, system, profession, rebirth advantage, or clue, ask what choice it enables, what the character risks, and how the situation becomes different. Information that only explains the world is not yet drama.

### Episode ladder test

Each episode should add or reinterpret information, force a choice, create a visible consequence, and open a concrete next action. A final surprise or emotional outburst that does not alter the next action is not a complete hook.

### Relationship engine test

Track what each side wants now, what each believes the other wants, and why both cannot succeed unchanged. Repeated misunderstanding is useful only while it changes risk, power, intimacy, or commitment.

### Skill-in-action test

Professional or everyday competence must appear as observation, procedure, test, physical action, evidence, or consequential decision. A biography label or unexplained jargon does not establish competence.

### Uncertainty test

Systems, prophecy, foreknowledge, wealth, or overwhelming authority must not solve every question automatically. Preserve uncertainty through cost, incomplete information, competing goals, counterplay, moral constraint, or irreversible trade-off.

## Canonical knowledge-use record

For every inspected standard, card, or case, write one record:

```json
{
  "entryId": "DRAMA-PAT-001",
  "entryKind": "card",
  "disposition": "ADOPTED | REJECTED_CONDITION | OVERRIDDEN_BY_HIGHER_PRIORITY",
  "reason": "Why this entry did or did not govern the decision",
  "matchedTriggers": ["..."],
  "matchedExclusions": ["..."],
  "missingInputs": ["..."],
  "outputRefs": [
    { "artifact": "ScriptDevelopmentAnalysis", "locator": "problemLedger[0]" }
  ],
  "entrySnapshot": {
    "title": "...",
    "version": "0.1.0 when applicable",
    "policyStatus": "ACTIVE when applicable",
    "evidenceStatus": "OBSERVED when applicable",
    "maturity": "OBSERVED when applicable",
    "updatedAt": "YYYY-MM-DD"
  }
}
```

Use `OVERRIDDEN_BY_HIGHER_PRIORITY` only with an explicit user decision, canon fact, project rule, or more authoritative source and record that authority in `override`. Never silently omit an applicable `ACTIVE` script standard.

## Knowledge evidence boundary

- `OBSERVED`: use as a hypothesis, diagnostic question, or representative example; never promise an effect.
- `REUSABLE`: may guide a default choice inside its stated conditions, but still disclose project-specific risks.
- `VALIDATED`: means the repository has the required own-production and human-acceptance evidence; it does not replace current-user approval.
- External cases may illustrate a mechanism. Do not copy their distinctive plot, character, dialogue, scene order, or title packaging.

## Doubao handoff

Call `$doubao-creative-studio` only when the user wants actual creative prose and has approved all direction-changing decisions. The handoff must contain:

- exact source binding and target range;
- approved `DEV-*` decision IDs;
- immutable canon and protected passages;
- requested changes and intended audience effect;
- format, length, tone, episode and dialogue constraints;
- permitted creative latitude;
- forbidden borrowing from knowledge-base cases;
- unresolved items and acceptance criteria.

The AI Director reviews returned prose against the approved brief and knowledge constraints. It does not silently rewrite Doubao's creative prose or accept a draft merely because generation succeeded.

## Stop conditions

Stop and ask for a user decision when:

- the working source, version, or canon is ambiguous;
- the desired audience effect conflicts with protected content;
- two viable options materially change protagonist agency, ending, genre promise, or relationship direction;
- required inputs for an applicable standard are missing;
- knowledge-base validation fails;
- the request would require unauthorized copying, paid generation, external publication, or destructive replacement.
