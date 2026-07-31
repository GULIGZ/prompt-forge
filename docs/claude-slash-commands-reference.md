# Claude Code 斜杠命令完整参考手册

> **版本：** Claude Code v2.1+ | **更新日期：** 2026年6月
>
> 本文档整理了 Claude Code CLI 中所有可用的斜杠命令（Slash Commands），按功能分类，包含详细说明和用法示例。

---

## 目录

- [一、概述](#一概述)
- [二、会话管理类](#二会话管理类)
- [三、上下文与记忆类](#三上下文与记忆类)
- [四、模型与性能类](#四模型与性能类)
- [五、代码与开发类](#五代码与开发类)
- [六、项目管理与配置类](#六项目管理与配置类)
- [七、账户与权限类](#七账户与权限类)
- [八、通信与分享类](#八通信与分享类)
- [九、工作流与自动化类](#九工作流与自动化类)
- [十、子代理与并行类](#十子代理与并行类)
- [十一、杂项工具类](#十一杂项工具类)
- [十二、技能集成类（Bundled Skills）](#十二技能集成类bundled-skills)
- [十三、工作流集成类（Bundled Workflows）](#十三工作流集成类bundled-workflows)
- [十四、MCP 命令集成](#十四mcp-命令集成)
- [十五、自定义命令（技能）](#十五自定义命令技能)

---

## 一、概述

### 1.1 什么是斜杠命令

Claude Code 的斜杠命令（以 `/` 开头的命令）是控制 Claude Code 行为的主要方式。它们提供了一种快速切换模型、管理权限、清除上下文、运行工作流等操作的途径。

### 1.2 使用方法

- 在提示符中直接输入 `/` 可查看所有可用命令
- 输入 `/` 后跟字母可过滤命令列表
- 命令仅在消息开头被识别，命令名称后的文本会作为参数传递

### 1.3 命令来源

| 来源 | 说明 |
|------|------|
| **内置命令** | Claude Code 自带的固定逻辑命令，行为编码在 CLI 中 |
| **捆绑技能（Bundled Skills）** | 基于提示的扩展，由 Claude 使用工具编排完成工作 |
| **捆绑工作流（Bundled Workflows）** | 在多子代理间分发任务并在后台运行 |
| **自定义命令/技能** | 用户通过 `.claude/skills/` 或 `.claude/commands/` 创建的个性化命令 |

### 1.4 符号约定

- `<arg>`：必需参数
- `[arg]`：可选参数
- `{a\|b}`：多选一
- `[Skill]`：捆绑技能
- `[Workflow]`：捆绑工作流

---

## 二、会话管理类

### `/clear [name]`

**用途：** 开启一个空上下文的新对话。

| 属性 | 值 |
|------|-----|
| 别名 | `/reset`, `/new` |
| 参数 | `name`（可选）：为之前的会话命名，便于在 `/resume` 中识别 |

**说明：** 清除当前对话上下文，开始全新会话。之前的对话会保留，可通过 `/resume` 恢复。如果想在继续当前对话的同时释放上下文，请用 `/compact`。

**示例：**
```
/clear
/clear 修复API认证问题
```

---

### `/resume [session]`

**用途：** 恢复之前的对话。

| 属性 | 值 |
|------|-----|
| 别名 | `/continue` |
| 参数 | `session`（可选）：会话 ID 或名称 |

**说明：** 通过 ID 或名称恢复对话。不带参数时打开会话选择器。从 v2.1.144 起，后台会话在选择器中会标记为 `bg`。

**示例：**
```
/resume
/resume 修复API认证问题
```

---

### `/branch [name]`

**用途：** 在当前对话点创建一个分支，尝试不同方向而不丢失原对话。

| 属性 | 值 |
|------|-----|
| 参数 | `name`（可选）：分支名称 |

**说明：** 在当前对话点创建分支并切换到新建分支，保留原始对话（可通过 `/resume` 返回）。如需将子任务交给后台子代理而非自己切换，使用 `/fork`。

**示例：**
```
/branch 尝试方案B
```

---

### `/fork <directive>`

**用途：** 生成一个继承完整对话的子代理。（v2.1.161+）

**说明：** 创建一个后台子代理，子代理继承完整的对话历史并在后台执行指令，完成后将结果返回主对话。在 v2.1.161 之前，`/fork` 是 `/branch` 的别名。

**示例：**
```
/fork 研究这个API的替代方案
```

---

### `/background [prompt]`

**用途：** 将当前会话分离到后台运行，释放当前终端。

| 别名 | `/bg` |
|------|-------|
| 参数 | `prompt`（可选）：分离前发送的最后一条指令 |

**说明：** 将当前会话转为后台代理继续运行，终端可另作他用。可通过 `claude agents` 监控会话状态。

**示例：**
```
/background 继续分析日志文件
```

---

### `/stop`

**用途：** 停止当前后台会话。

**说明：** 仅在附加到后台会话时可用。停止后会话记录和工作树会保留。如需仅分离而不停止，使用 `/exit` 或按 `←` 键。

---

### `/exit`

**用途：** 退出 CLI。

| 别名 | `/quit` |
|------|---------|

**说明：** 退出 Claude Code CLI。在附加的后台会话中，执行此命令仅分离，后台会话继续运行。

---

### `/rename [name]`

**用途：** 重命名当前会话，名称显示在提示栏。

**说明：** 带参时设置指定名称。不带参数时根据对话历史自动生成名称。

**示例：**
```
/rename 修复登录页面bug
```

---

### `/recap`

**用途：** 生成当前会话的一行摘要。

**说明：** 按需生成会话摘要。与离开一段时间后自动生成的摘要不同，此命令立即触发。

---

### `/teleport`

**用途：** 将网页端的 Claude Code 会话拉取到当前终端。

| 别名 | `/tp` |
|------|-------|

**说明：** 打开选择器，拉取网页端的会话分支和历史。需要 claude.ai 订阅。

---

### `/desktop`

**用途：** 在当前会话中继续使用 Claude Code 桌面应用。

| 别名 | `/app` |
|------|--------|
| 平台 | macOS、Windows |

**说明：** 需要 macOS 或 Windows 以及 Claude 订阅。

---

### `/cd <path>`

**用途：** 将会话移动到新的工作目录。（v2.1.169+）

**说明：** 移动会话到新目录。对话的提示缓存被保留：新目录的 `CLAUDE.md` 作为消息追加而非重建系统提示。会话迁移到新目录的项目存储，因此 `--resume` 和 `--continue` 会从新目录找到它。如需仅授予额外目录访问而不移动会话，使用 `/add-dir`。

**示例：**
```
/cd /Users/zhj/Documents/another-project
```

---

### `/add-dir <path>`

**用途：** 为当前会话添加一个可访问的工作目录。

**说明：** 添加一个目录用于文件访问。大多数 `.claude/` 配置不会从添加的目录中发现。之后可以从该目录使用 `--continue` 或 `--resume` 恢复会话。

**示例：**
```
/add-dir /Users/zhj/Documents/shared-lib
```

---

## 三、上下文与记忆类

### `/compact [instructions]`

**用途：** 通过总结对话来释放上下文空间。

| 参数 | `instructions`（可选）：总结的重点方向 |
|------|------|

**说明：** 将当前对话总结压缩，释放上下文窗口空间。可选传入重点说明以控制总结方向。

**示例：**
```
/compact
/compact 重点关注项目的架构决策
```

---

### `/context [all]`

**用途：** 可视化显示当前上下文使用情况的彩色网格。

**参数：** `all`（可选）：展开详细条目

**说明：** 展示上下文占用情况的图形化视图。包含针对上下文密集型工具的优化建议、内存膨胀警告和容量警告。

**示例：**
```
/context
/context all
```

---

### `/memory`

**用途：** 编辑 CLAUDE.md 记忆文件。

**说明：** 打开 CLAUDE.md 内存文件的编辑界面。可启用或禁用自动记忆（Auto-memory），以及查看自动记忆条目。

---

### `/rewind`

**用途：** 将对话和/或代码回滚到之前的状态，或从选定的消息处总结。

| 别名 | `/checkpoint`, `/undo` |
|------|------------------------|

**说明：** 回滚到检查点，或选择对话中的某个消息进行总结。支持回滚代码更改和对话记录。

---

### `/diff`

**用途：** 打开交互式差异查看器。

**说明：** 显示未提交的更改和每次对话回合的差异。使用左右箭头切换 Git diff 和单个 Claude 回合的差异，上下箭头浏览文件。

---

### `/btw <question>`

**用途：** 提出一个不加入对话历史的快速边线问题。

**说明：** 询问一个辅助性问题，不会增加对话上下文的大小。适合快速查询而不影响主任务。

**示例：**
```
/btw 这个函数的复杂度是多少？
```

---

### `/export [filename]`

**用途：** 将当前对话导出为纯文本。

| 参数 | `filename`（可选）：导出文件名 |
|------|------|

**说明：** 带文件名时直接写入文件。不带参时打开对话框，可选择复制到剪贴板或保存到文件。

**示例：**
```
/export conversation.txt
```

---

## 四、模型与性能类

### `/model [model]`

**用途：** 切换 AI 模型并保存为新建会话的默认模型。

**说明：** 不带参数时打开选择器。在选择器中按 `s` 可仅为当前会话切换。切换前会要求确认（如果对话已有历史输出）。确认后立即生效，无需等待当前响应完成。

**示例：**
```
/model
/model claude-opus-4-8
/model claude-sonnet-4-6
```

---

### `/effort [level|auto]`

**用途：** 设置模型的推理努力级别。

| 可选值 | `low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, `auto` |
|--------|------|
| 说明 | 可用级别取决于模型。`max` 和 `ultracode` 仅限会话内使用。`ultracode` 结合了 `xhigh` 推理和自动工作流编排。`auto` 重置为模型默认值 |

**说明：** 不带参数时打开交互式滑动条（左右箭头选择，Enter 确认）。设置后立即生效，无需等待当前响应完成。

**示例：**
```
/effort high
/effort auto
/effort ultracode
```

---

### `/fast [on|off]`

**用途：** 切换快速模式。

**说明：** 开启或关闭快速模式（以更高价格换取更快输出速度）。

**示例：**
```
/fast on
/fast off
```

---

### `/advisor [model|off]`

**用途：** 启用或禁用顾问工具（Advisor Tool）。（v2.1.98+）

| 参数 | `opus`, `sonnet`, `fable`（v2.1.170+），或完整模型 ID。`off` 关闭 |
|------|------|

**说明：** 顾问工具会在任务关键节点咨询第二个模型以获得指导。不带参数时打开选择器。需要 Claude Code v2.1.98 或更高版本。

**示例：**
```
/advisor
/advisor opus
/advisor off
```

---

### `/model` 和 `/effort` 的配合使用

切换模型后，模型支持的 effort 级别可能不同。建议先设模型再调 effort：

```
/model claude-opus-4-8
/effort high
```

---

## 五、代码与开发类

### `/code-review [low|medium|high|xhigh|max|ultra] [--fix] [--comment] [target]`

**类型：** [Skill]（捆绑技能）

**用途：** 审查当前差异（diff）的正确性、可复用性、简化和效率。

| 参数 | 说明 |
|------|------|
| 努力级别 | `low` / `medium` / `high` / `xhigh` / `max` / `ultra` |
| `--fix` | 将审查结果应用到工作树 |
| `--comment` | 以行内 GitHub PR 评论形式发布 |
| `target` | 指定目标 |

**说明：** 审查当前 diff 中的正确性问题以及复用、简化和效率清理。`ultra` 运行深度云端审查。v2.1.154 起，`/simplify` 作为独立的清理审查命令运行（不查找 Bug）。

**示例：**
```
/code-review
/code-review high --fix
/code-review ultra
/code-review --comment
```

---

### `/simplify [target]`

**类型：** [Skill]（捆绑技能）

**用途：** 审查更改的代码，寻找清理机会并应用修复。（v2.1.154+）

**说明：** 四个审查子代理并行运行，覆盖：现有工具复用、简化、效率、抽象层级。不查找正确性 Bug（请使用 `/code-review`）。传递路径或 PR 引用以审查特定目标。

**示例：**
```
/simplify
/simplify src/utils.ts
```

---

### `/security-review`

**用途：** 分析当前分支的待处理更改，寻找安全漏洞。

**说明：** 审查 git diff，识别注入、认证问题、数据暴露等风险。

---

### `/review [PR]`

**用途：** 审查 GitHub Pull Request。

| 参数 | `PR`（可选）：PR 编号 |
|------|------|

**说明：** 按编号审查 GitHub PR。使用与 `/code-review` 相同的审查引擎。不带参数时列出可选的 PR。如需云端审查，参见 `/code-review ultra`。

**示例：**
```
/review
/review 42
```

---

### `/diff`

**用途：** 打开交互式差异查看器。（详见第3节）

---

### `/init`

**用途：** 为项目初始化 CLAUDE.md 指南。

**说明：** 生成初始 `CLAUDE.md` 文件。设置 `CLAUDE_CODE_NEW_INIT=1` 可启动交互式流程，同时配置技能、钩子和个人记忆文件。

**示例：**
```
/init
```

---

### `/verify`

**类型：** [Skill]（捆绑技能）

**用途：** 确认代码更改按预期工作。（v2.1.145+）

**说明：** 通过构建项目应用、运行并观察结果来验证代码变更，而非仅依赖测试或类型检查。需要 Claude Code v2.1.145 或更高版本。

---

### `/run`

**类型：** [Skill]（捆绑技能）

**用途：** 启动并驱动项目应用以查看更改效果。（v2.1.145+）

**说明：** 在运行的应用中查看变更效果，而不仅仅通过测试。需要 Claude Code v2.1.145 或更高版本。

---

### `/run-skill-generator`

**类型：** [Skill]（捆绑技能）

**用途：** 教授 `/run` 和 `/verify` 如何从干净环境构建、启动和驱动项目应用。（v2.1.145+）

**说明：** 记录应用的构建、启动和运行方案，保存为项目级技能。需要 Claude Code v2.1.145 或更高版本。

---

### `/batch <instruction>`

**类型：** [Skill]（捆绑技能）

**用途：** 在代码库中并行编排大规模更改。

**说明：** 研究代码库，将工作分解为 5 到 30 个独立单元并呈现计划。批准后，每个单元在隔离的 git 工作树中启动一个后台子代理，各自实现、测试并创建 PR。需要 git 仓库。

**示例：**
```
/batch 将 src/ 从 Solid 迁移到 React
/batch 为所有 API 端点添加日志记录
```

---

### `/autofix-pr [prompt]`

**用途：** 启动一个云端会话，监听当前分支的 PR，当 CI 失败或审阅者留下评论时推送修复。

**说明：** 自动检测当前分支的 PR。默认指示云端会话修复所有 CI 失败和审查评论。传入自定义提示可改变行为。需要 `gh` CLI 和 Claude Code on the web 访问权限。

**示例：**
```
/autofix-pr
/autofix-pr 只修复lint和类型错误
```

---

## 六、项目管理与配置类

### `/config [key=value ...]`

**用途：** 打开设置界面，调整主题、模型、输出风格和其他偏好。

| 别名 | `/settings` |
|------|-------------|

**说明：** v2.1.181+ 支持直接传参：`/config thinking=false`。v2.1.182+ 支持简写键：`/config theme=dark`。`key=value` 形式也适用于非交互模式（`-p`）和远程控制。运行 `/config --help` 查看所有可设置键及其选项。

**示例：**
```
/config
/config theme=dark
/config model=sonnet
/config thinking=false
```

---

### `/status`

**用途：** 打开设置界面的状态标签页。

**说明：** 显示版本、模型、账户和连接状态。可在 Claude 响应时运行，无需等待当前响应完成。

---

### `/stats`

**用途：** `/usage` 的别名，直接打开统计标签页。

---

### `/cost`

**用途：** `/usage` 的别名，显示会话花费。

---

### `/usage`

**用途：** 显示对话成本、计划使用限制和活动统计。

| 别名 | `/cost`, `/stats` |
|------|-------------------|

**说明：** 在 Pro、Max、Team 和 Enterprise 计划上，包含按技能、子代理、插件和 MCP 服务器的使用分解。详细参见[成本追踪指南](https://code.claude.com/docs/en/costs)。

---

### `/usage-credits`

**用途：** 配置使用积分以在达到限制时继续工作。

| 曾用名 | `/extra-usage` |
|--------|----------------|

---

### `/theme`

**用途：** 更改颜色主题。

**说明：** 包含 `auto` 选项（匹配终端明暗背景）、亮/暗变体、色盲友好（daltonized）主题、ANSI主题（使用终端调色板）以及自定义主题。选择 **New custom theme…** 可创建新主题。

**示例：**
```
/theme
/theme dark
/theme auto
```

---

### `/color [color|default]`

**用途：** 设置当前会话的提示栏颜色。

| 可选颜色 | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
|---------|------|

**说明：** 使用 `default` 重置。不带参数时随机选择颜色。与远程控制连接时，颜色同步到 claude.ai/code。

**示例：**
```
/color blue
/color default
```

---

### `/tui [default|fullscreen]`

**用途：** 设置终端 UI 渲染器并重新启动。

| 参数 | `default`：普通模式 / `fullscreen`：无闪烁全屏模式 |
|------|------|

**说明：** 不带参时显示当前使用中的渲染器。

**示例：**
```
/tui fullscreen
/tui default
```

---

### `/scroll-speed`

**用途：** 交互式调整鼠标滚轮滚动速度。

**说明：** 在全屏渲染器中使用。打开时有一个标尺，可边滚动预览边调整。不支持 JetBrains IDE 终端。

---

### `/focus`

**用途：** 切换焦点视图。

**说明：** 仅显示最后一条提示、一行工具调用摘要（含编辑 diffstat）和最终响应。选择在会话间持久化。仅全屏渲染时可用。

---

### `/statusline`

**用途：** 配置 Claude Code 的状态行。

**说明：** 描述你想要的配置，或直接运行以从 shell 提示自动配置。

**示例：**
```
/statusline 显示当前分支和模型
```

---

### `/hooks`

**用途：** 查看工具事件的钩子配置。

---

### `/keybindings`

**用途：** 打开键盘快捷键配置文件。

**说明：** 编辑 `~/.claude/keybindings.json` 自定义快捷键绑定。

---

### `/plugin [subcommand]`

**用途：** 管理 Claude Code 插件。

| 子命令 | `list`、`install`、`enable`、`disable` |
|--------|------|

**说明：** 不带参时打开插件菜单。传子命令时直接操作。

**示例：**
```
/plugin list
/plugin install some-plugin
```

---

### `/reload-plugins [--force]`

**用途：** 重新加载所有活动插件以应用待处理更改，无需重启。

**说明：** 报告每个重载组件的计数并标记加载错误。当重载会更改 MCP 工具集并使提示缓存失效时，除非传递 `--force`，否则会警告并跳过。

---

### `/skills`

**用途：** 列出所有可用技能。

**说明：** 按 `t` 键按 Token 数排序。按 `Space` 键可从 Claude 或 `/` 菜单中隐藏技能，按 `Enter` 保存。

---

### `/reload-skills`

**用途：** 重新扫描技能和命令目录。（v2.1.152+）

**说明：** 使会话期间在磁盘上添加或更改的技能可用，无需重启。报告可用技能数以及新增和移除的技能数。

---

### `/mcp [reconnect <server>|enable|disable [<server>|all]]`

**用途：** 管理 MCP 服务器连接和 OAuth 认证。

**说明：** 不带参时打开交互式列表。`reconnect <server>` 重新连接一个断开的服务器。`enable`/`disable` 加服务器名或 `all` 可更改连接状态。

**示例：**
```
/mcp
/mcp reconnect github
/mcp disable all
/mcp enable github
```

---

### `/permissions`

**用途：** 管理工具权限的允许、询问和拒绝规则。

| 别名 | `/allowed-tools` |
|------|------------------|

**说明：** 打开交互式对话框，可查看按作用域划分的规则、添加或移除规则、管理工作目录以及查看最近的自动模式拒绝记录。

---

### `/agents`

**用途：** 管理子代理配置。

**说明：** 打开子代理管理器，Claude 可将子任务委托给这些代理。

---

### `/tasks`

**用途：** 查看和管理所有在后台运行的任务。

| 别名 | `/bashes` |
|------|-----------|

**说明：** 列出当前会话的所有后台活动及其状态。

---

### `/sandbox`

**用途：** 切换沙盒模式。

**说明：** 在支持的平台上启用/禁用沙盒模式。

---

### `/workflows`

**用途：** 打开工作流进度视图。

**说明：** 查看、暂停、恢复或保存运行中/已完成的工作流。

---

### `/remote-env`

**用途：** 选择云端代理的默认环境。

---

### `/web-setup`

**用途：** 使用本地 `gh` CLI 凭据将 GitHub 账户连接到 Claude Code on the web。

**说明：** `/schedule` 会在 GitHub 未连接时自动提示此设置。

---

### `/setup-bedrock`

**用途：** 通过交互式向导配置 Amazon Bedrock。

**说明：** 仅在设置 `CLAUDE_CODE_USE_BEDROCK=1` 时可见。

---

### `/setup-vertex`

**用途：** 通过交互式向导配置 Google Vertex AI。

**说明：** 仅在设置 `CLAUDE_CODE_USE_VERTEX=1` 时可见。

---

### `/chrome`

**用途：** 配置 Claude in Chrome 设置。

---

### `/release-notes`

**用途：** 在交互式版本选择器中查看更新日志。

**说明：** 选择特定版本查看发行说明，或直接查看所有版本。

---

### `/powerup`

**用途：** 通过带动画演示的快速交互式教程发现 Claude Code 功能。

---

### `/terminal-setup`

**用途：** 配置终端快捷键。

**说明：** 仅在需要它的终端中可见（如 VS Code、Cursor、Alacritty、Zed 等）。

---

### `/heapdump`

**用途：** 写入 JavaScript 堆快照和内存分析到桌面目录。

**说明：** 用于诊断高内存使用问题。

---

## 七、账户与权限类

### `/login`

**用途：** 登录 Anthropic 账户。

**说明：** 用于切换账户（Pro、Max、API Console 账户等）。

---

### `/logout`

**用途：** 退出 Anthropic 账户。

---

### `/upgrade`

**用途：** 打开升级页面切换更高计划。

---

### `/privacy-settings`

**用途：** 查看和更新隐私设置。

**说明：** 仅对 Pro 和 Max 计划订阅者可用。

---

### `/fewer-permission-prompts`

**类型：** [Skill]（捆绑技能）

**用途：** 扫描历史记录中的常见只读 Bash 和 MCP 工具调用，将优先允许列表添加到 `.claude/settings.json` 以减少权限提示。

---

## 八、通信与分享类

### `/feedback [report]`

**用途：** 提交反馈、报告 Bug 或分享对话。

| 别名 | `/bug`, `/share` |
|------|------------------|

**示例：**
```
/feedback
/feedback 我在解析YAML时遇到了问题
```

---

### `/team-onboarding`

**用途：** 从 Claude Code 使用历史生成团队入职指南。

**说明：** 分析过去 30 天的会话、命令和 MCP 服务器使用情况，生成一个 Markdown 指南。支持 Pro、Max、Team 和 Enterprise 计划。

---

### `/insights`

**用途：** 生成 Claude Code 会话分析报告。

**说明：** 涵盖项目领域、交互模式和改进点。

---

### `/install-github-app`

**用途：** 为仓库安装 Claude GitHub App。

**说明：** 可选步骤：设置 GitHub Actions 工作流和密钥。引导选择仓库和配置集成。

---

### `/install-slack-app`

**用途：** 安装 Claude Slack App。

**说明：** 打开浏览器完成 OAuth 流程。

---

### `/mobile`

**用途：** 显示下载 Claude 移动应用的二维码。

| 别名 | `/ios`, `/android` |
|------|---------------------|

---

### `/passes`

**用途：** 向朋友分享免费一周的 Claude Code。

**说明：** 仅在账户有资格时显示。

---

### `/stickers`

**用途：** 订购 Claude Code 贴纸。

---

### `/radio`

**用途：** 在浏览器中打开 Claude FM 放松音乐电台。

**说明：** 无浏览器可用时打印流 URL。不适用于 Bedrock、Vertex 或 Foundry。

---

## 九、工作流与自动化类

### `/goal [condition|clear]`

**用途：** 设定一个目标：Claude 会持续工作直至条件满足。

| 参数 | `condition`：目标条件描述 / `clear`（或 `stop`, `off`, `reset`, `none`, `cancel`）：提前取消目标 |
|------|------|

**说明：** 不带参时显示当前或最近完成的目标。

**示例：**
```
/goal 所有测试通过且无回归
/goal clear
```

---

### `/schedule [description]`

**用途：** 创建、更新、列出或运行例行任务。

| 别名 | `/routines` |
|------|-------------|

**说明：** 在 Anthropic 管理的云基础设施上执行。Claude 以对话方式引导完成设置。

**示例：**
```
/schedule 每天早上9点检查部署状态
```

---

### `/loop [interval] [prompt]`

**类型：** [Skill]（捆绑技能）

**用途：** 在会话保持期间重复运行一个提示。

**说明：** 省略间隔时，Claude 自定节奏。省略提示时运行自主维护检查或 `.claude/loop.md` 中的提示。

**示例：**
```
/loop 5m 检查部署是否完成
/loop 持续监控错误日志
```

---

### `/ultraplan <prompt>`

**用途：** 在 ultraplan 会话中起草计划，在浏览器中审阅，然后远程执行或发送回终端。

**示例：**
```
/ultraplan 设计一个多租户数据库架构
```

---

## 十、子代理与并行类

### `/tasks`

（详见第6节）列出所有后台运行的任务。

---

### `/agents`

（详见第6节）管理子代理配置。

---

### `/background [prompt]`

（详见第2节）将当前会话转为后台运行。

---

### `/batch <instruction>`

（详见第5节）大规模并行代码库更改。

---

### `/fork <directive>`

（详见第2节）创建继承完整对话的子代理。

---

## 十一、杂项工具类

### `/help`

**用途：** 显示帮助信息和可用命令。

---

### `/doctor`

**用途：** 诊断和验证 Claude Code 安装和设置。

**说明：** 各项结果以状态图标显示。按 `f` 键让 Claude 修复报告的问题。

---

### `/debug [description]`

**类型：** [Skill]（捆绑技能）

**用途：** 为当前会话启用调试日志以排查问题。

**说明：** 调试日志默认关闭（除非以 `claude --debug` 启动）。运行时从该时刻开始捕获日志。可选描述问题以聚焦分析。

**示例：**
```
/debug
/debug MCP服务器连接失败
```

---

### `/copy [N]`

**用途：** 将上一个助手响应复制到剪贴板。

| 参数 | `N`（可选）：复制第 N 条最近的响应。`/copy 2` 复制倒数第二条 |
|------|------|

**说明：** 有代码块时，显示交互式选择器，可选择单个代码块或完整响应。在选择器中按 `w` 将选择内容写入文件（适用于 SSH 环境）。

---

### `/vim`

**用途：** 曾是切换 Vim 编辑模式的命令。v2.1.92 已移除。

**说明：** 要切换 Vim 和普通编辑模式，请使用 `/config` → Editor mode。

---

## 十二、技能集成类（Bundled Skills）

以下命令是基于提示的捆绑技能。与普通内置命令不同，它们由 Claude 使用工具编排执行。

### `/code-review`

详见第5节。审查代码差异的正确性和质量。

### `/simplify`

详见第5节。审查并应用代码清理。

### `/batch <instruction>`

详见第5节。并行编排大规模代码更改。

### `/run`

详见第5节。启动项目应用以验证更改。

### `/verify`

详见第5节。构建并运行项目以验证更改。

### `/run-skill-generator`

详见第5节。为 `/run` 和 `/verify` 编写启动技能。

### `/debug [description]`

详见第11节。启用调试日志诊断问题。

### `/loop [interval] [prompt]`

详见第9节。循环执行提示任务。

### `/claude-api [migrate|managed-agents-onboard]`

**用途：** 加载 Claude API 参考文档。

**说明：** 加载项目语言的 Claude API 参考（Python、TypeScript、Java、Go、Ruby、C#、PHP 或 cURL）。覆盖工具使用、流式传输、批量处理、结构化输出等。当代码导入 `anthropic` 或 `@anthropic-ai/sdk` 时自动激活。

**子命令：**
- `migrate`：将现有 Claude API 代码升级到更新模型
- `managed-agents-onboard`：交互式创建 Managed Agent

**示例：**
```
/claude-api
/claude-api migrate
/claude-api managed-agents-onboard
```

### `/fewer-permission-prompts`

详见第7节。扫描命令以减少权限提示。

---

## 十三、工作流集成类（Bundled Workflows）

### `/deep-research <question>`

**类型：** [Workflow]（捆绑工作流）

**用途：** 对一个问题进行广度搜索，获取和交叉验证来源，综合生成一份带引用的报告。

**说明：** 在多个子代理之间分发搜索、获取和验证任务，并在后台运行。

**示例：**
```
/deep-research 量子计算在金融领域的应用现状
```

---

## 十四、MCP 命令集成

MCP 服务器可以暴露提示作为命令。这些使用 `/mcp__<server>__<prompt>` 格式，从连接的服务器动态发现。

**示例：**
```
/mcp__github__create_issue
/mcp__slack__send_message
```

具体可用命令取决于连接的 MCP 服务器。

---

## 十五、自定义命令（技能）

### 15.1 创建自定义命令

在 `.claude/skills/<skill-name>/SKILL.md` 或 `.claude/commands/<name>.md` 中创建文件即可定义自定义命令。

### 15.2 目录命名规则

| 位置 | 命令名来源 | 示例 |
|------|-----------|------|
| `~/.claude/skills/<name>/SKILL.md` | 目录名 | `deploy-staging` → `/deploy-staging` |
| `.claude/skills/<name>/SKILL.md` | 目录名 | `code-review-local` → `/code-review-local` |
| `.claude/commands/<name>.md` | 文件名（不含扩展名） | `deploy.md` → `/deploy` |
| 插件 `skills/` 子目录 | 目录名，以插件命名空间 | `review` → `/my-plugin:review` |

### 15.3 自定义技能的基本结构

```yaml
---
name: my-skill
description: 描述技能功能和适用场景
disable-model-invocation: true  # 设为true则仅用户可调用
user-invocable: true            # 设为false则仅Claude可调用
allowed-tools: Bash Grep        # 预授权的工具列表
context: fork                   # 设为fork则在子代理中运行
agent: Explore                  # 子代理类型
---

## 技能指令

在这里写下技能的具体指令...

$ARGUMENTS
```

### 15.4 预定义变量

| 变量 | 说明 |
|------|------|
| `$ARGUMENTS` | 所有传入的参数 |
| `$0`, `$1`, `$2`... | 按位置获取参数 |
| `${CLAUDE_SESSION_ID}` | 当前会话 ID |
| `${CLAUDE_EFFORT}` | 当前努力级别 |
| `${CLAUDE_SKILL_DIR}` | 技能文件所在目录 |

### 15.5 动态上下文注入

使用 `` !`command` `` 语法在技能内容发送给 Claude 之前执行 shell 命令并将输出替换进去：

```yaml
---
name: pr-summary
description: 总结Pull Request的变更
---

## PR 上下文
- PR diff: !`gh pr diff`
- Changed files: !`gh pr diff --name-only`
```

对于多行命令，使用 ` ```! ` 代码块：

````yaml
## 环境信息
```!
node --version
git status --short
```
````

---

## 附录

### A. 命令快速参考表

| 分类 | 命令 | 简要说明 |
|------|------|---------|
| **会话管理** | `/clear` | 开始新对话 |
| | `/resume` | 恢复对话 |
| | `/branch` | 创建对话分支 |
| | `/fork` | 创建子代理分支 |
| | `/background` | 转后台运行 |
| | `/stop` | 停止后台会话 |
| | `/exit` | 退出 CLI |
| | `/rename` | 重命名会话 |
| | `/recap` | 生成摘要 |
| | `/teleport` | 拉取网页端会话 |
| | `/desktop` | 切换到桌面应用 |
| | `/cd` | 切换工作目录 |
| | `/add-dir` | 添加工作目录 |
| **上下文/记忆** | `/compact` | 压缩上下文 |
| | `/context` | 查看上下文 |
| | `/memory` | 编辑记忆文件 |
| | `/rewind` | 回滚更改 |
| | `/diff` | 查看差异 |
| | `/btw` | 边线问题 |
| | `/export` | 导出对话 |
| **模型/性能** | `/model` | 切换模型 |
| | `/effort` | 调整努力级别 |
| | `/fast` | 切换快速模式 |
| | `/advisor` | 启用顾问工具 |
| **代码/开发** | `/code-review` | 代码审查 [Skill] |
| | `/simplify` | 代码简化 [Skill] |
| | `/security-review` | 安全审查 |
| | `/review` | PR 审查 |
| | `/init` | 项目初始化 |
| | `/verify` | 验证更改 [Skill] |
| | `/run` | 运行应用 [Skill] |
| | `/batch` | 批量更改 [Skill] |
| | `/autofix-pr` | 自动修复 PR |
| **项目/配置** | `/config` | 打开设置 |
| | `/status` | 状态信息 |
| | `/usage` | 使用统计 |
| | `/theme` | 切换主题 |
| | `/color` | 设置颜色 |
| | `/tui` | UI 渲染器 |
| | `/hooks` | 钩子配置 |
| | `/keybindings` | 快捷键绑定 |
| | `/plugin` | 插件管理 |
| | `/skills` | 技能列表 |
| | `/mcp` | MCP 管理 |
| | `/permissions` | 权限管理 |
| | `/agents` | 子代理管理 |
| | `/tasks` | 任务管理 |
| | `/workflows` | 工作流视图 |
| **账户/权限** | `/login` | 登录 |
| | `/logout` | 退出 |
| | `/upgrade` | 升级计划 |
| **通信/分享** | `/feedback` | 提交反馈 |
| | `/team-onboarding` | 团队入职 |
| | `/insights` | 使用分析 |
| | `/mobile` | 移动端下载 |
| **工作流/自动化** | `/goal` | 设定目标 |
| | `/schedule` | 例行任务 |
| | `/loop` | 循环执行 [Skill] |
| | `/ultraplan` | 高级计划 |
| **研究** | `/deep-research` | 深度研究 [Workflow] |
| **其他** | `/help` | 帮助信息 |
| | `/doctor` | 诊断问题 |
| | `/debug` | 调试日志 [Skill] |
| | `/copy` | 复制响应 |
| | `/claude-api` | API 参考 [Skill] |

### B. 版本标注说明

| 标记 | 含义 |
|------|------|
| `{/* min-version: 2.1.N */}` | 需要指定最低版本 |
| `{/* max-version: 2.1.N */}` | 在此版本或之后已移除/更改 |
| `[Skill]` | 捆绑技能 |
| `[Workflow]` | 捆绑工作流 |

### C. 参考来源

本文档基于 Claude Code 官方文档整理，详细信息请参阅：
- [Claude Code Commands Reference](https://code.claude.com/docs/en/commands)
- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Claude API Skill](https://code.claude.com/docs/en/claude-api)
- [Managed Agents]

---

> **说明：** 并非所有命令对每个用户都可见。可用性取决于平台、计划和环境。例如 `/desktop` 仅在 macOS 和 Windows 上显示，`/upgrade` 仅在 Pro 和 Max 计划上显示。