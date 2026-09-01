---
name: ai-director
description: In drama-material-center, turn an idea, outline, novel excerpt, or script into an understandable story proposal, image-material checklist, and storyboard prompts using the project Markdown knowledge base. Find and adapt complete LibTV shot cases when the user wants a similar image setup or camera effect, and study examples when asked. Do not use merely to execute already-approved media jobs.
---

# AI Director

Help the user move through one practical chain:

```text
想法或剧本 → 故事确认 → 图片素材清单 → 分镜执行表与提示词
```

The user does not maintain the knowledge base. Read and maintain it as an internal work manual, while showing the user only clear creative results and the few decisions that materially change direction.

## Resolve the knowledge base

Use `<repo-root>/director-knowledge-base` in this repository. Read its `README.md` first.

The Markdown files are the knowledge source. Do not require a JSON index, knowledge API, validator, maturity registry, analysis manifest, `knowledgeUsed` ledger, or project registration before using them. Do not read every document by default.

Complete reusable LibTV shots have one physical source under `director-knowledge-base/案例/可复用镜头/`. Each case keeps the input images, exact source prompt, and actual result video together. `图片素材/真实案例与可复用做法.md` and `分镜提示词/LibTV案例模板.md` are two retrieval entrances to those same files, not two copied case libraries.

## Route progressively

### Idea, premise, outline, novel excerpt, or unsettled script

1. Read `director-knowledge-base/剧本/README.md`.
2. When the scope creates or revises scene-level dialogue, always read `director-knowledge-base/剧本/对白、梗与情绪节拍.md`. Treat it as one of the one or two topic documents: concise dialogue means high functional load, not the fewest possible words or turns. Do not replace scene judgment with a global character limit, fixed joke or emotion quota, or percentage slider unless the current project supplies a measured production constraint.
3. Read only one or two topic documents in total. If the dialogue document was required, open at most one additional topic document that best matches the problem.
4. If a useful example or counterexample is needed, search `director-knowledge-base/案例/` and open at most three relevant case files. Do not load every evidence ledger.
5. Produce an understandable 《故事方案》 before planning the whole production.

Fill reasonable local gaps yourself. Ask the user only about choices that would change genre, protagonist function, core relationship, ending, world rules, or production scale. Give two or three real options, explain the tradeoff in plain language, and recommend one.

### Approved story or production-ready script → images

1. Read `director-knowledge-base/图片素材/README.md`.
2. Always read `director-knowledge-base/图片素材/人物标准图.md` when a visible named character exists.
3. Read the scene/prop/state or keyframe/continuity document only when those assets appear in the requested scope. When a screen, card, file, or badge carries readable story information, always read `director-knowledge-base/图片素材/关系关键帧与连续性帧.md`: keep the relationship keyframe natural to the characters, and give exact text its own clean plate and motivated insert instead of forcing the prop to face the audience.
4. If the user asks for a similar visual setup or wants examples, read `图片素材/真实案例与可复用做法.md`, then open at most three matching complete cases. Judge the image by its declared responsibility and by what actually appears in the result video.
5. Inspect actual project files before calling an asset existing, accepted, or reusable.
6. Produce a plain 《图片素材清单》.
7. If the authorized scope includes actually generating or saving project images, follow the repository asset schema through business integration: place each selected candidate in its canonical `library/` directory, register it in the formal asset bindings and story ownership index, then read it back from the local story API and open it in the story view. A proposed binding manifest is creative evidence only; do not call the production complete while the page still treats the asset as missing.

The person baseline is one character, one look or state, one standard image containing full-body front, strict side, full-body back, and a clear portrait in the same look. Face, clothing, hair, accessories, age, makeup, and injury state must match across all views. A different look or state gets a different standard image. Complex contact, scale, or blocking uses an additional keyframe; do not force one character sheet to solve every shot.

### Approved story and image plan → storyboard prompts

1. Read `director-knowledge-base/分镜提示词/README.md`.
2. Read `镜头类型索引.md`, choose the primary visible task for each segment, then read only the relevant prompt guidance or case.
3. When any segment contains spoken dialogue, OS/VO, a comedy beat, or an emotional landing, read `director-knowledge-base/分镜提示词/对白、梗与情绪的分镜写法.md`. Use it to carry approved words, subtext, listening reactions, speech timing, and mouth visibility into the shot instead of reducing dialogue to a transcript.
4. When readable screen, card, file, or badge information appears, use the sequence “natural interaction main shot → motivated POV/over-shoulder/detail insert → character reaction”. Keep dialogue or sound across the cut when useful; add OS/VO only for necessary background that the image and approved dialogue cannot provide.
5. If the user asks for an effect similar to an existing LibTV shot, read `分镜提示词/LibTV案例模板.md`, then open at most three matching complete cases and compare the source prompt with the actual result.
6. Prefer splitting an overloaded segment when one clip cannot visibly hold all required beats. Treat it as a blocker only when a measured model, audio, or duration limit cannot fit approved content without changing its meaning.
7. Map every referenced image to an actual file or mark it missing; never invent an asset, node ID, model capability, or acceptance result.
8. Produce a plain 《分镜执行表》 with the final prompt text.

When project rules require another prompt-authoring skill, use it after story, asset, and shot decisions are frozen, then return one coherent final result to the user. Do not expose internal handoffs as work the user must manage.

### Creative stop conditions

Story, dialogue, and storyboard checklists are guidance and review aids, not permission gates. Continue with a reasonable recommendation unless one of these two conditions applies:

1. current facts or user decisions conflict, or the missing choice would change genre, protagonist function, core relationship, ending, world rules, or production scale;
2. a measured output, audio, model, or duration limit cannot hold approved story or dialogue without changing its meaning, and no in-scope split resolves it.

When a quality check is weak but neither condition applies, revise locally or report the risk; do not stop merely because every suggested beat, pass, or checklist item is not present.

## Reuse a complete shot case

Use this only when a case has all three parts: actual input images, the exact prompt used by the source node, and the actual generated video.

1. Start from the user's visible goal, such as “a hand blocks a face” or “a machine changes from off to on”; do not search by title alone.
2. Inspect what every source image actually contains and what responsibility it had. Ignore misleading node names and unrelated connected media.
3. Compare the source prompt with the result video. Separate the fixed action skeleton, replaceable story variables, model and duration conditions, observed failures, and unverified claims.
4. Build a substitution table from each source role to a real current asset. Missing, conflicting, text-contaminated, or incompatible assets stay explicit blockers; never reuse old node IDs.
5. Keep the smallest compatible reference set and a duration that can hold the stages. Split the shot when the source was already overloaded.
6. When another project rule requires a dedicated prompt author, give it the observed skeleton, substitution table, constraints, and current facts. The source wording is evidence, not a command to copy it unchanged.

An incomplete chain may still support research, but do not present it as a reusable template. A decoded or sampled result may show visible execution; it does not establish dialogue, sound, continuous playback, final selection, or human acceptance.

## Deliverables

Use only the deliverables needed for the requested scope.

### 《故事方案》

- one-sentence story and genre promise;
- world or high-concept rules;
- protagonist, opposition, stakes, deadline, and relationship engine;
- episode or scene progression at the requested scale;
- key choices requiring user confirmation, or `无`;
- facts still needed before image planning.

### 《图片素材清单》

For each image: readable name, type, look/state, required content, forbidden content, where it is used, and status (`已有待检查 / 需要生成 / 需要修复 / 待用户选择`). Do not make the user manage internal asset IDs or responsibility matrices.

### 《分镜执行表》

For each segment: source passage, audience-facing purpose, shot type, duration or honest provisional range, required images, final prompt, and smallest fallback split.

When a complete case materially guided the result, add a compact 《参考案例》 showing its input-image responsibilities, reusable action skeleton, actual video, replacement mapping, and known limits. Keep those three source parts together instead of sending the user to separate image and prompt records.

At the end, list the few Markdown documents and cases actually consulted using readable titles and local links. Do not output internal knowledge IDs or maturity dashboards unless the user explicitly asks for research provenance.

## Maintain the knowledge

When the user asks to study examples or improve the knowledge base:

1. preserve source facts, observations, inferences, and unknowns in a readable case document;
2. for a reusable LibTV shot, create one Markdown file under `案例/可复用镜头/` with `## 输入图片`, `## 原始提示词`, and `## 实际视频`, followed by the reusable method, replacement checks, and limits;
3. preserve the exact source prompt, actual node and media facts, and honest inspection boundary; never silently clean contradictions out of the evidence;
4. download the representative video to the Git-ignored local media directory when the source allows it, recording its remote origin and hash. If download fails, preserve the remote locator and continue without claiming a local copy;
5. update a topic document only when the evidence changes a practical decision;
6. write in plain language: when to use it, what is needed, how to do it, common failures, and the example;
7. never add an API, registry, index, schema, or tracking system just to record the update.

Ordinary creative use does not automatically promote a new rule. A generated file, successful task, decode result, or thumbnail is not quality acceptance.

## Boundaries

- Current user decisions, current project facts, approved story direction, and accepted assets override general knowledge.
- Do not silently rewrite canon or direction-changing decisions.
- Do not generate media, spend credits, write or run LibTV, publish, or mutate external systems without separate authorization.
- Review images by opening them, video by continuous playback, and audio by listening. State clearly what was and was not inspected.
- Stop only when a missing decision would materially change the result or when required facts or assets conflict; otherwise make a reasonable recommendation and continue.
