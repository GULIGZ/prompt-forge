/* ============================================================
   图片反推：上传压缩 / LLM 分析 / 复制结果 / 转解析
   依赖 modules/api.js、modules/parser.js、modules/ui.js(showToast)
   与 app.js 运行时全局（switchMode/doParse）
   ============================================================ */

// ========== 图片反推 ==========
let _reverseImageData = null; // base64 data

function handleImageUpload(file) {
  if (!file) return;
  const area = $("#image-upload-area");
  const preview = $("#image-preview");
  // 先压缩图片再转 base64，避免上传超大原始图
  const img = new Image();
  img.onload = () => {
    const MAX = 1024; // 最长边不超过 1024px
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > MAX || h > MAX) {
      const ratio = Math.min(MAX / w, MAX / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    _reverseImageData = c.toDataURL("image/jpeg", 0.85);
    preview.src = _reverseImageData;
    preview.classList.remove("hidden");
    area.querySelector(".image-upload-hint")?.classList.add("hidden");
    area.style.padding = "8px";
  };
  img.src = URL.createObjectURL(file);
}

async function doReversePrompt() {
  if (!_reverseImageData) return showToast("请先上传图片", "info");
  if (!apiConfig.key) return showToast("请先在设置中配置 API 密钥 🔑", "info");
  const provider = API_PROVIDERS[apiConfig.provider] || API_PROVIDERS.openai;
  if (!provider.supportsVision) {
    showToast("当前" + provider.name + "不支持图片反推", "info"); return;
  }
  const btn = $("#btn-reverse");
  const resultEl = $("#reverse-result");
  btn.classList.add("loading");
  btn.disabled = true;
  resultEl.value = "⏳ 正在分析图片...";
  try {
    const { content, error } = await callOpenAI([
      { role: "system", content: getPromptConfig("reverse") },
      { role: "user", content: [
        { type: "image_url", image_url: { url: _reverseImageData } },
        { type: "text", text: "请反推这张图片的提示词" },
      ]},
    ], { model: apiConfig.model });
    if (error) {
      resultEl.value = `❌ 反推失败\n\n当前配置：${provider.name} / ${apiConfig.model}\n错误详情：${error}\n\n提示：当前模型，可能不支持 OpenAI 标准的图片格式。试试在设置中添加硅基流动(支持 Vision)的 API 配置。`;
      return;
    }
    resultEl.value = content;
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

function copyReverseResult() {
  const el = $("#reverse-result");
  if (!el.value || el.value.startsWith("等待") || el.value.startsWith("⏳") || el.value.startsWith("❌")) return;
  navigator.clipboard.writeText(el.value).then(() => showToast("已复制", "success")).catch(() => showToast("复制失败", "error"));
}

function reverseToParse() {
  const el = $("#reverse-result");
  if (!el.value || el.value.startsWith("等待") || el.value.startsWith("⏳") || el.value.startsWith("❌")) return;
  $("#parse-input").value = el.value;
  switchMode("parse");
  doParse();
}
