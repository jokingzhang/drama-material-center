# AI 短剧素材中心

一个只在本机运行的多项目短剧创作工作台。首页用封面卡片区分项目；进入项目后先按故事大概、角色设定、分集和场次理解剧本，再通过保留的统一文件树浏览真实剧本、图片、音频和视频。仓库级“导演知识库”用三组可读 Markdown 文档告诉 AI 怎样从想法或剧本继续完成故事、图片素材和分镜提示词；“AI 视频一周雷达”保存每周爆款复刻与教学选题报告。

桌面工作台支持：

- 可拖动的文件树与单一右侧工作区：点击文件夹显示铺满的缩略图概览；从内容区点击文件使用通用弹窗预览，从左侧文件树点击文件才切换为铺满的独立预览；
- 文件夹与文件统一树、镜头/版本标签和路径状态提示；
- 文件名搜索，以及 Markdown/文本正文搜索；
- 保留真实宽高比的图片缩略图与比例标签、文本摘要、音频卡内按需试听、延迟加载的视频预览和 Markdown 大纲；
- 沉浸阅读、文档内查找、字号调整和素材前后切换。
- 可记忆的浅色/暗黑主题切换，首页、工作台与沉浸阅读保持一致。
- 独立的剧本、图片素材、分镜提示词三类知识文档；AI 按当前任务渐进读取和维护，用户只需查看与确认。
- AI 视频一周雷达历史页、双列报告卡片与可交互详情页；每周报告按版本进入 Git，旧版不覆盖。

路径中的 `ACCEPTED`、`DRAFT` 等只作为文件命名提示展示，不代替实际查看、播放或人工验收。

Web 程序、测试和 `weekly-radar/reports/` 中的轻量 HTML 周报进入 Git；`workspace/` 中的项目配置、封面、剧本、图片、视频及其他资源全部保持在本地。

## 启动

```bash
npm install
npm run dev
```

默认地址：`http://127.0.0.1:4373/`。

## 本地数据

默认工作区是仓库内的 `workspace/`。可以复制 `.env.example` 为 `.env.local`，把 `MATERIAL_CENTER_WORKSPACE` 改成其他本地目录或外接硬盘路径。

实际项目不会被 Git 跟踪。运行 `npm run audit:git-boundary` 可以检查这一约束。

## AI 视频一周雷达

项目级 Skill 位于 `.agents/skills/ai-video-weekly-radar/`。调用 `$ai-video-weekly-radar` 完成当周公开样本调研、复刻候选筛选、教学选题规划和证据整理；最终使用 Skill 自带的注册脚本，把报告写入：

```text
weekly-radar/reports/<YYYY-MM-DD--YYYY-MM-DD-vNN>/
├── manifest.json
├── report.html
└── evidence.json       # 可选；本期已保留
```

同一观察周返修时递增 `vNN`，不得覆盖已有目录。服务端读取前会校验目录名、清单、普通文件边界和 SHA-256；未通过的报告会被隔离并在历史页提示。

每个项目使用下面的本地骨架：

```text
workspace/<project-id>/
├── project.json        # 名称、说明和当前封面文件名
├── cover.png           # 可选；也支持 jpg、webp、gif
├── production/
│   ├── story-index.v1.json      # 故事、角色、分集、场次和明确需求
│   └── asset-bindings.v1.json   # 本地素材与稳定业务 ID 的关联
└── library/
    ├── 剧情/
    ├── 图片/人物/
    ├── 图片/场景/
    ├── 音频/剧情/
    └── 视频/成片/
```

## 路由

- `/`：所有项目的封面卡片。
- `/projects/:projectId/story`：剧本抬头、故事大概、角色卡和分集索引；项目默认入口。
- `/projects/:projectId/story/characters/:characterId`：角色设定、主/备选造型和素材缺口。
- `/projects/:projectId/story/episodes/:episodeId`：按需读取一集的场次和相关素材。
- `/projects/:projectId/story/episodes/:episodeId/scenes/:sceneId`：指定场次的稳定深链。
- `/projects/:projectId/library/*`：指定项目及素材目录。
- `?file=...&preview=dialog&search=...&sort=...`：选中文件、内容区弹窗展示方式、搜索词和排序方式；没有 `preview=dialog` 的文件深链使用右侧独立预览。
- `scope=current|project`、`content=1`、`display=list|grid`：搜索范围、正文搜索和素材展示方式。旧分集台参数会自动清理。
- `/knowledge`：AI 导演的简单工作链路和三类知识入口。
- `/knowledge/areas/:area`：某一类知识的 Markdown 文档列表。
- `/knowledge/areas/:area/*`：具体知识文档，可直接刷新和复制链接。
- `/ai-video-radar`：AI 视频一周雷达历史列表；桌面端每行两份报告，窄屏自动改单列。
- `/ai-video-radar/reports/:reportId`：某一期周报详情；保留报告内筛选交互，并使用紧凑顶部展示。

导演知识页面在构建时发现仓库根 `director-knowledge-base/剧本`、`图片素材`、`分镜提示词` 中的 Markdown，并在点击文档时才读取正文。它不依赖导演知识 API、JSON 索引或使用记录。工作区内同名历史目录仍只是普通项目素材，不会被自动合并。

这些状态以 URL 为准，复制地址或直接刷新都不会返回项目首页。
