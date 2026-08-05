/* ============================================================
   百度翻译：JSONP 调用 / 自动翻译缺失英文
   依赖 modules/storage.js(Storage)、modules/md5.js、modules/ui.js(showToast)
   与 app.js 运行时全局（tags/showEn/renderCanvas）
   ============================================================ */

function getBaiduConfig() { return Storage.get("translateConfig") || { appid: '', key: '' }; }


// JSONP 请求（绕过 CORS 限制，用于百度翻译）
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'bd_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    window[cbName] = (data) => { delete window[cbName]; script.remove(); resolve(data); };
    script.src = url + '&callback=' + cbName;
    script.onerror = () => { delete window[cbName]; script.remove(); reject(new Error('JSONP 请求失败')); };
    document.head.appendChild(script);
  });
}

// 翻译：只影响画布！自动翻译缺失的英文
let _translating = false;
async function autoTranslateAll(untranslated) {
  if (untranslated.length === 0) return;
  const _cfg = getBaiduConfig(); if (!_cfg.appid || !_cfg.key) { console.warn("翻译配置未设置，跳过自动翻译"); return; }
  const texts = untranslated.map(t => t.cn);
  const q = texts.join('\n');
  const salt = Date.now();
  const sign = md5(getBaiduConfig().appid + q + salt + getBaiduConfig().key);
  console.log('百度翻译 sign 原文:', getBaiduConfig().appid + q + salt + '(密钥隐藏)');
  console.log('百度翻译 sign:', sign);
  console.log('百度翻译 URL q 参数:', encodeURIComponent(q).slice(0,80) + '...');
  const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(q)}&from=zh&to=en&appid=${getBaiduConfig().appid}&salt=${salt}&sign=${sign}`;
  try {
    const data = await jsonp(url);
    if (data.trans_result) {
      data.trans_result.forEach((r, i) => {
        if (r.dst && untranslated[i]) {
          untranslated[i].en = r.dst;
          // 同步写回词库（匹配中文相同的标签）
          const libTag = tags.find(t => t.cn === untranslated[i].cn);
          if (libTag) libTag.en = r.dst;
        }
      });
      saveCanvas();
      Storage.set("tags", tags);
    } else if (data.error_code) {
      showToast(`翻译失败: ${data.error_msg || '未知错误'}`, "error");
    }
  } catch(e) {
    showToast("翻译请求失败: " + e.message, "error");
  }
}

async function translateToggle() {
  showEn = !showEn;
  renderCanvas();

  // 切换到英文时，批量自动翻译缺失的标签
  if (showEn && !_translating) {
    const untranslated = canvasTags.filter(t => !t.en);
    if (untranslated.length > 0) {
      _translating = true;
      await autoTranslateAll(untranslated);
      renderCanvas();
      _translating = false;
    }
  }
}
