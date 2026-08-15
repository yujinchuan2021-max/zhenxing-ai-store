# Windows 桌面直连产物审计 B（2026-08-04）

## 范围与结论

本次仅核验五个项目的官方 GitHub 仓库与官方 Release：Stability Matrix、Intel AI Playground、goose Desktop、KoboldCpp、Invoke Community Edition。核验对象是 Windows 用户可直接下载的桌面产物，不执行任何安装包、可执行文件或应用代码，也不修改 AI Hub 的代码与目录数据。

截至 2026-08-04，五个项目均能从官方 Release 固定到明确版本和下载 URL，并用本机重新计算的 SHA-256 对上 GitHub Release 给出的资产 digest。它们并不共享同一种安装/卸载语义：

| 项目 | 当前官方版本 | Windows 交付形式 | Authenticode 结论 | 数据与卸载要点 |
| --- | --- | --- | --- | --- |
| Stability Matrix | `v2.16.2` | 便携 ZIP | 主程序签名有效，发布者 Lykos LLC | 应用位与 `Data`/自选库目录分离；删程序不等于删模型和生成数据 |
| Intel AI Playground | `v3.1.2-beta_hf3` | NSIS 安装器 | Intel Corporation 签名有效 | 卸载时由用户选择保留或删除 models；其余安装树内运行数据会随完整卸载移除 |
| goose Desktop | `v1.45.0` | 便携 ZIP（标准/CUDA） | 两个桌面主程序签名有效；ZIP 内 `uv.exe`/`uvx.exe` 未签名 | 配置、会话、日志和凭据在用户目录/凭据管理器中；删解压目录不会清掉它们 |
| KoboldCpp | `v1.118.1` | 单文件 EXE（三种变体） | 三个官方 EXE 均未签名 | 程序本身无安装器；模型、保存配置和故事文件由用户另存，删 EXE 不会删除它们 |
| Invoke Community Edition | Launcher `v1.8.1`；引擎稳定版 `v6.13.7` | NSIS Launcher 安装器 | Invoke AI, Inc. 签名有效 | Launcher 与用户选择的引擎/数据目录是两个生命周期；卸载 Launcher 不应被表述为删除引擎、模型或数据 |

## 核验方法与边界

- “最新版本”以审计当日各官方仓库的 `/releases/latest` 重定向为准；InvokeAI 另注明了引擎稳定版与预发布版的区别。
- 每个下载产物均从官方 GitHub Release URL 获取；记录精确字节数，并用 Windows `Get-FileHash -Algorithm SHA256` 重算。下文 SHA-256 均与相应 Release 资产的 GitHub digest 一致。
- ZIP 只进行静态目录枚举与指定 EXE 提取；签名只用 Windows `Get-AuthenticodeSignature` 静态检查。没有启动、安装或加载任何产物。
- “签名有效”只说明本机 Windows 在审计时验证了该文件的 Authenticode 签名链，不替代恶意代码分析，也不代表 ZIP 内每个二进制都已签名。
- 数据/卸载结论来自对应版本的官方文档或源码。此次不是安装体验、升级成功率、首次启动、GPU 兼容性或真实用户机器验收。

## 1. Stability Matrix

官方仓库：[LykosAI/StabilityMatrix](https://github.com/LykosAI/StabilityMatrix)；官方 Release：[v2.16.2](https://github.com/LykosAI/StabilityMatrix/releases/tag/v2.16.2)。

### Windows 产物

| 字段 | 核验值 |
| --- | --- |
| 文件名 | `StabilityMatrix-win-x64.zip` |
| 官方 URL | [下载](https://github.com/LykosAI/StabilityMatrix/releases/download/v2.16.2/StabilityMatrix-win-x64.zip) |
| 精确大小 | `141,104,015` bytes（Release UI 显示约 135 MB） |
| SHA-256 | `d76bd98c3fad844d05695cb1306083c1cf9424909570812866cad8bca220afca` |
| ZIP 主入口 | `StabilityMatrix.exe` |
| 主入口大小 | `377,484,424` bytes |
| 主入口 SHA-256 | `2e91950c2545877be357ff0064df876bd87b64d8af0fd4e0e14a29c596cbb3ac` |
| 主入口签名 | `Valid`；`CN=Lykos LLC, O=Lykos LLC, L=Dover, S=Delaware, C=US`；带 Microsoft 时间戳 |
| 交付类型 | 便携 ZIP，无传统安装器 |

### 数据、更新与移除边界

官方 [Data Directory 文档（v2.16.2）](https://github.com/LykosAI/StabilityMatrix/blob/v2.16.2/docs/getting-started/data-directory.md)说明，数据目录包含托管的软件包、模型、图片、资产、工作流、标签、下载缓存和 `settings.json`。便携模式是默认且推荐的形态，程序旁的 `Data` 目录与 `.sm-portable` 标记共同定义便携库；非便携 Windows 默认目录为 `%AppData%\StabilityMatrix`，选择的位置还会通过 `library.json` 记录。切换数据位置只是重新指向，不会代替用户搬移数据。

官方 [UpdateHelper 源码（v2.16.2）](https://github.com/LykosAI/StabilityMatrix/blob/v2.16.2/StabilityMatrix.Core/Updater/UpdateHelper.cs)显示更新先在相邻 `.StabilityMatrixUpdate` 目录暂存，再替换应用二进制。因此应用更新和库数据是两个边界。删除或替换 `StabilityMatrix.exe` 不会自动删除 `Data` 或用户选择的库目录；完整移除必须在确认备份需求后显式删除数据目录。

## 2. Intel AI Playground

官方仓库：[intel/AI-Playground](https://github.com/intel/AI-Playground)；官方 Release：[v3.1.2-beta_hf3](https://github.com/intel/AI-Playground/releases/tag/v3.1.2-beta_hf3)。

### Windows 产物

| 字段 | 核验值 |
| --- | --- |
| 文件名 | `AI-Playground-installer.exe` |
| 官方 URL | [下载](https://github.com/intel/AI-Playground/releases/download/v3.1.2-beta_hf3/AI-Playground-installer.exe) |
| 精确大小 | `213,581,992` bytes（Release UI 显示约 204 MB） |
| SHA-256 | `f22afd39bb19b83acb1d7973ea6d7c54c3f457e4bc26b8e58ca3227645cd1a50` |
| 文件版本 | Product `AI Playground`；ProductVersion `3.1.2-beta`；Company `Intel` |
| Authenticode | `Valid`；`CN=Intel Corporation, O=Intel Corporation, S=California, C=US`；带 Sectigo 时间戳 |
| 交付类型 | Electron Builder NSIS、x64、按用户辅助安装；不是便携包 |

该项目没有 ZIP 主入口；上表的安装器 EXE 就是用户入口。官方 [build-config.json（v3.1.2-beta_hf3）](https://github.com/intel/AI-Playground/blob/v3.1.2-beta_hf3/WebUI/build/build-config.json)固定了 `nsis`/`x64`、`oneClick: false`、`perMachine: false`、允许更改安装目录和提权，并设置 `deleteAppDataOnUninstall: true`。

### NSIS 发现与卸载指纹

官方 [package.json（v3.1.2-beta_hf3）](https://github.com/intel/AI-Playground/blob/v3.1.2-beta_hf3/WebUI/package.json)给出版本和作者，[package-lock.json](https://github.com/intel/AI-Playground/blob/v3.1.2-beta_hf3/WebUI/package-lock.json)把构建器解析为 `electron-builder@26.15.5`；构建脚本虽然会替换两个安装流程模板，但官方 [patch-nsis-template.mts](https://github.com/intel/AI-Playground/blob/v3.1.2-beta_hf3/WebUI/build/scripts/patch-nsis-template.mts)没有替换负责文件名和卸载注册表值的 `common.nsh`/`installer.nsh`。结合该版本 electron-builder 的 [common.nsh](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.5/packages/app-builder-lib/templates/nsis/common.nsh)、[NsisTarget.ts](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.5/packages/app-builder-lib/src/targets/nsis/NsisTarget.ts)和 [installer.nsh](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.5/packages/app-builder-lib/templates/nsis/include/installer.nsh)，可静态确定：

| 字段 | 值 |
| --- | --- |
| Programs and Features `DisplayName` | `AI Playground 3.1.2-beta` |
| `Publisher` | `Intel Corporation` |
| 安装后主 EXE | `AI Playground.exe` |
| 卸载器文件名 | `Uninstall AI Playground.exe` |
| `UninstallString` 参数 | `/currentuser` |
| `QuietUninstallString` 参数 | `/currentuser /S` |

依据是 electron-builder 默认把 DisplayName 展开为 `${productName} ${version}`、Publisher 取 `author.name`，主 EXE 定义为 `${PRODUCT_FILENAME}.exe`，卸载器定义为 `Uninstall ${PRODUCT_FILENAME}.exe`；Intel 配置还以 `perMachine: false` 和 `customInstallMode` 明确强制当前用户安装。接入时仍应优先采用已安装实例注册表里的完整 `QuietUninstallString`，而不是自行拼接路径。

### 数据与卸载边界

官方 [aipgRoot.ts（v3.1.2-beta_hf3）](https://github.com/intel/AI-Playground/blob/v3.1.2-beta_hf3/WebUI/electron/aipgRoot.ts)把 Windows 的 `process.resourcesPath` 作为可写工作树；其中包括 Python、后端虚拟环境、LlamaCPP/ComfyUI 安装、presets、settings、logs 和模型等运行数据。

官方 [installer.nsh（v3.1.2-beta_hf3）](https://github.com/intel/AI-Playground/blob/v3.1.2-beta_hf3/WebUI/build/installer.nsh)在卸载时明确询问是否保留 models：选择保留时，把 `$INSTDIR\resources\models` 移到相邻的 `$INSTDIR_model_backup`，后续重装会恢复；选择不保留时移除整个安装目录。静默卸载路径走保留 models 的逻辑。结合 `deleteAppDataOnUninstall: true`，AI Hub 不应承诺“卸载总会保留全部用户数据”：模型是否保留有明确分支，而安装树中的设置、日志、后端环境等不属于无条件保留项。

## 3. goose Desktop

官方仓库：[aaif-goose/goose](https://github.com/aaif-goose/goose)；官方 Release：[v1.45.0](https://github.com/aaif-goose/goose/releases/tag/v1.45.0)。官方 Release 同时提供 CLI ZIP；这里仅记录桌面 ZIP，避免把 CLI 同名产物误作桌面应用。

### Windows 桌面产物

| 变体 | 官方 URL | 精确大小 | SHA-256 | ZIP 主入口 |
| --- | --- | ---: | --- | --- |
| 标准 | [`Goose-win32-x64.zip`](https://github.com/aaif-goose/goose/releases/download/v1.45.0/Goose-win32-x64.zip) | `250,678,094` bytes | `ae10f77f0540985d090e3fc33191233e46c5477f96a48427380b2f2f86689d96` | `dist-windows/Goose.exe` |
| CUDA | [`Goose-win32-x64-cuda.zip`](https://github.com/aaif-goose/goose/releases/download/v1.45.0/Goose-win32-x64-cuda.zip) | `423,465,818` bytes | `ad61258e0dd50223f81cbb27cabf4ee2c55c341c65e1be7d18ac5ad20455ded4` | `dist-windows/Goose.exe` |

主入口静态核验：

| 变体 | 主入口大小 | 主入口 SHA-256 | Authenticode |
| --- | ---: | --- | --- |
| 标准 | `222,922,552` bytes | `67cc26a780822858e16eeb73ba577ed615d0d9fbd7129056ef09a9fb3a3f9615` | `Valid`；`CN="LF Open Source, LLC", O="LF Open Source, LLC", L=Laguna Beach, S=California, C=US`；Microsoft 时间戳 |
| CUDA | `222,922,560` bytes | `5562eba610ac01f005d175f758c55d75717a1e17e2cc2c59b3b06bc087c1823f` | 同一 LF Open Source, LLC 有效签名 |

标准 ZIP 还包含下列 EXE：

| ZIP 条目 | 大小 | SHA-256 | 签名 |
| --- | ---: | --- | --- |
| `dist-windows/resources/bin/goose.exe` | `257,352,504` bytes | `36ae56e66ef6a8fcf523f669387c1cf5772bb6fa8510896ba4acb5fc8c03d102` | `Valid`，LF Open Source, LLC |
| `dist-windows/resources/bin/uv.exe` | `67,778,048` bytes | `b1645e948603c12dd741987d0c072471195e18dd299b42334477ceac694f0af8` | `NotSigned` |
| `dist-windows/resources/bin/uvx.exe` | `337,920` bytes | `0305c488dc29c16df1483c02a902d21a6798b0744f8e9eb34271d6b3e4bf6e2a` | `NotSigned` |

因此，官方 Release digest 能绑定整个 ZIP，但不能据此写成“ZIP 内所有 EXE 均有 Authenticode 签名”。官方 [安装文档（v1.45.0）](https://github.com/aaif-goose/goose/blob/v1.45.0/documentation/docs/getting-started/installation.md)要求在 Windows 解压后运行可执行文件，属于便携 ZIP，没有传统卸载器。

### 数据与移除边界

官方 [配置文档（v1.45.0）](https://github.com/aaif-goose/goose/blob/v1.45.0/documentation/docs/guides/config-files.md)给出 Windows 配置文件 `%APPDATA%\Block\goose\config\config.yaml`。官方 [日志与会话文档（v1.45.0）](https://github.com/aaif-goose/goose/blob/v1.45.0/documentation/docs/guides/logs.md)给出命令历史 `%APPDATA%\Block\goose\data\history.txt`、会话数据库 `%APPDATA%\Block\goose\data\sessions\sessions.db` 和日志目录 `%APPDATA%\Block\goose\data\logs\`。

官方 [Known Issues 的完整重置说明（v1.45.0）](https://github.com/aaif-goose/goose/blob/v1.45.0/documentation/docs/troubleshooting/known-issues.md)还列出 `%APPDATA%\Block\goose\`、`%LOCALAPPDATA%\Block\goose\` 和 Windows Credential Manager 中的 secrets，完整重置需要分别清理。因此删除解压目录只移除应用位，不会清掉配置、会话、日志或凭据；升级替换 ZIP 也不应触碰这些外部数据。

## 4. KoboldCpp

官方仓库：[LostRuins/koboldcpp](https://github.com/LostRuins/koboldcpp)；官方 Release：[v1.118.1](https://github.com/LostRuins/koboldcpp/releases/tag/v1.118.1)。

### Windows 产物

| 变体 | 官方 URL | 精确大小 | SHA-256 | Authenticode |
| --- | --- | ---: | --- | --- |
| 默认 CUDA | [`koboldcpp.exe`](https://github.com/LostRuins/koboldcpp/releases/download/v1.118.1/koboldcpp.exe) | `632,413,210` bytes | `040b32b27cd1d4a72e0da702658118bebb55a0aa8ea7c2ab5c5513257bae3c5a` | `NotSigned` |
| 无 CUDA | [`koboldcpp-nocuda.exe`](https://github.com/LostRuins/koboldcpp/releases/download/v1.118.1/koboldcpp-nocuda.exe) | `116,244,310` bytes | `ef2f833df100099d2492e4eb398b48d3be5a0c327f6d99447e6cba77962e43ab` | `NotSigned` |
| 旧 CPU/NVIDIA | [`koboldcpp-oldpc.exe`](https://github.com/LostRuins/koboldcpp/releases/download/v1.118.1/koboldcpp-oldpc.exe) | `457,179,710` bytes | `7931af66ea46baa19c9f636dd2bb224d0db38ac5acafe404c608e138077654ad` | `NotSigned` |

三者都是资产 EXE 本身，没有 ZIP 主入口或安装器。Release 说明建议 NVIDIA 用户使用默认 CUDA 版，非 NVIDIA/无需 CUDA 使用 `nocuda`，老旧 CPU/NVIDIA 使用 CUDA 11 + AVX1 的 `oldpc`。三个文件均无 Authenticode 发布者身份，因此接入时只能依赖官方 Release 来源和固定 SHA-256 做来源/完整性约束，不能显示“已验证 Windows 发布者”。

### 数据与移除边界

官方 [README（v1.118.1）](https://github.com/LostRuins/koboldcpp/blob/v1.118.1/README.md)把 KoboldCpp 定义为无需安装或依赖的自包含单文件，并说明 GGUF 模型不随程序附带、需另行下载。GUI 可把配置保存为用户选择位置的 `.kcpps`，故事也以 JSON 导入/导出。

所以删除对应 EXE 即可移除应用位，但不会删除外部 GGUF 模型、用户保存的 `.kcpps` 或故事文件；项目没有可替用户清理这些文件的应用卸载器。

## 5. Invoke Community Edition

这里必须区分两个官方仓库：Windows 用户入口来自 [invoke-ai/launcher](https://github.com/invoke-ai/launcher)，而实际 InvokeAI 引擎来自 [invoke-ai/InvokeAI](https://github.com/invoke-ai/InvokeAI)。

- Launcher 当前官方稳定 Release：[v1.8.1](https://github.com/invoke-ai/launcher/releases/tag/v1.8.1)。
- InvokeAI 引擎 `/releases/latest` 当前稳定版：[v6.13.7](https://github.com/invoke-ai/InvokeAI/releases/tag/v6.13.7)。审计日还能看到 `v6.14.0-rc1` 预发布，但它不是默认稳定版。
- 引擎 Release 只提供源码归档，没有可直接交付给 Windows 用户的二进制；因此 AI Hub 的桌面入口应指向官方 Launcher，而不是把引擎源码包误标为 Windows 应用。

### Windows Launcher 产物

| 字段 | 核验值 |
| --- | --- |
| 文件名 | `Invoke-Community-Edition-Setup-1.8.1.exe` |
| 官方 URL | [下载](https://github.com/invoke-ai/launcher/releases/download/v1.8.1/Invoke-Community-Edition-Setup-1.8.1.exe) |
| 精确大小 | `104,961,536` bytes（Release UI 显示约 100 MB） |
| SHA-256 | `6cae054113bd54d3d99f43e621579b355258b049391a002f5b41ef569047f057` |
| 文件版本 | ProductVersion `1.8.1` |
| Authenticode | `Valid`；Invoke AI, Inc.（Atlanta, Georgia；Delaware private organization）；带 DigiCert 时间戳 |
| 交付类型 | NSIS 安装器，不是便携 ZIP |

同一 Release 的稳定别名 [`Invoke.Community.Edition.Setup.latest.exe`](https://github.com/invoke-ai/launcher/releases/download/v1.8.1/Invoke.Community.Edition.Setup.latest.exe)与版本文件的字节数及 SHA-256 完全相同。伴随更新元数据为：

| 文件 | 大小 | SHA-256 |
| --- | ---: | --- |
| `Invoke-Community-Edition-Setup-1.8.1.exe.blockmap` | `110,507` bytes（Release UI 显示约 108 KB） | `7e112b4bd39188b43bec38871558db03bba81ffc0fc6cf7c86e8e7ccb1a992ab` |
| `latest.yml` | `377` bytes | `eba38ab6d2b828cc2f75ce3883eddca05cbe97e77d64d3f813af9a5bbf8c99fe` |

官方 [electron-builder.config.ts（v1.8.1）](https://github.com/invoke-ai/launcher/blob/v1.8.1/electron-builder.config.ts)确认 Windows 目标是 NSIS 并配置代码签名；官方 [README（v1.8.1）](https://github.com/invoke-ai/launcher/blob/v1.8.1/README.md)说明 Launcher 可安装、更新、重装和运行引擎，且生产 Windows 构建有签名并支持自更新。Release 说明也明确从 1.7 起 Windows 文件是安装器，不再是便携程序。

### NSIS 发现与卸载指纹

官方 [package.json（v1.8.1）](https://github.com/invoke-ai/launcher/blob/v1.8.1/package.json)给出产品名、版本和作者，[package-lock.json](https://github.com/invoke-ai/launcher/blob/v1.8.1/package-lock.json)把构建器解析为 `electron-builder@26.0.12`。结合该版本 electron-builder 的 [common.nsh](https://github.com/electron-userland/electron-builder/blob/v26.0.12/packages/app-builder-lib/templates/nsis/common.nsh)、[NsisTarget.ts](https://github.com/electron-userland/electron-builder/blob/v26.0.12/packages/app-builder-lib/src/targets/nsis/NsisTarget.ts)和 [installer.nsh](https://github.com/electron-userland/electron-builder/blob/v26.0.12/packages/app-builder-lib/templates/nsis/include/installer.nsh)，可静态确定：

| 字段 | 值 |
| --- | --- |
| Programs and Features `DisplayName` | `Invoke Community Edition 1.8.1` |
| `Publisher` | `Invoke AI, Inc.` |
| 安装后主 EXE | `Invoke Community Edition.exe` |
| 卸载器文件名 | `Uninstall Invoke Community Edition.exe` |
| `UninstallString` 参数 | `/currentuser` |
| `QuietUninstallString` 参数 | `/currentuser /S` |

该项目没有覆盖 `perMachine`，electron-builder 只在 `perMachine === true` 时生成机器级默认，故本版本默认是当前用户安装。模板会把所选安装模式写回 `UninstallString`/`QuietUninstallString`；现有 NSIS 模块应优先读取注册表中的完整字符串。如果真实已安装实例记录的是 `/allusers`，应遵循该实例记录，而不是强制套用上表的默认值。

### Launcher、引擎与数据边界

安装流程允许用户选择引擎安装位置。官方 [InstallFlowStepLocation.tsx（v1.8.1）](https://github.com/invoke-ai/launcher/blob/v1.8.1/src/renderer/features/InstallFlow/InstallFlowStepLocation.tsx)明确告诉用户重装/更新会保留数据；官方 [util.ts（v1.8.1）](https://github.com/invoke-ai/launcher/blob/v1.8.1/src/main/util.ts)通过所选目录中的 `.venv`、Python 包和 `invokeai.yaml` 识别引擎安装，并从 `.venv\Scripts\invokeai-web.exe` 启动引擎。

因此存在两个独立生命周期：

1. Windows NSIS Launcher 本身；
2. 用户选择目录中的 InvokeAI 引擎、环境、配置、模型和其他数据。

卸载 Launcher 不应被 AI Hub 表述为删除第二类内容；完整移除需要先确认备份，再单独删除用户选择的引擎/数据目录。官方 Launcher 源码未显示“卸载 Launcher 时自动删除所选引擎目录”的路径。由于其构建配置没有把 Launcher 自身 AppData 的卸载行为写成同样明确的产品承诺，本报告不推断该部分一定保留或一定删除。

## 面向 AI Hub 的接入约束

本报告只给接入决策提供证据，不改目录。若后续录入，至少应满足：

- 每个版本使用版本化官方 Release URL，并保存官方来源、精确字节数和 SHA-256；“latest”别名只能用于发现，不能替代固定版本审计记录。
- Stability Matrix 与 goose Desktop 可描述为“下载官方 ZIP/解压后运行”；KoboldCpp 可描述为“下载官方单文件 EXE”。三者都不能假装存在传统卸载器。
- Intel AI Playground 与 Invoke Community Edition 应只打开/交付官方签名安装器，由用户完成安装；不要在客户端静默运行安装器。
- KoboldCpp 必须显式标明官方文件未签名；goose 必须把“桌面主程序已签名”与“ZIP 内全部二进制均已签名”区分开。
- 卸载文案必须逐产品描述数据保留边界，不能用统一的“卸载会保留数据”或“卸载会清理全部数据”。
- 任何未来版本变化都应重新获取官方 Release、重算 digest、复核签名和数据路径；本报告不是永久信任声明。

## 审计留痕与限制

本次只做静态下载、散列、ZIP 枚举、文件版本和签名检查。没有执行任何产物，也没有进行安装、首次启动、升级、卸载、网络访问、模型下载、GPU 或 UI 验收。报告落盘并复核后，本次审计下载的临时样本与浅克隆均已删除，不在仓库中保留第三方二进制。
