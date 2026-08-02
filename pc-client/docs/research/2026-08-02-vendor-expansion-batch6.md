# 第六批厂商与产品核验

## 范围

本批次只录入能够由厂商官网、官方帮助中心、官方开发者文档或官方产品页确认的内容。Windows 图形软件继续使用 `desktop-official` 模块，只打开厂商官方安装页；网页与 Windows 客户端属于同一产品时合并为一个产品模块，通过入口按钮区分。CLI 暂不扩充。

## 新增厂商与产品

| 厂商 | 产品 | 目录 | 处理方式 | 官方证据 |
| --- | --- | --- | --- | --- |
| Gamma | Gamma | AI 工具 / 办公自动化 | 网页产品 | [Gamma 官网](https://gamma.app/)、[Gamma 帮助中心](https://help.gamma.app/en/articles/11080604-what-s-gamma) |
| Krea | Krea、Krea Agent Platform | AI 工具 / 图像创作；AI 可接入 / 图像与设计 | 网页产品；另补官方 MCP 与 Agent Skills | [Krea 官网](https://www.krea.ai/)、[Krea MCP](https://www.krea.ai/mcp)、[Krea Skills](https://www.krea.ai/skills) |
| Meshy | Meshy、Meshy 3D Agent、Meshy Developer Platform | AI 工具 / 3D 创作、智能体；AI 可接入 / 3D 创作 | 网页产品；Developer Platform 作为官方 MCP 与 Skill 的来源产品 | [Meshy 官网](https://www.meshy.ai/)、[3D Agent](https://docs.meshy.ai/en/agent/overview)、[MCP 与 Skill](https://docs.meshy.ai/en/agent/mcp-and-skill) |
| 生数科技 | Vidu、Vidu Claw | AI 工具 / 视频创作、智能体 | 网页产品 | [生数科技官网](https://www.shengshu.com/)、[Vidu 官网](https://www.vidu.com/zh/)、[Vidu Claw](https://www.vidu.com/zh/vidu-claw) |
| PixVerse | PixVerse、PixVerse Agent、PixVerse Developer Platform | AI 工具 / 视频创作、智能体；AI 可接入 / 视频创作 | 网页产品；补官方 MCP，官方 CLI 留待后续 CLI 批次 | [PixVerse 官网](https://pixverse.ai/en)、[PixVerse Agent](https://pixverse.ai/en/agent)、[PixVerse MCP](https://github.com/PixVerseAI/PixVerse-MCP) |
| Udio | Udio | AI 工具 / 音频创作 | 网页产品 | [Udio 官网](https://www.udio.com/)、[Udio 帮助中心](https://help.udio.com/en/) |
| Obsidian | Obsidian | AI 可接入 / 文档与知识库 | Windows 客户端，插件能力由厂商官方插件机制承载 | [Obsidian 下载页](https://obsidian.md/download)、[插件文档](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin) |
| Discord | Discord | AI 可接入 / 项目与协作 | Windows 客户端，AI 接入通过官方 App/Bot 开发平台 | [Discord 下载页](https://discord.com/download)、[Discord 开发者文档](https://discord.com/developers/docs/intro) |

## 已有厂商的 Windows 补齐

| 厂商 | 产品 | 变更 | 官方证据 |
| --- | --- | --- | --- |
| 字节跳动 | CapCut | 新增独立 Windows 产品模块，保留官网、网页版和 Windows 安装入口 | [CapCut Desktop](https://www.capcut.com/tools/desktop-video-editor) |
| Microsoft | Visual Studio Code | 新增 Windows 产品模块，归入 AI 可接入目录；官方文档已确认 MCP 支持 | [VS Code 下载页](https://code.visualstudio.com/download)、[MCP 文档](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) |
| ClickUp | ClickUp、Brain MAX | ClickUp 网页与 Windows 客户端合并；Brain MAX 作为独立 AI 桌面产品 | [ClickUp Apps](https://clickup.com/download)、[Brain MAX](https://clickup.com/brain/max) |
| Slack | Slack | 网页与 Windows 客户端合并为一个产品模块 | [Slack Windows 下载页](https://slack.com/downloads/windows) |
| Miro | Miro | 网页与 Windows 客户端合并为一个产品模块 | [Miro Desktop](https://help.miro.com/hc/en-us/articles/360017572814-Miro-for-desktop) |
| Linear | Linear | 网页与 Windows 客户端合并为一个产品模块 | [Linear Desktop](https://linear.app/download) |
| Zoom | Zoom Workplace | 网页与 Windows 客户端合并为一个产品模块，继续归入 AI 可接入目录 | [Zoom Download Center](https://www.zoom.com/en/products/virtual-meetings/download-center/) |

## 资源商店

- Meshy MCP Server：官方页面说明可从 Claude、Cursor、VS Code、Windsurf、Codex 等支持 MCP 的工具连接；本批次只打开官方接入说明，不由后台下发命令。
- Meshy 3D Skill：官方页面提供 Skill 安装说明；仍以 `resource-link` 模块展示，不绕过客户端本地白名单。
- Krea MCP 与 Agent Skills：官方页面明确列出 Claude、Codex、OpenClaw、Cursor、Hermes、Copilot、Windsurf 等目标；当前只提供经过核验的官方说明入口。
- PixVerse MCP：官方仓库提供 Claude Desktop 与 Cursor 配置，并要求 Python、UV/UVX 和 PixVerse API Key；本批次不自动部署这些依赖。
- Miro、Linear、ClickUp、Slack 的官方 MCP 资源已经存在，只把新增的 Visual Studio Code 产品补充为经过官方文档确认的目标，不复制资源记录。

## 不纳入本批次

- PixVerse CLI：官方页面可确认存在，但用户当前要求先补桌面与网页产品，留给后续 CLI 批次。
- 任意非官方安装器直链：Windows 图形软件只打开厂商官方安装页。
- 根据网页文案推测的自动安装命令：后台不能下发任意命令，资源仍使用固定客户端模块。
