# Windows CLI 统一一键安装审计

日期：2026-07-31

范围：`admin/data/catalog-v1.json` 中当前 `productType = cli` 或 `cli-official` 的 16 个产品。

平台：AI Hub PC 当前只面向 Windows；本文件不把 WSL 发行物当成原生 Windows 发行物。

## 1. 审计口径

本次只接受厂商官方文档、厂商官方 GitHub 仓库/Release、npm 官方注册表和 PyPI 官方元数据。结论回答六个问题：Windows 是否受支持、安装来源能否固定、当前版本能否固定、依赖是什么、如何检测/启动/卸载，以及是否达到 AI Hub 一键安装门槛。

统一安全边界：

- 后台只选择客户端已经内置的 `installProfileId` 和有限结构化参数；不得下发包名、URL、PowerShell、CMD、Shell 或 npm/pip 参数。
- 安装器只接受客户端白名单中的固定版本、固定域名、固定架构和固定哈希/SRI；后台不能把 `latest` 改成任意产物。
- 不执行 `irm ... | iex`、`curl ... | bash` 等在线可变脚本；可以读取脚本理解厂商流程，但客户端必须实现等价的结构化动作。
- npm/PyPI 工具安装到 AI Hub 自有 prefix/venv，并由 AI Hub 创建 shim；不污染系统全局环境。
- 生命周期脚本默认禁用。确实属于产品启动必要条件时，必须升级为专用模块并逐条审计副作用。
- 卸载只清理 receipt 记录的模块文件、shim、PATH 和服务；默认保留账号、凭据、会话、配置、项目、Skill/MCP 和模型数据。
- 只有用户点击安装后才检测 Node、Python、Git、WSL 等环境；浏览目录时不探测。

## 2. 结论总览

| # | 当前 catalog 产品 | 2026-07-31 审计版本 | Windows | 一键安装结论 | 推荐模块 |
| --- | --- | --- | --- | --- | --- |
| 1 | Codex CLI | `0.146.0` | 原生 x64/ARM64 | **批准** | 固定 GitHub Release EXE，AI Hub 自管 shim |
| 2 | Claude Code | npm `2.1.220` | Windows 10 1809+；原生安装无强制 Node/Git | **有条件批准** | 优先官方原生/WinGet；npm 路线才要求 Node 22 |
| 3 | comfy-cli | `1.13.0` | Python 可运行 | **有条件批准** | AI Hub 私有 Python venv + 完整 hash lock |
| 4 | Gemini CLI | `0.53.0` | Windows 11 24H2+、Node 20+ | **批准** | 固定 npm 包 + SRI，自有 prefix |
| 5 | Antigravity CLI | `1.1.9` | 原生 x64/ARM64 | **批准** | 固定单文件 + SHA-512；关闭自动更新 |
| 6 | GitHub Copilot CLI | `1.0.77` | 原生 x64/ARM64 | **批准** | 固定官方 Release ZIP + SHA-256 |
| 7 | Cursor CLI | 官方仅 Windows WSL | 非原生 | **暂缓** | 以后单独做 WSL 模块；当前只开官方文档 |
| 8 | Kimi Code CLI | 客户端已固定 `0.31.1` | 原生 x64/ARM64；需要 Git Bash | **批准** | 固定单文件 + SHA-256；关闭自动更新 |
| 9 | Qwen Code | `0.21.2` | Node 跨平台 | **有条件批准** | 固定 npm 包 + SRI；禁用可选原生安装脚本 |
| 10 | Qoder CN CLI | `1.1.10` | Windows、Node 20+ | **阻塞：须先修错包** | 正确包是 `@qodercn-ai/qoderclicn`，需专用 postinstall 审计 |
| 11 | Kiro CLI | `2.16.0` | Windows 11 x64 | **批准** | 固定官方 MSI + SHA-256；关闭自动更新 |
| 12 | Mistral Vibe CLI | `2.23.2` | Python 3.12+ | **有条件批准** | 私有 venv/uv + 完整依赖锁 |
| 13 | MiniMax CLI | `mmx-cli@1.0.18` | Node 跨平台 | **批准** | 固定 npm 包 + SRI；命令是 `mmx` |
| 14 | Hugging Face CLI | `hf@1.26.0` / `huggingface_hub@1.26.0` | Windows | **有条件批准** | 私有 venv + 完整依赖锁；命令是 `hf` |
| 15 | OpenClaw | `2026.7.1-2` | Windows/Node；可安装服务 | **有条件批准，专用高权限模块** | 固定 npm + 专用 onboarding/service/卸载流程 |
| 16 | Hermes Agent | `0.19.0` | Windows 原生 beta | **暂缓** | 只有完成多产物 allowlist 后才做专用模块 |

当前可直接进入实现队列 7 项：Codex、Gemini、Antigravity、GitHub Copilot、Kimi、Kiro、MiniMax。另有 6 项需要专用或隔离模块后才能上线；Qoder CN、Cursor 和 Hermes 当前不应显示“一键安装”。

## 3. 每项安装合同

### 3.1 OpenAI Codex CLI

- Windows/来源：官方仓库同时给出 npm、Windows PowerShell 安装和 Release 直链；当前 Release 为 `rust-v0.146.0`。[官方仓库](https://github.com/openai/codex) / [官方 CLI 文档](https://developers.openai.com/codex/cli/) / [官方 Release](https://github.com/openai/codex/releases/tag/rust-v0.146.0)
- 推荐固定产物：x64 `codex-x86_64-pc-windows-msvc.exe`，SHA-256 `bc343ba420dc2e2e9f59e6fc5e5bf0aae1cd8c771fc319665241fc9c0271fddb`；ARM64 `codex-aarch64-pc-windows-msvc.exe`，SHA-256 `d52efa1d816b305c84c525335f451aafc56398a7e8515b6c6db095c4e4fb0d1d`。均来自上述 GitHub Release 的第一方 asset digest。
- npm 备选：`@openai/codex@0.146.0`，Node `>=16`，入口 `codex`；包记录含 registry signature 和 provenance。[npm 元数据](https://registry.npmjs.org/%40openai%2Fcodex/0.146.0)
- 动作：检测 `codex --version`；启动 `codex`；卸载仅删除 AI Hub 自有 EXE/shim/PATH，保留用户配置和登录。
- 结论：**批准**。Windows 首选无 Node 依赖的固定 EXE，不必继续沿用通用 npm profile。

### 3.2 Anthropic Claude Code

- Windows/依赖：当前官方安装页要求 Windows 10 1809+；原生 Windows 安装没有强制 Node 或 Git，Git for Windows 只是可选增强。只有 npm 路线要求 Node `>=22`。[官方安装文档](https://code.claude.com/docs/en/installation) / [npm 元数据](https://registry.npmjs.org/%40anthropic-ai%2Fclaude-code/2.1.220)
- 固定源：官方优先提供原生安装/WinGet。若暂时沿用 npm，则必须锁定 `@anthropic-ai/claude-code@2.1.220`，入口 `claude`，Windows 主程序为 `bin/claude.exe`；主包带 `postinstall: node install.cjs`，并有 Windows x64/ARM64 optional packages。
- 动作：检测 `claude --version`（诊断可用 `claude doctor`）；启动 `claude`；固定版本模式设置 `DISABLE_AUTOUPDATER=1` 或执行官方配置 `claude config set autoUpdates false --global`；卸载自有 prefix/shim，保留用户数据。
- 结论：**有条件批准**。建议迁移到经固定版本/完整性审核的原生或 WinGet 专用模块，并移除 catalog 中过时的强制 `node,git` 依赖；若保留 npm，必须用 Claude 专用模块审计/替代 postinstall。

### 3.3 Comfy Org comfy-cli

- Windows/来源：官方项目通过 PyPI 发布 `comfy-cli`，Python 要求 `>=3.10`；命令为 `comfy`。[官方仓库](https://github.com/Comfy-Org/comfy-cli) / [PyPI 1.13.0](https://pypi.org/pypi/comfy-cli/1.13.0/json)
- 固定源：`comfy_cli-1.13.0-py3-none-any.whl`，SHA-256 `190108e4fa4fba44916f12eedbaca9ea685c2f9924c4370210092ccd17e6e5a8`。
- 动作：在 AI Hub 私有 venv 安装完整 hash-lock；检测 `comfy --version`，如该版本行为异常则用 `comfy --help` 作为存活检测；普通 CLI 入口是 `comfy`，真正启动本地 ComfyUI 使用 `comfy launch`，两者不能在“安装完成”时隐式执行；卸载删除自有 venv/shim，保留 ComfyUI 工作区、模型和 Custom Nodes。
- 结论：**有条件批准**。不能全局 pip；主 wheel 的哈希不足以覆盖传递依赖，必须先生成并复核 Windows 完整 lock。

### 3.4 Google Gemini CLI

- Windows/来源：官方当前安装页列出 Windows 11 24H2+ 和 Node 20+，官方仓库给出 npm 安装和 `gemini` 入口。[官方安装文档](https://geminicli.com/docs/get-started/installation/) / [官方仓库](https://github.com/google-gemini/gemini-cli) / [npm 元数据](https://registry.npmjs.org/%40google%2Fgemini-cli/0.53.0)
- 固定源：`@google/gemini-cli@0.53.0`，Node `>=20`，npm SRI `sha512-2taA43ERjByp8uqBcMNPmKPeSoNyXBnTUVAaHWu3Bw1sN1nS+PsgY4+5V0hX2Iu4DHX1fO2tPjWzO+fJb3Sew==`，无 install/postinstall 生命周期脚本。
- 动作：检测 `gemini --version`；启动 `gemini`；按官方卸载语义清理同一自有 prefix 中的固定包和 shim，保留用户配置/认证。[官方卸载文档](https://geminicli.com/docs/resources/uninstall/)
- 结论：**批准**。

### 3.5 Google Antigravity CLI

- Windows/来源：官方提供 Windows x64/ARM64 单文件和带 SHA-512 的机器可读 manifest。[官方入门](https://antigravity.google/docs/cli-getting-started) / [x64 manifest](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json) / [ARM64 manifest](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_arm64.json)
- 固定源：`1.1.9`。x64 SHA-512 `ea4e55761b8252dcf5e051c61b1cdae1dcafcb9b8a76672aab13a2e8407fd8ae9fa5a389449f594c2fc970991afd5188a4bead1b06fe86dbb096ac2472893af1`；ARM64 SHA-512 `e9ee3960b023adec8bf6add28339bd9ab7cddf01f6d4e9374dc134faa21a44d195a0cb8dd5a0e308e37137f38a631630fec5094662cda13eadce26b009f853f4`。
- 动作：检测 `agy --version`；启动 `agy`；AI Hub 启动进程时设置 `AGY_CLI_DISABLE_AUTO_UPDATE=true`；卸载自有二进制/shim/PATH，保留 `~/.gemini/antigravity-cli`。
- 结论：**批准**；当前客户端的 `1.1.9` 白名单仍匹配审计版本。

### 3.6 GitHub Copilot CLI

- Windows/依赖：官方支持 Windows，npm 路线要求 Node 22+，PowerShell 路线要求 PowerShell 6+；命令为 `copilot`。[官方安装文档](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli) / [npm 元数据](https://registry.npmjs.org/%40github%2Fcopilot/1.0.77)
- 推荐固定产物：官方 Release `v1.0.77` 的 `copilot-win32-x64.zip`，SHA-256 `721f8d5c35b4af239399c408c8e7910bf82d674773201e3abf4983eaaa662215`；ARM64 ZIP SHA-256 `89f3ca3db7966002a0b4ff3fe59d548c365821de1060979d7f9d9b0be82e79fc`。[官方 Release](https://github.com/github/copilot-cli/releases/tag/v1.0.77)
- 动作：检测 `copilot --version`；启动 `copilot`；卸载自有目录/shim/PATH，保留 GitHub 登录信息和用户配置。
- 结论：**批准**。优先固定 ZIP，避免引入 Node 环境。

### 3.7 Anysphere Cursor CLI

- Windows/来源：官方只声明 macOS、Linux 和 Windows (WSL)，入口是 `cursor-agent`；未提供原生 win32 发行物。[官方安装文档](https://docs.cursor.com/en/cli/installation) / [认证文档](https://docs.cursor.com/en/cli/reference/authentication)
- 完整性：官方 `https://cursor.com/install` 脚本下载 tar.gz，但未提供可供客户端 fail-closed 的发布哈希/签名，并默认参与产品自己的更新流程。[官方安装脚本](https://cursor.com/install)
- 动作：WSL 中可检测/启动 `cursor-agent`；官方未给出稳定卸载命令。
- 结论：**暂缓**。当前 Windows 原生客户端不得显示“一键安装”；以后把 WSL 作为环境模块后，仍需先解决固定产物完整性和卸载边界。

### 3.8 Moonshot Kimi Code CLI

- Windows/依赖：官方支持 Windows PowerShell，运行依赖 Git for Windows/Git Bash，入口 `kimi`。[官方入门](https://www.kimi.com/code/docs/kimi-code-cli/guides/getting-started.html) / [官方仓库](https://github.com/MoonshotAI/kimi-code)
- 固定源：客户端当前固定 `0.31.1` 的 x64/ARM64 官方单文件，并记录各自 SHA-256；官方安装脚本同样读取版本化 manifest 后校验。[官方 PowerShell 安装器](https://code.kimi.com/kimi-code/install.ps1) / [0.31.1 manifest](https://code.kimi.com/kimi-code/binaries/0.31.1/manifest.json)
- 动作：检测 `kimi --version`；启动 `kimi`；设置 `KIMI_CODE_NO_AUTO_UPDATE=1`；卸载自有 EXE/shim/PATH，保留 Kimi 用户数据。
- 结论：**批准**。安装适配器必须继续使用固定 artifact+hash，不执行在线脚本，也不能跟随 latest 静默漂移。

### 3.9 Alibaba Qwen Code

- Windows/来源：官方仓库明确列出 Windows PowerShell 安装、npm 安装和 `qwen` 入口。[官方仓库](https://github.com/QwenLM/qwen-code) / [npm 元数据](https://registry.npmjs.org/%40qwen-code%2Fqwen-code/0.21.2)
- 固定源：`@qwen-code/qwen-code@0.21.2`，Node `>=22`，npm SRI `sha512-7XgYwENgztwjmOPvB3e3KdYnmkbcju9p0yV8mENv9ZC6wF5U7Dw3CdBXvAyfL9+wNrPILFXSf1+R+T0uMjojeA==`。主包没有 install/postinstall，但 optional `@qwen-code/audio-capture` 有安装脚本。
- 动作：固定主包及平台 optional 包，使用 `--ignore-scripts`；检测 `qwen --version`；启动 `qwen`；卸载自有 prefix/shim，保留配置和认证。
- 结论：**有条件批准**。首版可以牺牲可选语音捕获，避免执行未单独批准的原生生命周期脚本。

### 3.10 Alibaba Qoder CN CLI

- Windows/来源：当前 catalog 写的是 **Qoder CN CLI**，必须使用阿里云中国版文档和中国版包，不能误用国际版 Qoder。[Qoder CN 官方文档](https://www.alibabacloud.com/help/en/lingma/qodercli-cn/user-guide/qoder-cli-cn-get-started-quickly) / [npm 元数据](https://registry.npmjs.org/%40qodercn-ai%2Fqoderclicn/1.1.10)
- 固定源：正确包是 `@qodercn-ai/qoderclicn@1.1.10`，入口 `qoderclicn`，Node `>=20`，支持 `win32`，SRI `sha512-ivrfE0QRKrH7p9JxLPWKU4fP0FW85vnKQAb04KOrV4eOvlfDgl9Z01uhbKxVTS5UUD23V5NIQvje/HjREKK+8g==`，带 `postinstall: node postinstall.cjs`。
- 动作：先静态审计并决定替代或受控执行 postinstall，再固定平台依赖；检测 `qoderclicn --version`；启动 `qoderclicn`；卸载同一受管 prefix/shim；中国版配置/数据路径必须按包实际行为重新记录，不能套国际版 `~/.qoder` 结论。
- 结论：**当前阻塞**。客户端现有 `@qoder-ai/qodercli@1.1.9` / `qodercli` 实际是国际版，产品身份、命令和安装 profile 全部不匹配；修正并完成 postinstall 审计后才可重新批准。

### 3.11 Amazon Kiro CLI

- Windows/来源：官方支持 Windows 11 原生 PowerShell，入口 `kiro-cli`，并有官方更新设置和卸载命令。[官方安装文档](https://kiro.dev/docs/cli/installation/) / [官方 latest manifest](https://prod.download.cli.kiro.dev/stable/latest/manifest.json)
- 固定源：`2.16.0` Windows x64 MSI，版本化 URL `https://prod.download.cli.kiro.dev/stable/2.16.0/kiro-cli-x86_64-pc-windows-msvc.msi`，SHA-256 `923ae05cf3ca93abc26b27d35e10f272c5aad57aa895ab18855865b1fec874d5`。
- 动作：安装前检查 Windows 11 x64；MSI 需要用户确认提权；检测 `kiro-cli --version`；启动 `kiro-cli`；执行 `kiro-cli settings \"app.disableAutoupdates\" \"true\"`；卸载用官方 `kiro-cli uninstall` 或 MSI product receipt。
- 结论：**批准**，但这是 MSI 专用模块，不是 npm/便携二进制模块。

### 3.12 Mistral Vibe CLI

- Windows/来源：官方文档支持 Windows，要求 Python 3.12+，推荐 `uv tool install mistral-vibe`，入口 `vibe`。[官方安装文档](https://docs.mistral.ai/getting-started/quickstarts/vibe-code/install-cli/) / [PyPI 2.23.2](https://pypi.org/pypi/mistral-vibe/2.23.2/json)
- 固定源：`mistral_vibe-2.23.2-py3-none-any.whl`，SHA-256 `84e5dce6c405d9e0ce0d38dede1565c792ff573225fc6d864a3366048f05261f`；PyPI 元数据含较大的固定依赖集合。
- 动作：私有 venv/uv tool 目录和完整 hash lock；检测 `vibe --version`；启动 `vibe`；卸载删除自有 venv/shim（或对自有 uv home 执行 `uv tool uninstall mistral-vibe`），保留用户配置。
- 结论：**有条件批准**。不能只校验主 wheel 后在线解析依赖。

### 3.13 MiniMax CLI

- Windows/来源：MiniMax 官方仓库的 CLI 包名是 `mmx-cli`，入口 `mmx`。[官方仓库](https://github.com/MiniMax-AI/cli) / [npm 元数据](https://registry.npmjs.org/mmx-cli/1.0.18)
- 固定源：`mmx-cli@1.0.18`，Node `>=18`，SRI `sha512-H6Kw5p9WpJPptVPImcFSFcUP+wO0+ArJKnRuYask3gtPevEUNTDxLfkS0YXo67OiJv1tmsDNx0PQ6Xl3jXZaHg==`，无 install/postinstall 生命周期脚本。
- 动作：检测 `mmx --version`；启动 `mmx`；卸载自有 prefix/shim，保留 `~/.mmx`。
- 结论：**批准**。catalog id 可以继续叫 `minimax-cli`，但安装模块必须使用官方包 `mmx-cli`；不得误装 npm 上同名的非官方 `minimax-cli@0.0.2`。

### 3.14 Hugging Face CLI

- Windows/来源：官方 CLI 入口是 `hf`，官方也提供 Windows PowerShell 安装器；版本检测为 `hf version`。[官方 CLI 文档](https://huggingface.co/docs/huggingface_hub/en/guides/cli) / [官方 PowerShell 安装器](https://hf.co/cli/install.ps1)
- 固定源：`hf@1.26.0` wheel SHA-256 `67459e96dc10053f3fbbd7604d1c46264850550b238b417106554597dbd084f0`，依赖精确版本 `huggingface_hub==1.26.0`；后者 wheel SHA-256 `e8cca670caa5d8dfa7e45bf45e86b466698198cd8150c021bcdb4a86b9252364`。[hf PyPI 元数据](https://pypi.org/pypi/hf/1.26.0/json) / [huggingface_hub PyPI 元数据](https://pypi.org/pypi/huggingface-hub/1.26.0/json)
- 动作：复刻官方脚本的私有 venv 思路，但固定全部 wheel；检测 `hf version`；启动 `hf --help` 或打开 AI Hub 终端；设置 `HF_HUB_DISABLE_UPDATE_CHECK=1`；卸载自有 venv/shim，保留 token/cache。
- 结论：**有条件批准**。需要完整传递依赖 hash lock，不能直接运行动态官方脚本。

### 3.15 OpenClaw

- Windows/来源：官方安装与卸载文档明确给出 Node、onboarding、daemon/service 和卸载流程。[官方安装](https://docs.openclaw.ai/install) / [官方卸载](https://docs.openclaw.ai/install/uninstall) / [npm 元数据](https://registry.npmjs.org/openclaw/2026.7.1-2)
- 固定源：`openclaw@2026.7.1-2`，Node 范围 `>=22.22.3 <23 || >=24.15.0 <25 || >=25.9.0`，SRI `sha512-ycF3yPcbjN6bUPeaUx6Mh6vze1hQWoD3CT/wWcmD7a8xaHHHRUaAlaq+lFxMHf1ssEgODVAwjlzYqp2twkYZ7g==`，带 postinstall 和 bundled plugins。
- 动作：检测 `openclaw --version`；首次启动 `openclaw onboard --install-daemon`；卸载先 `openclaw uninstall --service --yes --non-interactive`，再删除 AI Hub 自有 prefix/shim；默认保留状态、workspace 和凭据。
- 结论：**有条件批准，且只能走现有 OpenClaw 专用模块**。它会配置长期运行服务并拥有较大权限，不能降级成通用 npm profile，也不能让后台增加参数。

### 3.16 Nous Research Hermes Agent

- Windows/来源：官方“Windows Native Beta”脚本会配置 uv、Python 3.11、Node 22、PortableGit、ffmpeg、ripgrep 和 Playwright Chromium等多个产物，并支持按 tag/commit 安装。[官方 Windows 文档](https://github.com/nousresearch/hermes-agent/blob/main/website/docs/user-guide/windows-native.md) / [PyPI 0.19.0](https://pypi.org/pypi/hermes-agent/0.19.0/json)
- 固定主 wheel：`hermes_agent-0.19.0-py3-none-any.whl`，Python `>=3.11,<3.14`，SHA-256 `bd0bac012aee38a60894781f4597dc29ee7bedb3448540249921f10d3bef327f`；但主 wheel 只是整个 Windows bootstrap 的一部分。
- 动作：官方命令可检测 `hermes --version`、启动 `hermes`、卸载 `hermes uninstall`，并保留 `%USERPROFILE%\.hermes`；这些命令本身不能替代安装供应链审计。
- 结论：**暂缓**。官方 Windows 支持仍标 beta，远程脚本会动态安装多套运行时和浏览器；只有把每个版本、架构、URL、哈希、权限和回滚动作全部变成本地 allowlist 后，才可作为专用模块上线。

## 4. 需要立即修正的 catalog/客户端差异

1. `alibaba-qoder-cn-cli` 当前客户端错用了国际版 `@qoder-ai/qodercli@1.1.9` / `qodercli`。必须改为中国版 `@qodercn-ai/qoderclicn@1.1.10` / `qoderclicn`，并重新审计 postinstall、平台依赖、配置路径和卸载。
2. `claude-code` 当前 catalog 强制 `node,git`，与官方原生 Windows 安装现状不符；应迁移原生/WinGet profile，或只在 npm fallback 时检测 Node 22。
3. `codex-cli` 当前以 Node/npm 作为必需环境，但官方已有固定 Windows x64/ARM64 EXE。建议迁移到便携二进制模块，移除不必要的 Node 前置条件。
4. Codex、Claude、Gemini 当前 profile 未把安装版本固定到白名单，存在 npm `latest` 漂移；必须先锁版本与完整性。
5. `github-copilot-cli`、`alibaba-qwen-code`、`amazon-kiro-cli`、`minimax-cli` 当前是 `cli-official` 且没有本地 `installProfileId`；应按上面合同补 profile 后才显示“一键安装”。
6. `comfy-cli`、`mistral-vibe-code-cli`、`hf-cli` 不能直接套通用 pip；先做统一的“私有 Python 工具环境”模块和完整 hash-lock。
7. `cursor-cli` 与 `nous-hermes-agent` 当前继续保持官方文档入口，不应伪装成已审核一键安装。
8. `openclaw-agent` 已有专用 profile，继续保持 daemon/service 的显式阶段、receipt 和保留用户数据的卸载语义。

## 5. 推荐实现顺序

1. 便携二进制：Codex、GitHub Copilot、Antigravity、Kimi。
2. 无生命周期脚本 npm：Gemini、MiniMax。
3. 专用 npm：Qwen、OpenClaw；Qoder CN 先修正产品身份并审计 postinstall；Claude 优先原生/WinGet。
4. 专用 MSI：Kiro。
5. 私有 Python 工具环境：comfy-cli、Vibe、Hugging Face。
6. 暂缓：Cursor WSL、Hermes 多产物 bootstrap。

每个 profile 的最小验收必须覆盖：未安装检测、安装中按钮禁用、固定来源下载、完整性失败 fail-closed、环境缺失自动进入环境模块、安装后版本检测、启动新终端、升级、卸载、残留用户数据、重装，以及后台未知 profile/任意 URL/任意命令被客户端拒绝。

## 6. 结论

“CLI 都调用一个通用模块”只能成立在**同一受控安装形态**内：便携二进制、无脚本 npm、专用 npm、MSI、私有 Python 环境、WSL/多产物 bootstrap 必须是不同的深模块。后台可以增删产品、改文案和选择已批准 profile；真正会下载、校验、安装、启动、升级和卸载的动作仍固定在客户端白名单中。这样新增厂商产品时多数只需选择模块并填写经过校验的有限参数，不需要修改页面，也不会把后台变成任意代码执行入口。
