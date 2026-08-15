# Skill 固定 profile 候选复核（draft89 / v2 active6）

## 结论

候选数量：**0**。本轮从 33 个 `resource-link` targets 逐项筛选，未发现同时满足官方一手来源、不可变版本/可审核快照、明确宿主与目标目录、无需秘密、可精确生命周期检测及 AI Hub 收据 ownership 的项目。因此 no-op：不新增 profile，不改变任何 target。

唯一已满足闭环的是现有 `openai-chatgpt-apps-skill` → `codex-cli` → `skill.codex.chatgpt-apps`，不属于本轮候选。

## 逐项阻断

下列身份、宿主和官网直接来自 `state.json` draft89/v2 active6；所有 target 当前均为 `resource-link`、空 profile、`website` capability。Windows 支持不从仓库存在推断。

| resourceId / publisher | 宿主 targets | 官方来源与可核查事实 | 权限/生命周期/收据阻断 |
|---|---|---|---|
| `openai-codex-skills-catalog` / OpenAI | `codex-cli` | [OpenAI Skills](https://github.com/openai/skills)；rolling-directory | 没有单一不可变 Skill；目录滚动，不能固定内容哈希或卸载 ownership。 |
| `anythingllm-agent-skills` / Mintplex Labs | `anythingllm-desktop` | [官方仓库](https://github.com/Mintplex-Labs/anything-llm)、[文档](https://docs.anythingllm.com/)；应用内 Skills/flows/MCP | 不是单一 portable Skill；应用管理状态，Windows install/update/remove 合同和精确收据缺失。 |
| `minimax-official-skills` / MiniMax | `minimax-cli` | [官方 skills 仓库](https://github.com/MiniMax-AI/skills)；安装说明使用 clone/symlink 并按宿主目录配置 | 默认分支、仓库集合而非固定 snapshot；涉及 git/symlink/宿主配置，现有 profile 无 `minimax-cli` 检测与 ownership。 |
| `pika-mcp-skills` / Pika | `pika-agent` | [Pika 官方 MCP 页](https://experiment.pika.art/mcp)；Skills 与 companion plugin/MCP | 需要 Auth/API key，动态创作工具，`npx`/插件脚本；秘密、远端状态和非只读权限均阻断。 |
| `hf-agent-skills` / Hugging Face | `hf-cli` | [官方 Agents 文档](https://huggingface.co/docs/hub/en/agents-overview)；插件安装和 `HF_TOKEN` 登录 | 需要 token；插件/CLI 宿主远端安装，未给单一 immutable Skill、Windows 目录及 AI Hub receipt 合同。 |
| `openclaw-clawhub-skills` / OpenClaw | `openclaw-agent` | [ClawHub](https://docs.openclaw.ai/tools/clawdhub)、[Skills](https://docs.openclaw.ai/skills)；支持 semver、lock/origin、install/update/remove | 依赖 OpenClaw/ClawHub CLI 和远端 registry；可含 env/权限声明，宿主不在现有固定 profile，不能由后台下发命令或接管市场状态。 |
| `hermes-agent-skills` / Nous Research | `nous-hermes-agent` | [Hermes 官方文档](https://hermes-agent.nousresearch.com/docs/)、[仓库](https://github.com/NousResearch/hermes-agent) | 没有确定单一 Skill 包、固定版本、Windows 目标目录或可复用检测/收据。 |
| `cline-official-skills-plugins` / Cline | `cline-agent` | [Skills 文档](https://docs.cline.bot/customization/skills)、[官方仓库](https://github.com/cline/cline) | 混合 Skill/Plugin/MCP；CLI/npm/auth 和宿主预览状态，缺现有 profile 与 Windows 生命周期。 |
| `opencode-agent-skills` / Anomaly | `opencode` | [官方 Skills 文档](https://opencode.ai/docs/skills)；仅说明 project/global 目录发现 | 文档是目录约定而非发行快照/安装器；无固定版本、检测、更新、卸载 ownership，宿主无现有 profile。 |
| `matlab-agentic-toolkit` / MathWorks | `codex-cli`, `claude-code`, `github-copilot` | [MATLAB toolkit](https://github.com/matlab/matlab-agentic-toolkit)；clone 默认分支、下载 MCP Core、写全局配置 | 复合 toolkit/MCP，不是单一 Skill；需 MATLAB/Git，写配置并有工具权限，无法精确 receipt/uninstall。 |
| `simulink-agentic-toolkit` / MathWorks | `codex-cli`, `claude-code`, `gemini-cli`, `github-copilot` | [Simulink toolkit](https://github.com/matlab/simulink-agentic-toolkit)；MATLAB-based installer 与 Skills Catalog | 复合安装、依赖 MATLAB/Simulink、配置副作用；无单一 immutable Skill 或现有宿主 profile。 |
| `nvidia-omniverse-agent-skills` / NVIDIA | `claude-code`, `codex-cli`, `cursor-desktop` | [NVIDIA skills](https://github.com/NVIDIA/skills)、[文档](https://docs.nvidia.com/skills)、[advanced install](https://docs.nvidia.com/skills/advanced-install)；目录动态同步，npx CLI | 官方身份成立但当前资源只是 Omniverse 组织入口，未选定 skill name/commit/file hash；npx CLI 和远端目录不具备本地 receipt 合同。 |
| `cesium-agent-skills` / Cesium | `claude-desktop`, `claude-code`, `codex-cli`, `github-copilot` | [Cesium AI integrations](https://github.com/CesiumGS/cesium-ai-integrations/blob/main/skills/README.md) | 实验性/代码生成 directives 需逐项审查；无固定 snapshot、宿主目录及安全卸载边界。 |
| `meshy-3d-skill` / Meshy | `claude-code`, `gemini-cli`, `opencode`, `openclaw-agent` | [Meshy MCP and Skill](https://docs.meshy.ai/en/agent/mcp-and-skill) | 生成能力会消耗 quota，需要 Meshy API key；非只读、无现有 profile 与 receipt ownership。 |
| `krea-agent-skills` / Krea | `claude-code`, `cursor-desktop`, `github-copilot`, `codex-cli`, `windsurf-editor`, `openclaw-agent` | [Krea Skills](https://www.krea.ai/skills) | 生成/增强能力会消耗 quota，需要 token；动态仓库/宿主集合，无固定 snapshot、Windows lifecycle 或现有 profile。 |

## 责任与下一步

- 当前无实现候选，Skill 商店 no-op；不应创建新的 adapter/profile。
- 若官方将来提供合格单一 Skill：Skill 商店负责证据、版本与 target；后台负责 profile/schema 审核；CLI/宿主员工负责 Windows detect/install/update/repair/uninstall；由 CTO 协调依赖。
- 本轮未修改代码、catalog、state、history；未 saveDraft、publish、package、download 或 install。
