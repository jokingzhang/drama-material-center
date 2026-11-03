---
name: project-incremental-sync
description: 在本仓库实际工作区与移动硬盘的同名短剧项目之间做双向增量同步，支持差异预览、覆盖前备份和 SHA-256 校验。用于“从硬盘同步过来”“反向同步回硬盘”“只复制差量文件”；不用于 LibTV 画布同步、素材生产或删除式镜像。
---

# 项目增量同步

使用本技能的 [sync_project.py](scripts/sync_project.py)，不要每次重写复制脚本。仅依赖 Python 3 标准库和本机 `rsync`。

## 确认方向与范围

- `pull`：移动硬盘 → 本机实际工作区。
- `push`：本机实际工作区 → 移动硬盘。
- 从当前对话恢复项目和方向；用户提到另一聊天时先用 `read_thread` 读取上下文，不把“反向同步”理解为写回 LibTV。已有明确同步指令可直接执行，不重复询问。
- 默认处理指定项目整棵目录，保留原相对路径、版本、索引和验收状态。若用户只要求某集或某目录，不用整项目脚本扩大范围。
- 遵守仓库 `AGENTS.md` 的资源边界和同步规则；涉及生产资料时复用已检查的 `PRODUCTION_SOP.md` 范围。纯文件复制不触发生图、视频运行、改词、业务重新绑定或内容验收。

## 执行

在仓库根目录运行。项目 ID 必须明确；硬盘默认 `/Volumes/PortableSSD`，换盘时传已核实的挂载点 `--drive-root`。脚本读取 `.env.local` 的 `MATERIAL_CENTER_WORKSPACE`，相对路径以仓库根目录为准，不猜默认工作区。

```bash
# 只读预览，不创建记录或复制文件
python3 .agents/skills/project-incremental-sync/scripts/sync_project.py \
  --project-id limited-marriage-escape-bride --direction pull

# 已获本次同步授权：增量复制到硬盘
python3 .agents/skills/project-incremental-sync/scripts/sync_project.py \
  --project-id limited-marriage-escape-bride --direction push --apply
```

脚本会检查 Git 状态、项目配置、真实目录与挂载点，并输出路径、文件数、字节数、新增、同名修改、目标端独有文件和冲突。

- 默认按大小和修改时间的整秒比较；对元数据有差异的同名文件再算 SHA-256，内容相同则跳过。
- `--checksum` 对所有同名文件比较完整内容，能发现大小和时间都相同的改动；会读取整项目，按需使用，不作为每次同步的默认前置步骤。
- 同名文件内容不同且源文件更新时，先复制并验证目标旧版备份，再替换。目标更新或同秒内容不同默认阻断写入；先展示具体冲突。用户明确以本次源目录为准时可加 `--source-wins`，仍保留备份，不按时间戳猜业务权威。
- `--apply` 每次从真实状态生成计划，拒绝符号链接、特殊文件、路径碰撞、文件/目录冲突和源目标嵌套；不使用 `--delete`，保留目标独有文件。只排除 `.DS_Store` 及经文件头确认的 AppleDouble `._` 元数据，不排除普通隐藏文件、未知 `._` 文件或生产记录。
- 失败后保留记录与备份，报告具体问题；修正后重新预览，只补差量，不清理历史文件。
- 没有差量时返回 `NO_CHANGES`，不新增空的同步记录。

执行前按 `AGENTS.md` 声明记录五字段：`materialType=record.production`，`subject=当前 projectId`，`targetDir=目标项目/生产记录/增量同步/全项目/<run-id>/`，`version=v01`，`storyBinding=false`。脚本只在目标项目写运行记录，源目录保持只读。

## 校验与报告

脚本对本次每个复制文件及覆盖前备份做 SHA-256 校验；重新检查源文件未变、源路径在目标端齐全、非复制文件未被改动，并回跑差异检查。`--checksum` 模式同时对全部源文件复核内容。日常结果只能报告实际检查范围，不把快速比较说成全项目内容哈希通过。

随后运行 `npm run audit:git-boundary`。同步入本机且本次变化影响网页内容时，复用已打开的素材中心标签页，回读项目/相关分集接口并抽查变化文件；同步出硬盘不要求重做本机已通过的页面和媒体验收。文件哈希相同也不等于内容已获用户验收。

结束报告方向、新增/替换数量、复制字节数、校验结论，以及目标项目中的 `SYNC-MANIFEST-v01.json`/备份位置。索引若被复制，说明是沿用源版本；没有业务变更则不另改索引。
