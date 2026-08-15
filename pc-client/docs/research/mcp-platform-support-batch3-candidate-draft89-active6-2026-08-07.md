# MCP resource platformSupport Batch 3（draft89 / v2 active6）

状态：`candidate-only=true`、`publishable=false`。本批排除 Batch 1/2，不改 catalog/state/schema/profile，不 saveDraft、publish、package、upload、download 或 install。

## 基线与选集

权威事实源：`pc-client/admin/published/catalog-store/state.json`，`draft.revision=89`、v2 active release `catalog-v00000006-567e671621f1-3dcee587`、123 MCP resources、472 targets、6 managed targets。

Batch 1/2 已排除 60 个 resource；剩余 63 个中有 57 official、5 reviewed-community、1 community。本批选取剩余 official 中宿主覆盖和一手 canonical source 较清晰的 40 个，不使用聚合站热度或推测作者身份。

本批 resource：

`anytype-mcp`、`apify-mcp`、`arcade-mcp-gateway`、`benchling-mcp`、`browserbase-mcp`、`composio-mcp`、`firecrawl-mcp`、`gitbook-published-docs-mcp`、`mem0-mcp`、`neon-mcp`、`new-relic-mcp`、`pinecone-mcp`、`qdrant-mcp`、`tavily-mcp`、`weaviate-mcp`、`zep-memory-mcp`、`assemblyai-docs-mcp`、`datadog-mcp-server`、`esri-arcgis-location-platform-mcp`、`grafana-mcp`、`hubspot-mcp-server`、`livekit-docs-mcp`、`make-mcp-server`、`oray-awesun-mcp`、`salesforce-hosted-mcp-servers`、`servicenow-mcp-server`、`siemens-xcelerator-developer-portal-mcp`、`snowflake-managed-mcp`、`tailscale-aperture-mcp-proxy`、`vimeo-mcp-server`、`autodesk-fusion-mcp`、`elastic-agent-builder-mcp`、`google-calendar-mcp`、`google-chat-mcp`、`google-docs-mcp`、`google-drive-mcp`、`google-gmail-mcp`、`google-people-mcp`、`google-sheets-mcp`、`google-slides-mcp`。

统计：40 resources、126 现有 resource×host tuples、378 个 resource×host×platform 预览组合。target 不增加 platform 字段。

## Claims 与运行形态

每个 resource 通过 JSON 的 `claimSetId` 关联 Windows/macOS/Linux 三条 claim；每条 claim 为 `status=unknown`、`architectures=[unknown]`，证据引用该 resource 的 canonical first-party HTTPS source，观察时间为 `2026-08-07T00:00:00.000Z`。

- `remote` 形态候选：Apify、Arcade、Benchling、Browserbase、Composio、Firecrawl、GitBook、Mem0、Neon、New Relic、Pinecone、Tavily、Zep Memory、AssemblyAI、Datadog、ArcGIS、Grafana、HubSpot、LiveKit、Make、AweSun、Salesforce、ServiceNow、Siemens、Snowflake、Tailscale、Vimeo、Google Workspace 系列等。
- `native` 形态候选：Anytype、Qdrant、Weaviate、Autodesk Fusion、Elastic；本地 server/package 入口不自动等于三平台支持。
- 本批没有官方明确的 WSL、container 或 browser runtime claim，因此不声明这些 runtime；npm、Python、Docker、仓库和客户端存在也不改变 unknown。
- remote MCP 即使跨平台可连接，仍需固定 transport、auth handoff、status、revoke、权限/费用边界和 ownership receipt；不得转为 managed、Agent 或 Workflow 依赖。

## 交集预览与阻断

| 预览范围 | 组合数 | available | managedEligible | 主要阻断 |
|---|---:|---:|---:|---|
| Batch 3 全部 resource×host×platform | 378 | 0 | 0 | fixed profile platformSupport 为空；resource/host claims 保守 unknown |
| 既有 fixed profile 交集 | 0 | 0 | 0 | 本批没有 managed target；profile artifact/lifecycle/receipt 未提供平台 claim |

即使以后 resource/host claims 变为 supported，仍需独立审核 platform-specific artifact、profile、lifecycle、receipt 与真实设备验收；当前 Agent Broker 与客户端动作继续 fail-closed。

## 平台统计

| 对象 | Windows | macOS | Linux |
|---|---:|---:|---:|
| resource claims | 40 | 40 | 40 |
| supported | 0 | 0 | 0 |
| unknown | 40 | 40 | 40 |
| fixed profile claims | 0 | 0 | 0 |

target tuple 只保留现有 resourceId/host/module/profile/capability 身份；平台只存在于 candidate projection。

## 安全、来源与去重

- 所有 canonicalSource 来自 active draft 的 official resource identity；聚合站如有发现信息只能作为 `discoveredVia`，本批没有把它当 canonical evidence。
- resourceId 唯一，host 列表取现有 target tuple；与 Batch 1/2 交集为 0。
- candidate JSON 不含后台执行字段，不包含命令、参数、环境、请求头、凭据、脚本、秘密、任意 endpoint 或 path。
- `adapterEvidence` 仅引用现有 registry 边界；不新增 adapter、不写 registry、不创建 profile。

## 最后剩余批次估算

Batch 3 后剩余 23 个 MCP resources：17 official、5 reviewed-community、1 community。最后批次可优先处理剩余 17 official，再单独评估 reviewed-community；预计 20–35 个 first-party HTTPS 页面请求、约 1–3 分钟、缓存元数据不超过 8 MiB。来源/作者/license 不清的社区项继续 blocked，不因数量强行纳入。

## 官方来源

每项具体 canonicalSource、host tuples、claimSetId 与 observedAt 见同名 JSON。代表性一手来源包括 [Apify MCP](https://docs.apify.com/integrations/mcp)、[Firecrawl MCP](https://docs.firecrawl.dev/mcp)、[Neon MCP](https://neon.com/docs/ai/neon-mcp-server)、[Grafana MCP](https://grafana.com/docs/grafana/latest/developer-resources/mcp/set-up/)、[Autodesk Fusion MCP](https://help.autodesk.com/view/fusion360/ENU/?guid=FMCP-OVERVIEW)、[Google Workspace MCP 配置](https://developers.google.com/workspace/guides/configure-mcp-servers)。
