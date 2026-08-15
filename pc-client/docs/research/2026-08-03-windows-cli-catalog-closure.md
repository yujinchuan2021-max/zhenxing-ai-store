# Windows `cli-official` 目录闭环审计

日期：2026-08-03

## 结论

本次复核 `admin/data/catalog-v1.json` 中现有的 **31 个** `cli-official` 产品：

- **11 个已接管**：使用客户端固定的 `npm`、`portable-binary` 或 `python-venv` 驱动；后台只能选择已批准产品和参数，不能下发命令。
- **20 个继续阻断**：仍只展示官网和教程，不显示“一键安装”。阻断项不得改用远程动态 Shell、PowerShell 或安装脚本绕过审核。

“已接管”只表示执行合同已经进入客户端固定注册表；它不替代用户网络、代理、权限、登录及真实设备验收。

## 已接管及待验收

| 目录产品 | 固定版本或软件包 | 客户端驱动 | 当前结论 | 官方来源 |
| --- | --- | --- | --- | --- |
| Agent TARS CLI | `@agent-tars/cli@0.3.0` | `npm`，Node `>=22.15`，固定包且禁用生命周期脚本 | **已接管** | [官方仓库](https://github.com/bytedance/UI-TARS-desktop)；[npm 固定版本元数据](https://registry.npmjs.org/@agent-tars%2fcli/0.3.0) |
| Qoder CN CLI | `@qodercn-ai/qoderclicn@1.1.12` | `npm`，Node `>=20`，AI Hub 管理自动更新设置 | **已接管** | [Qoder CN 官方文档](https://www.alibabacloud.com/help/en/lingma/qodercli-cn/user-guide/qoder-cli-cn-get-started-quickly)；[npm 固定版本元数据](https://registry.npmjs.org/@qodercn-ai%2fqoderclicn/1.1.12) |
| PixVerse CLI | `pixverse@1.2.12` | `npm`，Node `>=20`，固定包且禁用生命周期脚本 | **已接管** | [PixVerse 官方 CLI 说明](https://pixverse.ai/en/blog/pixverse-cli-generate-ai-videos-images-from-terminal)；[npm 固定版本元数据](https://registry.npmjs.org/pixverse/1.2.12) |
| Factory CLI | `droid@0.186.0` | `npm`，Node `>=20`；不使用远程 PowerShell 安装器 | **已接管** | [Factory 官方快速开始](https://docs.factory.ai/droid-cli/quickstart)；[npm 固定版本元数据](https://registry.npmjs.org/droid/0.186.0) |
| Kilo Code CLI | `@kilocode/cli@7.4.17` | `npm`，固定 Windows 平台包；禁用 postinstall | **已接管** | [Kilo 官方 CLI 文档](https://kilo.ai/docs/code-with-ai/platforms/cli)；[npm 固定版本元数据](https://registry.npmjs.org/@kilocode%2fcli/7.4.17) |
| Letta Code CLI | `@letta-ai/letta-code@0.30.3` | `npm`，Node `>=22.19`；只允许已审核的包内补丁步骤 | **已接管** | [Letta Code 官方仓库](https://github.com/letta-ai/letta-code)；[npm 固定版本元数据](https://registry.npmjs.org/@letta-ai%2fletta-code/0.30.3) |
| Amp CLI | `0.0.1785761938-g468e20` Windows x64 EXE | `portable-binary`，固定 URL、SHA-256 和下载域名 | **已接管** | [Amp 官方手册](https://ampcode.com/manual)；[固定 Windows 资产](https://static.ampcode.com/cli/0.0.1785761938-g468e20/amp-windows-x64-baseline.exe) |
| Daytona CLI | `v0.190.0` Windows x64/ARM64 EXE | `portable-binary`，按架构固定 URL、SHA-256 和 GitHub 下载域名 | **已接管** | [Daytona 官方 CLI 文档](https://www.daytona.io/docs/en/tools/cli/)；[官方 v0.190.0 发布](https://github.com/daytonaio/daytona/releases/tag/v0.190.0) |
| Deepgram CLI | `deepctl==0.2.26`，命令 `dg` | `python-venv`，Python 3.13 x64，99 个固定 wheel | **已接管并通过真实验收** | [Deepgram 官方安装文档](https://developers.deepgram.com/developer-tools/cli/installation)；[PyPI 固定版本](https://pypi.org/project/deepctl/0.2.26/) |
| nanobot | `nanobot-ai==0.3.0` | `python-venv`，Python 3.13 x64，93 个固定 wheel | **已接管并通过真实验收** | [HKUDS 官方仓库](https://github.com/HKUDS/nanobot)；[PyPI 固定版本](https://pypi.org/project/nanobot-ai/0.3.0/) |
| PraisonAI CLI | `praisonai==4.6.159` | `python-venv`，Python 3.13 x64，90 个固定 wheel | **已接管并通过真实验收** | [PraisonAI 官方文档](https://docs.praison.ai/nocode/installation)；[PyPI 固定版本](https://pypi.org/project/PraisonAI/4.6.159/) |

## 继续阻断

| 目录产品 | 已核验版本或形态 | 阻断理由 | 官方来源 |
| --- | --- | --- | --- |
| Cursor CLI | 官方滚动安装脚本；Windows 通过 WSL | 没有可由当前驱动固定校验并原生运行的 Windows 软件包；禁止执行动态脚本 | [Cursor 官方安装文档](https://docs.cursor.com/en/cli/installation) |
| NVIDIA NemoClaw CLI | `v0.0.100`；WSL2 + Docker/OpenShell | 属于容器、沙箱、服务和多运行时编排，不是单包 CLI；当前驱动无法完整安装和卸载 | [官方仓库](https://github.com/NVIDIA/NemoClaw)；[官方前置条件](https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/get-started/prerequisites) |
| Hermes Agent | Beta；Python、Node、渠道和服务等多运行时 | 多运行时、凭据和后台生命周期尚未收据化，不能当作普通 Python 包接管 | [官方产品页](https://nousresearch.net/hermes-agent/)；[官方文档](https://hermes-agent.nousresearch.com/docs/) |
| Tabnine CLI | 团队启用后由滚动安装器部署 | 动态团队安装器没有固定资产摘要；还依赖 Tabnine Host 和组织策略 | [Tabnine 官方安装文档](https://docs.tabnine.com/main/getting-started/tabnine-cli/getting-started/installation) |
| Browser Use CLI | 浏览器、Playwright/Chromium 与本地 daemon | 浏览器资产和 daemon 尚未纳入收据、检测及卸载闭环 | [官方仓库](https://github.com/browser-use/browser-use)；[官方 CLI 文档](https://docs.browser-use.com/open-source/browser-use-cli) |
| OpenManus | 源码仓库安装 | 没有已批准的固定 Windows CLI 分发包；源码、环境和配置安装超出当前驱动 | [Foundation Agents 官方项目页](https://foundationagents.org/projects/openmanus/)；[官方仓库](https://github.com/FoundationAgents/OpenManus) |
| MetaGPT CLI | 源码/Python 环境，并需要 Node/pnpm 等工具链 | 多运行时构建和生成流程未收据化，不适合当前单驱动安装 | [官方仓库](https://github.com/FoundationAgents/MetaGPT) |
| OpenFang | `v0.6.9`；Windows ZIP/MSI | 有固定资产和 SHA-256，但当前 `portable-binary` 不解压 ZIP，`managed-msi` 也不是通用 MSI 驱动 | [官方仓库](https://github.com/RightNow-AI/openfang)；[官方 v0.6.9 发布](https://github.com/RightNow-AI/openfang/releases/tag/v0.6.9) |
| ZeroClaw | `v0.8.4`；Windows ZIP/MSI | 当前驱动不能解压或通用安装 MSI，卸载还必须停止并删除用户计划任务服务 | [官方仓库](https://github.com/zeroclaw-labs/zeroclaw)；[官方 Windows 指南](https://github.com/zeroclaw-labs/zeroclaw/blob/master/docs/book/src/setup/windows.md) |
| IronClaw | `ironclaw-v1.0.0`；Windows MSI | 通用 MSI ProductCode、签名主体、WebUI 状态和卸载数据边界尚未建模 | [官方仓库](https://github.com/nearai/ironclaw)；[官方 v1.0.0 发布](https://github.com/nearai/ironclaw/releases/tag/ironclaw-v1.0.0) |
| NanoClaw | `v2.1.54`；WSL2 + Docker | 动态 Bash 引导会管理 Node、pnpm、Docker、容器、凭据和服务；现有驱动无法安全回滚 | [官方文档](https://docs.nanoclaw.dev/installation)；[官方仓库](https://github.com/nanocoai/nanoclaw) |
| Open Interpreter CLI | 官方 Python/归档分发 | 当前 `python-venv` 合同不能覆盖其归档资产和完整运行时；需先增加受审核归档驱动 | [官方终端快速开始](https://www.openinterpreter.com/docs/terminal/quickstart)；[官方仓库](https://github.com/OpenInterpreter/open-interpreter) |
| Kortix CLI | `v0.12.1`；Linux/macOS CLI | 官方安装器明确不支持原生 Windows；Windows 发布资产属于桌面端，不是 Kortix CLI | [官方仓库](https://github.com/kortix-ai/suna)；[官方 v0.12.1 发布](https://github.com/kortix-ai/suna/releases/tag/v0.12.1) |
| Aider CLI | Python，当前受支持上限与 AI Hub Python 3.13 合同不匹配 | 不能用当前 Python 3.13 锁直接安装；需独立 Python 3.12 运行时和完整依赖锁 | [Aider 官方安装文档](https://aider.chat/docs/install.html) |
| mini-SWE-agent | Bash/WSL 使用路径 | 没有可由现有 Windows 驱动接管的原生入口，不能把 WSL 脚本冒充 Windows 安装 | [官方仓库](https://github.com/SWE-agent/mini-swe-agent) |
| Plandex CLI | `cli/v2.2.1`；仅 WSL，Local 模式还需 Docker | 官方不支持 CMD/PowerShell；远程脚本、WSL 和 Docker 生命周期不在当前驱动内 | [官方仓库](https://github.com/plandex-ai/plandex)；[官方 v2.2.1 发布](https://github.com/plandex-ai/plandex/releases/tag/cli%2Fv2.2.1) |
| Agent S CLI | Python + GUI/OCR/桌面自动化 | 具备高权限桌面控制能力，模型、浏览器、OCR 资产和授权边界未完成安全及卸载审计 | [官方仓库](https://github.com/simular-ai/Agent-S) |
| AgenticSeek CLI | 源码 + Docker/本地服务 | 容器、模型、浏览器和服务编排没有收据化，不能用单包驱动接管 | [官方仓库](https://github.com/Fosowl/agenticSeek) |
| Auggie CLI | WSL + npm，包含 `node-pty` postinstall | 不是已验证的原生 Windows 路径，原生依赖生命周期脚本不能在当前 npm 安全合同中放行 | [Auggie 官方安装文档](https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli) |
| Anytype CLI | Windows ZIP + 用户级服务 | 当前驱动不解压 ZIP，也没有服务安装、检测、停止和卸载收据闭环 | [Anytype 官方 CLI 示例](https://developers.anytype.io/docs/examples/featured/cli/)；[官方仓库](https://github.com/anyproto/anytype-cli) |

## 后续门禁

1. Deepgram、nanobot 和 PraisonAI 已完成 Windows 3.13 x64 隔离安装、固定版本核对、命令启动、收据识别和仅删除收据目录的卸载验证；该脚本保留为后续版本升级门禁。
2. ZIP、通用 MSI、WSL/Docker、浏览器/daemon 和多运行时产品必须分别建立新的客户端固定驱动；不能由后台拼装命令替代。
3. 厂商发布新版本时必须重新固定版本、资产摘要、依赖锁和生命周期脚本；通过配置发布不等于自动继承旧审批。
4. 被阻断产品继续保留官方入口和教程，不得因为目录中存在 `cli-official` 身份就显示“一键安装”。
