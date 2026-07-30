# Windows 桌面应用官方分发来源调查

调查日期：2026-07-31（Asia/Shanghai）

范围：ChatGPT Desktop for Windows、Claude Desktop for Windows、Codex desktop/app for Windows。

## 方法与证据边界

- 只采用 OpenAI、Anthropic/Claude、Microsoft 官方页面、官方 CDN/下载响应和 Microsoft Store 官方目录响应。
- “官方发布者”分成两层记录：
  - 商店目录发布者：Microsoft Store 目录中的 `PublisherName` / `DeveloperName`。
  - 文件数字签名者：从官方入口当日取得的安装文件，经 Windows `Get-AuthenticodeSignature` 读取。
- 当日 HTTP 与签名观测是时间点证据。证书、安装器哈希、版本和重定向目标都会更新，不应作为永久常量。
- Microsoft Store 目录响应 URL 是 Microsoft 第一方端点，但不是本文确认过的公共稳定 API 合约；适合核查，不应直接作为 AI Hub 的长期生产依赖。

## 结论摘要

| 产品 | Windows 版 | 当前官方分发 | 版本/固定文件名 | 签名发布者证据 | 对 AI Hub 的适配结论 |
|---|---|---|---|---|---|
| ChatGPT Desktop（新的统一应用） | 有 | OpenAI 下载页指向 Microsoft 的 Store Installer 下载服务；Store 产品 ID `9PLM9XGG6VKS` | 响应文件名固定为 `ChatGPT Installer.exe`；Store 展示目录 `Version` 为空，但 Microsoft Display Catalog 可取得当前 MSIX 完整包名、版本和 SHA-256；不提供 payload URI | 当日取得的引导器签名有效，签名者为 `Microsoft Corporation`；Store 目录发布者为 `OpenAI` | 不适合作为“由 AI Hub 托管完整 ChatGPT 安装包”。可条件性托管/下载 Microsoft Store 引导器并验证 Microsoft 签名后打开，但更稳妥的是直接打开官方入口或 Store 产品页 |
| ChatGPT Classic（旧应用） | 有，仍受支持 | Microsoft Store 产品 ID `9NT1R1C2HH7J`；官方页面仍提供 Classic 下载 | `ChatGPT Classic Installer.exe`；同样不暴露目标应用版本 | 引导器签名者为 `Microsoft Corporation`；Store 目录发布者为 `OpenAI` | 与新应用相同：适合“打开官方 Store 安装入口”，不适合托管完整应用包 |
| Claude Desktop | 有（x64、arm64） | Anthropic 官方 `latest/redirect` 307 到 `downloads.claude.ai` 的版本化 `.exe`；Team/Enterprise 另有完整 `.msix` | 版本位于最终 URL 路径；当日为 `1.24012.9`。下载响应文件名分别为 `Claude Setup.exe`、`Claude.msix`；MSIX manifest 版本为 `1.24012.9.0` | 当日 x64 EXE Authenticode 及 x64 MSIX manifest/signature 均确认发布者为 `Anthropic, PBC` | 三者中唯一能从官方入口取得完整、版本化、一方载荷并做包级验签者。普通用户可用 EXE；若产品允许完整包托管，MSIX 的版本/架构/签名可验证性最强，但应遵守 Team/Enterprise 部署语境 |
| Codex desktop/app | 有，但当前已迁移进新的 ChatGPT 桌面应用 | 旧 Codex 应用正常更新后变成新的 ChatGPT 应用；当前 Windows 下载归于产品 ID `9PLM9XGG6VKS` | 没有再确认到独立、版本化的 Codex Windows 安装包；Store 目录当前标题为 `ChatGPT`，包族仍为 `OpenAI.Codex_2p2nqsd0c76g0` | 与新的 ChatGPT Store 引导器相同：文件签名者为 `Microsoft Corporation`，商店发布者为 `OpenAI` | 不应再为 Codex 建一套独立托管下载配置；Codex 产品入口应复用新的 ChatGPT 安装入口，并明确它是 ChatGPT 内的 Codex 模式 |

## 1. ChatGPT Desktop for Windows

### 1.1 Windows 版及当前产品关系

OpenAI 官方帮助中心确认 ChatGPT Windows 应用存在，并说明它通过 Microsoft Store 分发：

- https://help.openai.com/en/articles/9982051-using-the-chatgpt-windows-app

OpenAI 当前 Windows 文档把新统一应用的命令行安装方式明确为：

```text
winget install --id 9PLM9XGG6VKS -s msstore
```

来源：

- https://learn.chatgpt.com/docs/windows/windows-app

2026-07-31 当前的 OpenAI 官方下载页把桌面产品描述为包含 ChatGPT Work 和 Codex 的统一应用；Windows 按钮指向 Microsoft 下载服务：

- 页面：https://chatgpt.com/download/
- 新应用 Windows 入口：https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi
- ChatGPT Classic Windows 入口：https://get.microsoft.com/installer/download/9NT1R1C2HH7J?cid=website_cta_psi

OpenAI 官方迁移说明确认：

- 新 ChatGPT 桌面应用在 macOS 和 Windows 上包含 Chat、Work 与 Codex。
- 现有 Codex app 更新后会变成新的 ChatGPT 桌面应用。
- 旧 ChatGPT 桌面应用显示为 `ChatGPT Classic`，目前仍继续获得模型更新、缺陷修复、安全补丁和既有 Enterprise 能力支持。

来源：

- https://help.openai.com/en/articles/20001276

### 1.2 分发形式

新应用与 Classic 的官方下载不是 OpenAI 托管的完整 EXE/MSIX 直链，而是 Microsoft `get.microsoft.com/installer/download/{ProductId}` 服务返回的小型 Microsoft Store Installer 引导器。

2026-07-31 当日响应：

- 新应用：
  - Product ID：`9PLM9XGG6VKS`
  - `Content-Disposition`：`ChatGPT Installer.exe`
  - `Content-Length`：`1,462,848`
  - `Cache-Control`：短期缓存
- Classic：
  - Product ID：`9NT1R1C2HH7J`
  - `Content-Disposition`：`ChatGPT Classic Installer.exe`
  - `Content-Length`：`1,462,848`

Microsoft 官方文档建议用 Store Product ID 打开产品详情页，也可使用：

```text
ms-windows-store://pdp/?ProductId=9PLM9XGG6VKS
ms-windows-store://pdp/?ProductId=9NT1R1C2HH7J
```

来源：

- https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-store-app
- https://apps.microsoft.com/detail/9PLM9XGG6VKS
- https://apps.microsoft.com/detail/9NT1R1C2HH7J

### 1.3 文件名、版本与目录元数据

Microsoft Store 官方目录的当日响应显示：

新统一应用：

- `ProductId`: `9PLM9XGG6VKS`
- `Title`: `ChatGPT`
- `PublisherName` / `DeveloperName`: `OpenAI`
- `PackageFamilyNames`: `OpenAI.Codex_2p2nqsd0c76g0`
- `Installer.Type`: `WindowsUpdate`
- `Platforms`: `ARM64`, `x64`
- `LastUpdateDateUtc`: `2026-07-29T07:27:06Z`
- `RevisionId`: `2026-07-29T07:27:23.9678893Z`
- `Version`: 空字符串

ChatGPT Classic：

- `ProductId`: `9NT1R1C2HH7J`
- `Title`: `ChatGPT Classic`
- `PublisherName` / `DeveloperName`: `OpenAI`
- `PackageFamilyNames`: `OpenAI.ChatGPT-Desktop_2p2nqsd0c76g0`
- `Installer.Type`: `WindowsUpdate`
- `Platforms`: `ARM64`, `x64`
- `LastUpdateDateUtc`: `2026-07-13T16:36:44Z`
- `RevisionId`: `2026-07-13T16:36:57.2254218Z`
- `Version`: 空字符串

核查 URL：

- https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/9PLM9XGG6VKS?market=US&locale=en-US&deviceFamily=Windows.Desktop
- https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/9NT1R1C2HH7J?market=US&locale=en-US&deviceFamily=Windows.Desktop

Microsoft 另一第一方目录端点（Display Catalog）可进一步给出当前包级元数据：

- `PackageIdentityName`: `OpenAI.Codex`
- `PublisherCertificateName`: `CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B`
- arm64 完整包名：`OpenAI.Codex_26.721.11231.0_arm64__2p2nqsd0c76g0`
- arm64 SHA-256：`447385a011b58156d5212bdb75a2f6b9179321f83369528f911b85a2d631679d`
- x64 完整包名：`OpenAI.Codex_26.721.11231.0_x64__2p2nqsd0c76g0`
- x64 SHA-256：`24bd705ac12829ef0f4eb79e6c4484218297f330b2c8346796be6029cd875737`
- `PackageDownloadUris`: `null`

核查 URL：

- https://displaycatalog.mp.microsoft.com/v7.0/products/9PLM9XGG6VKS?market=US&languages=en-US&MS-CV=DGU1mcuYo0WMMp

ChatGPT Classic 的同类目录当日给出：

- 当前 bundle：`OpenAI.ChatGPT-Desktop_2026.709.1617.0_neutral_~_2p2nqsd0c76g0`
- SHA-256：`015befb771873386043fb611baa8dcb8657282b68beaba38c0fa2bd4931e7ccb`
- `PackageDownloadUris`: `null`

核查 URL：

- https://displaycatalog.mp.microsoft.com/v7.0/products/9NT1R1C2HH7J?market=US&languages=en-US&MS-CV=DGU1mcuYo0WMMp

结论：

- 可以获得固定的 Product ID、包族名、更新日期和目录修订时间。
- 可以从下载响应获得稳定的用户可见引导器文件名。
- 基础 Store 展示目录的 `Version` 为空；Display Catalog 则可以从包完整名取得当前四段版本，并取得架构与 SHA-256。
- Display Catalog 当日不返回 `PackageDownloadUris`，因此“有版本和哈希元数据”不等于“有可供 AI Hub 托管的公开稳定完整包 URL”。
- 引导器本身的 `FileVersion`（当日为 `22607.722.4.0`）是 Microsoft Store Installer 的版本，不是 ChatGPT/Codex 产品版本。

### 1.4 签名发布者

从以上两个官方 `get.microsoft.com` 入口取得的 EXE，当日 Windows 验签均为 `Valid`：

```text
Subject: CN=Microsoft Corporation, O=Microsoft Corporation,
         L=Redmond, S=Washington, C=US
Issuer:  CN=Microsoft Marketplace CA G 024, OU=AOC,
         O=Microsoft Corporation, L=Redmond, S=Washington, C=US
ProductName: Store Installer
```

这证明下载到的是 Microsoft 签名的 Store 引导器，不代表该 EXE 由 OpenAI 直接签名。OpenAI 身份来自 Microsoft Store 目录中的 `PublisherName: OpenAI` 及对应的 Product ID。

Microsoft 官方说明，Store 分发的 MSIX 会由 Microsoft Store 自动重签；因此“磁盘文件签名者”和“商店目录发布者”本来就可能不是同一个主体：

- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview

签名证书指纹会随证书轮换，不应作为长期唯一白名单。若 AI Hub 下载 Store Installer，应验证：

1. HTTPS 主机必须是 `get.microsoft.com`；
2. 路径中的 Product ID 必须是审核过的固定值；
3. Authenticode 状态有效；
4. 签名主体为 Microsoft Corporation，证书链可信；
5. 再打开引导器，让 Microsoft Store 完成目标应用获取与安装。

### 1.5 AI Hub 适配判断

推荐模式：`officialStore` / `externalInstaller`，而不是“完整安装包托管”。

- 最简单且边界最清楚：打开 OpenAI 官方下载页、`get.microsoft.com` 官方入口，或 `ms-windows-store://pdp/?ProductId=...`。
- 也可按 OpenAI 官方文档调用 `winget install --id 9PLM9XGG6VKS -s msstore`；这仍是 Store 分发，不是 AI Hub 托管完整载荷。
- 若产品必须展示下载进度，可以下载约 1.46 MB 的 Store Installer 引导器、验证 Microsoft 签名后打开；但 AI Hub 并没有下载或固定最终 ChatGPT MSIX，也拿不到目标版本。
- 不建议把该引导器宣传为“ChatGPT 安装包已由 AI Hub 托管并验签”。准确描述应是“已验证并打开 Microsoft Store 官方安装引导器”。

## 2. Claude Desktop for Windows

### 2.1 Windows 版

Anthropic 官方帮助中心确认 Claude Desktop 支持 Windows 10 或更高版本；官方下载页同时提供 Windows x64 与 Windows arm64：

- https://support.claude.com/en/articles/10065433-install-claude-desktop
- https://claude.com/download

Claude Code 官方文档也确认 Windows 桌面版可使用 EXE 或 MSIX：

- https://code.claude.com/docs/en/desktop

### 2.2 普通用户 EXE 分发

官方下载页的 Windows 按钮使用稳定的 `latest/redirect`：

- x64：https://claude.ai/api/desktop/win32/x64/exe/latest/redirect
- arm64：https://claude.ai/api/desktop/win32/arm64/exe/latest/redirect

2026-07-31 当日两个入口都返回 `307 Temporary Redirect`，指向版本化且带构建哈希的 Anthropic CDN URL：

```text
https://downloads.claude.ai/releases/win32/x64/1.24012.9/Claude-03c61d06f8e01a4db2273b9514e225f21d2ba62e.exe
https://downloads.claude.ai/releases/win32/arm64/1.24012.9/Claude-03c61d06f8e01a4db2273b9514e225f21d2ba62e.exe
```

x64 最终对象当日响应：

- `Content-Disposition`: `attachment; filename="Claude Setup.exe"`
- `Content-Length`: `229,010,080`
- `Cache-Control`: `public,max-age=3600,immutable`
- URL 路径版本：`1.24012.9`
- ETag：存在
- MD5/CRC32C 对象元数据：存在

结论：

- `latest/redirect` 是稳定入口，但目标随发布更新，不是稳定二进制直链。
- 解析后的版本化 CDN URL标记为 `immutable`，适合一次发布任务内固定并下载。
- 用户可见文件名固定为 `Claude Setup.exe`；CDN 对象名带构建哈希。
- **没有从本次第一方来源确认一个独立、公开且有兼容承诺的 JSON 版本清单 API**。可用的语义版本来自重定向目标路径。

### 2.3 企业 MSIX 分发

Anthropic 面向 Team/Enterprise 管理员提供 x64 和 arm64 MSIX，用于 Intune、SCCM、Group Policy 或 PowerShell 部署：

- 部署说明：https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows
- x64：https://claude.ai/api/desktop/win32/x64/msix/latest/redirect
- arm64：https://claude.ai/api/desktop/win32/arm64/msix/latest/redirect

当日重定向目标：

```text
https://downloads.claude.ai/releases/win32/x64/1.24012.9/Claude-03c61d06f8e01a4db2273b9514e225f21d2ba62e.msix
https://downloads.claude.ai/releases/win32/arm64/1.24012.9/Claude-03c61d06f8e01a4db2273b9514e225f21d2ba62e.msix
```

x64 最终对象当日响应：

- `Content-Disposition`: `attachment; filename=Claude.msix`
- `Content-Length`: `258,383,876`
- `Cache-Control`: `public,max-age=3600,immutable`
- URL 路径版本：`1.24012.9`

官方特别说明：

- MSIX 是每用户应用。
- 单用户可用 `Add-AppxPackage`。
- 全机预配用 `Add-AppxProvisionedPackage`。
- 默认应用约每四小时自行检查更新；若 MDM 管理版本，应设置 `disableAutoUpdates=1`。

因此普通消费者的一键安装优先使用 EXE；MSIX 入口应标为 Team/Enterprise 管理部署，而不是无条件替代普通安装器。

### 2.4 签名发布者

从官方 x64 EXE latest 入口解析并下载的 `1.24012.9` 文件，当日 Windows Authenticode 验签为 `Valid`：

```text
Subject: CN="Anthropic, PBC", O="Anthropic, PBC",
         L=San Francisco, S=California, C=US,
         SERIALNUMBER=4860621, ...
Issuer:  CN=DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1,
         O="DigiCert, Inc.", C=US
SHA-256: ED778E4EB71AA7231B28182B457C42DECE4416028C7EF6E18A3A0591F94D44EB
```

上述 SHA-256 仅是 `1.24012.9` x64 EXE 的当日证据，不应作为 `latest` 永久值。

从上述官方 x64 MSIX 的 `AppxManifest.xml` 与 `AppxSignature.p7x` 当日核查得到：

```text
Identity Name: Claude
Identity Version: 1.24012.9.0
Publisher / PublisherDisplayName: Anthropic, PBC
Signature leaf subject: CN="Anthropic, PBC", O="Anthropic, PBC",
                        L=San Francisco, S=California, C=US,
                        SERIALNUMBER=4860621, ...
Signature issuer: DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1
```

因此 Claude MSIX 的包身份、版本、架构和发布者签名都能从官方完整载荷校验。若 AI Hub 将来支持企业 MSIX，仍必须在每次下载时实际校验 MSIX 签名、manifest Identity/Publisher、架构与版本，不能只相信重定向 URL 或历史结果。

### 2.5 AI Hub 适配判断

Claude EXE 与完整 MSIX 都技术上满足“托管下载 + 签名校验 + 打开安装器”。其中 MSIX 的包级版本、架构和签名可验证性更强：

1. 请求审核过的 `latest/redirect`；
2. 只允许重定向到 `downloads.claude.ai`；
3. 从版本化目标路径提取版本；
4. 下载到临时位置；
5. EXE 验证 Authenticode；MSIX 验证 `AppxSignature.p7x`、manifest Identity/Publisher、版本与架构；发布者主体必须为 `Anthropic, PBC`；
6. 可选记录当前文件 SHA-256 作审计证据，但不作为跨版本白名单；
7. 验签成功后由用户明确点击打开安装器。

风险与限制：

- `latest` 是可变入口，必须在每次下载后重新验签。
- 不应永久固定证书 thumbprint；证书会续期/轮换。
- 完整 EXE/MSIX 较大，AI Hub 必须有断点、取消、临时文件清理和下载失败反馈。
- 若产品政策要求图形应用只打开官方入口，则即使技术上可托管，也应采用 `externalOfficialDownload`；本节只判断技术可行性。

## 3. Codex desktop/app for Windows

### 3.1 Windows 版与迁移状态

OpenAI 官方发布文在 2026-03-04 更新中明确写明 Codex app 已可用于 Windows：

- https://openai.com/index/introducing-the-codex-app/

但截至 2026-07-31，OpenAI 已把独立 Codex app 迁入新的 ChatGPT 桌面应用：

- https://help.openai.com/en/articles/20001276
- https://help.openai.com/en/articles/11369540-using-codex-with-chatgpt
- https://chatgpt.com/download/

官方迁移说明的关键事实：

- 现有 Codex app 正常更新后变成新的 ChatGPT app。
- Codex 成为新 ChatGPT 桌面应用内的独立视图/模式。
- 新用户应下载 ChatGPT 桌面应用。

### 3.2 当前 Windows 分发与元数据

当前官方下载复用新的 ChatGPT Windows 入口：

- https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi
- https://apps.microsoft.com/detail/9PLM9XGG6VKS

Microsoft Store 目录当日状态很能说明迁移：

- `Title`: `ChatGPT`
- `PackageFamilyNames`: `OpenAI.Codex_2p2nqsd0c76g0`
- `PublisherName`: `OpenAI`
- Display Catalog 当前包版本：`26.721.11231.0`
- `ReleaseDateUtc`: `2026-03-04T14:00:00Z`
- `LastUpdateDateUtc`: `2026-07-29T07:27:06Z`
- 基础展示目录 `Version`: 空字符串；Display Catalog 有包版本和 SHA-256，但无 payload URI

核查 URL：

- https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/9PLM9XGG6VKS?market=US&locale=en-US&deviceFamily=Windows.Desktop

因此：

- Windows 版已确认。
- 仍可看到 Codex 历史包族身份，但当前商店标题和官方下载名已经是 ChatGPT。
- **没有确认到一个仍面向新用户发布的、独立于 ChatGPT 的 Codex Windows 安装包 URL。**
- 文件名、版本、签名证据与第 1 节新的 ChatGPT 应用完全相同。

### 3.3 AI Hub 适配判断

- 后台产品层可保留“Codex”作为可发现产品/能力入口。
- 安装资源不应再维护独立 Codex 下载器；应引用新的 ChatGPT Desktop 官方安装配置 `9PLM9XGG6VKS`。
- UI 文案应明确：“安装 ChatGPT 桌面应用并使用其中的 Codex 模式。”
- 不应把旧的 `Codex (Beta)` 商店搜索结果或历史 Product ID 当作当前正式入口，除非 OpenAI 官方页面再次明确链接到它。

## 推荐给 AI Hub 的审核配置

### OpenAI 新统一桌面应用（ChatGPT + Codex）

```yaml
distribution: microsoft-store-installer
officialPage: https://chatgpt.com/download/
downloadUrl: https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi
storeProductId: 9PLM9XGG6VKS
expectedBootstrapperFilename: ChatGPT Installer.exe
expectedBootstrapperSignerSubject: Microsoft Corporation
catalogPublisher: OpenAI
packageFamilyName: OpenAI.Codex_2p2nqsd0c76g0
targetVersionMetadata: display-catalog-only
targetPayloadUri: unavailable
preferredAction: open-official-store-installer
```

### ChatGPT Classic

```yaml
distribution: microsoft-store-installer
officialPage: https://chatgpt.com/download/
downloadUrl: https://get.microsoft.com/installer/download/9NT1R1C2HH7J?cid=website_cta_psi
storeProductId: 9NT1R1C2HH7J
expectedBootstrapperFilename: ChatGPT Classic Installer.exe
expectedBootstrapperSignerSubject: Microsoft Corporation
catalogPublisher: OpenAI
packageFamilyName: OpenAI.ChatGPT-Desktop_2p2nqsd0c76g0
targetVersionMetadata: display-catalog-only
targetPayloadUri: unavailable
preferredAction: open-official-store-installer
```

### Claude Desktop 普通用户版

```yaml
distribution: vendor-latest-redirect
x64ExeUrl: https://claude.ai/api/desktop/win32/x64/exe/latest/redirect
arm64ExeUrl: https://claude.ai/api/desktop/win32/arm64/exe/latest/redirect
x64MsixUrl: https://claude.ai/api/desktop/win32/x64/msix/latest/redirect
arm64MsixUrl: https://claude.ai/api/desktop/win32/arm64/msix/latest/redirect
allowedRedirectHost: downloads.claude.ai
expectedExeFilename: Claude Setup.exe
expectedMsixFilename: Claude.msix
expectedSignerOrganization: Anthropic, PBC
versionSource: resolved-url-path
preferredAction: download-verify-open
```

最终是否启用 Claude 的托管下载，还需服从 AI Hub 已确定的“图形产品只打开厂商官方下载”的产品政策；本调查没有修改该政策。
