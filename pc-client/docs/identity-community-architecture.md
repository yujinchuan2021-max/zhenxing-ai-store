# 用户、个人中心与开源社区统一身份架构

## 目标

- 用户只注册一个 AI Hub 用户。
- Flarum 负责讨论、回复、通知、权限和社区管理，不重复开发论坛。
- PC 个人中心统一管理私有资料、安全、站内信和互动记录。
- PC 不保存社区密码，也不把长期刷新凭据交给渲染进程或社区容器。
- 本地 Docker 与未来 HTTPS 部署沿用同一身份流。

## 服务边界

`identity-community` 负责用户与私有个人数据：

- 邮箱验证码、注册和登录；
- 短期访问令牌与可轮换设备会话；
- 昵称、头像、个签、邮箱和手机号；
- 密码修改与设备会话撤销；
- 站内信；
- 讨论收藏与喜欢记录；
- 60 秒有效、仅能使用一次的社区跳转凭据。

Flarum 只负责社区：

- 用户映射；
- 讨论和回复；
- 通知、标签、权限与管理后台；
- 内嵌社区会话。

PC 客户端暴露窄接口：

```text
requestRegistrationCode(email)
register(...)
login(...)
getIdentitySnapshot()
updateProfile(...)
updatePhone(...)
requestEmailChange(...)
completeEmailChange(...)
changePassword(...)
listSiteMessages()
listCommunityInteractions()
setCommunityInteraction(...)
logout()
listDeviceSessions()
revokeDeviceSession(sessionId)
createCommunityEmbedSession()
```

## 内嵌社区登录流程

```text
PC 主进程
  -> AI Hub 身份服务申请一次性凭据
  -> 独立社区分区打开 Flarum 固定登录桥
  -> 登录桥在容器内兑换凭据
  -> Flarum 创建或找到对应用户并签发社区会话
  -> 内嵌容器重定向到无凭据的社区首页
```

凭据数据库只保存 SHA-256 摘要，有效期 60 秒，兑换采用数据库原子更新。成功兑换后不能再次使用。Flarum 用户名来自不可变的 AI Hub 用户名；密码由服务端秘密派生，不会暴露给用户、客户端或社区地址。

内嵌社区使用 `persist:aihub-community` 独立分区。分区只保存 Flarum Cookie，不共享 PC access token、refresh token 或 preload。主进程校验初始登录桥、后续导航和弹窗来源，并拒绝权限申请。

## 本地部署

```text
Electron PC
  |
  +-- 主进程 -> http://127.0.0.1:4180 -> identity-community
  |                                         +-- PostgreSQL
  |                                         +-- Mailpit SMTP
  |
  +-- 独立社区分区 -> http://127.0.0.1:8088 -> Flarum
                                                   +-- MariaDB
```

数据库不暴露宿主机端口。用户接口、Mailpit、Flarum 和后台仅绑定 `127.0.0.1`。

## 已验证边界

- 邮箱验证码、本地注册、登录、刷新轮换、旧刷新凭据重放撤销；
- 昵称、个签、头像、手机号、邮箱和密码修改；
- 站内信读取、收藏与喜欢；
- 一次性社区凭据签发、兑换和重放拒绝；
- Flarum 自动建号、发帖和回复；
- PC 在独立分区中加载精确社区来源；
- 社区容器没有 Node.js、preload、PC 凭据或权限申请能力。

Mailpit 只证明本地邮件链路，不代表公网邮件送达。生产环境仍需要 HTTPS、正式邮件服务、独立密钥、代码签名、监控和外部安全评估。
