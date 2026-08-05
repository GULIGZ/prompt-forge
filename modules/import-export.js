/* ============================================================
   数据导入导出：导出 JSON / 下载模板 / 导入数据（合并去重）
   依赖 modules/storage.js(Storage)、modules/ui.js(showToast)、modules/constants.js
   与 app.js 运行时全局（categories/tags/canvasTags/nextId）
   ============================================================ */

function exportData() {
  const data = {
    schemaVersion: SCHEMA_VERSION,
    categories, tags,
    canvas: canvasTags,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prompt-forge-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

// 下载模版：根据当前分类实时生成
function downloadTemplate() {
  const tplCategories = categories.filter(c => c.id !== FAV_CAT_ID).map(c => ({ ...c }));
  const tplTags = categories.filter(c => c.id !== FAV_CAT_ID).map((c, i) => ({
    id: -(i + 1), categoryId: c.id, cn: `示例标签（${c.name}）`, en: `example tag (${c.name})`,
  }));
  const template = {
    schemaVersion: SCHEMA_VERSION,
    _说明: "将标签数据填入本文件，然后通过「导入数据」功能导入。分类会根据名称自动匹配或新建。",
    categories: tplCategories,
    tags: tplTags,
    canvas: [],
  };
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prompt-forge-模版.json`;
  a.click();
}

function importData(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || typeof d !== "object") throw new Error("格式错误");
      const idMap = {};

      // 处理分类：按 (name + parentId) 匹配，新分类自动添加
      if (Array.isArray(d.categories)) {
        d.categories.forEach(c => {
          if (c.id === FAV_CAT_ID || c.id === UNCAT_ID) return;
          const existing = categories.find(x => x.name === c.name && x.parentId === c.parentId);
          if (existing) {
            idMap[c.id] = existing.id;
          } else {
            const newCat = { ...c, id: nextId++ };
            delete newCat.fixed;
            categories.push(newCat);
            idMap[c.id] = newCat.id;
          }
        });
        Storage.set("categories", categories);
      }

      // 处理标签：去重后追加
      if (Array.isArray(d.tags)) {
        const existingKeys = new Set(tags.map(t => `${t.categoryId}:${t.cn}`));
        d.tags.forEach(t => {
          const catId = idMap[t.categoryId] != null ? idMap[t.categoryId] : t.categoryId;
          const key = `${catId}:${t.cn}`;
          if (!existingKeys.has(key)) {
            tags.push({ id: nextId++, categoryId: catId, cn: t.cn, en: t.en });
            existingKeys.add(key);
          }
        });
        Storage.set("tags", tags);
      }

      if (Array.isArray(d.canvas)) {
        canvasTags = d.canvas.map(t => ({ cn: t.cn, en: t.en }));
        Storage.set("canvas", canvasTags);
      }

      location.reload();
    } catch (err) {
      showToast("导入失败: " + err.message, "error");
    }
  };
  r.readAsText(f, "UTF-8");
}
