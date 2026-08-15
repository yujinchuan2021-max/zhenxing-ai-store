# 5 个 Windows 桌面产品直接产物审计 A 组（2026-08-04）

## 结论

本轮从厂商官网或厂商官方 GitHub Release 下载了 `msty-go`、`msty-nexus`、`amd-gaia`、`letta-agent`、`rowboat-desktop` 的当前 Windows x64 产物，只做响应头、大小、SHA-256、Authenticode、PE、VersionInfo 和静态解包检查。**没有执行任何目标安装器、主程序、更新器或卸载器，也没有修改代码或 catalog。**

| 产品 | 本轮判断 | 进入受控安装定义前的门槛 |
| --- | --- | --- |
| `msty-go` | 条件性候选 | 滚动入口的实包是 0.14.1，但公开 changelog 顶部仍是 0.14.0；需在隔离用户安装中读回准确卸载收据，并明确是否接受个人证书主体 |
| `msty-nexus` | 暂缓 | 外层安装器和 GUI 主程序已签名，但随附运行程序与卸载器未签名；生命周期身份不完整 |
| `amd-gaia` | 暂缓 | 外层、主程序和卸载器全部未签名；官方 Release 的固定哈希只能确认 v0.22.0 这一份历史产物，不能替代后续版本的发布者信任 |
| `letta-agent` | 条件性候选 | 安装器、主程序和卸载器均由 Letta Inc. 有效签名；仍需隔离安装读回 ToDesktop 构建实际使用的卸载注册表子键和安装目录 |
| `rowboat-desktop` | 最强条件性候选 | 安装器、主程序和 Squirrel `Update.exe` 均由 ROWBOAT LABS, INC. 有效签名，静态收据完整；仍需完成一次隔离安装、打开、更新和交互式卸载读回 |

这不是实机安装验收，也不授权客户端自动下载或运行这些图形安装器。静态解包只能建立候选身份；安装 UI、权限、依赖、首次启动、更新、数据保留和卸载结果仍必须单独验收。

## 方法与证据边界

1. 下载只从厂商官网稳定入口或厂商官方 GitHub Release 发起；GitHub Release 重定向后的 `release-assets.githubusercontent.com` 签名 URL 是短期地址，因此只记录稳定 Release URL 和最终主机，不把短期查询串写入定义。
2. 对每个下载计算本机文件大小和 SHA-256，读取 Authenticode 状态、签名主题、PE 机器类型及 Windows VersionInfo。
3. 仅用静态解包工具查看 NSIS、Tauri、Electron、Squirrel 包内的主程序、卸载器、`app.asar`、`app-update.yml`、`RELEASES` 和 NuGet 元数据；没有加载或执行任何目标 PE。
4. 卸载收据分为两类：能由公开构建配置及安装框架源码精确推出的“静态收据”，以及只能给出名称候选、必须隔离安装后读回的“待确认收据”。后者不得硬编码。
5. Tauri 收据推导参照其官方 [Windows installer 文档](https://v2.tauri.app/distribute/windows-installer/) 和 [NSIS 模板](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi)；Squirrel 收据推导参照官方 [Squirrel.Windows 2.0.1 源码](https://github.com/Squirrel/Squirrel.Windows/tree/2.0.1)。

## 下载产物总表

| 产品 | 稳定官方 URL / 最终主机 | 文件与大小 | SHA-256 | 外层身份 |
| --- | --- | ---: | --- | --- |
| `msty-go` | [`go-assets.msty.ai/app/latest/win/MstyGo_x64.exe`](https://go-assets.msty.ai/app/latest/win/MstyGo_x64.exe) / `go-assets.msty.ai` | `MstyGo_x64.exe` · 42,706,936 B | `ECA410D11EE7855D025FC8260840F73FDCB8E84845B47718B33A5C9C9E73BB25` | PE x86 NSIS 启动器；Valid；Ashok Gelal；Msty Go 0.14.1 |
| `msty-nexus` | [`nexus-assets.msty.ai/app/latest/win/Msty-Nexus_x64.exe`](https://nexus-assets.msty.ai/app/latest/win/Msty-Nexus_x64.exe) / `nexus-assets.msty.ai` | `Msty-Nexus_x64.exe` · 24,571,592 B | `41B13CA93CA795D31B5330AF165E4E8ECCD9E2FF5F757634307C42D7AAE3CD4E` | PE x86 NSIS 启动器；Valid；Ashok Gelal；Msty Nexus 0.3.0 |
| `amd-gaia` | [AMD GAIA v0.22.0 Release](https://github.com/amd/gaia/releases/tag/v0.22.0) / `release-assets.githubusercontent.com` | `gaia-agent-ui-0.22.0-x64-setup.exe` · 117,167,241 B | `14555804E3D805A85CDD246FE6AABE840C1BE6B65D36EB62817CF9593602A01F` | PE x86 NSIS 启动器；NotSigned；GAIA 0.22.0 |
| `letta-agent` | [`download.letta.com/windows/nsis/x64`](https://download.letta.com/windows/nsis/x64) / `download.letta.com` | `Letta Setup 0.29.12 - x64.exe` · 160,012,392 B | `7F4D6BA595D4957BAD2EB7210591DA51A8DFF3D0DC9ADEDB179DDF5C6002190` | PE x86 NSIS 启动器；Valid；Letta Inc.；Letta 0.29.12 |
| `rowboat-desktop` | [Rowboat v0.8.3 Release](https://github.com/rowboatlabs/rowboat/releases/tag/v0.8.3) / `release-assets.githubusercontent.com` | `Rowboat-win32-x64-0.8.3-setup.exe` · 161,486,648 B | `CC6CFD0FFEDE048A072EAE0AF07665C2950DA38E7A65DF059C36C8A7BCC932B1` | PE x86 Squirrel Setup；Valid；ROWBOAT LABS, INC.；0.8.3 |

表中的 x86 是安装器启动壳架构；包内五个主程序均为 x64，因此不是产品位数误配。GAIA 和 Rowboat 的 SHA-256 还与其官方 GitHub Release 展开的资产 digest 完全一致。

## 1. `msty-go`

官方入口：[Msty Go](https://msty.ai/go/) · [Go changelog](https://msty.ai/go/changelog/)

### 静态产物身份

- 外层 `MstyGo_x64.exe`：Authenticode `Valid`；签名主题 `CN=Ashok Gelal, O=Ashok Gelal, L=Powell, S=Ohio, C=US, PostalCode=43065`；NSIS 3 Unicode / LZMA；VersionInfo 为 `Msty Go` 0.14.1。
- 主程序 `MstyGo.exe`：x64，118,412,600 B，SHA-256 `867B50D94D9BFA39EB2BE1092147B3ACD94939EF0101B7E0C952C63019ABEA3A`；签名 `Valid`，主题相同；ProductName `Msty Go`、CompanyName `msty`、版本 0.14.1。
- 卸载器 `uninstall.exe`：106,032 B，SHA-256 `556FDD72A807271B78725777705D0A10C740D75B4F8229A9F3E9F20A9A5167B4`；签名 `Valid`，主题相同；版本 0.14.1。

### 主程序与卸载收据

静态候选为：

- DisplayName：`Msty Go`
- Publisher 候选：`msty`（来自主程序 CompanyName；**不是**证书主题）
- 主程序：`<InstallLocation>\MstyGo.exe`
- 卸载器：`<InstallLocation>\uninstall.exe`
- 当前用户卸载键候选：`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Msty Go`
- 普通卸载：`"<InstallLocation>\uninstall.exe"`，不加静默参数

这些路径和键名符合 Tauri 官方 NSIS 模板，但没有执行安装，故 `InstallLocation`、最终 Publisher 和键值仍需隔离安装读回。另一个漂移信号是：滚动二进制为 0.14.1，而本轮查看的公开 changelog 顶部仍列 0.14.0。若进入定义，必须在每次安装点击后重新解析版本与签名，不能把本轮哈希当成滚动 URL 的永久哈希。证书主体是个人姓名而非 Msty 法人，允许列表若采用精确签名主题，需要显式产品政策决定。

## 2. `msty-nexus`

官方入口：[Msty Nexus](https://msty.ai/products/nexus/) · [Nexus changelog](https://msty.ai/nexus/changelog)

### 静态产物身份

- 外层 `Msty-Nexus_x64.exe`：Authenticode `Valid`；签名主题与 Msty Go 相同；NSIS 3 Unicode / Deflate；ProductName `Msty Nexus`、CompanyName `Msty`、版本 0.3.0。
- GUI 主程序 `MstyNexus.exe`：x64，18,645,312 B，SHA-256 `D6FC2D0A10DFF92E19E255F9B47BCDE9891F4B1A8EE5455C8849388F19F3D75C`；签名 `Valid`，主题相同；VersionInfo 为空。
- 随附运行程序 `msty-nexus.exe`：x64，28,572,672 B，SHA-256 `D54BB6FCD1753FBFF503A3415A3DEEC9ECC5A33E92E10DAAB485F413F253CC40`；`NotSigned`；无 VersionInfo。
- 卸载器 `uninstall.exe`：129,325 B，SHA-256 `A8512EC6EC678FD26E2641FC3A3D54BD94F72FDDDF339188EDC8DD1D1B39E0BC`；`NotSigned`；VersionInfo 为 Msty Nexus Installer 0.3.0 / Company `Msty`。

### 主程序与卸载收据

候选 DisplayName / Publisher 为 `Msty Nexus` / `Msty`，GUI 主程序为 `<InstallLocation>\MstyNexus.exe`，随附运行程序为 `<InstallLocation>\msty-nexus.exe`，卸载器为 `<InstallLocation>\uninstall.exe`；当前用户卸载键候选为 `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Msty Nexus`。这些仍需安装读回。

本项不应因为“外层和 GUI 已签名”就进入自动化：真正参与运行生命周期的 `msty-nexus.exe` 与卸载器均未签名。若未来厂商补齐签名，仍需重新审计整包，而不是只复用外层签名主题。

## 3. `amd-gaia`

官方来源：[AMD GAIA v0.22.0 Release](https://github.com/amd/gaia/releases/tag/v0.22.0) · [v0.22.0 Electron Builder 配置](https://github.com/amd/gaia/blob/v0.22.0/src/gaia/apps/webui/electron-builder.yml)

### 静态产物身份

- 外层安装器：`NotSigned`；VersionInfo 为 ProductName `GAIA`、CompanyName `AMD AI Group`、版本 0.22.0。
- 主程序 `gaia-desktop.exe`：x64，225,495,552 B，SHA-256 `60F69BF530577F03F34D4DF96964AA50A9773F0EE301B72174C61771ED68DCE7`；`NotSigned`；GAIA 0.22.0。
- 卸载器 `Uninstall gaia-desktop.exe`：282,685 B，SHA-256 `BDA8B0041A603202913090041D5473BD977B5D9D5297AE07A43D7793E3C95B54`；`NotSigned`；GAIA 0.22.0。
- `app.asar` 声明包 `@amd-gaia/agent-ui` 0.22.0，`app-update.yml` 指向 GitHub `amd/gaia`。

### 主程序与卸载收据

官方构建配置明确给出 `appId=ai.amd.gaia`、`productName=GAIA`、`executableName=gaia-desktop`、x64 NSIS、`perMachine=false`、`oneClick=false` 和 `forceCodeSigning=false`。按 Electron Builder 的 NSIS 标识规则，静态收据为：

- 卸载键：`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\071ff68a-44b8-5d94-b099-f93e99d1c3f3`
- DisplayName：`GAIA`
- Publisher：`AMD AI Group`
- 主程序：`<InstallLocation>\gaia-desktop.exe`
- 卸载：`"<InstallLocation>\Uninstall gaia-desktop.exe"`
- 静默卸载：在上式后加 `/S`

v0.22.0 的官方 Release digest 与本轮 SHA-256 一致，能确认本轮文件未偏离该固定 Release；但三段 PE 都没有 Authenticode 发布者身份，且上游明确关闭强制签名。因此本项应继续停留在官方下载/人工安装路径，不进入客户端受控执行允许列表。

## 4. `letta-agent`

官方来源：[Letta Desktop 文档](https://docs.letta.com/guides/ade/desktop/) · [Letta Code 官方仓库](https://github.com/letta-ai/letta-code) · [Windows x64 稳定入口](https://download.letta.com/windows/nsis/x64)

### 静态产物身份

- 响应头给出的官方文件名是 `Letta Setup 0.29.12 - x64.exe`。
- 外层安装器：Authenticode `Valid`；签名主题为 `CN=Letta Inc., O=Letta Inc., L=Oakland, S=California, C=US, SERIALNUMBER=3758417`；VersionInfo 为 Letta 0.29.12，构建标识 `260731y1aps0914`。
- 主程序 `Letta.exe`：x64，210,176,760 B，SHA-256 `619D645E155D60B8A336FEEC6495617612DA47E206B66081D85201B4C8CC4334`；签名 `Valid`，主题相同；版本 0.29.12.0。
- 卸载器 `Uninstall Letta.exe`：189,104 B，SHA-256 `2253B1D070EA8586C2DDEEEC9D92DC9619DF987662F6981BE6AA4ED094D4D243`；签名 `Valid`，主题相同；版本 0.29.12。
- `app.asar` 声明包名 `letta-code`、ProductName `Letta`、版本 0.29.12；`app-update.yml` 使用 ToDesktop 通用更新地址，缓存名为 `letta-code-updater`。

### 主程序与卸载收据

可确认 DisplayName / Publisher 为 `Letta` / `Letta`，主程序为 `<InstallLocation>\Letta.exe`，卸载器为 `<InstallLocation>\Uninstall Letta.exe`；普通卸载不加参数，静默形式通常加 `/S`。

本轮无法从公开 ToDesktop 配置与静态包元数据证明确切的 Electron Builder 卸载注册表哈希子键和默认 `InstallLocation`。因此不得猜测或硬编码；需要一次隔离的当前用户安装，读取 `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall` 中新增项，并同时核对 DisplayIcon、InstallLocation、UninstallString、QuietUninstallString 和主程序签名。签名链完整使它成为好候选，但收据未闭环前仍只是候选。

## 5. `rowboat-desktop`

官方来源：[Rowboat v0.8.3 Release](https://github.com/rowboatlabs/rowboat/releases/tag/v0.8.3) · [v0.8.3 Electron Forge 配置](https://github.com/rowboatlabs/rowboat/blob/v0.8.3/apps/x/apps/main/forge.config.cjs)

### 静态产物身份

- 外层 Squirrel Setup：Authenticode `Valid`；签名主题 `CN="ROWBOAT LABS, INC.", O="ROWBOAT LABS, INC.", L=SAN FRANCISCO, S=California, C=US`；VersionInfo 为 `AI coworker with memory` / Company `rowboatlabs` / 0.8.3。
- 包内 `RELEASES`：`9D85A73496A8F8FFD903F1B103B8CD946D5C06F6 Rowboat-win32-x64-0.8.3-full.nupkg 161261833`。其中 SHA-1 是 Squirrel 旧式包收据，不作为发布者信任信号。
- NuGet 元数据：id `Rowboat-win32-x64`，title `Rowboat`，authors / owners `rowboatlabs`，版本 0.8.3。
- 主程序 `rowboat.exe`：x64，210,848,056 B，SHA-256 `9FB3A50E16B0FB37902848A495C04FC6160E6A8F650D0097630CC4B7B1F75B73`；签名 `Valid`，主题相同；ProductName `Rowboat`、版本 0.8.3。
- 生命周期程序 `Update.exe`：1,915,192 B，SHA-256 `D86E2655C7B00042A6DC4D9277CBCB07345F7893911C68232F951AC4F76BD76F`；签名 `Valid`，主题相同；Squirrel 2.0.1。

### 主程序与卸载收据

根据官方 Squirrel 2.0.1 源码、官方 Forge 配置和包内 nuspec，可静态确定：

- 安装根目录：`%LOCALAPPDATA%\Rowboat-win32-x64`
- 版本目录：`%LOCALAPPDATA%\Rowboat-win32-x64\app-0.8.3`
- 主程序：`%LOCALAPPDATA%\Rowboat-win32-x64\app-0.8.3\rowboat.exe`
- 卸载键：`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Rowboat-win32-x64`
- DisplayName / DisplayVersion / Publisher：`Rowboat` / `0.8.3` / `rowboatlabs`
- UninstallString：`"%LOCALAPPDATA%\Rowboat-win32-x64\Update.exe" --uninstall`
- QuietUninstallString：在上式后加 `-s`

这是五项中静态收据最完整的一项。不过 Squirrel 的实际首次安装、快捷方式、更新切换和卸载后的用户数据行为仍需隔离验收；不能把“签名和收据都完整”直接写成“已在用户机器完成安装闭环”。

## 接入建议

1. 当前只应把 Rowboat、Letta 和 Msty Go 视为下一步隔离生命周期验证候选；不应直接向用户宣称“一键安装已支持”。
2. Msty Nexus 在未签名的 sidecar 与卸载器补齐信任策略前暂缓；GAIA 因完整生命周期均未签名而硬性暂缓。
3. 若未来实现客户端受控下载，每次点击后都应解析最终 URL、大小、SHA-256、签名状态与精确主题，并把它们写入任务证据；滚动 URL 不得复用旧哈希。
4. 安装后必须读回卸载项并验证主程序；卸载必须由用户交互确认，执行后再检查注册表、主程序和保留数据。自动化验证不能替代真实用户/设备验收。

本轮自建下载与解包临时目录在报告核对后删除，目标产物没有留在仓库中。
