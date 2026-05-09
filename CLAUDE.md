# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 常用命令

包管理器使用 **pnpm**（workspace）。除非另有说明，均在仓库根目录执行。

```bash
# 初始化
pnpm install
pnpm gen:hash <password>           # 生成 ADMIN_PASSWORD_HASH 的 bcrypt 哈希

# 开发模式（开两个终端）
pnpm dev:server                    # Koa 后端 :3000（node --watch 热重启）
pnpm dev:web                       # Vite 前端 :5173，自动代理 /api → :PORT

# 生产模式
pnpm build:web                     # 产出 web/dist
pnpm start                         # Node 同时托管 API + SPA + 静态资源，监听 :3000

# 测试
pnpm test                          # 前后端全部测试
pnpm -C /<repo-root> run test:server  # 仅后端 —— 注意 -C 用绝对路径
pnpm -C /<repo-root> run test:web     # 仅前端
pnpm coverage                      # 前后端 + v8 覆盖率

# 单测试运行（在 server/ 或 web/ 目录下）
node ./node_modules/vitest/vitest.mjs run path/to/file.test.js
node ./node_modules/vitest/vitest.mjs run -t "测试名匹配模式"
```

**注意**：直接执行 `pnpm test:server` / `pnpm test:web` 可能报 "Command not found"，因为 pnpm 可能在错误的 workspace 包中查找脚本。解决方案是使用 `pnpm -C <仓库根绝对路径> run <script>`，或先 `cd` 到仓库根目录。

## 架构

两个 workspace，共享一套设计：

- **server/** — 纯 JS，ESM (`"type": "module"`)，Koa 2 API。入口 `src/server.js` 调用 `src/app.js` 的 `createApp(config, logger)`；这种工厂形态是 Supertest 能在每个测试中以进程内方式挂载应用的关键。
- **web/** — TypeScript，React 18，Vite，Ant Design 5。构建产物为 `web/dist`，由后端在 `/admin/*` 下托管。

### 请求路由优先级（关键）

后端按以下顺序装配中间件 —— **先匹配先生效**。修改路由前请先阅读 [doc/技术方案.md §6.7](doc/技术方案.md)。

| 顺序 | 路径 | 处理器 |
| --- | --- | --- |
| 1 | `/api/*` | `routes/auth.js`、`routes/admin.js` |
| 2 | `/admin`、`/admin/*` | `routes/spa.js` —— 资源命中 `web/dist/<asset>` 直接下发；否则 fallback 到 `web/dist/index.html`（`web/dist/index.html` 不存在时返回 503） |
| 3 | 其他所有 GET/HEAD | `routes/static.js` —— 在 `STATIC_ROOT` 下查找文件，未命中 404 |

> **根路径 `/` 不做 302 重定向**：会落到顺序 3 的静态兜底，未命中返回 404。如要进后台请直接访问 `/admin`。

**保留前缀**（`/api`、`/admin`，可通过 `RESERVED_PREFIXES` 配置）会被静态兜底中间件跳过，让前面的路由处理它们。如果 `STATIC_ROOT` 下存在顶级 `api/` 或 `admin/` 目录/文件，会被 URL 路由遮蔽而无法访问 —— **这是有意设计，不在启动时校验**。**不要重新加上这种启动时校验**。

### 路径安全契约

`server/src/utils/safePath.js#resolveSafe(root, relPath)` 是所有用户路径输入的唯一收口：

- **前导 `/` 会被剥离** —— 客户端使用 POSIX 风格的 `/foo/bar`，语义上相对于 `STATIC_ROOT`。**不要把前导 `/` 当作绝对路径拒绝**；M2 阶段就是因为这个出过回归。
- 拒绝 `..` 穿越、null byte、Windows 盘符。
- 所有触碰文件系统的 service 函数（`listDir`、`createDir`、`deleteDir` 等）必须先调用此函数，**不要绕过**。

### 鉴权

- 单管理员账号写在环境变量：`ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`（bcrypt）。**没有用户库**。
- JWT (HS256) 用 `JWT_SECRET` 签名（非 test 环境强制 ≥32 字符）。
- 登录限流：进程内存中的 Map，5 次失败/分钟/IP。集成测试间通过 `_resetRateLimit()` 导出函数重置。

### 前端状态

- `useAuth`（Zustand）是唯一的持久化 store；读写 `localStorage` 的 `sslite_token` / `sslite_user`。
- `src/api/client.ts` 的 axios 拦截器统一注入 `Authorization`，并在任何 401 上清除会话。
- 成功响应遵循 `{ code: 0, data, message }`。`code !== 0` 时拦截器抛出 `ApiError`。

## 测试要点

### 后端（Vitest + Supertest）

- 每个集成测试用独立临时目录作为 `STATIC_ROOT`，通过 `tests/helpers.js#buildTestApp()` 构建；该 helper 同时会清空限流器、使用静默 logger。
- 用 `request(ctx.callback)`，**不要**真的 `app.listen()`。

### 前端（Vitest + RTL + MSW）

代码中有两个非显而易见的 workaround，重构时务必保留：

1. **AntD portal 跨测试泄漏** —— Modal、Popover、Popconfirm、message toast 都通过 portal 渲染到 `document.body`，在 RTL 的容器之外。`tests/setup.ts` 在 `beforeEach` 和 `afterEach` 都调用 `cleanup()` 加上手动的 `document.body.children.forEach(remove)`。否则会出现 "Found multiple elements with role 'button' and name /up/i" 这类重复元素错误。
2. **axios + jsdom + FormData** —— MSW handler 中的 `request.formData()` 会失败，因为 axios 在 jsdom 下不一定能正确设置带 boundary 的 multipart `Content-Type`。Manager 的上传流程测试通过 `vi.mock('../src/api/fs')` mock `uploadFiles`，并通过 `tests/mocks/handlers.ts` 的 `recordUploaded()` 共享 mock 状态。`UploadArea` 单测靠 `request.text()` 上的正则能跑通是因为它的断言更简单。

断言 toast 消息（`message.error(...)`）时，**优先断言由此引起的 DOM/状态变化**，而非 toast 文案本身。AntD 的 `message` 单例容器对 `document.body` 被清空非常敏感。

Popconfirm 的 OK 按钮：body 里可能有多个 "OK"（Popconfirm + Modal 同时存在）。用 `screen.findAllByRole('button', { name: /^ok$/i })` 然后点最后一个。

## 项目约定

- 后端：纯 JS、ESM，**不**用 TypeScript。**不要**给后端加构建步骤。
- 前端：严格 TypeScript。在 `web/` 目录下运行 `node ./node_modules/typescript/bin/tsc --noEmit` 做类型检查。
- 统一响应格式 `{ code, data, message }` 由 `server/src/utils/response.js` 强制；错误经 `utils/errors.js` 的自定义错误类 → `middleware/error.js` 流转。**不要直接 `ctx.throw`**，要 `throw` 类型化的错误。
- 提交信息使用约定式前缀（初始 commit 即此风格）。PR 尽量按里程碑拆分（M1–M8），见 [doc/技术方案.md §11](doc/技术方案.md)。

## pnpm-workspace.yaml

仓库级有一个 hook 会自动为带 postinstall 脚本的依赖注入 `allowBuilds:` 占位符。**正确处理方式是显式给布尔值**：

```yaml
allowBuilds:
  esbuild: true
  msw: true
```

**不要**只用 `onlyBuiltDependencies` 替代 —— hook 会持续追加 `allowBuilds:` 字段，并填入 `set this to true or false` 这种字符串占位符，导致 `pnpm install` 失败。
