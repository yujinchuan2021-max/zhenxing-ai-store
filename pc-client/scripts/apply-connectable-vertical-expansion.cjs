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
  ["canva", product("affinity", "Affinity", "Windows 图像、矢量与排版工具，官方 AI Connector 当前只提供 Claude 接入说明。", "https://www.affinity.studio/", "https://www.canva.com/newsroom/news/canva-create-2026-launches/")]
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
  ["affinity-ai-connector", "Affinity AI Connector", "canva", ["affinity"], "connector", "official", "https://www.canva.com/newsroom/news/canva-create-2026-launches/", ["claude-desktop"], "官方撤销文档尚未完整；生成脚本首次运行必须展示写入范围并确认。", "当前只提供官方说明；断开连接时保留 Affinity、文档与用户脚本。"]
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
