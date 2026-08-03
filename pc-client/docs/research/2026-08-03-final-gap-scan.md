# 353 厂商基线后的最终高价值缺口扫描

调研日期：2026-08-03（Asia/Shanghai）

## 结论

本次以 `pc-client/admin/data/catalog-v1.json` 的当前正式目录为唯一去重基线：**353 个厂商、559 个一级产品、128 项生态资源**。对厂商 ID/名称、嵌套产品 ID/名称和资源 ID/名称做大小写不敏感的精确检索后，本文列出的候选均未在当前目录中出现；`Pinecone` 例外，它已经有厂商和产品，只缺官方 MCP 资源。

建议把下一轮收口为一个固定批次，不在实现过程中继续外扩：

- 新建 **16 个厂商**：CopilotKit、Composio、Arcade、deepset、Mem0、Zep、Browserbase、Firecrawl、Tavily、Apify、Qdrant、Weaviate、Neon、GitBook、New Relic、Sider。
- 新建 **34 个产品**：17 个属于新厂商，另 17 个补到现有厂商；包括独立 Agent 平台、Windows 桌面产品、CLI、数据库和可接入平台，不把功能页、白皮书或同一产品的入口重复计数。
- 新建 **16 个 P0 生态资源**：均有发布者一手文档；先使用 `resource-link`，不写入客户端配置、不保存凭据、不执行安装命令。
- 另保留 **1 个 P1 受限资源**：Zep Memory MCP，仅企业计划并需厂商按账户启用，不能当作所有用户可用的普通 MCP。
- 明确排除 ChatRTX；暂缓 Notta Windows、Amuse 和 Portia，避免再次把历史页面、Mac 产品或身份尚未收敛的项目写成 Windows 正式产品。自动发现中得分较高但只是功能页、通用平台页、白皮书或现有产品别名的结果也已单独列入排除表。

完成上述固定清单、字段校验、搜索校验和发布后，这一轮“高价值 Agent / Windows 桌面 / AI 可接入产品”的缺口扫描即可关闭。后续新增应来自后台日常维护或新的官方发布事件，而不是在本批继续无限追加。

## 目录和执行边界

1. 框架、SDK、Python 包和 npm 包使用 `tutorial` / `tutorial-link`，不能伪装成 Windows 桌面软件，也不自动执行安装命令。
2. 托管平台、控制台和数据库服务使用 `web` / `web-link`。
3. 已确认具有官方 Windows 图形入口的产品是 Sider、Factory Desktop 和 Open Interpreter Desktop；Siemens Eigen Engineering Agent 是依赖 TIA Portal、账户和许可证的工程组件。它们可以使用 `desktop-official` / `open-official-download`，客户端只打开厂商长期维护的产品或下载页。
4. 已确认具有官方 Windows CLI 安装说明的产品是 Tabnine CLI 和 Deepgram CLI。二者都先建立独立 CLI 产品身份；在客户端固定安装模块完成版本、依赖、更新和卸载审核前，仅打开官方安装文档，不能直接执行网页返回的 PowerShell、远程 JavaScript 或管道命令。
5. 所有 MCP 先使用 `resource-link`。远程 MCP 只打开官方接入文档；本地 stdio MCP 也不因文档给出 `npx`、`uvx` 或 Docker 命令就自动进入白名单。
6. API key、OAuth token、数据库连接串、账号身份和第三方凭据由厂商与目标 AI 工具管理，枕星 AI 目录不保存。
7. 能写数据库、运行 Actor、操作登录态浏览器、发送消息或删除记忆的资源必须在卡片上标明权限和确认边界；不能把“官方 MCP”理解成“可以无确认地执行”。

## P0：Agent、Agent 基础设施与开发工具

| 厂商 / 建议厂商 ID | 产品 / 建议产品 ID | 页面归属 | 产品类型与分类 | 一手官方证据 | 建模边界 |
| --- | --- | --- | --- | --- | --- |
| CopilotKit / `copilotkit` | CopilotKit / `copilotkit-agent-ui` | 全部 AI 厂商 | `tutorial`；智能体 | [官方文档](https://docs.copilotkit.ai/)将其定义为 Agent 用户体验的前端栈，支持聊天组件、生成式 UI、共享状态、人机协作和多种 Agent 后端；[架构文档](https://docs.copilotkit.ai/concepts/architecture)说明前端、运行时和 Agent 后端三层结构。 | 它是 TypeScript/前端开发框架，不是独立 Windows 应用；只给官网、文档和包说明入口。 |
| Composio / `composio` | Composio / `composio-agent-tools` | 全部 AI 厂商 | `web`；智能体 | [官方 Quickstart](https://docs.composio.dev/docs/quickstart)说明可让 Agent 访问 1000+ 应用，并为每个用户建立会话；[认证文档](https://docs.composio.dev/docs/authentication)说明连接账户、OAuth、API key 和用户隔离。 | Web Agent 工具与认证平台；不能把平台工具目录拆成数百个重复一级产品，也不能由目录代管第三方凭据。 |
| Arcade / `arcade` | Arcade / `arcade-agent-tools` | 全部 AI 厂商 | `web`；智能体 | [官方工具调用文档](https://docs.arcade.dev/en/guides/tool-calling)说明其为 Agent 提供工具调用和标准化授权；[MCP Gateway 文档](https://docs.arcade.dev/en/guides/mcp-gateways)说明可筛选并聚合多个 MCP Server。 | Web 工具授权/网关平台，不是桌面应用；同一产品下放 Dashboard、SDK 和 MCP Gateway 入口。 |
| deepset / `deepset` | Haystack / `haystack-agent-framework` | 全部 AI 厂商 | `tutorial`；智能体 | [Haystack 官方文档](https://docs.haystack.deepset.ai/)将其定义为用于生产 Agent、RAG 和多模态搜索的开源 AI 编排框架；[Agent 文档](https://docs.haystack.deepset.ai/docs/agents)说明工具、记忆、推理和行动能力。 | Python 框架，不建立 Windows 安装卡；发布者显示 deepset，产品显示 Haystack。 |
| Mem0 / `mem0` | Mem0 Platform / `mem0-agent-memory` | 全部 AI 厂商 | `web`；智能体 | [官方平台概览](https://docs.mem0.ai/platform/overview)将其定义为托管的 Agent 记忆层，覆盖用户、Agent 和会话记忆；[产品总览](https://docs.mem0.ai/introduction)同时区分托管平台、开源版和 OpenMemory。 | 只建一个一级平台产品，托管版、开源版、CLI 和 MCP 作为按钮或资源；不能把“记忆”描述成普通文件存储。 |
| Zep / `zep` | Zep / `zep-agent-memory` | 全部 AI 厂商 | `web`；智能体 | [官方 Memory 文档](https://help.getzep.com/v2/memory)说明其保存对话并构建用户级知识图谱；[概念文档](https://help.getzep.com/v2/concepts)说明 Agent memory、Graph RAG 和上下文组装。 | Web / API Agent 记忆与上下文平台；文档 MCP、企业 Memory MCP 和实验性 Graphiti MCP 必须分别标注，不能混成一个“免费一键 MCP”。 |
| Browserbase / `browserbase` | Browserbase / `browserbase-platform` | 全部 AI 厂商 | `web`；智能体 | [官方产品文档](https://docs.browserbase.com/welcome/what-is-browserbase)说明其提供 Agent 浏览器、搜索、抓取、函数、模型和身份；[Agent 用例](https://docs.browserbase.com/use-cases/agents)说明持久登录态、实时观察和浏览器交互。 | 云端浏览器基础设施，不是本机浏览器；持久会话可访问登录态网站，必须提示高权限和费用边界。 |
| Browserbase / `browserbase` | Stagehand / `browserbase-stagehand` | 全部 AI 厂商 | `tutorial`；智能体 | [Browserbase 入门文档](https://docs.browserbase.com/welcome/getting-started)将 Stagehand 列为其维护的 AI 原生浏览器 SDK，支持 JavaScript/Python 和自然语言交互。 | Stagehand 是独立 SDK 身份，可以单独产品卡；不建立 Windows 桌面卡，也不自动执行 npm/pip 安装。 |
| Firecrawl / `firecrawl` | Firecrawl / `firecrawl-platform` | 全部 AI 厂商 | `web`；智能体 | [官方介绍](https://docs.firecrawl.dev/introduction)说明其提供网页搜索、抓取、爬取、结构化提取和 Agent 接入；官方还提供 Playground、API、Skill/CLI 和 MCP。 | Web 数据 API 平台；CLI、Skill 和 MCP 是子入口/资源，不能重复计成三个一级产品。 |
| Tavily / `tavily` | Tavily / `tavily-search-platform` | 全部 AI 厂商 | `web`；浏览器与搜索 | [Tavily MCP 官方文档](https://docs.tavily.com/documentation/mcp)明确其向 AI 客户端提供实时搜索和网页提取工具。 | 建一张搜索/提取平台卡；MCP 为资源。API key 或 OAuth 由 Tavily 和目标客户端管理。 |
| Apify / `apify` | Apify Platform / `apify-platform` | 全部 AI 可接入厂商 | `web`；工作流自动化 | [官方 Agent 入门](https://docs.apify.com/get-started/agent-onboarding)说明 Agent 可通过 MCP、API、CLI 使用 Apify；[集成总览](https://docs.apify.com/integrations)说明 Actors 可作为 Agent 工具。 | Apify 是可被 Agent 调用的 Web 自动化平台；Actor Store 项目不自动变成枕星 AI 一级产品。 |

## P0：数据库、文档与可观测性接入

| 厂商 / 建议厂商 ID | 产品 / 建议产品 ID | 页面归属 | 产品类型与分类 | 一手官方证据 | 建模边界 |
| --- | --- | --- | --- | --- | --- |
| Qdrant / `qdrant` | Qdrant / `qdrant-vector-database` | 全部 AI 可接入厂商 | `web`；数据库与数据 | [Qdrant 官方 MCP 文档](https://qdrant.tech/documentation/qdrant-mcp-server/)确认其向 Agent 提供向量记忆的保存与检索。 | 产品卡指向 Qdrant 平台/文档；MCP 单独作为资源，默认包含写入能力，不能宣称只读。 |
| Weaviate / `weaviate` | Weaviate / `weaviate-vector-database` | 全部 AI 可接入厂商 | `web`；数据库与数据 | [Weaviate 官方 MCP 文档](https://docs.weaviate.io/weaviate/configuration/mcp-server)说明 v1.38 起内置 Streamable HTTP MCP，支持 schema、查询和可选写入。 | MCP 属于数据库实例能力且默认关闭；产品卡不能把本机 `localhost` 地址当成所有用户可直接访问的公共端点。 |
| Neon / `neon-database` | Neon Postgres / `neon-postgres` | 全部 AI 可接入厂商 | `web`；数据库与数据 | [Neon MCP 官方文档](https://neon.com/docs/ai/neon-mcp-server)说明可管理项目、分支、数据库、SQL 和迁移，并提供托管远程 MCP。 | 当前目录的 `opera-neon` 是 Opera 浏览器产品，只是字符串相同，不是 Neon 数据库；必须使用独立厂商 ID，不能误判为重复。 |
| GitBook / `gitbook` | GitBook / `gitbook-docs-platform` | 全部 AI 可接入厂商 | `web`；内容管理与发布 | [GitBook 官方文档](https://gitbook.com/docs/publishing-documentation/mcp-servers-for-published-docs)说明每个已发布站点自动生成 HTTP MCP，读取公开或受身份保护的已发布内容。 | MCP 只读已发布文档，不读草稿、分析数据或内部用户数据；不要描述成可编辑 GitBook 的操作型 MCP。 |
| New Relic / `new-relic` | New Relic / `new-relic-observability` | 全部 AI 可接入厂商 | `web`；可观测性 | [New Relic 公告](https://docs.newrelic.com/whats-new/2025/11/whats-new-11-05-mcp-server/)和[设置文档](https://docs.newrelic.com/docs/agentic-ai/mcp/setup/)确认官方 MCP 仍为 Preview，可查询可观测性数据并执行部分运维动作。 | 产品卡必须写明 MCP 处于 Preview；使用区域端点、RBAC 和最小权限，不能默认为生产账户安全。 |
| Pinecone / 复用 `pinecone` | 复用 `pinecone-vector-database` | 全部 AI 可接入厂商 | 已有产品，仅补资源 | [Pinecone MCP 官方文档](https://docs.pinecone.io/guides/operations/mcp-server)说明可管理索引、写入和查询数据；[2026 发布记录](https://docs.pinecone.io/release-notes/2026)说明该 MCP 已 GA。 | 不新建厂商或产品，只给已有 Pinecone 产品补官方 MCP 资源；索引管理和数据写入必须提示确认。 |

## P0：Windows 桌面缺口

| 厂商 / 建议厂商 ID | 产品 / 建议产品 ID | 页面归属 | 产品类型与分类 | 一手官方证据 | Windows 边界 |
| --- | --- | --- | --- | --- | --- |
| Sider / `sider` | Sider for Windows / `sider-windows` | 全部 AI 厂商 | `desktop-official`；AI 对话 | [Sider Windows 官方页](https://sider.ai/apps/windows)明确提供 Windows 桌面产品，包含多模型聊天、浏览器 Agent、文件/PDF、写作、图像与视频能力；[官方下载选择页](https://sider.ai/download?windowsDl=1)提供 Microsoft Store 和 EXE 入口。 | 客户端只打开 Windows 官方页，不保存 EXE 直链，不下载、解析或启动安装器；扩展、移动端和 Windows 客户端合并在同一产品身份下，不重复建卡。 |

## P0：补入现有厂商的独立产品

这些候选来自官方页面自动发现结果的人工复核。它们均属于目录里已经存在的厂商，因此只新增产品，不新建厂商。建议 ID 已与当前 559 个产品做精确去重。

| 现有厂商 | 产品 / 建议产品 ID | 页面归属 | 产品类型与分类 | 一手官方证据 | 建模与 Windows 边界 |
| --- | --- | --- | --- | --- | --- |
| ServiceNow / `servicenow` | ServiceNow Build Agent / `servicenow-build-agent` | 全部 AI 厂商 | `web`；智能体、编程开发 | [官方使用文档](https://www.servicenow.com/docs/r/application-development/use-build-agent.html)和[产品公告](https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-Build-Agent-now-works-inside-every-major-AI-coding-tool-governed-by-default/default.aspx)确认它是用于生成和修改 ServiceNow 应用的独立 Agent，并可在主流 AI 编程工具中工作。 | 它依赖 ServiceNow 实例、管理员启用和受支持区域，不是 Windows 安装包；AI 生成代码仍需人工审查。不要再把通用“AI Agents”解决方案页重复建卡。 |
| Databricks / `databricks` | Lakebase / `databricks-lakebase` | 全部 AI 可接入厂商 | `web`；数据库与数据 | [Lakebase 官方产品页](https://www.databricks.com/product/lakebase)将其定义为面向应用和 Agent 的 Serverless Postgres，并提供持久 Agent 记忆和数据库分支。 | 与已有 Data Intelligence Platform 不同，是独立数据库产品；只给 Web 产品入口，不将 SQL、连接串或数据库管理权限交给目录。 |
| Databricks / `databricks` | Agent Bricks / `databricks-agent-bricks` | 全部 AI 厂商 | `web`；智能体 | [Agent Bricks 官方产品页](https://www.databricks.com/product/artificial-intelligence/agent-bricks)说明其用于构建、评估、治理和部署生产 Agent，并支持模型、工具与 MCP。 | 独立产品卡；通用“AI Agents”解决方案页、App Development 页和 Data Intelligence 平台页不再重复建产品。 |
| Tabnine / `tabnine` | Tabnine CLI / `tabnine-cli` | 全部 AI 厂商 | `cli-official`；编程开发 | [Tabnine CLI 官方文档](https://docs.tabnine.com/main/getting-started/tabnine-cli)明确它是终端中的 AI 编程助手；[安装文档](https://docs.tabnine.com/main/getting-started/tabnine-cli/getting-started/installation)列出 Windows PowerShell/CMD、Node.js 依赖、更新和卸载。 | CLI 必须与已有可视化 Code Assistant 分开。安装依赖 Tabnine Host、团队启用 Agents 和 Node.js；远程 `installer.mjs` 管道不能直接成为后台可下发命令，需客户端固定模块另审。 |
| Cloudflare / `cloudflare` | Cloudflare Agents / `cloudflare-agents` | 全部 AI 厂商 | `web`；智能体、开发平台 | [Cloudflare Agents 官方文档](https://developers.cloudflare.com/agents/)说明其提供具有持久身份、状态、SQL、定时任务、工具、浏览器、Sandbox 和 MCP 的 Agent 运行平台。 | 复用现有 Cloudflare 厂商；Workers、Limits、Data Platform、Frontends 等通用或功能页不单独建 AI 产品。已有 Cloudflare MCP 资源不重复新增。 |
| Confluent / `confluent` | Confluent Streaming Agents / `confluent-streaming-agents` | 全部 AI 厂商 | `web`；智能体、数据流 | [官方产品页](https://www.confluent.io/product/streaming-agents)将其定义为基于托管 Flink/Kafka 构建、部署和编排事件驱动 Agent 的产品，并支持 MCP/A2A。 | 与已有 Confluent Cloud 平台卡并存；不把 Kafka、Flink 或产品功能页继续拆成重复一级产品。 |
| Factory / `factory-ai` | Factory Desktop / `factory-desktop` | 全部 AI 厂商 | `desktop-official`；编程开发 | [Factory Desktop 官方页](https://factory.ai/product/desktop)明确其为 AI Agent 原生界面并提供 macOS 与 Windows，可使用同一 Droids、MCP、Skills、Hooks 和 Plugins。 | 与已有 Factory Droids、Factory CLI 分开；Windows 只打开官方产品/下载页，不保存临时构建直链。 |
| Neo4j / `neo4j` | Neo4j Aura Agent / `neo4j-aura-agent` | 全部 AI 厂商 | `web`；智能体、数据库与数据 | [官方产品页](https://neo4j.com/product/aura-agent/)和[官方文档](https://neo4j.com/docs/aura/aura-agent/)确认它是低/无代码 GraphRAG Agent 平台，可测试、部署为 REST 或 MCP endpoint。 | 依赖 AuraDB 和组织/项目权限；不是 Neo4j Desktop 的别名。外部 endpoint 会计费，当前只建 Web 产品入口。 |
| HubSpot / `hubspot` | Breeze Customer Agent / `hubspot-breeze-customer-agent` | 全部 AI 厂商 | `web`；智能体、客户服务 | [官方产品页](https://www.hubspot.com/products/artificial-intelligence/ai-customer-service-agent)确认它是跨营销、销售与服务渠道工作的 24/7 客户 Agent。 | 与 CRM 平台卡分开；账号套餐、HubSpot Credits、渠道授权和自动回复由 HubSpot 管理。 |
| HubSpot / `hubspot` | Breeze Data Agent / `hubspot-breeze-data-agent` | 全部 AI 厂商 | `web`；智能体、数据分析 | [官方产品页](https://www.hubspot.com/products/artificial-intelligence/ai-data-agent)确认它会基于 CRM、通话、邮件、文档和 Web 自动研究客户并输出洞察。 | 独立命名产品；不能描述成通用数据库或把 CRM 数据复制到目录。 |
| HubSpot / `hubspot` | Breeze Prospecting Agent / `hubspot-breeze-prospecting-agent` | 全部 AI 厂商 | `web`；智能体、销售 | [官方产品页](https://www.hubspot.com/products/sales/ai-prospecting-agent)确认它会监控购买信号、寻找联系人并生成个性化外联，且可切换全自动模式。 | 独立命名产品；涉及联系人和自动外联，卡片必须提示人工复核、套餐、Credits 和发送权限。 |
| Sentry / `sentry` | Sentry Seer / `sentry-seer` | 全部 AI 厂商 | `web`；智能体、编程开发 | [Sentry 官方文档](https://docs.sentry.io/product/ai-in-sentry/seer)将 Seer 定义为利用 issue、trace、log 和 profile 进行根因分析与修复的 AI 调试 Agent；[官方公告](https://sentry.io/changelog/seer-agent-is-in-open-beta/)说明 Seer Agent 仍为 Open Beta。 | 单独产品卡并明确 Beta；“Agent Tracing”是 Sentry 平台能力，不另建产品。 |
| UiPath / `uipath` | UiPath Agent Builder / `uipath-agent-builder` | 全部 AI 厂商 | `web`；智能体、工作流自动化 | [UiPath 官方产品页](https://www.uipath.com/product/agent-builder)确认其可在 Studio 环境中构建、测试、评估和部署 Agent，并与机器人、人和 Maestro 流程协作。 | 作为现有 UiPath Platform 下的独立命名产品；Coded Agents、测试场景页和 Studio 功能页不再重复建卡。 |
| Cisco / `cisco` | Webex AI Agent / `cisco-webex-ai-agent` | 全部 AI 厂商 | `web`；智能体、客户服务 | [Webex AI Agent 官方页](https://www.webex.com/us/en/products/customer-experience/ai-agent.html)确认它可构建自主或脚本式语音/数字 Agent，并接入后台系统解决客户问题。 | 与已有 Webex with Cisco AI Assistant 不同：前者面向自动客户自助，后者辅助人工坐席；两张卡必须用清晰描述避免混淆。 |
| Siemens / `siemens` | Eigen Engineering Agent / `siemens-eigen-engineering-agent` | 全部 AI 可接入厂商 | `desktop-official`；智能体、工业工程 | [Siemens 官方公告](https://press.siemens.com/global/en/pressrelease/siemens-launches-eigen-engineering-agent-bringing-purpose-built-ai-industrial)确认产品已 GA 并直接连接 TIA Portal；[官方产品页](https://www.siemens.com/de-de/products/tia-portal/eigen-engineering-agent/)说明需要 TIA Portal V19/V20/V21 许可证、Industry Organization Account 和安装文件。 | 它是 TIA Portal 的受许可工程组件，不是通用独立桌面 Agent；只打开官方产品/采购/下载入口，不自动安装或伪造“一键部署”。 |
| Open Interpreter / `open-interpreter` | Open Interpreter Desktop / `open-interpreter-desktop` | 全部 AI 厂商 | `desktop-official`；智能体、桌面自动化 | [官方桌面文档](https://www.openinterpreter.com/docs/desktop)说明它可跨应用、文件和浏览器执行任务；[安装文档](https://www.openinterpreter.com/docs/desktop/install)明确提供 Windows 安装器并要求首次运行处理 UAC 和工作目录权限。 | 与已有 Open Interpreter CLI 分开；桌面产品权限高，必须提示工作目录、模型凭据、UAC 和提交/发送/删除前确认。 |
| Deepgram / `deepgram` | Deepgram CLI / `deepgram-cli` | 全部 AI 厂商 | `cli-official`；音频、编程开发 | [官方入门](https://developers.deepgram.com/developer-tools/cli/getting-started)说明 `dg` 可在终端调用语音转文字、文字转语音、文本分析和账户 API；[安装文档](https://developers.deepgram.com/developer-tools/cli/installation)明确支持 Windows、Python 3.10+、更新和卸载。 | 与已有 Voice AI Platform 分开；官方 PowerShell 安装脚本不能由后台原样下发，需固定 CLI 模块审核依赖、版本、代理、凭据和卸载收据后再开放一键安装。 |

## 自动发现高分结果的去噪结论

| 发现结果 | 处理 | 原因 |
| --- | --- | --- |
| ServiceNow AI Agents、CSM、Process Mining、App Engine | 不新增 | 通用解决方案、业务平台或已有 ServiceNow AI Platform 的能力，不是本轮可验证的独立 AI 产品身份；只补 Build Agent。 |
| Databricks AI Agents、Data Intelligence、App Development 等页面 | 不新增 | 泛解决方案或已有平台入口；只补官方独立命名的 Lakebase 和 Agent Bricks。 |
| Cloudflare Limits、Data Platform、Workers for Platforms、Frontends | 不新增 | 配额、平台能力或开发页面，不应因页面出现 Agent/AI 文案就计成新产品；只补 Cloudflare Agents。 |
| Factory Droids、Factory CLI | 不新增 | 当前目录已存在；只补官方 Windows/macOS Desktop。 |
| Neo4j Enterprise Studio | 不新增 | 通用管理/开发界面；当前已有 Graph Database 与 Desktop，只补独立 Aura Agent。 |
| HubSpot Marketplace、Mobile、Breeze 总览 | 不新增 | 入口或产品集合页；只补三个有独立官方产品页和明确职责的 Breeze Agent。 |
| Sentry Agent Tracing | 不新增 | 是 Sentry 观测 Agent 的平台能力，不是与 Seer 并列的最终用户产品。 |
| UiPath Coded Agents、Agent Builder for Testers、Studio | 不新增 | 开发模式、场景页或现有平台能力；只补 Agent Builder。 |
| Cisco Webex AI Assistant | 不新增 | 当前目录已有；只补职责不同的 Webex AI Agent。 |
| Siemens Eigen eBook/案例页 | 不新增 | 营销材料或案例不计产品；产品身份仅采用 Eigen Engineering Agent 官方产品/公告。 |
| Deepgram Voice Agent API | 不新增 | 已包含在现有 Voice AI Platform；CLI 是独立产品，Docs MCP 和 Agent Skills 则进入资源商店。 |

## P0 生态资源清单

以下资源都有发布者一手页面，但本批只建议录成 `resource-link`。

| 建议资源 ID | 资源名称 | 关联产品 | 官方来源 | 权限与状态边界 |
| --- | --- | --- | --- | --- |
| `composio-mcp` | Composio MCP | `composio-agent-tools` | [Composio Quickstart](https://docs.composio.dev/docs/quickstart)说明每个会话都可暴露 MCP endpoint。 | 可发现、认证并执行大量第三方工具；按用户隔离，不能保存 Connect Link、token 或 API key。 |
| `arcade-mcp-gateway` | Arcade MCP Gateway | `arcade-agent-tools` | [Arcade MCP Gateways](https://docs.arcade.dev/en/guides/mcp-gateways) | 聚合多个 Server 与工具；只暴露必要工具，官方建议单个 Gateway 少于 80 个工具。 |
| `mem0-mcp` | Mem0 MCP | `mem0-agent-memory` | [Mem0 MCP 官方文档](https://docs.mem0.ai/platform/mem0-mcp) | 可新增、搜索、更新、单条删除、批量删除记忆；删除类操作必须确认，API key 不写入目录。 |
| `zep-docs-mcp` | Zep Documentation MCP | `zep-agent-memory` | [Zep Documentation MCP](https://help.getzep.com/docs-mcp-server) | 只检索 Zep 公共文档，与用户记忆 MCP 不是同一资源。 |
| `browserbase-mcp` | Browserbase MCP Server | `browserbase-platform` | [Browserbase MCP 文档](https://docs.browserbase.com/integrations/mcp/introduction) | 可控制浏览器、点击、填写和访问登录态；属于高权限 Agent 资源，必须提示外部网站操作风险。 |
| `firecrawl-mcp` | Firecrawl MCP Server | `firecrawl-platform` | [Firecrawl MCP 文档](https://docs.firecrawl.dev/mcp) | 提供抓取、爬取、搜索和批量提取；本地 `npx` 路径不能直接复制成受管安装白名单。 |
| `tavily-mcp` | Tavily MCP Server | `tavily-search-platform` | [Tavily MCP 文档](https://docs.tavily.com/documentation/mcp) | 提供远程 MCP、OAuth/API key 及本地模式；优先只给远程官方接入文档。 |
| `apify-mcp` | Apify MCP Server | `apify-platform` | [Apify MCP 官方文档](https://docs.apify.com/integrations/mcp) | 可发现并运行 Actors、访问存储和结果；官方明确排除 full-permission Actors，目录不能绕过这一限制。 |
| `pinecone-mcp` | Pinecone MCP Server | `pinecone-vector-database` | [Pinecone MCP 文档](https://docs.pinecone.io/guides/operations/mcp-server) | 可建索引、写入、搜索和重排；不是只读资源。 |
| `qdrant-mcp` | Qdrant MCP Server | `qdrant-vector-database` | [Qdrant MCP 文档](https://qdrant.tech/documentation/qdrant-mcp-server/) | 可保存与检索记忆；本地 `uvx`、Docker 和 embedding 模型属于运行环境，当前只给说明入口。 |
| `weaviate-mcp` | Weaviate MCP Server | `weaviate-vector-database` | [Weaviate MCP 文档](https://docs.weaviate.io/weaviate/configuration/mcp-server) | 内置但默认关闭；写入能力也默认关闭，必须保留厂商的安全默认值。 |
| `neon-mcp` | Neon MCP Server | `neon-postgres` | [Neon MCP 文档](https://neon.com/docs/ai/neon-mcp-server) | 可运行 SQL、改 schema 和迁移；官方建议仅开发/测试使用，不连接生产或含 PII 数据库。 |
| `gitbook-published-docs-mcp` | GitBook Published Docs MCP | `gitbook-docs-platform` | [GitBook MCP 文档](https://gitbook.com/docs/publishing-documentation/mcp-servers-for-published-docs) | HTTP、只读、只覆盖已发布内容；每个站点 URL 不同，后台只保存模板说明，不能假设固定公共端点。 |
| `new-relic-mcp` | New Relic MCP Server | `new-relic-observability` | [New Relic MCP 设置](https://docs.newrelic.com/docs/agentic-ai/mcp/setup/) | Preview；区分 US/EU 端点，按 RBAC 和标签过滤工具，使用 AI 工具会代表用户采取行动。 |

## P1 受限资源

| 建议资源 ID | 资源名称 | 官方来源 | 暂不进入普通 P0 的原因 |
| --- | --- | --- | --- |
| `zep-memory-mcp` | Zep Memory MCP Server | [Zep 官方文档](https://help.getzep.com/v3/memory-mcp-server) | 仅 Enterprise Plan、需要联系厂商按账户启用，并依赖企业 IdP；可搜索和新增用户记忆。可以录为“企业版/需启用”的资源，但不能显示普通一键安装。 |

## 明确排除与暂缓

| 候选 | 结论 | 一手依据与原因 |
| --- | --- | --- |
| NVIDIA ChatRTX | 排除 | NVIDIA 官方论坛明确说明项目自 2026-01-21 起已 [deprecated 且不再维护](https://forums.developer.nvidia.com/t/chatrtx-has-been-deprecated-this-forum-is-locked/365743)。旧营销页仍有 Download 文案不能覆盖更新的停用公告。 |
| Notta Windows Desktop | 排除 Windows 卡，Web 可在以后补 | [Notta 支持环境说明](https://support.notta.ai/hc/en-us/articles/18119588493467-Available-environment)推荐电脑使用 Web；[Notta Desktop 文档](https://support.notta.ai/hc/en-us/articles/48300234055707-Getting-Started-with-Notta-Desktop)当前 beta 只列 macOS，不存在已确认的 Windows 桌面入口。 |
| Amuse | 暂缓重新审核 | 原 `TensorStack-AI/AmuseAI` 当前会重定向到个人维护仓库，README 已出现新的 3.6.2 Windows 版本，但先前官方组织曾归档并标 Final Release，`amuse-ai.com` 本次请求又超时。需先确认当前发布者、官网、签名和长期下载入口，不能仅凭重定向恢复为官方 Windows 卡。 |
| Portia | 暂缓 | [Portia 官网](https://www.portia.live/)仍说明用于合规行业的 Agent SDK，但先前公开的 `portiaAI/portia-sdk-python` 地址当前返回 404，产品文档和长期仓库身份未收敛；不采用 Reddit 或第三方文章补证。 |
| Framer MCP Server | 不按官方 MCP 录入 | [Framer Server API 文档](https://www.framer.com/developers/server-api-introduction)只说明开发者可以自行构建 MCP Server，不等于 Framer 已发布官方 MCP Server。Framer 产品/API 可另做候选，但不能把示例措辞写成官方资源。 |
| Zep Graphiti MCP | 暂缓 | [官方文档](https://help.getzep.com/graphiti/getting-started/mcp-server)明确标为 experimental；如果后续录入，必须独立标记实验性并先审查本地运行与数据写入。 |

## 录入和验收清单

1. 在实际录入前重新读取最新目录，按 ID、显示名、别名、厂商域名和产品 URL 五个维度再去重；尤其不能把 Neon 数据库与 `opera-neon` 合并。
2. 一份厂商资料可同时出现在“全部 AI 厂商”和“全部 AI 可接入厂商”，但产品按页面用途分开；资源商店继续按宿主产品聚合，不在主页平铺 14 个 MCP。
3. 每个候选只添加本文列出的产品身份，不因为同一产品含 Web、SDK、CLI、MCP、Skill 或 Docker 再重复计算一级产品。
4. Sider 仅打开厂商 Windows 页面；其余候选均不得显示 Windows 一键安装按钮。
5. 所有资源先以 link-only 发布。后台不能下发 `npx`、`uvx`、pip、Docker、Shell、PowerShell、CMD 或任意配置写入；将来若做自动接入，必须由客户端固定模块、版本约束和本地白名单单独审核。
6. 对 Browserbase、Composio、Arcade、Apify、Mem0、Pinecone、Qdrant、Weaviate、Neon 和 New Relic增加权限说明；对删除、发送、写数据库、运行 Actor、访问登录态网站等动作要求用户确认。
7. 自动测试至少覆盖：固定数量增量、候选 ID 唯一、精确搜索、中文/英文 A-Z 路由、两类厂商页面分流、资源按宿主聚合、所有 URL 为 HTTPS、所有新资源无本地命令/安装 profile。
8. 发布前做脚本幂等性和既有记录语义审计：再次运行扩充脚本时目录哈希不变；除 `updatedAt` 外，不得修改已有 353 个厂商、559 个产品和 128 个资源的业务字段。
