/* ============================================================
   通用拖拽系统：分类 Tab / 词库卡片 / 画布标签 三区共用
   ghost 克隆体 + 插入条光标 + 鼠标移出清理
   依赖 modules/utils.js($/$$) 与 app.js 运行时全局状态
   ============================================================ */

// 拖拽状态
let dragFromLibrary = null;
// 三区拖拽共享状态结构：{ active, ghost, el, idx, insertIdx, startX, startY, origLeft, origTop, latestX, latestY }
let _catDrag = { active: false, ghost: null, el: null, idx: null, insertIdx: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, latestX: 0, latestY: 0 };
let _libDrag = { active: false, ghost: null, el: null, idx: null, insertIdx: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, latestX: 0, latestY: 0 };
let _canvasDrag = { active: false, ghost: null, el: null, idx: null, insertIdx: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, latestX: 0, latestY: 0 };

// 空标签拖拽状态
let _emptyDrag = { active: false, ghost: null, el: null, startX: 0, startY: 0, origLeft: 0, origTop: 0 };
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
// 规则（画布/词库统一）：
//   1. 仅基于「移除被拖元素后的元素」(others) 定位，绝不引用被拖占位符
//   2. 行 = 鼠标 Y 的最近行（间隙取最近、首尾钳制到首/末行，不自动造新行）
//   3. 光标水平跟随鼠标，落在行首/行尾时与元素同一行，垂直取该行中心
//   4. 每帧按当前布局重新测量（自适应画布大小变化）
function updateInsertBar(items, mouseX, mouseY, barName, dragIdx) {
  items = [...items];
  const bar = getBar(barName);
  const others = items.filter((_, i) => i !== dragIdx);

  // 先清除上一帧的让位效果，再测量干净位置（避免位移污染 rect 造成反馈跳动/闪烁）
  items.forEach(t => t.classList.remove('push-left', 'push-right'));

  if (!others.length) { bar.style.display = 'none'; return 0; }

  const rects = others.map(el => el.getBoundingClientRect());

  // 行分组：top 偏移小于 6px 视为同一行
  const rows = [];
  for (let i = 0; i < others.length; i++) {
    if (i === 0 || Math.abs(rects[i].top - rects[i - 1].top) > 6) rows.push([i]);
    else rows[rows.length - 1].push(i);
  }

  // 找鼠标所在/最近的行的索引（在行内直接命中；行间隙取垂直距离最近的行；越界钳制到首/末行）
  let targetRow = 0;
  let bestDist = Infinity;
  for (let i = 0; i < rows.length; i++) {
    const rTop = rects[rows[i][0]].top;
    const rBot = rects[rows[i][rows[i].length - 1]].bottom;
    let d;
    if (mouseY < rTop) d = rTop - mouseY;
    else if (mouseY > rBot) d = mouseY - rBot;
    else { targetRow = i; bestDist = -1; break; }
    if (d < bestDist) { bestDist = d; targetRow = i; }
  }

  const row = rows[targetRow];

  // 行内插入位：localIdx 为 others 下标；超过行尾 = 该行末尾（不越到下一行）
  let localIdx = row[0];
  for (const idx of row) {
    if (mouseX < rects[idx].left + rects[idx].width / 2) { localIdx = idx; break; }
    localIdx = idx + 1;
  }

  // 映射到 items 中的插入位置
  let finalIdx;
  if (localIdx >= others.length) finalIdx = items.length;
  else finalIdx = items.indexOf(others[localIdx]);

  if (finalIdx === dragIdx) { bar.style.display = 'none'; return finalIdx; }

  // 定位光标：垂直取目标行中心，水平跟随鼠标（行首/行中/行尾）
  const firstR = rects[row[0]];
  const lastR = rects[row[row.length - 1]];
  const isRowStart = localIdx <= row[0];
  const isRowEnd = localIdx > row[row.length - 1];

  bar.style.display = '';
  bar.classList.add('visible');

  if (isRowStart) {
    bar.style.left = (firstR.left - 6) + 'px';
    bar.style.top = (firstR.top + firstR.height / 2 - 18) + 'px';
    others[row[0]].classList.add('push-right');
  } else if (isRowEnd) {
    bar.style.left = (lastR.right + 6) + 'px';
    bar.style.top = (lastR.top + lastR.height / 2 - 18) + 'px';
    others[row[row.length - 1]].classList.add('push-left');
  } else {
    const li = row.indexOf(localIdx);
    const lr = rects[row[li - 1]];
    const rr = rects[row[li]];
    bar.style.left = ((lr.right + rr.left) / 2 - 2.5) + 'px';
    bar.style.top = (lr.top + lr.height / 2 - 18) + 'px';
    others[row[li - 1]].classList.add('push-left');
    others[row[li]].classList.add('push-right');
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
  document.body.classList.add('dragging');
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
    document.body.classList.remove('dragging');
    if (_emptyDrag.ghost) { _emptyDrag.ghost.remove(); _emptyDrag.ghost = null; }
    _emptyDrag.el = null;

    if (!wasMoved) return;

    // 检测是否落在画布区域
    const canvas = document.getElementById('tag-canvas');
    if (!canvas) return;
    const cr = canvas.getBoundingClientRect();
    if (e.clientX >= cr.left && e.clientX <= cr.right && e.clientY >= cr.top && e.clientY <= cr.bottom) {
      setTimeout(() => {
        const id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        canvasTags.push({ cn: '', _editing: true, _editId: id });
        saveCanvas(); renderCanvas();
        // 聚焦新标签
        requestAnimationFrame(() => {
          const inp = document.querySelector('.tag-chip.editing input');
          if (inp) { inp.focus(); inp.select(); }
        });
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
    document.body.classList.remove('dragging');
    $$('.tab, .tag-card, .tag-chip').forEach(c =>
      c.classList.remove('is-dragging', 'push-left', 'push-right', 'shrink-placeholder')
    );
    ['category', 'library', 'canvas'].forEach(hideBar);
  });
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
    document.body.classList.remove('dragging');

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
    document.body.classList.remove('dragging');

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
      const willReorder = wasMoved && !crossGroup && insertIdx !== null && insertIdx !== idx && insertIdx !== -1;
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
    // 空子分类：没有卡片可定位光标 → 悬停到空分组时，在分组标题处显示目标光标
    const over = document.elementFromPoint(mouseX, mouseY)?.closest('.subcat-group[data-group-id]');
    if (over && over.querySelectorAll('.tag-card[data-id]').length === 0) {
      const bar = getBar('library');
      const gr = over.getBoundingClientRect();
      cards.forEach(c => c.classList.remove('push-left', 'push-right'));
      bar.style.display = '';
      bar.classList.add('visible');
      bar.style.left = (gr.left - 6) + 'px';
      bar.style.top = (gr.top + 8) + 'px';
      _libDrag.insertIdx = -1; // 标记：目标为空分组（跨组移动）
    }
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
      document.body.classList.remove('dragging');

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

  // 编辑模式 input 提交/失焦
  $$('.tag-chip.editing .chip-input').forEach(inp => {
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        inp.blur();
      }
    };
    inp.onblur = () => {
      const idx = +inp.dataset.idx;
      if (idx >= 0 && idx < canvasTags.length) {
        const val = inp.value.trim();
        if (val) {
          canvasTags[idx].cn = val;
          delete canvasTags[idx]._editing;
          delete canvasTags[idx]._editId;
        } else {
          canvasTags.splice(idx, 1);
        }
        saveCanvas(); renderCanvas();
      }
    };
  });

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
