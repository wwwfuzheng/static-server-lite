## Context

`FileTable`（[web/src/components/FileTable.tsx](web/src/components/FileTable.tsx)）目前包含 4 列：Name / Size / Modified / Actions。文件项通过 `r.path`（已经是 POSIX 风格、相对 `STATIC_ROOT` 的绝对路径，例如 `/imgs/a.png`）唯一标识。后端 `routes/static.js` 在最低优先级路由处直接通过 `resolveSafe(STATIC_ROOT, ctx.path)` 把 URL 路径映射到磁盘文件，因此**只要把 `r.path` 拼到当前域名后**就能直接访问该文件。

提案要求给每行加"访问"链接。考虑到 AntD 表格列布局空间有限，选择在 Actions 列前新增一个独立的窄列，避免与现有删除按钮挤在一起影响视觉。

## Goals / Non-Goals

**Goals:**
- 文件资源一键以新标签打开静态 URL，复用浏览器原生 `target="_blank"`，无需任何 JS 中转。
- URL 拼接安全：含中文、空格、`#`、`?` 等字符的文件名能正确编码。
- 静态服务端口不硬编码：通过 Vite `loadEnv` 读取仓库根 `.env` 的 `PORT`，作为 dev 模式 base URL 的来源。
- 目录行视觉占位但无可点击链接（保持列对齐）。
- 单测覆盖关键行为：文件链接出现 / 目录不出现 / `href` 编码正确 / `target` + `rel` 属性 / env 来源。

**Non-Goals:**
- 不为目录提供访问入口（静态服务器无目录索引；如未来加索引再扩展）。
- 不预生成短链、不附带签名 token —— 当前仓库的 `STATIC_ROOT` 是公开资源，不需要鉴权。
- 不做"复制链接"按钮（可单独提案）。
- 不修改后端任何路由或中间件。

## Decisions

### 决策 1：URL 拼接策略

选择 `encodeURI(r.path)` 而非 `encodeURIComponent`。

- **原因**：`r.path` 形如 `/imgs/中文 名.png`，整体是 URL 路径，需要保留 `/` 作为分隔符。`encodeURIComponent` 会把 `/` 编码为 `%2F`，破坏路径语义；`encodeURI` 则保留路径分隔符并对每段中的非保留字符编码。
- **备选**：手工 `path.split('/').map(encodeURIComponent).join('/')` —— 等价但代码更繁琐，无收益。
- **使用相对 URL**（直接 `<a href={encodeURI(r.path)}>`）而非绝对 URL —— 当前页面在 `/admin` 下，相对 URL `/imgs/x.png` 会基于站点根解析，正好命中静态服务。同时也能跨开发/生产环境（dev 模式下 Vite proxy 仅代理 `/api`，但访问按钮跳出 SPA 进入新 tab 命中后端 `:3000`，开发模式下因为前端在 `:5173` 上，相对 URL 会指向 `:5173/imgs/x.png` —— Vite 不知道这个文件存在，会 404）。**因此开发模式下需要拼绝对 URL `http://localhost:3000<path>` 才能正确访问**。

### 决策 2：开发与生产环境的 base URL（端口从根 `.env` 读取，不硬编码）

引入一个常量 `STATIC_BASE_URL`：
- 生产模式（`import.meta.env.PROD === true`）：空串 `''`，得到相对 URL，由当前 origin 解析（与 SPA 同源；CLAUDE.md 已记录生产模式 Node 同时托管 API + SPA + 静态资源）。
- 开发模式：拼成 `http://${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT}`。`VITE_SERVER_PORT` 由 [web/vite.config.ts](web/vite.config.ts) 在构建期通过 `define` 注入：

  ```ts
  // web/vite.config.ts
  import { defineConfig, loadEnv } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig(({ mode }) => {
    const rootEnv = loadEnv(mode, '..', ''); // 读仓库根 .env，prefix 留空表示不过滤
    const serverPort = rootEnv.PORT || '3000'; // 兜底：仅为防御 .env 缺失
    return {
      plugins: [react()],
      base: '/admin/',
      build: { outDir: 'dist' },
      define: {
        'import.meta.env.VITE_SERVER_PORT': JSON.stringify(serverPort),
      },
      server: {
        port: 5173,
        proxy: { '/api': `http://localhost:${serverPort}` }, // 顺便消除现有硬编码
      },
    };
  });
  ```

- **为什么不简单写 `VITE_STATIC_BASE_URL` 让用户自己填**：单一信息源 —— 仓库根 `.env` 已有 `PORT`，再让用户在 `web/.env` 重复一遍只会漂移。`loadEnv(mode, '..', '')` 直接复用现有变量。
- **为什么 hostname 用 `window.location.hostname` 而非 `localhost`**：兼容跨机访问场景（e.g. 用 `http://192.168.x.x:5173` 访问 dev server 的同事），新标签也会指向同一台机的 `:PORT`。
- **`'3000'` 兜底**：仅为防御 `.env` 文件缺失或 `PORT` 字段被删的极端情况，避免 `http://host:undefined/...` 这种坏链接。**不是默认行为** —— 正常情况下值来自 `.env`。

### 决策 3：UI 形态

在 "Modified" 和 "Actions" 之间插入一列 "Visit"，宽度 ~80px：
- **文件**：渲染一个 `<a>` 包裹 AntD `LinkOutlined` 图标 + "打开" 文案的小号 Button（`type="link" size="small"`），`href` 为编码后的完整 URL，`target="_blank"`，`rel="noopener noreferrer"`，并设 `aria-label`。
- **目录**：渲染 `-`（与 Size 列保持一致的占位风格），不可点击。

**备选**：把链接合并进 Actions 列。否决 —— 与"删除"语义差距大，独立列更清晰。

### 决策 4：安全属性 —— `rel="noopener noreferrer"`

新标签打开外部资源时，`rel="noopener"` 阻止新页面通过 `window.opener` 反向控制，`noreferrer` 不向静态资源请求泄漏 admin 页面 URL。即使是同源资源也保持此惯例，避免日后改变托管方式时漏配。

## Risks / Trade-offs

- [文件名包含 `?` 或 `#`] → `encodeURI` 不会编码这两个字符（它们是 URL 保留字符），会把后续部分解析为 query 或 fragment，导致 404。**Mitigation**：在拼接前对 `r.path` 做一次 `replace(/[?#]/g, c => encodeURIComponent(c))`，或对每段使用 `encodeURIComponent` 后用 `/` 拼回。选用后者以确保 100% 安全。
- [开发模式下后端未启动] → 点访问按钮会得到浏览器层面的连接拒绝。**Mitigation**：不做特别处理 —— 与现有 `pnpm dev:web` 后调 API 的体验一致；CLAUDE.md 已说明开发需要同时启动两个服务。
- [文件刚被删 / 改名后再点链接] → 后端返回 404。**Mitigation**：可接受。表格本身不实时同步磁盘；用户刷新即可。
- [鉴权依赖] → 静态资源公开，不验 token。如未来给静态服务加保护，访问链接会失效。**Mitigation**：在 spec 中明确"当前依赖静态资源公开"作为前提，留作未来变更点。
