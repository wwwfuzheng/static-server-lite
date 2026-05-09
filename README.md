# static-server-lite

一个轻量级静态资源服务，自带管理后台 Web UI。

- 公开静态资源直接挂在**根 URL**（不带 `/files/` 前缀），且**不暴露目录列表**。
- 管理后台（React）登录后可浏览、新建文件夹、删除文件/文件夹、上传文件，并可一键在新标签页访问任一文件的静态 URL。
- 完整技术方案见 [doc/技术方案.md](doc/技术方案.md)。
- **服务器运维由 AI 接管时**，请先阅读 [OPS.md](OPS.md)（启动 / 重启 / 部署 / 故障排查规范）。

## 技术栈

- **后端**：Koa 2、JWT (jsonwebtoken)、bcryptjs、@koa/multer、koa-send、pino
- **前端**：React 18、Vite、Ant Design 5、Zustand、axios、React Router 6
- **测试**：Vitest、Supertest、React Testing Library、MSW

## 目录结构

```
server/                 Koa API + 静态文件托管
web/                    React 管理后台 SPA（Vite）
doc/技术方案.md          技术方案文档
scripts/gen-hash.mjs    生成 ADMIN_PASSWORD_HASH 的辅助脚本
OPS.md                  AI 运维指南（生产部署 / 重启 / 故障排查）
```

## 快速开始（开发）

```bash
pnpm install

# 1. 生成管理员密码的 bcrypt 哈希
pnpm gen:hash mypassword

# 2. 在仓库根创建 .env
cp .env.example .env
# 填入 JWT_SECRET（≥32 字符）和 ADMIN_PASSWORD_HASH

# 3. 启动后端（:3000）
pnpm dev:server

# 4. 另一个终端启动前端（:5173，自动代理 /api 到后端 PORT）
pnpm dev:web

# 浏览器访问 http://localhost:5173/admin
```

## 生产构建

构建前端并本机试跑（不带进程管理）：

```bash
pnpm build:web        # 产出 web/dist
pnpm start            # Node 同时托管 API + SPA + 静态文件
# 访问 http://localhost:3000/admin
```

> 服务器上**不要**用 `pnpm start` 直接前台跑；请用下面的 pm2 方式。

## 服务器部署（pm2）

仓库根带 `ecosystem.config.cjs`，已锁死 fork 单实例（**不要改成 cluster** —— 登录限流器是进程内 Map，文件上传直接落盘）。

**首次部署**（仅做一次）：

```bash
# 0. 服务器上装 pm2（一次性，需 sudo 看用户权限）
npm i -g pm2

# 1. clone 仓库到目标目录，配置 .env
cp .env.example .env
vi .env                                         # 填 JWT_SECRET (≥32 字符)、ADMIN_USERNAME、ADMIN_PASSWORD_HASH

# 2. 安装 + 构建
pnpm install --frozen-lockfile
pnpm build:web
mkdir -p logs                                   # pm2 日志目录（已 gitignore）

# 3. 启动 + 持久化 + 开机自启
pm2 start ecosystem.config.cjs
pm2 save                                        # 写入 pm2 dump，下次 pm2 resurrect 能恢复
pm2 startup                                     # 输出一行 sudo 命令，按提示执行
```

**日常更新**：

```bash
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build:web
pm2 restart static-server-lite
```

**常用命令**：

```bash
pm2 status                                      # 看进程状态
pm2 logs static-server-lite --lines 200         # 看日志（也写入 logs/pm2-{out,error}.log）
pm2 restart static-server-lite                  # 重启（约 1-3s 中断）
pm2 reload ecosystem.config.cjs                 # 改了 ecosystem.config.cjs 后用这个，不要用 restart
```

完整运维规范（含安全红线、回滚流程、故障速查）见 [OPS.md](OPS.md)。

## 路由优先级

详见 [doc/技术方案.md](doc/技术方案.md)。

| 路径 | 处理器 |
| --- | --- |
| `/api/*` | 业务 API |
| `/admin`、`/admin/*` | React SPA（`web/dist`） |
| 其他 GET/HEAD | 在 `STATIC_ROOT` 下查找文件，未命中 → 404 |

如果 `STATIC_ROOT` 下存在名为 `api` 或 `admin` 的顶级条目，会被上面的路由遮蔽，**无法通过 URL 访问** —— 这是有意设计，由用户自行规避。

## 配置（.env）

仓库根的 `.env` 是**唯一**的配置入口；后端通过 `dotenv` 读取，前端 Vite 通过 `loadEnv(mode, '..', '')` 共享同一份。模板见 [.env.example](.env.example)。

**后端 / 运行时**

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 生产模式同时托管 API + SPA + 静态资源 |
| `LOG_LEVEL` | `info` | pino 日志级别（`trace` / `debug` / `info` / `warn` / `error` / `fatal`） |
| `STATIC_ROOT` | `./public` | 不存在时自动创建 |

**鉴权**

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | （必填） | 非 test 环境必须 ≥ 32 字符；改动会让所有会话失效 |
| `JWT_EXPIRES_IN` | `2h` | token 有效期 |
| `ADMIN_USERNAME` | （必填） | 单管理员账号，无用户库 |
| `ADMIN_PASSWORD_HASH` | （必填） | bcrypt 哈希，用 `pnpm gen:hash <password>` 生成 |

**上传 / 路由**

| Key | 默认值 | 说明 |
| --- | --- | --- |
| `MAX_UPLOAD_SIZE_MB` | `50` | 单文件大小上限；反代层（nginx 等）需相应放开 |
| `RESERVED_PREFIXES` | `/api,/admin` | 不会走静态托管的顶级前缀，新增应用路由时可扩展 |


## 测试

```bash
pnpm test                # 前后端
pnpm test:server         # 仅后端（45 个用例）
pnpm test:web            # 仅前端（14 个用例）
pnpm coverage            # 覆盖率报告
```

后端使用 **Supertest** 直接调用进程内 Koa 应用；每个用例独占一个临时目录作为 `STATIC_ROOT`。前端使用 **MSW** 做 HTTP mock，**React Testing Library** 跑组件流程。

## 接口概览

所有管理接口需要 `Authorization: Bearer <token>`。统一响应：`{ code, data, message }`，`code === 0` 表示成功。

```
POST   /api/auth/login                  body: {username, password} → {token, expiresAt, username}
POST   /api/auth/verify                 (鉴权) → {user}
GET    /api/admin/list?path=/foo        (鉴权) → {path, items[]}
POST   /api/admin/folder                (鉴权) body: {path, name}
DELETE /api/admin/folder                (鉴权) body: {path}（必须为空）
DELETE /api/admin/file                  (鉴权) body: {path}
POST   /api/admin/files/batch-delete    (鉴权) body: {paths[]}
POST   /api/admin/upload                (鉴权) multipart: path + files[]

GET    /<任意路径>                       公开；下发 STATIC_ROOT/<任意路径>，未命中 404
```

## 安全说明

- 路径穿越防御位于 `server/src/utils/safePath.js`：前导 `/` 视为相对根目录（客户端约定），`..`、null byte、Windows 盘符均被拒绝。
- `koa-send` 配置 `hidden: false`、`index: false` —— **dotfile 不下发，永不返回目录列表**。
- 登录尝试限流：5 次/分钟/IP。
- 密码 bcrypt 存储；token 使用 JWT。

## 许可证

MIT
