# Skill needs-first-party-review batch（2026-08-05）

本轮复核原 Skill 审计中的 6 项 `needs-first-party-review`：`anythingllm-agent-skills`、`pika-mcp-skills`、`cline-official-skills-plugins`、`matlab-agentic-toolkit`、`simulink-agentic-toolkit`、`nvidia-omniverse-agent-skills`。仅使用发布者官方文档/官方仓库；未下载、未安装、未登录、未运行安装命令，未修改 catalog/state，也未调用 `saveDraft`。

## 准入合同

现有唯一 Skill managed 原语是 `skill.codex.chatgpt-apps` / `directory-snapshot`：固定 Codex 宿主、固定资源身份、固定 source snapshot、固定版本哈希、收据 ownership，以及 install/update/repair/uninstall。候选必须能在不下发命令、脚本、任意 URL、headers 或凭据的情况下表达；动态远程目录、滚动内容、需要用户认证、需要任意 CLI/plugin 脚本，或没有 Windows 生命周期合同的项目不进入受管候选。

## 逐项第一方复核

| resourceId | 官方确认的 Skill 身份/发布者 | 版本与来源 | 宿主 / Windows 生命周期 / 权限凭据 | 结论 |
|---|---|---|---|---|
| `anythingllm-agent-skills` | AnythingLLM 官方仓库说明有 Agent Skills、Skill Selection 与 MCP；发布者 Mintplex Labs。 [官方仓库](https://github.com/Mintplex-Labs/anything-llm) | 官方说明描述应用内 skills/flows，没有单一 Skill 包、不可变版本或文件清单；release 内容随应用版本变化。 [官方 releases](https://github.com/Mintplex-Labs/anything-llm/releases) | 宿主是 AnythingLLM Desktop/实例内 agent，不是现有 Codex `agent-skills` 目录；官方材料未给出本项目可复用的 Windows Skill install/update/remove 合同。权限由 AnythingLLM workspace/agent 配置决定。 | **official-link-only / blocked**：混合 Skill/MCP、应用内动态内容、无固定 profile 原语。 |
| `pika-mcp-skills` | Pika 官方页面明确称 Pika Skills 与 companion skills plugin；发布者 Pika / Pika Labs。 [官方 MCP 页面](https://experiment.pika.art/mcp) | 官方指向 `Pika-Labs/Pika-Skills`，并要求通过 `npx skills add Pika-Labs/Pika-Plugins`；页面描述持续滚动新增 Skills，未锁定单一版本/目录快照。 [官方页面](https://experiment.pika.art/mcp) | 需要先连接 Pika MCP、完成 Auth；官方 API 还要求 Pika Agent API key。宿主/权限包含创作、编辑、搜索等工具，不是只读 Skill；Windows 安装/更新/停用/移除合同未固定。 | **official-link-only / blocked**：认证、动态远程内容、npx/plugin 脚本、能力非只读。 |
| `cline-official-skills-plugins` | Cline 官方文档定义 Skills 为模块化指令集；Cline CLI changelog 增加 `cline skill` 安装管理。 [Skills docs](https://docs.cline.bot/customization/skills) · [官方 changelog](https://github.com/cline/cline/blob/main/apps/cli/CHANGELOG.md) | 官方 CLI 版本记录为 3.0.27 的 skill 命令；来源可为 Cline agent directory 或 CLI 管理内容，但本资源同时混合 Skill/Plugin/MCP，未给单一不可变 Skill snapshot。 | 官方目录为 `.cline/skills/` 或 `~/.cline/skills/`；CLI 安装指南标注 CLI 为 macOS/Linux preview，且需 `npm install -g cline` 与 `cline auth`。现有客户端没有 Cline 固定 Skill profile。 | **official-link-only / blocked**：宿主不在现有 profile、Windows 支持/生命周期不满足、安装涉及 npm/CLI 与认证。 |
| `matlab-agentic-toolkit` | MathWorks 官方仓库明确提供 curated skills，发布者 MathWorks；支持 Claude Code、GitHub Copilot、OpenAI Codex、Gemini CLI、Sourcegraph Amp。 [官方仓库](https://github.com/matlab/matlab-agentic-toolkit) | 官方 quickstart 使用默认分支 `git clone`，setup 会下载 MATLAB MCP Core Server、写入 agent 全局配置并注册 skills；仓库虽有 releases，但本资源没有选定单一 Skill、commit 和文件哈希。 | 要求 MATLAB R2020b+、Git 与 AI coding agent；官方说明包含全局配置写入、MCP server 下载和 Claude plugin marketplace 路径。Windows 单独 install/update/repair/uninstall 合同未固定，且权限涉及 MATLAB/MCP 工具。 | **official-link-only / blocked**：工具包/MCP/Skill 复合安装、依赖与写配置、未锁定单一 snapshot，不能映射现有 Skill profile。 |
| `simulink-agentic-toolkit` | Simulink 官方仓库明确提供 Skills Catalog，发布者 MathWorks/Simulink。 [官方仓库](https://github.com/simulink/simulink-agentic-toolkit) | 官方仓库给出 Skills Catalog 与 setup 文档入口，但本资源未选定单一 Skill、不可变 commit 或完整文件清单；安装器可同时配置 MATLAB 与 Simulink toolkits。 | 需要 MATLAB R2023a+ 与 Simulink；官方材料描述 MATLAB-based installer 和多工具包配置，未提供现有 `directory-snapshot` 可复用的 Windows 生命周期合同。 | **official-link-only / blocked**：复合工具包、MATLAB installer/配置副作用、未锁定单一 snapshot。 |
| `nvidia-omniverse-agent-skills` | NVIDIA 官方已发布 NVIDIA-verified Agent Skills；Skills 是带 `SKILL.md` 的可移植指令集，发布者 NVIDIA。 [官方仓库](https://github.com/NVIDIA/skills) · [官方文档](https://docs.nvidia.com/skills) | 官方 catalog 由产品仓库每日同步；单个 skill 可用 `--skill` 选择，仓库给出 catalog commit/签名体系，但当前资源指向 NVIDIA Omniverse 组织入口，未选定具体 skill name、commit、文件哈希。 | 官方支持 Codex/Claude Code/Cursor 等；安装依赖 `npx skills`，要求 CLI ≥1.5.16，可 project/global install、update/remove。 [Advanced install](https://docs.nvidia.com/skills/advanced-install) 这不是现有固定 bundled snapshot，也不是本项目已批准的命令原语。 | **official-link-only / blocked**：官方身份已确认，但资源粒度过宽、每日同步动态、需要 npx CLI；待选定单一 skill + immutable source 后再审。 |

## 候选与后续

- 本批 **受管候选 0 项**；6 项均保留 `resource-link` / `website`，不得显示一键安装、启停、更新或卸载。
- 最接近未来复核的是 NVIDIA 单一 skill 或 MathWorks 单一 skill snapshot，但必须先取得官方固定 skill name、不可变 commit/哈希、明确宿主目录和 Windows lifecycle；不能由后台自行推断或下发 CLI。
- Pika、Cline、MATLAB/Simulink 与 AnythingLLM 的 MCP、plugin、应用配置或凭据合同不得从 Skill 频道复制；同一 resource 的多类型仍由 `ResourceStore(kind)` 投影，不复制身份。
