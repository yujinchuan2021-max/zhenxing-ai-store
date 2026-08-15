# Official MCP Registry 下一批 10 条第一方复核（2026-08-14）

> 状态：只读研究冻结稿。结论仅用于下一阶段人工选材；不是 catalog candidate、连接授权、安全认证或发布许可。

## 结论

- 本轮精确复核 Official MCP Registry 排序中前一批 5 条之后的 **10 个不同 registry identity**。
- 裁决算术：**2 `ready-link-only` + 3 `deferred` + 5 `blocked` + 0 `duplicate` = 10**。`ready-link-only` 没有为数量放宽；它只表示可以准确展示第一方说明页、发布方、认证与风险事实。
- 可优先进入下一批 link-only 人工审查的只有 **AdAdvisor MCP** 与 **AdRamp Google Ads MCP**。两者都仍是第三方托管服务：AI Hub 只可打开第一方说明页，不代用户连接，也不接触用户授权材料。
- 本页没有保存任何可执行或连接参数、密钥材料、MCP 服务地址或安装步骤；也没有请求任何 MCP 服务。

## 公共读取边界与判定规则

1. 先按官方文档读取 [`GET /v0.1/servers`](https://modelcontextprotocol.io/registry/registry-aggregators) 的首 5 条以取得游标，再对该游标读取 10 条 `version=latest` 记录；两次读取均为匿名、串行、公开 registry metadata。第二次的可复查查询是 [next-10 registry snapshot](https://registry.modelcontextprotocol.io/v0.1/servers?limit=10&version=latest&cursor=agency.kesey%2Fpretrip%3A1.0.1)。
2. Registry 仍是 preview，可能发生破坏性变更或数据重置；registry version 是一次不可变的发布标识，但远程服务仍可能滚动变化。[聚合器文档](https://modelcontextprotocol.io/registry/registry-aggregators)；[版本规则](https://modelcontextprotocol.io/registry/versioning)。
3. Registry 的域名/账号验证只证明发布者控制相应 namespace；官方说明明确把实际代码安全扫描交给 package registry 和下游聚合器。因此本稿不把 `active`、`latest`、namespace verification 或任何 badge 解释为 AI Hub 安全认证。[Registry trust and security](https://modelcontextprotocol.io/registry/about#trust-and-security)。
4. Registry metadata 按 CC0 提交，但 CC0 **不重新许可**所指向的软件、网站或托管服务；每条仍分别记录代码许可或服务条款。[Official Registry Terms](https://modelcontextprotocol.io/registry/terms-of-service)。
5. `ready-link-only` 要求第一方身份、服务/源码边界、认证、主要副作用以及至少一个现有 CompatibleHost 能闭合。`deferred` 表示第一方线索存在但版本、认证、权限或宿主证据仍缺一项；`blocked` 只表示本轮证据链无法安全闭合，不等同断言资源恶意或永久下架。

## 去重基线

本轮按 registry name、展示名、发布方域名、第一方仓库和产品身份做语义扫描，而不是仅比较拟议 ID。受检范围包括 `admin/published/`、`docs/research/` 的 JSON/Markdown，以及以下冻结基线：

| 基线 | SHA-256 |
| --- | --- |
| active7 `catalog-v00000007-8c49e1972186-0cec5335.json` | `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4` |
| catalog-v3 base | `43bc18592106542d778ba47fc693fa42826b1febbdc166c7c9e2d9d617c95fd8` |
| Brave Search MCP 增量 candidate | `990721f3f8e55923d7014eb603ed9c3059e7e06f66415991b08e7e3164aca219` |
| next-major catalog candidate | `8822496b0b768605f2a0ecd7c6ebf70759107cb215cfb2cce1a6a2ae5caaf302` |

结果：10 条的 canonical identity、发布方域名和第一方仓库均 **0 个现有语义重复**。相似功能不等于重复：例如 Adeu 的 DOCX redlining MCP 与已有 DOCX Skill 是不同资源类型和不同发布方实现。

## 汇总表

| # | Registry identity | 版本口径 | 第一方证据状态 | exact CompatibleHost IDs | 风险 | 裁决 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `agency.lona/trading@2.0.0` | registry 固定；托管服务滚动 | 文档/条款强，registry 所列仓库已不可读取 | `claude-code` | high | `deferred` |
| 2 | `ai.1325/mcp@0.1.0` | registry 固定；服务滚动 | 官网可读，仓库不可读取，缺 MCP 合同 | — | unknown | `blocked` |
| 3 | `ai.aarna/atars-mcp@0.1.0` | registry 固定；服务滚动 | 只有域名与 MCP 地址，缺公开说明/源码 | — | high | `blocked` |
| 4 | `ai.abmeter/abmeter@0.1.0` | registry 固定；服务滚动 | 仓库不可读取，官网未在安全读取面闭合 | — | high | `blocked` |
| 5 | `ai.actwise/ideation@1.0.0` | registry 固定；服务滚动 | 产品页/隐私/条款可读，缺 MCP 专属合同 | `cursor-desktop` | guarded | `deferred` |
| 6 | `ai.adadvisor/mcp-server@1.0.1` | registry 固定；托管服务滚动 | MCP 产品页与服务条款闭合 | `claude-desktop`, `claude-code`, `cursor-desktop`, `windsurf-editor` | high | `ready-link-only` |
| 7 | `ai.adeu/adeu@1.7.1` | registry 1.7.1；当前一手页为 2.4.0 | 仓库/许可/宿主强，版本谱系漂移 | `claude-desktop`, `gemini-cli`, `cursor-desktop`, `windsurf-editor`, `microsoft-vscode` | high | `deferred` |
| 8 | `ai.adoraads/beauty@1.0.1` | registry 固定；服务滚动 | registry 所列仓库不可读取，缺官网/说明 | — | unknown | `blocked` |
| 9 | `ai.adplane/google-ads@1.29.1` | registry 固定；服务滚动 | 缺可审计第一方说明、许可与宿主证据 | — | high | `blocked` |
| 10 | `ai.adramp/google-ads@1.0.3` | registry 固定；托管服务滚动 | MCP 产品页、OAuth/撤权与条款闭合 | `claude-code`, `cursor-desktop`, `microsoft-vscode`, `windsurf-editor` | guarded | `ready-link-only` |

`—` 表示没有足够的一手证据映射到当前 catalog 已存在的宿主 ID；不得依据“兼容所有 MCP 客户端”自行补关系。

## 逐条第一方复核

### 1. LONA Trading — `deferred`

- **Identity / publisher**：Registry 记录 `agency.lona/trading@2.0.0`；`lona.agency` 的第一方 [产品页](https://www.lona.agency/en) 与 [文档](https://docs.lona.agency/)证明 LONA 提供交易策略生成、历史数据与回测服务。Registry 所列 [`mindsightventures/lona`](https://github.com/mindsightventures/lona) 在本轮返回 404，因此不能继续把该仓库视为可审计源码来源。
- **版本 / 许可**：`2.0.0` 仅是 registry metadata 的固定版本；当前托管能力按文档滚动。市场数据和服务受 LONA [Terms and Conditions](https://www.lona.agency/en/terms)约束，不能把 registry CC0 或已失效仓库的未知许可扩张到服务和市场数据。
- **认证 / credentialPolicy**：第一方 [Agent Onboarding](https://docs.lona.agency/agents/agent-onboarding)说明自动注册、短期访问凭据、轮换与月度额度；[MCP Tools Reference](https://docs.lona.agency/agents/mcp-tools-reference)另说明 Claude.ai 使用 OAuth。若未来只做 link-only，AI Hub 必须 `never-collect`，不能代用户注册、保存或轮换任何访问材料。
- **权限 / 风险**：18 个工具同时包含读取与写入：可创建/更新策略、上传数据、触发回测，并可能消耗额度；金融分析输出也不得当作投资建议。风险 `high`。
- **CompatibleHost**：文档明确点名 Claude Code，映射 `claude-code`。Claude.ai 与通用 ChatGPT 没有与现有 `claude-desktop` / `chatgpt-desktop` 完全相同的宿主表述，本轮不映射。
- **裁决**：强产品证据不足以修复“仓库消失 + 2.0.0 源码/服务谱系未闭合”；保持 `deferred`。

### 2. 1325.AI — `blocked`

- **Identity / publisher**：Registry 记录 `ai.1325/mcp@0.1.0`。第一方 [1325.AI 首页](https://1325.ai/)只证明其经营黑人企业目录与消费者忠诚服务；Registry 所列 [`1325ai/1325ai`](https://github.com/1325ai/1325ai) 本轮返回 404。
- **版本 / 许可**：没有可读取的 `0.1.0` 源码版本、MCP 专属服务条款或软件许可。Registry 文案称美国企业 44,000+，当前官网称全球企业 43,000+，也说明 discovery metadata 不能替代当前产品事实。
- **认证 / 风险 / 宿主**：MCP 认证、查询范围、位置/忠诚奖励数据处理、副作用和具体宿主均未闭合；credentialPolicy=`unknown`，risk=`unknown`，CompatibleHost 为空。
- **裁决**：`blocked`（证据链阻断）；不得仅凭目录检索看起来“只读”而升级。

### 3. aTars MCP — `blocked`

- **Identity / publisher**：Registry 记录 `ai.aarna/atars-mcp@0.1.0`，namespace 只能证明发布者控制 `aarna.ai`。Registry 没有给出源码仓库，唯一产品链接是 MCP 服务地址；本轮按边界没有请求该地址。
- **版本 / 许可 / 认证**：没有第一方公开文档把 `0.1.0` 绑定到代码或服务版本，也没有闭合软件许可、服务条款或认证方式。
- **权限 / 风险 / 宿主**：Registry 描述涉及加密资产市场信号、技术指标和情绪分析，属于高敏感金融信息；工具是否只读、是否收费、数据来源与宿主均未知。credentialPolicy=`unknown`，risk=`high`，CompatibleHost 为空。
- **裁决**：`blocked`。域名验证不是金融数据质量、安全或适用性认证。

### 4. ABMeter — `blocked`

- **Identity / publisher**：Registry 记录 `ai.abmeter/abmeter@0.1.0`。Registry 所列 [`abmeter/abmeter`](https://github.com/abmeter/abmeter) 本轮返回 404；`abmeter.ai` 未在本轮允许的安全读取面中形成可审计产品文档。
- **版本 / 许可 / 认证**：缺 `0.1.0` 的固定源码/服务谱系、许可、认证与撤权说明。
- **权限 / 风险 / 宿主**：feature flag 与 A/B testing 天然可能读写生产实验配置；在没有工具清单与审批边界前按 `high` 处理。credentialPolicy=`unknown`，CompatibleHost 为空。
- **裁决**：`blocked`，不得从产品类别推断为只读或无凭据。

### 5. Actwise Ideation — `deferred`

- **Identity / publisher**：Registry 记录 `ai.actwise/ideation@1.0.0`。Actwise Ltd 的第一方 [Ideation 产品页](https://actwise.ai/home/ideation)点名 ChatGPT、Cursor、Claude 与 Devin Local，并称完整 idea brief 不保留；[Privacy Policy](https://actwise.ai/home/privacy)则说明服务会处理账户、提示、会话、配置、日志与上传文件。两者应按不同数据类别理解，不能简化为“零留存”。
- **版本 / 许可**：托管服务受 [Actwise Terms](https://actwise.ai/home/terms) 的有限使用许可约束；无开源服务器许可，也没有把 registry `1.0.0` 绑定到可审计发布物。
- **认证 / credentialPolicy**：条款要求账户；隐私页说明仅在用户启用/授权后访问第三方服务，但没有 MCP 专属 OAuth scope、断开/撤权或工具级权限说明。AI Hub 仍须 `never-collect`。
- **权限 / 风险 / 宿主**：处理未公开商业创意与评估 metadata，风险 `guarded`。只有 Cursor 与现有 ID 能精确对齐，映射 `cursor-desktop`；通用 ChatGPT/Claude 不映射到桌面产品 ID。
- **裁决**：产品关系可信，但 MCP-specific lifecycle 未闭合，保持 `deferred`。

### 6. AdAdvisor MCP — `ready-link-only`

- **Identity / publisher**：Registry 记录 `ai.adadvisor/mcp-server@1.0.1`。第一方 [AdAdvisor MCP 产品页](https://adadvisor.ai/mcp)与 [Terms of Service](https://adadvisor.ai/terms)闭合发布者为 AdAdvisor, Inc.，并将服务许可限定为可撤销、非独占、不可转让的内部业务使用权；没有开源 server license。
- **版本**：`1.0.1` 只作为 registry 固定 metadata 保存；远程服务能力按发布方页面滚动，不能伪造固定源码 commit 或把页面当前状态称作 1.0.1 二进制。
- **认证 / credentialPolicy**：用户先登录 AdAdvisor，再通过 Meta OAuth 授权广告账户；第一方页面明确不要求用户手工管理 API key。AI Hub 只打开产品说明，policy=`provider-oauth / never-collect`。
- **权限 / 风险**：工具能读取广告数据，也能创建 campaign、上传 creative、构建 audience、暂停或调整广告。发布方称修改先生成 draft 并由用户明确批准，且保留 audit log；批准后仍会触及真实广告账户与预算，因此 risk=`high`，不能标只读。
- **CompatibleHost**：第一方页明确支持 Claude Desktop、Claude Code、Cursor、Windsurf，精确映射 `claude-desktop`, `claude-code`, `cursor-desktop`, `windsurf-editor`。通用 ChatGPT/Gemini/Lovable 表述不强行映射到不同现有宿主 ID。
- **裁决**：`ready-link-only`。这只是“可展示官方页面和风险事实”；不建立连接关系、不保存授权、不运行工具。

### 7. Adeu — `deferred`

- **Identity / publisher**：Registry 记录 `ai.adeu/adeu@1.7.1`。Adeu.ai / Dealfluence Oy 的第一方 [`dealfluence/adeu`](https://github.com/dealfluence/adeu)仓库公开并标 MIT；[开发者页](https://adeu.ai/developers)也明确 redlining engine 与 MCP server 为 MIT。
- **版本 / 许可漂移**：Registry 仍给 `1.7.1`，而当前第一方开发者页写明 **2.4.0（2026-08-13）**。MIT 许可可证明当前仓库边界，却不能在未查固定 revision 的情况下证明 registry 1.7.1 与当前 2.4.0 是同一已审对象。
- **认证 / credentialPolicy**：本地开源 engine 默认不要求云端账户；Adeu Cloud 和消息能力是另一商业边界，不能合并进本条。AI Hub 未来即使只展示链接也应 policy=`host-managed / never-collect`。
- **权限 / 风险**：第一方 [README](https://github.com/dealfluence/adeu#readme)说明 MCP 可读取 DOCX 并把修改写回为 Track Changes，还能处理活动 Word 文档；属于本地文件读写，risk=`high`。
- **CompatibleHost**：第一方资料明确 Claude Desktop、Gemini CLI、Cursor、Windsurf、VS Code Copilot，精确映射 `claude-desktop`, `gemini-cli`, `cursor-desktop`, `windsurf-editor`, `microsoft-vscode`。
- **裁决**：功能/许可/宿主证据强，但固定版本不一致且本地生命周期未审，保持 `deferred`。

### 8. AdoraAds Beauty — `blocked`

- **Identity / publisher**：Registry 记录 `ai.adoraads/beauty@1.0.1`；所列 [`DIGIBIZ360-COM/adoraads`](https://github.com/DIGIBIZ360-COM/adoraads) 本轮返回 404，且 registry 没有给出独立第一方产品页。
- **版本 / 许可 / 认证**：`1.0.1` 无可读取源码或服务版本对应关系；许可、认证、撤权和数据条款均未闭合。
- **权限 / 风险 / 宿主**：registry 描述涉及赞助商品发现与品牌推荐，但广告选择、归因、写入动作和商业披露均未知。credentialPolicy=`unknown`，risk=`unknown`，CompatibleHost 为空。
- **裁决**：`blocked`，不能把 registry 的 active 状态当作发布方或广告合规审查。

### 9. AdPlane Google Ads — `blocked`

- **Identity / publisher**：Registry 记录 `ai.adplane/google-ads@1.29.1`，没有源码仓库；`adplane.ai` 在本轮允许的安全读取面内未形成可审计产品说明。
- **版本 / 许可 / 认证**：没有第一方资料把 `1.29.1` 对应到服务变更，也没有闭合软件/服务许可、OAuth scope 或撤权说明。
- **权限 / 风险 / 宿主**：Registry 描述明确包含 Google Ads reporting **和 campaign management**，存在真实广告账户写操作可能；缺审批、预算保护与副作用边界，risk=`high`。credentialPolicy=`unknown`，CompatibleHost 为空。
- **裁决**：`blocked`，不能因描述称“新建内容默认 paused”就推断整体安全或只读。

### 10. AdRamp Google Ads MCP — `ready-link-only`

- **Identity / publisher**：Registry 记录 `ai.adramp/google-ads@1.0.3`。第一方 [Google Ads MCP 页面](https://adramp.ai/mcp/)与 [Terms of Service](https://adramp.ai/terms/)闭合运营方为 Product Stream Technologies SRL；服务与文档保留专有权利，不是开源 server license。
- **版本**：`1.0.3` 保存为 registry 固定 metadata；托管服务和 Google Ads API 数据新鲜度按发布方持续变化，不声称固定源码版本。
- **认证 / credentialPolicy**：页面明确使用 Google OAuth 的只读权限，不需要 AdRamp 账户或 API key，并可从 Google 账户撤销；发布方还声称数据仅实时转发、不在其服务器留存。AI Hub policy=`provider-oauth / never-collect`，这些仍是发布方声明而非本轮实测。
- **权限 / 风险**：只读取广告账户、campaign、ad group、keyword、search term 与 performance metrics；页面明确不能暂停 campaign、改预算或修改账户。业务广告数据敏感，故 risk=`guarded`，不是 `low`。
- **CompatibleHost**：第一方页明确 Claude Code、Cursor、VS Code 与 Windsurf，精确映射 `claude-code`, `cursor-desktop`, `microsoft-vscode`, `windsurf-editor`。Claude.ai 不等同现有 `claude-desktop`，因此不映射。
- **裁决**：`ready-link-only`；下一阶段只能投影为官方说明页链接，不能由 AI Hub 发起 OAuth 或保存连接状态。

## 下一阶段最小建议

1. 若 CTO 决定继续，只对两条 `ready-link-only` 做 **最多 2 条** candidate-only link projection；保持 `resource-link + website + empty profile + never-collect`，不增加任何连接或执行字段。
2. `deferred` 三条分别只补一个最小缺口：LONA 固定源码/服务版本关系；Actwise MCP 专属认证/撤权与工具权限；Adeu 1.7.1 固定 revision 与当前 2.4.0 的谱系。未补齐前不进入 candidate。
3. `blocked` 五条等待发布方恢复第一方仓库或公开说明；不要请求 MCP 服务、探测未公开接口或根据 registry 文案反推工具能力。
4. 任何后续候选都必须再次对 active、catalog-v3 base、Brave 增量、next-major 以及届时新增历史做语义去重。本稿的 `duplicate=0` 只对上述冻结字节和 2026-08-14 研究目录成立。

## 未触碰边界

- 未修改 active catalog、state、channel、release、App、schema、package 或 server。
- 未生成 candidate、test、generator、draft、签名、封包或发布物。
- 未登录、未下载/执行任何 server、未调用任何 MCP tool，也未验证远程服务在线性。
- GitHub 404 或本轮安全读取阻断只用于证据裁决，不被写成“产品已永久下线”的事实。
