# `libtv node` — 画布节点

对已有画布项目里的节点做**查询 / 新建 / 更新 / 改边 / 触发生成**。画布项目由 **`-p` / `--project`** 指定，或读取当前目录 **`.libtv/project.json`** 的 **`projectUuid`**（见 [commands/project.md](./project.md)）；限定到某个普通分组时通过 **`-g` / `--group`** 或 [`libtv group use`](./group.md) 绑定（见 [commands/group.md](./group.md)）。

管道（NDJSON）、stdout/stderr 约定与嵌套 case 见 [../examples/pipes/README.md](../examples/pipes/README.md)。

## 子命令

| 子命令                          | 作用                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| **（默认）`libtv node <node>`** | **查询 / 更新 / 改边 / `--run`**；只操作已有节点，**不接受 `-t`**。               |
| **`libtv node create <node>`**  | **仅新建**；已存在同名 / 同 id 则报错；**`-t` 必填**；可配合 `--run` 新建后生成。 |
| **`libtv node list`**           | 列出画布节点（受 `-g` / 目录默认分组约束）。                                      |
| **`libtv node delete <node>`**  | 删除指定节点与其全部连线。                                                        |

完整子命令与选项以 **`libtv node --help`** / **`libtv node <子命令> --help`** 为准。

### `libtv node <node>`（默认子命令）

用法骨架：`libtv node <node> [flags]`

**位置参数**

- **`<node>`**（必填）：目标**焦点节点**，可为节点 **id** 或**展示名**；**精确匹配**、**id 优先**，不是模糊搜索。多条同名：交互 TTY 可列出多条；**stdout 接到管道**时要求**唯一**匹配，否则报错。

**选项**

| 选项                                       | 可重复 | 说明                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-p, --project <project>`                  | 否     | 画布项目 **UUID**。省略时读当前目录 `.libtv/project.json` 的 `projectUuid`（需已 `libtv project use`）。**勿与** [`libtv project list -p`](./project.md)（**页码**）混淆。                                                                                                                                                                                                                                          |
| `-g, --group <group>`                      | 否     | 父级**普通分组**的节点 id 或展示名。限定 `<node>` 与 `--left/--right` 端点解析范围；未传时若已 `libtv group use` 则自动套用。                                                                                                                                                                                                                                                                                       |
| `--name <text>`                            | 否     | 改展示名。**仅**默认子命令可用；`node create` 的展示名由位置参数 `<node>` 承载。**禁止**用 `-u` 写 `name` / `label`。                                                                                                                                                                                                                                                                                               |
| `--prompt <text>`                          | 否     | 写 `data.params.prompt`；与 `-s prompt=…` 同用时 `--prompt` **后写入**并覆盖。文案里可用 `{{Node …}}` 占位符引用已连线的图片 / 视频，详见表格下方「prompt 占位符」。                                                                                                                                                                                                                                                |
| `-s, --set <key=value>`                    | 是     | 改「**生成器参数**」，写 `data.params`；按**第一个** `=` 拆键值；值可为 `true` / `false` / 数字 / JSON 片段。**`model` 只接受模型名字（`modelName`）**，含空格须引号（如 `-s "model=GVLM 3.1"`；用 [`libtv model search`](./model.md) 查名字，CLI 内部解析为 `modelKey`，传 key 会报错）。其余字段集以 [`libtv model <model>`](./model.md) 为准；schema 见 [../model-schema/schema.md](../model-schema/schema.md)。 |
| `-u, --update <key=value>`                 | 是     | 改「**节点自身属性**」，写 `data` 顶层（**不含** `params`），不经生成器 schema 校验。`-s` / `-u` 对比与 `-u` 拒写键见 [../node-types/README.md](../node-types/README.md)。                                                                                                                                                                                                                                          |
| `--left <node>` / `--right <node>`         | 是     | **确保模式**入边 / 出边：无则建边、已有则不变；**不会**删除未在列表中的已有边。**不可**与 `--left-add/--left-rm`（同侧）或 `--right-add/--right-rm`（同侧）**同时**使用。                                                                                                                                                                                                                                           |
| `--left-add <node>` / `--left-rm <node>`   | 是     | **增量**追加 / 移除左侧入边。                                                                                                                                                                                                                                                                                                                                                                                       |
| `--right-add <node>` / `--right-rm <node>` | 是     | **增量**追加 / 移除右侧出边。                                                                                                                                                                                                                                                                                                                                                                                       |
| `--x <n>` / `--y <n>`                      | 否     | 与建边联用的画布坐标（像素），默认 `0`。新建节点时写在父级 `node` 后、`create` 前：`libtv node --x 720 --y 260 create ...`。有分组时为**组内相对坐标**。                                                                                                                                                                                                                                                            |
| `-r, --run`                                | 否     | 写操作成功后，对 `<node>` 解析到的节点再触发一次生成，并**阻塞等待终态 JSON 后退出**。调用方只需要等待该命令返回；**不要**把它当异步提交命令、不要后台运行、不要自行加 timeout、不要额外轮询。**仅**在节点已存在、无改边、无 `--prompt`/`-s` 时允许「只触发生成」。                                                                                                                                                 |

**`--run` 等待规则（给 agent / 脚本）**：`libtv node ... --run` 是同步等待命令。CLI 内部会提交任务、轮询进度、写回画布，并在 stdout 输出终态 JSON 后退出；stderr 里的 `[run] task=...` 只是内部进度日志。外部脚本 / agent **不要**再包一层轮询，也**不要**因为看见 taskId 就停止；直接等待进程退出并读取 stdout JSON。

**prompt 占位符（`{{Node …}}`）**：文案里用 `{{Node …}}` 引用**已连线到该节点**的上游图片 / 视频 / 音频。`--prompt`、`-s prompt=…`、`libtv node create` 均适用。有两种写法：

- **`{{Node "节点名"}}`（手写 prompt 优先推荐）**：用**成对引号**包裹上游节点的**展示名**（与 `<node>` 定位用的名字一致）。写入时按整张画布精确匹配该名——**唯一**命中即自动解析为该节点；**画布内有多个同名**→整条写入中止并报错（错误里告知同名数量，请改用 `{{Node <nodeKey>}}` 精确指定）；找不到该名 / 该节点未连线到本节点→同样报错。不要写 `{{Node 节点名}}`，无引号会被当成 nodeKey。
- **`{{Node <nodeKey>}}`**：`<nodeKey>` 即查询输出里的 **`nodeKey`**，直接锚定节点身份。当节点同名、或想最稳妥时用它。CLI **读取节点时一律把 prompt 占位符显示为 `{{Node <nodeKey>}}`**；若 `<nodeKey>` 未连线到本节点，则整条写入中止并报错。

> `{{Node …}}` 是「CLI ↔ 模型」之间的占位符层，CLI 会按该节点当前入边自动落库，**不影响网页端展示**。

```bash
# 优先：按节点名引用（名字在画布内唯一时；带引号）
libtv node "改图" --left 原图 --left 参考猫 --left 参考动作 \
  --prompt "把 {{Node \"原图\"}} 中的小狗替换成 {{Node \"参考猫\"}} 中的小猫，动作参考 {{Node \"参考动作\"}}"

# 同名或求稳：按 nodeKey 引用（先查到上游 nodeKey，再写入）
libtv node "改图" --left 原图 --left 参考猫 --left 参考动作 \
  --prompt "把 {{Node <原图nodeKey>}} 中的小狗替换成 {{Node <参考猫nodeKey>}} 中的小猫，动作参考 {{Node <参考动作nodeKey>}}"
```

**Seedance 2.0 合规校验**：`--run` 触发视频生成时，若当前模型 schema 满足 `properties.portrait=true` 且 `properties.autoCompliance.enable=true`，CLI 会按网页端同一规则在提交 `generation/create` 前校验未带 `assetId`、未标记 `portraitCompliantExempt` 的上游图片。校验通过后，本次请求会把对应图片转换为 `asset://<assetId>`；未检测到真人且后端不签发 `assetId` 的图片会写入 `portraitCompliantExempt` 并继续使用真实 URL；任一图片未通过时，本次生成会中止。

**stdin（可选输入）**：无 `-s`/`--prompt`、无改边 flag 时，按**逐行 JSON** 解析，读取每行 `nodeKey` 或 `newNodeKey`，把上游节点**确保连到 `<node>` 左侧**（语义同 `--left`）。与 `--left` 合用：stdin 的 key 在前，命令行名字在后，去重后参与；可与 `-r` 合用。

**行为组合（摘要）**

| 条件（约）                                   | 行为                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| 无改边、无 `--prompt/-s/-u/--name`、无 stdin | **仅查询** `<node>`；管道下多为单行 NDJSON                                         |
| 有 stdin、无其它写参                         | stdin 节点**确保**连到 `<node>` 左侧                                               |
| 有改边类 flag                                | 在**已有** `<node>` 上改边（可同时带 stdin / `--prompt` / `-s` / `-u` / `--name`） |
| 有 `--prompt` / `-s` / `-u` / `--name`       | 在**已有** `<node>` 上更新；若节点不存在则报错，新建请用 `libtv node create`       |

### `libtv node create <node>`

用法骨架：`libtv node create <node> [flags]`

**位置参数**

- **`<node>`**（必填）：新节点的**展示名**（画布上需唯一）。

**与默认子命令的差异**

| 条目         | 差异                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| 只新建       | 同名 / 同 id 已存在时**报错**；更新已有节点改用默认子命令 `libtv node <node>`。                           |
| `-t, --type` | **必填**。**不能**创建画布 `group`（用 [`libtv group`](./group.md)）；`custom` / `group` 等类型会被拒绝。 |
| `-r, --run`  | 新建成功后立即触发一次生成；只触发已有节点生成请用默认子命令 `libtv node <node> --run`。                  |
| `--name`     | **不接受**；展示名由位置参数 `<node>` 承载。                                                              |
| stdin        | 仅在与 `-t` 及 `--left/...-add` 等**建边 / 写操作**组合时生效。                                           |

**相同语义的选项**：**`-p` / `-g` / `-t`（这里必填）/ `--prompt` / `-s` / `-u` / `--left` / `--left-add` / `--left-rm` / `--right` / `--right-add` / `--right-rm` / `-r`**。`--x` / `--y` 由父级 `node` 解析，写在 `create` 前：`libtv node --x 720 --y 260 create <node> ...`。**`--left` 与 `--left-add/--left-rm` 互斥**、**`--prompt` 覆盖 `-s prompt=…`** 等规则相同。

### `libtv node list`

用法骨架：`libtv node list [flags]`

**位置参数**：无。

**选项**

| 选项                      | 必填 | 说明                                                                            |
| ------------------------- | ---- | ------------------------------------------------------------------------------- |
| `-p, --project <project>` | 否   | 同默认子命令。                                                                  |
| `-g, --group <group>`     | 否   | 限定只列该分组 `childNodeIds` 内子节点；未传且未 `libtv group use` 时列全画布。 |

**输出**：stdout 为 JSON（含 `scope` / `count` / `nodes` 等）。

### `libtv node delete <node>`

用法骨架：`libtv node delete <node> [flags]`

**位置参数**

- **`<node>`**（必填）：节点 id 或展示名，**id 优先**、精确匹配（语义同默认子命令的 `<node>`）。

**选项**

| 选项                      | 必填 | 说明                               |
| ------------------------- | ---- | ---------------------------------- |
| `-p, --project <project>` | 否   | 同默认子命令。                     |
| `-g, --group <group>`     | 否   | 仅允许删组内子节点；跨组会被拒绝。 |

**副作用**：同时删除该节点的全部连线。

## 示例

```bash
# case 1: 查询单个节点（已 project use）
libtv node "剧情"

# case 2: 列出画布全部节点 / 仅列某个分组内
libtv node list
libtv node list -g "本镜资源组"

# case 3: 新建文本节点并一次性写好提示词与模型
libtv node create "剧情" -t text --prompt "写一段分镜旁白" -s "model=GVLM 3.1"

# case 4: 改已有节点参数（默认子命令不接受 -t，类型从画布推断）
libtv node "剧情" --set prompt="改后的提示全文" --set "model=GVLM 3.1"

# case 5: --prompt 会覆盖 -s prompt=…，最终 params.prompt=「最终版」
libtv node "剧情" -s prompt="旧版" --prompt "最终版"

# case 6: 仅改节点自身内容（不影响模型下次如何生成）
libtv node "剧情" -u content='["你好世界","第二段"]'

# case 7: 确保入边（不删其它已有边）
libtv node "下游" --left 上游甲 --left 上游乙

# case 8: 增量加一条入边 / 移除一条入边
libtv node "下游" --left-add 新上游
libtv node "下游" --left-rm 旧上游

# case 9: stdin 管道把多个上游 nodeKey 连到下游左侧
(libtv node "上游甲" && libtv node "上游乙") | libtv node "下游"

# case 10: 节点已存在、无改参时仅触发一次生成
libtv node "剧情" --run

# case 10b: 按坐标新建视频节点并立即生成（--x/--y 写在 create 前）
libtv node --x 720 --y 260 create "镜头-01" -t video \
  -s "model=Seedance 2.0 VIP" -s modeType=text2video -s ratio=16:9 \
  --prompt "A cinematic 4-second shot of a futuristic city at sunrise." \
  --run

# case 11: 改名（仅默认子命令支持；node create 不接受 --name）
libtv node "旧名" --name "新名"

# case 12: 改边与生成一条命令搞定
libtv node "剧情" --left 参考图 --run

# case 13: prompt 里用 {{Node …}} 引用已连线的图片 / 视频（优先按节点名）
libtv node "改图" --left 原图 --left 参考猫 --left 参考动作 \
  --prompt "把 {{Node \"原图\"}} 中的小狗替换成 {{Node \"参考猫\"}} 中的小猫，动作参考 {{Node \"参考动作\"}}" \
  --run
```
