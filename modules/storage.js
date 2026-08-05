// ========== 数据存储（实时写入 localStorage + 本地 JSON 文件同步）==========
const Storage = {
  _syncTimer: null,
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) {
    // 立即写入 localStorage
    localStorage.setItem(k, JSON.stringify(v));
    // 核心数据：防抖 50ms 后同步到服务器 JSON 文件
    if (k === 'tags' || k === 'categories' || k === 'canvas') {
      clearTimeout(this._syncTimer);
      this._syncTimer = setTimeout(() => this._syncToServer(), 50);
    }
  },
  // 立即写入服务器（关闭页面时调用）
  flush() {
    clearTimeout(this._syncTimer);
    this._syncToServer();
  },
  // 同步核心数据到本地服务器 JSON 文件
  _syncToServer() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    const data = {
      tags: Storage.get('tags', []),
      categories: Storage.get('categories', []),
      canvas: Storage.get('canvas', [])
    };
    fetch('/api/app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => {
      if (!r.ok) console.warn('数据同步失败:', r.status);
    }).catch(() => {});
  },
  // 从服务器拉取数据并写入 localStorage（初始化时调用）
  async syncFromServer() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    try {
      const resp = await fetch('/api/app-data');
      if (!resp.ok) return;
      const data = await resp.json();
      let changed = false;
      if (Array.isArray(data.tags) && data.tags.length > 0) {
        localStorage.setItem('tags', JSON.stringify(data.tags));
        changed = true;
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        localStorage.setItem('categories', JSON.stringify(data.categories));
        changed = true;
      }
      if (Array.isArray(data.canvas)) {
        localStorage.setItem('canvas', JSON.stringify(data.canvas));
      }
      return changed;
    } catch (e) { console.warn('App data sync failed:', e.message); }
  },
};
// 页面关闭前立即同步到服务器
window.addEventListener('beforeunload', () => Storage.flush());
