// 自定义分类下拉框（支持 SVG 图标）
function buildCatSelect(container, list, selectedVal, onChange) {
  container.style.display = 'none';
  // Remove old wrapper if exists
  if (container._catWrap) { container._catWrap.remove(); container._catWrap = null; }
  const wrap = document.createElement('div');
  wrap.className = 'cat-select-wrapper';
  container.insertAdjacentElement('afterend', wrap);
  container._catWrap = wrap;

  const trigger = document.createElement('div');
  trigger.className = 'cat-select-trigger';
  const opts = document.createElement('div');
  opts.className = 'cat-select-options hidden';
  const close = () => opts.classList.add('hidden');
  const renderItem = (item) => renderIcon(item.icon || '📁') + ' ' + escapeHtml(item.label || '');
  list.forEach(item => {
    const opt = document.createElement('div');
    opt.className = 'cat-select-option depth-' + (item.depth || 0) + (item.value === selectedVal ? ' selected' : '');
    opt.innerHTML = renderItem(item);
    if (item.depth > 0) opt.style.paddingLeft = (10 + (item.depth || 0) * 18) + 'px';
    if (!item.depth) opt.style.fontWeight = '600';
    opt.onclick = (e) => { e.stopPropagation();
      opts.querySelectorAll('.cat-select-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      trigger.innerHTML = opt.innerHTML + '<span class=\"cat-select-arrow\">▾</span>';
      close(); if (onChange) onChange(item.value);
    };
    opts.appendChild(opt);
  });
  const sel = list.find(i => i.value === selectedVal) || list[0];
  trigger.innerHTML = (sel ? renderItem(sel) : '请选择') + '<span class="cat-select-arrow">▾</span>';
  trigger.onclick = () => { opts.classList.remove('hidden'); };
  const docHandler = (e) => { if (!wrap.contains(e.target)) close(); };
  document.addEventListener('click', docHandler);
  wrap._docHandler = docHandler;
  // Track selected state
  opts.addEventListener('click', (e) => {
    const opt = e.target.closest('.cat-select-option');
    if (!opt) return;
    opts.querySelectorAll('.cat-select-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    trigger.innerHTML = opt.innerHTML + '<span class="cat-select-arrow">▾</span>';
  });
  wrap.appendChild(trigger);
  wrap.appendChild(opts);
  // Return cleanup
  return { hide: () => { wrap.style.display = 'none'; }, show: () => { wrap.style.display = ''; } };
}

// ========== 状态 ==========
let categories, tags, canvasTags, currentCatId, showEn, nextId;

// 从本地服务器同步核心数据，完成后初始化应用
(async function loadAppData() {
  await Storage.syncFromServer();
  categories = Storage.get("categories", DEFAULT_CATEGORIES);
  tags = Storage.get("tags", DEFAULT_TAGS);
  canvasTags = Storage.get("canvas", []);
  migrateSchema();
  // 初始化时将当前数据写入服务器 JSON 文件
  Storage.flush();
  currentCatId = categories.find(c => c.parentId == null && !c.fixed)?.id || categories.find(c => c.parentId == null)?.id || FAV_CAT_ID;
  showEn = false;
  nextId = Math.max(0, ...tags.map(t => t.id), ...categories.map(c => c.id)) + 1;
  init();
})();

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

let catEditMode = false;
let libEditMode = false;
let _pendingConnectionStatus = null;








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
           <button class="btn-cat-add-sub" data-id="${c.id}" title="加子类"><svg width="13" height="13" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M40 23V14L31 4H10C8.89543 4 8 4.89543 8 6V42C8 43.1046 8.89543 44 10 44H22"/><path d="M33 29V43"/><path d="M26 36H33H40"/><path d="M30 4V14H40"/></svg></button>
           <button class="btn-cat-edit" data-id="${c.id}">${iconSvg('✏️')}</button>
           <button class="btn-cat-del" data-id="${c.id}">${iconSvg('✕')}</button>
         </span>`;

    return `<div class="${cls.join(' ')}" data-id="${c.id}">
      ${renderIcon(c.icon)}${escapeHtml(c.name)}${actions}
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
  const catLabel = (showCat && cat && cat.id !== FAV_CAT_ID) ? `<span class="cat-label">${renderIcon(cat.icon)} ${escapeHtml(cat.name)}</span>` : "";
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
  return `<div class="subcat-header">${chevron}${renderIcon(cat.icon)}<span class="subcat-name">${escapeHtml(cat.name)}</span><span class="subcat-actions">${move}${edit}</span></div>`;
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
  el.innerHTML = canvasTags.map((t, i) => {
    const inLib = tags.some(tag => tag.cn === t.cn);
    if (t._editing) {
      return `<div class="tag-chip editing" data-idx="${i}" data-editid="${t._editId}">
        <input type="text" class="chip-input" value="${escapeHtml(t.cn || '')}" placeholder="输入标签..." data-idx="${i}" autofocus>
      </div>`;
    }
    return `<div class="tag-chip${t.silent ? ' silent' : ''}${inLib ? ' tag-library' : ''}" data-idx="${i}">
      ${escapeHtml(showEn && t.en ? t.en : t.cn)}<span class="remove" data-idx="${i}">×</span>
    </div>`;
  }).join("");
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
    openCatModal({ mode: 'edit', cat });
  });

  // 加子类
  $$('.btn-cat-add-sub').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const parentId = +b.dataset.id;
    openCatModal({ mode: 'add-sub', parentId });
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




// ========== 撤销系统 ==========







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
  // 不再自动调 doParse()，避免覆盖 AI 拆分结果
}

function saveCanvas() { Storage.set("canvas", canvasTags); }

// 百度翻译配置

// 默认提示词配置


function copyCanvas() {
  const active = canvasTags.filter(t => !t.silent);
  if (active.length === 0) { showToast("没有可复制的标签（全部已静默）", "info"); return; }
  const text = active.map(t => showEn ? (t.en || t.cn) : t.cn).join(", ");
  navigator.clipboard.writeText(text).then(() =>
    showToast("已复制: " + text.slice(0, 60) + (text.length > 60 ? "..." : ""), "success")
  ).catch(() => showToast("复制失败", "error"));
}


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
    const inputItems = [{ value: big.id, icon: null, label: '未分组', depth: 0 }, ...subs.map(s => ({ value: s.id, icon: s.icon, label: s.name, depth: 1 }))];
    buildCatSelect(sel, inputItems, id ? t.categoryId : big.id, (val) => { sel.dataset.val = val; });
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
  $("#modal-tag").classList.remove("hidden");
}
function confirmTag() {
  const cn = $("#input-cn").value.trim();
  if (!cn) return showToast("不能为空", "error");
  if (cn.length > 50) return showToast("标签名称不能超过 50 个字符", "error");
  const en = $("#input-en").value.trim() || undefined;
  if (en && en.length > 100) return showToast("英文名不能超过 100 个字符", "error");
  const sel = $("#input-subcat");
  const subcatVal = $("#input-subcat-wrap").classList.contains("hidden") ? null : +(sel.dataset.val || sel.value);
  if (editingTagId) {
    const t = tags.find(x => x.id === editingTagId);
    if (t) { t.cn = cn; t.en = en; if (subcatVal) t.categoryId = subcatVal; invalidateEmbedding(t.id); }
  } else {
    let catId;
    if (subcatVal) catId = subcatVal;
    else if (currentCatId === FAV_CAT_ID) catId = firstBigId();
    else catId = currentCatId;
    if (tags.some(t => t.categoryId === catId && t.cn === cn)) {
      return showToast("该分类下已有同名标签", "error");
    }
    tags.push({ id: nextId++, categoryId: catId, cn, en });
  }
  Storage.set("tags", tags); renderTabs(); renderLibrary(); closeModals();
}
const CAT_ICONS = [
  { name: '常用', icons: ['⭐','🎨','🏞️','🎭','🧍','👤','👔','💡','🌈','📷','✨','🏷️','🧩','🔑','🤖','🖼️','🌐','📦','🗺️','🐾','🌦️','🔛','👑'] },
  { name: '自然', icons: ['🌟','🌊','⛰️','🌲','🌸','☀️','🌙','🏔️','🏖️','🎇','🌠','❄️'] },
  { name: '动物', icons: ['🐟','🐦','🐝','🐶','🦋','🐰','🐸','🐵'] },
  { name: '娱乐', icons: ['🎵','🎸','🎬','🎯','🏆','🎪','🎮','🎲','🎡','🕹️','🥇','🎤','🎧','🏅','🎃','🍬','🎩','🔭'] },
  { name: '旅行', icons: ['🚀','✈️','🛸','🏯','🏰','🗼','🗽','🏕️','🚲','🚆','⛵'] },
  { name: '其他', icons: ['❤️','🔥','💎','💻','📱','🔮','📺','🔔','⚽','🧲','🎁','🧭'] },
];
let _catModalState = null;
function openCatModal(opts) {
  _catModalState = opts || {};
  $("#cat-modal-title").textContent = opts.mode === 'edit' ? '编辑分类' : opts.mode === 'add-sub' ? '添加子分类' : '添加分类';
  const picker = $("#cat-icon-picker");
  const curIcon = opts.cat?.icon || '📁';
  picker.innerHTML = CAT_ICONS.map(g => 
    `<div class="icon-group-title">${g.name}</div>` +
    g.icons.map(k => `<button class="icon-btn${k === curIcon ? ' selected' : ''}" data-icon="${k}">${renderIcon(k)}</button>`).join('')
  ).join('');
  picker.querySelectorAll('.icon-btn').forEach(btn => { btn.onclick = () => { picker.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }; });
  $("#cat-modal-name").value = opts.cat?.name || '';
  $("#modal-category").classList.remove('hidden');
  setTimeout(() => $("#cat-modal-name").focus(), 100);
}



// ========== 事件绑定入口 ==========
function bindEvents() {
  $("#btn-paint").onclick = () => switchMode("paint");
  $("#btn-parse-mode").onclick = () => switchMode("parse");

  // 新增按钮（在右侧固定区，不受滚动影响）
  document.getElementById('btn-add-cat').onclick = () => openCatModal({ mode: 'add' });

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
          <span class="api-status-dot ${cfg.connectionStatus || ''}" title="${cfg.connectionError || ''}"></span>
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
    loadTranslateSettings();    }
  };
  window.__apiEdit = function(id) { openApiEdit(id); };
  window.__apiDel = function(id) {
    if (apiConfigs.length <= 1) {
      showToast("至少保留一个 API 配置", "error");
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
    loadTranslateSettings();    });
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
    if (!name) return showToast("请填写配置名称", "error");
    if (!key) return showToast("请填写 API 密钥", "error");
    if (!model && provider !== "custom") return showToast("请选择或填写模型", "error");
    if (provider === "custom" && !baseURL) return showToast("自定义 API 需要填写接口地址", "error");

    const payload = { name, provider, key, model, baseURL, customModels };
    if (_pendingConnectionStatus) {
      payload.connectionStatus = "ok";
      payload.connectionTestedAt = Date.now();
      _pendingConnectionStatus = null;
    }
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
    loadTranslateSettings();  }

  // ========== 获取模型 / 测试连接 ==========
  async function fetchModelsFromApi(provider, baseURL, key) {
    const prov = API_PROVIDERS[provider] || API_PROVIDERS.openai;
    const url = (baseURL || prov.baseURL || '').replace(/\/+$/, '') + '/models';
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    const json = await res.json();
    return (json.data || []).map(m => ({ value: m.id, label: m.id }));
  }
  function showConnectionStatus(msg, type) {
    const el = $("#api-connection-status");
    if (!el) return;
    el.classList.remove("hidden", "ok", "error", "checking");
    if (type) el.classList.add(type);
    el.textContent = msg;
  }

  // 根据服务商更新模型下拉选项（用于编辑弹窗）
  const editProviderSel = $("#edit-api-provider");
  if (editProviderSel) {
    editProviderSel.onchange = () => {
      const p = editProviderSel.value;
      updateEditModelOptions(p);
      toggleCustomFields(p);
      showConnectionStatus("", "");
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
    loadTranslateSettings();
    loadPromptSettings();
    $("#modal-settings").classList.remove("hidden");
  };
  $("#btn-add-api").onclick = () => openApiEdit();
  $("#btn-save-api").onclick = saveApiEdit;
  $("#btn-cancel-api").onclick = () => $("#modal-api-edit").classList.add("hidden");

  // 翻译 API 设置
  function loadTranslateSettings() {
    const cfg = getBaiduConfig();
    document.querySelector("#translate-appid").value = cfg.appid || "";
    document.querySelector("#translate-key").value = cfg.key || "";
  }
  document.querySelector("#btn-save-translate").onclick = function() {
    const appid = document.querySelector("#translate-appid").value.trim();
    const key = document.querySelector("#translate-key").value.trim();
    if (!appid || !key) return showToast("请填写完整的百度翻译配置", "info");
    Storage.set("translateConfig", { appid: appid, key: key });
    showToast("翻译配置已保存", "success");
  };
  // 提示词编辑
  function loadPromptSettings() {
    document.querySelector("#prompt-reverse").value = getPromptConfig("reverse");
    document.querySelector("#prompt-parse").value = getPromptConfig("parse");
    updateParsePreview();
  }
  function updateParsePreview() {
    const el = document.querySelector("#prompt-parse-preview");
    if (!el) return;
    const cats = categories.filter(function(c) { return c.parentId == null && !c.fixed; });
    const catNames = cats.map(function(c) { return c.name; }).join("、");
    const tree = cats.map(function(c) {
      var subs = categories.filter(function(s) { return s.parentId === c.id; }).map(function(s) { return s.name; });
      return c.name + "：" + (subs.length ? subs.join("、") : "（暂无子标签）");
    }).join("\n");
    el.textContent = "你是一个提示词拆解专家。请将用户输入的提示词文本拆解为独立的语义标签词。" +
      "\n\n### 现有标签库参考（分类树）\n" + tree +
      "\n\n### 要求" +
      "\n1. 从输入文本中提取每个独立的语义单元作为标签" +
      "\n2. 每个标签必须归入上面分类树中**最匹配的大类**（第一个层级）" +
      "\n3. 如果标签与现有子标签高度相似，优先使用现有子标签的 cn" +
      "\n4. 返回格式必须是 JSON 数组，仅输出 JSON，不要其他文字：" +
      '\n{ "tags": [{"cn": "标签中文名", "category": "大类名"}] }' +
      "\n5. category 必须是以下之一：" + catNames +
      "\n6. 去除重复和无意义的通用词";
  }
  document.querySelector("#btn-save-prompts").onclick = function() {
    setPromptConfig("reverse", document.querySelector("#prompt-reverse").value);
    setPromptConfig("parse", document.querySelector("#prompt-parse").value);
    updateParsePreview();
    showToast("提示词已保存", "success");
  };
  let _previewDebounce;
  document.querySelector("#prompt-parse").oninput = function() {
    if (_previewDebounce) clearTimeout(_previewDebounce);
    _previewDebounce = setTimeout(updateParsePreview, 300);
  };
  document.querySelector("#btn-reset-prompts").onclick = function() {
    document.querySelector("#prompt-reverse").value = DEFAULT_PROMPTS.reverse;
    document.querySelector("#prompt-parse").value = DEFAULT_PROMPTS.parse;
    setPromptConfig("reverse", DEFAULT_PROMPTS.reverse);
    setPromptConfig("parse", DEFAULT_PROMPTS.parse);
    updateParsePreview();
    showToast("已恢复默认提示词", "success");
  };

  document.querySelector("#btn-test-translate").onclick = async function() {
    var appid = document.querySelector("#translate-appid").value.trim();
    var key = document.querySelector("#translate-key").value.trim();
    if (!appid || !key) return showToast("请先填写并保存翻译配置", "info");
    const q = "test";
    const salt = Date.now();
    const sign = md5(appid + q + salt + key);
    const url = "https://fanyi-api.baidu.com/api/trans/vip/translate?q=" + encodeURIComponent(q) + "&from=zh&to=en&appid=" + appid + "&salt=" + salt + "&sign=" + sign;
    try {
      const data = await jsonp(url);
      if (data.trans_result) showToast("连接成功: " + data.trans_result[0].dst, "success");
      else if (data.error_code) showToast("翻译失败: " + (data.error_msg || "未知错误"), "error");
    } catch(e) {
      showToast("请求失败: " + e.message, "error");
    }
  };

  // 获取模型按钮
  $("#btn-fetch-models").onclick = async () => {
    const provider = $("#edit-api-provider").value;
    const key = $("#edit-api-key").value.trim();
    const baseURL = $("#edit-api-baseurl")?.value.trim() || "";
    if (!key) return showToast("请先填写 API 密钥", "error");
    showConnectionStatus("⏳ 正在获取模型列表...", "checking");
    try {
      const models = await fetchModelsFromApi(provider, baseURL, key);
      if (!models.length) { showConnectionStatus("⚠️ 未获取到模型", "error"); return; }
      const sel = $("#edit-api-model");
      sel.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join("");
      if (models.length) sel.value = models[0].value;
      showConnectionStatus(`✅ 获取到 ${models.length} 个模型`, "ok");
    } catch (err) {
      showConnectionStatus("❌ 获取失败: " + (err.message || "未知错误"), "error");
    }
  };
  // 测试连接按钮（复用获取模型逻辑，检查是否连通）
  $("#btn-test-connection").onclick = async () => {
    const provider = $("#edit-api-provider").value;
    const key = $("#edit-api-key").value.trim();
    const baseURL = $("#edit-api-baseurl")?.value.trim() || "";
    if (!key) return showToast("请先填写 API 密钥", "error");
    showConnectionStatus("⏳ 连接测试中...", "checking");
    try {
      await fetchModelsFromApi(provider, baseURL, key);
      _pendingConnectionStatus = "ok";
      showConnectionStatus("✅ 连接成功，保存后列表将显示绿色状态", "ok");
    } catch (err) {
      _pendingConnectionStatus = "error";
      showConnectionStatus("❌ 连接失败: " + (err.message || "未知错误"), "error");
    }
  };
  // 保存/编辑时重置状态标记
  const _origSave = saveApiEdit;
  saveApiEdit = function() {
    showConnectionStatus("", "");
    _origSave();
  };
  const _origOpenEdit = openApiEdit;
  openApiEdit = function(id) {
    _origOpenEdit(id);
    showConnectionStatus("", "");
    _pendingConnectionStatus = null;
    if (id) {
      const cfg = apiConfigs.find(c => c.id === id);
      if (cfg?.connectionStatus === "ok") showConnectionStatus("✅ 上次测试连接成功", "ok");
      else if (cfg?.connectionStatus === "error") showConnectionStatus("❌ 上次测试连接失败", "error");
    }
  };

  $("#btn-export").onclick = exportData;
  
  // 分类编辑弹窗保存
  $("#btn-save-category").onclick = () => {
    const name = $("#cat-modal-name").value.trim();
    if (!name) return showToast("请填写分类名称", "error");
    if (name.length > 20) return showToast("分类名称不能超过 20 个字符", "error");
    const sel = $("#cat-icon-picker .icon-btn.selected");
    const icon = sel ? sel.dataset.icon : '📁';
    const st = _catModalState || {};
    if (st.mode === 'edit' && st.cat) {
      st.cat.name = name; st.cat.icon = icon;
      Storage.set("categories", categories);
    } else if (st.mode === 'add-sub' && st.parentId) {
      if (categories.some(c => c.parentId === st.parentId && c.name === name)) {
        return showToast("该大类下已有同名子分类", "error");
      }
      categories.push({ id: nextId++, parentId: st.parentId, name, icon });
      Storage.set("categories", categories);
    } else {
      if (categories.some(c => c.parentId == null && !c.fixed && c.name === name)) {
        return showToast("已有同名分类", "error");
      }
      categories.push({ id: nextId++, parentId: null, name, icon });
      Storage.set("categories", categories);
    }
    renderTabs(); renderLibrary(); closeModals();
  };
  
  $("#btn-import").onclick = () => { $("#import-file").value = ""; $("#import-file").click(); };
  $("#btn-template").onclick = downloadTemplate;
  $("#import-file").onchange = importData;
  $("#btn-reset").onclick = async () => {
    if (!confirm("确定重置所有数据？此操作将清空全部提示词、灵感图片及配置，不可恢复！")) return;
    // 调用服务器清除 JSON 文件和图片文件夹
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch (_) {}
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
  };

  // 炸开
  $("#btn-rule-parse").onclick = () => { window._isAIMode = false; doParse(true); };
  $("#btn-rule-settings").onclick = openSplitSettings;
  $("#btn-save-split-rules").onclick = saveSplitRules;
  $("#btn-ai-parse").onclick = doAIParse;
  // Parse input 清空按钮
  $("#btn-parse-clear").onclick = () => {
    const ta = $("#parse-input");
    if (!ta.value.trim()) return;
    ta.value = "";
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  $("#btn-parse-all").onclick = () => {
    $$('#parse-result .tag-card[data-text]').forEach(card => canvasTags.push({ cn: card.dataset.text, en: card.dataset.en || undefined }));
    saveCanvas(); renderCanvas(); switchMode("paint");
  };
  $("#btn-parse-save").onclick = () => {
    const text = $("#parse-input").value.trim();
    if (!text) return showToast("没有内容可保存", "info");
    const h = Storage.get("parseHistory", []);
    h.push({ text, time: new Date().toISOString() });
    Storage.set("parseHistory", h.slice(-50)); showToast("已保存", "success");
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
    const rm = e.target.closest(".btn-parse-remove");
    if (rm) {
      const card = rm.closest(".tag-card[data-idx]");
      _parseAtoms.splice(+card.dataset.idx, 1);
      renderParseResult();
      return;
    }
    const card = e.target.closest(".tag-card[data-idx]");
    if (card) onParseCardClick(+card.dataset.idx);
  };
}

