# 枕星 AI：第二批数据、自动化与可观测性接入目录

- 日期：2026-08-02
- 证据口径：只采用厂商官方文档和官方产品页。
- 发布边界：本批资源先使用 `resource-link`，只打开官方接入说明；不保存令牌、不代替用户授权、不自动写入第三方配置。

## 录入结论

| 厂商 / 产品 | 实用分类 | 官方接入资源 | 首批目标工具 | 安全边界 |
| --- | --- | --- | --- | --- |
| Zapier / Zapier | 工作流自动化 | Zapier MCP | ChatGPT、Claude、Cursor、Windsurf | 用户在 Zapier 创建独立 MCP Server 并自行授权；每次跨应用写入仍由目标 AI 工具确认。 |
| monday.com / monday Work Management | 项目与协作 | monday Platform MCP | ChatGPT、Claude | 使用官方托管端点与 OAuth；个人 Token 不进入枕星 AI，公开客户端接入需通过 monday.com 注册。 |
| MongoDB / MongoDB Platform | 数据库与数据 | MongoDB MCP Server | Claude、Cursor、GitHub Copilot、Windsurf | 默认建议只读模式与只读数据库账号；生产库写入、集群管理和索引变更不得自动执行。 |
| Grafana Labs / Grafana | 可观测性 | Grafana MCP | Claude、Cursor、VS Code/Copilot | 官方服务支持本地、Grafana Cloud 等方式；只展示说明，服务账号按最小 RBAC 授权。 |
| Datadog / Datadog Platform | 可观测性 | Datadog MCP Server | Codex、Claude Code、Cursor | 令牌和站点选择由用户完成；日志、指标、安全信号和监控写操作按最小权限控制。 |
| Elastic / Elastic Platform | 数据库与数据 | Elastic Agent Builder MCP | Claude、Cursor | 使用 Kibana 官方 MCP 端点；API Key/OAuth 权限限制到指定 Space、索引和只读工具。 |

## 一手证据

### Zapier

- [Zapier MCP quickstart](https://docs.zapier.com/mcp/get-started/quickstart)
- [Zapier MCP 客户端接入说明](https://help.zapier.com/hc/en-us/articles/36265392843917-Use-Zapier-MCP-with-your-client)

官方文档确认 Zapier MCP 可连接 MCP 兼容客户端，并通过用户自己的 Zapier 账户暴露已选择的应用动作。目录只提供官方创建与连接入口。

### monday.com

- [monday.com MCP 接入说明](https://developer.monday.com/api-reference/docs/integrate-with-monday-mcp)
- [monday.com MCP 安全模型](https://developer.monday.com/api-reference/docs/monday-mcp-security-overview)

官方托管端点为 `https://mcp.monday.com/mcp`，使用 OAuth 2.0 或用户自己的 Token；工具调用继续受当前 monday.com 用户权限约束。

### MongoDB

- [MongoDB MCP Server](https://www.mongodb.com/docs/mcp-server/)
- [MongoDB MCP 安全建议](https://www.mongodb.com/docs/mcp-server/security-best-practices/)

官方服务能查询和管理数据库、集合、索引、Atlas 项目与集群。官方明确提供 `--readOnly`，因此目录默认文案必须优先推荐只读模式。

### Grafana Labs

- [Grafana MCP 安装方式](https://grafana.com/docs/grafana/latest/developer-resources/mcp/set-up/)
- [Grafana MCP 工具与 RBAC](https://grafana.com/docs/grafana/latest/developer-resources/mcp/reference/mcp-tools-table/)

官方支持 `uvx`、Docker、固定二进制、Helm 和 Grafana Cloud MCP。首批只进入资源目录，不替用户选择部署方式或生成服务账号。

### Datadog

- [Datadog MCP Server](https://docs.datadoghq.com/mcp_server/)

官方文档确认 Datadog MCP 面向支持 MCP 的 AI Agent，包括 Cursor、OpenAI Codex 和 Claude Code，可访问 APM、日志、指标、监控和安全上下文。

### Elastic

- [Elastic Agent Builder MCP Server](https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/mcp-server)
- [Elastic AI 功能与 MCP 选项](https://www.elastic.co/docs/explore-analyze/ai-features)

官方 MCP 端点位于 Kibana Agent Builder，并支持 API Key 或 OAuth 2.1。首批只展示官方端点和权限说明，不收集用户凭据。

## 排除项

- 不把“存在社区 MCP”直接描述为厂商官方支持。
- 不因为某个服务有 npm/Docker 包就自动开放一键安装；本批全部先使用链接模块。
- 不把数据平台本身当成 AI 工具，它们只进入“全部 AI 可接入厂商”。
