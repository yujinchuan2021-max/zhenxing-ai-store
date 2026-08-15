# Windows 桌面与 CLI/Agent 获取深查（draft87 / v2 active4）

仅候选、不可发布；只读研究。权威输入为 revision 87 / v2 active4（615 产品）。桌面全集 265 条，逐条保留唯一 productId；login-required 18 条按用户裁决单列 skipped，不深挖、不阻断。没有把命令、脚本或包管理器伪装成桌面一键下载。

## 全量断言

- coveredProductCount=265，uniqueProductIds=265，missing=0，duplicates=0。
- nonLoginRescanned=247，loginSkipped=18。
- 推荐策略计数：direct-artifact 104、vendor-bootstrap 5、download-page 133、login-required 18、store 1、manual-selector 3、no-windows 1。
- changedRecords=16，blockedNonLogin=137。完整逐项记录、证据、URL、host、版本标记和 blocker 在同名 JSON。

## 上一轮六项修正保留

上一轮要求不得遗漏的六项均在 changedRecords：alibaba-dingtalk-ai、spark-mail-windows、blender、meitu-ultra、portraitpro、raycast-windows。DingTalk/Spark 现在使用官方页面中实际发现的 EXE；Raycast 保留精确 Microsoft Store 协议入口；Meitu/PortraitPro 保持动态选择器，不伪造直链。

## 新发现的官方 Windows 安装资产

| productId | strategy | exact URL / asset | fileName | evidence |
|---|---|---|---|---|
| acdsee-photo-studio-ultimate | direct-artifact | https://dl.acdsystems.com/acdsee/en/acdsee-photo-studio-ultimate-2026-1-0-4501-win-en.exe | acdsee-photo-studio-ultimate-2026-1-0-4501-win-en.exe | https://www.acdsee.com/en/products/photo-studio-ultimate/ |
| alibaba-quark-ai-browser | direct-artifact | https://umcdn.quark.cn/download/37212/quarkpc/pcquark@store_guanwang/QuarkPC_V1.2.5.25_pc_pf30002_(zh-cn)_release_(Build1707620-240313220512-x64).exe | QuarkPC_V1.2.5.25_pc_pf30002_(zh-cn)_release_(Build1707620-240313220512-x64).exe | https://www.quark.cn/ |
| asana-work-graph | direct-artifact | https://desktop-downloads.asana.com/win32_x64/prod/latest/AsanaSetup.exe | AsanaSetup.exe | https://asana.com/download |
| deepchat-desktop | direct-artifact | https://github.com/ThinkInAIXYZ/deepchat/releases/download/v1.0.9/DeepChat-1.0.9-windows-x64.exe | DeepChat-1.0.9-windows-x64.exe | https://github.com/ThinkInAIXYZ/deepchat/releases/tag/v1.0.9 |
| dialpad-desktop | direct-artifact | https://download.dialpad.com/win32/x64/DialpadSetup_x64.exe | DialpadSetup_x64.exe | https://www.dialpad.com/download/ |
| evoto-desktop | direct-artifact | https://res.evoto.ai/package/7.3.0-502/Evoto_Setup_7.3.0-502.exe | Evoto_Setup_7.3.0-502.exe | https://www.evoto.ai/download |
| fiveire-desktop | direct-artifact | https://github.com/nanbingxyz/5ire/releases/download/v0.15.1/5ire-Setup-0.15.1.exe | 5ire-Setup-0.15.1.exe | https://github.com/nanbingxyz/5ire/releases/tag/v0.15.1 |
| mongodb-compass | direct-artifact | https://downloads.mongodb.com/compass/mongodb-compass-1.49.12-win32-x64.exe | mongodb-compass-1.49.12-win32-x64.exe | https://www.mongodb.com/try/download/compass |
| nous-hermes-desktop | direct-artifact | https://hermes-assets.nousresearch.com/Hermes-Setup.exe?build=3c27eb6234bf | Hermes-Setup.exe | https://hermes-agent.nousresearch.com/desktop |
| pinokio-ai-browser | direct-artifact | https://github.com/pinokiocomputer/pinokio/releases/download/v8.0.40/Pinokio.exe | Pinokio.exe | https://github.com/pinokiocomputer/pinokio/releases/tag/v8.0.40 |

### Hermes 红样本

Hermes 官网 Windows 卡片明确给出 Hermes-Setup.exe?build=3c27eb6234bf；HEAD=200、Content-Type=application/octet-stream、Content-Length=7,597,376。GitHub v2026.8.3 release 页面没有上传安装资产，因此桌面候选只采用官网 artifact。证据：[Hermes Desktop](https://hermes-agent.nousresearch.com/desktop)、[Hermes release](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.3)、[Windows native guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/windows-native.md)。

桌面模块仅消费该 EXE；不得把 install.ps1、hermes desktop、hermes update 当桌面下载。CLI/Agent 证据见下节。

## CLI/Agent managed-script 与 package-manager 候选（不授予执行权限）

| productId | strategy | fixed source | official command / package | dependencies & lifecycle |
|---|---|---|---|---|
| nous-hermes-agent | managed-script | https://hermes-agent.nousresearch.com/install.ps1 | iex (irm https://hermes-agent.nousresearch.com/install.ps1) | Windows 10/11；installer provisions uv/Python 3.11/Node 22/ripgrep/ffmpeg/PortableGit；检测 hermes --version/hermes doctor；更新 hermes update；卸载 hermes uninstall，--full 才清理数据。 |
| raycast-windows | package-manager alternate | https://www.raycast.com/windows | winget install raycast / packageId raycast | Store 仍是桌面 acquisition；WinGet 仅记录为外部替代流程。 |
| gitkraken-desktop | package-manager CLI-only | https://www.gitkraken.com/download | winget install gitkraken.cli / packageId gitkraken.cli | 官方命令目标为 CLI，不是桌面 GUI。 |
| sunlogin-windows | package-manager CLI-only | https://sunlogin.oray.com/download | npm install -g @aweray/awesun-cli / packageId @aweray/awesun-cli | 官方命令目标为 CLI，不是桌面 GUI。 |

Hermes CLI 的官方数据边界为 %LOCALAPPDATA%\\hermes 基础设施与 %USERPROFILE%\\.hermes 配置/认证/技能/会话；脚本候选必须交 CLI driver 审核，不能进入桌面 signed-catalog。

## 明确阻断与跳过

- login-required 18 条完整列在 JSON 的 skippedLoginProductIds，本轮不深挖、不阻断。
- download-page、manual-selector、no-windows 的非登录阻断共 137 条；下载页不等于直链，动态命令/需改脚本/无固定资产保持 blocked。
- bytedance-ui-tars-desktop 的 GitHub release 仅源码/无上传 Windows 安装资产，跳过纯源码构建。
- figma-design 页面抓到的是 Figma Agent 安装器，不足以证明 Figma 桌面 GUI 身份，保持 blocked。
- navicat-premium 官方 URL 301 到下载页，未确认最终文件名/Content-Disposition，保持 blocked。

## 研究门禁

- 仅使用厂商官网、官方文档、官方 GitHub Release/API；未下载大文件、未安装、未运行、未写 catalog/state。
- direct-artifact 必须同时有 HTTPS URL、Windows 文件名、artifactKind（exe/msi/msix/zip）和官方证据；源码 zip/tar、脚本、WinGet/npm 命令不得进入桌面 direct。
- JSON forbiddenFieldScan.found=[]；研究中的 officialInstallCommand 只供 CLI/Agent 评审，不能下发为后台执行字段。
