# 下一批 Windows CLI 本地一键安装审计：Kimi Code、Cline、OpenCode

日期：2026-07-31

## 目标与边界

本次只读取厂商官方文档、第一方源码、官方发布清单和 npm 官方注册表记录；没有执行远程安装脚本，也没有运行下载到的 CLI。目标是从三项中选出下一项可进入 AI Hub 客户端本地白名单的产品。

统一批准条件：

- 后台只能选择客户端已经批准的模块，不能下发包名、URL、命令或任意参数。
- 安装固定版本、固定架构和固定完整性；版本更新必须重新审计并更新客户端白名单。
- 不执行 `irm ... | iex`、`curl ... | bash` 或其他可变远程脚本。
- 产品自己的自动更新必须关闭，避免受管文件在 AI Hub 之外发生漂移。
- 卸载只删除模块拥有的文件、shim 和 PATH 项；账号、凭据、配置、会话和用户安装的 Skill/MCP 默认保留。

## 结论总览

| 产品 | 本轮结论 | 推荐方式 | 主要理由 |
| --- | --- | --- | --- |
| Kimi Code CLI | **批准，建议下一项立即实现** | 直接下载官方固定版本单文件 `kimi.exe`，按架构校验 SHA-256 | 官方原生 Windows x64/ARM64、固定 manifest、无 Node/Python/WSL、自动更新开关和用户数据边界均明确 |
| Cline CLI | **技术上可批准，但排第二** | 固定 npm 主包和 Windows 平台包，禁用 lifecycle scripts | 包、平台二进制、SRI、registry signature、SLSA provenance 都完整；但需保留 Node wrapper 才能获得系统证书信任，且自动更新设置尚无稳定机器接口文档 |
| OpenCode | **暂缓首批，后续做专用平台包模块** | 不安装 `opencode-ai` 主包；直接固定并解包对应 Windows 平台包 | 平台包可验证，但主包 postinstall 是安装关键路径，会执行 PowerShell 探测、运行二进制并可能再次调用 npm；Windows 虽可原生运行但官方仍推荐 WSL |

## 1. Kimi Code CLI

### 官方归属与 Windows 支持

- Kimi Code CLI 由 Moonshot AI/Kimi 发布，第一方源码为 [`MoonshotAI/kimi-code`](https://github.com/MoonshotAI/kimi-code)，不要与已停止维护的旧 Python `MoonshotAI/kimi-cli` 混为一项。
- 官方明确支持 macOS、Linux 和 Windows PowerShell；Windows 首次启动前需要 Git for Windows，CLI 使用其中的 Git Bash。自定义路径可通过 `KIMI_SHELL_PATH` 指向 `bash.exe`。[Kimi Code 官方入门文档](https://www.kimi.com/code/docs/kimi-code-cli/guides/getting-started.html)
- 官方同时提供 npm 包 `@moonshot-ai/kimi-code`，但本轮建议使用原生单文件方案，避免 Node 22.19、可选原生依赖和 npm postinstall 的额外边界。

### 固定版本、产物和完整性

2026-07-31 官方 latest 与版本化 manifest 均为 `0.31.1`：

| 平台 | 固定 URL | SHA-256 |
| --- | --- | --- |
| Windows x64 | `https://code.kimi.com/kimi-code/binaries/0.31.1/kimi-code-win32-x64.exe` | `50e7aaa5db973553871e617af76df7470d305c36954298928a86f9ecdcd3ce5a` |
| Windows ARM64 | `https://code.kimi.com/kimi-code/binaries/0.31.1/kimi-code-win32-arm64.exe` | `f03fdd012ad4e9893c35f0e8e85a7a559c04b406d9e803c9e77081064ddd171e` |

来源：[官方 `0.31.1` manifest](https://code.kimi.com/kimi-code/binaries/0.31.1/manifest.json)。官方 PowerShell 安装器同样从该版本化 manifest 读取 filename/checksum，使用 SHA-256 校验后才写入 `kimi.exe`；AI Hub 应复现这个固定动作，而不是执行安装器本身。[官方 PowerShell 安装器](https://code.kimi.com/kimi-code/install.ps1)

官方 manifest 没有提供 Authenticode 证书主体或独立发布签名，因此本轮只能批准“固定 HTTPS 来源 + 固定 SHA-256”，不能标记为已验证 Authenticode。

### npm 备选路线静态审计

| 字段 | 值 |
| --- | --- |
| 包名/版本 | `@moonshot-ai/kimi-code@0.31.1` |
| bin | `kimi` -> `dist/main.mjs` |
| Node | `>=22.19.0` |
| SRI | `sha512-Hyly4EjzemSjla479jC47h+K98wNvRKOqGwu6mBncI/MlIafqEByUXeGl/9+DsOKdiE6fQTxkxiAcgusBay56Q==` |
| registry signature | 有 |
| SLSA provenance | 有 |
| lifecycle | `postinstall: node scripts/postinstall.mjs` |

来源：[npm 官方注册表记录](https://registry.npmjs.org/@moonshot-ai/kimi-code/0.31.1) 和 [npm provenance](https://registry.npmjs.org/-/npm/v1/attestations/@moonshot-ai%2fkimi-code@0.31.1)。

静态拆包显示 postinstall 会扫描 PATH 中旧 Python `kimi-cli` shim，将第一个重命名为 `kimi-legacy`，并可能删除后续重复 shim。它刻意不让安装失败，但会修改 AI Hub 模块之外的文件。因此：

- 若以后采用 npm 路线，必须 `--ignore-scripts`。
- 但 npm 路线还依赖 `node-pty ^1.1.0` 和 clipboard 可选原生包，其中 `node-pty` 有 install/postinstall/native build 行为；全局禁用 scripts 可能影响能力完整性。
- 原生单文件方案没有 npm lifecycle，因而更适合当前白名单。

### 环境、启动、检测和自动更新

- 运行环境：Windows x64/ARM64；无需 Node、Python 或 WSL；必须检测 Git for Windows/Git Bash。若 Git Bash 不在标准位置，只允许用户选择本地 `bash.exe`，后台不能提供路径。
- 检测：执行受管绝对路径 `kimi.exe --version`，必须得到 `0.31.1`。
- 启动：在用户选择的工作目录打开终端，执行绝对路径 `kimi.exe`，不附加 `-p`、YOLO 或自动批准参数。主入口和参数见[官方命令参考](https://www.kimi.com/code/docs/en/kimi-code-cli/reference/kimi-command.html)。
- 登录：首次启动后由用户在 TUI 内执行 `/login`；AI Hub 不收集 API key 或 OAuth 凭据。[官方入门文档](https://www.kimi.com/help/kimi-code/cli-getting-started)
- 自动更新：`~/.kimi-code/tui.toml` 中 `[upgrade].auto_install` 默认 `true`。固定版本模块必须保守合并为 `false`，不能覆盖用户其他 TUI 设置。[官方配置字段](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/config-files.html)
- 产品运行期间可能按需下载/缓存 `rg` 和 `fd` 到 `~/.kimi-code/bin/`；这是用户启动产品后的工具缓存，不属于 AI Hub 安装产物。官方已记录位置和重建行为。[官方数据目录说明](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/data-locations.html)

### 卸载与用户数据保留

- AI Hub 卸载只删除模块拥有的 `kimi.exe`、自己创建的 shim/PATH 项和安装记录。
- 不调用产品级清理，不删除 `%USERPROFILE%\.kimi-code`。该目录包含 OAuth 凭据、配置、会话、日志、插件、Skills、MCP、更新状态以及缓存工具；官方完整布局见[数据目录说明](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/data-locations.html)。
- 如用户选择“清除个人数据”，必须单独二次确认，并把它视为与“卸载程序”不同的动作。

### 批准结论

**批准 Kimi Code CLI 0.31.1 原生 Windows 模块进入客户端白名单，并建议作为下一项立即实现。**

模块不得调用官方 PowerShell 脚本；应在客户端下载、校验 SHA-256、原子写入受管目录、检测 Git Bash、合并关闭自动更新，再通过绝对路径启动。

## 2. Cline CLI

### 官方归属、Windows 支持和准确包名

- Cline Bot Inc. 的第一方仓库是 [`cline/cline`](https://github.com/cline/cline)，官方 CLI 安装包名是无 scope 的 `cline`，不是第三方 `@yaegaki/cline-cli`。[Cline 第一方仓库](https://github.com/cline/cline)
- 官方支持 Windows x64 和 ARM64。主包通过 optional dependencies 解析对应的预编译平台包，二进制内嵌 Bun；官方入口为 `cline`。[Cline CLI 第一方 README](https://github.com/cline/cline/blob/main/apps/cli/README.md)

### 固定版本和完整性

2026-07-31 固定为 `3.0.48`：

| 包 | SRI | registry signature | SLSA provenance |
| --- | --- | --- | --- |
| `cline@3.0.48` | `sha512-rnSL88+Z8YHU+/X000jD7AI1hId7445v4HTR0jEQ/UCrFdoQ5dwAwwTIAtXgjKMqyL379Y60FSG4L4Th8aTxag==` | 有 | 有 |
| `@cline/cli-windows-x64@3.0.48` | `sha512-fHbETTHM0C8NIAPHH4/4y2BPzUXWYIlDEZGwkAp/DWgV2ToAGN30uRzqN8x+5HA2xxE9qLKP0DHPzk8FGBdPRQ==` | 有 | 有 |
| `@cline/cli-windows-arm64@3.0.48` | `sha512-gxlID//0np+WYOM4lXry6z/3b8KowEzrgSz503GuZbDvYmpDCKdJjE6qAqMoWm5HtI6O9Ght4TpJXaZ6e0kL0A==` | 有 | 有 |

来源：[主包注册表记录](https://registry.npmjs.org/cline/3.0.48)、[x64 平台包](https://registry.npmjs.org/@cline/cli-windows-x64/3.0.48)、[ARM64 平台包](https://registry.npmjs.org/@cline/cli-windows-arm64/3.0.48)。注册表没有公布稳定 Authenticode 证书主体，SRI/signature/provenance 保护的是 npm tarball 供应链。

### lifecycle、Node 与安装建议

- 主包 lifecycle 只有 `postinstall: node ./postinstall.mjs || true`。
- 静态拆包确认：Windows 分支只输出“skipping binary cache setup”并返回；不会复制文件、下载产物或执行平台二进制。因此 Windows 上适合禁用 lifecycle scripts。
- `bin/cline` 是 Node wrapper：解析对应平台包并启动 `cline.exe`，还会读取 Windows 系统证书存储，为内嵌 Bun 生成 `NODE_EXTRA_CA_CERTS`。为了保留企业代理/自签 CA 支持，推荐使用 AI Hub 受管 Node 启动该 wrapper，而不是只裸跑平台 `cline.exe`。[第一方 wrapper/证书行为](https://github.com/cline/cline/blob/main/apps/cli/README.md#certificate-trust)
- wrapper 在 Node 22.15+ 才能读取完整 OS trust store；更旧 Node 仍可运行，但会失去该兼容能力。建议白名单依赖固定为 AI Hub Node `>=22.15`。

建议安装方式是固定 prefix、固定主包和固定平台包、`--ignore-scripts`，并验证两份 SRI；不要允许 npm 解析 nightly 或后台可变版本。

### 启动、检测、自动更新和卸载

- 检测：`cline version` 或 `cline -V` 必须得到 `3.0.48`。[官方 CLI reference](https://docs.cline.bot/cli/cli-reference)
- 启动：默认工具调用会自动批准；AI Hub 应以 `cline --auto-approve false` 启动交互 TUI，不能默认使用 `--yolo`/`--zen`。[第一方 CLI README](https://github.com/cline/cline/blob/main/apps/cli/README.md#tool-approval)
- 数据：全局配置与凭据位于 `~/.cline/`，结构化状态默认在 `~/.cline/data/`，可由 `CLINE_DATA_DIR` 改写。[官方配置说明](https://docs.cline.bot/getting-started/config)
- 自动更新：3.0.21 起存在“控制 CLI 启动时自动更新”的全局设置，但当前公开文档没有提供稳定的字段名/环境变量；在客户端能以一方接口确定并关闭它之前，不能把受管版本视为完全防漂移。[第一方 changelog](https://github.com/cline/cline/blob/main/apps/cli/CHANGELOG.md)
- 卸载：从相同受管 prefix 移除 `cline@3.0.48` 和平台包，删除 AI Hub 创建的 shim；不执行 lifecycle scripts，不删除 `~/.cline/`。

### 结论

**供应链条件已满足，排在 Kimi 之后。** 剩余阻塞是把官方全局自动更新设置落实为稳定、可测试的机器配置接口；在此之前可保留为 `cli-official`，不要发布“固定版本已完全受管”的承诺。

## 3. OpenCode

### 官方归属与 Windows 支持

- 第一方仓库为 [`anomalyco/opencode`](https://github.com/anomalyco/opencode)，官方 npm 包是 `opencode-ai`，入口 `opencode`。[OpenCode 官方安装文档](https://opencode.ai/docs)
- 官方允许 Windows 直接运行和 npm 安装，但明确推荐 WSL 以获得最佳兼容性和性能。[官方 Windows/WSL 文档](https://opencode.ai/docs/windows-wsl/)
- Windows CLI 暴露 `OPENCODE_GIT_BASH_PATH`，因此原生模块应检测 Git Bash；用户自定义路径只能来自本机选择。[官方 CLI 环境变量](https://dev.opencode.ai/docs/cli/)

### 固定版本和完整性

2026-07-31 固定为 `1.18.10`：

| 包 | SRI | registry signature | SLSA provenance |
| --- | --- | --- | --- |
| `opencode-ai@1.18.10` | `sha512-/PoGrZnTrSrmHvvXUg12O4yAEjytuqEQNG8usCydrYg4EtosvbtKtGIHI40DFaIhPws91Wa20niSvFG32xL8ZQ==` | 有 | 未公布 |
| `opencode-windows-x64@1.18.10` | `sha512-E2f57u8yYCbOZCRCI7vc0XthGDy6+ygijlvfOrF1v9EGrG0d/h/bhqszVOiHHWXUcy4HN4tNR8aGTWaUfUuOaQ==` | 有 | 未公布 |
| `opencode-windows-x64-baseline@1.18.10` | `sha512-IFDdagAZyogqg+9IgFKOemdO8aSich8a9/4tEqHBgMM68AYLknLU4etOpG07/W5UWm85HPjzXS7wzP6BWMsJ4g==` | 有 | 未公布 |
| `opencode-windows-arm64@1.18.10` | `sha512-7P8rb6aFMhEgI401vQiCFr4LsUuYMeCBOovAhi+W5kNqr4uBEgQzfsGv0weyEOze31hu77/2vyrnGeBrOBjfBg==` | 有 | 未公布 |

来源：[主包](https://registry.npmjs.org/opencode-ai/1.18.10)、[x64](https://registry.npmjs.org/opencode-windows-x64/1.18.10)、[x64 baseline](https://registry.npmjs.org/opencode-windows-x64-baseline/1.18.10)、[ARM64](https://registry.npmjs.org/opencode-windows-arm64/1.18.10)。没有稳定 Authenticode 证书主体记录。

### lifecycle 静态审计

`opencode-ai` 的 lifecycle 是 `postinstall: node ./postinstall.mjs`，而且它是安装关键路径：

1. 用 PowerShell/pwsh 调用 `IsProcessorFeaturePresent(40)` 检测 AVX2。
2. 从 optional dependency 中选择 standard/baseline Windows 平台包。
3. 复制或 hard-link 平台 `opencode.exe` 到主包 `bin/opencode.exe`。
4. 执行复制后的 `opencode.exe --version` 做验证。
5. 如果平台包不存在，会在临时目录再次执行 `npm install --ignore-scripts ...` 下载平台包。

主包自带的 `bin/opencode.exe` 初始只是提示“postinstall 未运行”的 shell 占位文件，因此 **`opencode-ai` 主包不能直接使用 `--ignore-scripts` 安装**。允许该 postinstall 又违反 AI Hub “固定结构化动作、不得在 lifecycle 内二次下载/执行新二进制”的边界。

可接受的未来方案是单独写 `opencode-platform` 模块：客户端本地检测架构和 AVX2，直接下载并校验对应平台 tarball，安全解包单个 `bin/opencode.exe`，完全绕过主包和 postinstall。这个模块尚需额外实现安全解包与 AVX2 分支测试，故不作为本轮第一项。

### 启动、自动更新、卸载和数据

- 检测：绝对路径 `opencode.exe --version` 必须得到 `1.18.10`；启动为交互式 `opencode.exe`，不附带非交互或共享参数。[官方 CLI reference](https://dev.opencode.ai/docs/cli/)
- 自动更新：OpenCode 启动时会自动下载更新。固定模块启动环境必须设置 `OPENCODE_DISABLE_AUTOUPDATE=true`，官方也支持配置 `"autoupdate": false`。[官方 CLI 环境变量](https://dev.opencode.ai/docs/cli/) / [官方配置说明](https://dev.opencode.ai/docs/config)
- 用户数据：Windows 下位于 `%USERPROFILE%\.local\share\opencode`，含 `auth.json`、日志和项目会话；配置/插件还位于 `%USERPROFILE%\.config\opencode`。[官方排障/存储说明](https://opencode.ai/docs/troubleshooting/)
- 官方 `opencode uninstall` 会移除 CLI 及相关文件并询问确认；AI Hub 的普通卸载不应调用它，因为用户要求保留数据。客户端只删除自己安装的二进制/shim/PATH，并保留上述目录。

### 结论

**暂缓用通用 npm 模块接入；允许下一轮实现专用平台包模块。** 不得为了“马上支持”而放开 postinstall 或在客户端执行可变 npm 下载。

## 建议立即落地的白名单记录

```text
id: kimi-code-cli-native
vendor: moonshot-ai
platform: win32
architectures: x64, arm64
version: 0.31.1

x64.url: https://code.kimi.com/kimi-code/binaries/0.31.1/kimi-code-win32-x64.exe
x64.sha256: 50e7aaa5db973553871e617af76df7470d305c36954298928a86f9ecdcd3ce5a

arm64.url: https://code.kimi.com/kimi-code/binaries/0.31.1/kimi-code-win32-arm64.exe
arm64.sha256: f03fdd012ad4e9893c35f0e8e85a7a559c04b406d9e803c9e77081064ddd171e

executable: kimi.exe
detect.args: [--version]
detect.expectedVersion: 0.31.1
launch.args: []
dependency: Git for Windows / bash.exe
autoUpdatePolicy: merge ~/.kimi-code/tui.toml -> [upgrade].auto_install=false
uninstallPolicy: remove module-owned binary/shim/PATH only
preserveUserData: true
userData: %USERPROFILE%\.kimi-code
```

## 复审触发条件

- Kimi manifest/版本/哈希、Git Bash 依赖或自动更新字段发生变化。
- Cline 公布稳定的自动更新机器配置字段，或提供禁用自动更新环境变量。
- OpenCode 平台包结构、AVX2 分支、SRI/signature 或 Windows 原生支持发生变化。
- 任一 npm 包新增/修改 lifecycle scripts、optional dependency 版本范围或 provenance 状态。
