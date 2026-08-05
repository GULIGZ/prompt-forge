/* ============================================================
   UI 辅助：撤销栈 / Toast 通知 / 加载态 / 确认弹窗 / 关闭弹窗
   依赖 modules/utils.js($/$$) 与 modules/storage.js(Storage)
   ============================================================ */

// 撤销栈
const _undoStack = [];
const UNDO_MAX = 5;
let _undoTimer = null;
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
// ========== 通用 Toast 通知系统 ==========
let _toastTimer = null;
function showToast(msg, type) {
  clearTimeout(_toastTimer);
  let el = document.getElementById("generic-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "generic-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = "generic-toast";
  if (type === "success") el.classList.add("toast-success");
  else if (type === "error") el.classList.add("toast-error");
  else if (type === "info") el.classList.add("toast-info");
  void el.offsetWidth;
  _toastTimer = setTimeout(() => { el.classList.add("hidden"); }, 2500);
}
// ========== AI 操作加载状态辅助 ==========
async function withLoading(el, asyncFn) {
  if (!el) return asyncFn();
  const spinner = document.getElementById("ai-loading");
  const wasDisabled = el.disabled;
  el.disabled = true;
  if (el.classList) el.classList.add("loading");
  if (spinner) spinner.classList.remove("hidden");
  try {
    return await asyncFn();
  } finally {
    el.disabled = wasDisabled;
    if (el.classList) el.classList.remove("loading");
    if (spinner) spinner.classList.add("hidden");
  }
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
let confirmDeleteFn = null;
let _confirmFromSettings = false;
function openConfirm(msg, fn) {
  $("#confirm-msg").textContent = msg; confirmDeleteFn = fn;
  _confirmFromSettings = !$("#modal-settings").classList.contains("hidden");
  if (_confirmFromSettings) $("#modal-settings").classList.add("hidden");
  $("#modal-confirm").classList.remove("hidden");
}
function closeModals() { $$('.modal').forEach(m => m.classList.add("hidden")); }
