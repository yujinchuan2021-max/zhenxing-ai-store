# AI 可接入厂商扩充调研（第一批）

日期：2026-08-02
状态：正式目录录入前的官方证据审查，不是已发布目录

## 调研口径

- 只接受厂商自己的开发文档、产品文档或厂商官方 GitHub 组织仓库。
- “官方”指接入资源由产品厂商提供或维护；仅被第三方 MCP 市场收录，不算厂商官方。
- 本文只证明“值得进入审核队列”，不自动授予枕星 AI 本地执行或写配置权限。
- 接入时必须使用客户端固定模块与固定参数；OAuth、API Key、PAT 和 Client Secret 不得写进后台目录数据。
- 默认优先只读、项目级/工作区级最小权限；创建、修改、删除、发布、支付等动作需要显式确认。

## 核验结果

共核验通过 18 个高质量条目。它们都存在一方官方证据，但接入条件并不相同；不能把“官方 MCP”统一理解为“无需授权即可一键启用”。

| # | 厂商 | 产品 | 接入资源 | 官方 URL | 适用 AI 工具 / 协议 | 官方性 | 风险与凭据要求 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Figma | Figma Design | Figma MCP Server（远程优先；另有桌面本地服务） | [Figma MCP 官方文档](https://developers.figma.com/docs/figma-mcp-server/)、[远程安装说明](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) | 远程 Streamable HTTP：`https://mcp.figma.com/mcp`；官方列出 Codex、Claude Code、Cursor、VS Code、Xcode 等 | 官方托管服务 | 需要用户 OAuth；只能连接 Figma MCP Catalog 允许的客户端。可读取设计上下文，也可创建和修改画布内容；写入能力应单独确认。远程能力仍处于快速迭代期，官方提示未来可能按量收费。 |
| 2 | Notion | Notion Workspace | Notion MCP | [Notion MCP 概览](https://developers.notion.com/guides/mcp/overview)、[连接指南](https://developers.notion.com/guides/mcp/get-started-with-mcp) | Streamable HTTP：`https://mcp.notion.com/mcp`；Claude Code、Cursor、VS Code、ChatGPT 及其他兼容客户端 | 官方托管服务 | 需要用户 OAuth；托管服务不支持直接 Bearer Token。授权后可按当前用户权限读写工作区页面，等同把用户可见内容交给 AI 客户端，应清楚展示工作区与权限范围。 |
| 3 | Atlassian | Atlassian Cloud（Jira、Confluence、Compass、Jira Service Management、Bitbucket） | Atlassian Rovo MCP Server | [Atlassian Rovo MCP 官方文档](https://developer.atlassian.com/cloud/rovo-mcp/) | 云端 MCP；适用于支持远程 MCP 与 OAuth 2.1 的 AI 助手、IDE 和自动化工具 | 官方托管服务 | OAuth 2.1，继续受现有 Atlassian 用户权限约束。服务能跨多个产品搜索、创建和更新数据；首次接入应让用户明确选择站点和授权范围，写操作需要确认。 |
| 4 | GitHub | GitHub | GitHub MCP Server | [GitHub MCP 官方设置文档](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server)、[官方仓库](https://github.com/github/github-mcp-server) | GitHub 托管远程 MCP（推荐）或本地服务；GitHub Copilot、VS Code/Visual Studio 及其他兼容 MCP 编辑器 | GitHub 提供并维护 | 远程服务默认一键 OAuth，也可使用 PAT；只能访问用户批准的 scope，并可能受组织策略限制。仓库、Issue、PR 和工作流都可能包含写操作，企业环境需遵守管理员 allowlist。 |
| 5 | Docker | Docker Desktop | Docker MCP Toolkit、MCP Catalog 与 Gateway | [Docker MCP Toolkit 官方文档](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/)、[入门指南](https://docs.docker.com/ai/mcp-catalog-and-toolkit/get-started/) | 本地 Gateway/stdio；可连接 Claude、Cursor、VS Code、Codex 等客户端 | Docker Desktop 官方内置能力，目前为 Beta | 这是 MCP 管理与隔离基础设施，不是单一业务数据源，目录中应归为“AI 接入基础设施”。Docker 会对目录镜像签名并提供 SBOM，但第三方服务器仍需逐项审核；主机文件挂载必须由用户显式授权，OAuth 凭据由 Toolkit 管理。 |
| 6 | Cloudflare | Cloudflare 平台 | Cloudflare API MCP Server 及产品专用 MCP Servers | [Cloudflare 官方 MCP 服务器目录](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/) | Streamable HTTP：`https://mcp.cloudflare.com/mcp`；Claude、Windsurf、Cloudflare AI Playground、Codex/Agent Skills 及兼容 MCP SDK | 官方托管服务与官方仓库 | OAuth 时由用户选择权限。统一 API 服务能覆盖 DNS、Workers、R2、Zero Trust 等大量接口，潜在破坏面很大；优先展示产品专用只读服务器，通用 `execute` 能力必须二次确认并限制账户。 |
| 7 | Linear | Linear | Linear MCP Server | [Linear MCP 官方文档](https://linear.app/docs/mcp) | Streamable HTTP：`https://mcp.linear.app/mcp`；Claude、Codex、Cursor、VS Code、v0、Windsurf、Zed 等 | 官方托管服务 | 支持 OAuth 2.1、Bearer Token 或 Linear API Key；能读写 Issue、项目和评论。优先接入官方只读端点 `https://mcp.linear.app/mcp/readonly`，只有用户主动选择时才升级为读写。 |
| 8 | Sentry | Sentry | Sentry MCP | [Sentry 官方仓库](https://github.com/getsentry/sentry-mcp)、[安全模型](https://github.com/getsentry/sentry-mcp/blob/main/docs/security.md) | 远程 MCP：`https://mcp.sentry.dev/mcp`；面向 Claude Code、Cursor 等人机协同编码代理；亦支持本地 stdio/self-hosted | Sentry 官方组织维护的开源服务与托管端点 | 远程首选 OAuth，并可按组织/项目 URL 限定；也支持显式 Sentry Token。本地/self-hosted 模式要求带写 scope 的用户令牌，AI 搜索还可能需要 OpenAI/Anthropic Key；默认不得启用超出排障所需的写权限。 |
| 9 | Stripe | Stripe Platform | Stripe MCP Server | [Stripe MCP 官方文档](https://docs.stripe.com/mcp) | 远程 MCP：`https://mcp.stripe.com`；Cursor、VS Code、Claude Code、ChatGPT、OpenAI Responses API 及其他兼容客户端 | 官方托管服务，Public preview | 首选 OAuth；无 OAuth 时只能使用受限 API Key，并放入系统凭据存储。服务存在通用 API 写入、退款等高风险工具，必须默认 Sandbox、最小权限、人工确认；Live Mode 与 Sandbox 授权必须清楚分开。 |
| 10 | Supabase | Supabase Projects | Supabase MCP Server | [Supabase MCP 官方文档](https://supabase.com/docs/guides/ai-tools/mcp)、[官方仓库](https://github.com/supabase/mcp) | 远程 Streamable HTTP：`https://mcp.supabase.com/mcp`；Claude Code 等兼容 MCP 客户端；本地 Supabase CLI 也提供 MCP | 官方托管服务与官方仓库 | 默认动态客户端注册/OAuth；CI 可用 PAT。官方明确要求不要连接生产数据。必须自动加 `project_ref`，默认 `read_only=true`，并限制 feature groups；SQL、迁移、Edge Function 部署和项目管理均属高风险写操作。 |
| 11 | Vercel | Vercel Projects | Vercel MCP | [Vercel MCP 官方文档](https://vercel.com/docs/agent-resources/vercel-mcp) | Streamable HTTP：`https://mcp.vercel.com`；Claude、ChatGPT、Codex、Cursor、VS Code、Devin、Windsurf、Gemini 等官方审核客户端 | 官方托管服务，Beta | OAuth，且只接受 Vercel 已审核客户端。可读取部署日志并管理项目/部署；按项目使用 `https://mcp.vercel.com/<team>/<project>` 可缩小上下文。部署和配置变更需要人工确认，并防范日志中的提示注入。 |
| 12 | Slack | Slack Workspace | Slack MCP Server | [Slack MCP 官方文档](https://docs.slack.dev/ai/slack-mcp-server/) | Streamable HTTP：`https://mcp.slack.com/mcp`；适用于实现 Slack 所需应用身份与 OAuth 的 MCP 客户端 | 官方托管服务 | 不是可随意粘贴 URL 的普通一键接入：客户端必须绑定固定 Slack App ID，只允许 Marketplace 已发布应用或内部应用；使用 confidential OAuth，需要 Client ID/Secret 和管理员审批。可搜索私密频道、私信并发送消息，应按 granular scopes、IP allowlist 和审计日志治理。 |
| 13 | JetBrains | IntelliJ IDEA / JetBrains IDE 系列 | IDE 内置 MCP Server 插件 | [JetBrains IDE MCP Server 官方文档](https://www.jetbrains.com/help/idea/mcp-server.html) | 本地 stdio、SSE 或 Streamable HTTP；Claude Code、Codex、VS Code、Cursor、Windsurf、GitHub Copilot CLI 等 | JetBrains IDE 2025.2 起官方内置，插件默认启用 | 外部代理可读取/修改项目、构建、运行配置，甚至执行终端命令。枕星 AI 只能调用 IDE 官方自动配置或固定配置模块；不得自动打开“无需确认执行命令”的 Brave Mode，应允许用户逐项关闭暴露工具。 |
| 14 | Canva | Canva | Canva MCP / AI Connector | [Canva MCP 官方文档](https://www.canva.dev/docs/mcp/) | 远程 MCP：`https://mcp.canva.com/mcp`；Claude、ChatGPT、Codex、Gemini 等常见 AI 工具已有入口，其他客户端可用远程 MCP | 官方托管服务 | 每位用户都需要登录授权。读取、生成、编辑、导出设计以及管理品牌资产都可能产生外部写入；自定义客户端还需要向 Canva 申请 redirect URI allowlist，不能在未获准前承诺枕星 AI 自身作为 MCP 客户端直连。 |
| 15 | Postman | Postman API Platform | Postman MCP Server | [Postman MCP 官方文档](https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/overview/)、[远程服务配置](https://learning.postman.com/latest-v-12/docs/reference/postman-api/postman-mcp-server/postman-mcp-remote-server) | 远程 Streamable HTTP 或本地 stdio；Claude Code、Cursor、VS Code、Codex、Windsurf、Gemini CLI 等 | 官方托管服务、官方 npm/Docker 发行物 | 美国远程服务首选 OAuth；EU 远程和本地服务要求 API Key。默认使用 Minimal 工具集；Full 含 100+ 工具，可修改工作区、集合、环境变量和监控。API Key 必须保存在系统凭据存储，不得写入共享配置。 |
| 16 | Asana | Asana Work Graph | Asana MCP Server V2 | [Asana MCP 官方文档](https://developers.asana.com/docs/mcp-server)、[V2 集成指南](https://developers.asana.com/docs/integrating-with-asanas-mcp-server) | Streamable HTTP：`https://mcp.asana.com/v2/mcp`；Claude、ChatGPT 以及 Claude Code、Codex、Cursor、VS Code 等兼容客户端 | 官方托管服务，V2 已 GA | 除官方内置客户端外，集成方通常需预注册 MCP OAuth App，保管 Client ID/Secret；不支持动态客户端注册。MCP App 当前没有细粒度 tool scopes，授权会覆盖现有及未来所有工具，但实际数据仍受用户 Asana 权限约束，因此不能默认无确认写入。 |
| 17 | HubSpot | HubSpot CRM | HubSpot MCP Server（远程） | [HubSpot MCP 官方文档](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server) | 远程 MCP：`https://mcp.hubspot.com`；任何支持 OAuth + PKCE 的 MCP 客户端 | 官方托管服务 | 必须在 HubSpot 创建 MCP Auth App，并使用 OAuth/PKCE；Client Secret 只能进服务端密钥存储。服务可读写联系人、公司、交易、工单等 CRM 数据，应按对象选择最小 scope，删除/批量修改/外发数据必须确认。 |
| 18 | Google | Chrome DevTools | Chrome DevTools MCP | [Chrome 官方接入指南](https://developer.chrome.com/docs/devtools/agents/get-started)、[官方仓库](https://github.com/ChromeDevTools/chrome-devtools-mcp) | 本地 MCP；官方列出 Gemini CLI、Claude Code、Cline、GitHub Copilot、Cursor 等客户端 | Chrome DevTools 团队维护 | 可读取和控制浏览器页面，并可能访问现有登录态。目录只展示官方说明；访问登录页面、提交表单、下载文件或修改站点数据前必须明确确认。 |

## 对枕星 AI 的录入建议

### 可进入第一批“AI 可接入厂商”审核队列

Figma、Notion、Atlassian、GitHub、Cloudflare、Linear、Sentry、Stripe、Supabase、Vercel、JetBrains、Canva、Postman、Asana、HubSpot、Slack、Docker 与 Chrome DevTools 均可作为独立厂商/产品展示。厂商资料只保存一份，以上产品应标记为 `ai-connectable`，不应复制成新的厂商记录。

### 不能使用同一种“一键接入”文案

建议后台给资源增加接入成熟度，不改变固定模块的安全边界：

1. **可直接配置**：官方远程 URL + 目标 AI 工具已有固定 MCP 配置模块；点击后写入固定结构，再由用户完成 OAuth。
2. **需要本地产品**：Docker MCP Toolkit、JetBrains MCP Server；先检测官方产品/版本，再调用固定的本地启用或配置入口。
3. **需要厂商应用登记**：Slack、Asana、HubSpot；在枕星 AI 完成厂商应用注册和密钥托管前，只展示官方接入说明，不能伪装成已经可一键授权。
4. **仅限厂商认可客户端**：Figma、Canva、Vercel；只给官方列出的目标 AI 工具显示接入按钮，枕星 AI 自身若要充当 MCP 客户端，需要另行申请或审核。

### 建议统一保存的目录字段

- 厂商 ID、接入产品 ID、资源 ID、资源名称与资源类型。
- 官方证据 URL、官方服务 URL、传输协议、官方状态与 Beta/GA 状态。
- 支持的目标 AI 产品 ID；不要只保存自由文本客户端名称。
- 认证模式：OAuth、OAuth + PKCE、PAT/API Key、厂商应用注册、本地无账号。
- 权限级别：只读、读写、高风险写操作；是否有官方只读端点/项目级 scope。
- 接入成熟度：可直接配置、需要本地产品、需要应用登记、仅官方认可客户端。
- 固定客户端模块、固定配置参数、用户确认要求、凭据存储策略。

## 明确排除与待复核

- 本轮未找到一方官方证据的候选不进入列表；第三方仓库即使热门，也不因为被 MCP 市场收录而获得“官方”标签。
- Docker MCP Catalog 中的“verified”代表 Docker 对其分发镜像的构建、签名与来源流程负责，不等于每个条目都是对应 SaaS 厂商官方维护；后续仍需逐项追溯到产品厂商。
- Supabase 仓库由 `supabase` 官方组织维护，且其一方文档直接链接该仓库。
- Slack、Asana、HubSpot 的客户端/应用登记会引入枕星 AI 自有 OAuth 应用和密钥生命周期，必须在服务端能力与隐私条款准备好后再开放一键接入。

## 结论

这 17 个条目足以组成第一批高质量“AI 可接入厂商”扩充清单。下一步应先把它们作为后台草稿导入，再按上述四种接入成熟度分别实现；不能把所有官方 MCP 都压成同一个按钮和同一种安装流程。
