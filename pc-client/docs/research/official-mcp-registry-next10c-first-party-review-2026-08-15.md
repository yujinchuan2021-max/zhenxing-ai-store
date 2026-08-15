# Official MCP Registry 下一页 10 条第一方复核（next10c，2026-08-15）

> 状态：只读研究冻结稿。结论只用于后续人工选材；不是 catalog candidate、连接授权、安全认证、安装许可或发布许可。

## 结论

- 本轮从上一批输出游标继续，精确复核 **10 个不同 registry identity**。
- 裁决算术：**0 `ready-link-only` + 4 `deferred` + 6 `blocked` + 0 `duplicate` = 10**。没有为数量放宽标准。
- 四个 `deferred` 分别是 Agentic Shelf、Agentic Terminal Directory、Agentra 与 AgentTrust。它们都有第一方产品或源码证据，但仍存在调用方认证、版本谱系、服务条款/环境或撤权闭环缺口。
- 六个 `blocked` 分别是 PuroAir、四个 Agent Lookups 服务与已被 Registry 标记为 `deprecated` 的 AgentPlaybooks。本轮没有足够证据把这些记录安全投影为当前可发现资源。
- 本页没有可进入下一轮 candidate 的条目。若未来缺口闭合，仍只能先作为 `resource-link + website + empty installProfileId + never-collect` 的 link-only 人工候选；不能从 Registry metadata 推导连接、安装或执行。
- 本页未保存任何 MCP 服务地址、命令、参数、环境变量、认证头、凭据值或原始列表响应，也没有请求任何 MCP 服务。

## 官方分页快照

- 观测时间：`2026-08-14T20:36:35.193Z`（北京时间 `2026-08-15T04:36:35.193+08:00`）。
- 精确查询：[Official Registry public read](https://registry.modelcontextprotocol.io/v0.1/servers?limit=10&version=latest&cursor=ai.agenticshelf%2Fgraffeo%3A1.0.2)。
- 输入游标：`ai.agenticshelf/graffeo:1.0.2`；返回 10 条；输出游标：`ai.agenttrust/mcp-server:1.1.1`。
- 只执行一次匿名 GET：固定 host/path/query，禁止自动跳转，要求 HTTP 200、JSON content type、exact 顶层结构与 exact 10 条；没有 401/403/429、重试、缓存旁路或第二次列表请求。响应只在内存中解析，并在输出前丢弃 remotes/packages 等执行字段。
- 官方文档把 `GET /v0.1/servers` 定义为匿名只读聚合入口，并说明 cursor 分页；Registry 仍处 preview，不提供可用性或持久性保证。[Aggregator guide](https://modelcontextprotocol.io/registry/registry-aggregators)。

## 判定与信任边界

1. Registry namespace authentication 只证明发布者控制对应 GitHub 账户或域名，不审计服务器代码、远端工具或服务安全性；安全扫描由包注册表和下游聚合器承担。[Registry trust and security](https://modelcontextprotocol.io/registry/about#trust-and-security)。
2. Registry metadata 以 CC0 提交，但 CC0 不重新许可所指源码、商业服务、网站内容或数据。每条必须单独核软件许可与服务条款。[Official Registry Terms](https://modelcontextprotocol.io/registry/terms-of-service)。
3. `active`、`latest` 与 namespace verification 都不是 AI Hub 安全认证。Registry 版本不可变，但官方仍建议 server、package 与 remote API 版本对齐；明显不一致必须保留为版本谱系缺口。[Registry versioning](https://modelcontextprotocol.io/registry/versioning)。
4. `deprecated` 是 Registry 可变状态之一；聚合器应保持状态同步。它不能作为当前可发现资源直接进入 candidate。[Server status](https://modelcontextprotocol.io/registry/registry-aggregators#server-status)。
5. `ready-link-only` 要求第一方身份、当前版本口径、许可/条款、认证与撤权、主要读写副作用以及至少一个可准确映射的现有 CompatibleHost 均闭合。`deferred` 表示第一方关系存在但仍有实质缺口；`blocked` 表示当前身份链或生命周期不能安全投影。二者都不等于恶意判定。
6. 所有认证事实只用于风险说明，credential policy 一律为 **AI Hub never-collect**：AI Hub 不请求、收集、保存、代理、验证或转发账号、OAuth grant、API key、签名密钥或钱包材料。

## 结构化语义去重

本轮对 exact/versionless registry identity、规范化 Resource ID、NFKC 规范化的 `name + publisher`、canonical website/source/repository 与发布者域名做结构化比较，不因 description 或普通 prose 提及而判重复。

| 基线 | SHA-256 / 事实 |
| --- | --- |
| active7 `catalog-v00000007-8c49e1972186-0cec5335.json` | `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4`；250 Resources |
| 最新 DeepSeek catalog-v3 candidate | `ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7`；375 vendors / 616 products / 270 resources / 821 targets / 10 relations |
| 上一页 next10b research | `8b9db20e3085798950b00a5c44c1451b4e2a0581c69b6fd5cb36f91281ad09ff` |

active7、当前 candidate 与排除当前 candidate 后的 92 份历史 JSON 均成功解析。10 条在三个层次全部 `NON-HIT`，所以 **0 duplicate**。上一页的 `ai.agenticshelf/graffeo@1.0.2` 只与本页两条 Agentic Shelf 记录共享 namespace/publisher；它的 canonical server identity 不同，不能误判为同一资源。

## 汇总表

| # | Registry identity | 版本口径 | exact existing CompatibleHost IDs | auth / revoke | 主要副作用与风险 | 裁决 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `ai.agenticshelf/mcp@1.0.0` | registry 固定；托管服务滚动；所链源码仓库当前 404 | — | merchant account + Shopify OAuth；Shopify 可撤权；MCP caller auth 未披露 | 读商品、价格与库存；guarded | `deferred` |
| 2 | `ai.agenticshelf/puroair@1.0.1` | 只有 registry 固定记录；服务谱系未知 | — | unknown / unknown | 声称读 PuroAir 商品、库存与价格；身份与风险未闭合 | `blocked` |
| 3 | `ai.agenticterminal/directory@1.0.0` | registry `1.0.0`；repo package `0.1.0` 且 README 自称 pre-v1 | `claude-desktop`, `claude-code`, `cursor-desktop`, `cline-agent`, `windsurf-editor`, `codex-cli`, `gemini-cli` | 匿名读；可选 DirectoryAccessCredential 解锁评论写入；撤权未披露 | 查商户/支付轨道与验证信息，可写评论；不代付；guarded/high | `deferred` |
| 4 | `ai.agentlookups/counterscript@1.0.0` | 只有 registry 固定记录 | — | unknown / unknown | 声称读处方实际成本与现金价估计；医疗决策风险未闭合 | `blocked` |
| 5 | `ai.agentlookups/groundtruth@1.0.0` | 只有 registry 固定记录 | — | unknown / unknown | 声称读联邦环境记录与地址尽调层；写入未知 | `blocked` |
| 6 | `ai.agentlookups/overassessed@1.0.0` | 只有 registry 固定记录 | — | unknown / unknown | 声称读 Maryland 房产评估比较、申诉窗口与链接；写入未知 | `blocked` |
| 7 | `ai.agentlookups/plumbline@1.0.0` | 只有 registry 固定记录 | — | unknown / unknown | 声称读 34 个美国辖区的承包商许可记录；写入未知 | `blocked` |
| 8 | `ai.agentplaybooks/agentplaybooks@1.0.0` | registry `1.0.0` 且 `deprecated`；repo server `0.2.0` / app `0.1.0` | `claude-cowork` | provider API key + RBAC；owner 管理 keys，精确撤权流程未闭合 | 可改 persona、Skills、MCP 配置、attachments、canvas 与 memory；high | `blocked` |
| 9 | `ai.agentrapay/agentra@1.0.0` | registry 固定；托管服务滚动；Terms 与首页环境声明冲突 | `cursor-desktop` | provider API key；终止即失效；自助 revoke/rotate 未披露 | KYA、钱包引用、交易授权/attestation 与 settlement 记录；high | `deferred` |
| 10 | `ai.agenttrust/mcp-server@1.1.1` | registry `1.1.1`；repo/package/release 当前 `1.2.1` | `claude-desktop`, `claude-code`, `cursor-desktop`, `windsurf-editor`, `openclaw-agent`, `nous-hermes-agent`, `n8n-platform` | provider API key；可申请删账号；精确 API-key revoke 未披露 | 邮件、A2A 消息、文件上传/分享/删除与 human escalation；high | `deferred` |

## 逐条第一方复核

### 1. Agentic Shelf — `ai.agenticshelf/mcp@1.0.0`

- **身份与发布者**：Registry 记录把 namespace 与 Agentic Shelf 网站绑定；网站条款明确 Agentic Shelf 提供托管 MCP 服务。Registry 所链 `vboykoCTO/agentic-shelf` 仓库在本轮观察时返回 404，不能再作为可审源码或许可证依据。[Agentic Shelf](https://www.agenticshelf.ai/)；[linked repository](https://github.com/vboykoCTO/agentic-shelf)。
- **版本与许可边界**：`1.0.0` 只锁 Registry publication；托管服务持续滚动。服务软件与 API 属供应方财产，使用受商业 Terms 约束，不应标成开源。[Terms](https://www.agenticshelf.ai/terms)。
- **认证与撤权**：商户使用账号并通过 Shopify OAuth 连接店铺；只申请商品与库存读取 scope。用户可在 Shopify admin 撤销 grant，卸载后 Shopify 立即撤销 token；但公开一手页没有闭合下游 MCP caller 是否匿名或如何认证。[Terms](https://www.agenticshelf.ai/terms)；[Privacy](https://www.agenticshelf.ai/privacy)。
- **读写与数据**：MCP 读取商户商品目录、价格与库存，不读订单或客户数据；服务会短期缓存目录并保存经匿名化的调用 metadata。未证实会修改 Shopify 数据。[Privacy](https://www.agenticshelf.ai/privacy)。
- **宿主与裁决**：官网提到 ChatGPT、Claude、Gemini 与 Perplexity，但语境混合审计对象和泛化“works with”，没有精确宿主配置证据，因此不映射现有 host ID。源码链接失效、caller auth 与 exact host 均未闭合，裁决 `deferred`。

### 2. PuroAir — `ai.agenticshelf/puroair@1.0.1`

- **身份与发布者**：Registry namespace 的发布者事实属于 Agentic Shelf；PuroAir 是记录所描述的商户/目录主题，不能自动升级为 MCP publisher。记录没有 repository；PuroAir 第一方站点确认品牌和商品目录，但本轮没有找到该站点对 MCP 或 Agentic Shelf 集成的声明。[PuroAir](https://getpuroair.com/collections/purifiers-2026)。
- **版本、条款与认证**：`1.0.1` 只锁 Registry metadata。源码许可、托管服务版本、调用方认证、撤权及 Agentic Shelf 与 PuroAir 的授权关系均未闭合。
- **读写与宿主**：Registry description 声称提供商品详情、库存与价格读取；没有第一方工具合同、写入边界或 CompatibleHost 证据。
- **裁决**：当前只能确认一条已验证 namespace 下的 metadata 记录，不能把商户身份、发布权与服务生命周期拼成安全 Resource，裁决 `blocked`。

### 3. Agentic Terminal Directory — `ai.agenticterminal/directory@1.0.0`

- **身份与发布者**：第一方 `observer-protocol/at-directory` 仓库把 `@agenticterminal/mcp-server` 声明为主要产品，网页目录与 MCP 使用同一数据，并明确目录不在付款路径中。[Repository README](https://github.com/observer-protocol/at-directory)。
- **版本与许可**：Registry 是 `1.0.0`，但当前 package manifest 为 `0.1.0`，README 仍写 `pre-v1`；二者没有可审映射。仓库与 package 均为 MIT。[Package manifest](https://github.com/observer-protocol/at-directory/blob/main/packages/mcp-server/package.json)；[LICENSE](https://github.com/observer-protocol/at-directory/blob/main/LICENSE)。
- **认证与撤权**：商户搜索、单条查看、支付端点验证、类别/轨道列表和调用者身份查询可匿名读取。可选 DirectoryAccessCredential 提高限额并解锁评论写入；第一方页未说明凭据撤权/过期闭环。[Repository README](https://github.com/observer-protocol/at-directory#use-it-from-an-agent)。
- **读写与宿主**：目录读取自报或运营方验证的商户、轨道和信任层；评论是明确写入。付款由 agent 与商户直接完成，不能描述成目录代付。README 精确列出 Claude Desktop、Claude Code、Cursor、Cline、Windsurf、Codex 与 Gemini CLI，因此可映射表中 7 个现有 ID。
- **裁决**：第一方身份、许可、读写和宿主较完整，但 Registry/package/pre-v1 版本冲突与可选写凭据撤权仍未闭合，裁决 `deferred`。

### 4–7. Agent Lookups 四个记录

共同 publisher 事实只能写成“`ai.agentlookups` namespace 控制者”；本轮没有找到可核验的 legal publisher、canonical site、repository、license、service terms、认证/撤权文档或宿主说明。四条均不得从相同 namespace 推导为一个 Resource，也不得从名称推断共享服务实现。

| Identity | Registry 声称的主要读取 | 未闭合边界 | 裁决 |
| --- | --- | --- | --- |
| `ai.agentlookups/counterscript@1.0.0` | CMS NADAC 处方成本与现金价估计 | 医疗/定价适用性、数据版本、auth、write、license、host | `blocked` |
| `ai.agentlookups/groundtruth@1.0.0` | 联邦环境记录和地址尽调层 | 数据来源/更新、auth、write、license、host | `blocked` |
| `ai.agentlookups/overassessed@1.0.0` | Maryland 房产评估公平性比较和申诉窗口 | 地域/时效、auth、write、license、host | `blocked` |
| `ai.agentlookups/plumbline@1.0.0` | 多辖区承包商许可检查 | 辖区覆盖/更新、auth、write、license、host | `blocked` |

这四条的所有能力描述仅来自本轮官方列表 metadata；没有调用服务或把其结果当事实验证。后续若发布方提供第一方页，应分别按 canonical server identity 重审。

### 8. AgentPlaybooks — `ai.agentplaybooks/agentplaybooks@1.0.0`

- **身份与状态**：第一方 repo 与 `server.json` 能闭合 AgentPlaybooks 项目，但本轮 Registry 状态为 `deprecated`。Registry publication `1.0.0`、repo `server.json` 的 `0.2.0` 与应用 package 的 `0.1.0` 三者不一致。[Repository](https://github.com/matebenyovszky/agentplaybooks)；[server.json](https://github.com/matebenyovszky/agentplaybooks/blob/main/server.json)；[package.json](https://github.com/matebenyovszky/agentplaybooks/blob/main/package.json)。
- **许可与认证**：仓库使用 PolyForm Noncommercial 1.0.0，不是 OSI 开源许可。服务使用 provider API key 与 Viewer/Coworker/Admin RBAC；人类 owner 管理 keys，而精确撤权生命周期未在本轮闭合。[LICENSE](https://github.com/matebenyovszky/agentplaybooks/blob/main/LICENSE)；[permissions](https://github.com/matebenyovszky/agentplaybooks/blob/main/permissions.md)。
- **读写与宿主**：项目可保存和修改 personas、Skills、MCP servers、attachments、canvas 与 memory；editor 可更新这些内容，属于高写入面。第一方文章对 Claude Coworker 有明确 MCP 集成说明，因此只保留 `claude-cowork` 这一精确现有 host 证据；泛称 Claude/ChatGPT/Codex/Gemini 不拆成多个猜测宿主。[Claude Coworker integration](https://agentplaybooks.ai/blog/claude-coworker-integration)。
- **裁决**：`deprecated` 状态已足以阻止进入当前 discovery；版本三方漂移与高写入面进一步要求重审。裁决 `blocked`。

### 9. Agentra — `ai.agentrapay/agentra@1.0.0`

- **身份与发布者**：第一方 Terms 将运营实体写为 ProTech Data Security Services LLC d/b/a Agentra；官网和开发文档确认 Agentra 是非托管的 agent identity/trust/transaction-authorization service。[Terms](https://agentrapay.ai/terms/)；[documentation](https://agentrapay.ai/docs/)。
- **版本与条款漂移**：`1.0.0` 只锁 Registry publication，服务滚动。Terms 仍称 Developer Preview、Base Sepolia 且“不涉及真实资金”，而当前首页/文档称 Base Mainnet live，并描述真实授权与 settlement 流程。这是 material environment/terms drift，不能自行选择一边。[Terms](https://agentrapay.ai/terms/)；[current product page](https://agentrapay.ai/)。
- **认证与撤权**：注册后由 provider 发放 API key，用户负责保管；Terms 说明服务终止时 keys 立即失效，但没有闭合用户自助 revoke/rotate 流程。AI Hub 不接触 key、钱包或签名材料。[Terms](https://agentrapay.ai/terms/)。
- **读写与风险**：服务会注册 agent、提交 KYA、保存 wallet reference、作交易授权、生成签名 attestation/unsigned transaction 并记录 settlement。Agentra 声称不持有私钥或代为转账，但授权和链上 settlement 具有财务及不可逆外部影响，风险为 high。[Documentation](https://agentrapay.ai/docs/)。
- **宿主与裁决**：官网明确 Cursor 与泛称 Claude；只有 Cursor 能无歧义映射到现有 `cursor-desktop`。条款/运行环境漂移、精确 MCP 权限面与自助撤权缺口使其裁决为 `deferred`。

### 10. AgentTrust — `ai.agenttrust/mcp-server@1.1.1`

- **身份与版本**：第一方 repo、package author/homepage 与 AgentTrust.AI 一致，MIT LICENSE 也归属 AgentTrust.AI。但 Registry 是 `1.1.1`，当前 package 与 latest release 都是 `1.2.1`；本轮没有固定 `1.1.1` 对应源码或 release lineage。[Repository](https://github.com/agenttrust/mcp-server)；[package.json](https://github.com/agenttrust/mcp-server/blob/main/package.json)；[releases](https://github.com/agenttrust/mcp-server/releases)；[LICENSE](https://github.com/agenttrust/mcp-server/blob/main/LICENSE)。
- **许可与服务边界**：本地 MCP server 代码是 MIT；托管 AgentTrust platform、账号数据与邮件/文件服务不因此变成 MIT。隐私政策确认账号、组织、API keys、interaction logs 与 verification receipts 的处理，并允许请求删除账号；本轮没有闭合独立服务条款正文。[Privacy](https://agenttrust.ai/privacy)。
- **认证与撤权**：连接需 provider API key；A2A signing key 可生成/轮换。账号删除可以申请，但没有第一方证据证明 MCP/API key 的精确自助 revoke 流程，不能把 signing-key rotation 当 API-key 撤权。[Documentation](https://agenttrust.ai/docs/)；[Repository README](https://github.com/agenttrust/mcp-server#quick-start)。
- **读写与风险**：工具可读取、发送、回复和转发邮件，创建草稿；发送 A2A 消息、回复、评论、升级人工；上传、下载、分享和删除云文件。它不是只读目录，风险为 high。[Repository README](https://github.com/agenttrust/mcp-server#tools)。
- **宿主与裁决**：README 精确列出 Claude Desktop、Claude Code、Cursor、Windsurf、OpenClaw、Hermes 与 n8n，可映射表中 7 个现有 ID。版本漂移、托管条款和 API-key 撤权缺口仍在，裁决 `deferred`。

## 后续最小队列

本页没有 ready 条目，所以下一阶段不应生成 candidate。若只做最小补证，顺序建议：

1. **Agentic Terminal Directory**：由 publisher 解释 Registry `1.0.0` 与 repo/package `0.1.0` 的对应关系，并补 DirectoryAccessCredential 撤权/过期文档。
2. **AgentTrust**：固定 `1.1.1` 的源码/release lineage，或发布与当前 `1.2.1` 对齐的新 Registry 版本；补 hosted terms 与 API-key revoke 文档。
3. **Agentic Shelf**：修复或替换失效 repository，公开 MCP caller auth，并给出精确宿主连接说明。
4. **Agentra**：统一 Terms 与当前 Mainnet 产品声明，公开 key revoke/rotate 与 MCP tool 权限合同。

即使以上全部闭合，首轮也最多每条建立一个 canonical Resource；同 publisher、merchant tenant 或多个 CompatibleHost 不产生重复卡片，也不产生 connection edge 或 managed install。

## 冻结边界

- 只新增本 Markdown；未改 active catalog、任何 candidate JSON、state、channel、release、App、schema、package 或 server。
- 没有登录、调用 MCP、下载或执行代码、安装 connector、发起 OAuth、保存凭据或触发外部写入。
- 本页不包含 install profile、endpoint、command、args、env、headers、credential value 或连接运行字段。
- 网络列表面严格为一次官方匿名 GET；后续浏览仅限 registry 官方说明与逐条第一方网页/仓库。
