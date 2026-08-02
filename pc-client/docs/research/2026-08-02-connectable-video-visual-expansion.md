# 枕星 AI：AI 可接入厂商扩充研究（视频、视觉创作与 3D 设计）

- 日期：2026-08-02
- 状态：研究完成，未修改代码、目录 JSON、白名单或安装模块
- 范围：Windows 产品及其可被 AI 客户端调用的真实 MCP、插件或连接器
- 证据标准：只采用厂商官方文档、官方仓库，或集成项目自身源码仓库；社区项目必须明确标注“非官方”

## 结论

建议下一批处理 5 个产品关系：

| 厂商 / 产品 | 用途类别 | 接入资源 | 官方性 | 建议级别 |
| --- | --- | --- | --- | --- |
| Adobe / Adobe for creativity | 图像、设计、视频格式化、创意工作流 | Adobe for creativity connector / plugin / skills | 官方 | 优先接入；只打开官方连接流程 |
| Autodesk / Autodesk Fusion | 3D、CAD、制造设计 | Fusion MCP + Fusion Data MCP | 官方 | 优先接入；本地 MCP 需商业订阅核验 |
| Trimble / SketchUp | 3D 建模、建筑与空间设计 | SketchUp Connector for Claude | 官方 | 优先接入；当前仅支持 Claude |
| Blackmagic Design / DaVinci Resolve | 视频剪辑、调色、音频、VFX | `samuelgursky/davinci-resolve-mcp` | 社区、非官方 | 审核后试点；先支持 Studio 本地模式 |
| Canva / Affinity | 图像、矢量、排版、批量视觉处理 | Affinity AI Connector with Claude | 官方 | 先展示说明；等待完整安装与撤销文档后再自动化 |

目录去重结果：当前 `pc-client` 未发现 Adobe for creativity、Autodesk Fusion、SketchUp Connector、Blackmagic Design / DaVinci Resolve 或 Affinity AI Connector 的现有记录。Canva 厂商已经存在，所以 Affinity 必须作为现有 Canva 厂商下的新产品/连接资源，不得重复创建 Canva 厂商。

OBS Studio 与 Blender 已由同批文档 [`2026-08-02-connectable-audio-game-expansion.md`](./2026-08-02-connectable-audio-game-expansion.md) 覆盖，本报告不重复计入候选数量。剪映/CapCut、Canva 本体、Figma、Unity 已在现有目录中，也不重复创建厂商。

## 1. Adobe / Adobe for creativity

- **vendor**：Adobe
- **product**：Adobe for creativity
- **用途类别**：图像编辑、矢量、模板设计、视频裁切与尺寸适配、素材搜索和 Creative Cloud 创意工作流
- **Windows 入口**：Claude Desktop（Windows）、Claude Web；Cowork 也支持 Windows，但要求 Claude 付费计划。官方最低系统要求为 Windows 10，浏览器要求 Chrome/Edge 143 或更高版本。
- **接入资源名称/类型**：官方 `Adobe for creativity` Connector；可选官方 Plugin 与 Skills
- **支持的 AI 客户端**：当前一手文档只确认 Claude Web、Claude Desktop、Cowork。不得在目录中写成支持 Codex、ChatGPT、Cursor 或任意 MCP 客户端。
- **安装方式**：在 Claude 的 `Customize -> Connectors` 中搜索 `Adobe for creativity` 并确认连接；可选安装同名 Plugin。枕星 AI 只应打开官方连接入口/说明，不下载本地包、不代填 Adobe 凭据，也不伪装成客户端本地一键安装。
- **安全权限**：连接后可调用 Photoshop、Lightroom、Illustrator、Firefly、Premiere、Express、InDesign、Stock 等 50+ 工具；素材会通过 Claude/Adobe 云服务处理，登录 Adobe 后还可使用 Creative Cloud 存储。首次连接必须说明“将选择的文件发送到第三方云服务”，按文件显式选择；Adobe/Claude 登录与组织管理员授权由用户完成。
- **卸载方式**：在 Claude 中断开 Connector、卸载 Plugin/Skills；如用户要求，再在 Adobe 账号中撤销授权。不得卸载任何 Adobe 桌面软件，也不得删除 Creative Cloud 资产。
- **官方/社区属性**：Adobe 官方连接器；AdobeDocs 仓库为官方文档仓库，不代表连接器代码已公开供本地重打包。
- **维护证据**：Adobe 于 2026-04-28 正式发布，官方文档明确称连接器可用且生产就绪；官方文档仓库持续更新。
- **logoSource**：[Adobe Legal - Copyright, Trademark and DMCA permissions](https://www.adobe.com/legal/permissions.html)、[Adobe icons and web logos](https://www.adobe.com/legal/permissions/icons-web-logos.html)
- **logoLicenseOrTrademarkNotes**：Adobe 明确规定，未经书面许可，第三方通常不得把 Adobe 公司 Logo 或产品图标用于自己的产品/材料。枕星 AI 在未取得授权前应使用纯文字“Adobe”或中性字母占位，不下载、仿制或改造 Adobe Logo；文字引用也不得暗示 Adobe 赞助、认证或合作。
- **一手证据**：
  - [Adobe for creativity 官方产品页](https://developer.adobe.com/adobe-for-creativity/)
  - [Adobe for creativity 官方安装与 Windows 要求](https://developer.adobe.com/adobe-for-creativity/getting-started/)
  - [Adobe 官方 FAQ 与能力边界](https://developer.adobe.com/adobe-for-creativity/support/)
  - [Adobe 官方发布说明](https://blog.adobe.com/en/publish/2026/04/28/adobe-for-creativity-connector)
  - [AdobeDocs 官方文档仓库](https://github.com/AdobeDocs/adobe-creativity-mcp)

## 2. Autodesk / Autodesk Fusion

- **vendor**：Autodesk
- **product**：Autodesk Fusion
- **用途类别**：3D CAD、参数化建模、产品设计、制造数据与自动化
- **Windows 入口**：Autodesk Fusion Windows 桌面端；本地 MCP 仅在 Fusion 运行时可用
- **接入资源名称/类型**：官方 Autodesk Fusion MCP（本地）与 Autodesk Fusion Data MCP（云端）
- **支持的 AI 客户端**：本地 MCP 官方确认 Claude Desktop、Cursor 和任意支持 Streamable HTTP 的 MCP 客户端；Data MCP 官方确认 Claude Desktop、VS Code，并要求支持 OAuth 的 Streamable HTTP。未单独验证的客户端不应默认展示“已支持”。
- **安装方式**：
  1. 用户安装并启动官方 Fusion。
  2. 在 `Preferences -> General -> API` 中由用户启用 `Fusion MCP Server`。
  3. 本地端点默认是 `http://127.0.0.1:27182/mcp`；Claude Desktop 可安装官方 Fusion Extension，其他客户端使用其标准 MCP 配置。
  4. Autodesk 支持文档指出，个人用途许可证不能进行第三方 AI 集成；枕星 AI 必须先核验/提示商业 Fusion 订阅条件，而不是把“连接失败”误报成环境故障。
- **安全权限**：本地 MCP 没有独立认证，因为只监听同机回环地址；它可以读取活动设计、截图、运行脚本并修改几何。必须保持 `127.0.0.1`，禁止改为局域网/公网监听；在 AI 客户端中默认只开放读取工具，运行脚本、删除对象、覆盖设计、生成制造结果前逐次确认。Data MCP 使用 Autodesk OAuth，令牌只进入系统凭据库，不进入后台目录数据。
- **卸载方式**：删除枕星 AI 写入的客户端连接/Extension，取消勾选 Fusion 的 MCP Server；使用过 Data MCP 时撤销 OAuth。不要卸载 Fusion，也不要删除设计、项目、制造数据或本地库。只有 Fusion 本体存在枕星 AI 安装收据且用户明确要求时，才可另行调起官方卸载流程。
- **官方/社区属性**：Autodesk 官方产品内置 MCP 与官方云 MCP
- **维护证据**：Autodesk 官方在 2026 年持续发布 Fusion MCP 产品文档、连接说明与开发教程；工具采用动态发现，能力可能随产品更新变化，因此目录只保存连接方式和权限等级，不硬编码完整工具清单。
- **logoSource**：[Autodesk Brand Hub](https://brand.autodesk.com/)、[Autodesk Logo guidelines](https://brand.autodesk.com/brand-system/logo/)
- **logoLicenseOrTrademarkNotes**：官方 DAM 的素材访问依赖与 Autodesk 的关系；Autodesk 的商标指南不自动授予第三方使用产品图标的许可。未取得授权前使用纯文字/中性字母卡片，不抓取 Fusion 安装目录图标，也不仿制 Autodesk 标志。
- **一手证据**：
  - [Autodesk Fusion MCPs Overview](https://help.autodesk.com/view/fusion360/ENU/?guid=FMCP-OVERVIEW)
  - [连接本地 Fusion MCP](https://help.autodesk.com/view/ADSKMCP/ENU/?guid=ADSKMCP_FusionDesktopMcp_connecting_to_the_fusion_mcp_server_html)
  - [Autodesk MCP Server 官方文档入口](https://help.autodesk.com/view/ADSKMCP/ENU)
  - [Autodesk 官方开发教程](https://www.autodesk.com/products/fusion-360/blog/build-your-own-fusion-add-ins-with-the-fusion-mcp/)
  - [第三方 AI 集成的许可证前置条件](https://www.autodesk.com/jp/support/technical/article/caas/sfdcarticles/sfdcarticles/JPN/Claude-MCP-connector-failing-to-connect-to-Autodesk-Fusion.html)
  - [Autodesk 商标使用规则](https://www.autodesk.com/company/legal-notices-trademarks/trademarks/guidelines-for-use)

## 3. Trimble / SketchUp

- **vendor**：Trimble
- **product**：SketchUp
- **用途类别**：3D 建模、建筑、室内、空间与产品概念设计
- **Windows 入口**：SketchUp 2026 Windows 64-bit 桌面端；Connector 本身在 Claude Web/Desktop 中运行并输出 `.skp` 文件
- **接入资源名称/类型**：官方 `SketchUp Connector for Claude`
- **支持的 AI 客户端**：当前官方只确认 Claude；不得写成通用 MCP、Codex、ChatGPT 或 Cursor 支持。
- **安装方式**：在 Claude `Customize -> Connectors -> Connect Your Apps` 中添加 SketchUp，使用 Trimble ID 完成授权。连接器不控制用户本机已打开的 SketchUp；它在会话中生成新的 `.skp`，用户下载后再用 Windows SketchUp 打开。因此不需要安装本地 MCP 服务，也不应扫描或修改用户现有 `.skp` 文件。
- **安全权限**：版本 1 只创建新模型，不能编辑或渲染现有 `.skp`。连接器会执行其受控环境中的 Python 建模工具并生成下载链接；枕星 AI 必须提示云端生成、Trimble/Claude 账号授权和模型数量限制。禁止把“可生成新文件”描述成“可接管本地 SketchUp”。
- **卸载方式**：在 Claude 中断开 SketchUp Connector，并按需撤销 Trimble ID 授权。没有本地 MCP 文件可删除；保留用户下载的 `.skp`、SketchUp 桌面端及其扩展。枕星 AI 不应把用户生成的模型当成安装缓存清理。
- **官方/社区属性**：Trimble/SketchUp 官方连接器
- **维护证据**：官方帮助页在 2026-04-21 发布版本 1 的能力、限制、安装流程和 Claude-only 边界。
- **logoSource**：[SketchUp 官方 2021 Logo 发布说明](https://sketchup.trimble.com/en/blog/article/sketchup-2021-building-a-foundation-for-success)、[Trimble Logo Usage](https://modus-v1.trimble.com/foundations/logo-usage/)
- **logoLicenseOrTrademarkNotes**：SketchUp 与 Trimble 标志属于 Trimble 商标；公开页面不是通用 Logo 再分发许可。未取得明确授权前使用文字/中性字母卡片；如以后获得官方素材，保持原比例、颜色与留白，并明确“目录收录不代表合作或背书”。
- **一手证据**：
  - [SketchUp Connector for Claude 官方说明](https://help.sketchup.com/pl/sketchup-claude-connector)
  - [SketchUp 官方 Windows 下载](https://sketchup.trimble.com/en/download/all)
  - [Trimble 商标使用指南](https://www.trimble.com/en/legal/trademark-guidelines)

## 4. Blackmagic Design / DaVinci Resolve

- **vendor**：Blackmagic Design
- **product**：DaVinci Resolve
- **用途类别**：视频剪辑、调色、Fusion 视觉特效、Fairlight 音频与交付
- **Windows 入口**：DaVinci Resolve 官方 Windows 桌面端
- **接入资源名称/类型**：`samuelgursky/davinci-resolve-mcp`，社区 MCP Server，非 Blackmagic 官方项目
- **支持的 AI 客户端**：项目安装器明确列出 Claude Desktop、Claude Code、Cursor、VS Code、Windsurf、Zed、Continue、Cline、Roo Code、OpenCode、JetBrains。其他 stdio MCP 客户端必须完成真实 Windows 连接测试后再展示。
- **安装方式**：上游快捷方式为 `npx davinci-resolve-mcp setup`，会在用户应用数据目录创建托管副本和 Python 虚拟环境并配置所选客户端。枕星 AI 不能直接执行 `@latest`；只有在固定提交/版本、代码审计、依赖锁定和哈希校验完成后，才能用客户端固定模块复现该流程。首批只支持 Resolve Studio 18.5+，并要求用户把 External Scripting 设为 `Local`。
- **安全权限**：默认 MCP 为本地 stdio，不开放网络监听；源媒体应保持只读。退出 Resolve、删除项目、替换/重连素材、修改渲染或项目设置、安装/删除脚本/Fuse/DCTL 均需逐次确认。默认只启用较小的 compound server；341 工具的 full 模式和可离线修改 `.drp/.drt/.drx`/数据库的 advanced server 不进入首批白名单。上游自动更新检查必须关闭，由枕星 AI 审核后升级固定版本。
- **卸载方式**：只移除枕星 AI 写入的 MCP 客户端配置、托管副本、虚拟环境和安装收据。若用户显式安装过 free-edition in-app bridge，再移除对应 Resolve Workspace Script。绝不卸载 Resolve、删除项目、媒体、缓存盘或用户自建脚本。精确托管路径要在固定版本验收时写入收据，不能靠模糊目录名删除。
- **官方/社区属性**：DaVinci Resolve 为 Blackmagic 官方产品；MCP 为活跃社区项目，必须在卡片上显示“社区连接器，非 Blackmagic 官方”。
- **维护证据**：上游主分支截至 2026-08-01 仍有提交；仓库有独立 Security Policy、MIT License、403 次提交及明确的 Windows/客户端安装文档。
- **logoSource**：[Blackmagic Design Press Images - DaVinci Resolve Logo](https://www.blackmagicdesign.com/media/images/davinci-resolve-logo)
- **logoLicenseOrTrademarkNotes**：这是官方 Press Images 资源页，不等于允许任意再分发或把 Logo 当作社区 MCP 品牌。DaVinci、Resolve、Blackmagic Design 属于其商标；正式打包前需确认目录展示用途是否符合媒体素材条款，否则使用文字/中性字母卡片。社区连接器卡片应使用通用 MCP 图标。
- **一手证据**：
  - [DaVinci Resolve 官方产品页](https://www.blackmagicdesign.com/products/davinciresolve)
  - [DaVinci Resolve MCP 源码仓库](https://github.com/samuelgursky/davinci-resolve-mcp)
  - [安装与客户端配置](https://github.com/samuelgursky/davinci-resolve-mcp/blob/main/docs/install.md)
  - [上游 Security Policy](https://github.com/samuelgursky/davinci-resolve-mcp/blob/main/SECURITY.md)
  - [上游提交记录](https://github.com/samuelgursky/davinci-resolve-mcp/commits/main)

## 5. Canva / Affinity

- **vendor**：Canva（复用现有厂商资料，不新增第二个 Canva）
- **product**：Affinity
- **用途类别**：图像编辑、矢量设计、排版、批量图片处理与印前工作流
- **Windows 入口**：Affinity 官方 Windows 桌面端；产品以 Canva 账号激活
- **接入资源名称/类型**：官方 Affinity AI Connector with Claude
- **支持的 AI 客户端**：官方当前只确认 Claude。
- **安装方式**：先通过 Affinity/Canva 官方入口安装 Windows 版，再在官方 UI 中连接 Claude。官方公告已经确认连接器会让 Claude 生成并保存可复用脚本到 Affinity `Scripting` 面板，但本轮没有找到完整的一手安装、权限和撤销步骤，因此当前只能配置为 `docs-only`，不能显示“一键安装连接器”。
- **安全权限**：连接器生成的脚本可做批量图像编辑、印前处理、全文件颜色平衡，等同于对当前文档执行可复用自动化。每个脚本首次运行前必须展示来源、目标文档、写入范围与可撤销性，并由用户点击确认；不得后台静默运行。Canva 官方说明 Affinity 工作默认保存在本机，且不会用于训练 Canva AI；只有用户选择导出/上传到 Canva 时才进入云端。
- **卸载方式**：在官方 UI 断开 Claude；仅在存在枕星 AI 资源收据时，允许删除由该资源安装/生成的脚本。保留 Affinity、本地文档、用户自写脚本、Canva 账号与云端资产。由于一手撤销文档尚不完整，首批不做自动卸载。
- **官方/社区属性**：Canva/Affinity 官方连接器；不是第三方 MCP。
- **维护证据**：Canva Create 2026 官方发布了 Affinity 与 Claude 的新 AI Connector；Affinity 官方 Windows 产品和 2026 更新仍在维护。
- **logoSource**：[Canva 官方 Affinity 新闻页（含 Press assets 链接）](https://www.canva.com/newsroom/news/affinity-free/)、[Affinity 官方站点](https://www.affinity.studio/)
- **logoLicenseOrTrademarkNotes**：官方 Press assets 入口不等同于无条件再分发许可。产品卡可继续使用现有 Canva 厂商标识；若要展示 Affinity 产品 Logo，必须先确认 Press assets 的具体使用条款，保留原样并避免暗示枕星 AI 与 Canva/Affinity 合作。
- **一手证据**：
  - [Canva Create 2026：Affinity 与 Claude 连接器](https://www.canva.com/newsroom/news/canva-create-2026-launches/)
  - [Affinity Windows 产品与许可条件](https://www.canva.com/policies/affinity-additional-terms/)
  - [Affinity 本地数据与 AI 训练说明](https://www.canva.com/newsroom/news/affinity-free/)
  - [Affinity 2026 官方更新](https://www.affinity.studio/blog/affinity-update-april-2026)

## 明确拒绝或暂缓的候选

| 候选 | 结论 | 原因 |
| --- | --- | --- |
| `maorcc/gimp-mcp` | 暂不进入安装白名单 | 社区项目虽活跃且支持 Windows/GIMP 3.2，但协议明确允许 `cmds` 任意 Python 执行，本地 `9877` TCP 未见认证；README 还把沙箱列为未来增强。最多提供源码说明页。 |
| `halby24/KritaMCP` | 拒绝 | 仓库已于 2026-07-26 归档为只读；包含本地服务与 Python 执行面，不符合“当前维护”要求。 |
| `ahujasid/blender-mcp` | 不在本报告推荐 | 社区项目默认可执行 Blender Python，并包含外部素材下载、API 凭据和遥测；Blender 已在同批另一份报告中处理，不能重复创建。 |
| `mikechambers/adb-mcp` | 拒绝自动安装 | 仓库自称 proof of concept、明确非 Adobe 官方；要求 Adobe UXP Developer Tool、开发者模式、Node 代理与 Python MCP，多应用脚本面过大，不适合普通用户一键安装。 |
| 随机 Premiere Pro / After Effects “上千工具”仓库 | 拒绝 | 本轮未同时验证官方性、固定发行版、签名/哈希、权限收敛、可逆卸载和真实 Windows 回归，宣传性工具数量不能替代审计证据。 |
| 剪映/CapCut | 不新增 | 现有目录已经收录；本轮未发现可替代厂商官方证明的通用本地 MCP。 |

拒绝项的一手证据：

- [GIMP MCP 源码、安装与任意执行协议](https://github.com/maorcc/gimp-mcp)
- [KritaMCP 已归档仓库](https://github.com/halby24/KritaMCP)
- [Blender MCP 社区仓库](https://github.com/ahujasid/blender-mcp)
- [Adobe 应用 proof-of-concept MCP](https://github.com/mikechambers/adb-mcp)

## 对后台与客户端的建议字段

研究结果后续进入后台时，至少应结构化保存：

- `vendorId`：复用唯一厂商资料；Affinity 使用现有 Canva 厂商。
- `productId`：Windows 产品本体。
- `resourceType`：`connector`、`mcp`、`plugin`、`skill`。
- `officiality`：`official`、`community-reviewed`、`docs-only`、`rejected`。
- `supportedClients`：只保存一手资料明确列出的客户端，不用“通用 MCP”偷换成已验证支持。
- `installMode`：`official-link`、`official-config`、`fixed-client-module`、`docs-only`。
- `permissionClasses`：云端文件、账号/OAuth、本地项目写入、脚本执行、删除/覆盖、视频/录屏、网络监听。
- `uninstallScope`：只删除枕星 AI 写入的配置、连接器文件、凭据引用和安装收据；主产品与用户作品默认保留。
- `logoSource`：厂商官方 Logo/品牌资源页 URL。
- `logoLicenseOrTrademarkNotes`：许可、商标、署名、是否允许再分发及是否必须用中性占位。
- `reviewedVersion`、`reviewedCommit`、`sha256`：仅社区安装资源需要，后台不能改变为任意 URL 或命令。

## 推荐接入顺序

1. **Adobe for creativity、SketchUp Connector**：都是官方云连接器，只做官方入口、能力说明、账号/云端权限提示和断开指导。
2. **Autodesk Fusion MCP**：官方本地 MCP；先完成商业订阅提示、回环地址校验、工具权限分级和关闭连接流程。
3. **DaVinci Resolve MCP**：固定版本、审计依赖与安装器、关闭上游自动更新，先做 Resolve Studio + Local scripting 的小范围试点。
4. **Affinity AI Connector**：先作为现有 Canva 厂商下的说明资源；等官方发布完整安装、权限和撤销文档后再升级为可连接模块。

以上顺序只代表资源接入优先级，不代表自动安装授权。任何社区连接器在本地白名单、固定版本/哈希、权限提示、安装收据、精确卸载和真实 Windows 验收齐备前，都不能显示“一键安装”。
