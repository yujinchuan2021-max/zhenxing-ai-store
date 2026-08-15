# ZeroClaw 与 IronClaw：Windows CLI 官方发布核对

审计日期：2026-08-04  
范围：只核对 ZeroClaw 与 IronClaw 当前官方 Windows CLI 发布方式；不安装、不运行产品，也不修改生产代码。  
证据范围：项目官方 GitHub 仓库、官方 Release / Release 资产、官方校验文件和仓库内官方文档。

## 结论

| 产品 | 当前稳定版 | Windows 官方支持 | x64 MSI | AI Hub 结论 |
| --- | --- | --- | --- | --- |
| ZeroClaw | `v0.8.4` | 原生 Windows 10 / 11；也可走 WSL2 | 有，但它是“桌面程序 + CLI sidecar”组合包 | **CLI-only 优先使用官方 ZIP 路径；桌面产品可使用 MSI。不要把 MSI 当成已加入 PATH 的纯 CLI 安装器。** |
| IronClaw | `1.0.0`（tag `ironclaw-v1.0.0`） | 原生 Windows x64 MSI；官方也列出 Windows/WSL shell 路径 | 有，是纯 CLI MSI | **可作为原生 Windows CLI 固定驱动，直接下载固定版本 MSI 后交给 Windows Installer。** |

共同风险：本轮下载的两个官方 MSI 均没有 Authenticode 数字签名。官方 SHA-256 可以证明下载内容与 Release 一致，但不能证明 Windows 发布者身份；客户端不能把“哈希匹配”写成“厂商签名有效”。

## 核对方法

1. 从两个项目的 `releases/latest` 确认当前稳定 tag。
2. 从官方 Release 资产列表和官方校验文件读取 x64 MSI 名称、固定 URL 与 SHA-256。
3. 只下载官方 MSI 做离线只读检查：重新计算 SHA-256，并读取 MSI 的 `Property`、`File`、`Directory`、`Environment` 和 `Shortcut` 表。
4. 没有执行 MSI、没有运行产品、没有触发 onboarding，也没有改注册表或 PATH。

## 1. ZeroClaw

### 1.1 Windows 支持与官方推荐路径

[官方 Windows 指南](https://github.com/zeroclaw-labs/zeroclaw/blob/master/docs/book/src/setup/windows.md)明确覆盖 Windows 10 / 11，也说明 WSL2 可以改走 Linux 安装路径。该指南当前把“预编译 ZIP + PowerShell”列为原生 Windows 的推荐 CLI 路径：下载 `zeroclaw-x86_64-pc-windows-msvc.zip`，把 `zeroclaw.exe` 放到 `%USERPROFILE%\.zeroclaw\bin`，加入用户 PATH，最后运行 `quickstart`。

官方推荐的安装后命令为：

```powershell
zeroclaw --version
zeroclaw quickstart
zeroclaw agent -a <alias>
```

需要常驻时，官方 Windows 指南使用当前用户的计划任务，而不是真正的 LocalSystem Windows Service：

```powershell
zeroclaw service install
zeroclaw service start
zeroclaw service status
```

因此，**ZeroClaw 的官方“推荐 CLI 安装”目前仍是 ZIP，不是 MSI**。Release 虽然提供 MSI，但不能据此覆盖官方 Windows 指南对 CLI-only 路径的说明。

### 1.2 当前 Release 与 x64 MSI

[官方最新 Release](https://github.com/zeroclaw-labs/zeroclaw/releases/tag/v0.8.4)为 `v0.8.4`，发布于 2026-08-02。官方 [Release 资产元数据](https://github.com/zeroclaw-labs/zeroclaw/releases/expanded_assets/v0.8.4)和 [SHA256SUMS](https://github.com/zeroclaw-labs/zeroclaw/releases/download/v0.8.4/SHA256SUMS)给出以下值：

| 字段 | 值 |
| --- | --- |
| 文件名 | `ZeroClaw-windows-x64.msi` |
| 固定下载 URL | [ZeroClaw-windows-x64.msi](https://github.com/zeroclaw-labs/zeroclaw/releases/download/v0.8.4/ZeroClaw-windows-x64.msi) |
| 官方 SHA-256 | `ea14713ca8dae2ed231a1d5a1df079496e08ec2a7d054c44c46d17c3aa51b379` |
| 文件大小 | `16,146,432` bytes |
| MSI `ProductName` | `ZeroClaw` |
| MSI `ProductVersion` | `0.8.4` |
| MSI `Manufacturer` | `zeroclawlabs` |
| MSI `ProductCode` | `{1538A590-C921-495D-880D-301CBFF20DA7}` |
| MSI `UpgradeCode` | `{AA368714-9C9E-5490-A086-6D89867E1CBD}` |
| Authenticode | `NotSigned` |

本地重新计算的 SHA-256 与官方 Release 值一致。

### 1.3 MSI 实际装的是什么

官方 MSI 的只读表结构显示：

- 安装目录是 `C:\Program Files\ZeroClaw`，`ALLUSERS=1`。
- 包内同时包含 `zeroclaw-desktop.exe` 和 `zeroclaw.exe`。
- 开始菜单和桌面快捷方式指向 `zeroclaw-desktop.exe`。
- MSI 没有 `Environment` 表，因此**不会把 CLI 所在目录加入 PATH**。
- MSI 内置标准卸载快捷方式，目标是 `msiexec.exe /x [ProductCode]`。

这证明它是桌面应用安装器，CLI 是随桌面程序安装的 sidecar。若 AI Hub 将它作为桌面产品下载，安装后可用固定绝对路径探测 CLI：

```powershell
& "$env:ProgramFiles\ZeroClaw\zeroclaw.exe" --version
& "$env:ProgramFiles\ZeroClaw\zeroclaw.exe" quickstart
```

上面的绝对路径调用是根据官方 MSI 表得到的 AI Hub 驱动建议，不是官方文档发布的 PATH 命令。

### 1.4 AI Hub 建议

- **CLI-only 模块**：采用官方 Windows 指南的 ZIP 资产，固定 tag、固定 GitHub 仓库与固定资产名；解压到 AI Hub 收据管理的目录，再运行 `zeroclaw quickstart`。当前 ZIP 的官方 SHA-256 是 `de17681f981b4bd7e1fa2c493924e2a9df60825932ec0f99a3fb647f2a3242c3`。
- **桌面产品模块**：可以展示 `ZeroClaw-windows-x64.msi`，由用户确认 Windows Installer；安装后用 `ProductName=ZeroClaw`、`UpgradeCode` 和绝对路径检测。
- 不要执行 `setup.bat --prebuilt` 作为无 Rust 路径。官方文档明确记录它当前仍会先检查 `cargo`。
- 不要默认删除 `%USERPROFILE%\.zeroclaw`；官方文档说明那里包含配置、工作区、日志和会话历史。

### 1.5 关键风险

1. MSI 是机器级包且未签名，可能触发 UAC / SmartScreen；不能静默吞掉系统确认。
2. 官方 Windows 指南仍把 ZIP 作为 CLI 推荐路径，并写有“未来加入 signed MSI”的提示；这与 Release 已出现但仍未签名的 MSI 并不矛盾，却容易被目录维护者误读成“MSI 已是官方推荐 CLI 路径”。
3. MSI 不写 PATH。若前端只用 `zeroclaw --version` 检测，会把已经通过 MSI 安装的用户误判为未安装。
4. 当前只有 Windows x64 MSI，没有 Windows ARM64 MSI。

### 1.6 CLI-only ZIP 静态取证

本节针对官方 Windows 指南推荐的预编译 ZIP，而不是桌面 MSI。取证对象是 [ZeroClaw `v0.8.4` 固定资产](https://github.com/zeroclaw-labs/zeroclaw/releases/download/v0.8.4/zeroclaw-x86_64-pc-windows-msvc.zip)；ZIP 摘要同时与官方 [SHA256SUMS](https://github.com/zeroclaw-labs/zeroclaw/releases/download/v0.8.4/SHA256SUMS)核对。

| 字段 | 结果 |
| --- | --- |
| 资产名 | `zeroclaw-x86_64-pc-windows-msvc.zip` |
| 固定 URL | `https://github.com/zeroclaw-labs/zeroclaw/releases/download/v0.8.4/zeroclaw-x86_64-pc-windows-msvc.zip` |
| ZIP 字节数 | `25,694,208` bytes |
| ZIP SHA-256 | `de17681f981b4bd7e1fa2c493924e2a9df60825932ec0f99a3fb647f2a3242c3` |
| ZIP 条目数 | `70`：`67` 个文件、`3` 个目录项 |
| CLI 相对路径 | `zeroclaw.exe` |
| `zeroclaw.exe` 解压后字节数 | `49,172,480` bytes |
| `zeroclaw.exe` SHA-256 | `5d59b2e603daf1ff2430d5f94cce2a57a82487e6d64b60c0bdd9dcc03cdeb62a` |
| `zeroclaw.exe --version` | `zeroclaw 0.8.4` |
| `--version` 退出码 | `0` |

`zeroclaw.exe` 的摘要是从官方 ZIP 解压后本地计算的派生证据；官方 `SHA256SUMS` 只发布整个 ZIP 的摘要，没有单独发布该 EXE 的摘要。

压缩包不是单文件 CLI：根目录还有 `zerocode.exe`，并携带完整的 `web/dist` 前端资源。在厂商明确说明这些资源可选、或隔离运行验收通过前，AI Hub 不应自行只复制 `zeroclaw.exe` 并丢弃其余条目。本轮只执行了 `--version`，没有证明完整运行时是否依赖这些资源。完整条目如下，右侧为解压后字节数：

<details>
<summary>展开查看 70 个 ZIP 条目</summary>

```text
web/dist/ | <dir>
web/dist/assets/ | <dir>
web/dist/assets/AcpConsole-B7JYX0NQ.js | 17332
web/dist/assets/AgentChat-lVaeJzO1.js | 45967
web/dist/assets/AgentDrawer-DhysLKTn.js | 15722
web/dist/assets/agents-kNkQp9sC.js | 2233
web/dist/assets/AgentsList-BXfjpWAh.js | 3043
web/dist/assets/AgentWorkspaceExplorer-DyweijWJ.js | 10580
web/dist/assets/api-CS_DHR0v.js | 15551
web/dist/assets/api-D6MKffIt.js | 68
web/dist/assets/arrow-right-CBXFWSHF.js | 164
web/dist/assets/book-open-DDfuvgsi.js | 278
web/dist/assets/Canvas-e9nkgGW5.js | 8887
web/dist/assets/chevron-right-CDz3UsTe.js | 129
web/dist/assets/circle-alert-CGBIEMaG.js | 249
web/dist/assets/circle-check-big-Dk_PglSl.js | 192
web/dist/assets/circle-x-Cv9yBT8Q.js | 206
web/dist/assets/Config-2IvaJ_s_.js | 242880
web/dist/assets/configuredModels-CpXJq5LN.js | 825
web/dist/assets/createLucideIcon-C9N9DIRg.js | 606035
web/dist/assets/Cron-CJhRqz5U.js | 31697
web/dist/assets/Dashboard-CpP7uX_B.js | 61560
web/dist/assets/Doctor-BMGmrngW.js | 7233
web/dist/assets/DoctorFixModal-ugYhTevl.js | 2865
web/dist/assets/external-link-DKhYbqVM.js | 250
web/dist/assets/FieldForm-q57FoUg8.js | 66260
web/dist/assets/file-text-BVg2mfzl.js | 332
web/dist/assets/folder-open-BkyQ9RTd.js | 291
web/dist/assets/folder-plus-asT4q3lR.js | 413
web/dist/assets/format-Cg1-f0Bc.js | 507
web/dist/assets/index-ByICXSOq.css | 87061
web/dist/assets/index-D84ka4dk.js | 366203
web/dist/assets/Integrations-B5zAjaaP.js | 4910
web/dist/assets/lib-Ds1AtvLQ.js | 153362
web/dist/assets/Logs-nE6_CFmn.js | 13249
web/dist/assets/MarkdownEditor-DtVuoiCH.js | 614178
web/dist/assets/modelProviders-U1IikCzs.js | 360
web/dist/assets/Pairing-DZy6RXmn.js | 5192
web/dist/assets/pause-D1gSEYEW.js | 211
web/dist/assets/pencil-D68B9osg.js | 276
web/dist/assets/play-CSnrFzY_.js | 134
web/dist/assets/plug-BgtjCaRq.js | 258
web/dist/assets/plus-Bc8vUCWg.js | 153
web/dist/assets/power-BvfLq81c.js | 173
web/dist/assets/Quickstart-B_VlbW33.js | 22999
web/dist/assets/radio-h5jixTzD.js | 812
web/dist/assets/RunDetail-nnESAhHW.js | 3723
web/dist/assets/Runs-BXI_gIkU.js | 4502
web/dist/assets/shield-check-CO6E2GMN.js | 319
web/dist/assets/Skills-B9hu-J10.js | 7592
web/dist/assets/SopCanvas-DviulAoB.js | 34679
web/dist/assets/sops-ko00-UJW.js | 778148
web/dist/assets/Sops-uRUq3D04.js | 34460
web/dist/assets/square-M0-b2v6Y.js | 384
web/dist/assets/ToolPicker-BAqO8jFQ.js | 11188
web/dist/assets/Tools-CeNbvBvu.js | 12924
web/dist/assets/trash-2-CpsAAX9g.js | 357
web/dist/assets/useFocusTrap-akmMKgyv.js | 1108
web/dist/assets/users-BqD7bMDl.js | 304
web/dist/assets/wifi-B3RVBFSY.js | 470
web/dist/assets/zap-tTRQ-dWf.js | 262
web/dist/blog/ | <dir>
web/dist/blog/atom.xml | 535
web/dist/blog/rss.xml | 473
web/dist/index.html | 2234
web/dist/logo.png | 32089
web/dist/robots.txt | 73
web/dist/sitemap.xml | 238
zeroclaw.exe | 49172480
zerocode.exe | 35386368
```

</details>

该 ZIP 中 `zeroclaw.exe` 的大小与桌面 MSI 内 sidecar 的大小不同，因此两种发布物必须使用不同的收据和检测合同；不能拿 ZIP 的 EXE 摘要去校验 MSI 内的 sidecar。

## 2. IronClaw

### 2.1 Windows 支持与官方推荐路径

[官方仓库 README](https://github.com/nearai/ironclaw#installation)明确提供原生 Windows Installer：打开所选 `ironclaw-v*` Release，下载 `ironclaw-x86_64-pc-windows-msvc.msi` 并运行。它也提供固定 tag 的 PowerShell 安装脚本：

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/nearai/ironclaw/releases/download/ironclaw-v1.0.0/ironclaw-installer.ps1 | iex"
```

对 AI Hub 来说，直接下载固定 MSI 比执行远程脚本更符合固定驱动边界：客户端只需要允许官方仓库、固定资产名和固定版本元数据，不需要从后台接收命令字符串。

官方安装后的主流程是：

```powershell
ironclaw onboard
ironclaw status
ironclaw serve
```

`onboard` 会要求用户选择 LLM provider 并在隐藏提示中输入凭据；Windows 用户用 `ironclaw serve` 在前台启动 WebUI。这一段不能被宣称为完全无人值守。

### 2.2 当前 Release 与 x64 MSI

[官方最新 Release](https://github.com/nearai/ironclaw/releases/tag/ironclaw-v1.0.0)为 `1.0.0`，tag 是 `ironclaw-v1.0.0`，发布于 2026-07-27。官方 [Release 资产元数据](https://github.com/nearai/ironclaw/releases/expanded_assets/ironclaw-v1.0.0)和 [MSI 校验文件](https://github.com/nearai/ironclaw/releases/download/ironclaw-v1.0.0/ironclaw-x86_64-pc-windows-msvc.msi.sha256)给出以下值：

| 字段 | 值 |
| --- | --- |
| 文件名 | `ironclaw-x86_64-pc-windows-msvc.msi` |
| 固定下载 URL | [ironclaw-x86_64-pc-windows-msvc.msi](https://github.com/nearai/ironclaw/releases/download/ironclaw-v1.0.0/ironclaw-x86_64-pc-windows-msvc.msi) |
| 官方 SHA-256 | `a1b9af9ae890ae2c5b6875ddd4a8267129abc7a8803a6d315482f28e109a64dd` |
| 文件大小 | `50,425,856` bytes |
| MSI `ProductName` | `ironclaw`（小写） |
| MSI `ProductVersion` | `1.0.0` |
| MSI `Manufacturer` | `NEAR AI` |
| MSI `ProductCode` | `{EA0E6381-0636-4283-8842-704A4312588F}` |
| MSI `UpgradeCode` | `{650712A0-A6B4-4584-829A-03A90CE3D7D9}` |
| Authenticode | `NotSigned` |

本地重新计算的 SHA-256 与官方 `.msi.sha256` 完全一致。

### 2.3 MSI 实际行为

官方 MSI 的只读表结构显示：

- 安装目录是 `C:\Program Files\ironclaw\bin`，`ALLUSERS=1`。
- 包内主文件是 `ironclaw.exe`。
- MSI 的 `Environment` 表把上述 `bin` 目录写入机器 PATH，并在卸载时移除对应项。
- MSI 没有桌面快捷方式；它是 CLI 安装包，不是图形桌面客户端。

因此 AI Hub 的安装后探测可以使用新进程中的：

```powershell
ironclaw --version
ironclaw status --json
```

当前 shell 不一定立即拿到 MSI 刚写入的机器 PATH；AI Hub 应刷新环境或直接使用 `C:\Program Files\ironclaw\bin\ironclaw.exe` 做首次探测，不能因此误报安装失败。

### 2.4 AI Hub 建议与风险

- **准入**：原生 Windows x64 固定 MSI 驱动可以落地。下载固定资产，显示 Windows Installer，让用户完成 UAC / 许可确认；随后打开 `ironclaw onboard`。
- **不要默认走远程 PowerShell 管道**：它是官方支持路径，但对本地固定驱动而言，MSI 更容易记录版本、ProductCode、安装位置和下载收据。
- **凭据必须由用户输入**：`ironclaw onboard` 是交互式配置，不得由后台注入 API key。
- **未签名**：当前 MSI 的 Authenticode 为 `NotSigned`，即使 SHA-256 匹配也不能显示“发布者已验证”。
- **机器级安装**：`ALLUSERS=1` 且修改机器 PATH，通常需要提升权限；用户取消 UAC 后任务必须立即进入“已取消”，不能卡在“安装中”。
- **架构范围**：当前 Release 只有 Windows x64 MSI，没有 Windows ARM64 MSI。

## 最终给目录维护与驱动实现的固定值

| 驱动字段 | ZeroClaw | IronClaw |
| --- | --- | --- |
| `releaseTag` | `v0.8.4` | `ironclaw-v1.0.0` |
| `version` | `0.8.4` | `1.0.0` |
| `windowsMode` | `native-x64`；另支持 WSL2 | `native-x64`；另有 Windows/WSL shell 路径 |
| `msiAssetName` | `ZeroClaw-windows-x64.msi` | `ironclaw-x86_64-pc-windows-msvc.msi` |
| `msiProductName` | `ZeroClaw` | `ironclaw` |
| `msiSha256` | `ea14713ca8dae2ed231a1d5a1df079496e08ec2a7d054c44c46d17c3aa51b379` | `a1b9af9ae890ae2c5b6875ddd4a8267129abc7a8803a6d315482f28e109a64dd` |
| 首次配置命令 | `zeroclaw quickstart` | `ironclaw onboard` |
| 首次可靠探测 | MSI 路径：`C:\Program Files\ZeroClaw\zeroclaw.exe --version` | `C:\Program Files\ironclaw\bin\ironclaw.exe --version` |
| 主要阻塞 / 风险 | MSI 非纯 CLI、不写 PATH、未签名 | MSI 未签名、机器级 PATH、onboarding 交互 |

版本和摘要是 2026-08-04 的点时证据。后续目录更新应重新读取官方 `releases/latest` 与官方校验文件，但后台只能更新固定字段；不能下发替代命令、任意 URL 或任意 PowerShell。
