## 1. 抽出 useHashPath hook

- [x] 1.1 新建 `web/src/hooks/useHashPath.ts`，导出 `useHashPath(): [string, (next: string, opts?: { replace?: boolean }) => void]`
- [x] 1.2 在 hook 内实现 `parseHash(raw: string): string`：调用 `decodeURIComponent`（try/catch），运行 `isSafeRelPath` 校验，非法/失败返回 `'/'`
- [x] 1.3 在 hook 内实现 `isSafeRelPath(p: string): boolean`：拒绝 `..` 段、null byte（` `）、Windows 盘符 `^[A-Za-z]:`；允许前导 `/`
- [x] 1.4 实现 `writeHash(path: string, replace: boolean)`：根目录 `'/'` 使用 `history.replaceState/pushState` 写入空 hash 的 URL；其他路径使用 `encodeURI` 编码并写入 `#<encoded>`；新值与当前相同时跳过
- [x] 1.5 在 hook 中用 lazy initial state 从 `window.location.hash` 解析初始路径；若解析后被规范化（比如清空了非法 hash）则在挂载 effect 中用 `replaceState` 回写一次
- [x] 1.6 注册 `hashchange` 监听：外部 hash 变化时同步本地 state，但 **不** 触发回写 hash（防循环）
- [x] 1.7 卸载时移除 `hashchange` 监听

## 2. 接入 Manager 页面

- [x] 2.1 在 `web/src/pages/Manager.tsx` 把 `const [path, setPath] = useState('/')` 替换为 `const [path, setPath] = useHashPath()`
- [x] 2.2 验证现有调用点（`onEnter={setPath}`、面包屑 `onNavigate={setPath}`、新建目录后 `setPath` 等）签名兼容；在用户主动导航处保持默认 `pushState` 行为
- [x] 2.3 不调整 `useEffect([path], refresh)` 依赖，确认初始挂载只触发一次 `refresh`

## 3. 测试

- [x] 3.1 新增 `web/tests/useHashPath.test.ts`：覆盖初始解析（合法 hash、空 hash、含 `..`、null byte、Windows 盘符、畸形百分号编码）
- [x] 3.2 在 `useHashPath.test.ts` 中覆盖 setter：`replace` vs `push` 行为差异、相同值不重复写、根目录写空 hash
- [x] 3.3 在 `useHashPath.test.ts` 中模拟 `hashchange` 事件，断言 state 同步且不再次调用 `history.*`
- [x] 3.4 更新或新增 `web/tests/Manager.test.tsx` 用例：刷新场景（jsdom 中预设 `window.location.hash = '#/foo'`），断言挂载即请求 `/foo` 目录列表，且不先请求 `/`
- [x] 3.5 在 `Manager.test.tsx` 中加入"进入子目录后 `window.location.hash` 反映为 `#/foo`"的断言
- [x] 3.6 运行 `pnpm -C <repo-root> run test:web` 全绿
- [x] 3.7 在 `web/` 目录下运行 `node ./node_modules/typescript/bin/tsc --noEmit` 无 TS 错误

## 5. 后端拒绝目录时降级到根

- [x] 5.1 在 `web/src/pages/Manager.tsx#refresh` 的 `catch` 中识别 `ApiError.code` ∈ `{'DIR_NOT_FOUND', 'BAD_PATH', 'PATH_OUT_OF_ROOT'}`，且当前 `path !== '/'` 时调用 `setPath('/', { replace: true })`
- [x] 5.2 其他错误码（5xx、`NETWORK_ERROR` 等）保持原行为（仅 toast，不改 path）
- [x] 5.3 在 `web/tests/Manager.test.tsx` 新增用例：mount with hash `#/ghost`（mock 状态中无该目录）→ 后端返回 `DIR_NOT_FOUND` → 当前列表显示根、hash 被清空
- [x] 5.4 新增用例：网络/服务器错误（mock 一次 5xx 或 `NETWORK_ERROR`）时 path 与 hash 保持不变
- [x] 5.5 重新运行 `pnpm -C <repo-root> run test:web` + `tsc --noEmit` 全绿

## 4. 手工验证

- [x] 4.1 `pnpm dev:server` + `pnpm dev:web`，登录后进入若干层目录，地址栏显示 `#/a/b/c`
- [x] 4.2 F5 刷新，确认仍停留在 `/a/b/c`
- [x] 4.3 浏览器后退/前进按钮可在已访问的目录间切换，文件列表同步刷新
- [x] 4.4 手动把 hash 改成 `#/foo/../etc` 回车，页面降级到根目录，无后端 4xx/5xx 异常
- [x] 4.5 中文目录名（如新建一个 `测试` 目录）进入后 hash 显示百分号编码、刷新后路径正确还原
- [x] 4.6 在地址栏手动输入 `/admin#/1234`（不存在的目录）回车 → 页面回到根目录、hash 清空、面包屑只剩根
