# D12-D16 官方 MCP 宿主证据复核（2026-08-15）

## 结论

本稿只使用五个 publisher 自己控制的文档、GitHub 组织仓库、release/package manifest 与法律条款。没有把“支持 MCP”或“任何 MCP client”推导成宿主关系。

五个对象均已取得至少一个由 publisher 明确点名、且在当前本地 catalog 中为 `enabled=true`、`directoryKind="ai-tool"` 的 exact host ID。因此在下述严格边界内，五项均可分类为 `ready-link-only`；没有一项升级为可安装、可连接或托管执行资源。

| Census ID | canonical identity | 形态 | 版本 / 许可或条款口径 | exact CompatibleHost IDs | 风险 | 分类 |
| --- | --- | --- | --- | --- | --- | --- |
| D12 | `pagerduty:official-mcp` | PagerDuty-hosted remote + 官方 local/self-hosted | hosted 滚动；local `main` 的两个 manifest 版本漂移，不能声称单一固定版；源码 Apache-2.0，服务另受 PagerDuty 条款约束 | `claude-desktop`, `cursor-desktop`, `microsoft-vscode` | high | `ready-link-only` |
| D13 | `launchdarkly:official-mcp` | hosted remote + 官方 local | hosted 滚动；local package `0.6.2`；MIT；托管服务另受 LaunchDarkly Subscription Terms | `claude-desktop`, `claude-code`, `cursor-desktop`, `microsoft-vscode`, `github-copilot`, `windsurf-editor` | high | `ready-link-only` |
| D14 | `snyk:studio-mcp` | Snyk CLI 驱动的 local MCP；无 hosted remote | 文档使用 rolling/latest CLI；官方 `studio-mcp` release 快照为 `v1.15.3`；CLI 与 server repo 均 Apache-2.0 | `claude-code`, `codex-cli`, `cursor-desktop`, `gemini-cli`, `microsoft-vscode`, `github-copilot`, `windsurf-editor` | high | `ready-link-only` |
| D15 | `twilio:docs-mcp` | Twilio-hosted remote docs/retrieval service | rolling Public Beta；无独立开源 server license；受 Twilio Terms 的 Beta Offering 边界约束 | `claude-desktop`, `claude-code`, `cursor-desktop`, `codex-cli` | guarded | `ready-link-only` |
| D16 | `square:official-mcp` | Block-hosted remote + 官方 local | remote rolling Beta；local package/release `0.1.2`；Apache-2.0；hosted 服务许可不从源码许可继承 | `claude-desktop`, `goose-desktop`, `cursor-desktop`, `windsurf-editor` | high | `ready-link-only` |

## 冻结边界与本地 host vocabulary

- 对照 catalog：`docs/research/deepseek-harness-product-catalog-v3-candidate-2026-08-15.json`，SHA-256 `ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7`。
- 上表列出的 host ID 均已在该 catalog 中逐项确认 `enabled=true` 且 `directoryKind="ai-tool"`。
- `Claude.ai` 不自动等同 `claude-desktop`；只有官方材料另行明确写出 Claude Desktop 时才映射后者。
- `Goose` 不自动等同 `goose-desktop`；Square 文档另行明确写出 Goose Desktop，才允许该映射。
- Twilio 的 `Figma Make`、`Replit` 与 `OpenCode CLI` 不映射到本地的 `figma-design`、`replit-agent` 或 `opencode-desktop`；名称和产品形态不相同。
- LaunchDarkly 的 Codex 表述位于 agent-skill 兼容说明，不是该 MCP server 的 host 安装证据，因此不映射 `codex-cli`。
- 对当前 catalog 以及 `docs/research` 中冻结 JSON 历史做只读结构化核查，按 ID、name、external ID、canonical key、canonical repo 与 domain 均未发现现有 Resource/Product 或独立 proposal 重复；历史唯一命中是旧关系候选中的 D12-D16 五条 `unbound` ledger 原记录，它们不是已收录资源。故本次 `duplicate=0`；未来 candidate 冻结时仍须对当时全部 active/history 重跑同一语义门禁。

## D12 — PagerDuty official MCP

### Identity、形态与版本

- PagerDuty 的 [官方 support 页](https://support.pagerduty.com/main/docs/pagerduty-mcp-server)把同一官方 MCP family 明确拆成 PagerDuty-hosted remote 与 open-source self-hosted 两种形态，并说明能力覆盖 incident、service 与 on-call schedule。
- Publisher-controlled [`PagerDuty/pagerduty-mcp-server`](https://github.com/PagerDuty/pagerduty-mcp-server)自称 PagerDuty 官方 local MCP server；[LICENSE](https://github.com/PagerDuty/pagerduty-mcp-server/blob/main/LICENSE)为 Apache-2.0。
- 当前 `main` 的 [`pyproject.toml`](https://github.com/PagerDuty/pagerduty-mcp-server/blob/main/pyproject.toml)声明 package `pagerduty-mcp` `1.1.0`，但 [`server.json`](https://github.com/PagerDuty/pagerduty-mcp-server/blob/main/server.json)仍声明 server/package `0.2.1`，且 [GitHub Releases](https://github.com/PagerDuty/pagerduty-mcp-server/releases)没有 release。故 link-only 文案只能写“hosted rolling / local upstream latest”，不得承诺一个固定可安装版本。
- Local token 的使用受 [PagerDuty Developer Agreement](https://developer.pagerduty.com/docs/pagerduty-developer-agreement)约束；Apache-2.0 只覆盖仓库源码，不覆盖 PagerDuty-hosted 服务。

### 认证、撤权与副作用

- [Remote setup](https://pagerduty.github.io/pagerduty-mcp-server/docs/remote-server/setup)明确 remote service 支持 OAuth 与 PagerDuty API key；local [authentication](https://pagerduty.github.io/pagerduty-mcp-server/docs/getting-started/authentication)使用 PagerDuty User API Token。
- [API Access Keys](https://support.pagerduty.com/main/docs/api-access-keys)说明 user/general REST API key 可删除，删除后不可恢复；[User Settings](https://support.pagerduty.com/main/docs/user-settings)还说明更改用户密码会撤销其 OAuth tokens。实际停用还应从 MCP host 删除连接；AI Hub 不参与凭据生命周期。
- 官方 server 默认为 read-only，但写工具需显式启用；工具可创建、更新或删除 incidents、services、schedule overrides、event orchestrations 等，并能 acknowledge、resolve 或 escalate incidents。错误启用写工具可能直接影响事故响应和 on-call 运营，risk=`high`。

### Exact host mapping

- [PagerDuty support 页](https://support.pagerduty.com/main/docs/pagerduty-mcp-server)明确点名 Claude Desktop、Cursor 与 VS Code。
- 映射：`Claude Desktop -> claude-desktop`；`Cursor -> cursor-desktop`；`VS Code -> microsoft-vscode`。
- 不从“remote MCP-compatible client”泛称增加其他 host。

### 裁决

`ready-link-only`。版本漂移已被收窄为 rolling/link-only 口径；任何 future candidate 不得携带 local install、命令、配置或凭据字段。

## D13 — LaunchDarkly official MCP

### Identity、形态与版本

- [LaunchDarkly MCP overview](https://launchdarkly.com/docs/home/getting-started/mcp)与 [hosted MCP guide](https://launchdarkly.com/docs/home/getting-started/mcp-hosted)闭合 LaunchDarkly-hosted MCP 身份；[local MCP guide](https://launchdarkly.com/docs/home/getting-started/mcp-local)闭合 EU/Federal 环境使用的官方 local 路径。
- Publisher-controlled [`launchdarkly/mcp-server`](https://github.com/launchdarkly/mcp-server)是 local implementation；当前 [`package.json`](https://github.com/launchdarkly/mcp-server/blob/main/package.json)与 [release `v0.6.2`](https://github.com/launchdarkly/mcp-server/releases/tag/v0.6.2)闭合 local package `0.6.2`，仓库 [LICENSE](https://github.com/launchdarkly/mcp-server/blob/main/LICENSE)为 MIT。
- Hosted service 按文档滚动，不继承 MIT；商业服务受 [LaunchDarkly Subscription Terms](https://launchdarkly.com/policies/subscription-terms/)约束。

### 认证、撤权与副作用

- Hosted guide 明确使用 OAuth；local guide 使用具备相应权限的 LaunchDarkly API access token。OAuth app 可在 Authorization 页面 [Review/Revoke](https://launchdarkly.com/docs/home/infrastructure/oauth)，local access token 可在同一管理面 [Delete](https://launchdarkly.com/docs/home/account/api-clone-delete)，删除后相关 API 调用返回未授权。
- [MCP overview](https://launchdarkly.com/docs/home/getting-started/mcp)明确工具能创建和管理 feature flags、AgentControl configs 与 observability data；示例包括创建 flag、跨环境打开 flag、改 targeting rules 与读取 errors。Local 文档还说明可用 read-only scope/tool filter 收窄能力，反证默认 writer 配置可执行创建、更新、删除。
- Flag/targeting/config 写入可改变生产行为，observability 查询可能暴露日志、trace 与错误数据，risk=`high`。

### Exact host mapping

- [Hosted guide](https://launchdarkly.com/docs/home/getting-started/mcp-hosted)明确点名 Cursor、Claude Code、VS Code with Copilot、Windsurf，并分别提供 Cursor、Claude Code、Windsurf、GitHub Copilot 的官方配置章节。
- [Local guide](https://launchdarkly.com/docs/home/getting-started/mcp-local)另行明确 Claude Desktop、Cursor 与 GitHub Copilot。
- 映射：`Claude Desktop -> claude-desktop`；`Claude Code -> claude-code`；`Cursor -> cursor-desktop`；`VS Code -> microsoft-vscode`；`GitHub Copilot -> github-copilot`；`Windsurf -> windsurf-editor`。
- 不把 overview 中 agent skills 对 Codex 的兼容说明外推为 MCP host 关系。

### 裁决

`ready-link-only`。Hosted/local、版本、许可/条款、权限和撤权均可准确陈述，但不得代用户授权或操作 flags/configs。

## D14 — Snyk Studio MCP

### Identity、形态与版本

- [Snyk Studio overview](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations)与 [getting started](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/getting-started-with-snyk-studio)明确：Snyk MCP Server 作为 Snyk CLI 的一部分在本机运行，需要 local file access；Snyk 不提供 hosted remote MCP server。
- Publisher-controlled [`snyk/studio-mcp`](https://github.com/snyk/studio-mcp)闭合 official implementation identity；观察时最新 release 是 [`v1.15.3`](https://github.com/snyk/studio-mcp/releases/tag/v1.15.3)，repo [LICENSE](https://github.com/snyk/studio-mcp/blob/main/LICENSE)为 Apache-2.0。承载它的 [`snyk/cli`](https://github.com/snyk/cli)也使用 [Apache-2.0](https://github.com/snyk/cli/blob/main/LICENSE)。
- 官方 quickstarts 使用 rolling/latest CLI；`v1.15.3`仅是本次 source snapshot，不应变成 AI Hub 托管安装承诺。

### 认证、撤权与副作用

- [CLI authentication](https://docs.snyk.io/snyk-cli/authenticate-to-use-the-cli)明确支持 OAuth 2.0、PAT 与 legacy API token，并会把授权材料保存在本机。PAT 可在 Snyk UI/API [revoke](https://docs.snyk.io/snyk-api/authentication-for-api/personal-access-tokens-pats)，legacy API token 可 [Revoke & Regenerate](https://docs.snyk.io/snyk-api/authentication-for-api/revoke-and-regenerate-a-snyk-api-token)；Snyk MCP tool list还包含 logout。
- MCP 工具可扫描 source、dependencies、IaC、containers 与 SBOM，并可建立 folder trust、认证和发送反馈。[Snyk Studio overview](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations)明确 SCA scan 可能在本机执行 Gradle/Maven 等第三方 ecosystem tools 来获取 dependency tree。
- [Cursor guide](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/quickstart-guides-for-snyk-studio/cursor-guide)与 [Windsurf guide](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/quickstart-guides-for-snyk-studio/windsurf-guide)说明 Snyk Code 会临时 clone 和/或上传代码并按 retention policy 缓存。官方 MCP tool list没有自动编辑 source 的专用工具；但 host agent 可能根据 findings 修改代码，必须由用户在 host 内审查。Local execution、源码外发与 workspace 信任使 risk=`high`。

### Exact host mapping

- Snyk 逐产品官方 quickstarts 明确点名 [Claude Code](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/quickstart-guides-for-snyk-studio/claude-code-guide)、[Codex CLI](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/quickstart-guides-for-snyk-studio/codex-cli-guide)、[Cursor](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/quickstart-guides-for-snyk-studio/cursor-guide)、[Gemini CLI](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/quickstart-guides-for-snyk-studio/gemini-cli-guide)与 [Windsurf](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/quickstart-guides-for-snyk-studio/windsurf-guide)。
- [GitHub Copilot guide](https://docs.snyk.io/integrations/developer-guardrails-for-agentic-workflows/quickstart-guides-for-mcp/github-copilot-guide)明确是在 VS Code 中通过 Copilot 使用 Snyk MCP。
- 映射：`Claude Code -> claude-code`；`Codex CLI -> codex-cli`；`Cursor -> cursor-desktop`；`Gemini CLI -> gemini-cli`；`VS Code -> microsoft-vscode`；`GitHub Copilot -> github-copilot`；`Windsurf -> windsurf-editor`。

### 裁决

`ready-link-only`。AI Hub 只能说明风险并打开官方页面；不得下载/运行 CLI、信任 workspace、触发扫描或接触认证材料。

## D15 — Twilio Docs MCP

### Identity、版本与条款

- Twilio 的 [官方 MCP 页面](https://www.twilio.com/docs/ai/mcp)闭合 publisher-hosted Twilio MCP server identity。它是只检索 Twilio public OpenAPI specs、Docs/Support、SendGrid Docs/Support 与 Segment Docs 的 remote service。
- 当前状态为 Public Beta、滚动服务；页面明确 Public Beta 不受 Twilio Support Terms 或 SLA 覆盖。它不是一个有独立开源 server license 的 local package。
- [Twilio Terms of Service](https://www.twilio.com/en-us/legal/tos)把 beta/developer-preview/limited-release 服务定义为 Beta Offerings，并允许 Twilio 修改或停止提供；因此不能承诺稳定 API、SLA 或永久可用。

### 认证、撤权与副作用

- 官方页明确当前 service 只索引公开资料，无需 Twilio account、API key 或其他认证；撤权等价于从 host 删除/停用该 connection，不存在 Twilio account token 要撤销。
- 当前仅有 search 与 retrieve 两类工具；官方限制明确它不代表用户执行 Twilio API call。副作用限于把用户问题发送给 remote retrieval service，并把公开文档/schema 返回 host；未来计划中的 OAuth execute-ready tools 不属于当前 identity。
- 无认证、只读、无 API execution 降低了操作风险，但 Public Beta 的契约/能力可漂移，risk=`guarded`。

### Exact host mapping

- [官方 MCP 页面](https://www.twilio.com/docs/ai/mcp)明确列出 Claude Connector，并说明覆盖 Claude web/desktop/mobile；另有 Claude Code CLI、Cursor 与 Codex 的独立 setup 段落。
- 映射：`Claude Desktop -> claude-desktop`；`Claude Code CLI -> claude-code`；`Cursor -> cursor-desktop`；`Codex CLI -> codex-cli`。
- 页面另列 OpenCode CLI、Figma Make 与 Replit，但本地没有同名 enabled ai-tool exact ID；不得映射到形态不同的 `opencode-desktop`、`figma-design` 或 `replit-agent`。

### 裁决

`ready-link-only`。Future candidate 必须保留“当前只读 docs retrieval / no auth / no API execution / Public Beta”四项边界，并在发布前重验是否已发生能力漂移。

## D16 — Square official MCP

### Identity、形态与版本

- Square 的 [官方 MCP 文档](https://developer.squareup.com/docs/mcp)闭合 Block-hosted remote 与 official local server 两种形态，并明确当前为 Beta。
- Publisher-controlled [`square/square-mcp-server`](https://github.com/square/square-mcp-server)闭合 local implementation；[`package.json`](https://github.com/square/square-mcp-server/blob/main/package.json)和 [release `0.1.2`](https://github.com/square/square-mcp-server/releases/tag/0.1.2)闭合 fixed local version，仓库 [LICENSE](https://github.com/square/square-mcp-server/blob/main/LICENSE)为 Apache-2.0。
- Remote service 滚动且只访问 production resources；Apache-2.0 不重新许可 hosted service 或 Square API/data。

### 认证、撤权与副作用

- Remote 使用 seller OAuth 并允许用户选择 granular scopes；local 使用 Square access token。Square 的 [OAuth best practices](https://developer.squareup.com/docs/oauth-api/best-practices)说明 seller 可从 Square Dashboard disconnect application，或由应用调用 RevokeToken；[RevokeToken reference](https://developer.squareup.com/reference/square/oauth-api/revoke-token)说明可撤销单个 token 或整个 authorization。Local token 则必须由用户在 Square Developer Console 管理/替换并从 host 配置移除。
- 官方页说明 server 连接完整 Square API platform，包括 customers、orders、items 等；local 只有在显式 read-only 限制时才禁写。Remote 只访问 production resources，local 可选 Sandbox；官方强烈建议先在 Sandbox 测试。
- 工具可能创建或修改 orders、catalog/customer data、payments 等 merchant resources，生产写入可能带来财务与业务影响，risk=`high`。

### Exact host mapping

- [Square MCP 文档](https://developer.squareup.com/docs/mcp)明确点名 Claude Desktop、Goose、Cursor 与 Windsurf；Goose 段落进一步明确 Goose Desktop 与 Goose CLI 共用配置。
- 映射：`Claude Desktop -> claude-desktop`；`Goose Desktop -> goose-desktop`；`Cursor -> cursor-desktop`；`Windsurf -> windsurf-editor`。
- `Claude.ai`不用于推导其他本地产品；Goose CLI 没有 exact local host ID，故不另建映射。

### 裁决

`ready-link-only`。高风险财务/商户写入意味着 AI Hub 只能链接官方页面，不能建立 remote connection、运行 local package 或测试 Square API。

## Candidate 安全合同

如 CTO 后续授权生成 candidate，这五项只能采用统一的非执行投影：

- `moduleId="resource-link"`
- target `capabilities=["website"]`
- `installProfileId=""`
- `clientManagedInstall=false`
- `credentialPolicy="never-collect"`
- AI Hub 不请求、收集、保存、代理、验证或转发 OAuth、API key、PAT、token、secret 或任何其他认证材料。
- 不写入 runtime command、args、env、headers、endpoint、package/install path 或 credential value。
- 不安装、不下载、不启动 server，不调用 MCP endpoint/tool，不测试 publisher API，不修改 host 配置。
- 每条仅连接上表由 publisher 明确点名的 exact host；任何新增 host 都须重新取得第一方产品名证据。
- Candidate 冻结前必须重新核对 publisher 页面、版本/条款、host exact IDs 与全部 active/history semantic identity；本稿不是发布授权。

## 未触碰边界

- 未下载、安装或执行任何 MCP server/CLI/package。
- 未调用任何 MCP endpoint、publisher API 或 OAuth flow。
- 未保存 command、args、env、headers、endpoint、credential 或 secret。
- 未修改 catalog、candidate、generator、test、state、release 或应用代码；本稿是唯一写入文件。
