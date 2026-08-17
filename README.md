# 枕星AI助手

枕星AI助手是面向 Windows 的 AI 工具发现、安装、更新与本机管理中心。它统一呈现 AI 厂商、桌面与 CLI 产品，以及 Skill、MCP、插件和连接器等生态资源。

## 当前公开版本

- [v0.1.100 正式版](https://github.com/yujinchuan2021-max/zhenxing-ai-assistant/releases/tag/v0.1.100)
- 提供 Windows x64 全机安装版和便携版。
- 发布页同时提供 SHA-256、BUILD 和 PACKAGE-CONTROL 校验记录。
- 当前 EXE 尚未代码签名，Windows 可能显示未知发布者或 SmartScreen 提示。
- 当前 GitHub Latest 为 v0.1.100。

## 主要能力

- 按厂商浏览 AI 产品与可接入产品。
- 浏览 Skill、MCP、插件和连接器，并查看用途、兼容宿主与来源。
- 管理已安装产品、下载任务、安装包和本机运行环境。
- 为已接入的软件提供版本检测、单项更新与批量更新入口。
- 在客户端内访问社区、投稿入口和个人中心。

## 项目目录

- `pc-client/`：Windows 桌面客户端、安装器、目录与本地服务。
- `app/`：枕星AI助手官方网站。
- `deployment/`：服务端与发布环境配置。

## 参与贡献

欢迎提交错误报告、体验改进、第一方资源证据、固定适配器、文档与翻译。贡献前请阅读 [贡献指南](CONTRIBUTING.md)：我们的原则是降低门槛但不降低安全线，把复杂留给系统，把选择交给用户。

## 本地开发

桌面客户端：

```powershell
cd pc-client
npm.cmd install
npm.cmd run desktop
```

官方网站：

```powershell
npm.cmd install
npm.cmd run dev
```

当前正式版仍未进行代码签名，也尚未启用客户端自身的正式 HTTPS 自动更新通道；这些边界会在发布页明确披露。
