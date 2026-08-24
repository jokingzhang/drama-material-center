# AI 短剧素材中心

一个只在本机运行的多项目短剧素材浏览器。首页用封面卡片区分项目，进入项目后可以浏览剧本、图片和视频，并把当前目录、文件、搜索与排序状态保留在网址中。

Web 程序和测试进入 Git；`workspace/` 中的项目配置、封面、剧本、图片、视频及其他资源全部保持在本地。

## 启动

```bash
npm install
npm run dev
```

默认地址：`http://127.0.0.1:4373/`。

## 本地数据

默认工作区是仓库内的 `workspace/`。可以复制 `.env.example` 为 `.env.local`，把 `MATERIAL_CENTER_WORKSPACE` 改成其他本地目录或外接硬盘路径。

实际项目不会被 Git 跟踪。运行 `npm run audit:git-boundary` 可以检查这一约束。

每个项目使用下面的本地骨架：

```text
workspace/<project-id>/
├── project.json        # 名称、说明和当前封面文件名
├── cover.png           # 可选；也支持 jpg、webp、gif
└── library/
    ├── 剧情/
    ├── 图片/人物/
    ├── 图片/场景/
    └── 视频/成片/
```

## 路由

- `/`：所有项目的封面卡片。
- `/projects/:projectId/library/*`：指定项目及素材目录。
- `?file=...&search=...&sort=...`：选中文件、搜索词和排序方式。

这些状态以 URL 为准，复制地址或直接刷新都不会返回项目首页。
