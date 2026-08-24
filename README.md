# AI 短剧素材中心

一个只在本机运行的多项目短剧素材浏览器。Web 程序和测试进入 Git，`workspace/` 中的项目配置、剧本、图片、视频及其他资源全部保持在本地。

## 启动

```bash
npm install
npm run dev
```

默认地址：`http://127.0.0.1:4373/`。

## 本地数据

默认工作区是仓库内的 `workspace/`。可以复制 `.env.example` 为 `.env.local`，把 `MATERIAL_CENTER_WORKSPACE` 改成其他本地目录或外接硬盘路径。

实际项目不会被 Git 跟踪。运行 `npm run audit:git-boundary` 可以检查这一约束。

