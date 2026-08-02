# 枕星 AI：AI 可接入厂商第二批研究（创作、工程、3D 与游戏）

研究日期：2026-08-02

## 研究范围与结论

本轮先读取了 `admin/data/catalog-v1.json`。当前快照包含 128 个厂商、257 个产品、56 项生态资源和 4 类资源商店。Blender、Godot、Unreal Engine、Ableton Live、OBS Studio、n8n、UiPath、Home Assistant、Adobe Creative Cloud、Autodesk Fusion、SketchUp、DaVinci Resolve 等已经存在，因此不重复创建。

本轮筛出 8 个未收录产品。它们的 MCP、Connector、Plugin 或 Skill 均能在厂商官方文档或厂商官方仓库中核验，建议全部标记为 `sourceKind: official`。本轮不收录社区资源，也不把普通 REST API 冒充 MCP。

| 优先级 | 厂商 / 产品 | 实用分类 | 官方资源 | 建议首版形态 |
| --- | --- | --- | --- | --- |
| P0 | Roblox / Roblox Studio | 游戏开发 | 内置 Studio MCP Server | 产品卡 + 固定配置模块 |
| P0 | Penpot / Penpot | 图像与设计 | Penpot MCP Server | 远程连接优先，本地模式仅文档 |
| P0 | Webflow / Webflow | 图像与设计 | Webflow MCP Server / Bridge App | 官方远程 Connector |
| P0 | Miro / Miro | 项目与协作 | Miro MCP Server | 官方远程 Connector |
| P1 | MathWorks / MATLAB | 工程计算与仿真 | MATLAB MCP Server / Agentic Toolkit | 官方下载 + 固定本地模块 |
| P1 | MathWorks / Simulink | 工程计算与仿真 | Simulink Agentic Toolkit | 依赖 MATLAB 的子产品模块 |
| P1 | NVIDIA / Omniverse | 3D 与工业仿真 | Kit / USD / OmniUI MCP 与官方 Skills | 先展示文档与资源，不自动构建 |
| P1 | Grafana Labs / Grafana | 云服务与运维 | Grafana MCP Server | 默认只读的固定容器/二进制模块 |

## 共用安全与生命周期边界

- 后台只保存产品、资源、目标 AI 工具、官方 URL、权限说明和固定模块参数，不能下发 Shell、PowerShell、CMD 或任意可执行命令。
- Web/远程 MCP 只写入目标 AI 工具的结构化连接记录；令牌、OAuth 会话和 MCP key 进入系统凭据存储，不能进入目录 JSON、日志或截图。
- 桌面图形产品只打开厂商官方下载页。枕星 AI 不代替厂商下载、解析、校验或启动图形安装器。
- “卸载资源”只移除枕星 AI 有回执的 MCP 配置、插件、固定容器或托管副本，并引导用户撤销 OAuth/令牌；不能卸载宿主产品，也不能删除项目、设计稿、看板、模型、站点或监控数据。
- 首次接入默认只读。修改设计、执行代码、运行仿真、发布站点、操作生产监控、上传资产和启动游戏测试均需按能力分级确认。

## 1. Roblox / Roblox Studio

### 产品与官方资源

- 产品入口：Roblox Studio 是面向 Windows 和 macOS 的官方 3D 游戏开发应用；Windows 安装文件由官方页面提供，当前最低系统要求包含 Windows 10。[Roblox Studio 设置与官方下载](https://create.roblox.com/docs/studio/setup)
- 官方资源：Studio MCP Server 已内置在 Roblox Studio 中，不需要安装第三方 MCP 包。用户在 Assistant 的 MCP 设置中启用它，本地通过 `stdio` 与 AI 客户端通信。[Roblox Studio MCP 官方文档](https://create.roblox.com/docs/studio/mcp)
- 官方快速连接明确列出 Antigravity、Codex CLI、Claude Code、Claude Desktop、Cursor、Gemini CLI 和 Visual Studio Code；Windows 连接入口由 Studio 自己提供的 `%LOCALAPPDATA%\Roblox\mcp.bat` 承载。[Roblox Studio MCP 官方文档](https://create.roblox.com/docs/studio/mcp)

### 安装、卸载与安全边界

- 枕星 AI 只检测 Roblox Studio 是否存在并引导用户在 Studio 内开启 MCP；固定模块可为目标客户端写入官方文档给出的 `stdio` 配置，但不能下载或替换 `mcp.bat`。
- 断开时只关闭 Studio 的 MCP 开关并删除枕星 AI 写入的目标客户端配置。保留 Roblox Studio、登录状态、Place、脚本、Creator Store 资产和发布记录。
- MCP 可读写脚本、批量编辑、执行 Luau、启动/停止 Playtest、模拟键鼠、截屏、插入或上传资产。官方也明确提醒只连接受信任客户端。因此首版应把读取与搜索设为低风险，把写脚本、执行 Luau、上传资产、键鼠模拟、Playtest 和发布前操作设为逐次确认。[Roblox Studio MCP 工具与安全提示](https://create.roblox.com/docs/studio/mcp)

### Logo 来源

- Roblox 的官方社区商标政策明确禁止一般创意材料使用 Roblox Logo 或 Tilt，除非属于获批场景；“Now on Roblox”徽章也不是产品目录 Logo。枕星 AI 不应抓取或展示 Roblox Logo，首版使用中性字母 `R` 或纯文字产品名。[Roblox 名称与 Logo 社区使用指南](https://en.help.roblox.com/hc/en-us/articles/115001708126-Roblox-Name-and-Logo-Community-Usage-Guidelines)

## 2. Penpot / Penpot

### 产品与官方资源

- 产品入口：Penpot 是可使用官方 SaaS 或自托管的开源设计平台。[Penpot 官方产品页](https://penpot.app/)
- 官方资源：Penpot MCP Server 由 MCP Server、Penpot 内插件和 MCP Client 三部分组成，可读取和修改组件、样式、Token、页面和图层。[Penpot MCP 官方文档](https://help.penpot.app/mcp/)
- 官方远程模式明确给出 Cursor、Claude Code、VS Code/GitHub Copilot、Codex 和 OpenCode 的连接示例；本地模式使用 `@penpot/mcp`，并需要 Node.js 与浏览器内插件。[Penpot MCP 官方文档](https://help.penpot.app/mcp/)

### 安装、卸载与安全边界

- 首版只接入官方远程 MCP：用户在 Penpot 账户中启用 MCP、生成一次性展示的 MCP key，并把官方生成的 URL 写入选定客户端。不得把包含 `userToken` 的 URL写入普通日志或后台目录。
- 本地 `npx @penpot/mcp@stable` 模式具备更高本地文件权限，且需要保持进程和插件窗口运行；在完成固定版本、哈希、Node 兼容、收据和浏览器本地网络权限验收前，只显示官方文档，不开放一键部署。
- 断开时删除目标客户端连接、在 Penpot 停用 MCP 并轮换 key；保留 Penpot 账号、文件、组件库、自托管实例和浏览器数据。
- MCP 总是作用于当前聚焦页面，且一次只能有一个活动标签页。默认先执行只读检查；创建、移动、删除、重命名、重排样式以及本地文件导入必须先展示变更摘要并确认。[Penpot MCP 安全建议](https://help.penpot.app/mcp/)

### Logo 来源

- 官方 Media Kit 提供 Logo、品牌指南和产品截图，可作为后台 Logo 来源记录；只使用其原始资产，不从第三方 Logo 站抓取。[Penpot Media Kit](https://penpot.app/media-kit)

## 3. Webflow / Webflow

### 产品与官方资源

- 产品入口：Webflow 是浏览器中的可视化网站设计、CMS 与发布平台。[Webflow 官方产品页](https://webflow.com/)
- 官方资源：Webflow MCP Server 运行在 `https://mcp.webflow.com/mcp`，通过 OAuth 访问用户授权的站点。官方说明列出 Claude Desktop、Claude Code、Cursor、Postman 和 Windsurf，并允许其他支持 MCP 的客户端手动接入。[Webflow MCP 入门](https://developers.webflow.com/mcp/reference/getting-started)
- MCP Bridge App 会在 OAuth 授权时自动安装到授权站点；大多数数据操作不依赖 Bridge，只有读取当前选择、页面、模式、分支、断点和可视快照等能力需要保持 Designer 内的 Bridge App 打开。[Webflow MCP 架构](https://developers.webflow.com/mcp/reference/how-it-works)

### 安装、卸载与安全边界

- 首版采用官方远程 Connector，不在本机安装 MCP 二进制。枕星 AI 只发起官方 OAuth 和写入官方 MCP URL，不保存 Webflow 令牌。
- 断开时删除目标 AI 工具连接、撤销 Webflow OAuth，并按官方产品界面移除/停用 Bridge App；保留 Workspace、站点、CMS、域名、资产、发布历史和 Webflow 账号。
- MCP 可创建和编辑元素、组件、样式、变量、CMS、页面、资产和字体。Webflow 官方说明 MCP 继承用户角色/自定义角色，并把 Agent 变更写入站点活动日志。枕星 AI 应在此基础上继续把发布、删除页面/CMS、改域名、改权限和批量变更设为高风险确认。[Webflow MCP 治理说明](https://developers.webflow.com/mcp/reference/how-it-works)

### Logo 来源

- 官方 Brand Assets 页面提供 SVG/PNG Logo、Mark、Icon 和颜色规则；导入时优先使用蓝色官方版本并保留比例。[Webflow Brand Assets](https://brand.webflow.com/brand-assets)
- Webflow 商标政策要求 Logo 不得改色、变形、组合进枕星 AI 标志或造成官方合作误导；产品卡仅作来源识别。[Webflow Trademark Usage Policy](https://webflow.com/legal/trademark-usage-policy)

## 4. Miro / Miro

### 产品与官方资源

- 产品入口：Miro 是面向创新、协作、白板和产品工作的在线工作空间；另有官方 Windows 64 位桌面客户端，但 MCP 不依赖桌面客户端。[Miro 官方产品介绍](https://miro.com/about/) · [Miro Desktop 官方说明](https://help.miro.com/hc/en-us/articles/360017572854-Desktop-app)
- 官方资源：Miro MCP Server 允许 AI 助手读取用户指定的看板、生成图表并写回看板，使用 OAuth 2.1；Enterprise 账户需要管理员批准。[Miro MCP Server 概览](https://help.miro.com/hc/en-us/articles/31624028247058-Miro-MCP-Server-overview)
- 官方用户指南给出 `https://mcp.miro.com`，并列出 Cursor、VS Code、Lovable、Claude Code、Gemini CLI、Windsurf 和 Replit 等接入路径。[Miro MCP 启用指南](https://help.miro.com/hc/en-us/articles/31625301583890-How-to-enable-Miro-s-MCP-Server-user-guide)

### 安装、卸载与安全边界

- 首版采用官方远程 Connector，只配置 URL 和发起 OAuth；不能把 Miro Desktop 安装当作使用 MCP 的前置条件。
- 断开时删除目标客户端配置、在 Miro 停用 MCP/撤销 OAuth；保留 Miro Desktop、账号、Team、看板和附件。
- MCP 权限受用户已有看板权限和 OAuth 所选 Team 限制，但仍可读取和写入看板。默认只读查看；创建图表、移动/删除对象、批量改写和向外部模型发送看板内容前应确认。Enterprise 需尊重组织或 Team 级管理员开关。[Miro MCP 管理员指南](https://help.miro.com/hc/en-us/articles/31625761037202-Miro-MCP-Server-admin-guide)

### Logo 来源

- 本轮未找到 Miro 面向第三方公开下载并明确授权目录使用的品牌包。不得用第三方 Logo 聚合站替代。可把 `https://miro.com/` 作为官方来源记录，但在品牌许可确认前使用字母 `M` 兜底，不自动抓取页面图片。

## 5. MathWorks / MATLAB

### 产品与官方资源

- 产品入口：MATLAB 是 Windows、macOS 和 Linux 上的工程计算与编程产品；Windows 官方系统要求和安装入口由 MathWorks 提供。[MATLAB Windows 系统要求](https://www.mathworks.com/support/requirements/matlab-system-requirements.html) · [MathWorks 官方安装说明](https://www.mathworks.com/help/install/ug/install-products-with-internet-connection.html)
- 官方资源：MATLAB MCP Core Server 是 MathWorks 官方开源项目，可启动/连接 MATLAB、检查代码、执行代码和文件、运行测试、检测工具箱。[MATLAB MCP 产品页](https://www.mathworks.com/products/matlab-mcp-server.html) · [MATLAB MCP 官方仓库](https://github.com/matlab/matlab-mcp-core-server)
- 官方说明覆盖 Claude Desktop、Claude Code、VS Code/GitHub Copilot、Gemini CLI；MATLAB Agentic Toolkit 另明确支持 Codex 和 Sourcegraph Amp，并可安装 MCP Server 与官方 Skills。[MATLAB Agentic Toolkit 官方仓库](https://github.com/matlab/matlab-agentic-toolkit)

### 安装、卸载与安全边界

- MATLAB 本体只打开 MathWorks 官方下载/安装入口，并由用户完成账号、许可证和产品选择。枕星 AI 不代填许可证、不静默安装 MATLAB。
- MCP 可由客户端固定模块下载 MathWorks 官方 Release 并校验固定版本/哈希；在正式纳入白名单前先做 `resource-link`。不得让后台传入任意下载地址或自定义命令。
- 断开时只删除枕星 AI 收据内的 MCP 二进制、Toolkit、Skills 和客户端配置；官方也给出 `claude mcp remove matlab` 这类连接移除方式。保留 MATLAB、许可证、Toolbox、工程、`.m` 文件和用户 Startup 配置。[MATLAB MCP 官方仓库](https://github.com/matlab/matlab-mcp-core-server)
- MCP 能执行 MATLAB 代码和绝对路径脚本。首版将代码检查、版本/Toolbox 查询设为只读；代码执行、文件写入、测试运行、启动/退出 MATLAB、扩展文件和工作目录变更必须确认，并把工作目录限制在用户选择的项目根目录。

### Logo 来源

- MathWorks 官方 Brand Guide 说明公司 Logo、膜面图形及商标规则；MATLAB 与 Simulink 共用该一方品牌来源，不从 GitHub 头像或第三方站点抓取。[MathWorks Brand Guide](https://www.mathworks.com/brand.html)

## 6. MathWorks / Simulink

### 产品与官方资源

- 产品入口：Simulink 是依赖 MATLAB 的模型化设计与仿真产品，支持 Windows、macOS 和 Linux。[Simulink 产品要求](https://www.mathworks.com/support/requirements/simulink.html)
- 官方资源：Simulink Agentic Toolkit 构建在 MATLAB MCP Server 之上，提供模型结构读取、参数查询、模型编辑、仿真和测试等工具，并带有模型化设计 Skills。[Simulink Agentic Toolkit 产品页](https://www.mathworks.com/products/simulink-agentic-toolkit.html) · [Simulink Agentic Toolkit 官方仓库](https://github.com/matlab/simulink-agentic-toolkit)
- 官方产品页明确列出 Claude Code、GitHub Copilot、Codex、Gemini CLI 和 Sourcegraph Amp。

### 安装、卸载与安全边界

- 后台数据必须把 Simulink 记录为独立产品，但安装模块声明依赖 `MATLAB + Simulink + MATLAB MCP Core Server`；不能把它伪装成无需 MATLAB 的独立 MCP。
- 首版只展示官方 Toolkit 与引导。完成真实 Windows 验收后，可由固定模块安装固定版本 Toolkit；不得直接执行后台下发的仓库命令。
- 断开时移除枕星 AI 收据内的 Toolkit、Skills、MCP 扩展与客户端配置；保留 MATLAB、Simulink、许可证、模型、测试、数据字典和用户工程。
- `model_edit`、仿真、测试和 Stateflow/模型结构修改会改变工程状态。模型读取与参数查询可默认只读；添加/删除 Block、改连线/参数、运行仿真、生成测试或修改 Requirements 必须展示模型与作用范围并确认。[Simulink Agentic Toolkit 官方仓库](https://github.com/matlab/simulink-agentic-toolkit)

### Logo 来源

- 复用 MathWorks 官方 Brand Guide 的厂商 Logo；产品卡用“Simulink”文字与官方产品截图规则，不自行重绘图标。[MathWorks Brand Guide](https://www.mathworks.com/brand.html)

## 7. NVIDIA / Omniverse

### 产品与官方资源

- NVIDIA 厂商已存在，新增产品即可，不要新建重复厂商。建议产品名为 `NVIDIA Omniverse`，分类为 `3D 与工业仿真`。[NVIDIA Omniverse 官方开发入口](https://developer.nvidia.com/omniverse)
- NVIDIA 官方 Omniverse GitHub 组织列出 Kit MCP、USD Code MCP、OmniUI MCP，以及 ovrtx、ovphysx、ovui、ovstream、ovstorage、ovpackage 等官方 Agent Skills。[NVIDIA Omniverse 官方 GitHub 组织](https://github.com/NVIDIA-Omniverse)
- 官方 2026 技术说明给出本地 Docker/Python 运行方式，Windows 使用 `build-wheels.bat`，并需要 NVIDIA API key；官方示例明确提到 Claude 与 Cursor。[NVIDIA Omniverse MCP 官方说明](https://developer.nvidia.com/blog/integrate-physical-ai-capabilities-into-existing-apps-with-nvidia-omniverse-libraries/)

### 安装、卸载与安全边界

- 当前属于开发者 SDK、库和多 MCP 集合，不应包装成一个普通 Windows 桌面“一键安装”。首版创建产品卡和资源子目录，MCP 与 Skills 仅打开官方说明/仓库。
- 完成固定版本、许可证、容器镜像、wheel 哈希、API key 存储、Windows 路径和 GPU/无 GPU 路径验收后，再考虑固定 Docker 模块。后台不能传 Compose 文件或构建命令。
- 断开时只停止和删除枕星 AI 收据内的容器、wheel、虚拟环境和客户端配置，并撤销/轮换 NVIDIA API key；保留 Omniverse 工程、USD、纹理、缓存和用户已有 Kit 应用。
- 官方说明涉及浏览 API、生成场景代码、编辑 USD prim/layer、运行渲染与物理仿真。文档搜索可只读；场景/Layer 修改、脚本执行、仿真步进、写文件、云 API 调用和 GPU 长任务必须按项目逐次确认。

### Logo 来源

- 复用目录中现有 NVIDIA 厂商资料，不新增第二份 Logo。官方品牌页面要求未经书面授权不得随意使用或修改 Logo，并禁止暗示合作/背书；保留官方比例、颜色和留白，若当前用途未获许可则继续用字母兜底。[NVIDIA Logo 与品牌指南](https://www.nvidia.com/en-us/about-nvidia/legal-info/logo-brand-usage/)

## 8. Grafana Labs / Grafana

### 产品与官方资源

- 产品入口：Grafana 有 OSS、Enterprise 和 Grafana Cloud 三种主要形态，均以浏览器管理，不是普通 Windows 桌面客户端。[Grafana 产品形态官方说明](https://grafana.com/docs/learning-hub/which-grafana/01-intro/02-the-grafana-landscape/)
- 官方资源：`grafana/mcp-grafana` 是 Grafana Labs 官方 MCP Server，可连接本地 Grafana 或 Grafana Cloud，官方提供二进制、Docker、`uvx` 和 Helm 方式。[Grafana MCP 官方仓库](https://github.com/grafana/mcp-grafana)
- 官方仓库给出 Claude Desktop 配置；Grafana Cloud 文档另给出 Claude Code 和 Cursor 连接方式。[Grafana Cloud MCP Server](https://grafana.com/docs/grafana-cloud/machine-learning/assistant/configure/cloud-mcp/)

### 安装、卸载与安全边界

- 首版优先连接 Grafana Cloud 官方远程 MCP，或对用户已有 Grafana 使用固定 Docker/二进制模块；不能顺带部署或接管用户现有 Grafana 实例。
- 凭据优先使用最小权限 Service Account Token，存入系统凭据库。禁止把 Token、用户名/密码、Cookie 或 `GRAFANA_EXTRA_HEADERS` 写入目录和普通日志。
- 默认强制 `--disable-write`，只开放用户需要的工具类别与精确 datasource/dashboard/folder scope。官方工具表明确区分读写 RBAC，Admin 工具默认也不应开启。[Grafana MCP 工具与 RBAC 参考](https://grafana.com/docs/grafana/latest/developer-resources/mcp/reference/mcp-tools-table/) · [Grafana MCP 只读模式](https://grafana.com/docs/grafana/latest/developer-resources/mcp/configure/enable-and-disable-tools/)
- 断开时只删除枕星 AI 收据内的 MCP 容器/二进制和客户端配置，并撤销 Service Account Token；保留 Grafana 实例、数据库、Dashboard、Datasource、Alert、日志、指标和 Trace。
- 若用户以后开启写权限，更新 Dashboard、创建 Folder/Incident、改 Alert、写 Annotation 或发起调查必须确认。查询日志/Trace 也可能向模型暴露生产敏感数据，应先显示目标 Datasource 和时间范围。

### Logo 来源

- Grafana 官方商标政策允许在开源讨论、开发和支持场景按规则使用，但要求归属声明、禁止修改、禁止造成背书且限制商业/营销用途。枕星 AI 在确认自身目录用途符合政策或获得许可前应使用字母 `G` 兜底；来源记录指向官方政策，不从第三方 Logo 站抓取。[Grafana Trademark Usage Policy](https://grafana.com/trademark-policy/)

## 推荐录入与上线顺序

1. Roblox Studio：官方内置 MCP、Windows 路径和目标客户端都已明确；先做“检测宿主 → 用户在 Studio 开启 → 写入固定配置 → 断开配置”的闭环。
2. Miro、Webflow、Penpot：先做远程 OAuth/key 连接，不碰图形安装器；其中 Penpot key URL 必须脱敏。
3. MATLAB、Simulink：先展示官方资源，再以真实授权 Windows 环境做固定版本安装、卸载和代码执行权限验收。
4. Grafana：先以 `--disable-write` 和最小 RBAC 接入测试实例；生产实例写能力延后。
5. NVIDIA Omniverse：先建立产品与资源层级；在官方组件仍处 Early Access、且构建/凭据链较复杂时不开放一键部署。

这 8 项全部属于“AI 可接入产品”，不应出现在“全部 AI 厂商”的 AI 工具产品列表中；资源只在对应产品的子目录和 MCP/Connector/Skill 商店分层展示。
