## Why

管理后台目前只能在文件表中删除或进入目录，无法直接验证某个文件是否能正常通过静态服务器访问。运营和开发人员经常需要打开终端拼 URL，或在新标签里手敲 `/path/to/file.jpg` 来确认上传产物是否生效，体验割裂。给每个资源加一个一键访问链接，可以直接在表格里完成"上传 → 验证"闭环。

## What Changes

- 在 Manager 文件表（`FileTable`）每行新增"访问"列，**文件**显示一个外链按钮/图标。
- 点击该按钮以新标签页（`target="_blank"` + `rel="noopener noreferrer"`）打开该文件在静态服务器下的 URL（即 `<静态服务 base>/<path>`，由后端 `routes/static.js` 提供）。
- 路径中的特殊字符（中文、空格、`?`、`#` 等）必须按 `/` 分段后逐段 `encodeURIComponent` 编码，保证 URL 合法且能命中 `resolveSafe`。
- 静态服务器的端口号 **不**硬编码 —— 在 dev 模式下通过 Vite 的 `loadEnv` 读取仓库根 `.env` 中的 `PORT` 字段，并经 `define` 暴露到前端常量 `import.meta.env.VITE_SERVER_PORT`；生产模式下使用相对 URL（因为 SPA 与静态资源同源同端口）。
- 目录行不展示访问入口（静态服务器不提供目录索引，访问目录会得到 404）；保持现有"点击名字进入"行为不变。
- 该按钮可被键盘聚焦，并提供 `aria-label="访问 <文件名>"` 以满足无障碍。

## Capabilities

### New Capabilities
- `admin-resource-visit`: 文件表内每个文件资源提供一键以新标签访问的能力，覆盖 URL 拼接、目录排除、安全属性、无障碍。

### Modified Capabilities
（无 —— 现有 `admin-folder-navigation` 的导航规约不受影响。）

## Impact

- 代码：
  - [web/src/components/FileTable.tsx](web/src/components/FileTable.tsx) 新增"访问"列（仅文件渲染链接）。
  - [web/vite.config.ts](web/vite.config.ts) 改为函数式配置，使用 `loadEnv(mode, '..', '')` 读取仓库根 `.env`，把 `PORT` 同时用于 dev proxy 目标 (`/api` → `http://localhost:${PORT}`) 与暴露给前端的 `VITE_SERVER_PORT`。
  - 可选新建 `web/src/utils/staticUrl.ts` 抽取 URL 拼接函数。
- 测试：[web/tests/](web/tests/) 新增/扩展 `FileTable` 行为用例（文件链接命中静态 URL、目录不渲染链接、特殊字符编码、`target=_blank` 与 `rel`、生产 vs 开发 base URL）。
- API、后端、鉴权流程：不受影响。文件链接命中的是公开静态服务，不需要登录态，因此**不要**附带 token 或敏感 query。
- 依赖：无新增。可选使用 AntD `LinkOutlined` 图标（已在 `@ant-design/icons` 中）。
