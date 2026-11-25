<div align="center">

<img src="public/brand-logo.png" alt="兜导 · 短剧 Harness" width="96" height="96" />

# 兜导 · 短剧 Harness

**本地多项目 AI 短剧生产底座：双入口剧本开发 × 电影级分镜 SOP × 自动化工程门禁 × 导演可视化工作台**

面向「无剧本起盘 / 既有剧本直通 → 角色 / 场景 / 道具 / 音色资产 → 电影级分镜与视频提示词 → 审片与成片交付」全链路，把分散的编剧与提示词经验收编为**可校验、可追溯、防穿帮、告别会动的 PPT** 的工程化 Harness。

</div>

---

## 核心能力

### 1. 双入口剧本开发与反捧杀审稿（`script-writer`）

系统按起点自动分流为两条正交路径，不强制绕路：

- **路径 A｜已有现成剧本**：直接进入 [ai-director](.agents/skills/ai-director/SKILL.md) 拆分镜与资产闭环，不强制过编剧入口；外来纯对白剧本仅在导演阶段补齐表演层与调度层，严禁擅改台词与事件。
- **路径 B｜无完整剧本 / 需完善世界观与人物 / 剧本审稿改稿**：进入 [script-writer](.agents/skills/script-writer/SKILL.md)，按需切片加载 4 份短剧实战参考模块与传统剧作方法库（`sw-*`、小津、契诃夫等）：
  - **世界观与人物规则落地**（`world-and-character-dev.md`）：机制差异化推演、能力/道具四要素（使用条件、边界、成本、弱点）、反派能力基线与跨集连续性五账。
  - **抖音/短视频节奏与 AIGC 可拍性**（`douyin-short-drama-pacing.md`）：平台节奏定档（R1 90s–3min / R3 3-7-30 / R5 3–5min）、第一集生死线、五大母型钩子与悬念存量配额、冲突签名全剧防重复、过渡即戏点，以及 AIGC 反穿模与抖音血腥脱敏前置铁律。
  - **台词拟人化与短剧对白密度**（`dialogue-naturalization.md`）：短剧台词驱动密度、称呼四轴变化、分题材去书面腔、“撒碎屑”四法、端着网文句改带刺活人话及 AI 机械腔 10 条认症表。
  - **反捧杀五维审稿与分层改稿**（`anti-sycophancy-review.md`）：单主会话过故事因果 / 商业平台 / 题材核心观众 / 信息流新观众前 10 秒 / 连刷防重复五维透镜，强制绑定原文证据与优先级，配合改稿六把刀分层修订。

### 2. 电影级四阶导演工作流（SOP + 按阶段切片）

详细执行规范见 [PRODUCTION_SOP.md](PRODUCTION_SOP.md) 与 [AGENTS.md](AGENTS.md)。创作任务按固定边界推进：**确认剧本 → 确认台词 → 设计分镜 → 双层机检 → 授权生产**：

```text
Stage 1 导演决策（风格档位 / 情境映射 / 权力几何 / 战斗按需挂载）
  ↓
Stage 2 空间排演与双栏分镜预览（默认人工停靠确认 + 本集资产缺口清单）
  ↓
Stage 3 四类资产闭环（3:4 人物四宫格 / 16:9 多视角场景 / 道具图 / LibTV 固定音色）
  ↓
Stage 4 提示词编译与双层机检（工程绑定 0 错误 + 反 PPT 电影感门禁 0 FAIL → 同步 LibTV）
```

- **按阶段动态切片规则**：通过 `scripts/slice-stage-context.py` 按 `S1–S4` 及战斗档位（`R1/R2/R3`）精确装载 `ai-director` 规则，避免一次性堆叠上下文导致注意力坍塌。
- **工具默认路由**：人物标准图（3:4 四宫格）与道具图默认走内置 `imagegen`；16:9 场景母版/分视角图与固定音色默认经官方 `libtv-cli` 闭环落地，落盘后实际核看/试听再入账。

### 3. 自动化硬门禁（先拦截，不花冤枉积分）

| 门禁脚本 | 拦截目标 |
| --- | --- |
| `scripts/video-format-gate.py` | 剧级画幅硬锁（`9:16` / `16:9`），统一接管视频节点创建/运行与成片像素校验 |
| `scripts/dialogue_gate.py` | 逐字台词合同校验，防止画面返修或改分镜时擅改已确认对白、说话人或顺序 |
| `scripts/check-episode-local.py` | 本地引用计划、文件 SHA-256、视角冲突与四类关键素材绑定完整性校验 |
| `scripts/check-storyboard-cinema.py` | 电影感与反 PPT 机检：拦截长静态站桩、内部规划词泄漏、时间轴错乱与画外人名泄漏 |
| `scripts/audit-git-boundary.mjs` | 严守仓库与本地素材隔离，确保 `workspace/` 中真实短剧资产永不误提交 Git |

### 4. 导演可视化工作台（本地 Web UI）

纯本机运行、不上传云端，支持**浅色（纯白画布 + 浅灰侧栏）**与**暗色（中性炭黑影棚）**双模切换：

- **紧凑单行工作台 + `⌘K` 全局跳转**：54px 毛玻璃顶栏内嵌阅读进度光丝，随时 `⌘K` / `Ctrl+K` 按集数、人物或场景一键直达。
- **智能剧本目录**：自动滚动定位当前集，支持集数/标题即时筛选、制作阶段色点与数量统计。
- **全剧制作总览**：SVG 完成度进度环、四阶段生产流程条、当前推进焦点与支持状态筛选的 60+ 集矩阵；切到人物/场景/分集列表时自动收敛为单行进度条。
- **单集导演工作台**：
  - 滚动吸顶毛玻璃 Scroll-Spy 导览条，长页实时追踪并切换区块；
  - 人物 `3:4` 四宫格与道具图完整展示零裁切，场景图按 `16:9` 宽画幅呈现并自动解析机位视角与版本标签；
  - 角色声音独立为紧凑横向音色试听条（支持拖动进度条与动态声波律动）；
  - 全宽分集剧本横幅卡 + 分镜提示词序列卡，支持卡片**一键复制全文**。
- **高效预览弹窗与引用核验**：
  - 顶栏直接展示文档名与生产标签，内置「复制全文」与键盘 `←` / `→` 快速切镜；
  - 单标题文档自动收起章节目录释放阅读宽度；
  - 提示词顶部「引用素材条」支持图片放大、音频行内直接试听、点击 `{{Node ...}}` 编号一键复制，未关联或版本不一致的引用自动提示原因。
- **延伸模块**：保留统一双栏素材文件浏览器、只读「导演知识库」、本地「原片拆解训练」及「AI 视频一周雷达」历史周报。

> 路径中的 `ACCEPTED`、`DRAFT` 等仅作命名提示，不代替实际查看、完整播放试听或人工验收。

---

## 快速启动

```bash
npm install
npm run dev
```

启动后访问：`http://127.0.0.1:4373/`

### 常用校验与构建命令

```bash
npm run typecheck           # TypeScript 类型检查
npm run test:app            # 前端与本地服务 Vitest 单元测试
npm run test                # 全量测试（前端 + Skills + 视频门禁 + 台词门禁 + 本地校验）
npm run build               # 生产构建
npm run audit:git-boundary  # 检查本地素材与 Git 边界隔离
```

---

## 本地工作区与项目结构

代码、Skills、门禁脚本、测试与 `weekly-radar/reports/` 轻量周报进入 Git；所有短剧项目配置、封面、剧本、图片、音频、视频和生产证据全部保留在本地工作区，不进入版本库。

默认工作区位于仓库内 `workspace/`。如需指向外接硬盘或其他本地目录，可复制 `.env.example` 为 `.env.local` 并配置 `MATERIAL_CENTER_WORKSPACE`（相对路径以仓库根目录为准）。

每个短剧项目遵循统一的本地自包含结构：

```text
workspace/<project-id>/
├── project.json                   # 项目显示名称、说明与封面
├── cover.png                      # 可选（支持 png/jpg/webp/gif）
├── PRODUCTION_RULES.md            # 剧级画幅锁与项目级规则
├── production/
│   ├── story-index.v1.json        # 故事、人物、场景、分集与明确需求索引
│   └── asset-bindings.v1.json     # 本地资产、哈希与稳定业务 ID 绑定
├── library/
│   ├── 剧情/                       # 统一剧本、角色设定、分集剧本与分镜提示词
│   ├── 图片/                       # 人物/<CHAR>/<LOOK>/、场景/<LOC>/、道具/<PROP>/
│   ├── 音频/                       # 人物/<CHAR>/、环境/<LOC>/、BGM/
│   └── 视频/                       # 剧情/<EP>/<SCENE>/、成片/<EP>/
├── 创作记录/                       # 俯视站位调度图、原始响应等内部创作证据
├── 生产记录/                       # 媒体任务、下载、抽帧与 QA 证据
└── 交付包/                         # 经正式验收后的顺序交付副本
```

---

## 主要页面路由

所有视图与预览状态以 URL 为准，刷新或复制链接均可精准还原：

- `/`：所有短剧项目封面卡片与新建入口
- `/projects/:projectId/story`：全剧制作总览与故事大概（项目默认入口）
- `/projects/:projectId/story?section=characters|locations|episodes`：人物设定 / 场景设定 / 分集视角
- `/projects/:projectId/story/characters/:characterId`：单人物设定、标准图与音色
- `/projects/:projectId/story/locations/:locationId`：单场景多视角母版与环境声
- `/projects/:projectId/story/episodes/:episodeId`：单集导演工作台（通用资源、剧本、专属图、分镜提示词与验收）
- `/projects/:projectId/story/episodes/:episodeId/scenes/:sceneId`：单场次稳定深链
- `/projects/:projectId/library/*`：项目素材文件浏览器（支持目录树、文件名与正文检索、生产顺序排序）
- `/knowledge`：仓库级只读导演知识库（`director-knowledge-base/剧本`、`图片素材`、`分镜提示词`）
- `/ai-video-practice`：本地原片拆解训练与复盘工作区（记录存本机 `localStorage`，不写入正式生产索引）
- `/ai-video-radar`：AI 视频一周雷达历史周报（按 `weekly-radar/reports/<YYYY-MM-DD--YYYY-MM-DD-vNN>/` 版本化留档并校验 SHA-256）
