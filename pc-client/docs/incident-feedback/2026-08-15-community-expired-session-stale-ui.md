# 社区失效会话被误报为通用操作失败

## 用户现象

已登录的 0.1.94 客户端进入“社区讨论”后，页面空白并显示“操作失败，请稍后重试”。社区公开页面和身份服务健康，但客户端没有提示重新登录。

## 现场证据

- 已安装客户端指向正确的生产身份与社区域名。
- 社区公开根页面和身份健康检查均返回成功；匿名请求社区跳转会话返回预期的 401。
- 截图账号存在历史会话记录，但没有有效 access/refresh 会话；社区跳转记录在近期为 0。
- 服务端在写入社区跳转记录前以 `401 SESSION_REVOKED` 拒绝请求，因此无需修改 Flarum 或社区服务器。

## 根因

渲染层仍保留过期登录资料并尝试申请一次性社区跳转凭据。Electron IPC 直接 reject 后，技术错误文本被统一压缩成“操作失败，请稍后重试”，导致可恢复的登录失效被误报为社区不可用。

## 修复

- 社区 IPC 改为固定的结构化结果，不再把主进程异常或服务端原文暴露给渲染层。
- `401` 或 `SESSION_REVOKED` 只映射为固定 `community.sessionExpired`；渲染层清除旧会话视图并打开登录页。
- 其他失败映射为固定服务不可用；成功结果还要在 preload 校验 HTTPS/loopback origin、精确 `/aihub-sso.php` 路径、单一安全 ticket、无凭据/hash 和有效过期时间。
- 非法成功响应按 `INVALID_IDENTITY_RESPONSE` fail closed，不创建 Webview。

## 验证

- TDD 首轮精确失败：共享层缺少 session failure 分类器。
- 修复后 `tests/community-embed.test.cjs` 11/11 通过，覆盖 401、SESSION_REVOKED、私密诊断不外泄、严格 IPC envelope 和非法跳转 URL。
- Node 语法检查、前端 build 与 lint 通过。

## 预防门

任何身份相关 IPC 都必须返回固定 discriminated union；渲染层不得从任意异常文本推断会话状态。社区跳转成功值必须在 preload 再验证一次，服务失效和登录失效必须提供不同的用户恢复动作。
