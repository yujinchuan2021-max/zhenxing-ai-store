# Windows 桌面产品官方分发复核

复核日期：2026-07-31（Asia/Shanghai）

范围仅包括：ChatGPT Desktop、Claude Desktop、ComfyUI Desktop / Comfy Desktop、Ollama。

## 研究边界

- 只使用厂商官网、厂商帮助中心、厂商官方 GitHub 仓库和 Microsoft 官方页面。
- 本次没有下载、解析或执行任何安装包，因此没有把某个时间点的文件哈希、证书指纹或实际 Authenticode 主体写成已验证事实。
- “官方源码中的应用 ID/作者字段”和“Windows 安装包的数字签名主体”不是一回事。只有厂商公开了后者时，才可将其作为固定校验依据。
- 下载入口、版本、证书和重定向目标都可能变化。AI Hub 不应把一次观察到的最终 CDN URL、版本号、哈希或证书指纹永久写死。

## 总结

| 产品 | 当前官方入口 | Windows 分发 | 官方公开的稳定身份 | AI Hub 推荐策略 |
|---|---|---|---|---|
| ChatGPT Desktop | `https://chatgpt.com/download/` | Microsoft Store；当前主产品 ID `9PLM9XGG6VKS` | Store Product ID；Microsoft Store 页面显示开发者为 OpenAI | 打开官方 Store 入口，不托管最终 MSIX，不自行判断安装完成 |
| Claude Desktop | `https://claude.com/download` | 普通用户使用厂商下载页的 EXE；Team/Enterprise 另有 x64/arm64 MSIX | 官方文档给出 MSIX 包名 `Claude`，可用 `Get-AppxPackage -Name Claude` 检测 | 默认打开官方入口；只有未来完成逐包验签策略后才考虑托管下载 |
| ComfyUI Desktop | `https://comfy.org/download` | 当前产品已演进为 **Comfy Desktop**，Windows 使用 NSIS `.exe` | 当前源码 `appId=com.todesktop.241012ess7yxs0e`、`productName=Comfy Desktop`；签名主体未公开 | 将旧产品标记为迁移项，更新为 Comfy Desktop；打开官方自动识别下载入口 |
| Ollama | `https://ollama.com/download/windows` | 官方 `OllamaSetup.exe`（Inno Setup），另提供 PowerShell 引导方式 | 安装器 AppId `{44E83376-CE68-45EB-8FC1-393500EB558C}`、应用名/发布者字段 `Ollama`；实际证书主体未公开 | 打开官方 Windows 下载入口；检测可组合卸载项、安装路径和本机 API |

## 1. ChatGPT Desktop

### 官方入口与分发

OpenAI 当前下载页把 Windows 主按钮指向 Microsoft 的 Store Installer：

- 官方下载页：<https://chatgpt.com/download/>
- 当前 Windows 入口：<https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi>
- Microsoft Store 产品页：<https://apps.microsoft.com/detail/9PLM9XGG6VKS>

当前下载页明确区分了主应用和 Classic：主应用的 Windows Product ID 是 `9PLM9XGG6VKS`；`9NT1R1C2HH7J` 现在是页面底部的 **ChatGPT Classic** Windows 入口。OpenAI 还说明，已有 Codex app 用户可更新到新的 ChatGPT 应用并在其中打开 Codex。[OpenAI 下载页](https://chatgpt.com/download/)

旧版 Windows 帮助文档仍记录 `9NT1R1C2HH7J` 的 Store/winget 安装方式，因此它适合作为 Classic 的历史依据，不应覆盖当前主下载页的产品 ID。[OpenAI Windows 帮助](https://help.openai.com/en/articles/9982051-using-the-chatgpt-windows-app)

### 包格式、身份和更新

- 分发机制是 Microsoft Store，不是 OpenAI 提供的稳定最终 EXE/MSIX 直链。
- 可长期使用的入口身份是 Store Product ID `9PLM9XGG6VKS`。
- Microsoft 官方建议使用 `ms-windows-store://pdp/?ProductId=<ProductId>` 打开指定产品详情页；PFN 和 App ID 形式已被标为不推荐，Product ID 是推荐链接方式。[Microsoft Store URI 文档](https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-store-app)
- Microsoft Store 中的 MSIX 会由 Store 处理签名；实际安装包签名主体和证书可能与目录中的开发者名称不是同一概念。[Microsoft Windows 代码签名说明](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- OpenAI 当前公开页面没有给出可供 AI Hub 固定的最终包 URL、稳定包版本 API、证书指纹或当前主应用的包族名称。

### 安装、检测和卸载约束

推荐：

1. AI Hub 打开 OpenAI 当前 Windows 入口，或打开 `ms-windows-store://pdp/?ProductId=9PLM9XGG6VKS`。
2. 不把 Microsoft Store Installer 引导文件描述为“ChatGPT 完整安装包”。
3. 检测优先使用 Store Product ID/Windows 已安装应用信息；如果需要包族检测，应从已安装包动态读取并审核后再固化，不能从第三方资料猜测。
4. 更新交给 Microsoft Store。
5. 卸载交给 Windows“已安装的应用”或 Store 包管理机制；AI Hub 不清理应用数据。

不推荐：

- 解析 Store 后端获取临时 MSIX 并自行托管。
- 固定某次 Store 包哈希、证书 thumbprint 或临时 CDN URL。
- 把 Classic ID `9NT1R1C2HH7J` 继续当作当前主 ChatGPT 应用。

## 2. Claude Desktop

### 官方入口与分发

- 官方下载页：<https://claude.com/download>
- Windows x64 普通用户入口：<https://claude.ai/api/desktop/win32/x64/exe/latest/redirect>
- Windows arm64 普通用户入口：<https://claude.ai/api/desktop/win32/arm64/exe/latest/redirect>
- 官方安装说明：<https://support.claude.com/en/articles/10065433-install-claude-desktop>
- 官方企业部署说明：<https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows>

官方帮助中心说明普通 Windows 用户从下载页取得文件并运行；下载页同时提供 x64 和 arm64。下载按钮使用 Anthropic 自己的 `latest/redirect` 入口，URL 路径明确标为 `exe`。[Claude 下载页](https://claude.com/download)

Team/Enterprise 管理部署另有完整 x64/arm64 MSIX，支持 Intune、SCCM、Group Policy 和 PowerShell。该 MSIX 是 per-user 应用：单用户使用 `Add-AppxPackage`，全机预配使用 `Add-AppxProvisionedPackage`。[Claude Windows 部署文档](https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows)

### 包身份、发布者和更新

- 官方公开的 MSIX 检测名是 `Claude`；文档明确建议用 `Get-AppxPackage -Name Claude` 做版本下限检测。
- 默认大约每四小时检查一次更新并自动应用。若 MDM 管理版本，应设置 `disableAutoUpdates=1`；否则必须让 Claude 自己负责更新，不能让两个更新所有者并存。[Claude Windows 部署文档](https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows)
- 企业策略还公开了 `autoUpdaterEnforcementHours`（1–72 小时，默认 72）和 `disableAutoUpdates`。[Claude 企业配置](https://support.claude.com/en/articles/12622667-enterprise-configuration-for-claude-desktop)
- 官网和帮助中心主体属于 Anthropic，但本次未下载文件，官方网页也没有公开 Windows EXE/MSIX 的 Authenticode 证书主体、证书指纹或固定 SHA-256。因此不能在本次复核中声称已验证某个 signer 字符串。

### 安装、检测和卸载约束

推荐：

1. 消费者产品默认打开 `https://claude.com/download`，让用户选择 x64/arm64。
2. 若未来支持完整包托管，必须只允许 Anthropic 固定入口，限制重定向到 Anthropic 官方下载域，并在每次下载后重新验证签名、架构、版本和包身份。
3. MSIX 检测使用官方给出的 `Get-AppxPackage -Name Claude`；普通 EXE 安装形态不能假定与 MSIX 的检测方式完全相同。
4. Claude 自更新与 AI Hub/MDM 更新二选一。
5. 卸载优先交给 Windows“已安装的应用”或 MSIX 包管理；没有官方、稳定的静默卸载协议时，不自动执行推测出的卸载命令。

特别约束：

- Claude Cowork 完整功能需要管理员权限、Windows Virtual Machine Platform，并可能要求重启；普通用户无管理员权限仍可安装 Claude，但 Cowork 不可用。[Claude Windows 部署文档](https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows)
- AI Hub 不应为了“检测 Claude 是否安装”而主动启用虚拟化功能或修改系统策略。

## 3. ComfyUI Desktop / Comfy Desktop

### 产品迁移结论

旧仓库 `Comfy-Org/desktop` 已归档并指向新的 `Comfy-Org/Comfy-Desktop`。当前官网和文档将产品称为 **Comfy Desktop**，定位为可管理多个 ComfyUI 实例的桌面启动器。因此目录中的“ComfyUI Desktop”不能继续按旧 V1 安装路径和探针维护，应迁移到当前产品，或明确标为 Legacy。[旧官方仓库](https://github.com/Comfy-Org/desktop) [当前官方仓库](https://github.com/Comfy-Org/Comfy-Desktop)

### 官方入口与包格式

- 官网入口：<https://comfy.org/download>
- 当前官方仓库给出的自动平台识别入口：<https://dl.todesktop.com/241130tqe9q3y>
- Windows 使用 NSIS `.exe`，从开始菜单或桌面快捷方式启动。[Comfy Desktop Windows 文档](https://docs.comfy.org/installation/desktop/windows)

当前官方构建配置公开：

- `appId`: `com.todesktop.241012ess7yxs0e`
- `productName`: `Comfy Desktop`
- Windows target: `nsis`
- `perMachine: false`
- 允许用户选择安装目录
- 发布仓库：`Comfy-Org/Comfy-Desktop`

来源：[官方 electron-builder 配置](https://raw.githubusercontent.com/Comfy-Org/Comfy-Desktop/main/electron-builder.yml)

官方 `package.json` 的作者字段是 `Comfy Org`，但这不是 Windows Authenticode signer 证明；当前官方源码没有公开可稳定固化的 Windows 签名主体或证书指纹。[官方 package.json](https://raw.githubusercontent.com/Comfy-Org/Comfy-Desktop/main/package.json)

### 更新、检测和卸载

Comfy Desktop 会自动检查更新；用户可点击 “Desktop Update Ready” 重启安装更新，也可在设置中手动检查或关闭自动安装更新。[Comfy Desktop Windows 文档](https://docs.comfy.org/installation/desktop/windows)

推荐：

1. 入口使用官网或官方仓库给出的 ToDesktop 自动识别链接，不使用旧 `download.comfy.org` V1 路径。
2. 目录名称更新为 `Comfy Desktop`，描述中说明它管理 ComfyUI 实例；如果必须保留旧名称，标注“已由 Comfy Desktop 取代”。
3. 安装检测以 Windows 卸载项中的 `Comfy Desktop`、当前应用 ID和实际安装记录组合判断；不要仅检查旧路径 `%LOCALAPPDATA%\Programs\ComfyUI`。
4. 更新交给 Comfy Desktop。
5. 卸载只卸载启动器。官方明确说明卸载不会删除用户创建的实例、共享模型、输出和设置；AI Hub 不得自动删除这些目录。

官方列出的保留数据包括：

- `%USERPROFILE%\ComfyUI-Installs`
- `%USERPROFILE%\ComfyUI-Shared`
- `%APPDATA%\Comfy Desktop`

来源：[Comfy Desktop Windows 文档](https://docs.comfy.org/installation/desktop/windows)

## 4. Ollama

### 官方入口与包格式

- Windows 下载页：<https://ollama.com/download/windows>
- 稳定下载入口：<https://ollama.com/download/OllamaSetup.exe>
- 官方 Windows 文档：<https://github.com/ollama/ollama/blob/main/docs/windows.mdx>

官方文档说明推荐使用 `OllamaSetup.exe`。它按用户安装，不要求管理员权限，默认放在 `%LOCALAPPDATA%\Programs\Ollama`，并把目录加入用户 PATH。另有只包含 CLI/GPU 依赖的 ZIP，适合自行集成服务，不应与桌面安装器混为一类。[Ollama Windows 文档](https://github.com/ollama/ollama/blob/main/docs/windows.mdx)

官方安装器源码确认其为 Inno Setup，并公开：

- AppId：`{44E83376-CE68-45EB-8FC1-393500EB558C}`
- AppName：`Ollama`
- AppPublisher 字段：`Ollama`
- 默认目录：`%LOCALAPPDATA%\Programs\Ollama`
- 安装权限：`lowest`
- 输出文件名：`OllamaSetup`

来源：[官方 Inno Setup 配置](https://raw.githubusercontent.com/ollama/ollama/main/app/ollama.iss)

官方发布流水线使用 `ollama_inc.crt` 和 Google Cloud KMS 调用 SignTool 对 EXE、DLL、脚本和安装器签名，但源码没有公开证书 Subject 或可永久固定的 thumbprint。因此可确认“官方发布流程包含代码签名”，不能仅凭源码确认当前二进制的实际签名主体。[官方 Windows 构建脚本](https://raw.githubusercontent.com/ollama/ollama/main/scripts/build_windows.ps1)

### 更新、检测和卸载

- Windows 版自动下载更新，用户从任务栏菜单点击 “Restart to update” 应用更新；也可重新下载最新版手动更新。[Ollama FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx)
- 默认后台 API 是 `http://localhost:11434`，安装目录为 `%LOCALAPPDATA%\Programs\Ollama`，模型通常位于 `%USERPROFILE%\.ollama\models`。[Ollama Windows 文档](https://github.com/ollama/ollama/blob/main/docs/windows.mdx)
- Windows 安装器注册系统卸载项，可从“添加或删除程序”卸载。

推荐检测顺序：

1. 读取与 AppId/DisplayName `Ollama` 对应的用户级卸载项；
2. 检查 `%LOCALAPPDATA%\Programs\Ollama\ollama.exe`；
3. 可选调用本机 `http://127.0.0.1:11434` 的版本接口确认服务状态，但“未运行”不能等价于“未安装”；
4. PATH 中出现另一个 `ollama.exe` 也不能单独证明它由官方桌面安装器安装。

推荐卸载策略：

- 调用 Windows 已注册的 Ollama 卸载流程，不自行删除目录。
- 模型目录可能占用数十到数百 GB，必须由用户明确选择是否删除。
- 官方文档称自定义 `OLLAMA_MODELS` 位置不会被安装器删除；当前安装器源码又包含交互式模型清理选项。两者说明模型清理属于用户决策，AI Hub 不应静默执行。

## 对 AI Hub 模块的最终约束

四个产品都应使用“图形桌面产品”统一模块，但策略参数不同：

```yaml
module: desktopOfficialDistribution
downloadOwnership: vendor
automaticInstall: false
automaticUninstall: false
probeOnBrowse: false
probeOnExplicitActionOnly: true
```

产品差异：

- ChatGPT：`distribution = microsoftStore`，固定 Product ID `9PLM9XGG6VKS`。
- Claude：`distribution = vendorDownloadPage`；企业 MSIX 是单独的受管部署能力，不与普通用户入口混用。
- Comfy：`distribution = vendorAutoDetectDownload`，产品名迁移为 `Comfy Desktop`。
- Ollama：`distribution = vendorExePage`；可使用多信号本机检测，但仍由用户运行官方安装器。

在没有完成“下载后逐包验签 + 发布者轮换策略 + 架构校验 + 临时文件清理 + 用户最终确认”之前，后台只能下发这些已审核的官方入口和展示参数，不能把任意 EXE URL 升级成自动安装能力。
