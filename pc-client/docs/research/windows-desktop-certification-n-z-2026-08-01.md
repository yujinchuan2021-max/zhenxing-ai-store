# Windows 桌面与本地模型产品认证复核（后半组）

复核日期：2026-08-01（Asia/Shanghai）
范围：CodeBuddy、WorkBuddy、QClaw、ima、LM Studio、GPT4All Desktop、AnythingLLM Desktop、Kiro IDE、Perplexity Comet、NVIDIA AI Workbench、OpenClaw Windows Hub、OpenCode Desktop、Ollama、Microsoft Copilot Windows 客户端。

## 1. 结论

当前目录中的下载入口大多仍可访问，但“入口能返回 EXE”不等于“已经完成全生命周期认证”。本轮发现四个应在继续扩大托管范围前修正的高风险差异：

1. **GPT4All 不是 Inno Setup。** 官方源码明确使用 Qt Installer Framework（CPack IFW），卸载入口是 `maintenancetool.exe`；当前 `innoAdapter` 只接受 `unins*.exe`，会拒绝官方卸载器。
2. **OpenClaw 当前静默卸载策略会自动尝试删除专属 WSL Gateway。** 官方交互式卸载本来允许用户选择保留或删除；AI Hub 当前固定传入 `/VERYSILENT`，会把这个数据保留选择变成默认删除。
3. **NVIDIA AI Workbench 把两个安装层级混成一个。** Desktop App 可先以 remote-only 模式安装且没有 WSL、Docker、Git 前置依赖；只有用户选择 Full Local Install 后，才需要 WSL、Git 和 Docker Desktop/Podman，而且厂商安装器会检查并安装或升级这些组件。当前 `requirements: ["wsl", "docker", "git"]` 会在桌面壳安装前错误阻塞或提前改动环境。
4. **WorkBuddy 白名单已落后。** 2026-08-01 官方更新接口返回 `5.3.8.34705286`，当前客户端仍固定 `5.3.5.34189228`；新版接口没有给出 SHA-256，所以不能只在后台改 URL，必须重新做完整包、签名和卸载身份认证后随客户端白名单发布。

另有一个系统性缺口：LM Studio、GPT4All、AnythingLLM、OpenClaw、OpenCode 都有官方 ARM64 Windows 发行面或明确 ARM 支持，但当前模块只保存 x64 下载，且现有 `requirements` 不能表达 CPU 架构、Windows build、AVX2、RAM、磁盘与“可选组件”关系。

## 2. 方法与证据边界

- 外部事实只采用厂商官网、厂商文档、厂商更新 API、Microsoft Store 和厂商官方代码仓库/Release。
- 本次只做网页、API、源码和现有白名单的只读复核，没有运行安装器，没有执行安装、更新或卸载。
- `expectedSigner` 中多数 Subject 是既有实包审计快照，不是厂商公开的永久兼容合同。本文把没有公开稳定证书 Subject 的产品标为 **unknown**；这不等于当前文件未签名。
- 滚动入口的最终版本和哈希会变化。一次 range 请求或 `MZ` 文件头只能证明入口当前返回 Windows 可执行文件，不能证明安装、打开、更新、卸载和数据保留均正确。
- 对照文件：`shared/windows-desktop-catalog.cjs`、`shared/install-registry.cjs`、`admin/data/catalog-v1.json`。`install-registry.cjs` 对这组 `desktop-reviewed` 产品是从前者机械派生，因此不会修正前者中的错误。

## 3. 总表

| 产品 | 2026-08-01 官方 Windows 来源 | 版本策略 / 架构 | 安装器与依赖 | 更新 / 卸载 / 数据 | 当前判断 |
|---|---|---|---|---|---|
| CodeBuddy | 官方更新 API 返回 `4.10.4.33993995` | 版本化 x64 user 包；官网要求按处理器选择 | 当前用户安装，可选目录；公开文档未声明格式和稳定 signer | 内置检查更新；卸载和数据保留契约 unknown | 包 URL/hash 当前，但 AI Hub 文件名写成 `1.106.1` |
| WorkBuddy | 官方更新 API 返回 `5.3.8.34705286` | Windows x64 user 包；官网称 Win10+ | 安装向导可选目录；公开文档未声明格式和稳定 signer | 内置自动下载升级；工作区在用户目录；卸载保留规则 unknown | **白名单仍是 5.3.5** |
| QClaw | 官方网页调用腾讯更新 API，当前 `0.2.35-5001-624` | 官方 API 只标 `system_type=win`，架构 unknown | 普通、silent、zip 三种官方产物；公开 API 仅给 MD5 | 更新/卸载/数据保留契约 unknown | URL 当前；`x64` 文件名与 NSIS 假设不是公开合同 |
| ima | 官网 Rainbow 配置当前 `2.6.3 build 4813` x64 | 滚动配置解析到版本化 x64 EXE | 腾讯自研外层安装器 + 子安装器；可改目录 | 注册表/官方卸载器可检测；卸载后的用户数据规则 unknown | 当前 URL/hash 正确；不应把它概括为普通 NSIS |
| LM Studio | 官方下载页当前 `0.4.20`；白名单为 `0.4.20-1` x64 | Windows x64 与 ARM；x64 必须 AVX2 | 16 GB RAM、4 GB VRAM 为官方建议；公开格式/signer contract unknown | Windows 内置 updater；模型目录可改；卸载保留规则 unknown | x64 包当前；缺 ARM 与硬件门禁表达 |
| GPT4All Desktop | 官方 Release 最新 `v3.10.0` | x64 与 Windows ARM64 两个 EXE | **Qt Installer Framework**；默认安装到用户目录 | App 内有更新提示；官方维护工具负责更新/卸载；默认模型目录已公开 | URL/hash 当前；**卸载适配器错误** |
| AnythingLLM Desktop | x64/ARM64 两个官方 rolling EXE | rolling，无公开固定版本/hash | 当前用户安装；安装时可拉取内置 Ollama GPU/NPU 组件 | Windows 更新靠重新运行最新版 EXE；数据明确保留，完整删除需手工清理 | x64 入口正确；缺 ARM、托盘退出和保留数据模型 |
| Kiro IDE | 官方 changelog 当前 `1.0.242` | Windows 10/11 x64 only，明确不支持 ARM | user-scope；不能以管理员方式运行，否则更新被禁用 | 自动更新曾暂停/分批恢复；Windows 设置卸载；设置/扩展/登录态保留 | 当前 x64 URL/hash 正确；系统要求未进入模块 |
| Perplexity Comet | 官方 rolling REST 入口，当前跳到 `150.0.7871.230` | `platform=win_x64` | Win10+、4 GB RAM、500 MB、持续联网；公开格式/signer contract unknown | 重启自动更新或设置中手动检查；本地浏览数据与账号数据分离 | 入口/最终 host 当前；系统要求和数据语义未进入模块 |
| NVIDIA AI Workbench | 官方 rolling URL 当前跳到 `0.169.2-17` | Windows 10 22H2 指定 build 或 Win11 23H2+ | Desktop remote-only 无依赖；Full Local 才需要 16 GB RAM、WSL、容器、Git | 厂商 updater；卸载分 App、WSL distro、程序文件、项目四层 | **当前依赖模型错误，且磁盘预算偏低** |
| OpenClaw Windows Hub | 独立 Windows repo 最新 `v0.6.12`，x64/ARM64 | Hub 版本与 CLI/Gateway 版本独立 | Inno per-user；Hub 可创建专属 `OpenClawGateway` WSL | 厂商更新；卸载必须让用户选择保留/删除 Gateway | 包/hash 当前；**静默卸载破坏用户选择** |
| OpenCode Desktop | 官方 Release 最新 `v1.18.10`，x64/ARM64 | 原生 Electron Desktop；WSL 是可选 server 路径 | electron-builder NSIS one-click per-user | 内置 updater；桌面 userData 与 WSL 数据分开；卸载保留规则 unknown | x64 包/hash 当前；描述把 CLI/WSL 规则误写给桌面端 |
| Ollama | 官方 rolling `OllamaSetup.exe` | x86 bootstrap，安装 Windows x64/ARM 能力由官方包决定 | Inno per-user；固定 AppId | 自动下载、重启更新；卸载器让用户决定默认模型，外置模型保留 | 当前生命周期模块基本正确 |
| Microsoft Copilot | Microsoft Store Product ID `9NHT9RB2F4HD` | MSIX/Appx，由 Store 分发 | 包名 `MICROSOFT.COPILOT`；发布者 `MICROSOFT CORPORATION` | Store 更新；Windows 设置或 Appx 卸载；账号历史不等于本地包数据 | 当前仅打开官网很安全，但尚未做到检测、打开和卸载管理 |

## 4. 逐产品复核

### 4.1 CodeBuddy

官方安装文档确认 Windows/macOS、当前用户安装、可选安装目录、安装后从 CodeBuddy 打开，以及“账户 → 检查更新 → Install Now”的更新流程：[安装和登录](https://www.codebuddy.ai/docs/ide/Getting-Started/Installation)。官方更新接口在本次复核返回：

- version/productVersion：`4.10.4.33993995`
- URL：`https://codebuddy-1328495429.cos.accelerate.myqcloud.com/aiide/win32-x64-user/CodeBuddy-win32-x64-user-4.10.4.33993995-1ba59196.exe`
- SHA-256：`fdb7342d8bb93c35b659cf67fd00ddeb8b7aa9747fbd0ad9e60bc4ae2791fd04`

来源：[CodeBuddy 官方更新 API](https://www.codebuddy.ai/v2/update?platform=ide-win32-x64-user&version=1.0.0&x-machine-id=default)。

`windows-desktop-catalog.cjs` 中 URL 与 SHA-256 当前一致，但 `fileName` 是 `CodeBuddy-1.106.1-Windows-x64.exe`，与真实产品版本不一致。该错误不会改变文件内容，却会污染下载记录、安装包管理页和故障反馈。官方还说明升级会覆盖安装目录，放在安装目录内的用户项目可能被删除；AI Hub 不应把任何 receipt、缓存或用户数据写入产品安装目录：[CodeBuddy FAQ](https://www.codebuddy.ai/docs/ide/Support/Troubleshooting)。

公开一手资料没有声明稳定 Authenticode Subject、卸载器文件名/参数或卸载后的数据保留行为，均记为 unknown。当前 `Tencent Technology (Shenzhen) Company Limited` 只能作为已审核产物快照，未来证书变化应 fail closed 并重新认证。

### 4.2 WorkBuddy

官方 Windows 指南要求 Windows 10+，安装向导允许选择目录和快捷方式，左下角头像可检查更新；发现新版后产品会自动下载并升级：[Windows 安装指南](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Installation-Win-Guide)。官网当前前端只为 Windows 请求 `workbuddy-win32-x64-user`，本次官方更新 API 返回：

- `5.3.8.34705286`
- `https://download.codebuddy.cn/workbuddy/saas/win32-x64-user/WorkBuddy-win32-x64-user-5.3.8.34705286-e9991e2b.exe`
- `sha256hash` 为空

来源：[WorkBuddy 官方更新 API](https://copilot.tencent.com/v2/update?platform=workbuddy-win32-x64-user)。

当前白名单仍使用 `5.3.5.34189228` 和该旧包的固定 SHA-256。官方变更日志页面公开到 5.3.5，而机器接口已经前进到 5.3.8；机器接口应作为下载发现真源，但因为它不提供 SHA-256，新包仍需完整下载后验证签名、产品身份、安装/卸载记录，再固化到新的客户端白名单。[WorkBuddy 更新日志](https://www.codebuddy.cn/docs/workbuddy/Changelog)。

官方 FAQ 给出用户工作区常见路径 `C:\Users\<用户名>\workbuddy`，说明它不是可随应用卸载任意删除的安装目录：[WorkBuddy FAQ](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/FQA)。公开文档未声明安装器格式、稳定 signer、静默卸载参数或卸载数据规则；当前 `nsisAdapter` 必须靠实包复验，不能只根据向导外观认定。

### 4.3 QClaw

QClaw 官网是官方 Windows/macOS 入口：[QClaw](https://qclaw.qq.com/)。官网前端向腾讯接口 `https://jprx.m.qq.com/data/4066/forward` POST `{"from":"web","system_type":"win"}`；本次响应给出 `0.2.35-5001-624` 的普通 EXE、silent EXE 和 ZIP，并为各产物给出 MD5 和长度。普通 EXE URL 与当前白名单一致。

但该一手接口只写 `system_type=win`，没有公开 `x64` 架构、NSIS 格式、稳定 Authenticode Subject、卸载器或数据保留契约。因此：

- `QClaw-0.2.35-Windows-x64.exe` 中的 `x64` 是 AI Hub 自己的断言，不是官方接口字段；
- `nsisAdapter` 和腾讯 signer 可以保留为当前实包认证结果，但不能表述为永久厂商合同；
- 官方提供 silent 包不代表 AI Hub 应切换到无交互安装；它涉及本地 Agent 权限，仍应使用普通安装流程。

### 4.4 ima

ima 官网先从腾讯 Rainbow `ima-download-config` 读取当前下载，再在远程配置失败时回退到网页 bundle 的旧链接：[ima 官网](https://ima.qq.com/)、[腾讯 Rainbow 配置入口](https://oi.rb.qq.com/config.v2.ConfigService/PullConfigReq)。2026-08-01 的正式配置是 `2.6.3 build 4813` x64，当前 URL/hash 与白名单一致。

已审核官方包表明它是腾讯自研外层安装器，再调用子安装器，不应仅因为最终存在一个卸载 EXE 就把整体生命周期描述为标准 NSIS。稳定检测身份是：

- `SOFTWARE\Tencent\ima.copilot`
- `...\Uninstall\Ima.copilot`
- 主程序 `ima.copilot.exe`
- 卸载器 `ImaUninstall.exe`，参数 `--uninstall --verbose-logging`

当前适配器已经兼容这些身份和真实发布者变体，这是正确方向。安装路径可由用户选择，所以不能只查固定目录。厂商没有公开“卸载会保留/删除哪些知识库、缓存或用户文件”的明确契约；数据保留仍应显示 unknown，不得在卸载后追加目录递归删除。

### 4.5 LM Studio

官方下载页当前显示 Windows `0.4.20`，[下载页](https://lmstudio.ai/download)；当前 x64 白名单 URL `0.4.20-1` 可用。官方系统要求明确：Windows 同时支持 x64 和 ARM（Snapdragon X Elite），x64 必须支持 AVX2，建议 16 GB RAM 和 4 GB 独立显存：[系统要求](https://www.lmstudio.ai/docs/app/system-requirements)。

Windows/macOS 有内置应用更新器，启动时联网检查并提示更新；AI Hub 不应再作为第二更新器覆盖产品目录：[离线运行与更新](https://www.lmstudio.ai/docs/app/offline)。模型目录可由用户调整，presets 位于 `%USERPROFILE%\.lmstudio\config-presets`：[模型下载](https://lmstudio.ai/docs/app/basics/download-model)、[Preset 存储](https://lmstudio.ai/docs/app/presets)。

差异：当前模块只有 x64 包，`requirements: []` 无法阻止不支持 AVX2 的 x64 机器；也没有表达内存/显存建议。公开资料没有给出 Windows 安装器格式、稳定 signer、卸载器参数或卸载是否保留模型，相关字段为 unknown。

### 4.6 GPT4All Desktop

官方 GitHub Release 最新稳定版是 `v3.10.0`，并同时提供：

- `gpt4all-installer-win64-v3.10.0.exe`
- `gpt4all-installer-win64-arm-v3.10.0.exe`

来源：[GPT4All 官方 Release](https://github.com/nomic-ai/gpt4all/releases/tag/v3.10.0)。x64 URL 和 SHA-256 与当前白名单一致。

关键差异来自官方构建源码：`CPACK_GENERATOR` 是 `IFW`，Windows 目标目录默认 `@HomeDir@\gpt4all`，并生成 Qt Installer Framework 的 maintenance tool；不是 Inno Setup。[CPack IFW 配置](https://github.com/nomic-ai/gpt4all/blob/main/gpt4all-chat/cmake/cpack_config.cmake)、[maintenance tool 组件](https://github.com/nomic-ai/gpt4all/blob/main/gpt4all-chat/cmake/installer_maintenancetool_component.qs)。当前 `innoAdapter` 只接受 `unins*.exe`，因此无法安全接受官方 `maintenancetool.exe --start-uninstaller` 一类身份。这不是文案问题，而是卸载模块类型错误。

官方应用源码有“New version is available / Update”流程，更新应交给 GPT4All/maintenance tool：[更新对话框源码](https://github.com/nomic-ai/gpt4all/blob/main/gpt4all-chat/qml/NewVersionDialog.qml)。默认模型目录为 `C:\Users\{username}\AppData\Local\nomic.ai\GPT4All`，且可由用户修改：[设置文档](https://docs.gpt4all.io/gpt4all_desktop/settings.html)。官方没有承诺卸载是否删除默认或自定义模型，必须记 unknown，AI Hub 不得代删。

### 4.7 AnythingLLM Desktop

官方 Windows 文档提供两个 rolling 包：

- x64：`https://cdn.anythingllm.com/latest/AnythingLLMDesktop.exe`
- ARM64：`https://cdn.anythingllm.com/latest/AnythingLLMDesktop-Arm64.exe`

厂商目标是 Windows 10+ Home/Professional，偏向 Windows 11，并明确只支持当前用户安装。安装器会按硬件为内置 Ollama 拉取 GPU/NPU 依赖；这属于厂商自己的安装阶段，不应由 AI Hub 预装一个外部 Ollama 环境：[Windows 安装](https://docs.anythingllm.com/installation-desktop/windows)。

Windows 更新方式是退出产品后下载最新版 EXE 并重新安装，数据和进度保留：[更新](https://docs.anythingllm.com/installation-desktop/update)。自 1.11 起关闭窗口会最小化到托盘，覆盖安装前必须真正选择 Quit；否则安装器会报告无法关闭。当前通用 `closeProcessStrategy=graceful` 需要真实验收，不能只等待窗口关闭。

Windows 数据根目录为 `%APPDATA%\anythingllm-desktop\storage`，包含数据库、文档、向量、模型、插件、上传和日志；卸载应用不会自动清除此目录，完整删除需要用户另行手工决定：[数据位置](https://docs.anythingllm.com/installation-desktop/storage)、[卸载](https://docs.anythingllm.com/installation-desktop/uninstall)。当前目录只有 x64 且未向用户表达数据保留，这是缺口。

### 4.8 Kiro IDE

官方 changelog 当前稳定补丁是 `1.0.242`，当前版本化 x64 URL/hash 正确：[IDE changelog](https://kiro.dev/changelog/ide/)。Kiro 明确只支持 Windows 10/11 64-bit，ARM 当前不支持；Windows 从“设置 → 应用 → 已安装的应用”卸载。降级/重装会保留设置、扩展和登录态：[安装文档](https://kiro.dev/docs/getting-started/installation/)。

Kiro 是 user-scope 安装；以管理员方式运行会禁用更新。产品提供 `Kiro: Check for Updates`，但 1.0 系列的自动更新曾暂停并分批恢复，所以“下载当前版本”仍应保留为厂商支持的恢复入口，而不是假设自动更新永远及时：[Windows 更新故障说明](https://kiro.dev/docs/troubleshooting/)、[1.0 changelog](https://kiro.dev/changelog/ide/1-0/)。

当前模块的版本与 x64 选择正确，但 `requirements: []` 没有表达 Windows 10/11、64-bit 和“不得管理员运行”；catalog 描述仍写“图形产品打开厂商官方下载”，与实际 `client-managed-installer` 行为矛盾。稳定 Authenticode Subject 未由官方文档公开，当前 Amazon Subject 是实包认证快照。

### 4.9 Perplexity Comet

官方入口 `https://www.perplexity.ai/rest/browser/download?platform=win_x64&channel=stable` 是滚动解析器。本次跳转到官方 R2 bucket 的 `150.0.7871.230/comet_latest_intel_system.exe`；当前 exact-host allowlist 能接受它。该 bucket 把 EXE 错报成 `text/html`，现有实现用 exact host + `MZ` 头兜底是合理的，但 MIME 异常不能降低完整签名验证要求。

官方要求 Windows 10+、至少 4 GB RAM（建议 8 GB）、500 MB 磁盘和持续联网。产品重启时自动更新，也可在 Settings → About 手工检查：[安装 Comet](https://www.perplexity.ai/help-center/comet/en/articles/11583748-installing-comet)、[Getting Started](https://www.perplexity.ai/help-center/en/articles/11172798-getting-started-with-comet)。

Comet 本地浏览数据可在产品设置中单独删除，且不会因此删除 Perplexity 账号或同步设置：[本地数据删除](https://www.perplexity.ai/help-center/comet/en/articles/12871737-self-serve-data-deletion)。官方没有说明卸载是否自动删除本地 profile，因此卸载数据行为仍为 unknown。当前 catalog 文案“打开官方下载入口”同样与 managed installer 不一致。

### 4.10 NVIDIA AI Workbench

官方 Windows rolling URL 当前重定向到 `0.169.2-17/NVIDIA-AI-Workbench-Setup.exe`，当前 host 白名单正确。产品必须拆成两个层次：

1. **Desktop App / remote-only**：Electron UI，初装时没有 WSL、Git、Docker/Podman 依赖；500 MB 应用空间、8 GB RAM、无 GPU/容器要求。
2. **Full Local Install**：用户明确选择在本机开发后才配置 WSL distro、Git/Git LFS、Docker Desktop 或 Podman；Windows 至少 16 GB RAM，建议 32 GB，基础总空间约 3.5–5 GB，实际容器项目可能达到几十 GB。

来源：[Desktop App 安装](https://docs.nvidia.com/ai-workbench/user-guide/latest/install/desktop-app-install.html)、[支持矩阵](https://docs.nvidia.com/ai-workbench/user-guide/latest/reference/support-matrix.html)、[Full Local Install](https://docs.nvidia.com/ai-workbench/user-guide/latest/install/full-local-install.html)。支持的 Windows 基线是 Windows 11 build 22631+ 或 Windows 10 22H2 build 19045.4052+。

当前 `requirements: ["wsl", "docker", "git"]` 和 `installDiskBytes=12 GB` 都不能正确表达这套关系：前者把可选 full-local 当作桌面安装前置；后者对最大数十 GB 的容器项目只能算下载/应用安全余量，不能宣传为完整本地环境预算。

产品启动时检查更新并提示 Update Now；更新 Desktop 也会更新 full-local 组件：[更新](https://docs.nvidia.com/ai-workbench/user-guide/latest/install/update.html)。卸载必须分开处理 Desktop、可选程序文件、`NVIDIA-Workbench` WSL distro 和项目 repositories；注销 WSL 前还应允许导出备份：[卸载](https://docs.nvidia.com/ai-workbench/user-guide/latest/install/uninstall.html)。因此它需要组合组件模块，不能用通用 NSIS 卸载成功就把所有状态置为“已卸载”。

### 4.11 OpenClaw Windows Hub

Windows Hub 是独立 Windows Companion，不等于 OpenClaw CLI/Gateway。独立官方仓库最新 Release 是 `v0.6.12`，同时发布 x64/ARM64 EXE 和 SHA-256；当前主 OpenClaw `v2026.7.1` Release 也镜像了相同 x64/ARM64 文件与相同 digest，所以当前白名单 URL/hash 有效，但长期版本发现应跟踪 Windows repo，而不是用 CLI release 版本推断 Hub 版本：[Windows Hub Releases](https://github.com/openclaw/openclaw-windows-node/releases/tag/v0.6.12)、[Windows Hub README](https://github.com/openclaw/openclaw-windows-node/blob/main/README.md)。

官方 Inno 配置定义 per-user `%LOCALAPPDATA%\OpenClawTray`、AppName `OpenClaw Companion`、x64/ARM64 分包和专属 `OpenClawGateway` distro。交互式卸载会询问是否删除 Gateway；静默卸载则直接把 `LocalGatewayCleanupRequested` 设为 true：[官方 installer.iss](https://github.com/openclaw/openclaw-windows-node/blob/main/installer.iss#L178-L205)。

当前适配器固定：

```text
uninstallMode: automatic
launchArguments: /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
```

这会绕过“保留 Gateway 与本地状态”的用户选择，并在清理成功时删除专属 distro/生成状态。应改成组合卸载语义：先让用户选择“仅卸载 Hub”或“同时删除 Gateway”，再调用相应的官方路径；不能把产品自己的静默默认当作安全默认。

### 4.12 OpenCode Desktop

官方 `v1.18.10` Release 同时发布 `opencode-desktop-win-x64.exe` 与 `opencode-desktop-win-arm64.exe`，并由 GitHub API 给出 SHA-256；当前 x64 URL/hash 正确：[官方 Release](https://github.com/anomalyco/opencode/releases/tag/v1.18.10)。

官方 Desktop 源码明确是 electron-builder：Windows target `nsis`、one-click、per-machine false；内部使用 electron-updater 检查、下载并在用户确认后重启安装：[electron-builder 配置](https://github.com/anomalyco/opencode/blob/dev/packages/desktop/electron-builder.config.ts)、[updater 源码](https://github.com/anomalyco/opencode/blob/dev/packages/desktop/src/main/updater.ts)。因此当前 `nsisAdapter` 类型正确。

Windows 文档推荐 WSL，针对的是 OpenCode CLI/server 的最佳体验；同一页明确 Desktop 可连接 WSL server，而 Desktop 本身仍是原生 Windows 应用：[Windows/WSL 文档](https://opencode.ai/docs/windows-wsl/)。当前 catalog 描述“Windows 官方建议 WSL，但也列出 npm、Scoop、Chocolatey”混合了 CLI 和 Desktop 两个 surface，应改成桌面端自己的描述。Desktop 的 Windows userData 在 `%APPDATA%\ai.opencode.desktop`，而 WSL session/config 在 WSL 的 `~/.local/share/opencode`，卸载不能把两者合并清理。官方没有声明 NSIS 卸载后是否保留这些数据，记为 unknown。

官方构建使用 Azure Trusted Signing，但仓库没有公开稳定证书 Subject；当前 Anomaly signer 是已审核产物快照，而非长期接口：[Windows 签名脚本](https://github.com/anomalyco/opencode/blob/dev/script/sign-windows.ps1)。

### 4.13 Ollama

官方 rolling Windows 入口是 `https://ollama.com/download/OllamaSetup.exe`；Inno 源码公开 AppId `{44E83376-CE68-45EB-8FC1-393500EB558C}`、per-user `%LOCALAPPDATA%\Programs\Ollama` 和主程序 `ollama app.exe`：[Windows 文档](https://github.com/ollama/ollama/blob/main/docs/windows.mdx)、[Inno 配置](https://github.com/ollama/ollama/blob/main/app/ollama.iss)。当前 `local-model.ollama` / `inno.ollama` 适配器与这些身份一致。

Ollama 自动下载更新，用户从托盘选择 Restart to update；AI Hub 应展示厂商更新状态，不替换产品目录：[FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx)。卸载器对默认模型目录提供用户选择，自定义 `OLLAMA_MODELS` 不由安装器删除。当前生命周期模块已经把卸载设为交互式并记录 `userChoiceRequired=true`，这是本组可复用的正确范例。

剩余边界：滚动 URL 每次会换 hash，`Ollama Inc.` Subject 是当前官方产物认证结果，不是源码公开的永久证书 contract；应继续在每次下载后检查有效签名和产品 VersionInfo。

### 4.14 Microsoft Copilot Windows 客户端

Microsoft 官方支持页明确：Windows 11 新机通常预装 Copilot，未安装时从 Microsoft Store 获取；Windows 10/11 都通过“设置 → 应用”卸载：[Getting started with Microsoft Copilot](https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-microsoft-copilot)。官方 Store 身份是 Product ID [`9NHT9RB2F4HD`](https://apps.microsoft.com/detail/9NHT9RB2F4HD)。

Microsoft Learn 进一步给出稳定检测/卸载线索：

- 包名：`MICROSOFT.COPILOT`
- 发布者：`CN=MICROSOFT CORPORATION, O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US`
- 检测：`Get-AppxPackage -Name Microsoft.Copilot`
- 卸载：标准 `Remove-AppxPackage` 或 Windows Installed Apps

来源：[Windows Copilot 管理](https://learn.microsoft.com/en-us/windows/client-management/manage-windows-copilot)。

当前 catalog 只提供官网/教程，`productType=desktop-official`，没有 install profile，也没有 install/open/uninstall capability。这是安全的降级策略，但不满足“检测并管理全电脑 AI 产品”的既定目标。后续可做专门的 Store/Appx 模块：安装只打开 Microsoft Store Product ID，检测/打开/卸载使用固定 Appx 身份；不需要也不应抓取 Store 私有包 URL。个人 Microsoft 账号中的聊天历史不属于本地 Appx 卸载范围。

## 5. 三份配置的差异与传播问题

### 5.1 `shared/windows-desktop-catalog.cjs`

它是本组 reviewed EXE 的真正执行白名单，决定 URL、allowed hosts、hash、signer、进程名和卸载器。当前主要问题：

- CodeBuddy 的文件名版本错；
- WorkBuddy 固定旧版；
- GPT4All 误用 Inno adapter；
- NVIDIA 把 full-local 依赖挂到 Desktop App；
- OpenClaw 强制 silent 清理 Gateway；
- 多个有 ARM64 发行面的产品只有 x64；
- 大多数产品缺少正式 lifecycle/data-retention 描述，仅靠通用 adapter 猜测。

### 5.2 `shared/install-registry.cjs`

本组 `desktop-reviewed` 项从 `WINDOWS_DESKTOP_PRODUCTS` 自动展开，profileId/adapterId 当前没有额外错位；但这也意味着它会原样传播前述错误。Ollama 是独立特例，生命周期信息较完整。Microsoft Copilot 不在 install registry，所以客户端不能检测/管理它。

### 5.3 `admin/data/catalog-v1.json`

后台目录与本地执行白名单是两个不同信任域：后台可以调整展示，但不能批准新 EXE、signer 或命令。因此后台把 WorkBuddy URL 改成 5.3.8，并不会让现有客户端安全接受新版；需要同步发布新的客户端白名单。这不是缓存 bug，而是安全边界，应在后台显示“当前客户端最小版本 / 认证 profile 版本”，避免运营人员误以为改 JSON 就已更新安装行为。

当前文案还有明显遗留：

- CodeBuddy Desktop 描述仍在谈 CLI 升级等级；
- Kiro、Comet、NVIDIA 写“打开官方下载入口”，实际策略却是 `client-managed-installer`；
- OpenCode Desktop 描述的是 CLI 的 WSL/npm/Scoop/Chocolatey；
- NVIDIA 把“不在浏览时探测”与“点击安装时必须先装全部依赖”混在一个产品记录中。

这些文案应由后台修正，但 installer 类型、架构路由、依赖图、卸载选择和本机证据必须留在客户端本地模块。

## 6. 建议的修复顺序（本次未修改代码）

1. **阻断破坏性路径**：OpenClaw 取消固定 silent uninstall；先实现 Hub/Gateway 两级选择和分别复检。
2. **修正错误适配器**：为 GPT4All 增加 Qt IFW/`maintenancetool.exe` 模块，不再套 Inno。
3. **拆 NVIDIA 组件状态**：`desktopInstalled`、`localLocationConfigured`、`wslDistro`、`containerRuntime`、`projects` 分开；Desktop 初装不预装环境。
4. **重新认证 WorkBuddy 5.3.8**：完整下载、SHA-256、Authenticode、VersionInfo、卸载记录和真实安装/升级/卸载验收；随后更新客户端白名单和后台目录。
5. **增加架构/系统门禁模型**：先路由 x64/ARM64，再表达 Windows build、AVX2、RAM、磁盘建议与 optional dependencies。
6. **补 Store/Appx 模块**：用 `9NHT9RB2F4HD` / `Microsoft.Copilot` 管 Copilot 的安装入口、检测、打开和卸载。
7. **补数据保留 UI**：AnythingLLM、Kiro、NVIDIA、OpenClaw、Ollama 使用已公开规则；其他产品明确显示 unknown，禁止 AI Hub 自行删除 AppData/工作区/模型。
8. **修后台一致性提示**：每个 managed product 显示所需最低 AI Hub 客户端版本和本地 certification revision，避免后台 URL 与旧客户端白名单各说各话。

## 7. 验收边界

本文完成的是一手资料、当前官方元数据和源码契约复核。以下仍需修改后在隔离 Windows 用户/虚拟机上逐款人工验收：

- x64/ARM64 路由；
- 首次安装、重复安装、厂商自更新；
- 托盘/后台进程真正退出；
- 从注册身份启动，而不是猜路径；
- 交互式卸载与取消；
- 保留/删除本地模型、工作区、WSL distro 的选择；
- 卸载后重新检测以及残留数据说明。

下载源审计、单元测试或浏览器页面演示不能替代上述真实 Windows 生命周期验收。
