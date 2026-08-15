# 类 CocoLoop 的 MCP / Connector / Plugin 公开资源目录研究（2026-08-14）

## 结论

本轮只检查公开网页、公开 `robots.txt`、公开 sitemap 索引、官方文档和官方源码仓库；没有登录、没有调用站点私有 API、没有访问 `/_next`，也没有枚举详情数据。公开页面上出现的“使用次数”“可连接应用数”不计作目录规模。

推荐顺序：

1. **A — Official MCP Registry / GitHub MCP Registry**：MCP 元数据发现的首选上游。官方注册表有公开、分页的 REST 读取合同、强 canonical name 和公开数据许可；GitHub 提供官方人类可浏览界面。
2. **A — Cursor Marketplace**：官方 Cursor Plugin 发现源。Plugin 可封装 MCP servers、skills、rules、agents、commands 和 hooks，且官方称上架前人工审核；不要把它扩张解释成通用 MCP 注册表。
3. **B — Smithery、Glama、MCP.so、Visual Studio Marketplace**：适合候选发现或交叉审核，不应单独证明原作者、许可证、安全性或可安装性。
4. **C — PulseMCP、Claude Connectors、cursor.directory**：当前自动化可访问性或公开索引合同不足；只保留人工审核入口，不做枚举源。

## 目录逐项审计

| 优先级 | 目录与精确入口 | 资源类型与公开规模 | 公开索引能力 | 来源回溯、canonical 与去重 | 登录、许可与抓取边界 | 建议用途 |
|---|---|---|---|---|---|---|
| **A** | [Official MCP Registry 说明](https://modelcontextprotocol.io/registry/about)；[REST API 基址/聚合器文档](https://modelcontextprotocol.io/registry/registry-aggregators)；[API reference](https://registry.modelcontextprotocol.io/docs)；[官方仓库](https://github.com/modelcontextprotocol/registry) | MCP servers 的官方 metadata registry。官网明确仍为 preview；本轮不调用列表 API，因此不报总数。 | 文档公开 REST API，支持分页和过滤；聚合器文档给出基址 `https://registry.modelcontextprotocol.io`。API docs 匿名可读。registry 主机的 `/robots.txt` 当前为 404，不能把“无 robots 文件”解释为无限抓取许可。 | 发布合同使用唯一 server `name`、version、package/repository/remote 等结构化来源字段；最适合作为 canonical ID。以 registry name + version 为主键，repo/package URL 仅作别名与冲突检测。Registry 只托管 metadata，不托管 artifacts。 | [Registry ToS](https://modelcontextprotocol.io/registry/terms-of-service)称提交的 Registry Data 预期公开并以 **CC0-1.0** 贡献。源码仓库当前 main commit 为 `a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be`；[LICENSE](https://github.com/modelcontextprotocol/registry/blob/main/LICENSE)说明代码/规范正迁移至 Apache-2.0、文档（规范除外）CC-BY-4.0，并保留历史 MIT 段落。匿名读取不需登录；发布需要认证。 | **主 discovery index**。只读枚举应严格按官方分页文档，记录 registry name/version/status/source fields；preview 状态要求 checkpoint 和漂移门禁。 |
| **A** | [GitHub MCP Registry](https://github.com/mcp)；稳定入口 [code.visualstudio.com/mcp](https://code.visualstudio.com/mcp) 当前重定向至该页 | GitHub 官方的人类可浏览 MCP server 目录；2026-08-14 页面明确显示 **All MCP servers 219**。这是页面快照数，不推导 API 总数。 | 公开 HTML 有搜索与 8 页分页；本轮未调用 GitHub 私有/内部接口。 | 列表展示 publisher、server 名称、说明、安装入口和使用量。优先回链 Official MCP Registry name 或发布者仓库；仅用展示名去重会误合并同名 server。 | 匿名浏览无需登录；安装/账户动作另行处理。受 [GitHub Terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) 和页面 robots/速率控制约束。 | **官方浏览/抽样核对层**，可交叉验证 Registry 的人类展示；不替代 Registry REST canonical 数据。 |
| **A** | [Cursor Marketplace](https://cursor.com/marketplace)；[Cursor Plugins 官方文档](https://cursor.com/docs/plugins) | Cursor Plugins；官方文档明确 Plugin 可包含 MCP servers、skills、rules、agents、commands、hooks。没有可复核的目录总数，页面中的“9,000+”是某个 Zapier 条目的应用覆盖，不是插件数量。 | 市场公开 HTML 可浏览；[robots.txt](https://cursor.com/robots.txt)明确允许 `/marketplace`，禁止 `/api/`、dashboard、settings 和 publish 等路径。没有发现面向匿名批量枚举的官方 API 合同。 | 官方文档称官方市场条目由 Cursor 团队提交并在上架前人工审核；以 marketplace 详情 canonical URL + plugin manifest identity 去重。Plugin 内的 MCP component 不能自动提升为独立 MCP Resource。 | 匿名浏览无需登录；发布和团队市场需要账户/相应计划。[Cursor ToS](https://cursor.com/terms-of-service)适用。robots 允许页面不等于允许复制目录数据，故只做低频公开页发现。 | **Cursor Plugin 主发现源**；对 MCP 仅产生“plugin contains MCP”候选，后续仍须核原始仓库、固定 commit、LICENSE 与权限。 |
| **B** | [Smithery](https://smithery.ai/)；[文档索引](https://smithery.ai/docs/llms.txt)；[Publish 文档](https://smithery.ai/docs/build/publish)；[sitemap index](https://smithery.ai/sitemap_index.xml) | MCP servers、skills、clients/connections。首页在本轮快照显示 **715 MCPs**，可作为带日期的页面显示数，不视为稳定总量。 | sitemap index 当前公开且列出 **2 个 server sitemap shards、4 个 skill shards**（另有站点页 sitemap）；官方 docs index 列出 servers/skills/namespaces 等 API reference，但 API 涉及 auth/token 的部分不应匿名试探。[robots.txt](https://smithery.ai/robots.txt)允许公开页，明确禁止 `/api/`、`/_next/`、admin/settings/deploy。 | 官方 namespace 将 servers、connections、skills 归组；候选 canonical 可用 namespace + server/skill slug，并必须保存明确 repository 元数据作为来源回溯。Smithery 托管/连接状态不是原作者身份或安全背书。 | 公开目录无需登录；发布、连接、token 等需账户。未在已核入口找到清晰公开目录数据再利用许可或有效 ToS 路径，因此只允许低频 sitemap/公开详情研究，不复制全文或运行配置。 | **次级 discovery index**。先只枚举 sitemap canonical URL，不调用 `/api`；随后小样本核 repository/license 是否稳定。 |
| **B** | [Glama MCP Servers](https://glama.ai/mcp/servers)；[sitemap index](https://glama.ai/sitemap.xml) | 开源 MCP servers，另有 remote servers、clients、connectors/tools 导航。页面标题在本轮明确显示 **72,114**。 | sitemap index 公开并区分 `mcp-servers`、`mcp-remote-servers`、`mcp-clients` shards。[robots.txt](https://glama.ai/robots.txt)禁止 `/api/`、checks/settings/inspect/admin/oauth/test、server blob/tree/score/discussion 等路径，也禁止带 `after`/`sort` 的动态分页。 | 详情通常以源码仓库为中心并展示 license/maintenance 等聚合信号；canonical 应以归一化 repository URL + upstream package/registry identity 去重，不能用 Glama 标题或评分当 Publisher/安全证明。 | 匿名列表可读；受限路径不得访问。未在所核公开入口定位到明确的数据再利用许可/ToS 页面，故规模大不等于可批量复制。 | **大范围候选发现**，但只从允许的 sitemap URL 做 URL 级索引；详情内容和评分仅作审核线索。 |
| **B** | [MCP.so](https://mcp.so/)；[sitemap index](https://mcp.so/sitemap.xml) | MCP servers，并混有 clients、skills、agents、CLI、themes、posts 等多种目录。未找到可信的站点总数；页面中的 12,000+/13,000 等数字出现在具体产品描述，不可当目录规模。 | sitemap index 公开，按 `servers&page=N`、clients、skills、agents 等 section 分片。[robots.txt](https://mcp.so/robots.txt)禁止 `/api/`、search、playground、账户/admin 路径和带 `q` 查询，允许 sitemap。 | 聚合条目可能含 author/slug/上游链接；必须以 upstream repo/package/Official Registry name 重新 canonicalize。缺上游一手来源的条目只能 deferred。 | 匿名主页/sitemap 可读；`/terms` 与 `/about` 本轮均为 404，未闭合公开数据许可。不得调用 `/api` 或站内 search 自动化。 | **仅 discovery lead**；URL 级枚举后必须回溯官方仓库/产品页，不作发布、许可或安全证据。 |
| **B** | [Visual Studio Marketplace](https://marketplace.visualstudio.com/)；[VS Code Extension Marketplace 文档](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)；[MCP servers 文档](https://code.visualstudio.com/docs/agent-customization/mcp-servers) | VS Code/Visual Studio extensions，可能包含或管理 MCP，但不是纯 MCP/Connector 目录。未报 MCP 条目总数。 | 公开搜索页可用；[robots.txt](https://marketplace.visualstudio.com/robots.txt)禁止 `/_apis/` 和 `/publishers/`，提供 sitemap。不得借内部 marketplace API 批量抓取。 | canonical 用 publisher + extension ID；MCP server identity 必须另从 extension 官方仓库/manifest 提取。微软文档明确 VS Code 可安装/管理 MCP servers，但扩展搜索命中 “mcp” 不证明其是 MCP server。 | 匿名浏览无需登录；发布需账户。[Marketplace Terms of Use](https://aka.ms/vsmarketplace-ToU)为微软官方 PDF。 | **宿主兼容性/扩展审核证据**；不作为独立 MCP canonical 主索引。 |
| **C** | [PulseMCP Servers](https://www.pulsemcp.com/servers)；[robots.txt](https://www.pulsemcp.com/robots.txt) | MCP server 聚合目录；未报数量。 | 首页、servers 与 sitemap 在本轮研究客户端均被 Cloudflare **403**；robots 对通用 crawler 允许公开站点，但明确屏蔽多类自动代理。 | 无法在不绕过保护的前提下复核 canonical、分页和来源字段。 | 当前要求 Cookie/挑战；不得规避、换私有接口或自动重试。 | **人工审核线索，暂不枚举**。可访问性恢复且官方给出公开索引合同后再评估。 |
| **C** | [Claude Connectors（预期官方入口）](https://claude.com/connectors)；[Anthropic Consumer Terms](https://www.anthropic.com/legal/consumer-terms) | Claude 官方/合作方 connectors 与 integrations。当前研究环境无法取得公开目录正文，故不报数量或字段。 | 未闭合匿名 sitemap/API/分页证据；Connectors 可能依赖 Claude 登录态。 | 若人工登录可见，也只能记录官方 connector 名称/供应商声明和帮助页，不能把账户已授权状态输出成“公开可连接”或“已连接”。 | Consumer Terms 对自动化非人访问有限制；本研究没有登录或使用会话。 | **仅官方审核证据**，不是匿名 discovery index。 |
| **C** | [cursor.directory](https://cursor.directory/) | Cursor 社区 plugins/MCP servers；Cursor 官方文档把它称为 community plugins and MCP servers 的浏览入口，但它不是 `cursor.com` 官方市场。 | 本轮主页和 robots 均返回 **429**，没有可安全使用的匿名索引合同。 | 必须回溯 Cursor official marketplace 或原始仓库；站名/slug 不足以证明 publisher。 | 遇 429 立即停止，不重试、不绕过。 | **线索源，暂不枚举**。 |

## 风险判断

- **robots 是访问边界，不是许可证。** sitemap/页面可访问只证明可以按该公开路径浏览；没有明确数据许可时，不复制描述全文、不镜像详情、不保存原始 HTML。
- **目录声称不是 Publisher 事实。** Smithery/Glama/MCP.so 的 author、评分、安装量和安全扫描只能记为该目录的外部声明；Resource canonical 必须回到 Official MCP Registry、包注册表、原始仓库或供应商官方页面。
- **同名去重不足。** 首选 Official Registry `name + version`；其次使用规范化 repository/package identity；marketplace 使用 publisher + extension/plugin ID。展示名、slug 和说明只作 fuzzy collision signal。
- **Connector 不能冒充连接状态。** 公开目录只能产生 `discovered-unreviewed` resource link；没有用户 OAuth/授权证据时不得写 installed、connected、authorized 或 managed。
- **目录数量是快照。** 本文的 219、715、72,114 仅是 2026-08-14 可复核页面显示值，不是完成度承诺，也不应跨站相加。

## 下一步最小只读枚举方案

1. **Official MCP Registry 小样本先行**：按官方 REST 文档以 `limit=20` 读取第一页，仅保存 exact minimal fields：registry name、version、status、repository/package/remote canonical references、响应内公开更新时间；不保存 headers、tokens、raw response。验证 next/cursor 语义后才扩大。
2. **GitHub MCP Registry 人工交叉抽样**：从公开 219 条页面首尾各抽 5 条，验证是否能映射回 Official Registry name；不使用内部 API。
3. **Smithery sitemap-only**：只读 `sitemap_index.xml`，固定 server/skill shard allowlist；先取每类 1 个 shard 的 20 个 URL 样本，核 URL schema、重复率、repo 字段稳定性。禁止 `/api`、`/_next`。
4. **Glama sitemap-only**：只读 root sitemap index，并从 `mcp-servers` 与 `mcp-remote-servers` 各取 20 个 URL；不访问 robots 禁止的 blob/tree/score/after 路径。只记录 URL 和 upstream canonical evidence presence。
5. **MCP.so sitemap-only**：只读取 servers section 的第一页 20 URL，先核是否每条都能回溯上游；来源缺失率高于 10% 即停止，不扩量。
6. **官方市场抽样**：Cursor Marketplace 抽 10 个公开 Plugin，分类其是否含 MCP component；Visual Studio Marketplace 只抽 10 个明确 publisher+extension ID 的 MCP 相关扩展。均不调用 marketplace 内部 API。
7. **C 类不自动化**：PulseMCP/cursor.directory 遇 403/429 保持停止；Claude Connectors 只做用户授权的人工公开页面核验，不使用登录会话进行目录抓取。

每个枚举器都应保持单实例、并发 1、至少 1.5 秒间隔、403/429 立即停、2 MiB 响应上限、same-host/manual redirect、content-type 校验、checkpoint 绑定输入 manifest 与 parser hash、completed rerun 零写。输出始终是 candidate-only `discovered-unreviewed`，不触碰 active catalog/state/App/server/package。

## 本轮证据限制

- 没有访问任何私有 API、账户页或受保护详情，也没有抓取目录数据集。
- Smithery、Glama、MCP.so 未闭合清晰的数据再利用许可；因此即使有 sitemap，也只建议低频 URL 级 discovery。
- PulseMCP 和 cursor.directory 的 403/429 是本轮客户端观测，不代表网站永久不可访问。
- Claude Connectors 的公开目录结构未在匿名环境闭合，任何数量、分页或 canonical schema 均刻意留空。
