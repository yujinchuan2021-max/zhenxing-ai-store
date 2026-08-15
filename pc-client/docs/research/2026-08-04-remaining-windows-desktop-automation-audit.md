# 剩余 Windows 桌面产品自动化审计（2026-08-04）

## 结论

本次审计对象是 113 个 Windows Package Manager 配置发布后，目录中仍保留为 `desktop-official` 的 **123 个**产品。审计只找安全、可复核的自动化入口；没有修改客户端白名单、后台目录或安装代码，也没有封包。

| 分类 | 数量 | 当前动作 |
| --- | ---: | --- |
| 找到精确 WinGet 包 | 13 | 可以进入下一轮静态白名单评审；不得由后台填写 Package ID |
| 有公开稳定安装器或发布 API | 10 | 需要客户端固定的 EXE、NSIS 或便携包驱动及签名、检测、卸载收据 |
| Store、厂商启动器、账户、许可或企业交付 | 99 | 其中 Store 6、厂商启动器 18、其余官方页面/账户/企业交付 75；不能伪装成目标产品已安装 |
| 当前没有可用 Windows 产物 | 1 | 保留官方入口并修正说明，等待厂商恢复正式产物 |
| **合计** | **123** | 全部条目均已归类 |

这不是“123 个都已经一键安装”的结论。当前可立即进入代码评审的是 13 个精确 WinGet 映射；10 个公开产物仍需完成产物身份、安装收据、打开和卸载闭环。其余条目继续打开厂商入口是正确降级，直到产品身份和生命周期证据齐备。

## 方法与证据边界

1. 目录快照来自 `admin/data/catalog-v1.json`；以 `productType=desktop-official` 重新计数得到 123。
2. 候选基线来自 `output/catalog-research/winget-desktop-candidates.json`，但不采信相似名称分数本身。
3. 每个新增包均在本机实际 App Installer 中执行 `winget show --id <ID> --exact --source winget`，核对包名、发布者、主页和安装器来源。微软要求使用精确 ID 时可通过 `--id` 与 `--exact` 消除名称歧义；包清单还承载安装器 URL 与 SHA-256。[WinGet search](https://learn.microsoft.com/en-us/windows/package-manager/winget/search) · [WinGet show](https://learn.microsoft.com/en-us/windows/package-manager/winget/show) · [WinGet manifest](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest)
4. Store 条目使用固定 Product ID；本机 `msstore` 源能返回的条目用 `winget show --id <Store ID> --exact --source msstore` 复核。Store 可用性仍受地区、账户和系统组件影响。
5. GitHub 产品只采用厂商官方仓库和 Releases。存在 Release 页面不等于存在 Windows 安装产物；存在启动器也不等于目标产品已经安装。

## 1. 新发现的精确 WinGet 包（13）

| 目录产品 | 固定 Package ID | 本机核验结果 | 产品边界与一手证据 |
| --- | --- | --- | --- |
| `youdao-translate` | `Youdao.YoudaoTranslate` | 11.3.14.0；发布者“网易公司” | 包主页为有道，安装器来自有道静态域名；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/y/Youdao/YoudaoTranslate/11.3.14.0) · [有道下载](https://fanyi.youdao.com/download/) |
| `iflytek-listen` | `iFlytek.iFlyRecMeeting` | 3.0.2449；发布者“安徽听见科技有限公司” | 对应讯飞听见会议客户端；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/i/iFlytek/iFlyRecMeeting/3.0.2449) · [讯飞听见](https://www.iflyrec.com/html/iflyrecAssistant.html) |
| `iflytek-simultaneous` | `iFlytek.iFlyRecSI` | 5.1.6；发布者“安徽听见科技有限公司” | 对应讯飞听见同传，不是普通听见客户端；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/i/iFlytek/iFlyRecSI/5.1.6) · [讯飞同传](https://tongchuan.iflyrec.com/download.html) |
| `qihoo360-nami-ai-pc` | `360.NamiAI` | 1.3.1574.64；发布者“360安全中心” | 包主页和安装器均归属 360/纳米；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/3/360/NamiAI/1.3.1574.64) · [纳米 AI](https://www.n.cn/) |
| `qihoo360-safe-claw` | `360.NamiClaw` | 2.2.1140.64；发布者“360安全中心” | 对应 360 安全龙虾；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/3/360/NamiClaw/2.2.1140.64) · [360 安全龙虾](https://claw.360.cn/) |
| `meitu-ultra` | `Meitu.ColorByte` | 5.9.4；发布者 Meitu | 包主页为美图云修，产品 ID 与展示名不同但发布者、主页、安装器域名一致；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/m/Meitu/ColorByte/5.9.4) · [美图云修](https://ultra.meitu.com/download) |
| `citavi` | `Lumivero.Citavi.7` | 7.4.0.21；发布者 Lumivero, LLC | 当前主版本为 Citavi 7；不能继续选旧的 `Lumivero.Citavi.6`；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/l/Lumivero/Citavi/7/7.4.0.21) · [Citavi](https://www.citavi.com/download) |
| `snagit` | `TechSmith.Snagit.2026` | 26.2.2；发布者 TechSmith Corporation | 对应当前 2026 主版本；旧扫描首项 Snagit 2020 不可用；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/t/TechSmith/Snagit/2026/26.2.2) · [Snagit](https://www.techsmith.com/snagit/) |
| `sketchup` | `Trimble.SketchUp.2026` | 26.2.243；发布者 Trimble, Inc. | 对应当前 2026 产品；旧扫描首项 SketchUp 2022 不可用；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/t/Trimble/SketchUp/2026/26.2.243) · [SketchUp](https://sketchup.trimble.com/en/download/all) |
| `cisco-webex-ai-assistant` | `Cisco.Webex` | 46.7.0.35472；发布者 Cisco Systems, Inc | 安装的是 Webex 主客户端，AI Assistant 是客户端能力，不是独立包；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/c/Cisco/Webex/46.7.0.35472) · [Webex 下载](https://www.webex.com/downloads.html) |
| `unity-editor` | `Unity.Unity.6000` | 6000.5.4f1；发布者 Unity Technologies ApS | 精确对应 Unity 6 Editor；`UnityHub` 只能表示启动器，不能表示 Editor 已安装；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/u/Unity/Unity/6000/6000.5.4f1) · [Unity 下载](https://unity.com/download) |
| `spark-mail-windows` | `Readdle.Spark` | 3.30.4；发布者 Spark Mail Limited | 对应 Spark Desktop 邮件客户端，不是 Spark ODBC/Apache Spark；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/r/Readdle/Spark/3.30.4) · [Spark](https://sparkmailapp.com/download) |
| `genesys-cloud-cx` | `Genesys.GenesysCloud` | 2.51.916.0；发布者 Genesys Inc. | 对应 Genesys Cloud 桌面应用；Background Assistant 不是主客户端；[WinGet 清单](https://github.com/microsoft/winget-pkgs/tree/master/manifests/g/Genesys/GenesysCloud/2.51.916.0) · [官方桌面应用说明](https://help.genesys.cloud/articles/desktop-app/) |

### 接入前仍需处理

- `Snagit`、`SketchUp`、`Unity` 的包 ID 含产品代际。下一代包 ID 出现时必须重新评审，不能靠后台替换任意 ID。
- 这 13 项只能加入客户端静态表；后台只能选择已存在 profile。
- 自动安装仍使用交互式厂商安装器，许可协议、UAC、组件与目录由用户选择。
- 安装完成必须按精确包 ID、注册卸载项或主程序身份复检；不能用“命令退出 0”冒充完成。

## 2. 精确 Store Product ID（6）

这些是 Store 路由，不应混入普通 `winget` 社区源。应用商店不可用时复用现有“先提示关闭 VPN，再运行官方修复”的流程。

| 目录产品 | Store Product ID | 核验状态 |
| --- | --- | --- |
| `microsoft-copilot-desktop` | `XP9CXNGPPJ97XX` | [Microsoft 官方 Copilot 下载页](https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot)直接链接该 Store 产品；本机中国区 `msstore` 源未返回，必须保留地区不可用提示 |
| `raycast-windows` | `9PFXXSHC64H3` | 本机 `msstore` 精确返回 Raycast / Raycast Technologies Ltd.；[Store](https://apps.microsoft.com/detail/9PFXXSHC64H3) |
| `krisp-desktop` | `XP9D25XXG3SV5X` | 本机精确返回 Krisp 3.11.8 / Krisp Technologies, Inc；[Store](https://apps.microsoft.com/detail/XP9D25XXG3SV5X) |
| `voicemod-windows` | `XP9B0BH6T8Z7KZ` | 本机精确返回 Voicemod / Voicemod；[Store](https://apps.microsoft.com/detail/XP9B0BH6T8Z7KZ) |
| `canary-mail` | `9MT5MZ5H9WL6` | 本机精确返回 Canary Mail App / Cartasec Pte. Ltd.；[Store](https://apps.microsoft.com/detail/9MT5MZ5H9WL6) |
| `luminar-neo` | `9P7JQGL6GC8P` | 本机精确返回 Luminar Neo / Skylum Software USA, Inc.；[Store](https://apps.microsoft.com/detail/9P7JQGL6GC8P) |

`Spark` 和 `Snagit` 也存在 Store 条目，但普通 WinGet 源已有可识别版本和发布者的精确包，优先采用上节的 WinGet 路由，避免同一产品同时留下两套安装收据。

## 3. 有公开稳定安装器或发布 API（10）

| 目录产品 | 可复核产物 | 建议驱动与尚缺门槛 |
| --- | --- | --- |
| `msty-go` | 官网公开 Windows x64 稳定入口 `https://go-assets.msty.ai/app/latest/win/MstyGo_x64.exe`，页面标注 Go 0.14.0；[官方产品页](https://msty.ai/products/go/) | EXE 驱动；核验签名、最终 URL、注册项、主程序和卸载器 |
| `msty-nexus` | 官网公开 Windows x64 稳定入口 `https://nexus-assets.msty.ai/app/latest/win/Msty-Nexus_x64.exe`，页面标注 Nexus 0.3.0；[官方产品页](https://msty.ai/products/nexus/) | EXE 驱动；它与 Msty Studio/Go 是独立产品，不能复用 `CloudStack.Msty` 收据 |
| `stability-matrix` | [官方 v2.16.2 Release](https://github.com/LykosAI/StabilityMatrix/releases/tag/v2.16.2)提供 `StabilityMatrix-win-x64.zip` | 便携包驱动；解压目录、主程序和下游包数据必须独立记收据 |
| `intel-ai-playground` | [官方 v3.1.2 Beta HF3](https://github.com/intel/AI-Playground/releases/tag/v3.1.2-beta_hf3)提供 `AI-Playground-installer.exe` | EXE 驱动；必须在安装点击后检查受支持 Intel 硬件，并明确 Beta |
| `amd-gaia` | [官方 v0.22.0 Release](https://github.com/amd/gaia/releases/tag/v0.22.0)提供 `gaia-agent-ui-0.22.0-x64-setup.exe` 和 `latest.yml` | NSIS/Electron 驱动；安装前检查 Windows 11 和受支持 AMD 平台 |
| `goose-desktop` | [官方 v1.45.0 Release](https://github.com/aaif-goose/goose/releases/tag/v1.45.0)提供 `Goose-win32-x64.zip` | 便携包驱动；Desktop 与 CLI 收据分开，不能把 Pressly Goose 数据库工具当成目标 |
| `koboldcpp` | [官方 v1.118.1 Release](https://github.com/LostRuins/koboldcpp/releases/tag/v1.118.1)提供 `koboldcpp.exe`、no-CUDA 和 old-PC 变体 | 单文件便携驱动；按用户硬件选固定变体，模型文件不属于卸载范围 |
| `invokeai-community-edition` | [官方 Launcher v1.8.1](https://github.com/invoke-ai/launcher/releases/tag/v1.8.1)提供版本化 Setup 和 `latest.yml`；[官方下载](https://invoke.ai/download/) | 先管理 Launcher 收据，再由 Launcher 安装运行组件；不能把 Launcher 成功当成全部模型组件完成 |
| `letta-agent` | 官方文档公开稳定 x64 入口 `https://download.letta.com/windows/nsis/x64`；[Windows 桌面文档](https://docs.letta.com/platform/desktop-app) | NSIS 驱动；核验最终文件签名、包版本、账户登录与本地数据边界 |
| `rowboat-desktop` | [官方 v0.8.3 Release](https://github.com/rowboatlabs/rowboat/releases/tag/v0.8.3)提供 `Rowboat-win32-x64-0.8.3-setup.exe` | Squirrel/Setup 驱动；核验更新通道、主程序、注册项和卸载器 |

这 10 项是“下一轮可做产物审核”，不是“现在已经批准执行”。其中 Stability Matrix、Goose、KoboldCpp 需要便携包生命周期；InvokeAI 是“启动器管理运行组件”的两层生命周期。

## 4. 厂商启动器或版本/组件选择（18）

| 产品 | 正确边界 | 为什么不能直接把启动器算成目标已安装 |
| --- | --- | --- |
| `microsoft-visual-studio` | `Microsoft.VisualStudio.2022.Community` / `Professional` / `Enterprise` + 用户选择 workload | 目录产品没有指定授权版和工作负载；不能替用户默认选 Community，也不能把 Installer 本身算成 IDE |
| `unreal-engine` | `EpicGames.EpicGamesLauncher` 后由用户选择 Engine 版本和组件 | Launcher 与 Unreal Engine 是两份收据 |
| `adobe-photoshop`、`adobe-lightroom`、`adobe-premiere`、`adobe-illustrator` | 已纳管的 `Adobe.CreativeCloud` 启动器 + Adobe 账户/许可 | Creative Cloud 已安装不表示四个应用都已安装 |
| `autodesk-autocad`、`autodesk-revit` | `Autodesk.AutodeskAccess` + 账户、版本、许可和可选组件 | Autodesk Access、BCF 插件和 DWG TrueView 都不能冒充主产品 |
| `matlab`、`simulink` | MathWorks Installer + 账户、许可、release 和 toolbox 选择 | MATLAB Runtime/Connector 不是 MATLAB；Simulink 也不是独立通用安装包 |
| `nero-ai-photo-tagger`、`nero-ai-image-upscaler`、`nero-ai-video-upscaler` | `Nero.NeroCore`（Nero Start）后选择具体产品 | Nero Start/Burning ROM 不是三个 AI 产品 |
| `izotope-rx` | iZotope Product Portal 后选择 RX 版本和授权 | `iZotope.ProductPortal` 只是启动器 |
| `steinberg-spectralayers` | Steinberg Download Assistant + 账户/许可 | USB Driver 不是 SpectraLayers；当前 WinGet 无精确主产品包 |
| `siemens-designcenter-nx` | Siemens 账户交付和受许可版本 | 通用 Siemens 启动器或学生版不能表示企业 NX 已安装 |
| `dassault-solidworks-design` | SOLIDWORKS Installation Manager + serial/许可/组件 | `SystemDesignLoad` 等相似包不是 SOLIDWORKS |
| `ptc-creo` | PTC 账户交付、许可和所选 Creo 组件 | Creo View Express 只是查看器，不是 Creo / Creo+ |

这些产品可以先让 AI Hub 安装或打开“厂商启动器”，但 UI 必须显示“已安装启动器，仍需在厂商工具中选择并安装产品”，并继续单独检测目标主程序。

## 5. 仍由官方页面、账户或企业交付管理（75）

下列产品身份成立，但本轮没有同时获得“公开稳定版本解析 + 可验证发布者/安装器 + 确定的主程序/注册项 + 可恢复卸载”四项证据。常见原因是动态 bootstrapper、登录后下载、地区/硬件限制、付费版本选择、企业管理员分发，或高权限产品需要专门确认。继续保留官方入口，不生成任意下载/命令，是当前正确行为。

`baidu-ruliu`, `nvidia-broadcast`, `nvidia-canvas`, `pieces-for-developers`, `manus-desktop`, `genspark-claw`, `genspark-ai-browser`, `genspark-speakly`, `read-desktop`, `moises-live`, `lalalai-desktop`, `otter-desktop`, `fireflies-desktop`, `qihoo360-ai-browser`, `qihoo360-ai-office`, `qihoo360-agent-safe`, `iflytek-sparkdesk`, `laiye-worker`, `laiye-rpa`, `meitu-pc`, `yingdao-rpa`, `sunlogin-windows`, `ableton-live`, `uipath-studio`, `trimble-tekla-structures`, `davinci-resolve`, `clickup-brain-max`, `wolfram-mathematica`, `ansys-lumerical`, `siemens-rapidminer-ai-studio`, `siemens-eigen-engineering-agent`, `synopsys-verdi`, `neo4j-enterprise-studio`, `lovable-ai-app-builder`, `opera-neon`, `cyberlink-powerdirector`, `cyberlink-photodirector`, `on1-photo-raw`, `capture-one-pro`, `dxo-photolab`, `capacities-desktop`, `dropbox-dash`, `tana-outliner`, `heptabase-desktop`, `vegas-pro`, `zoner-studio`, `mylio-photos`, `tldv-desktop`, `aftershoot`, `evoto-desktop`, `maxqda-desktop`, `nvivo`, `atlas-ti`, `dbeaver-pro`, `alteryx-designer`, `hitpaw-vikpea`, `hitpaw-fotorpea`, `hitpaw-voicepea`, `hitpaw-edimakor`, `portraitpro`, `supernormal-desktop`, `meetgeek-desktop`, `open-interpreter-desktop`, `graphisoft-archicad`, `vectorworks-design-suite`, `ilastik-desktop`, `octave-bricscad`, `screenpipe-desktop`, `voice-ai-windows`, `finevoice-desktop`, `coreldraw-graphics-suite`, `paintshop-pro`, `sider-windows`, `skales-desktop`, `allplan`。

代表性的一手交付边界：

- NVIDIA Broadcast 与 Canvas 需要受支持 RTX 硬件和驱动，不应在浏览目录时探测：[Broadcast](https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app/) · [Canvas](https://www.nvidia.com/en-us/studio/canvas.html)
- DaVinci Resolve 下载需要用户在 Blackmagic 官方页面选择版本并提交信息：[DaVinci Resolve](https://www.blackmagicdesign.com/products/davinciresolve)
- 企业工程产品由账户、许可和管理员交付：[Tekla Structures](https://download.trimble.com/tekla-structures/for-businesses) · [Ansys Lumerical](https://www.ansys.com/products/optics) · [Synopsys Verdi](https://www.synopsys.com/verification/debug/verdi.html) · [ALLPLAN](https://www.allplan.com/products/allplan/)
- DBeaver PRO 是产品族/商业版本入口；WinGet 的 Community、Lite、Enterprise 是不同 SKU，不能默认替用户选 Enterprise：[DBeaver PRO](https://dbeaver.com/download/)
- 屏幕录制、远控、RPA 与本地 Agent（如 screenpipe、向日葵、来也、影刀、Open Interpreter）需要产品专属权限提示和安装收据，不能仅因存在下载页就走通用静默安装。

## 6. 当前没有可用 Windows 产物（1）

| 产品 | 证据 | 处理 |
| --- | --- | --- |
| `nous-hermes-desktop` | [Nous Research 官方最新 Release v2026.8.3](https://github.com/nousresearch/hermes-agent/releases/tag/v2026.8.3)当前没有发布资产；WinGet 中 `fathah.HermesDesktop` 和 `EKKOLearnAI.HermesStudio` 均不是 Nous Research 产品 | 保留官网/源码说明，但取消“可直接下载 Windows 安装器”的暗示；厂商重新发布正式 Windows 资产后再审计 |

## 7. 明确排除的误匹配

| 目标产品 | 不可采用的候选 | 原因 |
| --- | --- | --- |
| Microsoft Copilot | `Microsoft.365Copilot` | 两个独立产品 |
| Visual Studio | `Microsoft.VSDotNetLogCollect`、VSTO Runtime | 辅助工具，不是 IDE；真实 IDE 还要选择授权版 |
| Hermes Desktop | `fathah.HermesDesktop`、`EKKOLearnAI.HermesStudio` | 第三方同名项目，与 Nous Research 无关 |
| Msty Go / Nexus | `CloudStack.Msty` | 这是 Msty Studio；Go 和 Nexus 各有独立官方安装器 |
| Otter | `OtterBrowserTeam.OtterBrowser` | 同名浏览器，不是 Otter.ai |
| Ableton Live | `Ableton.AbletonLive10Suite` | 历史 Live 10，不是当前通用产品 |
| DaVinci Resolve | DaVinci Resolve RPC | 第三方 RPC 工具 |
| MATLAB | MATLAB Connector / Runtime | 连接器和运行时都不是主产品 |
| ClickUp Brain MAX | `ClickUp.ClickUp` | 普通 ClickUp 客户端不是 Brain MAX |
| Dropbox Dash | `Dropbox.Dropbox` | 同步客户端不是 Dash |
| DBeaver PRO | DBeaver Community | 不同授权版；Enterprise 也需先明确 SKU |
| Neo4j Enterprise Studio | Neo4j Desktop | 不同产品 |
| Opera Neon | Opera Stable | 不同浏览器产品 |
| iZotope RX | iZotope Product Portal | 启动器，不是 RX |
| Octave BricsCAD | GNU Octave | 不同厂商、不同产品 |

## 8. 发现流程需要修正的地方

旧脚本主要有两个漏报源：

1. 中文产品使用 `winget search --name` 时容易没有结果，但按发布者、官网名称或精确 ID 可以找到真实包；本轮漏掉的有道、讯飞、360 和美图均属此类。
2. 只检查第一候选会把旧年度包、同名软件或启动器放在真实目标之前。以后候选生成应保留多个结果，并逐个执行 `winget show --id ... --exact`；最终仍由人工/AI 对照厂商、主页和产品边界后写入客户端静态表。

建议把这两项加入目录审计脚本的回归样例，但本次只记录结论，没有修改脚本。
