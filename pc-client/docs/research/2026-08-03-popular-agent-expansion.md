# 热门 Agent 产品持续扩充审查

日期：2026-08-03

## 结论

- 在上一版 238 个厂商、408 个一级产品的基础上，本轮新增 44 个厂商和 62 个产品，目录达到 282 个厂商、470 个一级产品。
- “hermas” 按正确产品名 `Hermes` 复核；目录原有 Nous Research 的 Hermes Desktop 与 Hermes Agent，不重复创建错误拼写记录。
- 产品按真实交付形态拆分：可视化桌面产品、Web 服务、CLI、框架/自托管项目各用固定模块；没有把 GitHub 项目、Web 服务或 Docker 服务伪装成 Windows 客户端。
- 后台仍只下发厂商资料、文案、官方入口和固定模块参数；本轮没有新增任意命令、安装包直链或本地执行权限。

## 核验方法

1. 使用厂商官网、官方文档、官方 GitHub 组织或仓库确认产品身份与当前状态。
2. 对热门 Agent 主题结果做人工去重，排除列表、教程文章、个人复刻、已归档或已停止服务的项目。
3. 将同一可视化产品的官网、Web、Windows 和教程入口合并到一张产品卡；CLI 保持独立产品，避免用户误认为它是图形界面。
4. 只有官方明确提供 Windows 图形产品时才使用 `desktop-official`；它只打开官方获取页，不自动下载或运行安装器。
5. CLI 与自托管项目本轮只使用官方说明模块，不获得客户端命令执行能力。

## 新增产品

### Windows 图形产品（4）

- 字节跳动：UI-TARS Desktop
- Opera：Opera Neon
- Letta：Letta Agent
- Rowboat Labs：Rowboat

### Web Agent 与托管平台（14）

- OpenHands Cloud、AutoGPT Platform、Browser Use Cloud、Skyvern Cloud
- Devin、Factory Droids、Kortix、Agent Neo
- Relevance AI Agents、Gumloop Agents、Bardeen、Lindy
- Activepieces、RAGFlow

### CLI 产品（23）

- Agent TARS CLI、NVIDIA NemoClaw CLI、Browser Use CLI
- OpenManus、MetaGPT CLI、OpenFang、ZeroClaw、IronClaw、nanobot、NanoClaw
- Open Interpreter CLI、Factory CLI、Kortix CLI、Aider CLI
- Continue CLI、Kilo Code CLI、mini-SWE-agent、Letta Code CLI
- Plandex CLI、Agent S CLI、PraisonAI CLI、AgenticSeek CLI、Ruflo CLI

### 框架、自托管与开发项目（21）

- DeerFlow、Google Agent Development Kit、smolagents、LangChain Deep Agents
- OpenHands Agent Canvas、Agent Zero、Skyvern 自托管版、AstrBot、LangBot
- Flowise、Langflow、Mastra、Pydantic AI、Agno AgentOS、CAMEL
- LlamaIndex Agents、Continue Agent、Kilo Code、Bytebot、VoltAgent、AgenticSeek

此外，目录中的 Amazon Strands Agents SDK 已按当前官方资料更新，没有生成第二张重复产品卡。

## 重点边界修正

- OpenHands 当前主仓库推荐 Agent Canvas；旧 Local GUI 与 CLI 已被官方文档列入 Deprecated Projects，因此不新增 `OpenHands CLI`。
- UI-TARS Desktop 是图形桌面产品，Agent TARS 是 CLI/Web UI 项目，两者分别建模。
- Skyvern 的开源形态是自托管服务及 Web UI，不建立假的 `Skyvern CLI` 产品。
- Letta Agent 的官网、Web、Windows 和教程入口合并在同一卡片；Letta Code CLI 单独展示。
- Microsoft Agent Framework 作为 AutoGen 的后继方向保留在官方生态研究中，不把维护模式的 AutoGen 伪装成新 Agent 产品。

## 未引入项

- Roo Code：官方仓库已归档，并说明服务于 2026-05-15 停止，不进入正式目录。
- AgentGPT：官方仓库已归档，不进入正式目录。
- Fellou：当前官方页面未提供足以确认可持续 Windows 交付的稳定证据，继续留在候选池。
- GitHub 上仅为 Agent 列表、论文实现、演示或个人复刻的项目：不作为独立厂商产品自动导入。

## 主要一手来源

- [OpenHands 官方仓库](https://github.com/OpenHands/OpenHands) 与 [OpenHands Quickstart](https://docs.openhands.dev/overview/quickstart)
- [UI-TARS Desktop 官方仓库](https://github.com/bytedance/UI-TARS-desktop)
- [AutoGPT 官方仓库](https://github.com/Significant-Gravitas/AutoGPT)
- [Browser Use 官方仓库](https://github.com/browser-use/browser-use)
- [Skyvern 官方仓库](https://github.com/Skyvern-AI/skyvern)
- [Agent Zero 官方仓库](https://github.com/agent0ai/agent-zero)
- [DeerFlow 官方仓库](https://github.com/bytedance/deer-flow)
- [Letta Code 官方仓库](https://github.com/letta-ai/letta-code)、[Letta Desktop](https://docs.letta.com/platform/desktop-app) 与 [Letta Web](https://docs.letta.com/platform/web-app)
- [NVIDIA NemoClaw 官方仓库](https://github.com/NVIDIA/NemoClaw)
- [Google ADK 官方仓库](https://github.com/google/adk-python)
- [Microsoft Agent Framework 官方仓库](https://github.com/microsoft/agent-framework)
- [Activepieces 官方仓库](https://github.com/activepieces/activepieces)
- [Rowboat 官方仓库](https://github.com/rowboatlabs/rowboat) 与 [官方下载页](https://www.rowboatlabs.com/downloads)
- [Ruflo 官方仓库](https://github.com/ruvnet/ruflo)
- [RAGFlow 官方仓库](https://github.com/infiniflow/ragflow)
- [Roo Code 官方仓库](https://github.com/RooCodeInc/Roo-Code)
- [AgentGPT 官方仓库](https://github.com/reworkd/AgentGPT)

## 防回退约束

- 完整性测试固定检查 282/470/118 基线与全部 62 个新增产品 ID。
- 定向测试约束 CLI、Windows、Web 和自托管模块边界，并检查 Hermes、OpenHands、UI-TARS、DeerFlow 与 Letta 的精准搜索结果。
- 明确断言 Roo Code、AgentGPT、Fellou、旧 OpenHands CLI、假 Skyvern CLI 与误建的 Strands 重复 ID 不得进入目录。
- 扩充脚本重复运行后目录与 Logo 兜底清单哈希必须保持不变。
