# Prompt Forge 数据架构与存储方案

> 本文档记录了项目的数据结构、本地存储方案及未来数据迁移规划。

---

## 一、数据结构总览

当前所有数据存储在浏览器的 `localStorage` 中，共 11 个 key：

| Key | 类型 | 说明 |
|---|---|---|
| `tags` | `Array` | 提示词库（核心数据） |
| `categories` | `Array` | 分类树（大类 + 子类） |
| `canvas` | `Array` | 画布上的标签列表 |
| `apiConfigs` | `Array` | AI API 配置 |
| `activeApiId` | `Number` | 当前选中的 API 配置 ID |
| `parseHistory` | `Array` | 解析历史（最多 50 条） |
| `promptForge.embeddings` | `Object` | AI 匹配用向量缓存 |
| `promptForge.pinUngrouped` | `Array` | 置顶的未分类标签 ID 列表 |
| `promptForge.collapsedSubs` | `Array` | 折叠的子分类 ID 列表 |
| `promptForge.splitDelimiters` | `Array` | 规则拆分分隔符 |
| `translateConfig` | `Object` | 翻译 API 配置 |
| `promptConfig` | `Object` | 其他配置项 |
| `schemaVersion` | `Number` | 数据版本号（当前 v2） |

---

## 二、核心数据结构精确格式

### 2.1 tags（提示词库）

```json
[
  { "id": 1, "categoryId": 135, "cn": "赛博朋克" },
  { "id": 2, "categoryId": 132, "cn": "油画", "en": "Oil painting" },
  { "id": 3, "categoryId": 101, "cn": "少女", "favorited": true }
]
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | Number | ✅ | 唯一标识，自增 |
| `categoryId` | Number | ✅ | 所属分类 ID |
| `cn` | String | ✅ | 中文名称 |
| `en` | String | ❌ | 英文名称 |
| `favorited` | Boolean | ❌ | 是否收藏 |

### 2.2 categories（分类树）

```json
[
  { "id": -2, "name": "收藏", "icon": "⭐", "fixed": true },
  { "id": -1, "name": "未分类", "icon": "🧩", "fixed": true, "parentId": null },
  { "id": 1, "name": "主体", "icon": "🧍", "parentId": null },
  { "id": 101, "name": "人物", "icon": "👤", "parentId": 1 }
]
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | Number | ✅ | 唯一标识（负数 = 系统固定分类） |
| `name` | String | ✅ | 分类名称 |
| `icon` | String | ✅ | Emoji 图标 |
| `parentId` | Number / null | ✅ | `null` = 大类，有值 = 子类 |
| `fixed` | Boolean | ❌ | 是否不可编辑/删除 |

### 2.3 canvas（画布标签）

```json
[
  { "cn": "赛博朋克", "en": "Cyberpunk" },
  { "cn": "少女" }
]
```

仅保存文字内容，不与 `tags` 库关联 ID。

### 2.4 apiConfigs（AI API 配置）

```json
[
  {
    "id": 1,
    "name": "DeepSeek",
    "baseUrl": "https://api.deepseek.com",
    "apiKey": "sk-xxx",
    "model": "deepseek-chat"
  }
]
```

### 2.5 parseHistory（解析历史）

```json
[
  { "text": "一个少女在夕阳下的海边", "time": "2026-06-25T10:30:00.000Z" }
]
```

### 2.6 其他配置

```json
// 翻译配置
{ "appid": "xxx", "key": "xxx" }

// 拆分分隔符
[",", "，", "。", "|"]

// 置顶未分类标签 ID 列表
[5, 12, 33]

// 折叠的子分类 ID 列表
[101, 111]

// 向量缓存（key = tag.id → 浮点数数组）
{ "1": [0.0123, 0.0456, ...], "2": [0.0789, 0.0321, ...] }
```

---

## 三、数据生命周期与默认模板

### 3.1 加载机制

```javascript
// 从 localStorage 读取，首次访问时用默认值填充
let categories = Storage.get("categories", DEFAULT_CATEGORIES);
let tags = Storage.get("tags", DEFAULT_TAGS);
```

- `DEFAULT_CATEGORIES` 和 `DEFAULT_TAGS` 是代码中的常量
- 仅在用户**首次访问（localStorage 为空）**时作为初始值使用
- 后续所有访问都从 localStorage 读取，忽略代码中的默认值

### 3.2 用户操作实时持久化

所有增删改操作都会立即调用 `Storage.set()` 写入 localStorage：

- 新增分类 → `Storage.set("categories", categories)` ✅
- 新增/编辑/删除提示词 → `Storage.set("tags", tags)` ✅
- 拖拽排序 → 同上 ✅
- 收藏切换 → 同上 ✅

### 3.3 默认模板不会自动同步

代码中的 `DEFAULT_TAGS` 修改后，**已有用户不会看到变化**。

例如：
```
用户 A 首次打开 → 加载 DEFAULT_TAGS（12个默认词）→ 存入 localStorage
用户 A 添加了 50 个自己的标签 → localStorage 有 62 个

开发者发布新版本 → DEFAULT_TAGS 新增 3 个默认词
用户 A 再次打开 → 读取 localStorage 的 62 个标签，DEFAULT_TAGS 被忽略
→ 新的 3 个默认词不会出现在用户 A 的数据中
```

这是有意设计的——用户数据归用户，不随代码硬编码变更。

---

## 四、当前存储的局限性

1. **清浏览器缓存 = 丢数据** ❌
2. **数据不可直接访问**——无法批量编辑、查看、备份 ❌
3. **版本更新后新默认词不会合并到老用户** ❌
4. **无法存储二进制文件**——限制了图片收藏功能 ❌
5. **跨设备无共享**——数据绑定在单浏览器中 ❌

---

## 五、本地文件存储方案（规划中）

### 5.1 目标

- GitHub Pages 部署用户：照常使用 localStorage，零侵入
- 本地用户（启动本地服务器）：数据自动存到本地 `server/data/` 目录

### 5.2 架构

```
GitHub Pages 模式（默认）
┌─ 浏览器 ───────────────┐
│  app.js → localStorage  │
└────────────────────────┘

本地服务器模式（可选）
┌─ 浏览器 ─────┐  fetch  ┌─ Node 本地服务器 ────────┐
│  app.js      │ ←─────→ │  server/                  │
│ （自动探测   │  JSON   │  ├─ server.js             │
│  localhost）  │         │  ├─ package.json          │
└──────────────┘         │  └─ data/                 │
                          │     ├─ tags.json          │
                          │     ├─ categories.json    │
                          │     ├─ parseHistory.json  │
                          │     ├─ embeddings.json    │
                          │     ├─ apiConfigs.json    │
                          │     ├─ settings.json      │
                          │     └─ images/            │ ← 后期：图片收藏
                          └───────────────────────────┘
```

### 5.3 数据文件映射

每个 localStorage key 对应一个 `server/data/<key>.json` 文件，内容完全一致：

| localStorage Key | 对应文件 |
|---|---|
| `tags` | `server/data/tags.json` |
| `categories` | `server/data/categories.json` |
| `canvas` | `server/data/canvas.json` |
| `apiConfigs` | `server/data/apiConfigs.json` |
| `parseHistory` | `server/data/parseHistory.json` |
| `activeApiId` | `server/data/activeApiId.json` |
| `promptForge.*` | `server/data/settings.json`（合并） |
| `translateConfig` | `server/data/settings.json`（合并） |

### 5.4 自适应加载策略

```javascript
// 页面加载时自动探测
async function tryConnectLocalServer() {
  try {
    await fetch('http://localhost:3001/api/ping');
    // 探测成功 → 从文件加载所有数据写入 localStorage
    const res = await fetch('http://localhost:3001/api/all');
    const data = await res.json();
    for (const [k, v] of Object.entries(data)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
    // 写操作同时推给服务器
    Storage.enableServerSync('http://localhost:3001');
  } catch {
    // 无本地服务器，纯 localStorage
  }
}
```

优点：
- `Storage.get/set` 接口完全不变（代码零侵入）
- 页面刷新后数据仍然从文件恢复，清浏览器缓存也不丢
- GitHub Pages 用户看不到任何变化

---

## 六、未来迁移路径

### 6.1 本地 → 远程服务器

所有数据是纯 JSON，迁移只需复制文件：

**方案 A：远程也是 Node.js + JSON 文件**
```bash
scp -r server/data/ user@server:/path/to/server/data/
# 或者：git 提交同步
```

**方案 B：远程使用数据库（SQLite / PostgreSQL）**
```javascript
// 一次性迁移脚本
const files = ['tags.json', 'categories.json', 'parseHistory.json'];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(`server/data/${file}`));
  for (const item of data) {
    await db.insert(item);  // 按目标库格式写入
  }
}
```

**方案 C：远程使用云存储（S3 / OSS）**
```bash
aws s3 sync server/data/ s3://your-bucket/data/
```

### 6.2 核心原则

- **数据格式是 JSON**，与后端技术栈无关
- **迁移本质是 JSON → 目标存储**，写一次脚本即可
- **未来即使上云，JSON 文件方案仍然可行**（小项目场景最简洁）

---

## 七、后期图片收藏的准备

本地服务器模式下：

```
server/data/images/
  ├── abc123.jpg        # 图片文件（命名 = hash 或 UUID）
  ├── def456.png
  └── images.json       # 索引文件
```

`images.json` 格式：
```json
[
  {
    "id": 1,
    "filename": "abc123.jpg",
    "name": "夕阳海滩参考图",
    "uploadTime": "2026-06-25T12:00:00.000Z",
    "relatedTagIds": [5, 12]
  }
]
```

GitHub Pages 模式下：图片以 Base64 存入 localStorage（有大小限制），或提示用户启动本地服务器。

---

## 八、后续待办

- [ ] 创建 `server/` 目录（server.js + package.json + data/）
- [ ] 实现 REST API（GET /api/all, PUT /api/data/:key）
- [ ] 在 `app.js` 的 `Storage` 对象中添加自适应探测逻辑
- [ ] 添加 Data Migration 工具函数（合并新默认词到用户数据）
- [ ] 添加图片收藏的 API 和数据存储支持
- [ ] 文档：使用说明（GitHub Pages 用户 vs 本地用户）