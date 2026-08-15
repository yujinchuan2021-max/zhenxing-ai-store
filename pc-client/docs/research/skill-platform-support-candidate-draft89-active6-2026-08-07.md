# Skill resources platformSupport candidate（draft89 / v2 active6）

状态：`candidateOnly=true`、`publishable=false`。事实源为 `state.json` draft revision 89 与 v2 active6；范围是全部 16 个 Skill resources / 34 targets。Batch 1/2 产品平台证据只作为 host 交集输入，未当作 active 事实，也没有把平台字段写入 target。

## 结论

- 资源级 claims：Windows/macOS/Linux 各 16 条，`supported=0 / unknown=16 / unsupported=0 / blocked=0`。官方资源页面大多确认 Skill/工具身份，但没有同时给出 Skill 包本身的逐平台 native 发行合同；未知保持 unknown，不凭桌面产品或仓库存在推断。
- 运行时按官方使用方式标注：本地 Skill/目录为 `native`；Pika、Meshy、Krea 的 MCP/生成服务依赖标为 `remote`。remote 不冒充 native，网页可访问不等于本地可安装。
- 目标交集预览：102 个 resource×host×requestedPlatform 组合，`available=0`、`managedEligible=0`、`blocked=102`。唯一 `skill.codex.chatgpt-apps` profile 的 platformSupport 仍为空，因此即使 Codex host 在 Batch 1 有 Windows/WSL、macOS/Linux claims，仍必须 `managed=false`。
- Hermes 保留为成熟 Agent 生态候选（`matureAgentEcosystemCandidate=true`），但当前 target 仍 `resource-link`，不获得 Agent/Workflow/profile 或安装动作。

## 资源与 target 核对

| resourceId | canonical source / runtime | targets（精确 hostProductId） | 平台结论 / 阻断 |
|---|---|---|---|
| `openai-codex-skills-catalog` | [OpenAI Skills](https://github.com/openai/skills) / native | `codex-cli`（resource-link） | 三平台 unknown；rolling directory，无 Skill 逐平台发行合同。 |
| `openai-chatgpt-apps-skill` | [固定 ChatGPT Apps commit](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/chatgpt-apps) / native | `codex-cli`（skill-managed, `skill.codex.chatgpt-apps`） | 三平台 resource unknown；profile platformSupport 空，强制 blocked-profile-platform-unreviewed。 |
| `anythingllm-agent-skills` | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) / native | `anythingllm-desktop`（resource-link） | 三平台 unknown；应用内混合 Skills/flows/MCP。 |
| `minimax-official-skills` | [MiniMax Skills](https://github.com/MiniMax-AI/skills) / native | `minimax-cli`（resource-link） | 三平台 unknown；仓库集合/宿主配置不构成固定 Skill snapshot。 |
| `pika-mcp-skills` | [Pika MCP](https://experiment.pika.art/mcp) / remote | `pika-agent`（resource-link） | 三平台 unknown；Auth/API key、远端 MCP/plugin，不能本地受管。 |
| `hf-agent-skills` | [Hugging Face Agents](https://huggingface.co/docs/hub/en/agents-overview) / native | `hf-cli`（resource-link） | 三平台 unknown；token/插件宿主合同缺失。 |
| `openclaw-clawhub-skills` | [OpenClaw Skills](https://docs.openclaw.ai/skills) / native | `openclaw-agent`（resource-link） | 三平台 unknown；ClawHub 远程 registry/CLI 状态不进入 AI Hub ownership。 |
| `hermes-agent-skills` | [Hermes docs](https://hermes-agent.nousresearch.com/docs/) / native | `nous-hermes-agent`（resource-link） | 三平台 unknown；成熟 Agent 生态候选，但无 fixed platform/profile/lifecycle。 |
| `cline-official-skills-plugins` | [Cline Skills](https://docs.cline.bot/customization/skills) / native | `cline-agent`（resource-link） | 三平台 unknown；Skill/Plugin/MCP 混合，npm/auth/宿主合同未固定。 |
| `opencode-agent-skills` | [OpenCode Skills](https://opencode.ai/docs/skills) / native | `opencode`（resource-link） | 三平台 unknown；目录发现文档不等于发行合同。 |
| `matlab-agentic-toolkit` | [MATLAB toolkit](https://github.com/matlab/matlab-agentic-toolkit) / native | `codex-cli`, `claude-code`, `github-copilot`（均 resource-link） | 三平台 unknown；复合 toolkit/MCP、配置副作用。 |
| `simulink-agentic-toolkit` | [Simulink toolkit](https://github.com/matlab/simulink-agentic-toolkit) / native | `codex-cli`, `claude-code`, `gemini-cli`, `github-copilot`（均 resource-link） | 三平台 unknown；复合 installer/依赖。 |
| `nvidia-omniverse-agent-skills` | [NVIDIA Skills](https://github.com/NVIDIA/skills) / native | `claude-code`, `codex-cli`, `cursor-desktop`（均 resource-link） | 三平台 unknown；当前为广泛动态目录，未选定 Skill name/commit/hash。 |
| `cesium-agent-skills` | [Cesium AI integrations](https://github.com/CesiumGS/cesium-ai-integrations/blob/main/skills/README.md) / native | `claude-desktop`, `claude-code`, `codex-cli`, `github-copilot`（均 resource-link） | 三平台 unknown；实验性/代码生成范围未形成固定生命周期。 |
| `meshy-3d-skill` | [Meshy MCP and Skill](https://docs.meshy.ai/en/agent/mcp-and-skill) / remote | `claude-code`, `gemini-cli`, `opencode`, `openclaw-agent`（均 resource-link） | 三平台 unknown；API key/quota、生成能力，不能本地受管。 |
| `krea-agent-skills` | [Krea Skills](https://www.krea.ai/skills) / remote | `claude-code`, `cursor-desktop`, `github-copilot`, `codex-cli`, `windsurf-editor`, `openclaw-agent`（均 resource-link） | 三平台 unknown；token/quota、动态来源。 |

## 证据、校验与责任

每条 resource claim 使用其 canonical HTTPS 一手来源并带 `observedAt=2026-08-07T00:00:00.000Z`；host 交集只引用 Batch 1/2 的 first-party evidence。已校验 resourceId 唯一、34 个 target tuple 与 active6 精确匹配、禁止字段为空、没有重复 target，且平台字段没有写入 target。

后台只审候选 schema/证据；前端只消费共享交集；桌面管理提供各平台 artifact/lifecycle；Agent Broker 消费同一 projection；Skill 商店维护 canonical source 与 资源级证据。未修改 catalog/state/schema/profile/artifact，未 saveDraft/publish/package/upload/download/install。
