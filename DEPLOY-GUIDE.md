# 跨设备同步后端 · 云端上线指南（免费 · 约 3 分钟）

> 前端已上传 CloudStudio（静态页，可看 + 同步 UI 就绪，但跑不了后端）。
> 后端 `server.js` 需部署到能运行 Node 的云平台，手机⇄电脑才能实时同步同一份数据。

## 已为你准备好的文件（已在 git 仓库中）
- `server.js` — 零依赖 Node 同步服务（/api/state 合并存储 + /api/summary 简报）
- `render.yaml` — Render 一键部署配置
- `Dockerfile` / `Procfile` — 通用容器/平台部署
- `package.json` — `npm start` 启动
- `sync-config.example.json` — 前端指定后端地址的模板

## 方式 A：Render + GitHub（推荐，免费）
1. 在 GitHub 新建一个**空仓库**（如 `workbuddy-workbench`）。
2. 在本机 `personal-workbench/` 目录执行（把 `<你的仓库地址>` 换成真实 HTTPS 地址）：
   ```bash
   git remote add origin <你的仓库地址>
   git branch -M main
   git push -u origin main
   ```
3. 打开 [render.com](https://render.com) → New → Blueprint → 连接该 GitHub 仓库 → 选 `render.yaml` → Create New Resources。
4. 部署完成后得到 `https://xxxx.onrender.com`。
5. 把 `sync-config.example.json` 改名为 `sync-config.json`，内容填：
   ```json
   { "apiBase": "https://xxxx.onrender.com" }
   ```
6. 重新部署静态前端（CloudStudio 上传 `personal-workbench/`），或在本地把该文件放同一目录即可。
7. 手机/电脑打开工作台，状态条显示 `🟢 已同步云端`，跨设备实时互通。

## 方式 B：你有 Render / Railway Token
把部署/API Token 发我，我直接调 API 完成部署（你操作最少）。Token 仅用于本次部署。

## 方式 C：Docker（若有自己的服务器）
```bash
docker build -t workbench-sync .
docker run -d -p 3000:3000 workbench-sync
```

## 验证
部署后访问 `https://<你的地址>/api/summary` 应返回纯文本每日简报，即成功。
此后两个自动化（每日 7:00 / 每周五 18:00）会抓取该地址生成手机推送。

## 登录（手机/电脑远程使用）
后端已加访问口令鉴权，只有登录后才能读写，保证数据是你的：
- 默认口令：`WorkBuddy2026`（部署时建议用环境变量 `WB_TOKEN` 改成你自己的强口令）。
- 部署后在 `sync-config.json` 填好后端地址，打开工作台会自动弹出登录框；登录后状态条显示 `🟢 已登录同步`，点状态条可退出。
- 手机：在浏览器打开同一后端地址（或 CloudStudio 链接 + sync-config.json 指向后端），输入口令即登录，与电脑同一份数据实时同步。
- 自动化抓取 `/api/summary` 也走同一后端，无需单独登录（服务端内部读取）。
