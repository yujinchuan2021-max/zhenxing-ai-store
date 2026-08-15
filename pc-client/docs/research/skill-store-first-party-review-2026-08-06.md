# Skill 商店事实源与一手证据复核（2026-08-06）

## 事实源与边界

唯一目录事实源为 `pc-client/admin/published/catalog-store/state.json`：`draft.revision=89`；v2 `activeCatalogVersion=6`，其发布载荷的 `draftRevision=89`。文件顶层另有 `activeCatalogVersion=72`，这是旧/全局字段；本轮按任务指定的 v2 active6 作为 Skill 事实源，未自行调和或修改。两者均为 146 个资源、4 个 ResourceStore、v2 schema。Skill 投影为 **16 resources / 34 targets / 1 managed target / 33 resource-link targets / 1 fixed profile**。本报告不把 Skill 当一级 AI 产品，只核对资源到宿主 target 的安装边界。

已有唯一受管 profile 是 `skill.codex.chatgpt-apps`：`openai-chatgpt-apps-skill` → `codex-cli`，`skill-managed` / `directory-snapshot`，固定 commit `49f948faa9258a0c61caceaf225e179651397431`，能力为 `website/install/update/repair/uninstall`。其安装范围是 Codex 用户级 Skill 目录；收据只允许对 AI Hub 写入且 hash 匹配的内容执行卸载，发现用户手工修改或新增内容即停止。权限为写入该目录；不需要凭据。

## 逐项盘点

下表的 target identity、宿主、module、profile、capabilities、versionRef 均直接取 draft89/active6；“Windows”只在官方材料明确时才成立，Git 仓库存在不构成 Windows 安装证据。

| resourceId（publisher；versionRef） | targets（productId；module/profile；capabilities） | 事实分类与 Windows/权限/生命周期边界 |
|---|---|---|
| `openai-codex-skills-catalog`（OpenAI；`rolling-directory`） | `codex-cli`; `resource-link`/空；`website` | 官方入口；无固定快照，无本地检测/安装/更新/卸载；Windows 支持未由该目录单独证明。 |
| `openai-chatgpt-apps-skill`（OpenAI；`49f948faa9258a0c61caceaf225e179651397431`） | `codex-cli`; `skill-managed`/`skill.codex.chatgpt-apps`; `website,install,update,repair,uninstall` | **managed-ready**；固定内容身份、宿主检测、收据/ownership 和用户改动保护已具备；写 Codex 用户级 Skill 目录，无凭据。 |
| `anythingllm-agent-skills`（Mintplex Labs；`rolling-directory`） | `anythingllm-desktop`; `resource-link`/空；`website` | 官方应用内 Agent Skills/flows/MCP，非单一可移植 Skill 快照；Windows 及独立生命周期未固定，仅保留官网入口。 |
| `minimax-official-skills`（MiniMax；`rolling-directory`） | `minimax-cli`; `resource-link`/空；`website` | 仅官方滚动目录；无不可变内容身份或本机生命周期合同。 |
| `pika-mcp-skills`（Pika；`rolling-directory`） | `pika-agent`; `resource-link`/空；`website` | 官方页面要求 MCP/Auth，伴随 `npx skills` 与 API key；动态创作能力、凭据和脚本超出 Skill fixed profile。 |
| `hf-agent-skills`（Hugging Face；`rolling-directory`） | `hf-cli`; `resource-link`/空；`website` | 官方入口但无固定 Skill 快照、Windows 生命周期或本地权限合同。 |
| `openclaw-clawhub-skills`（OpenClaw；`rolling-directory`） | `openclaw-agent`; `resource-link`/空；`website` | 滚动社区/目录型入口；不能证明固定版本、Windows 安装或卸载 ownership。 |
| `hermes-agent-skills`（Nous Research；`rolling-directory`） | `nous-hermes-agent`; `resource-link`/空；`website` | 官方入口；无现有 profile 可表达的固定来源与生命周期。 |
| `cline-official-skills-plugins`（Cline；`rolling-directory`） | `cline-agent`; `resource-link`/空；`website` | 官方 Skills 与 plugin/MCP 混合；文档涉及 `.cline/skills`、CLI/npm 与 `cline auth`，Windows 合同及单一 snapshot 缺失。 |
| `opencode-agent-skills`（Anomaly；`rolling-directory`） | `opencode`; `resource-link`/空；`website` | 仅滚动官方入口；无固定内容身份、检测、更新、卸载证据。 |
| `matlab-agentic-toolkit`（MathWorks；`rolling-official-service`） | `codex-cli`, `claude-code`, `github-copilot`; 各 `resource-link`/空；`website` | 官方 toolkit 会 clone 默认分支、下载 MATLAB MCP Core、写全局配置；不是单一 Skill，需 MATLAB/Git，Windows lifecycle 不可复用。 |
| `simulink-agentic-toolkit`（MathWorks；`rolling-official-service`） | `codex-cli`, `claude-code`, `gemini-cli`, `github-copilot`; 各 `resource-link`/空；`website` | 官方 MATLAB/Simulink installer 与 Skills Catalog；复合工具包、配置副作用、无单一 hash，不能受管。 |
| `nvidia-omniverse-agent-skills`（NVIDIA；`rolling-official-service`） | `claude-code`, `codex-cli`, `cursor-desktop`; 各 `resource-link`/空；`website` | 官方 NVIDIA skills 身份已确认，但目录每日同步、需 `npx skills`，当前资源没有单一 skill name/commit/file hash；保留链接。 |
| `cesium-agent-skills`（Cesium；`rolling-official-service`） | `claude-desktop`, `claude-code`, `codex-cli`, `github-copilot`; 各 `resource-link`/空；`website` | 官方/实验性 skills，需审查 directives、版本和代码生成范围；无固定 profile 或 Windows lifecycle。 |
| `meshy-3d-skill`（Meshy；`rolling-official-docs`） | `claude-code`, `gemini-cli`, `opencode`, `openclaw-agent`; 各 `resource-link`/空；`website` | 官方生成能力会消耗 quota、需 Meshy API key；不是只读、无现有固定 profile。 |
| `krea-agent-skills`（Krea；`rolling-official-repository`） | `claude-code`, `cursor-desktop`, `github-copilot`, `codex-cli`, `windsurf-editor`, `openclaw-agent`; 各 `resource-link`/空；`website` | 官方生成/增强能力会消耗 quota，需 Krea token；无固定 snapshot 与 Windows lifecycle。 |

## 一手证据与结论

六项上一轮 needs-review 的官方证据： [AnythingLLM 官方仓库](https://github.com/Mintplex-Labs/anything-llm) / [releases](https://github.com/Mintplex-Labs/anything-llm/releases)；[Pika MCP 官方页](https://experiment.pika.art/mcp)；[Cline Skills 文档](https://docs.cline.bot/customization/skills)、[CLI changelog](https://github.com/cline/cline/blob/main/apps/cli/CHANGELOG.md)；[MATLAB toolkit](https://github.com/matlab/matlab-agentic-toolkit)；[Simulink toolkit](https://github.com/simulink/simulink-agentic-toolkit)；[NVIDIA skills 仓库](https://github.com/NVIDIA/skills)、[NVIDIA 文档](https://docs.nvidia.com/skills)、[advanced install](https://docs.nvidia.com/skills/advanced-install)。这些材料确认官方身份，但未同时提供“单一 Skill + 不可变来源 + 现有固定宿主适配器 + Windows install/update/repair/uninstall + 不采集凭据”的完整合同。

因此本轮新增进入客户端固定-profile 审核队列的候选为 **0**。16 项中只有 `openai-chatgpt-apps-skill` 已经是可复用的受管闭环；其余保持 `resource-link`，只显示官网/教程，不显示安装、启停、更新、卸载。最接近下一轮的是 NVIDIA 或 MathWorks 的单一 Skill snapshot，但必须由官方先给出固定 skill name、不可变 commit/文件哈希、宿主路径和 Windows 生命周期；Skill 商店不自行推断或下发 CLI。下一步若满足条件，由后台负责 profile/schema 审核，CLI/宿主员工负责 Windows 检测与生命周期实现，Skill 商店负责官方证据和资源 target，当前没有可交付的实现责任人。

本轮未修改代码、catalog、state、history；未调用 saveDraft，未安装、登录、下载大文件、封包或发布。
