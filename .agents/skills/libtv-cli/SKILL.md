---
name: libtv-cli
description: >-
  LibTV 官方 CLI（libtv）：在命令行里完整操作 / 运行 LibTV 画布。
  凡是和 LibTV 画布 / 项目 / 节点 / 模型 / 素材相关的操作，一律通过 libtv CLI 完成，
  不要自己捏造 HTTP 请求或绕到网页端步骤。本 skill 内即包含完整的 CLI 命令操作手册；
  常见场景见 examples/，安装/更新见 scripts/install.md。
---

# LibTV CLI（`libtv`）

`libtv` 的文档地图。子命令与选项权威文案以 `libtv --help` 与 `libtv <子命令> --help` 为准；当文档与 `--help` 不一致时，以 CLI 实际输出为准并修订本 skill。

**术语**：本 CLI 里 **画布（project）** 是真正的画布文件，**项目（workspace）= 工作区** 是装画布的容器，一个项目下可放多张画布。

**画布 / 分组范围**：在画布所在工作目录执行 `libtv project use <画布UUID>`，写入 `.libtv/project.json` 的 `projectUuid`；之后大多数子命令（`libtv node` / `libtv upload` / `libtv group`）在省略 `-p` / `--project` 时即使用该画布。需要限定到某个普通分组时，再执行 `libtv group use <分组>` 写入 `groupNodeKey`。详见 [commands/project.md](./commands/project.md)、[commands/group.md](./commands/group.md)。

**项目（工作区）绑定**：用 `libtv workspace use <项目ID>` 把目录绑定到一个项目（工作区），写入 `.libtv/project.json` 的 `workspaceId`，用于 `project create` / `project list` 的默认项目范围。`workspace use` 不设置默认画布，会清掉原 `projectUuid` / `groupNodeKey`；`project use` 会写入画布，并把该画布实际所属的 `workspaceId` / `teamId` 同步进本地状态。详见 [commands/workspace.md](./commands/workspace.md)。

## 文档地图

| 主题                                                                                  | 文件                                                             |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 一键安装 / 指定版本安装                                                               | [scripts/install.md](./scripts/install.md)（脚本与本文件同目录） |
| 管道（NDJSON）、stdout/stderr、嵌套 case                                              | [examples/pipes/README.md](./examples/pipes/README.md)           |
| 常见案例（场景化可复制命令集，**每个 case 一文件**）                                  | [examples/README.md](./examples/README.md)                       |
| `libtv login web` / `libtv login phone`                                               | [commands/login.md](./commands/login.md)                         |
| `libtv logout`                                                                        | [commands/logout.md](./commands/logout.md)                       |
| `libtv account`（含 `info` / `list` / `use`）                                         | [commands/account.md](./commands/account.md)                     |
| `libtv workspace`（项目/工作区，含 `create` / `list` / `update` / `use` / `unuse`）   | [commands/workspace.md](./commands/workspace.md)                 |
| `libtv project`（画布，含 `create` / `list` / `update` / `use` / `unuse` / 默认摘要） | [commands/project.md](./commands/project.md)                     |
| `libtv node`（含 `create` / `list` / `delete` / 默认用法）                            | [commands/node.md](./commands/node.md)                           |
| `libtv group`（含 `list` / `create` / `use` / `unuse` / 默认用法）                    | [commands/group.md](./commands/group.md)                         |
| `libtv upload`                                                                        | [commands/upload.md](./commands/upload.md)                       |
| `libtv image`（`shortcut list` / `shortcut <scene label> -n <node>`）                 | [commands/image.md](./commands/image.md)                         |
| `libtv script`（含 `storyboard`：从脚本节点生成分镜图组）                             | [commands/script.md](./commands/script.md)                       |
| `libtv model`（含 `search` / 默认完整 schema）                                        | [commands/model.md](./commands/model.md)                         |
| 画布节点类型（`-t` 枚举、对应 `-s` / `-u` 字段）                                      | [node-types/README.md](./node-types/README.md)                   |
| 模型 schema 字段（`properties` / `config` / `rules` / `modeType`）                    | [model-schema/schema.md](./model-schema/schema.md)               |
