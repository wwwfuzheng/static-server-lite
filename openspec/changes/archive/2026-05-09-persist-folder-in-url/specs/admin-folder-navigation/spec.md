## ADDED Requirements

### Requirement: 当前文件夹路径反映在 URL hash 中

admin 文件管理器（`Manager` 页面）SHALL 在用户进入任意文件夹时，把当前路径同步写入 `window.location.hash`，hash 值以 `/` 开头并使用 POSIX 风格分隔符。根目录对应空 hash（`#` 或无 `#`）。

#### Scenario: 进入子目录后 hash 更新
- **WHEN** 用户在文件表中双击或点击进入名为 `foo` 的目录（当前路径 `/`）
- **THEN** 浏览器地址栏显示 `/admin#/foo`
- **AND** Manager 的当前路径状态变为 `/foo`
- **AND** 该跳转在浏览器历史栈中是一次 push（浏览器后退按钮可回到 `/`）

#### Scenario: 通过面包屑回到上层
- **WHEN** 用户在 `/foo/bar` 下点击面包屑中的 `foo`
- **THEN** hash 变为 `/foo`
- **AND** 文件列表刷新为 `/foo` 的内容

#### Scenario: 根目录不写多余的 hash
- **WHEN** 用户从 `/foo` 通过面包屑回到根
- **THEN** URL 不再带有 hash 段（或 hash 为空字符串）
- **AND** Manager state 为 `/`

### Requirement: 刷新页面时从 hash 恢复路径

Manager 页面挂载时 SHALL 优先从 `window.location.hash` 读取路径作为初始当前路径，缺省时使用 `/`。该恢复行为 MUST 在首次发起目录列表请求**之前**完成，避免先请求根目录再切换造成的双倍请求。

#### Scenario: 刷新后停留在子目录
- **GIVEN** 用户当前在 `/admin#/foo/bar`
- **WHEN** 用户按 F5 刷新
- **THEN** 页面挂载后立即请求 `/foo/bar` 的目录列表（而不是先请求 `/`）
- **AND** 面包屑显示 `根 / foo / bar`

#### Scenario: 缺省 hash 回落到根
- **WHEN** 用户访问 `/admin`（无 hash）
- **THEN** Manager state 初始化为 `/`
- **AND** 请求根目录列表

### Requirement: 浏览器前进/后退按钮在文件夹间穿梭

Manager SHALL 监听 `hashchange` / `popstate` 事件并将外部 hash 变更同步到当前路径状态，使浏览器前进/后退按钮能在用户访问过的目录之间切换。

#### Scenario: 后退到上一目录
- **GIVEN** 用户依次访问 `/` → `/foo` → `/foo/bar`
- **WHEN** 用户点击浏览器后退按钮
- **THEN** hash 变为 `/foo`
- **AND** Manager 状态更新为 `/foo` 且重新拉取目录列表
- **AND** 期间不产生 `pushState` 调用（避免循环写入历史）

#### Scenario: 前进按钮恢复目录
- **GIVEN** 上一场景之后用户已后退至 `/foo`
- **WHEN** 用户点击浏览器前进按钮
- **THEN** hash 恢复为 `/foo/bar` 且 Manager 同步显示该目录

### Requirement: 非法或可疑 hash 安全降级

当 hash 内容违反路径安全契约（包含 `..` 段、null byte、Windows 盘符 `X:`）或无法 URL 解码时，Manager MUST 降级到根目录 `/`，清空非法 hash，且不向后端发起非法路径请求。

#### Scenario: 拒绝路径穿越
- **WHEN** 用户访问 `/admin#/foo/../../etc`
- **THEN** Manager 当前路径降级为 `/`
- **AND** URL 中的 hash 被清空（或重写为空）
- **AND** 不向后端发起 `path=/foo/../../etc` 的请求

#### Scenario: 畸形百分号编码
- **WHEN** hash 为 `/foo%E4%B8` 这种不完整的 UTF-8 序列，`decodeURIComponent` 抛异常
- **THEN** Manager 降级为 `/`，hash 被清空
- **AND** 控制台不抛未捕获异常

#### Scenario: 含中文目录名的合法 hash
- **WHEN** 用户访问 `/admin#/%E6%96%87%E6%A1%A3`（解码为 `/文档`）
- **THEN** Manager 当前路径为 `/文档`
- **AND** 请求该目录列表成功（前提是该目录存在）

### Requirement: 后端拒绝的目录降级到根

当 Manager 请求列目录返回 `DIR_NOT_FOUND` / `BAD_PATH` / `PATH_OUT_OF_ROOT` 之一，且当前路径不是 `/` 时，Manager MUST 把当前路径回退到 `/`，并把这次回退用 `history.replaceState` 写入（不在历史栈中新增条目），使面包屑、文件列表、URL hash 同步反映根目录。其他错误码（如 5xx、`NETWORK_ERROR`、鉴权失效）不触发降级。

#### Scenario: 手动输入不存在的目录
- **GIVEN** `/admin` 已加载
- **WHEN** 用户在地址栏把 hash 改为 `#/1234`（`/1234` 在 `STATIC_ROOT` 下不存在）回车
- **THEN** 后端返回 `code: DIR_NOT_FOUND`
- **AND** Manager 当前路径回到 `/`
- **AND** URL hash 被清空（不再是 `#/1234`）
- **AND** 面包屑只显示根，文件列表展示根目录内容
- **AND** 浏览器历史不新增 "回退到根" 这一条（使用 `replaceState`），用户按后退键不会再次进入坏 URL

#### Scenario: 刷新进入不存在的目录
- **GIVEN** 用户访问 `/admin#/ghost-folder`，但服务端没有该目录
- **WHEN** 页面挂载并发起 `listDir('/ghost-folder')`
- **THEN** 收到 `DIR_NOT_FOUND`
- **AND** Manager 路径降级为 `/`、hash 清空、列表显示根目录

#### Scenario: 网络错误时不降级
- **GIVEN** 用户在 `/admin#/imgs`
- **WHEN** `listDir` 因网络错误失败（`ApiError.code === 'NETWORK_ERROR'`）
- **THEN** Manager 显示 toast 错误
- **AND** 当前路径仍为 `/imgs`，hash 仍为 `#/imgs`，不被踢回根目录
