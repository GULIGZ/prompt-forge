/* ============================================================
   AI API 层：服务商配置 / 多配置管理 / OpenAI 兼容调用 / Embedding
   依赖 modules/storage.js(Storage) 与 modules/ui.js(showToast)
   ============================================================ */

// API 配置
const API_PROVIDERS = {
  openai: { baseURL: "https://api.openai.com/v1", supportsVision: true, name: "OpenAI", authType: "bearer" },
  xiaomi: { baseURL: "https://api.xiaomimimo.com/v1", supportsVision: true, name: "小米 MiMo", authType: "bearer" },
  deepseek: { baseURL: "https://api.deepseek.com", supportsVision: false, name: "DeepSeek", authType: "bearer" },
  moonshot: { baseURL: "https://api.moonshot.cn/v1", supportsVision: true, name: "Moonshot (Kimi)", authType: "bearer" },
  zhipu: { baseURL: "https://open.bigmodel.cn/api/paas/v4", supportsVision: true, name: "智谱 AI", authType: "bearer" },
  siliconflow: { baseURL: "https://api.siliconflow.cn/v1", supportsVision: true, name: "硅基流动", authType: "bearer" },
  alibaba: { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", supportsVision: true, name: "阿里云百炼", authType: "bearer" },
  anthropic: { baseURL: "https://api.anthropic.com/v1", supportsVision: true, name: "Anthropic", authType: "bearer", header: "x-api-key" },
  openrouter: { baseURL: "https://openrouter.ai/api/v1", supportsVision: true, name: "OpenRouter", authType: "bearer" },
  together: { baseURL: "https://api.together.xyz/v1", supportsVision: true, name: "Together AI", authType: "bearer" },
  groq: { baseURL: "https://api.groq.com/openai/v1", supportsVision: true, name: "Groq", authType: "bearer" },
  custom: { baseURL: "", supportsVision: false, name: "自定义", authType: "bearer" },
};
const PROVIDER_MODELS = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o-mini" },
  ],
  xiaomi: [
    { value: "mimo-v2.5", label: "mimo-v2.5" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek-V3" },
    { value: "deepseek-reasoner", label: "DeepSeek-R1" },
  ],
  moonshot: [
    { value: "moonshot-v1-8k", label: "moonshot-v1-8k" },
    { value: "moonshot-v1-32k", label: "moonshot-v1-32k" },
    { value: "moonshot-v1-128k", label: "moonshot-v1-128k" },
  ],
  zhipu: [
    { value: "glm-4-flash", label: "GLM-4-Flash" },
    { value: "glm-4-plus", label: "GLM-4-Plus" },
    { value: "glm-4v-plus", label: "GLM-4V-Plus" },
  ],
  siliconflow: [
    { value: "deepseek-ai/DeepSeek-V3", label: "DeepSeek-V3" },
    { value: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5-72B" },
    { value: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama-3.3-70B" },
  ],
  alibaba: [
    { value: "qwen-max", label: "qwen-max" },
    { value: "qwen-plus", label: "qwen-plus" },
    { value: "qwen-vl-max", label: "qwen-vl-max" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
    { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
  ],
  openrouter: [
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
    { value: "deepseek/deepseek-chat", label: "DeepSeek-V3" },
  ],
  together: [
    { value: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama-3.3-70B" },
    { value: "deepseek-ai/DeepSeek-V3", label: "DeepSeek-V3" },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama-3.3-70B" },
    { value: "mixtral-8x7b-32768", label: "Mixtral-8x7B" },
  ],
  custom: [],
};
// 支持多 API 配置（向后兼容旧的单配置）
let apiConfigs = Storage.get("apiConfigs", []);
let activeApiId = Storage.get("activeApiId", null);

// 向后兼容：旧版单 apiConfig 迁移到新版
const _oldApi = Storage.get("apiConfig", null);
if (_oldApi && _oldApi.key) {
  const migrated = {
    id: 'mig_' + Date.now(),
    name: API_PROVIDERS[_oldApi.provider]?.name || _oldApi.provider,
    provider: _oldApi.provider || "openai",
    key: _oldApi.key,
    model: _oldApi.model || "gpt-4o-mini",
    baseURL: "",
    customModels: "",
  };
  if (!apiConfigs.length) apiConfigs = [migrated];
  else if (!apiConfigs.find(c => c.key === migrated.key)) apiConfigs.unshift(migrated);
  Storage.set("apiConfigs", apiConfigs);
  Storage.set("activeApiId", migrated.id);
  activeApiId = migrated.id;
  localStorage.removeItem("apiConfig"); // 清理旧数据
}

// 确保至少有一个默认空配置
if (!apiConfigs.length) {
  apiConfigs = [{
    id: 'cfg_' + Date.now(),
    name: "OpenAI",
    provider: "openai",
    key: "",
    model: "gpt-4o-mini",
    baseURL: "",
    customModels: "",
  }];
  Storage.set("apiConfigs", apiConfigs);
  activeApiId = apiConfigs[0].id;
  Storage.set("activeApiId", activeApiId);
}
if (!activeApiId) { activeApiId = apiConfigs[0].id; Storage.set("activeApiId", activeApiId); }

function getActiveConfig() {
  return apiConfigs.find(c => c.id === activeApiId) || apiConfigs[0];
}

// 旧 apiConfig 变量兼容（只读，避免老代码报错）
const apiConfig = new Proxy({}, {
  get(_, key) { return getActiveConfig()?.[key]; },
  set(_, key, value) {
    const cfg = getActiveConfig();
    if (cfg) { cfg[key] = value; Storage.set("apiConfigs", apiConfigs); }
    return true;
  }
});
async function callOpenAI(messages, options = {}) {
  const { model: optModel, onStream } = options;
  const cfg = getActiveConfig();
  if (!cfg || !cfg.key) {
    showToast("请先在设置中配置 API 密钥 🔑", "info");
    return { content: "", error: "NO_KEY" };
  }
  const providerKey = cfg.provider;
  const provider = API_PROVIDERS[providerKey] || API_PROVIDERS.openai;
  // 自定义 provider 用用户填写的 baseURL，预设用内置 baseURL
  const baseURL = providerKey === "custom" ? (cfg.baseURL || "").replace(/\/$/, "") : (provider.baseURL || "").replace(/\/$/, "");
  if (providerKey === "custom" && !baseURL) {
    showToast("自定义 API 未填写接口地址", "error");
    return { content: "", error: "NO_BASEURL" };
  }
  const model = optModel || cfg.model;
  try {
    const body = { model, messages, stream: !!onStream };
    if (!onStream) body.temperature = 0.3;

    const headers = { "Content-Type": "application/json" };
    const authType = provider.authType || "bearer";
    const headerName = provider.header || "Authorization";
    if (authType === "bearer") {
      headers[headerName] = `Bearer ${cfg.key}`;
    } else if (authType === "api-key") {
      headers[headerName] = cfg.key;
    }

    const res = await fetch(`${baseURL}/chat/completions`, {
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
// 各服务商对应的 embedding 模型（未列出的不支持向量匹配）
const EMBEDDING_MODELS = {
  openai: "text-embedding-3-small",
  siliconflow: "BAAI/bge-m3",
  alibaba: "text-embedding-v3",
  zhipu: "embedding-3",
  openrouter: "openai/text-embedding-3-small",
};
function supportsEmbedding() { return !!EMBEDDING_MODELS[getActiveConfig()?.provider]; }
// 调 /embeddings 接口，批量返回向量
async function callEmbedding(texts) {
  const cfg = getActiveConfig();
  if (!cfg || !cfg.key) return { vectors: [], error: "NO_KEY" };
  const embModel = EMBEDDING_MODELS[cfg.provider];
  if (!embModel) return { vectors: [], error: "NO_EMBEDDING" };
  const provider = API_PROVIDERS[cfg.provider] || API_PROVIDERS.openai;
  const baseURL = (cfg.provider === "custom" ? (cfg.baseURL || "") : (provider.baseURL || "")).replace(/\/$/, "");
  if (!baseURL) return { vectors: [], error: "NO_BASEURL" };
  const headers = { "Content-Type": "application/json" };
  if (provider.authType === "api-key") headers[provider.header || "Authorization"] = cfg.key;
  else headers[provider.header || "Authorization"] = `Bearer ${cfg.key}`;
  try {
    const res = await fetch(`${baseURL}/embeddings`, {
      method: "POST", headers, body: JSON.stringify({ model: embModel, input: texts }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); return { vectors: [], error: e.error?.message || `HTTP ${res.status}` }; }
    const json = await res.json();
    const vectors = (json.data || []).sort((a, b) => a.index - b.index).map(d => d.embedding);
    return { vectors, error: null };
  } catch (err) {
    return { vectors: [], error: err.message };
  }
}
