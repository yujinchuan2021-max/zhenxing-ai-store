# 核心 Windows 桌面产品全生命周期复核

复核日期：2026-08-01（Asia/Shanghai）
范围：ChatGPT Desktop、Claude Desktop、Comfy Desktop、Ollama for Windows

## 研究边界

- 只采用厂商官网、厂商帮助中心、厂商官方代码仓库，以及 Windows 分发机制的 Microsoft 官方资料。
- 本次没有下载、解包、运行或验证任何安装器；因此不会把一次性文件哈希、证书指纹或未公开的 Authenticode Subject 写成稳定事实。
- “目录发布者”“安装器配置中的 Publisher 字段”和“Windows 数字签名主体”是三个不同概念。只有官方明确公开时才记录签名结论。
- 下载入口、重定向目标、包版本和证书会变化。AI Hub 应保存稳定的产品身份和获准域名，并在每次显式安装动作时重新解析当前入口；不能把某次 CDN 目标永久写死。

## 结论摘要

| 产品 | 当前官方 Windows 入口 | 官方包形态 | 可稳定使用的安装识别 | 更新所有者 | 卸载与数据边界 |
|---|---|---|---|---|---|
| ChatGPT Desktop | `chatgpt.com/download`；主应用 Product ID `9PLM9XGG6VKS` | Microsoft Web Installer / Store；另有官方稳定 x64、Arm64 MSIX | Store Product ID；当前 PFN `OpenAI.Codex_2p2nqsd0c76g0` | Microsoft/OpenAI 的 Store 或 MSIX 自动更新 | 交给 Windows 卸载；OpenAI 未公开产品专属的本地数据清理契约 |
| Claude Desktop | `claude.com/download`；当前普通入口为 `/setup/latest/redirect` | 普通用户安装器；Team/Enterprise 另有 per-user MSIX | MSIX：`Get-AppxPackage -Name Claude`；普通安装器没有公开稳定 ProductCode | Claude 自更新，或企业 MDM 二选一 | 官方未公开普通安装器的静默卸载和本地数据保留契约，交给 Windows/厂商卸载 UI |
| Comfy Desktop | 官方自动识别链接 `dl.todesktop.com/241130tqe9q3y` | NSIS `.exe`，per-user，可改安装目录 | Windows “已安装的应用”中的 `Comfy Desktop`；当前 appId `com.todesktop.241012ess7yxs0e` | Comfy Desktop 自更新 | 只移除启动器；实例、共享模型/输出和设置保留 |
| Ollama | `ollama.com/download/OllamaSetup.exe` | Inno Setup `.exe`，per-user；另有官方 PowerShell 安装入口 | Inno AppId `{44E83376-CE68-45EB-8FC1-393500EB558C}` + 安装记录；运行态可读 `/api/version` | Ollama 自动下载，用户重启应用完成更新 | 厂商卸载器处理；默认模型删除由卸载 UI 选择，自定义 `OLLAMA_MODELS` 保留 |

## 1. ChatGPT Desktop

### 1.1 当前官方入口与产品身份

当前 ChatGPT 下载页把 Windows 主应用指向 Microsoft Web Installer，并明确说明新桌面应用包含 ChatGPT Work 和 Codex；旧应用单独列为 **ChatGPT Classic**：

- 官方下载页：<https://chatgpt.com/download/>
- 当前 Windows 主应用 Web Installer：<https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi>
- 当前 Windows 文档：<https://learn.chatgpt.com/docs/windows/windows-app>
- 企业部署文档：<https://learn.chatgpt.com/docs/enterprise/windows-deployment>

官方 Windows 文档给出的命令行安装方式是：

```powershell
winget install --id 9PLM9XGG6VKS -s msstore
```

因此 `9PLM9XGG6VKS` 才是当前主应用的稳定逻辑身份。旧帮助文章仍出现的 `9NT1R1C2HH7J` 属于 ChatGPT Classic，不应继续用于当前主应用。旧帮助文章可作为 Classic 的历史依据，但不能覆盖当前下载页和当前部署文档：<https://help.openai.com/en/articles/9982051-using-the-chatgpt-windows-app>。

### 1.2 包类型与签名边界

OpenAI 当前提供三种官方 Windows 分发入口：

1. Microsoft Web Installer / Store；
2. `winget` 的 `msstore` 源；
3. 不依赖 Microsoft 初始分发服务的稳定 MSIX 链接：
   - x64：<https://persistent.oaistatic.com/codex-app-prod/ChatGPT-x64.msix>
   - Arm64：<https://persistent.oaistatic.com/codex-app-prod/ChatGPT-arm64.msix>

OpenAI 企业部署文档明确称应用为 **Store-signed**，并说明上述 MSIX 稳定链接始终指向各架构最新已发布包；它没有提供 MSI 或非 Store EXE。文档没有把某个证书 Subject 或 thumbprint 声明为永久兼容契约，因此 AI Hub 只能要求 Windows 签名链有效，不能永久钉死证书指纹。

Microsoft 官方目录在本次复核时返回：

- `ProductId`: `9PLM9XGG6VKS`
- `Title`: `ChatGPT`
- `PublisherName` / `DeveloperName`: `OpenAI`
- `PackageFamilyNames`: `OpenAI.Codex_2p2nqsd0c76g0`
- 支持架构：x64、Arm64

目录来源：<https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/9PLM9XGG6VKS?market=US&locale=en-US&deviceFamily=Windows.Desktop>。目录元数据是 Microsoft 第一方的当前状态，但 PFN 仍可能随未来迁移变化；长期稳定键应仍是 Product ID。

### 1.3 安装后识别

推荐按以下顺序识别：

1. 以 Store Product ID `9PLM9XGG6VKS` 作为产品逻辑身份；
2. 从 Microsoft 官方目录刷新当前 Package Family Name；
3. 当前可用 `Get-AppxPackage -Name OpenAI.Codex` 检查对应包，并核对 PFN `OpenAI.Codex_2p2nqsd0c76g0`；
4. 不使用 Web Installer 自身的文件版本判断 ChatGPT 是否安装——它只是安装引导器；
5. 不把 Classic 的 `OpenAI.ChatGPT-Desktop_...` 与当前主应用混为一个安装状态。

### 1.4 启动与更新

- 官方 Windows 文档要求安装后从 Windows 开始菜单找到 ChatGPT；AI Hub 的“打开”应走 Windows 已安装应用身份/开始菜单，不猜测 `WindowsApps` 内部可执行文件路径。
- Web Installer 提供标准安装和自动更新体验。
- 使用稳定 MSIX 初装后，只要设备能访问 `persistent.oaistatic.com`，应用可以自动安装更新，不需要 AI Hub 再部署新版包。
- 因此 AI Hub 不应同时充当第二个更新器；可以显示当前版本和“由 ChatGPT 自动更新”，但不能覆盖 Store/MSIX 更新状态。

### 1.5 卸载与数据保留

OpenAI 当前公开文档只给出了 Windows “设置 → 应用 → 已安装的应用 → ChatGPT → 高级选项 → 重置”的恢复流程，没有公开 ChatGPT 专属的静默卸载参数或本地数据保留清单。

AI Hub 应：

- 打开 Windows “已安装的应用”中的 ChatGPT 卸载流程，或对当前用户的实际 Appx 包调用标准 Windows 卸载；
- 不直接删除 `%ProgramFiles%\WindowsApps`、包注册表或猜测的 AppData；
- 不宣称卸载会删除云端聊天、账号或用户自己创建的文件；这些不属于已公开的 Windows 包卸载契约。

Microsoft 对 MSIX 的通用边界是：卸载会移除包内应用工件和应用写入的容器化数据，但不会移除用户创建的文件。来源：<https://learn.microsoft.com/en-us/windows/msix/desktop/managing-your-msix-deployment-enterprise>。Windows 通用卸载入口来源：<https://support.microsoft.com/en-us/windows/uninstall-or-remove-apps-and-programs-in-windows-4b55f974-2cc6-2d2b-d092-5905080eaf98>。

## 2. Claude Desktop

### 2.1 当前官方入口

- 官方下载页：<https://claude.com/download>
- 当前普通 Windows x64 入口：<https://claude.ai/api/desktop/win32/x64/setup/latest/redirect>
- 当前普通 Windows Arm64 入口：<https://claude.ai/api/desktop/win32/arm64/setup/latest/redirect>
- 官方安装说明：<https://support.claude.com/en/articles/10065433-install-claude-desktop>
- 官方 Windows 企业部署说明：<https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows>

重要变化：当前下载页链接的是 `/setup/latest/redirect`，不是旧的 `/exe/latest/redirect`。AI Hub 应跟随官网当前入口，不应继续把旧路径当作永久合同。

### 2.2 包类型、权限与签名边界

Anthropic 将 Windows 分成两条分发路径：

- 普通用户：下载页的 user-friendly setup；当前公开页面没有把固定文件名、固定扩展名、ProductCode 或静默参数声明为兼容契约。
- Team/Enterprise 管理部署：per-user MSIX。
  - x64：<https://claude.ai/api/desktop/win32/x64/msix/latest/redirect>
  - Arm64：<https://claude.ai/api/desktop/win32/arm64/msix/latest/redirect>

单用户 MSIX 使用 `Add-AppxPackage`；全机预配使用 `Add-AppxProvisionedPackage`。普通 Claude 可以无管理员权限安装，但要完整使用 Claude Cowork，Windows 需要管理员权限、Virtual Machine Platform，并可能需要重启。仅安装了 per-user MSIX 不代表 Cowork 的机器级服务已经注册成功。

Anthropic 的公开文档没有给出可长期固化的 Windows Authenticode Subject 或证书指纹。本次也没有下载包验证，因此不能把历史观察到的 signer 字符串写入永久白名单。

### 2.3 安装后识别

- MSIX：官方明确推荐使用 `Get-AppxPackage -Name Claude`，并比较版本是否大于等于已部署版本。
- 普通 setup：官方没有公开稳定 ProductCode、卸载注册表键或默认可执行文件路径。不能把 MSIX 检测直接套给普通安装器，也不能只检查某个猜测路径。
- Cowork 能力必须独立检测：安装 Claude 与 Virtual Machine Platform、`vmcompute`/`hns` 服务可用是不同状态。官方故障诊断给出了 `Get-WindowsOptionalFeature` 和 `Get-Service vmcompute, hns`，但这些检查应只在用户显式启用 Cowork 时运行，不能在浏览目录时修改系统功能。

### 2.4 启动与更新

- 官方安装说明要求从 Windows 开始菜单启动 Claude；AI Hub 应通过已安装应用/开始菜单启动，不猜测安装路径。
- Claude Desktop 默认约每四小时检查一次更新并自动应用。
- 企业 MDM 与 Claude 自更新必须二选一：如果 MDM 管版本，设置 `disableAutoUpdates=1`；否则让 Claude 自更新。相关策略来源：<https://support.claude.com/en/articles/12622667-enterprise-configuration-for-claude-desktop>。
- AI Hub 不应在 Claude 自更新仍开启时再覆盖安装包，也不应为普通用户擅自写企业策略。

### 2.5 卸载与数据保留

Anthropic 当前公开文档没有提供普通 Windows setup 的稳定静默卸载命令，也没有声明卸载会删除哪些本地 Claude/Cowork 数据。因此：

- 普通安装器交给 Windows “已安装的应用”中厂商注册的卸载流程；
- MSIX 交给 Windows 包管理；
- AI Hub 只观察卸载前后状态，不删除猜测的 AppData、Cowork 工作区、用户文件或账号数据；
- 在厂商公布明确保留清单前，UI 应提示“仅卸载应用；本地工作区和云端账号数据不由 AI Hub 清理”。

## 3. Comfy Desktop

### 3.1 当前官方入口和产品迁移

当前产品名称是 **Comfy Desktop**，定位为管理多个 ComfyUI 实例的桌面启动器，不应继续使用旧 ComfyUI Desktop V1 的路径和检测规则。

- 官方下载页：<https://comfy.org/download>
- 官方 Windows 文档：<https://docs.comfy.org/installation/desktop/windows>
- 官方自动平台识别入口：<https://dl.todesktop.com/241130tqe9q3y>
- 官方源码：<https://github.com/Comfy-Org/Comfy-Desktop>

### 3.2 包类型与签名边界

官方文档明确 Windows 使用 NSIS `.exe`。官方构建配置进一步给出：

- `appId`: `com.todesktop.241012ess7yxs0e`
- `productName`: `Comfy Desktop`
- Windows target: `nsis`
- `perMachine: false`
- 允许用户改变安装目录
- 产物名模板：`Comfy-Desktop-${version}-${os}-${arch}.${ext}`

来源：<https://raw.githubusercontent.com/Comfy-Org/Comfy-Desktop/main/electron-builder.yml>。

官方 `package.json` 的作者为 `Comfy Org`，但作者字段不是 Authenticode 签名主体。当前公开仓库没有承诺稳定的 Windows 证书 Subject 或 thumbprint，因此 AI Hub 不能把 `Comfy Org` 作者字段直接当作签名白名单。

### 3.3 安装后识别

- 官方卸载说明明确要求在 Windows “已安装的应用”中查找 `Comfy Desktop`，所以它是第一识别信号。
- 结合当前 appId `com.todesktop.241012ess7yxs0e` 和卸载记录中解析出的实际安装位置确认身份。
- 因为安装器允许用户改变目录，不能以固定 `%LOCALAPPDATA%\Programs\...` 路径作为唯一判断。
- 旧 `ComfyUI Desktop` 路径只能作为迁移提示，不能让旧安装误判为当前 Comfy Desktop。

### 3.4 启动与更新

- 官方文档明确支持从开始菜单或桌面快捷方式启动。
- Comfy Desktop 自动检查更新；更新可通过顶部 “Desktop Update Ready” 或 “Desktop Settings → Updates → Restart & Update” 完成，也可关闭自动安装。
- AI Hub 应把更新所有权交给 Comfy Desktop，仅展示状态并打开应用；不在后台覆盖当前安装目录。

### 3.5 卸载与数据保留

官方边界非常明确：Windows 设置中的卸载只移除启动器，不移除以下用户数据：

| 数据 | 默认路径 |
|---|---|
| ComfyUI 实例 | `%USERPROFILE%\ComfyUI-Installs` |
| 共享模型、输入和输出 | `%USERPROFILE%\ComfyUI-Shared` |
| 应用设置、安装记录、日志 | `%APPDATA%\Comfy Desktop` |

自定义实例路径也不会被移除。完整清理必须由用户手动决定。AI Hub 不得在普通“卸载”中递归删除这些目录；可以另提供清晰的“查看保留数据”入口，但删除必须单独确认。

## 4. Ollama for Windows

### 4.1 当前官方入口

- 官方 Windows 页：<https://ollama.com/download/windows>
- 官方安装器入口：<https://ollama.com/download/OllamaSetup.exe>
- 官方 Windows 文档：<https://github.com/ollama/ollama/blob/main/docs/windows.mdx>
- 官方另提供 PowerShell 入口：`irm https://ollama.com/install.ps1 | iex`

桌面产品模块应优先使用 `OllamaSetup.exe`；PowerShell 入口应作为单独的受控脚本策略，不与图形安装器混成同一个动作。

### 4.2 包身份与签名边界

官方 Inno Setup 配置公开：

- AppId：`{44E83376-CE68-45EB-8FC1-393500EB558C}`
- AppName / AppPublisher 字段：`Ollama`
- 默认目录：`%LOCALAPPDATA%\Programs\Ollama`
- 权限：`lowest`，即当前用户安装，不要求管理员
- 输出文件名：`OllamaSetup.exe`
- 主程序：`ollama app.exe`

来源：<https://raw.githubusercontent.com/ollama/ollama/main/app/ollama.iss>。

官方 Windows 构建脚本显示正式发布流程会在配置 `KEY_CONTAINER` 和 `ollama_inc.crt` 后，通过 Google Cloud KMS Provider 和 SignTool 对 EXE、DLL、脚本及安装器签名：<https://raw.githubusercontent.com/ollama/ollama/main/scripts/build_windows.ps1>。但仓库没有公开证书 Subject 或永久 thumbprint，因此只能确认“官方发布流程包含代码签名”，不能把 `AppPublisher=Ollama` 当作证书主体。

### 4.3 安装后识别

推荐按以下顺序：

1. 查询 AppId `{44E83376-CE68-45EB-8FC1-393500EB558C}` 对应的当前用户卸载记录；
2. 从卸载记录解析实际安装目录，并确认 `ollama app.exe` 与 `ollama.exe`；
3. 默认路径 `%LOCALAPPDATA%\Programs\Ollama` 只作为回退，因为安装器支持 `/DIR=...` 改位置；
4. 若应用正在运行，调用 `GET http://localhost:11434/api/version` 取得运行版本。官方接口：<https://docs.ollama.com/api-reference/get-version>；
5. API 不通只代表服务未运行，不能据此判断未安装。

### 4.4 启动与更新

- 安装后 Ollama 在后台运行，`ollama` 命令可用于 cmd、PowerShell 或其他终端，API 默认在 `http://localhost:11434`。
- 桌面“打开”应启动卸载记录解析出的 `ollama app.exe` 或开始菜单项；CLI 动作应打开终端并让用户使用 `ollama`，两者在 UI 中应分开。
- Ollama 在 Windows 上会自动下载更新，用户从任务栏菜单选择 “Restart to update” 应用更新；也可以重新下载最新版手动更新。来源：<https://github.com/ollama/ollama/blob/main/docs/faq.mdx>。
- AI Hub 不应在 Ollama 更新器工作时直接替换二进制目录。

### 4.5 卸载与数据保留

官方 Windows 文档要求通过 “Add or remove programs” 调用已注册的 Ollama Uninstaller。当前官方安装器源码还显示：

- 卸载会停止 `ollama app.exe`、`ollama.exe` 和 `llama-server.exe`；
- 会清理 `%LOCALAPPDATA%\Ollama`、程序目录、临时文件和默认历史记录；
- 交互式卸载器会显示默认模型目录清理选项，当前源码中该选项默认勾选；
- 用户取消勾选时保留默认模型；自定义 `OLLAMA_MODELS` 位置不会被安装器删除。

因此 AI Hub 必须调起厂商交互式卸载器，不能静默代替用户选择，也不能在卸载后自行递归删除 `.ollama` 或自定义模型目录。卸载完成后应分别报告“应用已移除”和“模型数据是否仍保留”，而不是只给一个布尔状态。

## 5. 对 AI Hub 统一桌面模块的约束

四个产品可以复用统一生命周期接口，但不能复用同一组探针和卸载逻辑：

```text
resolveOfficialEntry -> detectInstalled -> openProduct
                     -> observeVendorUpdater
                     -> openVendorUninstaller -> detectInstalledAgain
                     -> reportRetainedData
```

必须保留的差异参数：

| 参数 | ChatGPT | Claude | Comfy Desktop | Ollama |
|---|---|---|---|---|
| 分发身份 | Store Product ID | setup 或 MSIX | appId + Installed Apps | Inno AppId |
| 确定性探针 | Appx/PFN | MSIX 可确定；普通 setup 不确定 | Installed Apps + 动态目录 | AppId + 二进制 + 可选 API |
| 启动入口 | Windows App/开始菜单 | 开始菜单 | 开始菜单/快捷方式 | GUI 与 CLI 分开 |
| 更新所有者 | Store/OpenAI | Claude 或 MDM 二选一 | Comfy Desktop | Ollama |
| 卸载数据选择 | 未公开产品专属清单 | 未公开产品专属清单 | 明确保留实例/模型/设置 | 模型保留由厂商卸载 UI 决定 |

共同安全边界：

- 目录展示时不运行本机探针；仅在用户进入已安装管理或显式点击安装/打开/卸载时检测。
- 后台只能选择客户端内置且审核过的产品策略参数，不能下发任意 EXE、PowerShell、CMD 或 Shell 命令。
- 图形产品的安装和卸载由官方分发/卸载机制完成；AI Hub 负责解析官方入口、展示状态和在操作后复检，不接管厂商更新器，也不猜测删除用户数据。
- 对没有公开稳定检测或卸载契约的产品，UI 必须诚实显示“由 Windows/厂商完成”，不能伪装成全自动成功。
