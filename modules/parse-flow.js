/* ============================================================
   炸开解析流程：规则/AI 拆分 / 匹配着色 / 向量匹配 / 卡片操作
   依赖 modules/parser.js、modules/api.js、modules/ui.js
   与 app.js 运行时全局（tags/categories/canvasTags/renderCanvas）
   ============================================================ */

// ========== 炸开解析 ==========
const PLACEHOLDER_HTML = '<span class="prompt-placeholder">拆分后的标签将在这里显示...</span>';

// 拆分规则设置弹窗
function openSplitSettings() {
  const current = Storage.get("promptForge.splitDelimiters", [",", "，"]);
  document.querySelectorAll('.split-preset input').forEach(cb => {
    cb.checked = current.includes(cb.dataset.delim);
  });
  const preset = [...document.querySelectorAll('.split-preset input')].map(cb => cb.dataset.delim);
  $("#split-delim-input").value = current.filter(d => !preset.includes(d)).join("\n");
  $("#modal-split-settings").classList.remove("hidden");
}
function saveSplitRules() {
  const presets = [...document.querySelectorAll('.split-preset input:checked')].map(cb => cb.dataset.delim);
  const raw = $("#split-delim-input").value.trim();
  const custom = raw ? raw.split("\n").map(s => s.trim()).filter(Boolean) : [];
  const list = [...new Set([...presets, ...custom])];
  Storage.set("promptForge.splitDelimiters", [...new Set(list)]);
  closeModals();
}


function doParse(skipAICheck) {
  if (!skipAICheck && window._isAIMode) return;
  const text = $("#parse-input").value.trim();
  if (!text) { _parseAtoms = []; $("#parse-result").innerHTML = PLACEHOLDER_HTML; $("#parse-stats").textContent = ""; $("#parse-stats").classList.add("hidden"); return; }

  const delimiters = Storage.get("promptForge.splitDelimiters", [",", "，"]);
  _parseAtoms = splitPrompt(text, delimiters).map(s => ({ cn: s }));
  _parseAtoms.forEach(a => { a.match = matchAtom(a, tags); });
  renderParseResult();
}

// ========== 数据导出/导入（统一 JSON 格式）==========

// AI 语义拆分：调 LLM 将提示词拆成标签
async function doAIParse() {
  const text = $("#parse-input").value.trim();
  if (!text) return showToast("请先输入提示词", "info");
  // AI 拆分前取消 pending 的规则拆分 debounce，避免结果被覆盖
  if (typeof window._cancelParseDebounce === "function") window._cancelParseDebounce();
  const loading = $("#ai-loading");
  const btn = $("#btn-ai-parse");
  loading.classList.remove("hidden");
  btn.classList.add("loading");
  try {
    const bigCats = categories.filter(c => c.parentId == null && !c.fixed);
    const catNames = bigCats.map(c => c.name).join("、");
    // 构建完整分类树参考：每个大类下的所有子标签
    const catTree = bigCats.map(function(c) {
      const subs = categories.filter(function(s) { return s.parentId === c.id; }).map(function(s) { return s.name; });
      return c.name + "：" + (subs.length ? subs.join("、") : "（暂无子标签）");
    }).join("\n");
    const _sysPrompt = "你是一个提示词拆解专家。请将用户输入的提示词文本拆解为独立的语义标签词。" +
      "\n\n### 现有标签库参考（分类树）\n" + catTree +
      "\n\n### 要求" +
      "\n1. 从输入文本中提取每个独立的语义单元作为标签" +
      "\n2. 每个标签必须归入上面分类树中**最匹配的大类**（第一个层级）" +
      "\n3. 如果标签与现有子标签高度相似，优先使用现有子标签的 cn" +
      "\n4. 返回格式必须是 JSON 数组，仅输出 JSON，不要其他文字：" +
      '\n{ "tags": [{"cn": "标签中文名", "category": "大类名"}] }' +
      "\n5. category 必须是以下之一：" + catNames +
      "\n6. 去除重复和无意义的通用词";
    const { content, error } = await callOpenAI([
      { role: "system", content: _sysPrompt },
      { role: "user", content: text },
    ], { model: apiConfig.model });
    if (error) { showToast("AI 解析失败: " + error, "error"); return; }
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
    if (!list.length) { showToast("AI 未能解析出标签，请重试", "error"); return; }
    // 补大类 id（支持模糊匹配：trim、包含关系）
    list.forEach(function(a) {
      let match = categories.filter(function(c) { return c.parentId == null && !c.fixed; }).find(function(c) {
        const catName = (a.category || "").trim();
        return c.name === catName || c.name.indexOf(catName) !== -1 || catName.indexOf(c.name) !== -1;
      });
      a._bigId = match ? match.id : UNCAT_ID;
    });
    _parseAtoms = list;
    _parseAtoms.forEach(a => { a.match = matchAtom(a, tags); });
    window._isAIMode = true;
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



// 渲染当前 _parseAtoms 到 #parse-result，按匹配状态着色 + 统计 + 大类徽标 + 批次条
function renderParseResult() {
  const counts = { EXACT: 0, CONTAINS: 0, SIMILAR: 0, NEW: 0 };
  _parseAtoms.forEach(a => counts[a.match.status]++);
  const total = _parseAtoms.length;
  const _statsEl = $("#parse-stats");
  _statsEl.innerHTML = total
    ? `共 ${total} 个：<span class="st-exact">已有 ${counts.EXACT}</span> · <span class="st-similar">相似 ${counts.SIMILAR}</span> · <span class="st-contains">近似 ${counts.CONTAINS}</span> · <span class="st-new">新词 ${counts.NEW}</span>`
    : "";
  _statsEl.classList.toggle("hidden", !total);
  $("#parse-result").innerHTML = total ? _parseAtoms.map((a, i) => {
    const m = a.match;
    const simTxt = m.sim ? ` ${(m.sim * 100).toFixed(0)}%` : "";
    // 大类徽标：仅 AI 拆分时有 _bigId
    const catBadge = a._bigId ? (() => { const c = categories.find(x => x.id === a._bigId); return c ? `<span class="cat-badge">${renderIcon(c.icon)} ${escapeHtml(c.name)}</span>` : ""; })() : "";
    return `<div class="tag-card ${m.status.toLowerCase()}" data-idx="${i}" data-text="${escapeHtml(a.cn)}"${a.en ? ` data-en="${escapeHtml(a.en)}"` : ""}>
      ${catBadge}<span class="cn">${escapeHtml(a.cn)}</span>${a.en ? `<span class="en">${escapeHtml(a.en)}</span>` : ""}
      <span class="badge">${STATUS_LABEL[m.status]}${simTxt}</span>
      <button class="btn-parse-remove" title="移除"><svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 14L34 34" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 34L34 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>`;
  }).join("") : PLACEHOLDER_HTML;

  // 批次条：常驻，不再隐藏 — 显示数据 + 控制按钮 disabled
  const addable = _parseAtoms.filter(a => a.match.status !== "EXACT");
  const btn = $("#btn-parse-batch-add");
  const cbtn = $("#btn-parse-batch-clear");
  const info = $("#parse-batch-info");
  const hasItems = addable.length > 0;

  // 实时显示可入库数据
  if (info) {
    info.textContent = `可入库 ${addable.length} 个（已有 ${counts.EXACT} 个已存在）`;
  }

  // 一键入库只在有可用项时可点击
  btn.disabled = !hasItems;
  if (hasItems) {
    btn.onclick = () => {
      addable.forEach(a => {
        tags.push({ id: nextId++, categoryId: a._bigId || currentCatId, cn: a.cn, en: a.en });
      });
      Storage.set("tags", tags);
      renderTabs(); renderLibrary();
      // 重新匹配已入库的 atom
      _parseAtoms.forEach(a => { a.match = matchAtom(a, tags); });
      renderParseResult();
    };
  } else {
    btn.onclick = null;
  }

  // 清空按钮始终可点击
  if (cbtn) {
    cbtn.disabled = false;
    cbtn.onclick = () => {
      _parseAtoms = [];
      document.getElementById("parse-result").innerHTML = PLACEHOLDER_HTML;
      document.getElementById("parse-stats").textContent = "";
      document.getElementById("parse-stats").classList.add("hidden");
      renderParseResult();
    };
  }
}

// 向量余弦相似度
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
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
  if (!_parseAtoms.length) return showToast("请先拆分提示词", "info");
  if (!supportsEmbedding()) return showToast("当前服务商不支持向量匹配", "info");
  if (!getActiveConfig()?.key) return showToast("请先在设置中配置 API 密钥 🔑", "info");
  const loading = $("#ai-loading");
  loading.classList.remove("hidden");
  try {
    const sync = await syncEmbeddingCache();
    if (sync.error) { showToast("向量匹配失败：" + sync.error, "error"); return; }
    const pending = _parseAtoms.filter(a => a.match.status !== "EXACT");
    if (pending.length) {
      const { vectors, error } = await callEmbedding(pending.map(a => a.cn || a.en));
      if (error) { showToast("向量匹配失败：" + error, "error"); return; }
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
        <span class="cat">${cat ? renderIcon(cat.icon) + " " + cat.name : ""}</span>${sim}
      </li>`;
    }).join("");
  }
  const addBtn = $("#btn-similar-add");
  if (m.status === "EXACT") { addBtn.classList.add("hidden"); }
  else {
    addBtn.classList.remove("hidden");
    addBtn.onclick = () => addAtomFromParse(idx);
  }
  // 初始化分类下拉，默认选中 AI 匹配的大类
  const sel = $("#similar-cat-select");
  sel.innerHTML = "";
  const items = [];
  categories.filter(function(c) { return c.parentId == null && c.id !== FAV_CAT_ID; }).forEach(function(big) {
    items.push({ value: big.id, icon: big.icon, label: big.name + "（未分组）", depth: 0 });
    categories.filter(function(c) { return c.parentId === big.id; }).forEach(function(sub) {
      items.push({ value: sub.id, icon: sub.icon, label: sub.name, depth: 1 });
    });
  });
  buildCatSelect(sel, items, a._bigId || null, null);
  $("#modal-similar").classList.remove("hidden");
}

// 把当前拆分标签加入词库（弹窗内选分类）
function addAtomFromParse(idx) {
  const a = _parseAtoms[idx];
  if (!a) return;
  const sel = $("#similar-cat-select");
  sel.innerHTML = '';
  const items = [];
  categories.filter(c => c.parentId == null && c.id !== FAV_CAT_ID).forEach(big => {
    items.push({ value: big.id, icon: big.icon, label: big.name + '（未分组）', depth: 0 });
    categories.filter(c => c.parentId === big.id).forEach(sub => {
      items.push({ value: sub.id, icon: sub.icon, label: sub.name, depth: 1 });
    });
  });
  buildCatSelect(sel, items, a._bigId || null, (val) => {
    const added = { id: nextId++, categoryId: +val, cn: a.cn, en: a.en };
    tags.push(added);
    Storage.set("tags", tags);
    sel.style.display = 'none';
    closeModals();
    a.match = { status: "EXACT", matched: added, candidates: [added] };
    renderTabs(); renderLibrary(); renderParseResult();
  });
}


