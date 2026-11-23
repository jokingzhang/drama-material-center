# `libtv project` — 画布

> 📌 **术语**：本 CLI 里 **画布（project）** 是真正的画布文件；装画布的容器叫 **项目（工作区，workspace）**，见 [workspace.md](./workspace.md)。下文「画布 UUID」即 `projectUuid`。

> 💡 **引导用户**：涉及某张画布时，主动把它的网页链接告诉用户，方便其在浏览器里打开查看：`https://www.liblib.tv/canvas?projectId=<画布UUID>`（把 `<画布UUID>` 换成实际的 `projectUuid`）。

创建、查询远程画布，以及**把当前工作目录绑定到某张画布**（写入 `.libtv/project.json`）。多数子命令（[`libtv node`](./node.md)、[`libtv upload`](./upload.md)、[`libtv group`](./group.md)）在未传 `-p/--project` 时会读取该文件里的 **`projectUuid`**；未绑定且未传 `-p` 时会报错并提示执行 `libtv project use`。

**`.libtv/project.json` 字段（可并存）**：`projectUuid`（画布）、`workspaceId`（所属项目）、`teamId`（所属团队）、`groupNodeKey`（默认分组）。`libtv project use` 写入画布时，会**把该画布实际所属的项目 `workspaceId` 与团队 `teamId` 一并同步写入**（画布不在任何项目下时不写 `workspaceId`）；[`libtv workspace use`](./workspace.md) 则写项目 + 团队但不设默认画布。

**项目（工作区）自动生效（`-w`）**：当 `.libtv/project.json` 里有 `workspaceId`（来自 `project use` 同步或 [`libtv workspace use`](./workspace.md)），`project create` / `project list` 会**自动作用在该项目下**——新画布默认建到该项目里、列表默认只列该项目下的画布。用 `-w/--workspace <项目ID>` 显式覆盖，`-w 0` 强制回到根目录（不在任何项目下）。自动生效时会在 stderr 打一行 `[项目范围] …` 提示（不污染 stdout 的 JSON）。

`.libtv/project.json` 写在当前工作目录；stdout/stderr 与管道嵌套 case 见 [../examples/pipes/README.md](../examples/pipes/README.md)。

## 子命令

| 子命令                                    | 作用                                                          |
| ----------------------------------------- | ------------------------------------------------------------- |
| **`libtv project create <project>`**      | 新建空白画布                                                  |
| **`libtv project list`**（别名 **`ls`**） | 分页列出当前账号下的画布                                      |
| **`libtv project update <projectUuid>`**  | 修改画布名称 / 简介 / 封面 / 所属文件夹                       |
| **`libtv project use <projectUuid>`**     | 把当前目录绑定到指定画布                                      |
| **`libtv project unuse`**                 | 解除当前目录与画布的绑定                                      |
| **（默认）`libtv project [projectUuid]`** | 拉取画布详情并输出**精简 JSON**（节点、边、id、展示名、位置） |

### `libtv project create <project>`

用法骨架：`libtv project create <project> [flags]`

**位置参数**

- **`<project>`**（必填）：画布名称（展示用）；含空格时用引号。

**选项**

| 选项                       | 必填 | 说明                                                                                   |
| -------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `-d, --description <text>` | 否   | 画布简介。                                                                             |
| `--cover-url <url>`        | 否   | 封面图 URL。                                                                           |
| `-t, --team-id <n>`        | 否   | 团队场景下的团队 ID（整数）。                                                          |
| `-w, --workspace <n>`      | 否   | 落地的项目（工作区）id：新画布建到该项目下。缺省跟随当前目录绑定的项目，`0` = 根目录。 |
| `--folder-id <n>`          | 否   | 低层父文件夹 id（等价 `-w`，显式传入时优先）。                                         |
| `--help`                   | 否   | 打印该子命令帮助。                                                                     |

**输出**：stdout 为 JSON，含新画布信息（可从中取 `uuid` 供后续 `libtv project use` 或其它子命令的 `-p` 使用）。

### `libtv project list`（别名 `ls`）

用法骨架：`libtv project list [flags]`

**位置参数**：无。

**选项**

| 选项                     | 默认              | 说明                                                                                      |
| ------------------------ | ----------------- | ----------------------------------------------------------------------------------------- |
| `-p, --page <n>`         | `1`               | **页码**（从 1 起）。⚠️ **不是画布 UUID**，勿与 [`libtv node -p`](./node.md) 混淆。       |
| `-s, --page-size <n>`    | `20`              | 每页条数。                                                                                |
| `-o, --order-by <field>` | `updated_at_desc` | 排序，须为接口约定值之一：`updated_at_desc` / `edit_time_desc` / `edit_time_asc`。        |
| `--name <text>`          | —                 | 仅保留名称**包含**该关键字的项（子串匹配）。                                              |
| `-t, --team-id <n>`      | —                 | 团队空间过滤：`>0` 仅返回该团队下的画布；缺省跟随当前活跃账户 scope，`0` 强制个人。       |
| `-w, --workspace <n>`    | —                 | 项目（工作区）范围：`>0` 仅列该项目下的画布、`0` 仅列根画布。缺省跟随当前目录绑定的项目。 |
| `--help`                 | —                 | 打印帮助。                                                                                |

**输出**：stdout 为 JSON。

### `libtv project update <projectUuid>`

用法骨架：`libtv project update <projectUuid> [flags]`

**位置参数**

- **`<projectUuid>`**（必填）：画布 UUID。

**选项**

| 选项                       | 必填 | 说明                                                    |
| -------------------------- | ---- | ------------------------------------------------------- |
| `-n, --name <text>`        | 否   | 新画布名称。                                            |
| `-d, --description <text>` | 否   | 新画布简介。                                            |
| `--cover-url <url>`        | 否   | 新封面图 URL；传空字符串可清空。                        |
| `--folder-id <n>`          | 否   | 父文件夹 id：`0` = 根目录；也可用于把画布移动到项目下。 |
| `--help`                   | 否   | 打印帮助。                                              |

至少传入 `--name` / `--description` / `--cover-url` / `--folder-id` 中的一个。

**输出**：stdout 为 JSON，如 `{ "ok": true, "projectUuid": "<画布UUID>" }`。

### `libtv project use <projectUuid>`

用法骨架：`libtv project use <projectUuid> [flags]`

**位置参数**

- **`<projectUuid>`**（必填）：**仅支持画布 UUID**（不支持按名称模糊匹配）。会先调接口校验可访问，再写入本地 `.libtv/project.json`。

**选项**

- **`--help`** — 打印帮助。

**副作用**：会把该画布实际所属的项目 `workspaceId` 与团队 `teamId` **一并同步写入**（画布不在任何项目下时不写 `workspaceId`）；并**清除**原有的 **`groupNodeKey`**（默认分组绑定），仍需组内限定请重新执行 [`libtv group use`](./group.md)。

**输出**：stdout 为 JSON，含 `cwd`、`projectUuid`；校验成功时可能含 `name`、`workspaceId`、`teamId`。

### `libtv project unuse`

用法骨架：`libtv project unuse`

**位置参数**：无。**选项**：仅 `--help`。

**副作用**：**删除** `.libtv/project.json`（含其中的 `groupNodeKey` 一并移除）。

**输出**：stdout 为 JSON，如 `{ "unbound": true }`。

### `libtv project` / `libtv project <projectUuid>`（默认子命令）

用法骨架：`libtv project [projectUuid]`

**位置参数**

- **`[projectUuid]`**（可选）：画布 UUID；省略时使用当前目录 `.libtv/project.json` 的 `projectUuid`；未绑定且未传参则报错。

**输出**：stdout 为 JSON——节点 id / 展示名 / 类型 / 位置；边的 id / source / target。便于快速查看画布结构，**不等价**于完整的画布元数据接口。

## 示例

```bash
# case 1: 新建画布，然后立刻绑定到当前目录
NEW=$(libtv project create "测试画布" -d "demo" | jq -r '.uuid')
libtv project use "$NEW"

# case 2: 翻页列出我的画布（页码走 -p/--page，不是 UUID）
libtv project list -p 1 -s 20

# case 3: 按名称子串过滤
libtv project list --name "分镜"

# case 4: 修改画布名称 / 移动到根目录
libtv project update "$NEW" -n "测试画布 v2"
libtv project update "$NEW" --folder-id 0

# case 5: 仅需画布结构（节点 + 边）时的快速摘要
libtv project                # 省略 UUID：使用目录绑定
libtv project 11111111-2222-3333-4444-555555555555

# case 6: 解除当前目录的画布绑定（同时清除 groupNodeKey）
libtv project unuse
```
