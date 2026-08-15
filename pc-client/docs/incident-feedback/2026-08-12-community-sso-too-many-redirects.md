# 社区 SSO `ERR_TOO_MANY_REDIRECTS`

## 用户现象

0.1.81 客户端已登录后进入社区，Electron Webview 显示
`ERR_TOO_MANY_REDIRECTS`，社区内容无法打开。

## 安全证据

- 对公开社区根路径执行上限为 5 的无凭据跳转探针：`2xx`、批准社区
  origin、root path、redirect count `0`、cookie present `true`。这排除了公开
  Flarum base URL 或 Caddy 对所有访问形成 canonical redirect 循环的情形。
- Identity handoff 仍为 60 秒、`community-browser` audience、单次事务消费；重放
  仍返回 401。
- Renderer 的 `did-fail-load` 处理器只呈现错误，不申请新 ticket；仅 renderer
  crash/8 秒挂载失败走一次有界恢复。因此没有客户端无限重开已消费 ticket 的
  实现证据。
- `aihub-sso.php` 把内部 HTTP API 所需的 `verify_ssl=false` 传给上游 SSO helper；
  上游同一个配置值还控制 `flarum_token` cookie 的 `Secure` 属性。生产公开 origin
  是 HTTPS，故会话落地此前生成的是非 Secure cookie。

探针和测试只记录 status class、origin class、path class、redirect count 与
cookie-present 布尔值；不记录 ticket、cookie、token、密码或响应正文。

## 根因分类

- A（服务端 SSO/canonical 跳转环）：公开 root 的当前安全探针未复现，排除其通用
  形态；真实带 ticket 的生产链仍需部署后验收。
- B（cookie domain/SameSite/Secure/proxy origin）：确认存在生产合同缺陷。公开
  HTTPS origin 与 SSO cookie 的 Secure 属性未绑定，cookie 落地依赖浏览器兼容
  行为。这是本轮最小修复点。
- C（客户端失败恢复重放 ticket）：代码和回归证据不支持。`did-fail-load` 不恢复，
  crash/watchdog 最多重建一次并申请新 ticket，不会循环打开已消费 URL。

## 修复

- 从固定 `AIHUB_FORUM_PUBLIC_ORIGIN` 的 scheme 派生 cookie Secure 标志：HTTPS 为
  `true`；现有 loopback HTTP 隔离环境为 `false`。
- 保留公开 host 作为 cookie domain，仍只 303 一次到固定公开社区根路径。
- 不新增 URL/host/path/header 覆盖，不更改 ticket 生命周期、replay 拒绝、Webview
  origin/navigation gate 或恢复次数。

## RED → GREEN

RED：`tests/community-sso-redirect-contract.test.cjs` 精确发现生产 SSO 配置未把 HTTPS
origin 映射为 Secure cookie；客户端失败处理测试同时证明没有 ticket replay trigger。

GREEN：同一测试验证 HTTPS Secure、单次 root landing、无回跳 SSO、60 秒单次消费、
固定 `persist:aihub-community` 分区和 `did-fail-load` 不重放。

## 自动验证

聚焦组合覆盖：

- SSO redirect/cookie 合同；
- Community embed origin、launch URL 与 navigation gate；
- logout/current-session revoke 的持久分区 cookie 清理；
- Identity client、social/profile 映射。

本轮本机 Docker 引擎未运行，因此没有把真实 Flarum 浏览器 cookie jar 或 Electron
隔离栈标成已验收。

## 部署与剩余验收

该修复需要重建包含 `community/flarum/aihub-sso.php` 的 Flarum 镜像，再由发布员工在
隔离栈完成完整 handoff → SSO 303 → cookie → root 链，并确认 redirect count 有界、
cookie present、ticket replay 401、退出和撤销会话后 cookie 清除。之后才可部署生产，
并需在 0.1.81 实机复验；本轮没有部署、封包或改客户端。

## 防复发门禁

社区 SSO 测试不得只手工提取 `flarum_token` 后调用 API；HTTPS 场景必须用真实 cookie
jar 跟随一次跳转，并验证会话落地。输出仍只能是允许的分类和布尔值，禁止输出凭据。
# Phase A real-chain update

The isolated real-helper and Electron `persist:aihub-community` differential confirms the HTTPS cookie `Secure` defect and its candidate fix. It does not reproduce `ERR_TOO_MANY_REDIRECTS`: both old and candidate images finish at the approved root with two allowed redirects and `tooManyRedirects=false`. Redirect root cause is therefore `UNVERIFIED`; this candidate remains `deployable=false` and must not be presented as the production redirect fix.

## 0.1.81 登录点击反馈跟进（P1）

### 用户现象与分叉

同一用户随后报告：0.1.81 登录框提交后没有进入登录态，底部只出现几乎不可见的
“操作失败，请稍后重试”。受限凭据此前通过正式 HTTPS 登录与退出验证，因此本轮不再
使用真实账号或网络，首个本地分叉固定在客户端的 main login handler、sandbox preload
和 renderer 登录表单。

### 确认根因

1. `identity:login` 仍直接返回或 rejected；Electron 会把 rejected 包装进包含 channel、
   异常类和原始信息的 `Error.message`。preload 没有结构化解析，renderer 只能把该技术
   文本降级成通用失败文案，稳定的 401/400/429/503 分类在 IPC 边界丢失。
2. `.authMessage` 在浅色主题中使用 `--accent-ink`；该 token 是主按钮上的白色前景，
   放在浅色 modal 背景上对比不足，与用户截图的“极低可见”一致。
3. 正式包配置合同继续只接受固定的非回环 HTTPS Identity origin，并拒绝环境变量覆盖。
   现有 0.1.81 验收收据没有保留可复核的包内 origin，因此本轮没有把配置假设写成实机
   已排除，也没有读取或重包旧制品。

### 最小修复

- main login handler 返回固定 `{ ok, value | error }` 信封；只保留
  `AUTHENTICATION_FAILED`、`INVALID_INPUT`、`RATE_LIMITED`、
  `INVALID_IDENTITY_RESPONSE` 和 `TEMPORARILY_UNAVAILABLE` 的固定状态与 message key。
  原始 URL、响应、异常、密码和 token 不进入 outer DTO 或 renderer。
- sandbox preload 严格校验 login 输入与成功/失败信封；Electron 自身 rejected 统一收敛为
  503，不让 renderer 解析 `error.message`。
- renderer 只在 `ok=true` 时更新 authenticated snapshot 并关闭 modal；失败使用中英文固定
  message key、`role=alert` 和浅色/暗色明确错误色。`finally` 始终恢复按钮；原生 form
  submit、Enter 和已有输入焦点路径不变。

### RED → GREEN 与自动验证

RED：`tests/identity-login-feedback.test.cjs` 通过当前 preload VM 调用合成 rejected main
结果，精确抛出 `Error invoking remote method 'identity:login'...`，1/1 失败。

GREEN：同一测试扩展到 main handler → preload VM → renderer 可见结果，覆盖成功登录、
401/400/429/503、未知字段、恶意诊断文本、按钮恢复、表单 Enter/自动填充语义和两套主题
错误色，4/4 通过。Identity client、服务 origin、语言、个人中心主题、社区 cookie 与社交
聚焦组合 35/35 通过；TypeScript/Vite build 通过，仅保留既有 Node externalization 与大
chunk 警告。本轮未运行正式登录、GUI、服务、封包或发布。

### 剩余验收与防复发

该本地源码修复只有进入后续客户端版本后才能影响用户机器。0.1.82 实机必须分别验证：
正确凭据进入登录态；错误凭据、不可用服务和 IPC 失败显示可读本地化提示；提交按钮恢复；
Enter 与焦点不跳失；UI/日志不出现 endpoint、raw error 或 token。该验收不证明前述社区
redirect 根因已解决，社区 SSO 仍保持 `UNVERIFIED` 和禁止部署结论。

以后账号 IPC 不得再把 rejected `error.message` 当协议；新增登录回归必须至少经过 main
固定 handler、实际 sandbox preload VM 和 renderer 可见状态三段公共 seam。

## 0.1.83 真实用户分区的诊断跟进

### 不可破坏的现场与真实 RED

用户报告 0.1.83 Portable 已登录窗口的内嵌社区显示
`An error occurred while trying to load this page.`。本轮没有刷新、点击、重登、
清 Cookie 或操作生产服务。安全只读证据为：

- `clientVersionClass=0.1.83`，`communityViewClass=load-error`；
- 当前用户的 `persist:aihub-community` 分区与 Cookie 行均存在，只读取布尔值，
  未读取值；
- 该实例没有可安全读取的 runtime 诊断通道，随后也已不再可观测；
  因此 `didFailLoad errorClass`、`currentOriginClass`、`pathClass` 和
  `redirectCountClass` 均不可得，不得从截图猜测。

### 三个可证伪假设的当前结论

1. 历史 Cookie/SSO 重定向：同分区 Cookie 存在，但本轮没有可用的真实
   origin/path/redirect 证据，仍为未证实分支。
2. CSP/X-Frame/Webview 策略：公开 root 返回 `frame-ancestors 'self'`，但
   Electron `<webview>` 的 guest 是顶层文档，而既有真实 Electron 隔离链在同类策略下
   已加载成功；没有将其判定为当前根因。
3. 服务/网络/TLS：无凭据公开 HTTPS root 为 `2xx`、零跳转，只排除
   全局 root/TLS 故障；它不等于用户 SSO 或 Flarum API 链验收。

首个已确认的产品缺口是诊断面：当前 `did-fail-load` 直接展示 Electron
`errorDescription`，没有稳定安全分类；对已加载文档内部的 Flarum 前端失败也
没有可观测分支。

### 本地最小修复与边界

`did-fail-load` 现只按 Chromium 数字代码归一为 `redirect`、`tls`、
`network`、`blocked` 或 `load`，取消项忽略；用户只看到固定中英文文案。
不记录或显示 URL、原始描述、ticket、cookie 或 token，不自动重试、不清分区，
不改 SSO 和既有一次有界恢复。

RED 为 5/6，新的安全分类公共 seam 不存在；GREEN 为 6/6。社区嵌入、
会话清理、SSO 跳转、语言与返回导航聚焦组合 19/19 通过，TypeScript/Vite
构建通过（仅既有 externalization/大 chunk 警告）。

这个修复提高下一版的安全可观测性，不声称解决本次真实 Flarum
文档级失败。下一步必须在用户同意的受控实机复现中，仅记录本节的分类与
布尔值，先区分“导航失败”与“Flarum 已加载文档内 API 失败”；本轮不部署、
不封包。

## 0.1.83 真实账号直接复现与最终根因

### 真实链路

在用户明确要求直接测试后，使用现有登录态和 `persist:aihub-community` 分区，
通过后台 CDP 触发真实 Community 导航。探针只保留状态、路径类别和固定错误类别，
不读取或输出 ticket、Cookie、token、URL 查询或响应正文。

冻结 0.1.83 renderer 仍在 React 创建 `<webview src=...>` 时立即开始一次性 ticket
导航，随后才在 effect 中注册 `did-fail-load`、`dom-ready` 等监听器。快速 SSO 导航
可先于监听器完成；8 秒 watchdog 会申请新 ticket 并重建 guest，第二次恢复后固定显示
“社区加载失败”。当前源码改为显式创建 webview，先注册所有监听器，再设置 `src`，
最后附着 DOM；主进程的 approved-origin、固定 partition 和 sandbox gate 保持不变。

第一次直接候选验证又发现第二个客户端缺陷：webview lifecycle effect 依赖
`theme`、`language` 和父组件每次 render 都会重建的 `onTargetConsumed` 回调。
首次 `dom-ready` 更新 React 状态后，effect 会销毁并重建 guest，把同一张已消费的
一次性 ticket 再请求一次。生产 Identity 数据库的现场形状为 ticket 已消费一次，
而最终 guest 停在 handoff 401，精确符合重放。修复后导航 effect 只依赖 `embed`；
主题、语言和 target callback 通过 refs/独立 presentation effect 更新，不再重建 guest。

### 服务端根因

客户端 ticket 重放修正后，真实链已到 forum root，但 root 返回 500 和 Flarum 通用错误页。
生产 Flarum 日志给出 `DirectoryNotFoundException`，缺失路径精确为
`/var/www/html/storage/sessions`。该目录是文件会话存储；ticket 已成功兑换、登录 Cookie
已建立后，Flarum 在读取 authenticated root 时因此失败。

当前生产容器仅创建这一精确目录，要求真实 storage 根、非 symlink，owner/group 为
`www-data:www-data`、mode 为 `0750`。源码 runtime entrypoint 同样幂等创建该目录，
防止空目录未被备份/恢复或新 volume 缺项后再次发生；未修改数据库、账号、Cookie、
ticket TTL、重放规则或导航 allowlist。

### RED → GREEN 与直接结果

- 客户端 RED：presentation props 变化会重建 webview 并重放 ticket；GREEN 锁定 lifecycle
  只依赖 `embed`，主题/语言仍可在原 guest 上更新。
- 服务端 RED：runtime entrypoint 不创建 `storage/sessions`；GREEN 要求它在 Apache 前以
  精确 owner/mode 创建。
- 客户端/Identity 聚焦组合 20/20、TypeScript/Vite build、Node syntax 和 diff-check 通过。
- 修复生产目录后，同一真实账号新建 1 张 ticket、消费 1 次、live 未消费 0；guest 最终
  为 approved root、HTTP 200、Flarum shell 存在，通用错误页和 host error 均不存在。

这次直接验证证明当前源码客户端与现有生产 Community 服务的组合可用；它不会反向修改
已经封装的 0.1.83 客户端字节。下一客户端候选仍须包含本节的 listener-order 和
single-ticket lifecycle 修复；后续 Community 镜像必须包含 runtime sessions-directory gate。
