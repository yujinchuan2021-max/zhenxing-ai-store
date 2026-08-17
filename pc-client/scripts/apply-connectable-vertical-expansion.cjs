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
const verifiedAt = "2026-08-02T15:48:46.000Z";

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
  vendor("microsoft", "Microsoft", "M", "#2563EB", "提供面向个人与组织的 AI 助手、开发工具和生产力服务。", "https://www.microsoft.com/ai", "https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-microsoft-copilot"),
  vendor("amazon", "Amazon Web Services", "A", "#ff9900", "提供云计算、开发者工具与人工智能服务。", "https://aws.amazon.com/", "https://github.com/awslabs/mcp"),
  vendor("google", "Google", "G", "#4285f4", "提供模型、生产力工具和开发者人工智能服务。", "https://ai.google", "https://ai.google.dev"),
  vendor("gitlab", "GitLab", "G", "#fc6d26", "提供代码托管、DevSecOps、CI/CD 与项目协作平台。", "https://about.gitlab.com/", "https://docs.gitlab.com/user/model_context_protocol/mcp_server/"),
  vendor("salesforce", "Salesforce", "S", "#00a1e0", "提供客户关系管理、数据与业务自动化平台。", "https://www.salesforce.com/", "https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/hosted-mcp-servers-overview.html"),
  vendor("servicenow", "ServiceNow", "S", "#293e40", "提供企业服务管理、工作流与自动化平台。", "https://www.servicenow.com/", "https://www.servicenow.com/docs/r/intelligent-experiences/create-mcp-server.html"),
  vendor("hashicorp", "HashiCorp", "H", "#000000", "提供 Terraform 基础设施即代码及云基础设施管理工具。", "https://www.hashicorp.com/", "https://developer.hashicorp.com/terraform/mcp-server/deploy"),
  vendor("pulumi", "Pulumi", "P", "#8a3391", "提供使用通用编程语言管理云基础设施的平台。", "https://www.pulumi.com/", "https://www.pulumi.com/docs/ai/mcp-server/"),
  vendor("browserstack", "BrowserStack", "B", "#f5b400", "提供真实设备与浏览器云测试平台。", "https://www.browserstack.com/", "https://www.browserstack.com/docs/browserstack-mcp-server/overview"),
  vendor("circleci", "CircleCI", "C", "#343434", "提供持续集成、持续交付与软件交付自动化平台。", "https://circleci.com/", "https://circleci.com/docs/guides/toolkit/circleci-mcp-overview/"),
  vendor("clickup", "ClickUp", "C", "#7b68ee", "提供项目、任务、文档与团队生产力工作空间。", "https://clickup.com/", "https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server"),
  vendor("box", "Box", "B", "#0061d5", "提供企业内容云、文件协作与内容智能平台。", "https://www.box.com/", "https://developer.box.com/guides/box-mcp"),
  vendor("pipedream", "Pipedream", "P", "#111111", "提供 API 集成、工作流与开发者自动化平台。", "https://pipedream.com/", "https://pipedream.com/docs/connect/mcp"),
  vendor("make", "Make", "M", "#6d00cc", "提供可视化工作流与跨应用自动化平台。", "https://www.make.com/", "https://help.make.com/make-mcp-server"),
  vendor("zoom", "Zoom", "Z", "#2d8cff", "提供会议、聊天、日历、文档与协作工作空间。", "https://www.zoom.com/", "https://developers.zoom.us/docs/mcp/zoom-mcp-server/"),
  vendor("shopify", "Shopify", "S", "#95bf47", "提供电商建站、商品、购物车与商家服务平台。", "https://www.shopify.com/", "https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront"),
  vendor("wolfram-research", "Wolfram Research", "W", "#dd1100", "提供 Mathematica、Wolfram Cloud 与计算知识服务。", "https://www.wolfram.com/", "https://www.wolfram.com/artificial-intelligence/mcp/"),
  vendor("ansys", "Ansys", "A", "#ffb71b", "提供工程仿真、光子设计与数字工程软件。", "https://www.ansys.com/", "https://developer.ansys.com/docs/lumerical"),
  vendor("cesium", "Cesium", "C", "#6cad45", "提供 CesiumJS 与开放地理空间 3D 开发平台。", "https://cesium.com/", "https://github.com/CesiumGS/cesium-ai-integrations"),
  vendor("siemens", "Siemens", "S", "#009999", "提供工业软件、自动化与 Xcelerator 开发者平台。", "https://www.siemens.com/", "https://developer.siemens.com/"),
  vendor("esri", "Esri", "E", "#007ac2", "提供 ArcGIS 地理信息与位置服务平台。", "https://www.esri.com/", "https://www.esri.com/en-us/arcgis/products/arcgis-location-platform/overview"),
  vendor("synopsys", "Synopsys", "S", "#5b2c83", "提供芯片设计、验证与软件安全产品。", "https://www.synopsys.com/", "https://www.synopsys.com/blogs/chip-design/using-ai-to-debug-more-quickly-and-accurately.html"),
  vendor("databricks", "Databricks", "D", "#ff3621", "提供统一的数据、分析与人工智能平台。", "https://www.databricks.com/", "https://docs.databricks.com/aws/en/agents/mcp/managed-mcp"),
  vendor("snowflake", "Snowflake", "S", "#29b5e8", "提供云端数据、分析与人工智能平台。", "https://www.snowflake.com/", "https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp"),
  vendor("redis", "Redis", "R", "#dc382d", "提供实时数据平台、缓存、向量检索与数据库服务。", "https://redis.io/", "https://redis.io/docs/latest/integrate/redis-mcp/"),
  vendor("neo4j", "Neo4j", "N", "#018bff", "提供图数据库、图分析与知识图谱平台。", "https://neo4j.com/", "https://neo4j.com/docs/mcp/current/"),
  vendor("confluent", "Confluent", "C", "#173361", "提供基于 Apache Kafka 的实时数据流平台。", "https://www.confluent.io/", "https://docs.confluent.io/cloud/current/ai/ai-tools/managed-mcp-server.html"),
  vendor("paypal", "PayPal", "P", "#003087", "提供在线支付、商户与商业服务平台。", "https://www.paypal.com/", "https://developer.paypal.com/community/blog/paypal-model-context-protocol/"),
  vendor("wix", "Wix", "W", "#0c0c0c", "提供网站、应用、内容和在线商业构建平台。", "https://www.wix.com/", "https://dev.wix.com/docs/sdk/articles/use-the-wix-mcp/about-the-wix-mcp"),
  vendor("automattic", "Automattic", "A", "#3858e9", "提供 WordPress.com 等内容发布与网站服务。", "https://automattic.com/", "https://developer.wordpress.com/docs/mcp/"),
  vendor("semrush", "Semrush", "S", "#ff642d", "提供搜索营销、竞争情报与网站分析平台。", "https://www.semrush.com/", "https://developer.semrush.com/api/v3/introduction/semrush-mcp/"),
  vendor("intercom", "Intercom", "I", "#1f8ded", "提供客户服务、消息沟通与 Fin 人工智能客服平台。", "https://www.intercom.com/", "https://developers.intercom.com/docs/guides/mcp"),
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
  ["nvidia", product("nvidia-omniverse", "NVIDIA Omniverse", "面向 3D、USD 与工业仿真的开发平台；官方 MCP 与 Skills 首版只提供说明入口。", "https://developer.nvidia.com/omniverse", "https://github.com/NVIDIA-Omniverse", false)],
  ["gitlab", product("gitlab-platform", "GitLab", "代码托管、DevSecOps、CI/CD 与项目协作平台，可通过官方 MCP 接入 AI 编程工具。", "https://gitlab.com/", "https://docs.gitlab.com/user/model_context_protocol/mcp_server/", false)],
  ["salesforce", product("salesforce-platform", "Salesforce Platform", "客户关系管理、数据与业务自动化平台，可通过官方托管 MCP 向授权 AI 客户端开放能力。", "https://www.salesforce.com/", "https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/hosted-mcp-servers-overview.html", false)],
  ["servicenow", product("servicenow-platform", "ServiceNow AI Platform", "企业服务管理与工作流平台，可由管理员创建 MCP Server 并选择允许的工具。", "https://www.servicenow.com/", "https://www.servicenow.com/docs/r/intelligent-experiences/create-mcp-server.html", false)],
  ["microsoft", product("azure-devops", "Azure DevOps", "代码、工作项、测试与流水线平台，可通过 Microsoft 官方 MCP 接入 AI 编程工具。", "https://azure.microsoft.com/products/devops", "https://github.com/microsoft/azure-devops-mcp", false)],
  ["hashicorp", product("terraform-platform", "Terraform", "基础设施即代码与 HCP Terraform 平台，可通过官方 MCP 查询 Registry 与授权组织资源。", "https://developer.hashicorp.com/terraform", "https://developer.hashicorp.com/terraform/mcp-server/deploy", false)],
  ["pulumi", product("pulumi-cloud", "Pulumi Cloud", "云基础设施管理平台，可通过官方托管 MCP 查询 Stack、Registry 与委派自动化任务。", "https://www.pulumi.com/product/", "https://www.pulumi.com/docs/ai/mcp-server/", false)],
  ["browserstack", product("browserstack-test-platform", "BrowserStack Test Platform", "真实设备与浏览器云测试平台，可通过官方 MCP 运行、调试和管理测试。", "https://www.browserstack.com/", "https://www.browserstack.com/docs/browserstack-mcp-server/overview", false)],
  ["circleci", product("circleci-platform", "CircleCI", "持续集成与交付平台，可通过官方托管 MCP 检查、重跑或取消流水线。", "https://circleci.com/", "https://circleci.com/docs/guides/toolkit/circleci-mcp-overview/", false)],
  ["clickup", product("clickup-workspace", "ClickUp Workspace", "任务、文档与团队协作工作空间，可通过官方远程 MCP 接入授权 AI 客户端。", "https://clickup.com/", "https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server", false)],
  ["box", product("box-content-cloud", "Box Content Cloud", "企业文件与内容协作平台，可通过官方托管 MCP 搜索和处理授权内容。", "https://www.box.com/", "https://developer.box.com/guides/box-mcp", false)],
  ["pipedream", product("pipedream-platform", "Pipedream", "连接 API 与应用的开发者自动化平台，可通过官方 MCP 使用用户授权的工具。", "https://pipedream.com/", "https://pipedream.com/docs/connect/mcp", false)],
  ["make", product("make-platform", "Make", "可视化跨应用工作流平台，可通过官方 MCP 运行场景或访问受限管理能力。", "https://www.make.com/", "https://help.make.com/make-mcp-server", false)],
  ["google", product("google-workspace", "Google Workspace", "Gmail、Drive、Docs、Sheets、Slides、Calendar 与 Chat 办公套件，每个产品使用独立官方 MCP。", "https://workspace.google.com/", "https://developers.google.com/workspace/guides/configure-mcp-servers", false)],
  ["zoom", product("zoom-workplace", "Zoom Workplace", "会议、聊天、日历、邮件、白板与协作工作空间，可通过官方 MCP 接入授权 AI 客户端。", "https://www.zoom.com/en/products/collaboration-tools/", "https://developers.zoom.us/docs/mcp/zoom-mcp-server/", false)],
  ["shopify", product("shopify-storefront", "Shopify Storefront", "面向商家与开发者的商品、政策和购物车平台，可通过每个商店的官方 MCP 构建 AI 购物体验。", "https://www.shopify.com/", "https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront", false)],
  ["wolfram-research", product("wolfram-mathematica", "Wolfram Mathematica", "桌面科学计算与符号计算产品；官方本地 MCP 可执行 Wolfram Language 并读写 Notebook。", "https://www.wolfram.com/mathematica/", "https://www.wolfram.com/artificial-intelligence/mcp/local/wolfram-mcp-local/")],
  ["wolfram-research", product("wolfram-cloud", "Wolfram Cloud", "云端计算与 Notebook 平台；官方云 MCP 只把用户提出的特定计算请求发送到 Wolfram 服务。", "https://www.wolframcloud.com/", "https://www.wolfram.com/artificial-intelligence/mcp/cloud/wolfram-mcp-cloud/", false)],
  ["ansys", product("ansys-lumerical", "Ansys Lumerical", "商业光子与器件仿真软件；官方 PyLumerical MCP 参考项目依赖已安装产品、许可证和受支持的 Python。", "https://www.ansys.com/products/optics", "https://github.com/ansys/pylumerical-mcp")],
  ["cesium", product("cesiumjs", "CesiumJS", "面向浏览器的开源 3D 地球与地图开发库；官方 AI integrations 仓库目前属于实验性参考实现。", "https://cesium.com/platform/cesiumjs/", "https://github.com/CesiumGS/cesium-ai-integrations", false)],
  ["siemens", product("siemens-xcelerator-developer-portal", "Siemens Xcelerator Developer Portal", "工业开发者文档、产品与 API 目录；官方远程 MCP 当前仅提供开发者门户问答工具。", "https://developer.siemens.com/", "https://developer.siemens.com/ai-registry/developer-portal/developer-portal-mcp.html", false)],
  ["esri", product("arcgis-location-platform", "ArcGIS Location Platform", "在线地图、地理编码、路线和位置服务平台；官方 MCP 支持仍处于 Beta 与 Early Adopter 阶段。", "https://www.esri.com/en-us/arcgis/products/arcgis-location-platform/overview", "https://www.esri.com/arcgis-blog/products/platform/developers/mcp-support-beta-and-arcgis-static-maps-service-in-arcgis-location-platform-release", false)],
  ["synopsys", product("synopsys-verdi", "Synopsys Verdi", "商业芯片调试与验证产品；Verdi Assistant MCP 目前仅有官方能力说明，没有公开安装入口。", "https://www.synopsys.com/verification/debug/verdi.html", "https://www.synopsys.com/blogs/chip-design/using-ai-to-debug-more-quickly-and-accurately.html")],
  ["microsoft", product("azure-cloud-platform", "Microsoft Azure", "云计算平台；官方 Azure MCP 通过 Entra ID 与 Azure RBAC 访问用户授权的资源。", "https://azure.microsoft.com/", "https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/", false)],
  ["amazon", product("aws-cloud-platform", "Amazon Web Services", "云计算平台；官方 MCP 资源包含托管服务与成熟度不同的 AWS Labs 开源服务器。", "https://aws.amazon.com/", "https://docs.aws.amazon.com/general/latest/gr/aws-mcp.html", false)],
  ["databricks", product("databricks-data-intelligence-platform", "Databricks Data Intelligence Platform", "统一数据、分析与 AI 平台；官方托管 MCP 覆盖 Genie、AI Search、SQL 与 Unity Catalog 函数，不同能力仍可能处于 Preview 或 Beta。", "https://www.databricks.com/product/data-intelligence-platform", "https://docs.databricks.com/aws/en/agents/mcp/managed-mcp", false)],
  ["snowflake", product("snowflake-ai-data-cloud", "Snowflake AI Data Cloud", "云端数据平台；Snowflake 托管 MCP 可按账号、数据库和 Schema 暴露受 RBAC 约束的数据与工具。", "https://www.snowflake.com/en/data-cloud/overview/", "https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp", false)],
  ["redis", product("redis-database", "Redis", "实时数据与数据库平台；官方 MCP 可读取、写入、搜索和管理用户指定的 Redis 数据。", "https://redis.io/", "https://redis.io/docs/latest/integrate/redis-mcp/", false)],
  ["neo4j", product("neo4j-graph-database", "Neo4j Graph Database", "图数据库平台；官方 MCP 可探索 Schema 并执行 Cypher，生产环境应使用受限账号和只读模式。", "https://neo4j.com/product/neo4j-graph-database/", "https://neo4j.com/docs/mcp/current/", false)],
  ["confluent", product("confluent-cloud", "Confluent Cloud", "实时数据流平台；官方 Global 与 Regional 托管 MCP 使用不同端点、凭据和可见数据范围。", "https://www.confluent.io/confluent-cloud/", "https://docs.confluent.io/cloud/current/ai/ai-tools/managed-mcp-server.html", false)],
  ["paypal", product("paypal-commerce-platform", "PayPal Commerce Platform", "支付与商业平台；官方 MCP 与 Agent Toolkit 可访问订单、发票、退款和争议等高风险业务能力。", "https://developer.paypal.com/", "https://developer.paypal.com/community/blog/paypal-model-context-protocol/", false)],
  ["wix", product("wix-platform", "Wix Platform", "网站与应用构建平台；官方 MCP 可搜索文档、调用站点 API，并创建或管理 Wix 站点。", "https://dev.wix.com/", "https://dev.wix.com/docs/sdk/articles/use-the-wix-mcp/about-the-wix-mcp", false)],
  ["automattic", product("wordpress-com", "WordPress.com", "托管网站与内容发布平台；官方远程 MCP 通过 OAuth 访问用户启用的 WordPress.com 站点。", "https://wordpress.com/", "https://developer.wordpress.com/docs/mcp/", false)],
  ["semrush", product("semrush-platform", "Semrush", "搜索营销与竞争情报平台；官方远程 MCP 当前为只读，但会访问项目、域名、关键词和流量数据并消耗配额。", "https://www.semrush.com/", "https://developer.semrush.com/api/v3/introduction/semrush-mcp/", false)],
  ["intercom", product("intercom-platform", "Intercom Platform", "客户服务平台；官方远程 MCP 可访问联系人、公司、会话和帮助中心内容，当前只支持美国区工作区。", "https://www.intercom.com/", "https://developers.intercom.com/docs/guides/mcp", false)],
  ["intercom", product("intercom-fin", "Intercom Fin", "人工智能客服产品；Fin Agent API MCP 的 Beta 能力可查询知识、开启对话并执行经过配置的业务流程。", "https://www.intercom.com/fin", "https://www.intercom.com/help/en/articles/15481203-fin-agent-api-mcp-server", false)]
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
  ["matlab-mcp-core-server", "MATLAB MCP Core Server", "mathworks", ["matlab"], "mcp", "official", "https://github.com/matlab/matlab-mcp-core-server", ["claude-desktop", "claude-code", "gemini-cli", "github-copilot"], "代码检查可只读；代码执行、文件写入、测试、启动或退出 MATLAB 必须确认并限制到用户项目。", "只移除枕星AI助手 收据内的 MCP 与客户端配置；保留 MATLAB、许可证、Toolbox 和工程。"],
  ["matlab-agentic-toolkit", "MATLAB Agentic Toolkit", "mathworks", ["matlab"], "skill", "official", "https://github.com/matlab/matlab-agentic-toolkit", ["codex-cli", "claude-code", "github-copilot"], "官方 Toolkit 首版只提供说明入口；启用代码执行、文件写入或扩展安装前必须确认。", "只移除枕星AI助手 收据内的 Toolkit、Skills 与客户端配置；保留 MATLAB、许可证、Toolbox 和工程。"],
  ["simulink-agentic-toolkit", "Simulink Agentic Toolkit", "mathworks", ["simulink"], "skill", "official", "https://github.com/matlab/simulink-agentic-toolkit", ["codex-cli", "claude-code", "gemini-cli", "github-copilot"], "依赖 MATLAB、Simulink 与 MATLAB MCP；模型编辑、仿真和测试必须展示作用范围并确认。", "只移除枕星AI助手 收据内的 Toolkit、Skills 和客户端配置；保留 MATLAB、Simulink、许可证与模型。"],
  ["nvidia-omniverse-mcp", "NVIDIA Omniverse MCP", "nvidia", ["nvidia-omniverse"], "mcp", "official", "https://github.com/NVIDIA-Omniverse", ["claude-desktop", "cursor-desktop"], "首版只提供官方说明；修改 USD、执行代码、渲染、物理仿真和云 API 调用必须确认。", "只移除枕星AI助手 收据内的连接配置；保留 Omniverse 工程、USD、纹理和缓存。"],
  ["nvidia-omniverse-agent-skills", "NVIDIA Omniverse Agent Skills", "nvidia", ["nvidia-omniverse"], "skill", "official", "https://github.com/NVIDIA-Omniverse", ["claude-code", "codex-cli", "cursor-desktop"], "官方 Skills 首版只提供资源入口；启用前必须审核固定版本、工具范围与本地写权限。", "只移除枕星AI助手 收据内的 Skill 配置；保留 Omniverse 工程、SDK 与用户文件。"],
  ["gitlab-mcp-server", "GitLab MCP Server", "gitlab", ["gitlab-platform"], "mcp", "official", "https://docs.gitlab.com/user/model_context_protocol/mcp_server/", ["codex-cli", "claude-desktop", "claude-code", "cursor-desktop", "gemini-cli", "github-copilot", "amazon-kiro-ide", "zed-editor"], "OAuth 仅继承当前 GitLab 用户权限；读取代码、Issue、Merge Request 与任何写入动作均受项目权限限制，写入前必须确认。", "删除目标 AI 工具中的 GitLab MCP 连接并撤销 OAuth；保留账号、项目、仓库、Issue、Merge Request 与流水线。"],
  ["salesforce-hosted-mcp-servers", "Salesforce Hosted MCP Servers", "salesforce", ["salesforce-platform"], "mcp", "official", "https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/hosted-mcp-servers-overview.html", ["chatgpt-desktop", "claude-desktop", "cursor-desktop"], "继承当前 Salesforce 用户的对象、字段与共享权限；记录写入、Flow、Apex 和自动化调用必须逐次确认。", "删除目标 AI 工具连接并由用户撤销 OAuth；保留 Salesforce Org、记录、Flow、Apex 与审计数据。"],
  ["servicenow-mcp-server", "ServiceNow MCP Server", "servicenow", ["servicenow-platform"], "mcp", "official", "https://www.servicenow.com/docs/r/intelligent-experiences/create-mcp-server.html", ["chatgpt-desktop", "claude-desktop", "cursor-desktop"], "只连接管理员批准的实例与工具；ITSM、CMDB、HR 和工作流记录的创建、修改、删除或执行必须确认。", "删除目标 AI 工具连接并撤销 OAuth 入站集成；保留 ServiceNow 实例、服务器定义、业务记录与工作流。"],
  ["microsoft-azure-devops-mcp", "Azure DevOps MCP Server", "microsoft", ["azure-devops"], "mcp", "official", "https://github.com/microsoft/azure-devops-mcp", ["codex-cli", "claude-desktop", "claude-code", "cursor-desktop", "github-copilot", "opencode", "windsurf-editor"], "仅授权指定 Azure DevOps 组织和工具域；创建分支、Pull Request、工作项、Wiki 或运行流水线前必须确认。", "删除目标 AI 工具连接并撤销 Microsoft 授权；保留组织、项目、仓库、工作项、测试与流水线。"],
  ["terraform-mcp-server", "Terraform MCP Server", "hashicorp", ["terraform-platform"], "mcp", "official", "https://developer.hashicorp.com/terraform/mcp-server/deploy", ["codex-cli", "claude-desktop", "claude-code", "cursor-desktop", "github-copilot"], "首版只提供官方说明入口；私有 Registry 与 HCP Terraform 令牌必须最小权限，生成的基础设施变更必须人工审查。", "只移除枕星AI助手 收据内的 MCP 配置；撤销专用令牌，保留 Terraform、State、Workspace、Module 与云资源。"],
  ["pulumi-mcp-server", "Pulumi MCP Server", "pulumi", ["pulumi-cloud"], "mcp", "official", "https://www.pulumi.com/docs/ai/mcp-server/", ["claude-desktop", "claude-code", "cursor-desktop", "windsurf-editor", "amazon-kiro-ide"], "查询 Stack 与 Registry 可只读；部署、Pulumi Neo 任务和组织成员管理会改变云资源或权限，必须明确确认。", "删除目标 AI 工具连接并撤销 Pulumi 授权；保留组织、Stack、State、代码、Policy 与云资源。"],
  ["browserstack-mcp-server", "BrowserStack MCP Server", "browserstack", ["browserstack-test-platform"], "mcp", "official", "https://www.browserstack.com/docs/browserstack-mcp-server/get-started/remote-mcp-server", ["chatgpt-desktop", "claude-desktop", "cursor-desktop", "github-copilot"], "继承当前 BrowserStack 用户权限；启动真实设备测试、修改测试用例或消耗套餐额度前必须确认。", "删除目标 AI 工具连接并撤销 BrowserStack OAuth；保留项目、测试、报告、日志与组织设置。"],
  ["circleci-mcp", "CircleCI MCP", "circleci", ["circleci-platform"], "mcp", "official", "https://circleci.com/docs/guides/toolkit/circleci-mcp-overview/", ["claude-desktop", "claude-code", "cursor-desktop", "github-copilot", "windsurf-editor"], "托管 MCP 可读取构建日志并重跑或取消 Workflow；任何执行和取消动作必须确认，日志输出按敏感数据处理。", "删除目标 AI 工具中的托管 MCP 连接并撤销 OAuth；保留项目、配置、Context、Workflow 与构建记录。"],
  ["clickup-mcp-server", "ClickUp MCP Server", "clickup", ["clickup-workspace"], "mcp", "official", "https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server", ["chatgpt-desktop", "claude-desktop", "claude-code", "cursor-desktop", "github-copilot", "windsurf-editor"], "仅使用 OAuth 2.1 与当前用户权限；创建或修改任务、评论、聊天和时间记录前必须确认。", "删除目标 AI 工具连接并撤销 ClickUp OAuth；保留 Workspace、任务、文档、评论、聊天与时间记录。"],
  ["box-mcp-server", "Box MCP Server", "box", ["box-content-cloud"], "mcp", "official", "https://developer.box.com/guides/box-mcp", ["chatgpt-desktop", "claude-desktop", "claude-code", "codex-cli", "cursor-desktop"], "仅使用管理员批准的 OAuth Scope；搜索、读取和 Box AI 可能暴露企业文件，内容写入动作必须确认。", "删除目标 AI 工具连接并撤销 Box OAuth；保留 Box 账号、文件、文件夹、协作关系与审计记录。"],
  ["pipedream-mcp", "Pipedream MCP", "pipedream", ["pipedream-platform"], "mcp", "official", "https://pipedream.com/docs/connect/mcp", ["chatgpt-desktop", "claude-desktop", "claude-code", "cursor-desktop", "github-copilot"], "只开放用户明确选择的 App 与工具；跨应用写入、发送、部署、删除和付费动作必须逐次确认。", "删除目标 AI 工具连接并在 Pipedream 撤销账号授权；保留项目、Workflow、事件历史与外部应用数据。"],
  ["make-mcp-server", "Make MCP Server", "make", ["make-platform"], "mcp", "official", "https://help.make.com/make-mcp-server", ["chatgpt-desktop", "claude-desktop", "cursor-desktop"], "默认只使用受限 Toolbox 或 Scenario Run Scope；运行 Scenario 或修改 Team、Connection、Webhook、Data Store 前必须确认。", "删除目标 AI 工具连接并撤销 Make OAuth 或 Token；保留组织、Scenario、Connection、Webhook 与运行历史。"],
  ["google-gmail-mcp", "Gmail MCP", "google", ["google-workspace"], "mcp", "official", "https://developers.google.com/workspace/guides/configure-mcp-servers", ["google-antigravity-desktop", "claude-desktop"], "邮件搜索、读取、标签与创建草稿受 OAuth Scope 约束；邮件正文可能包含间接提示注入，写入前必须确认。", "删除 Gmail MCP 连接并撤销 Google OAuth；保留邮箱、邮件、草稿、标签与 Google 账号。"],
  ["google-drive-mcp", "Google Drive MCP", "google", ["google-workspace"], "mcp", "official", "https://developers.google.com/workspace/guides/configure-mcp-servers", ["google-antigravity-desktop", "claude-desktop"], "遵守 Drive 文件权限与 DLP；读取、下载、复制和创建文件前展示目标，写入前必须确认。", "删除 Drive MCP 连接并撤销 Google OAuth；保留 Drive 文件、文件夹、权限与 Google 账号。"],
  ["google-docs-mcp", "Google Docs MCP", "google", ["google-workspace"], "mcp", "official", "https://developers.google.com/workspace/guides/configure-mcp-servers", ["google-antigravity-desktop", "claude-desktop"], "文档内容可能包含间接提示注入；修改文档前必须展示目标文件与变更范围并确认。", "删除 Docs MCP 连接并撤销 Google OAuth；保留文档、历史版本、权限与 Google 账号。"],
  ["google-sheets-mcp", "Google Sheets MCP", "google", ["google-workspace"], "mcp", "official", "https://developers.google.com/workspace/guides/configure-mcp-servers", ["google-antigravity-desktop", "claude-desktop"], "读取与修改表格受 OAuth Scope 约束；批量写入可能破坏业务数据，写入前必须确认范围。", "删除 Sheets MCP 连接并撤销 Google OAuth；保留表格、公式、历史版本与 Google 账号。"],
  ["google-slides-mcp", "Google Slides MCP", "google", ["google-workspace"], "mcp", "official", "https://developers.google.com/workspace/guides/configure-mcp-servers", ["google-antigravity-desktop", "claude-desktop"], "读取与编辑演示文稿受 OAuth Scope 约束；生成、删除或覆盖内容前必须确认目标。", "删除 Slides MCP 连接并撤销 Google OAuth；保留演示文稿、历史版本与 Google 账号。"],
  ["google-calendar-mcp", "Google Calendar MCP", "google", ["google-workspace"], "mcp", "official", "https://developers.google.com/workspace/guides/configure-mcp-servers", ["google-antigravity-desktop", "claude-desktop"], "创建、更新、删除或响应日历事件会影响参与者；执行前必须展示日历、时间与人员并确认。", "删除 Calendar MCP 连接并撤销 Google OAuth；保留日历、事件、邀请与 Google 账号。"],
  ["google-chat-mcp", "Google Chat MCP", "google", ["google-workspace"], "mcp", "official", "https://developers.google.com/workspace/guides/configure-mcp-servers", ["google-antigravity-desktop", "claude-desktop"], "聊天消息可能包含间接提示注入；发送消息属于对外动作，必须展示空间与正文并确认。", "删除 Chat MCP 连接并撤销 Google OAuth；保留 Space、消息、成员与 Google 账号。"],
  ["google-people-mcp", "Google People MCP", "google", ["google-workspace"], "mcp", "official", "https://developers.google.com/workspace/guides/configure-mcp-servers", ["google-antigravity-desktop", "claude-desktop"], "只读取当前 OAuth Scope 允许的资料、联系人和组织目录；输出按个人信息处理。", "删除 People MCP 连接并撤销 Google OAuth；保留联系人、组织目录与 Google 账号。"],
  ["zoom-mcp-server", "Zoom MCP Server", "zoom", ["zoom-workplace"], "mcp", "official", "https://developers.zoom.us/docs/mcp/zoom-mcp-server/", ["chatgpt-desktop", "claude-desktop"], "按 Zoom 产品逐项申请最小 OAuth Scope；会议、聊天、邮件、日历和白板写入动作必须确认。", "删除目标 AI 工具连接并由用户撤销 Zoom OAuth App；保留账号、会议、聊天、邮件、日历、录制与白板。"],
  ["shopify-storefront-mcp", "Shopify Storefront MCP", "shopify", ["shopify-storefront"], "mcp", "official", "https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront", ["codex-cli", "claude-desktop", "claude-code", "cursor-desktop", "github-copilot"], "只接受经过校验的 Shopify 商店域名；商品查询可只读，购物车修改和进入结账前必须确认。", "删除目标 AI 工具中的商店 MCP 配置；保留 Shopify 商店、商品、购物车、订单、客户与商家账号。"],
  ["wolfram-local-mcp", "Wolfram MCP Local", "wolfram-research", ["wolfram-mathematica"], "mcp", "official", "https://www.wolfram.com/artificial-intelligence/mcp/local/wolfram-mcp-local/", ["claude-desktop", "claude-code", "codex-cli", "cursor-desktop", "github-copilot"], "仅提供官方配置说明；本地服务可执行 Wolfram Language、读写 Notebook 与文件，运行代码、覆盖文件和访问外部数据前必须确认。", "删除目标 AI 工具中的本地 MCP 连接并停止服务；保留 Mathematica、许可证、Notebook、文件与计算结果。"],
  ["wolfram-cloud-mcp", "Wolfram MCP Cloud", "wolfram-research", ["wolfram-cloud"], "mcp", "official", "https://www.wolfram.com/artificial-intelligence/mcp/cloud/wolfram-mcp-cloud/", ["chatgpt-desktop", "claude-desktop", "claude-code", "cursor-desktop", "github-copilot", "github-copilot-cli"], "仅提供官方远程端点说明；用户提交的具体计算查询会发送给 Wolfram 云服务，敏感数据和付费计算前必须确认。", "删除目标 AI 工具中的 Wolfram Cloud MCP 连接并撤销相关授权；保留 Wolfram 账号、Cloud Object 与计算数据。"],
  ["ansys-pylumerical-mcp", "PyLumerical MCP", "ansys", ["ansys-lumerical"], "mcp", "official", "https://github.com/ansys/pylumerical-mcp", ["claude-desktop", "claude-code", "codex-cli", "cursor-desktop", "github-copilot"], "官方开源参考项目，当前只提供说明入口；可持久执行任意 Python/PyLumerical 并修改仿真工程，代码、文件写入、求解与许可证消耗前必须确认。", "只删除用户按官方文档建立的客户端连接；保留 Ansys Lumerical、许可证、Python 环境、工程与仿真结果。"],
  ["cesium-ai-integrations-mcp", "Cesium AI Integrations MCP", "cesium", ["cesiumjs"], "mcp", "official", "https://github.com/CesiumGS/cesium-ai-integrations/blob/main/mcp/README.md", ["claude-desktop", "claude-code", "codex-cli", "cursor-desktop", "github-copilot"], "官方实验性参考实现，仅提供说明入口；可修改场景、相机、实体、影像、地形和 3D Tiles，并可能向 Nominatim、Overpass 或 OSRM 发送位置查询。", "删除目标 AI 工具中的 MCP 连接和用户自行部署的参考服务；保留 CesiumJS 项目、Cesium ion 资产、场景数据与源码。"],
  ["cesium-agent-skills", "Cesium Agent Skills", "cesium", ["cesiumjs"], "skill", "official", "https://github.com/CesiumGS/cesium-ai-integrations/blob/main/skills/README.md", ["claude-desktop", "claude-code", "codex-cli", "github-copilot"], "官方实验性 Skills，只提供资源入口；使用前必须审核指令、固定版本与代码生成范围，生成或覆盖 CesiumJS 项目文件前必须确认。", "只移除用户从官方仓库导入的 Cesium Skills；保留 Claude、Codex、Copilot、CesiumJS 项目与用户源码。"],
  ["siemens-xcelerator-developer-portal-mcp", "Siemens Xcelerator Developer Portal MCP", "siemens", ["siemens-xcelerator-developer-portal"], "mcp", "official", "https://developer.siemens.com/ai-registry/developer-portal/developer-portal-mcp.html", ["claude-desktop", "cursor-desktop", "github-copilot"], "官方远程 MCP 当前只有 askDeveloperPortal 文档问答工具；它不控制工业设备，也不应被描述为工业自动化执行入口。", "删除目标 AI 工具中的远程 MCP 连接；保留 Siemens 账号、开发者门户资料、项目与工业系统。"],
  ["esri-arcgis-location-platform-mcp", "ArcGIS Location Platform MCP", "esri", ["arcgis-location-platform"], "mcp", "official", "https://www.esri.com/arcgis-blog/products/platform/developers/mcp-support-beta-and-arcgis-static-maps-service-in-arcgis-location-platform-release", ["claude-desktop", "github-copilot", "microsoft-365-copilot"], "Beta/Early Adopter 能力，仅提供官方说明入口；位置查询会离开本机并可能产生 ArcGIS 用量费用，动态工具与数据写入前必须确认。", "删除目标 AI 工具中的 ArcGIS MCP 连接并撤销访问令牌；保留 ArcGIS 账号、Hosted Layer、地图、位置数据与账单记录。"],
  ["synopsys-verdi-assistant-mcp", "Synopsys Verdi Assistant MCP", "synopsys", ["synopsys-verdi"], "mcp", "official", "https://www.synopsys.com/blogs/chip-design/using-ai-to-debug-more-quickly-and-accurately.html", ["claude-desktop", "github-copilot"], "官方目前只公布能力说明，没有公开安装或配置入口；它可读取芯片源码、日志、波形与调试数据库并执行调试动作，当前仅展示文档。", "当前无公开安装项可卸载；如由厂商交付，按 Synopsys 管理方式断开，并保留 Verdi、许可证、源码、日志、波形与调试数据库。"],
  ["microsoft-azure-mcp", "Microsoft Azure MCP", "microsoft", ["azure-cloud-platform"], "mcp", "official", "https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/", ["codex-cli", "cursor-desktop", "github-copilot", "windsurf-editor"], "继承 Azure Entra ID 与 RBAC；列出资源可只读，创建、修改、部署或删除任何云资源前必须展示订阅、资源组和影响并确认。", "删除目标 AI 工具中的 Azure MCP 连接并撤销相关授权；保留 Azure 订阅、资源、日志和账单记录。"],
  ["aws-mcp-servers", "AWS MCP Servers", "amazon", ["aws-cloud-platform"], "mcp", "official", "https://github.com/awslabs/mcp", ["amazon-kiro-ide", "claude-code", "cursor-desktop"], "AWS Labs 目录中的各服务器成熟度、依赖和权限不同；目录当前只提供官方说明，不能把整个仓库视为一个可自动部署的软件包。", "删除用户自行添加的 MCP 连接并撤销对应 AWS 凭据；保留 AWS 账号、云资源、日志和账单记录。"],
  ["databricks-managed-mcp-directory", "Databricks Managed MCP Servers", "databricks", ["databricks-data-intelligence-platform"], "mcp", "official", "https://docs.databricks.com/aws/en/agents/mcp/managed-mcp", ["chatgpt-desktop", "claude-desktop", "claude-code", "cursor-desktop", "windsurf-editor"], "不同服务器仍可能处于 Preview 或 Beta；Databricks SQL 可读写数据，Unity Catalog 函数可执行业务逻辑，必须按工作区、Scope 和对象权限最小授权。", "删除目标 AI 工具中的 Databricks MCP 连接并撤销 OAuth；保留工作区、Catalog、Schema、表、索引、函数、Notebook 与任务。"],
  ["snowflake-managed-mcp", "Snowflake-managed MCP Server", "snowflake", ["snowflake-ai-data-cloud"], "mcp", "official", "https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp", ["chatgpt-desktop", "claude-desktop", "cursor-desktop"], "只授权指定角色、数据库、Schema 和工具；SQL、UDF、存储过程与 Cortex Agent 可能读取或改变数据并产生计算费用，执行前必须确认。", "删除目标 AI 工具中的 Snowflake MCP 连接并撤销授权；保留账号、数据库、Schema、表、服务、Agent 与查询历史。"],
  ["redis-mcp-server", "Redis MCP Server", "redis", ["redis-database"], "mcp", "official", "https://redis.io/docs/latest/integrate/redis-mcp/", ["claude-desktop", "github-copilot"], "默认使用只读、最小权限 Redis ACL 与加密连接；写入、删除、索引变更、服务器管理和生产数据查询前必须确认。", "删除目标 AI 工具中的 Redis MCP 连接并撤销专用凭据；保留 Redis 实例、数据库、Key、索引、持久化文件与云账号。"],
  ["neo4j-mcp-server", "Neo4j MCP Server", "neo4j", ["neo4j-graph-database"], "mcp", "official", "https://neo4j.com/docs/mcp/current/", ["claude-desktop", "claude-code", "cursor-desktop", "github-copilot"], "官方默认可写；接入生产库时必须启用只读模式并使用受限账号。任何写 Cypher、APOC、GDS 或大范围查询前必须确认。", "删除目标 AI 工具中的 Neo4j MCP 连接并撤销专用凭据；保留 Neo4j 实例、图数据、索引、约束和备份。"],
  ["confluent-cloud-global-mcp", "Confluent Cloud Global MCP", "confluent", ["confluent-cloud"], "mcp", "official", "https://docs.confluent.io/cloud/current/ai/ai-tools/managed-mcp-server.html", [{ id: "claude-desktop", compatibility: "protocol-compatible" }, "claude-code", "cursor-desktop", "github-copilot"], "官方 Global 端点当前只读，但可枚举环境、集群、Connector 与指标；组织级 API Key 和元数据不得进入目录或普通日志。", "删除目标 AI 工具中的 Global MCP 连接并撤销对应 API Key；保留 Confluent 组织、环境、集群、Connector、指标与账单。"],
  ["confluent-cloud-regional-mcp", "Confluent Cloud Regional MCP", "confluent", ["confluent-cloud"], "mcp", "official", "https://docs.confluent.io/cloud/current/ai/ai-tools/managed-mcp-server.html", [{ id: "claude-desktop", compatibility: "protocol-compatible" }, "claude-code", "cursor-desktop", "github-copilot"], "官方 Regional 端点当前只读，但可读取 Topic 样本消息、Schema 与区域资源；区域、云、组织 ID 和专用 Key 必须受约束并避免日志泄露。", "删除目标 AI 工具中的 Regional MCP 连接并撤销对应 API Key；保留 Topic、消息、Schema、集群、网络和组织资源。"],
  ["paypal-mcp-server", "PayPal MCP Server", "paypal", ["paypal-commerce-platform"], "mcp", "official", "https://developer.paypal.com/community/blog/paypal-model-context-protocol/", ["claude-desktop", "cursor-desktop"], "优先使用 Sandbox；创建订单、发送或取消发票、付款、退款和争议处理会影响真实商户与资金，生产环境每次都必须确认。", "删除目标 AI 工具中的 PayPal MCP 连接并撤销应用凭据；保留商户账号、订单、发票、退款、争议和法定交易记录。"],
  ["wix-mcp", "Wix MCP", "wix", ["wix-platform"], "mcp", "official", "https://dev.wix.com/docs/sdk/articles/use-the-wix-mcp/about-the-wix-mcp", ["claude-desktop", "cursor-desktop", "github-copilot", "windsurf-editor"], "除文档检索外还可调用站点 API、创建或管理站点；所有工具默认启用，发布、删除、安装应用和批量修改站点前必须确认。", "删除目标 AI 工具中的 Wix MCP 连接并撤销 OAuth 或 API Key；保留 Wix 账号、站点、应用、内容、订单和发布记录。"],
  ["wordpress-com-mcp", "WordPress.com MCP", "automattic", ["wordpress-com"], "mcp", "official", "https://developer.wordpress.com/docs/mcp/", ["chatgpt-desktop", "claude-desktop", "claude-code", "codex-cli", "cursor-desktop", "github-copilot"], "仅适用于用户启用的 WordPress.com 站点；发布、更新、删除内容，切换主题、管理插件、设置或 DNS 前必须展示目标并确认。", "删除目标 AI 工具中的 WordPress.com MCP 连接，并在 Connected Apps 撤销 OAuth；保留账号、站点、文章、页面、媒体、主题、插件和域名。"],
  ["semrush-mcp", "Semrush MCP", "semrush", ["semrush-platform"], "mcp", "official", "https://developer.semrush.com/api/v3/introduction/semrush-mcp/", ["chatgpt-desktop", "claude-desktop", "claude-code", "cursor-desktop", "github-copilot", "perplexity-web"], "当前为只读，但会访问客户域名、关键词、竞争情报、项目与流量数据并消耗订阅或 API Units；OAuth 与 API Key 不得进入目录。", "删除目标 AI 工具中的 Semrush MCP 连接并撤销 OAuth 或 API Key；保留 Semrush 账号、项目、报表、配额和历史数据。"],
  ["intercom-mcp-server", "Intercom MCP Server", "intercom", ["intercom-platform"], "mcp", "official", "https://developers.intercom.com/docs/guides/mcp", ["chatgpt-desktop", "claude-desktop", "claude-code", "cursor-desktop", "github-copilot", "windsurf-editor"], "当前只支持美国区工作区；联系人、公司、会话和帮助中心内容包含客户 PII，读取、更新文章或任何外发动作前必须确认。", "删除目标 AI 工具中的 Intercom MCP 连接并撤销 OAuth 或 Token；保留工作区、联系人、公司、会话、文章和审计记录。"],
  ["intercom-fin-agent-api-mcp", "Fin Agent API MCP Server", "intercom", ["intercom-fin"], "mcp", "official", "https://www.intercom.com/help/en/articles/15481203-fin-agent-api-mcp-server", ["claude-desktop", "claude-code"], "Beta 能力可查询知识、开启对话并运行退款、升级、取消等 Procedure；生产流程必须逐次确认，Messenger Secret 绝不能进入客户端。", "删除目标 AI 工具中的 Fin MCP 连接并撤销 API Key/OAuth；保留 Fin 配置、知识库、会话、Procedure 与业务记录。"]
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
  const targets = targetIds
    .map((entry) => typeof entry === "string"
      ? { id: entry, compatibility: sourceKind === "official" ? "official" : "verified" }
      : entry)
    .filter((entry) => productIds.has(entry.id))
    .map((entry) => target(entry.id, entry.compatibility));
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
