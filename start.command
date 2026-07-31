#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# 杀掉旧进程
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 0.5

node -e "
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const PORT = 3000;
const ROOT = process.cwd();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

// 读取数据目录配置（统一存放所有数据：JSON + 图片）
let dataDir = '';
try {
  const cfg = fs.readFileSync(path.join(ROOT, 'image-folder.txt'), 'utf8').trim();
  if (cfg && fs.existsSync(cfg)) dataDir = cfg;
} catch (_) {}
// 兜底：默认使用项目根目录下的 data 文件夹
if (!dataDir) {
  dataDir = path.join(ROOT, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  console.log('数据目录: ' + dataDir);
}

// 数据文件路径（动态计算，支持运行时切换 dataDir）
function itemsFile() { return path.join(dataDir, 'insp-items.json'); }
function configFile() { return path.join(dataDir, 'insp-config.json'); }
function appDataFile() { return path.join(dataDir, 'app-data.json'); }
function tagsFile() { return path.join(dataDir, 'insp-tags.json'); }

// 迁移：如果项目根目录有旧 JSON 文件，移入 dataDir
['insp-items.json', 'insp-config.json', 'app-data.json', 'insp-tags.json'].forEach(f => {
  const oldFile = path.join(ROOT, f);
  const newFile = path.join(dataDir, f);
  if (fs.existsSync(oldFile) && !fs.existsSync(newFile)) {
    fs.copyFileSync(oldFile, newFile);
    console.log('已迁移: ' + f + ' -> ' + dataDir);
  }
});

// 安全读取 JSON 文件
function readJSON(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (_) { return fallback; }
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// 首次启动：确保 JSON 文件存在
if (!fs.existsSync(itemsFile())) writeJSON(itemsFile(), []);
if (!fs.existsSync(configFile())) writeJSON(configFile(), { mode: 'folder', folderName: 'data' });
if (!fs.existsSync(appDataFile())) writeJSON(appDataFile(), { tags: [], categories: [], canvas: [] });
if (!fs.existsSync(tagsFile())) writeJSON(tagsFile(), []);

// 读取请求 body
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');

  // ========== API 路由 ==========
  try {
    if (req.method === 'GET' && url.pathname === '/api/items') {
      const items = readJSON(itemsFile(), []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(items));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/items') {
      const body = await readBody(req);
      let items;
      try { items = JSON.parse(body); }
      catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求体不是合法的 JSON' }));
        return;
      }
      writeJSON(itemsFile(), Array.isArray(items) ? items : []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/cfg') {
      const cfg = readJSON(configFile(), { mode: 'local', folderName: '' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cfg));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/cfg') {
      const body = await readBody(req);
      let cfg;
      try { cfg = JSON.parse(body); }
      catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求体不是合法的 JSON' }));
        return;
      }
      writeJSON(configFile(), cfg);
      // 同步更新数据文件夹
      if (cfg.folderName !== undefined) {
        const newDir = path.join(ROOT, cfg.folderName);
        if (fs.existsSync(newDir)) {
          dataDir = newDir;
          // 持久化到 image-folder.txt，确保重启后仍使用此目录
          fs.writeFileSync(path.join(ROOT, 'image-folder.txt'), dataDir, 'utf8');
          // 在新目录中自动创建 JSON 文件
          if (!fs.existsSync(itemsFile())) writeJSON(itemsFile(), []);
          if (!fs.existsSync(configFile())) writeJSON(configFile(), cfg);
          if (!fs.existsSync(appDataFile())) writeJSON(appDataFile(), { tags: [], categories: [], canvas: [] });
          if (!fs.existsSync(tagsFile())) writeJSON(tagsFile(), []);
          console.log('已切换数据目录: ' + dataDir);
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ========== /api/tags：灵感标签池 ==========
    if (req.method === 'GET' && url.pathname === '/api/tags') {
      const tags = readJSON(tagsFile(), []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(Array.isArray(tags) ? tags : []));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/tags') {
      const body = await readBody(req);
      let tags;
      try { tags = JSON.parse(body); }
      catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求体不是合法的 JSON' }));
        return;
      }
      writeJSON(tagsFile(), Array.isArray(tags) ? tags : []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ========== /api/app-data：原子提示词核心数据 ==========
    if (req.method === 'GET' && url.pathname === '/api/app-data') {
      const data = readJSON(appDataFile(), { tags: [], categories: [], canvas: [] });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/app-data') {
      const body = await readBody(req);
      let data;
      try { data = JSON.parse(body); }
      catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求体不是合法的 JSON' }));
        return;
      }
      writeJSON(appDataFile(), {
        tags: Array.isArray(data.tags) ? data.tags : [],
        categories: Array.isArray(data.categories) ? data.categories : [],
        canvas: Array.isArray(data.canvas) ? data.canvas : []
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ========== /api/reset：重置所有数据 ==========
    if (req.method === 'POST' && url.pathname === '/api/reset') {
      // 删除数据目录中的所有文件（图片 + JSON）
      if (dataDir && fs.existsSync(dataDir)) {
        fs.readdirSync(dataDir).forEach(f => {
          try { fs.unlinkSync(path.join(dataDir, f)); } catch (_) {}
        });
      }
      // 重新创建空的数据文件
      writeJSON(appDataFile(), { tags: [], categories: [], canvas: [] });
      writeJSON(itemsFile(), []);
      writeJSON(tagsFile(), []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: dataDir }));
      return;
    }
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
    return;
  }

  // ========== /api/folder-info：获取图片文件夹信息 ==========
  if (req.method === 'GET' && url.pathname === '/api/folder-info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ path: dataDir, exists: dataDir ? fs.existsSync(dataDir) : false }));
    return;
  }

  // ========== /api/open-folder：在 Finder 中打开文件夹 ==========
  if (req.method === 'POST' && url.pathname === '/api/open-folder') {
    if (dataDir) {
      spawn('open', [dataDir]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: dataDir }));
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '未设置图片文件夹' }));
    }
    return;
  }

  // ========== /img/ 路由：本地图片 ==========
  if (url.pathname.startsWith('/img/') && dataDir) {
    const fname = decodeURIComponent(url.pathname.slice(5));
    const fp = path.join(dataDir, fname);
    if (!fp.startsWith(dataDir)) { res.writeHead(403); res.end(); return; }
    const ext = path.extname(fp);
    fs.readFile(fp, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(d);
    });
    return;
  }

  // ========== 默认：静态文件 ==========
  let fp = path.join(ROOT, url.pathname === '/' ? '/index.html' : url.pathname);
  fp = path.normalize(fp);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  const ext = path.extname(fp);
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(d);
  });
});

server.listen(PORT, () => {
  console.log('服务已启动: http://localhost:' + PORT);
  console.log('数据文件: ' + itemsFile());
  if (dataDir) console.log('图片目录: ' + dataDir);
});
" &

sleep 1
open http://localhost:3000
echo "在浏览器中访问 http://localhost:3000"
echo "关闭此窗口停止服务"
