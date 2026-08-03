# 目录研究欠账闭环审计

审计日期：2026-08-03（Asia/Shanghai）

## 结论

本报告以最终的 `admin/data/catalog-v1.json` 为唯一去重基线：`updatedAt = 2026-08-03T16:30:00.000Z`，共 **369 个厂商、596 个一级产品、142 项生态资源**。已逐份复核 `docs/research/*.md`，并把自动发现文件 `output/catalog-research/official-product-candidates.json` 中 `score >= 10` 的结果按官方产品身份重新去重。

当前真正仍缺的目录欠账是：

- **20 个一级产品**：19 个可按本文边界录入，1 个（Superhuman Go）需要发布前最后核验；
- **1 个现有产品入口修正**：Adobe Creative Cloud 增加明确的 Windows 官方下载入口，不新建产品；
- **1 个品牌身份迁移**：Coda / Coda AI 迁移为 Superhuman Docs，保留稳定 ID，不重复建卡；
- **2 项可录入的官方 MCP 资源**：Anytype MCP、Benchling MCP，均先使用 `resource-link`；
- **1 项企业受限资源**：Zep Memory MCP，只能标记“企业版/需厂商启用”，不能显示普通一键安装；
- 其余研究候选均已入库、属于现有产品的入口/功能，或因停服、平台不符、身份不清、预览状态及安全边界而明确排除。

本文件是数据实施清单，不授予本地执行能力。图形产品只允许打开厂商长期维护的官方产品/下载页；CLI 只有在客户端固定模块完成版本、依赖、更新、检测、卸载和回滚审核后，才可从“官方说明入口”升级为“一键安装”。

## 自动发现数据的闭环结果

自动发现快照覆盖 353 个厂商、957 个页面；共得到 310 条 `score >= 10` 记录。其中 251 条在扫描时已映射到 85 个现有产品组，59 条没有映射。URL 规范化后为 55 组，再按同一官方产品身份合并 Airtable 多平台页等重复项，得到 53 个语义候选：

| 审核结果 | 数量 | 当前处理 |
| --- | ---: | --- |
| 独立、正式命名的产品身份 | 26 | 17 个已在当前 596 产品中；9 个仍缺，已列入下方产品表 |
| 现有产品入口、功能、套件或已收录身份 | 20 | 不新建一级产品；仅 Adobe Creative Cloud 尚需补明确下载入口 |
| 明显误报或当前范围外 | 7 | 不进入正式目录 |

当前已闭环的 17 个独立高分产品为：Asana AI Teammates、Autodesk Flow Studio、Webex AI Agent、Cloudflare Agents、Confluent Streaming Agents、Databricks Agent Bricks、Databricks Lakebase、Grafana Agent Observability、HubSpot Customer Agent、HubSpot Data Agent、HubSpot Prospecting Agent、Neo4j Aura Agent、ServiceNow Build Agent、Sentry Seer Agent、Tabnine CLI、UiPath Agent Builder、Zoom Virtual Agent。它们不在本报告重复列入欠账。

### 高分候选中仍缺的 9 个独立产品

这 9 项已合并进下方完整的 20 产品清单：Databricks Apps、来也智能体文档处理、来也 RPA、Neo4j Enterprise Studio、Open Interpreter Desktop、Qlik Discovery Agent、Siemens Eigen Engineering Agent、ThoughtSpot Analyst Studio、UiPath Studio。

### 高分候选中不应新建一级产品的 20 项

| 候选 | 处理 | 原因 |
| --- | --- | --- |
| Adobe Creative Cloud 下载页 | 更新现有卡片 | 产品已存在，只缺明确的 Windows 下载入口 |
| Airtable Downloads / Windows / macOS | 已闭环 | 当前 `airtable-platform` 已合并 Web 与 Windows 入口；macOS 不属于本版客户端 |
| BrowserStack Self-Healing Agent / Test Failure Analysis | 现有产品功能 | 属于 BrowserStack Test Platform 的 Agent 能力，不是两个新产品 |
| Cisco Collaboration AI | 现有产品功能 | 属于现有 Webex / Cisco AI 能力；职责不同的 Webex AI Agent 已单列 |
| Databricks Platform | 已收录 | Data Intelligence Platform 已存在；不能把平台总览再建卡 |
| Factory Desktop | 已闭环 | 当前 `factory-droids` 已按同一产品的 Web/Windows 入口合并；Factory CLI 继续独立 |
| MongoDB AI Search & Retrieval | 现有产品能力 | 属于 MongoDB Platform 的 AI 搜索能力 |
| MongoDB Atlas Vector Search | 现有产品能力 | 属于 MongoDB Platform / Atlas，不重复产品身份 |
| Msty Go | 已收录 | 当前目录已有正式产品身份 |
| Notion AI Use Cases | 现有产品功能 | 用例页归入现有 Notion 产品 |
| ON1 Photo Studio | 套件/订阅 | 是包含现有 ON1 工具的订阅集合，不是新的本机安装身份 |
| OpenHands Agent Canvas | 已收录 | 当前目录已有正式产品身份 |
| Postman Agent Mode | 现有产品功能 | 属于 Postman 产品内模式 |
| Sentry AI Agent Tracing | 现有产品功能 | 是 Sentry 的 Agent 可观测能力；最终用户 Agent 产品为 Seer |
| ServiceNow AI Agents | 复核现有重复 | 当前已存在 `servicenow-ai-agents`，但与 `servicenow-platform` 的能力边界重叠；不再新增，后续应做一次合并审计 |
| ServiceNow Customer Service Management | 范围外 | 通用业务产品，不因页面出现 AI 文案就变成新的 AI 产品身份 |
| ServiceNow Process Mining | 范围外 | 通用业务产品，不是本轮缺失的独立 AI 产品 |
| ServiceNow App Engine | 范围外 | Build Agent 的依赖平台，不重复成 Agent 产品 |
| UiPath Agent Builder for Testers | 现有产品场景 | 属于 Agent Builder / 测试场景，不建立第二张 Agent Builder 卡 |
| Warp Gemini CLI | 集成用例 | 是 Warp 对 Gemini CLI 的集成说明，不是 Warp 发布的新产品 |

### 高分候选中的 7 个误报/范围外结果

| 候选 | 排除原因 |
| --- | --- |
| Adobe Creative Cloud Cleaner Tool | 故障清理工具，不是 AI 产品 |
| Adobe Limited Access Repair Tool | 支持修复工具，不是 AI 产品 |
| Adobe Log Collector Tool | 日志采集工具，不是 AI 产品 |
| Docker CLI | 通用运行环境/开发工具；不因 AI 产品依赖 Docker 就建立 AI 产品卡 |
| ElevenLabs Mobile App | 移动端，不属于当前 Windows 目录 |
| Lovable Download | 候选页未能由官方材料确认独立 Windows 桌面产品 |
| Trimble Estimation Desktop | 未发现可成立的 AI/MCP 产品边界 |

## 可直接录入的 19 个产品

表中的 `desktop-official` 只表示打开官方产品或下载页，不下载、解析、校验或启动安装器；`cli-official` 只表示独立 CLI 身份及官方安装说明，不代表已经进入受管安装白名单。

| 厂商 / 建议 ID | 产品 / 建议 ID | `directoryKind` | `productType` | 官网 / 教程 | 精确边界与一手证据 |
| --- | --- | --- | --- | --- | --- |
| Skales / `skales` | Skales / `skales-desktop` | `ai-tool` | `desktop-official` | [官网](https://skales.app/) / [文档](https://docs.skales.app/) | 官方提供 Windows 10/11 x64 EXE、本地优先和 SHA-512，但明确尚未代码签名，会触发 SmartScreen；只能打开官方页，不能进入受管下载白名单。 |
| PixVerse / 复用 `pixverse` | PixVerse CLI / `pixverse-cli` | `ai-tool` | `cli-official` | [产品入口](https://pixverse.ai/en) / [官方 CLI 说明](https://pixverse.ai/en/blog/pixverse-cli-generate-ai-videos-images-from-terminal) | 独立命令行产品，要求 Node.js 20+、OAuth 和账户点数；生成会计费。固定版本、包身份、凭据、更新和卸载未审完前仅打开说明。 |
| PTC / `ptc` | Onshape AI Advisor / `onshape-ai-advisor` | `ai-connectable` | `web` | [AI Advisor](https://www.onshape.com/en/features/ai-advisor) / [更新说明](https://www.onshape.com/en/resource-center/what-is-new/ai-advisor-configurable-variable-studios-simulation) | Onshape 内置、以官方帮助内容为依据的 Advisor，不是自动生成 CAD 设计；可用性受 Professional/Enterprise 方案和管理员设置约束。 |
| ALLPLAN / `allplan` | ALLPLAN / `allplan` | `ai-connectable` | `desktop-official` | [产品页](https://www.allplan.com/products/allplan/) / [2026 更新说明](https://www.allplan.com/us_en/system/releasenotes/2026/allplan-2026-0-1/) | Windows BIM 产品，AI Visualizer V2 是产品内能力；许可证、显卡和 Windows 11 要求以[官方系统要求](https://www.allplan.com/fileadmin/user_upload/shared-files/pdf/System_requirements_ALLPLAN_2026_EN.pdf)为准，只开官方入口。 |
| PTC / `ptc` | PTC Creo / Creo+ / `ptc-creo` | `ai-connectable` | `desktop-official` | [能力页](https://www.ptc.com/en/products/creo/capabilities) / [Creo 13 公告](https://www.ptc.com/en/news/2026/ptc-brings-ai-powered-guidance-to-the-design-environment-with-creo-13) | 合并 Creo 与 Creo+ 同一产品族；Advise 可作为当前能力，Assist 仍为 Beta、Automate 仍为 Alpha，卡片不得把预览能力写成 GA。 |
| BioRender / `biorender` | BioRender / `biorender-ai` | `ai-tool` | `web` | [AI 工具](https://www.biorender.com/ai-tools) / [AI Figure Generator 教程](https://help.biorender.com/hc/en-gb/articles/37585527817629-How-to-generate-custom-and-fully-editable-figures-with-BioRender-AI) | 科研插图 Web 产品；部分 AI 能力仍为 Beta，生成结果需人工检查，并受计划、点数、发布和许可条款约束。 |
| Benchling / `benchling` | Benchling AI / `benchling-ai` | `ai-connectable` | `web` | [Benchling AI](https://www.benchling.com/ai) / [AI Connectors](https://www.benchling.com/ai/connectors) | 企业生命科学研发平台；涉及租户、实验数据、管理员权限和合规要求。产品卡与 MCP 资源分开，不能把租户数据复制到目录。 |
| Anytype / `anytype` | Anytype Desktop / `anytype-desktop` | `ai-connectable` | `desktop-official` | [官网](https://anytype.io/) / [安装说明](https://doc.anytype.io/anytype-docs/getting-started/install-and-setup) | 官方 Windows 桌面产品、本地优先；只打开官方长期下载入口。Web、桌面和本地 API 属于同一图形产品身份。 |
| Anytype / `anytype` | Anytype CLI / `anytype-cli` | `ai-connectable` | `cli-official` | [CLI 文档](https://developers.anytype.io/docs/examples/featured/cli/) / [开发示例总览](https://developers.anytype.io/docs/examples/overview/) | CLI 必须与可视化桌面产品分开，避免用户误认为是 GUI；跨平台无头服务的版本、服务生命周期和卸载尚未经过客户端固定模块审核。 |
| Corel / 复用 `corel` | PaintShop Pro / `paintshop-pro` | `ai-tool` | `desktop-official` | [产品页](https://www.paintshoppro.com/en/products/paintshop-pro/) / [Ultimate 页](https://www.paintshoppro.com/en/products/paintshop-pro/ultimate/) | 官方仍提供 Windows 购买/试用及 AI 能力，但公开版本品牌主要停留在 2023；可收录官方链接，不能描述为“最新持续活跃版本”，也不能托管安装包。 |
| Databricks / 复用 `databricks` | Databricks Apps / `databricks-apps` | `ai-connectable` | `web` | [官方产品页](https://www.databricks.com/product/databricks-apps) / [同页文档入口](https://www.databricks.com/product/databricks-apps) | 是在 Databricks 上构建和托管数据/AI 应用的独立正式产品；不要与 Data Intelligence Platform 或 Agent Bricks 合并，也不要代管工作区凭据。 |
| 来也科技 / 复用 `laiye` | 来也智能体文档处理 / `laiye-adp` | `ai-tool` | `web` | [产品页](https://laiye.com/product/adp-platform) / [官方文档](https://documents.laiye.com/) | 文档理解与处理产品；API、MCP、CLI、Skill 是接入入口/资源，不重复建一级产品，也不把客户文档上传到目录。 |
| 来也科技 / 复用 `laiye` | 来也 RPA / `laiye-rpa` | `ai-connectable` | `desktop-official` | [产品页](https://laiye.com/product/rpa-platform) / [官方文档](https://documents.laiye.com/) | Windows/Linux 流程自动化产品，具备大模型接入；自动化可操作业务系统，产品卡必须提示权限和确认边界。官方页未给稳定直链，只打开产品/联系入口。 |
| Neo4j / 复用 `neo4j` | Neo4j Enterprise Studio / `neo4j-enterprise-studio` | `ai-connectable` | `desktop-official` | [官方产品页](https://neo4j.com/product/enterprise-studio/) / [同页部署入口](https://neo4j.com/product/enterprise-studio/) | 独立命名的企业图数据开发/管理产品，不是 Aura Agent，也不是现有 Neo4j Desktop 的别名；下载、授权和部署由 Neo4j 账户管理，只开官方入口。 |
| Open Interpreter / 复用 `open-interpreter` | Open Interpreter Desktop / `open-interpreter-desktop` | `ai-tool` | `desktop-official` | [桌面产品](https://www.openinterpreter.com/desktop) / [安装文档](https://www.openinterpreter.com/docs/desktop/install) | 与现有 CLI 分开。它可跨应用、文件和浏览器执行操作，首次运行涉及 UAC 和工作目录；卡片必须提示高权限、凭据及提交/发送/删除前确认。 |
| Qlik / 复用 `qlik` | Qlik Discovery Agent / `qlik-discovery-agent` | `ai-tool` | `web` | [官方产品页](https://www.qlik.com/us/products/discovery-agent) / [同页产品说明](https://www.qlik.com/us/products/discovery-agent) | 基于 Qlik Analytics Engine 发现异常和洞察；依赖 Qlik 应用、数据权限和企业账户，不是通用本地 Agent。 |
| Siemens / 复用 `siemens` | Eigen Engineering Agent / `siemens-eigen-engineering-agent` | `ai-connectable` | `desktop-official` | [官方公告](https://press.siemens.com/global/en/pressrelease/siemens-launches-eigen-engineering-agent-bringing-purpose-built-ai-industrial) / [TIA Portal 产品页](https://www.siemens.com/en-us/products/tia-portal/) | 已 GA，但它是连接 TIA Portal 的受许可工程组件，需要受支持版本、组织账户和许可证；不能宣传为通用独立桌面 Agent，也不能自动安装。 |
| ThoughtSpot / 复用 `thoughtspot` | ThoughtSpot Analyst Studio / `thoughtspot-analyst-studio` | `ai-connectable` | `web` | [官方产品页](https://www.thoughtspot.com/product/analyst-studio) / [同页产品说明](https://www.thoughtspot.com/product/analyst-studio) | 数据团队的 SQL/Python 与 AI 分析工作区，可接入 OpenAI/Claude 等模型；连接、查询和模型凭据由 ThoughtSpot 账户管理。 |
| UiPath / 复用 `uipath` | UiPath Studio / `uipath-studio` | `ai-connectable` | `desktop-official` | [Studio 产品页](https://www.uipath.com/product/studio) / [Agent Builder 产品页](https://www.uipath.com/platform/agentic-automation/agentic-ai/agent-builder) | Studio 是 Windows 自动化开发产品，和当前已收录的 Agent Builder 有依赖/宿主关系但不是同一产品；只打开官方试用/下载页，执行自动化前仍需权限和人工确认。 |

## 发布前最后核验的 1 个产品

| 厂商 / 建议 ID | 产品 / 建议 ID | 建议字段 | 冲突与发布门禁 |
| --- | --- | --- | --- |
| Superhuman / `superhuman` | Superhuman Go / `superhuman-go` | `directoryKind: ai-tool`；`productType: desktop-official`；[产品页](https://superhuman.com/products/go-ai-assistant)；[Windows 安装帮助](https://help.superhuman.com/hc/en-us/articles/46507570953613-How-do-I-install-Superhuman-Go-for-Windows-or-Superhuman-Go-for-Mac) | 官方帮助中心已有 Windows 安装、部署和使用文档，但营销产品页仍出现桌面版“coming soon”的冲突文案。发布前必须用官方 Windows 下载入口做一次可达性/签名归属核验；通过后仍只开官方页，不缓存安装包。 |

## 现有卡片的 1 个入口修正

| 现有产品 | 修正 | 依据与边界 |
| --- | --- | --- |
| `adobe-creative-cloud` | 在现有产品卡增加 `desktop` 入口，目标为 Adobe 维护的 Windows 下载页；不新建“Creative Cloud Download”产品 | [Adobe Creative Cloud 官方下载页](https://www.adobe.com/download/creative-cloud)。当前卡已是 `desktop-official`，本次只补明确按钮/URL，仍由厂商管理安装和卸载。 |

## 现有身份的 1 个品牌迁移

| 当前身份 | 目标身份 | 处理 |
| --- | --- | --- |
| vendor `coda` / product `coda-ai` | Superhuman Docs / Superhuman Docs AI | [官方迁移说明](https://help.superhuman.com/hc/en-us/articles/46210093285773-What-s-changing-Coda-becomes-Superhuman-Docs)确认 Coda 已于 2026-07-08 更名。保留现有稳定 ID、历史别名和搜索词，更新显示名、官网与说明；[桌面帮助](https://help.superhuman.com/hc/en-us/articles/46875595711117-Superhuman-Docs-desktop-app)目前仍只确认 macOS，不能新增 Windows 安装按钮。 |

## 可录入的 2 项官方资源

两项都先使用 `resource-link`；后台只保存官方说明、发布者、权限、兼容关系和状态，不能下发 `npx`、Shell、PowerShell、CMD、Docker 或任意配置写入。

| 建议资源 ID | 发布者 / 关联产品 | 官方来源 | 精确边界 |
| --- | --- | --- | --- |
| `anytype-mcp` | Anytype / `anytype-desktop` | [Anytype MCP 官方文档](https://developers.anytype.io/docs/examples/featured/mcp/) | 官方包 `@anyproto/anytype-mcp`；依赖 Anytype API key 和用户授权范围。当前只展示接入文档，不自动安装、写客户端配置或保存密钥。 |
| `benchling-mcp` | Benchling / `benchling-ai` | [Benchling MCP 配置文档](https://help.benchling.com/hc/en-us/articles/40342713479437-Configure-Benchling-s-MCP-Server-for-other-MCP-clients) | 官方租户端点为 `https://<tenant>.mcp.benchling.com/mcp`，涉及企业租户、OAuth/DCR、管理员策略和敏感实验数据；端点是模板，不是公共固定 URL。 |

## 受限和未来资源

| 候选 | 结论 | 原因与证据 |
| --- | --- | --- |
| Zep Memory MCP / `zep-memory-mcp` | P1 受限，可记录但不作为普通安装项 | [官方文档](https://help.getzep.com/v3/memory-mcp-server)说明仅 Enterprise Plan、需厂商按账户启用并依赖企业 IdP；可搜索和新增用户记忆。 |
| Onshape FeatureScript MCP | 暂不发布 | [PTC Onshape Labs 公告](https://www.ptc.com/en/news/2026/onshapelabs)只把它列为预计即将提供的未来能力，不能提前伪装成可用 MCP。 |
| Zep Graphiti MCP | 暂不发布 | [官方文档](https://help.getzep.com/graphiti/getting-started/mcp-server)明确标为 experimental；需先审查本地运行、数据写入和删除边界。 |
| Framer MCP Server | 不按官方资源录入 | [Framer Server API 文档](https://www.framer.com/developers/server-api-introduction)只说明开发者可以自行构建 MCP，不等于 Framer 已发布官方 MCP Server。 |

## 明确排除或继续暂缓的产品候选

### 已停止、归档或不再适合新用户

| 候选 | 结论与一手依据 |
| --- | --- |
| OpenAI Sora（旧产品身份） | [OpenAI 官方公告](https://openai.com/index/sora-is-here/)已标明旧 Sora 产品自 2026-04-26 起不再提供；不作为当前活跃子产品恢复。 |
| Roo Code | [官方仓库](https://github.com/RooCodeInc/Roo-Code)已归档并说明服务关闭；不再作为当前维护产品。 |
| AgentGPT | [官方仓库](https://github.com/reworkd/AgentGPT)已归档；不进入正式目录。 |
| NVIDIA ChatRTX | [NVIDIA 官方论坛公告](https://forums.developer.nvidia.com/t/chatrtx-has-been-deprecated-this-forum-is-locked/365743)确认 deprecated 且不再维护；旧下载文案不能覆盖新公告。 |
| Backyard AI Desktop | [官方 Desktop 页](https://desktop.backyard.ai/)和[官方更新记录](https://backyard.ai/changelog)已将桌面产品标为 deprecated / no longer supported。 |
| Void | [官方仓库](https://github.com/voideditor/void)说明 IDE 工作已暂停；即使旧 Windows Beta 仍可下载，也不视为当前维护产品。 |
| Firebase Studio | [官方状态页](https://firebase.google.com/docs/studio)已停止新用户注册和新工作区创建；现有用户可用不等于适合新增。 |
| Microsoft AutoGen | [官方仓库](https://github.com/microsoft/autogen)已进入维护模式，新项目转向 Microsoft Agent Framework；只保留迁移/兼容说明。 |
| KritaMCP | [上游仓库](https://github.com/halby24/KritaMCP)已归档，且包含本地服务与 Python 执行面；拒绝进入安装白名单。 |

### Windows、发布者或长期分发身份尚未成立

| 候选 | 暂缓原因 |
| --- | --- |
| Notta Windows Desktop | [官方环境说明](https://support.notta.ai/hc/en-us/articles/18119588493467-Available-environment)推荐电脑使用 Web；[Desktop 文档](https://support.notta.ai/hc/en-us/articles/48300234055707-Getting-Started-with-Notta-Desktop)当前只列 macOS Beta。 |
| Dia for Windows | [Windows 官方页](https://www.diabrowser.com/windows)仍是 waitlist / coming soon，尚无正式 Windows 下载。 |
| Fellou | [官网](https://fellou.ai/)没有可稳定证明当前 Windows 长期分发的明确材料；旧发布说明中的 Windows “soon”不能当成已发布。 |
| Arc for Windows | [Arc 官网](https://arc.net/)已把新 AI 浏览器方向转向 Dia；Windows 旧版仍有维护资料，但不适合作为新的活跃 AI 产品缺口加入。 |
| Amuse | [原官方仓库](https://github.com/TensorStack-AI/AmuseAI)经历归档/Final Release 与发布者重定向，官网可达性也不稳定；需先确认当前发布者、签名和长期下载入口。 |
| Portia | [官网](https://www.portia.live/)仍描述 Agent SDK，但原公开仓库身份和长期文档未收敛；不采用第三方文章补证。 |
| Faraday.dev、SillyTavern、RisuAI、ChatALL、NextChat、PearAI | 官方站点/仓库没有同时满足当前 Windows 产品身份、长期维护和稳定官方分发三项要求；不使用第三方下载站补证。 |

### 社区扩展不冒充厂商官方资源

以下候选可保留研究链接，但不得标成宿主厂商官方 MCP，也不得直接进入一键安装白名单：`maorcc/gimp-mcp`（任意 Python 执行且本地 TCP 未见认证）、第三方 Adobe Premiere/After Effects MCP、REAPER/Audacity/FL Studio/TouchDesigner 社区 MCP、ADB MCP PoC，以及 DaVinci Resolve MCP Professional 社区实现。即使某个仓库热门或被市场收录，也只能以实际发布者身份单独审核来源、版本、权限、端口、凭据、更新与卸载。

## 实施顺序

1. 先录入 19 个可直接产品、Adobe 入口修正和 Superhuman Docs 身份迁移；每次写入前按 ID、显示名、旧品牌、官网域名和 URL 再去重。
2. Superhuman Go 只有通过官方 Windows 入口与签名归属复核后才录入；未通过就继续留在发布门禁。
3. Anytype MCP 与 Benchling MCP 只以 `resource-link` 发布；Zep Memory MCP 标为企业受限，不提供普通安装按钮。
4. 所有新增厂商 Logo 继续遵守独立 Logo 审计结论；没有可再分发的一方素材时使用文字回退，不抓搜索图片、第三方 Logo 站或 GitHub 平台通用图标。
5. 发布后验证固定计数、ID 唯一、精准搜索、中英文 A-Z、两个厂商频道分流、资源按宿主产品聚合、所有 URL 为 HTTPS、图形产品无受管安装 profile、CLI 无未经审核的一键执行。
