# Kimi 与 OpenClaw 二次产品复核

复核时间：2026-07-31

本轮只采信厂商官网、官方帮助中心、官方文档、官方 GitHub 仓库和官方 npm 包。用户截图用于发现漏项，不作为下载地址或安装命令来源。

## 月之暗面 / Kimi

| 产品 | 结论 | PC 端行为 | 官方证据 |
|---|---|---|---|
| Kimi | 在线 AI 助手主产品。Slides、Websites、Deep Research、Sheets、Docs 是 Kimi 内部功能，不拆成重复安装项。 | 直接打开网站 | https://www.kimi.com/ |
| Kimi Work | Kimi 官方 Windows/macOS 桌面客户端，具备本地文件、浏览器和自动化能力。 | 打开官方产品与下载页 | https://www.kimi.com/zh-cn/products/kimi-work / https://www.kimi.com/zh-cn/resources/kimi-work-introduction |
| Kimi Code | 官方终端与 IDE 编程产品；沿用现有 Kimi Code CLI 目录项。 | 打开官方安装说明，待单独审核 Windows 安装闭环 | https://www.kimi.com/code/zh |
| Kimi Claw | Kimi 内集成的 OpenClaw，可在云端一键创建。 | 直接打开 Kimi Claw 产品页 | https://www.kimi.com/zh-cn/resources/kimi-claw-introduction / https://www.kimi.com/help/kimi-claw |
| Kimi Claw 本地部署 | Kimi Work 内提供“部署到我的电脑”，由 Kimi 桌面端完成 OpenClaw、模型和搜索能力配置。 | 打开 Kimi Work 官方下载页与桌面部署教程 | https://www.kimi.com/help/kimi-claw/desktop-deployment-guide |
| Kimi WebBridge | Kimi Work/本地 Agent 与浏览器之间的官方扩展桥接。 | 打开官方扩展说明页 | https://www.kimi.com/zh-cn/features/webbridge |
| Kimi Open Platform | 独立 API/Key 体系。 | 打开开发者平台与文档 | https://platform.moonshot.cn/ / https://platform.moonshot.cn/docs/ |

Kimi 移动应用不进入当前 PC 产品目录。Kimi Claw 的 Android 部署入口也不伪装成 Windows 安装项。

## OpenClaw

| 产品 | 结论 | PC 端行为 | 官方证据 |
|---|---|---|---|
| OpenClaw CLI / Gateway | 官方包名为 `openclaw`，推荐安装后运行 `openclaw onboard --install-daemon`。 | 客户端本地白名单一键部署固定版本，然后打开可见 onboarding 命令窗口 | https://docs.openclaw.ai/install / https://www.npmjs.com/package/openclaw / https://github.com/openclaw/openclaw |
| OpenClaw Windows Hub | 官方 Windows 桌面伴侣，提供 setup、tray、chat、node mode 和 local MCP。 | 打开官方 Windows 下载与说明页 | https://docs.openclaw.ai/windows |
| ClawHub Skills / Plugins | OpenClaw 产品内扩展，不进入厂商首页一级产品。公共 registry 收录不等于官方发布者。 | 保留在 OpenClaw 产品的扩展子目录 | https://docs.openclaw.ai/clawhub |

### 一键部署审核记录

- 固定官方 npm registry，不执行后台传入的包名或命令。
- 当前审核版本：`openclaw@2026.7.1-2`。
- 官方包引擎要求：Node `>=22.22.3 <23 || >=24.15.0 <25 || >=25.9.0`。
- npm 依赖脚本全部禁用；只允许客户端内写死并核对 manifest 的 OpenClaw 包内 `postinstall`。
- 安装完成后使用客户端本地固定参数打开 `openclaw onboard --install-daemon`。
- 后台只能启停产品、调整展示内容和选择已批准的 `cli.openclaw` 配置，不能下发 PowerShell、CMD、Shell 或任意 npm 包。
- OpenClaw 可访问文件、网络、消息渠道和凭据；安装成功不等于用户已授权全部能力。onboarding 仍由用户逐项完成。

## 本轮目录变更

- 新增：Kimi Work、Kimi Claw、Kimi Claw 本地部署、Kimi WebBridge、OpenClaw Windows Hub。
- 修改：OpenClaw 从“打开官方安装说明”升级为客户端本地白名单的一键部署模块。
- 保留：Kimi、Kimi Code CLI、Kimi Open Platform、OpenClaw 的 Skills/Plugins 子目录。
