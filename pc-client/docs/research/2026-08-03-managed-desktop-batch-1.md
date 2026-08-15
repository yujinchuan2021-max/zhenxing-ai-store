# Windows 桌面产品受管安装第一批审计

审计日期：2026-08-03  
目录来源：`pc-client/admin/data/catalog-v1.json` 中尚未纳管的 `desktop-official` 产品  
审计范围：约 10 个高频 Windows 桌面产品，优先核验 Jan、Visual Studio Code、Zed、Windsurf  

## 结论

第一批直接进入客户端受管安装白名单的产品只有 3 个：

1. Jan 0.8.4
2. Visual Studio Code 最新稳定用户版
3. Zed 1.13.2

Notion、DeepL、Grammarly、Obsidian 的官方分发和生命周期证据较完整，可作为下一小批，但仍需先完成一次隔离安装验收。Cherry Studio、DeepChat 和 Windsurf 暂缓：前两者当前 Windows 安装包没有有效 Authenticode 签名，Windsurf 的官方入口和文档已迁移到 Devin Desktop，产品身份不再稳定。

| 产品 | 本轮结论 | 官方 Windows 产物 | 签名 / 安装器 | 生命周期可信度 |
| --- | --- | --- | --- | --- |
| Jan | **Recommend：第一批** | 版本化 GitHub Release，另有官方滚动入口 | `Jan AI Pte. Ltd.`；NSIS | 高；需冻结安装收据和实际注册项 |
| Visual Studio Code | **Recommend：第一批** | Microsoft 稳定更新端点，可按版本解析 | `Microsoft Corporation`；Inno Setup | 高 |
| Zed | **Recommend：第一批** | 版本化 GitHub Release，x64 / ARM64 分离 | `Zed Industries Inc`；Inno Setup | 高 |
| Notion | Recommend：下一小批 | 官方稳定 MSIX，版本化重定向 | `Notion Labs, Inc.`；MSIX | 高；必须处理旧 NSIS 迁移 |
| DeepL | Recommend：下一小批 | 官方 Zero Install 引导器 | `DeepL SE`；Zero Install | 高 |
| Grammarly | Recommend：下一小批 | 官方部署安装器 | `Grammarly, Inc.`；NSIS | 高 |
| Obsidian | Recommend：下一小批 | 版本化 GitHub Release | `Dynalist Inc`；NSIS | 中高；卸载保持交互式 |
| Cherry Studio | **Defer** | 版本化 GitHub Release | 当前 v1.9.13 Windows 包未签名 | 低 |
| DeepChat | **Defer** | 版本化 GitHub Release | 当前 v1.0.9 Windows 包未签名 | 低 |
| Windsurf | **Defer** | 原下载入口已转向 Devin Desktop | 尚无稳定的当前产品身份 | 低 |

## 方法与边界

- 只采用厂商官网、官方文档、厂商官方 GitHub 仓库 / Release，以及产品明确支持的官方分发元数据。
- 本轮下载的安装包仅用于 SHA-256、PE 版本信息、Authenticode 和安装器格式离线检查；**没有运行任何第三方安装器**。
- SHA-256 是单个版本的点时证据，不是永久信任依据。正式策略应同时验证允许的来源域名、有效证书链、发布者主体、产品名、架构和版本。
- 不固定证书指纹。证书会续签轮换，应固定发布者主体与有效证书链，并保留客户端本地产品白名单。
- 后台只能更新已经批准的版本、URL 和展示参数，不能新增命令、静默参数、发布者或执行器类型。
- 卸载默认只移除应用，不删除模型、对话、设置、扩展、工作区或账号数据。数据清理必须是用户单独确认的动作。

## 1. Jan 0.8.4 — Recommend

### 官方来源

- [Windows 安装文档](https://www.jan.ai/docs/desktop/install/windows)
- [官方更新清单](https://github.com/janhq/jan/releases/latest/download/latest.json)
- [官网 Windows 下载入口](https://app.jan.ai/download/latest/win-x64)
- [v0.8.4 官方 Release](https://github.com/janhq/jan/releases/tag/v0.8.4)
- [v0.8.4 Windows x64 安装包](https://github.com/janhq/jan/releases/download/v0.8.4/Jan_0.8.4_x64-setup.exe)

### 本轮产物证据

- 文件：`Jan_0.8.4_x64-setup.exe`
- 大小：57,771,664 bytes
- SHA-256：`59F2712FF579208C7E50DF1D4408675418CA576421998549F787879372EC50B1`
- 文件 / 产品版本：`0.8.4`
- Authenticode：`Valid`
- 发布者：`Jan AI Pte. Ltd.`
- PE 引导壳：`0x014c`（x86）。这是承载 x64 Jan 应用的 NSIS 启动壳，因此客户端白名单校验引导壳为 x86，同时继续用固定哈希、有效签名和 Jan 版本信息约束产品身份。
- 安装器：NSIS 标记；厂商文档要求用户运行 `.exe` 并完成交互安装。

### 建议生命周期

- **版本解析**：优先读取官方 `latest.json` 和 GitHub latest Release，选择与客户端架构严格匹配的 `*_x64-setup.exe`，并校验清单中的 Tauri updater 签名。审计时 `app.jan.ai/download/latest/win-x64` 返回 HTTP 500，不能作为唯一通道。
- **检测**：官方 NSIS 配置为 `currentUser`，默认安装到 `%LOCALAPPDATA%\Programs\Jan`，并写入 `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Jan`。检测应组合该注册项的 `DisplayVersion` / `InstallLocation`、签名后的 `Jan.exe` 和文件版本；仅凭文件名或桌面快捷方式不算已安装。
- **打开**：从已验证安装收据定位签名有效的 Jan 主程序，不在代码里猜测路径。
- **更新**：Jan 的官方 Tauri 配置使用 `https://apps.jan.ai/update-check` 与 `latest.json`，Windows 更新模式为 passive。AI Hub 只报告目录版本和已安装版本，不在厂商更新器运行时并行覆盖安装。
- **卸载**：调起 `InstallLocation` 下注册的 `uninstall.exe` 并在退出后重新检测。官方文档把“卸载应用”和“删除 `%APPDATA%\Jan`”分成两个步骤，官方 NSIS 模板也把删除 AppData 作为可选项，因此 AI Hub 默认只执行前者。
- **数据保留**：官方文档说明模型、会话、设置和日志位于 `%APPDATA%\Jan\data`。不得在普通卸载中删除；若以后提供“清理数据”，必须展示路径、预计大小和不可恢复警告并再次确认。

### 实现前验收门槛

在干净的隔离 Windows 用户目录完成一次：交互安装、注册项记录、主程序签名验证、启动、版本检测、交互卸载、卸载后应用消失且 `%APPDATA%\Jan\data` 保留。通过后可按客户端固定的 `desktop-managed` 模块纳管。

## 2. Visual Studio Code — Recommend

### 官方来源

- [Windows 安装文档](https://code.visualstudio.com/docs/setup/windows)
- [卸载与数据清理文档](https://code.visualstudio.com/docs/setup/uninstall)
- [稳定用户版滚动端点](https://update.code.visualstudio.com/latest/win32-x64-user/stable)
- 固定版本端点模板：`https://update.code.visualstudio.com/{version}/win32-x64-user/stable`

### 本轮产物证据

2026-08-03 审计时，稳定端点解析到 `VSCodeUserSetup-x64-1.131.0.exe`：

- 大小：232,347,808 bytes
- SHA-256：`8CD4350898DEC154D97104C9126BD52AEBB387BB6824B4349FFBA1C347FDED34`
- 文件 / 产品版本：`1.131.0`
- Authenticode：`Valid`
- 发布者：`Microsoft Corporation`
- PE 引导壳：`0x014c`（x86）；该 Inno 启动壳承载 x64 VS Code 应用载荷。
- 安装器：Inno Setup 用户级安装器。

### 建议生命周期

- **安装类型**：默认选择官方推荐的 User Setup，不要求管理员权限，典型安装位置为 `%LOCALAPPDATA%\Programs\Microsoft VS Code`。不要把 System Installer 与 User Setup 混为一个收据。
- **安装参数**：若后续启用非交互模式，只能采用 Inno 官方通用参数和客户端固定参数；当前第一版可继续调起交互安装器。
- **检测**：注册卸载项 + 签名有效的 `Code.exe` + 文件版本三者组合；`code` 命令是否已进入当前终端 PATH 不是唯一安装证据。
- **打开**：从安装收据定位 `Code.exe`，可选传入用户主动选择的文件或目录；不得由后台下发任意命令行参数。
- **更新**：由 VS Code 自身更新器负责；AI Hub 做版本展示、打开和修复入口，不与正在运行的更新器竞争。
- **卸载与数据保留**：调起注册的卸载器。官方“完全卸载”文档把 `%APPDATA%\Code` 和 `%USERPROFILE%\.vscode` 的删除列为额外手工步骤，证明普通卸载应保留设置、扩展与用户数据；AI Hub 不自动删除这些目录。

### 实现建议

首批采用 `win32-x64-user/stable`；ARM64 必须作为独立架构产物和哈希记录。每次下载先解析最终 URL，再要求最终主机仍处于 Microsoft 允许域名集合，并验证 Microsoft 有效签名。

## 3. Zed 1.13.2 — Recommend

### 官方来源

- [Zed Windows 页面](https://zed.dev/windows)
- [Windows 安装、更新与卸载文档](https://zed.dev/docs/windows)
- [官方 Release v1.13.2](https://github.com/zed-industries/zed/releases/tag/v1.13.2)
- [Windows x64 安装包](https://github.com/zed-industries/zed/releases/download/v1.13.2/Zed-x86_64.exe)
- [官方下载页](https://zed.dev/download)
- [Windows Inno 配置](https://github.com/zed-industries/zed/blob/v1.13.2/crates/zed/resources/windows/zed.iss)
- [更新说明](https://zed.dev/docs/update)
- [卸载说明](https://zed.dev/docs/uninstall)

### 本轮产物证据

- 文件：`Zed-x86_64.exe`
- 大小：91,201,584 bytes
- SHA-256：`F9E73B28ED1D202832DC2FF1E5DF1BE46297D16AC7AA1762F230F7C9995FD5B3`
- 文件 / 产品版本：`1.13.2`
- Authenticode：`Valid`
- 发布者：`Zed Industries Inc`
- PE 引导壳：`0x014c`（x86）；该 Inno 启动壳承载 x64 Zed 应用载荷。
- 安装器：Inno Setup。
- 官方支持的 WinGet 清单标识为 `ZedIndustries.Zed`，当前 x64 安装产物仍指向同一个官方 GitHub Release；AI Hub 应直接取官方产物，不依赖用户机器上的 WinGet 可用性。

### 建议生命周期

- **安装**：x64 与 ARM64 分开选择。官方 Inno 配置为 `PrivilegesRequired=lowest` 的每用户安装；协议、文件关联、PATH、桌面图标等选项交给用户确认，不照搬厂商自更新器使用的静默更新参数作为首装参数。
- **检测**：使用 Inno 注册卸载项、产品代码、签名有效的 `Zed.exe` 和文件版本组合检测。当前官方清单产品代码为 `{2DB0DA96-CA55-49BB-AF4F-64AF36A86712}_is1`，但实现仍应通过隔离安装确认其跨版本稳定性。
- **打开**：从收据定位 `Zed.exe`；如需打开项目，参数只能来自用户显式选择的本地路径。
- **更新**：官方文档说明 Zed 默认后台下载更新并在重启时应用，用户可以在设置中关闭。AI Hub 不替换 Zed 的更新器，只展示状态并可重新获取官方版本。
- **卸载**：官方要求在 Windows“已安装的应用”中卸载。AI Hub 调起注册卸载器，不自造卸载命令。
- **数据保留**：官方把删除 `%APPDATA%\Zed` 与 `%LOCALAPPDATA%\Zed` 明确列为可选数据清理步骤。普通卸载必须保留；AI Hub 不能自行删除这些目录。

## 4. Notion — Recommend，下一小批

### 官方来源

- [桌面版说明](https://www.notion.com/en-gb/help/notion-for-desktop)
- [Windows 部署说明](https://www.notion.com/en-gb/help/deploy-notion-for-windows)
- [官方稳定 x64 MSIX](https://www.notion.com/desktop/windows-msix/download)
- [官方稳定 ARM64 MSIX](https://www.notion.com/desktop/windows-msix-arm/download)

2026-08-03 的 x64 稳定入口解析到 `Notion-7.28.0.msix`，签名为 `Notion Labs, Inc.`；包身份为 `com.notion.app.desktop.notion`，版本 `7.28.0.0`，主程序 `Notion\Notion.exe`。

建议对新受管安装统一采用 MSIX，以包身份完成安装、检测、打开和卸载。官方文档要求从经典安装器切换到 MSIX 前先卸载旧版本，因此必须先检测 legacy NSIS；发现旧版时只能提供迁移向导，不能并排安装。卸载应用不应删除用户账号或工作区数据。

## 5. DeepL — Recommend，下一小批

### 官方来源

- [Windows 应用入口](https://www.deepl.com/en/windows-app)
- [官方 Zero Install 引导器](https://appdownload.deepl.com/windows/0install/DeepLSetup.exe)
- [静默安装说明](https://support.deepl.com/hc/en-us/articles/9596644822428-Unattended-or-silent-installation-of-DeepL-app-for-Windows)
- [Zero Install 说明](https://support.deepl.com/hc/en-us/articles/6725601939228-About-Zero-Install)
- [Intune 部署与检测说明](https://support.deepl.com/hc/en-us/articles/14885492440860-Configure-the-DeepL-for-Windows-app-via-Intune)

本轮下载的引导器签名为 `DeepL SE`，版本 `2.29.0.0`。官方公开了 per-user 安装、卸载命令和 HKCU 检测项，生命周期证据完整。普通用户应采用 per-user 模式，不默认启用 machine-wide 服务和计划任务。卸载只移除应用实现，不清理用户文档或系统剪贴板历史。

## 6. Grammarly — Recommend，下一小批

### 官方来源

- [Windows 产品页](https://www.grammarly.com/desktop/windows)
- [官方部署安装器](https://download-windows.grammarly.com/GrammarlyInstaller.exe)
- [Windows 部署说明](https://support.grammarly.com/hc/en-us/articles/4422076438029-How-to-deploy-Grammarly-for-Windows)
- [交互卸载说明](https://support.grammarly.com/hc/en-us/articles/4412832963469-How-to-uninstall-Grammarly-for-Windows-or-Grammarly-for-Mac)

本轮产物签名为 `Grammarly, Inc.`，版本 `1.2.283.1934`，NSIS 安装器。官方提供 `/S`、`/S /uninstall`、HKCU 注册检测项和默认主程序位置。面向普通用户时仍建议调起交互卸载并复检；自动更新由 Grammarly 负责。

## 7. Obsidian — Recommend，下一小批

### 官方来源

- [官方下载页](https://obsidian.md/download)
- [官方 Release v1.13.4](https://github.com/obsidianmd/obsidian-releases/releases/tag/v1.13.4)
- [Windows 安装包](https://github.com/obsidianmd/obsidian-releases/releases/download/v1.13.4/Obsidian-1.13.4.exe)
- [Obsidian URI 文档](https://help.obsidian.md/Extending%2BObsidian/Obsidian%2BURI)

本轮产物签名为 `Dynalist Inc`，版本 `1.13.4`，NSIS 安装器。检测应使用注册卸载项、签名主程序和版本；打开可使用验证后的主程序或已注册的 `obsidian://` 协议。官方没有提供足够稳定的普通用户静默卸载契约，因此保持交互卸载。Vault、插件、主题和配置属于用户数据，普通卸载不得删除。

## 8. Cherry Studio 1.9.13 — Defer

### 官方来源

- [官方 Release v1.9.13](https://github.com/CherryHQ/cherry-studio/releases/tag/v1.9.13)
- [Windows x64 Setup](https://github.com/CherryHQ/cherry-studio/releases/download/v1.9.13/Cherry-Studio-1.9.13-x64-setup.exe)
- [官方构建配置](https://github.com/CherryHQ/cherry-studio/blob/main/electron-builder.yml)

本轮 Windows x64 安装包 SHA-256 为 `7D64BD7528F9563EC3F1A09C7D1B5210CA47623F5568CCBA8FC71C7220E50A45`，文件版本 `1.9.13`，但 Authenticode 状态为 `NotSigned`。官方构建配置虽包含签名相关设置，当前公开产物仍无法建立稳定发布者链。

固定单个哈希只能批准一个历史文件，不能安全承接未来版本更新。因此保持“打开官方下载页”，等连续版本恢复有效 Windows 签名后再重新审计。

## 9. DeepChat 1.0.9 — Defer

### 官方来源

- [官方仓库](https://github.com/ThinkInAIXYZ/deepchat)
- [官方 Release v1.0.9](https://github.com/ThinkInAIXYZ/deepchat/releases/tag/v1.0.9)
- [官方构建配置](https://github.com/ThinkInAIXYZ/deepchat/blob/dev/electron-builder.yml)

官方仓库确认 Windows 桌面端、MCP、Skills、ACP 和本地数据能力，当前最新稳定 Release 为 `v1.0.9`。但本轮 Windows 安装产物验签结果为 `NotSigned`，无法建立可持续的 Windows 发布者身份。

在未签名状态下，AI Hub 不应自动下载并执行，也不应以后台哈希更新替代签名信任。保留官方 Release 入口；厂商恢复有效 Authenticode 后重新检查安装器类型、注册项、主程序、自动更新和卸载数据选项。

## 10. Windsurf — Defer

### 官方来源

- [原 Windsurf 下载入口](https://windsurf.com/editor/download)
- [当前 Devin Desktop 下载页](https://devin.ai/download)
- [当前官方入门文档](https://docs.windsurf.com/windsurf/getting-started)
- [官方支持页](https://windsurf.com/support)

审计时，原 Windsurf 下载入口已跳转到 Devin Desktop，原文档也已经改写为 Devin Desktop；支持页把旧 Windsurf 标为 legacy。继续保存旧 `codeiumdata` 版本化链接会把历史品牌、现行产品和更新通道混在一起。

在官方明确以下内容前暂缓纳管：

1. Legacy Windsurf 与 Devin Desktop 是否是升级、替代还是并行产品；
2. 当前 Windows 正式产物、发布者主体和版本 API；
3. 已安装旧 Windsurf 的检测、迁移、数据保留和卸载规则；
4. 目录中的 `windsurf-editor` 是否应改名、停用或拆分产品。

## 客户端固定规则

第一批 3 个产品都应使用同一受管桌面模块，但每个产品必须有客户端本地、不可由后台新增的安装档案：

1. **Source**：允许的起始 URL、重定向域名、架构选择和最大包大小。
2. **Artifact**：PE / MSIX 类型、有效证书链、发布者主体、产品名和版本规则；SHA-256 作为下载收据，不作为唯一长期信任。
3. **Install**：安装器适配器与客户端固定参数。EULA、UAC、安装目录和可选组件保留给用户。
4. **Detect**：注册卸载项或包身份 + 签名主程序 + 版本，至少两个独立信号一致。
5. **Open**：只打开已验证收据对应的主程序或协议；后台不能传入命令。
6. **Update**：默认尊重厂商更新器；AI Hub 负责版本状态、重新下载和修复，不并行覆盖。
7. **Uninstall**：只调起注册卸载器或包管理卸载 API，退出后重新检测；不得根据猜测删除安装目录。
8. **Data**：应用数据、模型、对话、扩展、工作区与账号缓存默认保留；清理数据另做显式二次确认。

## 第一批实现后的验收清单

- 在隔离 Windows 用户目录分别完成 Jan、VS Code、Zed 的真实完整下载。
- 记录最终 URL、内容长度、SHA-256、签名发布者、文件版本和安装收据。
- 人工完成协议、UAC 和安装选项；自动等待并检测安装结果。
- 验证“打开”启动的是签名匹配的主程序，而不是同名文件。
- 调起厂商卸载器；人工确认卸载选项；自动复检应用已移除。
- 确认 Jan 数据、VS Code 设置 / 扩展、Zed 设置 / 扩展按厂商界面选择保留，不被 AI Hub 擅自清理。
- 将真实失败写入 `docs/incident-feedback/`；单元测试或下载成功不等于用户机器验收通过。

完成上述实机闭环后，才能把这 3 个产品从“研究批准”标记为“客户端受管安装已验收”。
