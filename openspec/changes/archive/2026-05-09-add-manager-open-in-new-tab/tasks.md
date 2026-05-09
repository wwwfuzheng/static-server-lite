## 1. Vite 配置：从根 `.env` 读取端口

- [x] 1.1 改写 [web/vite.config.ts](web/vite.config.ts) 为函数式配置 `defineConfig(({ mode }) => { ... })`，调用 `loadEnv(mode, '..', '')` 读取仓库根 `.env`，取出 `PORT`（兜底 `'3000'` 仅防御 `.env` 缺失）。
- [x] 1.2 在 vite 配置 `define` 中注入 `'import.meta.env.VITE_SERVER_PORT': JSON.stringify(serverPort)`。
- [x] 1.3 同时把现有 `server.proxy['/api']` 的硬编码 `http://localhost:3000` 改为 `http://localhost:${serverPort}`，保持单一信息源。
- [x] 1.4 在 [web/src/](web/src/) 下若存在 `vite-env.d.ts`（或新建之）补充类型声明：`interface ImportMetaEnv { readonly VITE_SERVER_PORT: string }`。

## 2. URL 工具函数

- [x] 2.1 在 [web/src/components/FileTable.tsx](web/src/components/FileTable.tsx) 内（或新建 `web/src/utils/staticUrl.ts`）实现：
  - [x] 2.1.1 `getStaticBaseUrl(): string` —— `import.meta.env.PROD` 为真返回 `''`，否则返回 `\`http://${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT}\``。
  - [x] 2.1.2 `buildStaticUrl(path: string): string` —— 把 `path` 按 `/` 分段后对每段 `encodeURIComponent`，再用 `/` 拼回，前置 `getStaticBaseUrl()`。

## 3. UI 改动

- [x] 3.1 在 `FileTable` 的 `columns` 中、`Modified` 与 `Actions` 之间插入 `Visit` 列，宽度 `80`。
- [x] 3.2 渲染逻辑：`r.type === 'file'` 时输出 `<a href={buildStaticUrl(r.path)} target="_blank" rel="noopener noreferrer" aria-label={\`访问 ${r.name}\`}>` 包裹的小号 link 按钮（含 `LinkOutlined` 图标 + 文案"打开"）；`r.type === 'dir'` 时输出 `-`。
- [x] 3.3 访问链接**不**随 `disabled` prop 失效（它是只读操作，不会与正在进行的写操作冲突，已与用户对齐）。

## 4. 单元测试（[web/tests/](web/tests/)）

- [x] 4.1 新增 `FileTable.test.tsx`（若已存在则追加用例）：
  - [x] 4.1.1 文件行存在 `aria-label` 为 `访问 <name>` 的链接，`target="_blank"`，`rel` 包含 `noopener` 与 `noreferrer`。
  - [x] 4.1.2 目录行不存在以 `访问` 开头 aria-label 的链接，访问列只显示 `-`。
  - [x] 4.1.3 中文文件名 `/文档/说明.txt` 的 `href` 末尾包含 `/%E6%96%87%E6%A1%A3/%E8%AF%B4%E6%98%8E.txt`。
  - [x] 4.1.4 含 `?`、`#`、空格的文件名分别被编码为 `%3F`、`%23`、`%20`。
  - [x] 4.1.5 `disabled=true` 时访问链接仍可点击（`aria-disabled` 不为 true、无 `pointer-events: none`）。
- [x] 4.2 覆盖 base URL 两个分支：
  - [x] 4.2.1 `vi.stubEnv('PROD', true)` 时 `href` 为相对路径 `/a.txt`。
  - [x] 4.2.2 `vi.stubEnv('PROD', false)` + `vi.stubEnv('VITE_SERVER_PORT', '3000')` 时 `href` 为 `http://<hostname>:3000/a.txt`。
  - [x] 4.2.3 同样设置但 PORT 改为 `'4000'` 时，`href` 端口随之变。
- [x] 4.3 静态扫描断言：在源码搜索 `web/src/**/*.{ts,tsx}` 不出现字面量 `localhost:3000` 或 `:3000` 的 URL 拼接（可作为一条简单的 grep 测试或在 PR review 中人工核对）。

## 5. 类型与构建检查

- [x] 5.1 在 `web/` 下运行 `node ./node_modules/typescript/bin/tsc --noEmit` 通过。
- [x] 5.2 运行 `pnpm -C <repo-root> run test:web` 全部通过。
- [x] 5.3 运行 `pnpm build:web` 构建无报错。

## 6. 手动验收

- [x] 6.1 启动 `pnpm dev:server` + `pnpm dev:web`（仓库根 `.env` 中 `PORT=3000`）：
  - [x] 6.1.1 文件行末尾出现"打开"按钮，点击后在新标签页 `http://localhost:3000/<path>` 加载文件内容。
  - [x] 6.1.2 目录行无"打开"按钮。
  - [x] 6.1.3 中文/带空格文件名能正确加载（不出现 404 或乱码 URL）。
- [x] 6.2 把根 `.env` `PORT` 改为 `4000`，重启 `pnpm dev:server`、`pnpm dev:web`：
  - [x] 6.2.1 访问按钮的 `href` 自动指向 `http://localhost:4000/...` 并能正确加载。
  - [x] 6.2.2 Vite 的 `/api` 代理也跟随到 `:4000`（验证 dev server 自检无报错）。
- [x] 6.3 `pnpm build:web && pnpm start`（恢复 `PORT=3000` 或任意值），访问 `http://localhost:<PORT>/admin`，重复 6.1.1～6.1.3，确认链接为相对路径并能正确打开。
- [x] 6.4 在新标签页执行 `window.opener` 应为 `null`（DevTools Console 验证）。

## 7. 文档与归档准备

- [x] 7.1 若 [README.md](README.md) 或 [doc/](doc/) 中有 Manager 页面截图/功能说明，补充新列描述（无则跳过）。**补做于归档之后**：[README.md](README.md) 第 6 行功能列表加入"一键在新标签页访问任一文件的静态 URL"；[doc/技术方案.md](doc/技术方案.md) §7.2 `FileTable` 描述补充"访问"列行为（文件 Open 链接 + 安全属性 + 编码；目录显示 `-`）。
- [x] 7.2 在 [doc/技术方案.md](doc/技术方案.md) 中相关章节（若涉及前端配置）补充"Vite 通过 `loadEnv` 读取根 `.env.PORT`"的说明，或在 PR 描述中提及（无则跳过）。**补做于归档之后**：[doc/技术方案.md](doc/技术方案.md) §10.1 dev 命令注释补充 `loadEnv` + `define` + `VITE_SERVER_PORT` 来源说明。
- [x] 7.3 实现完成、测试全绿后，运行 `/opsx:archive add-manager-open-in-new-tab` 归档。
