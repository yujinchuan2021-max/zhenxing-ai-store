# AI 可接入厂商缺口：游戏、媒体、远程、3D 与办公（下一批）

- 研究日期：2026-08-03
- 状态：证据清单完成，尚未写入 catalog，尚未实现或验收连接器
- 证据范围：只采用厂商官方产品页、官方开发者文档或项目官方仓库
- 去重基线：`admin/data/catalog-v1.json` 快照 `updatedAt=2026-08-03T04:50:17.949Z`，包含 311 个厂商、505 个产品、118 个资源；同时检索了 `docs/research/` 下已有研究
- 范围边界：本文件只研究候选和接入边界，不授权下载图形安装器、执行 `npx`/`pip`/Docker、创建 OAuth 应用、保存密钥或调用会改写用户数据的工具

## 结论

本轮筛出 14 个当前目录与既有研究均未覆盖的候选。其中 6 个有“厂商官方、可操作产品”的 MCP，可作为下一批高置信资源；6 个只有官方 API、SDK、框架能力或项目官方本地 MCP，应先收为文档/资源入口；另有 2 个处于 Alpha 或并非通用连接器，只适合作为观察项。

| 优先级 | 厂商 / 产品 | 类别 | 官方接口性质 | 建议的首版形态 |
| --- | --- | --- | --- | --- |
| P0 | PlayCanvas / PlayCanvas Editor | 游戏、实时 3D | 官方本地 Editor MCP，可读写当前编辑器项目 | 产品卡 + 官方文档资源；本地模块审计后再开放安装 |
| P0 | Vimeo / Vimeo Platform | 视频、媒体管理 | 官方远程 MCP，当前为 Public Beta | 远程 MCP 资源，OAuth，醒目标注 Beta |
| P0 | Cloudinary / Media Platform | 图像、视频、媒体工作流 | 官方远程/本地 MCP 套件 | 远程 OAuth 优先，按服务器组最小化授权 |
| P0 | ONLYOFFICE / DocSpace | 办公、文档协作 | 官方远程/本地 DocSpace MCP | 远程 OAuth 资源，默认只读工具集 |
| P0 | Airtable / Airtable Platform | 数据表、业务协作 | 官方远程 MCP | 远程 OAuth 资源，按用户原有角色限权 |
| P0 | PandaDoc / PandaDoc Workspace | 文档、合同与签署流程 | 官方远程 MCP | 远程 OAuth 资源；发送、提醒和改写逐次确认 |
| P1 | mod.io / mod.io Platform | 游戏 UGC、模组 | 官方 REST API 与 SDK；未发现官方 MCP | API/SDK 文档资源，不伪装成 MCP |
| P1 | AssemblyAI / Voice AI Platform | 语音识别、语音智能 | 官方 REST/WebSocket API；官方 MCP 仅检索文档 | API/SDK 资源；文档 MCP 单独标为“文档助手” |
| P1 | LiveKit / LiveKit Cloud + Agents | 实时音视频、语音 Agent | 官方 Agents SDK 可消费 MCP；官方 MCP 仅检索文档 | 框架/SDK 资源，不标成平台控制 MCP |
| P1 | AnyDesk / my.anydesk I | 远程设备与会话管理 | 官方 REST API；不是交互式远控接口 | 管理 API 文档资源，计划/账号门槛说明 |
| P1 | Tripo AI / Tripo OpenAPI | 生成式 3D | 官方异步 OpenAPI | API 文档资源；预算、密钥和结果归档完成设计后再实现 |
| P1 | Docling Project / Docling | 文档解析与转换 | 项目官方本地/远程 MCP | 明标“官方开源项目”；先做资源链接和文件边界审计 |
| P2 | Tailscale / Aperture | 私网、远程 MCP 聚合 | 官方 MCP 代理，当前为 Alpha | 观察项；只链接文档，不预置通用端点 |
| P2 | Spline / Spline | 交互式 3D | AI Voice Assistant API，可触发场景动作；不是通用 MCP | 产品/开发文档入口，不创建“官方 Spline MCP”卡片 |

## 1. 游戏与实时 3D

### 1.1 PlayCanvas / PlayCanvas Editor

官方 Editor MCP 连接到一个已经打开的 PlayCanvas Editor，可修改项目数据，并通过视口或运行态检查结果。官方文档给出了 Codex、Claude Code、Cursor 和 Claude Desktop 的配置；Windows/Codex 示例通过 `cmd /c npx` 启动 `@playcanvas/editor-mcp-server`。它一次只连接一个 Editor 实例，默认使用本机端口 52000。

这是真正的产品操作 MCP，但权限并不轻：官方安全说明列出的能力包含删除实体、资产、构建或分支，以及重置状态，并建议在操作前建立 checkpoint。因此首版只应发布产品卡和官方资源；在固定包版本、校验供应链、限定本机端口、验证 checkpoint/恢复路径之前，不应开放一键执行 `npx`。

- [PlayCanvas Editor MCP 官方文档](https://developer.playcanvas.com/user-manual/editor/mcp-server/)

建议 ID：`playcanvas` / `playcanvas-editor` / `playcanvas-editor-mcp`。

### 1.2 mod.io / mod.io Platform

mod.io 官方 REST API v1 面向游戏内 UGC、模组、订阅、评分、审核和管理流程。官方入门资料区分只读 API key 与具备读写权限的 OAuth access token，并建议在适用时优先使用官方插件或 SDK。官方 Rules Engine 还明确支持把外部 AI、文件、内容或恶意软件服务接入审核链路。

本轮未找到 mod.io 官方 MCP，因此首版只能标为 API/SDK 资源。写操作、UGC 审核、订阅、评分和付费模组/钱包相关接口必须在后续固定模块中按能力分级；API key 或 OAuth token 不得进入 catalog。

- [mod.io REST API 官方介绍](https://docs.mod.io/restapi/introduction)
- [mod.io 官方入门](https://docs.mod.io/getting-started)
- [mod.io Rules Engine 与外部服务集成](https://docs.mod.io/moderation/rules-engine/)

建议 ID：`mod-io` / `mod-io-platform` / `mod-io-rest-api`。

## 2. 视频、图像与媒体工作流

### 2.1 Vimeo / Vimeo Platform

Vimeo 官方提供远程 MCP，Streamable HTTP 端点为 `https://mcp.vimeo.com/mcp`，当前官方页面标注 Public Beta。官方列出的能力覆盖视频检索、元数据、分析、showcase、隐私设置、章节、团队权限、评论与转录等；破坏性删除未包含在 MCP 能力范围内，实际可用功能还受 Vimeo 会员计划约束。

首版可把它作为远程 OAuth MCP 收录，但必须显示 Beta 和账户计划依赖。即使官方不暴露删除，修改隐私、团队访问、章节、评论或创建内容仍属于外部状态变更，应在执行前展示对象与影响并确认。

- [Vimeo MCP Server 官方文档](https://developer.vimeo.com/api/mcp-server)
- [Vimeo Developer Platform](https://developer.vimeo.com/)

建议 ID：`vimeo` / `vimeo-platform` / `vimeo-mcp-server`。

### 2.2 Cloudinary / Media Platform

Cloudinary 官方文档将 MCP 分为 Asset Management、Environment Configuration、Structured Metadata、Analysis 和 MediaFlows 五组，覆盖资产上传/管理/转换/分析、环境配置、结构化元数据和自动化流程。官方同时提供远程与本地模式，当前建议优先远程连接和 OAuth；文档也说明了 Streamable HTTP `/mcp` 与旧 SSE 端点的迁移差异。

这套 MCP 的能力跨度很大，不能把五组工具一次性全部授权。首版应按组拆成资源并默认只启用读取/检索；上传、重命名、删除资产，修改环境、webhook、元数据结构或 MediaFlows 都需要高风险确认。API key 只能进入系统凭据存储，不能出现在 catalog、日志或截图中；本地模式在版本和收据机制完成前仅展示文档。

- [Cloudinary LLM 与 MCP 官方文档](https://cloudinary.com/documentation/cloudinary_llm_mcp)

建议 ID：`cloudinary` / `cloudinary-media-platform` / `cloudinary-mcp-servers`。

## 3. 音频、语音与实时 Agent

### 3.1 AssemblyAI / Voice AI Platform

AssemblyAI 官方 API 提供预录音频转写、流式 WebSocket、语音理解及语音 Agent 相关能力。官方 Coding Agent 页面同时提供文档 MCP `https://assemblyai.com/docs/mcp`，但该 MCP 的工具是搜索和读取 AssemblyAI 文档，不是替用户提交转写任务或操作账户。

因此应拆成两条关系：产品通过官方 REST/WebSocket API“可接入”，文档 MCP 只作为开发者资料助手。浏览器或移动端不得暴露长期 API key，应由受控服务端签发短期 token；流式会话还要明确结束，避免连接继续计费。首版只放 API/SDK 与文档入口。

- [AssemblyAI API 官方总览](https://www.assemblyai.com/docs/api-reference/overview/)
- [AssemblyAI Coding Agent 与文档 MCP](https://www.assemblyai.com/docs/coding-agent-prompts)

建议 ID：`assemblyai` / `assemblyai-voice-ai-platform` / `assemblyai-api-and-docs-mcp`。

### 3.2 LiveKit / LiveKit Cloud + Agents

LiveKit 官方将产品定位为面向实时音频、视频、数据和 Agent 的开源框架与云平台。Agents SDK 可以作为 MCP client 连接外部 MCP server；LiveKit 自己提供的 `https://docs.livekit.io/mcp` 则用于搜索官方文档、代码示例和更新记录。

这两种能力不能合并成“LiveKit 平台控制 MCP”。首版应收录 LiveKit Cloud、Agents SDK 和文档 MCP 的明确关系：SDK 是构建/承载 Agent 的框架，文档 MCP 是资料检索器。房间、媒体、电话或 Agent 部署等真实操作必须通过官方 SDK/API 的后续固定模块，并另行设计凭据、费用和实时会话终止策略。

- [LiveKit 官方平台介绍](https://docs.livekit.io/intro/about/)
- [LiveKit Docs MCP 官方文档](https://docs.livekit.io/reference/developer-tools/docs-mcp/)
- [LiveKit Agents JavaScript 官方参考](https://docs.livekit.io/reference/agents-js/)

建议 ID：`livekit` / `livekit-cloud` / `livekit-agents-and-docs-mcp`。

## 4. 远程访问、设备与私网

### 4.1 Tailscale / Aperture

Tailscale Aperture 官方 MCP Server Proxy 可以聚合多个远程 MCP，并通过 Tailscale 身份、grants 和动态工具发现向用户暴露统一入口；官方文档同时支持 Streamable HTTP 与 SSE。当前页面明确标为 Alpha，需要已有 tailnet、Aperture 主机和相应配置。

它是基础设施代理，不是一个可直接预置的公共 SaaS MCP。实际 URL 和权限依赖用户自己的 tailnet 与 Aperture 实例，因此首版只能链接官方文档，并标注 Alpha；不得生成“所有用户共用”的 endpoint，也不得暗示安装 Tailscale 就自动获得 MCP 权限。

- [Tailscale Aperture MCP Server Proxy 官方文档](https://tailscale.com/docs/aperture/mcp-server)
- [Tailscale 安全 AI Agent 连接用例](https://tailscale.com/use-cases/secure-ai-agent-connectivity)

建议 ID：`tailscale` / `tailscale-aperture` / `tailscale-aperture-mcp-proxy`。

### 4.2 AnyDesk / my.anydesk I

AnyDesk 官方 REST API 面向 my.anydesk I 管理能力，可查询许可证/账户、客户端和在线状态、会话历史、评论与别名，也包含移除客户端、关闭活动会话等写操作。官方说明该 API 只对特定 Standard、Advanced、Ultimate Cloud/On-Prem 计划开放；凭据需联系 AnyDesk 获取，最新 endpoint 与认证细节位于登录后的客户门户。

这不是启动或接管交互式远程桌面的 API，不能把它描述为“让 AI 远程控制电脑”。首版只收录管理 API 文档和计划门槛；移除客户端、关闭会话、改变别名等操作即使以后实现，也必须逐次确认。AnyDesk 图形客户端只能链接官方产品/下载页，不由客户端自动下载、解析或启动安装器。

- [AnyDesk REST API 官方文档](https://support.anydesk.com/docs/rest-api)

建议 ID：`anydesk` / `anydesk-remote` / `anydesk-rest-api`。

## 5. 生成式与交互式 3D

### 5.1 Tripo AI / Tripo OpenAPI

Tripo 官方 OpenAPI 基址为 `https://api.tripo3d.ai/v2/openapi`，覆盖文本、单图或多视图生成 3D，以及后处理、绑定等异步任务。官方定价以 credits 计费；任务结果中的下载 URL 只有短时有效期，官方文档说明结果链接会在约五分钟后过期，并要求使用同一 API key 查询任务。

本轮未发现官方 MCP。首版只应发布 OpenAPI 文档资源；后续模块必须先解决预算上限、API key 凭据存储、任务轮询和成果持久化。不得把短时结果 URL 当成 catalog 中的稳定资产地址，也不得未经用户确认批量提交计费任务。

- [Tripo API 官方介绍](https://docs.tripo3d.ai/get-started/introduction.html)
- [Tripo API 官方定价](https://docs.tripo3d.ai/get-started/pricing.html)
- [Tripo 任务结果官方文档](https://docs.tripo3d.ai/task-query/get-your-task-result.html)

建议 ID：`tripo` / `tripo-studio` / `tripo-openapi`。

### 5.2 Spline / Spline

Spline 是浏览器中的交互式 3D 设计平台。官方 AI Voice Assistant API 使用 OpenAI Realtime API，并要求用户自己的 OpenAI API key、付费 OpenAI 开发者账户以及相应的 Spline Pro/Team 计划。设计者可以把 AI Assistant Trigger 绑定到预先定义的场景动作，例如状态转换、动画、声音、视频、对象创建/销毁、镜头切换、变量或 API Request。

这证明 Spline 场景可被 AI 驱动，但它不是供任意 MCP client 连接并编辑整个 Spline 项目的通用 MCP。首版只适合产品与开发文档入口；不得创建“官方 Spline MCP”资源，也不得由 AI Hub 收集用户 OpenAI API key。对象销毁、外部 API Request、清除 local storage 等动作需要在场景设计与执行层分别确认。

- [Spline AI Voice Assistant API 官方文档](https://docs.spline.design/interaction-states-events-and-actions/ai-voice-assistant-api)
- [Spline AI Assistant Trigger Event 官方文档](https://docs.spline.design/interaction-states-events-and-actions/events/ai-assistant-trigger-event)
- [Spline 官方产品介绍](https://docs.spline.design/basics/what-is-spline)

建议 ID：`spline` / `spline-platform` / `spline-ai-voice-assistant-api`。

## 6. 办公、数据表与文档工作流

### 6.1 ONLYOFFICE / DocSpace

ONLYOFFICE 官方 DocSpace MCP 把 AI client 连接到 rooms、files、permissions 和工作流，提供远程与本地两种模式。官方推荐远程 Streamable HTTP 端点 `https://mcp.onlyoffice.com/mcp`，旧 `/sse` 为兼容入口；远程模式使用 OAuth。官方同时提供 npm/Docker 本地部署方式，需要 DocSpace base URL 和 API key。

可操作范围包含房间、成员、文件、复制/移动/重命名/删除、权限和审计，因此首版应采用远程 OAuth、默认只读，并按工具精细授权。不能自动执行本地 npm/Docker 安装。断开连接只移除 AI client 配置并引导用户在 ONLYOFFICE 撤销授权，不删除 DocSpace、房间或文件。Desktop Editors 9.2+ 还可作为 MCP host 使用，但这是另一条产品能力，不能替代 DocSpace MCP 的权限说明。

- [ONLYOFFICE DocSpace MCP 官方入门](https://api.onlyoffice.com/docspace/mcp-server/getting-started/)
- [ONLYOFFICE DocSpace MCP 官方安装方式](https://api.onlyoffice.com/docspace/mcp-server/getting-started/installation/)
- [ONLYOFFICE DocSpace MCP 客户端配置](https://api.onlyoffice.com/docspace/mcp-server/getting-started/clients/)
- [ONLYOFFICE Desktop Editors 连接 MCP](https://api.onlyoffice.com/docs/desktop-editors/usage-api/connecting-mcp-servers/)

建议 ID：`onlyoffice` / `onlyoffice-docspace` / `onlyoffice-docspace-mcp`。

### 6.2 Airtable / Airtable Platform

Airtable 官方远程 MCP 端点为 `https://mcp.airtable.com/mcp`，支持 OAuth，官方也列出 PAT 模式和 Claude、ChatGPT、Codex、Cursor 等客户端。MCP 权限继承用户在 Airtable 中的既有角色：Owner/Creator/Editor 可读写，较低角色保持相应的只读或评论权限；授权 scope 覆盖 records、schema、comments 和 workspaces 的读写能力。

首版采用远程 OAuth，并在授权前展示 scopes；默认只启用读取和检索。创建 base、修改 schema、批量写 records、写评论或工作区变更都应确认。断开时移除目标 AI client 的连接并引导撤销 OAuth，不删除 base、table 或记录。

- [Airtable MCP Server 官方文档](https://support.airtable.com/v1/docs/using-the-airtable-mcp-server)

建议 ID：`airtable` / `airtable-platform` / `airtable-mcp-server`。

### 6.3 PandaDoc / PandaDoc Workspace

PandaDoc 官方远程 MCP 端点为 `https://mcp.pandadoc.com/v1/mcp`，使用 OAuth，并给出 Claude、Cursor、ChatGPT、Codex、VS Code 和自定义 MCP client 的接入说明。官方能力清单包括搜索、创建、更新、发送文档，发送提醒，以及跟踪和分析。

发送文档可能触发外部邮件/SMS、签署或审批流程，属于明显的外部副作用；文档更新也可能影响合同内容。因此首版先开放搜索/查看，创建草稿、更新、发送和提醒全部逐次确认，并在确认界面显示文档、收件人和预期通知。断开连接不应删除 workspace、模板、文档、签名或审计记录。

- [PandaDoc MCP 官方总览](https://developers.pandadoc.com/docs/how-to-use-the-pandadoc-mcp-server)
- [PandaDoc MCP 官方入门](https://developers.pandadoc.com/docs/getting-started-with-mcp)
- [PandaDoc MCP 官方能力清单](https://developers.pandadoc.com/docs/what-you-can-do-with-pandadoc-mcp)

建议 ID：`pandadoc` / `pandadoc-workspace` / `pandadoc-mcp-server`。

### 6.4 Docling Project / Docling

`docling-project/docling-mcp` 是 Docling 项目的官方仓库，可把文档转换、处理与生成能力暴露给 MCP client。它既可连接 Docling Serve，也可用本地 extra 运行转换；本地模式会读取文件/URL、生成输出并使用缓存。仓库采用 MIT 许可，并说明 Docling 由 IBM Research Zurich 发起、现由 LF AI & Data 托管。

它应标为“项目官方开源资源”，不能写成 IBM 商业产品、IBM 官方 SaaS 或厂商合作。由于本地模式涉及 Python/uvx 依赖、模型下载、任意用户文件和输出目录，首版只做资源链接；在依赖锁定、模型收据、文件选择器、路径沙箱、缓存与卸载边界审计前，不开放一键本地运行。

- [Docling MCP 项目官方仓库](https://github.com/docling-project/docling-mcp)
- [Docling 项目官方仓库](https://github.com/docling-project/docling)

建议 ID：`docling-project` / `docling` / `docling-mcp`。

## 不得误标的六条边界

1. AssemblyAI 和 LiveKit 当前列出的官方 MCP 都是文档检索器，不是产品账户或媒体任务操作 MCP。
2. AnyDesk REST API 是 my.anydesk I 管理 API，不代表 AI 能发起或接管交互式远程桌面。
3. Spline AI Voice Assistant API 是场景内能力，不是通用 Spline MCP。
4. mod.io 与 Tripo 提供官方 API/SDK，不应因此创建“官方 MCP”标签。
5. Tailscale Aperture 是 Alpha 基础设施代理，endpoint 属于用户自己的 tailnet/部署，不存在可预置的全民公共地址。
6. Docling MCP 是项目官方开源资源，但不等同于 IBM 商业产品或合作背书。

## 统一接入与生命周期建议

- 远程 MCP：只接受本文件核验过的固定官方域名；优先 OAuth，不把 token、PAT、API key 或含 token 的 URL 写入 catalog、日志、遥测或截图。
- 权限：首次连接默认只读；按工具或 scope 最小授权。删除、覆盖、发布、发送、提醒、改变隐私/权限、结束会话、启动计费任务和外部通知必须逐次确认。
- 本地执行：PlayCanvas、Cloudinary 本地模式、ONLYOFFICE 本地模式和 Docling 不在首版自动执行 `npx -y`、`pip`、`uvx` 或 Docker。先完成固定版本、来源、哈希、依赖、收据、卸载和回归测试。
- 图形产品：如 AnyDesk 或 ONLYOFFICE Desktop Editors 需要安装，只打开厂商官方下载页；客户端不下载、解析、校验或启动图形安装器。
- 断开与卸载：只移除 AI Hub 写入的连接配置和它有收据的受控资源，并引导用户在厂商侧撤销 OAuth/密钥；不删除账户、workspace、项目、房间、文件、表格、媒体、模型或用户缓存。
- 文案：产品、MCP/API 资源、目标 AI client 三者必须独立建模。收录不代表厂商背书，也不代表连接器已通过本机用户验收。

## 去重与落库前验收清单

- [x] 14 个候选名称在当前 `catalog-v1.json` 中无匹配。
- [x] 14 个候选名称在既有 `docs/research/` 报告中无匹配。
- [x] 上述建议 vendor/product/resource ID 在当前 catalog 中无冲突。
- [x] 每项至少有一个厂商官方页面、官方开发者文档或项目官方仓库。
- [x] 已区分官方产品操作 MCP、文档 MCP、普通 API/SDK、基础设施代理与开源项目。
- [ ] 落库前重新跑一次去重，因为 catalog 可能在研究完成后继续扩充。
- [ ] 对 P0 远程 endpoint 做一次实际协议握手与 OAuth 用户验收；本文的网页证据不等于连接可用性验收。
- [ ] 对任何本地模块完成供应链、固定版本、权限、收据、卸载和真实 Windows 用户验收后，才可从资源链接升级为一键连接。
