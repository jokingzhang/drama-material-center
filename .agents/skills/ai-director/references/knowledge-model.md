# Director knowledge model

The current knowledge source is the Markdown tree under `<repo-root>/director-knowledge-base`. The Web UI is a local read-only view of those files. Do not introduce a JSON index, maturity registry, knowledge API, usage ledger, or project registration as a prerequisite for retrieval.

## Current layout

```text
<kb-root>/
├── README.md
├── 剧本/
├── 图片素材/
│   └── 真实案例与可复用做法.md
├── 分镜提示词/
│   └── LibTV案例模板.md
├── 案例/
│   ├── 可复用镜头/
│   │   ├── README.md
│   │   └── <完整镜头案例>.md
│   └── CASE-*/                 # detailed research dossiers retained as evidence
└── 来源/                       # source reports retained as evidence
```

The three problem domains are the working entrances:

- `剧本/`: story design and revision;
- `图片素材/`: which images are required and what each one must guarantee;
- `分镜提示词/`: shot-task selection, decomposition, and prompt writing.

Cases and source reports support those domains. They do not override current project facts or explicit user decisions.

## One complete case, two entrances

`图片素材/真实案例与可复用做法.md` and `分镜提示词/LibTV案例模板.md` expose the same cases from different angles. Do not copy a case into both folders.

The physical source lives once in `案例/可复用镜头/<title>.md` and must contain:

- source canvas, node, model, mode, duration, aspect ratio, and inspection boundary;
- `## 输入图片`: each actual input image, its node or source locator, and its one clear responsibility;
- `## 原始提示词`: the exact prompt used by the representative source node, including its redundancies and contradictions;
- `## 实际视频`: a playable local link when downloaded, a remote source locator, hash when available, and only the result that was actually observed;
- reusable action skeleton;
- replacement checks;
- limits and things that must not be copied.

The image entrance emphasizes image responsibilities. The shot-prompt entrance emphasizes action structure and substitution. Both still show the complete bundle because an image or prompt cannot be evaluated without the actual result.

## Admission rule

A chain enters `案例/可复用镜头/` only when the actual input images, exact source prompt, and actual result video can all be traced to the same result node. A canvas name, thumbnail, disconnected prompt, or isolated image is not a complete reusable case.

Incomplete or failed chains remain useful in detailed case dossiers or source reports as evidence and counterexamples. Do not hide them, but do not market them as templates.

## Local media

Downloaded case videos live under `<repo-root>/director-knowledge-base/.media/`, which is ignored by Git. The local Web route may stream those files, while the Markdown keeps the remote source and node for traceability.

- Download only when the source allows it and the user has authorized the work.
- Never run a generation node merely to complete a case.
- Record the local filename and SHA-256 when downloaded.
- If download fails, keep the canvas, node, and remote locator and continue. Do not fabricate a local file.
- A successful download or full decode is technical evidence, not continuous playback, sound review, creator selection, or human acceptance.

## Retrieval

1. Read the root README and the current problem-domain README.
2. Read the one or two relevant topic documents.
3. If an example would help, search complete cases by the visible directing problem and open at most three.
4. Compare image responsibilities, source prompt, and actual video before recommending reuse.
5. Return a current-project substitution table; never carry source node IDs into a new project.

Retrieve by mechanism and condition, not title similarity. Useful mechanisms include a visible state ladder, a precise contact point, a before/after machine state, a role-to-node mapping, a spatial route, or a single physical consequence.

## Maintenance

When studying a new source:

1. preserve source facts, observations, inferences, failures, and unknowns in a readable dossier or report;
2. select representative complete chains rather than treating an entire mutable canvas as one answer;
3. create or update a complete case only when the three-part admission rule is met;
4. change a domain topic document only when the evidence changes a practical production decision;
5. keep old dossiers, ledgers, cards, and standards as research history unless the user explicitly authorizes migration or cleanup.

Legacy references that describe `.ai-director/index.json`, mandatory schemas, status promotion, validation registries, or knowledge-use tracking are historical research machinery, not the current retrieval path. Do not load or rebuild them for ordinary AI Director work.
