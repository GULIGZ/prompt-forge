# AI 技能调用指南

> 本文档说明如何在 Claude Code 中调用技能（Skills），涵盖项目中的两套技能系统及其调用方式。

---

## 什么是 Skill

**Skill** 是 Claude Code 的扩展指令集，是一组预定义的工作流程和专业能力。通过调用 Skill，可以让 Claude 按照特定的方式执行任务，而不需要每次从零开始描述。

Skill 通常包含：
- **SKILL.md** — 技能定义文件（指令、工作流程、规则）
- **可选的驱动脚本/工具** — 实现具体功能的代码

---

## 项目中的两套技能系统

当前项目中存在两套独立的技能系统：

| 系统 | 路径 | 特点 | 触发方式 |
|------|------|------|----------|
| **原生系统** | `.claude/skills/` | Claude Code 官方支持，支持自动匹配 | 手动 + 自动 |
| **Matt Pocock 系统** | `.agents/skills/` | 工程工作流专用，仅手动触发 | 仅手动 |

---

## 系统一：`.agents/skills/`（工程工作流）

这是项目中已有的 **17 个 engineering skills**，用于软件工程的全流程管理。

### 特点

- **仅手动触发**：所有技能都标记了 `disable-model-invocation: true`
- **状态驱动**：通过 `CONTEXT.md`、ADR 等文件在会话间保持状态
- **结构化流程**：每个技能定义了明确的步骤和完成标准

### 调用方式

直接在对话中输入斜杠命令：

```
/ask-matt
/grill-with-docs
/tdd
/diagnosing-bugs
...
```

输入后，Claude 会加载对应目录下的 `SKILL.md`，按照其中的指令执行。

### 可用技能清单

| 技能命令 | 功能 | 使用场景 |
|----------|------|----------|
| `/ask-matt` | 技能路由器，推荐该用哪个技能 | 不确定用哪个时 |
| `/setup-matt-pocock-skills` | 首次配置项目 | 第一次使用前 |
| `/grill-with-docs` | 有代码库的需求追问+文档生成 | 梳理需求 |
| `/grill-me` | 无代码库的需求追问 | 无代码库时讨论 |
| `/grilling` | 核心追问引擎 | 深入讨论设计 |
| `/prototype` | 快速原型验证 | 验证设计可行性 |
| `/handoff` | 会话交接 | 当前会话要结束时 |
| `/to-prd` | 生成产品需求文档 | 讨论结束，出文档 |
| `/to-issues` | 拆分为垂直切片任务 | 开始开发前 |
| `/improve-codebase-architecture` | 架构体检 | 代码库维护 |
| `/codebase-design` | 模块设计词汇表 | 设计接口时 |
| `/domain-modeling` | 领域建模 | 定义术语 |
| `/triage` | 工单分拣 | 处理 issue/PR |
| `/tdd` | 测试驱动开发 | 写代码/修 bug |
| `/diagnosing-bugs` | 硬核调试 | 排查 bug |
| `/teach` | 教学工作区 | 学习新概念 |
| `/writing-great-skills` | 写技能的参考手册 | 编写 skill |

### 完整工作流示例

```
/setup-matt-pocock-skills     ← 首次配置（只需一次）
        │
        ▼
/grill-with-docs              ← 梳理需求
        │
        ▼
/prototype（可选）            ← 验证关键设计
        │
        ▼
/to-prd                       ← 生成 PRD
        │
        ▼
/to-issues                    ← 拆成任务
        │
        ▼
  逐个开发（配合 /tdd）       ← 实现
```

---

## 系统二：`.claude/skills/`（Claude Code 原生）

这是 Claude Code 官方支持的技能系统，支持**自动触发**。

### 特点

- **手动 + 自动**：可以说技能名称调用，也可以让 Claude 根据上下文自动匹配
- **description 驱动**：`SKILL.md` 中的 `description` 是自动匹配的关键
- **灵活部署**：可以放在项目内（`.claude/skills/`）或用户目录（`~/.claude/skills/`）

### 调用方式

#### 方式一：直接输入斜杠命令

```
/run-prompt-forge
/screenshot-prompt-forge
```

#### 方式二：自然语言触发（自动匹配）

Claude 会扫描所有可用技能的 `description`，匹配到你话语中的关键词时自动加载：

| 你说 | Claude 匹配 | 加载的技能 |
|------|-------------|-----------|
| "截图看看 PromptForge" | "screenshot" + "PromptForge" | `run-prompt-forge` |
| "运行 PromptForge" | "run" + "PromptForge" | `run-prompt-forge` |
| "启动 PromptForge" | "launch" + "PromptForge" | `run-prompt-forge` |

#### 方式三：通过 Agent 工具调用（代码中）

在 Workflow 或其他自动化脚本中：

```javascript
Skill({ skill: "run-prompt-forge", args: "screenshot" })
```

### 当前状态

当前 `.claude/skills/` 目录为空（之前创建的 `run-prompt-forge` 已删除）。

如需创建新的原生技能，在 `.claude/skills/<skill-name>/SKILL.md` 中定义即可。

---

## 两套系统的核心区别

| 对比项 | `.agents/skills/` | `.claude/skills/` |
|--------|-------------------|-------------------|
| **发现方式** | 用户必须记住名字 | Claude 自动扫描 description |
| **触发方式** | 仅手动 `/command` | 手动 + 自动匹配 |
| **状态管理** | 文件驱动（CONTEXT.md、ADR） | 通常无状态或单次执行 |
| **适用场景** | 复杂工程工作流 | 快速任务、工具调用 |
| **学习成本** | 高（需了解工作流） | 低（自然语言即可） |
| **上下文占用** | 用户调用型 = 零负担 | 模型调用型 = 每轮加载 |

---

## 如何选择

### 使用 `.agents/skills/` 当：
- 你在进行**严肃的软件工程工作**
- 需要**跨 session 保持状态**（讨论 → PRD → Issues → 实现）
- 需要**结构化流程**（有明确的步骤和完成标准）
- 你愿意**学习工作流**以换取更高的工程效率

### 使用 `.claude/skills/` 当：
- 你想**快速执行某个任务**（截图、启动服务器、格式化代码）
- 你希望**自然语言触发**，不用记命令
- 任务是**一次性的**，不需要状态保持
- 你想让其他**普通用户**也能轻松使用

---

## 最佳实践

### 1. 先用 `/ask-matt` 问路

不确定该用哪个技能时，先问路由器：

```
/ask-matt
```

描述你的情况，它会推荐流程。

### 2. 尽量在一个 session 内完成主流程

 grilling → PRD → issues 尽量在一个会话内完成，不要 compact/clear 中途打断。

### 3. 跨 session 用 `/handoff`

如果必须结束当前会话，用 `/handoff` 生成交接文档，新 session 可以无缝继续。

### 4. 原生技能保持简洁

`.claude/skills/` 下的技能应该：
- 功能单一明确
- description 包含丰富的触发关键词
- 不依赖复杂的跨会话状态

---

## 故障排除

| 问题 | 原因 | 解决 |
|------|------|------|
| `/xxx` 命令没反应 | 技能名拼错或不存在 | 检查 `.agents/skills/` 或 `.claude/skills/` 目录 |
| Claude 没自动加载技能 | description 不匹配 | 修改 `SKILL.md` 的 description，增加触发词 |
| 技能执行到一半断了 | session 上下文满了 | 用 `/handoff` 交接，开新 session |
| 状态没保留 | 没用文件驱动 | `.agents/` 的技能会自动写文件，检查是否正确生成 |

---

## 参考文档

- [`.agents/skills` 使用指南](.agents-skills-指南.md) — 17 个 engineering skills 的详细说明
- [Claude Code 官方文档](https://docs.anthropic.com/en/docs/claude-code/skills) — 原生技能系统文档
- [Matt Pocock 的 AI 工程方法论](https://www.aihero.dev/) — `.agents/skills` 的设计哲学

---

*文档生成时间：2026-06-19*
