# 枕星 AI：AI 可接入厂商扩充研究（音频、游戏、3D、自动化与远程控制）

- 日期：2026-08-02
- 状态：研究完成，待产品与安全审核；本文不代表已经进入客户端白名单
- 范围：Windows 产品，以及能被 Claude、Codex、ChatGPT、Cursor、Copilot 等 AI 客户端调用的真实 MCP、插件或连接器
- 证据标准：只采用厂商官方文档、官方仓库，或集成项目自身源码仓库；社区项目必须明确标注“社区”，不得暗示厂商背书

## 结论

建议首批补充 8 个厂商/产品，覆盖 7 类实用特性：3D 创作、游戏开发、音乐制作、直播与录制、工作流自动化、桌面 RPA、智能设备控制。

- 官方集成优先：n8n、UiPath、Home Assistant。
- 社区连接器审核后接入：Blender、Godot、Unreal Engine、Ableton Live、OBS Studio。
- OBS 连接器仍处于活跃开发期，首版只进入“实验性资源”，不开放静默一键安装。
- 现有目录已经包含 Unity 和向日葵，因此本轮不重复新增。AI 厂商页和 AI 可接入厂商页可以引用同一份厂商资料，但产品与连接器关系必须分开。
- 当前目录中未发现 Blender、Godot、Unreal、Ableton、OBS、n8n、UiPath、Home Assistant，以下候选不会造成现有目录重复。

## 厂商 Logo 与商标规则

Logo 必须同步补齐，但要把“厂商身份”和“连接器官方性”分开表达：

1. 厂商卡片与产品卡片使用厂商官方品牌资源，不能再长期使用字母占位图。
2. 社区 MCP/插件卡片使用通用 MCP 图标或项目自己的图标，并显示“社区连接器”；不能直接把厂商 Logo 当成社区项目 Logo。
3. 后台至少保存 `logoAsset`、`logoSourceUrl`、`logoUsageNote`、`logoUpdatedAt` 和 `integrationOfficiality`。客户端只读取已发布的本地/CDN 资产，不能长期热链厂商网站。
4. 优先保存官方 SVG/PNG，保留比例、留白和品牌色，不自行描边、换色、加字或组合成新的商标。
5. 所有厂商页都显示“商标归其各自权利人所有；收录不代表厂商认可或合作”。如果官方品牌规范有更严格要求，以官方规范为准。
6. Logo 加载失败时才退回厂商首字母或通用图标；发布校验应阻止“缺 Logo 来源”的新厂商进入正式目录。

## 首批候选总表

| 厂商 / 产品 | 实用类别 | Windows 入口 | AI 资源 | 可验证的 AI 客户端 | 资源官方性 | 首批建议 |
| --- | --- | --- | --- | --- | --- | --- |
| Blender Foundation / Blender | 3D 建模、动画、渲染 | Windows 安装版或便携版 | Blender MCP | Claude Desktop、Claude Code、Cursor | 社区 | 审核后接入 |
| Godot Engine / Godot | 游戏开发、交互应用 | Windows 自包含程序 | Godot MCP | Claude Desktop、Claude Code、Cursor、Cline、Windsurf 及通用 MCP 客户端 | 社区 | 审核后接入 |
| Epic Games / Unreal Engine | 游戏开发、实时 3D | Epic Games Launcher | Unreal MCP | Claude Desktop、VS Code、Cursor 及通用 stdio MCP 客户端 | 社区 | 审核后接入 |
| Ableton / Ableton Live | 音乐制作、MIDI、音频 | Windows 安装程序 | Ableton MCP Extended | Claude Desktop、Cursor | 社区 | 审核后接入 |
| OBS Project / OBS Studio | 直播、录制、场景与音频控制 | Windows 安装程序 | MCP Server for OBS | VS Code / GitHub Copilot、Claude Desktop、Cursor、Windsurf | 社区、实验性 | 先展示，审核后安装 |
| n8n / n8n | 工作流与业务自动化 | 云端网页或 Windows 上的 Docker 自托管 | n8n 内置 MCP Server | Claude Desktop、Claude Code、Codex、ChatGPT、Cursor、Windsurf、自定义 Agent | 官方 | 优先接入 |
| UiPath / UiPath Platform | 桌面 RPA、业务流程自动化 | Automation Cloud 网页；Studio、Assistant、Robot 为 Windows 客户端 | UiPath MCP Server | VS Code / GitHub Copilot；ChatGPT、Copilot Studio 等可按官方 OAuth 方式连接 | 官方 | 优先接入 |
| Open Home Foundation / Home Assistant | 智能家居、设备与远程控制 | Windows 中运行 HAOS 虚拟机，浏览器管理 | Model Context Protocol Server 集成 | ChatGPT、Claude Code 及通用 MCP 客户端 | 官方 | 优先接入 |

## 1. Blender Foundation / Blender

### 产品与连接器

- 产品：Blender，开源 3D 建模、动画、渲染与视频处理工具。
- Windows 入口：官方提供 Windows 安装版和便携版；产品安装只应跳转官方入口或调用客户端已经审核的固定模块。
- 资源：`ahujasid/blender-mcp`，社区 MCP。它由 Blender 插件内的 Socket 服务与 Python MCP 服务组成，可操作对象、材质和场景，也提供任意 Python 代码执行能力。
- 支持客户端：项目文档明确给出 Claude Desktop、Claude Code、Cursor 的 Windows 配置。

### 安装、卸载与安全

- 安装：先确认 Blender 3+、Python 3.10+ 和 `uv`；安装 Blender add-on，再把固定的 MCP Server 配置写入用户选择的 AI 客户端。Windows 示例通过 `cmd /c uvx blender-mcp` 启动。
- 卸载：禁用并删除 Blender add-on，删除对应 AI 客户端中的 MCP 配置，再按用户选择清理 `uv` 缓存或项目目录。除非 Blender 本身由枕星 AI 安装且存在收据，否则不得卸载 Blender 或删除 `.blend` 工程。
- 安全：连接器可执行任意 Blender Python，等同于当前用户对工程和文件系统的权限。默认禁用 `execute_blender_code`，启用时逐次确认；只监听本机，不向公网暴露端口；删除对象、导入外部资源和执行脚本必须二次确认。

### Logo

- 官方来源：[Blender Logo](https://www.blender.org/about/logo/)。Blender 的软件许可不等于 Logo 可任意使用，目录中只作厂商/产品识别并保留官方样式。
- 社区 MCP 卡片使用通用 MCP 图标并标注“社区”，不把 Blender Logo 作为连接器自身品牌。

### 一手证据

- [Blender 官方 Windows 下载](https://www.blender.org/download/)
- [Blender 官方系统要求](https://www.blender.org/download/requirements/)
- [Blender MCP 源码与安装说明](https://github.com/ahujasid/blender-mcp)

## 2. Godot Engine / Godot

### 产品与连接器

- 产品：Godot 4.x，游戏和交互应用开发引擎。
- Windows 入口：官方 Windows 包为自包含程序，解压即可运行，官方页面提供签名版本与不同架构。
- 资源：`tomyud1/godot-mcp`，社区 MCP；通过 Godot Asset Library 安装“Godot AI Assistant tools MCP”插件，服务端由 npm/npx 启动。
- 支持客户端：Claude Desktop、Claude Code、Cursor、Cline、Windsurf 以及其他兼容 MCP 的客户端。

### 安装、卸载与安全

- 安装：检测 Godot 4.x 与 Node.js LTS；用户在指定 Godot 项目中安装并启用插件；Windows MCP 配置使用固定的 `cmd /c npx -y godot-mcp-server` 模板。后台只能选择模块和参数，不能直接下发命令文本。
- 卸载：在 Godot 项目中禁用/删除 `addons/godot_mcp`，移除 AI 客户端 MCP 配置；npx 按需运行时默认不保留独立服务，可按用户选择清理 npm 缓存。不得删除 Godot 可执行文件或项目目录。
- 安全：连接器可读写项目、创建和删除节点、修改脚本和项目设置、运行/停止项目并注入输入。必须绑定到用户明确选择的工程目录；删除、运行、输入注入和批量改写前确认；默认禁止跨工程路径访问。

### Logo

- 官方来源：[Godot Press Kit](https://godotengine.org/press/)。官方允许按 CC BY 4.0 使用品牌资源，但仍需署名、保持比例并避免暗示认可。
- 连接器卡片用通用 MCP 图标，不把 Godot Logo 变成社区项目 Logo。

### 一手证据

- [Godot 官方 Windows 下载](https://godotengine.org/download/windows/)
- [Godot MCP 源码与客户端配置](https://github.com/tomyud1/godot-mcp)
- [Godot 官方品牌与媒体资源](https://godotengine.org/press/)

## 3. Epic Games / Unreal Engine

### 产品与连接器

- 产品：Unreal Engine，游戏和实时 3D 内容开发引擎。
- Windows 入口：通过 Epic Games Launcher 安装并管理精确的引擎版本。
- 资源：`GenOrca/unreal-mcp`，社区 MCP；仓库说明覆盖大量 Unreal 操作，并包含 `execute_python`。
- 支持客户端：仓库明确给出 Claude Desktop Windows、VS Code 和 Cursor 配置；其他兼容 stdio MCP 的客户端需要单独验证。

### 安装、卸载与安全

- 安装：先确认 Unreal Engine 5.6+、Python 3.11+、`uv`，再下载与引擎版本严格匹配的预编译插件，放入用户选定项目的 `Plugins`；源码构建还依赖 Visual Studio C++。不能跨引擎版本猜测安装。
- 卸载：关闭编辑器，从指定项目删除 `Plugins/UnrealMCPython`，删除独立 MCP Server 与客户端配置，再由 Unreal 重建项目元数据。不得删除引擎、Marketplace 资产或项目内容。
- 安全：该连接器能执行 Python、修改 Blueprint/材质/Actor、删除资产、构建和打包。任意 Python 默认关闭；删除、构建、打包、编辑器重启和资产覆盖逐次确认；仅授权单个项目根目录。

### Logo

- 官方来源：[Unreal Engine Branding Guidelines](https://www.unrealengine.com/en-US/branding-guidelines-and-trademark-usage)。只使用 Epic 允许的官方素材与留白规则，并明确 MCP 为社区项目。

### 一手证据

- [Unreal Engine 官方安装文档](https://dev.epicgames.com/documentation/en-us/unreal-engine/install-unreal-engine)
- [Unreal Engine 项目设置文档](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-your-production-pipeline-in-unreal-engine)
- [Unreal MCP 源码、版本与客户端说明](https://github.com/GenOrca/unreal-mcp)

## 4. Ableton / Ableton Live

### 产品与连接器

- 产品：Ableton Live 11+，音乐制作、MIDI 编排与现场演出软件。
- Windows 入口：官方 Windows 安装程序与 Ableton 授权流程。
- 资源：`uisato/ableton-mcp-extended`，社区 MCP；通过 Ableton Remote Script 和本地 Socket 控制 Live，可创建轨道、鼓组、MIDI，并可选接入 ElevenLabs 生成音频。
- 支持客户端：项目说明列出 Claude Desktop 和 Cursor。

### 安装、卸载与安全

- 安装：检测 Live 11+ 与 Python 3.10+；把固定版本 Remote Script 安装到 Windows 用户 Remote Scripts 目录，在 Live 的 Control Surface 中选择 `AbletonMCP`，再写入已审核的 MCP 配置。
- 卸载：先在 Live 中把 Control Surface 改为 `None`，删除 `AbletonMCP` Remote Script、MCP 配置和连接器虚拟环境/仓库。不得删除 Live Set、User Library、采样库或用户自定义 Pack。
- 安全：连接器可改变当前 Session、轨道、MIDI 和音频素材。首次写入前提示保存工程；覆盖、批量生成和外部音频导入需要确认；ElevenLabs 等外部 API 必须独立授权，密钥不进入目录配置。

### Logo

- 官方来源：[Ableton Press](https://www.ableton.com/en/press/)。Ableton、Ableton Logo 与 Live 标识均为商标，保持官方素材与比例，仅作识别。

### 一手证据

- [Ableton Live 官方 Windows 安装文档](https://help.ableton.com/hc/en-us/articles/209773565-Installing-Ableton-Live)
- [Ableton 官方卸载说明](https://help.ableton.com/hc/en-us/articles/115001172024-Uninstalling-Live-Windows)
- [Ableton MCP Extended 源码与安装说明](https://github.com/uisato/ableton-mcp-extended)

## 5. OBS Project / OBS Studio

### 产品与连接器

- 产品：OBS Studio，录屏、直播、场景与音频混合工具。
- Windows 入口：OBS 官方 Windows 安装程序。
- 资源：`sbroenne/mcp-server-obs`，社区 MCP；通过 OBS 28+ 内置的 obs-websocket 控制直播、录制、场景、来源、音频、截图和虚拟摄像头。
- 支持客户端：VS Code / GitHub Copilot 扩展，或独立服务接入 Claude Desktop、Cursor、Windsurf。仓库明确标注仍在活跃开发并且当前面向 Windows。

### 安装、卸载与安全

- 安装：优先使用 Visual Studio Marketplace 中的官方项目扩展发布；独立模式需固定版本的发行包与 .NET 运行时。用户在 OBS 内主动启用 WebSocket，并设置强密码；服务仅连接 `localhost`。
- 卸载：卸载 VS Code 扩展，或删除独立 MCP Server 与客户端配置；随后关闭 OBS WebSocket 或轮换/撤销密码。不得卸载 OBS 或删除 Profile、Scene Collection、录制文件。
- 安全：开始直播、开始录制、屏幕/窗口截图、切换含敏感来源的场景属于高风险动作，必须逐次确认；禁止把 WebSocket 暴露到公网；密码只存在系统凭据存储，不写入后台目录。
- 发布级别：实验性。先提供“查看说明/连接”入口，完成代码审计、固定版本、哈希和回归测试后再开放安装按钮。

### Logo

- 官方来源：[OBS 官方网站](https://obsproject.com/)；OBS 名称和 Logo 是 Wizards of OBS LLC 的注册商标。
- [OBS 第三方资源与知识产权政策](https://obsproject.com/forum/threads/forum-resource-and-ip-policy.178569/)明确要求第三方插件/资源不得用 OBS Logo 作为自身品牌或造成官方关联混淆。因此厂商/产品卡可以用官方 OBS Logo 作识别，连接器卡必须使用通用 MCP/社区图标。

### 一手证据

- [OBS Studio 官方源码仓库](https://github.com/obsproject/obs-studio)
- [MCP Server for OBS 源码与配置](https://github.com/sbroenne/mcp-server-obs)
- [MCP Server for OBS 的 Visual Studio Marketplace 发布页](https://marketplace.visualstudio.com/items?itemName=sbroenne.obs-mcp)

## 6. n8n / n8n

### 产品与连接器

- 产品：n8n，工作流和业务自动化平台。
- Windows 入口：使用 n8n Cloud 网页，或在 Windows 的 Docker Desktop 中运行官方自托管模板，管理页通常为浏览器入口。
- 资源：n8n 内置的实例级 MCP Server，属于官方功能；不需要安装第三方 MCP 包。
- 支持客户端：官方资料列出 Claude Desktop、Claude Code、Codex、ChatGPT、Cursor、Windsurf、自定义 Agent 等；具体客户端按 OAuth/令牌能力连接。

### 安装、卸载与安全

- 安装：已有 Cloud/自托管实例时，只启用内置 MCP 并完成 OAuth/令牌授权；没有实例时，Windows 可调用客户端固定的 Docker Compose 模块，不能从后台下发 Shell。必须区分“部署 n8n”和“连接 n8n MCP”两个动作。
- 卸载：关闭 MCP、撤销令牌；AI Hub 自建 Docker 实例只停止/删除带安装收据的容器。卷和工作流先备份，默认保留，绝不能把用户现有实例、凭据或工作流一起删除。
- 安全：MCP 可搜索、创建、编辑、验证、测试并运行工作流，工作流又可能访问凭据、网络和文件。首版默认只读/搜索；创建、更新和运行都需确认；按项目/工作区最小授权；令牌保存在系统凭据库并使用 TLS。

### Logo

- 官方来源：[n8n Brand Guidelines](https://n8n.io/brandguidelines/)。按其颜色、留白、最小尺寸和小写 `n8n` 规则使用，不拉伸、不重绘。

### 一手证据

- [n8n 官方 MCP Server 发布说明](https://blog.n8n.io/n8n-mcp-server/)
- [n8n 官方 MCP Server 文档源码](https://github.com/n8n-io/n8n-docs/blob/main/docs/build/ways-of-building-workflows/connect-to-n8n-mcp-server.md)
- [n8n MCP 工具参考](https://github.com/n8n-io/n8n-docs/blob/main/docs/connect/connect-to-n8n-mcp-server/mcp-server-tools-reference.md)
- [n8n 官方自托管模板](https://github.com/n8n-io/n8n-hosting)

## 7. UiPath / UiPath Platform

### 产品与连接器

- 产品：UiPath Platform；Windows 侧包括 Studio、Assistant 和 Robot，云端 Orchestrator 负责编排与权限。
- Windows 入口：Automation Cloud 为网页；Studio/Assistant/Robot 为官方 Windows 客户端。
- 资源：UiPath MCP Server，官方功能。管理员在 Orchestrator 中把 RPA 工作流、Agent、API workflow、Maestro Process、Integration Service Activity 等现有工件选择为 MCP 工具。
- 支持客户端：官方当前明确列出 VS Code / GitHub Copilot 的内置 OAuth 流；ChatGPT、Copilot Studio 等可按官方手动 OAuth 方式连接。不能在没有验证时把“任意 MCP 客户端”写成已支持。

### 安装、卸载与安全

- 安装：Studio/Assistant 使用 UiPath 官方安装程序；MCP 本身不是 Windows 本地服务，而是在 Orchestrator 创建 MCP Server、选择工件、生成 URL 并配置 OAuth/PAT。客户端应显示“连接/配置”，不能伪装成一键安装本地 MCP。
- 卸载：在 Orchestrator 删除/停用 MCP Server，撤销 OAuth/PAT/External Application；保留 Studio、Robot、流程与作业记录。只有 Windows 客户端存在枕星 AI 安装收据且用户明确要求时，才调起官方卸载。
- 安全：MCP 可触发控制桌面和业务系统的 RPA 作业。按 Orchestrator Folder 最小授权，使用 Automation User 等最小角色；每次运行 Job 都需要用户确认；External Application Secret 不进入后台目录；Integration Service 工具保持用户上下文。

### Logo

- 官方来源：[UiPath Brand Center](https://brandcenter.uipath.com/portal)。只使用 Brand Center 提供的素材，不改色、裁切或自行组合。

### 一手证据

- [UiPath 官方：About MCP Servers](https://docs.uipath.com/orchestrator/automation-cloud/latest/user-guide/about-mcp-servers)
- [UiPath 官方：MCP Server Types](https://docs.uipath.com/orchestrator/automation-cloud/latest/user-guide/mcp-server-types)
- [UiPath 官方：MCP Server Authentication](https://docs.uipath.com/orchestrator/automation-cloud/latest/user-guide/mcp-server-authentication)
- [UiPath 官方：OAuth Flow](https://docs.uipath.com/orchestrator/automation-cloud/latest/user-guide/authenticating-with-the-mcp-oauth-flow)
- [UiPath Studio 官方介绍](https://docs.uipath.com/studio/standalone/latest/user-guide/introduction)

## 8. Open Home Foundation / Home Assistant

### 产品与连接器

- 产品：Home Assistant，智能家居和本地设备自动化平台。
- Windows 入口：官方推荐在 Windows 上用 VirtualBox、VMware Workstation 或 Hyper-V 运行 Home Assistant OS 虚拟机，再通过浏览器管理。
- 资源：官方内置的 Model Context Protocol Server 集成，Streamable HTTP 端点为 `/api/mcp`，可使用 OAuth 或长期访问令牌。
- 支持客户端：官方文档明确提供 ChatGPT 与 Claude Code 示例；其他通用 MCP 客户端需要逐个验证 OAuth/HTTP 能力。

### 安装、卸载与安全

- 安装：已有 Home Assistant 时，在“设置 → 设备与服务”添加 Model Context Protocol Server 集成；没有实例时，Windows 只提供经过审核的 HAOS 虚拟机部署引导。不能把 HAOS 虚拟机伪装成原生 Windows 桌面软件。
- 卸载：删除 MCP Server 集成，撤销 OAuth/令牌。默认保留 Home Assistant 虚拟机、配置、自动化和设备；删除虚拟机属于独立的高风险操作。
- 安全：默认只暴露用户选择的实体，并可关闭控制能力。门锁、警报、摄像头、车库门、温控与电源属于敏感物理控制：首版应只读，用户明确开启控制后仍逐次确认；使用实体白名单；远程连接必须 TLS/OAuth，不能公开裸端点。

### Logo

- 官方来源：[Home Assistant Design：Logo](https://design.home-assistant.io/#brand/logo)和[官方 Brands 仓库](https://github.com/home-assistant/brands)。商标仍归各自权利人，资源收录不代表认可。

### 一手证据

- [Home Assistant 官方 Windows 安装方式](https://www.home-assistant.io/installation/windows/)
- [Home Assistant 官方 MCP Server 集成](https://www.home-assistant.io/integrations/mcp_server/)
- [Home Assistant 官方品牌资源仓库](https://github.com/home-assistant/brands)

## 延后但可信的候选

### Blackmagic Design / DaVinci Resolve Studio

`hoyt-harness/davinci-mcp-professional` 是可验证的社区项目，支持 Windows、Claude Desktop，并描述了 Gemini CLI 与 ChatGPT 接入方式。但项目明确要求付费的 DaVinci Resolve Studio；免费版不支持所需的外部脚本能力。因此它适合作为第二批“付费前置条件”资源，不适合首批默认推荐或一键安装。

- [DaVinci Resolve 官方产品页](https://www.blackmagicdesign.com/products/davinciresolve)
- [DaVinci MCP Professional 源码与前置要求](https://github.com/hoyt-harness/davinci-mcp-professional)
- [Blackmagic Design 官方媒体资源](https://www.blackmagicdesign.com/media/images)

## 本轮拒绝或不收录的候选

- Unity、向日葵：现有目录已收录，本轮不重复创建厂商；后续只补其连接器关系和资源资料。
- REAPER、Audacity、FL Studio、TouchDesigner 的随机 MCP 项目：本轮未能同时验证“当前维护、源码可审计、明确 Windows 生命周期、明确支持客户端”四个条件，暂不入库。
- Smithery、Glama、MCP.Pub 等目录聚合页：只能作为发现线索，不能充当产品、安装、安全或官方性的证据。
- 只有 README 宣传、没有源码/发行版/卸载说明的项目：拒绝进入目录。
- 要求用户粘贴一段未知 PowerShell/CMD/Shell 的项目：拒绝自动安装；最多显示官方/源码说明页。

## 建议的后台数据边界

本轮研究不修改代码，但后续数据模型应至少区分：

- 厂商：只保存一份厂商身份、Logo、官网与商标说明。
- 产品：标记为 `AI 工具` 或 `AI 可接入产品`，同一厂商可拥有两类产品。
- 资源：MCP、插件、扩展、工作流、连接器等独立记录，归属某一产品，而不是平铺在商店首页。
- 官方性：`official`、`community-reviewed`、`community-experimental`。
- Windows 入口：`desktop`、`browser`、`docker`、`vm`，避免把网页/虚拟机伪装成原生客户端。
- 安装模式：`official-config`、`fixed-client-module`、`docs-only`。后台只能选择客户端固定模块和经过批准的参数，不能下发任意命令。
- 权限声明：文件读写、项目修改、任意代码、网络、凭据、录屏/直播、业务作业、物理设备控制必须结构化标记。
- 卸载策略：优先移除连接器、配置和令牌；只有存在枕星 AI 安装收据时才自动卸载宿主产品。

## 推荐录入顺序

1. n8n、UiPath、Home Assistant：官方 MCP，先完成厂商 Logo、产品页、连接说明和权限提示。
2. Blender、Godot：社区项目较清晰，完成源码审计、固定版本与项目级权限后进入审核白名单。
3. Unreal Engine、Ableton Live：依赖版本和工程/音乐项目状态更复杂，需要真实 Windows 软件验收。
4. OBS：先以实验性资源展示；完成直播/录屏高风险确认和凭据存储测试后再开放安装。
5. DaVinci Resolve Studio：作为带付费前置条件的第二批资源。

以上顺序只决定资源接入优先级，不代表自动安装授权。任何社区连接器都必须在客户端本地白名单、固定版本/哈希、卸载收据和权限说明齐备后，才能显示“一键安装”。
