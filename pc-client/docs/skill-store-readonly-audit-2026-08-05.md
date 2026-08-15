# Skill 商店只读审计（authoritative draft84）

日期：2026-08-05  
范围：146 个顶层 resources；筛选 `resourceTypes` 包含 `skill` 的全部记录。未下载、未安装、未调用 `saveDraft`，未修改 catalog/state。

## 合同与基线

- `ResourceStore` 只接受 `skill | mcp | connector | plugin`；`shared/resource-store.cjs` 按 `resourceTypes` 投影资源，不复制多类型 resource 身份。
- 前端 `ResourceStorePage` 使用 `kind + resourceStores/resources/vendors`，沿用宿主工具 → 资源列表 → 详情/安装；目标关系来自 `targets[].productId`。
- `resource-link` 只有 `website`，无安装 profile；只有本地 registry 的 `skill-managed` profile 才能显示安装/更新/修复/卸载。
- 唯一 Skill fixed profile：`skill.codex.chatgpt-apps` → `codex-cli` → `directory-snapshot`，能力为 `website/install/update/repair/uninstall`，版本快照为 `49f948faa9258a0c61caceaf225e179651397431`。

## 逐条资源核对

分类含义：`managed-ready` = 固定 profile 已覆盖；`official-link-only` = 官方来源已记录但仅官网入口；`needs-first-party-review` = 仍需核对 Skill 包格式、宿主范围或直接官方证据。所有下列 targets 的现状均为 `resource-link / profile="" / capabilities=[website]`，除 managed-ready 行外另有注明。

| resourceId | 资源 / 发布者 | targets（宿主工具） | 官方来源 | 分类 / 固定 profile |
|---|---|---|---|---|
| `openai-codex-skills-catalog` | OpenAI Codex Skills / OpenAI | `codex-cli` | [OpenAI Skills](https://github.com/openai/skills) | official-link-only / 无 |
| `openai-chatgpt-apps-skill` | ChatGPT Apps Skill / OpenAI | `codex-cli` | [Skill README](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/chatgpt-apps)、[SKILL.md](https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/chatgpt-apps/SKILL.md) | **managed-ready** / `skill.codex.chatgpt-apps` |
| `anythingllm-agent-skills` | AnythingLLM Agent Skills 与 MCP / Mintplex Labs | `anythingllm-desktop` | [AnythingLLM repository](https://github.com/Mintplex-Labs/anything-llm)、[docs](https://docs.anythingllm.com/) | needs-first-party-review（Skill/MCP 混合，缺固定 Skill profile） |
| `minimax-official-skills` | MiniMax 官方 Skills / MiniMax | `minimax-cli` | [MiniMax skills](https://github.com/MiniMax-AI/skills) | official-link-only / 无 |
| `pika-mcp-skills` | Pika MCP Skills / Pika | `pika-agent` | [Pika official blog](https://experiment.pika.art/blog) | needs-first-party-review（当前证据为博客入口，且 Skill/MCP 混合） |
| `hf-agent-skills` | Hugging Face Agent Skills / Hugging Face | `hf-cli` | [Hugging Face Agents overview](https://huggingface.co/docs/hub/agents-overview) | official-link-only / 无 |
| `openclaw-clawhub-skills` | OpenClaw ClawHub Skills / OpenClaw | `openclaw-agent` | [ClawHub docs](https://docs.openclaw.ai/clawhub) | official-link-only / 无 |
| `hermes-agent-skills` | Hermes Agent Skills / Nous Research | `nous-hermes-agent` | [Hermes docs](https://hermes-agent.nousresearch.com/docs/)、[repository](https://github.com/NousResearch/hermes-agent) | official-link-only / 无 |
| `cline-official-skills-plugins` | Cline Skills、Plugins 与 MCP / Cline | `cline-agent` | [Cline repository](https://github.com/cline/cline)、[Cline GitHub](https://github.com/cline) | needs-first-party-review（Skill/Plugin/MCP 混合，缺固定 Skill profile） |
| `opencode-agent-skills` | OpenCode Agent Skills / Anomaly | `opencode` | [OpenCode Skills docs](https://opencode.ai/docs/skills) | official-link-only / 无 |
| `matlab-agentic-toolkit` | MATLAB Agentic Toolkit / MathWorks | `codex-cli`, `claude-code`, `github-copilot` | [MATLAB Agentic Toolkit](https://github.com/matlab/matlab-agentic-toolkit) | needs-first-party-review（工具包来源产品，不等同已验证 Skill 安装包） |
| `simulink-agentic-toolkit` | Simulink Agentic Toolkit / MathWorks | `codex-cli`, `claude-code`, `gemini-cli`, `github-copilot` | [Simulink Agentic Toolkit](https://github.com/matlab/simulink-agentic-toolkit) | needs-first-party-review（工具包来源产品，不等同已验证 Skill 安装包） |
| `nvidia-omniverse-agent-skills` | NVIDIA Omniverse Agent Skills / NVIDIA | `claude-code`, `codex-cli`, `cursor-desktop` | [NVIDIA Omniverse GitHub](https://github.com/NVIDIA-Omniverse) | needs-first-party-review（组织入口，缺直接 Skill 发布/版本证据） |
| `cesium-agent-skills` | Cesium Agent Skills / Cesium | `claude-desktop`, `claude-code`, `codex-cli`, `github-copilot` | [Cesium AI integrations](https://github.com/CesiumGS/cesium-ai-integrations/blob/main/skills/README.md) | official-link-only / 无 |
| `meshy-3d-skill` | Meshy 3D Skill / Meshy | `claude-code`, `gemini-cli`, `opencode`, `openclaw-agent` | [Meshy MCP and Skill](https://docs.meshy.ai/en/agent/mcp-and-skill) | official-link-only / 无 |
| `krea-agent-skills` | Krea Agent Skills / Krea | `claude-code`, `cursor-desktop`, `github-copilot`, `codex-cli`, `windsurf-editor`, `openclaw-agent` | [Krea Skills](https://www.krea.ai/skills) | official-link-only / 无 |

## 结论与队列

- 计数：16 个 Skill 资源；1 个 managed-ready；9 个 official-link-only；6 个 needs-first-party-review；未发现重复 resourceId、重复同一 resource 内 target productId、或可据现有 schema 判定的 duplicate/invalid。
- `anythingllm-agent-skills`、`pika-mcp-skills`、`cline-official-skills-plugins` 虽含 Skill 类型，仍按资源类型投影到 Skill 频道，但不能因此显示安装；混合类型不会复制成独立 Skill 记录。
- `matlab-agentic-toolkit` 与 `simulink-agentic-toolkit` 的 `sourceProductIds` 是 AI 可接入来源产品，不是 Skill 宿主；不得把普通产品、提示词或工作流直接提升为 Skill。
- 下一步只接受第一方直接 Skill 包/版本/宿主安装合同和对应固定 profile；未完成前保持 `resource-link + website`。后台继续只引用已批准 module/profile，不下发命令、脚本、参数或凭据。
