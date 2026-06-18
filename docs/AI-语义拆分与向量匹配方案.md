# AI 语义拆分与向量匹配技术方案

## 概述

PromptForge 提供两套提示词拆解方式：

| 方式 | 触发 | 原理 |
|------|------|------|
| **规则拆分** | 点击「规则拆分」按钮 | 按自定义分隔符（逗号/空格/分号等）机械切分文本 |
| **AI 语义拆分** | 点击「AI 语义拆分」按钮 | 调用 LLM（如 GPT-4o）做语义理解，逐标签拆分并归属大类 |

拆分后自动执行两阶段匹配（规则匹配 → 可选向量匹配），结果以不同颜色标识，支持一键入库。

---

## 一、规则拆分 (`splitPrompt` → `doParse`)

### 流程

```
用户输入文本 → 按分隔符正则切分 → 去重 → 映射为 _parseAtoms → 逐 atom 规则匹配 → 渲染
```

### 分隔符机制

- 默认：中文逗号 `，`、英文逗号 `,`、空格（始终生效）
- 用户可通过齿轮按钮自定义额外分隔符（每行一个，如 `;`、`/`）
- 存储于 localStorage key `promptForge.splitDelimiters`
- 分隔符被转义后拼入正则字符组 `[...]+`，一次 split 完成

### 代码位置

```
app.js:1504  openSplitSettings()        — 打开设置弹窗
app.js:1511  saveSplitRules()          — 保存自定义分隔符
app.js:1520  splitPrompt(text, delimiters) — 核心切分函数
app.js:1528  doParse()                 — 入口（绑定在 btn-rule-parse）
```

---

## 二、AI 语义拆分 (`doAIParse`)

### 完整流程

```
用户点击「AI 语义拆分」
  │
  ├─ 1. 取消 pending 的规则拆分 debounce（防冲突）
  │
  ├─ 2. 构造 system prompt：
  │    ├─ 动态获取当前所有大类名（categories 中 parentId==null 且非 fixed）
  │    └─ 要求 LLM 返回 JSON：{ tags: [{ cn, en, category }] }
  │
  ├─ 3. 调用 callOpenAI() → POST {baseURL}/chat/completions
  │
  ├─ 4. 解析 LLM 响应：
  │    ├─ 优先 JSON.parse()
  │    ├─ 失败则提取 markdown ```json``` 代码块
  │    └─ 再失败则贪婪匹配最外层 {...}
  │
  ├─ 5. 补大类 id（_bigId）：
  │    └─ 按 LLM 返回的 category 名称从 categories 中查找对应 id
  │       └─ 未匹配 → UNCAT_ID（-2）
  │
  ├─ 6. 规则匹配：逐 atom 在本地词库中查 EXACT / CONTAINS
  │
  ├─ 7. 自动向量匹配（静默，失败不阻断）：
  │    ├─ 检查当前 API 服务商是否支持 embedding
  │    ├─ 同步 embedding 缓存（补算缺失项）
  │    └─ 对非 EXACT atom 算余弦相似度，≥0.75 标 SIMILAR
  │
  └─ 8. 渲染结果
```

### 关键设计

**system prompt 动态生成：** 大类名来源于 `categories` 中所有 `parentId == null` 的分类（排除 fixed 如收藏），因此用户新增/改名/删除大类后自动生效：

```js
const catNames = categories.filter(c => c.parentId == null && !c.fixed).map(c => c.name).join("、");
// → "category 必须是以下之一：主体、场景、镜头、风格、光影、细节、画质"
```

**JSON 解析容错：** 三层降级策略应对 LLM 可能输出的各种格式——干净 JSON、包裹在 Markdown 代码块中、或被额外文本包围。

**debounce 冲突防护：** AI 拆分是异步操作，同时输入框也可能触发规则拆分（前版本有 oninput debounce），通过 `window._cancelParseDebounce()` 取消 pending 的规则拆分。

### 代码位置

```
app.js:1538  callOpenAI(messages, opts) — 通用的 API 调用层
app.js:1605  doAIParse()              — AI 拆分入口
```

---

## 三、匹配体系

拆分后的每个标签（atom）的 `match` 对象决定它在结果区的颜色和状态。

```
match = {
  status: "EXACT" | "CONTAINS" | "SIMILAR" | "NEW",
  matched: tag | null,           // EXACT 命中的具体标签对象
  candidates: tag[],             // 候选列表
  sim: number | undefined,       // 余弦相似度分值（仅 SIMILAR）
}
```

| 状态 | 颜色 | 条件 | 含义 |
|------|------|------|------|
| `EXACT` | 🟢 绿色 | cn 或 en 任一字段与词库标签**完全相等**（跨语言匹配） | 已存在 |
| `CONTAINS` | 🟠 橙色 | 与词库标签**互为子串**（双向包含） | 近似 |
| `SIMILAR` | 🔵 蓝色 | 余弦相似度 ≥ 0.75 | 语义相似 |
| `NEW` | 🔴 红色 | 以上皆不满足 | 新词 |

### 3.1 规则匹配 (`matchAtom`)

```
matchAtom(atom, tags) → { status, matched, candidates }
```

- **标准归一化：** cn/en 均转小写 + trim
- **EXACT 判定：** 一个标签的 cn 等于另一个的 cn 或 en（跨语言）
- **CONTAINS 判定：** 检查 cn/en 四个交叉组合（cn↔cn、en↔en、cn↔en、en↔cn），任一方向包含即匹配

### 3.2 向量匹配 (`callEmbedding` → `cosineSim`)

**支持的 embedding 模型：**

| 服务商 | Embedding 模型 |
|--------|---------------|
| OpenAI | `text-embedding-3-small` |
| 硅基流动 | `BAAI/bge-m3` |
| 阿里云百炼 | `text-embedding-v3` |
| 智谱 AI | `embedding-3` |
| OpenRouter | `openai/text-embedding-3-small` |

**匹配流程：**

```
1. syncEmbeddingCache()
   └─ 清理已删除标签的向量
   └─ 为缺失向量标签批量调用 callEmbedding() 补算
   └─ 存储到 embCache（localStorage key: promptForge.embeddings）
   
2. 对每个待匹配 atom：
   └─ 调 callEmbedding() 获取其向量
   └─ 与 embCache 中所有标签向量逐一计算余弦相似度
   └─ 取 top-1 ≥ 阈值(0.75) → 标记 SIMILAR
   └─ 取 top-5 作为候选人列表
```

**余弦相似度阈值：** `EMB_THRESHOLD = 0.75`

**缓存策略：**

- `embCache` 以 `{ tagId: vector[] }` 形式存储在 `promptForge.embeddings` 
- 标签被编辑或删除时调用 `invalidateEmbedding(tagId)` 清除对应缓存
- `syncEmbeddingCache()` 在每次向量匹配前同步，保证缓存与当前 tags 一致

### 代码位置

```
app.js:1688  matchAtom(atom, library)           — 规则匹配
app.js:1757  cosineSim(a, b)                    — 余弦相似度
app.js:1775  callEmbedding(texts)               — 调用 embedding API
app.js:1800  syncEmbeddingCache()               — 同步向量缓存
app.js:1813  invalidateEmbedding(tagId)         — 清除单标签缓存
app.js:1818  doAIMatch()                        — 手动触发向量匹配
```

---

## 四、渲染与交互

### 4.1 结果渲染 (`renderParseResult`)

```
_parseAtoms → 统计计数 → 生成卡片（着色 + 大类徽标 + 相似度%）→ 批次条
```

- **着色：** 卡片 class 设为 `exact`/`contains`/`similar`/`new`，CSS 控制背景色和边框
- **大类徽标：** 仅 AI 拆分结果显示（规则拆分无 `_bigId`），显示大类的 emoji 图标
- **统计行：** "共 N 个：已有 X · 相似 Y · 近似 Z · 新词 W"
- **批次条：** 显示「可入库 N 个」，点击批量添加

### 4.2 单标签交互 (`onParseCardClick` → `addAtomFromParse`)

```
点击卡片 → 弹出候选浮层 → 选择分类 → 单标签入库
```

- EXACT 状态：只显示已存在信息，无操作按钮
- 非 EXACT 状态：显示候选标签列表，点击「加入词库」弹出分类选择器

### 4.3 批量入库

- 批次条中的「一键入库」按钮遍历 `_parseAtoms` 所有非 EXACT atom
- 入库后重新匹配，已入库的变为 EXACT
- 优先使用 AI 指定的大类 id（`_bigId`），否则使用当前分类 tab id

### 代码位置

```
app.js:1714  renderParseResult()     — 渲染结果区
app.js:1849  onParseCardClick(idx)   — 点击卡片
app.js:1878  addAtomFromParse(idx)   — 单标签入库
```

---

## 五、支持的 API 服务商

| 服务商 | 聊天接口 | Embedding | 图片反推 |
|--------|---------|-----------|---------|
| OpenAI | ✅ | ✅ | ✅ |
| 小米 MiMo | ✅ | ❌ | ✅ |
| DeepSeek | ✅ | ❌ | ❌ |
| Moonshot | ✅ | ❌ | ✅ |
| 智谱 AI | ✅ | ✅ | ✅ |
| 硅基流动 | ✅ | ✅ | ✅ |
| 阿里云百炼 | ✅ | ✅ | ✅ |
| Anthropic | ✅ | ❌ | ✅ |
| OpenRouter | ✅ | ✅ | ❌ |
| Together AI | ✅ | ❌ | ❌ |
| Groq | ✅ | ❌ | ❌ |
| 自定义 | 需填 baseURL | 需手动适配 | 需支持 Vision |

---

## 六、数据流图

```
┌────────────────────────────────────────────────────────────────┐
│                        用户输入文本                            │
└─────────────────┬──────────────────────────────────────────────┘
                  │
     ┌────────────┴────────────┐
     ▼                        ▼
  规则拆分                  AI 语义拆分
  (splitPrompt)             (doAIParse → callOpenAI)
     │                        │
     │                        ├─ LLM 返回带大类的标签列表
     │                        └─ 补 _bigId
     │                        │
     └────────┬───────────────┘
              ▼
        共用渲染管线
            │
     ┌──────┴──────┐
     ▼             ▼
  matchAtom()   向量匹配(静默/手动)
  规则匹配       callEmbedding → cosineSim
  EXACT/CONTAINS  → ≥0.75 SIMILAR
     │             │
     └──────┬──────┘
            ▼
    renderParseResult()
    ┌─────────────────┐
    │ 着色卡片       │
    │ 统计行         │
    │ 大类徽标(AI)   │
    │ 批次条         │
    └─────────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
  单标签入库      批量入库
  (点击卡片)     (一键入库)
  → push tag      → push tags
  → 重匹配渲染     → 重匹配渲染
```
