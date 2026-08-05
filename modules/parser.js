/* ============================================================
   提示词处理纯逻辑：默认提示词配置 / 分隔符拆分 / 标签匹配 / 模糊搜索
   只依赖 modules/storage.js 中的 Storage，无 DOM 副作用
   ============================================================ */

const DEFAULT_PROMPTS = {
  reverse: "你是一个提示词反推专家。根据用户提供的图片，分析其风格、主体、光影、色彩、构图等要素，生成一个完整的提示词。",
  parse: '你是一个提示词分析助手。将用户的提示词文本拆解为语义独立的标签词，并标注各标签所属大类。\n要求：\n1. 每个标签是一个独立的语义单元\n2. 返回 JSON 格式：{ "tags": [{ "cn": "...", "en": "...", "category": "大类名" }] }\n3. 去除重复和无意义的通用词',
};
function getPromptConfig(key) {
  const saved = Storage.get("promptConfig");
  return (saved && saved[key]) || DEFAULT_PROMPTS[key];
}
function setPromptConfig(key, val) {
  const saved = Storage.get("promptConfig", {});
  saved[key] = val;
  Storage.set("promptConfig", saved);
}

// 共享规则拆分：按自定义分隔符列表拆分文本
function splitPrompt(text, delimiters) {
  if (!text || !Array.isArray(delimiters) || !delimiters.length) return [];
  const escaped = delimiters.map(d => d === ' ' ? '\\s' : d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`[${escaped.join('')}]+`);
  return [...new Set(text.split(re).map(s => s.trim()).filter(Boolean))];
}

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
