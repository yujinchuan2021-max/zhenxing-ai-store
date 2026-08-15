# Official MCP Registry 剩余全量枚举合同（第一阶段，2026-08-15）

> 状态：只读合同研究冻结稿。本稿不是枚举结果、catalog candidate、安装配置、安全认证或发布许可。本阶段没有请求新的 Registry 列表页，也没有批量枚举。

## 结论先行

- **可以做聚合器式全量 metadata 同步。** 官方聚合器指南明确提供匿名只读 REST API，预期下游低频抓取并把 Registry Data 持久化到自己的数据仓库；Registry Data 由官方条款置于 CC0。该许可只覆盖 Registry Data，不重新许可链接到的 package、源码、网站或托管服务。[Aggregator guide](https://modelcontextprotocol.io/registry/registry-aggregators)；[Official Registry Terms](https://modelcontextprotocol.io/registry/terms-of-service)。
- **官方公开面没有当前总量字段。** `metadata.count` 只是本页数量，响应 schema 没有 `total`/`totalCount`；数据库读取也只是排序后 `LIMIT`，没有总量查询。因此不完成分页就不能准确给出当前总数，本阶段不以第三方目录数字替代官方事实。[OpenAPI](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/docs/reference/api/openapi.yaml)；[response types](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/pkg/api/v0/types.go)；[PostgreSQL list implementation](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/internal/database/postgres.go)。
- **继续点固定且此前页面不重抓：** 下一阶段首个请求从精确 opaque cursor `ai.agentutility/mcp-model-router:0.1.1` 开始，并继续使用 `version=latest`。此前连续前缀共冻结 45 个不同 Registry identity，但它们分散在多个观测时点，只能称为“已观察前缀”，不能冒充同一时刻的当前总量。
- **metadata 枚举不等于资源复核。** Registry 只做 namespace authentication 和 metadata hosting，不替每个 server 审代码、许可证、服务条款、认证、宿主或工具副作用。下一阶段只能生成 `discovery-only` inventory；逐条回溯 publisher/repo/docs/package/license/auth/revoke/side effects 必须另开低频、分批的一手复核阶段。[Registry trust and security](https://modelcontextprotocol.io/registry/about#trust-and-security)；[Moderation policy](https://modelcontextprotocol.io/registry/moderation-policy)。

## 本轮官方来源与观测边界

### 官方合同来源

| 来源 | 本稿采用的事实 |
| --- | --- |
| [Registry Aggregators](https://modelcontextprotocol.io/registry/registry-aggregators) | 匿名只读入口、cursor 分页、低频持久化、`updated_since`、status 同步、无 uptime/durability 保证 |
| [Official Registry API](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/docs/reference/api/official-registry-api.md) | production base URL；`search`、`updated_since`、`version`、`include_deleted`；public list/detail 与写接口边界 |
| [OpenAPI](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/docs/reference/api/openapi.yaml) | `GET /v0.1/servers`、opaque cursor、ServerList 与当前页 `count`/`nextCursor` |
| [list handler](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/internal/api/handlers/v0/servers.go) | `limit` 默认 30、最小 1、最大 100；`include_deleted` 与 `updated_since` 的组合规则 |
| [response types](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/pkg/api/v0/types.go) | exact response 字段、status enum、时间戳、`isLatest`、server identity/version |
| [database pagination](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/internal/database/postgres.go) | `(server_name, version)` 顺序、exclusive cursor、满页游标与终页细节 |
| [Terms](https://modelcontextprotocol.io/registry/terms-of-service) | CC0 Registry Data、个人信息处理告知、合法使用、品牌/非背书规则、无保证 |
| [repository LICENSE](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/LICENSE) | 实现代码处 Apache-2.0/MIT 迁移；项目文档（非 specification）为 CC-BY-4.0；这与 Registry Data 的 CC0 是三条不同许可边界 |

官方 source `main` 在本轮只读 `git ls-remote` 的固定提交为 `a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be`。它用于审计源码合同，不证明 production 此刻部署了完全相同的 commit；下一阶段仍须用真实响应 fail closed 验证。

### robots 观测

- 2026-08-15 对标准路径 [`https://registry.modelcontextprotocol.io/robots.txt`](https://registry.modelcontextprotocol.io/robots.txt) 做了一次 64 KiB 上限、禁止跳转的匿名 GET；返回 HTTP 404、`application/problem+json`、155 bytes、无 `Retry-After`。
- 该 404 只表示标准根路径当前没有提供 robots 指令，不等于放宽 Terms、API 合同或反滥用边界。响应建议了版本化 API 形似路径，但它们不是标准根 robots，本轮没有继续探测。
- 后续只使用文档化 `GET /v0.1/servers`，不抓 UI、`/docs` 交互页面、站内搜索、detail、metrics、私有 API、MCP endpoint 或第三方 bundle。

## 精确公开读取合同

### 入口、过滤与页大小

下一阶段唯一 baseline 入口：

```text
GET https://registry.modelcontextprotocol.io/v0.1/servers?limit=100&version=latest&cursor=ai.agentutility%2Fmcp-model-router%3A0.1.1
```

- host 必须精确为 `registry.modelcontextprotocol.io`，scheme 必须为 HTTPS，path 必须精确为 `/v0.1/servers`。
- `cursor` 是 opaque string；只能逐字使用上一成功页的 `metadata.nextCursor`，不得解析、拼接、大小写转换或自行推进。[OpenAPI cursor contract](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/docs/reference/api/openapi.yaml)。
- 固定 `version=latest`，目标是每个 canonical server 的当前 publication，而不是把历史版本当成不同资源。默认 `include_deleted=false`，所以 baseline 可见 `active` 与 `deprecated`，不主动枚举已删除项。[Official API filters](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/docs/reference/api/official-registry-api.md)。
- 官方版本化静态 OpenAPI 没有写出数值上限，但当前官方 handler source 明确为 default 30、minimum 1、maximum 100；计划采用 100 以减少请求次数。若 production 对 100 返回验证错误，整轮停止并回到合同审查，不静默降级或试探其他数值。[list handler](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/internal/api/handlers/v0/servers.go)。

### 响应字段与每页不变量

每页只在内存中读取完整 JSON，并在任何 checkpoint 写入前验证：

1. HTTP 必须为 200；media type 去除可选 charset 后必须精确为 `application/json`。
2. 顶层必须有 `servers` array 与 `metadata` object；`metadata.count` 必须为 0..100 的 integer 且严格等于 `servers.length`。
3. `metadata.nextCursor` 只能是缺失、空 string 或非空 string；其他类型整页阻断。
4. 每行必须有 `server.name`、`server.version` 与 `_meta["io.modelcontextprotocol.registry/official"]`。
5. official meta 必须含 `status`、`statusChangedAt`、`publishedAt`、`updatedAt`、`isLatest`；status 只接受 `active|deprecated|deleted`。baseline 固定 `version=latest&include_deleted=false`，因此要求 `isLatest===true`，出现 `deleted` 或未知状态即合同漂移并整轮停止。[official response types](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/pkg/api/v0/types.go)。
6. 当前页 `name@version` 必须唯一；全量已提交 identity 集合也不得再次出现。exact duplicate、同 identity 不同字节、重复 cursor 或 cursor 回环都停止，不能“最后写入者获胜”。
7. 遇新增/未知结构字段先整页隔离审查；不会把 preview schema 漂移静默吞入本地记录。

### 终止条件

- 规范合同说 `nextCursor` 为 null/empty 时没有更多结果。[OpenAPI ServerList](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/docs/reference/api/openapi.yaml)。
- 当前数据库实现只要 `results.length >= limit` 就把最后一条 identity 设为 next cursor，并没有多取一条判断“后面是否还存在”。因此如果最后一页恰好 100 条，它仍可能返回非空 cursor；随后必须再请求一次，才会得到 0 条和空 cursor。[database pagination](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/internal/database/postgres.go)。
- 唯一正常终态是：成功页满足上述 schema，且 `nextCursor` 缺失/为空。`count<100` 但仍给非空 cursor、`count>0` 却 cursor 不前进、或空页仍给非空 cursor，都视为漂移并停止。

## 网络、速率与响应体边界

官方聚合器指南建议下游“regular but infrequent”（示例约每小时一次）同步，但公开文档、OpenAPI 与本轮审阅的应用源码没有给出 production 数值配额，也没有定义 list endpoint 的 429 schema 或 `Retry-After` 合同。不能把“未文档化”表述为“永远不会限流”。[Aggregator guide](https://modelcontextprotocol.io/registry/registry-aggregators)；[OpenAPI](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/docs/reference/api/openapi.yaml)。

AI Hub 下一阶段采用更保守的本地策略；以下是 **AI Hub policy，不冒充官方配额**：

- host concurrency = 1；页面严格串行；两个成功请求之间至少 2 秒；每小时最多启动一轮 baseline/增量同步。
- redirect mode = manual；任何 3xx 都停止，不自动跟随，即使 Location 仍在同 host。
- 单请求 deadline 30 秒；响应体 streaming cap = 32 MiB。超时、提前断流、解压/JSON 失败或超过 cap 时丢弃整页，checkpoint 不推进。
- 401、403、429 立即停止；不登录、不换身份、不在同一轮重试。429 如带可解析 `Retry-After`，只规范化为下一次允许时间；header 缺失/无效则至少等待 1 小时并要求新一轮授权。
- 其他 4xx、5xx、DNS/TLS/网络错误同样停止当前轮；下一轮从最后成功 checkpoint 恢复，不在失败循环中重试。
- 不使用缓存旁路参数、并发分片、多个 IP、浏览器 session 或私有 token。

## 落盘白名单：允许持久化 normalized metadata，不落 raw

官方允许聚合器持久化 Registry Data，但 AI Hub 仍不保存原始 body、原始 headers 或任意执行/凭据材料。每个成功行只可投影为 discovery-only 白名单：

- `registryIdentity = server.name + "@" + server.version`
- `canonicalServerName = server.name`
- `title`, `description`, `version`, `websiteUrl`
- `repository.{source,url,id,subfolder}`（存在时）
- `packageRefs[]` 仅保留 `{registryType,registryBaseUrl,identifier,version}`；删除 transport、arguments、environmentVariables 与任何 value hint
- `hasPackages`, `hasRemotes`, `packageCount`, `remoteCount`；不保存 remote URL、headers 或 endpoint
- `status`, `statusMessage`, `statusChangedAt`, `publishedAt`, `updatedAt`, `isLatest`
- `classification="discovery-only"`, `candidateOnly=true`, `publishable=false`, `installProfileId=""`
- provenance 固定为 `discoveredVia="Official MCP Registry"` 与公共 list 文档链接；它不成为 publisher、sourceKind=official、reviewStatus 或安全 badge

必须递归拒绝持久化 command、args、env、environmentVariables、headers、credential、token、secret、value、endpoint、remote URL、script、runtime、managed install、tool invocation 或原始 publisher-provided `_meta`。Registry metadata 可能含个人 GitHub username、域名或描述内容；CC0 和公开性不免除 AI Hub 遵守适用隐私法律及最小化原则。[Terms: Privacy and Publicity](https://modelcontextprotocol.io/registry/terms-of-service)。

## Stop / resume / checkpoint 合同

### 已冻结续接基线

| 连续前缀 | 文件 | SHA-256 | 数量 / 输出 cursor |
| --- | --- | --- | --- |
| 1 | `docs/research/mcp-connector-official-public-samples-2026-08-14.md` | `c4a0d25287f6134407656b4cb64ecd2587b7f634af02a3c01a8cf2787d42fb1b` | 5；`agency.kesey/pretrip:1.0.1` |
| 2 | `docs/research/official-mcp-registry-next10-first-party-review-2026-08-14.md` | `da43d7555f1e657a30dc4d233f445778760fcbee7fc49de892f21b6a25ed2a24` | 10；`ai.adramp/google-ads:1.0.3` |
| 3 | `docs/research/official-mcp-registry-next10b-first-party-review-2026-08-15.md` | `8b9db20e3085798950b00a5c44c1451b4e2a0581c69b6fd5cb36f91281ad09ff` | 10；`ai.agenticshelf/graffeo:1.0.2` |
| 4 | `docs/research/official-mcp-registry-next10c-first-party-review-2026-08-15.md` | `2a14765227efdebb5191d056d0f4dbcb029448fe3063c1e9c3b89dfdd7c022f1` | 10；`ai.agenttrust/mcp-server:1.1.1` |
| 5 | `docs/research/official-mcp-registry-next10d-first-party-review-2026-08-15.md` | `a6c531a42897c21b96ee583a73a93efb9fa96f5b3ca38c4a2f91091c6ff86ec6` | 10；`ai.agentutility/mcp-model-router:0.1.1` |

算术为 5 + 10 + 10 + 10 + 10 = **45 个已观察 identity**。下一阶段不得重抓这五页；只验证文件字节和 SHA 后，以第五行 cursor 作为第一个未消费请求的输入。

### 每个成功页的 checkpoint

只有整页通过 HTTP、byte cap、JSON、schema、身份与重复检查后，才原子提交一份 normalized checkpoint。checkpoint 至少锁：

- 固定 query contract：host/path、`limit=100`、`version=latest`、默认 `include_deleted=false`
- `cursorIn`, `cursorOut`, `pageCount`, `pageNumber`, `observedAt`
- 本页 normalized identity 列表 SHA-256、累计 identity-set SHA-256、累计 accepted/deprecated/duplicate 数
- 上一 checkpoint SHA-256 与本 checkpoint SHA-256，形成可审 lineage
- `stopReason` 只在终态或阻断时写规范化 enum；不保存错误 body、raw header 或 token

若请求在完整验证前失败，不修改 checkpoint；后续获授权时可从同一 `cursorIn` 重取这一个未提交页。若成功 checkpoint 已提交，则恢复必须使用其 exact `cursorOut`，不得“为确认”重抓上一页。

恢复前 fail closed 验证：五份前缀 SHA、所有 checkpoint hash chain、累计 identity-set hash、最后 cursor、查询合同、目标文件不存在/与 checkpoint 一致、无并行 Registry 进程。任一漂移先停止审计。

## Duplicate 与状态收敛规则

1. **publication identity**：exact `server.name@server.version`；baseline 中重复即阻断。
2. **canonical server identity**：exact `server.name`；后续出现新 version 是同一 server lineage，不是新 Resource。
3. **provenance keys**：规范化 repository stable ID/owner-repo-subfolder、package registry+identifier、canonical website URL；只作 semantic duplicate 信号。
4. 不因同 namespace、同 publisher、同 repository、同 subfolder 上级、同显示名或相似功能自动合并。一个 monorepo 可以合法发布多个不同 server。
5. `active` 进入待一手复核队列；`deprecated` 进入 lifecycle ledger，不直接成为 ready；delta 中 `deleted` 形成 tombstone 并撤出发现队列。未知状态整批阻断。
6. 与 active catalog、全部本地 candidate/history 的 exact ID、registry identity、规范化 name+publisher、repository/package/source URL 比较必须在 metadata 枚举后独立执行。Registry namespace 只证明控制关系，不足以填写 publisherVendorId 或 `sourceKind=official`。
7. exact duplicate 若 normalized bytes 完全一致，只能在 **增量 reconciliation** 记作重复观测；baseline cursor 流中的重复仍表示分页漂移。相同 identity 不同事实必须进入 conflict ledger，不能覆盖。

## 活跃写入造成的非原子快照问题

公开 API 没有 snapshot token 或上界时间参数；分页期间仍可能有新发布、状态变化或新版本。把 2026-08-14/15 的前 45 条与未来续页合并，只能得到 rolling census，不能宣称数据库在单一时刻的原子快照。[Registry preview/no durability](https://modelcontextprotocol.io/registry/registry-aggregators)。

baseline 正常终止后，应另做一次 `updated_since` reconciliation：

- 以 `2026-08-14T00:00:00.000Z` 作为保守 overlap watermark，覆盖首次前缀研究当天以来对前缀、续页和 cursor 之前插入项的变化。
- 仍只用 `GET /v0.1/servers`、limit 100、cursor 分页；`updated_since` 按官方规则自动包含 deleted，不能同时强制 `include_deleted=false`。[Official API filters](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/docs/reference/api/official-registry-api.md)；[list handler](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/internal/api/handlers/v0/servers.go)。
- delta 与 baseline 分开计数，按 canonical server identity/version/status 合并；不得把重复更新算成新增资源。
- 因 API 没有 upper-bound snapshot，最终只能报告 `rolling census closed at <time>`，并公开 baseline/delta/duplicate/tombstone 算术，不能写“此刻绝对总数”。

## 当前总量与请求量能否估算

- 官方响应没有总量字段，本阶段也没有调用任何新列表页，因此 **当前 exact total = unknown**。
- 冻结事实只有 45 个连续已观察 identity；它们不是当前总量下界，因为旧记录在不同观测时点后可能被 deprecated/deleted。
- 下一阶段完成后，`discovery total = 45 + continuation unique - reconciliation tombstones + reconciliation new unique`，并单列 deprecated、deleted、exact duplicate 与 conflict 数。
- 若 cursor 之后有 `R` 条 baseline 记录，limit 100 的数据页数量约为 `ceil(R/100)`；当 `R` 是 100 的正整数倍时，当前实现还可能需要 1 个空 sentinel 页。`R` 在实际分页结束前不可由官方公开 schema预知。

## 许可、缓存、镜像与归属

- Aggregator guide 明确期待下游定期拉取并持久化，因此对 **Registry Data metadata** 做完整本地镜像是官方设计用途；CC0 不要求署名。[Aggregator guide](https://modelcontextprotocol.io/registry/registry-aggregators)；[Terms](https://modelcontextprotocol.io/registry/terms-of-service)。
- AI Hub 仍保留来源说明，建议用户可见文案为：“数据来源于 Official MCP Registry；该来源不表示双方合作、认可或安全背书。”Terms 允许陈述数据来源，但禁止暗示 affiliation、endorsement、sponsorship 或 partnership。[Terms: Branding](https://modelcontextprotocol.io/registry/terms-of-service)。
- Registry Data 的 CC0 不覆盖 package/source/service；逐资源 license、Terms、privacy 仍须第一方复核。
- 官方没有给 list response 的 TTL、ETag 或 Cache-Control 合同；不能依赖 HTTP cache 判 freshness。使用 checkpoint、`updatedAt`、status 与 `updated_since` 做应用层同步。
- 官方 docs 是 CC-BY-4.0，implementation source 处 Apache-2.0/MIT 迁移；本计划只引用/链接，不复制或再发布官方文档/源码。未来如分发代码或文档副本，必须分别遵守相应许可。[repository LICENSE](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/LICENSE)。

## 分阶段完成定义

### Phase 2：全量 metadata discovery-only

完成条件：从固定 cursor 到合法终页；完成 overlap delta；每个 identity 恰有一个 normalized inventory row 或 tombstone/conflict ledger；所有算术可复算；raw body/header/执行/凭据字段为 0；不改 catalog/state/channel/release/App/schema/package/server。

该阶段回答“Registry 公开 metadata 里还列了什么”，不回答“哪些条目可信、可展示、可连接或可安装”。

### Phase 3：本地结构化去重与分批路由

只读对照 active catalog 与全部 candidate/history。输出 exact duplicate、lineage、semantic-review、new-review-queue；不把同 publisher/namespace/monorepo 条目强行合并，不创建 Resource。

### Phase 4：逐条第一方复核

按固定小批次（建议每批 10，单 host concurrency 1）分别访问 publisher 官方 repo/docs/package/terms/privacy/auth/revoke/host evidence；每条裁决 `ready-link-only|deferred|blocked|duplicate`。不调用任何 MCP endpoint/tool，不登录，不下载/执行 package，不保存 endpoint/command/args/env/headers/token/secret。

只有 Phase 4 证据闭合的 `ready-link-only` 才能进入下一轮 candidate 设计；`active`、`latest`、namespace verification、下载量或 Registry presence 都不是 AI Hub reviewStatus、安全认证或安装授权。

## 本阶段未做事项

- 未请求新的 `/v0.1/servers` 页面，未重抓此前五页，未获取 detail/version history、metrics、health、private API 或 MCP endpoint。
- 未批量枚举、未登录、未下载/执行 server/package、未保存 raw response、endpoint 或凭据材料。
- 仅新增本 Markdown；未创建 candidate、script、test、checkpoint 或 inventory，未改 active catalog、state、channel、release、App、schema、package 或 server。
- 文件冻结后的 SHA-256、bytes 与 lines 由外部计算回传，避免自引用改变文件哈希。
