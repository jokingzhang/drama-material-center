# 内置输出模板

模板固定结构，不指定作者。`ai-director` 默认主会话可直接复用裸模板和下面的输出合同；只有用户明确选择豆包时，才使用本页的 job、CLI 和 runner 调用说明，由豆包完成正文。不要为校验 GPT-6 文本伪填 `expectedModel: doubao-*` 或伪造豆包运行记录；主会话按同一结构、时间轴、逐字台词和引用合同做本地校验。2500 字符仅为豆包 CLI 的传输安全线，不是该模板或主会话的正文上限。

查看可用模板：

```bash
node <skill-directory>/scripts/run-doubao-creative.mjs --list-templates
```

## `video-shot-prompt-v2`

当前新写、重设计和返修统一使用的视频提示词模板，适用于任意目标视频模型。它采用用户指定的 LibTV 示例的逐镜格式，详见 [格式来源与使用合同](../../ai-director/references/shot-block-format.md)。示例的 21:9、惊悚风格、密集秒数、镜头数和素材编号均不是默认值。不要为凑长度扩写；目标入口若有真实限制，执行前另行核对。

固定结构：

1. 开头引用与主体，如 `{{Mixed 1}} 角色全名。`；必要道具也可在对应画面句中引用。
2. `【全局美学设定】`，依次写画幅、影调、摄影、地点。
3. `正文：分镜执行动作`，可带当前场次标题。
4. `镜头N｜MM:SS.d—MM:SS.d｜X秒`，逐镜写 `相机：`、`构图／运镜：`、`画面：`。构图和运镜可分两行。
5. 镜内用连续段落展开动作、逐字对白、倾听、反应、声音与切出，不另加旧五段式或重复整集声音段。

状态、Task ID、标题、版本、作者和评分放在任务或执行记录中；单独保存的 UTF-8 提示词文件只含模型正文。含对白、OS/VO、梗或情绪时，按知识库专项方法先安排完整表演再定镜长，不以字符除以平均语速代替真实容量判断。

各段按本镜需要承担职责：全局美学设定只给必要视听和空间条件；逐镜相机、构图／运镜与画面写清站位、视线、机位侧、道具关系、动作因果、逐字对白、声源、倾听反应和结束状态；进出口、路线及危险边界只在相关动作存在时写；开头引用说明各输入控制什么。不要把导演评分、素材审核或生产流程抄进正文，也不要设置最低字数。独立节点所需事实仍须写全，不能假设模型会读取外部合同或上一条提示词。

适用 `kind`：`storyboard`、`video-prompts`、`creative-repair`。输出必须为 Markdown。

必填变量：

| 变量 | 示例 | 规则 |
|---|---|---|
| `status` | `DRAFT` | `DRAFT`、`NEEDS_REVISION`、`BLOCKED` 或 `READY`。首次创作默认 `DRAFT`；`READY` 必须来自执行者完成的事实核对，不代表独立语义审查或人工验收。 |
| `taskId` | `EP05 V01` | 本轮稳定 Task ID，不把旧任务 ID 复用到新内容。 |
| `title` | `卷帘门逃生` | 当前生成任务承诺的核心可见事件。 |
| `version` | `v17` | 递增版本，不覆盖旧版。 |
| `durationSeconds` | `30` | 正数；生成单元的镜头块从 `00:00.0` 连续覆盖到该秒数。整集绝对剪辑时间另存执行表。 |
| `aspectRatio` | `16:9` | 正数比例，如 `16:9`、`9:16`。 |

任务包示例：

```json
{
  "template": {
    "id": "video-shot-prompt-v2",
    "variables": {
      "status": "DRAFT",
      "taskId": "EP05 V01",
      "title": "卷帘门逃生",
      "version": "v18",
      "durationSeconds": "30",
      "aspectRatio": "16:9"
    }
  }
}
```

脚本确定性检查：

- 全局设定和逐镜字段完整、顺序正确，画幅与合同一致；不接受旧五段式或状态标题；
- 每个镜头的打印时长等于起止差，镜头编号递增，区间从 0 连续覆盖到 `durationSeconds`；
- 不能遗留模板中的角括号说明；平台真实语法 `<Subject N>` 例外。
- 豆包任务包必须有通过输入校验的 `referencePlan`：至少一个场景；每个 `requiredCharacters` 都有 `character-identity`，或目标入口允许直接使用的 `character-turnaround`。`assets` 按已核对的实际输入顺序登记，Mixed 序号与之对应；v2 不再强制场景排在人物之前，也不要求正文末尾汇总或每项只出现一次。`INTERNAL` 不得进入生成输入；`DRAFT` 可声明 DRAFT 素材，`READY` 的素材状态只能是 `GEN_INPUT` 或 `ACCEPTED`。
- 每个计划内引用均在正文出现并邻近正确主体，可再次用于相关动作；不接受漏引用、计划外引用或错配。场景、人物标准图与辅助图的职责和像素相容性由主会话实查；不以出现“只锁、禁止”等词证明可用，也不默认同一人物同时接头像与标准图。
- 新任务应在 `referencePlan.turnaroundDispositions` 中逐个声明可见具名人物的三视图状态；缺少声明、`CONNECTED` 未对应真实三视图输入，或三视图输入没有对应 `CONNECTED` 声明时停止。历史任务缺少该字段只代表兼容读取，不代表职责完整。

这些检查能证明模板结构和已声明素材合同成立，但不能自动发现执行者漏写进 `requiredCharacters` 的人物，也不证明剧情、动作、素材或画面已接受。执行者仍需从事实源逐镜枚举实际出镜人物和场景、检查陌生观众能否复述核心事件、每句对白是否在对应时间段，并确认状态是否真的有资格写成 `READY`。

`video-shot-prompt-v1` 与其别名 `seedance-shot-prompt-v1` 仅供 `--check`、`--validate-output` 只读核对历史记录，保留历史格式校验；v1 人物标准图可在 `〖参考〗` 末尾共用一行 `共用边界（人物标准图）：…`，但每图仍须独立职责，局部辅助不能借用该边界；实际新调用会拒绝旧 ID。`--list-templates` 只展示 v2。旧素材不批量改写；当前请求范围内的返修另存 v2 格式新版本。

主会话可直接运行不带作者假设、不调用模型的检查器。`contract.json` 使用当前 `durationSeconds`、`aspectRatio` 和 `referencePlan.assets`（每项至少有 `reference` 与 `subject`），可以存于已有创作证据；它是检查输入，不是新的正式业务索引：

```bash
node <skill-directory>/scripts/validate-shot-prompt.mjs \
  --prompt <standalone-body.md> --contract <contract.json>
```

此检查只证明格式、时间算术和声明过的引用对应，不能证明台词自然、图片相容、真实 Node 存在或通过独立审查。写入 LibTV 前仍须先完成正式本地更新，实际 Node 映射也先进入新的本地版本，再进行远端同步与三方哈希回读。

已有豆包 App、网页或旧运行结果时，可只读复核模板，不消耗 Plan：

```bash
node <skill-directory>/scripts/run-doubao-creative.mjs \
  --job <job.json> \
  --validate-output <creative-output.md>
```

## 新增模板

只有用户确认了稳定格式或提供了可复用黄金样本时才新增内置模板。新增时同时提供：

- `assets/templates/<template-id>.md` 的纯输出骨架；
- runner 中的适用 `kind`、必填变量和结构校验；
- 本目录中的选择说明与任务示例；
- 不调用模型的通过和失败用例，并验证实际写作行为；只有当前任务已明确选择且授权豆包创作时才做最小真实豆包调用。模拟 CLI 返回只能验证接线与存盘，不能冒称豆包创作质量已验证。
