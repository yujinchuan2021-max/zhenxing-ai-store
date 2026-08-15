# Official MCP Registry 再下一页 10 条第一方复核（2026-08-15）

> 状态：只读研究冻结稿。结论只用于后续人工选材；不是 catalog candidate、连接授权、安全认证或发布许可。

## 结论

- 本轮从上一批结束游标继续，精确复核 **10 个不同 registry identity**。
- 裁决算术：**2 `ready-link-only` + 7 `deferred` + 1 `blocked` + 0 `duplicate` = 10**。没有为数量放宽标准。
- 当前只有 **Agentic News MCP** 与 **Affiliate Networks MCP** 具备足够闭合的一手身份、许可/条款、认证、主要副作用与现有宿主证据，可进入下一轮 link-only 人工审查。
- `ready-link-only` 只表示 AI Hub 可以准确展示第一方说明链接和风险事实；不表示可代用户安装、授权、连接或调用。
- 本页未保存任何可执行连接配置、服务地址、认证值或安装指令；没有请求任何 MCP 服务。

## 官方分页快照

- 观测时间：`2026-08-14T18:08:39.596Z`（北京时间 `2026-08-15T02:08:39.596+08:00`）。
- 精确查询：[Official Registry public read](https://registry.modelcontextprotocol.io/v0.1/servers?limit=10&version=latest&cursor=ai.adramp%2Fgoogle-ads%3A1.0.3)。
- 输入游标：`ai.adramp/google-ads:1.0.3`；返回 10 条；输出游标：`ai.agenticshelf/graffeo:1.0.2`。
- 本轮只做一次匿名、串行、禁止自动跳转的公开 metadata 读取。官方说明中，`GET /v0.1/servers` 是聚合器的公开读取入口；Registry 仍处 preview，数据和接口都可能变化。[Aggregator guide](https://modelcontextprotocol.io/registry/registry-aggregators)；[versioning](https://modelcontextprotocol.io/registry/versioning)。

## 判定与信任边界

1. Registry namespace verification 只证明发布者控制相应 namespace；它不审计所指软件或托管工具的安全性。`active`、`latest` 与任何 registry badge 均不等于 AI Hub 安全认证。[Registry trust and security](https://modelcontextprotocol.io/registry/about#trust-and-security)。
2. Registry metadata 以 CC0 提交，但 CC0 不重新许可所指源码、商业网站、数据或托管服务；每条分别记录软件许可与服务条款边界。[Official Registry Terms](https://modelcontextprotocol.io/registry/terms-of-service)。
3. `ready-link-only` 要求：第一方身份、版本口径、许可/条款、认证策略、主要读写副作用，以及至少一个当前 catalog 已存在的 CompatibleHost ID 均可准确陈述。
4. `deferred` 表示第一方关系存在，但版本谱系、服务条款、权限合同、撤权或宿主证据有实质缺口；`blocked` 表示本轮连第一方 MCP 身份链都不能安全闭合。两者都不等于断言恶意或永久下线。
5. 所有凭据策略均为 `AI Hub never-collect`：AI Hub 不请求、收集、保存、代理、验证或转发用户认证材料。

## 结构化语义去重

本轮不是只搜名称字符串。只读解析 active7 和 `docs/research` 下 92 份 JSON，对 `id`、展示名、发布方、registry external identity、canonical source、第一方域名与仓库身份做规范化比较，共检查 57,416 个身份字段。

| 基线 | SHA-256 |
| --- | --- |
| active7 `catalog-v00000007-8c49e1972186-0cec5335.json` | `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4` |
| 最新 267-resource Adeu catalog-v3 candidate | `1cc5da97e4a371a71c0e0118109156858c183e16f52159224768e20e8c6dea03` |
| 上一页 registry first-party review | `da43d7555f1e657a30dc4d233f445778760fcbee7fc49de892f21b6a25ed2a24` |

结果：10 条的 registry identity、规范化名称、发布方域名和第一方仓库均为 **0 个现有语义重复**。最新候选实测为 267 resources / 813 targets / 10 relations；本稿不修改它，也不把 discovery metadata 写回 catalog。

## 汇总表

| # | Registry identity | 版本口径 | exact CompatibleHost IDs | credentialPolicy | 风险 | 裁决 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `ai.adside/adside@1.0.0` | registry 固定；服务滚动 | — | provider account / unknown MCP auth / never-collect | high | `deferred` |
| 2 | `ai.adweave/meta-ads-mcp@1.0.0` | registry 固定；服务与 plugin 滚动 | `claude-desktop`, `claude-code` | provider account + Meta OAuth 或 provider-issued access / never-collect | high | `deferred` |
| 3 | `ai.aetherwealth/mcp@0.2.14` | registry 固定；托管服务滚动 | `claude-desktop`, `cursor-desktop`, `codex-cli` | provider OAuth / never-collect | high | `deferred` |
| 4 | `ai.afmr/discovery@1.0.0` | 只有 registry 固定记录 | — | unknown / never-collect | unknown | `blocked` |
| 5 | `ai.agentberg/agentberg@0.2.0` | registry 固定；托管服务与 client 分开滚动 | `claude-code` | no account/key claim + opaque agent ID / never-collect | high | `deferred` |
| 6 | `ai.agentdm/agentdm@2.0.0` | registry 固定；Early Access 服务滚动 | `claude-desktop`, `claude-code`, `cursor-desktop`, `windsurf-editor` | provider account + provider-issued access or OAuth / never-collect | high | `deferred` |
| 7 | `ai.agentic-news/mcp@1.0.0` | registry 固定；托管服务滚动 | `claude-desktop`, `cursor-desktop`, `microsoft-vscode`, `windsurf-editor` | provider account + API access or OAuth 2.0 PKCE / never-collect | guarded | `ready-link-only` |
| 8 | `ai.agenticaffiliate/affiliate-networks-mcp@0.19.0` | registry 与 signed release tag 固定 | `claude-desktop`, `claude-code`, `codex-cli` | local BYO network credentials or hosted OAuth / never-collect | high | `ready-link-only` |
| 9 | `ai.agenticfabricationnetwork/ufp@0.1.1` | registry 固定；托管服务滚动 | `cursor-desktop` | provider-issued access / never-collect | high | `deferred` |
| 10 | `ai.agenticshelf/graffeo@1.0.2` | registry 固定；per-tenant catalog 滚动 | — | shopper auth unknown; merchant Shopify OAuth / never-collect | guarded | `deferred` |

`—` 表示没有足够的一手证据精确映射到当前 catalog 的宿主 ID；“任何 MCP client”或泛称 Claude/ChatGPT 不能自行变成某个桌面产品关系。

## 逐条第一方复核

### 1. Adside — `deferred`

- **Identity / publisher**：Registry 记录 `ai.adside/adside@1.0.0`。第一方 [Adside 首页](https://www.adside.ai/)只闭合 Adside 是广告运营 SaaS：面向 Meta 广告研究、创意、报表和运营；没有公开 MCP 专页或源码仓库可把 registry identity 对应到当前服务合同。
- **版本 / 许可**：`1.0.0` 仅是 registry metadata 固定版本。当前网站是商业服务；本轮没有找到覆盖 MCP 的公开软件许可或服务条款，不能把 registry CC0 解释成服务许可。
- **认证 / 权限**：第一方 [features](https://www.adside.ai/features)说明可批量把素材推送到 Meta、自动退役疲劳广告、定时运行例行任务并向 Slack/邮件发报告；这包括真实广告账户写入与计划任务。网站说明用户连接 Meta 账户，但 MCP 专属认证、scope、审批和撤权未闭合。
- **CompatibleHost / 风险**：没有第一方 MCP 宿主证据，CompatibleHost 为空；risk=`high`。
- **裁决**：`deferred`。免费 CSV 审计工具的“内存处理、不存储”声明只适用于该工具，不能外推给 Adside MCP 或完整 SaaS。[Free audit boundary](https://www.adside.ai/tools/ad-account-audit)。

### 2. AdWeave Meta Ads MCP — `deferred`

- **Identity / publisher**：Registry 记录 `ai.adweave/meta-ads-mcp@1.0.0`。AdWeave 第一方 [产品页](https://www.adweave.ai/)和 [`adweave-ai/adweave-claude-plugin`](https://github.com/adweave-ai/adweave-claude-plugin)闭合发布关系；MIT 只覆盖开源 plugin，不覆盖托管 MCP 方法论和服务。
- **版本 / 许可**：registry `1.0.0` 是固定 metadata；plugin main 与托管服务滚动。商业服务受 [Terms of Service](https://www.adweave.ai/tos)约束，不能继承 plugin MIT。
- **认证 / credentialPolicy**：需要 AdWeave 账户和 Meta OAuth；第一方 [pricing/FAQ](https://www.adweave.ai/pricing)还说明 raw MCP 可使用发布方生成的访问材料，并可在 Settings 撤销。AI Hub 必须 `never-collect`。
- **权限 / 风险**：当前产品和 plugin 明确能把 campaign、ad set 与 ad 创建为 paused，之后由用户在 Meta 复核并解除暂停；仍是广告账户写入，risk=`high`。
- **合同漂移**：2026-02-28 的 [Privacy Policy](https://www.adweave.ai/privacy)和 Terms 把第三方广告访问写为 read-only，但当前产品明确创建 paused campaign。两组都是第一方材料，权限合同相互冲突，不能替发布方消解。
- **CompatibleHost / 裁决**：精确映射 `claude-desktop`, `claude-code`；Cowork/claude.ai 不硬映射桌面 ID。因权限条款漂移，保持 `deferred`。

### 3. Aether Wealth MCP — `deferred`

- **Identity / publisher**：Registry 记录 `ai.aetherwealth/mcp@0.2.14`。Aether Wealth Advisors Pvt Ltd 的第一方 [MCP 页面](https://aetherwealth.ai/mcp)闭合 hosted/local 产品关系，并说明托管与本地客户端均使用用户自己的 Aether Wealth 账户。
- **版本 / 许可**：registry 版本固定，托管工具面滚动；当前页面没有把本地 package `0.2.14` 绑定到固定源码许可。商业服务的 [Terms](https://aetherwealth.ai/terms)与 [Privacy Policy](https://aetherwealth.ai/privacy)都注明是 pre-launch、pending legal review 的草案。
- **认证 / credentialPolicy**：第一方称使用 per-user OAuth、可撤权；本地路径可能把访问材料存入操作系统凭据存储，失败时退回受保护文件。AI Hub 不参与该生命周期。
- **权限 / 风险**：MCP 页面列出创建/更新/删除交易日志与账户、创建/修改提醒、连接/断开 broker、提议和执行交易、关闭/修改仓位等高风险动作；risk=`high`。
- **合同漂移**：同日可读的 Terms 又写明服务“never executes trades”且不存在订单路由，和 MCP 页的 broker execution 工具说明直接冲突。
- **CompatibleHost / 裁决**：一手精确映射 `claude-desktop`, `cursor-desktop`, `codex-cli`；因许可谱系和交易权限合同未闭合，`deferred`。

### 4. AFMR Discovery — `blocked`

- **Identity / publisher**：Registry 记录 `ai.afmr/discovery@1.0.0`，描述为读取 failure modes、发现 attestation/lift-evidence contracts。Registry 所列网站是 `afmr.ai`，但本轮没有取得可审计的一手产品页、仓库或法律主体资料。
- **版本 / 许可 / 认证**：除 registry metadata 外，`1.0.0` 的源码/服务对应关系、许可、条款、认证、撤权与数据处理均未知。
- **权限 / 宿主**：不能仅凭 registry 摘要断言工具只读，也没有精确宿主证据。credentialPolicy=`unknown`，risk=`unknown`，CompatibleHost 为空。
- **裁决**：`blocked`（本轮证据链阻断）。域名 namespace 验证不能替代产品事实或安全评估。

### 5. Agentberg — `deferred`

- **Identity / publisher**：Registry 记录 `ai.agentberg/agentberg@0.2.0`。Agentberg 第一方 [首页](https://agentberg.ai/)与 [Privacy Policy](https://agentberg.ai/privacy)闭合“交易智能知识交换网络”身份；PyPI 的 [`agentberg-mcp`](https://pypi.org/project/agentberg-mcp/)发布信息标 MIT，但 registry 版本、client package 版本和托管服务不是同一版本谱系。
- **认证 / credentialPolicy**：发布方称连接无需账户或 API key，但调用者会使用自选 opaque agent ID。AI Hub 不替用户生成、保存或复用该身份。
- **权限 / 风险**：服务能公开发布 findings、交易记录与投票。隐私页明确所有提交会公开可见并无限期保留，删除需联系发布方；它不代用户下单，但数据公开性与金融语境使 risk=`high`。
- **许可 / 条款边界**：MIT 只证明 client package；本轮没有找到覆盖托管知识网络的服务条款，不能把 MIT 扩张到服务或其中的用户数据。
- **CompatibleHost / 裁决**：首页的一手接入表述精确支持 `claude-code`；泛称 GPT/任何 MCP framework 不增加宿主关系。因托管条款与版本谱系缺口，`deferred`。

### 6. AgentDM — `deferred`

- **Identity / publisher**：Registry 记录 `ai.agentdm/agentdm@2.0.0`。第一方 [AgentDM 首页](https://agentdm.ai/)闭合 hosted messaging、MCP/A2A bridge 与 bidirectional Slack 产品身份；registry 所列仓库本轮返回 404。
- **版本 / 许可**：`2.0.0` 只有 registry 固定口径，Early Access 服务滚动。首页称 `agentdm-cli` runner 为 Apache-2.0，但该许可不覆盖 hosted grid；没有取得 MCP 服务条款。
- **认证 / credentialPolicy**：第一方说明可由 CLI 创建 agent、签发访问材料并写入宿主配置，也提供 OAuth 路径；模型 provider key 留在本机。缺少统一的 access revoke、配置清除和账户删除闭环，AI Hub 必须 `never-collect`。
- **权限 / 风险**：可向其他 agent 或 channel 发消息、读收件箱、查询回执，并与 Slack 双向同步；错误消息可能泄漏代码、内部链接或个人信息，risk=`high`。发布方同时称消息会持久化以供收件方读取，但首页另一段又称“不存储 beyond delivery”，数据保留表述也需澄清。
- **CompatibleHost / 裁决**：精确映射 `claude-desktop`, `claude-code`, `cursor-desktop`, `windsurf-editor`。服务许可、撤权与保留合同未闭合，`deferred`。

### 7. Agentic News MCP — `ready-link-only`

- **Identity / publisher**：Registry 记录 `ai.agentic-news/mcp@1.0.0`。第一方 [MCP 产品页](https://agentic-news.ai/mcp)、[Terms](https://agentic-news.ai/terms)与 [Privacy Policy](https://agentic-news.ai/privacy)闭合 Agentic News 的托管 MCP 身份；registry 所列 GitHub 仓库不可读取，因此不声称有开源 server license。
- **版本 / 许可**：`1.0.0` 作为 registry 固定 metadata；托管服务按 Terms 滚动、属商业专有服务。Registry CC0 不覆盖新闻内容、summary 或服务代码。
- **认证 / credentialPolicy**：需要 Agentic News 账户；第一方 Terms 说明 API access 或 OAuth 2.0 with PKCE，隐私页说明保存 key hash、OAuth session 与 tool-call log。AI Hub 只打开说明页，`never-collect`。
- **权限 / 风险**：新闻读取本身不向外部发布，但工具会创建/更新监控 agent、提交反馈、保存 collection，写入用户在 Agentic News 内的状态；不能把首页“never write/post/act on your behalf”误读成零状态写入。个人化新闻、聊天与使用数据还可能交由列明的 LLM/基础设施 subprocessors 处理，risk=`guarded`。
- **CompatibleHost**：产品页精确映射 `claude-desktop`, `cursor-desktop`, `microsoft-vscode`, `windsurf-editor`。ChatGPT 没有可精确对齐的现有 CompatibleHost ID，本轮不映射。
- **裁决**：`ready-link-only`。只允许后续展示第一方 MCP/条款链接和上述边界，不保存认证、不建立连接、不调用工具。

### 8. Affiliate Networks MCP — `ready-link-only`

- **Identity / publisher**：Registry 记录 `ai.agenticaffiliate/affiliate-networks-mcp@0.19.0`。Robert Berrisford 维护的第一方 [`bobberrisford/affiliatemcp`](https://github.com/bobberrisford/affiliatemcp)明确说明它是社区实现，不是各 affiliate network 的官方集成；多数 adapter 仍为 experimental。
- **版本 / 许可**：registry `0.19.0` 与 first-party [signed GitHub release](https://github.com/bobberrisford/affiliatemcp/releases/tag/v0.19.0)闭合，release 指向 signed commit `9248d42`；该固定 tag 的源码是 [MIT](https://github.com/bobberrisford/affiliatemcp/blob/v0.19.0/LICENCE)。当前 main 已为 0.20.0，不混入本条固定对象。
- **认证 / credentialPolicy**：本地模式由用户自备各 affiliate network 的凭据并保存在本机；可选 hosted connector 使用发布方 OAuth/加密 vault，只覆盖部分网络。AI Hub 不安装 server、不写宿主配置、不接触任何网络凭据。
- **权限 / 风险**：first-party [v0.19.0 README](https://github.com/bobberrisford/affiliatemcp/tree/v0.19.0)说明外部 network API 数据访问是 read-only；但 setup/installer 会在本机保存配置与凭据，可选 cache 会写本地结果，且 adapter 成熟度参差。link-only 风险仍记 `high`，不能把 MIT 或自动化测试当成第三方网络认证。
- **CompatibleHost**：固定文档精确映射 `claude-desktop`, `claude-code`, `codex-cli`；Cursor/VS Code 当时仅是“可能兼容、未形成 first-party tested journey”，不映射。
- **裁决**：`ready-link-only`。后续如建 candidate，只能链接固定 release/source；不得带入本地执行、配置写入或凭据字段。

### 9. Agentic Fabrication Network UFP — `deferred`

- **Identity / publisher**：Registry 记录 `ai.agenticfabricationnetwork/ufp@0.1.1`。AFN 的第一方 [产品页](https://agenticfabricationnetwork.ai/)闭合 Agentic Fabrication Network 与 Universal Fabrication Protocol 的发布关系，覆盖 3D printing、CNC、sheet metal、laser cutting、stickers、paper print 与 apparel。
- **版本 / 许可**：`0.1.1` 只有 registry 固定口径；托管网络滚动。产品页称协议 open，但没有取得可把 `0.1.1` 对应到具体源码/许可的第一方仓库或服务条款，不能自行解释“open”。
- **认证 / credentialPolicy**：页面说明 agent 可自助取得 provider access，但没有闭合撤权、额度、文件删除与支付授权生命周期。AI Hub 必须 `never-collect`。
- **权限 / 风险**：服务可登记设计文件、请求报价、生成 checkout；用户完成 hosted payment 后，AFN 会自动向 vendor 下单。它涉及文件上传、价格、地址、支付与实体采购，risk=`high`。
- **CompatibleHost / 裁决**：页面明确点名 Cursor，映射 `cursor-desktop`；ChatGPT/Claude 的泛称不硬映射。因许可、认证/撤权与采购生命周期缺口，`deferred`。

### 10. Agentic Shelf / Graffeo catalog — `deferred`

- **Canonical identity / publisher**：Registry identity 是 `ai.agenticshelf/graffeo@1.0.2`，因此 publisher 是 Agentic Shelf；Graffeo Coffee 是 catalog subject/merchant，不应被写成 MCP publisher。Graffeo 的第一方 [官网](https://graffeo.com/)只证明其商品与商家身份，不证明其授权或运营该 MCP。
- **服务边界**：Agentic Shelf 第一方 [产品页](https://www.agenticshelf.ai/)说明其为商家提供 live catalog/stock/price MCP；[Privacy Policy](https://www.agenticshelf.ai/privacy)进一步说明 per-tenant MCP、Shopify read-only product/inventory scope、merchant OAuth 撤销和删除时序。
- **版本 / 许可**：`1.0.2` 是 registry 固定 metadata；per-tenant catalog 数据滚动。服务属于 Agentic Shelf 商业条款边界，不是 Graffeo 网站内容的开放许可。
- **认证 / 权限**：Agentic Shelf 证明 merchant side 需 Shopify OAuth 且不读取 customer/order data；但本轮没有一手资料闭合 Graffeo tenant 的授权关系、shopper-side auth、逐 tenant 工具面或生命周期。
- **CompatibleHost / 风险**：泛称 ChatGPT/Claude/其他 agent 不足以精确映射现有产品 ID，CompatibleHost 为空；按当前已知只读 catalog 记 `guarded`，但不能据此推断该 tenant 的完整工具面。
- **裁决**：`deferred`。只有取得 Agentic Shelf 的 Graffeo tenant 第一方说明或 Graffeo 对该关系的确认后，才可进入 link-only candidate 审查。

## 下一阶段最小建议

1. 若 CTO 继续，只优先对 **Agentic News** 与 **Affiliate Networks MCP** 各做一条 candidate-only link projection；保持 `resource-link + website + empty profile + never-collect`，不增加 connection edge 或执行字段。
2. `deferred` 七条只补最小缺口：Adside 的 MCP 产品合同；AdWeave 的 read-only/write 条款一致性；Aether 的交易执行条款与固定 package 许可；Agentberg/AgentDM 的 hosted terms 与撤权；AFN 的采购授权生命周期；Agentic Shelf 与 Graffeo tenant 的发布关系。
3. `blocked` 的 AFMR 等待发布方公开可审计文档或仓库；不要请求其 MCP 服务或根据 registry 描述反推权限。
4. 任一后续 candidate 都必须重新对当时最新 active、catalog-v3 successor 与全部结构化历史做语义去重。本稿的 `duplicate=0` 只对上述冻结字节与本轮扫描成立。

## 未触碰边界

- 未修改 active catalog、state、channel、release、App、schema、package 或 server。
- 未生成 candidate、test、generator、draft、签名、封包或发布物。
- 未登录、下载、安装或执行任何 server，也未调用任何 MCP endpoint/tool 或测试远程服务在线性。
- GitHub 404、站点读取失败或证据缺口仅用于本轮裁决，不被写成“产品永久下线”。
