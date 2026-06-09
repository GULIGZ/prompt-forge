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

// 分类拖拽状态（document 级别事件共享）
let _catDrag = { active: false, el: null, idx: null, startX: 0, startY: 0 };

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
    `<div class="tag-card ${t.favorited ? 'favorited' : ''}" data-id="${t.id}" data-idx="${i}" draggable="true">
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

// ========== 分类 Tab 拖拽排序（仅编辑模式）==========
// 原则：mousedown 绑在每个 tab 上，mousemove/mouseup 只绑一次在 document 上

function bindTabMouseDrag() {
  const allTabs = $$('.tab[data-id]');

  allTabs.forEach((tab, idx) => {
    // 固定分类不可拖
    if (tab.classList.contains('fixed')) {
      tab.onmousedown = null;
      tab.style.cursor = 'default';
      return;
    }

    tab.style.cursor = catEditMode ? 'grab' : 'pointer';

    tab.onmousedown = (e) => {
      // 非编辑模式、非左键、点击操作按钮 → 不触发拖拽
      if (!catEditMode || e.button !== 0) return;
      if (e.target.closest('.cat-actions')) return;

      e.preventDefault();

      _catDrag.active = true;
      _catDrag.el = tab;
      _catDrag.idx = idx;
      _catDrag.startX = e.clientX;
      _catDrag.startY = e.clientY;

      // 视觉反馈：半透明
      tab.style.opacity = '0.35';
      tab.style.zIndex = '100';
      tab.style.transform = 'scale(1.08)';
      tab.style.boxShadow = '0 4px 12px rgba(233,69,96,0.5)';
    };
  });
}

function initCatDragListeners() {
  // mousemove：实时高亮目标位置
  document.addEventListener('mousemove', (e) => {
    if (!_catDrag.active || !_catDrag.el) return;

    const tabs = $$('.tab[data-id]');
    // 清除旧的高亮
    tabs.forEach(t => {
      t.classList.remove('drag-over');
      t.style.transform = '';
      t.style.boxShadow = '';
      if (t !== _catDrag.el) t.style.opacity = '';
    });

    // 找到鼠标下方的目标 tab（排除固定分类和自己）
    let hitIdx = -1;
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      if (t === _catDrag.el || t.classList.contains('fixed')) continue;
      const r = t.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top && e.clientY <= r.bottom) {
        hitIdx = i;
        break;
      }
    }

    if (hitIdx >= 0) {
      const target = tabs[hitIdx];
      target.classList.add('drag-over');
      // 根据鼠标在目标左边还是右边决定偏移方向
      const midX = target.getBoundingClientRect().left + target.offsetWidth / 2;
      target.style.transform = e.clientX < midX ? 'translateX(16px)' : 'translateX(-16px)';
      target.style.boxShadow = '0 0 0 2px var(--blue), 0 0 12px rgba(59,130,246,0.4)';
    }
  }, { passive: true });

  // mouseup：执行排序
  document.addEventListener('mouseup', (e) => {
    if (!_catDrag.active) return;
    _catDrag.active = false;

    // 恢复被拖元素的样式
    if (_catDrag.el) {
      _catDrag.el.style.opacity = '';
      _catDrag.el.style.zIndex = '';
      _catDrag.el.style.transform = '';
      _catDrag.el.style.boxShadow = '';
    }

    const tabs = $$('.tab[data-id]');
    const targetTab = [...tabs].find(t => t.classList.contains('drag-over'));

    // 清理所有高亮
    tabs.forEach(t => {
      t.classList.remove('drag-over');
      t.style.transform = '';
      t.style.boxShadow = '';
    });

    // 如果有有效目标，执行排序
    if (targetTab && _catDrag.el && targetTab !== _catDrag.el) {
      const srcIdx = categories.findIndex(c =>
        c.id === +_catDrag.el.dataset.id
      );
      const dstIdx = categories.findIndex(c =>
        c.id === +targetTab.dataset.id
      );

      if (srcIdx >= 0 && dstIdx >= 0 && srcIdx !== dstIdx) {
        // 判断插入目标前面还是后面
        const targetRect = targetTab.getBoundingClientRect();
        let finalIdx = dstIdx;
        if (e.clientX > targetRect.left + targetRect.width / 2) {
          finalIdx = dstIdx + 1;
          if (finalIdx > srcIdx) finalIdx--;
        } else {
          if (finalIdx > srcIdx) finalIdx--;
        }

        const [moved] = categories.splice(srcIdx, 1);
        categories.splice(Math.max(0, Math.min(finalIdx, categories.length - 1)), 0, moved);
        Storage.set("categories", categories);
        renderTabs(); // 重新渲染
      }
    }

    _catDrag.el = null;
    _catDrag.idx = null;
  });
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

// ========== 词库内拖拽重排（HTML5 Drag） ==========
function bindLibraryDrag() {
  const grid = $("#tag-grid");
  let dragIdx = null;
  let dragId = null;

  $$('.tag-card[data-id]').forEach(card => {
    card.ondragstart = (e) => {
      dragIdx = +card.dataset.idx;
      dragId = +card.dataset.id;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(dragId));
    };
    card.ondragend = () => {
      card.classList.remove('is-dragging');
      clearDragOverState();
      dragIdx = null; dragId = null;
    };
    card.ondragover = (e) => {
      e.preventDefault();
      if (dragId !== null && +card.dataset.id !== dragId) {
        clearDragOverState();
        card.classList.add('drag-over');
      }
    };
    card.ondrop = (e) => {
      e.preventDefault();
      const dropIdx = +card.dataset.idx;
      if (dragIdx !== null && dropIdx !== dragIdx && dragId !== null) {
        // 获取当前视图列表
        const kw = $("#search-input").value.trim().toLowerCase();
        let viewList;
        if (currentCatId === FAV_CAT_ID) {
          viewList = tags.filter(t => t.favorited && (!kw || t.cn.includes(kw)));
        } else {
          viewList = tags.filter(t => t.categoryId === currentCatId && (!kw || t.cn.includes(kw)));
        }
        // 在视图列表中交换位置
        const [moved] = viewList.splice(dragIdx, 1);
        viewList.splice(dropIdx, 0, moved);
        // 写回完整数组
        if (currentCatId === FAV_CAT_ID) {
          tags = [...tags.filter(t => !viewList.includes(t)), ...viewList];
        } else {
          tags = [...tags.filter(t => !viewList.includes(t)), ...viewList];
        }
        Storage.set("tags", tags); renderLibrary();
      }
      clearDragOverState();
      dragIdx = null; dragId = null;
    };
  });

  grid.ondragover = (e) => e.preventDefault();

  function clearDragOverState() {
    $$('.tag-card.drag-over').forEach(c => c.classList.remove('drag-over'));
  }

  // 从词库拖到画布：在 card ondragstart 中设置
  $$('.tag-card[data-id]').forEach(card => {
    const origStart = card.ondragstart;
    card.ondragstart = (e) => {
      dragFromLibrary = +card.dataset.id;
      origStart.call(card, e);
    };
  });
}

// ========== 画布鼠标拖拽（核心修复：用 mouse 事件替代 HTML5 drag）==========
function bindCanvasMouseDrag() {
  const canvas = $("#tag-canvas");
  const ghost = $("#drag-ghost");
  const placeholder = $("#drag-placeholder");

  let isDragging = false;
  let dragIdx = null;
  let dragEl = null;
  let targetIdx = null; // 当前悬停目标位置

  $$('.tag-chip').forEach(chip => {
    chip.onmousedown = (e) => {
      // 只响应左键，且不是点击删除按钮
      if (e.button !== 0 || e.target.classList.contains('remove')) return;
      e.preventDefault();

      isDragging = true;
      dragIdx = +chip.dataset.idx;
      dragEl = chip;
      targetIdx = dragIdx;

      // 显示幽灵元素
      ghost.textContent = chip.childNodes[0].textContent.trim();
      ghost.classList.remove('hidden');
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';

      // 原始标签半透明
      chip.classList.add('dragging');

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  });

  function onMouseMove(e) {
    if (!isDragging) return;

    // 幽灵跟随鼠标
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';

    // 计算当前鼠标位置对应的插入索引
    const chips = $$('.tag-chip');
    let newTargetIdx = null;

    for (let i = 0; i < chips.length; i++) {
      if (chips[i] === dragEl) continue; // 跳过自己
      const rect = chips[i].getBoundingClientRect();
      // 判断鼠标是否在这个标签范围内
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        newTargetIdx = i;
        break;
      }
    }

    // 如果没有命中任何标签，判断是在末尾
    if (newTargetIdx === null) {
      const canvasRect = canvas.getBoundingClientRect();
      if (e.clientY > canvasRect.top && e.clientY < canvasRect.bottom) {
        newTargetIdx = chips.length;
      }
    }

    // 更新目标高亮和占位符
    if (newTargetIdx !== null && newTargetIdx !== targetIdx) {
      targetIdx = newTargetIdx;
      updateDragVisuals(chips, newTargetIdx);
    } else if (newTargetIdx === null) {
      targetIdx = null;
      clearDragVisuals(chips);
      placeholder.classList.add('hidden');
    }
  }

  function updateDragVisuals(chips, idx) {
    clearDragVisuals(chips);

    if (idx >= chips.length) {
      // 放在末尾：显示占位符
      placeholder.classList.remove('hidden');
      const lastChip = chips[chips.length - 1];
      if (lastChip) {
        const rect = lastChip.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        placeholder.style.left = (rect.right - canvasRect.left + 8) + 'px';
        placeholder.style.top = (rect.top - canvasRect.top) + 'px';
        placeholder.style.width = '40px';
      }
    } else {
      // 放在某个标签前/后
      const targetChip = chips[idx];
      const targetRect = targetChip.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      // 判断是左半边还是右半边
      const midX = targetRect.left + targetRect.width / 2;
      const insertBefore = e => false; // 将在 mousemove 中判断

      // 显示占位符
      placeholder.classList.remove('hidden');
      placeholder.style.left = (targetRect.left - canvasRect.left) + 'px';
      placeholder.style.top = (targetRect.top - canvasRect.top) + 'px';
      placeholder.style.width = targetRect.width + 'px';
      placeholder.style.height = targetRect.height + 'px';

      // 高亮目标标签
      targetChip.classList.add('drag-target');
    }
  }

  function clearDragVisuals(chips) {
    chips.forEach(c => {
      c.classList.remove('drag-target', 'drag-target-before');
    });
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // 清理视觉
    ghost.classList.add('hidden');
    placeholder.classList.add('hidden');
    if (dragEl) dragEl.classList.remove('dragging');
    clearDragVisuals($$('.tag-chip'));

    // 执行排序
    if (targetIdx !== null && targetIdx !== dragIdx) {
      // 调整索引（因为 dragEl 还在原位）
      let finalIdx = targetIdx;
      if (finalIdx > dragIdx) finalIdx--; // 往后放时补偿

      const [moved] = canvasTags.splice(dragIdx, 1);
      canvasTags.splice(finalIdx, 0, moved);
      saveCanvas();
    }

    dragEl = null; dragIdx = null; targetIdx = null;

    // 重新渲染
    renderCanvas();
  }

  // 删除按钮
  $$('.tag-chip .remove').forEach(x => x.onclick = (e) => {
    e.stopPropagation();
    canvasTags.splice(+x.dataset.idx, 1); saveCanvas(); renderCanvas();
  });

  // 画布接收来自词库的拖拽（HTML5 drag）
  canvas.ondragover = (e) => e.preventDefault();
  canvas.ondrop = (e) => {
    e.preventDefault();
    if (dragFromLibrary !== null) {
      const t = tags.find(x => x.id === dragFromLibrary);
      if (t) { canvasTags.push({ cn: t.cn, en: t.en }); saveCanvas(); renderCanvas(); }
      dragFromLibrary = null;
    }
  };
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
