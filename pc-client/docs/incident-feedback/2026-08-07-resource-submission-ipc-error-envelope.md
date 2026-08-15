# 投稿 IPC 技术错误直出

## 现象与证据

隔离 PostgreSQL、Identity 与真实 Electron 组合验收中，投稿 owner IPC 失败后，页面直接显示：

```text
Error invoking remote method 'identity:…': ResourceSubmissionIpcError: …
```

数据库连接串和服务 secret 原文没有从本次 Identity 错误返回，但 Electron channel、异常类和 IPC 包装文本属于技术诊断，不能作为用户文案。

## 根因

main 已把 Identity 错误归一化成安全 `Error`，但仍通过 `ipcMain.handle` reject。Electron 会在 reject 跨越 `ipcRenderer.invoke` 时重新包装 `error.message`，自动附加 remote method channel 和异常类。preload 将该 rejection 原样交给 renderer；renderer 再读取 `error.message`，因此 main 中安全的中文 message 仍被 Electron 技术前缀污染。

同一问题也覆盖 preload 本地参数校验：校验函数抛出 `Error` 时仍会让 renderer 依赖 rejection 的序列化方式。

## 被排除的错误猜测

- 不是 Identity 把数据库或 secret 原文返回给客户端；原始 cause 只存在于 main 日志。
- 不是某一个投稿 action 的特例；八个 capability/owner 方法共用相同的 reject 边界。
- 不在 renderer 增加 `Error invoking remote method` 正则。该文本由 Electron 实现决定，字符串清洗会遗漏其他包装形式。

## 修复

- main 的所有投稿 handler 始终 fulfilled，并返回固定 `SubmissionIpcResult<T>`：成功为 `{ok:true,value}`，失败为 `{ok:false,error:{code,status,messageKey}}`。
- main 只允许固定错误码、HTTP 状态和投稿文案 key；未知服务码降级为 `TEMPORARILY_UNAVAILABLE`。原始错误对象作为 cause 保留在 main 日志，不进入结果。
- sandbox preload 对 main envelope 做严格白名单校验；Electron invoke reject、畸形 envelope 和 preload 参数 validation 都转换为固定失败结果，不把 channel、异常类、stack、URL 或底层诊断交给 renderer。
- renderer 只消费 `ok/value/error.messageKey`，不解析 `error.message`。

该变化不改变 Identity 会话派生、capability gate、OwnerSubmission DTO、revision/idempotency、workflow fail-closed 或 reviewer 隔离。

## 自动验证

- `tests/resource-submission-ipc.test.cjs` 使用真实 Electron 包装文本建立红测，确认修复前 rejection 原样泄漏，修复后八个方法均只返回安全 envelope。
- 表驱动覆盖 401、409、429、503、validation、未知服务错误和成功 OwnerSubmission。
- renderer、runtimeMessage、Identity 聚焦测试和构建结果记录在本轮交付报告。

## 剩余验收

测试发布运维仍须使用发现本问题的同一套隔离 Electron + Identity E2E 脚本重跑。自动测试与隔离 E2E 都不等于真实用户账号或生产验收；本次未启用 capability、未封包或部署。

## 防复发门禁

任何新增 Electron IPC 的用户可见失败都不能依赖 rejection message 作为结构化协议。需要跨 main/preload/renderer 保留 code/status 时，必须使用严格白名单的 fulfilled result envelope，并用真实 Electron 包装文本回归 technical-message leakage。
