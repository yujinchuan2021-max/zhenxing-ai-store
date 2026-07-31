# AI 厂商、产品、Agent、CLI、Skill 与 MCP 生态首批清单

调查日期：2026-07-31（Asia/Shanghai）

## 结论先行

“收录所有 AI 厂商”不能解释为一次性列完一个永不变化的名单。AI 产品的名称、入口、客户端、CLI、安装方式和归属变化很快；本文件把“全部”定义为一个**持续维护的目录目标**，并给出首批高置信、可追溯的覆盖面。

本轮形成了三层目录：

1. 厂商与一方产品：厂商是第一层，产品及官方子产品在其下。
2. 独立 Agent 工具：按实际维护者单独建厂商，不能因为它支持 OpenAI/Claude/Qwen 就归给模型厂商。
3. Skill、MCP、插件、Powers、Custom Nodes：只挂在明确支持它们的宿主产品下，不进入主页产品流。

首批覆盖用户指定的 33 个核心厂商，并补充 GitHub、Kuaishou、Baichuan、SenseTime 及 10 个高置信独立 Agent/Agent IDE 项目。它是上线前的研究基线，不等于全部项目都已经通过 AI Hub 本地安装白名单审核。

## 1. 证据与收录规则

### 1.1 只接受的证据

- 厂商官网、官方产品页、官方帮助中心或官方开发文档。
- 厂商控制的 GitHub 组织/仓库、官方模型组织页。
- 官方 npm、PyPI、NuGet、WinGet、Microsoft Store 等包身份，并且官方文档明确引用该包。
- 官方公告可用于记录改名、迁移、下线和继任关系。
- 搜索结果、媒体、百科、聚合目录、第三方下载站不能作为归属和安装依据。

### 1.2 厂商与产品归属

- `vendor` 代表拥有、发布或明确维护产品的实体；品牌名可作展示名，但必须保留实际维护者证据。
- 一个项目支持某厂商的模型，不代表它属于该厂商。例如 OpenClaw、Cline、OpenCode 都是独立项目。
- `parentProductId` 只在官方页面明确把能力作为产品模式、子产品或同一安装体时设置。
- 同一品牌的 Web、Desktop、CLI 是不同 `product surface`，可以共享 `productFamilyId`，不能用一个 URL 覆盖所有平台。
- 模型家族只在具有用户可操作入口、官方权重或官方 API 时收录；不把每个日期版模型都铺到主页。

### 1.3 用户要求的入口优先级

对每个产品按以下顺序选择用户入口：

1. 有官方桌面客户端：产品页主入口展示桌面版，同时保留 Web 入口。
2. 无桌面客户端、有官方 CLI：主入口展示 CLI。
3. 无桌面客户端、无 CLI：展示官方 Web。
4. API、SDK、模型权重不冒充普通用户客户端；放在“开发者/本地模型”子项。

这项优先级不改变 AI Hub 既有安全边界：**图形应用只打开厂商官方分发入口；受控一键自动安装优先限于经过本地适配与审核的 CLI。**

### 1.4 类型枚举

| 类型 | 含义 |
|---|---|
| `web` | 浏览器产品或云控制台 |
| `desktop` | 官方桌面应用、IDE、浏览器或桌面启动器 |
| `cli` | 官方终端工具 |
| `agent` | 能规划并调用工具执行多步任务的产品/框架 |
| `local-model` | 官方权重、本地推理或模型管理入口 |
| `tutorial` | 只有官方安装/接入文档，AI Hub 不执行安装 |
| `skill` | `SKILL.md` 或宿主定义的可复用指令能力 |
| `mcp` | Model Context Protocol 服务或宿主 MCP 接入项 |

### 1.5 “一键安装候选”不是“已批准”

| 等级 | 目录含义 | AI Hub 行为 |
|---|---|---|
| `A` | 官方、版本化包/安装命令清楚；可进入本地适配审核 | 完成本地白名单、依赖、检测、升级、卸载和回滚测试后才可一键安装 |
| `B` | 有官方桌面分发，但应由厂商/商店掌握安装 | 一键打开官方入口，不托管、不解析、不代运行安装包 |
| `C` | Web/云服务 | 一键打开网站；可能需要用户登录、订阅或地区可用性 |
| `D` | SDK、模型、Docker 栈、需密钥/硬件或复杂配置 | 只给官方教程；不能承诺通用一键安装 |
| `X` | 下线、迁移或证据不足 | 不发布为可安装产品，保留历史/待确认记录 |

## 2. 建议的数据层级与字段

```text
vendor/{vendorId}
  products/{productId}
    surfaces/{surfaceId}             # web / desktop / cli / agent / local-model
    extensions/
      skills/{extensionId}
      mcp/{extensionId}
      plugins/{extensionId}
      powers/{extensionId}
      custom-nodes/{extensionId}
```

每个产品/扩展至少保存：

```yaml
vendorId: openai
vendorName: OpenAI
productId: openai-codex-cli
productName: Codex CLI
productFamilyId: openai-codex
parentProductId: openai-codex
type: cli
officialUrl: https://github.com/openai/codex
officialDocs: https://developers.openai.com/codex/cli/
distribution: npm:@openai/codex
platforms: [Windows, macOS, Linux]
installCandidate: A
evidenceUrls: []
status: active
uncertainty: null
lastVerifiedAt: 2026-07-31
```

扩展记录还必须包含 `targetProductId`、`sourceKind`、`publisher`、`version/ref`、`requestedPermissions`、`credentialRequirements`、`installScope`、`uninstallPlan` 和 `provenanceEvidence`。后台不能下发任意命令；它只能选择客户端内置的、版本化的安装适配器。

## 3. 首批厂商与产品清单

表中“平台”是官方产品形态，不代表本轮在所有平台做过实机验收。

### 3.1 国际通用模型、助手与开发平台

| vendorId / 厂商 | productId / 产品 | parent | 类型 | 官方入口 / 文档 | 分发与平台 | 候选 | 证据与备注 |
|---|---|---|---|---|---|---|---|
| `openai` OpenAI | `openai-chatgpt-web` ChatGPT | — | web | [ChatGPT](https://chatgpt.com/) / [帮助中心](https://help.openai.com/en/collections/3742473-chatgpt) | Web | C | 一方在线入口。 |
| `openai` | `openai-chatgpt-desktop` ChatGPT Desktop | ChatGPT | desktop | [官方下载](https://chatgpt.com/download/) / [Windows 文档](https://learn.chatgpt.com/docs/windows/windows-app) | Microsoft Store，Windows/macOS | B | 当前 Windows 主入口为 Store Product ID `9PLM9XGG6VKS`；打开官方商店入口，不托管最终包。 |
| `openai` | `openai-codex` Codex | ChatGPT | agent | [Codex](https://openai.com/codex/) / [Codex 文档](https://developers.openai.com/codex/) | Web、ChatGPT Desktop 的 Code 视图、IDE、CLI | C/A | OpenAI 说明 Codex 可跨 app、CLI、IDE 和 Web 使用；Windows 独立 Codex 已迁移进统一 ChatGPT 应用。[迁移证据](https://help.openai.com/en/articles/20001276) |
| `openai` | `openai-codex-cli` Codex CLI | Codex | cli/agent | [官方仓库](https://github.com/openai/codex) / [CLI 文档](https://developers.openai.com/codex/cli/) | 官方 npm/原生发布，Windows/macOS/Linux | A | 需要单独审核官方包、版本、登录、更新与卸载协议。 |
| `openai` | `openai-sora-retired` Sora | — | web | [OpenAI 公告](https://openai.com/index/sora-is-here/) | 历史 Web/iOS/Android | X | 官方页面明确标注 Sora 产品自 2026-04-26 起不再提供；不可按用户示例继续作为 ChatGPT 活跃子产品发布。 |
| `anthropic` Anthropic | `anthropic-claude-web` Claude | — | web | [Claude](https://claude.ai/) / [帮助中心](https://support.claude.com/) | Web | C | 活跃在线产品。 |
| `anthropic` | `anthropic-claude-desktop` Claude Desktop | Claude | desktop | [官方下载](https://claude.com/download) / [安装说明](https://support.claude.com/en/articles/10065433-install-claude-desktop) | Windows x64/arm64、macOS | B | 图形产品仅打开官方入口。 |
| `anthropic` | `anthropic-claude-code-cli` Claude Code CLI | Claude | cli/agent | [Claude Code](https://code.claude.com/docs/en/overview) / [CLI 快速开始](https://code.claude.com/docs/en/quickstart) | 官方安装器/npm，Windows/macOS/Linux | A | 官方包 `@anthropic-ai/claude-code`；登录/订阅由用户完成。 |
| `anthropic` | `anthropic-claude-code-desktop` Claude Code Desktop | Claude Desktop | desktop/agent | [官方文档](https://code.claude.com/docs/en/desktop) | Claude Desktop 的 Code tab，Windows/macOS | B | 与 Claude Desktop 共用安装体，不应重复安装。 |
| `anthropic` | `anthropic-agent-sdk` Claude Agent SDK | Claude Code | agent/tutorial | [SDK 文档](https://platform.claude.com/docs/en/agent-sdk/overview) | Python/TypeScript SDK | D | 开发库，不作为普通终端应用。 |
| `google` Google | `google-gemini-web` Gemini | — | web | [Gemini](https://gemini.google.com/) / [帮助](https://support.google.com/gemini/) | Web、移动端 | C | PC 目录使用 Web；不把移动 App 当 Windows 客户端。 |
| `google` | `google-gemini-cli` Gemini CLI | Gemini | cli/agent | [官方仓库](https://github.com/google-gemini/gemini-cli) / [文档](https://geminicli.com/docs/) | npm/原生发布，Windows/macOS/Linux | A | 官方终端 Agent，可进入本地安装适配审核。 |
| `google` | `google-jules` Jules | Gemini | web/agent | [Jules](https://jules.google/) / [文档](https://jules.google/docs/) | 云端 Web Agent | C | 云端编码 Agent，不下载到本机。 |
| `google` | `google-notebooklm` NotebookLM | — | web | [NotebookLM](https://notebooklm.google.com/) / [帮助](https://support.google.com/notebooklm/) | Web、移动端 | C | 研究/知识产品。 |
| `google` | `google-ai-studio` Google AI Studio | Gemini | web/tutorial | [AI Studio](https://aistudio.google.com/) / [Gemini API](https://ai.google.dev/gemini-api/docs) | Web/API | C | 开发者控制台；API Key 由用户管理。 |
| `microsoft` Microsoft | `microsoft-copilot` Microsoft Copilot | — | web/desktop | [Copilot](https://copilot.microsoft.com/) / [入门](https://support.microsoft.com/en-us/microsoft-copilot) | Web、Windows/Microsoft Store | B/C | 桌面入口交由 Microsoft 分发；Web 可直接打开。 |
| `microsoft` | `microsoft-copilot-studio` Copilot Studio | Copilot | web/agent | [产品页](https://www.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-studio) / [文档](https://learn.microsoft.com/en-us/microsoft-copilot-studio/) | Web SaaS | C | 低代码 Agent 构建平台。 |
| `microsoft` | `microsoft-foundry` Microsoft Foundry | — | web/agent | [产品页](https://azure.microsoft.com/en-us/products/ai-foundry/) / [文档](https://learn.microsoft.com/en-us/azure/ai-foundry/) | Azure Web/SDK/CLI | C/D | 需要 Azure 账户、订阅与资源权限。 |
| `microsoft` | `microsoft-agent-framework` Microsoft Agent Framework | Foundry | agent/tutorial | [官方概览](https://learn.microsoft.com/en-us/agent-framework/overview/) / [GitHub](https://github.com/microsoft/agent-framework) | Python/.NET/Go SDK | D | 2026 年的一方继任框架；AutoGen 已进入维护模式、Semantic Kernel 正迁移，不能把三者并列成同等新装推荐。 |
| `github` GitHub | `github-copilot` GitHub Copilot | — | desktop/tutorial | [产品页](https://github.com/features/copilot) / [文档](https://docs.github.com/en/copilot) | IDE、GitHub、移动端 | B | GitHub 是明确产品维护者，单独建 vendor，避免混入 Microsoft Copilot 产品树。 |
| `github` | `github-copilot-cli` GitHub Copilot CLI | GitHub Copilot | cli/agent | [官方文档](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-in-the-cli) | CLI，跨平台 | A | 需以当前 GitHub 官方安装文档为审核源，不能沿用旧 `gh copilot` 假设。 |
| `meta` Meta | `meta-ai-web` Meta AI | — | web | [Meta AI](https://www.meta.ai/) / [Meta AI 产品信息](https://ai.meta.com/meta-ai/) | Web、移动/社交应用 | C | PC 端使用官方 Web。 |
| `meta` | `meta-llama-models` Llama | — | local-model | [Llama](https://www.llama.com/) / [官方模型仓库](https://github.com/meta-llama/llama-models) | 权重/API/合作平台 | D | 模型下载可能需要许可接受与较大硬件；不作为普通一键应用。 |
| `meta` | `meta-llama-stack` Llama Stack | Llama | cli/agent | [官方仓库](https://github.com/meta-llama/llama-stack) / [文档](https://llama-stack.readthedocs.io/) | Python/容器/CLI | D | 属开发栈；需隔离环境与 provider 配置。 |
| `amazon` Amazon Web Services | `amazon-kiro-ide` Kiro IDE | — | desktop/agent | [Kiro](https://kiro.dev/) / [文档](https://kiro.dev/docs/) | Windows/macOS/Linux 桌面 IDE | B | 图形产品打开厂商官方下载。 |
| `amazon` | `amazon-kiro-cli` Kiro CLI | Kiro | cli/agent | [CLI 文档](https://kiro.dev/docs/cli/) / [AWS 迁移说明](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/upgrade-to-kiro.html) | CLI，跨平台 | A | Amazon Q Developer CLI 已改名/升级为 Kiro CLI；新目录优先 Kiro。 |
| `amazon` | `amazon-q-developer-transition` Amazon Q Developer | — | tutorial | [AWS 公告](https://aws.amazon.com/blogs/devops/amazon-q-developer-end-of-support-announcement/) | IDE/现有订阅 | X | 新注册已受限，IDE 插件与付费订阅计划于 2027-04-30 结束支持；作为迁移提示，不作新装主推。 |
| `amazon` | `amazon-bedrock-agents` Amazon Bedrock Agents / AgentCore | Bedrock | web/agent | [Agents](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html) / [AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/) | AWS Console/SDK/CLI | C/D | 需要 AWS 身份、区域和付费资源。 |
| `amazon` | `amazon-strands-agents` Strands Agents SDK | Bedrock | agent/tutorial | [官方仓库](https://github.com/strands-agents/sdk-python) / [文档](https://strandsagents.com/) | PyPI/TypeScript SDK | D | `pip install strands-agents` 是开发环境依赖，不应直接装进全局 Python。 |
| `xai` xAI | `xai-grok-web` Grok | — | web | [Grok](https://grok.com/) / [xAI](https://x.ai/) | Web、移动端 | C | 当前 PC 通用入口为 Web。 |
| `xai` | `xai-api` xAI API | Grok | tutorial | [官方文档](https://docs.x.ai/) / [控制台](https://console.x.ai/) | API/SDK | D | 密钥、计费和模型权限由用户管理。 |
| `mistral` Mistral AI | `mistral-vibe` Vibe | — | web/agent | [Vibe](https://chat.mistral.ai/) / [概览](https://docs.mistral.ai/vibe/overview/) | Web、移动端 | C | 2026-06-05 起 Le Chat 政名为 Vibe；保留旧名仅作搜索别名。[官方改名说明](https://help.mistral.ai/en/articles/682992-le-chat-is-now-vibe) |
| `mistral` | `mistral-vibe-code-cli` Vibe Code CLI | Vibe | cli/agent | [官方文档](https://docs.mistral.ai/vibe/code/overview) | CLI、VS Code、Web | A | CLI 可进入适配审核，VS Code 扩展作为教程/商店入口。 |
| `mistral` | `mistral-studio-api` Mistral Studio & API | — | web/tutorial | [官方文档](https://docs.mistral.ai/studio-api/overview) | Web/API | C/D | 开发者平台。 |
| `cohere` Cohere | `cohere-north` North | — | web/agent | [North](https://cohere.com/north) / [Cohere 文档](https://docs.cohere.com/) | 企业 Web/私有部署 | C/D | 企业 Agent 工作平台；试用和部署条件需人工确认。 |
| `cohere` | `cohere-platform-api` Cohere Platform | — | web/tutorial | [控制台](https://dashboard.cohere.com/) / [API 文档](https://docs.cohere.com/) | Web/API/SDK | C/D | 不是 PC 安装产品。 |
| `perplexity` Perplexity | `perplexity-web` Perplexity | — | web | [Perplexity](https://www.perplexity.ai/) / [帮助中心](https://www.perplexity.ai/help-center) | Web | C | 搜索与回答产品。 |
| `perplexity` | `perplexity-comet` Comet | Perplexity | desktop/agent | [Comet](https://www.perplexity.ai/comet) / [帮助](https://www.perplexity.ai/help-center/en/collections/11252744-comet) | Windows/macOS 浏览器 | B | 属完整浏览器/Agent surface，打开官方下载入口。 |
| `perplexity` | `perplexity-sonar-api` Sonar API | Perplexity | tutorial | [API 文档](https://docs.perplexity.ai/) | API | D | 需 API Key 与计费。 |

### 3.2 中国厂商与产品

| vendorId / 厂商 | productId / 产品 | parent | 类型 | 官方入口 / 文档 | 分发与平台 | 候选 | 证据与备注 |
|---|---|---|---|---|---|---|---|
| `bytedance` 字节跳动 | `bytedance-doubao` 豆包 | — | web/desktop | [豆包](https://www.doubao.com/) / [下载](https://www.doubao.com/download/desktop) | Web、Windows/macOS | B/C | 桌面版只打开官方入口。 |
| `bytedance` | `bytedance-trae` TRAE | — | desktop/agent | [TRAE](https://www.trae.ai/) / [下载](https://www.trae.ai/download) | Windows/macOS IDE | B | Agent IDE。 |
| `bytedance` | `bytedance-coze` 扣子 / Coze | — | web/agent | [扣子](https://www.coze.cn/) / [Coze](https://www.coze.com/) | Web | C | 国内外入口分开保存，不自动互换账户体系。 |
| `bytedance` | `bytedance-jimeng` 即梦 AI | — | web | [即梦](https://jimeng.jianying.com/) | Web/移动端 | C | 图像与视频创作入口。 |
| `alibaba` 阿里巴巴 / Qwen | `alibaba-qwen-studio` Qwen Studio | — | web/desktop | [Qwen](https://qwen.ai/) / [Qwen Studio](https://chat.qwen.ai/) | Web、Windows/macOS、移动端 | B/C | 官方页面当前明确列出 Windows/macOS 下载；桌面入口仍按 B 处理。 |
| `alibaba` | `alibaba-qwen-code` Qwen Code | Qwen | cli/agent | [官方仓库](https://github.com/QwenLM/qwen-code) / [官方发布说明](https://qwen.ai/blog?id=qwen3-coder) | npm，Windows/macOS/Linux | A | 官方包 `@qwen-code/qwen-code`；Node 版本、登录、卸载需适配验证。 |
| `alibaba` | `alibaba-model-studio` Alibaba Cloud Model Studio | Qwen | web/tutorial | [官方文档](https://www.alibabacloud.com/help/en/model-studio/) | Web/API | C/D | 中国站与国际站账户、Base URL、计费独立。 |
| `alibaba` | `alibaba-qwen-models` Qwen Open Models | Qwen | local-model | [Qwen GitHub](https://github.com/QwenLM) / [Qwen 官方模型说明](https://qwen.ai/) | Hugging Face/ModelScope/本地推理 | D | 由本地模型运行器承载；AI Hub 不直接把权重当应用安装。 |
| `tencent` 腾讯 | `tencent-yuanbao` 腾讯元宝 | — | web/desktop | [元宝](https://yuanbao.tencent.com/) / [电脑版](https://yuanbao.tencent.com/evt/dl) | Web、Windows/macOS | B/C | 官方桌面入口。 |
| `tencent` | `tencent-codebuddy` CodeBuddy | — | desktop/cli/agent | [CodeBuddy](https://www.codebuddy.ai/) / [文档](https://www.codebuddy.ai/docs) | IDE/CLI/Web（按当前官方页面） | B/A/C | 各 surface 分开建记录；CLI 只有取得稳定官方包身份后才能升 A。 |
| `tencent` | `tencent-workbuddy` WorkBuddy | — | agent | [腾讯 Hy3 产品归属公告](https://www.tencent.com/tencent-hunyuan-officially-releases-hy3-advancing-agent-capabilities-and-deeper-product-integration/) | 企业 Agent | C/D | 官方公告可确认归属，但公开安装/试用入口仍需二次人工审核。 |
| `tencent` | `tencent-hunyuan-platform` 腾讯混元 | — | web/tutorial/local-model | [产品页](https://cloud.tencent.com/product/hunyuan) / [文档](https://cloud.tencent.com/document/product/1729) | 腾讯云 API/开源模型 | C/D | 不与元宝客户端合并。 |
| `baidu` 百度 | `baidu-wenxiaoyan` 文小言 | — | web/desktop | [文小言](https://yiyan.baidu.com/) | Web、官方客户端入口 | B/C | 发布前需再次核验 Windows 下载页和当前产品名；不使用第三方下载站。 |
| `baidu` | `baidu-comate` Baidu Comate | — | desktop/agent | [产品页](https://comate.baidu.com/) / [文档](https://comate.baidu.com/zh/docs) | IDE 插件/企业版 | B | 通过 IDE 官方市场或厂商入口安装。 |
| `baidu` | `baidu-qianfan` 千帆大模型平台 | — | web/agent | [千帆](https://cloud.baidu.com/product/wenxinworkshop) / [文档](https://cloud.baidu.com/doc/WENXINWORKSHOP/) | Web/API/Agent Builder | C/D | 需要百度智能云账号。 |
| `deepseek` DeepSeek | `deepseek-chat-web` DeepSeek Chat | — | web | [官方 Chat](https://chat.deepseek.com/) / [官方仓库证据](https://github.com/deepseek-ai/DeepSeek-V3) | Web、移动 App | C | 未确认一方 Windows Desktop 或官方 CLI；PC 目录以 Web 为主。 |
| `deepseek` | `deepseek-api` DeepSeek API | — | tutorial | [平台](https://platform.deepseek.com/) / [API 文档](https://api-docs.deepseek.com/) | API | D | 密钥与计费由用户完成。 |
| `deepseek` | `deepseek-open-models` DeepSeek Open Models | — | local-model | [官方 GitHub](https://github.com/deepseek-ai) | 权重/源码 | D | 通过 Ollama、Comfy、本地推理框架等宿主安装时要记录真实分发者，不能声称第三方量化包是 DeepSeek 官方包。 |
| `moonshot` Moonshot AI | `moonshot-kimi` Kimi | — | web | [Kimi](https://www.kimi.com/) / [帮助中心](https://www.kimi.com/help) | Web、移动端 | C | PC 主入口 Web。 |
| `moonshot` | `moonshot-kimi-code-cli` Kimi Code CLI | Kimi | cli/agent | [官方入门](https://www.kimi.com/help/kimi-code/cli-getting-started) / [官方仓库](https://github.com/MoonshotAI/kimi-cli) | 官方脚本/npm，Windows/macOS/Linux | A | 当前新版为 TypeScript/Node 路线；不能沿用旧 Python `kimi-cli` 配置。Windows 依赖 Git for Windows。 |
| `moonshot` | `moonshot-open-platform` Kimi Open Platform | Kimi | tutorial | [平台](https://platform.moonshot.cn/) / [文档](https://platform.moonshot.cn/docs/) | API | D | `api.kimi.com` 与 `api.moonshot.cn` 是独立账户/Key 体系，安装引导需避免混用。 |
| `zhipu` 智谱 AI | `zhipu-qingyan` 智谱清言 | — | web | [清言](https://chatglm.cn/) | Web、移动端 | C | 本轮未确认稳定一方 Windows 安装来源。 |
| `zhipu` | `zhipu-glm-coding-plan` GLM Coding Plan | — | tutorial/agent | [官方文档](https://docs.bigmodel.cn/cn/coding-plan/overview) | 服务配置，接入受支持编码 Agent | D | 它是模型服务计划，不是一个可独立安装的 CLI。 |
| `zhipu` | `zhipu-bigmodel-platform` BigModel 开放平台 | — | web/agent | [平台](https://open.bigmodel.cn/) / [文档](https://docs.bigmodel.cn/) | Web/API/Agent | C/D | 账户和密钥由用户管理。 |
| `minimax` MiniMax | `minimax-chat` MiniMax Chat | — | web | [Chat](https://chat.minimax.io/) / [官网](https://www.minimax.io/) | Web | C | 全球产品入口。 |
| `minimax` | `minimax-agent` MiniMax Agent | MiniMax Chat | web/agent | [官方产品入口](https://agent.minimax.io/) / [官方组织](https://github.com/MiniMax-AI) | Web Agent | C | 官方组织与公司资料可确认产品名。 |
| `minimax` | `minimax-hailuo` Hailuo AI | — | web | [Hailuo](https://hailuoai.video/) | Web、移动端 | C | 视频生成产品。 |
| `minimax` | `minimax-cli` MiniMax CLI | — | cli | [官方仓库](https://github.com/MiniMax-AI/cli) | npm/TypeScript，跨平台 | A | 官方仓库描述支持文本、图像、视频、语音和音乐生成；包名需在进入白名单前从 README/registry 再固定。 |
| `minimax` | `minimax-openroom` OpenRoom | MiniMax Agent | agent/desktop | [官方仓库](https://github.com/MiniMax-AI/OpenRoom) | 浏览器式桌面 Agent | D | 源码项目；是否有稳定签名 Windows 分发需二次审核。 |
| `01ai` 01.AI | `01ai-yi-models` Yi | — | local-model | [官方仓库](https://github.com/01-ai/Yi) / [官网](https://www.01.ai/) | 权重、源码、本地推理 | D | 官方仓库的本地路径需要 Python/显卡；不承诺通用一键安装。 |
| `01ai` | `01ai-api-platform` 01.AI API Platform | Yi | tutorial | [官方文档](https://platform.01.ai/docs) | API | D | 本轮没有足够一方证据证明存在当前活跃、面向 PC 的官方客户端或 CLI。 |
| `baichuan` 百川智能 | `baichuan-ying` 百小应 | — | web | [官方 Web](https://ying.baichuan-ai.com/chat) / [一方隐私政策中的产品定义](https://policy.baichuan-ai.com/mobile/privacy/2025) | Web、移动端 | C | 补充厂商；不用第三方下载。 |
| `baichuan` | `baichuan-platform` 百川开放平台 | — | web/agent/local-model | [平台](https://platform.baichuan-ai.com/) / [官网模型页](https://www.baichuan-ai.com/) | Web/API/开源权重 | C/D | 平台明确包含智能体平台与模型服务。 |
| `kuaishou` 快手 | `kuaishou-kling` 可灵 AI / Kling AI | — | web | [中国站](https://klingai.kuaishou.com/) / [国际站](https://klingai.com/) | Web、移动端 | C | 国内外账户与可用功能分开记录。 |
| `sensetime` 商汤科技 | `sensetime-sensechat` 商量 / SenseChat | — | web | [SenseChat](https://chat.sensetime.com/) / [商汤日日新](https://platform.sensenova.cn/) | Web/API | C | 发布前需人工核验地域入口和当前个人开放状态。 |

### 3.3 图像、视频与创意平台

| vendorId / 厂商 | productId / 产品 | parent | 类型 | 官方入口 / 文档 | 分发与平台 | 候选 | 证据与备注 |
|---|---|---|---|---|---|---|---|
| `stability` Stability AI | `stability-stable-assistant` Stable Assistant | — | web | [产品页](https://assistant.stability.ai/about) | Web | C | 官方描述为图像生成与编辑工具。 |
| `stability` | `stability-dreamstudio` DreamStudio | — | web | [DreamStudio](https://dreamstudio.ai/) / [知识库](https://kb.stability.ai/) | Web | C | Stability 现有帮助内容存在 DreamStudio/Brand Studio 名称变化，发布前应再次核对展示名；不推断桌面客户端。 |
| `stability` | `stability-platform-api` Stability Platform API | — | tutorial | [官方文档](https://platform.stability.ai/docs) | API | D | 开发者入口。 |
| `midjourney` Midjourney | `midjourney-web` Midjourney | — | web | [产品](https://www.midjourney.com/) / [入门](https://docs.midjourney.com/hc/en-us/articles/33329261836941-Getting-Started-Guide) | Web、Discord | C | 官方指南已支持网站 Create；没有一方 Windows 客户端/CLI 证据。 |
| `runway` Runway | `runway-web` Runway | — | web | [应用](https://app.runwayml.com/) / [帮助中心](https://help.runwayml.com/) | Web | C | 生成式视频与编辑平台。 |
| `runway` | `runway-agent` Runway Agent | Runway | web/agent | [官方公告](https://runwayml.com/news/introducing-runway-agent) | Runway Web 内 | C | 2026 年官方发布的创意 Agent，是 Runway 的子产品，不是独立 CLI。 |
| `pika` Pika | `pika-web` Pika | — | web | [Pika](https://pika.art/) / [官方条款的产品定义](https://pika.art/terms-of-service) | Web、移动端 | C | 官方服务包含文本/图像/视频输入到视频等输出。 |
| `pika` | `pika-agent` Pika Agent | Pika | web/agent | [官方实验/公告页](https://experiment.pika.art/blog) | Web Agent | C | 2026 官方页面已有 Agent 与 MCP skills 描述；具体公开范围变化快，需在发布时复核。 |
| `bfl` Black Forest Labs | `bfl-playground` FLUX Playground | FLUX | web | [Playground](https://playground.bfl.ai/) / [官方服务定义](https://bfl.ai/legal/terms-of-service) | Web | C | 官方条款明确涵盖 Playground、FLUX 模型和 API。 |
| `bfl` | `bfl-flux-api-models` FLUX Models & API | FLUX | tutorial/local-model | [API 文档](https://docs.bfl.ai/) / [官网](https://bfl.ai/) | API/部分开放权重 | D | 权重许可、模型大小与 API 计费分别处理。 |

### 3.4 模型平台、推理云与本地运行器

| vendorId / 厂商 | productId / 产品 | parent | 类型 | 官方入口 / 文档 | 分发与平台 | 候选 | 证据与备注 |
|---|---|---|---|---|---|---|---|
| `huggingface` Hugging Face | `hf-hub` Hugging Face Hub | — | web | [Hub](https://huggingface.co/) / [Hub 文档](https://huggingface.co/docs/hub/) | Web | C | 模型、数据集、Spaces 与 Agent 资源平台。 |
| `huggingface` | `hf-cli` Hugging Face CLI | Hub | cli | [官方文档](https://huggingface.co/docs/huggingface_hub/en/guides/cli) | 官方安装脚本/Python 包，Windows/macOS/Linux | A | 当前命令是 `hf`；Windows 官方脚本可审计，但需决定独立安装器还是隔离 Python。 |
| `replicate` Replicate | `replicate-web` Replicate Models | — | web | [平台](https://replicate.com/explore) / [模型文档](https://replicate.com/docs/topics/models/) | Web | C | 可在 Web 运行模型。 |
| `replicate` | `replicate-api-cog` Replicate API / Cog | Replicate Models | cli/tutorial | [API](https://replicate.com/docs/reference/http) / [Cog](https://github.com/replicate/cog) | API、Python/JS、Docker CLI | D | Cog 涉及 Docker 和模型构建，不列为普通用户一键安装。 |
| `together` Together AI | `together-playground` Together Playground | — | web | [平台](https://api.together.ai/playground) / [文档](https://docs.together.ai/) | Web/API | C | 本轮未把第三方 CLI 当作 Together 官方产品。 |
| `together` | `together-api` Together API | — | tutorial | [官方文档](https://docs.together.ai/docs/introduction) | API/SDK | D | 需要 API Key 与计费。 |
| `groq` Groq | `groq-console` GroqCloud Console | — | web | [Console](https://console.groq.com/) / [文档](https://console.groq.com/docs/overview) | Web/API | C | 推理云入口。 |
| `groq` | `groq-api-agents` Groq API Tools & MCP | GroqCloud | agent/tutorial | [Tool Use](https://console.groq.com/docs/tool-use/overview) / [Remote MCP](https://console.groq.com/docs/tool-use/remote-mcp) | API | D | 这是服务端 Agent 能力，不是本地 MCP 安装包。 |
| `nvidia` NVIDIA | `nvidia-nim` NVIDIA NIM | — | local-model/tutorial | [NIM](https://developer.nvidia.com/nim) / [文档](https://docs.nvidia.com/nim/) | 容器、云服务 | D | 需要支持的 GPU、驱动、容器与许可。 |
| `nvidia` | `nvidia-ai-workbench` NVIDIA AI Workbench | — | desktop | [产品页](https://developer.nvidia.com/ai-workbench) / [文档](https://docs.nvidia.com/ai-workbench/) | Windows/Linux/macOS | B | 图形工具打开官方分发入口；WSL/Docker/GPU 依赖不在浏览时探测。 |
| `nvidia` | `nvidia-nemo-agent-toolkit` NVIDIA NeMo Agent Toolkit | — | cli/agent/tutorial | [官方仓库](https://github.com/NVIDIA/NeMo-Agent-Toolkit) / [文档](https://docs.nvidia.com/nemo/agent-toolkit/latest/) | PyPI/CLI/容器；Windows 推荐 WSL2 | D | 当前官方名为 NeMo Agent Toolkit，旧名 AgentIQ 只作搜索别名；稳定包为 `nvidia-nat`。它是开发框架，不能全局无隔离安装。[官方安装与迁移说明](https://docs.nvidia.com/nemo/agent-toolkit/latest/get-started/installation.html) |
| `ollama` Ollama | `ollama-windows` Ollama for Windows | — | desktop/cli/local-model | [下载](https://ollama.com/download/windows) / [Windows 文档](https://github.com/ollama/ollama/blob/main/docs/windows.mdx) | `OllamaSetup.exe`，Windows | B | 同一安装体同时提供后台应用、API 与 `ollama` CLI；不建立重复安装任务。 |
| `ollama` | `ollama-model-library` Ollama Model Library | Ollama | local-model | [模型库](https://ollama.com/search) / [CLI 文档](https://docs.ollama.com/cli) | `ollama pull`，跨平台 | A/D | 可做宿主内“一键拉取模型”，但每个模型需记录上游来源、大小、许可、量化和磁盘预算；不是厂商桌面软件安装。 |
| `comfy` Comfy Org | `comfy-desktop` Comfy Desktop | — | desktop/local-model | [下载](https://comfy.org/download) / [官方仓库](https://github.com/Comfy-Org/Comfy-Desktop) | Windows/macOS/Linux | B | 当前正式名称是 Comfy Desktop；旧 ComfyUI Desktop 仓库已迁移。 |
| `comfy` | `comfy-cli` comfy-cli | ComfyUI | cli | [官方仓库](https://github.com/Comfy-Org/comfy-cli) | PyPI，Python 3.10+ | A | 官方支持安装/启动 ComfyUI、模型和 Custom Nodes；应使用隔离环境，不污染系统 Python。 |
| `comfy` | `comfy-registry` Comfy Registry / Custom Nodes | ComfyUI | tutorial | [Registry](https://registry.comfy.org/) / [Custom Nodes 文档](https://docs.comfy.org/registry/overview) | 由 Comfy Desktop/Manager/comfy-cli 安装 | D/A | 是 Comfy 子目录，不进入主页；只有经来源、版本、依赖和恶意代码审核的节点可一键安装。 |

## 4. 独立 Agent、Agent IDE 与编排工具

这些项目不归属于它们默认使用的模型厂商。

| vendorId / 维护者 | productId / 产品 | 类型 | 官方入口 / 文档 | 分发与平台 | 候选 | 核验结论 |
|---|---|---|---|---|---|---|
| `openclaw` OpenClaw | `openclaw-agent` OpenClaw | cli/agent | [官网](https://openclaw.ai/) / [文档](https://docs.openclaw.ai/) / [官方仓库](https://github.com/openclaw/openclaw) | 官方 CLI/网关，跨平台 | A | 名称可确认；需要高权限文件、命令、网络和消息渠道能力，必须单独做威胁模型、默认最小权限和凭据隔离，不能仅凭官方安装命令直接开放。 |
| `nousresearch` Nous Research | `nous-hermes-agent` Hermes Agent | desktop/cli/agent | [官方产品页](https://nousresearch.net/hermes-agent/) / [文档](https://hermes-agent.nousresearch.com/docs/) / [仓库](https://github.com/NousResearch/hermes-agent) | Windows/macOS 桌面安装器；Windows PowerShell、Linux/macOS/WSL 脚本 | A/B | 用户所写 `hermas` 未找到一方项目；高置信纠正为 **Hermes Agent**。原生 Windows 已有官方 PowerShell 路径，但安装脚本执行前必须固定允许域、版本、校验和卸载策略。 |
| `anysphere` Anysphere | `cursor-desktop` Cursor | desktop/agent | [下载](https://cursor.com/download) / [文档](https://docs.cursor.com/) | Windows/macOS/Linux IDE | B | 官方桌面产品。 |
| `anysphere` | `cursor-cli` Cursor CLI | Cursor | cli/agent | [CLI 文档](https://docs.cursor.com/en/cli/overview) / [安装](https://docs.cursor.com/en/cli/installation) | macOS/Linux/Windows WSL | A | Windows 原生未列为支持面；AI Hub 不能在普通 Windows 上误报可用。 |
| `cline` Cline | `cline-agent` Cline | desktop/cli/agent | [官方仓库](https://github.com/cline/cline) / [文档](https://docs.cline.bot/) | VS Code/JetBrains、npm CLI | A/B | CLI 官方安装为 `npm i -g cline`；IDE 插件走官方市场。 |
| `anomalyco` Anomaly | `opencode` OpenCode | desktop/cli/agent | [官网/文档](https://opencode.ai/docs) / [官方仓库](https://github.com/anomalyco/opencode) | Windows/macOS/Linux，npm/Scoop/Chocolatey/桌面 beta | A/B | Windows 官方建议 WSL，但也列出 npm、Scoop、Chocolatey；每种安装源分别审核。 |
| `langchain` LangChain | `langgraph` LangGraph | agent/tutorial | [官方仓库](https://github.com/langchain-ai/langgraph) / [文档](https://docs.langchain.com/oss/python/langgraph/overview) | PyPI/npm SDK | D | 编排框架，不是最终用户 CLI；推荐项目级虚拟环境。 |
| `microsoft` Microsoft | `microsoft-autogen-maintenance` AutoGen | agent/tutorial | [官方仓库](https://github.com/microsoft/autogen) / [文档](https://microsoft.github.io/autogen/) | Python/.NET SDK | X/D | 官方仓库已注明维护模式，新项目推荐 Microsoft Agent Framework；保留迁移/兼容入口。 |
| `crewai` CrewAI | `crewai-framework` CrewAI | cli/agent | [官网文档](https://docs.crewai.com/) / [官方仓库](https://github.com/crewAIInc/crewAI) | Python/uv CLI | D | 有 CLI，但创建/运行 Agent 项目依赖 Python 环境、模型 Key 与代码执行；适合教程式项目安装，不适合全局无提示安装。 |
| `langgenius` LangGenius | `dify` Dify | web/agent | [官方仓库](https://github.com/langgenius/dify) / [自托管文档](https://docs.dify.ai/getting-started/install-self-hosted) | 云服务或 Docker Compose | C/D | Docker 多服务栈；不能把“启动容器”包装成无条件一键安装，需端口、磁盘、数据库、密钥和升级/备份计划。 |
| `mintplex` Mintplex Labs | `anythingllm` AnythingLLM | desktop/agent | [官网](https://anythingllm.com/) / [官方仓库](https://github.com/Mintplex-Labs/anything-llm) / [文档](https://docs.anythingllm.com/) | Windows/macOS/Linux Desktop、Docker | B/D | 桌面版打开官方下载；Docker 为高级安装。Agent Skills 与 MCP 放产品子目录。 |
| `openwebui` Open WebUI | `open-webui` Open WebUI | web/agent | [官方仓库](https://github.com/open-webui/open-webui) / [文档](https://docs.openwebui.com/) | Docker/Python/Kubernetes | D | 工具/Functions 可执行用户提供的 Python；只对信任管理员开放，不能作为普通插件无审核安装。 |

## 5. Skill、MCP 与周边扩展首批清单

### 5.1 必须遵守的展示与安装规则

- 主页和厂商首页只显示产品，不显示 Skill、MCP、插件、Power、Custom Node。
- 产品详情页增加“扩展”子目录，按 `官方`、`已审核`、`社区未审核` 分区；默认只展示官方和已审核。
- 一个扩展可以支持多个宿主，但数据库必须为每个 `targetProductId` 保存独立安装配方；不能把 Claude Code 的 `.mcp.json` 直接写到 Codex、Gemini CLI 或 OpenClaw。
- 一键安装前展示发布者、来源、版本/commit、写入路径、将启动的进程、网络域、凭据需求和权限；安装后记录 receipt，并能精准卸载。
- 远程 MCP 不“安装服务”，只写入经审核的连接配置；OAuth/登录由用户完成。stdio MCP 可能执行本地代码，必须按 CLI 安装等级审核。
- 社区扩展不因出现在官方 marketplace/registry 就自动成为厂商代码；“官方目录收录”与“官方发布者”是两个字段。

### 5.2 高置信扩展记录

| extensionId | targetProductId | 类型 | 官方来源 / 安装方式 | 候选 | 备注 |
|---|---|---|---|---|---|
| `openai-codex-skills-catalog` | `openai-codex` | skill | [openai/skills](https://github.com/openai/skills)；由 Codex 内 `$skill-installer` 按名称或 GitHub 目录安装 | A | 官方仓库明确区分 system、curated、experimental；AI Hub 默认只允许 system/curated，实验项需额外确认。 |
| `openai-codex-mcp-config` | `openai-codex` | mcp | [Codex MCP 文档](https://developers.openai.com/codex/mcp/) | A/D | 这是宿主适配器，不是一个通用 MCP 包；逐 server 审核。 |
| `anthropic-official-plugin-marketplace` | `anthropic-claude-code-cli` | skill/mcp/plugin | [官方 marketplace 文档](https://code.claude.com/docs/en/discover-plugins)；`/plugin install <name>@claude-plugins-official` | A | 官方 marketplace 自动可用；文档也明确提醒 Anthropic 不控制所有插件包含的第三方代码，仍需逐项审核。 |
| `anthropic-claude-code-mcp` | `anthropic-claude-code-cli` | mcp | [官方 MCP 文档](https://code.claude.com/docs/en/mcp)；`claude mcp add ...` | A/D | 远程 OAuth 与本地 stdio 分开；不要把 Claude Desktop Chat 的配置误认为 Code tab 配置。 |
| `google-gemini-cli-extensions` | `google-gemini-cli` | skill/mcp | [官方扩展文档](https://geminicli.com/docs/extensions/) / [官方仓库](https://github.com/google-gemini/gemini-cli) | A | 每个 extension 的来源、版本、MCP 和 hook 权限需单独展示。 |
| `github-copilot-mcp` | `github-copilot` | mcp | [GitHub MCP 文档](https://docs.github.com/en/copilot/customizing-copilot/extending-copilot-chat-with-mcp) / [GitHub 官方 MCP Server](https://github.com/github/github-mcp-server) | A | GitHub 官方 server 可标“官方发布者”；其他 Marketplace 项仍是第三方。 |
| `microsoft-playwright-mcp` | `microsoft-agent-framework` | mcp | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | A/D | 一方仓库；浏览器控制权限高，必须显示访问页面与本地浏览器权限。 |
| `microsoft-azure-mcp` | `microsoft-foundry` | mcp | [Azure MCP Server](https://github.com/microsoft/mcp) / [Microsoft Learn](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/) | A/D | 需要 Azure 登录与资源权限；默认不得自动批准写操作。 |
| `amazon-kiro-powers` | `amazon-kiro-ide` | skill/mcp/plugin | [Kiro Powers 文档](https://kiro.dev/docs/powers/) | A/D | Power 可打包 MCP、steering 和 hooks；一键装之前必须展开其全部组件和权限。 |
| `aws-mcp-servers` | `amazon-kiro-ide` | mcp | [awslabs/mcp](https://github.com/awslabs/mcp) | A/D | AWS Labs 一方组织不等于所有 server 已生产支持；逐 server 标 experimental/preview。 |
| `moonshot-kimi-plugins` | `moonshot-kimi-code-cli` | skill/mcp/plugin | [官方插件文档](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html) | A | 插件可包含 Skills 与 MCP；只通过 Kimi 当前插件机制安装，不能写旧 `~/.kimi` 目录。 |
| `minimax-official-skills` | `minimax-cli` | skill | [MiniMax-AI/skills](https://github.com/MiniMax-AI/skills) | A/D | 官方组织仓库；需要读取每个 skill 的许可证、脚本和 Key 要求后再批准。 |
| `minimax-official-mcp` | `minimax-cli` | mcp | [MiniMax-AI/MiniMax-MCP](https://github.com/MiniMax-AI/MiniMax-MCP) | A/D | 一方 MCP，调用图像/视频/TTS API；需用户 Key、计费提示和输出存储说明。 |
| `hf-agent-skills` | `hf-cli` | skill | [HF Agents 文档](https://huggingface.co/docs/hub/agents-overview)；`hf skills add` / `hf skills add --claude` | A | 官方 CLI 原生提供宿主定向安装，适合复用为 AI Hub 适配器。 |
| `hf-mcp-server` | `hf-hub` | mcp | [HF Agents 文档](https://huggingface.co/docs/hub/agents-overview)；从登录后的设置页生成宿主配置 | A/C | 官方建议使用设置页生成精确配置，不手写猜测 URL 参数。 |
| `openclaw-clawhub-skills` | `openclaw-agent` | skill | [ClawHub](https://docs.openclaw.ai/clawhub)；`openclaw skills install @owner/slug` | A | ClawHub 是公共 registry；只有 `@openclaw/*` 等已核实发布者才能标官方。安装前可调用官方 `openclaw skills verify` 信任包络，但扫描通过不替代人工审计。 |
| `openclaw-clawhub-plugins` | `openclaw-agent` | plugin/mcp | [ClawHub 快速开始](https://docs.openclaw.ai/clawhub/quickstart)；`openclaw plugins install clawhub:<package>` | A/D | 插件可获得高权限，默认不自动批准工具调用。 |
| `hermes-agent-skills` | `nous-hermes-agent` | skill | [Hermes 官方文档](https://hermes-agent.nousresearch.com/docs/) / [官方仓库](https://github.com/NousResearch/hermes-agent) | A/D | Hermes 会从经验创建/改进 skills；AI Hub 只管理明确来源的外部 skill，不能把 Agent 自生成内容误标为官方。 |
| `cline-official-skills-plugins` | `cline-agent` | skill/mcp/plugin | [Cline 官方仓库](https://github.com/cline/cline) / [官方组织](https://github.com/cline)；CLI `cline skill`、`cline plugin install`、`cline mcp` | A | Cline 官方组织有 `plugins`、`mcp-marketplace`、`skills` 类资源；marketplace 收录项逐一保存发布者。 |
| `opencode-agent-skills` | `opencode` | skill | [官方 Skills 文档](https://opencode.ai/docs/skills) | A/D | OpenCode 当前支持本地 `.agents/skills` 等目录发现，但没有一方稳定“任意 registry 一键装”协议；AI Hub 只能安装审核过的目录快照。 |
| `anythingllm-agent-skills` | `anythingllm` | skill/mcp | [官方仓库](https://github.com/Mintplex-Labs/anything-llm) / [文档](https://docs.anythingllm.com/) | D | 宿主内配置，Desktop 与 Docker 路径/权限不同；先做官方 API/配置协议核验。 |
| `comfy-custom-nodes` | `comfy-desktop` | plugin | [Comfy Registry](https://registry.comfy.org/) / [comfy-cli](https://github.com/Comfy-Org/comfy-cli) | A/D | 安装命令清楚，但 Custom Node 是可执行 Python；需依赖冲突、供应链、许可证、快照与回滚审核。 |
| `pika-mcp-skills` | `pika-agent` | skill/mcp | [Pika 官方实验博客](https://experiment.pika.art/blog) | D | 官方已公开描述 Pika MCP skills，但本轮未取得稳定包 ID/安装协议；先展示教程，待官方 manifest 后再升 A。 |

### 5.3 MCP 生态级记录

- MCP 是开放协议，不应整体归属于 Anthropic 产品目录。协议入口使用 [modelcontextprotocol.io](https://modelcontextprotocol.io/)；参考实现/官方组织使用 [modelcontextprotocol GitHub](https://github.com/modelcontextprotocol)。
- MCP server 的“协议官方”“平台官方”“第三方社区”是三个不同概念。
- AI Hub 首版只自动配置具有固定官方 HTTPS endpoint，或具有官方包 ID、固定发布者、可锁版本的 stdio server。
- 所有 MCP 默认 `autoApprove = []`。写文件、执行命令、浏览器控制、云资源修改、邮件/消息发送、支付与凭据访问必须由宿主继续询问用户。

## 6. 可直接转成开发任务的首批范围

### 6.1 CLI 本地适配优先队列

先做这些具有一方安装证据、Windows 路径清楚且用户价值高的 CLI：

1. Codex CLI
2. Claude Code CLI
3. Gemini CLI
4. Qwen Code
5. Kimi Code CLI
6. Kiro CLI
7. Hugging Face `hf` CLI
8. `comfy-cli`（隔离 Python 环境）
9. Cline CLI
10. OpenCode

OpenClaw、Hermes Agent、MiniMax CLI 进入第二队列：它们已经具备官方来源，但权限面更大或安装机制更新更快，需要先完成威胁模型、凭据边界和可恢复卸载设计。

### 6.2 桌面官方入口优先队列

ChatGPT Desktop、Claude Desktop、Kiro、Cursor、Comet、TRAE、豆包、Qwen Studio、腾讯元宝、Comfy Desktop、Ollama、AnythingLLM。统一行为为打开官方分发页/商店；不在客户端托管、解析或执行厂商安装器。

### 6.3 首批扩展适配器

1. Codex Skill 安装器 + Codex MCP 配置器
2. Claude Code 官方 Marketplace + MCP 配置器
3. Gemini CLI Extension 配置器
4. GitHub MCP Server 配置器
5. Kiro Power 安装器
6. Kimi Code Plugin 安装器
7. Hugging Face Skill + MCP 配置器
8. OpenClaw ClawHub Skill 安装器（带 `verify` 与权限卡）
9. Cline Skill/Plugin/MCP 适配器
10. Comfy Custom Node 适配器（带快照与回滚）

## 7. 明确不应做的事

- 不根据模型兼容性把独立 Agent 归给模型厂商。
- 不把 Sora 作为当前 OpenAI 活跃产品继续上架；保留历史记录和下线状态。
- 不把 Amazon Q Developer CLI 与 Kiro CLI 同时作为两个新装项。
- 不把 Le Chat 和 Vibe 当成两个当前产品；Le Chat 是 Vibe 的旧名。
- 不把 OpenAI Codex Windows 当成独立安装包；当前复用统一 ChatGPT Desktop。
- 不把 `MCP registry 收录`、`ClawHub 收录`、`Claude Marketplace 收录` 等同于“厂商官方代码”。
- 不让后台下发 PowerShell、CMD、shell、npm/pip 参数或任意 URL；客户端只接受内置 adapter ID 与有限结构化参数。
- 不在用户浏览目录时探测 Node、Python、Git、WSL、Docker、GPU；只在用户点击安装并看到依赖说明后检查。
- 不把测试通过描述成真实 Windows 安装、登录、升级、卸载或硬件兼容验收。

## 8. 后续持续维护流程

1. 每周增量扫描厂商官方 products/docs/changelog/GitHub organization。
2. 新条目先进入 `candidate`，至少两个一方证据字段：归属证据 + 当前入口/分发证据。
3. 产品负责人确认厂商/产品/parent 关系后才发布目录。
4. CLI 安装候选进入本地安全审核：包身份、签名/校验、依赖、固定版本策略、登录、更新、检测、卸载、残留、回滚。
5. Skill/MCP 进入扩展审核：发布者、commit/version、脚本、权限、网络、凭据、许可证、宿主写入范围、卸载 receipt。
6. 每次发布重新检查 `active / renamed / migrated / retired`；Sora、Le Chat、Amazon Q、Codex Desktop 已证明这一步不能省略。

## 9. 本轮不确定性与待补证

- “所有厂商”仍需通过持续 intake 扩展，尤其是地区性垂直 AI、企业内部 Agent、学术项目和快速出现的新工具。
- 百度文小言、智谱个人产品、SenseChat 的 Windows 客户端/公开范围变化较快；本轮只保留高置信 Web/平台入口，不猜安装包。
- Tencent CodeBuddy 的多 surface 当前变化快，应在实现前重新固定每个 surface 的官方包/商店身份。
- MiniMax OpenRoom、Pika MCP skills 已有官方项目/公告，但稳定 Windows 分发或可机器读取的扩展 manifest 仍需补证。
- Together、Groq、Cohere 等主要是 Web/API 平台；没有一方证据时，不为满足“没有客户端就补 CLI”而制造第三方 CLI。
- 本文件记录的是 2026-07-31 的官方状态；任何安装 adapter 上线前必须再做一次实时复核。
