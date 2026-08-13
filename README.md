# 枕星AI商店

枕星AI商店，让每个人都能更轻松地发现、安装和使用值得信赖的 AI 工具。我们希望把复杂留给系统，把探索与创造还给用户，让技术真正贴近日常、陪伴成长。

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

当前产品发布版本为 **0.1.91**。根站点 `0.1.0` 与 PC 客户端内部 package `0.1.40` 是独立开发包版本，不表示它们已经统一为产品发布版本。

## 语言与内容边界

客户端支持中文与英文界面。目录中的厂商、产品和资源可使用经审核的英文本地化内容；缺少英文内容时保留原文。社区帖子属于用户内容，不由本仓库自动翻译，也不保证提供英文版本。

## 版权

本仓库未附开源许可证，除非另有书面许可，保留所有权利。
