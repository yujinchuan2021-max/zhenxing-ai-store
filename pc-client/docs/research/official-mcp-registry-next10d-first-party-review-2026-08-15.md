# Official MCP Registry 下一页 10 条第一方复核（next10d，2026-08-15）

> 状态：只读研究冻结稿。它不是 catalog candidate、安装说明、连接配置、安全认证或发布许可。

## 结论

- 本轮从冻结游标继续，精确复核 **10 个不同 Registry identity**。
- 裁决算术：**0 `ready-link-only` + 10 `deferred` + 0 `blocked` + 0 `duplicate` = 10**。
- 十条都属于 `ai.agentutility` namespace，并指向同一个 `rooz21/x402` monorepo 的不同 package subfolder；它们仍有不同 server name、版本、包路径和工具面，不能合并成一条 Resource。
- AgentUtility 第一方网站为十条分别提供 cluster 页面和 MCP package 页面，并统一说明当前形态是本机 stdio shim、按调用以 Base 上 USDC 结算。第一方文档明确点名 Claude Desktop、Claude Code、Cursor、Codex 与 Replit Agent。
- 但本轮观察时，共享 GitHub repository 返回 404；十个由第一方页面链接的 npm package 页面均返回 403，按边界没有重试。逐包固定源码、许可证、Registry 版本与当前 package 的谱系因而无法闭合。
- 第一方站点在本轮有限页面内未呈现可核的法律运营实体、服务条款、隐私/数据保留政策或钱包材料轮换与止付流程；站点对当前 stdio package 数量也存在 `17` 与 `8` 的页面漂移。因此十条全部保留为 `deferred`，不生成 candidate。

## 唯一官方列表请求

- 观测时间：`2026-08-14T21:28:58.196Z`（北京时间 `2026-08-15T05:28:58.196+08:00`）。
- 精确查询：[Official Registry public read](https://registry.modelcontextprotocol.io/v0.1/servers?limit=10&version=latest&cursor=ai.agenttrust%2Fmcp-server%3A1.1.1)。
- 输入游标：`ai.agenttrust/mcp-server:1.1.1`。
- 返回：HTTP 200、exact 10、10/10 identity unique。
- 输出游标：`ai.agentutility/mcp-model-router:0.1.1`。
- 只执行这一次 Registry 匿名列表 GET：manual redirect、固定 host/path/query、HTTP 200、JSON content type、2 MB 流式上限；没有 401/403/429、重试、缓存旁路或第二次 Registry 请求。原始响应只在内存解析，未落盘；输出前丢弃 package/remote 等执行字段。
- Registry namespace verification 证明相应 GitHub 账户或域名控制，不审计 server 代码或工具安全；`active` 与 `latest` 也不是 AI Hub 安全认证。[Registry trust and security](https://modelcontextprotocol.io/registry/about#trust-and-security)；[Registry versioning](https://modelcontextprotocol.io/registry/versioning)。

## 共同第一方边界

### 身份与分型

- AgentUtility 首页把自身描述为 Base/USDC 上的 x402 按调用服务，并把 AgentOps、Bestiary、BrowserWorkflow、Compose、EdgeFinance、EdgeMarket、Locale、Matchpoint、MediaKit 与 ModelRouter 列为不同 cluster。[AgentUtility](https://agentutility.ai/)。
- MCP 总览把每个 live cluster 映射为独立的 `@agentutility/mcp-*` stdio server；每个 server 是同一批远端付费工具的本机 shim。[MCP overview](https://agentutility.ai/mcp/)；[AgentUtility docs](https://agentutility.ai/docs/)。
- 十条 Registry record 都指向 `https://github.com/rooz21/x402`，但 subfolder 分别为 `packages/<exact package name>`。共享 repo 是 provenance 关系，不是合并 canonical identity 的依据。

### 连接、认证和财务副作用

- 第一方文档说明不需要 AgentUtility signup、API key 或 dashboard；用户在自己的 MCP host 中持有本地 EVM 私钥和 Base USDC。每次工具调用都会签署支付授权并在链上结算，发布方声称不托管 key、余额或 session。[AgentUtility docs](https://agentutility.ai/docs/)；[MCP overview](https://agentutility.ai/mcp/)。
- 这不是“无凭据”：钱包私钥是高敏财务凭据。每次成功调用都可能产生不可逆资金副作用；停止使用本地 server 不等于撤销已经签署或结算的支付。
- 本轮没有找到发布方提供的私钥轮换、止付、退款、误付争议或失窃处置闭环。不能把“发布方不托管 key”写成完整撤权方案。
- AI Hub credential policy 固定为 **never-collect**：不请求、收集、保存、代理、验证或转发钱包私钥、签名、USDC、支付授权或任何其他认证材料。

### Exact CompatibleHost 证据

- 每一条独立 MCP package 页面都分别给出 Claude Desktop 与 Cursor 的使用面，因此可映射 `claude-desktop`、`cursor-desktop`。
- 组合级第一方 docs 明确说这些 cluster MCP packages 面向 Claude Code、Cursor、Codex 与 Replit Agent，因此还可映射 `claude-code`、`codex-cli`、`replit-agent`。[AgentUtility docs](https://agentutility.ai/docs/#ii-mcp--one-install-per-live-cluster)。
- 五个 ID 均已在最新本地 base 中核为 `enabled=true`、`directoryKind="ai-tool"`。这只是宿主兼容事实，不授权安装、运行、支付或建 connection edge。
- 第一方 [remote status](https://agentutility.ai/mcp/remote/) 明确 hosted remote MCP 仍保留给未来 v2；当前不得把任何十条投影为 remote connection。

### 版本、许可和站点漂移

- Registry 版本只冻结本轮 publication。AgentUtility 页面是滚动内容，没有给这十个版本对应的固定 source commit。
- 本轮观察到共享 repo 及其十个 package subfolder 均返回 404；由各第一方 MCP 页面链接的 npm package 页面均返回 403。404/403 是本轮观测，不冒充永久状态，也没有绕过或重试。
- 因此逐包 source license 未闭合；不能从另一个 AgentUtility package、共同 namespace 或 monorepo 假定十包同一许可证。托管 x402 服务也不会自动继承本地 package license。
- MCP 总览称当前有 17 个 cluster servers，remote status 页面却称当前可用 8 个 stdio packages；MediaKit 的 cluster 页面写 50 endpoints，而 MCP 页面写 67 tools。它们是当前性漂移证据，不应自行选择其一作为稳定总量。

## 精确 10 条裁决

所有行的 exact existing CompatibleHost IDs 均为：`claude-desktop`, `claude-code`, `cursor-desktop`, `codex-cli`, `replit-agent`。每行仍保留独立 identity；共同 hosts 不产生重复卡片或 connection edge。

| # | Registry identity | 第一方 package / 工具面 | 版本与许可 | 主要输入、输出和风险 | 裁决 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `ai.agentutility/mcp-agentops@0.1.1` | [AgentOps MCP](https://agentutility.ai/mcp/agentops/)；4 tools | Registry `0.1.1`；滚动服务；source/license 未闭合 | 用户可提交 agent execution trace、tool manifest 与 eval/task 内容，返回 trace brief、eval draft、MCP tool 风险评分和调用差异；可能含内部工具、权限与运行证据，且每次调用发生 USDC 支付；`high` | `deferred` |
| 2 | `ai.agentutility/mcp-bestiary@0.1.3` | [Bestiary MCP](https://agentutility.ai/mcp/bestiary/)；6 tools | Registry `0.1.3`；滚动服务；source/license 未闭合 | 读取或生成 creature lore、比较、识别、stat block 与 hosted image；输入可能涉及受版权保护角色/作品，输出可能生成媒体，且调用付费；`high` | `deferred` |
| 3 | `ai.agentutility/mcp-browser-workflow@0.1.1` | [BrowserWorkflow MCP](https://agentutility.ai/mcp/browser-workflow/)；3 tools | Registry `0.1.1`；滚动服务；source/license 未闭合 | 用户可提交 screenshots、Playwright traces、DOM snapshots、HTML forms 与 task paths，返回 workflow memory、DOM diff 和 form-fill plan；可能暴露页面内容、表单与操作轨迹，且调用付费；`high` | `deferred` |
| 4 | `ai.agentutility/mcp-compose@0.13.0` | [Compose MCP](https://agentutility.ai/mcp/compose/)；133 tools | Registry `0.13.0`；滚动服务；source/license 未闭合 | 单次付费可组合多个 enrichment、搜索、文档、地址、研究、内容生成与风险工具；输入面跨 PII、URL、文件和业务材料，子处理链与保留边界未闭合；`high` | `deferred` |
| 5 | `ai.agentutility/mcp-edge-finance@0.18.8` | [EdgeFinance MCP](https://agentutility.ai/mcp/edge-finance/)；91 tools | Registry `0.18.8`；滚动服务；source/license 未闭合 | 读取 SEC/FEC/FDA、市场、预测市场与金融数据并运行估值、贷款和风险计算；本轮未见交易执行工具，但输出可影响投资/信贷判断且调用付费；`high` | `deferred` |
| 6 | `ai.agentutility/mcp-edge-market@0.15.6` | [EdgeMarket MCP](https://agentutility.ai/mcp/edge-market/)；64 tools | Registry `0.15.6`；滚动服务；source/license 未闭合 | 读取链上账户、token、DEX、NFT、DAO、Safe 与市场数据，并提供模拟/风险/解码结果；本轮未见替用户提交链上交易，但每次工具调用本身会签署 USDC 支付；`high` | `deferred` |
| 7 | `ai.agentutility/mcp-locale@0.8.7` | [Locale MCP](https://agentutility.ai/mcp/locale/)；40 tools | Registry `0.8.7`；滚动服务；source/license 未闭合 | 处理地址、地理位置、天气、航班、许可、房产、车辆与 card BIN 等数据；可能包含位置、住址和支付卡前缀等敏感上下文，且调用付费；`high` | `deferred` |
| 8 | `ai.agentutility/mcp-matchpoint@0.1.4` | [Matchpoint MCP](https://agentutility.ai/mcp/matchpoint/)；7 tools | Registry `0.1.4`；滚动服务；source/license 未闭合 | 用户可提交公司名、个人姓名、地址、电子邮箱与电话号码以生成标准化 match key 或相似度；PII 处理、保留与删除边界未披露，且调用付费；`high` | `deferred` |
| 9 | `ai.agentutility/mcp-mediakit@0.11.9` | [MediaKit MCP](https://agentutility.ai/mcp/mediakit/)；页面当前列 67 tools | Registry `0.11.9`；滚动服务；source/license 未闭合 | 处理 PDF、图片、视频、音频、Office、OCR、转写、水印和格式转换；文件内容、临时副本、hosted output 与删除/保留时序未闭合，且调用付费；`high` | `deferred` |
| 10 | `ai.agentutility/mcp-model-router@0.1.1` | [ModelRouter MCP](https://agentutility.ai/mcp/model-router/)；4 tools | Registry `0.1.1`；滚动服务；source/license 未闭合 | 用户提交任务/模型需求以取得成本估算、路由建议、结构化 plan 或第三方模型结果；prompt 数据处理与下游模型边界未闭合，且调用付费；`high` | `deferred` |

## 本地结构化语义去重

- 最新 base：`docs/research/official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json`，SHA-256 `3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba`；275 Resources / 845 targets / 10 resourceConnections。
- 对 base 与 `docs/research` 共 94 份 JSON 做只读 identity-bearing 文本预筛：versioned/versionless Registry identity、package slug、规范化 `Agent Utility` publisher/name 形态、`agentutility.ai` canonical source 与 `rooz21/x402` repository 均为 0 matched files。
- 因所有结构化 exact ID、external identity、name+publisher 或 canonical source 命中都必须含至少一个上述身份字符串，本轮十条均为 `NON-HIT`，所以 `duplicate=0`。
- 同一 `ai.agentutility` namespace、同一 GitHub repository 或共同 host 集合仅是 publisher/provenance/compatibility 关系，不是 semantic duplicate。

## 为什么没有 ready

任一条要进入 link-only candidate，至少仍需同时闭合：

1. 可访问并固定到版本或 commit 的逐包 source，及其精确许可证；
2. Registry version 与当前 package version 的可审谱系；
3. 发布方法律运营实体、服务条款、隐私/数据保留/删除和 subprocessors；
4. 钱包私钥轮换、误付/失窃处置、已签支付与未来调用的停止边界；
5. 解决 `17`/`8` stdio packages 与 MediaKit `50`/`67` 的页面漂移；
6. 在候选冻结时重新验证每个 exact host、版本和全部 active/history semantic identity。

缺口闭合后，仍应为十个 canonical server identity 分别建 Resource；不得把一个 publisher card、monorepo 或 MCP 总览复制为资源，也不得把 link-only 页面升级为 managed install、remote connection 或执行授权。

## 未做事项与冻结边界

- 未调用 Registry detail/private API、任何 MCP endpoint/tool、AgentUtility 付费 API、OAuth 或钱包流程。
- 未下载、安装或执行 package；未访问或保存钱包私钥、签名、支付材料、命令、参数、环境变量、headers、endpoint 或原始 Registry 响应。
- npm 403 与 GitHub 404 后没有重试、登录、绕过或调用私有 API。
- 只新增本 Markdown；未改 candidate、generator、test、active catalog、state、channel、release、App、schema、package 或 server。
- 文件按 UTF-8 无 BOM、LF 和 final newline 冻结；最终 SHA-256、bytes 与 lines 由冻结后外部计算并回传，避免文档自引用改变自身哈希。
