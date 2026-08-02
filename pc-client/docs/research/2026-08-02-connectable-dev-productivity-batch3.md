# AI 可接入厂商扩充调研：开发工具、办公/生产力与自动化（第三批）

日期：2026-08-02
状态：目录录入前的官方证据审查，不代表已经发布

## 范围、排重与安全口径

- 本轮开始前核对了 `admin/data/catalog-v1.json`：当前共有 139 个厂商、270 个产品、71 项生态资源。
- 已排除目录及现有 `docs/research` 中收录的 GitHub、Notion、Atlassian、Docker、Cloudflare、Linear、Sentry、Stripe、Supabase、Slack、JetBrains、Vercel、Postman、Asana、HubSpot、n8n、UiPath、Zapier、monday.com、MongoDB、Grafana、Datadog、Elastic 等内容。
- 下列建议 ID 已与现有厂商、产品和资源 ID 做精确比对；除 `microsoft` 与 `google` 是复用现有厂商外，其余厂商 ID 目前均未占用。
- 只采用厂商官方文档、官方开发者站点或厂商官方 GitHub 组织仓库；未把第三方 MCP 市场、博客转载或个人仓库当成官方证据。
- “首录仅链接”表示当前只展示官方说明或官方连接入口，不执行后台下发命令，也不保存 OAuth Client Secret、PAT、API Key 或账号令牌。
- “固定模块候选”表示以后可以调用客户端内置的 `remote-mcp`、`local-mcp` 或“带参数的官方连接”模块；后台只能填写已定义参数，不得传入任意命令、脚本或可执行文件。

## 建议清单

| # | 厂商 / 产品 | 建议 ID | 官方证据与接入目标 | 主要权限风险 | 首录方式 |
| --- | --- | --- | --- | --- | --- |
| 1 | GitLab / GitLab | vendor `gitlab`；product `gitlab-platform`；resource `gitlab-mcp-server` | [GitLab MCP 官方文档](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)；面向 Codex、Claude Code、Cursor、Gemini CLI、GitHub Copilot、Kiro、Zed 等 MCP 客户端 | 可读取项目、Issue、Merge Request，也能调用 GitLab API 执行动作；官方明确提示防范来自仓库对象的提示注入 | **是**。Beta 阶段先链接；以后用带 `instanceUrl` 的固定远程 MCP 模块 |
| 2 | Salesforce / Salesforce Platform | vendor `salesforce`；product `salesforce-platform`；resource `salesforce-hosted-mcp-servers` | [Salesforce Hosted MCP Servers](https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/hosted-mcp-servers-overview.html)；支持 Claude、ChatGPT、Cursor、Postman 和其他兼容客户端 | 可读写 Salesforce 记录、调用 Flow、Apex、查询和自动化；权限继承当前用户，但仍可能影响 CRM 和业务流程 | **是**。必须先由管理员启用服务器并配置 External Client App；不保存客户端密钥 |
| 3 | ServiceNow / ServiceNow AI Platform | vendor `servicenow`；product `servicenow-platform`；resource `servicenow-mcp-server` | [ServiceNow 创建 MCP Server](https://www.servicenow.com/docs/r/intelligent-experiences/create-mcp-server.html)、[连接 MCP 客户端](https://www.servicenow.com/docs/r/intelligent-experiences/connect-mcp-server-client.html)；目标是企业批准的 MCP 客户端 | 管理员可选择暴露自定义工具；这些工具可能修改 ITSM、CMDB、HR 或自动化记录，作用范围完全取决于实例配置 | **是**。服务器 URL 由客户实例和服务器名动态生成，且需 OAuth 入站集成，不应假装成统一一键连接 |
| 4 | Microsoft / Azure DevOps | 复用 vendor `microsoft`；product `azure-devops`；resource `microsoft-azure-devops-mcp` | [Microsoft 官方 Azure DevOps MCP 仓库](https://github.com/microsoft/azure-devops-mcp)；远程端点模板为 `https://mcp.dev.azure.com/{organization}`，支持 VS Code、Codex、Claude Code、Cursor 等 | 可访问代码、Work Item、Wiki、测试、Advanced Security 和流水线；写工具可建分支/PR、改工作项、运行或更新流水线 | **是**。先链接；以后用固定 `remote-mcp` 模块，只允许组织名和工具域参数，写操作逐次确认 |
| 5 | HashiCorp / Terraform | vendor `hashicorp`；product `terraform-platform`；resource `terraform-mcp-server` | [Terraform MCP 部署说明](https://developer.hashicorp.com/terraform/mcp-server/deploy)、[Terraform MCP 安全模型](https://developer.hashicorp.com/terraform/mcp-server/security)；面向本地或受管 MCP 客户端 | 可读取公共或私有 Registry、HCP Terraform / Terraform Enterprise 资产；令牌泄露、提示注入和未经审查的基础设施变更风险高 | **是**。当前不自动安装本地服务；完成版本、哈希、回环监听、令牌存储和卸载收据后再接固定 `local-mcp` 模块 |
| 6 | Pulumi / Pulumi Cloud | vendor `pulumi`；product `pulumi-cloud`；resource `pulumi-mcp-server` | [Pulumi MCP 官方文档](https://www.pulumi.com/docs/ai/mcp-server/)；官方远程端点 `https://mcp.ai.pulumi.com/mcp`，目标包括 Cursor、Claude、Windsurf、Kiro 与其他 OAuth MCP 客户端 | 可查询 Stack 和云资源、查看策略违规、管理组织成员、委派 Pulumi Neo，部分工具可生成并部署基础设施 | **是**。先链接；固定远程模块必须把查询与部署/成员管理分级，所有部署和组织变更人工确认 |
| 7 | BrowserStack / BrowserStack Test Platform | vendor `browserstack`；product `browserstack-test-platform`；resource `browserstack-mcp-server` | [BrowserStack MCP 概览](https://www.browserstack.com/docs/browserstack-mcp-server/overview)、[官方远程 MCP](https://www.browserstack.com/docs/browserstack-mcp-server/get-started/remote-mcp-server)；目标包括 Copilot、Cursor、Claude、ChatGPT | 可启动真实设备/浏览器测试、读取测试日志、管理测试用例并消耗套餐额度；测试数据和本地隧道可能包含未公开项目内容 | **是**。优先官方 OAuth 远程端点；以后接固定模块时，启动测试和写测试用例必须确认并提示可能计费 |
| 8 | CircleCI / CircleCI | vendor `circleci`；product `circleci-platform`；resource `circleci-mcp` | [CircleCI MCP 官方说明](https://circleci.com/docs/guides/toolkit/circleci-mcp-overview/)；官方托管端点 `https://mcp.circleci.com/v1/mcp`，另有内置于 CircleCI CLI 的本地 MCP | 托管服务可读日志、重跑或取消 Workflow；CLI MCP 权限更大，可管理 Context、环境变量、Runner、Policy、签名和直接 API | **是**。首版只链接托管 MCP；不要再使用已废弃的独立 npm MCP 包，CLI MCP 另行审核为独立资源 |
| 9 | ClickUp / ClickUp Workspace | vendor `clickup`；product `clickup-workspace`；resource `clickup-mcp-server` | [ClickUp MCP 官方文档](https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server)；官方端点 `https://mcp.clickup.com/mcp`，支持主流 MCP 客户端 | 可搜索任务、文档和评论，创建/修改任务、记录时间、发评论和聊天；当前官方未开放删除工具，但写入仍会改变团队工作状态 | **是**。Public Beta 先链接；以后固定远程模块只走 OAuth 2.1 + PKCE，不接受 API Key 或后台令牌 |
| 10 | Box / Box Content Cloud | vendor `box`；product `box-content-cloud`；resource `box-mcp-server` | [Box MCP 官方文档](https://developer.box.com/guides/box-mcp)；官方托管端点 `https://mcp.box.com`，目标包括 Codex、Claude Code、Cursor、ChatGPT 等 | 可搜索和读取企业文件、调用 Box AI，并按 Content Actions 等 OAuth Scope 执行内容操作；可能暴露企业敏感文件 | **是**。需 Box 管理员启用并配置 OAuth；弃用的自托管 Box MCP 不录入为自动安装资源 |
| 11 | Pipedream / Pipedream | vendor `pipedream`；product `pipedream-platform`；resource `pipedream-mcp` | [Pipedream MCP 官方文档](https://pipedream.com/docs/connect/mcp)；面向 ChatGPT、Claude、Cursor、VS Code 以及开发者自建 Agent | 单个连接可触达数千个 API 和一万余工具，能发消息、改仓库、部署、写数据库或处理客户数据；风险取决于每个已连接账号 | **是**。宽权限聚合器先链接；后续模块必须按 App 白名单、用户隔离和工具注解筛选，不能一次开放全部工具 |
| 12 | Make / Make | vendor `make`；product `make-platform`；resource `make-mcp-server` | [Make MCP Server 官方说明](https://help.make.com/make-mcp-server)；可连接 Claude、ChatGPT 与其他远程 MCP 客户端 | Scenario Run 可执行自动化；Management Scope 可修改 Scenario、Team、Connection、Webhook、Data Store，甚至邀请组织成员 | **是**。默认只引导使用受限 MCP Toolbox 或 Scenario Run Scope；完整管理 Scope 不纳入一键连接 |
| 13 | Google / Google Workspace | 复用 vendor `google`；product `google-workspace`；resources 见下方拆分 | [Google Workspace MCP 官方配置](https://developers.google.com/workspace/guides/configure-mcp-servers)；目标包括 Google Antigravity、Claude 和支持远程 HTTP + OAuth 的客户端 | 能读取邮件、文件、联系人、日历和聊天，也能写文档、建会议、发消息；官方特别警告邮件/文档中的间接提示注入可导致数据泄露或误操作 | **是**。Developer Preview，且需 Google Cloud 项目、API 启用和 OAuth Client；必须按产品拆分，不伪造一个统一端点 |
| 14 | Zoom / Zoom Workplace | vendor `zoom`；product `zoom-workplace`；resource `zoom-mcp-server` | [Zoom MCP Server](https://developers.zoom.us/docs/mcp/zoom-mcp-server/)、[连接 Zoom MCP](https://developers.zoom.us/docs/mcp/servers/connect-to-zoom-mcp-servers/)；面向 Claude、ChatGPT 和其他手工注册 OAuth 客户端 | 可读取或操作 Meeting、Chat、Calendar、Email、Canvas、Clips、Whiteboard；不同产品需要不同 Scope 和许可证 | **是**。Zoom 仅支持手工客户端注册，不支持 DCR；首版只给官方配置入口，绝不在目录保存 Client Secret |
| 15 | Shopify / Shopify Storefront | vendor `shopify`；product `shopify-storefront`；resource `shopify-storefront-mcp` | [Shopify Storefront MCP](https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront)；每个商店端点为 `https://{shop}.myshopify.com/api/mcp`，用于 AI 购物 Agent | 公共 Storefront MCP 无需认证，可查商品、政策并管理购物车；加入购物车和进入结账仍是交易行为，且商店域名属于用户输入 | **是**。这是开发者/商家接入资源，不是通用桌面工具；以后固定模块必须校验 `*.myshopify.com` 域名并在结账前确认 |

## Google Workspace 必须拆分的资源子目录

Google 官方明确说明每个 Workspace 产品都有独立 MCP 服务，不能把它们合并成一个虚假的 `google-workspace-mcp` 端点。建议在同一产品 `google-workspace` 下建立以下 8 个资源：

| 建议 resource ID | 名称 | 官方端点 | 权限重点 |
| --- | --- | --- | --- |
| `google-gmail-mcp` | Gmail MCP | `https://gmailmcp.googleapis.com/mcp/v1` | 邮件搜索、读取、标签和创建草稿；邮件正文有间接提示注入风险 |
| `google-drive-mcp` | Google Drive MCP | `https://drivemcp.googleapis.com/mcp/v1` | 文件搜索、读取、下载、复制和创建；需遵守 Drive 文件权限与 DLP |
| `google-docs-mcp` | Google Docs MCP | `https://docsmcp.googleapis.com/mcp/v1` | 读取和修改文档；写入必须确认目标文件 |
| `google-sheets-mcp` | Google Sheets MCP | `https://sheetsmcp.googleapis.com/mcp/v1` | 读取与修改表格；批量写入可能破坏业务数据 |
| `google-slides-mcp` | Google Slides MCP | `https://slidesmcp.googleapis.com/mcp/v1` | 读取和编辑演示文稿；生成或覆盖内容必须确认 |
| `google-calendar-mcp` | Google Calendar MCP | `https://calendarmcp.googleapis.com/mcp/v1` | 查询、创建、更新、删除和响应日历事件 |
| `google-chat-mcp` | Google Chat MCP | `https://chatmcp.googleapis.com/mcp/v1` | 搜索会话和消息、发送消息；发信属于对外动作 |
| `google-people-mcp` | Google People MCP | `https://people.googleapis.com/mcp/v1` | 读取用户资料、联系人和组织目录 |

上述端点、OAuth 方式和 Developer Preview 状态均来自 [Google Workspace MCP 官方配置文档](https://developers.google.com/workspace/guides/configure-mcp-servers)。目录首录时各资源均保持链接模式；未来即使复用同一个固定模块，也必须让用户逐个选择产品与 OAuth Scope。

## 录入顺序建议

1. **远程固定端点、OAuth 清晰**：GitLab、Azure DevOps、Pulumi、BrowserStack、CircleCI、ClickUp、Box。先录产品与链接资源，再逐个做固定远程 MCP 模块验收。
2. **企业管理员配置型**：Salesforce、ServiceNow、Zoom。先录官方入口，不承诺个人用户一键连接；连接 UI 需要实例 URL、组织策略与手工 OAuth App 指引。
3. **高权限自动化聚合器**：Pipedream、Make。必须先有 App/Scenario 白名单和动作风险分级，不能把“一万多个工具”当成默认全部启用。
4. **本地或基础设施高风险**：Terraform。先提供官方资源，后续本地部署必须固定版本、哈希、回环监听、最小令牌权限和枕星 AI 安装收据。
5. **预览和多端点产品**：Google Workspace。按 8 个独立资源展示，等 Developer Preview 的稳定性、配额和 OAuth 流程验收后再考虑自动配置。
6. **开发者场景**：Shopify Storefront。放在“AI 可接入厂商”，不放“全部 AI 厂商”；明确它服务于商家/开发者构建 AI 购物体验，而非普通消费者安装软件。

## 对后续实现的约束

- 同一厂商仍只保存一份厂商资料；Microsoft 和 Google 不得重复建厂商。
- 这些产品只进入“全部 AI 可接入厂商”；资源只进入对应产品子目录和 MCP 商店的产品层级，不在首页平铺。
- 所有远程地址都必须由客户端固定模块生成或校验。后台不能把任意 URL、命令、环境变量或脚本包装成“一键安装”。
- OAuth Token、Client Secret、PAT、API Key 只能进入系统凭据存储或由官方 OAuth 页面托管；后台目录和普通日志只保存非敏感配置元数据。
- 查询类工具可以在用户明确授权后低摩擦执行；创建、修改、删除、发布、部署、运行流水线、发送消息、运行付费测试、执行 Scenario、管理成员和进入结账等动作必须显示目标与影响后确认。
- 断开连接只删除枕星 AI 创建的客户端配置和收据；撤销 OAuth 走厂商官方页面，不删除用户账号、项目、文档、流水线、基础设施、会议、商店或业务数据。
