# Windows 受管桌面产品第二批调查：Grammarly 与 Obsidian

调查日期：2026-08-04  
范围：Grammarly for Windows、Obsidian for Windows  
证据边界：只使用厂商官网、官方帮助/文档和官方 GitHub；安装包仅做静态读取，**未执行任何第三方安装器**。

## 结论

| 产品 | 结论 | 可以进入客户端的范围 | 仍需的真实机器证据 |
| --- | --- | --- | --- |
| Grammarly for Windows | **有条件批准** | 受管下载、静态验签、交互安装、官方注册表检测、打开、调起厂商卸载 | 隔离 Windows 用户下完成一次安装→检测→打开→卸载→复检，固化真实收据与主程序签名 |
| Obsidian for Windows | **阻断生产白名单，允许进入隔离验收** | 官方下载与安装包静态验证；可准备交互安装流程 | 官方没有公布 Windows 卸载注册键、`UninstallString` 或安装路径合同；必须先用真实安装收据确认检测、打开和交互卸载，不得根据 Electron/NSIS 常见路径猜测 |

两者都不应使用单一 SHA-256 作为长期信任。客户端应固定起始/重定向域名、有效 Authenticode、发布者主体、PE 引导壳架构和产品版本信息；后台只能更新已批准的版本、URL、大小和哈希。

## 1. Grammarly for Windows

### 官方证据

- [Grammarly for Windows 产品页](https://www.grammarly.com/desktop/windows)
- [Grammarly for Windows 官方部署文档](https://support.grammarly.com/hc/en-us/articles/4422076438029-How-to-deploy-Grammarly-for-Windows)
- [Windows 与 macOS 官方重装/卸载步骤](https://support.grammarly.com/hc/en-us/articles/4403747415821-How-do-I-reinstall-Grammarly-for-Mac-or-Grammarly-for-Windows)
- [删除 Grammarly 账号与个人数据](https://support.grammarly.com/hc/en-us/articles/115000090052-Delete-your-Grammarly-account)
- [官方 Windows 滚动安装器](https://download-windows.grammarly.com/GrammarlyInstaller.exe)

官方部署文档明确给出：

- 普通安装行为是 per-user；默认不提供 per-machine 版。
- 安装前提包含 Windows 10 1903、.NET Framework 4.7.2 和 WebView2。
- 官方批量命令为 `GrammarlyInstaller.exe /S`，静默卸载命令为 `GrammarlyInstaller.exe /S /uninstall`。AI Hub 面向普通用户时仍应保留交互安装/卸载，不自动引入企业托管参数。
- 官方检测键是 `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Grammarly Desktop Integrations`，版本值是 `DisplayVersion`，并注明在 64 位客户端上按 32 位应用处理。
- per-user 主程序的官方路径模板是 `%LOCALAPPDATA%\Grammarly\DesktopIntegrations\Grammarly.Desktop.exe`；文档也把该路径用于开机启动值。
- 更新由 Grammarly 自动执行，官方说明周期为每两周一次，更新文件会数字签名。
- 官方重装文档要求先退出托盘程序，再通过 Windows 的“已安装的应用”进行卸载。

### 2026-08-04 官方产物静态证据

`https://download-windows.grammarly.com/GrammarlyInstaller.exe` 未发生 HTTP 重定向，起始与最终主机均为 `download-windows.grammarly.com`。

| 字段 | 观测值 |
| --- | --- |
| 文件 | `GrammarlyInstaller.exe` |
| 大小 | 37,269,536 bytes |
| SHA-256 | `A63C2F6C8814B2D9615AC3B7D7516AD2DC152F8E5EB00A7126414CB6D7B6114F` |
| PE Machine | `0x014c` (x86 引导壳) |
| 安装器标记 | NSIS / Nullsoft |
| Authenticode | `Valid` |
| 签名主体 | `Grammarly, Inc.` |
| ProductName / FileDescription | `Grammarly for Windows` |
| CompanyName | `Grammarly Inc.` |
| FileVersion / ProductVersion | `1.2.283.1934` |

PE Machine 描述的是下载到的 NSIS 引导壳，不是产品展示架构。客户端身份合同应按观测到的 x86 PE 校验，不得因为客户端 Windows 是 x64 就把引导壳写成 x64。

### 建议的受管生命周期

1. **Source**：只允许 HTTPS 起始及最终主机 `download-windows.grammarly.com`。该 URL 是滚动产物，每次后台发布新版本都要重新执行哈希、大小、签名和产品身份审核。当前 37 MB 产物可使用 128 MiB 作为第一版客户端上限（这是 AI Hub 安全裕量，不是厂商承诺）。
2. **Artifact**：需同时满足有效 Authenticode、发布者主体 `Grammarly, Inc.`、PE x86、`Grammarly for Windows` 产品名/描述与数字版本。不固定证书指纹，允许厂商正常续签。
3. **Install**：验证通过后调起厂商安装器，按钮保持“正在安装”直到检测收据出现。只在隔离验收确认安装器自行处理 .NET/WebView2 后，才能决定是否需要 AI Hub 单独呈现依赖。
4. **Detect**：用官方 HKCU 卸载键的 `DisplayVersion` 作收据候选，再校验 `Grammarly.Desktop.exe` 的 Authenticode、发布者和文件版本；两个独立信号一致才报告“已安装”。
5. **Open**：从已验证收据定位主程序；可用官方 per-user 路径作候选，但不能跳过签名与产品名复检。
6. **Update**：尊重 Grammarly 的自动更新器。AI Hub 只显示已安装版本、提供打开/重新下载入口，不在厂商更新运行时并行覆盖。
7. **Uninstall**：优先调起验证过的注册卸载项，退出后重新检测。`/S /uninstall` 是有官方证据的企业参数，但普通客户端第一版不必默认静默卸载。
8. **Data**：普通卸载只移除 Windows 应用。官方将“删除账号与个人信息/已保存文档”定义为独立、不可撤销的账号操作；AI Hub 不得把应用卸载扩展为账号删除，也不猜测删除本地用户设置目录。

### 上线前验收门槛

官方文档已给出完整的检测与卸载契约，因此可进入客户端候选白名单。但在标记“真机已验收”前，必须在隔离 Windows 用户下记录：安装后卸载键、主程序路径/签名/版本、打开、交互卸载、卸载后收据消失，以及账号数据未被 AI Hub 删除。

## 2. Obsidian for Windows

### 官方证据

- [Obsidian 官方下载页](https://obsidian.md/download)
- [Obsidian 官方 Release v1.13.4](https://github.com/obsidianmd/obsidian-releases/releases/tag/v1.13.4)
- [v1.13.4 Windows Universal 安装器](https://github.com/obsidianmd/obsidian-releases/releases/download/v1.13.4/Obsidian-1.13.4.exe)
- [Windows 下载与安装文档](https://github.com/obsidianmd/obsidian-help/blob/1d26fe9d22673ba476c77919800ce514dc0907e0/en/Getting%20started/Download%20and%20install%20Obsidian.md)
- [Obsidian 更新与安装器版本文档](https://github.com/obsidianmd/obsidian-help/blob/1d26fe9d22673ba476c77919800ce514dc0907e0/en/Getting%20started/Update%20Obsidian.md)
- [Obsidian 数据存储文档](https://github.com/obsidianmd/obsidian-help/blob/1d26fe9d22673ba476c77919800ce514dc0907e0/en/Files%20and%20folders/How%20Obsidian%20stores%20data.md)
- [Obsidian URI 文档](https://github.com/obsidianmd/obsidian-help/blob/1d26fe9d22673ba476c77919800ce514dc0907e0/en/Extending%20Obsidian/Obsidian%20URI.md)

官方下载页把当前 Windows 产物标为 **Universal**，并直接链接到官方 GitHub Release。官方安装文档要求用户打开该安装文件并按界面完成安装，没有公布普通用户的静默首装参数。

### 2026-08-04 官方产物静态证据

官方下载页当日指向 `v1.13.4/Obsidian-1.13.4.exe`；官方 latest Release 也解析为 `v1.13.4`。版本化 GitHub URL 最终重定向到 `release-assets.githubusercontent.com`。最终 URL 的限时查询串不得持久化，只持久化官方版本化起始 URL 与允许的最终主机。

| 字段 | 观测值 |
| --- | --- |
| 文件 | `Obsidian-1.13.4.exe` |
| 大小 | 326,879,800 bytes |
| SHA-256 | `8C761AAA40310D339B6936092E91E99A9886DAF1FD655F4C8D59E9F7FA46E7A0` |
| PE Machine | `0x014c` (x86 引导壳) |
| 安装器标记 | NSIS / Nullsoft |
| Authenticode | `Valid` |
| 签名主体 | `Dynalist Inc` |
| ProductName / FileDescription | `Obsidian` |
| CompanyName | `Obsidian` |
| FileVersion / ProductVersion | `1.13.4` |

官方页的“Universal”是产物适用范围；下载文件本身仍是 x86 NSIS 引导壳。AI Hub 的安装包身份合同必须按实际 PE Machine `x86` 校验，不得把展示上的 Universal 误写为 PE x64。

### 已核验的生命周期边界

1. **Source**：从 `obsidian.md/download` 解析当前版本化 GitHub Release URL；允许的起始主机为 `github.com`，观测到的最终主机为 `release-assets.githubusercontent.com`。当前 326.9 MB 产物可使用 512 MiB 作为第一版客户端上限（AI Hub 安全裕量，不是厂商承诺）。
2. **Artifact**：需同时满足有效 Authenticode、发布者主体 `Dynalist Inc`、PE x86、产品名/描述 `Obsidian` 与数字版本。不固定短期证书指纹，但必须要求 Windows 验签链为 `Valid`。
3. **Install**：按官方文档调起交互安装器；不自造静默参数。按钮在安装器运行与收据复检期间保持灰色“正在安装”。
4. **Update**：官方明确区分两层：桌面应用定期检查更新，开启自动更新时会在重启后应用；Electron “安装器版本”不能由该自动更新流程升级，需重新下载并运行安装器，且不必先卸载。AI Hub 可显示两个版本状态，并仅在用户主动点击时获取新安装器。
5. **Data**：官方说明 vault 是用户本地文件夹，笔记是 Markdown 文件；每个 vault 内的 `.obsidian` 保存快捷键、主题、插件等配置，Windows 全局设置在 `%APPDATA%\Obsidian\`。普通卸载不得删除任何 vault、`.obsidian` 或 `%APPDATA%\Obsidian\`。

### 阻断项：检测、打开与卸载收据未被官方公开

截至本次调查，Obsidian 官方安装文档只说明“打开安装文件并按界面操作”；官方帮助与 Release 没有公布：

- Windows 卸载注册键的稳定名称或产品代码；
- `InstallLocation`、`DisplayIcon`、`UninstallString` 和 `QuietUninstallString` 的真实值；
- 已安装 `Obsidian.exe` 的签名主体、路径和文件版本是否与安装器一致；
- 普通用户静默卸载参数。

因此现在不得把 Obsidian 直接标记为“生产受管安装已验收”，也不得因为它是 NSIS/Electron 就猜测 `%LOCALAPPDATA%\Programs\Obsidian`或 `Uninstall Obsidian.exe`。

解除阻断只需一次隔离 Windows 用户验收：

1. 交互安装官方已验证产物；
2. 记录新增卸载注册项和主程序路径；
3. 验证主程序 Authenticode、产品名与版本；
4. 从收据打开 `Obsidian.exe`，而不是从硬编码路径打开；
5. 调起注册的交互卸载器，等待其退出后复检应用收据消失；
6. 确认 vault、`.obsidian` 与 `%APPDATA%\Obsidian\` 仍保留。

收据完成后，AI Hub 才可将“卸载注册项 + 有效签名主程序 + 文件版本”固化为本地白名单合同。后台仍只能更新版本化 URL、大小和哈希，不能下发卸载命令或主程序路径。

## 客户端实现清单

### Grammarly

- 本地固定模块：`desktop-managed/nsis`。
- 滚动源域名：`download-windows.grammarly.com`。
- 引导壳架构：`x86`。
- 签名主体：`Grammarly, Inc.`。
- 产品身份：`Grammarly for Windows` / `Grammarly Inc.`。
- 收据：官方 HKCU 卸载键 + 签名主程序 + 版本。
- 更新：尊重厂商自更新；必要时用户主动重新下载。
- 卸载：从收据调起交互卸载，不删账号/数据。

### Obsidian

- 本地固定模块候选：`desktop-managed/nsis`，但当前保持生产白名单阻断。
- 版本解析：`obsidian.md/download` → 官方 GitHub Release。
- 允许主机：`github.com` 和 `release-assets.githubusercontent.com`。
- 引导壳架构：`x86`；产物展示：Windows Universal。
- 签名主体：`Dynalist Inc`。
- 产品身份：`Obsidian`。
- 更新：应用内更新与安装器版本更新分开展示。
- 收据/打开/卸载：等待隔离安装收据，禁止猜测路径。
- 数据：永不在普通卸载中删除 vault、`.obsidian` 或 `%APPDATA%\Obsidian\`。

## 本次静态调查备注

- 两个安装包均只做了 HTTPS 最终 URL、文件长度、SHA-256、PE Machine、可见 NSIS 标记、VersionInfo 和 Windows Authenticode 静态检查。
- 安装器没有被启动，因此本文没有把安装、UAC、首次启动、更新、卸载或数据保留写成已经通过的用户机器验收。
- 调查用临时大文件与官方帮助仓库快照在取证后删除，不纳入项目或发布包。
