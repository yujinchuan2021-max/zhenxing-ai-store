# Windows CLI 本地一键安装审计：Antigravity、Cursor、Qoder CN

日期：2026-07-31

## 审计范围与安全基线

本次只使用厂商官方文档、官方安装脚本、官方包注册表和第一方发布清单。目标不是判断“能否运行一条远程安装命令”，而是判断 AI Hub 能否把产品收进**客户端本地白名单**，以固定版本、固定来源、固定完整性和固定动作完成安装、检测、启动与卸载。

批准条件：

- 后台只能选择已批准的本地模块和参数，不能下发 URL、包名或命令。
- 安装必须固定版本；不能在安装时执行 `irm ... | iex` 或 `curl ... | bash` 之类的可变远程脚本。
- 下载产物必须与白名单内的 SHA-256/SHA-512 或 npm SRI 一致。
- 自动更新必须关闭，或明确从“AI Hub 管理的固定版本”降级为“厂商自行更新、仅检测”。
- 卸载只删除模块自己安装的文件和 PATH 项；账号、会话、配置等用户数据默认保留。

## 结论总览

| 产品 | 结论 | 推荐接入方式 | 关键原因 |
| --- | --- | --- | --- |
| Google Antigravity CLI | **有条件批准** | 直接下载固定版本 `agy.exe`，核对 SHA-512，AI Hub 自管目录/PATH | 官方提供原生 Windows x64/ARM64 和 SHA-512；但应绕过可变远程安装脚本，且必须关闭后台自动更新 |
| Cursor CLI | **暂缓原生 Windows 一键安装** | 先保留官方安装入口；若以后做 WSL 专用模块再单独审批 | 官方只声明 macOS、Linux、Windows (WSL)，没有原生 Windows 发行物；安装脚本没有发布校验值或签名信息，且默认自动更新 |
| Qoder CLI / Qoder CN CLI | **批准 npm 固定版本方案** | `@qoder-ai/qodercli@1.1.9`，npm SRI 校验，`--ignore-scripts`，AI Hub 自管 PATH | 官方支持 Windows/npm；包有 SRI 和 npm registry signature；生命周期脚本不是运行必需，可由客户端替代其 PATH 工作 |

## 1. Google Antigravity CLI

### 官方入口与真实分发

- 官方 Windows PowerShell 入口为 `irm https://antigravity.google/cli/install.ps1 | iex`，CMD 入口为下载并执行 `install.cmd`；默认安装目录是 `%LOCALAPPDATA%\agy\bin`。[官方入门文档](https://antigravity.google/docs/cli-getting-started)
- PowerShell 安装脚本不是包管理器安装。它从 Google Cloud Run 上的发布清单取 `version`、二进制 URL 和 `sha512`，下载单文件 `agy.exe`，校验 SHA-512 后调用 `agy.exe install` 配置环境。[官方 PowerShell 安装脚本](https://antigravity.google/cli/install.ps1)
- 官方一方源码仓库给出的可执行入口是 `agy`。[第一方源码仓库](https://github.com/google-antigravity/antigravity-cli)

### 2026-07-31 固定版本与完整性

| 平台 | 版本 | 固定产物 | SHA-512 |
| --- | --- | --- | --- |
| Windows x64 | `1.1.9` | `https://storage.googleapis.com/antigravity-public/antigravity-cli/1.1.9-6572839516635136/windows-x64/cli_windows_x64.exe` | `ea4e55761b8252dcf5e051c61b1cdae1dcafcb9b8a76672aab13a2e8407fd8ae9fa5a389449f594c2fc970991afd5188a4bead1b06fe86dbb096ac2472893af1` |
| Windows ARM64 | `1.1.9` | `https://storage.googleapis.com/antigravity-public/antigravity-cli/1.1.9-6572839516635136/windows-arm/cli_windows_arm64.exe` | `e9ee3960b023adec8bf6add28339bd9ab7cddf01f6d4e9374dc134faa21a44d195a0cb8dd5a0e308e37137f38a631630fec5094662cda13eadce26b009f853f4` |

以上字段来自 Google 当前的 [Windows x64 发布清单](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json) 和 [Windows ARM64 发布清单](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_arm64.json)。清单有强哈希，但未在官方清单或文档中提供 Authenticode 证书主体/发布签名证明，因此 **Authenticode 状态记为未知，不能替代 SHA-512 白名单校验**。

### 生命周期、依赖、启动与卸载

- 包形态：独立原生可执行文件，不存在 npm lifecycle scripts；“是否禁用 lifecycle scripts”不适用。
- 环境依赖：Windows 64 位；官方同时发布 x64 和 ARM64。安装与下载阶段需要 HTTPS；运行时首次认证会打开浏览器。[官方产品/认证说明](https://github.com/google-antigravity/antigravity-cli#authentication)
- 安装后检测：绝对路径执行 `agy.exe --version`。
- 启动：在用户选择的工作目录打开终端，执行绝对路径 `agy.exe`；不要默认附加 `--dangerously-skip-permissions`。官方命令参考表明普通入口就是 `agy`，危险跳过权限是显式选项。[Google Codelab 命令说明](https://codelabs.developers.google.com/sdd-agy-cli)
- 自动更新：官方安装器明确说明会后台自更新；官方排障文档提供 `AGY_CLI_DISABLE_AUTO_UPDATE=true`。AI Hub 固定版本模式必须在所启动进程环境中设置该变量，否则第一次运行后白名单版本可能漂移。[官方自动更新排障文档](https://antigravity.google/docs/cli/troubleshooting)
- 卸载：官方安装脚本只明确给出删除 `agy.exe` 的“fresh installation”提示，没有公布完整产品卸载命令。AI Hub 应自管安装目录/终端 shim/PATH 项，卸载时只删除这些受管对象；默认保留 `~/.gemini/antigravity-cli` 的用户设置、登录与会话数据。

### 批准约束

**批准进入本地模块白名单**，但必须同时满足：

1. 客户端内置上述固定 URL、版本、架构和 SHA-512，不调用远程 `install.ps1`/`install.cmd`。
2. 下载到临时文件，先校验 SHA-512，再原子移动到 AI Hub 受管目录。
3. AI Hub 自己创建/删除终端入口；不把后台参数转发给 `agy install`。
4. 所有由 AI Hub 启动的 `agy` 进程设置 `AGY_CLI_DISABLE_AUTO_UPDATE=true`，并在检测中报告版本漂移。
5. Authenticode 只能作为将来的附加门槛；在取得稳定的签名主体证据前不能写成“已验证发布签名”。

## 2. Cursor CLI

### 官方入口与真实分发

- 官方只声明 **macOS、Linux 和 Windows (WSL)**，安装命令为 `curl https://cursor.com/install -fsS | bash`，入口是 `cursor-agent`。[Cursor 官方安装文档](https://docs.cursor.com/en/cli/installation)
- 2026-07-31 获取到的官方安装脚本固定构建标识为 `2026.07.23-e383d2b`，从 `https://downloads.cursor.com/lab/2026.07.23-e383d2b/${OS}/${ARCH}/agent-cli-package.tar.gz` 下载，将版本目录链接为 `~/.local/bin/agent` 和 `~/.local/bin/cursor-agent`。[Cursor 官方安装脚本](https://cursor.com/install)
- npm 上同名的非 scoped `cursor-agent` 不能从 Cursor 官方文档或第一方源码建立归属关系，**不得当作 Cursor 官方包接入**。官方安装文档没有给出 `@cursor/agent` 或其他 npm 包名。

### 完整性、生命周期与依赖

- 官方安装脚本中没有 SHA-256/SHA-512 校验，也没有发布签名/证书校验；仅凭 HTTPS 和固定构建路径不足以达到 AI Hub 当前的受管安装门槛。[Cursor 官方安装脚本](https://cursor.com/install)
- 分发物是预编译 tar.gz/独立二进制，不存在 npm lifecycle scripts；禁用 lifecycle scripts 不适用。
- Windows 依赖是 **WSL 中的 Linux 用户空间**，并需要 bash、curl、tar/链接能力。官方没有声明原生 `win32-x64.exe` 安装方式。[Cursor 官方安装文档](https://docs.cursor.com/en/cli/installation)
- 官方 CLI 默认尝试自动更新，并提供 `cursor-agent update`/`upgrade`；文档没有给出稳定的禁用自动更新开关。[Cursor 官方安装文档](https://docs.cursor.com/en/cli/installation)

### 启动与卸载

- 启动入口：WSL 内执行 `cursor-agent`；登录入口为 `cursor-agent login`。[Cursor 官方认证文档](https://docs.cursor.com/en/cli/reference/authentication)
- 不应默认使用 `-p`、`--force` 或携带 API key；普通验收应启动交互式 `cursor-agent`。Cursor 的非交互模式拥有写文件和执行命令能力。[Cursor 官方参数参考](https://docs.cursor.com/en/cli/reference/parameters)
- 官方文档没有给出卸载命令。按当前脚本布局只能由安装模块追踪并删除两个 symlink 与对应版本目录；这属于安装脚本实现推导，不是厂商承诺的卸载接口。

### 暂缓原因

**暂缓纳入原生 Windows 一键安装白名单**：

1. AI Hub 是 Windows 原生客户端，而 Cursor 官方 Windows 支持目前是 WSL，不是原生 Windows 包。
2. 官方安装脚本没有可用于 fail-closed 的发布哈希或签名。
3. 默认自动更新且无官方禁用方案，固定版本会在运行后漂移。
4. 没有官方卸载接口。

如后续新增“WSL 环境模块”，仍需先取得每个平台产物的厂商发布校验值，或由 Cursor 提供签名/可验证清单；在此之前只保留“打开官方安装文档”。

## 3. Qoder CLI / Qoder CN CLI

### 官方入口与真实包名

- Qoder 官方文档声明支持 Windows (Windows Terminal)，Windows 推荐的包是 `@qoder-ai/qodercli`，命令为 `npm install -g @qoder-ai/qodercli`，入口 `qodercli`。[Qoder 官方快速开始](https://docs.qoder.com/en/cli/quick-start)
- 官方还维护原生 Windows PowerShell bootstrap：它支持 `--version`，从阿里云 OSS 的版本化 manifest 下载 Windows ZIP、校验 SHA-256，解压 `qodercli.exe` 并调用 `qodercli.exe install --force`。[Qoder 官方 PowerShell 安装脚本](https://qoder-ide.oss-accelerate.aliyuncs.com/qodercli/install.ps1)

### 2026-07-31 固定版本与完整性

推荐的 npm 白名单字段：

| 字段 | 固定值 |
| --- | --- |
| 包名 | `@qoder-ai/qodercli` |
| 版本 | `1.1.9` |
| bin | `qodercli` -> `bundle/qodercli.js` |
| Node | `>=20.0.0` |
| npm SRI | `sha512-fx/bw31INvdy5Pv+XJleBbnA5Mz9CsXHGmORVcAS2rkmKZy6iX7rwPcXpEhVCkPX4Rjebx6xGAC4Zcjz9MCZBw==` |
| tarball | `https://registry.npmjs.org/@qoder-ai/qodercli/-/qodercli-1.1.9.tgz` |
| lifecycle | `postinstall: node postinstall.cjs` |

这些字段来自 [npm 官方注册表的 1.1.9 包记录](https://registry.npmjs.org/@qoder-ai/qodercli/1.1.9)。该记录同时包含 npm registry signature；审计下载的 tarball SHA-512 与上述 SRI 完全一致。包的 repository/homepage 元数据指向当前不可访问的 `github.com/nicepkg/qodercli`，所以不能把仓库链接当作额外的源码可追溯保证；批准依据是阿里云官方文档明确指定该包、注册表 SRI 和注册表签名。

原生 Windows 备选字段来自 [Qoder 1.1.9 官方发布清单](https://qoder-ide.oss-accelerate.aliyuncs.com/qodercli/channels/1.1.9/manifest.json)：

- 标准版（Windows build >= 17763，Bun runtime）：`qodercli-windows-x64.zip`，SHA-256 `ca891721c636a8fc873653bba2f60aa9e9b94111ab08947aba327a23267c9625`。
- legacy（Node SEA）：`qodercli-windows-x64-legacy.zip`，SHA-256 `842a06800c046eb9041f033e148baf2c4f9df4919a13e1fc2e32af543db9bb37`。
- Windows ARM64 尚不支持；官方快速开始也明确写明 Windows on Arm 暂不支持。[Qoder 官方快速开始](https://docs.qoder.com/en/cli/quick-start)

官方清单没有给出 Windows Authenticode 证书主体或独立发布签名，因此原生 ZIP 的 Authenticode 状态仍记为未知；SHA-256 是当前可验证门槛。

### lifecycle 脚本审计

`@qoder-ai/qodercli@1.1.9` 的 `postinstall.cjs` 做两类工作：

1. 检查平台对应的可选 ripgrep 包或系统 `rg`，没有时只打印警告，不使安装失败。
2. Windows 下查询 npm 全局 prefix，把它追加到 `HKCU\Environment\Path`，并广播环境变量变更。

脚本不下载 Qoder 主程序、不编译本地代码，也不是 `bundle/qodercli.js` 运行的必要条件。因此 **适合使用 `--ignore-scripts`**，前提是：

- AI Hub 以固定 npm prefix 安装并自己管理终端入口/PATH；
- 不使用 `--omit=optional`，让 `@qoder-ai/qodercli-ripgrep-win32-x64@1.1.9` 随包安装，或检测到系统 `rg`；
- 可选 ripgrep 包也固定为 `1.1.9` 并验证其 SRI `sha512-70vfezXg/M66oylj/iGKC6asEmGW9/xT1QgxsnnHlPghqY1tYDCcN33SfBB3Z/QrowYiaEx8TaSpfLBRsn/Zpw==`。[npm 官方注册表包记录](https://registry.npmjs.org/@qoder-ai/qodercli-ripgrep-win32-x64/1.1.9)

### 安装、检测、启动、卸载

- 安装：在 AI Hub 固定 prefix 中执行等价的结构化 npm 安装动作，包名和版本必须来自客户端白名单：`@qoder-ai/qodercli@1.1.9`；启用 `ignore-scripts`，保留 optional dependencies。后台不能修改包名、版本或 npm 参数。
- 检测：调用受管 shim/绝对路径 `qodercli --version`，必须得到 `1.1.9`。
- 启动：在用户选择的工作目录打开终端执行 `qodercli`；首次登录由 Qoder 自己的交互流程处理，AI Hub 不收集 PAT。官方文档也支持在 TUI 内 `/login`。[阿里云官方 Qoder 文档](https://www.alibabacloud.com/help/en/model-studio/qoder-agent)
- 自动更新：Qoder 默认启用自动升级。固定版本模式必须合并设置 `general.enableAutoUpdate=false` 到 `~/.qoder/settings.json`，不得覆盖用户其他设置。[Qoder 官方快速开始](https://docs.qoder.com/en/cli/quick-start)
- 卸载：对同一受管 prefix 执行 `npm uninstall -g @qoder-ai/qodercli --ignore-scripts`，再删除 AI Hub 自己创建的 shim/PATH 项。默认保留 `~/.qoder` 用户数据；如果 optional ripgrep 包不再被其他包引用，由 npm 一并清理。

### 批准约束

**批准 npm 固定版本方案进入本地白名单**。首版不建议调用可变远程 PowerShell bootstrap，也不建议直接采用原生 ZIP 的 `qodercli.exe install`，因为其 install 子命令会继续执行 PATH、marker、telemetry 等副作用，尚未形成和 npm 路线同等清晰的文件所有权边界。

## 建议的客户端白名单记录

```text
antigravity-cli
  platform: win32
  architectures: x64, arm64
  version: 1.1.9
  artifact: agy.exe (per-arch fixed URL)
  integrity: sha512 (per-arch fixed value)
  detect: agy.exe --version
  launch: agy.exe
  managedEnv: AGY_CLI_DISABLE_AUTO_UPDATE=true
  uninstall: remove module-owned binary/shim/PATH only

qoder-cn-cli
  platform: win32
  architecture: x64
  package: @qoder-ai/qodercli
  version: 1.1.9
  integrity: npm SRI + registry signature
  node: >=20.0.0
  installPolicy: ignore scripts, keep optional dependencies, fixed prefix
  detect: qodercli --version
  launch: qodercli
  uninstall: npm uninstall from the same fixed prefix

cursor-cli
  approval: deferred
  reason: WSL-only on Windows; no published artifact checksum/signature; auto-update drift
```

## 后续复审触发条件

- 任一固定版本、下载 URL、SRI/哈希或平台支持变化时重新审计，不能由后台静默替换。
- Cursor 发布原生 Windows 构建且提供可验证清单/签名时重新评估。
- Google/Qoder 提供稳定 Authenticode 证书主体后，可将签名主体加入额外 allowlist；在此之前仍以固定强哈希 fail-closed。
- Qoder npm 包新增/变更 lifecycle scripts、依赖原生编译或将关键安装逻辑移入 postinstall 时，立即撤销 `--ignore-scripts` 的既有结论并复审。
