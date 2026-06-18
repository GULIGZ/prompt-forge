const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ========== 数据存储 ==========
const Storage = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};

// ========== 默认数据 ==========
const FAV_CAT_ID = -1;
const UNCAT_ID = -2; // 未分类（孤儿标签收容所，固定不可删）
const SCHEMA_VERSION = 2;
// 两层本体：parentId === null 为大类；parentId = 大类id 为子类
const DEFAULT_CATEGORIES = [
  { id: FAV_CAT_ID, name: "收藏", icon: "⭐", fixed: true },
  { id: UNCAT_ID, name: "未分类", icon: "🧩", fixed: true, parentId: null },
  // 大类
  { id: 1, name: "主体", icon: "🧍", parentId: null },
  { id: 2, name: "场景", icon: "🏞️", parentId: null },
  { id: 3, name: "镜头", icon: "📷", parentId: null },
  { id: 4, name: "风格", icon: "🎨", parentId: null },
  { id: 5, name: "光影", icon: "💡", parentId: null },
  { id: 6, name: "细节", icon: "✨", parentId: null },
  { id: 7, name: "画质", icon: "🏷️", parentId: null },
  // 主体
  { id: 101, name: "人物", icon: "👤", parentId: 1 },
  { id: 102, name: "动物", icon: "🐾", parentId: 1 },
  { id: 103, name: "物体", icon: "📦", parentId: 1 },
  { id: 104, name: "场景主体", icon: "🏞️", parentId: 1 },
  // 场景
  { id: 111, name: "大场景", icon: "🗺️", parentId: 2 },
  { id: 112, name: "时间天气", icon: "🌦️", parentId: 2 },
  { id: 113, name: "背景层次", icon: "🖼️", parentId: 2 },
  // 镜头
  { id: 121, name: "景别", icon: "🔍", parentId: 3 },
  { id: 122, name: "视角", icon: "📷", parentId: 3 },
  { id: 123, name: "构图法则", icon: "🖼️", parentId: 3 },
  { id: 124, name: "画幅", icon: "🏷️", parentId: 3 },
  // 风格
  { id: 131, name: "摄影写实", icon: "📷", parentId: 4 },
  { id: 132, name: "传统绘画", icon: "🎨", parentId: 4 },
  { id: 133, name: "动漫二次元", icon: "🤖", parentId: 4 },
  { id: 134, name: "3D渲染", icon: "🖼️", parentId: 4 },
  { id: 135, name: "主题氛围", icon: "✨", parentId: 4 },
  { id: 136, name: "风格修饰语", icon: "🏷️", parentId: 4 },
  // 光影
  { id: 141, name: "光源方向", icon: "💡", parentId: 5 },
  { id: 142, name: "大气特效", icon: "🌈", parentId: 5 },
  { id: 143, name: "色调情绪", icon: "🎨", parentId: 5 },
  // 细节
  { id: 151, name: "主体材质", icon: "✨", parentId: 6 },
  { id: 152, name: "动态微粒", icon: "✨", parentId: 6 },
  { id: 153, name: "干净度约束", icon: "🧩", parentId: 6 },
];
const DEFAULT_TAGS = [
  { id: 1, categoryId: 135, cn: "赛博朋克" }, { id: 2, categoryId: 132, cn: "油画" },
  { id: 3, categoryId: 132, cn: "水彩" }, { id: 4, categoryId: 133, cn: "像素风" },
  { id: 5, categoryId: 133, cn: "宫崎骏风" }, { id: 6, categoryId: 141, cn: "霓虹灯光" },
  { id: 7, categoryId: 142, cn: "体积光" }, { id: 8, categoryId: 142, cn: "丁达尔效应" },
  { id: 9, categoryId: 7, cn: "8K超高清" }, { id: 10, categoryId: 7, cn: "超精细" },
  { id: 11, categoryId: 7, cn: "虚幻引擎" }, { id: 12, categoryId: 7, cn: "电影级" },
];

// ========== SVG 图标映射 ==========
const _S = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const _C = (cx, cy, r) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="${cx}" cy="${cy}" r="${r}"/></svg>`;
const _P = (pts) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="${pts}"/></svg>`;
const ICON_SVG = {
  '⭐': _S('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'),
  '🎨': _S('M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z'),
  '🏞️': _S('M3 3h18v18H3V3zm0 12l5-5 4 4 3-3 6 6'),
  '🎭': _S('M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM12 22V12'),
  '🧍': _S('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 7a4 4 0 100-8 4 4 0 000 8z'),
  '👤': _S('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z'),
  '👔': _S('M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M12 22V10'),
  '💡': _S('M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14'),
  '🌈': _S('M22 17a10 10 0 00-20 0M6 17a6 6 0 0112 0M10 17a2 2 0 014 0'),
  '📷': _S('M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z'),
  '✨': _S('M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3zM18 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z'),
  '🏷️': _S('M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01'),
  '✏️': _S('M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z'),
  '🗑️': _S('M4 4L20 20M4 20L20 4'),
  '✕': _S('M18 6L6 18M6 6l12 12'),
  '🔍': _S('M10 2a8 8 0 107.29 11.71L22 18.59 18.59 22l-4.88-4.71A8 8 0 0010 2z'),
  '⚙️': _S('M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'),
  '🧩': _S('M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 3v3.5a1.5 1.5 0 01-3 0V3M15.5 3v3.5a1.5 1.5 0 003 0V3M12 10v.5a1.5 1.5 0 01-3 0V10M12 10h.5a1.5 1.5 0 000-3H12M12 10v.5a1.5 1.5 0 003 0V10'),
  '📋': _S('M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z'),
  '📤': _S('M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12'),
  '📥': _S('M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3'),
  '🔑': _S('M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'),
  '🤖': _S('M12 8V4M8 16H6a2 2 0 01-2-2v-4a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2h-2M8 16v2a2 2 0 002 2h4a2 2 0 002-2v-2M8 12h.01M16 12h.01'),
  '🖼️': _S('M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21'),
  '+': _S('M12 5v14M5 12h14'),
  '🌐': _C(12, 12, 10) + '<line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
  '🔛': '<rect x="2" y="8" width="20" height="8" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="12" r="3" fill="currentColor" stroke="none"/>',
};
function renderIcon(key) { return `<span class="icon-svg">${ICON_SVG[key] || key}</span>`; }
function iconSvg(key) { return ICON_SVG[key] || key; }

// ========== 状态 ==========
let categories = Storage.get("categories", DEFAULT_CATEGORIES);
let tags = Storage.get("tags", DEFAULT_TAGS);
let canvasTags = Storage.get("canvas", []);
migrateSchema(); // 旧扁平分类 → 两层本体
let currentCatId = categories.find(c => c.parentId == null && !c.fixed)?.id || categories.find(c => c.parentId == null)?.id || FAV_CAT_ID;
let showEn = false;
let nextId = Math.max(0, ...tags.map(t => t.id), ...categories.map(c => c.id)) + 1;

// 旧 schema（扁平分类无 parentId）→ 两层本体迁移
function migrateSchema() {
  if (Storage.get("schemaVersion", 1) >= SCHEMA_VERSION) return;
  const isOld = categories.some(c => c.id !== FAV_CAT_ID && c.parentId === undefined);
  if (!isOld) { Storage.set("schemaVersion", SCHEMA_VERSION); return; }
  // 旧分类名 → 新大类 id
  const nameToBig = { "风格": 4, "背景": 2, "场景": 2, "人物姿态": 1, "人物外貌": 1, "服装": 1, "光影": 5, "色彩": 5, "镜头": 3, "特效": 6, "画质": 7 };
  const oldIdToBig = {}; // 旧分类id → 新大类id（已知名）
  const customCats = []; // 用户自定义分类（名不在映射表）→ 升为新大类
  categories.forEach(c => {
    if (c.id === FAV_CAT_ID) return;
    if (nameToBig[c.name]) oldIdToBig[c.id] = nameToBig[c.name];
    else customCats.push(c);
  });
  let nextBig = 8;
  const customOldToNew = {}; // 自定义旧id → 新大类id
  customCats.forEach(c => { customOldToNew[c.id] = nextBig++; });
  // 重建分类：FAV + 未分类 + 7 大类（带子类）+ 自定义大类
  categories = [
    { id: FAV_CAT_ID, name: "收藏", icon: "⭐", fixed: true },
    { id: UNCAT_ID, name: "未分类", icon: "🧩", fixed: true, parentId: null },
    ...DEFAULT_CATEGORIES.filter(c => c.id !== FAV_CAT_ID && c.id !== UNCAT_ID),
    ...customCats.map(c => ({ id: customOldToNew[c.id], name: c.name, icon: c.icon, parentId: null })),
  ];
  // 重映射标签
  tags.forEach(t => {
    if (oldIdToBig[t.categoryId] != null) t.categoryId = oldIdToBig[t.categoryId];
    else if (customOldToNew[t.categoryId] != null) t.categoryId = customOldToNew[t.categoryId];
    else t.categoryId = UNCAT_ID;
  });
  Storage.set("categories", categories);
  Storage.set("tags", tags);
  Storage.set("schemaVersion", SCHEMA_VERSION);
}

// 拖拽状态
let dragFromLibrary = null;
let catEditMode = false;
let libEditMode = false;

// API 配置
const API_PROVIDERS = {
  openai: { baseURL: "https://api.openai.com/v1", supportsVision: true, name: "OpenAI", authType: "bearer" },
  xiaomi: { baseURL: "https://api.xiaomimimo.com/v1", supportsVision: true, name: "小米 MiMo", authType: "bearer" },
  deepseek: { baseURL: "https://api.deepseek.com", supportsVision: false, name: "DeepSeek", authType: "bearer" },
  moonshot: { baseURL: "https://api.moonshot.cn/v1", supportsVision: true, name: "Moonshot (Kimi)", authType: "bearer" },
  zhipu: { baseURL: "https://open.bigmodel.cn/api/paas/v4", supportsVision: true, name: "智谱 AI", authType: "bearer" },
  siliconflow: { baseURL: "https://api.siliconflow.cn/v1", supportsVision: true, name: "硅基流动", authType: "bearer" },
  alibaba: { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", supportsVision: true, name: "阿里云百炼", authType: "bearer" },
  anthropic: { baseURL: "https://api.anthropic.com/v1", supportsVision: true, name: "Anthropic", authType: "bearer", header: "x-api-key" },
  openrouter: { baseURL: "https://openrouter.ai/api/v1", supportsVision: true, name: "OpenRouter", authType: "bearer" },
  together: { baseURL: "https://api.together.xyz/v1", supportsVision: true, name: "Together AI", authType: "bearer" },
  groq: { baseURL: "https://api.groq.com/openai/v1", supportsVision: true, name: "Groq", authType: "bearer" },
  custom: { baseURL: "", supportsVision: false, name: "自定义", authType: "bearer" },
};
const PROVIDER_MODELS = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o-mini" },
  ],
  xiaomi: [
    { value: "mimo-v2.5", label: "mimo-v2.5" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek-V3" },
    { value: "deepseek-reasoner", label: "DeepSeek-R1" },
  ],
  moonshot: [
    { value: "moonshot-v1-8k", label: "moonshot-v1-8k" },
    { value: "moonshot-v1-32k", label: "moonshot-v1-32k" },
    { value: "moonshot-v1-128k", label: "moonshot-v1-128k" },
  ],
  zhipu: [
    { value: "glm-4-flash", label: "GLM-4-Flash" },
    { value: "glm-4-plus", label: "GLM-4-Plus" },
    { value: "glm-4v-plus", label: "GLM-4V-Plus" },
  ],
  siliconflow: [
    { value: "deepseek-ai/DeepSeek-V3", label: "DeepSeek-V3" },
    { value: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5-72B" },
    { value: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama-3.3-70B" },
  ],
  alibaba: [
    { value: "qwen-max", label: "qwen-max" },
    { value: "qwen-plus", label: "qwen-plus" },
    { value: "qwen-vl-max", label: "qwen-vl-max" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
    { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
  ],
  openrouter: [
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
    { value: "deepseek/deepseek-chat", label: "DeepSeek-V3" },
  ],
  together: [
    { value: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama-3.3-70B" },
    { value: "deepseek-ai/DeepSeek-V3", label: "DeepSeek-V3" },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama-3.3-70B" },
    { value: "mixtral-8x7b-32768", label: "Mixtral-8x7B" },
  ],
  custom: [],
};
// 支持多 API 配置（向后兼容旧的单配置）
let apiConfigs = Storage.get("apiConfigs", []);
let activeApiId = Storage.get("activeApiId", null);

// 向后兼容：旧版单 apiConfig 迁移到新版
const _oldApi = Storage.get("apiConfig", null);
if (_oldApi && _oldApi.key) {
  const migrated = {
    id: 'mig_' + Date.now(),
    name: API_PROVIDERS[_oldApi.provider]?.name || _oldApi.provider,
    provider: _oldApi.provider || "openai",
    key: _oldApi.key,
    model: _oldApi.model || "gpt-4o-mini",
    baseURL: "",
    customModels: "",
  };
  if (!apiConfigs.length) apiConfigs = [migrated];
  else if (!apiConfigs.find(c => c.key === migrated.key)) apiConfigs.unshift(migrated);
  Storage.set("apiConfigs", apiConfigs);
  Storage.set("activeApiId", migrated.id);
  activeApiId = migrated.id;
  localStorage.removeItem("apiConfig"); // 清理旧数据
}

// 确保至少有一个默认空配置
if (!apiConfigs.length) {
  apiConfigs = [{
    id: 'cfg_' + Date.now(),
    name: "OpenAI",
    provider: "openai",
    key: "",
    model: "gpt-4o-mini",
    baseURL: "",
    customModels: "",
  }];
  Storage.set("apiConfigs", apiConfigs);
  activeApiId = apiConfigs[0].id;
  Storage.set("activeApiId", activeApiId);
}
if (!activeApiId) { activeApiId = apiConfigs[0].id; Storage.set("activeApiId", activeApiId); }

function getActiveConfig() {
  return apiConfigs.find(c => c.id === activeApiId) || apiConfigs[0];
}

// 旧 apiConfig 变量兼容（只读，避免老代码报错）
const apiConfig = new Proxy({}, {
  get(_, key) { return getActiveConfig()?.[key]; },
  set(_, key, value) {
    const cfg = getActiveConfig();
    if (cfg) { cfg[key] = value; Storage.set("apiConfigs", apiConfigs); }
    return true;
  }
});

// 三区拖拽共享状态结构：{ active, ghost, el, idx, insertIdx, startX, startY, origLeft, origTop, latestX, latestY }
let _catDrag = { active: false, ghost: null, el: null, idx: null, insertIdx: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, latestX: 0, latestY: 0 };
let _libDrag = { active: false, ghost: null, el: null, idx: null, insertIdx: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, latestX: 0, latestY: 0 };
let _canvasDrag = { active: false, ghost: null, el: null, idx: null, insertIdx: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, latestX: 0, latestY: 0 };

// 空标签拖拽状态
let _emptyDrag = { active: false, ghost: null, el: null, startX: 0, startY: 0, origLeft: 0, origTop: 0 };

// 撤销栈
const _undoStack = [];
const UNDO_MAX = 5;
let _undoTimer = null;

// ========== 通用竖条光标系统（三区共用）==========
const _bars = {}; // { canvas: DOM, library: DOM, category: DOM }

function getBar(name) {
  if (!_bars[name]) {
    const bar = document.createElement('div');
    bar.className = 'insert-bar';
    document.body.appendChild(bar);
    _bars[name] = bar;
  }
  return _bars[name];
}

// 通用：2D 间隙插入计算 + 更新光标和让位效果
// items: DOM 元素数组, mouseX/Y: 鼠标坐标, barName: 光标名称, dragIdx: 被拖元素索引
// 支持 flex-wrap 多行：先按 Y 找最近行，再按 X 定插入位
function updateInsertBar(items, mouseX, mouseY, barName, dragIdx) {
  // 确保 items 是数组（应对 $$ 返回的 NodeList）
  items = [...items];
  const bar = getBar(barName);
  const others = items.filter((_, i) => i !== dragIdx);

  // —— 第一步：批量 DOM 读（一次性获取所有 rect，避免布局抖动）——
  const allRects = items.map(el => el.getBoundingClientRect());

  // —— 第二步：纯计算 ——
  if (!others.length) { bar.style.display = 'none'; items.forEach(t => t.classList.remove('push-left', 'push-right')); return 0; }

  // 获取 others 对应的 rect：直接追踪原始索引，避免 indexOf 映射风险
  const EMPTY_RECT = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  // 先构建带有原始索引的列表
  const indexedItems = items.map((el, i) => ({ el, origIdx: i }));
  const indexedOthers = indexedItems.filter((_, i) => i !== dragIdx);
  // 用原始索引从 allRects 取值，绝不依赖 indexOf
  const rects = indexedOthers.map(o => {
    return o.origIdx >= 0 && o.origIdx < allRects.length ? allRects[o.origIdx] : EMPTY_RECT;
  });

  // 行分组：top 偏移小于 6px 视为同一行
  const rows = [];
  for (let i = 0; i < others.length; i++) {
    const top = rects[i].top;
    if (i === 0 || Math.abs(top - rects[i - 1].top) > 6) rows.push([i]);
    else rows[rows.length - 1].push(i);
  }

  // 找鼠标所在行（修正：处理行间间隙）
  let targetRow = 0;
  for (let i = 0; i < rows.length; i++) {
    const first = rows[i][0];
    const firstRect = rects[first] || EMPTY_RECT;
    const rowTop = firstRect.top;

    if (mouseY < rowTop) {
      // 鼠标在当前行上方 → 插入到本行开头（处理行间间隙）
      targetRow = i;
      break;
    }
    const last = rows[i][rows.length - 1];
    const lastRect = rects[last] || EMPTY_RECT;
    const rowBot = lastRect.bottom;
    if (mouseY <= rowBot) {
      // 鼠标在当前行范围内
      targetRow = i;
      break;
    }
    // 鼠标在当前行下方，继续下一行
    if (i === rows.length - 1) {
      targetRow = rows.length; // 最后一行之后
    }
  }

  let insertIdx;
  if (targetRow >= rows.length) {
    insertIdx = others.length;
  } else {
    const row = rows[targetRow];
    insertIdx = row[0];
    for (const idx of row) {
      if (mouseX < rects[idx].left + rects[idx].width / 2) { insertIdx = idx; break; }
      insertIdx = idx + 1;
    }
  }

  // 映射回原始 items 中的索引
  let finalIdx;
  if (insertIdx >= others.length) {
    finalIdx = items.length;
  } else {
    finalIdx = items.indexOf(others[insertIdx]);
  }

  // —— 第三步：批量 DOM 写 ——
  items.forEach(t => t.classList.remove('push-left', 'push-right'));

  if (finalIdx === dragIdx) { bar.style.display = 'none'; return finalIdx; }
  bar.style.display = '';
  bar.classList.add('visible');

  // 从缓存 rect 定位竖条（不再重复 getBoundingClientRect）
  if (finalIdx === 0) {
    const r = allRects[0];
    if (r) {
      bar.style.left = (r.left - 6) + 'px';
      bar.style.top = (r.top + r.height / 2 - 18) + 'px';
    }
    items[0]?.classList.add('push-right');
  } else if (finalIdx >= items.length) {
    const r = allRects[allRects.length - 1];
    if (r) {
      bar.style.left = (r.right + 6) + 'px';
      bar.style.top = (r.top + r.height / 2 - 18) + 'px';
    }
    items[items.length - 1]?.classList.add('push-left');
  } else {
    const lr = allRects[finalIdx - 1];
    const rr = allRects[finalIdx];
    if (lr && rr) {
      bar.style.left = ((lr.right + rr.left) / 2 - 2.5) + 'px';
      bar.style.top = (lr.top + lr.height / 2 - 18) + 'px';
      items[finalIdx - 1].classList.add('push-left');
      items[finalIdx].classList.add('push-right');
    }
  }
  return finalIdx;
}

function hideBar(name) {
  const bar = _bars[name];
  if (bar) { bar.classList.remove('visible'); bar.style.display = 'none'; }
}

// ========== 三区事件委托拖拽（originPlaceholder 模式）==========
function initDragDelegation() {
  getBar('category'); getBar('library'); getBar('canvas');

  // --- 分类 Tab（仅在编辑模式下可拖）---
  document.getElementById('category-tabs').addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const tab = e.target.closest('.tab[data-id]');
    if (!tab || tab.classList.contains('fixed')) return;
    if (!catEditMode || e.target.closest('.cat-actions')) return;
    e.preventDefault();
    const all = [...tab.parentElement.querySelectorAll('.tab[data-id]')];
    _catDrag.idx = all.indexOf(tab);
    _catDrag.insertIdx = _catDrag.idx;
    startDragGhost(_catDrag, tab, e);
    _catDrag.wasMoved = false;
    // 延迟加 is-dragging，避免纯点击就变淡闪烁
    tab.classList.remove('is-dragging');
  });

  // --- 词库卡片 ---
  document.getElementById('tag-grid').addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const card = e.target.closest('.tag-card[data-id]');
    if (!card || e.target.closest('.actions')) return;
    e.preventDefault();
    dragFromLibrary = +card.dataset.id;
    const all = [...card.parentElement.querySelectorAll('.tag-card[data-id]')];
    _libDrag.idx = all.indexOf(card);
    _libDrag.insertIdx = _libDrag.idx;
    startDragGhost(_libDrag, card, e);
    _libDrag.wasMoved = false;
    // 延迟加 is-dragging，避免纯点击就变淡/收缩
    card.classList.remove('is-dragging');
    // 编辑模式下显示让位效果，非编辑模式隐藏插入光标
    if (!libEditMode) hideBar('library');
  });

  // --- 画布标签 ---
  document.getElementById('tag-canvas').addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const chip = e.target.closest('.tag-chip');
    if (!chip || e.target.classList.contains('remove')) return;
    e.preventDefault();
    const all = [...chip.parentElement.querySelectorAll('.tag-chip')];
    _canvasDrag.idx = all.indexOf(chip);
    _canvasDrag.insertIdx = _canvasDrag.idx;
    startDragGhost(_canvasDrag, chip, e);
    _canvasDrag.wasMoved = false;
  });
}

// 创建 ghost（克隆体跟随鼠标）+ 原元素变 placeholder
function startDragGhost(state, el, e) {
  const r = el.getBoundingClientRect();

  // ghost：克隆体，fixed 定位跟随鼠标
  const ghost = el.cloneNode(true);
  ghost.className = (el.className || '') + ' drag-ghost';
  // 清掉可能干扰 fixed 布局的内联样式
  ghost.style.cssText = '';
  ghost.style.position = 'fixed';
  ghost.style.left = r.left + 'px';
  ghost.style.top = r.top + 'px';
  ghost.style.width = r.width + 'px';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '10000';
  ghost.style.margin = '0';
  document.body.appendChild(ghost);

  state.active = true;
  state.ghost = ghost;
  state.el = el;
  state.startX = e.clientX;
  state.startY = e.clientY;
  state.latestX = e.clientX;
  state.latestY = e.clientY;
  state.origLeft = r.left;
  state.origTop = r.top;

  // 原元素变 placeholder
  el.classList.add('is-dragging');
  // 清掉可能残留的变换
  el.style.transform = '';
  el.style.zIndex = '';
  el.style.boxShadow = '';

  // 全局禁止文字选中，防止拖拽时元素高亮
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
}

// ========== 空标签拖拽 ==========
function initEmptyTagDrag() {
  const emptyEl = document.getElementById('empty-tag-drag');
  if (!emptyEl) return;

  let rafId = null;
  let wasMoved = false;

  emptyEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    wasMoved = false;
    const r = emptyEl.getBoundingClientRect();
    const ghost = emptyEl.cloneNode(true);
    ghost.className = 'empty-tag-drag drag-ghost';
    ghost.style.cssText = '';
    ghost.style.position = 'fixed';
    ghost.style.left = r.left + 'px';
    ghost.style.top = r.top + 'px';
    ghost.style.width = r.width + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '10000';
    ghost.style.margin = '0';
    document.body.appendChild(ghost);
    _emptyDrag = { active: true, ghost, el: emptyEl, startX: e.clientX, startY: e.clientY, origLeft: r.left, origTop: r.top };
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!_emptyDrag.active || !_emptyDrag.ghost) return;
    if (Math.abs(e.clientX - _emptyDrag.startX) > 5 || Math.abs(e.clientY - _emptyDrag.startY) > 5) wasMoved = true;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (_emptyDrag.ghost) {
        const dx = e.clientX - _emptyDrag.startX;
        const dy = e.clientY - _emptyDrag.startY;
        _emptyDrag.ghost.style.left = (_emptyDrag.origLeft + dx) + 'px';
        _emptyDrag.ghost.style.top = (_emptyDrag.origTop + dy) + 'px';
      }
    });
  }, { passive: true });

  document.addEventListener('mouseup', (e) => {
    if (!_emptyDrag.active) return;
    _emptyDrag.active = false;
    document.body.style.userSelect = '';
    if (_emptyDrag.ghost) { _emptyDrag.ghost.remove(); _emptyDrag.ghost = null; }
    _emptyDrag.el = null;

    if (!wasMoved) return;

    // 检测是否落在画布区域
    const canvas = document.getElementById('tag-canvas');
    if (!canvas) return;
    const cr = canvas.getBoundingClientRect();
    if (e.clientX >= cr.left && e.clientX <= cr.right && e.clientY >= cr.top && e.clientY <= cr.bottom) {
      setTimeout(() => {
        const text = prompt("输入标签文字:");
        if (text && text.trim()) {
          canvasTags.push({ cn: text.trim() });
          saveCanvas(); renderCanvas();
        }
      }, 50);
    }
  });
}

// 鼠标移出窗口时取消所有拖拽（只绑一次）
if (!window._dragCleanupBound) {
  window._dragCleanupBound = true;
  window.addEventListener('mouseleave', () => {
    [_catDrag, _libDrag, _canvasDrag].forEach(s => {
      if (!s.active) return;
      s.active = false;
      if (s.ghost) { s.ghost.remove(); s.ghost = null; }
      if (s.el) s.el.classList.remove('is-dragging');
      s.el = null; s.idx = null; s.insertIdx = null;
    });
    dragFromLibrary = null;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    $$('.tab, .tag-card, .tag-chip').forEach(c =>
      c.classList.remove('is-dragging', 'push-left', 'push-right', 'shrink-placeholder')
    );
    ['category', 'library', 'canvas'].forEach(hideBar);
  });
}

// ========== 初始化 ==========
function init() {
  if (!categories.find(c => c.id === FAV_CAT_ID)) {
    categories.unshift({ id: FAV_CAT_ID, name: "收藏", icon: "⭐", fixed: true });
    Storage.set("categories", categories);
  }
  currentCatId = currentCatId || categories.find(c => c.parentId == null && !c.fixed)?.id || FAV_CAT_ID;
  renderTabs(); renderLibrary(); renderCanvas();
  bindEvents();
  initPanelResize(); // 左右面板分隔条拖拽
  initDragDelegation(); // 事件委托：三区 mousedown 统一处理
  initCatDragListeners(); // 分类拖拽 document 级 mousemove/mouseup
  initLibDragListeners(); // 词库拖拽 document 级 mousemove/mouseup
  initEmptyTagDrag(); // 空标签拖拽
}

// ========== 渲染 ==========
function renderTabs() {
  const el = $("#category-tabs");
  const bar = el.parentElement;
  bar.classList.toggle("cat-edit-mode", catEditMode);

  // 只渲染大类（parentId == null，含收藏/未分类）+ 收藏
  const bigs = categories.filter(c => c.parentId == null);
  el.innerHTML = bigs.map(c => {
    const cls = ["tab"];
    if (c.id === currentCatId) cls.push("active");
    if (c.fixed) cls.push("fixed");

    // 编辑按钮始终渲染在 HTML 中，CSS 控制显隐（避免切换编辑模式时重建 DOM 导致的闪烁）
    const actions = c.fixed ? ""
      : `<span class="cat-actions">
           <button class="btn-cat-add-sub" data-id="${c.id}" title="加子类">${iconSvg('+')}</button>
           <button class="btn-cat-edit" data-id="${c.id}">${iconSvg('✏️')}</button>
           <button class="btn-cat-del" data-id="${c.id}">${iconSvg('✕')}</button>
         </span>`;

    return `<div class="${cls.join(' ')}" data-id="${c.id}">
      ${renderIcon(c.icon)}${c.name}${actions}
    </div>`;
  }).join("");

  // 新增按钮始终在右侧按钮区，不受滚动影响
  const addBtn = document.getElementById('btn-add-cat');
  addBtn.classList.toggle('hidden', !catEditMode);

  bindCatEditActions();
}

// 标签卡片 HTML（showCat=true 时附带分类标签，用于搜索结果）
function cardHtml(t, showCat) {
  const cat = categories.find(c => c.id === t.categoryId);
  const catLabel = (showCat && cat && cat.id !== FAV_CAT_ID) ? `<span class="cat-label">${renderIcon(cat.icon)} ${cat.name}</span>` : "";
  return `<div class="tag-card ${t.favorited ? 'favorited' : ''}" data-id="${t.id}">
    <span class="fav-dot"></span>
    <span class="cn">${escapeHtml(t.cn)}</span>
    ${catLabel}
    <div class="actions">
      <button class="btn-fav ${t.favorited ? 'active' : ''}" data-id="${t.id}">${iconSvg('⭐')}</button>
      <button class="btn-edit" data-id="${t.id}">${iconSvg('✏️')}</button>
      <button class="btn-delete" data-id="${t.id}">${iconSvg('🗑️')}</button>
    </div>
  </div>`;
}
function emptyHint(msg) {
  return `<div style="width:100%;text-align:center;color:var(--text3);padding:20px;">${msg}</div>`;
}
// 子类标题：折叠按钮常显；置顶/上下移/改名/删除仅编辑态（包在 .subcat-actions 内，CSS 控制显隐）
function subcatHeaderHtml(cat, editMode, groupId, isCollapsed, isUngrouped) {
  const chevron = `<button class="btn-sub-collapse" data-id="${groupId}" title="折叠/展开">${isCollapsed ? '▸' : '▾'}</button>`;
  const move = !isUngrouped
    ? `<button class="btn-sub-up" data-id="${cat.id}" title="上移">↑</button><button class="btn-sub-down" data-id="${cat.id}" title="下移">↓</button>`
    : "";
  const edit = (!isUngrouped && editMode)
    ? `<button class="btn-sub-edit" data-id="${cat.id}">${iconSvg('✏️')}</button><button class="btn-sub-del" data-id="${cat.id}">${iconSvg('✕')}</button>`
    : "";
  return `<div class="subcat-header">${chevron}${renderIcon(cat.icon)}<span class="subcat-name">${cat.name}</span><span class="subcat-actions">${move}${edit}</span></div>`;
}

// 子类在兄弟中上/下移位
function moveSubcat(id, dir) {
  const cat = categories.find(c => c.id === id);
  if (!cat || cat.parentId == null) return;
  const siblings = categories.filter(c => c.parentId === cat.parentId);
  const i = siblings.findIndex(c => c.id === id);
  const j = i + dir;
  if (j < 0 || j >= siblings.length) return;
  const a = categories.indexOf(siblings[i]);
  const b = categories.indexOf(siblings[j]);
  [categories[a], categories[b]] = [categories[b], categories[a]];
  Storage.set("categories", categories); renderLibrary();
}
function togglePinUngrouped(bigId) {
  const arr = Storage.get("promptForge.pinUngrouped", []);
  const i = arr.indexOf(bigId);
  if (i >= 0) arr.splice(i, 1); else arr.push(bigId);
  Storage.set("promptForge.pinUngrouped", arr); renderLibrary();
}
// 折叠/展开：只改 store + 切换 DOM，不整体重渲染
function toggleSubcatCollapse(groupId) {
  const arr = Storage.get("promptForge.collapsedSubs", []);
  const i = arr.indexOf(groupId);
  if (i >= 0) arr.splice(i, 1); else arr.push(groupId);
  Storage.set("promptForge.collapsedSubs", arr);
  const group = document.querySelector(`.subcat-group[data-group-id="${groupId}"]`);
  if (group) {
    const tagsEl = group.querySelector('.subcat-tags');
    const hidden = tagsEl.classList.toggle('hidden');
    const btn = group.querySelector('.btn-sub-collapse');
    if (btn) btn.textContent = hidden ? '▸' : '▾';
  }
}

function renderLibrary() {
  const kw = $("#search-input").value.trim().toLowerCase();
  const el = $("#tag-grid");
  el.classList.toggle("lib-edit-mode", libEditMode);

  // 全局搜索：跨所有分类，卡片显示子类名
  if (kw) {
    const list = tags.filter(t => fuzzyMatch(t.cn, kw));
    if (list.length === 0) { el.innerHTML = emptyHint("无匹配结果"); bindCardEvents(); return; }
    el.innerHTML = list.map(t => cardHtml(t, true)).join("");
    bindCardEvents(); return;
  }

  // 收藏
  if (currentCatId === FAV_CAT_ID) {
    const list = tags.filter(t => t.favorited);
    el.innerHTML = list.length ? list.map(t => cardHtml(t, false)).join("") : emptyHint("收藏夹为空");
    bindCardEvents(); return;
  }

  // 大类 tab：按子类分组
  const big = categories.find(c => c.id === currentCatId && c.parentId == null);
  if (!big) { el.innerHTML = emptyHint(""); bindCardEvents(); return; }
  const subs = categories.filter(c => c.parentId === big.id);
  const collapsed = Storage.get("promptForge.collapsedSubs", []);
  const ungrouped = tags.filter(t => t.categoryId === big.id);

  const renderGroup = (groupId, headerCat, list, isUngrouped) => {
    const isCollapsed = collapsed.includes(groupId);
    const tagsHtml = list.length ? list.map(t => cardHtml(t, false)).join("") : `<span class="subcat-empty">(空)</span>`;
    html += `<div class="subcat-group" data-group-id="${groupId}">${subcatHeaderHtml(headerCat, catEditMode, groupId, isCollapsed, isUngrouped)}<div class="subcat-tags${isCollapsed ? ' hidden' : ''}">${tagsHtml}</div></div>`;
  };

  let html = "";
  renderGroup(big.id, { id: big.id, icon: big.icon, name: "未分组" }, ungrouped, true);
  subs.forEach(sub => renderGroup(sub.id, sub, tags.filter(t => t.categoryId === sub.id), false));

  el.innerHTML = html || emptyHint("该分类下暂无提示词");
  bindCardEvents();
  bindSubcatActions();
}

function renderCanvas() {
  const el = $("#tag-canvas");
  el.innerHTML = canvasTags.map((t, i) =>
    `<div class="tag-chip${t.silent ? ' silent' : ''}" data-idx="${i}">
      ${showEn && t.en ? t.en : t.cn}<span class="remove" data-idx="${i}">×</span>
    </div>`
  ).join("");
  bindCanvasMouseDrag();
  renderPreview(); // ← 更新预览
}

// ========== 提示词预览区 ==========
function renderPreview() {
  const el = $("#prompt-preview");
  const active = canvasTags.filter(t => !t.silent);
  if (active.length === 0) {
    el.textContent = "";
    el.dataset.placeholder = "等待生成...";
    el.classList.add("placeholder");
    return;
  }
  el.classList.remove("placeholder");
  el.textContent = active.map(t => showEn ? (t.en || t.cn) : t.cn).join(", ");
}

// ========== 分类 Tab 拖拽排序（间隙插入模式）==========
// 事件委托在 initDragDelegation() 中统一处理

function initCatDragListeners() {
  let rafId = null;

  document.addEventListener('mousemove', (e) => {
    if (!_catDrag.active || !_catDrag.ghost) return;
    // 持续跟踪最新鼠标位置，确保 rAF 拿到的是最新坐标
    _catDrag.latestX = e.clientX;
    _catDrag.latestY = e.clientY;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updateCatDragPosition(_catDrag.latestX, _catDrag.latestY);
    });
  }, { passive: true });

  document.addEventListener('mouseup', () => {
    if (!_catDrag.active) return;
    _catDrag.active = false;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    // 移出 ghost
    if (_catDrag.ghost) { _catDrag.ghost.remove(); _catDrag.ghost = null; }

    // 快照排序所需数据
    const el = _catDrag.el;
    const insertIdx = _catDrag.insertIdx;
    const idx = _catDrag.idx;
    const wasMoved = _catDrag.wasMoved;
    const willReorder = wasMoved && el && insertIdx !== null && insertIdx !== idx;
    _catDrag.el = null; _catDrag.idx = null; _catDrag.insertIdx = null; _catDrag.wasMoved = false;

    // 移除让位效果 + 隐藏插入条
    $$('.tab[data-id]').forEach(t => t.classList.remove('push-left', 'push-right', 'is-dragging'));
    hideBar('category');

    // 仅真实重排时才缩小占位 + 延迟；纯点击立即重渲染
    if (willReorder && el) el.classList.add('shrink-placeholder');

    setTimeout(() => {
      if (willReorder && el) {
        // 按「大类块（大类+其子类）」整体移动
        const srcId = +el.dataset.id;
        const fixedBigs = categories.filter(c => c.parentId == null && c.fixed);
        const movableBigs = categories.filter(c => c.parentId == null && !c.fixed);
        const srcMovable = movableBigs.findIndex(c => c.id === srcId);
        if (srcMovable >= 0) {
          const movableBlocks = movableBigs.map(b => ({ cat: b, subs: categories.filter(c => c.parentId === b.id) }));
          const [moved] = movableBlocks.splice(srcMovable, 1);
          let dstMovable = insertIdx - fixedBigs.length;
          if (dstMovable > srcMovable) dstMovable--;
          dstMovable = Math.max(0, Math.min(dstMovable, movableBlocks.length));
          movableBlocks.splice(dstMovable, 0, moved);
          categories = [...fixedBigs, ...movableBlocks.flatMap(bl => [bl.cat, ...bl.subs])];
          Storage.set("categories", categories);
        }
      }
      renderTabs();
    }, willReorder ? 350 : 0);
  });
}

// 核心：计算鼠标位置对应的插入索引，更新视觉效果（使用通用光标）
function updateCatDragPosition(mouseX, mouseY) {
  const tabsEl = document.getElementById('category-tabs');
  const tabs = [...tabsEl.querySelectorAll('.tab[data-id]')];

  if (_catDrag.el) {
    const all = [...tabsEl.querySelectorAll('.tab[data-id]')];
    _catDrag.idx = all.indexOf(_catDrag.el);
  }

  let insertIdx = updateInsertBar(tabs, mouseX, mouseY, 'category', _catDrag.idx);

  // 固定大类（收藏/未分类）始终在最前，插入点不能落到它们之前
  const fixedCount = categories.filter(c => c.parentId == null && c.fixed).length;
  if (insertIdx <= fixedCount) insertIdx = fixedCount;

  _catDrag.insertIdx = insertIdx;

  // 检测真实拖动（区分点击和拖拽）
  if (!_catDrag.wasMoved && (Math.abs(mouseX - _catDrag.startX) > 5 || Math.abs(mouseY - _catDrag.startY) > 5)) {
    _catDrag.wasMoved = true;
  }
  // 真实拖动时才让原 tab 变淡
  if (_catDrag.wasMoved && _catDrag.el) _catDrag.el.classList.add('is-dragging');

  // 移动 ghost 跟随鼠标
  if (_catDrag.ghost) {
    const dx = mouseX - _catDrag.startX;
    const dy = mouseY - _catDrag.startY;
    _catDrag.ghost.style.left = (_catDrag.origLeft + dx) + 'px';
    _catDrag.ghost.style.top = (_catDrag.origTop + dy) + 'px';
  }
}

// ========== 分类编辑操作（删除/编辑）==========
function bindCatEditActions() {
  // 删除分类（大类级联子类→标签入未分类；子类→标签降为父大类未分组）
  $$('.btn-cat-del').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const id = +b.dataset.id;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const isBig = cat.parentId == null;
    const subIds = isBig ? categories.filter(c => c.parentId === id).map(c => c.id) : [];
    const affected = isBig ? [id, ...subIds] : [id];
    const tagCount = tags.filter(t => affected.includes(t.categoryId)).length;
    let msg = `确定删除分类 "${cat.name}" 吗？`;
    if (isBig && subIds.length) msg += `\n（含 ${subIds.length} 个子分类）`;
    if (tagCount) msg += `\n该分类下有 ${tagCount} 个提示词，将${isBig ? "移入「未分类」" : "降为未分组"}。`;
    openConfirm(msg, () => {
      if (isBig) {
        tags.forEach(t => { if (affected.includes(t.categoryId)) t.categoryId = UNCAT_ID; });
      } else {
        tags.forEach(t => { if (t.categoryId === id) t.categoryId = cat.parentId; });
      }
      categories = categories.filter(c => !affected.includes(c.id));
      Storage.set("tags", tags); Storage.set("categories", categories);
      if (affected.includes(currentCatId)) currentCatId = categories.find(c => c.parentId == null && !c.fixed)?.id || FAV_CAT_ID;
      renderTabs(); renderLibrary();
    });
  });

  // 编辑大类名/图标
  $$('.btn-cat-edit').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const id = +b.dataset.id;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const name = prompt("修改分类名称:", cat.name);
    if (name && name.trim()) cat.name = name.trim();
    const icon = prompt("修改图标（emoji）:", cat.icon);
    if (icon && icon.trim()) cat.icon = icon.trim();
    Storage.set("categories", categories); renderTabs(); renderLibrary();
  });

  // 加子类
  $$('.btn-cat-add-sub').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const parentId = +b.dataset.id;
    const name = prompt("子分类名称:");
    if (!name || !name.trim()) return;
    const icon = prompt("图标（emoji，默认📁）:") || "📁";
    categories.push({ id: nextId++, parentId, name: name.trim(), icon: icon.trim() });
    Storage.set("categories", categories); renderTabs(); renderLibrary();
  });
}

// 子类标题上的改名/删除（编辑模式下显示）
function bindSubcatActions() {
  $$('.btn-sub-collapse').forEach(b => b.onclick = (e) => { e.stopPropagation(); toggleSubcatCollapse(+b.dataset.id); });
  $$('.btn-sub-up').forEach(b => b.onclick = (e) => { e.stopPropagation(); moveSubcat(+b.dataset.id, -1); });
  $$('.btn-sub-down').forEach(b => b.onclick = (e) => { e.stopPropagation(); moveSubcat(+b.dataset.id, 1); });
  $$('.btn-sub-pin').forEach(b => b.onclick = (e) => { e.stopPropagation(); togglePinUngrouped(+b.dataset.id); });
  $$('.btn-sub-edit').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const id = +b.dataset.id;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const name = prompt("修改子分类名称:", cat.name);
    if (name && name.trim()) cat.name = name.trim();
    const icon = prompt("修改图标（emoji）:", cat.icon);
    if (icon && icon.trim()) cat.icon = icon.trim();
    Storage.set("categories", categories); renderLibrary();
  });
  $$('.btn-sub-del').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const id = +b.dataset.id;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const tagCount = tags.filter(t => t.categoryId === id).length;
    let msg = `确定删除子分类 "${cat.name}" 吗？`;
    if (tagCount) msg += `\n其下 ${tagCount} 个提示词将降为未分组。`;
    openConfirm(msg, () => {
      tags.forEach(t => { if (t.categoryId === id) t.categoryId = cat.parentId; });
      categories = categories.filter(c => c.id !== id);
      Storage.set("tags", tags); Storage.set("categories", categories);
      renderTabs(); renderLibrary();
    });
  });
}

// ========== 词库卡片事件 ==========
function bindCardEvents() {
  $$('.tag-card[data-id]').forEach(card => {
    // 单击：编辑模式不响应，非编辑模式加入画布（若刚拖拽过则跳过）
    card.onclick = (e) => {
      if (libEditMode) return;
      if (e.target.closest('.actions')) return;
      if (_libDrag.wasMoved) { _libDrag.wasMoved = false; return; }
      const t = tags.find(x => x.id === +card.dataset.id);
      if (t) { canvasTags.push({ cn: t.cn, en: t.en }); saveCanvas(); renderCanvas(); }
    };
  });

  // 收藏
  $$('.btn-fav').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const t = tags.find(x => x.id === +b.dataset.id);
    if (t) { t.favorited = !t.favorited; Storage.set("tags", tags); renderLibrary(); }
  });

  $$('.btn-edit').forEach(b => b.onclick = (e) => { e.stopPropagation(); openTagModal(false, +b.dataset.id); });
  $$('.btn-delete').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const tag = tags.find(t => t.id === +b.dataset.id);
    openConfirm(`确定删除 "${tag?.cn}" 吗？`, () => {
      tags = tags.filter(t => t.id !== +b.dataset.id); Storage.set("tags", tags); invalidateEmbedding(+b.dataset.id); renderLibrary();
      if (tag) { pushUndo({ type: 'tag-delete', data: tag }); showUndoToast(`已删除「${tag.cn}」`); }
    });
  });
}

// ========== 词库鼠标拖拽（统一绿色竖条光标）==========
// 事件委托在 initDragDelegation() 中统一处理

function initLibDragListeners() {
  let rafId = null;

  document.addEventListener('mousemove', (e) => {
    if (!_libDrag.active || !_libDrag.ghost) return;
    _libDrag.latestX = e.clientX;
    _libDrag.latestY = e.clientY;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updateLibDragPosition(_libDrag.latestX, _libDrag.latestY);
    });
  }, { passive: true });

  document.addEventListener('mouseup', (e) => {
    if (!_libDrag.active) return;
    _libDrag.active = false;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    if (_libDrag.ghost) { _libDrag.ghost.remove(); _libDrag.ghost = null; }

    if (libEditMode) {
      // 编辑模式：拖拽排序或跨组移动
      const idx = _libDrag.idx;
      const insertIdx = _libDrag.insertIdx;
      const wasMoved = _libDrag.wasMoved;
      const el = _libDrag.el;
      const dropX = _libDrag.latestX, dropY = _libDrag.latestY;
      _libDrag.el = null; _libDrag.idx = null; _libDrag.insertIdx = null; _libDrag.wasMoved = false;

      $$('.tag-card[data-id]').forEach(c => c.classList.remove('push-left', 'push-right', 'is-dragging'));
      hideBar('library');

      // 判定落点所属分组（用于跨组移动 categoryId）
      let targetGroupId = null;
      if (wasMoved) {
        const gp = document.elementFromPoint(dropX, dropY)?.closest('.subcat-group[data-group-id]');
        if (gp) targetGroupId = +gp.dataset.groupId;
      }
      const draggedTag = dragFromLibrary != null ? tags.find(t => t.id === dragFromLibrary) : null;
      const crossGroup = wasMoved && draggedTag && targetGroupId != null && targetGroupId !== draggedTag.categoryId;
      const willReorder = wasMoved && !crossGroup && insertIdx !== null && insertIdx !== idx;
      const changed = crossGroup || willReorder;

      if (changed && el) el.classList.add('shrink-placeholder');

      setTimeout(() => {
        if (crossGroup && draggedTag) {
          draggedTag.categoryId = targetGroupId;
          Storage.set("tags", tags);
        } else if (willReorder) {
          // 同组重排：按当前渲染顺序（DOM）取视图标签
          const viewIds = [...$$('#tag-grid .tag-card[data-id]')].map(c => +c.dataset.id);
          const viewList = viewIds.map(id => tags.find(t => t.id === id)).filter(Boolean);
          let dstIdx = insertIdx;
          let srcIdx = idx;
          if (dstIdx > srcIdx) dstIdx--;
          const [moved] = viewList.splice(srcIdx, 1);
          viewList.splice(Math.max(0, Math.min(dstIdx, viewList.length)), 0, moved);
          const viewIdSet = new Set(viewList.map(t => t.id));
          tags = [...tags.filter(t => !viewIdSet.has(t.id)), ...viewList];
          Storage.set("tags", tags);
        }
        renderLibrary();
        dragFromLibrary = null;
      }, changed ? 350 : 0);
    } else {
      // 非编辑模式：拖到画布加入，否则无操作
      if (_libDrag.el) _libDrag.el.classList.remove('is-dragging');
      _libDrag.el = null; _libDrag.idx = null; _libDrag.insertIdx = null;
      $$('.tag-card[data-id]').forEach(c => c.classList.remove('push-left', 'push-right'));
      hideBar('library');

      const canvasRect = $("#tag-canvas").getBoundingClientRect();
      const droppedOnCanvas = e.clientX >= canvasRect.left && e.clientX <= canvasRect.right &&
          e.clientY >= canvasRect.top && e.clientY <= canvasRect.bottom;
      if (droppedOnCanvas) {
        const t = tags.find(x => x.id === dragFromLibrary);
        if (t) { canvasTags.push({ cn: t.cn, en: t.en }); saveCanvas(); renderCanvas(); }
      }
      dragFromLibrary = null;
    }
  });
}

function updateLibDragPosition(mouseX, mouseY) {
  const cards = $$('.tag-card[data-id]');
  if (_libDrag.el) _libDrag.idx = [...cards].indexOf(_libDrag.el);
  if (libEditMode) {
    _libDrag.insertIdx = updateInsertBar(cards, mouseX, mouseY, 'library', _libDrag.idx);
  } else {
    hideBar('library');
    cards.forEach(c => c.classList.remove('push-left', 'push-right'));
  }

  // 检测真实拖动（区分点击和拖拽）
  if (!_libDrag.wasMoved && (Math.abs(mouseX - _libDrag.startX) > 5 || Math.abs(mouseY - _libDrag.startY) > 5)) {
    _libDrag.wasMoved = true;
  }
  // 真实拖动时才让原卡片变淡
  if (_libDrag.wasMoved && _libDrag.el) _libDrag.el.classList.add('is-dragging');

  // 移动 ghost 跟随鼠标
  if (_libDrag.ghost) {
    const dx = mouseX - _libDrag.startX;
    const dy = mouseY - _libDrag.startY;
    _libDrag.ghost.style.left = (_libDrag.origLeft + dx) + 'px';
    _libDrag.ghost.style.top = (_libDrag.origTop + dy) + 'px';
  }
}

function clearLibDragVisuals() {
  if (_libDrag.ghost) { _libDrag.ghost.remove(); _libDrag.ghost = null; }
  $$('.tag-card[data-id]').forEach(c => {
    c.classList.remove('is-dragging', 'push-left', 'push-right', 'shrink-placeholder');
    c.style.transform = '';
    c.style.zIndex = '';
  });
  hideBar('library');
}

// ========== 画布鼠标拖拽（统一绿色竖条光标）==========
function bindCanvasMouseDrag() {
  // document 级事件（只绑一次）
  if (!bindCanvasMouseDrag._bound) {
    bindCanvasMouseDrag._bound = true;

    let rafId = null;

    document.addEventListener('mousemove', (e) => {
      if (!_canvasDrag.active || !_canvasDrag.ghost) return;
      _canvasDrag.latestX = e.clientX;
      _canvasDrag.latestY = e.clientY;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const mx = _canvasDrag.latestX, my = _canvasDrag.latestY;
        const chips = $$('.tag-chip');
        if (_canvasDrag.el) _canvasDrag.idx = [...chips].indexOf(_canvasDrag.el);
        _canvasDrag.insertIdx = updateInsertBar(chips, mx, my, 'canvas', _canvasDrag.idx);
        // 检测真实拖动（区分点击和拖拽）
        if (!_canvasDrag.wasMoved && (Math.abs(mx - _canvasDrag.startX) > 5 || Math.abs(my - _canvasDrag.startY) > 5)) {
          _canvasDrag.wasMoved = true;
        }
        // 移动 ghost 跟随鼠标
        if (_canvasDrag.ghost) {
          const dx = mx - _canvasDrag.startX;
          const dy = my - _canvasDrag.startY;
          _canvasDrag.ghost.style.left = (_canvasDrag.origLeft + dx) + 'px';
          _canvasDrag.ghost.style.top = (_canvasDrag.origTop + dy) + 'px';
        }
      });
    }, { passive: true });

    document.addEventListener('mouseup', () => {
      if (!_canvasDrag.active) return;
      _canvasDrag.active = false;
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';

      if (_canvasDrag.ghost) { _canvasDrag.ghost.remove(); _canvasDrag.ghost = null; }

      // 缩小 placeholder
      if (_canvasDrag.el) _canvasDrag.el.classList.add('shrink-placeholder');

      const el = _canvasDrag.el;
      const idx = _canvasDrag.idx;
      const insertIdx = _canvasDrag.insertIdx;
      _canvasDrag.el = null; _canvasDrag.idx = null; _canvasDrag.insertIdx = null;

      $$('.tag-chip').forEach(c => {
        c.classList.remove('push-left', 'push-right', 'shrink-placeholder');
        c.style.transform = '';
        c.style.zIndex = '';
      });
      hideBar('canvas');

      setTimeout(() => {
        if (insertIdx !== null && insertIdx !== idx) {
          let dstIdx = insertIdx;
          if (dstIdx > idx) dstIdx--;
          const [moved] = canvasTags.splice(idx, 1);
          canvasTags.splice(Math.max(0, Math.min(dstIdx, canvasTags.length)), 0, moved);
          saveCanvas();
        }
        renderCanvas();
      }, 350);
    });
  }

  // 删除按钮
  $$('.tag-chip .remove').forEach(x => x.onclick = (e) => {
    e.stopPropagation();
    const idx = +x.dataset.idx;
    if (idx >= 0 && idx < canvasTags.length) {
      const removed = canvasTags[idx];
      canvasTags.splice(idx, 1); saveCanvas(); renderCanvas();
      pushUndo({ type: 'canvas-remove', data: { idx, tag: { ...removed } } });
      showUndoToast(`已移除「${removed.cn}」`);
    }
  });

  // 点击标签切换静默状态（拖拽过后不切换）
  $$('.tag-chip').forEach(chip => {
    chip.onclick = (e) => {
      if (e.target.classList.contains('remove')) return;
      if (_canvasDrag.wasMoved) { _canvasDrag.wasMoved = false; return; }
      const idx = +chip.dataset.idx;
      if (idx >= 0 && idx < canvasTags.length) {
        canvasTags[idx].silent = !canvasTags[idx].silent;
        saveCanvas();
        chip.classList.toggle('silent');
      }
    };
  });
}

// ========== 撤销系统 ==========
function pushUndo(action) {
  _undoStack.push(action);
  if (_undoStack.length > UNDO_MAX) _undoStack.shift();
}

function showUndoToast(msg) {
  const toast = $("#undo-toast");
  const msgEl = $("#undo-msg");
  msgEl.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => { toast.classList.add("hidden"); }, 5000);
}

function hideUndoToast() {
  clearTimeout(_undoTimer);
  $("#undo-toast").classList.add("hidden");
}

$("#btn-undo").onclick = () => {
  const action = _undoStack.pop();
  if (!action) return;
  hideUndoToast();
  switch (action.type) {
    case 'tag-delete':
      tags.push(action.data);
      Storage.set("tags", tags);
      renderLibrary(); break;
    case 'canvas-remove':
      canvasTags.splice(action.data.idx, 0, action.data.tag);
      saveCanvas(); renderCanvas(); break;
    case 'canvas-clear':
      canvasTags = action.data;
      saveCanvas(); renderCanvas(); break;
  }
};

// ========== 左右面板分隔条拖拽 ==========
function initPanelResize() {
  const divider = $("#panel-divider");
  const leftPanel = document.querySelector('.left-panel');
  let startX, startWidth, isResizing = false;

  divider.onmousedown = (e) => {
    isResizing = true; startX = e.clientX;
    startWidth = leftPanel.offsetWidth;
    divider.classList.add('active');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = e.clientX - startX;
    const newWidth = Math.max(280, startWidth + delta);
    const maxW = window.innerWidth * 0.6;
    leftPanel.style.flex = 'none';
    leftPanel.style.width = Math.min(newWidth, maxW) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    divider.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// ========== 功能函数 ==========
function switchMode(mode) {
  $("#btn-paint").classList.toggle("active", mode === "paint");
  $("#btn-parse-mode").classList.toggle("active", mode === "parse");
  $("#paint-mode").classList.toggle("hidden", mode !== "paint");
  $("#parse-mode").classList.toggle("hidden", mode !== "parse");
  if (mode === "parse") doParse();
}

function saveCanvas() { Storage.set("canvas", canvasTags); }

// 百度翻译配置
const BAIDU_CONFIG = { appid: '20260612002630330', key: 'pppsq04tDgJ1ml_1bu3i' };

// 紧凑 MD5（Paul Johnston 算法，公开领域，广泛验证）
function md5(s) {
  function add32(a,b){return(a+b)&0xFFFFFFFF;}
  function cmn(q,a,b,x,s,t){a=add32(add32(a,q),add32(x,t));return add32((a<<s)|(a>>>(32-s)),b);}
  function ff(a,b,c,d,x,s,t){return cmn((b&c)|(~b&d),a,b,x,s,t);}
  function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&~d),a,b,x,s,t);}
  function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t);}
  function ii(a,b,c,d,x,s,t){return cmn(c^(b|~d),a,b,x,s,t);}
  function md5cycle(x,k){
    let a=x[0],b=x[1],c=x[2],d=x[3];
    a=ff(a,b,c,d,k[0],7,-680876936);d=ff(d,a,b,c,k[1],12,-389564586);c=ff(c,d,a,b,k[2],17,606105819);b=ff(b,c,d,a,k[3],22,-1044525330);
    a=ff(a,b,c,d,k[4],7,-176418897);d=ff(d,a,b,c,k[5],12,1200080426);c=ff(c,d,a,b,k[6],17,-1473231341);b=ff(b,c,d,a,k[7],22,-45705983);
    a=ff(a,b,c,d,k[8],7,1770035416);d=ff(d,a,b,c,k[9],12,-1958414417);c=ff(c,d,a,b,k[10],17,-42063);b=ff(b,c,d,a,k[11],22,-1990404162);
    a=ff(a,b,c,d,k[12],7,1804603682);d=ff(d,a,b,c,k[13],12,-40341101);c=ff(c,d,a,b,k[14],17,-1502002290);b=ff(b,c,d,a,k[15],22,1236535329);
    a=gg(a,b,c,d,k[1],5,-165796510);d=gg(d,a,b,c,k[6],9,-1069501632);c=gg(c,d,a,b,k[11],14,643717713);b=gg(b,c,d,a,k[0],20,-373897302);
    a=gg(a,b,c,d,k[5],5,-701558691);d=gg(d,a,b,c,k[10],9,38016083);c=gg(c,d,a,b,k[15],14,-660478335);b=gg(b,c,d,a,k[4],20,-405537848);
    a=gg(a,b,c,d,k[9],5,568446438);d=gg(d,a,b,c,k[14],9,-1019803690);c=gg(c,d,a,b,k[3],14,-187363961);b=gg(b,c,d,a,k[8],20,1163531501);
    a=gg(a,b,c,d,k[13],5,-1444681467);d=gg(d,a,b,c,k[2],9,-51403784);c=gg(c,d,a,b,k[7],14,1735328473);b=gg(b,c,d,a,k[12],20,-1926607734);
    a=hh(a,b,c,d,k[5],4,-378558);d=hh(d,a,b,c,k[8],11,-2022574463);c=hh(c,d,a,b,k[11],16,1839030562);b=hh(b,c,d,a,k[14],23,-35309556);
    a=hh(a,b,c,d,k[1],4,-1530992060);d=hh(d,a,b,c,k[4],11,1272893353);c=hh(c,d,a,b,k[7],16,-155497632);b=hh(b,c,d,a,k[10],23,-1094730640);
    a=hh(a,b,c,d,k[13],4,681279174);d=hh(d,a,b,c,k[0],11,-358537222);c=hh(c,d,a,b,k[3],16,-722521979);b=hh(b,c,d,a,k[6],23,76029189);
    a=hh(a,b,c,d,k[9],4,-640364487);d=hh(d,a,b,c,k[12],11,-421815835);c=hh(c,d,a,b,k[15],16,530742520);b=hh(b,c,d,a,k[2],23,-995338651);
    a=ii(a,b,c,d,k[0],6,-198630844);d=ii(d,a,b,c,k[7],10,1126891415);c=ii(c,d,a,b,k[14],15,-1416354905);b=ii(b,c,d,a,k[5],21,-57434055);
    a=ii(a,b,c,d,k[12],6,1700485571);d=ii(d,a,b,c,k[3],10,-1894986606);c=ii(c,d,a,b,k[10],15,-1051523);b=ii(b,c,d,a,k[1],21,-2054922799);
    a=ii(a,b,c,d,k[8],6,1873313359);d=ii(d,a,b,c,k[15],10,-30611744);c=ii(c,d,a,b,k[6],15,-1560198380);b=ii(b,c,d,a,k[13],21,1309151649);
    a=ii(a,b,c,d,k[4],6,-145523070);d=ii(d,a,b,c,k[11],10,-1120210379);c=ii(c,d,a,b,k[2],15,718787259);b=ii(b,c,d,a,k[9],21,-343485551);
    x[0]=add32(a,x[0]);x[1]=add32(b,x[1]);x[2]=add32(c,x[2]);x[3]=add32(d,x[3]);
  }
  const hex='0123456789abcdef';
  let str=unescape(encodeURIComponent(s)), n=str.length, state=[1732584193,-271733879,-1732584194,271733878], i, j;
  // 将字节数组转为 32 位字数组（小端序），供 md5cycle 处理
  function bytesToWords(bytes) {
    const w = Array.from({length: 16}, (_, i) =>
      (bytes[i*4]|(bytes[i*4+1]<<8)|(bytes[i*4+2]<<16)|(bytes[i*4+3]<<24))
    );
    return w;
  }
  let words;
  for(i=64;i<=str.length;i+=64){
    const bytes = [];
    for(j=0;j<64;j++) bytes[j]=str.charCodeAt(i-64+j);
    words = bytesToWords(bytes);
    md5cycle(state, words);
  }
  let tail=[];
  for(j=i-64;j<str.length;j++) tail.push(str.charCodeAt(j));
  tail.push(128);
  while(tail.length%64!==56) tail.push(0);
  let bits=n*8;
  tail.push(bits&0xFF); tail.push((bits>>8)&0xFF); tail.push((bits>>16)&0xFF); tail.push((bits>>24)&0xFF);
  tail.push(0);tail.push(0);tail.push(0);tail.push(0); // 高32位（对于 <512GB 的输入恒为0）
  for(i=0;i<tail.length;i+=64){
    words = bytesToWords(tail.slice(i,i+64));
    md5cycle(state, words);
  }
  let res='';
  for(i=0;i<4;i++)res+=hex[(state[i]>>4)&0xF]+hex[state[i]&0xF]+hex[(state[i]>>12)&0xF]+hex[(state[i]>>8)&0xF]+hex[(state[i]>>20)&0xF]+hex[(state[i]>>16)&0xF]+hex[(state[i]>>28)&0xF]+hex[(state[i]>>24)&0xF];
  return res;
}

// MD5 自测（打开控制台看结果）
console.log('MD5 自测 "abc":', md5('abc'), '(期望: 900150983cd24fb0d6963f7d28e17f72)');
console.log('MD5 自测 "":', md5(''), '(期望: d41d8cd98f00b204e9800998ecf8427e)');

// JSONP 请求（绕过 CORS 限制，用于百度翻译）
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'bd_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    window[cbName] = (data) => { delete window[cbName]; script.remove(); resolve(data); };
    script.src = url + '&callback=' + cbName;
    script.onerror = () => { delete window[cbName]; script.remove(); reject(new Error('JSONP 请求失败')); };
    document.head.appendChild(script);
  });
}

// 翻译：只影响画布！自动翻译缺失的英文
let _translating = false;
async function autoTranslateAll(untranslated) {
  if (untranslated.length === 0) return;
  const texts = untranslated.map(t => t.cn);
  const q = texts.join('\n');
  const salt = Date.now();
  const sign = md5(BAIDU_CONFIG.appid + q + salt + BAIDU_CONFIG.key);
  console.log('百度翻译 sign 原文:', BAIDU_CONFIG.appid + q + salt + '(密钥隐藏)');
  console.log('百度翻译 sign:', sign);
  console.log('百度翻译 URL q 参数:', encodeURIComponent(q).slice(0,80) + '...');
  const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(q)}&from=zh&to=en&appid=${BAIDU_CONFIG.appid}&salt=${salt}&sign=${sign}`;
  try {
    const data = await jsonp(url);
    if (data.trans_result) {
      data.trans_result.forEach((r, i) => {
        if (r.dst && untranslated[i]) {
          untranslated[i].en = r.dst;
          // 同步写回词库（匹配中文相同的标签）
          const libTag = tags.find(t => t.cn === untranslated[i].cn);
          if (libTag) libTag.en = r.dst;
        }
      });
      saveCanvas();
      Storage.set("tags", tags);
    } else if (data.error_code) {
      alert(`百度翻译失败 [${data.error_code}]: ${data.error_msg || '未知错误'}`);
    }
  } catch(e) {
    alert('翻译请求失败，请检查网络: ' + e.message);
  }
}

async function translateToggle() {
  showEn = !showEn;
  renderCanvas();

  // 切换到英文时，批量自动翻译缺失的标签
  if (showEn && !_translating) {
    const untranslated = canvasTags.filter(t => !t.en);
    if (untranslated.length > 0) {
      _translating = true;
      await autoTranslateAll(untranslated);
      renderCanvas();
      _translating = false;
    }
  }
}

function copyCanvas() {
  const active = canvasTags.filter(t => !t.silent);
  if (active.length === 0) { alert("没有可复制的标签（全部已静默）"); return; }
  const text = active.map(t => showEn ? (t.en || t.cn) : t.cn).join(", ");
  navigator.clipboard.writeText(text).then(() =>
    alert("已复制: " + text.slice(0, 60) + (text.length > 60 ? "..." : ""))
  ).catch(() => alert("复制失败"));
}

let confirmDeleteFn = null;
let _confirmFromSettings = false;
function openConfirm(msg, fn) {
  $("#confirm-msg").textContent = msg; confirmDeleteFn = fn;
  _confirmFromSettings = !$("#modal-settings").classList.contains("hidden");
  if (_confirmFromSettings) $("#modal-settings").classList.add("hidden");
  $("#modal-confirm").classList.remove("hidden");
}
function closeModals() { $$('.modal').forEach(m => m.classList.add("hidden")); }

let editingTagId = null;
// 取 categoryId 所属的大类 id（自身即大类则返回自身）
function parentBigOf(catId) {
  const c = categories.find(x => x.id === catId);
  if (!c) return null;
  return c.parentId == null ? c.id : c.parentId;
}
function firstBigId() {
  return categories.find(c => c.parentId == null && !c.fixed)?.id || UNCAT_ID;
}
function openTagModal(handwrite, id) {
  editingTagId = id || null;
  $("#tag-modal-title").textContent = id ? "编辑提示词" : "添加提示词";
  const t = id ? tags.find(x => x.id === id) : null;
  $("#input-cn").value = t?.cn || "";
  $("#input-en").value = t?.en || "";
  // 子类选择：编辑时取标签所属大类，新增时取当前 tab 的大类
  const bigId = id ? (parentBigOf(t.categoryId) ?? firstBigId()) : (currentCatId === FAV_CAT_ID ? firstBigId() : (parentBigOf(currentCatId) ?? currentCatId));
  const big = categories.find(c => c.id === bigId);
  const sel = $("#input-subcat");
  const wrap = $("#input-subcat-wrap");
  if (big && big.parentId == null) {
    const subs = categories.filter(c => c.parentId === big.id);
    sel.innerHTML = `<option value="${big.id}">未分组</option>` + subs.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join("");
    sel.value = String(id ? t.categoryId : big.id);
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
  $("#modal-tag").classList.remove("hidden");
}
function confirmTag() {
  const cn = $("#input-cn").value.trim();
  if (!cn) return alert("不能为空");
  const en = $("#input-en").value.trim() || undefined;
  const sel = $("#input-subcat");
  const subcatVal = $("#input-subcat-wrap").classList.contains("hidden") ? null : +sel.value;
  if (editingTagId) {
    const t = tags.find(x => x.id === editingTagId);
    if (t) { t.cn = cn; t.en = en; if (subcatVal) t.categoryId = subcatVal; invalidateEmbedding(t.id); }
  } else {
    let catId;
    if (subcatVal) catId = subcatVal;
    else if (currentCatId === FAV_CAT_ID) catId = firstBigId();
    else catId = currentCatId;
    tags.push({ id: nextId++, categoryId: catId, cn, en });
  }
  Storage.set("tags", tags); renderTabs(); renderLibrary(); closeModals();
}
function openAddCategory() {
  const name = prompt("大类名称:"); if (!name) return;
  const icon = prompt("图标（emoji，默认📁）:") || "📁";
  categories.push({ id: nextId++, parentId: null, name: name.trim(), icon: icon.trim() });
  Storage.set("categories", categories); renderTabs();
}

// ========== 炸开解析 ==========
const PLACEHOLDER_HTML = '<span class="prompt-placeholder">拆分后的标签将在这里显示...</span>';

// 拆分规则设置弹窗
function openSplitSettings() {
  const current = Storage.get("promptForge.splitDelimiters", [",", "，"]);
  const custom = current.filter(d => d !== "," && d !== "，");
  $("#split-delim-input").value = custom.join("\n");
  $("#modal-split-settings").classList.remove("hidden");
}
function saveSplitRules() {
  const raw = $("#split-delim-input").value.trim();
  const list = raw ? raw.split("\n").map(s => s.trim()).filter(Boolean) : [];
  list.unshift("，", ",");
  Storage.set("promptForge.splitDelimiters", [...new Set(list)]);
  closeModals();
}

// 共享规则拆分：按自定义分隔符列表拆分文本
function splitPrompt(text, delimiters) {
  if (!text || !Array.isArray(delimiters) || !delimiters.length) return [];
  const escaped = delimiters.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  escaped.push(',', '，', '\\s');
  const re = new RegExp(`[${escaped.join('')}]+`);
  return [...new Set(text.split(re).map(s => s.trim()).filter(Boolean))];
}

function doParse() {
  const text = $("#parse-input").value.trim();
  if (!text) { _parseAtoms = []; $("#parse-result").innerHTML = PLACEHOLDER_HTML; $("#parse-stats").textContent = ""; return; }

  const delimiters = Storage.get("promptForge.splitDelimiters", [",", "，"]);
  _parseAtoms = splitPrompt(text, delimiters).map(s => ({ cn: s }));
  _parseAtoms.forEach(a => { a.match = matchAtom(a, tags); });
  renderParseResult();
}

// ========== 数据导出/导入（统一 JSON 格式）==========
async function callOpenAI(messages, options = {}) {
  const { model: optModel, onStream } = options;
  const cfg = getActiveConfig();
  if (!cfg || !cfg.key) {
    alert("请先在设置中配置 API 密钥 🔑");
    return { content: "", error: "NO_KEY" };
  }
  const providerKey = cfg.provider;
  const provider = API_PROVIDERS[providerKey] || API_PROVIDERS.openai;
  // 自定义 provider 用用户填写的 baseURL，预设用内置 baseURL
  const baseURL = providerKey === "custom" ? (cfg.baseURL || "").replace(/\/$/, "") : (provider.baseURL || "").replace(/\/$/, "");
  if (providerKey === "custom" && !baseURL) {
    alert("自定义 API 未填写接口地址");
    return { content: "", error: "NO_BASEURL" };
  }
  const model = optModel || cfg.model;
  try {
    const body = { model, messages, stream: !!onStream };
    if (!onStream) body.temperature = 0.3;

    const headers = { "Content-Type": "application/json" };
    const authType = provider.authType || "bearer";
    const headerName = provider.header || "Authorization";
    if (authType === "bearer") {
      headers[headerName] = `Bearer ${cfg.key}`;
    } else if (authType === "api-key") {
      headers[headerName] = cfg.key;
    }

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { content: "", error: err.error?.message || `HTTP ${res.status}` };
    }
    if (onStream) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n").filter(l => l.startsWith("data: "))) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || "";
            full += delta;
            onStream(full);
          } catch { /* skip incomplete chunks */ }
        }
      }
      return { content: full, error: null };
    }
    const json = await res.json();
    return { content: json.choices?.[0]?.message?.content || "", error: null };
  } catch (err) {
    return { content: "", error: err.message };
  }
}

// AI 语义拆分：调 LLM 将提示词拆成标签
async function doAIParse() {
  const text = $("#parse-input").value.trim();
  if (!text) return alert("请先输入提示词");
  // AI 拆分前取消 pending 的规则拆分 debounce，避免结果被覆盖
  if (typeof window._cancelParseDebounce === "function") window._cancelParseDebounce();
  const loading = $("#ai-loading");
  const btn = $("#btn-ai-parse");
  loading.classList.remove("hidden");
  btn.classList.add("loading");
  try {
    const bigCats = categories.filter(c => c.parentId == null && !c.fixed);
    const catNames = bigCats.map(c => c.name).join("、");
    const { content, error } = await callOpenAI([
      { role: "system", content: `你是一个提示词分析助手。将用户的提示词文本拆解为语义独立的标签词，并标注各标签所属大类。
要求：
1. 每个标签是一个独立的语义单元
2. 返回 JSON 格式：{ "tags": [{ "cn": "...", "en": "...", "category": "大类名" }] }
3. 去除重复和无意义的通用词
4. category 必须是以下之一：${catNames}` },
      { role: "user", content: text },
    ], { model: apiConfig.model });
    if (error) { alert("AI 解析失败: " + error); return; }
    // 解析 JSON 响应——先尝试直接 parse，再尝试提取代码块，最后贪婪匹配最外层 {}
    let parsed;
    try {
      parsed = JSON.parse(content.trim());
    } catch {
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : null;
        if (jsonStr) parsed = JSON.parse(jsonStr);
        else {
          const outer = content.match(/\{[\s\S]*\}/);
          parsed = outer ? JSON.parse(outer[0].trim()) : { tags: [] };
        }
      } catch {
        parsed = { tags: [] };
      }
    }
    const list = (parsed.tags || []).filter(t => t.cn);
    if (!list.length) { alert("AI 未能解析出标签，请重试"); return; }
    // 补大类 id
    list.forEach(a => {
      a._bigId = (categories.filter(c => c.parentId == null && !c.fixed).find(c => c.name === a.category)?.id) || UNCAT_ID;
    });
    _parseAtoms = list;
    _parseAtoms.forEach(a => { a.match = matchAtom(a, tags); });
    // 自动向量匹配（静默跳过失败，不阻断后续）
    if (supportsEmbedding() && getActiveConfig()?.key) {
      loading.textContent = "AI 语义匹配中…";
      const sync = await syncEmbeddingCache();
      if (!sync.error) {
        const pending = _parseAtoms.filter(a => a.match.status !== "EXACT");
        if (pending.length) {
          const { vectors, error: embErr } = await callEmbedding(pending.map(a => a.cn || a.en));
          if (!embErr) {
            pending.forEach((a, i) => {
              if (!vectors[i]) return;
              const scored = tags.filter(t => embCache[t.id]).map(t => ({ t, sim: cosineSim(vectors[i], embCache[t.id]) })).sort((x, y) => y.sim - x.sim);
              const best = scored[0];
              if (best && best.sim >= EMB_THRESHOLD) a.match = { status: "SIMILAR", matched: null, candidates: scored.slice(0, 5).map(s => s.t), sim: best.sim };
            });
          }
        }
      }
    }
    renderParseResult();
  } finally {
    loading.textContent = "AI 解析中…";
    loading.classList.add("hidden");
    btn.classList.remove("loading");
  }
}

// ========== 提示词匹配分析（炸开模式内：拆分后与词库匹配着色）==========
const EMB_KEY = "promptForge.embeddings";
const EMB_THRESHOLD = 0.75;
const STATUS_LABEL = { EXACT: "已有", CONTAINS: "近似", SIMILAR: "相似", NEW: "新词" };
let embCache = Storage.get(EMB_KEY, {});
let _parseAtoms = [];

// 规则匹配：EXACT（完全相等）/ CONTAINS（互为包含）/ NEW（无匹配）
function matchAtom(atom, library) {
  const aCn = (atom.cn || "").toLowerCase().trim();
  const aEn = (atom.en || "").toLowerCase().trim();
  if (!aCn && !aEn) return { status: "NEW", matched: null, candidates: [] };
  const norm = t => ({ cn: (t.cn || "").toLowerCase().trim(), en: (t.en || "").toLowerCase().trim() });
  // EXACT：cn/en 任一字段完全相等（跨语言也算）
  const exact = library.find(t => {
    const n = norm(t);
    return (n.cn && (n.cn === aCn || n.cn === aEn)) || (n.en && (n.en === aEn || n.en === aCn));
  });
  if (exact) return { status: "EXACT", matched: exact, candidates: [exact] };
  // CONTAINS：互为包含
  const contains = library.filter(t => {
    const n = norm(t);
    const pairs = [[n.cn, aCn], [n.en, aEn], [n.cn, aEn], [n.en, aCn]];
    return pairs.some(([x, y]) => x && y && (x.includes(y) || y.includes(x)));
  });
  if (contains.length) return { status: "CONTAINS", matched: null, candidates: contains };
  return { status: "NEW", matched: null, candidates: [] };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 渲染当前 _parseAtoms 到 #parse-result，按匹配状态着色 + 统计 + 大类徽标 + 批次条
function renderParseResult() {
  const counts = { EXACT: 0, CONTAINS: 0, SIMILAR: 0, NEW: 0 };
  _parseAtoms.forEach(a => counts[a.match.status]++);
  const total = _parseAtoms.length;
  $("#parse-stats").innerHTML = total
    ? `共 ${total} 个：<span class="st-exact">已有 ${counts.EXACT}</span> · <span class="st-similar">相似 ${counts.SIMILAR}</span> · <span class="st-contains">近似 ${counts.CONTAINS}</span> · <span class="st-new">新词 ${counts.NEW}</span>`
    : "";
  $("#parse-result").innerHTML = total ? _parseAtoms.map((a, i) => {
    const m = a.match;
    const simTxt = m.sim ? ` ${(m.sim * 100).toFixed(0)}%` : "";
    // 大类徽标：仅 AI 拆分时有 _bigId
    const catBadge = a._bigId ? (() => { const c = categories.find(x => x.id === a._bigId); return c ? `<span class="cat-badge">${c.icon}</span>` : ""; })() : "";
    return `<div class="tag-card ${m.status.toLowerCase()}" data-idx="${i}" data-text="${escapeHtml(a.cn)}"${a.en ? ` data-en="${escapeHtml(a.en)}"` : ""}>
      ${catBadge}<span class="cn">${escapeHtml(a.cn)}</span>${a.en ? `<span class="en">${escapeHtml(a.en)}</span>` : ""}
      <span class="badge">${STATUS_LABEL[m.status]}${simTxt}</span>
    </div>`;
  }).join("") : PLACEHOLDER_HTML;

  // 批次条：可入库数量
  const addable = _parseAtoms.filter(a => a.match.status !== "EXACT");
  const bar = $("#parse-batch-bar");
  const info = $("#parse-batch-info");
  const btn = $("#btn-parse-batch-add");
  if (addable.length) {
    bar.classList.remove("hidden");
    info.textContent = `可入库 ${addable.length} 个（已有 ${counts.EXACT} 个已存在）`;
    btn.onclick = () => {
      addable.forEach(a => {
        tags.push({ id: nextId++, categoryId: a._bigId || currentCatId, cn: a.cn, en: a.en });
      });
      Storage.set("tags", tags);
      bar.classList.add("hidden");
      renderTabs(); renderLibrary();
      // 重新匹配已入库的 atom
      _parseAtoms.forEach(a => { a.match = matchAtom(a, tags); });
      renderParseResult();
    };
  } else {
    bar.classList.add("hidden");
  }
}

// 向量余弦相似度
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// 各服务商对应的 embedding 模型（未列出的不支持向量匹配）
const EMBEDDING_MODELS = {
  openai: "text-embedding-3-small",
  siliconflow: "BAAI/bge-m3",
  alibaba: "text-embedding-v3",
  zhipu: "embedding-3",
  openrouter: "openai/text-embedding-3-small",
};
function supportsEmbedding() { return !!EMBEDDING_MODELS[getActiveConfig()?.provider]; }

// 调 /embeddings 接口，批量返回向量
async function callEmbedding(texts) {
  const cfg = getActiveConfig();
  if (!cfg || !cfg.key) return { vectors: [], error: "NO_KEY" };
  const embModel = EMBEDDING_MODELS[cfg.provider];
  if (!embModel) return { vectors: [], error: "NO_EMBEDDING" };
  const provider = API_PROVIDERS[cfg.provider] || API_PROVIDERS.openai;
  const baseURL = (cfg.provider === "custom" ? (cfg.baseURL || "") : (provider.baseURL || "")).replace(/\/$/, "");
  if (!baseURL) return { vectors: [], error: "NO_BASEURL" };
  const headers = { "Content-Type": "application/json" };
  if (provider.authType === "api-key") headers[provider.header || "Authorization"] = cfg.key;
  else headers[provider.header || "Authorization"] = `Bearer ${cfg.key}`;
  try {
    const res = await fetch(`${baseURL}/embeddings`, {
      method: "POST", headers, body: JSON.stringify({ model: embModel, input: texts }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); return { vectors: [], error: e.error?.message || `HTTP ${res.status}` }; }
    const json = await res.json();
    const vectors = (json.data || []).sort((a, b) => a.index - b.index).map(d => d.embedding);
    return { vectors, error: null };
  } catch (err) {
    return { vectors: [], error: err.message };
  }
}

// 让词库向量缓存与当前 tags 同步：补算缺失的、清理已删除的
async function syncEmbeddingCache() {
  const liveIds = new Set(tags.map(t => t.id));
  Object.keys(embCache).forEach(id => { if (!liveIds.has(+id)) delete embCache[+id]; });
  const missing = tags.filter(t => !embCache[t.id]);
  if (missing.length) {
    const { vectors, error } = await callEmbedding(missing.map(t => t.cn || t.en));
    if (error) return { error };
    missing.forEach((t, i) => { if (vectors[i]) embCache[t.id] = vectors[i]; });
    Storage.set(EMB_KEY, embCache);
  }
  return { error: null };
}

function invalidateEmbedding(tagId) {
  if (embCache[tagId]) { delete embCache[tagId]; Storage.set(EMB_KEY, embCache); }
}

// AI 向量匹配：对当前拆分结果中非 EXACT 的标签找语义相似的库内标签（按钮触发，避免输入即调 API）
async function doAIMatch() {
  if (!_parseAtoms.length) return alert("请先拆分提示词");
  if (!supportsEmbedding()) return alert("当前服务商不支持向量匹配（支持：OpenAI / 硅基流动 / 阿里云 / 智谱 / OpenRouter）");
  if (!getActiveConfig()?.key) return alert("请先在设置中配置 API 密钥 🔑");
  const loading = $("#ai-loading");
  loading.classList.remove("hidden");
  try {
    const sync = await syncEmbeddingCache();
    if (sync.error) { alert("向量匹配失败：" + sync.error); return; }
    const pending = _parseAtoms.filter(a => a.match.status !== "EXACT");
    if (pending.length) {
      const { vectors, error } = await callEmbedding(pending.map(a => a.cn || a.en));
      if (error) { alert("向量匹配失败：" + error); return; }
      pending.forEach((a, i) => {
        if (!vectors[i]) return;
        const scored = tags
          .filter(t => embCache[t.id])
          .map(t => ({ t, sim: cosineSim(vectors[i], embCache[t.id]) }))
          .sort((x, y) => y.sim - x.sim);
        const best = scored[0];
        if (best && best.sim >= EMB_THRESHOLD) {
          a.match = { status: "SIMILAR", matched: null, candidates: scored.slice(0, 5).map(s => s.t), sim: best.sim };
        }
      });
    }
    renderParseResult();
  } finally {
    loading.classList.add("hidden");
  }
}

// 点击拆分卡片 → 弹出候选/相似列表 + 入库
function onParseCardClick(idx) {
  const a = _parseAtoms[idx];
  if (!a) return;
  const m = a.match;
  const list = m.candidates || [];
  $("#similar-title").textContent = m.status === "EXACT" ? `已存在：${a.cn}` : `「${a.cn}」的候选标签`;
  const ul = $("#similar-list");
  if (!list.length) { ul.innerHTML = '<li class="similar-empty">无候选标签</li>'; }
  else {
    ul.innerHTML = list.map(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const sim = m.sim && m.candidates[0] === t ? ` <span class="sim">${(m.sim * 100).toFixed(0)}%</span>` : "";
      return `<li data-tag-id="${t.id}">
        <span class="cn">${escapeHtml(t.cn)}</span>${t.en ? `<span class="en">${escapeHtml(t.en)}</span>` : ""}
        <span class="cat">${cat ? cat.icon + " " + cat.name : ""}</span>${sim}
      </li>`;
    }).join("");
  }
  const addBtn = $("#btn-similar-add");
  if (m.status === "EXACT") { addBtn.classList.add("hidden"); }
  else {
    addBtn.classList.remove("hidden");
    addBtn.onclick = () => addAtomFromParse(idx);
  }
  $("#modal-similar").classList.remove("hidden");
}

// 把当前拆分标签加入词库（弹窗内选分类）
function addAtomFromParse(idx) {
  const a = _parseAtoms[idx];
  if (!a) return;
  const sel = $("#similar-cat-select");
  sel.classList.remove("hidden");
  sel.innerHTML = categories.filter(c => c.id !== FAV_CAT_ID).map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
  sel.onchange = () => {
    const added = { id: nextId++, categoryId: +sel.value, cn: a.cn, en: a.en };
    tags.push(added);
    Storage.set("tags", tags);
    sel.classList.add("hidden");
    closeModals();
    a.match = { status: "EXACT", matched: added, candidates: [added] };
    renderTabs(); renderLibrary(); renderParseResult();
  };
  sel.focus();
}

// ========== 图片反推 ==========
let _reverseImageData = null; // base64 data

function handleImageUpload(file) {
  if (!file) return;
  const area = $("#image-upload-area");
  const preview = $("#image-preview");
  // 先压缩图片再转 base64，避免上传超大原始图
  const img = new Image();
  img.onload = () => {
    const MAX = 1024; // 最长边不超过 1024px
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > MAX || h > MAX) {
      const ratio = Math.min(MAX / w, MAX / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    _reverseImageData = c.toDataURL("image/jpeg", 0.85);
    preview.src = _reverseImageData;
    preview.classList.remove("hidden");
    area.querySelector(".image-upload-hint")?.classList.add("hidden");
    area.style.padding = "8px";
  };
  img.src = URL.createObjectURL(file);
}

async function doReversePrompt() {
  if (!_reverseImageData) return alert("请先上传图片");
  if (!apiConfig.key) return alert("请先在设置中配置 API 密钥 🔑");
  const provider = API_PROVIDERS[apiConfig.provider] || API_PROVIDERS.openai;
  if (!provider.supportsVision) {
    return alert("当前" + provider.name + "不支持图片反推功能，请切换到 OpenAI 使用此功能");
  }
  const btn = $("#btn-reverse");
  const resultEl = $("#reverse-result");
  btn.textContent = "⏳ 反推中...";
  btn.disabled = true;
  resultEl.value = "⏳ 正在分析图片...";
  try {
    const { content, error } = await callOpenAI([
      { role: "system", content: "你是一个提示词反推专家。根据用户提供的图片，分析其风格、主体、光影、色彩、构图等要素，生成一个完整的提示词。" },
      { role: "user", content: [
        { type: "image_url", image_url: { url: _reverseImageData } },
        { type: "text", text: "请反推这张图片的提示词" },
      ]},
    ], { model: apiConfig.model });
    if (error) {
      resultEl.value = `❌ 反推失败\n\n当前配置：${provider.name} / ${apiConfig.model}\nAPI 地址：${(apiConfig.baseURL || provider.baseURL || "默认")}\n\n错误详情：${error}\n\n提示：如果您的 API 不支持图片识别，请切换到支持 Vision 的模型（如 gpt-4o / gpt-4o-mini）或 OpenAI 官方 API。`;
      return;
    }
    resultEl.value = content;
  } finally {
    btn.textContent = "🤖 反推提示词";
    btn.disabled = false;
  }
}

function copyReverseResult() {
  const el = $("#reverse-result");
  if (!el.value || el.value.startsWith("等待") || el.value.startsWith("⏳") || el.value.startsWith("❌")) return;
  navigator.clipboard.writeText(el.value).then(() => alert("已复制")).catch(() => alert("复制失败"));
}

function reverseToParse() {
  const el = $("#reverse-result");
  if (!el.value || el.value.startsWith("等待") || el.value.startsWith("⏳") || el.value.startsWith("❌")) return;
  $("#parse-input").value = el.value;
  switchMode("parse");
  doParse();
}

function exportData() {
  const data = {
    schemaVersion: SCHEMA_VERSION,
    categories, tags,
    canvas: canvasTags,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prompt-forge-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

// 下载模版：根据当前分类实时生成
function downloadTemplate() {
  const tplCategories = categories.filter(c => c.id !== FAV_CAT_ID).map(c => ({ ...c }));
  const tplTags = categories.filter(c => c.id !== FAV_CAT_ID).map((c, i) => ({
    id: -(i + 1), categoryId: c.id, cn: `示例标签（${c.name}）`, en: `example tag (${c.name})`,
  }));
  const template = {
    schemaVersion: SCHEMA_VERSION,
    _说明: "将标签数据填入本文件，然后通过「导入数据」功能导入。分类会根据名称自动匹配或新建。",
    categories: tplCategories,
    tags: tplTags,
    canvas: [],
  };
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prompt-forge-模版.json`;
  a.click();
}

function importData(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || typeof d !== "object") throw new Error("格式错误");
      const idMap = {};

      // 处理分类：按 (name + parentId) 匹配，新分类自动添加
      if (Array.isArray(d.categories)) {
        d.categories.forEach(c => {
          if (c.id === FAV_CAT_ID || c.id === UNCAT_ID) return;
          const existing = categories.find(x => x.name === c.name && x.parentId === c.parentId);
          if (existing) {
            idMap[c.id] = existing.id;
          } else {
            const newCat = { ...c, id: nextId++ };
            delete newCat.fixed;
            categories.push(newCat);
            idMap[c.id] = newCat.id;
          }
        });
        Storage.set("categories", categories);
      }

      // 处理标签：去重后追加
      if (Array.isArray(d.tags)) {
        const existingKeys = new Set(tags.map(t => `${t.categoryId}:${t.cn}`));
        d.tags.forEach(t => {
          const catId = idMap[t.categoryId] != null ? idMap[t.categoryId] : t.categoryId;
          const key = `${catId}:${t.cn}`;
          if (!existingKeys.has(key)) {
            tags.push({ id: nextId++, categoryId: catId, cn: t.cn, en: t.en });
            existingKeys.add(key);
          }
        });
        Storage.set("tags", tags);
      }

      if (Array.isArray(d.canvas)) {
        canvasTags = d.canvas.map(t => ({ cn: t.cn, en: t.en }));
        Storage.set("canvas", canvasTags);
      }

      location.reload();
    } catch (err) {
      alert("导入失败: " + err.message);
    }
  };
  r.readAsText(f, "UTF-8");
}
function debounce(fn, ms) { let t; const w = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; w.cancel = () => { clearTimeout(t); t = null; }; return w; }

// 模糊搜索：先精确子串匹配，再逐字符模糊匹配
function fuzzyMatch(text, query) {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (t.includes(q)) return true;
  // 逐字符匹配：查询串的每个字符必须在目标文本中出现
  const qChars = [...new Set(q)];
  return qChars.every(c => t.includes(c));
}

// ========== 事件绑定入口 ==========
function bindEvents() {
  $("#btn-paint").onclick = () => switchMode("paint");
  $("#btn-parse-mode").onclick = () => switchMode("parse");

  // 新增按钮（在右侧固定区，不受滚动影响）
  document.getElementById('btn-add-cat').onclick = openAddCategory;

  $("#category-tabs").onclick = (e) => {
    // cat-actions 按钮已 stopPropagation；编辑态也允许切换大类（便于给不同大类管理子类）
    const tab = e.target.closest(".tab[data-id]");
    if (tab) { currentCatId = +tab.dataset.id; renderTabs(); renderLibrary(); }
  };

  // 分类编辑模式切换（只切换 CSS 类，不重建 DOM，避免闪烁）
  $("#btn-edit-cats").innerHTML = iconSvg('✏️');
  $("#btn-edit-cats").onclick = () => {
    catEditMode = !catEditMode;
    $("#btn-edit-cats").classList.toggle("active", catEditMode);
    $("#btn-edit-cats").innerHTML = catEditMode ? iconSvg('✕') : iconSvg('✏️');
    document.querySelector('.category-tabs-bar').classList.toggle("cat-edit-mode", catEditMode);
    document.getElementById('btn-add-cat').classList.toggle('hidden', !catEditMode);
  };

  // 词库编辑模式切换
  $("#btn-edit-lib").innerHTML = iconSvg('✏️');
  $("#btn-edit-lib").onclick = () => {
    libEditMode = !libEditMode;
    $("#btn-edit-lib").classList.toggle("active", libEditMode);
    $("#btn-edit-lib").innerHTML = libEditMode ? iconSvg('✕') : iconSvg('✏️');
    renderLibrary();
  };

  $("#search-input").oninput = () => {
    renderLibrary();
    $("#btn-search-clear").classList.toggle("hidden", !$("#search-input").value.trim());
  };
  $("#btn-search-clear").onclick = () => {
    $("#search-input").value = "";
    $("#btn-search-clear").classList.add("hidden");
    renderLibrary();
  };
  $("#btn-add-tag").onclick = () => openTagModal();
  // 添加按钮：将输入框文字变为标签
  $("#btn-add-to-canvas").onclick = () => {
    const text = $("#input-field").value.trim();
    if (text) { canvasTags.push({ cn: text }); saveCanvas(); renderCanvas(); $("#input-field").value = ""; }
  };

  // 工具栏（在画布内右下角）
  $("#btn-translate").onclick = translateToggle;
  $("#btn-copy").onclick = copyCanvas;
  $("#btn-clear").onclick = () => {
    if (canvasTags.length === 0) return;
    openConfirm("确定清空画布吗？", () => {
      const backup = canvasTags.map(t => ({ ...t }));
      canvasTags = []; saveCanvas(); renderCanvas();
      pushUndo({ type: 'canvas-clear', data: backup });
      showUndoToast("已清空画布");
    });
  };

  // 双空格变标签
  let lastSpaceTime = 0;
  $("#input-field").addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      const now = Date.now();
      if (now - lastSpaceTime < 500) {
        e.preventDefault();
        const text = $("#input-field").value.trim();
        if (text) { canvasTags.push({ cn: text }); saveCanvas(); renderCanvas(); $("#input-field").value = ""; }
        lastSpaceTime = 0;
      } else { lastSpaceTime = now; }
    } else { lastSpaceTime = 0; }
  });

  // 弹窗
  $$(".modal .btn-cancel").forEach(b => b.onclick = closeModals);
  $$(".modal").forEach(m => m.onclick = (e) => { if (e.target === m) closeModals(); });
  $("#modal-tag .btn-confirm").onclick = confirmTag;
$("#modal-confirm .btn-danger").onclick = () => { confirmDeleteFn?.(); $("#modal-confirm").classList.add("hidden"); if (_confirmFromSettings) $("#modal-settings").classList.remove("hidden"); };
  $("#modal-confirm .btn-cancel").onclick = () => { $("#modal-confirm").classList.add("hidden"); };

  // ========== 设置面板（多 API 配置 + 标签页）==========
  let _editingApiId = null;

  function renderSettingsApiList() {
    const el = $("#api-list");
    if (!el) return;
    if (!apiConfigs.length) {
      el.innerHTML = `<div class="api-empty">暂无 API 配置，点击上方「添加 API」按钮</div>`;
      return;
    }
    const toggleOn = '<svg width="15" height="15" viewBox="0 0 48 48" fill="none"><path d="M14.5 8C13.8406 8.37652 13.2062 8.79103 12.6 9.24051C11.5625 10.0097 10.6074 10.8814 9.75 11.8402C6.79377 15.1463 5 19.4891 5 24.2455C5 34.6033 13.5066 43 24 43C34.4934 43 43 34.6033 43 24.2455C43 19.4891 41.2062 15.1463 38.25 11.8402C37.3926 10.8814 36.4375 10.0097 35.4 9.24051C34.7938 8.79103 34.1594 8.37652 33.5 8" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 4V24" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const toggleOff = '<svg width="15" height="15" viewBox="0 0 48 48" fill="none"><path d="M14.5 8C13.8406 8.37652 13.2062 8.79103 12.6 9.24051C11.5625 10.0097 10.6074 10.8814 9.75 11.8402C6.79377 15.1463 5 19.4891 5 24.2455C5 34.6033 13.5066 43 24 43C34.4934 43 43 34.6033 43 24.2455C43 19.4891 41.2062 15.1463 38.25 11.8402C37.3926 10.8814 36.4375 10.0097 35.4 9.24051C34.7938 8.79103 34.1594 8.37652 33.5 8" stroke="var(--text3)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 4V24" stroke="var(--text3)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    // 用内联 onclick，确保每个按钮独立可点击
    // 注意：用单引号包裹参数，避免与 HTML 双引号属性冲突
    el.innerHTML = apiConfigs.map(cfg => {
      const isActive = cfg.id === activeApiId;
      const prov = API_PROVIDERS[cfg.provider] || API_PROVIDERS.openai;
      const safeId = "'" + String(cfg.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
      return `<div class="api-item ${isActive ? 'active' : ''}" data-id="${cfg.id}">
        <div class="api-item-info">
          <span class="api-item-name">${cfg.name || prov.name}</span>
          <span class="api-item-detail">${prov.name} · ${cfg.model}</span>
        </div>
        <div class="api-item-actions">
          <button class="api-btn-toggle" onclick="__apiToggle(${safeId})" title="${isActive ? '正在使用' : '设为默认'}">${isActive ? toggleOn : toggleOff}</button>
          <button class="api-btn-edit" onclick="__apiEdit(${safeId})" title="编辑">${iconSvg('✏️')}</button>
          <button class="api-btn-del" onclick="__apiDel(${safeId})" title="删除">${iconSvg('🗑️')}</button>
        </div>
      </div>`;
    }).join("");
  }

  // 挂载到 window 上供内联 onclick 调用
  window.__apiToggle = function(id) {
    if (id !== activeApiId) {
      activeApiId = id;
      Storage.set("activeApiId", activeApiId);
      renderSettingsApiList();
    }
  };
  window.__apiEdit = function(id) { openApiEdit(id); };
  window.__apiDel = function(id) {
    if (apiConfigs.length <= 1) {
      alert("至少保留一个 API 配置，如需删除请先添加新配置");
      return;
    }
    const cfg = apiConfigs.find(c => c.id === id);
    openConfirm(`确定删除 API 配置「${cfg?.name || '未命名'}」吗？`, () => {
      apiConfigs = apiConfigs.filter(c => c.id !== id);
      Storage.set("apiConfigs", apiConfigs);
      if (activeApiId === id) {
        activeApiId = apiConfigs[0]?.id || null;
        Storage.set("activeApiId", activeApiId);
      }
      renderSettingsApiList();
    });
  };

  function openApiEdit(id) {
    _editingApiId = id || null;
    const cfg = id ? apiConfigs.find(c => c.id === id) : null;
    $("#edit-api-title").textContent = id ? "编辑 API 配置" : "添加 API 配置";
    $("#edit-api-name").value = cfg?.name || "";
    $("#edit-api-provider").value = cfg?.provider || "openai";
    $("#edit-api-key").value = cfg?.key || "";
    $("#edit-api-model").value = cfg?.model || "";
    $("#edit-api-baseurl").value = cfg?.baseURL || "";
    $("#edit-api-custommodels").value = cfg?.customModels || "";
    updateEditModelOptions(cfg?.provider || "openai", cfg?.model);
    toggleCustomFields(cfg?.provider || "openai");
    $("#modal-api-edit").classList.remove("hidden");
  }

  function updateEditModelOptions(provider, selectedModel) {
    const sel = $("#edit-api-model");
    let models = PROVIDER_MODELS[provider] || [];
    // 如果有自定义模型，追加到列表
    const cfg = apiConfigs.find(c => c.id === _editingApiId);
    const customStr = cfg?.customModels || $("#edit-api-custommodels")?.value || "";
    if (customStr.trim()) {
      const customModels = customStr.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
      models = [...models, ...customModels.map(m => ({ value: m, label: m }))];
    }
    // 去重
    const seen = new Set();
    models = models.filter(m => { if (seen.has(m.value)) return false; seen.add(m.value); return true; });
    sel.innerHTML = models.map(m => `<option value="${m.value}" ${m.value === selectedModel ? 'selected' : ''}>${m.label}</option>`).join("") +
      (models.length ? '' : '<option value="">请选择或输入模型</option>');
    // 如果没有匹配的选项，添加一个用户输入的占位
    if (selectedModel && !models.find(m => m.value === selectedModel)) {
      sel.innerHTML += `<option value="${selectedModel}" selected>${selectedModel}</option>`;
    }
  }

  function toggleCustomFields(provider) {
    const wrap = $("#edit-api-custom-wrap");
    if (!wrap) return;
    const isCustom = provider === "custom";
    wrap.classList.toggle("hidden", !isCustom);
    // 自定义模型输入框始终显示（用于补充预设列表）
    $("#edit-api-custommodels-wrap").classList.remove("hidden");
  }

  function saveApiEdit() {
    const name = $("#edit-api-name").value.trim();
    const provider = $("#edit-api-provider").value;
    const key = $("#edit-api-key").value.trim();
    const model = $("#edit-api-model").value;
    const baseURL = $("#edit-api-baseurl")?.value.trim() || "";
    const customModels = $("#edit-api-custommodels")?.value.trim() || "";
    if (!name) return alert("请填写配置名称");
    if (!key) return alert("请填写 API 密钥");
    if (!model && provider !== "custom") return alert("请选择或填写模型");
    if (provider === "custom" && !baseURL) return alert("自定义 API 需要填写接口地址");

    const payload = { name, provider, key, model, baseURL, customModels };
    if (_editingApiId) {
      const idx = apiConfigs.findIndex(c => c.id === _editingApiId);
      if (idx >= 0) {
        apiConfigs[idx] = { ...apiConfigs[idx], ...payload };
      }
    } else {
      apiConfigs.push({ id: 'cfg_' + Date.now(), ...payload });
    }
    Storage.set("apiConfigs", apiConfigs);
    if (!activeApiId && apiConfigs.length) {
      activeApiId = apiConfigs[0].id;
      Storage.set("activeApiId", activeApiId);
    }
    $("#modal-api-edit").classList.add("hidden");
    renderSettingsApiList();
  }

  // 根据服务商更新模型下拉选项（用于编辑弹窗）
  const editProviderSel = $("#edit-api-provider");
  if (editProviderSel) {
    editProviderSel.onchange = () => {
      const p = editProviderSel.value;
      updateEditModelOptions(p);
      toggleCustomFields(p);
    };
  }
  const editCustomModels = $("#edit-api-custommodels");
  if (editCustomModels) {
    editCustomModels.oninput = () => {
      updateEditModelOptions($("#edit-api-provider").value);
    };
  }

  // 设置面板标签切换
  function switchSettingsTab(tab) {
    $$('.settings-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    $$('.settings-panel').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== tab));
  }
  $$('.settings-tab').forEach(t => t.onclick = () => switchSettingsTab(t.dataset.tab));

  $("#btn-settings").onclick = () => {
    switchSettingsTab('api');
    renderSettingsApiList();
    $("#modal-settings").classList.remove("hidden");
  };
  $("#btn-add-api").onclick = () => openApiEdit();
  $("#btn-save-api").onclick = saveApiEdit;
  $("#btn-cancel-api").onclick = () => $("#modal-api-edit").classList.add("hidden");

  $("#btn-export").onclick = exportData;
  $("#btn-import").onclick = () => $("#import-file").click();
  $("#btn-template").onclick = downloadTemplate;
  $("#import-file").onchange = importData;
  $("#btn-reset").onclick = () => { if (confirm("确定重置所有数据？不可恢复！")) { localStorage.clear(); location.reload(); } };

  // 炸开
  $("#btn-rule-parse").onclick = doParse;
  $("#btn-rule-settings").onclick = openSplitSettings;
  $("#btn-save-split-rules").onclick = saveSplitRules;
  $("#parse-input").oninput = () => {};
  $("#btn-ai-parse").onclick = doAIParse;
  $("#btn-parse-all").onclick = () => {
    $$('#parse-result .tag-card[data-text]').forEach(card => canvasTags.push({ cn: card.dataset.text, en: card.dataset.en || undefined }));
    saveCanvas(); renderCanvas(); switchMode("paint");
  };
  $("#btn-parse-save").onclick = () => {
    const text = $("#parse-input").value.trim();
    if (!text) return alert("没有内容可保存");
    const h = Storage.get("parseHistory", []);
    h.push({ text, time: new Date().toISOString() });
    Storage.set("parseHistory", h.slice(-50)); alert("已保存");
  };

  // 🖼️ 图片反推
  $("#image-upload-area").onclick = () => $("#image-input").click();
  $("#image-input").onchange = (e) => handleImageUpload(e.target.files[0]);
  // 拖拽上传
  const uploadArea = $("#image-upload-area");
  uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.classList.add("dragover"); };
  uploadArea.ondragleave = () => uploadArea.classList.remove("dragover");
  uploadArea.ondrop = (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageUpload(file);
  };
  $("#btn-reverse").onclick = doReversePrompt;
  $("#btn-copy-reverse").onclick = copyReverseResult;
  $("#btn-reverse-to-parse").onclick = reverseToParse;

  // 炸开：卡片点击弹出候选
  $("#parse-result").onclick = (e) => {
    const card = e.target.closest(".tag-card[data-idx]");
    if (card) onParseCardClick(+card.dataset.idx);
  };
}

init();
