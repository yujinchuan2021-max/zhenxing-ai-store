"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  applyConnectableTaxonomy,
  categoryForConnectableProduct
} = require("../catalog/ai-connectable-taxonomy.cjs");

const root = path.resolve(__dirname, "..");
const catalogPaths = [
  path.join(root, "admin", "data", "catalog-v1.json"),
  path.join(root, "catalog", "catalog-v1.example.json")
];
const verifiedAt = "2026-08-02T13:00:00.000Z";

function vendor(id, name, mark, color, description, website, tutorial) {
  return { id, enabled: true, name, initial: mark[0].toUpperCase(), mark, iconUrl: "", color,
    description, website, tutorial, products: [] };
}

function product(id, name, description, website, tutorial, desktop = true) {
  return {
    id, enabled: true, order: 0, directoryKind: "ai-connectable", name,
    kind: desktop ? "桌面端" : "其他产品",
    category: categoryForConnectableProduct(id), description, website, tutorial,
    productType: desktop ? "desktop-official" : "web",
    moduleId: desktop ? "desktop-official" : "web-link",
    installProfileId: "", requirements: [],
    installPolicy: desktop ? "open-official-download" : "open-product-website",
    downloadPolicy: desktop ? "official-page" : "none",
    signaturePolicy: desktop ? "vendor-controlled" : "not-applicable",
    uninstallPolicy: desktop ? "vendor-managed" : "not-managed",
    capabilities: ["website", "tutorial"]
  };
}

const vendors = [
  vendor("blender", "Blender Foundation", "B", "#e87d0d", "维护 Blender 开源 3D 创作套件。", "https://www.blender.org/", "https://www.blender.org/support/"),
  vendor("godot", "Godot Engine", "G", "#478cbf", "维护 Godot 开源游戏与交互应用引擎。", "https://godotengine.org/", "https://docs.godotengine.org/"),
  vendor("epic-games", "Epic Games", "E", "#202020", "提供 Unreal Engine 与实时 3D 创作平台。", "https://www.epicgames.com/", "https://dev.epicgames.com/documentation/en-us/unreal-engine/"),
  vendor("ableton", "Ableton", "A", "#111111", "提供 Live 音乐制作与现场演出软件。", "https://www.ableton.com/", "https://help.ableton.com/"),
  vendor("obs-project", "OBS Project", "O", "#302e31", "维护 OBS Studio 直播与录制软件。", "https://obsproject.com/", "https://obsproject.com/kb/"),
  vendor("n8n", "n8n", "n", "#ea4b71", "提供可自托管的工作流自动化平台。", "https://n8n.io/", "https://docs.n8n.io/"),
  vendor("uipath", "UiPath", "U", "#fa4616", "提供桌面 RPA 与企业自动化平台。", "https://www.uipath.com/", "https://docs.uipath.com/"),
  vendor("open-home-foundation", "Open Home Foundation", "H", "#18bcf2", "维护 Home Assistant 开源智能家居平台。", "https://www.openhomefoundation.org/", "https://www.home-assistant.io/docs/"),
  vendor("adobe", "Adobe", "A", "#eb1000", "提供 Creative Cloud 创意软件与服务。", "https://www.adobe.com/", "https://helpx.adobe.com/creative-cloud.html"),
  vendor("autodesk", "Autodesk", "A", "#0696d7", "提供设计、工程、制造与 3D 创作软件。", "https://www.autodesk.com/", "https://help.autodesk.com/"),
  vendor("trimble", "Trimble", "T", "#0063a3", "提供 SketchUp 等建筑、空间与建模产品。", "https://www.trimble.com/", "https://help.sketchup.com/"),
  vendor("blackmagic-design", "Blackmagic Design", "B", "#222222", "提供 DaVinci Resolve 视频后期制作软件。", "https://www.blackmagicdesign.com/", "https://www.blackmagicdesign.com/support/"),
  vendor("zapier", "Zapier", "Z", "#ff4f00", "提供连接应用与自动化工作流的平台。", "https://zapier.com/", "https://docs.zapier.com/mcp/get-started/quickstart"),
  vendor("monday", "monday.com", "M", "#6161ff", "提供项目、流程与团队协作平台。", "https://monday.com/", "https://developer.monday.com/api-reference/docs/integrate-with-monday-mcp"),
  vendor("mongodb", "MongoDB", "M", "#00ed64", "提供文档数据库、Atlas 云服务与开发者数据平台。", "https://www.mongodb.com/", "https://www.mongodb.com/docs/mcp-server/"),
  vendor("grafana", "Grafana Labs", "G", "#f46800", "提供可观测性、仪表盘与监控平台。", "https://grafana.com/", "https://grafana.com/docs/grafana/latest/developer-resources/mcp/set-up/"),
  vendor("datadog", "Datadog", "D", "#632ca6", "提供云应用可观测性与安全平台。", "https://www.datadoghq.com/", "https://docs.datadoghq.com/mcp_server/"),
  vendor("elastic", "Elastic", "E", "#00bfb3", "提供搜索、分析、可观测性与安全数据平台。", "https://www.elastic.co/", "https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/mcp-server"),
  vendor("roblox", "Roblox", "R", "#e2231a", "提供 Roblox Studio 游戏与交互体验创作平台。", "https://create.roblox.com/", "https://create.roblox.com/docs/studio/"),
  vendor("penpot", "Penpot", "P", "#6e6df6", "提供开源协作式界面设计平台。", "https://penpot.app/", "https://help.penpot.app/mcp/"),
  vendor("webflow", "Webflow", "W", "#146ef5", "提供可视化网站设计、CMS 与发布平台。", "https://webflow.com/", "https://developers.webflow.com/mcp/reference/getting-started"),
  vendor("miro", "Miro", "M", "#ffd02f", "提供协作白板与可视化工作空间。", "https://miro.com/", "https://help.miro.com/hc/en-us/articles/31624028247058-Miro-MCP-Server-overview"),
  vendor("mathworks", "MathWorks", "M", "#d95319", "提供 MATLAB、Simulink 与工程计算产品。", "https://www.mathworks.com/", "https://www.mathworks.com/products/matlab-mcp-server.html"),
  vendor("nvidia", "NVIDIA", "N", "#76b900", "提供 GPU、AI、仿真与开发平台。", "https://developer.nvidia.com/omniverse", "https://developer.nvidia.com/omniverse"),
];

const products = [
  ["blender", product("blender", "Blender", "Windows 3D 建模、动画和渲染工具，可通过经过审核的社区 MCP 接入 AI 客户端。", "https://www.blender.org/download/", "https://github.com/ahujasid/blender-mcp")],
  ["godot", product("godot-engine", "Godot Engine", "Windows 游戏与交互应用引擎，可通过社区 MCP 为 AI 工具提供项目上下文。", "https://godotengine.org/download/windows/", "https://github.com/tomyud1/godot-mcp")],
  ["epic-games", product("unreal-engine", "Unreal Engine", "实时 3D 与游戏开发引擎；社区 MCP 只能在用户指定项目中工作。", "https://www.unrealengine.com/download", "https://github.com/GenOrca/unreal-mcp")],
  ["ableton", product("ableton-live", "Ableton Live", "Windows 音乐制作软件；社区连接器可控制当前 Live Session。", "https://www.ableton.com/en/trial/", "https://github.com/uisato/ableton-mcp-extended")],
  ["obs-project", product("obs-studio", "OBS Studio", "Windows 直播与录制软件；实验性社区 MCP 通过本机 obs-websocket 连接。", "https://obsproject.com/download", "https://github.com/sbroenne/mcp-server-obs")],
  ["n8n", product("n8n-platform", "n8n", "云端或自托管工作流自动化平台，内置官方实例级 MCP Server。", "https://n8n.io/", "https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/", false)],
  ["uipath", product("uipath-platform", "UiPath Platform", "通过 Orchestrator 官方 MCP Server 把经过授权的 RPA 工件提供给 AI 客户端。", "https://cloud.uipath.com/", "https://docs.uipath.com/orchestrator/automation-cloud/latest/user-guide/about-mcp-servers", false)],
  ["open-home-foundation", product("home-assistant", "Home Assistant", "智能家居与设备自动化平台，内置官方 Model Context Protocol Server 集成。", "https://www.home-assistant.io/installation/windows/", "https://www.home-assistant.io/integrations/mcp_server/", false)],
  ["adobe", product("adobe-creative-cloud", "Adobe Creative Cloud", "Adobe 创意工具可通过官方 Adobe for creativity 连接器接入 Claude。", "https://www.adobe.com/creativecloud.html", "https://developer.adobe.com/adobe-for-creativity/getting-started/")],
  ["autodesk", product("autodesk-fusion", "Autodesk Fusion", "Windows CAD 与制造设计软件，内置官方本地 Fusion MCP。", "https://www.autodesk.com/products/fusion-360/", "https://help.autodesk.com/view/fusion360/ENU/?guid=FMCP-OVERVIEW")],
  ["trimble", product("sketchup", "SketchUp", "Windows 3D 建模产品，官方 Claude Connector 当前用于生成新的 SKP 文件。", "https://sketchup.trimble.com/en/download/all", "https://help.sketchup.com/pl/sketchup-claude-connector")],
  ["blackmagic-design", product("davinci-resolve", "DaVinci Resolve", "Windows 视频剪辑、调色、音频与 VFX 软件；社区 MCP 需固定版本审计后再安装。", "https://www.blackmagicdesign.com/products/davinciresolve", "https://github.com/samuelgursky/davinci-resolve-mcp")],
  ["canva", product("affinity", "Affinity", "Windows 图像、矢量与排版工具，官方 AI Connector 当前只提供 Claude 接入说明。", "https://www.affinity.studio/", "https://www.canva.com/newsroom/news/canva-create-2026-launches/")],
  ["zapier", product("zapier-platform", "Zapier", "把用户授权的应用动作连接到支持 MCP 的 AI 工具；它是在线自动化平台，不是 AI 工具。", "https://zapier.com/", "https://docs.zapier.com/mcp/get-started/quickstart", false)],
  ["monday", product("monday-work-management", "monday Work Management", "通过官方 MCP 把用户有权限的工作区、看板和事项接入 AI 工具。", "https://monday.com/work-management", "https://developer.monday.com/api-reference/docs/integrate-with-monday-mcp", false)],
  ["mongodb", product("mongodb-platform", "MongoDB Platform", "通过官方 MCP 查询或管理 MongoDB 与 Atlas；生产数据默认建议只读。", "https://www.mongodb.com/products/platform/atlas-database", "https://www.mongodb.com/docs/mcp-server/", false)],
  ["grafana", product("grafana-platform", "Grafana", "Grafana OSS、Enterprise 或 Cloud 可通过官方 MCP 向 AI 工具提供受 RBAC 约束的可观测性数据。", "https://grafana.com/grafana/", "https://grafana.com/docs/grafana/latest/developer-resources/mcp/set-up/", false)],
  ["datadog", product("datadog-platform", "Datadog Platform", "通过官方 MCP 向 AI 工具提供 APM、日志、指标、监控和安全上下文。", "https://www.datadoghq.com/", "https://docs.datadoghq.com/mcp_server/", false)],
  ["elastic", product("elastic-platform", "Elastic Platform", "通过 Kibana Agent Builder 官方 MCP 接入受 Space、索引和工具权限约束的数据。", "https://www.elastic.co/", "https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/mcp-server", false)],
  ["roblox", product("roblox-studio", "Roblox Studio", "Windows 游戏与交互体验创作工具，Studio 内置官方 MCP Server。", "https://create.roblox.com/docs/studio/setup", "https://create.roblox.com/docs/studio/mcp")],
  ["penpot", product("penpot-platform", "Penpot", "在线或自托管的开源设计平台，可通过官方远程 MCP 接入 AI 工具。", "https://penpot.app/", "https://help.penpot.app/mcp/", false)],
  ["webflow", product("webflow-platform", "Webflow", "浏览器中的网站设计、CMS 与发布平台，可通过官方远程 MCP 接入。", "https://webflow.com/", "https://developers.webflow.com/mcp/reference/getting-started", false)],
  ["miro", product("miro-workspace", "Miro", "协作白板与工作空间，可通过官方远程 MCP 读取或更新用户授权的看板。", "https://miro.com/", "https://help.miro.com/hc/en-us/articles/31625301583890-How-to-enable-Miro-s-MCP-Server-user-guide", false)],
  ["mathworks", product("matlab", "MATLAB", "Windows 工程计算与编程产品；官方 MCP 可检查、执行代码和运行测试。", "https://www.mathworks.com/products/matlab.html", "https://www.mathworks.com/products/matlab-mcp-server.html")],
  ["mathworks", product("simulink", "Simulink", "依赖 MATLAB 与相应许可证的模型化设计与仿真产品；官方 Agentic Toolkit 建立在 MATLAB MCP 上。", "https://www.mathworks.com/products/simulink.html", "https://www.mathworks.com/products/simulink-agentic-toolkit.html")],
  ["nvidia", product("nvidia-omniverse", "NVIDIA Omniverse", "面向 3D、USD 与工业仿真的开发平台；官方 MCP 与 Skills 首版只提供说明入口。", "https://developer.nvidia.com/omniverse", "https://github.com/NVIDIA-Omniverse", false)]
];

function target(productId, compatibility) {
  return { productId, compatibility, moduleId: "resource-link", installProfileId: "",
    capabilities: ["website"], enabled: true };
}

const resources = [
  ["blender-mcp", "Blender MCP", "blender", ["blender"], "mcp", "reviewed-community", "https://github.com/ahujasid/blender-mcp", ["claude-desktop", "claude-code", "cursor-desktop"], "可读写 Blender 场景并执行 Python；任意代码、删除和外部素材导入必须确认。", "禁用并删除 Blender add-on，再移除目标 AI 工具配置；保留 Blender 与工程。"],
  ["godot-mcp", "Godot MCP", "godot", ["godot-engine"], "mcp", "reviewed-community", "https://github.com/tomyud1/godot-mcp", ["claude-desktop", "claude-code", "cursor-desktop", "windsurf-editor"], "仅授权用户选择的 Godot 工程；运行、删除节点和批量改写必须确认。", "删除项目插件与客户端配置；保留 Godot 和项目。"],
  ["unreal-mcp", "Unreal MCP", "epic-games", ["unreal-engine"], "mcp", "reviewed-community", "https://github.com/GenOrca/unreal-mcp", ["claude-desktop", "cursor-desktop", "github-copilot"], "仅授权单个 Unreal 项目；Python、删除资产、构建和打包必须确认。", "关闭编辑器后移除项目插件和客户端配置；保留引擎与项目内容。"],
  ["ableton-mcp-extended", "Ableton MCP Extended", "ableton", ["ableton-live"], "mcp", "reviewed-community", "https://github.com/uisato/ableton-mcp-extended", ["claude-desktop", "cursor-desktop"], "会修改当前 Live Session；写入前提示保存，批量生成与外部音频导入必须确认。", "停用 Control Surface，删除 Remote Script 和客户端配置；保留 Live Set 与素材库。"],
  ["obs-mcp", "MCP Server for OBS", "obs-project", ["obs-studio"], "mcp", "community", "https://github.com/sbroenne/mcp-server-obs", ["github-copilot", "claude-desktop", "cursor-desktop", "windsurf-editor"], "实验性资源；开始直播/录制、截图和切换敏感场景必须逐次确认。", "删除客户端连接并关闭或轮换 OBS WebSocket；保留 OBS 配置与录制文件。"],
  ["n8n-mcp-server", "n8n MCP Server", "n8n", ["n8n-platform"], "mcp", "official", "https://blog.n8n.io/n8n-mcp-server/", ["claude-desktop", "claude-code", "codex-cli", "chatgpt-desktop", "cursor-desktop", "windsurf-editor"], "按工作区最小授权；创建、更新和运行工作流必须确认。", "关闭 MCP 并撤销令牌；保留实例、卷、凭据和工作流。"],
  ["uipath-mcp-server", "UiPath MCP Server", "uipath", ["uipath-platform"], "mcp", "official", "https://docs.uipath.com/orchestrator/automation-cloud/latest/user-guide/about-mcp-servers", ["github-copilot", "chatgpt-desktop"], "按 Orchestrator Folder 最小授权；每次运行 RPA Job 都必须确认。", "在 Orchestrator 停用 MCP Server 并撤销 OAuth/PAT；保留流程和作业记录。"],
  ["home-assistant-mcp-server", "Home Assistant MCP Server", "open-home-foundation", ["home-assistant"], "mcp", "official", "https://www.home-assistant.io/integrations/mcp_server/", ["chatgpt-desktop", "claude-code"], "只暴露用户选择的实体；设备控制默认关闭，门锁、安防等敏感操作逐次确认。", "删除集成并撤销令牌；保留 Home Assistant 实例、配置和自动化。"],
  ["adobe-for-creativity", "Adobe for creativity", "adobe", ["adobe-creative-cloud"], "connector", "official", "https://developer.adobe.com/adobe-for-creativity/", ["claude-desktop"], "用户明确选择的文件会发送到 Adobe 与 Claude 云服务；组织授权由用户完成。", "在 Claude 断开连接器并按需在 Adobe 账号撤销授权；保留 Creative Cloud 软件与资产。"],
  ["autodesk-fusion-mcp", "Autodesk Fusion MCP", "autodesk", ["autodesk-fusion"], "mcp", "official", "https://help.autodesk.com/view/fusion360/ENU/?guid=FMCP-OVERVIEW", ["claude-desktop", "cursor-desktop"], "只允许 127.0.0.1；运行脚本、删除对象和覆盖设计必须确认。", "删除客户端连接并在 Fusion 关闭 MCP Server；保留 Fusion 与设计数据。"],
  ["sketchup-claude-connector", "SketchUp Connector for Claude", "trimble", ["sketchup"], "connector", "official", "https://help.sketchup.com/pl/sketchup-claude-connector", ["claude-desktop"], "当前只生成新的 SKP 文件，不能描述为接管用户本机 SketchUp。", "在 Claude 断开 Connector 并撤销 Trimble 授权；保留 SketchUp 与用户模型。"],
  ["davinci-resolve-mcp", "DaVinci Resolve MCP", "blackmagic-design", ["davinci-resolve"], "mcp", "reviewed-community", "https://github.com/samuelgursky/davinci-resolve-mcp", ["claude-desktop", "claude-code", "cursor-desktop", "github-copilot", "windsurf-editor"], "固定版本审核前只展示说明；修改项目、素材、渲染设置和脚本必须确认。", "只删除安装收据记录的 MCP 配置、托管副本和虚拟环境；保留 Resolve、项目和媒体。"],
  ["affinity-ai-connector", "Affinity AI Connector", "canva", ["affinity"], "connector", "official", "https://www.canva.com/newsroom/news/canva-create-2026-launches/", ["claude-desktop"], "官方撤销文档尚未完整；生成脚本首次运行必须展示写入范围并确认。", "当前只提供官方说明；断开连接时保留 Affinity、文档与用户脚本。"],
  ["zapier-mcp", "Zapier MCP", "zapier", ["zapier-platform"], "mcp", "official", "https://docs.zapier.com/mcp/get-started/quickstart", ["chatgpt-desktop", "claude-desktop", "claude-code", "cursor-desktop", "windsurf-editor"], "只暴露用户在 Zapier 选择的应用与动作；跨应用写入、发送和删除必须确认。", "断开目标 AI 工具并撤销 Zapier 连接；保留 Zap、任务历史和应用数据。"],
  ["monday-platform-mcp", "monday Platform MCP", "monday", ["monday-work-management"], "mcp", "official", "https://developer.monday.com/api-reference/docs/integrate-with-monday-mcp", ["chatgpt-desktop", "claude-desktop"], "继承 monday.com 用户权限；创建、更新和删除看板、事项前必须确认。", "断开 OAuth 或撤销 Token；保留工作区、看板、事项和活动记录。"],
  ["mongodb-mcp-server", "MongoDB MCP Server", "mongodb", ["mongodb-platform"], "mcp", "official", "https://www.mongodb.com/docs/mcp-server/", ["claude-desktop", "claude-code", "cursor-desktop", "github-copilot", "windsurf-editor"], "默认使用只读模式与只读数据库账号；写入、索引和 Atlas 管理必须确认。", "删除客户端连接并撤销凭据；保留数据库、集合、索引与 Atlas 集群。"],
  ["grafana-mcp", "Grafana MCP", "grafana", ["grafana-platform"], "mcp", "official", "https://grafana.com/docs/grafana/latest/developer-resources/mcp/set-up/", ["claude-desktop", "cursor-desktop", "github-copilot"], "默认禁用写操作并使用最小 RBAC；仪表盘、告警和事件变更必须确认。", "删除客户端连接并撤销服务账号令牌；保留 Grafana 实例、仪表盘、数据源和告警。"],
  ["datadog-mcp-server", "Datadog MCP Server", "datadog", ["datadog-platform"], "mcp", "official", "https://docs.datadoghq.com/mcp_server/", ["codex-cli", "claude-code", "cursor-desktop"], "按站点和团队最小授权；监控写入、敏感日志查询和安全操作必须确认。", "断开 MCP 并撤销凭据；保留 Datadog 监控、日志、指标和安全数据。"],
  ["elastic-agent-builder-mcp", "Elastic Agent Builder MCP", "elastic", ["elastic-platform"], "mcp", "official", "https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/mcp-server", ["claude-desktop", "cursor-desktop"], "API Key 或 OAuth 只授权指定 Space、索引和只读工具；写操作必须确认。", "删除客户端连接并撤销 API Key/OAuth；保留索引、Kibana Space 和已保存对象。"],
  ["roblox-studio-mcp-server", "Roblox Studio MCP Server", "roblox", ["roblox-studio"], "mcp", "official", "https://create.roblox.com/docs/studio/mcp", ["codex-cli", "claude-code", "claude-desktop", "cursor-desktop", "gemini-cli", "github-copilot"], "只连接受信任客户端；写脚本、执行 Luau、上传资产、模拟键鼠和 Playtest 必须确认。", "关闭 Studio MCP 开关并删除客户端配置；保留 Roblox Studio、Place、脚本与发布记录。"],
  ["penpot-mcp-server", "Penpot MCP Server", "penpot", ["penpot-platform"], "mcp", "official", "https://help.penpot.app/mcp/", ["claude-code", "codex-cli", "cursor-desktop", "github-copilot"], "包含 userToken 的连接 URL 不得进入日志；修改页面、图层、样式和本地文件导入必须确认。", "删除客户端连接、在 Penpot 停用 MCP 并轮换 Key；保留账号、文件和组件库。"],
  ["webflow-mcp-server", "Webflow MCP Server", "webflow", ["webflow-platform"], "mcp", "official", "https://developers.webflow.com/mcp/reference/getting-started", ["claude-desktop", "claude-code", "cursor-desktop", "windsurf-editor"], "继承 Webflow 角色；发布、删除页面或 CMS、修改域名与批量变更必须确认。", "删除客户端连接、撤销 OAuth 并停用 Bridge App；保留工作区、站点、CMS 和发布历史。"],
  ["miro-mcp-server", "Miro MCP Server", "miro", ["miro-workspace"], "mcp", "official", "https://help.miro.com/hc/en-us/articles/31625301583890-How-to-enable-Miro-s-MCP-Server-user-guide", ["claude-code", "cursor-desktop", "gemini-cli", "github-copilot", "windsurf-editor"], "只读取用户授权的 Team 和看板；写入、删除对象和向模型发送看板内容必须确认。", "删除客户端连接并撤销 Miro OAuth；保留 Team、看板和附件。"],
  ["matlab-mcp-core-server", "MATLAB MCP Core Server", "mathworks", ["matlab"], "mcp", "official", "https://github.com/matlab/matlab-mcp-core-server", ["claude-desktop", "claude-code", "gemini-cli", "github-copilot"], "代码检查可只读；代码执行、文件写入、测试、启动或退出 MATLAB 必须确认并限制到用户项目。", "只移除枕星 AI 收据内的 MCP 与客户端配置；保留 MATLAB、许可证、Toolbox 和工程。"],
  ["matlab-agentic-toolkit", "MATLAB Agentic Toolkit", "mathworks", ["matlab"], "skill", "official", "https://github.com/matlab/matlab-agentic-toolkit", ["codex-cli", "claude-code", "github-copilot"], "官方 Toolkit 首版只提供说明入口；启用代码执行、文件写入或扩展安装前必须确认。", "只移除枕星 AI 收据内的 Toolkit、Skills 与客户端配置；保留 MATLAB、许可证、Toolbox 和工程。"],
  ["simulink-agentic-toolkit", "Simulink Agentic Toolkit", "mathworks", ["simulink"], "skill", "official", "https://github.com/matlab/simulink-agentic-toolkit", ["codex-cli", "claude-code", "gemini-cli", "github-copilot"], "依赖 MATLAB、Simulink 与 MATLAB MCP；模型编辑、仿真和测试必须展示作用范围并确认。", "只移除枕星 AI 收据内的 Toolkit、Skills 和客户端配置；保留 MATLAB、Simulink、许可证与模型。"],
  ["nvidia-omniverse-mcp", "NVIDIA Omniverse MCP", "nvidia", ["nvidia-omniverse"], "mcp", "official", "https://github.com/NVIDIA-Omniverse", ["claude-desktop", "cursor-desktop"], "首版只提供官方说明；修改 USD、执行代码、渲染、物理仿真和云 API 调用必须确认。", "只移除枕星 AI 收据内的连接配置；保留 Omniverse 工程、USD、纹理和缓存。"],
  ["nvidia-omniverse-agent-skills", "NVIDIA Omniverse Agent Skills", "nvidia", ["nvidia-omniverse"], "skill", "official", "https://github.com/NVIDIA-Omniverse", ["claude-code", "codex-cli", "cursor-desktop"], "官方 Skills 首版只提供资源入口；启用前必须审核固定版本、工具范围与本地写权限。", "只移除枕星 AI 收据内的 Skill 配置；保留 Omniverse 工程、SDK 与用户文件。"]
];

function ensureVendor(catalog, spec) {
  const existing = catalog.vendors.find((entry) => entry.id === spec.id);
  if (existing) return existing;
  spec.order = Math.max(-1, ...catalog.vendors.map((entry) => entry.order ?? 0)) + 1;
  catalog.vendors.push(spec);
  return spec;
}

function upsertProduct(catalog, vendorEntry, spec) {
  const owner = catalog.vendors.find((entry) =>
    entry.products.some((candidate) => candidate.id === spec.id)
  );
  if (owner && owner.id !== vendorEntry.id) throw new Error(`产品 ID 冲突：${spec.id}`);
  const index = vendorEntry.products.findIndex((entry) => entry.id === spec.id);
  const previous = index >= 0 ? vendorEntry.products[index] : null;
  if (previous && previous.directoryKind !== "ai-connectable") {
    throw new Error(`拒绝覆盖 AI 工具产品：${spec.id}`);
  }
  const next = { ...spec,
    enabled: previous?.enabled ?? true,
    order: previous?.order ?? Math.max(-1, ...vendorEntry.products.map((entry) => entry.order ?? 0)) + 1
  };
  if (index >= 0) vendorEntry.products[index] = next;
  else vendorEntry.products.push(next);
}

function upsertResource(catalog, spec) {
  const [id, name, vendorId, sourceProductIds, type, sourceKind, website,
    targetIds, permission, uninstallPlan] = spec;
  const productIds = new Set(catalog.vendors.flatMap((entry) => entry.products.map((item) => item.id)));
  const targets = targetIds.filter((targetId) => productIds.has(targetId))
    .map((targetId) => target(targetId, sourceKind === "official" ? "official" : "verified"));
  if (!targets.length) return;
  const index = catalog.resources.findIndex((entry) => entry.id === id);
  const previous = index >= 0 ? catalog.resources[index] : null;
  const next = {
    id, enabled: previous?.enabled ?? true,
    order: previous?.order ?? Math.max(-1, ...catalog.resources.map((entry) => entry.order ?? 0)) + 1,
    name, resourceTypes: [type], description: permission, website, tutorial: website,
    publisherVendorId: vendorId,
    publisher: catalog.vendors.find((entry) => entry.id === vendorId).name,
    sourceKind, sourceProductIds, targets,
    versionRef: sourceKind === "official" ? "rolling-official-service" : "review-required",
    requestedPermissions: [permission],
    credentialRequirements: [sourceKind === "official" ? "账号、OAuth 或令牌由厂商与目标 AI 工具管理，目录不保存凭据。" : "社区资源固定版本审核前只提供说明入口，不写入本地配置。"],
    installScope: "仅打开经过核验的接入说明；当前不写入本地配置。",
    uninstallPlan, provenanceEvidence: [website], lastVerifiedAt: verifiedAt
  };
  if (index >= 0) catalog.resources[index] = next;
  else catalog.resources.push(next);
}

for (const catalogPath of catalogPaths) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  catalog.resources ||= [];
  catalog.resourceStores ||= [];
  if (!catalog.resourceStores.some((store) => store.id === "connector")) {
    catalog.resourceStores.push({ id: "connector", label: "连接器商店", enabled: true,
      order: Math.max(-1, ...catalog.resourceStores.map((store) => store.order ?? 0)) + 1 });
  }
  for (const spec of vendors) ensureVendor(catalog, structuredClone(spec));
  for (const [vendorId, spec] of products) {
    upsertProduct(catalog, catalog.vendors.find((entry) => entry.id === vendorId), spec);
  }
  for (const spec of resources) upsertResource(catalog, spec);
  applyConnectableTaxonomy(catalog);
  catalog.updatedAt = verifiedAt;
  validateCatalog(catalog);
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  process.stdout.write(`Updated ${catalogPath}\n`);
}
