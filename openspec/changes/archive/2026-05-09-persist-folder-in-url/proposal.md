## Why

当前 admin 文件管理器把"当前文件夹"放在组件的本地 `useState` 里（`web/src/pages/Manager.tsx:22`），URL 不反映该状态。用户进入子目录后刷新页面、收藏链接或把链接发给同事，都会回到根目录 `/`，丢失上下文。把当前路径同步到 URL hash（如 `/admin#/foo/bar`）能修复刷新丢失，并让链接可分享。

## What Changes

- 在 `Manager` 页面进入文件夹（`onEnter`、面包屑跳转、新建目录后切入等）时，将当前路径写入 `window.location.hash`。
- 页面挂载时从 `window.location.hash` 读取初始路径，校验合法后作为初始 `path` state；非法或缺省时回落到 `/`。
- 监听浏览器前进/后退（`hashchange` / `popstate`），同步组件 state，让浏览器导航按钮也能在文件夹之间穿梭。
- 路径写入前经过与后端一致的安全校验（拒绝 `..`、null byte、Windows 盘符），防止伪造的 hash 触发非法请求。
- 当后端返回"目录不存在 / 路径非法"错误（`DIR_NOT_FOUND` / `BAD_PATH` / `PATH_OUT_OF_ROOT`）时，前端 SHALL 自动把当前路径降级为 `/`，同时清空 URL hash，使面包屑、列表、URL 都不再保留无效目录名（修复"hash 上仍保留 `/1234`、面包屑显示错误目录"的体验问题）。

## Capabilities

### New Capabilities
- `admin-folder-navigation`: admin 文件管理器中"当前文件夹"的状态管理与 URL 同步规则，包括初始化、写入、浏览器历史、非法值兜底。

### Modified Capabilities
（无 —— 当前还没有已归档的 spec）

## Impact

- 受影响代码：[web/src/pages/Manager.tsx](web/src/pages/Manager.tsx)（path state 初始化与更新）、可能新增一个 `web/src/hooks/useHashPath.ts` 之类的 hook 收口逻辑。
- 受影响测试：[web/tests/Manager.test.tsx](web/tests/Manager.test.tsx) 等使用 Manager 的用例需要在 jsdom 中配合 `window.location.hash` 的 mock，新增 hash 同步专项用例。
- 不影响后端 API、鉴权、路由优先级、`STATIC_ROOT` 解析。
- 不影响 `BrowserRouter basename="/admin"` 配置；hash 仅用作 admin 内部子状态，与 React Router 路径无冲突。
