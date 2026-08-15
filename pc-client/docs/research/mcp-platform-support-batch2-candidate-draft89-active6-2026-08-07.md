# MCP resource platformSupport Batch 2（draft89 / v2 active6）

状态：`candidate-only=true`、`publishable=false`。本批排除 Batch 1 的 20 个 resource，不改 catalog/state/schema/profile，不 saveDraft、publish、package、upload、download 或 install。

## 基线与选集

权威事实源仍为 `pc-client/admin/published/catalog-store/state.json`：`draft.revision=89`、v2 active release `catalog-v00000006-567e671621f1-3dcee587`、123 MCP resources、472 targets、6 managed targets，其余 link-only。

Batch 1 已覆盖 `openai-codex-mcp-config`、`zep-docs-mcp` 及 18 个官方资源；本批从剩余 103 个资源中筛选 40 个 official MCP，实际 official 候选池为 97 个。选集按现有 target tuple 数量、宿主覆盖和官方 HTTPS identity 排序，不使用 stars、ratings 或 downloads。

本批资源：

`gitlab-mcp-server`、`microsoft-azure-devops-mcp`、`n8n-mcp-server`、`roblox-studio-mcp-server`、`miro-mcp-server`、`clickup-mcp-server`、`wolfram-cloud-mcp`、`wordpress-com-mcp`、`semrush-mcp`、`intercom-mcp-server`、`asana-mcp-server-v2`、`google-chrome-devtools-mcp`、`zapier-mcp`、`mongodb-mcp-server`、`terraform-mcp-server`、`pulumi-mcp-server`、`circleci-mcp`、`box-mcp-server`、`pipedream-mcp`、`shopify-storefront-mcp`、`wolfram-local-mcp`、`ansys-pylumerical-mcp`、`cesium-ai-integrations-mcp`、`databricks-managed-mcp-directory`、`meshy-mcp-server`、`krea-mcp-server`、`pandadoc-mcp-server`、`penpot-mcp-server`、`webflow-mcp-server`、`matlab-mcp-core-server`、`browserstack-mcp-server`、`neo4j-mcp-server`、`confluent-cloud-global-mcp`、`confluent-cloud-regional-mcp`、`wix-mcp`、`playcanvas-editor-mcp`、`cloudinary-mcp-servers`、`onlyoffice-docspace-mcp`、`airtable-mcp-server`、`docling-mcp`。

统计：40 resources、200 现有 resource×host tuples、600 个 resource×host×platform 预览组合。已补入 active draft 的 `wolfram-cloud-mcp | cursor-desktop` 原始 target tuple：`productId=cursor-desktop`、`compatibility=official`、`moduleId=resource-link`、`installProfileId=""`、`capabilities=["website"]`、`enabled=true`。target 不增加 platform 字段。

## Claims 与运行形态

每个 resource 通过 JSON 中的 `claimSetId` 关联 Windows/macOS/Linux 三条保守 claim；每条 claim 使用 `status=unknown`、`architectures=[unknown]`，证据引用该 resource 的 canonical first-party HTTPS source 和 `observedAt=2026-08-07T00:00:00.000Z`。`unknown` 是有意的闭合结果：官方身份/配置入口存在，不等于官方明确承诺三平台运行。

- `remote`：GitLab、Azure DevOps、Miro、ClickUp、Wolfram Cloud、WordPress.com、Semrush、Intercom、Asana、Zapier、CircleCI、Box、Pipedream、Shopify、Databricks、Meshy、Krea、PandaDoc、Penpot、Webflow、BrowserStack、Confluent、Wix、Cloudinary、ONLYOFFICE、Airtable 等官方云端/HTTP 入口候选。
- `native`：n8n、Roblox Studio、Chrome DevTools、MongoDB、Terraform、Pulumi、Wolfram Local、PyLumerical、Cesium、MATLAB、Neo4j、PlayCanvas、Docling 等官方本地宿主/本地 server 入口候选。
- 本批没有把 npm、Python、Docker、GitHub repository、浏览器客户端或网络可达性自动转换成平台 supported；没有一手明确的 WSL、container 或 browser runtime claim，因此不声明这些 runtime。
- remote 资源即使多个客户端可以连接，也仍需固定 transport、auth handoff、status、revoke、费用/权限边界和所有权收据，不能成为 managed 或 Agent binding。

## 交集预览与阻断

| 预览范围 | 组合数 | available | managedEligible | 主要阻断 |
|---|---:|---:|---:|---|
| Batch 2 全部 resource×host×platform | 600 | 0 | 0 | fixed profile platformSupport 缺失；resource/host claim 保守 unknown |
| 既有 fixed profile 交集 | 0 | 0 | 0 | Batch 2 无 managed target；active fixed profiles 没有 platformSupport |

即使未来 resource 与 host claims 变为 supported，profile claim、platform-specific artifact、lifecycle、ownership receipt 仍必须独立通过；当前 Broker 和客户端动作继续 fail-closed。Batch 2 文件重算后 target coverage 为 200/200，Batch 1–4 汇总见 Batch 4 文件。

## 平台统计

| 对象 | Windows | macOS | Linux |
|---|---:|---:|---:|
| resource claims | 40 | 40 | 40 |
| supported | 0 | 0 | 0 |
| unknown | 40 | 40 | 40 |
| fixed profile claims | 0 | 0 | 0 |

Target tuple 仅保留现有 resourceId/host/module/profile/capability 身份；平台仅用于 candidate projection，绝不回写 target。

## 安全、来源与去重

- 所有 canonicalSource 取 active draft 的第一方 HTTPS identity；本批没有聚合站热度字段，也没有虚构外部指标。
- resourceId 唯一，host 列表由现有 target tuple 去重；Batch 1 resourceId 逐一排除。
- candidate JSON 不含后台执行字段，不包含命令、参数、环境、请求头、凭据、脚本、秘密、任意 endpoint 或 path。
- `adapterEvidence` 只引用现有 registry/adapter 边界，不新增 adapter、不写 registry、不创建 profile。

## 剩余资源与下一批估算

Batch 2 后剩余 63 个 MCP resources，其中 57 个 official、6 个非 official/需重新核验。下一批可从剩余 official 中选 25–35 个，预计 25–50 个 first-party HTTPS 页面请求、约 1–4 分钟、缓存元数据不超过 12 MiB；不下载包、不调用禁用 API、不运行安装。优先补足游戏开发、科研/数据、媒体和低宿主覆盖资源的身份与平台边界。

## 官方来源

每项具体 canonicalSource、host tuples、claimSetId 与 observedAt 见同名 JSON。代表性一手来源包括 [GitLab MCP](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)、[Roblox Studio MCP](https://create.roblox.com/docs/studio/mcp)、[Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)、[Terraform MCP](https://developer.hashicorp.com/terraform/mcp-server/deploy)、[PlayCanvas MCP](https://developer.playcanvas.com/user-manual/editor/mcp-server/)。
