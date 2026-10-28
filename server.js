/* 个人工作台 · 跨设备同步后端（纯 Node，零依赖）
 * - 托管静态页面（index.html 等同目录文件）
 * - GET  /api/state   读取全量模块 {rev, modules:{key:{updatedAt,value}}}
 * - POST /api/state   按模块 updatedAt 合并后写回
 * - GET  /api/summary 返回纯文本每日/每周简报（供自动化抓取推送）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'sync-data.json');
const PORT = process.env.PORT || 3000;
// 访问口令：部署时可用环境变量 WB_TOKEN 覆盖；未设置则用默认口令
const WB_TOKEN = process.env.WB_TOKEN || 'WorkBuddy2026';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8'
};

function load() {
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); }
  catch (e) { return { rev: 0, modules: {} }; }
}
function save(o) {
  try { fs.writeFileSync(DATA, JSON.stringify(o)); } catch (e) {}
}
function send(res, code, obj, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(typeof obj === 'string' ? obj : JSON.stringify(obj));
}

function keyOf(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function weekKeyOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = x.getDay();
  x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd));
  return keyOf(x);
}

function buildSummary(g) {
  const d = new Date();
  const t = keyOf(d);
  const todos = g.todos || [];
  const active = todos.filter(x => !x.done);
  const done = todos.filter(x => x.done);
  const water = (g.water && g.water[t]) || 0;
  const en_days = g.en_days || [];
  const en_lib = g.en_learned || [];
  const set = new Set(en_days);
  let streak = 0; const tmp = new Date(d);
  while (set.has(keyOf(tmp))) { streak++; tmp.setDate(tmp.getDate() - 1); }
  const policy_user = g.policy_user || [];
  const weekplans = g.weekplans || {};
  const wk = weekKeyOf(d);
  const wp = weekplans[wk] || [];
  const wpDone = wp.filter(x => x.done).length;
  const L = [];
  L.push('【个人工作台每日进展】 ' + t);
  L.push('');
  L.push('一、今日待办：进行中 ' + active.length + ' 项，已完成 ' + done.length + ' 项');
  if (active.length) L.push('   重点：' + active.slice(0, 3).map(x => x.text).join('；'));
  L.push('二、饮水：今日 ' + water + ' / 1500 ml' + (water >= 1500 ? '（已达标✅）' : '（未达标，记得多喝水💧）'));
  L.push('三、英语学习：连续 ' + streak + ' 天，累计 ' + en_lib.length + ' 条');
  L.push('四、本周计划：完成 ' + wpDone + ' / ' + wp.length + (wp.length && wpDone === wp.length ? '（全部完成🎉）' : ''));
  L.push('五、政策速递：用户自定义政策 ' + policy_user.length + ' 条' + (policy_user.length ? '，最新：' + policy_user[0].title : ''));
  L.push('');
  L.push('💡 新的一天，稳步推进，注意休息与饮水。');
  return L.join('\n');
}

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];

  if (req.method === 'OPTIONS') { send(res, 204, ''); return; }

  // 登录：校验访问口令，返回 token
  if (u === '/api/login' && req.method === 'POST') {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      let pass = '';
      try { pass = (JSON.parse(b).pass) || ''; } catch (e) {}
      if (pass === WB_TOKEN) send(res, 200, { token: WB_TOKEN });
      else send(res, 401, { error: 'bad pass' });
    });
    return;
  }

  // 以下接口需鉴权
  const authed = (req.headers['x-wb-token'] || '') === WB_TOKEN;

  if (u === '/api/state' && req.method === 'GET') {
    if (!authed) { send(res, 401, { error: 'unauthorized' }); return; }
    send(res, 200, load()); return;
  }

  if (u === '/api/state' && req.method === 'POST') {
    if (!authed) { send(res, 401, { error: 'unauthorized' }); return; }
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      let inc;
      try { inc = JSON.parse(b); } catch (e) { send(res, 400, { error: 'bad json' }); return; }
      const cur = load();
      const mods = cur.modules || {};
      for (const k in (inc.modules || {})) {
        const m = inc.modules[k];
        const ex = mods[k];
        if (!ex || (m.updatedAt || 0) >= (ex.updatedAt || 0)) {
          mods[k] = { updatedAt: m.updatedAt || Date.now(), value: m.value };
        }
      }
      cur.modules = mods; cur.rev = (cur.rev || 0) + 1; save(cur); send(res, 200, cur);
    });
    return;
  }

  if (u === '/api/summary' && req.method === 'GET') {
    if (!authed) { send(res, 401, { error: 'unauthorized' }); return; }
    const m = load().modules || {};
    const g = {};
    for (const k in m) g[k] = m[k] ? m[k].value : null;
    send(res, 200, buildSummary(g), 'text/plain; charset=utf-8');
    return;
  }

  // 静态托管
  let fp = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, (err, buf) => {
    if (err) {
      // 未知路由回退到首页（SPA 友好）
      fs.readFile(path.join(ROOT, 'index.html'), (e2, b2) => {
        if (e2) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(b2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, () => console.log('WorkBench sync server listening on ' + PORT));
