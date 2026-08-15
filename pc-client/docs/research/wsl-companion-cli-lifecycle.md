# WSL companion/CLI 生命周期研究

范围：现有 `openclaw-wsl-gateway`（`companion-runtime`）与 `augment-auggie-cli`（`wsl-managed`）。仅使用官方文档、官方源码仓库与官方发布页；未安装、未登录、未改业务数据。

## `openclaw-wsl-gateway`

- **架构与 Windows/WSL**：OpenClaw 官方把 Windows Hub 作为原生 companion；本地设置可创建 app-owned `OpenClawGateway` WSL 发行版，不修改用户现有 Ubuntu。手工路径为 WSL2 + Linux Gateway；WSL 内启用 systemd，Gateway 以 systemd user service `openclaw-gateway[-<profile>].service` 运行。来源：[Windows](https://docs.openclaw.ai/windows)、[平台总览](https://github.com/openclaw/openclaw/blob/main/docs/platforms/index.md)。
- **依赖与 Node**：OpenClaw 核心要求 Node（因使用 `node:sqlite`）；当前官方 `package.json` 的 engines 为 `>=22.22.3 <23 || >=24.15.0 <25 || >=25.9.0`，因此不能把任意系统 Node 视为兼容。WSL 需 Ubuntu/发行版、systemd；无 Docker 依赖被 Windows Gateway 路径强制要求。来源：[平台源码](https://raw.githubusercontent.com/openclaw/openclaw/main/package.json)。
- **安装/启动/服务**：官方 Windows Hub 本地设置或 WSL 内 Linux quickstart；Gateway 服务使用 `openclaw gateway install`，状态用 `openclaw gateway status`，前台可用 `openclaw gateway run`。来源：[Windows](https://docs.openclaw.ai/windows)、[Gateway runbook](https://docs.openclaw.ai/gateway)。
- **更新/修复**：官方提供 `openclaw update`、`openclaw update status`、`openclaw update repair`；`openclaw doctor --fix/--repair` 可修复配置、服务元数据、迁移旧状态，并明确区分只读 lint 与写入修复。更新后官方建议检查状态、深度 Gateway 状态、doctor 与 restart。来源：[Update](https://docs.openclaw.ai/cli/update)、[Doctor](https://docs.openclaw.ai/gateway/doctor)、[Troubleshooting](https://docs.openclaw.ai/gateway/troubleshooting)。
- **卸载与数据保留**：`openclaw uninstall` 可分别移除 service、state、workspace；`--state` 不删除 workspace，`--all` 才全部移除。官方建议先 `openclaw backup create`；state 包含会话、凭据、日志和配置，删除前必须确认备份。来源：[Uninstall](https://docs.openclaw.ai/cli/uninstall)、[Backup](https://docs.openclaw.ai/cli/backup)。
- **driver 结论**：现有 profile 可安全增加受批准的 **update** 与 **repair** capability，但必须把 Node engine、WSL systemd/service 归属、状态备份和重启确认作为合同前置；保留 `install/open/uninstall` 的现有边界，不自动执行 state/workspace 删除。

## `augment-auggie-cli`

- **架构与 Windows/WSL**：Auggie 是 Augment 官方终端 CLI，不是桌面客户端；官方安装页列出 macOS、Windows WSL、Linux，要求兼容 shell（zsh/bash/fish），因此本 profile 的 WSL 归类正确，未找到原生 Windows CLI 合同。来源：[官方安装页](https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli)、[Overview](https://docs.augmentcode.com/cli/overview)。
- **依赖与 Node**：官方安装页与仓库 README 写 Node 22+；Overview 页面仍写 Node 20+，存在官方文档口径冲突，应按更严格的 Node 22+ 阻断并交 CLI 员工确认。安装身份是 npm 包 `@augmentcode/auggie`，不是固定 MSI/portable 制品。来源：[安装页](https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli)、[官方仓库](https://github.com/augmentcode/auggie)。
- **安装/启动/进程**：官方入口 `npm install -g @augmentcode/auggie`；首次需 `auggie login`，启动为 `auggie` 或 `auggie --print ...`。文档没有 WSL systemd service 合同；它是按终端进程运行的 CLI。来源：[Overview](https://docs.augmentcode.com/cli/overview)、[仓库 README](https://github.com/augmentcode/auggie)。
- **更新/修复**：交互模式默认自动更新；官方提供 `auggie upgrade`，也可用 `AUGMENT_DISABLE_AUTO_UPDATE=1` 禁用自动更新。官方 CLI reference 未提供独立 `repair` 命令；故障恢复只能保持为重新安装/重新登录等人工流程，不能猜测为 repair capability。来源：[自动更新](https://docs.augmentcode.com/cli/autoupgrade)、[CLI reference](https://docs.augmentcode.com/cli/reference)。
- **卸载与数据保留**：官方明确 `auggie logout` 只移除本地 token，`auggie token revoke` 撤销服务端 token；未找到官方 CLI 安装目录清理/完整卸载合同。`~/.augment` 下的设置、会话与计划属于用户数据，不应由客户端擅自删除。来源：[认证](https://docs.augmentcode.com/cli/setup-auggie/authentication)、[配置](https://docs.augmentcode.com/cli/config)。
- **driver 结论**：可在 Node 22+ 与 WSL shell 前置检查后增加受批准的 **update**（调用官方 `auggie upgrade`）；**repair 保持 partial/blocked**，直到 Augment 提供明确修复与卸载/数据保留合同。现有 install/open/uninstall 不应扩展为自动删除 `~/.augment`。

## 结论

共享 driver 可增加：OpenClaw 的 update+repair；Auggie 仅 update。两者都必须保留 WSL/Node 前置检查与用户确认，不能把 WSL 内 CLI 的服务、状态或凭据删除动作隐式下发。

## Auggie Node 20/22 冲突专项复核

- **冲突证据与对应范围**：当前 Augment 安装页和 Overview 都写“Node 20+”，并把平台列为 macOS、Windows WSL、Linux；页面本身没有发布日期或版本选择器。[安装页](https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli) [Overview](https://docs.augmentcode.com/cli/overview)；相对地，Augment 2025-08-28 的“CLI available for everyone”发行公告写明可在 Node.js 22+ 运行，官方 `augmentcode/auggie` README 也写 Node 22+。[发行公告](https://www.augmentcode.com/changelog/auggie-cli-is-available-for-everyone) [官方源码仓库](https://github.com/augmentcode/auggie)
- **解释**：现有证据不能证明 Node 20 对应旧版、Node 22 对应新版，因为安装页/Overview 没有版本日期或版本绑定；只能确认官方文档之间存在未标注时间的最低版本分歧。Node 20 是当前文档页面声明的最低值，Node 22 是带明确发布日期的发行公告和当前仓库 README 的更严格要求。
- **当前 profile 决策**：Windows/WSL 的固定 Node22 profile 是正确且保守的选择；不能下调到 Node20，除非 Augment 发布带版本号的兼容性矩阵或同步修正文档。Auggie 仍是 WSL shell + npm 全局包 `@augmentcode/auggie`，不是 Windows 原生 MSI。[安装页](https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli)
- **repair 边界**：官方定义了 `auggie upgrade` 和交互模式自动更新，但没有 `repair` 命令或“重建安装”的官方合同。[自动更新与升级](https://docs.augmentcode.com/cli/autoupgrade) 因此可把候选 repair 限定为只读验证：受管安装前缀、Node 版本、`@augmentcode/auggie` 包身份/版本；不能把“验证后重建”标为已支持 repair。即使将来实现受控重建，也必须只重建 npm 包前缀，明确禁止写入或删除 `~/.augment`。
- **token/config 数据边界**：`auggie logout` 只删除本地 token，`token revoke` 才撤销服务端 token；官方配置、会话、计划位于 `~/.augment`，自动更新开关也在 `~/.augment/settings.json`。[认证](https://docs.augmentcode.com/cli/setup-auggie/authentication) [自动更新](https://docs.augmentcode.com/cli/autoupgrade) 所以任何 repair 不得触碰 `~/.augment`、token、session、settings 或 workspace；若安装前缀不确定，应直接 blocked。
- **卸载边界**：官方文档提供 logout/token revoke，但未提供 Auggie 专用完整卸载或数据清理命令；npm 包移除与 `~/.augment` 数据删除不能被目录客户端自行推断。故当前 repair 仍 blocked，update 仅在 Node22+、WSL bash/兼容 shell 与受管 npm 前缀核验通过后可进入实现。
