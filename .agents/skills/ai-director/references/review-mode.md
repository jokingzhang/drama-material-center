# Review mode

Review the artifact that actually exists. A task status, thumbnail, stream, decode result, or node prompt cannot substitute for watching the relevant image sequence or listening when sound is in scope.

## Bind the review target

Record exact file or node, version, duration, expected Bible or Brief, related `DEV-*` / `DIR-*` decision IDs, upstream references, and the acceptance scope. Preserve selected and previously accepted takes unless the user asks to replace them. If no decision ID exists, bind the intended decision verbatim and do not invent an approval history.

## Review in layers

1. **Technical integrity** — dimensions, duration, decoding, missing frames, broken audio, and obvious corruption.
2. **Story legibility** — objective, threat, causal action, result, information order, and hook.
3. **Performance and blocking** — gaze, intention, reaction, contact, weight, timing, and spatial relationships.
4. **Image and material** — identity, costume, injury, prop, location, light, texture, unwanted text, and clean-frame suitability.
5. **Shot and edit** — shot size, axis, camera motivation, action readability, entrance and exit, rhythm, and match continuity.
6. **Sound** — speaker, exact dialogue, emotion, lip visibility, ambience, effects, music, noise, clipping, and mix. Mark subjective listening pending if it was not actually performed.
7. **AI failure** — morphing, duplicated subjects, sliding contact, temporal reset, reference conflict, model artifacts, or excessive task complexity.

## Review reference effect, not reference presence

Compare each supplied reference with its declared visual or sound responsibility and the actual output. Record whether it was followed, ignored, conflicted with another reference, or contaminated the result. For a directly supplied turnaround, inspect identity and body consistency across front, side, back, turning, and movement as applicable, then check for repeated people, triptych or storyboard layout, neutral-pose copying, labels, or studio-background leakage.

Do not infer benefit from an uploaded asset, input edge, prompt mention, or successful generation task. If no generated footage was actually watched, report only mapping or execution status and keep the directing assumption unvalidated. When evidence is available, compare against the smallest relevant baseline before recommending broader reuse.

## Diagnose before prescribing

Classify the primary cause:

- story or directing decision;
- performance or blocking;
- visual material or continuity;
- shot, camera, or edit;
- reference mapping;
- model or technical limit;
- sound or post-production.

State the evidence and the earliest layer where the error appears. Do not repair a directing error by adding prompt adjectives, or a source-reference conflict by rerunning unchanged text.

When possible, identify which layer first diverged from the approved decision:

1. source or adaptation contract;
2. Director Bible or Brief;
3. creative-text translation;
4. reference mapping or generation execution;
5. edit, sound, or post-production;
6. review evidence or acceptance scope.

## Prescribe the smallest repair

For each failed criterion, specify:

- observed fact and timecode;
- intended audience effect;
- likely cause and confidence;
- one bounded repair at the earliest faulty layer;
- what must remain unchanged;
- exact re-review test;
- whether the repair affects only one shot or requires stopping downstream work.

By default, stop at a factual repair brief. Invoke `$doubao-creative-studio` only when the user explicitly requests creative repair or approves the proposed repair. When authorized, keep `repairFeedback` limited to its supported `observedFailure`, `evidence`, and `mustCorrect` fields; carry affected `DEV-*` / `DIR-*` IDs through `canon` or `hardConstraints`. Do not silently rewrite creative text.

Record a knowledge-card practice result only after the repaired output is actually reviewed. The record must bind the decision IDs, intended audience effect, actual result, human conclusion, evidence path, cost, and side effects. Technical success alone cannot promote a card.
