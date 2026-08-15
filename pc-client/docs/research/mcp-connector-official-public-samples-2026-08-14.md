# MCP / Connector 官方公共源小样本（2026-08-14）

> 状态：candidate-only 只读研究冻结稿。未修改 active catalog/state/channel/release/App/schema/package/server，未下载或执行 MCP server，未登录、未带 key/token、未探测私有 API，也未绕过 robots/401/403/429。
> 上游普查：[comprehensive-mcp-connector-sources-census-2026-08-14.md](./comprehensive-mcp-connector-sources-census-2026-08-14.md)。本稿只验证低频采样能否得到可审查的 canonical metadata；不是新增 catalog 或安装授权。

## 结果

- 完成 **3 个公开源、每源 5 个原始样本**：Official MCP Registry 5、Docker MCP Catalog 5、ToolHive Catalog 5。
- canonical merge 后是 **14 个不同资源身份**：ToolHive `atlassian-remote` 与 active7 已有 `atlassian-rovo-mcp-server` 重复；Docker 的 `airtable-mcp-server` 指向第三方 local server，不等同 active7 的 Airtable 官方 remote MCP，因此只能记“同产品身份冲突”，不能覆盖。
- Official Registry 的前 5 条如果不加 `version=latest`，会返回同一 server 的多个历史版本；本轮使用文档化公开参数 `limit=5&version=latest`。这证明 AI Hub 必须按 `name + version` 保存观测，再按 `isLatest` 选择候选，不能把版本行当 5 个产品。
- Docker 与 ToolHive 的 “Official”/tier 是各目录分类，不自动证明 publisher、license、安全或 AI Hub 可托管安装；每条仍回溯到了公开 repo/package/endpoint，未闭合处保持 blocked/deferred。
- Postman、Higress、ModelScope 本轮 **deferred**：没有在不登录、不调用 key/API、不依赖动态内部接口的边界内完成稳定 5 条枚举。未为凑数扩大网络或探测接口。

## 采样方法与时间

- `observedAt`：2026-08-14（Asia/Shanghai）。
- Official Registry：公开文档化 `GET https://registry.modelcontextprotocol.io/v0.1/servers?limit=5&version=latest`，一次响应。
- Docker：公开 GitHub repo `docker/mcp-registry` 的 `servers/` 按 GitHub Contents API 默认字典序读取前 5 个目录，再读各自公开 `server.yaml`；同 host 顺序请求、约 1.6 秒间隔。
- ToolHive：公开 repo 当前 canonical redirect 为 `stacklok/toolhive-catalog`；读取 `registries/official/servers/` 前 5 个目录及 `server.json`，顺序请求、约 1.6 秒间隔。
- Publisher/license：只读公开 GitHub repository metadata、raw LICENSE/README 或 npm registry package metadata；没有下载 tarball/image，也没有连接、initialize、列 tool 或调用 endpoint。
- 历史重复：只读精确字符串查询 `admin/data/catalog-v1.json`、`admin/published/` 与 `docs/research/`；“0 命中”只表示这些受检路径内未命中，不证明全世界唯一。

## 1. Official MCP Registry（5）

Registry 本身的数据按其公开条款为 CC0，但 CC0 不覆盖 server、package、网站内容或远端服务。`status=active` / `isLatest=true` 只描述 registry 行状态，不代表安全、可用性或许可审核。

| 样本 | canonical identity / transport | publisher 与一手来源 | license / auth / 风险 | active7/历史重复与 candidate 结论 |
| --- | --- | --- | --- | --- |
| `ac.inference.sh/mcp@2.0.1` | Registry [canonical query](https://registry.modelcontextprotocol.io/v0.1/servers?limit=5&version=latest)；remote `streamable-http`：`https://api.inference.sh/mcp`；active/latest | reverse-DNS namespace `ac.inference.sh`；registry 本行未给 repository，endpoint/domain 是当前唯一 publisher-control 证据 | server/service license **未闭合**；页面描述含按次付费；auth、权限、数据保留、费率未在 registry metadata 中声明。不得仅凭 active/latest 连接 | 受检路径精确 identity/title **0 命中**。`discovered-unreviewed`；先补 publisher docs、ToS/privacy/auth/tool side effects，暂不进 managed profile |
| `ac.tandem/docs-mcp@0.3.2` | remote `streamable-http`：`https://tandem.ac/mcp`；[repo](https://github.com/frumu-ai/tandem)；[website](https://tandem.ac/docs-mcp)；active/latest | Frumu/Tandem 控制 `tandem.ac` 与 `frumu-ai/tandem`；repo 未归档，2026-08-05 有 push | repo 是 **mixed license**：MIT/Apache-2.0 + BUSL-1.1，root LICENSE 明确不作 blanket license；remote auth/tool/数据边界仍需 publisher 文档。大型 agent authority 平台 repo 不等于 docs endpoint server source | 受检路径 **0 命中**。`discovered-unreviewed`，只适合 remote official-link 候选；商业生产许可与 endpoint 权限未闭合 |
| `ag.hood/name-service@0.1.0` | remote `streamable-http`：`https://www.hood.ag/api/mcp`；[publisher docs](https://www.hood.ag/docs)；active/latest | reverse-DNS namespace/endpoint/docs 均为 `hood.ag`；registry 未给 repo | license、auth、链上交易/定价工具的 side effects 未闭合；名称服务涉及 availability/pricing，不能假定 read-only | 受检路径 **0 命中**。`discovered-unreviewed`；须先证明 tool list、签名/交易边界、网络与费用，不得自动连接 |
| `agency.goji/goji@1.0.1` | remote `streamable-http`：`https://mcp.goji.agency/mcp`；[documentation repo](https://github.com/goji-agency/goji-mcp)；active/latest | GOJI publisher 控制 repo、`goji.agency` 与 endpoint；repo 明确 server source 私有 | repo MIT **仅覆盖文档**，不覆盖 server/content/trademark；publisher 文档称无需 auth，但 `goji_start_enquiry` 会发送真实邮件，是显式外部副作用；本研究未调用 endpoint | 受检路径 **0 命中**。`discovered-unreviewed`；即使多数工具只读，也需对发信工具默认 deny/显式确认，不能标整个 server read-only |
| `agency.kesey/pretrip@1.0.1` | npm `pretrip-mcp@1.0.1`，stdio；[npm metadata](https://registry.npmjs.org/pretrip-mcp/1.0.1)；[publisher site](https://scan.kesey.agency/developers/)；active/latest | registry namespace `agency.kesey`，npm maintainer `keseyagency`；registry 未给 repo，npm metadata也未声明 repository | npm 声明 `GPL-2.0-or-later`、Node `>=18`；tarball integrity 可见但本研究未下载。处理 regulated-health marketing 文案，结果不得当法律/监管意见；数据外传、ruleset source、auth 尚未闭合 | 受检路径 **0 命中**。`discovered-unreviewed`；缺 source repo/固定执行审查与数据边界，不能进入 managed install |

## 2. Docker MCP Catalog（5）

公开 repo 当前 `servers/` 有 328 个目录；本轮只按字典序读取前 5 个。Docker manifest 的 source commit/image/config 是很好的 discovery evidence，但 **不是 Docker 对上游功能或 license 的替代担保**。

| 样本 | Docker identity / 固定来源 | publisher / license | auth、权限与风险 | active7/历史重复与 candidate 结论 |
| --- | --- | --- | --- | --- |
| `SQLite`（Archived） | `mcp/sqlite`；source `modelcontextprotocol/servers/src/sqlite`，branch `2025.4.24`，commit `b4ee623039a6c60053ce67269701ad9e95073306`；[manifest](https://github.com/docker/mcp-registry/blob/main/servers/SQLite/server.yaml) | MCP reference repo；GitHub license metadata为 NOASSERTION，须按 pinned subdirectory/commit 复核具体许可 | Docker title 明示 **Archived**；挂载 Docker named volume并读写 SQLite；reference/archived 不应当 production server | 受检路径 **0 命中**。**reject/deferred**：只保留历史/reference 关系，不进入 active discovery 候选 |
| `airtable-mcp-server` | `mcp/airtable-mcp-server`；[upstream](https://github.com/domdomegg/airtable-mcp-server) branch `master`，commit `2a5896d0891d13558e1313155b177fc0a4bc95d6`；[manifest](https://github.com/docker/mcp-registry/blob/main/servers/airtable-mcp-server/server.yaml) | community publisher `domdomegg`，repo MIT、未归档 | 要求 `AIRTABLE_API_KEY` secret；可读取 schema/records，描述称可 interact，权限范围和写操作需按 tool/令牌复核 | active7 已有 `airtable-mcp-server`，但它是 **Airtable 官方 remote OAuth MCP**；本项是第三方 local API-key server。**身份冲突，不得 merge/覆盖**；最多建 alternative implementation 关系，默认 blocked |
| `ais-fleet` | remote SSE `https://mcp.aisfleet.com/sse`；[manifest](https://github.com/docker/mcp-registry/blob/main/servers/ais-fleet/server.yaml)；dynamic tools | endpoint publisher `aisfleet.com`；manifest 未给 repo/version/license | SSE 已是旧 transport；动态 tools、auth、license、数据来源/定位隐私、费率均未闭合 | 受检路径 **0 命中**。`discovered-unreviewed`，证据不足；先补 publisher docs、auth、privacy、tool snapshot，不连接 |
| `aks` | `mcp/aks`；[upstream](https://github.com/Azure/aks-mcp) commit `e60444c3d739dc3606d9ff4cd3826019e02df8d9`；[manifest](https://github.com/docker/mcp-registry/blob/main/servers/aks/server.yaml) | Azure 官方组织，repo MIT、未归档 | 需挂载 host Azure credential dir 与 kubeconfig；支持 `readonly/readwrite/admin`，默认 readonly 但 namespace 未指定时允许全部；额外 helm/cilium tools。高权限基础设施风险 | 受检路径 **0 命中**。高风险 `discovered-unreviewed`；必须固定 read-only、namespace allowlist、最小 Azure principal，不能直接做一键 managed install |
| `alfresco` | image `angelborroy/alfresco-mcp-server`；[upstream](https://github.com/AlfrescoLabs/alfresco-mcp-server) commit `141731818b6b40aae4ccc7ca8fccaf0c5800769f`；[manifest](https://github.com/docker/mcp-registry/blob/main/servers/alfresco/server.yaml) | AlfrescoLabs org，repo Apache-2.0、未归档，但 repo description 明示 **experimental**；image namespace并非 AlfrescoLabs | 连接任意 `ALFRESCO_HOST`；manifest 未声明 auth secret/精确工具权限；experimental + image/publisher namespace 分离需供应链复核 | 受检路径 **0 命中**。`discovered-unreviewed`；补 image digest/signature、publisher authorization、auth/permission 后再议 |

## 3. ToolHive Catalog（5）

原 URL `stacklok/toolhive-registry` 当前 canonical redirect 为 [`stacklok/toolhive-catalog`](https://github.com/stacklok/toolhive-catalog)。`registries/official/servers/` 公开目录当前有 85 项，本轮按字典序取前 5 项。其 `tier=Official` 是 ToolHive taxonomy；必须继续看 upstream owner、package、secret 与 permissions。Catalog repo 为 Apache-2.0，但不重新许可第三方 server/image/service。

| 样本 | ToolHive identity / package / upstream | publisher / license | auth、权限与风险 | active7/历史重复与 candidate 结论 |
| --- | --- | --- | --- | --- |
| `io.github.stacklok/adb-mysql-mcp-server@1.0.0` | OCI `ghcr.io/stacklok/dockyard/uvx/adb-mysql-mcp-server:2.0.0`；[upstream](https://github.com/aliyun/alibabacloud-adb-mysql-mcp-server)；[entry](https://github.com/stacklok/toolhive-catalog/tree/main/registries/official/servers/adb-mysql-mcp-server) | Aliyun org upstream Apache-2.0；ToolHive-built OCI 另有 Sigstore provenance | DB password、Alibaba AK/SK secrets；network `insecure_allow_all`；默认 SQL toolset/read-only，但 `ENABLE_SQL_WRITE_TOOLS=true` 可开放 DDL/DML/DCL/TCL。资源 version `1.0.0` 与 image `2.0.0` 不一致，需先解释 | 受检路径 **0 命中**。高风险 `discovered-unreviewed`；版本漂移、网络 allow-all 与 write toggle 未闭合，blocked |
| `io.github.stacklok/agentql-mcp@1.0.0` | OCI `ghcr.io/stacklok/dockyard/npx/agentql-mcp:1.0.1`；[upstream](https://github.com/tinyfish-io/agentql-mcp)；[entry](https://github.com/stacklok/toolhive-catalog/tree/main/registries/official/servers/agentql-mcp) | Tinyfish/AgentQL org upstream MIT；ToolHive-built OCI 有 Sigstore provenance | 必需 `AGENTQL_API_KEY`；只放行 `api.agentql.com:443`，但工具可按任意公共 URL做数据抽取，涉及 robots/ToS/隐私；resource/image version不一致 | 受检路径 **0 命中**。`discovered-unreviewed`；需 URL policy、数据处理与版本映射，不自动安装 |
| `io.github.stacklok/apollo-mcp-server@1.0.0` | OCI `ghcr.io/apollographql/apollo-mcp-server:v1.17.0`；[upstream](https://github.com/apollographql/apollo-mcp-server)；[entry](https://github.com/stacklok/toolhive-catalog/tree/main/registries/official/servers/apollo-mcp-server) | Apollo GraphQL 官方 org，repo MIT；image 由 publisher namespace发布 | `APOLLO_KEY` secret 与 graph ref；network `insecure_allow_all`；GraphQL operation 可能含 mutations；resource version `1.0.0` 与 image `v1.17.0` 不一致 | 受检路径 **0 命中**。`discovered-unreviewed`；需 operation allowlist/readonly contract、network scope 与版本映射，blocked |
| `io.github.stacklok/astra-db-mcp@1.0.0` | OCI `ghcr.io/stacklok/dockyard/npx/astra-db-mcp:1.2.2`；[upstream](https://github.com/datastax/astra-db-mcp)；[entry](https://github.com/stacklok/toolhive-catalog/tree/main/registries/official/servers/astra-db-mcp) | DataStax org upstream Apache-2.0；ToolHive-built OCI 有 Sigstore provenance | 必需 Astra token/endpoint；network `insecure_allow_all`；tools 明确含 create/update/delete collection/record 与 bulk delete；资源/image version不一致 | 受检路径 **0 命中**。高风险 `discovered-unreviewed`；写删权限、secret、network 与版本映射未闭合，blocked |
| `io.github.stacklok/atlassian-remote@1.0.0` | remote SSE `https://mcp.atlassian.com/v1/sse`；[Atlassian publisher page](https://www.atlassian.com/platform/remote-mcp-server)；[entry](https://github.com/stacklok/toolhive-catalog/tree/main/registries/official/servers/atlassian-remote) | Atlassian 官方 publisher；remote service 无开源 server license 声明，受 Atlassian service terms | OAuth 2.1，沿用用户权限；tools 含 create/edit/transition Jira issue、create/update Confluence page/comment，存在明确写副作用；SSE endpoint/entry可能落后于当前 publisher docs | **与 active7 `atlassian-rovo-mcp-server` 重复**（publisher/product/remote service）。不新增 Resource，只可给现有记录补 `discoveredVia=toolhive` 候选证据；任何 endpoint 更新须重新以 Atlassian 一手文档核验 |

## 4. Deferred sources（不探测内部接口）

| 来源 | 本轮结果 | 阻断与后续最小动作 |
| --- | --- | --- |
| Postman official MCP list | deferred | Public workspace/list 页面可浏览，但本轮未在无需账号且不依赖站点内部 API 的边界内稳定抽出 5 条 canonical publisher/repo/package/version/endpoint。后续只用 Postman 明示 public workspace/Collection export 或人工详情页；不调用 undocumented API |
| Higress MCP Marketplace | deferred | 公开动态 marketplace 可见，但没有在本轮闭合稳定、许可清晰的 5 条公开枚举契约。后续只读公开详情页，每次最多 5 条；若遇动态内部 API、登录、403/429 即停 |
| ModelScope MCP 广场 | deferred | 公开详情页存在，但 documented OpenAPI 需要 Bearer token；本轮不调用 token API，也没有为凑数抓动态内部接口。后续可由人工提供 5 个公开详情 URL，或等官方提供匿名 public feed |

## Canonical merge 与安全结论

1. **14 个 canonical identities，不是 15 个新品。** `atlassian-remote` 回归现有 `atlassian-rovo-mcp-server`；`airtable-mcp-server` 则是第三方 local API-key implementation，不能与官方 remote OAuth implementation 合并成同一可执行 profile。
2. **Source/catalog 版本与执行 artifact 版本分开。** ToolHive 多项 `server.version=1.0.0`，OCI 实际为 1.0.1/1.2.2/2.0.0/v1.17.0；AI Hub 若日后评审必须锁执行 artifact digest/version，不能只显示 registry version。
3. **目录 tier/badge 不等于 publisher trust。** Docker Archived、ToolHive Official、Registry active/latest 都只进入 provenance；是否可安装取决于 upstream identity、license、固定 artifact、hash/signature、permissions、credentials 与 uninstall plan。
4. **副作用按 tool/permission 建模。** GOJI 的发信工具、AKS admin/readwrite、Astra CRUD/bulk delete、Apollo mutations、Atlassian create/edit、ADB SQL write toggle 都阻止“整个 server 默认只读”的宽泛声明。
5. **本轮没有 catalog mutation 建议。** 14 个身份中，1 个明确 active7 duplicate、1 个 implementation conflict、1 个 archived reject，其余均保持 `discovered-unreviewed`/blocked；需要独立 CTO/频道审核后才能进入任何 candidate merge。

## 验证与边界

- 精确字符串扫描范围：`admin/data/`、`admin/published/`、`docs/research/`；只读。结果不等同 signed active release 的正式审计，也不替代 catalog identity resolver。
- 未调用任何 MCP endpoint，因此没有宣称 endpoint 真实在线、auth 可用或 tool list 与 manifest 一致。
- 未下载 npm tarball、OCI image 或源代码归档；GitHub raw/metadata 与 npm package metadata读取不构成执行验证。
- 如进入下一轮，最多从 deferred 来源各人工核验 5 个公开详情 URL；不应扩到二级聚合目录，更不应为数量绕过登录、robots、API key 或 rate limit。
