# 用户、个人中心与开源社区统一身份架构

## 目标

- 用户只注册一个 AI Hub 用户。
- Flarum 负责讨论、回复、通知、权限和社区管理，不重复开发论坛。
- PC 个人中心统一管理资料、安全、账号与社区提醒、收藏和喜欢。
- PC 不保存社区密码，也不把长期刷新凭据交给渲染进程或社区容器。
- 本地 Docker 与未来 HTTPS 部署沿用同一身份流。

## 服务边界

`identity-community` 负责用户与私有个人数据：

- 邮箱验证码、注册和登录；
- 短期访问令牌与可轮换设备会话；
- 昵称、头像、个签、邮箱和手机号；
- 密码修改与设备会话撤销；
- 账号提醒；
- 聚合 Flarum 原生提醒、讨论关注与帖子喜欢；
- 60 秒有效、仅能使用一次的社区跳转凭据。

Flarum 只负责社区：

- 用户映射；
- 讨论和回复；
- 原生通知、讨论关注、帖子喜欢、标签、权限与管理后台；
- 内嵌社区会话。

PC 客户端暴露窄接口：

```text
requestRegistrationCode(email)
register(...)
login(...)
getIdentitySnapshot()
getPersonalCenter()
markPersonalCenterNotificationRead(source, id)
updateProfile(...)
updatePhone(...)
requestEmailChange(...)
completeEmailChange(...)
changePassword(...)
logout()
listDeviceSessions()
revokeDeviceSession(sessionId)
createCommunityEmbedSession()
```

`getPersonalCenter()` 是 PC 当前使用的唯一读取接口。它在服务端合并身份服务中的账号提醒与 Flarum 中的社区提醒、关注和喜欢；旧的站内信与互动接口仅为兼容保留，不再驱动个人中心。

身份服务通过 Docker 内网调用 Flarum 窄桥。窄桥要求独立共享密钥，只接受固定的读取和标记已读动作，并始终使用身份服务从 access token 得到的用户名；客户端无法提交 SQL、命令或任意用户名。

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
- 统一个人中心接口聚合账号提醒与 Flarum 原生提醒、关注和喜欢；
- 一次性社区凭据签发、兑换和重放拒绝；
- Flarum 自动建号、发帖和回复；
- PC 在独立分区中加载精确社区来源；
- 社区容器没有 Node.js、preload、PC 凭据或权限申请能力。

Mailpit 只证明本地邮件链路，不代表公网邮件送达。生产环境仍需要 HTTPS、正式邮件服务、独立密钥、代码签名、监控和外部安全评估。
-
## 当前事实校正（2026-08-06）

本节以 ADR-0002、当前代码和 `docs/development-status.md` 的 2026-08-06 事实校正为准；前文旧表述保留作历史记录。

- Flarum 技术映射名由不可变 AI Hub 用户 UUID 确定性派生；不可变 UUID 是映射输入，统一昵称和头像是可修改的展示资料，技术映射名不对用户展示。
- `identity-community` 是用户关注、粉丝投影、用户私信和系统站内信的事实源；Flarum 是讨论关注、帖子喜欢、社区提醒和阅读记录的事实源。`getPersonalCenter()` 只负责统一读取/聚合，不改变两边的所有权。
- `community_interactions` 等旧接口仅兼容保留，PC 当前不调用，不再驱动个人中心；弃用前必须按“数据迁移 → 读路径切换 → 兼容期观测/回滚确认 → 最终弃用”的顺序执行，禁止直接删除旧接口或旧数据。
