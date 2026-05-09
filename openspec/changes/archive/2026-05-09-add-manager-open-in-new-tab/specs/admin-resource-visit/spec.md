## ADDED Requirements

### Requirement: 文件行展示访问入口

文件管理表（Manager 页面的 `FileTable`）SHALL 在每一**文件**行渲染一个"访问"控件。该控件 MUST 是一个 `<a>` 元素（或包含 `<a>` 的链接型按钮），其 `href` 指向该文件在静态服务器下可直接获取的 URL。

#### Scenario: 文件行渲染访问链接
- **GIVEN** Manager 当前路径为 `/imgs`，文件表有一项 `{ name: "a.png", path: "/imgs/a.png", type: "file" }`
- **WHEN** 表格渲染完成
- **THEN** 该行存在一个可访问性名称为 `访问 a.png` 的链接
- **AND** 该链接的 `href` 解析后等于 `<STATIC_BASE_URL>/imgs/a.png`（生产环境下 `STATIC_BASE_URL` 为空，链接为相对路径 `/imgs/a.png`）
- **AND** 该链接含 `target="_blank"` 与 `rel="noopener noreferrer"` 属性

#### Scenario: 目录行不渲染访问链接
- **GIVEN** 文件表中存在一项 `{ name: "subdir", path: "/imgs/subdir", type: "dir" }`
- **WHEN** 表格渲染完成
- **THEN** 该行的访问列只显示占位符 `-`
- **AND** 该行不存在以 `访问` 开头的可访问性名称的链接元素
- **AND** 该行不渲染任何带 `target="_blank"` 的链接

### Requirement: URL 路径分段编码

访问链接的 `href` MUST 通过对 `path` 按 `/` 分段、对每段使用 `encodeURIComponent` 后再用 `/` 拼回的方式生成，以确保中文、空格、`?`、`#`、`&` 等字符都被正确编码且 `/` 作为分隔符保留。

#### Scenario: 中文文件名
- **GIVEN** 文件 `{ path: "/文档/说明.txt", type: "file" }`
- **WHEN** 渲染访问链接
- **THEN** `href` 末尾段为 `/%E6%96%87%E6%A1%A3/%E8%AF%B4%E6%98%8E.txt`
- **AND** 在浏览器中点击该链接将命中后端 `routes/static.js` 并返回该文件

#### Scenario: 含 `#` 与 `?` 的文件名
- **GIVEN** 文件 `{ path: "/notes/draft?v1#tmp.md", type: "file" }`
- **WHEN** 渲染访问链接
- **THEN** `href` 中的 `?` 被编码为 `%3F`、`#` 被编码为 `%23`，整个文件名作为单一路径段，不会被浏览器解析为 query 或 fragment

#### Scenario: 含空格的文件名
- **GIVEN** 文件 `{ path: "/imgs/hello world.png", type: "file" }`
- **WHEN** 渲染访问链接
- **THEN** `href` 中的空格被编码为 `%20`（不是 `+`）

### Requirement: 新标签页打开且不泄漏 referrer

访问链接被点击或键盘激活时，浏览器 MUST 在新标签页打开目标 URL，新页面 MUST 不能通过 `window.opener` 访问 Manager 页面，且 MUST 不发送 `Referer` 头。

#### Scenario: 鼠标点击在新标签打开
- **WHEN** 用户左键点击访问链接
- **THEN** 浏览器在新标签页加载该 URL
- **AND** 当前 admin 标签页停留在原页面，状态、表格选中项不变

#### Scenario: 键盘激活
- **GIVEN** 焦点位于某文件行的访问链接
- **WHEN** 用户按下 Enter
- **THEN** 浏览器在新标签页打开目标 URL（与鼠标点击行为一致）

### Requirement: 开发与生产模式 base URL（端口源自仓库根 `.env`）

链接的 base URL SHALL 按以下规则确定：
- **生产模式**（`import.meta.env.PROD === true`）：使用空串，使最终 `href` 为相对路径并由当前 origin 解析（生产环境下 SPA 与静态资源同进程同端口托管）。
- **开发模式**（`import.meta.env.PROD === false`）：使用 `http://${window.location.hostname}:${VITE_SERVER_PORT}`，其中 `VITE_SERVER_PORT` MUST 由 Vite 配置在构建期通过 `loadEnv(mode, '..', '')` 从仓库根 `.env` 的 `PORT` 字段注入到 `import.meta.env`。**端口号 MUST NOT 在前端源码中硬编码**。

#### Scenario: 生产模式相对路径
- **GIVEN** `import.meta.env.PROD === true`
- **WHEN** 渲染 `{ path: "/a.txt", type: "file" }` 的访问链接
- **THEN** `href` 字面量为 `/a.txt`（不带 origin）

#### Scenario: 开发模式 base 由根 `.env` 的 PORT 决定
- **GIVEN** 仓库根 `.env` 中 `PORT=3000`，且 `import.meta.env.PROD === false`
- **WHEN** 在 `http://localhost:5173/admin` 下渲染 `{ path: "/a.txt", type: "file" }` 的访问链接
- **THEN** `href` 字面量为 `http://localhost:3000/a.txt`

#### Scenario: 修改根 `.env` PORT 后开发链接随之改变
- **GIVEN** 仓库根 `.env` 中 `PORT=4000`
- **WHEN** 重启 dev server 并渲染 `{ path: "/a.txt", type: "file" }` 的访问链接
- **THEN** `href` 字面量为 `http://localhost:4000/a.txt`
- **AND** Vite dev server 的 `/api` 代理目标也指向 `http://localhost:4000`（同一来源）

#### Scenario: 跨机访问 dev server
- **GIVEN** 同事在 `http://192.168.1.10:5173/admin` 下访问 dev server，根 `.env` 中 `PORT=3000`
- **WHEN** 渲染访问链接
- **THEN** `href` 以 `http://192.168.1.10:3000` 开头（hostname 取自 `window.location.hostname`，不写死 `localhost`）

#### Scenario: 前端源码中无端口硬编码
- **WHEN** 对 [web/src/](web/src/) 下源码做静态检索
- **THEN** 不存在形如 `localhost:3000`、`:3000` 或字面量 `3000` 直接拼入 URL 的代码（兜底常量除外，仅用于防御 `.env` 字段缺失，不参与正常运行路径）

### Requirement: 不附带鉴权或敏感参数

访问链接 MUST NOT 在 URL 中携带 JWT、用户标识或任何敏感 query 参数。后端静态服务对这些资源公开访问，因此链接保持纯净。

#### Scenario: 链接不含 token
- **WHEN** 当前用户已登录（`localStorage.sslite_token` 存在）
- **AND** 渲染任意文件的访问链接
- **THEN** 该链接的 `href` 中不包含 `token`、`auth`、`Authorization` 等字段
- **AND** 该链接的 `href` 不含任何 query string（除非源于文件名编码）
