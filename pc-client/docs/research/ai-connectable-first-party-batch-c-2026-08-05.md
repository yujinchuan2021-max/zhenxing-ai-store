# AI 可接入厂商第一方证据核对：Batch C

核对日期：2026-08-05  
范围：65 项 evidence queue 中 Batch A/B 之后的第 41–60 项。  
严格口径：只有官方材料明确说明 AI 接入、AI 宿主兼容、官方 MCP、AI API 或 AI 专用能力才记为 `confirmed`。通用 API、普通插件、脚本、WebDriver 或自动化接口不作 AI 接入推断。本轮不改 catalog、不改 state、不 `saveDraft`、不发布。

## 结果摘要

- `confirmed`：7 项
- `blocked`：13 项
- confirmed：Siemens Eigen Engineering Agent、Redis Insight、Neo4j Desktop/Enterprise Studio、Genesys Cloud、Dialpad、Cisco Webex。
- Redis 与 Neo4j 的证据是官方 MCP；Siemens、Genesys、Dialpad、Cisco 的证据是官方 AI 宿主/AI 产品能力。
- 其余产品本轮未取得满足严格口径的第一方 AI 接入证据。

## 逐项结果

| # | vendor / product | status | 官方证据与接入类型 | 对应一级产品 | 现有 category | category 判断 | 官方 URL |
|---:|---|---|---|---|---|---|---|
| 41 | Siemens / Designcenter NX | blocked | 本轮未找到 NX 明确 AI API、MCP 或 AI 宿主兼容证据 | Designcenter NX | 3D 与工业仿真 | 准确 | — |
| 42 | Siemens / Eigen Engineering Agent | confirmed | 生成式 AI 工程助手；连接 TIA Portal；可执行 PLC/HMI/设备配置等工程任务 | Eigen Engineering Agent / TIA Portal | 工程计算与仿真 | 不够准确；建议改为“工业自动化/工程 AI” | [Siemens Eigen Engineering Agent](https://www.siemens.com/de-ch/products/tia-portal/eigen-engineering-agent/); [Siemens launch release](https://press.siemens.com/global/en/pressrelease/siemens-launches-eigen-engineering-agent-bringing-purpose-built-ai-industrial) |
| 43 | Synopsys / Synopsys Verdi | blocked | 本轮未找到明确 AI 接入/AI 宿主兼容的一手证据 | Synopsys Verdi | 工程计算与仿真 | 基本准确；更接近芯片验证/EDA | — |
| 44 | Redis / Redis Insight | confirmed | 官方 Redis MCP；可被 MCP client 以自然语言访问 Redis；官方 Redis MCP 仓库面向 agentic applications | Redis / Redis Insight 生态 | 数据库与数据 | 准确；应补充数据库 MCP/AI 数据访问 | [Redis MCP docs](https://redis.io/docs/latest/integrate/redis-mcp/); [official Redis MCP repository](https://github.com/redis/mcp-redis) |
| 45 | Neo4j / Neo4j Desktop | confirmed | 官方 Neo4j MCP；AI assistants/agents 可连接 Neo4j，查询图谱、探索 schema、作为知识源 | Neo4j / Neo4j MCP | 数据库与数据 | 准确；应补充图数据库 MCP/知识图谱 | [Neo4j MCP](https://neo4j.com/docs/mcp/current/) |
| 46 | Neo4j / Neo4j Enterprise Studio | confirmed | 同一官方 Neo4j MCP 证据可连接 Neo4j 实例；但产品关系应指向 Neo4j MCP/数据库服务，不应把 Studio 本身当 MCP 产品 | Neo4j / Neo4j MCP | 数据库与数据 | 准确但需拆分一级产品关系 | [Neo4j MCP](https://neo4j.com/docs/mcp/current/) |
| 47 | Obsidian / Obsidian | blocked | 本轮未找到 Obsidian 官方 AI API/MCP/AI 宿主兼容证据；第三方插件不计入 | Obsidian | 文档与知识库 | 准确 | — |
| 48 | Discord / Discord | blocked | 本轮未找到 Discord 官方 AI 接入 API/MCP/AI 宿主兼容证据 | Discord | 项目与协作 | 基本准确；也可归社区/消息协作 | — |
| 49 | Opera / Opera Stable | blocked | 本轮未找到 Opera 官方 AI 接入 API/MCP/AI 宿主兼容证据；内置 AI 功能不能替代外部接入证据 | Opera | 浏览器与搜索 | 准确 | — |
| 50 | Mozilla / Mozilla Firefox | blocked | 本轮未找到 Firefox 官方 AI 接入 API/MCP/AI 宿主兼容证据 | Firefox | 浏览器与搜索 | 准确 | — |
| 51 | Graphisoft / Archicad | blocked | 本轮未找到明确 AI API/MCP/AI 宿主兼容的一手证据 | Archicad | 3D 与工业仿真 | 准确 | — |
| 52 | Vectorworks / Vectorworks Design Suite | blocked | 本轮未找到明确 AI API/MCP/AI 宿主兼容的一手证据 | Vectorworks Design Suite | 3D 与工业仿真 | 准确 | — |
| 53 | Dassault Systèmes / SOLIDWORKS Design | blocked | 本轮未找到明确 AI API/MCP/AI 宿主兼容的一手证据 | SOLIDWORKS | 3D 与工业仿真 | 准确 | — |
| 54 | Genesys / Genesys Cloud | confirmed | 官方 Genesys Cloud AI 能力/AI-powered customer experience；Genesys Cloud AI、AI Studio、虚拟代理/预测能力属于平台 AI 宿主 | Genesys Cloud CX | 客户服务 | 准确；建议补充客服 AI/虚拟代理 | [Genesys Cloud AI](https://www.genesys.com/capabilities/artificial-intelligence); [Genesys Cloud developer center](https://developer.genesys.cloud/) |
| 55 | Dialpad / Dialpad | confirmed | 官方 Dialpad AI；AI Assistant、实时转写/摘要与 AI 功能嵌入 Dialpad 工作流 | Dialpad Ai / Dialpad cloud communications | 客户服务 | 准确；建议补充语音客服/会议 AI | [Dialpad AI](https://www.dialpad.com/features/ai/) |
| 56 | Audacity / Audacity | blocked | 本轮未找到 Audacity 官方 AI API/MCP/AI 宿主兼容证据；普通插件/脚本不计入 | Audacity | 音频制作 | 准确 | — |
| 57 | Streamlabs / Streamlabs Desktop | blocked | 本轮未找到明确 AI 接入 API/MCP/AI 宿主兼容的一手证据 | Streamlabs Desktop | 直播与录制 | 准确 | — |
| 58 | Navicat / Navicat Premium | blocked | 本轮未找到 Navicat 官方 AI API/MCP/AI 宿主兼容证据；普通数据库连接能力不计入 | Navicat Premium | 数据库与数据 | 准确 | — |
| 59 | Octave / Octave BricsCAD | blocked | 本轮未找到明确 AI 接入/AI 宿主兼容的一手证据 | BricsCAD | 3D 与工业仿真 | 不够准确；产品更接近 CAD/工程设计 | — |
| 60 | Cisco / Webex | confirmed | 官方 Webex AI Assistant；AI 助手嵌入 Webex 会议、消息与协作流程 | Webex | 办公自动化 | 基本准确；建议补充会议/协作 AI | [Cisco Webex AI Assistant](https://www.webex.com/ai-assistant.html); [Webex developer platform](https://developer.webex.com/) |

## 关键边界结论

1. Neo4j Desktop 与 Neo4j Enterprise Studio 都可以复用同一个 Neo4j MCP 证据，但不能把两个桌面/管理产品分别描述成不同 MCP 产品；应建立“产品 → Neo4j 数据库/MCP 接入能力”的关系。
2. Redis Insight 的 confirmed 依据是 Redis 官方 MCP，不是 Redis Insight 的普通数据库 GUI 能力；产品层级应区分 Redis Insight、Redis 服务和 Redis MCP。
3. Siemens Eigen Engineering Agent 是明确的一级 AI 产品，不应归入普通“工程计算与仿真”而失去工业自动化 AI 特性。
4. Genesys、Dialpad、Cisco Webex 的本轮确认是平台内置 AI 宿主能力，不等价于已证明存在对外 AI API/MCP；接入类型应标为“内置 AI 宿主”，不要冒充外部 API。
5. blocked 只表示当前批次未获得符合严格口径的一手证据，不代表这些产品绝对没有 AI 功能。

## 后续缺口

- 继续核对 Genesys、Dialpad、Webex 是否有独立 AI API、Webhook、OAuth 或 MCP，并与内置 AI 宿主分开记录。
- 对 Obsidian、Discord、Opera、Firefox、CAD/EDA、音频与直播产品继续做厂商开发者门户定向检索。
- 对 category 不准确的 Eigen Engineering Agent、BricsCAD 候选建立分类修订建议，但本轮不改 catalog。
