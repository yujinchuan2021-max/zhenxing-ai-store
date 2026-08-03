# 下一批高置信度 Agent / 开发工具调研

调研日期：2026-08-03（Asia/Shanghai）

## 结论

本轮以 `admin/data/catalog-v1.json` 的当前正式目录为去重基线：**311 个厂商、505 个一级产品、118 项生态资源**。候选名称、厂商名和主要官方域名均未作为一级产品出现在当前正式目录；`Amp` 只在既有研究文档中作为其他产品支持的客户端被提到，并没有独立产品记录。

本轮建议：

- 优先进入下一轮录入审查的 **12 个一级产品候选**：Amp、Augment Code、Auggie CLI、Qodo、CodeRabbit、Greptile、GitHub Spark、LangSmith、Langfuse、Promptfoo、Daytona Sandboxes、E2B Sandboxes。
- 另保留 **4 个边界清楚但优先级稍低的候选**：JetBrains Junie、Braintrust、AgentOps、Helicone。其中 Junie 应作为 JetBrains IDE 的官方插件资源，不应伪装成独立 Windows 客户端。
- 本文的“热门”只表示产品具有持续更新的一方官网、文档或仓库，并覆盖当前 Agent / AI 开发主流工作面；由于本轮禁止采用第三方榜单，本文**不是市场份额或热度排名**。
- 本文只做产品身份、厂商归属、交付面与边界研究，不修改正式目录、客户端模块、安装白名单或执行命令。

## 录入硬边界

1. Web 控制台、Git 提供商应用、自托管服务和本地 Web UI 都不是 Windows 桌面产品；只能使用固定 Web / 教程模块。
2. IDE 插件必须挂在明确的宿主 IDE 或产品资源下，不能因为宿主支持 Windows 就标成独立 Windows 客户端。
3. CLI 候选只代表官方存在命令行交付面，不代表已经通过 AI Hub 的安装、权限、升级、卸载和真实 Windows 验收。
4. WSL 交付必须明确写成 WSL，不得标成原生 Windows。官方未明确声明 Windows 支持时，不根据 npm、Node.js 或 PowerShell 的存在自行推断。
5. 会读取代码、连接代码仓库、执行命令或管理云端沙箱的产品必须提示权限、代码外发、凭据和费用边界；后台不能借此获得任意命令执行权。
6. 同一商业产品的 Web、Git 集成、IDE 插件和 CLI 若共享账号、计费和产品身份，应优先放在一张一级产品卡下，具体交付面作为子入口或资源；只有官方明确区分产品身份时才拆卡。

## P0：建议优先复核的一级产品候选

| 优先级 | 厂商 / 产品 | 官方交付面 | 产品边界与建议建模 | 一手官方来源 |
| --- | --- | --- | --- | --- |
| 1 | **Amp Inc. / Amp** | CLI、Web 远程控制、IDE 集成；官方支持说明将 Windows 列为 WSL | 独立的编码 Agent，不再归属 Sourcegraph。建议一张 `Amp` 产品卡，以 CLI 为主入口、Web 为辅助入口；当前不要标成原生 Windows。官方手册同时给出 PowerShell 安装段落和“Windows via WSL”的支持声明，录入前应以 WSL 口径保守处理。 | [Amp Owner's Manual](https://ampcode.com/manual)；[Sourcegraph 与 Amp 成为独立公司的官方公告](https://sourcegraph.com/blog/why-sourcegraph-and-amp-are-becoming-independent-companies) |
| 2 | **Augment Code / Augment Code** | VS Code、JetBrains IDE 插件 | 面向团队代码库上下文的 AI 开发产品。它不是独立桌面 IDE；建议一级产品使用 Web / 开发工具说明模块，VS Code 与 JetBrains 插件作为子资源，不建立假的 Windows 桌面卡。 | [Augment Quickstart](https://docs.augmentcode.com/quickstart) |
| 3 | **Augment Code / Auggie CLI** | CLI；官方列出 macOS、Linux、Windows WSL；当前为 beta | 与 Augment IDE 插件共享厂商与上下文能力，但官方将其作为明确的终端产品交付。建议单独建立 CLI 产品卡，描述中标注 beta、Node.js 22+、Windows 仅 WSL；不直接加入自动安装白名单。 | [Auggie CLI 概览](https://docs.augmentcode.com/cli/overview)；[官方安装与系统要求](https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli) |
| 4 | **Qodo / Qodo** | Web / Git 提供商集成、IDE 插件、CLI、Agent Skills | 当前产品重点是 AI 代码审查与治理。建议只建一张 `Qodo` 一级产品卡，Git 集成、IDE、CLI 和 Skills 为交付面；不要再创建 `Qodo Gen`、`Qodo Merge` 或 `PR-Agent` 重复一级卡。官方文档说明 Qodo v2 已统一代码审查体验，IDE 插件也从代码生成转向本地审查。 | [Qodo 当前文档首页](https://docs.qodo.ai/)；[Qodo v2 代码审查边界](https://docs.qodo.ai/code-review)；[Qodo IDE 插件](https://docs.qodo.ai/qodo-ide) |
| 5 | **CodeRabbit / CodeRabbit Code Review** | Web / Git 提供商应用、VS Code 系 IDE 扩展、CLI；Windows CLI 通过 WSL | 一张代码审查产品卡覆盖 PR、IDE 和 CLI，避免拆出三个重复产品。官方另有 CodeRabbit Agent for Slack，属于不同工作面且单独计费，本候选不把它合并进代码审查卡。Windows 只明确核验到 WSL CLI。 | [CodeRabbit 当前产品与交付面](https://docs.coderabbit.ai/)；[IDE 与 CLI 边界](https://docs.coderabbit.ai/overview/ide-cli-review)；[Windows WSL 指南](https://docs.coderabbit.ai/cli/wsl-windows) |
| 6 | **Greptile / Greptile** | GitHub / GitLab 云服务、自托管服务、CLI | AI 代码审查 Agent；建议一张 Web / 开发平台产品卡，CLI 为同产品入口。官方 CLI 页面未在本轮检索结果中明确列出 Windows 支持，因此不能标成 Windows CLI；自托管 Docker / Kubernetes 也不能标成桌面产品。 | [Greptile 产品与部署边界](https://www.greptile.com/docs/introduction)；[Greptile CLI](https://www.greptile.com/cli) |
| 7 | **GitHub / GitHub Spark** | Web | 复用现有 GitHub 厂商。Spark 是自然语言构建、编辑和发布全栈智能应用的独立 Web 产品面，不等同于 GitHub Copilot IDE 助手；当前为 public preview，并受 Copilot Pro+ / Enterprise 方案约束。 | [GitHub Spark 产品页](https://github.com/features/spark)；[GitHub 官方教程与 preview 状态](https://docs.github.com/en/copilot/tutorials/build-apps-with-spark) |
| 8 | **LangChain / LangSmith** | 托管 Web 平台、API / SDK；企业自托管 | 复用现有 LangChain 厂商。LangSmith 是 Agent / LLM 应用的可观测、评估、提示工程和部署平台，不是 LangChain 框架本身，也不是 Windows 客户端。建议独立 Web 产品卡；企业自托管只给官方教程入口。 | [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation)；[LangSmith 自托管边界](https://docs.langchain.com/langsmith/self-hosted) |
| 9 | **ClickHouse / Langfuse** | Langfuse Cloud、Web UI、自托管、CLI、API / SDK | 当前厂商归属应为 ClickHouse；Langfuse 品牌和产品继续独立运行。建议一张一级产品卡，Cloud / 自托管 / CLI 为子入口，不把 CLI 或 MCP 另建一级产品。自托管是服务栈，不是 Windows 桌面应用。 | [ClickHouse 收购公告](https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability)；[Langfuse 产品与当前归属](https://langfuse.com/press/press)；[Langfuse CLI](https://langfuse.com/docs/api-and-data-platform/features/cli)；[自托管说明](https://langfuse.com/faq/all/self-hosting-langfuse) |
| 10 | **Promptfoo, Inc. / Promptfoo** | CLI、本地 Web Viewer、云端 / 自托管服务；官方明确支持 Windows CLI | 面向提示词、模型与 Agent 的评估和红队测试工具。建议以 CLI 产品卡为主，本地 Web Viewer 是同一 CLI 启动的查看界面，不另建桌面产品；云端与自托管为同产品服务面。Windows 有官方路径和客户端要求，但仍需单独完成 AI Hub 安装与权限审核。 | [Promptfoo 安装与 Windows 路径](https://www.promptfoo.dev/docs/installation/)；[Web Viewer](https://www.promptfoo.dev/docs/usage/web-ui/)；[自托管与 Windows 客户端要求](https://www.promptfoo.dev/docs/usage/self-hosting/) |
| 11 | **Daytona / Daytona Sandboxes** | 云 API / SDK、Web 控制台、原生 Windows / macOS / Linux CLI、MCP | 面向 AI Agent 运行生成代码的隔离云沙箱基础设施，不是编码 Agent 本身。建议一张开发平台产品卡，CLI 为管理入口；官方明确提供 Windows CLI，但其安装脚本会获取并执行远程内容，不能直接复制进 AI Hub 白名单，需另做供应链与生命周期审计。 | [Daytona 产品边界](https://www.daytona.io/docs/en/)；[官方 Windows CLI](https://www.daytona.io/docs/en/tools/cli/)；[Daytona MCP](https://www.daytona.io/docs/mcp) |
| 12 | **E2B / E2B Sandboxes** | 云 API / SDK、CLI | 为 Agent 提供隔离 Linux VM、模板和代码执行环境；不是本地 Windows 沙箱或桌面 Agent。建议一张开发平台产品卡，以 Web / 官方文档入口为主，CLI 为子入口。官方文档给出 npm CLI，但本轮没有找到明确的 Windows 支持声明，因此不标 Windows。 | [E2B 产品与沙箱边界](https://www.e2b.dev/docs)；[E2B CLI](https://e2b.dev/docs/cli) |

## P1：边界明确、可后续录入的候选

| 厂商 / 产品 | 官方交付面 | 建议与限制 | 一手官方来源 |
| --- | --- | --- | --- |
| **JetBrains / Junie** | JetBrains IDE / Android Studio 插件 | 高置信产品，但官方定义是安装在宿主 IDE 内的编码 Agent。建议作为 JetBrains IDE 的官方插件或生态资源，而不是独立 Windows 桌面产品。Marketplace 还提示部分远程开发能力在 Windows 未支持，不能用宿主 IDE 的 Windows 支持替代 Junie 能力核验。 | [Junie 产品页](https://www.jetbrains.com/junie/)；[Junie 官方 Marketplace](https://plugins.jetbrains.com/plugin/26104-junie-the-ai-coding-agent-by-jetbrains) |
| **Braintrust / Braintrust** | Web 平台、SDK、CLI、CI | 面向 Agent / AI 应用的评估与可观测平台，适合作为 Web 开发工具。当前 `bt eval` 官方 CLI 明确仅支持 macOS 和 Linux，因此不能建立 Windows CLI 入口；Windows 用户可使用 Web，但 WSL 兼容性不能自行推断。 | [Braintrust 评估工作流](https://www.braintrust.dev/docs/evaluate/run-evaluations)；[`bt eval` 平台限制](https://www.braintrust.dev/docs/reference/cli/eval) |
| **AgentOps / AgentOps** | Web Dashboard、Python 与 TypeScript / JavaScript SDK | Agent 测试、调试和可观测平台；没有独立 Windows 桌面交付证据。建议 Web 产品卡，SDK 与框架集成作为教程 / 资源。 | [AgentOps 官方介绍](https://docs.agentops.ai/v1/introduction) |
| **Helicone / Helicone** | Web 平台、AI Gateway、SDK / API、自托管 | LLM / Agent 网关、路由与可观测平台；不是最终用户 Agent，也不是 Windows 客户端。适合开发平台 Web 卡，Gateway 和自托管只作为能力与教程入口。 | [Helicone 平台概览](https://docs.helicone.ai/getting-started/platform-overview)；[Agent 监控指南](https://docs.helicone.ai/guides/cookbooks/ai-agents) |

## 关键厂商归属与去重说明

### Amp 不再归属 Sourcegraph

Sourcegraph 于 2025-12-02 官方宣布 Sourcegraph 与 Amp 成为两个独立公司，Amp 团队成立 Amp Inc.。因此新目录应建立 **Amp Inc.** 厂商，不应把 Amp 作为 Sourcegraph 子产品，也不应因为既有文档写过 “Sourcegraph Amp” 就沿用旧归属。[官方公告](https://sourcegraph.com/blog/why-sourcegraph-and-amp-are-becoming-independent-companies)

### Langfuse 当前归属 ClickHouse

ClickHouse 于 2026-01-16 官方宣布收购 Langfuse；Langfuse 官方同时说明 Cloud、开源与自托管产品继续运行。因此应复用或新建 **ClickHouse** 厂商，在其下保留 `Langfuse` 品牌产品，不再创建独立的旧所有者厂商。[ClickHouse 公告](https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability)；[Langfuse 公告](https://langfuse.com/blog/joining-clickhouse)

### Qodo、CodeRabbit 与 Greptile 不按每个入口拆卡

- Qodo 当前官方文档将核心产品统一为代码审查和治理平台；历史名称与旧产品面只保留作搜索别名。
- CodeRabbit 的 PR、IDE 与 CLI 审查共享产品身份；CodeRabbit Agent for Slack 是另一个单独计费的工作面，不应在本轮混入。
- Greptile 的云端 Git 应用、自托管部署与 CLI 都服务同一代码审查产品；不要把 Docker / Kubernetes 部署写成 Windows 客户端。

## 本轮明确不纳入

| 项目 | 结论 | 官方证据 |
| --- | --- | --- |
| **Firebase Studio** | 不作为新用户候选。官方已停止新用户注册和新工作区创建，并提供迁移说明；现有工作区仍可使用不等于适合目录新增。 | [Firebase Studio 当前状态](https://firebase.google.com/docs/studio)；[迁移说明](https://firebase.google.com/docs/studio/migrating-project) |
| **Amazon Q Developer** | 当前目录已有 Kiro IDE 与 Kiro CLI，既有研究也已记录 Amazon Q Developer 向 Kiro 的迁移 / 停止支持边界；不建立重复产品。 | [AWS 迁移文档](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/upgrade-to-kiro.html)；[AWS 停止支持公告](https://aws.amazon.com/blogs/devops/amazon-q-developer-end-of-support-announcement/) |
| **Sourcegraph Amp** | 这是过时归属写法。产品应归 Amp Inc.，不在 Sourcegraph 下重复创建。 | [Sourcegraph 与 Amp 独立公告](https://sourcegraph.com/blog/why-sourcegraph-and-amp-are-becoming-independent-companies) |
| **Junie Windows Desktop** | 不存在此独立产品边界；Junie 是 JetBrains IDE 插件。 | [Junie 产品页](https://www.jetbrains.com/junie/) |
| **Auggie / CodeRabbit 原生 Windows CLI** | 官方当前明确写的是 Windows WSL，不能标成原生 Windows。 | [Auggie 系统要求](https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli)；[CodeRabbit WSL 指南](https://docs.coderabbit.ai/cli/wsl-windows) |
| **Braintrust Windows CLI** | 官方当前明确 `bt eval` 仅支持 macOS 与 Linux。 | [`bt eval` CLI 参考](https://www.braintrust.dev/docs/reference/cli/eval) |

## 建议的下一步录入顺序

1. 先录入无需本地执行的 Web 产品：GitHub Spark、Qodo、CodeRabbit、Greptile、LangSmith、Langfuse。
2. 再录入只给官方说明、暂不自动安装的 CLI：Amp、Auggie CLI、Promptfoo、Daytona、E2B。
3. Augment Code 的 IDE 插件、Junie、Langfuse CLI / MCP / Skills、Daytona MCP 进入对应产品的资源或子入口，不增加一级产品数量。
4. 每个代码仓库类产品在文案中明确：连接仓库可能授予读取代码、PR、Issue、组织信息或写入评论 / 提交的权限；具体权限必须由用户在厂商授权页确认。
5. 每个 CLI / 沙箱类产品在进入受管安装前，分别完成官方包身份、版本来源、Windows / WSL、登录、凭据、遥测、自动更新、命令执行、升级和卸载审计；本报告不构成批准。

## 录入前验收清单

- 正式目录新增产品名与规范化 URL 不和现有 505 个产品重复。
- Amp 厂商归属为 Amp Inc.；Langfuse 归属 ClickHouse；历史名称只作为搜索别名。
- GitHub Spark 明确标注 public preview 与方案限制；Auggie 明确标注 beta。
- Auggie、CodeRabbit 只写 Windows WSL；Braintrust CLI 不写 Windows；Greptile、E2B 不推断 Windows。
- Junie、Augment IDE 扩展以及 MCP / Skills 不被计为独立 Windows 桌面产品。
- 自托管 Docker / Kubernetes / API 服务不出现“安装到 Windows”“已安装”“卸载”或环境探测状态。
- 本轮不新增任何 EXE / MSI / MSIX 直链、任意 Shell / PowerShell 命令、安装适配器或客户端执行权限。
