# AI 产品目录持续扩充：下一轮核验清单

## 结论

本轮以 `admin/data/catalog-v1.json` 当前正式基线为准：**238 个厂商、408 个产品、118 项生态资源**。候选名称已经与现有产品做规范化去重，整理出 **40 个尚未收录的高置信产品**：

- **17 个 Windows 图形产品**：统一使用客户端固定 `desktop-official` 模块，只打开厂商维护的产品页、下载页或发布页。
- **23 个 Web 产品**：统一使用 `web-link` 模块，不显示安装、卸载、环境检测或文件管理。
- **0 个 CLI 产品**：本轮不把 CLI、Web UI、自托管容器或 WSL 服务伪装成 Windows 桌面软件。
- 目录归属建议为 **27 个 `ai-tool`**、**13 个 `ai-connectable`**；同一厂商资料仍只保存一份，产品按目录归属分别展示。

所有链接均来自厂商官网、官方帮助中心、官方文档或厂商维护的 GitHub 组织。本文是录入前研究清单，不修改正式目录。

## 录入硬边界

1. Windows 图形产品只能配置 `desktop-official`，后台只保存名称、描述、分类、官网、教程和官方入口 URL。
2. 不保存 EXE、MSI、MSIX 或安装器重定向直链，不保存哈希、静默参数、签名策略或任意执行命令。
3. `desktop-official` 只调用系统浏览器打开官方页面；不下载、解析、校验或启动图形安装器。
4. `web-link` 只打开网页；不得出现“一键安装”“卸载”“环境检测”或“已安装”状态。
5. MCP、Skill、插件和扩展属于对应产品的子资源，不重复计入产品数量。
6. Preview、Beta、Alpha、Labs、Tech Preview 和受控开放能力必须在描述中明确标注。
7. 法律、科研、医疗和企业数据类产品必须提示用户核对来源、权限与合规要求，不能把 AI 输出表述为专业结论。

## 工程、CAD、BIM 与工业设计（8）

| # | 厂商 / 产品 | 目录与分类 | 客户端模块 | 官方证据 | 建议描述与边界 |
| --- | --- | --- | --- | --- | --- |
| 1 | Autodesk / **AutoCAD** | `ai-connectable` · 3D 与工业仿真 | `desktop-official` | [产品页](https://www.autodesk.com/products/autocad/overview) · [AutoCAD 2026 AI 功能](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-WhatsNew/files/GUID-B4E1E636-E08E-4277-8971-910D47440116.htm) | Windows CAD 产品，包含 Autodesk Assistant、Smart Blocks 等 AI 辅助能力；不能描述成 AI 渲染器，功能受版本和订阅限制。 |
| 2 | Autodesk / **Revit** | `ai-connectable` · 3D 与工业仿真 | `desktop-official` | [产品页](https://www.autodesk.com/products/revit/overview/) · [Revit 2027 Assistant](https://help.autodesk.com/view/RVT/2027/ENU/?guid=GUID-68D8FE6D-C5B0-4503-AE27-02C715BAC25B) · [官方 MCP 公告](https://www.autodesk.com/blogs/aec/2026/06/17/revit-public-mcp-server/) | Windows BIM 产品。Assistant 和 MCP 的预览状态必须明确；MCP 后续进入 Revit 子资源，不建立第二个产品。 |
| 3 | Graphisoft / **Archicad** | `ai-connectable` · 3D 与工业仿真 | `desktop-official` | [官方下载页](https://www.graphisoft.com/en-us/downloads/) · [AI Visualizer](https://help.graphisoft.com/AC/28/INT/_AC28_Help/100_Visualization/100_Visualization-10.htm) | Windows BIM 产品；AI Visualizer 面向概念图，不生成可编辑 BIM 对象，并需要相应 Cloud 或 Collaborate 许可。 |
| 4 | Vectorworks / **Vectorworks Design Suite** | `ai-connectable` · 3D 与工业仿真 | `desktop-official` | [产品与试用](https://www.vectorworks.net/en-US/products?showModal=trial-form) · [Windows 安装](https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Start/Installing_Vectorworks_products.htm) · [AI Visualizer](https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Rendering2/Generating_AI_images.htm) | Windows 设计套件；AI 图像在云端处理，输出不是 Vectorworks 对象，且受订阅或 Service Select 权限限制。 |
| 5 | Bricsys / **BricsCAD** | `ai-connectable` · 3D 与工业仿真 | `desktop-official` | [产品与 AI 能力](https://www.bricsys.com/en-ie/bricscad/v25) · [官方安装指南](https://boa.bricsys.com/static/files/BricsCAD_InstallationGuide_V26.pdf) | Windows CAD/BIM 产品；BIMIFY、BLOCKIFY 等能力随版本和版本档位变化，实验功能不能按正式能力宣传。 |
| 6 | Dassault Systèmes / **SOLIDWORKS Design** | `ai-connectable` · 工程计算与仿真 | `desktop-official` | [SOLIDWORKS 2026 与 AI](https://www.solidworks.com/media/introducing-solidworks-2026) · [官方下载中心](https://www.solidworks.com/support/downloads) · [系统要求](https://www.solidworks.com/support/system-requirements) | Windows 工业设计产品；AURA、AI Drawing 等能力受版本、3DEXPERIENCE 连接和许可证限制。 |
| 7 | Siemens / **Designcenter NX** | `ai-connectable` · 工程计算与仿真 | `desktop-official` | [NX AI CAD](https://blogs.sw.siemens.com/nx-design/ai-cad) · [Windows 学生版入口](https://blogs.sw.siemens.com/designcenter/nx-student-edition-free-download/) · [学习中心](https://blogs.sw.siemens.com/designcenter/learn-designcenter-nx-cad-software/) | 复用现有 Siemens 厂商。Design Copilot 需要对应许可；学生版入口不能等同企业 AI 功能。 |
| 8 | Trimble / **Tekla Structures** | `ai-connectable` · 3D 与工业仿真 | `desktop-official` | [官方下载入口](https://download.trimble.com/tekla-structures/for-businesses) · [试用](https://download.trimble.com/tekla-structures/free-trial?page=account) · [2026 AI 公告](https://news.trimble.com/Trimble-Unveils-2026-Tekla-Software-Accelerating-BIM-Engineering-and-Construction-Productivity-Through-Streamlined-Workflows-and-AI?asPDF=1) | 复用现有 Trimble 厂商。AI Drawing、Assistant 等能力存在 Preview/Labs 和许可边界，录入时必须标注。 |

## 科研、生命科学与数据分析（8）

| # | 厂商 / 产品 | 目录与分类 | 客户端模块 | 官方证据 | 建议描述与边界 |
| --- | --- | --- | --- | --- | --- |
| 9 | Altair / **Altair AI Studio** | `ai-tool` · 数据库与数据 | `desktop-official` | [Windows 安装文档](https://docs.rapidminer.com/latest/studio/installation/index.html) · [入门教程](https://docs.rapidminer.com/latest/studio/getting-started/index.html) | 原 RapidMiner Studio，面向可视化机器学习与 AutoML；不是聊天助手，完整功能受账号和许可限制。 |
| 10 | ilastik / **ilastik** | `ai-tool` · 数据库与数据 | `desktop-official` | [官网](https://www.ilastik.org/) · [Windows 下载页](https://www.ilastik.org/download) · [文档](https://www.ilastik.org/documentation/) | Windows 实验图像分割、分类和追踪工具；不得描述为临床诊断软件。 |
| 11 | QuPath / **QuPath** | `ai-tool` · 数据库与数据 | `desktop-official` | [官网](https://qupath.github.io/) · [官方发布](https://github.com/qupath/qupath/releases) · [教程](https://qupath.readthedocs.io/en/stable/) | Windows 开源生物图像分析平台；不是获批医疗器械，扩展与模型可能有版本兼容要求。 |
| 12 | Orange / **Orange Data Mining** | `ai-tool` · 数据库与数据 | `desktop-official` | [官网](https://orangedatamining.com/) · [Windows 下载页](https://orangedatamining.com/download/) · [文档](https://orangedatamining.com/docs/) | Windows 可视化机器学习和教学平台；不得包装成生成式 AI，附加组件能力随版本变化。 |
| 13 | Elsevier / **Scopus AI** | `ai-tool` · 文档与知识库 | `web-link` | [产品页](https://www.elsevier.com/en-gb/products/scopus/scopus-ai) · [研究工作流课程](https://researcheracademy.elsevier.com/research-preparation/research-design/gen-ai-use-research-workflow) | 基于 Scopus 数据的 Web 研究助手；依赖机构订阅，摘要、引用和结论仍需回到原文核验。 |
| 14 | Clarivate / **Web of Science Research Assistant** | `ai-tool` · 文档与知识库 | `web-link` | [产品页](https://clarivate.com/academia-government/scientific-and-academic-research/research-discovery-and-referencing/web-of-science/web-of-science-research-assistant/) · [官方教程](https://clarivate.com/academia-government/blog/a-more-transparent-connected-experience-in-web-of-science-research-assistant/) | 复用现有 Clarivate 厂商；依赖 Web of Science Core Collection 和机构权限，不能替代科研审查。 |
| 15 | SciSpace / **SciSpace Literature Review** | `ai-tool` · 文档与知识库 | `web-link` | [产品入口](https://scispace.com/search) · [文献综述教程](https://scispace.com/help/en/articles/10660587-how-to-conduct-a-literature-review-using-scispace) | Web 论文搜索、PDF 问答与综述工具；引用和摘要必须回到原论文验证。 |
| 16 | scite / **scite** | `ai-tool` · 文档与知识库 | `web-link` | [产品页](https://scite.ai/) · [官方文档](https://api.scite.ai/docs) · [官方 MCP](https://scite.ai/mcp) | Smart Citation 分类可能存在误差；MCP 后续进入 scite 子资源，不重复建立产品。 |

## 法律与合同工作（6）

| # | 厂商 / 产品 | 目录与分类 | 客户端模块 | 官方证据 | 建议描述与边界 |
| --- | --- | --- | --- | --- | --- |
| 17 | Thomson Reuters / **CoCounsel Legal** | `ai-tool` · 文档与知识库 | `web-link` | [产品页](https://legal.thomsonreuters.com/en/products/cocounsel-legal) · [帮助中心](https://www.thomsonreuters.com/en-us/help/cocounsel/legal/get-started/about) | 面向法律研究、分析、起草和文档审查；受方案、司法辖区和内容权限限制，所有结果必须由专业人员复核。 |
| 18 | LexisNexis / **Lexis+ with Protégé** | `ai-tool` · 文档与知识库 | `web-link` | [Lexis+ 产品页](https://www.lexisnexis.com/en-us/products/lexis-plus.page) · [AI 产品页](https://www.lexisnexis.com/en-us/products/lexis-plus-ai.page) | Web 法律研究与起草工具；旧名称 Lexis+ AI 可作为搜索别名，产品展示使用当前品牌，受订阅和司法辖区限制。 |
| 19 | Harvey / **Harvey** | `ai-tool` · 文档与知识库 | `web-link` | [平台页](https://www.harvey.ai/platform) · [官网](https://www.harvey.ai/) | 面向法律和专业服务组织的 Web 平台；企业接入和数据治理由组织管理员控制。 |
| 20 | Spellbook / **Spellbook** | `ai-tool` · 文档与知识库 | `web-link` | [产品页](https://spellbook.com/) · [官方 Academy](https://academy.spellbook.com/) | AI 合同审阅与起草工具，主要以 Microsoft Word 加载项交付；不是独立 Windows 客户端，不显示桌面安装按钮。 |
| 21 | vLex / **Vincent AI** | `ai-tool` · 文档与知识库 | `web-link` | [产品页](https://vlex.com/es/vincent-ai) · [帮助中心](https://knowledge.vlex.com/en/vincent-ai) | Web 法律研究助手；内容库、国家、司法辖区和账号权限不同，不能承诺全地域覆盖。 |
| 22 | Relativity / **Relativity aiR for Review** | `ai-tool` · 文档与知识库 | `web-link` | [产品页](https://www.relativity.com/data-solutions/air/review/) | RelativityOne 内的生成式 AI 文档审阅能力；不是独立应用，需要企业平台、工作区和管理员配置。 |

## 客户服务、联络中心与销售（5）

| # | 厂商 / 产品 | 目录与分类 | 客户端模块 | 官方证据 | 建议描述与边界 |
| --- | --- | --- | --- | --- | --- |
| 23 | Zendesk / **Zendesk Copilot** | `ai-tool` · 客户服务 | `web-link` | [产品页](https://www.zendesk.com/service/ai/copilot/) · [官方说明](https://support.zendesk.com/hc/en-us/articles/7908817636378-About-agent-copilot) | 嵌入 Zendesk 工作区的坐席和管理员 AI 助手；属于附加方案，不是独立桌面软件。 |
| 24 | Freshworks / **Freddy AI Copilot** | `ai-tool` · 客户服务 | `web-link` | [Freshdesk 产品页](https://www.freshworks.com/freshdesk/freddy-ai-for-cx/helpdesk/) · [Freddy AI](https://www.freshworks.com/freddy-ai/) | 嵌入 Freshworks/Freshdesk 的 Web AI 能力；受产品方案、管理员和数据权限限制。 |
| 25 | Genesys / **Genesys Cloud CX** | `ai-connectable` · 客户服务 | `web-link` | [产品页](https://www.genesys.com/genesys-cloud) · [开发者中心](https://developer.genesys.cloud/) | 云联络中心，包含虚拟坐席、Copilot、AI Studio 和分析能力；不是 Windows 客户端，需企业租户。 |
| 26 | Gong / **Gong Revenue AI OS** | `ai-tool` · 营销与搜索 | `web-link` | [平台页](https://www.gong.io/platform) · [官方帮助](https://help.gong.io/docs/getting-started-welcome-to-gong) | Web 收入智能平台，处理销售会话、管道、预测和辅导；需要组织授权并涉及通话录制与隐私合规。 |
| 27 | Dialpad / **Dialpad** | `ai-connectable` · 客户服务 | `desktop-official` | [官方下载页](https://www.dialpad.com/download/) · [应用要求](https://help.dialpad.com/v1/docs/en/dialpad-app-requirements) | Windows 通信与联络中心客户端，AI 能力随方案开放；录音、转写和客户数据需遵守地区法规与组织策略。 |

## 视频、音频与直播（4）

| # | 厂商 / 产品 | 目录与分类 | 客户端模块 | 官方证据 | 建议描述与边界 |
| --- | --- | --- | --- | --- | --- |
| 28 | Audacity / **Audacity** | `ai-connectable` · 音频制作 | `desktop-official` | [AI 插件页](https://www.audacityteam.org/download/openvino/) · [Windows 下载页](https://www.audacityteam.org/download/windows/) | Windows 音频编辑器；OpenVINO AI 效果是可选插件，不是基础安装默认能力，插件后续进入 Audacity 子资源。 |
| 29 | Streamlabs / **Streamlabs Desktop** | `ai-connectable` · 直播与录制 | `desktop-official` | [桌面产品页](https://streamlabs.com/desktop) · [Game Pulse 官方说明](https://support.streamlabs.com/hc/en-us/articles/47097311788443-Introducing-the-Game-Pulse-Widget-by-Streamlabs) | Windows 直播软件；Game Pulse 使用 AI vision 且仅面向 Windows，但它是产品内组件，不另建产品。 |
| 30 | Riverside / **Riverside AI Video Editor** | `ai-tool` · 视频创作 | `web-link` | [AI Video Editor](https://riverside.com/tools/ai-video-editor) · [Video Editor](https://riverside.com/video-editor) | Web 录制与 AI 视频编辑平台；官网另有 macOS 应用，但没有等价 Windows 原生客户端，Windows 入口保持 Web。 |
| 31 | OpusClip / **OpusClip** | `ai-tool` · 视频创作 | `web-link` | [产品页](https://www.opus.pro/) · [帮助中心](https://help.opus.pro/) | Web 长视频切片、编辑和社交分发工具；额度、导出和平台发布权限由账号方案决定。 |

## 数据、BI 与数据库（4）

| # | 厂商 / 产品 | 目录与分类 | 客户端模块 | 官方证据 | 建议描述与边界 |
| --- | --- | --- | --- | --- | --- |
| 32 | ThoughtSpot / **Spotter** | `ai-tool` · 数据库与数据 | `web-link` | [产品页](https://www.thoughtspot.com/product/agents/spotter) | 企业分析 Agent，基于组织数据提供问答和分析；需要 ThoughtSpot 环境、语义模型和数据权限。 |
| 33 | Qlik / **Qlik Answers** | `ai-tool` · 数据库与数据 | `web-link` | [产品页](https://www.qlik.com/us/products/qlik-answers) · [官方文档](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/Qlik-Answers.htm) | Qlik Cloud 内的生成式 AI 知识助手；受云方案、知识库和访问权限限制，回答必须核对来源。 |
| 34 | Dataiku / **Dataiku** | `ai-tool` · 数据库与数据 | `web-link` | [产品页](https://www.dataiku.com/product/) | 企业分析、模型与 AI Agent 平台；本轮只收 Web/企业产品入口，不把自托管节点或命令行部署伪装成桌面应用。 |
| 35 | Navicat / **Navicat Premium** | `ai-connectable` · 数据库与数据 | `desktop-official` | [Navicat 17 AI 功能](https://www.navicat.com/en/navicat-17-highlights.html) · [官方下载页](https://www.navicat.com/en/download/navicat-premium) | Windows 数据库客户端，AI Assistant 可接外部模型提供商；需要相应版本、服务账号或 API 凭据。 |

## Agent 与自动化产品（5）

| # | 厂商 / 产品 | 目录与分类 | 客户端模块 | 官方证据 | 建议描述与边界 |
| --- | --- | --- | --- | --- | --- |
| 36 | ByteDance / **UI-TARS Desktop** | `ai-tool` · 智能体 | `desktop-official` | [官方仓库](https://github.com/bytedance/UI-TARS-desktop) · [官方下载发布页](https://github.com/bytedance/UI-TARS-desktop/releases) · [快速开始](https://github.com/bytedance/UI-TARS-desktop/blob/main/docs/quick-start.md) | Windows 原生 GUI Agent，可操作本地计算机和浏览器。只打开官方发布页，不保存 GitHub Release 资产直链；本地操作具有高权限风险。 |
| 37 | OpenHands / **OpenHands Cloud** | `ai-tool` · 编程开发 | `web-link` | [产品页](https://www.openhands.dev/) · [快速开始](https://docs.openhands.dev/overview/quickstart) | Web 云端编程 Agent，无需本地安装。Windows 本地版实际依赖 WSL2 与 Docker，CLI 也要求 WSL，不能显示成原生桌面客户端。 |
| 38 | Skyvern / **Skyvern** | `ai-tool` · 智能体 | `web-link` | [产品页](https://www.skyvern.com/) · [官方文档](https://docs.skyvern.com/) | Web 浏览器自动化 Agent；另有 Docker 自托管和 SDK，但它们不是 Windows 图形客户端。登录、2FA、CAPTCHA 和凭据操作应提示高风险。 |
| 39 | Lindy / **Lindy** | `ai-tool` · 智能体 | `web-link` | [产品页](https://www.lindy.ai/) · [官方文档](https://docs.lindy.ai/) | Web 工作助理，可连接邮箱、日历、会议与消息渠道；需要明确外发、改期、发送邮件和账号授权风险。 |
| 40 | Gumloop / **Gumloop** | `ai-tool` · 工作流自动化 | `web-link` | [产品页](https://www.gumloop.com/) · [官方文档](https://docs.gumloop.com/) · [Agent 文档](https://docs.gumloop.com/core-concepts/agents) | Web 无代码 Agent 与工作流平台；连接外部服务、MCP、代码沙箱和自动触发器时必须明确凭据、费用和副作用。 |

## Agent 名称与平台边界审计

### “hermas” 实际指向 Hermes Agent

- 用户提到的 “hermas” 应规范化为 **Nous Research / Hermes Agent**；当前目录已经收录 **Hermes Agent** 和 **Hermes Desktop**，本轮不重复新增。
- 新的 [Windows Native Guide](https://github.com/nousresearch/hermes-agent/blob/main/website/docs/user-guide/windows-native.md) 明确说明 Hermes 可原生运行于 Windows 10/11，并提供薄 GUI 安装器；[Desktop Guide](https://github.com/nousresearch/hermes-agent/blob/main/website/docs/user-guide/desktop.md) 说明桌面端与 CLI 共用安装和数据目录。
- 仓库中较旧的 [FAQ](https://github.com/nousresearch/hermes-agent/blob/main/website/docs/reference/faq.md) 仍可能出现“不支持原生 Windows”的旧描述。正式维护时应以更具体、更新的 Windows/安装文档和 [官方 Releases](https://github.com/NousResearch/hermes-agent/releases) 为准，同时记录文档冲突，不能凭单页自动改安装策略。
- 原生 Windows 仍有边界：Dashboard 的嵌入式终端面板需要 POSIX PTY，官方文档建议该部分使用 WSL2；这不等于整个 Hermes 只能运行在 WSL。

### Agent TARS 与 UI-TARS Desktop 不能混为一个桌面产品

- **Agent TARS** 官方定位主要是 CLI 与 Web UI；本轮桌面优先阶段不新增 CLI 产品。
- **UI-TARS Desktop** 才是原生 GUI Agent，因此本轮只建议新增 UI-TARS Desktop。
- 两者可以归属于同一 ByteDance 厂商，但不能让 Agent TARS 的 CLI/Web 能力冒充 Windows 桌面安装入口。

### Web、CLI、自托管与桌面的判定

| 产品 | 本轮展示 | 不得展示成 |
| --- | --- | --- |
| UI-TARS Desktop | Windows 图形产品，`desktop-official` | AI Hub 托管安装器或固定 Release 资产直链 |
| OpenHands Cloud | Web 产品，`web-link` | 原生 Windows 桌面端；本地运行依赖 WSL2/Docker |
| Skyvern | Web 产品，`web-link` | Windows 桌面端；Docker 与 SDK 是另外的部署方式 |
| Lindy | Web 产品，`web-link` | Windows 桌面端或本地常驻 Agent |
| Gumloop | Web 产品，`web-link` | Windows 桌面端；浏览器扩展、MCP 和工作流是子资源 |
| Hermes Agent / Hermes Desktop | 已在正式目录，不新增 | 两个重复厂商，或把旧 FAQ 当作当前唯一事实 |

## 暂缓或后置候选

以下项目有官方线索，但当前不应混入这 40 个高置信录入项：

- **Fellou**：官网存在下载入口，但当前官方动态下载页抓取结果只明确展示 macOS 芯片选择，未能从一手页面稳定核实当前 Windows 构建；确认后再入库。
- **Agent TARS**：以 CLI 和 Web UI 为主，等 CLI 阶段单独录入；不能使用 UI-TARS Desktop 的下载入口代替。
- **ALLPLAN**：AI Visualizer 可核实，但本轮优先级低于更常用 CAD/BIM 产品；可进入下一轮。
- **PTC Creo**：部分新 AI 能力仍是 Beta/Alpha；适合先记录预览边界，再决定是否展示。
- **BioRender AI Figure Generator**：AI Figure Generator 仍标注 Beta；可作为后续 Web 科研创作候选。
- **Benchling AI**：企业生命科学平台和 AI Connectors/MCP 可核实，但涉及敏感实验数据、租户与管理员权限；建议单独做生命科学数据合规批次。
- **Browser Use Cloud**：可作为后续 Web Agent 候选；需先与 Skyvern、Agent TARS 等浏览器 Agent 做产品边界和重复能力审计。
- **Roo Code**：明确排除。其[官方仓库](https://github.com/RooCodeInc/Roo-Code)已由所有者在 2026-05-15 归档并转为只读，README 也说明扩展已关闭；不得再作为当前维护产品录入。

## 后台录入建议

每个产品只需要调用固定模块并填写参数，不在前端写厂商特例：

```text
厂商（复用或新增）
└─ 产品
   ├─ directoryKind: ai-tool | ai-connectable
   ├─ category
   ├─ moduleId: desktop-official | web-link
   ├─ 官网按钮
   ├─ Web 按钮（存在才显示）
   ├─ Windows 官方下载按钮（存在才显示）
   ├─ 教程按钮（存在才显示）
   ├─ 描述、许可与风险提示
   └─ 子资源：MCP / Skill / 插件 / 扩展（独立审核）
```

建议先按以下顺序录入：

1. 复用现有厂商的 5 个产品：Autodesk AutoCAD、Autodesk Revit、Siemens Designcenter NX、Trimble Tekla Structures、Clarivate Web of Science Research Assistant。
2. 录入 12 个其余 Windows 工程、科研、数据和通信图形产品。
3. 录入 18 个法律、科研、客户服务、视频和数据 Web 产品。
4. 最后录入 5 个 Agent 产品，并执行高权限与平台边界复核。
5. 每次发布前运行去重、URL 域名、模块约束和图标来源校验；前端不得维护备用静态产品数组。

## 验收口径

- 正式目录新增数量应为 **40 个产品**，没有同名或同义重复。
- Windows 图形产品数量应为 **17**，且全部为 `desktop-official`。
- Web 产品数量应为 **23**，且全部为 `web-link`。
- CLI 新增数量应为 **0**。
- 不出现 EXE/MSI/MSIX 直链、哈希、静默参数、任意命令或客户端安装白名单变更。
- 搜索 “Hermas”“Hermes” 应命中已有 Nous Research 产品，不新增第三份 Hermes 产品。
- 搜索 “Agent TARS” 与 “UI-TARS” 时，说明和入口必须清楚区分 CLI/Web 与 Windows GUI。
- MCP、Skill、插件和扩展只在所属产品子目录展示，不增加厂商产品数。
