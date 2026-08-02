# 枕星 AI：AI 可接入厂商扩充调研（第四批：云平台、数据与商业服务）

- 日期：2026-08-02
- 状态：目录录入前的官方证据审查，不代表已经发布
- 范围：云平台、数据库、流数据、支付、建站、内容平台、营销数据与客户服务

## 排重与发布边界

- 本轮开始前核对了 `admin/data/catalog-v1.json`：当前为 158 个厂商、292 个产品、101 项生态资源。
- Microsoft 的 `microsoft-azure-mcp` 与 Amazon Web Services 的 `aws-mcp-servers` 已存在，本批不重复建厂商或资源；补建各自缺失的 AI 可接入产品卡，并把既有资源关联回产品。
- 下列候选 ID 已与当前厂商、产品和资源 ID 精确比对，均未占用。
- 只采用厂商官方文档、厂商官方开发者站点或厂商官方 GitHub 组织仓库；第三方 MCP 市场、个人仓库和转载文章不作为录入证据。
- 本批所有资源首录均使用 `resource-link`：只打开官方接入说明，不安装包、不写宿主配置、不保存 OAuth Token、PAT、API Key、数据库密码或 Client Secret。
- 后续如需“一键接入”，只能使用客户端内置、版本化并经过验收的固定模块。后台只能选择模块和填写已声明参数，不能下发命令、脚本、任意 URL 或可执行文件。

## 已有条目复核

| 厂商 / 产品 | 当前资源 ID | 官方证据 | 本轮结论 |
| --- | --- | --- | --- |
| Microsoft / Azure | `microsoft-azure-mcp` | [Azure MCP Server 官方文档](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/)、[Microsoft 官方 MCP 仓库](https://github.com/microsoft/mcp) | 保留并更新现有条目，新增缺失的 `azure-cloud-platform` 产品关联；不得新建第二个 Azure MCP。资源仍只打开官方说明，创建、修改或删除 Azure 资源前必须确认 |
| Amazon Web Services / AWS | `aws-mcp-servers` | [AWS Labs 官方 MCP Servers 仓库](https://github.com/awslabs/mcp) | 保留现有目录型资源，新增缺失的 `aws-cloud-platform` 产品关联；各服务器成熟度不同，不能把整个仓库统一标成生产可用或一键安装 |

## 建议录入清单

| # | 厂商 / 产品 | 建议 ID | 官方证据与 AI 宿主 | 主要权限风险 | 首录方式 |
| --- | --- | --- | --- | --- | --- |
| 1 | Databricks / Databricks Data Intelligence Platform | vendor `databricks`；product `databricks-data-intelligence-platform`；resource `databricks-managed-mcp-directory` | [Databricks Managed MCP Servers](https://docs.databricks.com/aws/en/agents/mcp/managed-mcp)、[连接 AI 助手与编码代理](https://docs.databricks.com/aws/en/generative-ai/mcp/connect-clients)；官方覆盖 Claude、Claude Code、ChatGPT、Cursor、Windsurf、Replit 等 MCP 客户端 | 功能仍处于不同 Preview/Beta 阶段；Databricks SQL MCP 可读写数据并创建数据管道，Unity Catalog 函数可执行预定义业务逻辑；端点随工作区和资源变化，OAuth Scope、Unity Catalog 权限与网络白名单必须最小化 | **是，`resource-link`**。该资源是“官方托管 MCP 目录”，不能伪造一个统一固定端点 |
| 2 | Snowflake / Snowflake AI Data Cloud | vendor `snowflake`；product `snowflake-ai-data-cloud`；resource `snowflake-managed-mcp` | [Snowflake-managed MCP server](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp)；官方示例覆盖 Claude、ChatGPT、Cursor 与其他兼容客户端 | 可暴露 Cortex Analyst、Cortex Search、Cortex Agent、SQL 执行、UDF 和存储过程；存在数据泄露、工具投毒、工具遮蔽、循环调用与计算费用风险；服务 URL 随账号、数据库、Schema 和服务名变化 | **是，`resource-link`**。只打开创建、授权和连接说明，不替用户创建 Snowflake 对象 |
| 3 | Redis / Redis | vendor `redis`；product `redis-database`；resource `redis-mcp-server` | [Redis MCP](https://redis.io/docs/latest/integrate/redis-mcp/)、[客户端配置](https://redis.io/docs/latest/integrate/redis-mcp/client-conf/)；官方示例覆盖 Claude Desktop、VS Code/GitHub Copilot 与 OpenAI Agents | 通用 Redis MCP 可读取、写入、查询数据并执行部分服务器管理；数据库密码、Redis Cloud API Key/Secret 和生产数据都属于高敏感范围 | **是，`resource-link`**。即使官方提供 `uvx`、Docker 等方式，也要等固定版本、哈希、只读策略和卸载收据完成后再评审自动部署 |
| 4 | Neo4j / Neo4j Graph Database | vendor `neo4j`；product `neo4j-graph-database`；resource `neo4j-mcp-server` | [Neo4j MCP](https://neo4j.com/docs/mcp/current/)、[客户端配置](https://neo4j.com/docs/mcp/current/client-configuration/)；官方覆盖 Claude Code、Claude Desktop、VS Code、Cursor 等兼容客户端 | `NEO4J_READ_ONLY` 默认是 `false`，`write-cypher` 可执行创建、修改和删除；还涉及数据库账号、Bearer/Basic 凭据、APOC 与可选 GDS 能力。官方要求生产环境使用受限账号并审查生成的 Cypher | **是，`resource-link`**。以后固定模块必须默认 `NEO4J_READ_ONLY=true`，不能默认开放写工具 |
| 5 | Confluent / Confluent Cloud | vendor `confluent`；product `confluent-cloud`；resources `confluent-cloud-global-mcp`、`confluent-cloud-regional-mcp` | [Confluent Managed MCP Servers](https://docs.confluent.io/cloud/current/ai/ai-tools/managed-mcp-server.html)；官方覆盖 Claude Code、Cursor、VS Code/GitHub Copilot | 两个端点均只读，但可枚举环境与集群、读取 Topic 样本消息、Schema、Connector 错误和指标；Basic API Key、组织 ID、云区域与私网拓扑都不可写入普通目录或日志 | **是，两个独立 `resource-link`**。Global 与 Regional 的 URL、Key 类型和可见数据不同，不能合成一个虚假资源 |
| 6 | PayPal / PayPal Commerce Platform | vendor `paypal`；product `paypal-commerce-platform`；resource `paypal-mcp-server` | [PayPal 官方 MCP 公告与接入说明](https://developer.paypal.com/community/blog/paypal-model-context-protocol/)、[PayPal Agent Toolkit 官方仓库](https://github.com/paypal/agent-toolkit)；官方明确支持 Claude Desktop、Cursor、通用 MCP 客户端及 OpenAI Agent SDK 等框架 | 工具可创建、发送或取消发票，创建订单、付款、退款并处理争议；任何误调用都可能产生真实商户和资金影响，Client ID/Secret 与 Access Token 必须留在官方授权或安全凭据存储中 | **是，`resource-link`**。首录只提供官方远程/本地两种方案说明；自动化评审必须先锁定 Sandbox，生产支付逐次确认 |
| 7 | Wix / Wix Platform | vendor `wix`；product `wix-platform`；resource `wix-mcp` | [Wix MCP 官方说明](https://dev.wix.com/docs/sdk/articles/use-the-wix-mcp/about-the-wix-mcp)；官方列出 Claude、Cursor、Copilot、Windsurf、VS Code、n8n 等宿主 | 除文档检索外，`CallWixSiteAPI` 与 `ManageWixSite` 可以调用站点 API、创建或管理站点；API Key、Wix Account ID 与站点选择属于敏感参数，所有工具当前默认启用 | **是，`resource-link`**。不得因为官方存在 Node/npm 启动方式就直接开启一键部署 |
| 8 | Automattic / WordPress.com | vendor `automattic`；product `wordpress-com`；resource `wordpress-com-mcp` | [WordPress.com MCP](https://developer.wordpress.com/docs/mcp/)、[工具与安全确认规则](https://developer.wordpress.com/docs/mcp/tools-reference/)；官方覆盖 Claude Desktop、Claude Code、ChatGPT、Codex、VS Code、Cursor | 可读写文章、页面、评论、媒体、插件、主题、站点设置和 DNS；错误操作可能直接发布内容、切换主题、改变域名或中断网站。官方服务对写、更新、删除强制显式确认 | **是，`resource-link`**。这是 WordPress.com 托管服务，不得描述成所有自托管 WordPress.org 站点通用 |
| 9 | Semrush / Semrush | vendor `semrush`；product `semrush-platform`；resource `semrush-mcp` | [Semrush MCP 官方 API 文档](https://developer.semrush.com/api/v3/introduction/semrush-mcp/)、[Semrush MCP 产品说明](https://www.semrush.com/kb/1618-mcp)；官方覆盖 ChatGPT、Claude、Claude Code、Cursor、VS Code、Perplexity、Antigravity 等 | 当前连接为只读，但会访问客户域名、关键词、竞争情报、流量与项目数据并消耗订阅/API Units；OAuth 或 API Key 不得进入目录数据。官方已注明 Gemini CLI 支持停止，不能继续把 `gemini-cli` 作为目标 | **是，`resource-link`**。远程端点固定，但套餐、配额和宿主支持仍会变化，先保持官方说明入口 |
| 10 | Intercom / Intercom Platform | vendor `intercom`；product `intercom-platform`；resource `intercom-mcp-server` | [Intercom MCP 官方开发者文档](https://developers.intercom.com/docs/guides/mcp)；官方列出 Claude Desktop、Claude Code、OpenAI、Claude.ai、Cursor、Windsurf、VS Code | 当前只支持美国区工作区；可读取联系人、公司、会话与客户支持内容，也需要“读写文章”权限，涉及客户 PII 和 Help Center 内容变更 | **是，`resource-link`**。优先 OAuth；Bearer Token 仅由用户显式配置，目录和普通日志不得保存 |
| 11 | Intercom / Fin | 复用 vendor `intercom`；product `intercom-fin`；resource `intercom-fin-agent-api-mcp` | [Fin Agent API MCP Server](https://www.intercom.com/help/en/articles/15481203-fin-agent-api-mcp-server)；官方给出 Claude Desktop、Claude Code 与通用 HTTP MCP 配置 | Beta 功能；可查询知识库、开启对话并运行 Fin Procedure，例如退款、升级、取消等业务流程。Teammate 端使用 API Key/OAuth，终端用户端使用服务端签发 JWT；Messenger Secret 绝不能下发到客户端 | **是，`resource-link`**。它与通用 Intercom MCP 是两个产品边界，不得合并成一个资源 |

## 必须拆开的资源

### Confluent Cloud

官方要求按能力和区域连接两个托管服务器：

- `confluent-cloud-global-mcp`：固定入口 `https://api.confluent.cloud/mcp/v1`，用于环境、集群、Connector 与指标。
- `confluent-cloud-regional-mcp`：动态入口 `https://mcp.<region>.<cloud>.confluent.cloud/mcp/v1/organizations/<org_id>`，用于 Topic、Schema 和消息样本。

两者认证 Key 类型、网络范围和可见数据不同。后台即使以后调用固定远程模块，也只能让用户填写受约束的 `region`、`cloud`、`org_id`，不能接受任意服务器 URL。

### Intercom

- `intercom-mcp-server` 是面向 Intercom 工作区数据的通用 MCP，当前只支持美国区工作区。
- `intercom-fin-agent-api-mcp` 是 Fin Agent API 的 Beta 能力，用于问答、多轮会话和 Procedure。

Fin 的终端用户 JWT 必须由客户自己的服务端签发。枕星 AI 客户端不能索取、生成或保存客户的 Messenger Secret。

## 建议目标宿主

以下 ID 均为当前目录已经存在的宿主产品；录入时只选择官方文档明确展示或标准 MCP 能力已经核验的目标：

- Claude Desktop：`claude-desktop`
- Claude Code：`claude-code`
- ChatGPT：`chatgpt-desktop`
- Codex CLI：`codex-cli`
- Cursor：`cursor-desktop`
- Windsurf：`windsurf-editor`
- GitHub Copilot / VS Code：`github-copilot`
- Perplexity：`perplexity-web`

不要为了提高“支持数量”把同一资源机械挂到所有宿主。每个 `targetProductId` 仍要保存独立兼容结论和独立验收状态。

## 推荐录入顺序

1. **官方托管且只读**：Confluent Global、Confluent Regional、Semrush。先录资源链接，再验证 OAuth/API Key 流程和断开授权。
2. **企业动态端点**：Databricks、Snowflake。先录官方目录/创建说明，不生成假固定 URL；以后固定模块必须验证账号域名、资源路径、OAuth Scope 与最小权限。
3. **数据库本地服务**：Redis、Neo4j。当前只提供官方说明；完成固定版本、哈希、凭据存储、默认只读、回环监听与卸载收据前不自动安装。
4. **内容与建站写操作**：Wix、WordPress.com、Intercom。所有发布、修改、删除、站点管理与文章写入动作必须显示目标和影响后逐次确认。
5. **支付与业务流程**：PayPal、Intercom Fin。先使用官方 Sandbox 或测试工作区；真实支付、退款、取消、升级等动作不得后台静默执行。

## 本轮明确不录入

- **第二个 Azure MCP 与第二个 AWS Labs 目录**：当前目录已经有 `microsoft-azure-mcp` 和 `aws-mcp-servers`，本轮只补产品关联、更新证据和状态，不重复建资源。
- **Databricks 提供的 Slack、GitHub、Google Drive 等 SaaS MCP Service**：这些外部厂商已经或应由其自己的厂商与产品目录承载；Databricks 这里只展示治理平台能力，不能复制一套同名资源。
- **RedisVL MCP**：它依赖已有 Redis Search 索引、Python 运行时和向量化模型供应商，属于与通用 Redis MCP 不同的产品能力，需单独调研后再录。
- **Confluent Manager for Apache Flink MCP**：官方端点仍是 `v1alpha1`，写工具和日志工具可选且风险明显；不与本批只读的 Confluent Cloud 托管 MCP 混为一项。
- **PayPal Agent Toolkit 独立条目**：它是 PayPal MCP/Agent 接入的官方实现，不额外计算成第二个产品；以后若做固定本地模块，可作为同一产品下的安装方案。
- **自托管 WordPress.org 通用 MCP**：本轮官方证据只证明 WordPress.com 托管服务，不把第三方 WordPress 插件冒充 Automattic 官方能力。
- **Gemini CLI → Semrush**：Semrush 官方已说明 Gemini CLI 支持停止，并转向 Antigravity；当前目录不能继续展示已过期目标。

## 对后续实现的约束

- 同一厂商只保存一份厂商资料；Intercom 的两个产品、Confluent 的两个端点按产品/资源层级拆分。
- 这些产品只进入“全部 AI 可接入厂商”；资源只进入对应产品子目录和 MCP 商店的产品层级，不在首页平铺。
- 目录记录必须包含 `sourceKind=official`、官方证据、核验日期、权限风险、凭据要求、断开/撤销说明与明确的 `targetProductId`。
- 动态端点必须由客户端固定模块按受约束参数生成或校验。后台不能传入任意 URL，尤其不能把数据库地址、云账号地址或客户自建服务直接当成可信服务器。
- OAuth Token、PAT、API Key、数据库密码、Client Secret、Messenger Secret 只进入系统凭据存储或厂商托管 OAuth；目录、普通日志、任务历史和社区帖子不得持久化这些值。
- 查询型动作可以在用户授权后执行；创建、更新、删除、发布、付款、退款、运行 SQL、执行 Procedure、管理站点和读取 Topic 消息必须按照实际数据敏感度显示目标与影响，并保留确认和审计记录。
- 断开连接只删除枕星 AI 创建的宿主配置与安装收据；撤销 OAuth 或 API Key 引导用户进入厂商官方页面，不删除用户的云资源、数据库、网站、内容、支付记录或客户数据。

## 实际录入结果

- 新增 10 个厂商；复用 Microsoft 与 Amazon 两份既有厂商资料。
- 新增 13 个 AI 可接入产品，其中 11 个属于新厂商，另 2 个是既有厂商缺失的 Azure 与 AWS 产品卡。
- 新增 12 项官方 MCP 资源，并把既有 `microsoft-azure-mcp`、`aws-mcp-servers` 关联到对应产品。
- 所有资源仍使用 `resource-link`；动态端点、凭据和高风险动作没有进入后台可下发参数。
