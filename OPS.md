# OPS.md — AI 运维指南

> 本文档面向**接管本服务运维的 AI 助手**（已通过 SSH 等方式接入生产服务器的 AI agent）。如果你是 AI，请在执行任何运维动作前完整阅读本文件。

本项目是 Node 18+ / Koa + Vite 单体应用。**生产模式**下用 **pm2** 跑一个 Node 进程，同时托管 API、SPA、静态资源，监听单端口（默认 `3000`，受 `.env` 中 `PORT` 控制）。

> **不适用场景**：本机开发态调试用 `pnpm dev:server` + `pnpm dev:web`，不要套用本指南。

---

## 安全红线（先读再做）

执行任何运维动作之前必须遵守：

1. **永远不要 `rm -rf` 项目目录、`STATIC_ROOT` 或 `node_modules` 之外的任何路径**。`STATIC_ROOT` 下是用户托管的真实文件，删除等于丢数据。
2. **改 `.env` 之前先备份**：`cp .env .env.bak.$(date +%Y%m%d-%H%M%S)`。`JWT_SECRET` 一旦更换，所有已登录会话立即失效（这通常是用户不想要的副作用）。
3. **不要 `git reset --hard` / `git clean -fd`**，除非用户明确要求。服务器上可能有手动调试改动或临时配置。
4. **不要 `kill -9`**，先 `pm2 stop` 让进程优雅退出；万不得已用 `kill -15`，等 5–10s 没退再升级到 `-9`。
5. **生产模式不要跑测试**（`pnpm test` 会创建临时目录、可能影响本机环境）。
6. **构建前确认磁盘空间**：`df -h .`。`web/dist` 构建峰值占用通常 < 200MB，但 `node_modules` 安装失败常因磁盘满。
7. **执行重启 / 部署 / 回滚前，先把"打算做什么 + 预计影响（短暂中断 N 秒）+ 涉及的命令"复述给用户，等用户确认再执行**。运维动作不可逆性高，宁可多确认一次。

---

## 第一步：确认 pm2 在跑

到达服务器后先确认状态，**不要假设**：

```bash
pm2 list                                              # 应能看到 static-server-lite 这一行，status = online
ss -ltnp | grep -E ':3000\b' || lsof -iTCP:3000 -sTCP:LISTEN   # 端口监听确认（默认 3000）
```

**如果 `pm2 list` 没有这条**，可能是：

- 进程从未启动过 → 看下文【首次用 pm2 接管服务】
- pm2 daemon 重启过没恢复 → `pm2 resurrect`（会读上次 `pm2 save` 的进程列表）
- 别人停过没启回来 → 跟用户确认后 `pm2 start ecosystem.config.cjs`

**如果端口被占却找不到 pm2 进程**，停下来询问用户 —— 可能是别的服务占了端口。

---

## 常用动作

下面命令默认在仓库根目录执行。`<REPO>` 表示该绝对路径。环境变量从仓库根的 `.env` 读取。

### 状态检查（read-only，可直接做）

```bash
pm2 status                                                              # 概览
pm2 describe static-server-lite                                         # 详情：cwd、env、重启次数、内存
pm2 list --watch 2>/dev/null || true                                    # 偶尔扫一眼

# 端口 & 健康（首选 /admin —— 应用真正的入口）
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:${PORT:-3000}/admin
# 期望 200（SPA index.html）。
# 503 = web/dist 没构建（跑 pnpm build:web）；000 = 没监听；500 = 进程在但内部错。
# 注意：根路径 / 不做重定向；STATIC_ROOT 下没 index.html 时会返回 404，这是正常行为。

# 简易接口探活（不需要 token，只看是否能解析到 /api 路由）
curl -fsS -X POST http://127.0.0.1:${PORT:-3000}/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"_probe","password":"_probe"}' \
  -o /dev/null -w 'http=%{http_code}\n'
# 期望 401（凭据错），证明 API 链路通；000/502 = 异常。
```

关注 `pm2 describe` 输出里的 **restart** 次数：短时间内频繁增长 = 进程在崩溃循环，立即查日志。

### 查看日志（read-only）

```bash
pm2 logs static-server-lite --lines 200 --nostream      # 最近 200 行（推荐）
pm2 logs static-server-lite --err --lines 100 --nostream # 仅 error 流
pm2 logs static-server-lite                              # 实时 tail（看完按 Ctrl+C）

# 文件位置（ecosystem.config.cjs 配置）
tail -n 200 <REPO>/logs/pm2-error.log
tail -n 200 <REPO>/logs/pm2-out.log
```

服务用 `pino` 输出 JSON 行日志，必要时 `| jq` 过滤，例如：

```bash
tail -n 500 <REPO>/logs/pm2-out.log | jq 'select(.level >= 40)'   # warn 及以上
```

### 重启（**需用户确认**）

```bash
pm2 restart static-server-lite
```

重启会有 ~1–3 秒中断。重启后立刻做一次健康检查（上面的 `curl /admin` 拿到 200）。**没拿到就不要离开**，立即看日志找原因。

### 停止 / 启动（**需用户确认**）

```bash
pm2 stop static-server-lite
pm2 start static-server-lite                            # 已存在条目时，重新拉起
pm2 start ecosystem.config.cjs                          # 不存在条目时（如刚 pm2 delete 过），用配置启动
```

> `pm2 start <name>` 和 `pm2 start ecosystem.config.cjs` 不一样：前者按 pm2 内部记录的旧条目启动；后者重新读配置文件。**改过 `ecosystem.config.cjs` 后必须用后者，或 `pm2 reload ecosystem.config.cjs`，否则改动不生效**。

### 首次用 pm2 接管服务（仅初次部署做一次）

仓库根有 `ecosystem.config.cjs`，**必须用它启动**，不要 `pm2 start server/src/server.js` 直接跑（会丢配置、丢 cwd 锁定）。

```bash
cd <REPO>
cp .env.example .env && vi .env                 # 填 JWT_SECRET (≥32 字符)、ADMIN_USERNAME、ADMIN_PASSWORD_HASH
pnpm install --frozen-lockfile
pnpm build:web                                  # 构建前端，不然 /admin 404
mkdir -p logs                                   # 日志目录（已 gitignore）

pm2 start ecosystem.config.cjs                  # 启动
pm2 save                                        # 把进程列表写入 pm2 dump，重启后能恢复
pm2 startup                                     # 输出一行 sudo 命令，按提示执行 → 开机自启
```

**关键约束**：本服务**只能 fork 单实例**（登录限流器是进程内 Map，文件上传直接落盘）。`ecosystem.config.cjs` 已锁死 `exec_mode: 'fork'` + `instances: 1`，**不要改成 cluster**。

### 部署 / 更新到最新代码（**需用户确认**）

完整流程，**任何一步失败都立即停下来报告**，不要继续：

```bash
cd <REPO>

# 1) 先检查当前是否干净
git status --porcelain                # 有输出 = 工作区有未提交改动，停下询问
git rev-parse --abbrev-ref HEAD       # 确认在预期分支（通常 main）

# 2) 拉新代码
git fetch --prune
git pull --ff-only                    # 只允许快进，避免意外 merge commit

# 3) 装依赖（lockfile 决定，不写入）
pnpm install --frozen-lockfile

# 4) 构建前端
pnpm build:web

# 5) 重启
pm2 restart static-server-lite

# 6) 健康检查
sleep 2 && curl -fsS -o /dev/null -w 'http=%{http_code}\n' http://127.0.0.1:${PORT:-3000}/
```

> **零停机部署**：本项目是单实例托管 SPA + API，重启会有 ~1–3 秒中断。如果用户要求严格零停机，需要在前面加反代（nginx / caddy）+ 双实例蓝绿，**这超出本指南范围，请先询问用户是否要做架构调整**。

### 回滚（**需用户确认**）

部署翻车时：

```bash
cd <REPO>
git log --oneline -n 10                       # 找到上一个稳定 commit
git reset --hard <commit-sha>                 # ⚠️ 仅在确认无未提交改动时
pnpm install --frozen-lockfile
pnpm build:web
pm2 restart static-server-lite
```

`git reset --hard` 是高风险动作 —— **必须**先确认 `git status` 干净，并向用户复述将要回滚到哪个 commit、丢失哪些 commit。

---

## 故障诊断速查

| 症状 | 先查什么 | 常见原因 |
| --- | --- | --- |
| `curl /` 返回 000 / 拒绝连接 | `pm2 list` 看 status；端口是否监听 | 进程崩溃 / stopped；端口被改但反代没改 |
| `pm2 list` 显示 errored / 重启次数飙升 | `pm2 logs --err --lines 100` | `.env` 缺 `JWT_SECRET`（非 test 环境强制 ≥32 字符）；`STATIC_ROOT` 不存在；端口被占 |
| 502 / 504 经反代来 | 反代日志 + `pm2 logs` | upstream 端口写错；防火墙；进程 OOM 被 pm2 重启（看 `pm2 describe` 的 memory） |
| 登录一直失败 | `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | hash 没用 `pnpm gen:hash` 生成；改过密码但忘了 `pm2 restart` |
| 上传 413 | `MAX_UPLOAD_SIZE_MB` + 反代 `client_max_body_size` | 反代层先于应用层拦了 |
| `/admin` 404 | `web/dist/index.html` 是否存在 | 没跑 `pnpm build:web` 就启动了生产模式 |
| 部署后页面白屏 | 浏览器控制台 + `web/dist/assets/` | 浏览器缓存了旧 chunk 引用；让用户硬刷 |
| 改了 `ecosystem.config.cjs` 不生效 | 是否用 `pm2 start <name>` 而非配置文件 | 必须 `pm2 reload ecosystem.config.cjs` 或 `pm2 delete` 后重新 start |

定位思路：**先看 `pm2 list` / 端口、再看日志最后 50 行、再看 `.env`**。九成问题在前两步出结果。

---

## 关键路径与配置参考

| 项 | 位置 / 默认 | 说明 |
| --- | --- | --- |
| pm2 配置 | `ecosystem.config.cjs`（仓库根） | 锁死 fork + 单实例，不要改成 cluster |
| 入口 | `server/src/server.js` | pm2 直接拉起 |
| 前端产物 | `web/dist/` | `pnpm build:web` 产出，由后端在 `/admin/*` 托管 |
| 环境变量 | `.env`（仓库根） | 模板见 `.env.example` |
| 静态资源根 | `STATIC_ROOT`（默认 `./public`） | 用户托管文件的根；**勿动其下内容** |
| 监听端口 | `PORT`（默认 `3000`） | 单端口同时跑 API + SPA + 静态 |
| 鉴权密钥 | `JWT_SECRET`（≥32 字符） | 改动会让所有会话失效 |
| 管理员账号 | `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` | hash 用 `pnpm gen:hash <password>` 生成 |
| 上传上限 | `MAX_UPLOAD_SIZE_MB`（默认 50） | 同时检查反代层 |
| 保留前缀 | `RESERVED_PREFIXES`（默认 `/api,/admin`） | 这些前缀走应用路由，不走静态托管 |
| pm2 日志 | `<REPO>/logs/pm2-{out,error}.log` | 已 gitignore |

---

## 报告格式

每次执行运维动作后，给用户一段简明回报，包含：

1. **做了什么**（一两句）
2. **健康检查结果**（HTTP 码 + 关键日志片段，3–5 行）
3. **下一步建议**（如需用户做什么、要不要再观察）

例：

> 已 `pm2 restart static-server-lite`。`pm2 list` 显示 online，重启计数无异常增长；健康检查 `GET /admin` 返回 200（SPA 入口正常），日志最后 5 行无 ERROR。建议观察 5 分钟，如有异常我再排查。

---

## 边界

以下事情**不要**自动做，要先和用户对齐：

- 改防火墙 / 安全组 / nginx / caddy 配置
- 装新软件（`apt`/`yum`/`brew install`），包括 `npm i -g pm2` 本身
- 修改 `ecosystem.config.cjs`（特别是 `exec_mode` / `instances`）
- 修改 `JWT_SECRET`（会让所有用户掉线）
- 触碰 `STATIC_ROOT` 下的用户文件（这是用户托管的内容，不是项目资产）
- 跨用户操作（`sudo -u`、改 owner / group）
- `pm2 delete static-server-lite`（会丢失 pm2 内部记录的配置；必须重 `pm2 start ecosystem.config.cjs` 才能恢复）
- 数据库迁移（本项目目前无 DB；如未来引入，单独写迁移文档）
