# CLI/Agent 官方安装事实研究

研究范围：authoritative draft 78 中 9 个无客户端 profile 的 `cli-official` 产品。仅采用项目官方文档、官方 GitHub 仓库或官方发布页；未安装、未登录、未执行安装命令。结论中的“可映射”只表示安装形态与现有 driver 类型相符，不表示已批准执行。

| productId | 官方身份与 Windows 支持 | 官方入口/身份/环境 | 生命周期证据 | 现有 driver 判断 |
|---|---|---|---|---|
| `cursor-cli` | 官方 Cursor CLI/Agent；支持 macOS、Linux、Windows **WSL**，未见原生 Windows 路径。[安装文档](https://docs.cursor.com/en/cli/installation) | 固定入口 `https://cursor.com/install`，安装 `cursor-agent`；文档未给固定包版本或制品哈希。 | 启动 `cursor-agent`；更新 `cursor-agent update/upgrade`；未在该官方 CLI 文档找到卸载/修复合同。 | **WSL driver 可研究**；因缺卸载/修复与固定制品，当前 blocked。 |
| `nvidia-nemoclaw-cli` | 官方 NemoClaw/OpenShell 沙箱 CLI；Windows 通过 WSL 2，依赖 Docker Desktop；非原生 Windows CLI。[Windows 准备](https://docs.nvidia.com/nemoclaw/latest/get-started/windows-setup.html) | 官方 bootstrap PowerShell 脚本；WSL Ubuntu 24.04、Docker Desktop WSL 集成，Ollama 可选。[官方仓库](https://github.com/NVIDIA/NemoClaw) | 仓库提供官方 `install.sh` 与 `uninstall.sh`；修复需按 Windows 准备/Quickstart 重新检查 WSL/Docker。 | **WSL/服务复合体**；超出单一现有 driver，blocked。 |
| `nous-hermes-agent` | 官方 Hermes Agent；Windows 原生仅 Early Beta，也支持 WSL2。[Windows 原生指南](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/windows-native.md) | PowerShell `install.ps1`；自动引入 uv、Python 3.11、Node 22、PortableGit、venv、ffmpeg/ripgrep；无固定 MSI/版本制品。 | `hermes` 启动；`hermes doctor` 修复诊断；官方文档给出卸载数据目录方式，但没有稳定客户端安装合同。[官方仓库](https://github.com/NousResearch/hermes-agent) | 依赖复合体（Python+Node+Git+浏览器）；不能安全归入单一 portable/python driver，blocked。 |
| `tabnine-cli` | 官方 Tabnine CLI；Windows 原生 PowerShell、macOS/Linux/WSL；需 Tabnine Agents 与 Tabnine host。[安装文档](https://docs.tabnine.com/main/getting-started/tabnine-cli/getting-started/installation) | Node.js 22+；从租户 host 的 `/update/cli/installer.mjs` 安装，非公共固定 npm 包/制品。 | `tabnine` 启动并浏览器认证；更新为重跑 installer；Windows 卸载为删除安装目录并清理 PATH。 | 不能安全映射 npm（host/认证/动态 installer）；blocked。 |
| `browser-use-cli` | 官方 Browser Use CLI；Windows 需要 Git for Windows、Python 3.11+，使用 Chrome/CDP；同时有 Python library。[CLI 源码说明](https://github.com/browser-use/browser-use/blob/main/browser_use/skill_cli/README.md) | 官方 shell installer；手动 `uv pip install browser-use`、`browser-use install` 安装 Chromium；非固定 MSI/portable 制品。 | `browser-use doctor/setup`；启动/关闭为官方 CLI 命令；故障文档给出删除 venv 后重装，未提供独立卸载器。 | 可明显复用 **python-venv** 的部分，但还需 Git/Chromium/daemon；当前 driver 合同不足，blocked。 |
| `openmanus-cli` | 官方 OpenManus CLI/框架；仓库提供 Windows venv 路径，非桌面产品。[官方 README](https://github.com/FoundationAgents/OpenManus/blob/main/README.md) | `uv venv --python 3.12`、`uv pip install -r requirements.txt`；可选 `playwright install`；源码仓库而非固定发布制品。 | README 给出启动入口与配置，但未给统一 update/repair/uninstall 命令。 | **python-venv 候选**；因依赖/配置/Playwright 生命周期不完整，暂 blocked，需 CLI 员工审核。 |
| `metagpt-framework` | 官方 MetaGPT 多智能体 CLI/框架；官方仓库明确可 CLI 使用。[官方仓库](https://github.com/FoundationAgents/MetaGPT) | Python 3.9 至 `<3.12`，`pip install metagpt`；另需 Node.js 与 pnpm；可用 Docker 文档。 | `metagpt --init-config` 与 CLI 启动有记录；未见统一 update/repair/uninstall 合同。 | Python 虚拟环境之外还需 Node/pnpm（或 Docker），不能安全映射单一 python-venv，blocked。 |
| `mini-swe-agent-cli` | 官方 mini-SWE-agent CLI/库；Python CLI，官方仓库提供多种安装路径。[官方仓库](https://github.com/SWE-agent/mini-swe-agent) | `uvx mini-swe-agent`、`pip install mini-swe-agent` 或源码 editable 安装；未给 Windows 专用二进制。 | `mini` 启动；更新依赖重新运行 pip/uv；未见独立修复/卸载合同。 | **python-venv 候选**；包身份固定为 PyPI `mini-swe-agent`，但仍需 profile 审核，暂 blocked。 |
| `anytype-cli` | 官方 Anytype CLI，Go 编译的 headless server/CLI；Windows user service 支持。[官方仓库](https://github.com/anyproto/anytype-cli) | 官方 `install.sh`；源码构建需 Go 1.25+、Git、Make、C 编译器；仓库未提供本轮可核验的固定 Windows MSI/portable release。 | `anytype serve`；`anytype service install/start/stop/uninstall`；`anytype update`；官方支持服务生命周期。 | 形态接近 **portable-binary**，但缺固定 Windows 制品与 checksum，当前 blocked。 |

## 汇总

- 可直接进入现有 driver 评审的候选：`openmanus-cli`、`mini-swe-agent-cli`（python-venv），`cursor-cli`（WSL）；共 3 个，但均未获安装批准。
- 明确需要复合环境或缺固定制品/生命周期合同而 blocked：6 个（`nvidia-nemoclaw-cli`、`nous-hermes-agent`、`tabnine-cli`、`browser-use-cli`、`metagpt-framework`、`anytype-cli`）。
- 本报告没有把官方网页、桌面产品或动态脚本推断成可发布安装 profile；后续需 CLI 员工补齐固定版本、校验、修复与卸载合同。
