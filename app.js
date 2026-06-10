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
let libEditMode = false;

// API 配置
const API_PROVIDERS = {
  openai: { baseURL: "https://api.openai.com/v1", supportsVision: true, name: "OpenAI" },
  xiaomi: { baseURL: "https://api.xiaomimimo.com/v1", supportsVision: true, name: "小米 MiMo" },
};
const PROVIDER_MODELS = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o-mini" },
  ],
  xiaomi: [
    { value: "mimo-v2.5", label: "mimo-v2.5" },
  ],
};
let apiConfig = Storage.get("apiConfig", { key: "", model: "gpt-4o-mini", provider: "openai" });
if (!apiConfig.provider) apiConfig.provider = "openai";

// 三区拖拽共享状态结构：{ active, ghost, el, idx, insertIdx, startX, startY, origLeft, origTop, latestX, latestY }
let _catDrag = { active: false, ghost: null, el: null, idx: null, insertIdx: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, latestX: 0, latestY: 0 };
let _libDrag = { active: false, ghost: null, el: null, idx: null, insertIdx: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, latestX: 0, latestY: 0 };
let _canvasDrag = { active: false, ghost: null, el: null, idx: null, insertIdx: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, latestX: 0, latestY: 0 };

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
  currentCatId = currentCatId || categories[0]?.id;
  renderTabs(); renderLibrary(); renderCanvas();
  bindEvents();
  initResize();
  initDragDelegation(); // 事件委托：三区 mousedown 统一处理
  initCatDragListeners(); // 分类拖拽 document 级 mousemove/mouseup
  initLibDragListeners(); // 词库拖拽 document 级 mousemove/mouseup
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
  }).join("");

  // 新增按钮始终在右侧按钮区，不受滚动影响
  const addBtn = document.getElementById('btn-add-cat');
  addBtn.classList.toggle('hidden', !catEditMode);

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
  el.classList.toggle("lib-edit-mode", libEditMode);
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
}

function renderCanvas() {
  const el = $("#tag-canvas");
  el.innerHTML = canvasTags.map((t, i) =>
    `<div class="tag-chip${t.silent ? ' silent' : ''}" data-idx="${i}">
      ${showEn && t.en ? t.en : t.cn}<span class="remove" data-idx="${i}">×</span>
    </div>`
  ).join("");
  bindCanvasMouseDrag();
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

    // 缩小 placeholder
    if (_catDrag.el) _catDrag.el.classList.add('shrink-placeholder');

    // 快照排序所需数据
    const el = _catDrag.el;
    const insertIdx = _catDrag.insertIdx;
    const idx = _catDrag.idx;
    _catDrag.el = null; _catDrag.idx = null; _catDrag.insertIdx = null;

    // 移除让位效果 + 隐藏插入条
    $$('.tab[data-id]').forEach(t => t.classList.remove('push-left', 'push-right'));
    hideBar('category');

    setTimeout(() => {
      if (el && insertIdx !== null && insertIdx !== idx) {
        const srcId = +el.dataset.id;
        const srcIdx = categories.findIndex(c => c.id === srcId);
        if (srcIdx >= 0) {
          let dstIdx = insertIdx;
          if (dstIdx > srcIdx) dstIdx--;
          const [moved] = categories.splice(srcIdx, 1);
          categories.splice(Math.max(0, Math.min(dstIdx, categories.length)), 0, moved);
          Storage.set("categories", categories);
        }
      }
      renderTabs();
    }, 350);
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

  const firstFixedIdx = categories.findIndex(c => c.fixed);
  if (firstFixedIdx >= 0 && insertIdx <= firstFixedIdx) insertIdx = firstFixedIdx + 1;

  _catDrag.insertIdx = insertIdx;

  // 检测真实拖动（区分点击和拖拽）
  if (!_catDrag.wasMoved && (Math.abs(mouseX - _catDrag.startX) > 5 || Math.abs(mouseY - _catDrag.startY) > 5)) {
    _catDrag.wasMoved = true;
  }

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
    openConfirm(`确定删除 "${tags.find(t => t.id === +b.dataset.id)?.cn}" 吗？`, () => {
      tags = tags.filter(t => t.id !== +b.dataset.id); Storage.set("tags", tags); renderLibrary();
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
      // 编辑模式：拖拽排序（不向画布添加）
      if (_libDrag.el) _libDrag.el.classList.add('shrink-placeholder');
      const idx = _libDrag.idx;
      const insertIdx = _libDrag.insertIdx;
      _libDrag.el = null; _libDrag.idx = null; _libDrag.insertIdx = null;

      $$('.tag-card[data-id]').forEach(c => c.classList.remove('push-left', 'push-right'));
      hideBar('library');

      setTimeout(() => {
        if (insertIdx !== null && insertIdx !== idx) {
          const kw = $("#search-input").value.trim().toLowerCase();
          let viewList;
          if (currentCatId === FAV_CAT_ID) {
            viewList = tags.filter(t => t.favorited && (!kw || t.cn.includes(kw)));
          } else {
            viewList = tags.filter(t => t.categoryId === currentCatId && (!kw || t.cn.includes(kw)));
          }
          let dstIdx = insertIdx;
          let srcIdx = idx;
          if (dstIdx > srcIdx) dstIdx--;
          const [moved] = viewList.splice(srcIdx, 1);
          viewList.splice(Math.max(0, Math.min(dstIdx, viewList.length)), 0, moved);
          const viewIds = new Set(viewList.map(t => t.id));
          tags = [...tags.filter(t => !viewIds.has(t.id)), ...viewList];
          Storage.set("tags", tags);
        }
        renderLibrary();
        dragFromLibrary = null;
      }, 350);
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
    canvasTags.splice(+x.dataset.idx, 1); saveCanvas(); renderCanvas();
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
  const active = canvasTags.filter(t => !t.silent);
  if (active.length === 0) { alert("没有可复制的标签（全部已静默）"); return; }
  const text = active.map(t => showEn ? (t.en || t.cn) : t.cn).join(", ");
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
  $("#input-en").value = t?.en || "";
  $("#modal-tag").classList.remove("hidden");
}
function confirmTag() {
  const cn = $("#input-cn").value.trim();
  if (!cn) return alert("不能为空");
  const en = $("#input-en").value.trim() || undefined;
  if (editingTagId) {
    const t = tags.find(x => x.id === editingTagId);
    if (t) { t.cn = cn; t.en = en; }
  } else {
    const catId = currentCatId === FAV_CAT_ID
      ? (categories.find(c => c.id !== FAV_CAT_ID)?.id || FAV_CAT_ID)
      : currentCatId;
    tags.push({ id: nextId++, categoryId: catId, cn, en });
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
  let parts = [text];
  if (byComma && bySpace) {
    // 同时按逗号和空格切分
    parts = text.split(/[,，\s]+/).filter(Boolean);
  } else if (byComma) {
    parts = text.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  } else if (bySpace) {
    parts = text.split(/\s+/).filter(Boolean);
  }
  // 去重
  parts = [...new Set(parts)];

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

// ========== 导出 JSON / 导入 CSV ==========
// 导出用 JSON：保留完整数据结构，适合备份迁移
// 导入用 CSV：固定模板，适合批量添加标签
// CSV 列: 分类名称, 分类图标, 中文, 英文, 收藏(是/否)
const CSV_COLS = ['分类名称', '分类图标', '中文', '英文', '收藏'];

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function csvParseLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { result.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ========== OpenAI API 调用工具 ==========
async function callOpenAI(messages, options = {}) {
  const { model = apiConfig.model, onStream } = options;
  if (!apiConfig.key) {
    alert("请先在设置中配置 API 密钥 🔑");
    return { content: "", error: "NO_KEY" };
  }
  const provider = API_PROVIDERS[apiConfig.provider] || API_PROVIDERS.openai;
  try {
    const body = { model, messages, stream: !!onStream };
    if (!onStream) body.temperature = 0.3;

    const headers = { "Content-Type": "application/json" };
    // 不同服务商认证方式不同：OpenAI 用 Bearer，小米用 api-key
    if (apiConfig.provider === "xiaomi") {
      headers["api-key"] = apiConfig.key;
    } else {
      headers["Authorization"] = `Bearer ${apiConfig.key}`;
    }

    const res = await fetch(`${provider.baseURL}/chat/completions`, {
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
  const loading = $("#ai-loading");
  const btn = $("#btn-ai-parse");
  loading.classList.remove("hidden");
  btn.classList.add("loading");
  try {
    const { content, error } = await callOpenAI([
      { role: "system", content: "你是一个提示词分析助手。将用户的提示词文本拆解为语义独立的标签词。\n要求：\n1. 每个标签是一个独立的语义单元\n2. 返回 JSON 格式：{ \"tags\": [{ \"cn\": \"...\", \"en\": \"...\" }] }\n3. 标签数量 3-15 个\n4. 去除重复和无意义的通用词" },
      { role: "user", content: text },
    ], { model: apiConfig.model });
    if (error) { alert("AI 解析失败: " + error); return; }
    // 解析 JSON 响应
    let parsed;
    try {
      // 尝试提取 JSON（可能被 markdown 代码块包裹）
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/{[\s\S]*?}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      parsed = { tags: [] };
    }
    const list = (parsed.tags || []).filter(t => t.cn);
    if (!list.length) { alert("AI 未能解析出标签，请重试"); return; }
    // 渲染到结果区（复用现有卡片样式）
    const el = $("#parse-result");
    el.innerHTML = list.map(t => {
      const exist = tags.find(x => x.cn === t.cn);
      return `<div class="tag-card ${exist ? 'existing' : ''}" data-text="${t.cn}">
        <span class="cn">${t.cn}</span>${t.en ? `<span style="font-size:11px;color:#94a3b8;margin-left:4px">${t.en}</span>` : ''}
        <span style="font-size:11px;color:#94a3b8;margin-left:4px">${exist ? "已有" : ""}</span>
      </div>`;
    }).join("");
    // 绑定分类选择（复现 doParse 中的逻辑）
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
  } finally {
    loading.classList.add("hidden");
    btn.classList.remove("loading");
  }
}

// ========== 图片反推 ==========
let _reverseImageData = null; // base64 data

function handleImageUpload(file) {
  if (!file) return;
  const area = $("#image-upload-area");
  const preview = $("#image-preview");
  const reader = new FileReader();
  reader.onload = (e) => {
    _reverseImageData = e.target.result;
    preview.src = _reverseImageData;
    preview.classList.remove("hidden");
    area.querySelector(".image-upload-hint")?.classList.add("hidden");
    area.style.padding = "8px";
  };
  reader.readAsDataURL(file);
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
  const addActions = $("#reverse-add-actions");
  btn.textContent = "⏳ 反推中...";
  btn.disabled = true;
  resultEl.classList.add("hidden");
  addActions.classList.add("hidden");
  try {
    const { content, error } = await callOpenAI([
      { role: "system", content: "你是一个提示词反推专家。根据用户提供的图片，分析其风格、主体、光影、色彩、构图等要素，生成一个完整的提示词。" },
      { role: "user", content: [
        { type: "image_url", image_url: { url: _reverseImageData, detail: "high" } },
        { type: "text", text: "请反推这张图片的提示词" },
      ]},
    ], { model: apiConfig.model });
    if (error) { alert("反推失败: " + error); return; }
    resultEl.textContent = content;
    resultEl.classList.remove("hidden");
    addActions.classList.remove("hidden");
  } finally {
    btn.textContent = "🤖 反推提示词";
    btn.disabled = false;
  }
}

function copyReverseResult() {
  const text = $("#reverse-result").textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => alert("已复制")).catch(() => alert("复制失败"));
}

function reverseToCanvas() {
  const text = $("#reverse-result").textContent;
  if (!text) return;
  canvasTags.push({ cn: text });
  saveCanvas();
  renderCanvas();
  switchMode("paint");
  alert("已加入画布");
}

function reverseToLibrary() {
  const text = $("#reverse-result").textContent;
  if (!text) return;
  // 整段文本作为一条标签，放入当前分类
  const catId = currentCatId === FAV_CAT_ID
    ? (categories.find(c => c.id !== FAV_CAT_ID)?.id || FAV_CAT_ID)
    : currentCatId;
  tags.push({ id: nextId++, categoryId: catId, cn: text });
  Storage.set("tags", tags);
  renderLibrary();
  alert("已加入词库");
}

function exportData() {
  const data = { categories, tags, canvas: canvasTags };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prompt-forge-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

// CSV 导入模版下载
function downloadTemplate() {
  const rows = [CSV_COLS, ['风格', '🎨', '示例标签', 'example', '否'], ['光影', '💡', '', '', '']];
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: "text/csv;charset=utf-8" }));
  a.download = "prompt-forge-导入模版.csv";
  a.click();
}

function importData(e) {
  const f = e.target.files[0];
  if (!f) return;
  // 按文件后缀分流
  if (f.name.endsWith(".json")) {
    importJSON(f);
  } else {
    importCSV(f);
  }
}

// JSON 导入：完整数据恢复（导出功能的逆操作）
function importJSON(f) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || typeof d !== "object") throw new Error("格式错误");
      if (d.categories) { categories = d.categories; Storage.set("categories", categories); }
      if (d.tags) { tags = d.tags; Storage.set("tags", tags); }
      if (d.canvas) { canvasTags = d.canvas; Storage.set("canvas", canvasTags); }
      location.reload();
    } catch (err) {
      alert("JSON 导入失败: " + err.message);
    }
  };
  r.readAsText(f, "UTF-8");
}

// CSV 导入：批量添加标签
function importCSV(f) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const raw = r.result;
      // 去除 BOM 和空行
      const lines = raw.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { alert("CSV 文件为空或格式错误"); return; }

      // 解析表头
      const header = csvParseLine(lines[0]);
      const colIdx = {};
      CSV_COLS.forEach((name, i) => {
        const idx = header.indexOf(name);
        if (idx >= 0) colIdx[name] = idx;
      });
      if (!('分类名称' in colIdx && '中文' in colIdx)) {
        alert("CSV 格式不正确。需要包含列：分类名称, 分类图标, 中文, 英文, 收藏");
        return;
      }

      // 按分类名称去重收集分类
      const catByName = {}; // name -> {id, name, icon}
      const newTags = [];
      let maxId = nextId;
      let nextCatId = Math.max(0, ...categories.map(c => c.id)) + 1;

      for (let i = 1; i < lines.length; i++) {
        const row = csvParseLine(lines[i]);
        if (row.length < 2) continue;

        const catName = (row[colIdx['分类名称']] || '').trim();
        const catIcon = (row[colIdx['分类图标']] || '').trim() || '📁';

        // 按名称匹配/创建分类
        if (catName && !catByName[catName]) {
          catByName[catName] = { id: nextCatId++, name: catName, icon: catIcon };
          maxId = Math.max(maxId, nextCatId);
        }

        const cn = (row[colIdx['中文']] || '').trim();
        if (!cn) continue; // 仅分类行（无标签），跳过

        const en = (row[colIdx['英文']] || '').trim() || undefined;
        const fav = (row[colIdx['收藏']] || '').trim() === '是';

        const catId = fav ? FAV_CAT_ID : (catByName[catName]?.id || FAV_CAT_ID);
        const tagId = maxId++;

        newTags.push({ id: tagId, categoryId: catId, cn, en });
      }

      if (Object.keys(catByName).length === 0 && newTags.length === 0) {
        alert("CSV 中没有找到有效数据"); return;
      }

      // 重建数据
      const cats = Object.values(catByName);
      // 确保收藏分类存在
      if (!cats.find(c => c.id === FAV_CAT_ID) && newTags.some(t => t.categoryId === FAV_CAT_ID)) {
        cats.unshift({ id: FAV_CAT_ID, name: "收藏", icon: "⭐", fixed: true });
      }
      categories = cats;
      tags = newTags;
      canvasTags = []; // 画布不导入
      nextId = maxId + 1;

      Storage.set("categories", categories);
      Storage.set("tags", tags);
      Storage.set("canvas", canvasTags);
      location.reload();
    } catch (err) {
      alert("CSV 导入失败: " + err.message);
    }
  };
  r.readAsText(f, "UTF-8");
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ========== 事件绑定入口 ==========
function bindEvents() {
  $("#btn-paint").onclick = () => switchMode("paint");
  $("#btn-parse-mode").onclick = () => switchMode("parse");

  // 新增按钮（在右侧固定区，不受滚动影响）
  document.getElementById('btn-add-cat').onclick = openAddCategory;

  $("#category-tabs").onclick = (e) => {
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

  // 词库编辑模式切换
  $("#btn-edit-lib").onclick = () => {
    libEditMode = !libEditMode;
    $("#btn-edit-lib").classList.toggle("active", libEditMode);
    $("#btn-edit-lib").textContent = libEditMode ? "✕" : "✏️";
    renderLibrary();
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
  // 根据服务商更新模型下拉选项
  function updateModelOptions(provider) {
    const sel = $("#select-model");
    const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.openai;
    sel.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join("");
  }
  $("#btn-settings").onclick = () => {
    $("#input-api-key").value = apiConfig.key;
    $("#select-provider").value = apiConfig.provider;
    updateModelOptions(apiConfig.provider);
    $("#select-model").value = apiConfig.model;
    // 如果当前模型不在新选项里，选第一个
    if (!$("#select-model").querySelector(`option[value="${apiConfig.model}"]`)) {
      apiConfig.model = $("#select-model").value;
    }
    $("#api-status").textContent = apiConfig.key ? "✔️" : "";
    $("#modal-settings").classList.remove("hidden");
  };
  // 保存 API 配置
  const saveApiConfig = () => {
    apiConfig.key = $("#input-api-key").value.trim();
    apiConfig.model = $("#select-model").value;
    apiConfig.provider = $("#select-provider").value;
    Storage.set("apiConfig", apiConfig);
    $("#api-status").textContent = apiConfig.key ? "✔️" : "";
  };
  // 切换服务商 → 更新模型列表
  $("#select-provider").onchange = () => {
    const p = $("#select-provider").value;
    updateModelOptions(p);
    // 自动选中该服务商的第一个模型
    apiConfig.model = $("#select-model").value;
    saveApiConfig();
  };
  $("#input-api-key").oninput = saveApiConfig;
  $("#select-model").onchange = saveApiConfig;
  $("#btn-export").onclick = exportData;
  $("#btn-import").onclick = () => $("#import-file").click();
  $("#btn-template").onclick = downloadTemplate;
  $("#import-file").onchange = importData;
  $("#btn-reset").onclick = () => { if (confirm("确定重置所有数据？不可恢复！")) { localStorage.clear(); location.reload(); } };

  // 炸开
  $("#parse-input").oninput = $("#opt-comma").onchange = $("#opt-space").onchange = debounce(doParse, 300);
  $("#btn-ai-parse").onclick = doAIParse;
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
  $("#btn-reverse-to-canvas").onclick = reverseToCanvas;
  $("#btn-reverse-to-library").onclick = reverseToLibrary;
}

init();
