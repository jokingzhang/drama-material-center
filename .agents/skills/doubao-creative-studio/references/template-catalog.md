# 内置输出模板

模板固定结构，不创作内容。当前 Agent 选择模板并填入事实型变量；豆包负责根据任务事实完成模板正文。脚本会把模板内容放入 Claude Code 的 stdin，并校验返回结果是否保持模板契约。

查看可用模板：

```bash
node <skill-directory>/scripts/run-doubao-creative.mjs --list-templates
```

## `video-shot-prompt-v1`

当前唯一的视频分镜/生成提示词模板，适用于任意目标视频模型。它抽象自用户认可的 EP05 格式，但不会携带 EP05 的人物、动作、秒数、画幅、焦段或素材编号，也不设置固定字符门槛。不要为凑长度扩写；目标入口若有真实限制，执行前另行核对。

固定结构：

1. `# <状态>｜<Task ID>｜<标题> <版本>`
2. `〖风格〗`
3. `〖空间与轴线〗`
4. `〖时间轴〗`
5. `〖声音〗`
6. `〖参考〗`
7. 可选 `〖禁止〗`

适用 `kind`：`storyboard`、`video-prompts`、`creative-repair`。输出必须为 Markdown。

必填变量：

| 变量 | 示例 | 规则 |
|---|---|---|
| `status` | `DRAFT` | `DRAFT`、`NEEDS_REVISION`、`BLOCKED` 或 `READY`。首次豆包创作默认 `DRAFT`；`READY` 必须来自执行者完成的事实核对。 |
| `taskId` | `EP05 V01` | 本轮稳定 Task ID，不把旧任务 ID 复用到新内容。 |
| `title` | `卷帘门逃生` | 当前生成任务承诺的核心可见事件。 |
| `version` | `v17` | 递增版本，不覆盖旧版。 |
| `durationSeconds` | `30` | 正数；时间轴必须从 `0s` 连续覆盖到该秒数。 |
| `aspectRatio` | `16:9` | 正数比例，如 `16:9`、`9:16`。 |

任务包示例：

```json
{
  "template": {
    "id": "video-shot-prompt-v1",
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

- 标题行必须与六个变量完全一致；
- 五个核心段必须存在且顺序正确；
- `〖禁止〗` 可以删除，保留时必须在 `〖参考〗` 之后；
- `〖风格〗` 必须包含指定时长和画幅；
- `〖时间轴〗` 的反引号时间段必须从 0 开始、首尾相接、不重叠，并精确结束于 `durationSeconds`；
- 不能遗留模板中的角括号说明；平台真实语法 `<Subject N>` 例外。
- 所有使用本模板的任务包都必须有通过输入校验的 `referencePlan`：至少一个场景；每个 `requiredCharacters` 都有 `character-identity`，或目标入口允许直接使用的 `character-turnaround`；同一人物可同时使用一个身份锚点和一个受控三视图。顺序固定为场景 → 人物身份与三视图输入 → 状态/道具/音频 → 空间/连续帧/关键帧。`INTERNAL` 不得进入生成输入；`DRAFT` 可声明 DRAFT 素材，`READY` 的素材状态只能是 `GEN_INPUT` 或 `ACCEPTED`。
- 三视图与头像同时使用时，`〖参考〗` 必须明确头像负责脸部身份，三视图只补充体型、轮廓与同一造型前侧背结构，并写明忽略三联排版和中性站姿、禁止复制重复人物、拼板、文字或影棚背景。校验通过只证明职责和引用成立，不证明模型实际遵循。
- 新任务应在 `referencePlan.turnaroundDispositions` 中逐个声明可见具名人物的三视图状态；缺少声明、`CONNECTED` 未对应真实三视图输入，或三视图输入没有对应 `CONNECTED` 声明时停止。历史任务缺少该字段只代表兼容读取，不代表职责完整。
- 有 `referencePlan` 时，`〖参考〗` 必须按计划顺序使用全部平台引用且各出现一次；引用不能出现在其它段落；每个引用必须在邻近文字中点名对应 `subject` 和素材职责；空间板、连续帧和关键帧必须写成局部辅助约束并带明确负面边界。

这些检查能证明模板结构和已声明素材合同成立，但不能自动发现执行者漏写进 `requiredCharacters` 的人物，也不证明剧情、动作、素材或画面已接受。执行者仍需从事实源逐镜枚举实际出镜人物和场景、检查陌生观众能否复述核心事件、每句对白是否在对应时间段，并确认状态是否真的有资格写成 `READY`。

旧 ID `seedance-shot-prompt-v1` 仅作为已有任务包的兼容别名，解析后仍使用本模板；`--list-templates` 只展示上述一个规范 ID，新任务不得继续使用旧 ID。

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
- 至少一条不调用模型的通过用例和一条失败用例，再做一次最小真实调用。
