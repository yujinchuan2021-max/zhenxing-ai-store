# Windows 桌面产品受管生命周期第三批：Notion 与 DeepL

审计日期：2026-08-04  
范围：Notion for Windows（legacy NSIS 与 x64 MSIX 迁移）和 DeepL for Windows（per-user Zero Install）  
证据规则：只使用厂商官网、厂商帮助中心、厂商第一方分发物 / feed，以及 Microsoft 官方 MSIX 文档；所有下载物只做离线读取，**未执行任何安装器、应用或卸载器**。

## 结论

| 产品 | 本轮结论 | 可进入客户端的部分 | 尚未通过的门槛 |
| --- | --- | --- | --- |
| Notion | **条件准入** | 干净机器上的 x64 MSIX 下载、验签、交互安装、包身份检测、打开和 MSIX 卸载 | legacy NSIS 自动迁移 / 自动卸载必须先在隔离 Windows 用户中捕获真实卸载收据并验收；未通过前发现旧版时只给迁移提示和 Windows 卸载入口 |
| DeepL | **准入 per-user 模式** | 官方 Zero Install 引导器下载验签、交互安装、HKCU 检测、固定协议打开、官方 per-user 卸载、厂商自更新 | 仍需一次隔离安装—打开—退出—卸载验收；machine-wide 模式会增加服务和计划任务，不进入普通用户默认流程 |

共同边界：

- AI Hub 只验证并调起已批准的厂商分发物，不替代厂商更新器。
- 当前 SHA-256、版本和证书 thumbprint 是 2026-08-04 的点时证据，不能永久钉死。持久合同应约束来源域、有效 Windows 信任链、发布者主体、产品身份、架构和安装器类型。
- 卸载只调用 Windows / 厂商正式生命周期，不递归删除用户配置、登录状态、日志、工作区文件或整个 AppData 目录。

## 方法

1. 解析官方稳定入口的完整重定向链和最终主机。
2. 下载当前 x64 MSIX、legacy NSIS 和 Zero Install 引导器，仅做大小、SHA-256、PE、VersionInfo、Authenticode 和包清单读取。
3. 从 Notion MSIX 读取 `AppxManifest.xml`、包内 `Notion.exe` 和 Windows 包签名状态。
4. 从 DeepL 第一方 `deepl.xml` 读取架构、入口、当前 stable implementation、内容摘要和依赖式更新模型。
5. 对照厂商文档中的安装、迁移、检测、更新、卸载和本地路径约定，区分“官方承诺”与“实现推断”。

临时下载目录在取证完成后删除；仓库不保存第三方二进制。

## 1. Notion for Windows

### 1.1 官方分发与迁移事实

Notion 当前同时保留两种 Windows 分发：

- [桌面下载页](https://www.notion.com/desktop/windows)当前明确展示 `Windows MSIX x64`。
- [Notion for desktop](https://www.notion.com/help/notion-for-desktop)仍分别说明普通 Windows 桌面安装器和 MSIX；x64 MSIX 稳定入口为 <https://www.notion.com/desktop/windows-msix/download>。
- legacy Windows 稳定入口 <https://www.notion.com/desktop/windows/download> 仍解析到版本化 NSIS EXE。
- [Deploy Notion for Windows](https://www.notion.com/help/deploy-notion-for-windows)明确说 legacy 安装器基于 NSIS，支持 `/S` 和 `/D`，且 Windows 自动更新当前不能关闭。

迁移规则不是推断。Notion 官方明确要求：从当前桌面版切换到 MSIX 时，**先卸载当前 Notion，再打开 MSIX 安装**；同时说明 MSIX 会从与旧版相同的位置读取现有 profile 和登录数据，窗口与标签页会继续出现。因而 AI Hub 不得并排安装 NSIS 与 MSIX，也不能把“数据可迁移”误写成“可跳过旧版卸载”。

### 1.2 当前 x64 MSIX 静态证据

稳定入口：<https://www.notion.com/desktop/windows-msix/download>  
重定向链：`www.notion.com` → `app.notion.com` → `desktop-release.notion-static.com`  
最终 URL：`https://desktop-release.notion-static.com/Notion-7.28.0.msix`

| 字段 | 2026-08-04 结果 |
| --- | --- |
| 文件 | `Notion-7.28.0.msix` |
| 大小 | `158,316,907` bytes |
| SHA-256 | `D2CB8E51AD20CB37C575D3A1A2A08E9DF82DBDC4507DB4F97D47378A61C6EE25` |
| Windows 签名 | `Valid` |
| 签名主体 | `CN="Notion Labs, Inc.", O="Notion Labs, Inc.", L=San Francisco, S=California, C=US` |
| 当前证书 thumbprint | `B354B8FCE9B34BF35DCDBC3B8DECB1F2AF46D599`（仅点时证据） |
| 包名 | `com.notion.app.desktop.notion` |
| Publisher | 与上面的 Notion Labs 证书主体完全一致 |
| 包版本 | `7.28.0.0` |
| 包架构 | `x64` |
| 最低 manifest 目标 | `Windows.Desktop 10.0.19041.0` |
| Application Id | `com.notion.app.desktop.notion` |
| 主程序 | `Notion\Notion.exe` |
| EntryPoint | `Windows.FullTrustApplication` |

包清单还声明：

- `notion:` URL protocol；
- `www.notion.so` 和 `app.notion.com` App URI handler；
- Notion 的 startup task；
- Markdown 文件关联；
- `runFullTrust`、`packageManagement`、`unvirtualizedResources`、网络和麦克风能力。

AI Hub 应在安装前展示这是 full-trust 桌面应用，并让 Windows App Installer 展示最终安装确认，不能静默吞掉系统确认。

包内 `Notion\Notion.exe` 的独立核验：

| 字段 | 结果 |
| --- | --- |
| 大小 | `232,405,304` bytes |
| SHA-256 | `F6D99C34744BD24A53019B70889908922F43A2E30E8D026FD2684131CA43E8FF` |
| PE Machine | `0x8664`（x64） |
| File / Product version | `7.28.0` |
| Company / Product | `Notion Labs, Inc` / `Notion` |
| Authenticode | `Valid`，发布者 `Notion Labs, Inc.` |

MSIX 的发布证书是短期签发并带 Microsoft 时间戳，进一步说明客户端不能永久钉当前 thumbprint；应要求包签名有效、证书主体与 manifest Publisher 一致，并重新读取每次下载的 manifest。Microsoft 的 [MSIX overview](https://learn.microsoft.com/en-us/windows/msix/overview)说明 `AppxSignature.p7x` 与 `AppxBlockMap.xml` 共同提供安装和运行时完整性；AI Hub 不应只验证外层文件名或 URL。

### 1.3 legacy NSIS 当前证据

稳定入口：<https://www.notion.com/desktop/windows/download>  
最终 URL：`https://desktop-release.notion-static.com/Notion%20Setup%207.28.0.exe`

| 字段 | 2026-08-04 结果 |
| --- | --- |
| 文件 | `Notion Setup 7.28.0.exe` |
| 大小 | `106,056,888` bytes |
| SHA-256 | `8C7ECFA9C3EBC530C4D688837BC38ECC3723686116546E16733F688722114D3C` |
| PE Machine | `0x014c`（x86 NSIS 引导壳；不是应用载荷架构） |
| File / Product version | `7.28.0` |
| Company / Product | `Notion Labs, Inc` / `Notion` |
| Authenticode | `Valid`，发布者 `Notion Labs, Inc.` |

这证明“legacy”描述的是安装机制，不代表该入口已经停止发布；当前 NSIS 和 MSIX 甚至是同一产品版本。客户端因此必须按**安装形态**识别，不能只比较 `7.28.0` 就认为迁移完成。

### 1.4 建议的 MSIX 受管生命周期

#### 下载与安装

1. 仅批准 x64 稳定入口和最终主机 `desktop-release.notion-static.com`；若最终主机、扩展名或内容类型越界则失败关闭。
2. 校验完整 MSIX 签名、manifest `Name` / `Publisher` / `Version` / `ProcessorArchitecture`、Application Id 和包内主程序签名。
3. [Notion 系统要求](https://www.notion.com/help/system-requirements-for-notion)当前要求 Windows 10 21H2 或更高版本（并列出 Windows Server 2016）；产品前置检查采用厂商要求，不因 manifest 最低值较低而放宽。
4. 使用 Windows 默认 App Installer 交互打开 MSIX；AI Hub 不从后台接受 PowerShell 参数，也不静默安装。
5. 先查询 MSIX 包；若不存在，再检查 legacy Windows“已安装的应用”记录。发现 legacy 候选时停止 MSIX 安装，显示“先卸载旧版，数据会迁移”，并调起 Windows 卸载入口。

#### 检测

MSIX 的确定性检测键是 manifest Name：

```powershell
Get-AppxPackage -Name 'com.notion.app.desktop.notion'
```

检测后还要比对 `Publisher`、`Architecture`、`Version` 和 `SignatureKind`，不能只以命令有输出为成功。Microsoft 的 [Package Identity overview](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/package-identity-overview)说明包全名由 Name、Version、Architecture、ResourceId 和 PublisherId 构成；应用 AUMID 则由动态的 PackageFamilyName 与 manifest Application Id 组成。

#### 打开

不要猜 `C:\Program Files\WindowsApps` 路径。查询已安装包后，使用返回的 `PackageFamilyName` 和固定 Application Id 动态构造：

```text
shell:AppsFolder\<PackageFamilyName>!com.notion.app.desktop.notion
```

也可以把经过 Windows 注册的固定 `notion:` protocol 作为回退；不得从后台下发任意 URI 或参数。

#### 更新

[Notion for desktop](https://www.notion.com/help/notion-for-desktop)说明桌面端自动更新，并允许用户在 Windows 应用菜单中检查更新。AI Hub 只展示已安装版本并在修复时重新获取稳定入口，不与 Notion 更新器并行覆盖安装。

#### 卸载与数据边界

优先调起 Windows“已安装的应用”；固定客户端模块也可以对当前用户查询到的精确 `PackageFullName` 使用 Windows 包卸载能力。Microsoft 的 [MSIX enterprise deployment](https://learn.microsoft.com/en-us/windows/msix/desktop/managing-your-msix-deployment-enterprise)说明卸载包会移除包工件和被容器化的应用数据，但不删除用户创建的文件。

Notion 只明确保证 **NSIS → MSIX 迁移时**复用 profile / 登录数据；它没有承诺 MSIX 卸载后所有本地缓存、离线内容或登录态都保留。因此客户端文案必须区分：

- 普通卸载：交给 Windows 包生命周期；
- 用户工作区和自行导出的文件：不删除；
- “清理 Notion 数据 / 登录状态”：本轮无官方可验证契约，不能提供自动清理。

### 1.5 Notion 阻断点

Notion 官方文档没有公布 legacy NSIS 的稳定卸载注册表键、AppId、uninstaller 路径或跨版本 ProductCode。本轮又遵守“绝不执行安装器”，所以尚未取得真实 legacy 安装收据。结论：

- **不阻断干净机器的 MSIX 受管实现**；
- **阻断 legacy 自动迁移和自动卸载**；
- 上线前必须在隔离 Windows 用户完成一次 NSIS 安装，记录 HKCU/HKLM 卸载项、安装位置、主程序签名、退出行为和卸载后的 profile 保留情况；然后再用 MSIX 安装验证官方所说的登录状态、窗口和标签页迁移。

在该门槛通过前，检测到任何可信的 legacy Notion 记录时只提供 Windows 卸载入口，不执行猜测的 `Uninstall.exe`。

## 2. DeepL for Windows

### 2.1 官方 Zero Install 模型

[About Zero Install](https://support.deepl.com/hc/en-us/articles/6725601939228-About-Zero-Install)明确说明：Zero Install 同时负责 DeepL Windows 的初次安装和后续自动更新，并从 `appdownload.deepl.com` 下载应用与更新。普通安装是 per-user；machine-wide 是另一个具有额外系统组件的模式。

[Unattended installation](https://support.deepl.com/hc/en-us/articles/9596644822428-Unattended-or-silent-installation-of-DeepL-app-for-Windows)还公开：

- `--silent` / `--verysilent` 可用于无人值守安装；
- `--prepare-offline` 会在引导器旁生成完整 `content` 目录；
- 如果 `content` 已存在，安装器可以不再联网下载。

AI Hub 的普通消费者流程应直接交互打开引导器，不默认添加静默、offline 或 machine 参数。这些模式若未来需要，必须是客户端固定模块中的显式选项，不能由后台提供命令行。

### 2.2 当前引导器静态证据

官方固定 URL：<https://appdownload.deepl.com/windows/0install/DeepLSetup.exe>  
最终 URL：同上，无跨域重定向  
最终主机：`appdownload.deepl.com`

| 字段 | 2026-08-04 结果 |
| --- | --- |
| 文件 | `DeepLSetup.exe` |
| 大小 | `4,914,904` bytes |
| SHA-256 | `E46AA95BF47009CFEB86575ED8B86000E24BEF6F1A6093F5CB5519BC9E96F243` |
| PE Machine | `0x014c`（x86 bootstrapper） |
| File version | `2.29.0.0` |
| Product version | `1.0.0.0`（不可用于判断 DeepL 应用版本） |
| Company | `zero-install` |
| Product / description | `DeepL` / `Bootstrapper for DeepL` |
| Authenticode | `Valid` |
| 发布者 | `DeepL SE` |
| 当前证书 thumbprint | `34BF691C9E1D0018F5C59DA02661040C1EAD6BE4`（仅点时证据） |

这里与 Jan、VS Code、Zed 的情形相同：被调起的引导壳是 x86，不代表最终产品是 32 位。持久身份合同应校验引导器 PE 为 x86，同时要求 DeepL 官方 feed 选择 `Windows-x86_64` 实现。

### 2.3 当前第一方 feed 证据

Feed：<https://appdownload.deepl.com/windows/0install/deepl.xml>

| 字段 | 2026-08-04 结果 |
| --- | --- |
| feed publisher | `DeepL SE` |
| feed architecture | `Windows-x86_64` |
| run command | `DeepL.exe` |
| entry app-id | `DeepL.Apps.Windows` |
| entry binary | `DeepL` |
| URL protocol | `deepl` |
| 当前最新 stable | `26.7.2.20508`，released `2026-07-21` |
| implementation digest | `HBD24UCCKLVAEMHWPY7TZSBRVUSXGGTHG4U4QOSMIWF2NJVRWPFQ` |
| 当前 archive | `https://appdownload.deepl.com/windows/0install/archives/deepl-26.7.2.20508.tar.zst` |
| archive size | `33,905,687` bytes |
| feed SHA-256 | `84278B2CE9521EBF5BA992CC6C4BBC9847B07ECC5C07B21D4DBD2504310AC683`（点时证据） |
| feed signature | 文件尾含 Zero Install Base64 签名 |

Feed 同时声明 .NET Desktop Runtime、CEF、OCR 数据和 native messaging host 等版本化依赖。这意味着 AI Hub 不能把 `DeepLSetup.exe` 的 `2.29.0.0` 显示成已安装 DeepL 版本，也不能自行拼接或挑选某个 archive；版本解析、依赖选择、摘要验证和更新继续由 Zero Install 完成。

### 2.4 建议的 per-user 受管生命周期

#### 前置检查、下载与安装

- [DeepL troubleshooting](https://support.deepl.com/hc/en-us/articles/4407741925778-Troubleshooting-desktop-apps)当前要求 Windows 10 64-bit、至少 500 MiB 磁盘；客户端按这个更保守的要求检查。
- 网络检查只验证实际请求是否可达，不按国家预判；厂商要求 `*.deepl.com` 不被 firewall、VPN 或 proxy 阻断。
- 下载后校验最终主机、完整 SHA、有效信任链、发布者 `DeepL SE`、VersionInfo 的 `DeepL` / `Bootstrapper for DeepL` 和 x86 引导壳。
- 交互调起 `DeepLSetup.exe`，按钮保持“正在安装”禁用态；安装结果以注册表收据为准，不以引导器进程退出或下载文件存在为准。

#### 检测

[DeepL Intune deployment](https://support.deepl.com/hc/en-us/articles/14885492440860-Configure-the-DeepL-for-Windows-app-via-Intune)给出了官方确定性检测键：

```text
HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\https%3a##appdownload.deepl.com#windows#0install#deepl.xml
```

普通用户流程只认 HKCU。若将来显式支持 machine-wide，则使用同名 HKLM 键，不能把两种 scope 合并成同一收据。检测后可显示 Zero Install 注册的版本；不要扫描易变的 `implementations` 哈希目录作为主证据。

#### 打开

第一方 feed 明确声明 `DeepL.exe` 入口、`DeepL.Apps.Windows` app-id 和 `deepl` protocol；Zero Install 文档说明 `%APPDATA%\0install.net\desktop-integration\stubs` 是转发到当前实现的稳定 stub 层。因此客户端优先通过 Windows 已注册的固定 `deepl:` protocol 打开，并可把发布者有效的 DeepL stub 作为回退。不得从动态 implementation 目录里挑第一个 EXE。

若卸载收据存在但 protocol / stub 缺失，应显示“修复 / 重新安装”，而不是声称已成功打开。

#### 更新

Zero Install 负责初装和自动更新。AI Hub 只读取安装收据、展示当前版本、提供打开 / 修复 / 卸载；不下载 feed 中 archive 覆盖正在运行的 DeepL，也不把引导器更新与应用更新混为一谈。

#### 卸载

DeepL 官方故障排查要求先退出 DeepL，再从 Windows Start 菜单选择卸载。Intune 文档进一步给出 per-user 的固定卸载生命周期：

```text
"%APPDATA%\Programs\Zero Install\0install-win.exe" remove --batch https://appdownload.deepl.com/windows/0install/deepl.xml
```

文档把 exit code `0` 和 `1` 都定义为成功。该命令只能存在于客户端本地固定模块；后台只选择 `deepl-zero-install-user` 模块，不能替换 executable、feed 或参数。执行后必须重新检查 HKCU 收据、protocol 和 stub，不能只看进程返回。

#### 数据边界

DeepL 官方列出的 per-user 实现路径是：

- `%LOCALAPPDATA%\0install.net\implementations`：DeepL 应用和依赖，内容会随更新变化；
- `%APPDATA%\Programs\Zero Install`：更新器；
- `%APPDATA%\0install.net\desktop-integration\stubs`：稳定转发层；
- `%APPDATA%\DeepL_SE\logs`：DeepL 应用日志；
- `%TEMP%` 中的 `DeepLSetup ... Log.txt`、`0install ... Log.txt`、`0install-win ... Log.txt`：安装 / 更新日志。

AI Hub 只能调用 Zero Install 的 `remove`，不得手工递归删除上述共享 0install 目录。DeepL 没有公开“卸载同时删除 `%APPDATA%\DeepL_SE` 中全部偏好和登录状态”的契约，因此普通卸载也不得删除该目录、用户翻译文件、账号、术语表或日志。若未来提供“清理数据”，必须是独立二次确认功能，并先取得厂商明确路径契约。

### 2.5 machine-wide 不是默认模式

[Machine-wide installation](https://support.deepl.com/hc/en-us/articles/10031198544156-Install-the-DeepL-app-for-Windows-machine-wide)明确说明 `--machine` 会额外安装：

- `Zero Install` 子目录中的两个 Windows 计划任务；
- `Zero Install Store Service` Windows 服务。

对应检测键在 HKLM，卸载器位于 `C:\Program Files\Zero Install\0install-win.exe`，并需 `--machine`。这会扩大权限、服务和卸载范围，不适合普通用户一键安装。只有企业管理员明确选择、客户端拥有独立白名单模块并完成 UAC / 服务 / 计划任务验收后，才能增加；当前普通目录固定使用 per-user。

### 2.6 DeepL 剩余验收门槛

官方合同已经足以实现 per-user 模块，但正式标记“已验收”前还需在隔离 Windows 用户完成：

1. 交互运行引导器，确认实际网络和 Windows 代理下能解析 feed / archive；
2. 核对 HKCU 收据、版本、`deepl:` protocol 和 signed stub；
3. 打开、退出托盘进程；
4. 调用固定 per-user 卸载，接受官方成功码 `0` / `1` 并重新检测；
5. 验证不残留应用收据 / protocol，同时不主动删除 `%APPDATA%\DeepL_SE` 和用户文件。

## 3. 客户端固定模块建议

| 模块 | 后台可调参数 | 客户端固定内容 |
| --- | --- | --- |
| `notion-msix-x64` | 展示文案、已批准稳定 URL、最低版本提示、排序 / 启停 | 最终主机 allowlist、MSIX 签名 / manifest identity、legacy migration guard、动态 PackageFamilyName 检测和固定 Application Id、Windows 卸载路径 |
| `deepl-zero-install-user` | 展示文案、已批准引导器 URL、排序 / 启停 | x86 bootstrapper 身份、`DeepL SE` 有效签名、HKCU 收据、固定 `deepl:` 打开、固定 per-user remove 命令、禁止 machine-wide 参数 |

后台不得下发：任意 EXE、PowerShell / CMD / Shell、命令行参数、注册表路径、Appx 包名、卸载器路径或 URL protocol。新增全新执行语义仍需客户端升级；厂商版本、稳定 URL 和展示内容可通过已批准模块更新。

## 4. 实现与发布顺序

1. 先实现 Notion MSIX 和 DeepL per-user 的静态身份合同与表驱动测试。
2. 用隔离 profile 做完整下载重放，确认真实包仍匹配本文身份，而非只用 fixture。
3. 完成 DeepL 隔离生命周期验收；通过后可发布 per-user 模块。
4. 完成 Notion legacy NSIS 安装收据捕获和 NSIS → MSIX 迁移验收；通过前保留迁移 guard，不自动卸载旧版。
5. 用户机器最终点击验收仍与自动测试分开记录；自动验签、fixture 或浏览器演示不能替代真实安装 / 卸载确认。

## 官方来源

### Notion

- [Download Notion for desktop](https://www.notion.com/desktop/windows)
- [Notion for desktop](https://www.notion.com/help/notion-for-desktop)
- [Deploy Notion for Windows](https://www.notion.com/help/deploy-notion-for-windows)
- [System requirements for Notion](https://www.notion.com/help/system-requirements-for-notion)
- [x64 MSIX stable endpoint](https://www.notion.com/desktop/windows-msix/download)
- [legacy NSIS stable endpoint](https://www.notion.com/desktop/windows/download)
- [Microsoft: MSIX app distribution and uninstall](https://learn.microsoft.com/en-us/windows/msix/desktop/managing-your-msix-deployment-enterprise)
- [Microsoft: package identity overview](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/package-identity-overview)
- [Microsoft: MSIX overview, manifest, block map and signature](https://learn.microsoft.com/en-us/windows/msix/overview)

### DeepL

- [DeepL for Windows](https://www.deepl.com/en/windows-app)
- [DeepLSetup.exe](https://appdownload.deepl.com/windows/0install/DeepLSetup.exe)
- [About Zero Install](https://support.deepl.com/hc/en-us/articles/6725601939228-About-Zero-Install)
- [Unattended or silent installation](https://support.deepl.com/hc/en-us/articles/9596644822428-Unattended-or-silent-installation-of-DeepL-app-for-Windows)
- [Configure DeepL via Intune](https://support.deepl.com/hc/en-us/articles/14885492440860-Configure-the-DeepL-for-Windows-app-via-Intune)
- [Machine-wide installation](https://support.deepl.com/hc/en-us/articles/10031198544156-Install-the-DeepL-app-for-Windows-machine-wide)
- [Troubleshooting desktop apps](https://support.deepl.com/hc/en-us/articles/4407741925778-Troubleshooting-desktop-apps)
- [Export a log file](https://support.deepl.com/hc/en-us/articles/4409562115602-Export-a-log-file)
- [DeepL Zero Install feed](https://appdownload.deepl.com/windows/0install/deepl.xml)
