# OpenClaw 与腾讯 ima 的 Windows 产品模型核查

核查日期：2026-08-01（Asia/Shanghai）

## 结论先行

1. **OpenClaw Windows Hub、OpenClaw CLI、Gateway 是三个不同状态，不得再共用一个 `installed` 布尔值。** Windows Hub 是独立发布的 WinUI Companion；桌面程序安装完成，不代表 Gateway 已经部署、运行或配对。
2. Windows Hub 的默认本地安装流程会创建专属 WSL 发行版 **`OpenClawGateway`**，其基础系统才是 `Ubuntu-24.04`。它不会修改或自动接管用户已有的普通 `Ubuntu-24.04`。因此，把 OpenClaw CLI 安装进普通 Ubuntu 后，Hub 仍要求配置 WSL Gateway，是符合官方实现的。
3. OpenClaw 的“安装完成”应拆成桌面端、Gateway 已部署、Gateway 运行/就绪、Hub 已配对四层证据；AI Hub 自己保存的任务记录不能替代真实机器检测。
4. 腾讯 ima 官网并非固定下载 2.3.0。官网当前先读取腾讯远程下载配置，失败后才退回网页包内的 2.3.0 URL。2026-08-01 获取到的正式 Windows 发行版是 **2.6.3 build 4813**，大小 **224,073,264 bytes**。
5. ima 当前正式安装器已验证为腾讯有效 Authenticode 签名；安装完成应检查其注册表身份、安装目录和主程序，而不是检查“安装包是否还在下载目录”。
6. 两个“安装超时”都不能靠简单延长一个总超时解决：OpenClaw 是多阶段 WSL/Gateway/配对流程；ima 是大文件下载、外层安装器、子安装器和最终注册表落盘流程。每个阶段需要独立进度、超时和完成证据。

## 1. OpenClaw 的真实 Windows 产品关系

### 1.1 Windows Hub 是 Companion，不是 Gateway

OpenClaw 官方 Windows 文档明确区分三条路径：

- **Windows Hub**：原生 WinUI Companion，负责托盘、桌面聊天、Command Center、Windows node 能力、本地 MCP 和 Gateway 连接管理。
- **原生 Windows CLI / Gateway**：由 PowerShell 安装器部署，可通过 Windows 计划任务或 Startup 登录项运行 Gateway。
- **WSL2 Gateway**：Linux 兼容性最完整的 Gateway 运行方式；既可以由 Windows Hub 创建专属实例，也可以由用户在自己的发行版内手工安装。

来源：[OpenClaw Windows 官方文档](https://github.com/openclaw/openclaw/blob/main/docs/platforms/windows.md#L243-L352)、[Windows Hub 官方 README](https://github.com/openclaw/openclaw-windows-node/blob/main/README.md#L14-L38)。

Windows Hub 还可以只开启本地 MCP server 而不运行 Gateway。因此，“桌面端已安装”与“Gateway 已部署”在产品语义上也不能合并。

### 1.2 默认本地 Gateway 使用专属发行版

Windows Hub 首次启动且没有可用 Gateway 时，默认“Set up locally”流程会：

1. 创建应用自有的 WSL 发行版 `OpenClawGateway`；
2. 以 `Ubuntu-24.04` 为基础系统；
3. 在发行版内创建 `openclaw` Linux 用户；
4. 安装 CLI 和 Gateway；
5. 安装并启动 systemd 用户服务；
6. 将 Hub 与 Gateway 配对。

官方默认配置同时关闭 Windows PATH 注入、Windows/WSL interop 和 Windows 盘自动挂载，说明这个发行版是隔离的 Gateway appliance，不是普通开发用 Ubuntu。

来源：[Windows Hub 首次启动说明](https://github.com/openclaw/openclaw/blob/main/docs/platforms/windows.md#L263-L273)、[默认 SetupEngine 配置](https://github.com/openclaw/openclaw-windows-node/blob/main/src/OpenClaw.SetupEngine/default-config.json)、[受管 WSL Gateway 管理说明](https://github.com/openclaw/openclaw-windows-node/blob/main/docs/WSL_GATEWAY_ADMIN.md#L1-L21)。

**直接影响：** AI Hub 目前若只把 OpenClaw CLI 装进名为 `Ubuntu-24.04` 的普通发行版，Windows Hub 不会把它识别为自己的默认本地 Gateway。AI Hub 必须选择下面两种明确策略之一：

- 调用/复刻官方专属 Gateway 编排，创建精确名称 `OpenClawGateway`；或
- 保留普通发行版，但把它作为“现有 Gateway”连接到 Hub，并完成 URL、token 和配对注册。

不能只完成 npm/CLI 安装就把整个产品标为“已安装”。

## 2. OpenClaw 的可靠检测模型

建议状态至少拆成以下字段：

| 状态 | 可靠证据 | 不能作为唯一证据的内容 |
| --- | --- | --- |
| `hubInstalled` | `%LOCALAPPDATA%\OpenClawTray\OpenClaw.Tray.WinUI.exe` 存在且签名/版本可读；HKCU Inno 卸载记录存在 | 下载过安装包、AI Hub receipt |
| `hubRunning` | `OpenClaw.Tray.WinUI.exe` 进程存在 | 托盘图标没看到或任务已启动 |
| `gatewayProvisioned` | `wsl --list --quiet` 精确包含 `OpenClawGateway`；发行版内 `openclaw --version` 成功 | 普通 `Ubuntu-24.04` 存在、Windows 上有 `openclaw.cmd` |
| `gatewayRunning` | 发行版内 `openclaw gateway status --json --require-rpc` 成功 | 仅检查进程、仅检查 18789 端口 |
| `gatewayReady` | 官方 `/readyz` 或 RPC 检查成功；`/healthz` 仅表示进程存活 | HTTP 任意响应 |
| `gatewayPaired` | `%LOCALAPPDATA%\OpenClawTray\setup-state.json` 已完成；`%APPDATA%\OpenClawTray\gateways.json` 及对应设备身份/token 有效 | Hub 已安装、Gateway 正在运行 |

Windows Hub 的固定安装身份来自官方 Inno Setup：

- AppName：`OpenClaw Companion`
- AppId：`{M0LTB0T-TRAY-4PP1-D3N7}`
- per-user 安装目录：`%LOCALAPPDATA%\OpenClawTray`
- 主程序：`OpenClaw.Tray.WinUI.exe`
- URL protocol：`openclaw://`
- AUMID：`OpenClaw.Companion`

来源：[官方 installer.iss](https://github.com/openclaw/openclaw-windows-node/blob/main/installer.iss#L13-L61)、[SetupEngine 真实检测和完成态写入](https://github.com/openclaw/openclaw-windows-node/blob/9acafa606a4d863f1f62058364bb2f64625a8cca/src/OpenClaw.SetupEngine/SetupSteps.cs)、[Gateway health/ready 语义](https://github.com/openclaw/openclaw/blob/main/docs/cli/gateway.md#L297-L355)、[Hub 启动状态判断源码](https://github.com/openclaw/openclaw-windows-node/blob/main/src/OpenClaw.Tray.WinUI/Services/StartupSetupState.cs)。

对用户应显示为分层状态，例如：

- 桌面端已安装 · 本地网关未部署
- 桌面端已安装 · 网关已部署但未启动
- 网关运行中 · 等待配对
- 已连接

## 3. OpenClaw 安装、更新与卸载关系

### 3.1 当前 Windows Hub 发行版

2026-08-01 查询官方 GitHub Releases，最新稳定版为 `v0.6.12`（2026-06-30）：

- [发布页](https://github.com/openclaw/openclaw-windows-node/releases/tag/v0.6.12)
- [x64 安装器](https://github.com/openclaw/openclaw-windows-node/releases/download/v0.6.12/OpenClawCompanion-Setup-x64.exe)
- [ARM64 安装器](https://github.com/openclaw/openclaw-windows-node/releases/download/v0.6.12/OpenClawCompanion-Setup-arm64.exe)
- [latest 下载入口与 SHA-256 清单](https://github.com/openclaw/openclaw-windows-node/blob/main/README.md#L28-L38)

Hub 独立于 CLI/Gateway 发布，核心 OpenClaw release 中的镜像版本可能落后于 Windows Hub 独立 release。AI Hub 应分别保存 Hub 版本与 Gateway/CLI 版本。

### 3.2 官方完整本地 Gateway 流水线

官方 SetupEngine 不是简单执行一次 npm，而是依次执行 WSL/虚拟化预检、陈旧专属发行版清理、命名发行版创建、systemd/隔离配置、CLI 安装、Gateway 配置、service 安装、启动和健康等待、Operator/Windows Node 配对、注册记录和完成状态写入。

来源：[官方 SetupPipeline](https://github.com/openclaw/openclaw-windows-node/blob/main/src/OpenClaw.SetupEngine/SetupPipeline.cs)、[SetupSteps](https://github.com/openclaw/openclaw-windows-node/blob/main/src/OpenClaw.SetupEngine/SetupSteps.cs)。

### 3.3 卸载是两个独立选择

官方桌面卸载器允许：

- 只卸载 Windows Hub，保留本地 WSL Gateway；
- 同时注销并删除专属 `OpenClawGateway` 和生成的本地 Gateway 状态。

如果 Gateway 清理失败，官方卸载器允许继续卸载 Hub 并保留 Gateway 数据。清理脚本只针对专属发行版，不应删除用户的普通 Ubuntu。

来源：[官方卸载选择及调用逻辑](https://github.com/openclaw/openclaw-windows-node/blob/main/installer.iss#L162-L320)、[专属 Gateway 清理脚本](https://github.com/openclaw/openclaw-windows-node/blob/main/scripts/Uninstall-LocalGateway.ps1)。

## 4. OpenClaw 为什么会“安装超时”

官方为不同阶段设置了不同预算，说明产品本身就不是单一安装进程：

| 阶段 | 官方预算/重试 |
| --- | --- |
| 创建命名 WSL 发行版 | 15 分钟 |
| WSL 内 CLI 安装 | 单次 5 分钟，最多 2 次 |
| Gateway service 安装 | 60 秒 |
| Gateway 启动 | 单次 30 秒，最多 3 次 |
| Gateway HTTP health 等待 | 默认 90 秒 |
| 普通 Wizard 步骤 | 30 秒 |
| 下载、安装或登录类 Wizard 步骤 | 300 秒 |
| 长安装进度轮询 | 最多约 20 分钟 |

来源：[SetupSteps 超时与重试](https://github.com/openclaw/openclaw-windows-node/blob/9acafa606a4d863f1f62058364bb2f64625a8cca/src/OpenClaw.SetupEngine/SetupSteps.cs)、[默认 health 超时](https://github.com/openclaw/openclaw-windows-node/blob/main/src/OpenClaw.SetupEngine/default-config.json)、[WizardTimeouts](https://github.com/openclaw/openclaw-windows-node/blob/main/src/OpenClaw.SetupEngine/WizardTimeouts.cs)。

官方列出的常见失败原因包括：WSL 未启用、硬件虚拟化/Virtual Machine Platform 不可用、陈旧的 app-owned WSL 状态、安装 Gateway 包时网络失败，以及端口或配对问题。排查应优先读取：

```text
%LOCALAPPDATA%\OpenClawTray\Logs\Setup\easy-setup-latest.txt
%LOCALAPPDATA%\OpenClawTray\Logs\Setup\easy-setup-latest.jsonl
%LOCALAPPDATA%\OpenClawTray\openclaw-tray.log
```

来源：[官方 Windows troubleshooting](https://github.com/openclaw/openclaw/blob/main/docs/platforms/windows.md#L399-L428)、[Windows Hub Setup troubleshooting](https://github.com/openclaw/openclaw-windows-node/blob/main/docs/SETUP.md#L101-L150)。

**AI Hub 不能把“桌面安装器退出”“CLI 命令成功”或“总计时器到期”直接映射为最终产品状态。** 每个阶段都应有独立状态，并在超时后继续进行只读真实检测；若实际证据已经完成，应归并为成功，而不是继续显示超时。

## 5. 腾讯 ima 的官方 Windows 分发

### 5.1 官网使用远程下载配置，不是固定 EXE

ima 官网当前的前端逻辑会先从腾讯 Rainbow 配置服务读取 `ima-download-config`，按 `channel/group` 选择下载 URL；只有远程配置读取失败时才回退到网页 bundle 内写死的 2.3.0 地址。

2026-08-01 从该官方前端调用的腾讯配置服务取得：

- 正式 channel：`official`
- Windows 版本：`2.6.3`
- build：`4813`
- 官方 URL：`https://app-dl.ima.qq.com/win_channel/ima.copilot_win_x64_1018_2.6.3_4813.exe`
- 配置版本名：`v_20260731210806`

来源：[ima 官网](https://ima.qq.com/)、[官网当前前端 bundle（包含远程配置优先、2.3.0 fallback 逻辑）](https://static.ima.qq.com/ima/assets/chat/assets/app-kbKEXi1c.js)、[腾讯 Rainbow 配置入口](https://oi.rb.qq.com/config.v2.ConfigService/PullConfigReq)。最后一个入口是官网前端使用的 POST API，浏览器直接 GET 不会返回上述配置。

因此，AI Hub 若仍固定使用 `ima.copilot_win_x64_1018_2.3.0_3717.exe`，它使用的是官网 fallback，不是当前正式版本。

### 5.2 当前正式安装器实测完整性

从上述正式 URL 下载并在 2026-08-01 本机验证：

| 字段 | 值 |
| --- | --- |
| Content-Length / 实际文件长度 | `224073264` bytes |
| FileVersion | `2.6.3.4813` |
| ProductName | `ima installer` |
| CompanyName | `Tencent` |
| OriginalFilename | `ima_installer.exe` |
| SHA-256 | `14102BC92F815463905C9A7FE65137F1A2D4297FB733C827DB011CD6DCC3D45F` |
| Authenticode | `Valid` |
| 签名主体 | `Tencent Technology (Shenzhen) Company Limited` |
| 证书 thumbprint | `0A518324A48A250A4579DC9E96539CB44725B38C` |
| 证书有效期 | 2025-11-06 至 2028-11-05 |

来源：[腾讯当前正式 Windows 安装器](https://app-dl.ima.qq.com/win_channel/ima.copilot_win_x64_1018_2.6.3_4813.exe)。SHA-256、VersionInfo 与 Authenticode 是对该下载产物的本机只读验证结果；它们是本次核查快照，未来版本更新后必须重新获取并审核，不能永久写死为“最新版”。

## 6. ima 的安装完成、更新与卸载检测

对当前官方 2.6.3 安装器进行字符串与 VersionInfo 检查，可确认它是腾讯自研外层安装器，会调用 `ima_installer.bat` / `mini_installer.exe`，并使用以下固定身份：

- 产品主程序：`ima.copilot.exe`
- 卸载器：`ImaUninstall.exe`
- 产品注册键：`SOFTWARE\Tencent\ima.copilot`
- 卸载注册键：`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Ima.copilot`
- 安装路径值：`ImaInstallPath`
- 版本来源：注册表版本值和安装目录内 `version.txt`
- 卸载命令值：`UninstallString`
- 安装器名值：`InstallerName`
- 自动启动值：`InstallAutoLaunch`

以上身份直接来自腾讯有效签名的官方 2.6.3 安装器产物。安装器允许用户自定义目录，所以不能只猜 `%LOCALAPPDATA%` 下的固定路径。

可靠检测顺序建议为：

1. 同时检查 HKCU、HKLM 与 32/64 位 registry view 中的 `...\Uninstall\Ima.copilot`；
2. 读取 `SOFTWARE\Tencent\ima.copilot\ImaInstallPath`；
3. 解析 `UninstallString` 和版本字段；
4. 验证安装目录下的 `ima.copilot.exe` 确实存在，读取 VersionInfo/签名；
5. 运行态再单独检查 `ima.copilot.exe` 进程。

“安装包存在于 `D:\AI Hub`”只能表示已经下载，不能表示已经安装；同样，安装器窗口启动也不代表子安装器已完成。

更新方面，官网远程配置已经从 2.3.0 指向 2.6.3；腾讯官方公告也要求用户更新客户端后使用新功能。例如 2026-04 的官方 imaCopilot 公告要求更新至 2.4.8。[腾讯官方发布渠道转载页](https://cloud.tencent.com/developer/news/3890501)。产品包内存在更新安装模式和版本落盘逻辑，因此 AI Hub 应以已安装版本与当前正式配置版本对比，而不是把更新当成一个新产品。

卸载应优先执行注册表 `UninstallString` 指向的官方 `ImaUninstall.exe`；只有卸载器不存在时，才提示用户从 Windows“已安装的应用”处理。不得用删除安装目录替代官方卸载。

## 7. ima 为什么会“安装超时”

当前正式安装器约 224 MB。本次从腾讯正式 URL 下载实际耗时约 183 秒；不同网络、代理/CDN 路由下会明显变化。下载完成后，外层 `ima_installer.exe` 还会启动批处理和 `mini_installer.exe`，最后才写入产品与卸载注册表。

因此真实超时机制至少包括：

- 下载阶段：大文件、代理/CDN、断流或无续传导致总时长超过固定预算；
- 启动阶段：AI Hub 等待的是外层进程，但实际安装工作已经交给子进程；
- 交互阶段：用户未完成安装器 UI，外层进程仍在等待；
- 检测阶段：AI Hub 只查固定路径或错误 DisplayName，注册表已经写入但仍被判为未安装；
- 版本阶段：AI Hub 下载旧 2.3.0，而官网当前正式版为 2.6.3，更新/覆盖流程与预期不一致。

正确处理方式不是一个更长的总计时器，而是：下载进度 → 文件长度/哈希/签名 → 安装器已启动 → 轮询注册表和主程序 → 安装完成。用户关闭或安装失败时，再读取安装器退出码和日志；超时后最后做一次真实检测，避免“已经装好但 UI 一直说超时”。

## 8. 对 AI Hub 产品模块的直接约束

### OpenClaw

- `windows-desktop` 模块只管理 Windows Hub 安装、版本、启动、更新和桌面卸载。
- `wsl-gateway` 模块管理专属 `OpenClawGateway` 的创建、环境、CLI、service、健康、配对和可选删除。
- `native-cli-gateway` 是第三条独立策略；不能与 Hub 的专属 WSL Gateway receipt 混用。
- 前端从模块状态渲染，不再为 OpenClaw 写特例；后续同类 Agent 也复用 `desktop companion + runtime + service + pairing` 多组件模型。

### ima

- 安装源应来自审核后的当前正式配置快照，而不是网页 bundle fallback。
- 下载必须校验本地白名单内的长度、SHA-256 和腾讯签名主体。
- 安装完成依赖注册表与主程序证据，安装包缓存单独管理。
- 更新和卸载都复用同一桌面应用模块的版本、注册身份和官方卸载命令接口。

## 9. 证据边界

- 本文只使用 OpenClaw 官方仓库/官方发布页、腾讯 ima 官网/官网前端配置、腾讯官方分发域名和由腾讯签名的官方安装器。
- 版本号、URL、哈希和证书是 2026-08-01 快照，接入时仍需进入客户端本地审核白名单；后台不能下发任意 URL 或命令。
- 本文没有执行真实安装或卸载，不把静态研究和产物验证表述为用户机器安装验收。
