# MCP / Connector / Plugin 来源全面普查（2026-08-14）

> 状态：只读研究冻结稿；未调用私有 API，未登录、未绕过 robots/反爬、未抓全站，也未修改 catalog/state/channel/release/App/server/package。
> 目的：回答“还能从哪里发现更多 MCP、Connector、Plugin 资源”，不是给任何条目背书，更不是授权安装。
> 交叉阅读：本稿扩展而不覆盖 [similar-resource-directories-mcp-2026-08-14.md](./similar-resource-directories-mcp-2026-08-14.md)；后者保留了较小范围目录的页面级核验与 robots 证据。

## 结论先行

- 本次冻结 **79 个可独立判定的来源/产品面，覆盖 73 个不同公开 host**：**A 19、B 14、C 29、D 17**。计数是“来源面”而不是资源数；同一上游条目被多个目录收录时只能算一个 AI Hub Resource。
- 最值得先接的是官方 MCP Registry、Docker、ToolHive、ModelScope、Postman、Claude Connectors、Gemini CLI Gallery、Google Cloud 支持产品表等公开一手源；每源首轮只取 **5–10 条**。
- Smithery、Glama、mcp.so、mcp.directory、MCPMarket、PulseMCP 等独立目录适合补漏，不适合作为 publisher、license、安全或“官方”事实来源。
- Azure API Center、JFrog、Google Agent Registry、GitHub 组织注册表、Red Hat Developer Hub、HiMarket、ToolHive Registry Server 等是组织治理或自托管能力，不是匿名公共内容库。
- Composio/Pipedream/Zapier/Make/n8n/Apify 的“数千应用/工具”，以及 Agent、Workflow、Tool marketplace 的条目，**不等于数千个 MCP/Skill**。应建一个 Provider/Plugin 资源，再用 capability/target 关系表达其应用与动作。
- 任何第三方目录的 verified/official/featured、热度、评分或付费展示都只是目录声明；AI Hub 仍须回到 publisher 控制的仓库、文档、包与版本证据。

## 分级与证据规则

| 级别 | 本稿含义 | AI Hub 用法 |
| --- | --- | --- |
| A | 官方公共 registry/marketplace，或 publisher 自己公开、有限且可枚举的 MCP/Plugin seed | 可进入低频 discovery；仍以 `discovered-unreviewed` 入库，安装前另做版本、权限、哈希、签名与卸载审查 |
| B | 有明确运营主体的独立聚合目录 | 只补漏和找上游；不能继承 badge、publisher、license 或安装信任 |
| C | 产品内、账号内、企业私有或自托管 registry/connector/agent marketplace | 建“产品/组织内能力”或 Provider 关系；不得冒充匿名公共目录，也不得调用需要登录或密钥的接口 |
| D | research dataset、awesome/meta-list、SEO 聚合、失效/预发布/反爬或误报率高的源 | 仅人工研究线索；默认不做自动枚举 |

证据口径：本稿只记录公开页面、公开仓库 README/LICENSE 与公开文档；“公开可浏览”不等于允许复制数据库，robots 也不等于内容许可。若来源未明示目录数据许可，则一律记为“目录复用许可未闭合”；仓库自身的 MIT/Apache-2.0/CC0 也不自动覆盖其链接到的第三方项目。规模是 **2026-08-14 的页面/文档自称快照**，随时可能变化，不跨站相加。表内若未单独写 robots 规则，表示本轮只核验了公开页面/仓库、**没有声称可自动抓取**；实施前必须再读该 host 当时的 robots/ToS，未发现公开 API 契约时不得探测内部接口。

## A — 官方公共 registry / marketplace / 可枚举 seed（19）

| ID | canonical URL | 资源类型、公开规模或枚举机制 | publisher / provenance；license / 登录 / API 边界 | AI Hub discovery 与去重规则 |
| --- | --- | --- | --- | --- |
| A01 Official MCP Registry | <https://registry.modelcontextprotocol.io/>；[About](https://modelcontextprotocol.io/registry/about)；[API docs](https://registry.modelcontextprotocol.io/docs)；[GitHub](https://github.com/modelcontextprotocol/registry) | MCP server 元数据中央 registry；公开 `GET /v0.1/servers` 支持 cursor、filter 与增量同步；registry 明确建议下游低频同步 | MCP 项目运营；namespace 需证明控制权；registry 数据标为 CC0，但所指 package/repo 各自许可；匿名读、发布需 GitHub/OAuth；服务条款不提供安全保证 | **首选**。identity 用 registry `name + version`，保留版本与状态；package、remote endpoint、repo 分别建 provenance，不把 metadata 当可执行物 |
| A02 GitHub MCP Registry | <https://github.com/mcp> | GitHub 官方 MCP 展示页；公开列表可浏览，页面数量是动态快照，无稳定公开批量契约 | GitHub 运营，publisher 仍是每个条目上游；页面公开，目录数据复用许可未闭合；不得用内部接口 | **高价值补充**。按上游 registry 名称/repo/package 去重；GitHub 的展示/徽章不替代上游签名和版本审查 |
| A03 Docker MCP Catalog | [Docs](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/)；[public catalog repo](https://github.com/docker/mcp-registry)；[Hub](https://hub.docker.com/mcp) | 官方文档自称 **300+ verified servers**；公开 repo/Hub 可枚举；含 local 与 remote MCP、版本、provenance、SBOM 等 | Docker 运营；Docker-built local image 有 Docker 签名链，第三方 upstream 许可逐项核验；公共浏览，组织自定义 catalog 另属 C | **首选**。优先用 repo/manifest 的 server identity + image digest/version；不要按容器 tag 文案或同名工具重复建条目 |
| A04 Cursor Marketplace | <https://cursor.com/marketplace>；[2.5 announcement](https://cursor.com/changelog/2-5) | 官方 plugin marketplace；plugin 可组合 MCP、Skills、rules、subagents、hooks；公开 UI 可浏览，无稳定公开总量/API 承诺 | Cursor 运营，publisher 为插件作者；第三方组件许可逐项核验；公共浏览，团队私有 marketplace 另属 C；不调用内部接口 | **适合发现 bundle**。identity=`cursor + publisher + plugin id + version`；拆出 MCP/Skill 组件关系但保留 bundle 来源，不把每个 command 算独立资源 |
| A05 Claude Connectors Directory | [Overview](https://claude.com/docs/connectors/overview)；[submission](https://claude.com/docs/connectors/building/submission) | 官方目录，收 remote MCP、MCPB 与 MCP Apps；公开说明 OAuth 2.0、HTTPS、tool annotations、隐私资料等提交条件 | Anthropic 运营；publisher 需提交一手文档；目录审核不等于零风险；公开浏览/使用可能需 Claude 账号，目录数据许可未闭合 | **首选 remote MCP seed**。按 publisher domain + normalized endpoint origin/path 去重；connector 与其暴露 tools 是一对多关系 |
| A06 Claude Plugins Directory | <https://claude.com/plugins>；[提交说明](https://claude.com/docs/plugins/submit)；[Claude Code plugin docs](https://code.claude.com/docs/en/plugins) | 官方 plugin 目录；可捆绑 Skills、MCP、subagents、commands；产品内统一目录还可能显示组织条目 | Anthropic 运营但社区 publisher 自负内容；自动基础审查，“Anthropic Verified”只是附加审查声明；提交需公开 repo，使用/组织条目常需登录 | **适合 Plugin/Skill/MCP bundle discovery**。identity=`anthropic directory + publisher + plugin id + version`；组织私有条目不得外泄 |
| A07 Gemini CLI Extension Gallery | <https://geminicli.com/extensions/>；[docs](https://geminicli.com/docs/extensions/)；[release/indexing](https://geminicli.com/docs/extensions/releasing/) | 2026-08-14 页面显示 **1,322 extensions**；每天索引带 `gemini-cli-extension` topic 且根目录含 `gemini-extension.json` 的公开 GitHub repo；bundle 可含 MCP、commands、themes、hooks、subagents、Skills | Google/Gemini CLI 官方 gallery；Google 明示不 vet、endorse 或保证第三方扩展安全；公开 gallery/实验性 JSON registry，repo 许可逐项核验 | **首选公开 bundle seed**。identity=`owner/repo + manifest id + release/commit`；topic 命中只表示候选，不表示官方/安全 |
| A08 ModelScope MCP 广场 | <https://www.modelscope.cn/mcp>；[公开说明](https://www.modelscope.cn/learn/5589)；[示例详情](https://www.modelscope.cn/mcp/servers/@XGenerationLab/xhs_mcp_server) | ModelScope 官方 MCP 广场；一手白皮书快照称 **5,500+**；公开详情页可浏览；文档有带 Bearer token 的 OpenAPI list/query/deploy | ModelScope 运营、publisher 为条目作者；公共页可读，OpenAPI/部署需 token，本研究未调用；目录许可与上游许可分别核验 | **中文/区域首选**。首批只读公开详情 5–10 条；按 namespace/server + repo/package/version 去重，绝不把 deploy API 当 discovery 权限 |
| A09 Postman MCP Directory | <https://www.postman.com/getmcp>；[official list workspace](https://www.postman.com/getmcp/official-mcp-server-list/overview) | Postman 官方 curated/verified MCP list，使用 public workspaces/Collections 表达条目与 publisher；可公开浏览 | Postman 运营目录、条目 publisher 独立；Postman 的“curated/verified”仅目录 provenance；公共 workspace 可读，目录 API/账号边界不调用 | **高价值人工/低频 seed**。按 Collection/workspace publisher + upstream MCP identity 去重；不要把 Postman 自己的单个 MCP（100+ Postman tools）拆成 100 个资源 |
| A10 Higress MCP Marketplace | <https://mcp.higress.ai/> | Higress 官方公共 MCP marketplace，公开分类/详情/remote service 浏览；动态页面无稳定复用 API 承诺 | Higress/阿里开源生态运营；条目 publisher 与许可逐项核验；公开浏览，不调用私有接口 | **适合中文 remote MCP 补充**。按 upstream repo/package/endpoint 去重；HiMarket 企业自托管面另列 C06 |
| A11 ToolHive Catalog | <https://github.com/stacklok/toolhive-registry> | Stacklok/ToolHive 官方公共 catalog repo；`server.json`/schema 暴露 repo、版本、transport、provenance；同时含 Skills | Stacklok 官方维护；repo Apache-2.0，所指第三方项目许可不继承；公开 Git，可按提交增量读取，PR 有 review | **首选可审计源**。identity 优先 registry server name/version，保留 upstream repo/package/digest；Skill 与 MCP 分 channel，不互相冒充 |
| A12 Cline MCP Marketplace | <https://github.com/cline/mcp-marketplace>；<https://cline.bot/mcp-marketplace> | Cline 官方 marketplace repo/产品入口；提交通过 issue/审查，一键流程可能 clone、安装并写配置 | Cline 官方维护，repo MIT；第三方 server 许可和代码风险逐项核验；公开 repo，安装需要本机权限 | **只 discovery，不复制一键执行**。按 upstream repo/package/version 去重；AI Hub 必须独立做固定版本、hash、权限、卸载方案 |
| A13 Goose Extensions | <https://github.com/aaif-goose/goose> | Goose 官方继任仓库/产品内 extension 生态；公开自称 **70+ MCP extensions**，不是通用 registry | Linux Foundation Agentic AI Foundation 项目；repo Apache-2.0，扩展上游逐项核验；公开 Git/文档 | **官方 host seed**。按 Goose extension id + upstream server identity 去重；只计 MCP extension，不把 recipe/agent/tool 混入 MCP |
| A14 Google Cloud remote MCP 支持产品 | <https://docs.cloud.google.com/mcp/supported-products> | Google Cloud 官方有限表，列出受支持产品及 remote MCP endpoints；公开 HTML 表可人工/低频枚举 | Google Cloud 一手 publisher；文档公开，实际调用受 IAM/产品权限约束；文档许可不代表 endpoint 数据许可 | **高可信 provider seed**。一个产品 endpoint 为一个 provider MCP，tools 是 capabilities；不与 Google Agent Registry 私有组织条目混合 |
| A15 AWS Agent Toolkit for AWS | <https://github.com/aws/agent-toolkit-for-aws> | AWS 新主线公开 repo，包含 AWS MCP/skills/plugins；官方说明单个 managed server 覆盖 **300+ AWS services** | AWS 官方，repo Apache-2.0；实际云调用需 AWS 权限；公开 Git，不调用凭据接口 | **官方有限 seed**。managed server 算一个 provider MCP，300+ services 建 capability/target 关系；旧 `awslabs/mcp` 另列 D05 |
| A16 Apify MCP / Actors | <https://apify.com/mcp>；[docs](https://docs.apify.com/integrations/mcp) | Apify 官方公共 MCP/Actor marketplace 面；自称 **7,000+ Actors/MCP servers**；公开只读 discovery tools 可找 Actor，执行/存储需 token | Apify 运营，Actor publisher 各异；公开 discovery 不等于执行授权；Actor 许可、数据处理、费用逐项核验 | **谨慎接入**。默认建 `Apify MCP provider`，Actor 作 capability/linked product；仅有独立 canonical MCP endpoint/repo 时才升格为独立 MCP |
| A17 ClawHub / OpenClaw Hub | <https://clawhub.ai/>；[official repo](https://github.com/openclaw/clawhub)；[official docs](https://github.com/openclaw/clawhub/blob/main/docs/clawhub.md) | OpenClaw 官方 public **Skill + Plugin** registry/CLI；公开 search/explore/inspect，含 semver、tags、changelog、files、downloads、stars、security scan；**不是 MCP registry** | OpenClaw 官方生态；repo MIT；发布/删除需 GitHub 账号及账号年龄门槛；robots 禁 `/api/`/`/admin/`，但明确允许 `/v1/feeds/plugins` 与 `/v1/feeds/skills`；本研究未调用任何私有 API | **只在 Skill/Plugin channel 作为 A 源**。identity=`publisher/slug + version + source repo`；security scan 只是信号，不得把 Skill/Plugin 数计入 MCP |
| A18 Stripe MCP | <https://github.com/mcp/com.stripe/mcp> | Stripe 控制的 canonical MCP repo；单一 provider server，不是 marketplace，但公开版本/repo 可枚举 | Stripe publisher；公开 Git，repo license 与 API 条款分别核验；实际操作需 Stripe 权限 | **官方 provider seed**。只建一个 Stripe MCP 及其 tools/capabilities，不把每个 API action 建成资源 |
| A19 Shopify agentic/UCP/MCP | <https://shopify.dev/docs/agents> | Shopify 官方 agentic commerce 文档与公开 MCP/UCP 接入面；有限一手 provider seed，不是通用 registry | Shopify publisher；公开文档，商店/账户/API 权限与条款适用；目录复用许可不适用 | **官方关系 seed**。建 Shopify provider/connector 与协议能力，不能把 agents、APIs、actions 自动计作 MCP/Skill |

## B — 可信独立聚合目录（14）

| ID | canonical URL | 资源类型、公开规模或枚举机制 | provenance / license / access 边界 | AI Hub discovery 与去重规则 |
| --- | --- | --- | --- | --- |
| B01 Smithery | <https://smithery.ai/>；[API docs](https://smithery.ai/docs/api-reference/servers/list-all-servers) | 2026-08-14 页面显示约 **14,362+ MCPs**；公开详情可浏览；文档 list API 需要 Bearer key | 独立聚合+托管/认证服务；目录 badge/scan 是站点声明；目录复用许可未闭合；本研究未调用 key API | **补漏**。每条回溯 publisher repo/package/endpoint；托管 URL 与 upstream server 分开记录 |
| B02 Glama | <https://glama.ai/> | 同日页面曾显示 **65,763 servers / 10,479 connectors**，稍后又显示 **72,114 / 12,022**；另称 574,084 tools，证明计数高度动态 | 独立聚合、hosting/inspector 服务；maintainer-verified/scanned 为站点声明；公开页面可读，许可未闭合 | **仅 lead**。绝不相加 server/connector/tool；同一 upstream 用 `discoveredVia=glama` 合并，badge 不升信任 |
| B03 mcp.so | <https://mcp.so/> | 社区目录混合 local/remote servers、clients、CLI、Skills、agents、themes；公开分类/搜索，提交经 GitHub issue | 独立运营；上游 publisher/许可逐项核验；无稳定全量契约 | **按 type 分流后补漏**。server、Skill、client 不互相计数；相同 repo/package/endpoint 合并 |
| B04 mcp.directory | <https://mcp.directory/>；[about](https://mcp.directory/about) | 2026-08-14 页面自称 **2,303 servers、9,291 skills、1,907 publishers**；公开详情/分类可浏览 | 独立目录；“official”标签只是站点声明；目录复用许可未闭合 | **适合少量人工 seed**。publisher 名需用一手域名/repo重证；server 与 Skill 分 channel |
| B05 MCPMarket | <https://mcpmarket.com/>；[Hub](https://mcpmarket.com/hub) | 页面自称 **42,970 servers** 并混有大量 Skill；公开 catalog，Hub 有账号/团队/版本能力 | 独立目录，存在 featured/商业展示；部分结果是通用 repo/工具而非 MCP；目录许可未闭合 | **低信任 lead**。先做 type gate + upstream manifest；“Official/featured”不采信，Hub 私有数据不取 |
| B06 PulseMCP | <https://www.pulsemcp.com/servers> | 2026-08-14 页面显示 **22,070 servers、526 pages、每页 42**；较早快照为 12,724，计数动态；公开分页 | 独立目录；Anthropic reference/official/community 是其分类；页面注明 submission/listing changes paused | **补漏**。最多 5 条/轮，按 upstream 去重；暂停状态使其不宜当实时主源 |
| B07 MCP Marketplace | <https://mcp-marketplace.io/> | 独立 MCP 浏览/搜索站，公开 UI，无已核验的稳定总量或公共批量 API | 独立运营；publisher、license、badge 需回溯；目录复用许可未闭合 | **人工 lead**。只取明确 upstream URL 的条目；无 upstream 则不入候选 |
| B08 MCP Markets | <https://mcpmarkets.com/en> | 独立多语言 MCP 聚合页；公开分类/详情，无稳定公共枚举契约 | 独立运营；目录数据许可与安全审核口径未闭合 | **人工 lead**。同 upstream 合并，不把翻译页/地区页建成新资源 |
| B09 LobeHub MCP | <https://lobehub.com/mcp> | LobeHub 生态中的公开 MCP 聚合与分类；动态 UI，无稳定全量复用契约 | LobeHub 运营；publisher/许可仍属上游；产品内 install 体验不构成 AI Hub 执行授权 | **补漏**。按 repo/package/endpoint 去重；Lobe plugin/agent 与 MCP 分开 |
| B10 MCP Server Finder | <https://www.mcpserverfinder.com/search> | 独立搜索目录；公开查询/详情，规模与枚举契约未稳定核验 | 独立运营；目录许可、审核与 publisher 证明未闭合 | **只人工查询**。必须有一手链接才能进入 `discovered-unreviewed` |
| B11 registry.mcpservers.org | <https://registry.mcpservers.org/> | 官方 MCP Registry 的第三方 browser/front-end；公开搜索但内容主要来自官方 registry | 独立前端；许可/刷新延迟由实现决定；不比官方 API 更权威 | **通常跳过**。若发现条目，`discoveredVia` 记录此站，identity 回归 A01，绝不重复建资源 |
| B12 Visual Studio Marketplace | <https://marketplace.visualstudio.com/> | 官方扩展宿主，但 MCP 只是其中一小类；公开 query/pagination UI，非 canonical MCP registry | Microsoft 运营宿主，publisher 是扩展作者；扩展 license/包逐项核验；不得调用未公开内部 API | **IDE plugin 补漏**。identity=`marketplace + publisher + extension id + version`；仅 manifest 明确含 MCP 时建立组件关系 |
| B13 APITracker MCP Servers | <https://apitracker.io/mcp-servers> | 2026-08-14 公开页精确显示 **109 项 = 89 Official Integration + 20 Reference**；详情页可逐项打开，AutomationSwitch 的 110 已漂移 | API Tracker 是 Apideck product；公开浏览无需登录；未发现目录数据开放许可；robots 允许 `/mcp-servers/`/`/mcp-server/`、禁止 `/api/`，并明确禁止多种 AI crawler；本研究未探测 API | **高信号、低频人工 seed**。只读公开页，每条回到 publisher；分类标签不是 publisher 证明，不镜像内容 |
| B14 Claude Marketplaces Directory | <https://claudemarketplaces.com/>；[about](https://claudemarketplaces.com/about)；[privacy](https://claudemarketplaces.com/privacy) | 第三方目录自称 **23,600+ skills、2,600+ marketplaces、12,700+ MCP servers**；说明从 skills.sh、GitHub 与 community MCP directories 聚合 | 独立运营、非 Anthropic；GitHub 登录仅保存 listing；未见内容开放许可；robots 允许公开页但禁止 `/api/`/`/profile`/`/go`，本研究未调用 API | **跨生态二级 lead**。只保留 canonical repo/publisher 线索；不得把数量、安装数或摘要当一手事实，也不得冒充 A06 官方目录 |

## C — 产品内 / 企业私有 registry、自托管软件与 connector 平台（29）

| ID | canonical URL | 类型、规模或枚举机制 | provenance / license / 登录与私有 API 边界 | AI Hub 建模结论 |
| --- | --- | --- | --- | --- |
| C01 Azure API Center | [register/discover](https://learn.microsoft.com/en-us/azure/api-center/register-discover-mcp-server)；[discover catalog](https://learn.microsoft.com/en-us/azure/api-center/discover-catalog-mcp-server) | 组织 inventory，可登记/发现 API、MCP server、plugin、skill；可暴露标准 registry endpoint | Microsoft 官方；资源属于租户/组织；匿名或 Entra 由组织配置，非默认公共数据库 | **企业能力，不抓内容**。AI Hub 可记录“可连接 Azure API Center”，不得导出其他租户目录 |
| C02 JFrog MCP Registry | [AI Catalog overview](https://docs.jfrog.com/ai-ml/docs/jfrog-ai-catalog-overview)；[manage MCP](https://docs.jfrog.com/ai-ml/docs/manage-mcp-servers) | project-scoped 企业 system of record；可导入 official registry、自定义 Artifactory npm/PyPI/remote，含 allowlist/scanning/policy | JFrog 官方商业产品；需组织账号/权限；项目数据私有 | **企业治理能力**。不得当公共 publisher；仅用户明确连接其组织且授权时同步 |
| C03 Google Cloud Agent Registry | [manage MCP tools](https://docs.cloud.google.com/agent-registry/manage-mcp-tools)；[use MCP](https://docs.cloud.google.com/agent-registry/use-agentregistry-mcp) | GCP project/IAM 内的 agents、MCP、Skills、endpoints catalog | Google Cloud 官方；要求 principal/IAM，不用匿名 API key；组织资产私有 | **组织内 catalog**。与 A14 Google 公共支持产品表严格分离 |
| C04 GitHub organization MCP registry | <https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-mcp-registry> | GitHub Enterprise/Business 管理员配置组织允许的 MCP registry，可接自托管或 Azure API Center | GitHub 官方；owner/admin 权限，组织政策与数据私有 | **治理接入点**，不是 github.com/mcp 公共内容源；无用户授权不读取 |
| C05 Red Hat Developer Hub catalog MCP | <https://developers.redhat.com/articles/2025/11/10/mcp-red-hat-developer-hub-chat-your-catalog> | 通过 MCP 查询组织 Backstage/Developer Hub software catalog 与 TechDocs | Red Hat 官方示例；需组织部署/static token；内部 catalog | **企业 connector**。只描述能力与权限边界，不枚举示例组织的数据 |
| C06 Higress HiMarket | <https://github.com/higress-group/himarket> | 自托管企业 AI marketplace，治理 model、MCP、agent、skill；不是公共 Higress marketplace 数据镜像 | Higress 官方开源 repo；repo license 见仓库，部署数据由组织控制；需自建/登录 | **自托管软件资源**。与 A10 公共条目分开，默认不创建其内部资源 |
| C07 ToolHive Registry Server | <https://github.com/stacklok/toolhive-registry-server> | 自托管 aggregation/governance server，兼容 official Registry API 并扩展 Skills；支持 internal Git/K8s/API sources、JWT/claims | Stacklok 官方，Apache-2.0；运行实例与 feeds 私有 | **可作为企业同步软件**。只有用户提供授权实例才枚举；来源/feed provenance 必须保留 |
| C08 Nacos MCP/Skill Registry | [MCP auto-register](https://www.nacos.io/en/docs/v3.0/manual/user/ai/mcp-auto-register/)；[system config](https://nacos.io/en/docs/latest/manual/admin/system-configurations/) | 自托管 MCP/Skill registry、namespace 与 standard API；可导入 official registry，标准接口默认可关闭 | Nacos 官方开源/产品文档；实例数据私有，访问由部署者控制 | **自托管 registry 能力**。namespace + source provenance 去重，不把一次导入复制成新 publisher |
| C09 Workato MCP Registry | <https://docs.workato.com/en/mcp/mcp-registry> | workspace 内中央 catalog，含 prebuilt/private/proxy servers；产品文档曾列约 60 个 prebuilt templates | Workato 官方商业产品；需 workspace 登录/权限，条目与凭据私有 | **账号内 catalog**。只建 Workato provider/connector，不能匿名批量抓模板 |
| C10 Dify Marketplace | <https://marketplace.dify.ai/?category=all&language=en-US> | 官方产品 plugin marketplace，混合 Models、Tools、Data Sources、Triggers、Agent Strategies、Extensions、Bundles；部分 plugin 是 MCP wrapper | Dify 官方；公开页面可浏览但安装/管理进 workspace；plugin publisher/许可逐项核验 | **Plugin source，不是 MCP registry**。先按 category 建 bundle/component 关系；wrapper 不等于其远端 provider |
| C11 Composio Connect | <https://docs.composio.dev/docs/composio-connect> | 单个 MCP endpoint/元工具层连接 **1,000+ apps**；文档描述 7 个 meta-tools，OAuth/API key 后发现/执行 | Composio 官方 SaaS；账户、OAuth 与 API key 边界；应用目录不是 1,000 个 MCP | **一个 Provider 资源**，app/action 作 capability/target；不得收集用户 secret 或把每个 action 建资源 |
| C12 Pipedream MCP | [developer docs](https://pipedream.com/docs/connect/mcp/developers)；<https://mcp.pipedream.com/> | provider MCP 连接 **3,000+ APIs / 10,000+ tools**；公开 app list，执行需 token/OAuth | Pipedream 官方 SaaS；账号、计费、OAuth；公开 app 名不等于公开执行权限 | **一个 Provider→app/tool 关系图**。只有独立 publisher MCP 才升格资源 |
| C13 Zapier MCP | <https://zapier.com/mcp> | 一个 Zapier MCP 连接其自称 **8,000 apps / 30,000+ actions** | Zapier 官方 SaaS；需账号、app authorization、task quota；条款适用 | **一个 Provider**。8,000 apps/30,000 actions 绝不能计成 MCP/Skill 数 |
| C14 Make MCP | <https://www.make.com/en/mcp> | 将用户的 Make scenarios 暴露为 tools；平台自称 **3,000 apps / 30,000+ actions** | Make 官方 SaaS；需账号、scenario 与连接凭据 | **用户工作流 connector**。workflow/tool 是用户资产，不进入公共 MCP catalog |
| C15 n8n MCP Client integrations | <https://n8n.io/integrations/mcp-client/> | 官方 integrations/templates 页面，自称连接 **422+ apps**；是 workflow/integration 生态，不是 MCP registry | n8n 官方；模板/connector publisher 与 license 各异；执行需部署/账号凭据 | **Connector/Workflow seed**。一个 n8n product relationship；不把每个 workflow/template 当 MCP/Skill |
| C16 LangChain integrations | <https://docs.langchain.com/oss/python/integrations/providers/overview> | 官方文档自称 **1,000+ integrations**，跨 model/tool/loader/vector 等类别 | LangChain 官方 docs/packages；开源包许可逐项，服务凭据另行适用 | **相邻 connector seed**，不是 MCP/Skill。仅在一手包明确实现 MCP 时建组件关系 |
| C17 LlamaHub | <https://docs.llamaindex.ai/en/v0.10.33/understanding/loading/llamahub/> | LlamaIndex 官方生态的 hundreds of data connectors、agent tools、packs；链接为旧版 v0.10.33 文档 | LlamaIndex 官方；各包/数据源许可与凭据逐项；不是统一 MCP registry | **相邻 connector seed**。版本过旧需实时复核；connector/tool/pack 不自动进入 MCP/Skill |
| C18 Alibaba Cloud Model Studio MCP/plugins | [plugin overview](https://help.aliyun.com/en/model-studio/plug-in-overview)；[managed MCP](https://help.aliyun.com/zh/model-studio/managed-agents-mcp) | 产品内官方/第三方/自定义 plugins 与 MCP；账号内启用、计费、授权 | 阿里云官方；需账号/服务开通；市场条目、凭据和调用记录受产品边界约束 | **中国云产品关系**。不匿名批量抓；与 A08 ModelScope、A10 Higress 分开 |
| C19 Tencent Cloud Agent plugin marketplace | <https://intl.cloud.tencent.com/zh/document/product/1254/72577> | 产品内 official/third-party/custom plugin，类型含 MCP/API/code/app | 腾讯云官方；账号/产品权限；官方文档明确不担保第三方安全、稳定或合规 | **产品内 connector/plugin**。第三方条目仍需 publisher 一手复核，不继承腾讯“官方”身份 |
| C20 Coze 技能商店 | <https://www.coze.cn/overview> | Coze 官方产品面明确有技能商店/插件/工作流生态；登录后使用，非匿名 MCP registry | Coze 官方；账号、workspace 与平台条款；公开首页不是可复用全量 API | **Skill/Plugin 产品关系**。只有显式 MCP 实现才进入 MCP channel |
| C21 Baidu Qianfan MCP components | [Qianfan docs](https://cloud.baidu.com/doc/QIANFAN/index.html)；[official MCP announcement](https://ai.baidu.com/support/news?action=detail&id=3238) | 百度官方 2025-04-24 快照称 **11 MCP servers / 68 tools**；产品组件/服务集，不是公共通用目录 | 百度智能云官方；账号/云权限/费用；数字为历史页面快照 | **官方 provider seed**。实时复核后按 server 建有限关系，68 tools 只作 capabilities |
| C22 Salesforce AgentExchange | <https://help.salesforce.com/s/articleView?id=005387252&language=en_US&type=1> | Salesforce 平台 Agent/solution marketplace，页面自称 **13k+ solutions / 6k+ AgentX apps** 并支持 MCP connectivity | Salesforce 官方商业平台；账号、org、Marketplace 条款；数字不是 MCP 数 | **Agent/Product marketplace**。只把明确 publisher MCP/connector 建组件；其余维持 agent/app 关系 |
| C23 Microsoft 365 Agent Store | <https://learn.microsoft.com/en-us/microsoft-365/copilot/copilot-agent-store> | Microsoft 365 Copilot 产品内 agent store，含组织治理/部署 | Microsoft 官方；租户、管理员与许可证控制；组织条目私有 | **Agent store，不是 MCP/Skill 目录**。只能记录 host relationship 与明确 connector 组件 |
| C24 Atlassian Rovo connectors | <https://www.atlassian.com/software/rovo/connectors>；[Marketplace collection](https://marketplace.atlassian.com/collections/atlassian-rovo) | Rovo 官方 connectors 与 Atlassian Marketplace collection；产品/app 生态 | Atlassian 官方；使用需站点/账号/Marketplace 权限；第三方 app publisher 独立 | **Connector/Product seed**。按 Atlassian app id/version 建插件资源，仅明确 MCP 组件进入 MCP channel |
| C25 ServiceNow AI Agent Marketplace | <https://www.servicenow.com/workflow/ai/your-go-to-marketplace-ai-agents.html> | ServiceNow 官方 AI agent marketplace 产品面 | ServiceNow 官方商业平台；实例/账号/Store 条款；非匿名 MCP registry | **Agent marketplace**。仅记录 product/connector relationship，不把 agent 数映射为 MCP/Skill |
| C26 AGNTCY Agent Directory Service | <https://docs.agntcy.org/dir/directory-cli/>；<https://github.com/agntcy/dir> | 开放标准/自托管 OCI record store，可导入 MCP Registry、MCP、A2A、agent skill；是 software/protocol，不是统一公共内容库 | AGNTCY/LF 项目，repo Apache-2.0；实例与 records 由部署者治理 | **自托管 registry 软件**。可作为未来协议适配器；未经实例 owner 授权不枚举 records |
| C27 Slack MCP-enabled apps | <https://slack.com/help/articles/52414744085139-Connect-Slackbot-to-other-apps-with-MCP> | Slack 官方帮助页当前公开列 **18 个 MCP-enabled apps**；是 Slack Marketplace/产品连接范围，不是全网 MCP registry | Slack 官方；app publisher 独立；workspace plan/admin/OAuth 与 Marketplace 限制适用 | **有限 connector seed**。按 Slack app id + publisher + MCP relationship 建模，18 不扩成 tools/Skills |
| C28 Huawei Cloud AgentArts / Cloud Store MCP | <https://support.huaweicloud.com/productdesc-agentarts/agentarts_01_0001.html> | AgentArts 产品/官方材料指向插件与云商店精选 MCP；公开产品文档可查，未闭合匿名全量枚举契约 | 华为云官方；账号、区域、云商店与费用边界；不调用登录后接口 | **产品内市场线索**。只采公开官方详情，不能把“精选”或云商店商品当公共 MCP registry |
| C29 HubSpot Marketplace / connector ecosystem | <https://ecosystem.hubspot.com/marketplace/apps> | HubSpot 官方 app marketplace/connector 生态；不是 MCP 专门目录，动态 UI | HubSpot 官方宿主，app publisher 独立；账号/OAuth/Marketplace 条款；无匿名 MCP 全量契约 | **Connector seed**。仅当 app/publisher 一手文档明确 MCP 时建立组件关系，其余不入 MCP/Skill |

## D — 不建议自动枚举的研究源（17）

| ID | canonical URL | 类型/证据 | 边界与结论 |
| --- | --- | --- | --- |
| D01 AutomationSwitch MCP directory list | <https://automationswitch.com/mcp> | 二级元索引自称 **18 directories / 74,658+** 并由 Firecrawl weekly 更新；本身不是资源 publisher 或 registry，站点计数也已被 APITracker 等实时页面证实会漂移 | **只用于发现目录**。其候选已逐项归入 A/B/C/D；绝不把元索引中的数量相加或直接摄取条目 |
| D02 Protodex | <https://protodex.io/>；[pricing](https://protodex.io/pricing.html) | 页面自称 **26,109** 且每周从 GitHub 刷新，但高位结果包含 n8n、gemini-cli、awesome-mcp-servers、modelcontextprotocol/servers 等非单个 MCP server；公开浏览、存在付费 featured placement，目录复用许可未闭合 | **高误报/商业排序，仅人工 lead**。必须证明 manifest/transport/upstream identity 才可进入候选 |
| D03 Awesome MCP Servers | <https://github.com/punkpeye/awesome-mcp-servers>；[license](https://github.com/punkpeye/awesome-mcp-servers/blob/main/LICENSE) | 社区 awesome list，公开 README/PR 按分类枚举；2026-08-14 GitHub 快照约 92.2k stars、10,104 commits；publisher=punkpeye+contributors，列表 MIT、无需登录读取，但列表许可不覆盖上游项目 | **高价值社区 seed，但仍只找上游**。按 repo/package/endpoint 回到 publisher 证据，不能复制描述/徽章为事实 |
| D04 MCP official reference servers | <https://github.com/modelcontextprotocol/servers> | MCP 项目官方 reference examples；README 明确它们用于展示协议能力，并把 production servers 引向 registry | **不当 production catalog**。可作开发/测试样例，不能因“官方 repo”自动授予托管安装 |
| D05 Legacy AWS Labs MCP | <https://github.com/awslabs/mcp> | AWS 旧但仍维护的 MCP repo；官方已把主线指向 `aws/agent-toolkit-for-aws` | **legacy seed**。发现同一 server 时优先 A15 canonical successor，保留迁移/弃用关系而非重复建条目 |
| D06 AutoGen Gallery | <https://autogenhub.github.io/autogen/docs/Gallery/> | 社区 demo showcase，通过 `data/gallery.json`/PR 加案例；不是 component、Skill 或 MCP registry | **研究案例**。只有案例引用的一手组件可另行审查；gallery item 不入资源库 |
| D07 CrewAI Marketplace | <https://marketplace.crewai.com/> | 当前仍是 “launching soon”/提交预告面，尚无稳定公共可枚举 catalog | **等待正式上线与契约**，不制造预发布资源数 |
| D08 MCP-Atlas | <https://arxiv.org/abs/2602.00933> | 研究 dataset/benchmark，用于分析 MCP ecosystem，不是实时 publisher registry | **研究/统计用途**。论文数据快照、许可与陈旧性必须单独处理，不作为自动 discovery 主源 |
| D09 cursor.directory | <https://cursor.directory/> | 独立提示词/rules/MCP 聚合；当前核验出现 429/反爬，且类型混合 | **停止自动访问**。不绕过 429/反爬；如需条目由用户手工提供公开 URL，再回溯上游 |
| D10 Roo Code historical marketplace | [archived official repo](https://github.com/RooCodeInc/Roo-Code)；[current MCP setup docs](https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo/) | Roo Code 官方主仓库已于 **2026-05-15 archived/read-only**；当前文档只说明自行寻找并配置 MCP，没有活跃、稳定、公开授权的 marketplace 数据源；旧产品域名已转向其他产品 | **排除当前 discovery**。仅保留历史客户端兼容元数据；不得抓旧入口或把历史 issue 当活跃 catalog |
| D11 mcp-awesome | <https://mcp-awesome.com/> | 首页自称 1,200+ servers/73.1K+ stars/100% open source，但可见精选约 15 项，又跳转 D03；其 GitHub publisher 链接 404，verified/production-ready 等指标无可核验来源 | **SEO/不可审计，排除自动摄取**。robots 虽允许且 crawl-delay=1，仍不等于许可或可信 provenance；改用上游 repo |
| D12 Awesome Remote MCP Servers | <https://github.com/jaw9c/awesome-remote-mcp-servers> | 社区 remote-only 清单，公开 README 表格枚举 Name/Category/URL/Authentication/Maintainer，约 230 commits；publisher=jaw9c+contributors，MIT、无需登录读取；不是 registry，列表与上游许可分离 | **高价值 remote seed，仍不自动采信**。endpoint + publisher domain 必须一手核验，避免把 hosted proxy 当 upstream；OAuth/API-key/Open 仅作风险提示 |
| D13 AI Agents List | <https://aiagentslist.com/mcp-servers>；[about](https://aiagentslist.com/about) | 商业 agent/tool directory 的 MCP 子页自称 **593+**，支持 category/language/scope；Stackdir-built、含广告与提交入口；© All rights reserved，robots 对 AI bot 规则冲突且禁止 dashboard/admin/login/API auth/webhook | **保守地仅人工 reference**。不批量摄取；只有一手 publisher source 才能进入候选 |
| D14 MCP Servers Directory (GitHub awesome variant) | <https://github.com/wong2/awesome-mcp-servers> | 社区 awesome list/索引，可能与 D03 大量重叠；无 canonical registry 身份 | **去重后只作线索**。同 repo/endpoint 只保留 `discoveredVia`，不复制描述为事实 |
| D15 MCP Server Hub | <https://mcpserverhub.com/en/servers>；<https://github.com/mcpserverhub> | 单页公开可见约 54 个唯一详情与 39 tags，但 GitHub org 无公开成员、唯一公开 repo 只是 2024 年的 `modelcontextprotocol/servers` fork，来源/维护人不透明 | **小而旧、provenance 弱，仅人工补漏**。不使用其 Official/Community 标签；逐项回源 |
| D16 AIBase MCP | <https://mcp.aibase.com/> | 页面自称 **121,231 Services Listed**，混合 server/client、local/remote、official/unofficial；来源、开放许可与公共 API 契约未闭合，筛选总数波动且可见重复 | **多语人工线索，禁止镜像**。robots Allow 不等于复用许可；121,231 不能当唯一有效 MCP 数 |
| D17 Augment MCP Registry wrapper | <https://www.augmentcode.com/mcp/mcp-registry> | 不是 Augment 自有 registry；只是 A01 官方 `modelcontextprotocol/registry` 项目的包装详情，author/source 均指回官方 repo/registry；页面 license 标识也不能替代上游 | **伪独立源，去重排除**。所有 identity/provenance 回归 A01，不增加一条来源或资源 |

## AutomationSwitch 元索引候选的独立归并

AutomationSwitch 只承担“目录指路牌”角色。其可辨认候选按本次独立核验归并如下；重复项不增加本稿总数：

| 候选 | 归并 | 理由 |
| --- | --- | --- |
| Official MCP Registry / GitHub MCP / Docker / Smithery / Glama / mcp.so / mcp.directory / MCPMarket / PulseMCP / Protodex | A01/A02/A03/B01–B06/D02 | 已直接核验 canonical source；以直接来源为准 |
| APITracker | B13 | 109 项公开二级目录；robots 禁 `/api/` 和多种 AI crawler，只做公开页人工 seed |
| ClaudeMarketplaces.com | B14 | 独立第三方跨生态目录，非 Anthropic；API 禁止，逐项回 GitHub/publisher |
| ClawHub/OpenClaw | A17（仅 Skill/Plugin） | 官方 public registry，但不是 MCP registry；必须分 channel |
| Roo Code marketplace | D10 | 主仓库已归档，当前没有稳定官方公开 marketplace feed |
| `registry.mcpservers.org` | B11 | 官方 registry 的第三方 browser，identity 回归 A01 |
| `mcp-marketplace.io` / `mcpmarkets.com` / LobeHub MCP / MCP Server Finder | B07–B10 | 可公开浏览但非 publisher；仅补漏 |
| `cursor.directory` | D09 | 类型混合且 429；不绕过反爬 |
| punkpeye / Awesome Remote / mcp-awesome / wong2 awesome | D03/D11/D12/D14 | 前两者是高价值社区 seed，但按本稿分级仍属 awesome list；列表许可不覆盖上游，后两者 provenance 更弱 |
| AI Agents List / MCP Server Hub / AIBase | D13/D15/D16 | 可公开浏览但分别存在广义商业目录、维护不透明、超大重复/许可不明问题；仅人工 reference |
| Augment MCP Registry wrapper | D17 | 只是 A01 的包装详情，不是独立目录 |
| 广义 AI agent/tool directories | D13 | 不是 MCP/Skill registry，默认排除自动摄取 |

## AI Hub canonical identity 与去重规则

1. **先判类型，再去重。** `MCP server`、`remote provider connector`、`Skill`、`IDE/plugin bundle`、`Agent`、`Workflow/template`、`Tool/action`、`registry software` 是不同类型；不得因为同一页面混排就塞进同一 channel。
2. **Registry MCP：** 优先 `registry namespace/name + version`；保留版本/withdrawn 状态。package identity=`ecosystem + package name + exact version`，remote identity=`publisher-controlled normalized endpoint origin/path`。
3. **Git repo：** `normalized host/owner/repo + subpath + pinned tag/commit`；fork、mirror、rename 记录 lineage，不按标题重复建资源。
4. **Marketplace plugin/bundle：** `marketplace host + publisher + immutable item/extension id + version`。拆出 Skills/MCP 等 components，但保留 `bundledBy`，不能把 commands/hooks/themes 算作 Skill 或 MCP。
5. **超级 provider：** Composio、Pipedream、Zapier、Make、n8n、Apify、AWS managed MCP 等默认各建一个 Provider/MCP/Plugin，再用 `capabilityTargets[]` 关联 apps/services/actions/Actors；只有目标自身拥有独立 publisher、canonical repo/package/endpoint 时才升格。
6. **同一上游多目录命中：** 一个 `Resource`，追加 `discoveredVia[]` 与各自 `observedAt`；官方 registry/publisher source 优先，聚合描述、score、verified/official/featured badge 均不进入权威事实字段。
7. **publisher 与 host 分离。** `publisher` 必须能回到受控域名/namespace/repo；Smithery/Glama/Postman/Docker 等可能只是 host/curator。remote proxy/managed hosting 不能冒充原作者 endpoint。
8. **license 不继承。** Registry/index repo 的 CC0/MIT/Apache-2.0 只覆盖其自身明示范围；每个 package、container、Skill 内容、文档、logo、远程服务条款分别核验。
9. **私有 catalog 隔离。** 组织实例、租户、workspace、IAM、OAuth、API key 后的资源不进入公共 AI Hub catalog；若用户日后显式连接，只在其本地/组织 scope 保存引用与最小 metadata。

## 推荐首批低频公共样本

这是一份**研究采样计划**，不是 catalog 变更授权：

| 顺序 | 来源 | 首轮上限 | 只读字段/目的 |
| --- | --- | ---: | --- |
| 1 | Official MCP Registry A01 | 10 | name/version/status、package/remote、repository、publisher namespace；验证 canonical identity |
| 2 | Docker A03 | 10 | server id、version/image digest、provenance/SBOM link、upstream repo；验证容器固定性 |
| 3 | ToolHive Catalog A11 | 10 | manifest、repo、transport、version、license link；验证 Git 增量方案 |
| 4 | Google supported products A14 | 5 | product、official endpoint、auth/IAM docs；建立 provider seed |
| 5 | Postman A09 | 5 | workspace/collection、publisher、upstream link；验证 curator→publisher 分离 |
| 6 | Claude Connectors A05 | 5 | publisher、remote endpoint/docs、OAuth/privacy links；验证 remote connector contract |
| 7 | Gemini CLI Gallery A07 | 5 | repo、manifest id、release/commit、component types；验证 bundle 拆分 |
| 8 | ModelScope A08 | 5 | 仅公开详情页的 namespace/server、repo/package、transport；不调用 token API |
| 9 | Higress A10 / Cline A12 | 各 5 | 只取有一手 repo/package/endpoint 的条目；验证中文与 IDE host 补充 |
| 10 | ClawHub A17 | 5 | 仅取公开 Skill/Plugin feed 的 canonical id、version、source repo；不进入 MCP channel |
| 11 | Smithery/Glama/mcp.so/mcp.directory/PulseMCP | 各最多 5 | 只查 A 类未命中的 upstream lead；不采 badge/score/描述为事实 |

采样门禁：同 host 并发 1，间隔至少 1.5 秒；优先 documented public API/Git raw，其次公开 HTML；限制响应体与分页；遇 401/403/429/验证码/robots 禁止即停；不登录、不带 token/cookie、不探测私有 API；每条必须保存 canonical URL、publisher source、license URL、observedAt、discoveredVia 与证据缺口。第一轮最多约 100 条候选，完成 canonical merge 后再决定是否扩展。

## 不可误读的边界

- 本稿没有证明任何候选“安全、官方可托管安装、可商用或可自动更新”。
- 页面总量是站点自称，尤其 Glama、PulseMCP、Protodex 等同日波动显著；不同站点高度重叠，不能求和。
- 本稿没有调用 ModelScope/Smithery/云平台等需要 token 的 API，没有打开任何组织 registry，也没有下载/执行 server/plugin。
- Agent/Workflow/Tool/Actor/app/action marketplace 仅是关系线索；没有 MCP manifest、transport 或 publisher-controlled endpoint/repo/package 证据时，不得创建 MCP/Skill 资源。
- 后续若实施 discovery，所有新条目先保持 `discovered-unreviewed`，且与安装、凭据收集、OAuth、执行、发布、封包完全分离。
