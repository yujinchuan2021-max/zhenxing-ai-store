# 账号与开源社区统一身份架构

## 目标

- 用户只注册一个 AI Hub 账号。
- Flarum 负责帖子、回复、通知、权限和社区管理，不重复开发论坛。
- PC 客户端不保存社区密码，也不把长期刷新凭据交给渲染进程。
- 本地 Docker 与未来 HTTPS 部署沿用同一身份流。

## 服务边界

`identity-community` 只负责身份：

- 邮箱验证码、注册和登录；
- 短期访问令牌；
- 可轮换的设备刷新会话；
- 个人资料；
- 60 秒有效、仅能使用一次的社区登录票据。

Flarum 只负责社区：

- 社区用户映射；
- 帖子和回复；
- 通知、标签、权限与管理后台；
- 浏览器会话。

PC 客户端只暴露窄接口：

```text
requestRegistrationCode(email)
register(...)
login(...)
getIdentitySnapshot()
logout()
listDeviceSessions()
revokeDeviceSession(sessionId)
openCommunity()
```

## 登录流程

```text
PC 客户端
  -> AI Hub 身份服务申请一次性票据
  -> 系统浏览器打开 Flarum 登录桥
  -> 登录桥在容器内兑换票据
  -> Flarum 创建或找到对应用户并签发浏览器会话
  -> 浏览器重定向到无票据的社区首页
```

票据数据库只保存 SHA-256 摘要，有效期 60 秒，兑换采用数据库原子更新。成功或失败后都不能再次使用。Flarum 用户名来自不可变的 AI Hub 用户名；密码由服务器端秘密派生，不会暴露给用户、客户端或浏览器地址。

## 本地部署

```text
Electron PC
  |
  +-- http://127.0.0.1:4180 -> identity-community
  |                              +-- PostgreSQL
  |                              +-- Mailpit SMTP
  |
  +-- 系统浏览器
         |
         +-- http://127.0.0.1:8088 -> Flarum
                                          +-- MariaDB
```

数据库不暴露宿主机端口。账号接口、Mailpit、Flarum 和后台仅绑定 `127.0.0.1`。

## 已验证边界

- 邮箱验证码、本地注册、登录、刷新轮换、旧刷新凭据重放撤销；
- 一次性社区票据签发、兑换和重放拒绝；
- Flarum 自动建号、发帖和回复；
- PC 端通过主进程校验社区地址后调用系统浏览器。

Mailpit 只证明本地邮件链路，不代表公网邮件送达。生产环境仍需要 HTTPS、正式邮件服务、独立密钥、代码签名和外部安全评估。
