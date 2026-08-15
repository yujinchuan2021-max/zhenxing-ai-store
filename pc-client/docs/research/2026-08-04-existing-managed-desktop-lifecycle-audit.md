# 现有受管 Windows 桌面产品生命周期合同审计

审计日期：2026-08-04（Asia/Shanghai）  
范围：当前已进入 `shared/windows-desktop-catalog.cjs`、但尚未进入
`shared/desktop-lifecycle.cjs` 的 24 个 Windows 桌面产品。  
目标字段：`updateOwner`、`updateStrategy`、`latestSource`、
`dataRetention`、`installerIdentity`。

## 结论

这 24 款产品都已经有客户端本地执行白名单和审核指纹，但“有下载/卸载
适配器”不等于“生命周期证据完整”。当前合同要求下载文件必须同时有：

1. 下载器自身的真实 PE Machine（不是产品宣传的 payload 架构）；
2. 至少一个从官方产物只读取得的 Windows VersionInfo 字段；
3. 现有来源域、有效 Authenticode 发布者、固定版本哈希或滚动包重新验签；
4. 厂商更新所有权、最新版本来源与保留数据边界。

按这个口径：

- **千问桌面版、OpenClaw Windows Hub、Wispr Flow** 已有足够的下载器
  PE/VersionInfo 证据，可直接写入 `installerIdentity`。其中 OpenClaw 的
  Windows Hub 与 Gateway 必须保持组合组件语义。
- 其余 **21 款**虽然已有当前版本的来源、签名、适配器和（多数情况下）
  固定 SHA-256，但仓库研究没有记录可供生命周期白名单使用的完整
  VersionInfo；不得根据产品名或安装器框架补写，统一标为
  `installerIdentity: pending-artifact-version-info`。
- **QoderWork、AnythingLLM、Comet、NVIDIA AI Workbench** 使用滚动包且
  没有固定 SHA-256，也还没有 Wispr Flow 那样的固定 PE 身份合同；在补齐
  PE/VersionInfo 前，不应仅凭来源域和 signer 让未来新包自动通过。
- 公开资料没有说明卸载后数据行为时，安全合同不是猜测“会保留”或“会
  删除”，而是显式使用 `vendor-unspecified`，普通卸载后 AI Hub 不递归删除
  任何 AppData、模型、工作区、项目或账号缓存。

## 口径与状态

- **可写入**：一手来源足以支持该字段；仍不代表真实安装/升级/卸载已经在
  隔离 Windows 用户上验收。
- **保守可写入**：这是客户端安全所有权决定，例如证据不足时把更新交回
  厂商、把数据清理设为不执行；不把它表述成厂商功能承诺。
- **pending**：不能安全固化；必须补一手文档或对官方产物做只读身份采样。
- `latestSource` 只有在机器可解析的官方 API、rolling URL 或官方 Release
  feed 存在时才算机器来源。只有下载页面时可以作为人工复核页，但不能
  宣称自动跟随最新版。
- `installerIdentity` 中的 `architecture` 指 **AI Hub 实际启动的下载器
  EXE 的 PE Machine**。URL 中的 `x64`、官网标注的 x64 和最终应用架构都
  不能替代该值。

## 汇总矩阵

| 产品 ID | 更新合同 | `latestSource` | 数据保留 | 下载器身份 | 结果 |
|---|---|---|---|---|---|
| `jianying` | `updateOwner=jianying`；机制未公开，策略保守写 `vendor-unspecified` | 官网仅能人工复核，无稳定版本 API | `vendor-unspecified` | 当前固定包 SHA/签名/Inno 已审核；缺 PE Machine + VersionInfo | **pending identity** |
| `trae-desktop` | `updateOwner=trae`；公开页未给稳定更新合同 | 官方 latest API 可机器解析 | `vendor-unspecified` | 固定包、北京引力弹弓签名、x86 Inno wrapper 已审核；缺 VersionInfo | **pending identity** |
| `trae-solo-cn` | `updateOwner=trae-work`；公开页未给稳定更新合同 | 与 TRAE 共用官方 API 的 `solo` 分组；展示名必须是 TRAE Work | `vendor-unspecified` | 固定包、同一签名、x86 Inno wrapper 已审核；缺 VersionInfo | **pending identity** |
| `bytedance-doubao` | `updateOwner=doubao`；机制未公开 | 只有官方下载页/固定包，机器 latest pending | `vendor-unspecified` | 固定 SHA、北京春田知韵签名、当前 NSIS 适配器已审核；缺 PE/VersionInfo | **pending identity/latest** |
| `google-antigravity-desktop` | `updateOwner=google-antigravity`；机制未公开 | 官网能人工确认当前版本和架构入口，未发现稳定版本 API | `vendor-unspecified` | 固定 SHA、Google LLC 签名、x86 wrapper 已审核；缺 VersionInfo | **pending identity/latest API** |
| `cursor-desktop` | `updateOwner=cursor`；公开当前页未给可引用的稳定更新/卸载合同 | `https://cursor.com/download` 仅作为官方 rolling 人工入口 | `vendor-unspecified` | 3.14.7 固定 SHA、Anysphere 签名、x86 Inno wrapper 已审核；缺 VersionInfo | **pending identity** |
| `kimi-work-desktop` | `updateOwner=kimi-work`；更新机制未公开 | 官方 Windows rolling API 可机器解析 | 本地文件处理数据留在设备端，但卸载目录/行为未公开，写 `vendor-unspecified` | 3.1.6 固定 SHA、月之暗面签名、x86 wrapper 已审核；缺 VersionInfo | **pending identity** |
| `alibaba-qwen-studio` | `updateOwner=qianwen`；机制未公开 | 中国千问稳定下载重定向可机器解析；不得混入全球 Qwen 渠道 | `vendor-unspecified` | 当前包 SHA、有效阿里签名、PE x64、`ProductName=Qianwen Installer` 已记录 | **identity 可写入；其余保守** |
| `alibaba-qoder-cn-ide` | `updateOwner=qoder-cn`；产品版本、VS Code 内核版本和下载目录版本目前相互不能映射 | 下载页/更新日志可人工复核；机器 latest 仍 pending | `vendor-unspecified` | 固定 SHA、BRIGHT ZENITH 签名、x86 Inno wrapper 已审核；缺 VersionInfo | **pending identity/latest mapping** |
| `alibaba-qoderwork-cn` | `updateOwner=qoderwork`；`vendor-background-check-user-confirm` | 官方 User x64 rolling URL | 普通卸载后配置需另删 `%USERPROFILE%\.qoderwork`，写 `retain-listed-data` | rolling 包只有来源域、当前 signer/x86 wrapper 快照；缺 SHA/PE VersionInfo | **pending rolling identity** |
| `tencent-yuanbao-desktop` | `updateOwner=tencent-yuanbao`；机制未公开 | 官网存在多个渠道包，无稳定版本 API | `vendor-unspecified` | 固定 SHA、腾讯签名、x86 wrapper 已审核；缺 VersionInfo | **pending identity/latest API** |
| `tencent-codebuddy` | `updateOwner=codebuddy`；`vendor-manual-check-user-confirm` | 官方更新 API，含版本、URL、SHA-256 | 不得把项目放进安装目录；卸载保留清单未公开，写 `vendor-unspecified` | 固定 SHA、腾讯签名、x86 Inno wrapper 已审核；缺 VersionInfo | **pending identity** |
| `tencent-workbuddy` | `updateOwner=workbuddy`；`vendor-auto-download-and-upgrade` | 官方更新 API；API 当前不提供 SHA-256 | 工作区常见于 `%USERPROFILE%\workbuddy`，必须保留；其他数据 `vendor-unspecified` | 当前 5.3.8 已固定本地 SHA/腾讯签名；缺 PE/VersionInfo | **pending identity** |
| `tencent-qclaw` | `updateOwner=qclaw`；官网未说明客户端更新机制 | 官方 POST 接口给版本、普通/静默/ZIP URL、MD5 与长度 | `vendor-unspecified` | 固定 SHA、腾讯 signer、NSIS 是当前实包快照；官方接口不承诺架构/格式，缺 PE/VersionInfo | **pending identity** |
| `tencent-ima` | `updateOwner=ima`；包内存在更新模式，但公开稳定更新流程不足，策略写 `vendor-unspecified` | 官网使用的 Rainbow 配置是机器真源 | `vendor-unspecified` | SHA、腾讯有效签名、`ProductName=ima installer`、`CompanyName=Tencent`、`OriginalFilename=ima_installer.exe` 已记录；下载器 PE Machine 未记录 | **pending architecture only** |
| `lm-studio-desktop` | `updateOwner=lm-studio`；`vendor-startup-check-user-confirm` | 官方下载页是当前版本来源；未找到独立机器 latest API | 模型目录可调整、preset 在 `%USERPROFILE%\.lmstudio\config-presets`；卸载行为未公开，写 `vendor-unspecified` 并保护已知数据 | 固定 SHA、Element Labs 签名、当前 NSIS 适配器已审核；缺 PE/VersionInfo | **pending identity** |
| `gpt4all-desktop` | `updateOwner=gpt4all`；`vendor-app-update-user-confirm` | 官方 GitHub Releases/latest | 模型默认在 `%LOCALAPPDATA%\nomic.ai\GPT4All` 且可改；卸载行为未承诺，写 `vendor-unspecified` | 固定 SHA/Nomic 签名；官方源码证明 Qt IFW + `maintenancetool.exe`，缺下载器 PE/VersionInfo | **pending identity** |
| `anythingllm-desktop` | `updateOwner=anythingllm`；`vendor-reinstall-latest-preserve-data` | 官方 x64/ARM64 rolling URL | 卸载不清 `%APPDATA%\anythingllm-desktop\storage`，写 `retain-listed-data` | rolling 包仅有 Mintplex signer 与 NSIS 快照，缺固定 SHA 和 PE/VersionInfo | **pending rolling identity** |
| `amazon-kiro-ide` | `updateOwner=kiro`；`vendor-check-updates-or-official-reinstall` | 官方 IDE changelog/下载；固定版本 URL 不能单独充当 latest feed | 重装/降级保留设置、扩展和登录态；卸载具体目录未公开，写 `vendor-unspecified` | 固定 SHA、Amazon 签名、Inno 已审核；缺 PE/VersionInfo | **pending identity** |
| `perplexity-comet` | `updateOwner=perplexity-comet`；`vendor-auto-update-or-manual-check` | 官方 Windows stable rolling API | 本地浏览数据由产品设置单独删除；卸载是否清 profile 未公开，写 `vendor-unspecified` | rolling R2 包缺固定 SHA/PE VersionInfo；只有当前 Perplexity signer/NSIS 快照 | **pending rolling identity** |
| `nvidia-ai-workbench` | `updateOwner=nvidia-ai-workbench`；`vendor-startup-check-user-confirm` | 官方 Desktop rolling URL | 必须使用组合组件/用户选择：Desktop、可选程序、`NVIDIA-Workbench` WSL distro、项目仓库分别处理 | rolling 包只有 NVIDIA signer/NSIS 快照；缺固定 SHA/PE VersionInfo | **pending rolling identity** |
| `openclaw-windows-hub` | `updateOwner=openclaw-windows-hub`；官方 Windows Hub Release 独立于 CLI；未发现稳定内置 updater 合同，策略保守写 `vendor-release-reinstall` | `openclaw/openclaw-windows-node` Releases/latest | `vendor-uninstaller-choice`：仅卸 Hub，或同时删除专属 `OpenClawGateway`；失败时允许保留 Gateway | 官方 Inno 身份 + 本机现有官方包：PE x86，`ProductName=OpenClaw Companion`，`FileDescription=OpenClaw Companion Setup`，`CompanyName=Scott Hanselman`，OpenClaw Foundation 有效签名 | **identity/data 可写入** |
| `wispr-flow-desktop` | `updateOwner=wispr-flow`；官方资料未说明产品内更新，策略写 `vendor-unspecified` | 官方 Windows rolling URL | 厂商未承诺卸载清理；AI Hub 只调起 Squirrel 卸载且不删除 `%APPDATA%\Wispr Flow`，写 `vendor-unspecified` | PE x86；Product/File description `Voice-typing made perfect`；OriginalFilename `Setup.exe`；CompanyName `Wispr Flow`；Squirrel `Update.exe --uninstall` | **identity 可写入** |
| `opencode` | `updateOwner=opencode`；`vendor-auto-download-user-confirm-restart` | 官方 GitHub Releases/latest | Desktop 数据 `%APPDATA%\ai.opencode.desktop` 与 WSL 数据 `~/.local/share/opencode` 分离；卸载行为未公开，写 `vendor-unspecified` | 固定 SHA/Anomaly 签名；官方源码证明 per-user NSIS；缺下载器 PE/VersionInfo | **pending identity** |

## 可直接落地的保守合同

即使厂商没有公开更新或卸载数据合同，也可以安全地增加生命周期对象，但必须
把未知写成未知，而不是用框架惯例补齐：

```text
updateOwner: <产品厂商>
updateStrategy: vendor-unspecified
latestSource: <官方人工复核页或已确认机器入口>
dataRetention:
  mode: vendor-unspecified
  retainedPaths: []
  userChoiceRequired: false
```

这个默认值的实际含义是：AI Hub 不成为第二更新器；只打开当前客户端已审核
的安装器/厂商应用；普通卸载后不追加任何目录删除。它不是“厂商保证保留
全部数据”。

以下产品已有更强的数据合同，应覆盖保守默认值：

| 产品 | 模式 | 保留/选择 |
|---|---|---|
| QoderWork | `retain-listed-data` | `%USERPROFILE%\.qoderwork` |
| WorkBuddy | `retain-listed-data` | `%USERPROFILE%\workbuddy`（用户工作区；不得当安装残留删除） |
| AnythingLLM Desktop | `retain-listed-data` | `%APPDATA%\anythingllm-desktop\storage` |
| NVIDIA AI Workbench | `vendor-uninstaller-choice` / 组合组件 | Desktop、可选程序、`NVIDIA-Workbench` WSL distro、项目仓库分别确认；注销 distro 前允许导出 |
| OpenClaw Windows Hub | `vendor-uninstaller-choice` / 组合组件 | 仅卸 Hub，或明确选择删除专属 `OpenClawGateway` 和生成状态；不碰普通 Ubuntu |

LM Studio、GPT4All、Kiro、Comet、OpenCode 已公开部分用户数据位置或保留
事实，但没有完整的“普通卸载会做什么”合同；应继续使用
`vendor-unspecified`，同时把已知路径作为“不得由 AI Hub 删除”的保护信息，
不要把它们伪装成厂商卸载器的完整行为清单。

## 可直接写入的下载器身份

### 千问桌面版（中国渠道）

```text
installerKind: vendor-installer
architecture: x64
versionInfo.ProductName: ^Qianwen Installer$
```

仍应同时保留现有官方来源域、固定 SHA-256 和
`ALIBABA (CHINA) NETWORK TECHNOLOGY CO.,LTD.` 有效签名要求。这个身份只
适用于中国千问 PC 渠道，不能用于全球 Qwen Desktop。

### OpenClaw Windows Hub

现有 `D:\AI Hub\OpenClawCompanion-0.6.12-Windows-x64.exe` 与官方 v0.6.12
Release 的文件名/大小一致；本次只读复核得到：

```text
installerKind: inno-user
architecture: x86
versionInfo.ProductName: ^OpenClaw Companion\s*$
versionInfo.FileDescription: ^OpenClaw Companion Setup\s*$
versionInfo.CompanyName: ^Scott Hanselman\s*$
```

文件 Authenticode 状态为 `Valid`，Subject 为 `OpenClaw Foundation`。本地
观察仅补齐下载器身份，不替代官方 AppId、per-user 安装目录和组合卸载逻辑。

### Wispr Flow

```text
installerKind: squirrel-user
architecture: x86
versionInfo.ProductName: ^Voice-typing made perfect$
versionInfo.FileDescription: ^Voice-typing made perfect$
versionInfo.OriginalFilename: ^Setup\.exe$
versionInfo.CompanyName: ^Wispr Flow$
```

它是 x86 Squirrel bootstrapper 承载 x64 应用，不得把合同改成 x64。滚动
入口每次仍须验证有效 `Wispr AI, Inc.` 签名及上述固定产品身份；证书
thumbprint 只作审计快照，不永久固定。

## 待补证据清单

对其余 21 款产品，下一轮只需要做一次可复用的“下载器身份采样”，不必重复
研究全部产品逻辑：

1. 从当前已审核 URL 获取官方安装器；滚动 URL 先记录最终 URL。
2. 只读记录 SHA-256（滚动包也记录点时 hash）、Authenticode 状态与 Subject。
3. 读取真实 PE Machine。
4. 读取 `ProductName`、`FileDescription`、`OriginalFilename`、`CompanyName`；
   只选择跨版本可稳定匹配且不会误认通用安装器的字段。
5. 对照当前 `installerKind`。GPT4All 必须保持 Qt IFW，ima 必须保持厂商外层
   引导器，Wispr 必须保持 Squirrel；不得全部套 NSIS/Inno。
6. 固定版本条目把新身份与现有 SHA 一起审核；滚动条目必须依靠 signer +
   PE/VersionInfo 身份持续校验，不能只靠 CDN host。
7. 完成后再更新执行合同指纹；研究/自动化通过不等于真实 Windows 安装、
   更新、打开、取消卸载和数据保留验收通过。

## 一手来源

### 字节跳动、Google、Cursor、月之暗面、阿里、腾讯元宝

- 剪映专业版：<https://www.capcut.cn/>
- TRAE / TRAE Work 下载：<https://www.trae.cn/ide/download>
- TRAE 官方 latest API：
  <https://api.trae.cn/icube/api/v1/native/version/trae/cn/latest>
- 豆包桌面版：<https://www.doubao.com/download/desktop>
- Google Antigravity：<https://antigravity.google/download>
- Cursor：<https://cursor.com/download>
- Kimi Work：<https://www.kimi.com/zh-cn/products/kimi-work>
- Kimi Windows rolling API：
  <https://appsupport.moonshot.cn/api/app/pkg/latest/windows/download>
- 中国千问 PC：
  <https://b.qianwen.com/apps/qkhomepage_twofoufeb/routes/l5Utxkrh6>
- 中国千问稳定下载重定向：
  <https://download.qianwen.com/download/qianwenpc?platform=pc&ch=pcqwen@default>
- Qoder CN 下载：<https://qoder.com.cn/download>
- Qoder CN 安装文档：
  <https://www.alibabacloud.com/help/en/lingma/qoder-cn/user-guide/installation-guide>
- Qoder CN 更新日志：
  <https://www.alibabacloud.com/help/en/lingma/qoder-cn-update-log>
- QoderWork 下载：<https://qoderwork.cn/download>
- QoderWork Windows 安装/更新/卸载：
  <https://www.alibabacloud.com/help/en/lingma/qoderwork-cn/windows-installation>
- 腾讯元宝：<https://yuanbao.tencent.com/evt/dl>

### 腾讯开发工具、QClaw、ima

- CodeBuddy 安装/更新：
  <https://www.codebuddy.ai/docs/ide/Getting-Started/Installation>
- CodeBuddy 官方更新 API：
  <https://www.codebuddy.ai/v2/update?platform=ide-win32-x64-user&version=1.0.0&x-machine-id=default>
- CodeBuddy 安装目录风险说明：
  <https://www.codebuddy.ai/docs/ide/Support/Troubleshooting>
- WorkBuddy Windows 指南：
  <https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Installation-Win-Guide>
- WorkBuddy 官方更新 API：
  <https://copilot.tencent.com/v2/update?platform=workbuddy-win32-x64-user>
- WorkBuddy 工作区说明：
  <https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/FQA>
- QClaw 官网：<https://qclaw.qq.com/>
- QClaw 官网使用的腾讯接口：<https://jprx.m.qq.com/data/4066/forward>
- ima 官网：<https://ima.qq.com/>
- ima 官网使用的 Rainbow 配置入口：
  <https://oi.rb.qq.com/config.v2.ConfigService/PullConfigReq>

### 本地模型、IDE、浏览器、Agent

- LM Studio 下载：<https://lmstudio.ai/download>
- LM Studio 更新/离线说明：<https://www.lmstudio.ai/docs/app/offline>
- LM Studio 模型与 preset：
  <https://lmstudio.ai/docs/app/basics/download-model>、
  <https://lmstudio.ai/docs/app/presets>
- GPT4All v3.10.0 Release：
  <https://github.com/nomic-ai/gpt4all/releases/tag/v3.10.0>
- GPT4All Qt IFW 配置：
  <https://github.com/nomic-ai/gpt4all/blob/main/gpt4all-chat/cmake/cpack_config.cmake>
- GPT4All 模型设置：<https://docs.gpt4all.io/gpt4all_desktop/settings.html>
- AnythingLLM Windows：
  <https://docs.anythingllm.com/installation-desktop/windows>
- AnythingLLM 更新、存储与卸载：
  <https://docs.anythingllm.com/installation-desktop/update>、
  <https://docs.anythingllm.com/installation-desktop/storage>、
  <https://docs.anythingllm.com/installation-desktop/uninstall>
- Kiro 安装/卸载/保留：
  <https://kiro.dev/docs/getting-started/installation/>
- Kiro 更新故障说明：<https://kiro.dev/docs/troubleshooting/>
- Comet 安装与更新：
  <https://www.perplexity.ai/help-center/comet/en/articles/11583748-installing-comet>
- Comet 本地数据删除：
  <https://www.perplexity.ai/help-center/comet/en/articles/12871737-self-serve-data-deletion>
- NVIDIA AI Workbench Desktop、Full Local、更新与卸载：
  <https://docs.nvidia.com/ai-workbench/user-guide/latest/install/desktop-app-install.html>、
  <https://docs.nvidia.com/ai-workbench/user-guide/latest/install/full-local-install.html>、
  <https://docs.nvidia.com/ai-workbench/user-guide/latest/install/update.html>、
  <https://docs.nvidia.com/ai-workbench/user-guide/latest/install/uninstall.html>
- OpenClaw Windows Hub Releases：
  <https://github.com/openclaw/openclaw-windows-node/releases>
- OpenClaw installer / Hub-Gateway 卸载选择：
  <https://github.com/openclaw/openclaw-windows-node/blob/main/installer.iss>
- Wispr Flow 下载、Windows 指南、卸载入口与 MDM：
  <https://wisprflow.ai/downloads>、
  <https://docs.wisprflow.ai/articles/2772472373-what-is-flow>、
  <https://docs.wisprflow.ai/articles/2809372297-what-to-do-if-the-app-doesn-t-start-up-after-signing-in-and-clicking-open-wispr-flow>、
  <https://docs.wisprflow.ai/articles/9363440133-deploy-wispr-flow-via-mdm>
- OpenCode v1.18.10 Release：
  <https://github.com/anomalyco/opencode/releases/tag/v1.18.10>
- OpenCode Desktop builder / updater：
  <https://github.com/anomalyco/opencode/blob/dev/packages/desktop/electron-builder.config.ts>、
  <https://github.com/anomalyco/opencode/blob/dev/packages/desktop/src/main/updater.ts>
- OpenCode Windows/WSL 数据边界：<https://opencode.ai/docs/windows-wsl/>

## 仓库证据边界

本文复用并汇总以下已经完成的一手来源研究：

- `docs/research/windows-desktop-certification-a-m-2026-08-01.md`
- `docs/research/windows-desktop-certification-n-z-2026-08-01.md`
- `docs/research/2026-08-01-openclaw-ima-windows-product-model.md`
- `docs/research/2026-08-03-wispr-flow-windows-managed-install.md`
- `docs/audits/2026-08-01-reviewed-windows-desktop-sources.md`

本次没有下载或执行新的第三方安装器。除 OpenClaw 本机现有官方包外，文中
产物身份沿用上述研究的只读验证记录。任何“可写入”都只是生命周期合同
资料充分，不是用户机器上的实际安装/升级/卸载验收。
