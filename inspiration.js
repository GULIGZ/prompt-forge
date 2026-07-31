/* ============================================================
   灵感页面（Inspiration）逻辑
   完全自包含，不依赖 app.js 内部变量，避免继续膨胀单体文件。
   仅在 index.html 中做了最小接线（#btn-inspiration / #inspiration-mode）。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 工具 ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => 'i_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  /* ---------- 存储键 ---------- */
  const LS_ITEMS = 'inspirations';
  const LS_CFG = 'insp_storage_cfg';
  const LS_COLS = 'insp_cols';
  const LS_TAGS = 'promptForge.inspTags';

  /* ---------- 标签池（独立持久化，不再从图片反推） ---------- */
  let _tagPoolCache = null;

  function _loadTagPoolCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(LS_TAGS));
      if (cached && Array.isArray(cached)) { _tagPoolCache = cached; return; }
    } catch (_) {}
    _tagPoolCache = [];
  }

  async function _syncTagPoolFromAPI() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    try {
      const resp = await fetch('/api/tags');
      if (resp.ok) {
        const tags = await resp.json();
        if (Array.isArray(tags)) {
          _tagPoolCache = tags;
          localStorage.setItem(LS_TAGS, JSON.stringify(tags));
        }
      }
    } catch (_) {}
  }

  function _saveTagPool(tags) {
    _tagPoolCache = tags;
    localStorage.setItem(LS_TAGS, JSON.stringify(tags));
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      postWithRetry('/api/tags', tags);
    }
  }

  function addTagsToPool(newTags) {
    if (!newTags || !newTags.length) return;
    if (!_tagPoolCache) _loadTagPoolCache();
    let changed = false;
    newTags.forEach(t => {
      if (t && !_tagPoolCache.includes(t)) {
        _tagPoolCache.push(t);
        changed = true;
      }
    });
    if (changed) {
      _tagPoolCache.sort((a, b) => a.localeCompare(b, 'zh'));
      _saveTagPool(_tagPoolCache);
    }
  }

  function removeTagFromPool(tag) {
    if (!_tagPoolCache) _loadTagPoolCache();
    const idx = _tagPoolCache.indexOf(tag);
    if (idx === -1) return;
    _tagPoolCache.splice(idx, 1);
    _saveTagPool(_tagPoolCache);
  }
  const IDB_NAME = 'insp-fs';
  const IDB_STORE = 'handles';
  const IDB_KEY = 'dir';

  const supportsFS = typeof window.showDirectoryPicker === 'function';

  /* ---------- 同步通知栏 ---------- */
  let _syncBar = null;
  function _getSyncBar() {
    if (_syncBar) return _syncBar;
    _syncBar = document.createElement('div');
    _syncBar.className = 'insp-sync-bar hidden';
    _syncBar.innerHTML = `<span class="insp-sync-bar-msg"></span><button class="insp-sync-bar-retry" type="button">重试</button><button class="insp-sync-bar-close" type="button">×</button>`;
    document.body.appendChild(_syncBar);
    _syncBar.querySelector('.insp-sync-bar-close').addEventListener('click', () => _syncBar.classList.add('hidden'));
    return _syncBar;
  }
  let _syncWarningTimer = null;
  function showSyncWarning(retryFn) {
    const bar = _getSyncBar();
    bar.querySelector('.insp-sync-bar-msg').textContent = '数据同步失败，仅保存在本地';
    const retryBtn = bar.querySelector('.insp-sync-bar-retry');
    const newBtn = retryBtn.cloneNode(true);
    retryBtn.parentNode.replaceChild(newBtn, retryBtn);
    newBtn.addEventListener('click', () => {
      bar.classList.add('hidden');
      retryFn();
    });
    bar.classList.remove('hidden');
    clearTimeout(_syncWarningTimer);
    _syncWarningTimer = setTimeout(() => bar.classList.add('hidden'), 8000);
  }

  /* ---------- POST 重试（最多 3 次，间隔 800ms） ---------- */
  function postWithRetry(url, body) {
    let attempts = 0;
    const maxAttempts = 3;
    function attempt() {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(r => { if (!r.ok) throw new Error(r.status); });
    }
    function run() {
      attempts++;
      return attempt().catch(() => {
        if (attempts < maxAttempts) {
          return new Promise(resolve => setTimeout(resolve, 800)).then(run);
        }
        showSyncWarning(() => run());
      });
    }
    run();
  }

  /* ---------- localStorage 元数据 ---------- */
  function getItems() {
    try { return JSON.parse(localStorage.getItem(LS_ITEMS)) || []; }
    catch (e) { return []; }
  }
  function saveItems(items) {
    localStorage.setItem(LS_ITEMS, JSON.stringify(items));
    // 异步同步到本地服务器 JSON 文件（自动重试，失败时通知）
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      postWithRetry('/api/items', items);
    }
  }
  function getCfg() {
    try { return JSON.parse(localStorage.getItem(LS_CFG)) || { mode: 'local', folderName: '' }; }
    catch (e) { return { mode: 'local', folderName: '' }; }
  }
  function setCfg(cfg) {
    localStorage.setItem(LS_CFG, JSON.stringify(cfg));
    // 异步同步到本地服务器 JSON 文件（自动重试，失败时通知）
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      postWithRetry('/api/cfg', cfg);
    }
  }

  /* ---------- 从本地服务器 JSON 文件同步数据到 localStorage ---------- */
  async function syncFromAPI() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    try {
      const localItems = getItems();
      // 拉取灵感数据
      const itemsResp = await fetch('/api/items');
      if (itemsResp.ok) {
        const items = await itemsResp.json();
        if (Array.isArray(items)) {
          if (items.length > 0) {
            // 服务器有数据 → 更新 localStorage
            localStorage.setItem(LS_ITEMS, JSON.stringify(items));
          } else if (localItems.length > 0 && !sessionStorage.getItem('_migrated_insp')) {
            // 首次启动且服务器为空 → 迁移一次 localStorage 到服务器
            sessionStorage.setItem('_migrated_insp', '1');
            saveItems(localItems);
          } else {
            // 重置后服务器为空 → 清空 localStorage 保持一致
            localStorage.removeItem(LS_ITEMS);
          }
        }
      }
      // 拉取配置
      const cfgResp = await fetch('/api/cfg');
      if (cfgResp.ok) {
        const cfg = await cfgResp.json();
        if (cfg && cfg.mode) {
          localStorage.setItem(LS_CFG, JSON.stringify(cfg));
        }
      }
    } catch (e) {
      console.warn('API 同步失败，使用本地缓存:', e.message);
    }

    // 同步标签池
    await _syncTagPoolFromAPI();

    // 历史迁移：如果标签池为空但图片有标签，从图片汇总一次
    if (!_tagPoolCache || _tagPoolCache.length === 0) {
      const items = getItems();
      const set = new Set();
      items.forEach(it => (it.tags || []).forEach(t => set.add(t)));
      if (set.size > 0) {
        _tagPoolCache = Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
        _saveTagPool(_tagPoolCache);
      }
    }
  }
  function getCols() {
    const n = parseInt(localStorage.getItem(LS_COLS), 10);
    return (n >= 2 && n <= 12) ? n : 5;
  }
  function setCols(n) { localStorage.setItem(LS_COLS, String(n)); }

  /* ---------- 提取所有历史标签（读标签池，不再遍历图片） ---------- */
  function getAllTags() {
    if (!_tagPoolCache) _loadTagPoolCache();
    return _tagPoolCache;
  }

  /* ---------- IndexedDB：持久化目录句柄 ---------- */
  function idbOpen() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(IDB_STORE)) r.result.createObjectStore(IDB_STORE); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbGetHandle() {
    try {
      const db = await idbOpen();
      return await new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const rq = tx.objectStore(IDB_STORE).get(IDB_KEY);
        rq.onsuccess = () => res(rq.result || null);
        rq.onerror = () => rej(rq.error);
      });
    } catch (e) { return null; }
  }
  async function idbSetHandle(h) {
    try {
      const db = await idbOpen();
      return await new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(h, IDB_KEY);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) { return false; }
  }

  async function ensureDirPermission(handle, mode = 'readwrite') {
    if (!handle) return null;
    try {
      if ((await handle.queryPermission({ mode })) === 'granted') return handle;
      if ((await handle.requestPermission({ mode })) === 'granted') return handle;
    } catch (e) { /* ignore */ }
    return null;
  }

  /* ---------- 图片源解析（缓存 blob URL） ---------- */
  const imgCache = {};
  async function resolveImageSrc(item) {
    if (!item || !item.image) return '';
    if (item.storage !== 'folder') return item.image; // dataURL
    if (imgCache[item.id]) return imgCache[item.id];
    // 优先：通过 File System Access API 读取
    const handle = await idbGetHandle();
    if (handle) {
      const h = await ensureDirPermission(handle);
      if (h) {
        try {
          const fh = await h.getFileHandle(item.image);
          const file = await fh.getFile();
          const url = URL.createObjectURL(file);
          imgCache[item.id] = url;
          return url;
        } catch (e) { /* 文件不存在时走降级 */ }
      }
    }
    // 降级：无 IndexedDB 句柄时，通过本地服务器 /img/ 路由加载
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      const url = '/img/' + encodeURIComponent(item.image);
      imgCache[item.id] = url;
      return url;
    }
    return '';
  }

  function fileToDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }
  function extOf(file) {
    const map = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
    if (map[file.type]) return map[file.type];
    const m = (file.name || '').match(/\.[a-z0-9]+$/i);
    return m ? m[0].toLowerCase() : '.png';
  }

  /* ============================================================
     DOM 构建
     ============================================================ */
  const root = $('#inspiration-mode');

  root.innerHTML = `
    <div class="insp-home">
      <div class="insp-toolbar">
        <h2 class="insp-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v.3h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2Z"/></svg>
          灵感
        </h2>
        <div class="insp-toolbar-right">
          <div class="insp-col-control" title="自定义列数">
            <button class="insp-col-btn" id="insp-col-dec" type="button">−</button>
            <span class="insp-col-label"><span id="insp-col-count">5</span> 列</span>
            <button class="insp-col-btn" id="insp-col-inc" type="button">+</button>
          </div>
          <button class="insp-tag-manage-btn" id="insp-tag-manage" type="button" title="标签管理">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          </button>
          <div class="insp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input id="insp-search-input" type="text" placeholder="搜索提示词或标签…">
          </div>
        </div>
      </div>
      <div class="insp-masonry" id="insp-masonry"></div>
      <div class="insp-empty hidden" id="insp-empty">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
        <span>还没有收藏，点击右下角星形按钮添加灵感</span>
      </div>
      <button class="insp-fab insp-fab-top hidden" id="insp-fab-top" type="button" title="回到顶部">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      </button>
      <button class="insp-fab insp-fab-star" id="insp-fab-add" type="button" title="收藏新灵感">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.8 6.2 21l1.1-6.5L2.6 9.8l6.5-.9z"/></svg>
      </button>
    </div>

    <div class="insp-detail hidden" id="insp-detail">
      <button class="insp-detail-back icon-btn" id="insp-detail-back" type="button" title="返回">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <div class="insp-detail-body">
        <div class="insp-detail-left">
          <img class="insp-detail-img" id="insp-detail-img" alt="灵感图片" title="点击放大">
        </div>
        <div class="insp-detail-right">
          <div class="insp-detail-prompt" id="insp-detail-prompt"></div>
          <div class="insp-detail-tags" id="insp-detail-tags"></div>
          <div class="insp-detail-actions">
            <button class="btn-danger" id="insp-delete" type="button">删除</button>
            <div class="insp-detail-actions-right">
              <button class="btn-add-to-canvas" id="insp-add-canvas" type="button">加入画布</button>
              <button class="btn-outline" id="insp-edit" type="button">二次编辑</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="insp-zoom hidden" id="insp-zoom">
      <div class="insp-zoom-indicator" id="insp-zoom-ind">100%</div>
      <img class="insp-zoom-img" id="insp-zoom-img" alt="">
      <button class="insp-zoom-close" id="insp-zoom-close" type="button" title="关闭">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="modal hidden" id="insp-modal">
      <div class="modal-content insp-modal-content">
        <h3 class="insp-modal-title" id="insp-modal-title">收藏灵感</h3>
        <label class="insp-field-label">提示词</label>
        <textarea id="insp-prompt-input" class="insp-textarea" placeholder="输入或粘贴长提示词…"></textarea>
        <label class="insp-field-label">图片</label>
        <div class="insp-img-row">
          <div class="insp-img-preview" id="insp-img-preview">无图片</div>
          <label class="btn-outline insp-file-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            选择图片
            <input type="file" id="insp-file-input" accept="image/*" hidden>
          </label>
        </div>
        <label class="insp-field-label">标签</label>
        <div class="insp-tag-input-wrap">
          <input id="insp-tag-input" class="insp-tag-input" type="text" placeholder="输入标签后回车…">
        </div>
        <div class="insp-tag-chips" id="insp-tag-chips"></div>
        <div class="modal-actions" style="display:flex;gap:10px;margin-top:4px;">
          <button class="btn-cancel" id="insp-cancel" type="button" style="flex:1;">取消</button>
          <button class="btn-confirm" id="insp-save" type="button" style="flex:1;">保存</button>
        </div>
      </div>
    </div>

    <div class="modal hidden" id="insp-tag-manage-modal">
      <div class="modal-content insp-tag-manage-content">
        <h3 class="insp-modal-title">标签管理</h3>
        <div class="insp-tag-manage-list" id="insp-tag-manage-list"></div>
        <div class="insp-tag-manage-empty hidden" id="insp-tag-manage-empty">暂无标签，收藏灵感并添加标签后这里会出现标签列表。</div>
        <div class="modal-actions" style="display:flex;gap:10px;margin-top:14px;">
          <button class="btn-cancel" id="insp-tag-manage-close" type="button" style="flex:1;">关闭</button>
        </div>
      </div>
    </div>
  `;

  /* ---------- DOM 引用 ---------- */
  const masonry = $('#insp-masonry');
  const emptyState = $('#insp-empty');
  const searchInput = $('#insp-search-input');
  const colCountEl = $('#insp-col-count');
  const colDec = $('#insp-col-dec');
  const colInc = $('#insp-col-inc');
  const fabAdd = $('#insp-fab-add');
  const fabTop = $('#insp-fab-top');
  const tagManageBtn = $('#insp-tag-manage');
  const tagManageModal = $('#insp-tag-manage-modal');
  const tagManageList = $('#insp-tag-manage-list');
  const tagManageEmpty = $('#insp-tag-manage-empty');
  const tagManageClose = $('#insp-tag-manage-close');

  const detail = $('#insp-detail');
  const detailImg = $('#insp-detail-img');
  const detailPrompt = $('#insp-detail-prompt');
  const detailTags = $('#insp-detail-tags');
  const detailBack = $('#insp-detail-back');

  const zoom = $('#insp-zoom');
  const zoomImg = $('#insp-zoom-img');
  const zoomInd = $('#insp-zoom-ind');
  const zoomClose = $('#insp-zoom-close');

  const modal = $('#insp-modal');
  const modalTitle = $('#insp-modal-title');
  const promptInput = $('#insp-prompt-input');
  const fileInput = $('#insp-file-input');
  const imgPreview = $('#insp-img-preview');
  const tagInput = $('#insp-tag-input');
  const tagChips = $('#insp-tag-chips');
  const btnCancel = $('#insp-cancel');
  const btnSave = $('#insp-save');

  /* ---------- 标签联想列表 ---------- */
  const suggestEl = document.createElement('div');
  suggestEl.className = 'insp-tag-suggest hidden';
  tagInput.parentElement.insertAdjacentElement('afterend', suggestEl);
  let suggestIndex = -1;

  function hideSuggestions() {
    suggestEl.classList.add('hidden');
    suggestIndex = -1;
  }

  function showSuggestions(filter) {
    const available = getAllTags().filter(t => !modalTags.includes(t));
    const q = filter.trim().toLowerCase();
    const matches = q ? available.filter(t => t.toLowerCase().includes(q)) : available;
    if (matches.length === 0) { hideSuggestions(); return; }
    suggestIndex = Math.min(Math.max(suggestIndex, 0), matches.length - 1);
    suggestEl.innerHTML = matches.map((t, i) =>
      `<div class="insp-tag-suggest-item${i === suggestIndex ? ' active' : ''}" data-tag="${esc(t)}">${esc(t)}</div>`
    ).join('');
    suggestEl.classList.remove('hidden');
  }

  function selectSuggestion(tag) {
    if (tag && !modalTags.includes(tag)) {
      modalTags.push(tag);
      addTagsToPool([tag]);
      renderTagChips();
    }
    tagInput.value = '';
    showSuggestions('');
  }

  suggestEl.addEventListener('click', (e) => {
    const item = e.target.closest('.insp-tag-suggest-item');
    if (item) selectSuggestion(item.dataset.tag);
  });

  tagInput.addEventListener('input', () => showSuggestions(tagInput.value));

  /* ============================================================
     状态
     ============================================================ */
  let currentFilter = '';
  let activeId = null;            // 当前详情/编辑项
  let modalTags = [];             // 弹窗内临时标签
  let pendingFile = null;         // 弹窗内待保存图片文件
  let editingImageExisting = '';  // 编辑时已有图片引用

  /* ============================================================
     瀑布流渲染
     ============================================================ */
  function chipHTML(tag) {
    return `<span class="insp-chip">${esc(tag)}</span>`;
  }

  async function renderMasonry() {
    let items = getItems().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const q = currentFilter.trim().toLowerCase();
    if (q) {
      items = items.filter(it =>
        (it.prompt || '').toLowerCase().includes(q) ||
        (it.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    colCountEl.textContent = getCols();
    masonry.innerHTML = '';
    if (items.length === 0) {
      masonry.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }
    masonry.classList.remove('hidden');
    emptyState.classList.add('hidden');

    const cols = getCols();
    // 创建列容器
    const columns = Array.from({ length: cols }, () => {
      const col = document.createElement('div');
      col.className = 'insp-masonry-col';
      masonry.appendChild(col);
      return col;
    });

    // 轮询分配到各列（第 i 项 → 第 i % cols 列）
    items.forEach((it, i) => {
      const card = document.createElement('article');
      card.className = 'insp-card';
      card.dataset.id = it.id;
      card.innerHTML = `
        <div class="insp-card-imgwrap"><img class="insp-card-img" alt="" loading="lazy"></div>
      `;
      const img = card.querySelector('img');
      resolveImageSrc(it).then(src => {
        if (src) { img.src = src; return; }
        const wrap = img.parentElement;
        wrap.innerHTML = '<div style="aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px;">图片不可用</div>';
      });
      card.addEventListener('click', () => openDetail(it.id));
      columns[i % cols].appendChild(card);
    });
  }

  /* ---------- 列数 ---------- */
  function updateCols(delta) {
    let n = getCols() + delta;
    n = Math.max(2, Math.min(12, n));
    setCols(n);
    colCountEl.textContent = n;
    colDec.disabled = n <= 2;
    colInc.disabled = n >= 12;
    renderMasonry();
  }
  colDec.addEventListener('click', () => updateCols(-1));
  colInc.addEventListener('click', () => updateCols(1));
  colDec.disabled = getCols() <= 2;
  colInc.disabled = getCols() >= 12;

  /* ---------- 搜索 ---------- */
  searchInput.addEventListener('input', () => {
    currentFilter = searchInput.value;
    renderMasonry();
  });

  /* ---------- 悬浮按钮 ---------- */
  fabAdd.addEventListener('click', () => openModal(null));
  fabTop.addEventListener('click', () => {
    const homeEl = masonry.parentElement;
    if (homeEl) homeEl.scrollTo({ top: 0, behavior: 'smooth' });
  });
  const homeScrollEl = masonry.parentElement;
  if (homeScrollEl) {
    homeScrollEl.addEventListener('scroll', () => {
      fabTop.classList.toggle('hidden', homeScrollEl.scrollTop < 300);
    });
  }

  /* ============================================================
     详情页
     ============================================================ */
  async function openDetail(id) {
    const item = getItems().find(it => it.id === id);
    if (!item) return;
    activeId = id;
    detailPrompt.textContent = item.prompt || '（无提示词）';
    detailTags.innerHTML = (item.tags || []).map(chipHTML).join('');
    const src = await resolveImageSrc(item);
    detailImg.src = src || '';
    detailImg.style.display = src ? '' : 'none';
    detail.classList.remove('hidden');
  }
  function closeDetail() {
    detail.classList.add('hidden');
    activeId = null;
  }
  detailBack.addEventListener('click', closeDetail);

  /* ---------- 加入画布（复用现有入口） ---------- */
  $('#insp-add-canvas').addEventListener('click', () => {
    const item = getItems().find(it => it.id === activeId);
    if (!item) return;
    const input = document.getElementById('input-field');
    const btn = document.getElementById('btn-add-to-canvas');
    if (input && btn) {
      input.value = item.prompt || '';
      btn.click();
      hideInspiration();
      if (window.switchMode) window.switchMode('paint');
    }
  });

  /* ---------- 二次编辑 ---------- */
  $('#insp-edit').addEventListener('click', () => openModal(activeId));

  /* ---------- 自包含删除确认弹窗（风格对齐项目 #modal-confirm） ---------- */
  let inspConfirmEl = null;
  function showInspConfirm(message, onConfirm) {
    if (!inspConfirmEl) {
      inspConfirmEl = document.createElement('div');
      inspConfirmEl.className = 'modal hidden';
      inspConfirmEl.innerHTML = `
        <div class="modal-content">
          <h3>确认删除</h3>
          <p id="insp-confirm-msg"></p>
          <div class="modal-actions">
            <button class="btn-cancel" id="insp-confirm-cancel">取消</button>
            <button class="btn-danger" id="insp-confirm-ok">确认删除</button>
          </div>
        </div>`;
      document.body.appendChild(inspConfirmEl);
      inspConfirmEl.querySelector('.modal-content').addEventListener('click', e => e.stopPropagation());
      inspConfirmEl.addEventListener('click', () => inspConfirmEl.classList.add('hidden'));
      inspConfirmEl.querySelector('#insp-confirm-cancel').addEventListener('click', () => inspConfirmEl.classList.add('hidden'));
      inspConfirmEl.querySelector('#insp-confirm-ok').addEventListener('click', () => {
        inspConfirmEl.classList.add('hidden');
        if (inspConfirmEl._cb) inspConfirmEl._cb();
      });
    }
    inspConfirmEl.querySelector('#insp-confirm-msg').textContent = message;
    inspConfirmEl._cb = onConfirm;
    inspConfirmEl.classList.remove('hidden');
  }

  /* ---------- 删除 ---------- */
  $('#insp-delete').addEventListener('click', () => {
    if (!activeId) return;
    const item = getItems().find(it => it.id === activeId);
    if (!item) return;
    showInspConfirm('确定删除这条灵感吗？此操作不可撤销。', async () => {
      // 文件夹模式：一并删除磁盘上的图片文件
      if (item.storage === 'folder' && item.image) {
        try {
          const handle = await idbGetHandle();
          const h = await ensureDirPermission(handle, 'readwrite');
          if (h) await h.removeEntry(item.image);
        } catch (_) { /* 文件删除失败不影响元数据删除 */ }
      }
      saveItems(getItems().filter(it => it.id !== activeId));
      closeDetail();
      renderMasonry();
    });
  });

  /* ============================================================
     图片放大预览
     ============================================================ */
  let zScale = 1, zTx = 0, zTy = 0;
  let pressTimer = null, isPanning = false, startX = 0, startY = 0, startTx = 0, startTy = 0;

  function applyZoom() {
    zoomImg.style.transform = `translate(${zTx}px, ${zTy}px) scale(${zScale})`;
    zoomInd.textContent = Math.round(zScale * 100) + '%';
  }
  function openZoom(src) {
    if (!src) return;
    zoomImg.src = src;
    zScale = 1; zTx = 0; zTy = 0;
    applyZoom();
    zoom.classList.remove('hidden');
  }
  function closeZoom() {
    zoom.classList.add('hidden');
    zoomImg.src = '';
  }
  detailImg.addEventListener('click', () => openZoom(detailImg.src));
  zoomClose.addEventListener('click', closeZoom);

  zoom.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zScale = Math.max(0.2, Math.min(8, zScale * factor));
    applyZoom();
  }, { passive: false });

  zoom.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    startX = e.clientX; startY = e.clientY;
    startTx = zTx; startTy = zTy;
    pressTimer = setTimeout(() => {
      isPanning = true;
      zoom.classList.add('grabbing');
    }, 280); // 长按进入抓手
  });
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    zTx = startTx + (e.clientX - startX);
    zTy = startTy + (e.clientY - startY);
    applyZoom();
  });
  window.addEventListener('mouseup', () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    isPanning = false;
    zoom.classList.remove('grabbing');
  });

  /* ============================================================
     收藏弹窗
     ============================================================ */
  function renderTagChips() {
    tagChips.innerHTML = modalTags.map((t, i) =>
      `<span class="insp-chip">${esc(t)}<button class="insp-tag-remove" data-i="${i}" type="button" title="移除">×</button></span>`
    ).join('');
    tagChips.querySelectorAll('.insp-tag-remove').forEach(b => {
      b.addEventListener('click', () => {
        modalTags.splice(+b.dataset.i, 1);
        renderTagChips();
        showSuggestions('');
      });
    });
  }

  function openModal(id) {
    activeId = id || null;
    modalTags = [];
    pendingFile = null;
    editingImageExisting = '';
    if (id) {
      const item = getItems().find(it => it.id === id);
      modalTitle.textContent = '编辑灵感';
      promptInput.value = item.prompt || '';
      modalTags = (item.tags || []).slice();
      editingImageExisting = item.image || '';
      if (editingImageExisting) {
        resolveImageSrc(item).then(src => {
          imgPreview.innerHTML = src ? `<img src="${src}" alt="">` : '图片不可用';
        });
      } else {
        imgPreview.textContent = '无图片';
      }
    } else {
      modalTitle.textContent = '收藏灵感';
      promptInput.value = '';
      imgPreview.textContent = '无图片';
    }
    renderTagChips();
    showSuggestions('');
    modal.classList.remove('hidden');
    promptInput.focus();
  }
  function closeModal() {
    modal.classList.add('hidden');
    hideSuggestions();
    fileInput.value = '';
  }

  tagInput.addEventListener('keydown', (e) => {
    const suggestionsOpen = !suggestEl.classList.contains('hidden');

    // 方向键：在建议列表中导航
    if (suggestionsOpen && e.key === 'ArrowDown') {
      e.preventDefault();
      const items = suggestEl.querySelectorAll('.insp-tag-suggest-item');
      if (items.length > 0) {
        suggestIndex = (suggestIndex + 1) % items.length;
        showSuggestions(tagInput.value);
      }
      return;
    }
    if (suggestionsOpen && e.key === 'ArrowUp') {
      e.preventDefault();
      const items = suggestEl.querySelectorAll('.insp-tag-suggest-item');
      if (items.length > 0) {
        suggestIndex = (suggestIndex - 1 + items.length) % items.length;
        showSuggestions(tagInput.value);
      }
      return;
    }

    // Enter / 逗号：确认输入或选择建议
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      // 有高亮建议项 → 选中它
      if (suggestionsOpen && suggestIndex >= 0) {
        const items = suggestEl.querySelectorAll('.insp-tag-suggest-item');
        if (items[suggestIndex]) {
          selectSuggestion(items[suggestIndex].dataset.tag);
          return;
        }
      }
      // 否则输入新标签
      const v = tagInput.value.trim().replace(/,$/, '');
      if (v && !modalTags.includes(v)) {
        modalTags.push(v);
        addTagsToPool([v]);
      }
      tagInput.value = '';
      renderTagChips();
      showSuggestions('');
      return;
    }

    // Escape：关闭建议
    if (e.key === 'Escape') {
      if (suggestionsOpen) { hideSuggestions(); return; }
    }

    // Backspace 删除最后一个标签
    if (e.key === 'Backspace' && !tagInput.value && modalTags.length) {
      modalTags.pop();
      renderTagChips();
      showSuggestions('');
    }
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    pendingFile = f;
    const url = URL.createObjectURL(f);
    imgPreview.innerHTML = `<img src="${url}" alt="">`;
  });

  btnCancel.addEventListener('click', closeModal);
  // 点击弹窗外部区域取消
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  btnSave.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt && !pendingFile && !editingImageExisting) {
      closeModal();
      return;
    }
    const cfg = getCfg();
    const existing = activeId ? getItems().find(x => x.id === activeId) : null;
    let image = editingImageExisting;
    let storage = existing ? existing.storage : cfg.mode;

    if (pendingFile) {
      try {
        if (storage === 'folder') {
          const handle = await idbGetHandle();
          const h = await ensureDirPermission(handle, 'readwrite');
          if (h) {
            const fname = uid() + extOf(pendingFile);
            const fh = await h.getFileHandle(fname, { create: true });
            const w = await fh.createWritable();
            await w.write(pendingFile);
            await w.close();
            // 删除旧图
            if (editingImageExisting && editingImageExisting !== fname) {
              try { await h.removeEntry(editingImageExisting); } catch (_) {}
            }
            image = fname;
          } else {
            // 文件夹不可用时回退到 localStorage
            image = await fileToDataURL(pendingFile);
            storage = 'local';
          }
        } else {
          image = await fileToDataURL(pendingFile);
        }
      } catch (err) {
        image = await fileToDataURL(pendingFile);
        storage = 'local';
      }
    }

    const items = getItems();
    if (activeId) {
      const it = items.find(x => x.id === activeId);
      if (it) {
        it.prompt = prompt;
        it.tags = modalTags.slice();
        it.image = image;
        it.storage = storage;
      }
    } else {
      items.push({ id: uid(), prompt, tags: modalTags.slice(), image, storage, createdAt: Date.now() });
    }
    saveItems(items);
    addTagsToPool(modalTags);
    closeModal();
    renderMasonry();
  });

  /* ============================================================
     设置：存储方式（注入数据管理面板）
     ============================================================ */
  function injectStorageSettings() {
    const panel = $('[data-panel="data"]');
    if (!panel || $('#insp-storage-block')) return;

    const block = document.createElement('div');
    block.className = 'insp-storage-block';
    block.id = 'insp-storage-block';
    block.innerHTML = `
      <div class="insp-storage-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        数据存储位置
      </div>
      <div class="insp-folder-row" id="insp-folder-row">
        <span class="insp-folder-path" id="insp-folder-path">未选择文件夹</span>
        <button class="btn-outline" id="insp-folder-pick" type="button" style="flex-shrink:0;">重新选择</button>
        <button class="btn-outline" id="insp-folder-browse" type="button" style="flex-shrink:0;">在应用中打开</button>
      </div>
      <div class="insp-storage-note" id="insp-storage-note">全部数据（提示词、灵感、配置）存储于项目目录中的本地 JSON 文件，启动 start.command 即可读写。</div>
    `;
    // 插入到标题之后、数据操作按钮之前
    const actionsEl = panel.querySelector('.settings-data-actions');
    if (actionsEl) {
      panel.insertBefore(block, actionsEl);
    } else {
      panel.appendChild(block);
    }

    const folderRow = $('#insp-folder-row');
    const folderPath = $('#insp-folder-path');
    const pickBtn = $('#insp-folder-pick');
    const browseBtn = $('#insp-folder-browse');
    const note = $('#insp-storage-note');

    function syncUI() {
      const cfg = getCfg();
      folderPath.textContent = cfg.folderName || '未选择文件夹';
      folderPath.classList.toggle('empty', !cfg.folderName);
    }

    pickBtn.addEventListener('click', async () => { await selectFolder(); syncUI(); renderMasonry(); });
    browseBtn.addEventListener('click', () => browseFolder(note));

    syncUI();
  }

  async function selectFolder() {
    if (!supportsFS) return false;
    try {
      const handle = await window.showDirectoryPicker();
      const h = await ensureDirPermission(handle, 'readwrite');
      if (!h) return false;
      await idbSetHandle(h);
      setCfg({ mode: 'folder', folderName: h.name });
      return true;
    } catch (e) {
      return false; // 用户取消或失败
    }
  }

  async function browseFolder(noteEl) {
    // 通过本地服务器在 Finder 中打开图片文件夹
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      try {
        const resp = await fetch('/api/open-folder', { method: 'POST' });
        const data = await resp.json();
        if (resp.ok) {
          noteEl.className = 'insp-storage-note';
          noteEl.textContent = '已在 Finder 中打开：' + (data.path || '文件夹');
          return;
        }
        noteEl.className = 'insp-storage-note warn';
        noteEl.textContent = data.error || '无法访问文件夹。';
        return;
      } catch (e) {
        noteEl.className = 'insp-storage-note warn';
        noteEl.textContent = '服务器未启动，请先运行 start.command。';
        return;
      }
    }
    // file:// 协议：提示用户服务器模式
    noteEl.className = 'insp-storage-note warn';
    noteEl.textContent = '请通过 start.command 打开应用以使用此功能。';
  }

  /* ============================================================
     标签管理
     ============================================================ */
  function openTagManage() {
    renderTagManageList();
    tagManageModal.classList.remove('hidden');
  }
  function closeTagManage() {
    tagManageModal.classList.add('hidden');
  }

  function renderTagManageList() {
    const allTags = getAllTags();
    if (allTags.length === 0) {
      tagManageList.innerHTML = '';
      tagManageEmpty.classList.remove('hidden');
      return;
    }
    tagManageEmpty.classList.add('hidden');
    // 统计每个标签被多少图片使用
    const items = getItems();
    const usage = {};
    items.forEach(it => (it.tags || []).forEach(t => { usage[t] = (usage[t] || 0) + 1; }));
    tagManageList.innerHTML = allTags.map(t => {
      const count = usage[t] || 0;
      return `<span class="insp-tag-manage-chip">
        ${esc(t)} <em class="insp-tag-manage-chip-count">${count}</em>
        <button class="insp-tag-manage-chip-del" data-tag="${esc(t)}" type="button" title="删除标签">×</button>
      </span>`;
    }).join('');
    // 绑定删除事件
    tagManageList.querySelectorAll('.insp-tag-manage-chip-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        deleteTag(tag);
      });
    });
  }

  function deleteTag(tag) {
    showInspConfirm(`确定删除标签「${tag}」吗？该标签将从标签池和所有图片中移除。`, () => {
      // 1. 从标签池移除
      removeTagFromPool(tag);
      // 2. 从所有图片的 tags 中移除
      const items = getItems();
      let changed = false;
      items.forEach(it => {
        if (it.tags && it.tags.includes(tag)) {
          it.tags = it.tags.filter(t => t !== tag);
          changed = true;
        }
      });
      if (changed) saveItems(items);
      // 3. 刷新管理列表和瀑布流
      renderTagManageList();
      renderMasonry();
    });
  }

  tagManageBtn.addEventListener('click', openTagManage);
  tagManageClose.addEventListener('click', closeTagManage);
  tagManageModal.addEventListener('click', (e) => { if (e.target === tagManageModal) closeTagManage(); });

  /* ============================================================
     导航切换（不改动 app.js）
     ============================================================ */
  const btnInsp = $('#btn-inspiration');
  const btnPaint = $('#btn-paint');
  const btnParse = $('#btn-parse-mode');

  function showInspiration() {
    $('#paint-mode').classList.add('hidden');
    $('#parse-mode').classList.add('hidden');
    root.classList.remove('hidden');
    btnPaint.classList.remove('active');
    btnParse.classList.remove('active');
    btnInsp.classList.add('active');
    renderMasonry();
  }
  function hideInspiration() {
    if (!root.classList.contains('hidden')) root.classList.add('hidden');
    btnInsp.classList.remove('active');
    closeDetail();
    closeModal();
    closeZoom();
  }
  btnInsp.addEventListener('click', showInspiration);
  btnPaint.addEventListener('click', hideInspiration);
  btnParse.addEventListener('click', hideInspiration);

  /* ---------- 全局快捷键 ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modal.classList.contains('hidden')) { closeModal(); return; }
    if (!zoom.classList.contains('hidden')) { closeZoom(); return; }
    if (!detail.classList.contains('hidden')) { closeDetail(); return; }
  });

  /* ---------- 初始化 ---------- */
  syncFromAPI().then(() => {
    injectStorageSettings();
  });
})();
