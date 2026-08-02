# 枕星 AI：第三批工业设计、工程科学、3D 与设备控制接入研究

- 日期：2026-08-02
- 范围：只研究厂商官方产品、官方文档、厂商控制的源码仓库与一手发布信息。
- 目录审计：已检查 `admin/data/catalog-v1.json` 及现有 `docs/research/`；Unity、Roblox、Autodesk Fusion、MathWorks、NVIDIA Omniverse、Blender、Godot、Unreal Engine、Home Assistant、向日葵等已有记录，本报告不重复创建。
- 发布边界：本报告只提出目录候选，不修改目录数据。除经过后续客户端安全审核的固定模块外，首批资源都使用 `resource-link`；后台不得下发命令、令牌、脚本或任意包地址。

## 结论

本批找到 6 组可以进入下一轮目录实现的官方能力，以及 1 组只能进入观察清单的未正式发布能力：

| 优先级 | 厂商 / 产品 | 官方能力 | 结论 |
| --- | --- | --- | --- |
| P0 | Wolfram Research / Mathematica、Wolfram Cloud | Wolfram Local MCP、Wolfram Cloud MCP | 可录入；本地和云端必须拆成两个资源 |
| P0 | Ansys / Ansys Lumerical | PyLumerical MCP Server | 可录入；只能链接模式，禁止普通一键安装 |
| P0 | Cesium / CesiumJS | Cesium AI Integrations MCP 与 Agent Skills | 可录入为官方实验性资源；链接模式 |
| P0 | Siemens / Xcelerator Developer Portal | Siemens Developer Portal MCP | 可录入；它只查开发者文档，不能描述为工业设备控制 |
| P1 | Esri / ArcGIS Location Platform | ArcGIS Location Services MCP（Beta） | 可录入 Beta 说明页；当前需要 Early Adopter 资格 |
| P1 | Synopsys / Verdi | Verdi Assistant MCP | 可录入产品与“厂商内置 MCP”说明；暂无公开安装端点 |
| 观察 | PTC / Onshape | FeatureScript MCP Server | 官方只宣布“即将推出”，暂不发布资源卡片 |

## 建议目录记录

### 1. Wolfram Research

#### 产品与资源 ID

| 字段 | 建议值 |
| --- | --- |
| `vendorId` | `wolfram-research` |
| `productId`（桌面） | `wolfram-mathematica` |
| `productId`（云端） | `wolfram-cloud` |
| `resourceId`（本地） | `wolfram-local-mcp` |
| `resourceId`（云端） | `wolfram-cloud-mcp` |

#### 官方证据

- [Wolfram MCP 产品总览](https://www.wolfram.com/artificial-intelligence/mcp/)明确区分 Local、自托管/会话模式和 Cloud、远程/无状态模式。
- [Wolfram Local MCP 官方文档](https://www.wolfram.com/artificial-intelligence/mcp/local/wolfram-mcp-local/)说明本地服务从 Wolfram 应用内安装，能够执行 Wolfram Language、搜索文档、读写 Notebook、检查代码和运行测试。
- [Wolfram Cloud MCP 官方文档](https://www.wolfram.com/artificial-intelligence/mcp/cloud/wolfram-mcp-cloud/)给出官方远程端点 `https://agenttools.wolfram.com/mcp`，并列出 ChatGPT、Claude、Claude Code、Cursor、VS Code / GitHub Copilot 等接入方式。
- [Mathematica 官方产品页](https://www.wolfram.com/mathematica/)确认 Mathematica 是 Windows、macOS、Linux 与云端技术计算产品。

#### 接入目标

- 本地资源优先关联：`claude-code`、`claude-desktop`、`cursor-desktop`、`github-copilot`、`codex-cli`。
- 云端资源优先关联：`chatgpt-desktop`、`claude-desktop`、`claude-code`、`cursor-desktop`、`github-copilot`、`github-copilot-cli`。

#### 权限与安全边界

- Cloud MCP 只把客户端实际调用的 Wolfram 查询发送到 Wolfram；官方说明它不接收整段聊天记录，并且无持久会话、不支持外部文件上传下载。目录仍需提示用户：查询内容会离开本机并由 Wolfram 云处理。
- Local MCP 能执行 Wolfram Language、读写 Notebook 和运行测试，等价于在用户许可证与当前进程权限下执行代码。首次只能展示官方安装说明；不得静默调用安装函数，也不得默认批准写文件、代码执行和测试执行。
- 枕星 AI 不收集 Wolfram 账号、许可证、API Key 或 Notebook 内容。连接和断开由目标 AI 工具与 Wolfram 应用完成。

#### 是否链接模式

- `wolfram-local-mcp`：**是，`resource-link`**。完成固定版本、工具权限与真实 Windows 验收前不自动部署。
- `wolfram-cloud-mcp`：**首批是，`resource-link`**。后续可单独评审为固定的“远程 MCP 配置模块”，不能与本地执行型 MCP 共用策略。

### 2. Ansys

#### 产品与资源 ID

| 字段 | 建议值 |
| --- | --- |
| `vendorId` | `ansys` |
| `productId` | `ansys-lumerical` |
| `resourceId` | `ansys-pylumerical-mcp` |

#### 官方证据

- [Ansys Lumerical 开发者入口](https://developer.ansys.com/docs/lumerical)把 PyLumerical MCP 列为官方 Lumerical 自动化能力。
- [Ansys 官方 `pylumerical-mcp` 仓库](https://github.com/ansys/pylumerical-mcp)说明它支持 FDTD、MODE、DEVICE、INTERCONNECT，多会话管理，以及持久化执行任意 Python / PyLumerical 代码；前置条件是 Python 3.11–3.14、Ansys Lumerical 安装与许可证。
- [Ansys Developer Portal 更新页](https://developer.ansys.com/whats-new)把 PyLumerical MCP Server 列为 2026 年新增官方能力。

#### 接入目标

- 官方仓库明确面向 VS Code、Claude Code、Claude Desktop、Cursor 和其他 MCP 客户端；目录优先关联 `github-copilot`、`claude-code`、`claude-desktop`、`cursor-desktop`、`codex-cli`。

#### 权限与安全边界

- 该服务器可以启动和关闭 Lumerical 会话、修改模型、运行仿真，并持久执行任意 Python。它不是“只读文档 MCP”。
- 必须把项目目录、模型写入、仿真执行、关闭会话、任意 Python 执行分级；写入和执行默认逐次确认，不能把 `pip install` 后的全部工具设为自动批准。
- 不代装或破解 Lumerical，不管理 Ansys 商业许可证，不读取用户许可证服务器信息。
- Windows 一键部署必须等到：固定 PyPI 版本与哈希、隔离虚拟环境、安装/卸载收据、真实 Lumerical 许可证机器验收全部完成。

#### 是否链接模式

- **是，`resource-link`**。即使官方提供 `pip install ansys-lumerical-mcp`，也不能因为存在 PyPI 包就直接开放普通一键安装。

### 3. Cesium

#### 产品与资源 ID

| 字段 | 建议值 |
| --- | --- |
| `vendorId` | `cesium` |
| `productId` | `cesiumjs` |
| `resourceId`（MCP） | `cesium-ai-integrations-mcp` |
| `resourceId`（Skill） | `cesium-agent-skills` |

#### 官方证据

- [Cesium 官方 `cesium-ai-integrations` 仓库](https://github.com/CesiumGS/cesium-ai-integrations)将自身定义为连接 Cesium 与 LLM、检索管线和 Agent 工作流的参考集成、实验与模式集合，采用 Apache-2.0。
- [官方 MCP 目录](https://github.com/CesiumGS/cesium-ai-integrations/blob/main/mcp/README.md)包含相机、实体、动画、影像、地形、3D Tiles、地理定位和 Cesium 代码生成等服务器/应用。
- [官方 Agent Skills 目录](https://github.com/CesiumGS/cesium-ai-integrations/blob/main/skills/README.md)提供 CesiumJS、Cesium ion、3D Tiles 与地理空间最佳实践 Skill。
- [CesiumJS 官方产品页](https://cesium.com/platform/cesiumjs/)确认 CesiumJS 是面向 Web 的 3D 地理空间可视化平台。

#### 接入目标

- MCP 首批关联 `claude-code`、`github-copilot`、`cursor-desktop`、`codex-cli`。
- Agent Skill 首批关联支持 Agent Skills 的 `github-copilot`、`claude-code`、`codex-cli`；是否兼容必须按各宿主的 Skill 目录规则单独判断，不能只复制文件名。

#### 权限与安全边界

- 相机工具主要改视图；实体、影像、地形、3D Tiles 与动画工具会修改运行中的 CesiumJS 应用状态；代码生成应用还会生成可执行项目代码。
- 地理定位服务器会访问 Nominatim、Overpass、OSRM 等外部服务；应明确第三方网络请求、位置查询内容和各服务使用条款。
- 官方把仓库称为 reference integrations / experiments，而且当前没有稳定 Release；不能把 `main` 分支当不可变安装包。
- 仓库当前未提供独立 `SECURITY.md`。进入自动部署评审前必须固定提交、审计依赖、限制工作区，并对实体删除、图层移除和代码写入逐次确认。

#### 是否链接模式

- 两项资源均为 **`resource-link`**，并标记 `official-experimental`。不要把仓库内的多个实验服务器拆成一批“已审核一键安装”假条目。

### 4. Siemens

#### 产品与资源 ID

| 字段 | 建议值 |
| --- | --- |
| `vendorId` | `siemens` |
| `productId` | `siemens-xcelerator-developer-portal` |
| `resourceId` | `siemens-xcelerator-developer-portal-mcp` |

#### 官方证据

- [Siemens Xcelerator Developer Portal MCP](https://developer.siemens.com/ai-registry/developer-portal/developer-portal-mcp.html)给出官方远程地址 `https://mcp.developer.xcelerator.rocks/mcp`。
- 官方当前只列出 `askDeveloperPortal` 工具，用于查询 Siemens Xcelerator Developer Portal 的文档、产品与 API。
- [Siemens 的 MCP / `llms.txt` 教程](https://developer.siemens.com/resources/how-tos/mcp.html)说明产品文档可供 AI 检索，但示例本地服务器使用第三方 `mcpdoc`，不能把该第三方包说成 Siemens 官方服务器。

#### 接入目标

- 官方文档列出 Claude Desktop、VS Code / GitHub Copilot 和 Cursor；目录关联 `claude-desktop`、`github-copilot`、`cursor-desktop`。

#### 权限与安全边界

- 当前官方远程服务是文档检索，不提供 PLC、机器人、工厂、能源或设备控制。产品文案必须写“查询开发文档与 API”，不能写“一键控制 Siemens 设备”。
- 官方页面提示生成式 AI 返回可能不准确，并受隐私、使用权与出口管制约束；高风险工业决策必须回到正式产品文档与工程人员确认。
- 不自动安装 `mcpdoc`，不替用户生成 Siemens API 凭据，不把示例代码直接执行到生产工业环境。

#### 是否链接模式

- **首批是，`resource-link`**。由于远程端只有一个只读检索工具，后续可评审固定远程配置模块；评审前需实际验证端点、工具清单变化与断开流程。

### 5. Esri

#### 产品与资源 ID

| 字段 | 建议值 |
| --- | --- |
| `vendorId` | `esri` |
| `productId` | `arcgis-location-platform` |
| `resourceId` | `esri-arcgis-location-platform-mcp` |

#### 官方证据

- [Esri 2026-06-29 官方发布说明](https://www.esri.com/arcgis-blog/products/platform/developers/mcp-support-beta-and-arcgis-static-maps-service-in-arcgis-location-platform-release)确认 ArcGIS Location Services MCP 已进入 Beta，并且当前通过 Early Adopter Community 开放。
- [Esri 开发团队说明](https://www.esri.com/arcgis-blog/products/developers/geoai/developers-lounge-exposing-location-services-to-model-context-protocol-mcp-clients)说明 MCP 会在每次连接时动态发现最新工具，底层位置服务按正常方式计费，并提供 GitHub Copilot、Microsoft 365 和 Claude 的连接示例。
- [ArcGIS Location Platform 官方产品页](https://www.esri.com/en-us/arcgis/products/arcgis-location-platform/overview)是该 MCP 所调用位置服务的平台入口。

#### 接入目标

- 官方点名 GitHub Copilot、Microsoft 365 和 Claude；目录关联 `github-copilot`、`microsoft-365-copilot`、`claude-desktop`。

#### 权限与安全边界

- 当前是 Beta，工具实现可能变化，而且需要 Early Adopter 资格；不能显示为“所有用户立即可连接”。
- 底层地理编码、路径、地图和位置服务会产生正常 ArcGIS 用量费用。连接前必须明确“由 Esri 计费，不是枕星 AI 收费”。
- 用户查询的位置、地址、路线和业务地点会发送给 ArcGIS Location Services。账号、Token、API Key 由 Esri 与目标 AI 宿主管理，枕星 AI 后台不保存。
- 动态工具发现意味着目录不能硬编码“永远存在”的完整工具清单；应记录最近验证时间和 Beta 状态。

#### 是否链接模式

- **是，`resource-link`**，链接到官方 Beta / Early Adopter 说明。公开端点、认证流程和 GA 文档未稳定前不写入客户端配置。

### 6. Synopsys

#### 产品与资源 ID

| 字段 | 建议值 |
| --- | --- |
| `vendorId` | `synopsys` |
| `productId` | `synopsys-verdi` |
| `resourceId` | `synopsys-verdi-assistant-mcp` |

#### 官方证据

- [Synopsys 官方 Verdi Assistant 说明](https://www.synopsys.com/blogs/chip-design/using-ai-to-debug-more-quickly-and-accurately.html)明确说明 Verdi Assistant 能通过 MCP 连接其他 AI 应用，此时 Verdi 成为 MCP Server。
- 官方示例包括查询文档、跟踪驱动信号、向波形窗口添加信号，以及利用 Verdi / SolvNetPlus 上下文辅助验证调试。

#### 接入目标

- 官方明确描述 Verdi 与 VS Code 的集成，并允许其他 MCP 客户端请求 Verdi 调试服务；首批只关联 `github-copilot`，其他宿主显示“支持 MCP 的客户端”，不凭空宣称逐项认证。

#### 权限与安全边界

- Verdi MCP 能访问芯片设计源码、日志、波形、调试数据库并执行调试动作；这些通常属于高敏感企业 IP。
- 必须继承 Verdi / 项目现有用户权限，并对改变调试会话、生成/执行 Tcl、打开项目数据等动作要求用户确认。
- 官方公开页面没有给出可供普通用户安装的 MCP 包、固定端点或公开配置步骤。枕星 AI 不能编造下载地址，也不能把企业许可证产品包装成免费一键安装。

#### 是否链接模式

- **是，`resource-link` / `docs-only`**。只展示官方能力说明和 Verdi 产品入口，等待厂商公开配置文档后再评审连接模块。

## 暂缓：PTC Onshape FeatureScript MCP

| 字段 | 预留值 |
| --- | --- |
| `vendorId` | `ptc` |
| `productId` | `onshape` |
| `resourceId` | `onshape-featurescript-mcp` |

[PTC 2026-07-14 官方公告](https://www.ptc.com/en/news/2026/onshapelabs)确认 Onshape Labs 已进入早期访问，但 FeatureScript MCP Server 被列在“预计即将提供”的能力中，而不是当前可用能力。官方还明确表示这些未来信息可能变化，不构成发布承诺。

因此：

- 可以先在研究/待办中保留上述 ID；
- 可以新增 PTC / Onshape 产品资料，但不能在 MCP 商店展示可安装资源；
- 等公开可用、官方连接文档、认证方式、权限模型和退出流程齐全后再进入目录。

## 设备控制专项结论

本轮没有找到新的、面向普通 Windows 用户、由设备厂商正式维护且具备可审核权限模型的通用设备控制 MCP。这个“没有”比收录社区演示更重要：

- ROS / ROS 2 的多个 MCP 项目可以发布 Topic、调用 Service/Action，甚至直接驱动机器人，但未发现 Open Robotics 官方发布的通用 MCP 产品；不进入官方资源目录。
- Unitree 社区 MCP、各种 Arduino / SCPI / 实验室仪器演示会直接驱动物理硬件；没有设备厂商签名发布、硬限位策略和真实硬件验收前，禁止一键安装。
- [NI 官方社区活动记录](https://forums.ni.com/t5/LabVIEW-Caf%C3%A9/%E7%AC%AC4%E5%9B%9E-LabVIEW-Knowledge-Exchange-%E9%96%8B%E5%82%AC%E5%A0%B1%E5%91%8A/td-p/4477693)把 LabVIEW MCP Server SDK 明确描述为 NI 员工个人项目，而不是 NI 正式支持产品，因此暂不创建 NI 官方 MCP 资源。
- 现有目录中的 Home Assistant MCP 与向日葵 AweSun MCP 仍是当前设备/远程控制类别的官方入口；新候选不得绕过它们已有的确认、账号授权和设备安全规则。

## 目录实现顺序

1. 先录入 Wolfram、Ansys、Cesium、Siemens 的厂商、产品与链接型资源。
2. Esri 标记 `beta` 与 `requires-early-access`；Synopsys 标记 `docs-only` 与 `enterprise-license`。
3. PTC 仅写入研究待办，不进入公开资源商店。
4. 所有资源设置明确的 `targetProductIds`，继续按“目标工具主目录 → 资源列表 → 单项详情”展示，不能平铺到商店首页。
5. 设备控制资源新增统一门槛：厂商官方维护、版本固定、权限分级、物理动作确认、急停/安全限位说明和真实设备验收，缺一项就保持链接或不收录。

## 本轮不应产生的实现

- 不因官方网页出现“MCP”就生成一键安装脚本。
- 不把 Beta、Early Access、实验仓库或“即将推出”写成正式可用。
- 不把读取文档的 Siemens MCP 写成工业设备控制。
- 不把任意 Python、Wolfram Language、Tcl、仿真或机器人动作放进默认自动批准范围。
- 不下载、转存或重新分发商业工程软件安装包。
- 不把社区仓库的高星数当作厂商官方背书。
