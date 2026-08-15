# Aider 与 Open Interpreter 官方 Windows CLI 核对

核对时间：2026-08-04

本轮只核对 Aider 与 Open Interpreter 当前官方 Windows CLI 的安装要求，不修改客户端实现。信息只取自项目官网、官方文档、官方 GitHub 仓库与 PyPI。

## 结论

| 产品 | 当前官方交付形态 | Windows 原生支持 | Python 要求 | 入口命令 | 固定 Python venv 驱动 |
|---|---|---|---|---|---|
| Aider | PyPI 包 `aider-chat` | 支持 | 当前 PyPI 元数据为 `>=3.10,<3.13`；官方安装文档推荐使用独立 Python 3.12 | `aider`；找不到脚本入口时可用 `python -m aider` | 适合，但 AI Hub 必须先提供独立、受管的 Python 3.12，不能使用当前仅有的 Python 3.13 运行时 |
| Open Interpreter | Rust 独立发行包及官方 PowerShell 安装器 | 支持，WSL 仅为可选 Linux 工作流 | 当前正式 CLI 不依赖 Python | `interpreter` 或短命令 `i` | 不适合；Python 包属于旧一代项目，套用 Python venv 会装错产品 |

## Aider

### 官方事实

- 当前 PyPI 包名为 `aider-chat`。2026-08-04 查询到的最新版为 `0.86.2`，`Requires-Python` 为 `>=3.10,<3.13`。
- 官方安装文档支持 Windows 原生 PowerShell，并推荐让 Aider 使用隔离环境。
- 官方 `aider-install` 与 `uv tool` 方案会为 Aider 单独准备 Python 3.12；即使启动安装器的现有 Python 是 3.8—3.13，Aider 本身仍可落到独立 Python 3.12 环境。
- 官方文档给出的 pipx 范围是 Python 3.9—3.12，直接 pip 安装范围也是 Python 3.9—3.12；但当前具体发布包的 PyPI 元数据更严格，因此 AI Hub 应以当前发布包的 `>=3.10,<3.13` 为最终兼容边界。
- 命令入口为 `aider`；官方文档在入口找不到时建议使用 `python -m aider`。

官方来源：

- 安装文档：https://aider.chat/docs/install.html
- PyPI 项目与发布元数据：https://pypi.org/project/aider-chat/
- 依赖隔离说明：https://aider.chat/docs/troubleshooting/imports.html
- 官方仓库：https://github.com/Aider-AI/aider

### 对 AI Hub 的驱动判断

Aider 适合使用固定 Python venv 驱动，但应满足以下条件：

1. AI Hub 自己管理 Python 3.12，不借用用户系统 Python，也不复用 Python 3.13。
2. 每次客户端审核一个明确的 `aider-chat` 版本，并由固定模块安装该版本；后台只能选择已审核版本或策略参数，不能传入任意包名或 pip 参数。
3. 安装目录与收据由 AI Hub 独占；检测使用受管环境中的 `aider --version`，启动时在用户可见终端中运行 `aider`。
4. 更新时先审核新版本的 Python 范围和依赖，再替换受管环境；卸载只删除 AI Hub 自己创建的环境和收据，不触碰用户项目、Git 仓库或用户手动安装的 Aider。

### 当前阻断条件

- 现有 AI Hub 托管 Python 运行时只有 3.13，而当前 `aider-chat` 明确要求 `<3.13`。
- 在补齐受管 Python 3.12、固定版本清单和真实 Windows 安装/启动/卸载验收前，`aider-cli` 应继续保持阻断状态。

## Open Interpreter

### 官方产品身份已经变化

当前官方仓库 `openinterpreter/openinterpreter` 明确说明：正式产品已经是基于 Rust 的新版本；原 Python 项目只作为社区维护分支继续存在。因此，旧资料中的 `pip install open-interpreter`、Python 3.10/3.11 等要求不能继续作为当前官方 CLI 的安装依据。

### 当前官方事实

- Windows 原生安装命令是 `irm https://www.openinterpreter.com/install.ps1 | iex`。
- 官方安装器会选择当前平台发行包，并建立其自更新所需的受管 standalone 布局。
- 安装后使用 `interpreter --version` 验证；交互入口为 `interpreter` 或 `i`。
- Windows 原生受支持；WSL 也受支持，但只用于偏 Linux 的工作流，并非 Windows 安装的必需依赖。
- 官方更新入口为 `interpreter update`，也支持重新运行安装器。
- 官方 Windows 卸载逻辑只移除指向 `%USERPROFILE%\.openinterpreter\packages\standalone` 的受管 junction、standalone 包和对应 PATH 项，并默认保留 `.openinterpreter` 中的用户配置、会话、日志与文件型凭据。
- 2026-08-04 查询到的最新官方发行版为 `Open Interpreter 0.0.34`，标签 `rust-v0.0.34`，发布时间为 2026-07-18；发行页提供 Windows MSVC 架构包。

官方来源：

- 当前官方仓库与 Python 旧版迁移说明：https://github.com/openinterpreter/openinterpreter
- Windows 安装、更新和卸载：https://www.openinterpreter.com/docs/terminal/install
- 入口命令与首次启动流程：https://www.openinterpreter.com/docs/terminal/quickstart
- CLI 命令参考：https://www.openinterpreter.com/docs/terminal/cli-reference
- 当前发行版：https://github.com/openinterpreter/openinterpreter/releases/tag/rust-v0.0.34

### 对 AI Hub 的驱动判断

Open Interpreter 不应使用 Python venv 驱动。合适的模块是“固定清单的 Windows standalone 归档驱动”或经过单独审核的官方安装器驱动：

1. 客户端清单固定版本、架构、官方发行地址与安装布局；后台不能下发安装脚本或任意 URL。
2. 模块需识别 x86_64/ARM64，解压官方 Windows 发行包，建立官方要求的受管目录、junction 与 PATH 项，并写入 AI Hub 安装收据。
3. 检测使用 `interpreter --version`；安装完成后在用户可见终端运行 `interpreter`，让用户自行完成首次模型提供商登录或 API Key 配置。
4. 更新必须保持官方 standalone 布局；卸载只清理 AI Hub/官方受管的程序目录与 PATH，不默认删除用户的 `.openinterpreter` 数据。

不建议 AI Hub 在运行时直接执行官网的 `irm ... | iex`：该命令会即时获取可变化的远程脚本，无法满足客户端固定模块、固定来源和可审核行为的边界。

### 当前阻断条件

- 客户端尚无经过验收的 Windows standalone 归档安装模块，也未完整实现官方 junction、PATH、更新和保留用户数据的卸载语义。
- 不能退回旧 Python 包绕过阻断；那会安装另一代、社区维护的产品。
- 在固定发行清单、受限归档驱动及真实 Windows 安装/启动/更新/卸载验收完成前，`open-interpreter-cli` 应继续保持阻断状态。

## 建议的下一步

1. 先补一个 AI Hub 独占的 Python 3.12 运行时，用 Aider 作为固定 Python venv 驱动的首个验收产品。
2. 单独实现 Windows standalone 归档模块，用 Open Interpreter 作为首个验收产品；不要把它塞进 Python CLI 模块。
3. 两个模块都通过真实 Windows 闭环后，再把对应阻断项改为可安装。
