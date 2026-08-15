# 枕星AI商店

枕星AI商店，让每个人都能更轻松地发现、安装和使用值得信赖的 AI 工具。我们希望把复杂留给系统，把探索与创造还给用户，让技术真正贴近日常、陪伴成长。

此商店源码全部由 Codex 编写。

作者从 2012 年开始做开源与基础互联网教育。新时代来临时，希望做更多普世性教育；AI 的发展应该惠及每一个人，而不是高高在上。

所以我做了这款产品，希望把 AI 的使用门槛降到最低。

希望有更多志同道合的朋友加入。项目会持续开源和开放；如果你在此基础上改版或使用，也欢迎（但不强制）告诉我你的使用场景。谢谢！

## 使命

我们希望建立一个清晰、可信、对普通用户友好的 AI 工具入口，让发现、安装和日常管理不再需要理解复杂的技术细节。

## 主要能力

- 发现、安装和管理 AI 工具。
- 检测本机环境，并在用户明确确认后执行更新。
- 通过统一账号使用个人中心与社区功能。

## 仓库内容

Windows 客户端与服务器源码位于同一仓库：

- `app/`、`worker/`、`db/`：网站与服务器源码。
- `pc-client/src/`、`pc-client/electron/`：Windows 客户端界面与桌面能力。
- `pc-client/shared/`、`pc-client/identity/`、`pc-client/community/`、`pc-client/catalog/`、`pc-client/admin/`：共享业务、账号、社区、目录与管理端源码。
- `public/`、`pc-client/public/`、`pc-client/extension-resources/`：公开静态资源与扩展资源。
- `tests/`、`pc-client/tests/`：可公开的自动化测试。

## 本地开发

安装 Node.js 与 npm 后，在仓库根目录运行：

```text
npm install
npm run dev
npm run build
```

开发 Windows 客户端：

```text
cd pc-client
npm install
npm run dev
npm run build
npm run desktop
```

## 安全

本仓库不提交凭据、私钥、生产环境秘密或用户数据。请不要把安全漏洞提交为公开 Issue；应通过仓库所有者提供的私下安全联系方式报告，并在修复公开前保密。

## 版本

当前已完成验收的产品版本为 **0.1.93**。根站点 `0.1.0` 与 PC 客户端内部 package `0.1.40` 是独立开发包版本，不表示它们已经统一为产品发布版本。

## 语言与内容边界

客户端支持中文与英文界面。目录中的厂商、产品和资源可使用经审核的英文本地化内容；缺少英文内容时保留原文。社区帖子属于用户内容，不由本仓库自动翻译，也不保证提供英文版本。

## 开源许可证

除另有说明外，本仓库中由项目方原创的软件源代码采用 Apache License 2.0 开源。

详见 [LICENSE](./LICENSE)、[NOTICE](./NOTICE) 和 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

第三方依赖、厂商商标与图标、目录元数据、社区内容及另附许可证的扩展资源，不因本许可证而重新授权，分别遵循其原始许可证或条款。
