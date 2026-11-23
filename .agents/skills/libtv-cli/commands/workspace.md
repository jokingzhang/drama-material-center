# `libtv workspace` — 项目（工作区）

> 📌 **术语**：本 CLI 里 **项目（workspace）= 工作区**，是装画布的容器；**画布（project）** 才是真正的画布文件（见 [project.md](./project.md)）。一个**项目**下可以放多张**画布**。
>
> 💡 **引导用户**：项目即网页端左侧的「项目（工作区）」。项目本身没有独立的画布链接，进入项目后选中某张画布再分享：`https://www.liblib.tv/canvas?spaceId=<项目ID>&projectId=<画布UUID>`。

创建、查询、更新远程**项目（工作区）**，以及**把当前工作目录绑定到某个项目**（写入 `.libtv/project.json` 的 `workspaceId` + 团队 `teamId`）。

**`.libtv/project.json` 的绑定字段（可并存）**：`projectUuid`（画布）、`workspaceId`（所属项目）、`teamId`（所属团队）、`groupNodeKey`（默认分组）。

- `libtv workspace use <项目ID>`：写 `workspaceId` + `teamId`，**不设置默认画布**（清除原 `projectUuid` / `groupNodeKey`）。
- [`libtv project use <画布UUID>`](./project.md)：写 `projectUuid`，并把 `workspaceId` / `teamId` **同步成该画布实际所属的项目与团队**（画布不在任何项目下时不写 `workspaceId`）。
- `libtv workspace unuse`：清除 `workspaceId` + `teamId`（保留画布绑定）。

**绑定项目后，画布命令自动作用在该项目下**：`libtv workspace use <项目ID>` 之后，[`libtv project create`](./project.md) 默认把新画布建到该项目里、[`libtv project list`](./project.md) 默认只列该项目下的画布。两者都支持 `-w/--workspace <项目ID>` 显式覆盖，`-w 0` 回到根目录。

`.libtv/project.json` 写在当前工作目录；stdout/stderr 与管道嵌套 case 见 [../examples/pipes/README.md](../examples/pipes/README.md)。

## 子命令

| 子命令                                      | 作用                                       |
| ------------------------------------------- | ------------------------------------------ |
| **`libtv workspace create <workspace>`**    | 新建一个空项目（工作区）                   |
| **`libtv workspace list`**（别名 **`ls`**） | 分页列出当前账号下的项目                   |
| **`libtv workspace update <workspaceId>`**  | 修改项目名称 / 简介 / 封面                 |
| **`libtv workspace use <workspaceId>`**     | 把当前目录绑定到指定项目（顶掉原画布绑定） |
| **`libtv workspace unuse`**                 | 解除当前目录与项目的绑定                   |

### `libtv workspace create <workspace>`

用法骨架：`libtv workspace create <workspace> [flags]`

**位置参数**

- **`<workspace>`**（必填）：项目名称（展示用）；含空格时用引号。

**选项**

| 选项                       | 必填 | 说明                                                                  |
| -------------------------- | ---- | --------------------------------------------------------------------- |
| `-d, --description <text>` | 否   | 项目简介。                                                            |
| `--cover-url <url>`        | 否   | 封面图 URL。                                                          |
| `-t, --team-id <n>`        | 否   | 团队场景下的团队 ID（整数）；缺省跟随当前活跃账户，`0` 强制建到个人。 |
| `--help`                   | 否   | 打印该子命令帮助。                                                    |

**输出**：stdout 为 JSON，含 `workspaceId`（即新项目的文件夹 id，可直接用于 `libtv workspace use`）。

### `libtv workspace list`（别名 `ls`）

用法骨架：`libtv workspace list [flags]`

**位置参数**：无。

**选项**

| 选项                     | 默认              | 说明                                                                                      |
| ------------------------ | ----------------- | ----------------------------------------------------------------------------------------- |
| `-p, --page <n>`         | `1`               | **页码**（从 1 起）。⚠️ **不是项目 ID**。                                                 |
| `-s, --page-size <n>`    | `20`              | 每页条数。                                                                                |
| `-o, --order-by <field>` | `updated_at_desc` | 排序，须为：`updated_at_desc` / `updated_at_asc` / `created_at_desc` / `created_at_asc`。 |
| `--name <text>`          | —                 | 仅保留名称**包含**该关键字的项（子串匹配）。                                              |
| `-t, --team-id <n>`      | —                 | 团队空间过滤：`>0` 仅返回该团队下的项目；缺省跟随当前活跃账户 scope，`0` 强制个人。       |
| `--help`                 | —                 | 打印帮助。                                                                                |

**输出**：stdout 为 JSON，项目以 `folders` 数组返回，每项含 `id`（项目 ID）、`name`、`fileCnt`（含画布数）等。

### `libtv workspace update <workspaceId>`

用法骨架：`libtv workspace update <workspaceId> [flags]`

**位置参数**

- **`<workspaceId>`**（必填）：项目（工作区）文件夹 id（正整数）。

**选项**：`-n, --name`、`-d, --description`、`--cover-url`（传空字符串可清空封面）、`-t, --team-id`、`--help`。至少传入 `--name` / `--description` / `--cover-url` 中的一个。`--team-id` 缺省跟随当前活跃账户 scope，`0` 强制个人空间。

**输出**：stdout 为 JSON，如 `{ "ok": true, "workspaceId": 42 }`。

### `libtv workspace use <workspaceId>`

用法骨架：`libtv workspace use <workspaceId> [flags]`

**位置参数**

- **`<workspaceId>`**（必填）：**仅支持项目 ID**（项目即文件夹 id，正整数；不支持按名称匹配）。会先调接口校验可访问，再写入本地 `.libtv/project.json` 的 `workspaceId` 与团队 `teamId`。

**选项**：`-t, --team-id`（团队项目的详情校验用，缺省跟随当前活跃账户）、`--help`。

**副作用**：**不设置默认画布**——会清除原有的画布绑定 `projectUuid` 与默认分组 `groupNodeKey`，仅保留 `workspaceId` + `teamId`。之后 `project create` / `project list` 会自动作用在该项目下（见 [project.md](./project.md) 的 `-w`）。

**输出**：stdout 为 JSON，含 `cwd`、`workspaceId`；校验成功时可能含 `name`、`teamId`；若顶掉了原有画布绑定则含 `releasedProjectUuid`（被解除的画布 UUID）。

### `libtv workspace unuse`

用法骨架：`libtv workspace unuse`

**位置参数**：无。**选项**：仅 `--help`。

**副作用**：清除 `.libtv/project.json` 的 `workspaceId` 与团队 `teamId`；若该文件中仍保有画布绑定（`projectUuid`）则保留之，否则删除整个文件。

**输出**：stdout 为 JSON，如 `{ "workspaceUnbound": true }`。

## 示例

```bash
# case 1: 新建项目，拿到项目 ID 后绑定到当前目录
WS=$(libtv workspace create "我的短剧项目" -d "demo" | jq -r '.workspaceId')
libtv workspace use "$WS"

# case 2: 翻页列出我的项目（项目 = 工作区）
libtv workspace list -p 1 -s 20

# case 3: 按名称子串过滤
libtv workspace list --name "短剧"

# case 4: project use 会把画布所属项目 + 团队同步进 project.json
libtv project use 11111111-2222-3333-4444-555555555555
# => { projectUuid, workspaceId: <画布所属项目>, teamId: <所属团队> }
# 之后 workspace use 切到别的项目：清掉画布绑定，只留 workspaceId + teamId
libtv workspace use 42

# case 5: 绑定项目后，画布命令自动作用在该项目下（无需每次带 -w）
libtv workspace use "$WS"
libtv project create "第一集"     # 自动建到 $WS 项目下（stderr 提示项目范围）
libtv project list                # 自动只列 $WS 项目下的画布
libtv project list -w 0           # 临时查看根目录画布（不在任何项目下）
libtv project create "草稿" -w 0  # 临时建到根目录

# case 6: 解除项目绑定 / 重命名
libtv workspace unuse
libtv workspace update 42 -n "改个名"
```
