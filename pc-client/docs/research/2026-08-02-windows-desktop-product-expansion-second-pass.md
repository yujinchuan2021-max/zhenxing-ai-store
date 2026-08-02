# Windows 图形产品扩充第二轮普查

调查日期：2026-08-02（Asia/Shanghai）

> 展示模型说明：文中把插件或扩展保留在产品子目录的建议已由 [ADR-0006](../adr/0006-catalog-views-and-ecosystem-resource-stores.md) 取代。桌面产品来源与归属结论仍有效。

对照基线：`pc-client/admin/data/catalog-v1.json`，当前为 49 个厂商、142 个产品，`updatedAt=2026-08-02T06:49:07.742Z`。

## 1. 结论与边界

本轮合并了三路调查：海外 Windows 产品、中国 Windows 产品、Agent / 开发工具 / 本地模型 / 开源图形客户端。结论不是把搜索结果直接写入生产目录，而是形成一份可以进入后台录入与下一轮产品认证的清单。

- 只接受厂商官网、官方帮助中心、官方文档和官方 GitHub 仓库/Release 等一手来源。
- 本轮只处理 Windows 图形产品；CLI 保持独立产品，留到 CLI 轮次，不伪装成桌面产品。
- 同一产品的官网、Web 和 Windows 客户端只占一个产品卡，通过 `entryPoints` 增加按钮；不同交互形态的 CLI 仍是独立产品。
- “确认可纳入”只表示产品身份、AI 属性与官方 Windows 入口已经确认。新图形产品应先使用 `productType=desktop-official`、`moduleId=desktop-official`，让厂商负责下载、安装、更新和卸载。
- 只有完成精确安装包来源、重定向边界、签名、架构、安装收据、启动、更新、卸载和用户数据保留审计后，才可单独审批为 `desktop-reviewed` / `desktop-managed`。本文件没有批准任何新的自动安装白名单。
- Agent、包管理器和带脚本市场的产品，本轮只收录其官方客户端；后台不得借产品参数下发任意 EXE、PowerShell、CMD、Shell 或第三方脚本。
- `requiresCrossBorderNetwork` 必须来自可重复的网络证据，不得凭厂商国籍或主观印象推断。中国大陆原生服务默认不标记；海外产品也不因“海外”二字自动标记。

推荐统一产品结构：

```json
{
  "productType": "desktop-official",
  "moduleId": "desktop-official",
  "entryPoints": [
    { "type": "website", "label": "工具官网", "url": "..." },
    { "type": "web", "label": "打开网页版", "url": "..." },
    { "type": "desktop", "label": "Windows 下载" }
  ]
}
```

这里必须遵守现有 `shared/product-entry-points.cjs` 契约：`website` 与 `web` 入口带 URL；`desktop` 是客户端动作，不带 URL。`product.website` 保存厂商官方下载页，客户端点击 `desktop` 动作时打开该地址。不能把下载 URL 塞进 `desktop` 入口。

### 1.1 可直接录入的高置信首批字段

下表是三路普查合并后的首批可录入数据；`entryPoints` 中的 `desktop:标签` 均不含 URL。所有项目先使用 `productType=desktop-official`、`moduleId=desktop-official`，不进入自动安装白名单。

| vendorId | productId | 厂商 / 产品 | category | 描述 | product.website（官方下载入口） | tutorial | entryPoints | 新厂商 |
|---|---|---|---|---|---|---|---|---:|
| `openwebui` | `open-webui` | Open WebUI / Open WebUI | 本地模型 | 可连接本地或远程服务的开源 AI 工作台，官方 Desktop 提供 Windows x64/ARM64 版本。 | https://github.com/open-webui/desktop/releases | https://docs.openwebui.com/getting-started/quick-start/ | `website:工具官网=https://openwebui.com/`; `desktop:Open WebUI 客户端下载` | 否，合并现有产品 |
| `nous-research` | `hermes-desktop` | Nous Research / Hermes Desktop | 智能体 | Hermes Agent 的 Windows 原生图形客户端；与 Hermes Agent CLI 分开呈现。 | https://hermes-agent.nousresearch.com/ | https://github.com/nousresearch/hermes-agent/blob/main/website/docs/getting-started/installation.md | `website:工具官网=https://hermes-agent.nousresearch.com/`; `desktop:Hermes Desktop 下载` | 否，现有厂商补产品 |
| `quora` | `poe` | Quora / Poe | AI 对话 | 聚合多种模型与 Bot 的 AI 对话产品，网页版和 Windows 客户端共用一个产品卡。 | https://poe.com/download | https://poe.com/download | `website:工具官网=https://poe.com/`; `web:Poe 网页版=https://poe.com/`; `desktop:Poe 客户端下载` | 是 |
| `jan` | `jan` | Jan / Jan | 本地模型 | 可离线运行本地模型并连接云模型的开源 Windows 桌面客户端。 | https://www.jan.ai/download | https://www.jan.ai/docs/desktop/install/windows | `website:工具官网=https://www.jan.ai/`; `desktop:Jan 客户端下载` | 是 |
| `cherryhq` | `cherry-studio` | CherryHQ / Cherry Studio | AI 对话 | 支持多模型与本地知识能力的开源 Windows 桌面客户端。 | https://cherry-ai.com/download | https://docs.cherry-ai.com/cherry-studio-wen-dang/en-us/pre-basic/installation/windows | `website:工具官网=https://cherry-ai.com/`; `desktop:Cherry Studio 客户端下载` | 是 |
| `chatboxai` | `chatbox` | Chatbox AI / Chatbox | AI 对话 | 支持多模型与本地数据的跨平台 AI 客户端，Web 与 Windows 共用一个产品卡。 | https://chatboxai.app/en/install | https://chatboxai.app/en/guide/getting-started/download | `website:工具官网=https://chatboxai.app/`; `web:Chatbox 网页版=https://web.chatboxai.app/`; `desktop:Chatbox 客户端下载` | 是 |
| `msty` | `msty-studio` | Msty / Msty Studio | 本地模型 | 面向本地与在线模型的 Windows AI 工作台，包含 Agent Mode。 | https://msty.ai/studio/download | https://msty.ai/products/studio/ | `website:工具官网=https://msty.ai/products/studio/`; `desktop:Msty Studio 下载` | 是 |
| `msty` | `msty-go` | Msty / Msty Go | 智能体 | 带审批、Skills 和隔离能力的 Windows 自治智能体客户端。 | https://msty.ai/go/ | https://msty.ai/go/changelog/ | `website:工具官网=https://msty.ai/go/`; `desktop:Msty Go 下载` | 否，同厂商补产品 |
| `msty` | `msty-nexus` | Msty / Msty Nexus | 本地模型 | 用于管理本地模型网关和运行时的 Windows 控制中心。 | https://msty.ai/products/nexus/ | https://msty.ai/nexus/changelog | `website:工具官网=https://msty.ai/products/nexus/`; `desktop:Msty Nexus 下载` | 否，同厂商补产品 |
| `lobehub` | `lobehub` | LobeHub / LobeHub | AI 对话 | 支持本地与远程 Agent 的开源 AI 工作台，Web 与 Windows 共用一个产品卡。 | https://github.com/lobehub/lobehub/releases | https://github.com/lobehub/lobehub/releases | `website:工具官网=https://lobehub.com/`; `web:LobeHub 网页版=https://lobechat.com/`; `desktop:LobeHub 客户端下载` | 是 |
| `pieces` | `pieces-for-developers` | Pieces / Pieces for Developers | 编程开发 | 面向开发者的 AI 工作流与上下文管理客户端，Windows 安装包包含 Pieces OS 依赖。 | https://pieces.app/thanks | https://code.pieces.app/support-articles/how-do-i-use-the-windows-pieces-suite-installer | `website:工具官网=https://pieces.app/`; `desktop:Pieces 客户端下载` | 是 |
| `windsurf` | `windsurf` | Windsurf / Windsurf | 编程开发 | 内置 Cascade 智能体的 Windows AI IDE。 | https://windsurf.com/download | https://docs.windsurf.com/zh/windsurf/getting-started | `website:工具官网=https://windsurf.com/`; `desktop:Windsurf 客户端下载` | 是 |
| `warp` | `warp` | Warp / Warp | 编程开发 | 面向 Agent 开发流程的 Windows 图形终端与开发环境。 | https://www.warp.dev/download | https://docs.warp.dev/getting-started/quickstart/installation-and-setup | `website:工具官网=https://www.warp.dev/windows-terminal`; `desktop:Warp 客户端下载` | 是 |
| `zed-industries` | `zed` | Zed Industries / Zed | 编程开发 | 支持 AI/ACP Agent 与 WSL 工作流的原生 Windows 编辑器。 | https://zed.dev/download | https://zed.dev/docs/windows | `website:工具官网=https://zed.dev/windows`; `desktop:Zed 客户端下载` | 是 |
| `aaif` | `goose-desktop` | Agentic AI Foundation / goose Desktop | 智能体 | goose 的 Windows 原生图形客户端；CLI 后续作为独立产品录入。 | https://github.com/aaif-goose/goose/releases | https://github.com/aaif-goose/goose | `website:工具官网=https://github.com/aaif-goose/goose`; `desktop:goose Desktop 下载` | 是 |
| `thinkinai` | `deepchat` | ThinkInAI / DeepChat | AI 对话 | 支持多模型、Ollama 与 MCP 的开源 Windows AI 客户端。 | https://github.com/ThinkInAIXYZ/deepchat/releases | https://github.com/ThinkInAIXYZ/deepchat | `website:工具官网=https://deepchat.thinkinai.xyz/`; `desktop:DeepChat 客户端下载` | 是 |
| `fiveire` | `fiveire` | 5ire / 5ire | AI 对话 | 支持 MCP 与本地知识库的跨平台桌面 AI 客户端。 | https://5ire.app/ | https://github.com/nanbingxyz/5ire | `website:工具官网=https://5ire.app/`; `desktop:5ire 客户端下载` | 是 |
| `browseros` | `browseros` | BrowserOS / BrowserOS | 智能体 | 具备本地 Agent、MCP 与自动化能力的开源 Windows AI 浏览器。 | https://browseros.com/ | https://docs.browseros.com/ | `website:工具官网=https://browseros.com/`; `desktop:BrowserOS 客户端下载` | 是 |
| `amd` | `gaia` | AMD / GAIA | 智能体 | 面向 Windows 11 的本地 Agent 图形应用，官方 Release 提供 x64 安装包与 SHA-256。 | https://github.com/amd/gaia/releases | https://github.com/amd/gaia | `website:工具官网=https://github.com/amd/gaia`; `desktop:GAIA 客户端下载` | 是 |
| `genspark` | `genspark-claw` | Genspark / Genspark Claw | 智能体 | 面向本地 Chat、Channels、Skills 与 Memory 的 Windows 原生智能体。 | https://www.genspark.ai/download | https://www.genspark.ai/helpcenter/genspark-claw | `website:工具官网=https://www.genspark.ai/`; `desktop:Genspark Claw 下载` | 是 |
| `genspark` | `genspark-ai-browser` | Genspark / Genspark AI Browser | 智能体 | 带设备端 AI、Autopilot 与 MCP Store 的 Windows AI 浏览器。 | https://www.genspark.ai/browser | https://www.genspark.ai/blog/genspark-ai-browser-and-on-device-free-ai | `website:工具官网=https://www.genspark.ai/browser`; `desktop:Genspark AI Browser 下载` | 否，同厂商补产品 |
| `wispr-flow` | `wispr-flow` | Wispr Flow / Wispr Flow | 音频创作 | 在 Windows 应用中提供语音输入与 AI 文本整理的桌面工具。 | https://dl.wisprflow.ai/windows/latest | https://docs.wisprflow.ai/articles/2772472373-what-is-flow | `website:工具官网=https://wisprflow.ai/`; `desktop:Wispr Flow 客户端下载` | 是 |

以上 ID 是建议稳定键，正式录入前只需做一次与生产目录 ID 的冲突检查；产品身份和 Windows 一手证据已经完成核验。中低置信项不进入这张表，统一保留在第 5 节。

## 2. 已确认可纳入：现有厂商补产品或补 Windows 入口

| 厂商 / 产品 | 新厂商 | Windows 与 AI 一手证据 | 建议产品模块与处理 |
|---|---:|---|---|
| Open WebUI / Open WebUI | 否 | [官方 Desktop 仓库](https://github.com/open-webui/desktop)列出 Windows x64/ARM64 `.exe`，可本地运行或连接服务器；[官方 Quick Start](https://docs.openwebui.com/getting-started/quick-start/)已增加 Desktop 路径。 | 把 Windows 入口并入现有 `Open WebUI` 产品，不新增重复产品；`desktop-official`，标记 Early Alpha。 |
| Nous Research / Hermes Desktop | 否 | [官方 Desktop 文档](https://github.com/nousresearch/hermes-agent/blob/main/apps/desktop/README.md)明确 Windows/macOS/Linux 原生 GUI；[安装文档](https://github.com/nousresearch/hermes-agent/blob/main/website/docs/getting-started/installation.md)推荐 Windows 使用 Desktop installer。 | 新增独立图形产品 `Hermes Desktop`；已有 `Hermes Agent` CLI 保持独立。先 `desktop-official`，标记 Windows Early Beta。 |
| Perplexity / Perplexity | 否 | [官方平台页](https://www.perplexity.ai/platforms)分别提供 Perplexity Windows 与 Comet Windows。 | 只给现有 `Perplexity` 产品补 Windows 按钮；`Comet` 继续是另一产品。 |
| Microsoft / Microsoft 365 Copilot | 否 | [官方产品说明](https://support.microsoft.com/en-us/microsoft-365-copilot/what-is-the-microsoft-365-copilot-app)与[Windows 访问说明](https://support.microsoft.com/en-us/microsoft-365-copilot/access-microsoft-365-copilot-on-windows)明确它是 Windows 应用，且不同于独立 Microsoft Copilot。 | 新增独立产品；`desktop-official`，不要与现有 Microsoft Copilot 合并。 |
| 字节跳动 / 飞书（含飞书 AI） | 否 | [官方下载页](https://www.feishu.cn/download?lang=zh-CN)提供 Windows 客户端；[飞书 AI](https://www.feishu.cn/service/ai?open-from=official_website)说明知识问答、妙记、多维表格等 AI 能力。 | 新增一个产品卡，AI 功能不拆成多个产品；`desktop-official`。 |
| 字节跳动 / 剪映专业版（CapCut 全球入口） | 否 | [CapCut Windows 官方页](https://www.capcut.com/resource/capcut-for-windows)与[桌面 AI 能力](https://www.capcut.com/tools/desktop-ai-power)确认全球 Windows 渠道。 | 优先给现有剪映产品增加全球官网/Windows 入口，不重复统计 CapCut；若未来因地区包身份不同而拆分，需单独 ADR。 |
| 阿里巴巴 / 夸克 AI 浏览器 | 否 | [夸克官网](https://www.quark.cn/)同时给出客户端/网页版和 AI 浏览器、AI 搜索、AI 助手定位。 | 新增产品；官网、Web、Windows 为同一卡片入口；`desktop-official`。 |
| 阿里巴巴 / 钉钉（AI 工作平台） | 否 | [钉钉官方下载](https://www.dingtalk.com/download?isLite=0)提供 Windows，并明确 AI 时代工作方式、AI 听记、AI 表格和 AI 搜问。 | 新增一个产品卡；`desktop-official`。 |
| 腾讯 / QQ 浏览器（AI 浏览器） | 否 | [QQ 浏览器官网](https://browser.qq.com/)提供 Windows 版，并说明元宝助手与智能 Agent。 | 新增产品；`desktop-official`。 |
| 百度 / 如流 | 否 | [如流官网](https://infoflow.baidu.com/newweb/)定位为智能工作平台，官方页面当前仍提供 Windows 安装入口。 | 新增产品；发布前重新验证安装入口仍属于百度官方域。 |
| NVIDIA / NVIDIA Broadcast | 否 | [NVIDIA Broadcast 官方页](https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app/)确认 Windows RTX AI 音视频增强应用。 | 新增产品；`desktop-official`，结构化记录 RTX 硬件门槛。 |
| NVIDIA / NVIDIA Canvas | 否 | [NVIDIA Canvas 官方页](https://www.nvidia.com/en-us/studio/canvas.html)确认 Windows AI 绘画应用。 | 新增产品；`desktop-official`，标记 Beta 与 RTX 门槛。 |

## 3. 已确认可纳入：Agent、开发工具、本地模型与开源客户端

| 厂商 / 产品 | 新厂商 | Windows 与 AI 一手证据 | 建议产品模块与处理 |
|---|---:|---|---|
| Jan / Jan | 是 | [官方仓库](https://github.com/janhq/jan)列出 Windows `jan.exe`，可离线运行本地模型并连接云模型；[Windows 安装文档](https://www.jan.ai/docs/desktop/install/windows)。 | `desktop-official`；初始字母 `J`。 |
| CherryHQ / Cherry Studio | 是 | [官方仓库](https://github.com/CherryHQ/cherry-studio)与[Windows 安装文档](https://docs.cherry-ai.com/cherry-studio-wen-dang/en-us/pre-basic/installation/windows)确认 Windows 多模型桌面客户端。 | `desktop-official`；初始字母 `C`。 |
| Chatbox AI / Chatbox | 是 | [官方仓库](https://github.com/chatboxai/chatbox)确认 Windows 10 x64；[官方下载指南](https://chatboxai.app/en/guide/getting-started/download)提供 Windows。 | Web 与 Windows 合为一个产品；`desktop-official`，初始字母 `C`。 |
| Msty / Msty Studio | 是 | [官方 Studio 页](https://msty.ai/products/studio/)列出 Windows 10/11 x64，支持本地与在线模型、Agent Mode。 | 用当前名称替代旧称 `Msty App`；Web 与 Desktop 合并；`desktop-official`。 |
| Msty / Msty Go | 否（同上） | [官方 Msty Go 页](https://msty.ai/go/)明确 macOS、Windows、Linux 原生自治 Agent，带审批、Skills 和容器隔离。 | 与 Studio 分开，是真正不同产品；`desktop-official`，标记 Beta。 |
| Msty / Msty Nexus | 否（同上） | [官方 Nexus 页](https://msty.ai/products/nexus/)列出 Windows x64 EXE，是本地模型网关和运行时控制中心。 | 与 Studio/Go 分开；`desktop-official`。 |
| LobeHub / LobeHub | 是 | [官方 Release](https://github.com/lobehub/lobehub/releases)列出 Windows `.exe`，当前稳定版包含本地/远程 Agent 和 Desktop 能力。 | Web 与 Desktop 合为一个产品；`desktop-official`，初始字母 `L`。 |
| Pieces / Pieces for Developers | 是 | [官方产品与文档](https://pieces.app/about)提供 Windows；[Windows Suite 安装说明](https://code.pieces.app/support-articles/how-do-i-use-the-windows-pieces-suite-installer)说明 Pieces OS 与桌面应用一同安装。 | `desktop-official`；Pieces OS 是依赖/组件，不另算产品；需要多组件生命周期档案。 |
| Windsurf / Windsurf | 是 | [官方入门文档](https://docs.windsurf.com/zh/windsurf/getting-started)明确 Windows AI IDE 与 Cascade Agent。 | `desktop-official`；初始字母 `W`。 |
| Warp / Warp | 是 | [官方 Windows 发布说明](https://www.warp.dev/blog/launching-warp-on-windows)列出 Windows x64/ARM64 `.exe` 与 winget；[官方 Windows 产品页](https://www.warp.dev/windows-terminal)说明 Agentic Development Environment。 | 这是图形终端/Agent 产品，不作为 CLI 条目；`desktop-official`。 |
| Zed Industries / Zed | 是 | [官方 Windows 页](https://zed.dev/windows)明确原生 Windows、WSL、AI/ACP Agent；[安装文档](https://zed.dev/docs/windows)给出安装器与卸载方式。 | `desktop-official`；初始字母 `Z`。 |
| Raycast / Raycast | 是 | [官方 Windows 页](https://www.raycast.com/windows)与[Windows 更新日志](https://www.raycast.com/changelog/windows)确认 AI Chat、Skills、MCP 的 Windows Beta。 | `desktop-official`，标记 Beta；初始字母 `R`。 |
| Manus / Manus | 是 | [官方 Desktop 页](https://manus.im/desktop)与[官方功能文档](https://manus.im/docs/features/desktop)明确 Windows、文件访问、命令执行和工作流自动化。 | 先按 `Manus` 独立厂商品牌录入，不因收购新闻直接并入 Meta；Web 与 Windows 合并；高权限产品只装官方客户端。 |
| Quora / Poe | 是 | [Poe 官方下载页](https://poe.com/download)明确列出 Windows 下载并指向 Poe CDN；页面版权主体为 Quora Inc. | Web 与 Windows 合为一个 `Poe` 产品；`desktop-official`，初始字母 `Q`。 |
| Pinokio / Pinokio | 是 | [官方仓库](https://github.com/pinokiocomputer/pinokio)与[官方 Release](https://github.com/pinokiocomputer/pinokio/releases)确认跨平台 AI Browser。 | `desktop-official`；AI Hub 只提供官方客户端入口，绝不继承其第三方脚本信任。 |
| Lykos AI / Stability Matrix | 是 | [官方仓库](https://github.com/LykosAI/StabilityMatrix)与[官方 Release](https://github.com/LykosAI/StabilityMatrix/releases)提供 Windows 便携包并管理多种生成式 AI 包。 | `desktop-official`；标记 portable/package-manager；下游包不自动进入白名单。 |
| Intel / AI Playground | 是 | [Intel 官方说明](https://game.intel.com/stories/introducing-ai-playground/)明确封装 Windows 桌面安装器与本地生成式 AI。 | `desktop-official`；标记 Beta 与 Intel 硬件支持矩阵。 |
| AMD / GAIA | 是 | [AMD 官方 GAIA 仓库](https://github.com/amd/gaia)支持 Windows 11 Agent UI；[官方 Release](https://github.com/amd/gaia/releases)提供 Windows x64 setup 并公布 SHA-256。 | `desktop-official`；多组件/硬件产品，受管安装前需完整档案。 |
| Agentic AI Foundation / goose | 是 | [官方仓库](https://github.com/aaif-goose/goose)明确 Windows/macOS/Linux 原生 Desktop、CLI、API。 | 新增 `goose Desktop`；CLI 后续单列。厂商归 AAIF，不再归 Block；`desktop-official`。 |
| ThinkInAI / DeepChat | 是 | [官方仓库](https://github.com/ThinkInAIXYZ/deepchat)明确 Windows `.exe`、Ollama 管理、ACP Agent 与 MCP。 | `desktop-official`；初始字母 `D`。 |
| 5ire / 5ire | 是 | [官网](https://5ire.app/)明确 Windows 下载；[官方仓库](https://github.com/nanbingxyz/5ire)说明跨平台桌面 AI/MCP 客户端和本地知识库。 | `desktop-official`；Node/Python/uv 仅在用户启用 MCP 工具时作为依赖，不把 MCP 市场内容自动白名单化。 |
| BrowserOS / BrowserOS | 是 | [官网](https://browseros.com/)与[官方文档](https://docs.browseros.com/)明确开源 Windows AI-native 浏览器、本地 Agent、MCP 和自动化。 | `desktop-official`；高权限浏览器只安装客户端；初始字母 `B`。 |
| Genspark / Genspark Claw | 是 | [官方下载页](https://www.genspark.ai/download)列出 Windows 原生 Claw；[官方帮助](https://www.genspark.ai/helpcenter/genspark-claw)说明本地 Chat、Channels、Skills、Memory。 | 与 Genspark AI Browser 分开，是真正不同产品；`desktop-official`。 |
| Genspark / Genspark AI Browser | 否（同上） | [官方浏览器页](https://www.genspark.ai/browser)明确 Windows、设备端 AI、Autopilot 与 MCP Store。 | 独立产品；`desktop-official`。 |
| Block / Buzz | 是 | [官方支持页](https://block.github.io/buzz/support.html)明确 Buzz 是 Windows/macOS/Linux 的开源桌面应用，用户与 AI Agent 在社区和频道协作。 | `desktop-official`；产品涉及外部 relay，目录描述应明确数据边界。 |
| LostRuins / KoboldCpp | 是 | [官方仓库](https://github.com/LostRuins/koboldcpp/)与[官方 Release](https://github.com/LostRuins/koboldcpp/releases)提供自包含 Windows 可执行文件，未带参数启动时显示 GUI。 | `desktop-official`，标记 portable；不伪装为传统安装器。 |

## 4. 已确认可纳入：生产力、创作、会议与中国 Windows 产品

这些产品不一定是“纯 AI 公司”，但其 Windows 客户端中的 AI 是明确的核心工作流。目录可通过分类、描述和标签区分“AI-first”与“AI-enabled”，不应因传统厂商品牌而漏录。

| 厂商 / 产品 | 新厂商 | Windows 与 AI 一手证据 | 建议产品模块与处理 |
|---|---:|---|---|
| DeepL / DeepL | 是 | [Windows 产品页](https://www.deepl.com/en/windows-app)与[官方入门文档](https://support.deepl.com/hc/en-us/articles/18606772245916-Get-started-with-DeepL-desktop-apps)确认 Windows 翻译与 Write。 | Web/Windows 同一卡；`desktop-official`。 |
| Grammarly / Grammarly | 是 | [Grammarly for Windows](https://www.grammarly.com/desktop/windows)确认全局写作与生成式 AI 客户端。 | Web/Windows 同一卡；`desktop-official`。 |
| Notion / Notion | 是 | [桌面文档](https://www.notion.com/en-gb/help/notion-for-desktop)与[Windows Store 公告](https://www.notion.com/blog/notion-available-in-microsoft-store-on-windows)确认 x64/Arm Windows 和桌面 AI 能力。 | Web/Windows 同一卡；`desktop-official`。 |
| Descript / Descript | 是 | [官方安装文档](https://help.descript.com/hc/en-us/articles/10503599253773-Download-and-install-Descript)与[Windows 下载页](https://www.descript.com/download/windows)确认 AI 音视频编辑器。 | `desktop-official`。 |
| Read AI / Read Desktop | 是 | [官方 Windows/Mac 文档](https://support.read.ai/hc/en-us/articles/45911611006995-How-to-Use-Read-s-Desktop-App-for-Windows-and-Mac)说明转录、摘要、行动项和 Ask Read。 | `desktop-official`。 |
| Canva / Canva | 是 | [Windows 下载页](https://www.canva.com/en_in/download/windows/)与[Magic Studio 官方说明](https://www.canva.com/en_in/newsroom/news/magic-studio/)确认 Windows 与 AI 创作。 | Web/Windows 同一卡；`desktop-official`。 |
| Wondershare / Filmora | 是 | [官方下载页](https://filmora.wondershare.com/video-editor/video-editor-download.html)确认 Windows AI 视频编辑器。 | `desktop-official`；同厂商其他产品见下方。 |
| Wondershare / EdrawMax（万兴图示） | 否（同上） | [万兴统一下载中心](https://edraw.wondershare.cn/download/)确认 Windows 和 AI 一键绘图。 | 独立产品；`desktop-official`。 |
| Wondershare / EdrawMind（万兴脑图） | 否（同上） | [万兴统一下载中心](https://edraw.wondershare.cn/download/)确认 Windows 和 AI 思维导图。 | 独立产品；`desktop-official`。 |
| Wondershare / PDFelement（万兴 PDF） | 否（同上） | [官方产品页](https://pdf.wondershare.cn/)确认 Windows 与 AI 对话、总结、翻译和校对。 | 独立产品；`desktop-official`。 |
| Skylum / Luminar Neo | 是 | [官方下载页](https://skylum.com/luminar-download)与[安装文档](https://support.skylum.com/getting-started/downloading-and-installing)确认 Windows AI 照片编辑器。 | `desktop-official`。 |
| Topaz Labs / Topaz Photo | 是 | [官方下载中心](https://www.topazlabs.com/downloads)与[系统要求](https://docs.topazlabs.com/topaz-photo/system-requirements)确认 Windows 桌面产品和本地生成模型。 | 独立产品；`desktop-official`。旧名 `Photo AI` 不再新建。 |
| Topaz Labs / Topaz Video | 否（同上） | [官方 Quick Start](https://docs.topazlabs.com/topaz-video/quick-start)确认 Windows 桌面应用。 | 独立产品；`desktop-official`。旧名 `Video AI` 不再新建。 |
| Topaz Labs / Topaz Gigapixel | 否（同上） | [官方系统要求](https://docs.topazlabs.com/topaz-gigapixel/system-requirements)确认 Windows AI 放大产品。 | 独立产品；`desktop-official`。 |
| Moises / Moises Desktop | 是 | [官方产品页](https://moises.ai/products/moises-desktop-app/)确认 Windows AI 分轨、母带与音乐工作流。 | `desktop-official`。 |
| Moises / Moises Live | 否（同上） | [官方 Moises Live](https://moises.ai/products/live/)确认 Windows/macOS AI Smart Volume。 | 与 Moises Desktop 分开，是真正不同产品。 |
| Voicemod / Voicemod | 是 | [官网](https://www.voicemod.net/)确认 Windows 10/11 实时 AI 变声。 | `desktop-official`。 |
| LALAL.AI / LALAL.AI Desktop | 是 | [官方 Desktop 页](https://www.lalal.ai/desktop-app/)确认 Windows 10/11 AI 分轨与降噪。 | `desktop-official`。 |
| Otter.ai / Otter Desktop | 是 | [官方 Desktop 文档](https://help.otter.ai/hc/en-us/articles/35973988280215-Otter-Desktop-App-Mac-Windows)确认 Windows 10+、AI Chat、摘要与本地录制。 | Web/Windows 同一卡；`desktop-official`。 |
| Fireflies.ai / Fireflies Desktop | 是 | [官方 Desktop 页](https://fireflies.ai/desktop)与[入门文档](https://guide.fireflies.ai/articles/1208704416-getting-started-with-the-fireflies-desktop-app)确认 Windows、转录、摘要、AskFred 与 AI Skills。 | Web/Windows 同一卡；`desktop-official`。 |
| Fathom / Fathom | 是 | [官方 Windows 文档](https://help.fathom.video/en/articles/449088)与[Windows 下载入口](https://fathom.video/download/win)确认托盘应用。 | Web/Windows 同一卡；`desktop-official`，说明 bot-free 新体验仍偏 Mac-first。 |
| Granola / Granola | 是 | [官方托管安装文档](https://docs.granola.ai/help-center/getting-started/managed-installations)与[网络文档](https://docs.granola.ai/help-center/troubleshooting/network-troubleshooting)明确 Windows。 | Web/Windows 同一卡；`desktop-official`。 |
| Krisp / Krisp | 是 | [官方安装文档](https://help.krisp.ai/hc/en-us/articles/4420088642460-Install-Krisp-AI-Meeting-Assistant)明确 Windows AI Meeting Assistant。 | `desktop-official`；登录下载流不应被误写成稳定直链。 |
| Wispr Flow / Wispr Flow | 是 | [官方产品文档](https://docs.wisprflow.ai/articles/2772472373-what-is-flow)明确 Windows 10+；[官方下载入口](https://dl.wisprflow.ai/windows/latest)。 | `desktop-official`；初始字母 `W`。 |
| 360 / 360 AI 浏览器 | 是 | [360 AI 浏览器官网](https://browser.360.cn/?from=xp)提供 Windows 与 AI 搜索、助手、创作。 | `desktop-official`；厂商 `initial=Q`（Qihoo）。 |
| 360 / 纳米 AI PC | 否（同上） | [360 官方发布页](https://weishi.360.cn/n/12653.html)与[纳米 AI 官网](https://www.n.cn/)确认 PC 客户端。 | 独立产品；`desktop-official`。 |
| 360 / 360 AI 办公 | 否（同上） | [官方产品页](https://bangong.360.cn/)提供桌面下载与 AI 办公能力。 | 独立产品；`desktop-official`。 |
| 360 / 360 安全龙虾 | 否（同上） | [官方产品页](https://claw.360.cn/)确认 Windows 桌面 Agent。 | 独立产品；`desktop-official`。 |
| 360 / 360 智能体卫士 | 否（同上） | [官方产品页](https://agentsafe.360.cn/)提供 Win10+ 客户端。 | 作为可选安全周边独立产品；`desktop-official`。 |
| 科大讯飞 / 讯飞星火 | 是 | [官方下载页](https://xinghuo.xfyun.cn/app/download)明确 SparkDesk Windows 桌面版。 | Web/Windows 同一卡；`desktop-official`，`initial=I`。 |
| 科大讯飞 / 讯飞听见 | 否（同上） | [官方 Windows AI 语音助手](https://www.iflyrec.com/html/iflyrecAssistant.html)。 | 独立产品；`desktop-official`。 |
| 科大讯飞 / 讯飞同传 | 否（同上） | [官方下载页](https://tongchuan.iflyrec.com/download.html)确认 Windows 10 x64。 | 独立产品；`desktop-official`。 |
| 网易有道 / 有道龙虾（LobsterAI） | 是 | [官网](https://lobsterai.youdao.com/)与[官方 Skill/Agent 帮助](https://note.youdao.com/help-center/skill-install-guide-agent.html)确认 Windows/macOS/Linux 全场景个人 Agent。 | `desktop-official`；初始字母 `N`。 |
| 网易有道 / 有道翻译 | 否（同上） | [官网](https://fanyi.youdao.com/)与[官方下载](https://fanyi.youdao.com/download/)确认 Windows、AI 助手、AI 写作/PPT。 | Web/Windows 同一卡；`desktop-official`。 |
| 网易有道 / 有道云笔记 | 否（同上） | [官方下载页](https://note.youdao.com/note-download)确认 Web/Windows 与 AI 工具。 | Web/Windows 同一卡；`desktop-official`。 |
| 来也科技 / Laiye Worker | 是 | [官方产品页](https://laiye.com/product/worker)明确 Windows 10+ 桌面端 AI 员工，可访问本地文件、内网与跨系统执行。 | `desktop-official`；高权限产品仅安装官方客户端，`initial=L`。 |
| Skywork / Skywork Desktop | 是 | [官方 Desktop 页](https://skywork.ai/desktop/zh/index.html)明确 Windows 10+ 本地 AI Agent，可交付文档、PPT、表格、网站和代码。 | `desktop-official`；`initial=S`。 |
| Genspark / Speakly | 否（同上） | [官方帮助](https://www.genspark.ai/helpcenter/speakly)明确 Windows 全局 AI 语音输入和 Agent Mode。 | 与 Genspark Claw/Browser 分开，是真正不同产品。 |
| Monica / Monica Desktop | 是 | [官方下载页](https://monica.im/download)确认 Windows/macOS 跨应用侧边栏、截图分析、翻译与总结。 | Web/Windows 同一卡；`desktop-official`，`initial=M`。 |
| 金山办公 / WPS Office（含 WPS AI） | 是 | [WPS AI 开放平台](https://platform.wps.cn/)与[官方说明](https://plus.wps.cn/blog/p109287.html)确认 AI 写文档、PPT、数据和阅读能力在客户端内。 | 只建 WPS Office 产品，AI 不拆成伪安装包；`desktop-official`，`initial=K`。 |
| Xmind / Xmind（含 Xmind AI） | 是 | [官方下载页](https://xmind.cn/download)明确 Windows x64/ARM64 和 Web/桌面 AI 协作。 | Web/Windows 同一卡；`desktop-official`，`initial=X`。 |
| 美图 / 美图秀秀（电脑端） | 是 | [官方 PC 页](https://pc.meitu.com/pc)定位为 AI 修图改字工具并提供 Windows。 | `desktop-official`，`initial=M`。 |
| 美图 / 美图云修 | 否（同上） | [官方云修下载页](https://ultra.meitu.com/download)提供 Windows AI 专业修图客户端。 | 与美图秀秀分开，是真正不同产品。 |
| 影刀 / 影刀 RPA 6 | 是 | [官方下载页](https://www.yingdao.com/xbot-go-download/)提供 Windows；[官方 AI 流程说明](https://www.yingdao.com/encyclopedia/detail?uuid=951354527115943936)说明可用对话生成自动化流程。 | `desktop-official`；定位为自动化/Agent 工具，`initial=Y`。 |

## 5. 仅候选，待复核后再纳入

| 厂商 / 产品 | 当前证据 | 暂缓原因与下一步 |
|---|---|---|
| Skales / Skales | [官网](https://skales.app/)明确 Windows EXE、Agent、Ollama、本地数据和 SHA-512。 | 官网同时明确 Windows 包尚未代码签名。可先保留候选；若目录允许只打开官网，可作为 `desktop-official`，但不得进入受管下载白名单。 |
| ChatGPTNextWeb / NextChat | [官方仓库](https://github.com/ChatGPTNextWeb/NextChat)写明 Windows Tauri 客户端。 | 当前可见稳定 Release 较旧，需复核最新 Windows 资产、维护状态和官方发行主体后再录入。 |
| AI-Shifu / ChatALL | [官方组织](https://github.com/ai-shifu)仍维护 ChatALL 仓库。 | 需补当前 Windows Release、下载入口和生命周期证据，不能只依据源代码可构建。 |
| PearAI / PearAI | [官方仓库](https://github.com/trypear/pearai-app)说明开源 AI 编辑器。 | 当前可见最新 Release 标题为 Linux 且停留在 2025；需确认 Windows 正式资产和项目仍在维护。 |

## 6. 明确无当前 Windows 客户端、已停止维护或不纳入

| 产品 | 结论 | 一手依据 |
|---|---|---|
| NVIDIA ChatRTX | 不纳入；旧下载页仍在线，但产品已停止维护。 | NVIDIA 官方论坛公告说明自 2026-01-21 起 [ChatRTX 已 deprecated](https://forums.developer.nvidia.com/t/chatrtx-has-been-deprecated-this-forum-is-locked/365743)。旧产品页不能覆盖更新的停止维护公告。 |
| Backyard AI Desktop | 不纳入；桌面产品已 deprecated / no longer supported。 | [官方 Desktop 页](https://desktop.backyard.ai/)与[官方 Changelog](https://backyard.ai/changelog)。 |
| Void | 不纳入当前主目录；Windows Beta 仍可下载，但官方已暂停 IDE 工作。 | [官方仓库](https://github.com/voideditor/void)明确 paused work，未来可能不恢复维护。 |
| OpenHands | 不纳入 Windows 图形产品；Windows 需要 WSL，原生 Windows 不受官方支持。 | [官方 CLI Quick Start](https://docs.openhands.dev/openhands/usage/cli/quick-start)与[官方 Quickstart](https://docs.openhands.dev/overview/quickstart)。 |
| Fellou | 不纳入；当前官方下载页只有 macOS，Windows 仍没有可核验的正式入口。 | [官方下载页](https://fellou.ai/download)与[官方旧发布文](https://fellou.ai/blog/fellou-v2-launch/)。 |
| DeepSeek 图形客户端 | 不纳入；未发现深度求索官方 Windows 图形客户端。 | 保留现有 Web、API、模型，不使用第三方套壳。 |
| 文小言 Windows 客户端 | 不纳入；未发现百度官方 Windows 安装入口。 | 保留现有 Web；不把百度内容平台用户上传链接当官方包。 |
| Mistral Le Chat / Vibe | 不新增 Windows 客户端。 | [官方帮助](https://help.mistral.ai/en/articles/682992-le-chat-is-now-vibe)当前只证实 Web/mobile。 |
| xAI Grok | 不新增 Windows 客户端。 | [xAI FAQ](https://docs.x.ai/grok/faq)与[X 帮助](https://help.x.com/en/using-x/about-grok)未给出 Windows 原生包。 |
| Microsoft Designer | 不新增 Windows 客户端。 | [Microsoft 官方说明](https://support.microsoft.com/en-US/designer/welcome-to-microsoft-designer)为 Web 与移动端。 |
| Devin | 不建立 Windows 客户端产品。 | [官方 Release Notes](https://docs.devin.ai/release-notes/overview)提供的是可安装 PWA，不是原生 Windows 分发。 |
| Cline、Roo Code、Continue | 不作为 Windows 桌面产品。 | 它们是编辑器插件/扩展；可留在对应宿主产品的子目录或教程中。 |
| Open Interpreter | 本轮不纳入 Windows 桌面产品。 | 未找到当前一手来源下可稳定认证的 Windows 原生图形安装器；CLI 留待后续轮次。 |

特别说明：Poe 先前被误判为“只有 Web/iOS/Android”。当前 [Poe 官方下载页](https://poe.com/download)已明确列出 Windows，因此本报告按当前一手证据纳入，而不是沿用旧判断。

## 7. 与现有目录的去重和迁移规则

| 情况 | 应做什么 | 不应做什么 |
|---|---|---|
| Perplexity 已有 Web 产品 | 给现有产品加 Windows `entryPoint`。 | 再建一个 `Perplexity Desktop` 重复产品。 |
| Open WebUI 已有教程型产品 | 把官网、教程和 Windows Desktop 入口并入同一产品并调整主模块。 | 同时保留一个“Open WebUI 教程”和一个“Open WebUI Desktop”重复计数。 |
| 剪映与 CapCut | 优先视为同一概念产品的中国/全球渠道按钮。 | 因 URL 不同直接算两个产品。 |
| Hermes CLI 与 Hermes Desktop | 保留两个产品：CLI 是命令行，Desktop 是可视界面。 | 把 CLI 按钮塞进 Desktop 卡片导致用户误解。 |
| Msty | `Msty Studio` 的 Web/Desktop 合并；`Msty Go`、`Msty Nexus`各自独立。 | 继续使用已经过时且含糊的 `Msty App` 名称。 |
| Pieces | Pieces for Developers 是产品，Pieces OS 是其必需组件/依赖。 | 把 Pieces OS 计为第二个面向用户的产品。 |
| Topaz | 使用当前 `Topaz Photo`、`Topaz Video`、`Topaz Gigapixel` 三个独立产品。 | 新建已停止的旧名 `Photo AI`、`Video AI`。 |
| Moises | `Moises Desktop` 与 `Moises Live` 是不同产品。 | 因同厂商而强行合并。 |
| Genspark | Claw、AI Browser、Speakly 是三种不同用户工作流。 | 把三个可执行产品压成一个难以理解的卡片。 |
| Web + Windows | 同一产品卡按存在情况显示“官网 / 打开网页版 / Windows 下载”。 | 为每个入口增加产品计数。 |

## 8. 后台模块、元数据与安全门槛

### 8.1 默认模块

所有本轮新确认的图形产品默认使用：

```text
productType = desktop-official
moduleId    = desktop-official
downloadOwnership = vendor
automaticInstall = false
automaticUninstall = false
probeOnBrowse = false
```

后台可以调整厂商、产品、描述、排序、入口和经过 schema 允许的参数，但不能下发命令。后续若某个产品要升级为受管安装，必须逐产品补齐：

1. 官方下载页和允许的重定向域；
2. x64/ARM64 与系统版本；
3. 当前文件签名链或厂商公开的校验值；
4. 安装收据与多信号检测；
5. 启动方式和厂商更新器所有权；
6. 厂商卸载入口；
7. 用户数据、模型和工作区的保留规则；
8. Beta、硬件、登录下载、便携包、多组件和第三方脚本市场等风险标签。

### 8.2 跨境网络字段

厂商级字段建议为：

```ts
requiresCrossBorderNetwork?: boolean
```

- 缺省/`false` 表示不显示提示，规范化时可省略 `false`。
- 不存后台自由文案；固定文案由语言模块提供：中文 `中国用户需要科学上网`，英文可用 `May require cross-border network access in mainland China`。
- 展示名可渲染为 `${vendor.name}（${t('vendor.crossBorderNetworkRequired')}）`，但搜索、去重和排序必须继续使用原始 `vendor.name`。
- 旧严格客户端会拒绝未知字段。生产发布顺序必须先发布支持该字段的客户端，再发布含字段的目录；或以 schema/最低客户端版本建立兼容门槛。
- 中国大陆原生服务不要默认标记。Manus、Genspark、Monica、Skywork 等全球入口也必须有独立可重复的网络证据后才标记。

### 8.3 A-Z 初始字母

每个厂商必须保存显式、合法的 `initial`，筛选不得用中文名称首字符临时推导。建议示例：

- 360 → `Q`（Qihoo）
- 科大讯飞 → `I`（iFlytek）
- 金山办公 → `K`（Kingsoft）
- 网易有道 → `N`
- 万兴科技 → `W`
- 美图 → `M`
- 来也科技 → `L`
- 影刀 → `Y`
- Skywork → `S`
- Manus → `M`
- Genspark → `G`
- CherryHQ / Chatbox AI → `C`
- Monica → `M`
- Xmind → `X`

`initial` 只允许 `A-Z`。中文、数字或符号开头的厂商也必须能归入 A-Z；筛选、搜索和厂商数量不能因显示名首字符不是英文而丢失。

## 9. 发布前自动校验与测试建议

1. `shared/catalog.cjs` 作为唯一 schema 边界：允许 `requiresCrossBorderNetwork`，并强制其只能为 boolean；未知类型拒绝。
2. 厂商完整性：不允许重复 `vendor.id`、重复规范化名称；所有启用厂商都必须有合法 `initial` 且能被“全部”和对应 A-Z 筛选命中。
3. 中文/数字回归：360、科大讯飞、金山、网易有道等测试夹具不得因中文或数字首字符从列表消失。
4. 入口去重：同一产品 Web/Windows 不增加产品数量；CLI 与图形客户端必须仍可独立计数和展示。
5. 文案一致性：VPN 后缀在厂商卡、详情、搜索结果、精选厂商等所有可见位置一致；搜索原名仍能命中。
6. 后台持久化：新增/编辑/发布/历史版本/回滚均需保留 `initial`、跨境网络字段和 `entryPoints`。
7. 旧客户端兼容：在含新字段目录发布前增加最低客户端版本或兼容测试，防止旧严格 schema 客户端整份拒绝目录。
8. 目录来源：每个 Windows 入口必须是 HTTPS 一手来源；不得把搜索结果 URL、第三方镜像、用户上传链接或项目 README 中未证实的构建说明当正式安装包。
9. 状态标签：Beta、Early Alpha、portable、硬件限制、登录下载、多组件、包管理器/脚本市场必须结构化校验，不能只藏在描述文案。
10. 每次发布生成去重报告：列出“新增厂商、现有厂商补产品、现有产品补入口、被排除/弃用产品”，避免后台一次更新把完整目录退回到局部种子数据。

## 10. 建议录入顺序

1. 先修目录基础能力：显式 `initial`、中文/数字 A-Z 筛选、跨境网络字段、旧客户端兼容和发布回归。
2. 现有厂商无争议增量：Open WebUI Windows、Hermes Desktop、Perplexity Windows、Microsoft 365 Copilot、飞书、夸克、钉钉、QQ 浏览器、如流、NVIDIA Broadcast/Canvas。
3. Agent / 开发 / 本地模型核心：Jan、Cherry Studio、Chatbox、Msty 三产品、LobeHub、Pieces、Windsurf、Warp、Zed、Raycast、Manus、Poe、goose、DeepChat、5ire、BrowserOS、Genspark、AMD GAIA、Intel AI Playground。
4. 再录生产力、创作、会议和中国 AI-enabled 客户端，并按真实产品边界去重。
5. 最后处理候选：Skales、NextChat、ChatALL、PearAI；未补齐当前 Windows 分发与维护证据前不进入正式目录。

这套顺序可以先让用户看到可靠、可解释的增量，同时避免把“找到一个 Windows 下载按钮”误当成“已经批准 AI Hub 自动安装”。
