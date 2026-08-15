# MiniMax 与主流 AI 桌面版缺口审计（2026-08-15）

## 结论

用户指出的问题成立：当前目录把 `minimax-agent` 仍建模为纯 Web 产品，但 MiniMax 已在一方站点提供 Windows 和 macOS 桌面下载。进一步对当前本地目录做一轮有边界的复核后，本批 12 个对象的处置为：

| 处置 | 数量 | 含义 |
| --- | ---: | --- |
| **ready** | **4** | 一方原生桌面证据、稳定下载落地页和目录关系已经足以进入“官方入口”目录评审；不等于一键托管安装获批 |
| **deferred** | **1** | 一方桌面证据存在，但公开下载合同或产品身份边界还不足以写入目录 |
| **blocked** | **7** | 本轮不能新增独立桌面身份：属于 PWA/网页/移动端/CLI，或已经由同厂商现有桌面产品承载 |

**最先应修的是 MiniMax 和 Notion。** MiniMax 应在现有 `minimax-agent` 身份上增加桌面入口并处理当前“MiniMax Agent / MiniMax Code”命名迁移；Notion 的本地记录甚至带有 `officialDownload.kind = "no-windows"`，与 Notion 当前一方 Windows 下载文档直接冲突。

本报告只批准“进入目录内容评审”。没有下载或运行任何安装器，没有核验签名、哈希、注册表收据、更新器或卸载残留，也不批准 `desktop-managed`、镜像托管或静默安装。

## 审计基线与方法

- 本地基线：`admin/data/catalog-v1.json`，`updatedAt = 2026-08-08T18:27:54.775Z`。
- 基线 SHA-256：`75ff95ce9d579965e04fc44725787b72e9ed133ce9ed684747af04a0dd3d1d36`。
- 基线规模：375 个厂商、615 个产品、459 个启用的 `ai-tool` 产品；其中 199 个 `productType` 以 `desktop` 开头，157 个仍为 `web`。
- 本批不是无边界全网爬取。先从现有 157 个 Web AI 产品中选取用户明确指出的 MiniMax、已有桌面语义但字段冲突的产品，以及高使用量的 Agent/对话/开发产品；只在一方证据明确区分产品身份时，再沿厂商关系跟进相邻桌面产品（本批为 FlowithOS、AgentMore）。随后用一方官网、帮助中心、官方文档、官方条款或一方产品卡核验。
- “原生桌面”在本报告中指厂商提供可下载、非浏览器安装的 Windows/macOS 应用。Chrome/Edge 的“安装此网站”、PWA、浏览器扩展、仅网页快捷方式、CLI 和云端 Desktop Mode 都不算原生桌面版。
- 稳定目录入口优先记录厂商的下载落地页，不固化滚动二进制 URL。未经产物身份审计，不把动态 `.exe`、`.msix`、`.dmg` 地址升为客户端托管下载合同。

## Ready：可进入官方桌面入口评审（4）

### 1. MiniMax：更新现有 `minimax-agent`，不要再造重复产品

| 项目 | 核验结果 |
| --- | --- |
| 当前本地身份 | 厂商 `minimax`，产品 `minimax-agent`，当前为 `web`；另有独立 `minimax-cli`，不能混并 |
| 当前一方产品名 | 主站仍显示 MiniMax Agent / New MiniMax Desktop；下载页和 Token Plan 已使用 **MiniMax Code**，并称其为官方 Agent。因此建议稳定 ID 不变，显示名改为 `MiniMax Code（原 MiniMax Agent）`，同时保留两个搜索别名 |
| 原生性与平台 | 一方下载页同时列出 macOS、Windows；隐私政策明确区分可下载的 desktop application 与浏览器交互，不能按 PWA 处理 |
| 稳定下载入口 | [https://agent.minimax.io/download](https://agent.minimax.io/download)（本轮 HEAD 200，未请求安装包） |
| 一方证据 | [MiniMax 下载页](https://agent.minimax.io/download)、[MiniMax Agent 首页](https://agent.minimax.io/)、[MiniMax Token Plan](https://platform.minimax.io/subscribe/coding-plan)、[服务条款](https://agent.minimax.io/doc/en/terms-of-service.html)、[隐私政策](https://agent.minimax.io/doc/en/privacy-policy.html) |
| 条款、账户与权限边界 | 专有服务，需要用户登录；功能和用量受免费/付费计划或额度约束。条款只授予用户下载并使用一份应用副本的有限权利。桌面 Agent 可接触用户授权的本地数据、浏览器会话、Cookie、网络连接和第三方账户内容，并可执行浏览器操作；目录必须在打开下载页前显式提示这些高权限面 |
| 目录动作 | 在 `minimax-agent` 上增加 Windows/macOS desktop entry point；保留 Web entry point；**只打开官方落地页**。在完成安装包签名、版本、收据、更新和卸载审计前，不配置 `download`、`installProfileId` 或托管安装能力 |

### 2. Notion：修正现有 `notion-desktop` 的错误平台结论

| 项目 | 核验结果 |
| --- | --- |
| 当前本地身份 | `notion-desktop`，名称 Notion，但仍是 `productType=web`，且 `officialDownload.kind="no-windows"` |
| 原生性与平台 | Notion 一方帮助中心明确提供 macOS 和 Windows 可下载桌面应用；Windows 另有 x64 与 Arm/Arm64 MSIX，macOS 有 Universal、Apple Silicon 与 Intel 构建。Notion 也明确称桌面端具有浏览器没有的本地体验和 AI 能力 |
| 稳定下载入口 | [https://www.notion.com/desktop](https://www.notion.com/desktop)（本轮 HEAD 200） |
| 一方证据 | [Notion 桌面帮助](https://www.notion.com/help/notion-for-desktop)、[Notion 桌面下载](https://www.notion.com/desktop)、[Windows Store 公告](https://www.notion.com/blog/notion-available-in-microsoft-store-on-windows)、[Notion 条款](https://www.notion.com/terms) |
| 条款、账户与更新边界 | 专有云服务，打开应用后需要用邮箱或受支持的身份提供方登录；桌面应用默认自动更新。AI、会议记录、SSO 等能力受套餐、组织配置和权限影响，不能把“安装成功”写成“全部 AI 功能可用” |
| 目录动作 | 复用 `notion-desktop`，删除错误的 `no-windows` 结论并增加 Windows/macOS desktop entry point。先采用官方落地页；MSIX x64/Arm64 只能作为后续产物审计输入，不在本批直接升为托管安装 |

### 3. Replit：为现有 `replit-agent` 补同一 Replit 产品的桌面入口

| 项目 | 核验结果 |
| --- | --- |
| 当前本地身份 | `replit-agent`，当前只描述浏览器 Agent |
| 原生性与平台 | 当前一方下载页仍提供 Mac、Windows、Linux。Replit 的一方发布说明明确桌面应用使用 Electron，提供 `.dmg`、`.exe`、`.deb`，不是 PWA；应用需要网络并使用 Replit Workspace |
| 稳定下载入口 | [https://replit.com/desktop](https://replit.com/desktop)（本轮 HEAD 200） |
| 一方证据 | [Replit Desktop](https://replit.com/desktop)、[一方桌面应用公告](https://replit.com/blog/desktop-app)、[Replit Agent 4](https://replit.com/blog/introducing-agent-4-built-for-creativity)、[服务条款](https://replit.com/terms-of-service)、[隐私政策](https://replit.com/privacy-policy) |
| 条款、账户与数据边界 | 专有托管服务；启动后需登录，且桌面客户端依赖互联网。账户、项目代码、发布内容和连接的第三方服务受 Replit 条款及可见性设置约束；客户端不能把云端项目或 Agent 执行描述为本机离线工作 |
| 目录动作 | 不新增 `replit-desktop` 重复卡。建议把现有显示层从狭义 `Replit Agent` 扩为 `Replit`，在描述/能力中保留 Agent，并添加同产品桌面入口。若产品负责人坚持 Agent 是独立产品，须先建立 `Replit` 父产品关系，不能把通用 Replit 安装包冒充 Agent 专用安装包 |

### 4. FlowithOS：新增独立产品，不挂到 `flowith-agent-neo` 上

| 项目 | 核验结果 |
| --- | --- |
| 当前本地身份 | 当前只有 `flowith-agent-neo`（Agent Neo，Web） |
| 当前一方产品关系 | Flowith 文档明确把 Neo 定义为数据层生成 Agent，把 **FlowithOS** 定义为在电脑上运行、管理本地文件系统并执行编码、浏览器和桌面 UI 操作的执行引擎；二者是协作产品，不是同一个入口 |
| 原生性与平台 | 一方首页提供 FlowithOS for Mac / Windows；官方安装说明分别描述 macOS 应用包与 Windows 安装器，属于可安装桌面产品而非网页快捷方式 |
| 稳定下载入口 | [https://flowith.io/home/](https://flowith.io/home/)（本轮 HEAD 200） |
| 一方证据 | [Flowith 首页/下载入口](https://flowith.io/home/)、[FlowithOS 与 Neo 的一方说明](https://flowith.io/docs/tr/flowithos/about/)、[FlowithOS 下载与注册](https://doc.flowith.io/cn/oracle-mode-zhi-neng-ti-mo-shi/flowithos-zhi-neng-ti-cao-zuo-xi-tong/xia-zai-zhu-ce)、[Agent Neo 说明](https://flowith.io/docs/en/agent-neo/about/)、[服务条款](https://flowith.io/compliance/terms-of-service/)、[隐私政策](https://flowith.io/compliance/privacy-policy/) |
| 条款、账户与权限边界 | 专有服务，需要 Flowith 账户；一方旧版注册文档还记载邀请码激活，因此可用性需在录入当日复核。FlowithOS 可访问本地项目、终端、浏览器登录站点和桌面应用，权限显著高于 Agent Neo Web；条款禁止未授权逆向与分发 |
| 目录动作 | 新建 `flowith-os` 候选产品并与 `flowith-agent-neo` 建同厂商关系，不能改写 Neo 身份。只提供官方落地页并显示本地文件、终端、浏览器会话、系统操作和账户/邀请码提示；托管安装继续阻断 |

## Deferred：有桌面证据但本轮不能落目录（1）

| 当前对象 | 一方发现 | 暂缓原因 | 再评审门槛 |
| --- | --- | --- | --- |
| `zhipu-agentmore` 候选（由 `zhipu-qingyan-web` 关系审计发现） | [AgentMore 官方站](https://agentmore.chatglm.cn/)在一方界面中显示“桌面应用”和“下载最新 Windows 应用” | AgentMore 是“多 Agent 云端协作平台”，与智谱清言主对话产品不是同一身份；当前公开入口把下载控件放在应用/登录界面内，本轮没有固定到独立公共下载落地页、版本页或安装生命周期合同，也没有 macOS 证据 | 建独立 `zhipu-agentmore` 候选；取得无需登录即可复核的官方产品/下载页、当前 Windows 版本或稳定滚动入口、发布者身份、条款归属、更新/卸载说明后，再进入 `desktop-official` 评审。不要把 AgentMore 安装入口塞给 `zhipu-qingyan-web` |

## Blocked：不能新增独立桌面身份（7）

| 当前目录产品 | 一方结论 | 阻断原因与正确目录关系 |
| --- | --- | --- |
| `openai-codex` | OpenAI 的[迁移说明](https://help.openai.com/en/articles/20001276-moving-to-the-new-chatgpt-desktop-app)说明新版 ChatGPT 桌面应用在 macOS/Windows 内同时承载 Chat、Work、Codex；旧 Codex 应用更新后迁入新版 ChatGPT | 当前 `chatgpt-desktop` 已存在且描述中已写“包含 Codex 桌面模式”。不得再建第二套 Codex 桌面安装身份；如 UI 需要展示“有桌面版”，应关联现有 `chatgpt-desktop` |
| `chatgpt-work` | 同一 OpenAI 迁移说明确认 Work 位于新版 ChatGPT 桌面应用 | 不新增 Work 安装包/收据；引用 `chatgpt-desktop` 这一唯一桌面身份 |
| `claude-cowork` | [Claude Cowork](https://claude.com/product/cowork)和[Claude Desktop 安装说明](https://support.claude.com/en/articles/10065433-install-claude-desktop)均表明 Cowork 是 Claude Desktop 内的模式，Windows/macOS 由统一 Claude 下载页提供 | 当前 `claude-desktop` 已存在并明确包含 Cowork。只能建立能力/入口关系，不能复制第二个桌面产品或安装器 |
| `cognition-devin` | Devin 的[一方更新日志](https://docs.devin.ai/release-notes/overview)明确“Install Devin as an App”使用 Chrome/Edge 的安装图标，即 PWA；Devin 自己的 Desktop Mode 是云端 Linux 环境能力，不是用户 Windows/macOS 客户端 | 保持 Web；不能把 PWA、浏览器外壳或云端桌面能力标成原生 desktop |
| `mistral-vibe` | [Vibe 官方概览](https://docs.mistral.ai/vibe/overview)列出的当前表面是 Web、移动端、代码编辑器和终端；Windows 支持来自 [Vibe CLI](https://docs.mistral.ai/vibe/code/cli/install-setup)，不是 GUI 桌面应用 | 保持 `mistral-vibe` Web，并继续复用现有 `mistral-vibe-code-cli`；不能把 CLI 的 Windows 支持转写成桌面版 |
| `xai-grok-web` | xAI 当前[模型系统卡](https://data.x.ai/2026-04-07-grok-4-20-model-card.pdf)只把消费者 Grok 列为 Web 与移动应用 | 本批没有一方 Windows/macOS 原生客户端下载证据；保持 Web，不采用第三方商店或非官方封装 |
| `zhipu-qingyan-web` | [智谱清言官方下载页](https://chatglm.cn/download?lang=zh)当前要求扫码下载 App 或在移动端打开；Windows 证据来自另一产品 AgentMore | 保持智谱清言 Web/移动产品边界；AgentMore 按上节独立候选处理 |

## 去重与录入规则

1. **一个桌面安装身份只保留一份。** Codex、ChatGPT Work 共用 `chatgpt-desktop`；Claude Cowork 共用 `claude-desktop`。产品卡可以显示“可在桌面使用”，但不能重复下载、检测、更新、卸载和收据所有权。
2. **同一产品的 Web 与 desktop 是 entry point，不是两个产品。** MiniMax 和 Notion直接更新现有产品；Replit 应先把产品显示范围校正为 Replit 平台，再补桌面入口。
3. **相邻产品不能强行合并。** FlowithOS 与 Agent Neo、AgentMore 与智谱清言都具有不同的一方产品身份，应分别建候选并通过厂商关系连接。
4. **官方落地页通过不代表安装器通过。** 本批 ready 项全部先采用 `official-link-only`/打开厂商下载页；若以后要“一键安装”，必须另做当前二进制、Authenticode/Apple notarization、架构、版本、哈希或滚动身份、安装收据、更新器、卸载和残留验收。
5. **PWA、CLI、扩展和云端 Desktop Mode 不计桌面软件。** UI 上可以呈现其真实入口，但不得为了增加“桌面版数量”而改变产品形态。

## 下一批边界

本批到 12 个对象即停止，没有把“没搜到”扩写成“全网不存在”。下一批若继续，应从当前 157 个 Web AI 产品按同一方法分组，每批 10–15 个，并优先处理：官方页面已有 Download 文案、产品 ID 含 desktop 但仍标 Web、或现有描述已经声称 Windows 客户端的记录。每次都必须重新读取活动目录并做语义去重；本报告的计数和 SHA 只是 2026-08-15 的本地快照。
