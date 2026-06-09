const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ========== 数据存储 ==========
const Storage = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};

// ========== 默认数据 ==========
const FAV_CAT_ID = -1;
const DEFAULT_CATEGORIES = [
  { id: FAV_CAT_ID, name: "收藏", icon: "⭐", fixed: true },
  { id: 1, name: "风格", icon: "🎨" }, { id: 2, name: "背景", icon: "🏞️" },
  { id: 3, name: "场景", icon: "🎭" }, { id: 4, name: "人物姿态", icon: "🧍" },
  { id: 5, name: "人物外貌", icon: "👤" }, { id: 6, name: "服装", icon: "👔" },
  { id: 7, name: "光影", icon: "💡" }, { id: 8, name: "色彩", icon: "🌈" },
  { id: 9, name: "镜头", icon: "📷" }, { id: 10, name: "特效", icon: "✨" },
  { id: 11, name: "画质", icon: "🏷️" },
];
const DEFAULT_TAGS = [
  { id: 1, categoryId: 1, cn: "赛博朋克" }, { id: 2, categoryId: 1, cn: "油画" },
  { id: 3, categoryId: 1, cn: "水彩" }, { id: 4, categoryId: 1, cn: "像素风" },
  { id: 5, categoryId: 1, cn: "宫崎骏风" }, { id: 6, categoryId: 7, cn: "霓虹灯光" },
  { id: 7, categoryId: 7, cn: "体积光" }, { id: 8, categoryId: 7, cn: "丁达尔效应" },
  { id: 9, categoryId: 11, cn: "8K超高清" }, { id: 10, categoryId: 11, cn: "超精细" },
  { id: 11, categoryId: 11, cn: "虚幻引擎" }, { id: 12, categoryId: 11, cn: "电影级" },
];

// ========== 状态 ==========
let categories = Storage.get("categories", DEFAULT_CATEGORIES);
let tags = Storage.get("tags", DEFAULT_TAGS);
let canvasTags = Storage.get("canvas", []);
let currentCatId = categories[0]?.id;
let showEn = false;
let nextId = Math.max(0, ...tags.map(t => t.id), ...categories.map(c => c.id)) + 1;

// 拖拽状态
let dragFromLibrary = null;
let catEditMode = false;

// 分类拖拽状态
let _catDrag = { active: false, el: null, idx: null, insertIdx: null };

// 词库拖拽状态
let _libDrag = { active: false, el: null, idx: null, insertIdx: null };

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

// 通用：计算间隙插入位置 + 更新光标和让位效果
// items: DOM 元素数组, mouseX/Y: 鼠标坐标, barName: 光标名称, dragIdx: 被拖元素索引
// 返回 insertIdx
function updateInsertBar(items, mouseX, mouseY, barName, dragIdx) {
  const bar = getBar(barName);

  let insertIdx = 0;
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    if (mouseX < r.left + r.width / 2) { insertIdx = i; break; }
    insertIdx = i + 1;
  }

  // 清除旧状态
  items.forEach(t => t.classList.remove('push-left', 'push-right'));
  bar.classList.remove('visible');

  // 没移动则隐藏
  if (insertIdx === dragIdx) { bar.style.display = 'none'; return insertIdx; }
  bar.style.display = '';
  bar.classList.add('visible');
  bar.style.position = 'fixed';

  if (insertIdx === 0) {
    const first = items[0];
    if (first) {
      const r = first.getBoundingClientRect();
      bar.style.left = (r.left - 6) + 'px';
      bar.style.top = (r.top + r.height / 2 - 18) + 'px';
    }
    items[0]?.classList.add('push-right');
  } else if (insertIdx >= items.length) {
    const last = items[items.length - 1];
    if (last) {
      const r = last.getBoundingClientRect();
      bar.style.left = (r.right + 6) + 'px';
      bar.style.top = (r.top + r.height / 2 - 18) + 'px';
    }
    items[items.length - 1]?.classList.add('push-left');
  } else {
    const leftEl = items[insertIdx - 1];
    const rightEl = items[insertIdx];
    if (leftEl && rightEl) {
      const lr = leftEl.getBoundingClientRect();
      bar.style.left = ((lr.right + rightEl.getBoundingClientRect().left) / 2 - 2.5) + 'px';
      bar.style.top = (lr.top + lr.height / 2 - 18) + 'px';
      leftEl.classList.add('push-left');
      rightEl.classList.add('push-right');
    }
  }
  return insertIdx;
}

function hideBar(name) {
  const bar = _bars[name];
  if (bar) { bar.classList.remove('visible'); bar.style.display = 'none'; }
}

// ========== 初始化 ==========
function init() {
  if (!categories.find(c => c.id === FAV_CAT_ID)) {
    categories.unshift({ id: FAV_CAT_ID, name: "收藏", icon: "⭐", fixed: true });
    Storage.set("categories", categories);
  }
  currentCatId = currentCatId || categories[0]?.id;
  renderTabs(); renderLibrary(); renderCanvas();
  bindEvents();
  initResize();
  initCatDragListeners(); // 分类拖拽的 document 级事件只绑一次
  initLibDragListeners(); // 词库拖拽的 document 级事件只绑一次
}

// ========== 渲染 ==========
function renderTabs() {
  const el = $("#category-tabs");
  const bar = el.parentElement;
  bar.classList.toggle("cat-edit-mode", catEditMode);

  el.innerHTML = categories.map(c => {
    const cls = ["tab"];
    if (c.id === currentCatId) cls.push("active");
    if (c.fixed) cls.push("fixed");

    const actions = catEditMode && !c.fixed
      ? `<span class="cat-actions">
           <button class="btn-cat-edit" data-id="${c.id}">✏️</button>
           <button class="btn-cat-del" data-id="${c.id}">✕</button>
         </span>`
      : "";

    return `<div class="${cls.join(' ')}" data-id="${c.id}">
      <span class="tab-icon">${c.icon}</span>${c.name}${actions}
    </div>`;
  }).join("") + (catEditMode
    ? `<div class="tab tab-add" id="btn-add-cat"><span class="tab-add">+ 新增</span></div>`
    : "");

  bindTabMouseDrag(); // 改用鼠标拖拽
  bindCatEditActions();
}

function renderLibrary() {
  const kw = $("#search-input").value.trim().toLowerCase();
  let list;
  if (currentCatId === FAV_CAT_ID) {
    list = tags.filter(t => t.favorited && (!kw || t.cn.includes(kw)));
  } else {
    list = tags.filter(t => t.categoryId === currentCatId && (!kw || t.cn.includes(kw)));
  }
  const el = $("#tag-grid");
  if (list.length === 0 && kw) {
    el.innerHTML = `<div style="width:100%;text-align:center;color:#94a3b8;padding:20px;">无匹配结果</div>`;
    bindCardEvents(); return;
  }
  el.innerHTML = list.map((t, i) =>
    `<div class="tag-card ${t.favorited ? 'favorited' : ''}" data-id="${t.id}" data-idx="${i}">
      <span class="fav-dot"></span>
      <span class="cn">${t.cn}</span>
      <div class="actions">
        <button class="btn-fav ${t.favorited ? 'active' : ''}" data-id="${t.id}">★</button>
        <button class="btn-edit" data-id="${t.id}">✏️</button>
        <button class="btn-delete" data-id="${t.id}">🗑️</button>
      </div>
    </div>`
  ).join("");
  bindCardEvents();
  bindLibraryDrag();
}

function renderCanvas() {
  const el = $("#tag-canvas");
  el.innerHTML = canvasTags.map((t, i) =>
    `<div class="tag-chip" data-idx="${i}">
      ${showEn && t.en ? t.en : t.cn}<span class="remove" data-idx="${i}">×</span>
    </div>`
  ).join("");
  bindCanvasMouseDrag();
}

// ========== 分类 Tab 拖拽排序（间隙插入模式）==========

// 创建竖条光标元素（挂到 body，避免被父容器 overflow 裁剪）
function ensureInsertBar() {
  getBar('category'); // 预创建
}

function bindTabMouseDrag() {
  ensureInsertBar();
  const allTabs = $$('.tab[data-id]');

  allTabs.forEach((tab, idx) => {
    if (tab.classList.contains('fixed')) {
      tab.onmousedown = null;
      tab.style.cursor = 'default';
      return;
    }

    tab.style.cursor = catEditMode ? 'grab' : 'pointer';

    tab.onmousedown = (e) => {
      if (!catEditMode || e.button !== 0) return;
      if (e.target.closest('.cat-actions')) return;
      e.preventDefault();

      _catDrag.active = true;
      _catDrag.el = tab;
      _catDrag.idx = idx;
      _catDrag.insertIdx = idx; // 默认在原位置

      tab.classList.add('is-dragging');
    };
  });
}

function initCatDragListeners() {
  let rafId = null;

  document.addEventListener('mousemove', (e) => {
    if (!_catDrag.active || !_catDrag.el) return;

    // 用 rAF 节流，避免卡顿
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updateCatDragPosition(e.clientX, e.clientY);
    });
  }, { passive: true });

  document.addEventListener('mouseup', () => {
    if (!_catDrag.active) return;
    _catDrag.active = false;

    // 清理所有视觉状态
    clearCatDragVisuals();

    // 执行排序
    if (_catDrag.el && _catDrag.insertIdx !== null && _catDrag.insertIdx !== _catDrag.idx) {
      const srcId = +_catDrag.el.dataset.id;
      const srcIdx = categories.findIndex(c => c.id === srcId);

      if (srcIdx >= 0) {
        let dstIdx = _catDrag.insertIdx;
        // 补偿：如果往右拖且目标在源右边，需要-1（因为还没真正移除）
        if (dstIdx > srcIdx) dstIdx--;

        const [moved] = categories.splice(srcIdx, 1);
        categories.splice(Math.max(0, Math.min(dstIdx, categories.length)), 0, moved);
        Storage.set("categories", categories);
        renderTabs();
      }
    }

    _catDrag.el = null;
    _catDrag.idx = null;
    _catDrag.insertIdx = null;
  });
}

// 核心：计算鼠标位置对应的插入索引，更新视觉效果（使用通用光标）
function updateCatDragPosition(mouseX, mouseY) {
  const tabsEl = document.getElementById('category-tabs');
  const tabs = [...tabsEl.querySelectorAll('.tab[data-id]')];

  let insertIdx = 0;
  for (let i = 0; i < tabs.length; i++) {
    const r = tabs[i].getBoundingClientRect();
    if (mouseX < r.left + r.width / 2) { insertIdx = i; break; }
    insertIdx = i + 1;
  }

  // 固定分类不能被跨越
  const firstFixedIdx = categories.findIndex(c => c.fixed);
  if (firstFixedIdx >= 0 && insertIdx <= firstFixedIdx) insertIdx = firstFixedIdx + 1;

  _catDrag.insertIdx = insertIdx;
  updateInsertBar(tabs, mouseX, mouseY, 'category', _catDrag.idx);
}

function clearCatDragVisuals() {
  $$('.tab[data-id]').forEach(t => {
    t.classList.remove('is-dragging', 'push-left', 'push-right');
    t.style.opacity = '';
    t.style.zIndex = '';
    t.style.transform = '';
    t.style.boxShadow = '';
  });
  hideBar('category');
}

// ========== 分类编辑操作（删除/编辑）==========
function bindCatEditActions() {
  // 删除分类
  $$('.btn-cat-del').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const id = +b.dataset.id;
    const cat = categories.find(c => c.id === id);
    const tagCount = tags.filter(t => t.categoryId === id).length;
    let msg = `确定删除分类 "${cat?.name}" 吗？`;
    if (tagCount > 0) msg += `\n该分类下有 ${tagCount} 个提示词，将一并删除。`;
    openConfirm(msg, () => {
      tags = tags.filter(t => t.categoryId !== id);
      categories = categories.filter(c => c.id !== id);
      Storage.set("tags", tags); Storage.set("categories", categories);
      if (currentCatId === id) currentCatId = categories[0]?.id || FAV_CAT_ID;
      renderTabs(); renderLibrary();
    });
  });

  // 编辑分类
  $$('.btn-cat-edit').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const id = +b.dataset.id;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const name = prompt("修改分类名称:", cat.name);
    if (name && name.trim()) cat.name = name.trim();
    const icon = prompt("修改图标 emoji:", cat.icon);
    if (icon && icon.trim()) cat.icon = icon.trim();
    Storage.set("categories", categories); renderTabs();
  });
}

// ========== 词库卡片事件 ==========
function bindCardEvents() {
  $$('.tag-card[data-id]').forEach(card => {
    // 单击加入画布
    card.onclick = (e) => {
      if (e.target.closest('.actions')) return;
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
    openConfirm(`确定删除 "${tags.find(t => t.id === +b.dataset.id)?.cn}" 吗？`, () => {
      tags = tags.filter(t => t.id !== +b.dataset.id); Storage.set("tags", tags); renderLibrary();
    });
  });
}

// ========== 词库鼠标拖拽（统一绿色竖条光标）==========
function bindLibraryDrag() {
  const cards = $$('.tag-card[data-id]');

  cards.forEach((card, idx) => {
    card.onmousedown = (e) => {
      if (e.button !== 0 || e.target.closest('.actions')) return;
      e.preventDefault();

      _libDrag.active = true;
      _libDrag.el = card;
      _libDrag.idx = idx;
      _libDrag.insertIdx = idx;

      card.classList.add('is-dragging');
      dragFromLibrary = +card.dataset.id;
    };
  });
}

function initLibDragListeners() {
  let rafId = null;

  document.addEventListener('mousemove', (e) => {
    if (!_libDrag.active || !_libDrag.el) return;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updateLibDragPosition(e.clientX, e.clientY);
    });
  }, { passive: true });

  document.addEventListener('mouseup', (e) => {
    if (!_libDrag.active) return;
    _libDrag.active = false;

    clearLibDragVisuals();

    // 检查是否释放在画布区域 → 加入画布
    const canvasRect = $("#tag-canvas").getBoundingClientRect();
    if (e.clientX >= canvasRect.left && e.clientX <= canvasRect.right &&
        e.clientY >= canvasRect.top && e.clientY <= canvasRect.bottom) {
      const t = tags.find(x => x.id === dragFromLibrary);
      if (t) { canvasTags.push({ cn: t.cn, en: t.en }); saveCanvas(); renderCanvas(); }
    } else if (_libDrag.insertIdx !== null && _libDrag.insertIdx !== _libDrag.idx) {
      // 词库内排序
      executeLibSort();
    }

    _libDrag.el = null; _libDrag.idx = null; _libDrag.insertIdx = null;
    dragFromLibrary = null;
  });
}

function updateLibDragPosition(mouseX, mouseY) {
  const cards = $$('.tag-card[data-id]');
  _libDrag.insertIdx = updateInsertBar(cards, mouseX, mouseY, 'library', _libDrag.idx);
}

function clearLibDragVisuals() {
  $$('.tag-card[data-id]').forEach(c => {
    c.classList.remove('is-dragging', 'push-left', 'push-right');
  });
  hideBar('library');
}

function executeLibSort() {
  // 获取当前视图列表
  const kw = $("#search-input").value.trim().toLowerCase();
  let viewList;
  if (currentCatId === FAV_CAT_ID) {
    viewList = tags.filter(t => t.favorited && (!kw || t.cn.includes(kw)));
  } else {
    viewList = tags.filter(t => t.categoryId === currentCatId && (!kw || t.cn.includes(kw)));
  }

  const srcIdx = _libDrag.idx;
  let dstIdx = _libDrag.insertIdx;
  if (dstIdx > srcIdx) dstIdx--;

  const [moved] = viewList.splice(srcIdx, 1);
  viewList.splice(Math.max(0, Math.min(dstIdx, viewList.length)), 0, moved);

  // 写回完整数组（保持非视图项顺序不变）
  const viewIds = new Set(viewList.map(t => t.id));
  tags = [...tags.filter(t => !viewIds.has(t.id)), ...viewList];
  Storage.set("tags", tags);
  renderLibrary();
}

// ========== 画布鼠标拖拽（统一绿色竖条光标）==========
function bindCanvasMouseDrag() {
  const canvas = $("#tag-canvas");

  let _canvasDrag = { active: false, el: null, idx: null, insertIdx: null };

  $$('.tag-chip').forEach((chip, idx) => {
    chip.onmousedown = (e) => {
      if (e.button !== 0 || e.target.classList.contains('remove')) return;
      e.preventDefault();

      _canvasDrag.active = true;
      _canvasDrag.el = chip;
      _canvasDrag.idx = idx;
      _canvasDrag.insertIdx = idx;

      chip.classList.add('is-dragging');
    };
  });

  // document 级事件（只绑一次，通过闭包捕获 _canvasDrag）
  if (!bindCanvasMouseDrag._bound) {
    bindCanvasMouseDrag._bound = true;

    let rafId = null;

    document.addEventListener('mousemove', (e) => {
      if (!_canvasDrag.active || !_canvasDrag.el) return;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const chips = $$('.tag-chip');
        _canvasDrag.insertIdx = updateInsertBar(chips, e.clientX, e.clientY, 'canvas', _canvasDrag.idx);
      });
    }, { passive: true });

    document.addEventListener('mouseup', () => {
      if (!_canvasDrag.active) return;
      _canvasDrag.active = false;

      // 清理视觉
      $$('.tag-chip').forEach(c => c.classList.remove('is-dragging', 'push-left', 'push-right'));
      hideBar('canvas');

      // 执行排序
      if (_canvasDrag.insertIdx !== null && _canvasDrag.insertIdx !== _canvasDrag.idx) {
        let dstIdx = _canvasDrag.insertIdx;
        if (dstIdx > _canvasDrag.idx) dstIdx--;

        const [moved] = canvasTags.splice(_canvasDrag.idx, 1);
        canvasTags.splice(Math.max(0, Math.min(dstIdx, canvasTags.length)), 0, moved);
        saveCanvas();
        renderCanvas();
      }

      _canvasDrag.el = null; _canvasDrag.idx = null; _canvasDrag.insertIdx = null;
    });
  }

  // 删除按钮
  $$('.tag-chip .remove').forEach(x => x.onclick = (e) => {
    e.stopPropagation();
    canvasTags.splice(+x.dataset.idx, 1); saveCanvas(); renderCanvas();
  });
}

// ========== Canvas 区域大小调整 ==========
function initResize() {
  const area = $("#canvas-area");
  const handle = $("#resize-handle");
  let startY, startHeight, isResizing = false;

  handle.onmousedown = (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = area.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = e.clientY - startY;
    const newHeight = Math.max(180, startHeight + delta);
    // 限制最大高度不超过窗口的 70%
    const maxH = window.innerHeight * 0.7;
    area.style.flex = 'none';
    area.style.height = Math.min(newHeight, maxH) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// ========== 功能函数 ==========
function switchMode(mode) {
  $("#btn-paint").classList.toggle("active", mode === "paint");
  $("#btn-parse-mode").classList.toggle("active", mode === "parse");
  $("#paint-mode").classList.toggle("hidden", mode !== "paint");
  $("#parse-mode").classList.toggle("hidden", mode === "paint");
  if (mode === "parse") doParse();
}

function saveCanvas() { Storage.set("canvas", canvasTags); }

// 翻译：只影响画布！
function translateToggle() {
  showEn = !showEn;
  renderCanvas(); // ← 只渲染画布，不碰词库
}

function copyCanvas() {
  if (canvasTags.length === 0) { alert("画布为空"); return; }
  const text = canvasTags.map(t => showEn ? (t.en || t.cn) : t.cn).join(", ");
  navigator.clipboard.writeText(text).then(() =>
    alert("已复制: " + text.slice(0, 60) + (text.length > 60 ? "..." : ""))
  ).catch(() => alert("复制失败"));
}

let confirmDeleteFn = null;
function openConfirm(msg, fn) { $("#confirm-msg").textContent = msg; confirmDeleteFn = fn; $("#modal-confirm").classList.remove("hidden"); }
function closeModals() { $$('.modal').forEach(m => m.classList.add("hidden")); }

let editingTagId = null;
function openTagModal(handwrite, id) {
  editingTagId = id || null;
  $("#tag-modal-title").textContent = id ? "编辑提示词" : "添加提示词";
  const t = id ? tags.find(x => x.id === id) : null;
  $("#input-cn").value = t?.cn || "";
  $("#modal-tag").classList.remove("hidden");
}
function confirmTag() {
  const cn = $("#input-cn").value.trim();
  if (!cn) return alert("不能为空");
  if (editingTagId) {
    const t = tags.find(x => x.id === editingTagId);
    if (t) t.cn = cn;
  } else {
    tags.push({ id: nextId++, categoryId: currentCatId, cn });
  }
  Storage.set("tags", tags); renderTabs(); renderLibrary(); closeModals();
}
function openAddCategory() {
  const name = prompt("分类名称:"); if (!name) return;
  const icon = prompt("图标 emoji:") || "📁";
  categories.push({ id: nextId++, name, icon });
  Storage.set("categories", categories); renderTabs();
}

// ========== 炸开解析 ==========
function doParse() {
  const text = $("#parse-input").value.trim();
  if (!text) return $("#parse-result").innerHTML = "";

  const byComma = $("#opt-comma").checked, bySpace = $("#opt-space").checked;
  let parts = byComma ? text.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    : bySpace ? text.split(/\s+/).filter(Boolean)
    : [text];

  const el = $("#parse-result");
  el.innerHTML = parts.map(p => {
    const exist = tags.find(t => t.cn === p);
    return `<div class="tag-card ${exist ? 'existing' : ''}" data-text="${p}">
      <span class="cn">${p}</span><span style="font-size:11px;color:#94a3b8;margin-left:4px">${exist ? "已有" : ""}</span>
    </div>`;
  }).join("");

  $$('#parse-result .tag-card:not(.existing)').forEach(card => {
    card.onclick = () => {
      card.classList.toggle("selected");
      if (card.classList.contains("selected")) {
        const sel = document.createElement("select");
        sel.style.cssText = "margin-top:2px;background:var(--bg);border:1px solid var(--accent);color:var(--text);padding:2px 6px;border-radius:4px;font-size:11px;";
        sel.innerHTML = categories.filter(c => c.id !== FAV_CAT_ID).map(c => `<option value="${c.id}">${c.icon}${c.name}</option>`).join("");
        sel.onchange = () => {
          tags.push({ id: nextId++, categoryId: +sel.value, cn: card.dataset.text });
          Storage.set("tags", tags);
          card.classList.remove("selected"); card.classList.add("existing");
          card.lastChild.textContent = "已入库"; sel.remove();
        };
        card.appendChild(sel);
      }
    };
  });
}

// 导入导出
function exportData() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ categories, tags, canvas: canvasTags }, null, 2)], { type: "application/json" }));
  a.download = `prompt-forge-${new Date().toISOString().slice(0,10)}.json`; a.click();
}
function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (d.categories) { categories = d.categories; Storage.set("categories", categories); }
      if (d.tags) { tags = d.tags; Storage.set("tags", tags); }
      if (d.canvas) { canvasTags = d.canvas; Storage.set("canvas", canvasTags); }
      location.reload();
    } catch { alert("文件格式错误"); }
  }; r.readAsText(f);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ========== 事件绑定入口 ==========
function bindEvents() {
  $("#btn-paint").onclick = () => switchMode("paint");
  $("#btn-parse-mode").onclick = () => switchMode("parse");

  $("#category-tabs").onclick = (e) => {
    // 新增按钮（仅编辑模式可见，始终可点）
    if (e.target.closest("#btn-add-cat")) { openAddCategory(); return; }
    // 编辑模式下不响应分类切换
    if (catEditMode) return;
    const tab = e.target.closest(".tab[data-id]");
    if (tab) { currentCatId = +tab.dataset.id; renderTabs(); renderLibrary(); }
  };

  // 分类编辑模式切换
  $("#btn-edit-cats").onclick = () => {
    catEditMode = !catEditMode;
    $("#btn-edit-cats").classList.toggle("active", catEditMode);
    $("#btn-edit-cats").textContent = catEditMode ? "✕" : "✏️";
    renderTabs();
  };

  $("#search-input").oninput = renderLibrary;
  $("#btn-add-tag").onclick = () => openTagModal();

  // 工具栏（在画布内右下角）
  $("#btn-translate").onclick = translateToggle;
  $("#btn-copy").onclick = copyCanvas;
  $("#btn-clear").onclick = () => { if (confirm("确定清空画布吗？")) { canvasTags = []; saveCanvas(); renderCanvas(); } };

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
  $("#modal-confirm .btn-danger").onclick = () => { confirmDeleteFn?.(); closeModals(); };

  // 设置
  $("#btn-settings").onclick = () => $("#modal-settings").classList.remove("hidden");
  $("#btn-export").onclick = exportData;
  $("#btn-import").onclick = () => $("#import-file").click();
  $("#import-file").onchange = importData;
  $("#btn-reset").onclick = () => { if (confirm("确定重置所有数据？不可恢复！")) { localStorage.clear(); location.reload(); } };

  // 炸开
  $("#parse-input").oninput = $("#opt-comma").onchange = $("#opt-space").onchange = debounce(doParse, 300);
  $("#btn-parse-all").onclick = () => {
    $$('#parse-result .tag-card[data-text]').forEach(card => canvasTags.push({ cn: card.dataset.text }));
    saveCanvas(); renderCanvas(); switchMode("paint");
  };
  $("#btn-parse-save").onclick = () => {
    const text = $("#parse-input").value.trim();
    if (!text) return alert("没有内容可保存");
    const h = Storage.get("parseHistory", []);
    h.push({ text, time: new Date().toISOString() });
    Storage.set("parseHistory", h.slice(-50)); alert("已保存");
  };
}

init();
