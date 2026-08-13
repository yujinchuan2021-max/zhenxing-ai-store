"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const fallbackPath = path.join(root, "admin", "data", "vendor-icon-fallbacks.json");
const verifiedAt = "2026-08-02T16:00:00.000Z";

function webProduct({ id, name, category, description, website, tutorial, directoryKind = "ai-tool" }) {
  return {
    id,
    enabled: true,
    order: 0,
    directoryKind,
    name,
    kind: "其他产品",
    category,
    description,
    website,
    tutorial,
    productType: "web",
    moduleId: "web-link",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-product-website",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "web", label: `打开 ${name}`, url: website },
      ...(tutorial !== website
        ? [{ type: "tutorial", label: "使用教程", url: tutorial }]
        : [])
    ]
  };
}

function desktopProduct({
  id,
  name,
  category,
  description,
  downloadPage,
  homePage,
  webPage = "",
  tutorial,
  directoryKind,
  desktopLabel = "获取 Windows 客户端"
}) {
  return {
    id,
    enabled: true,
    order: 0,
    directoryKind,
    name,
    kind: "桌面端",
    category,
    description,
    website: downloadPage,
    tutorial,
    productType: "desktop-official",
    moduleId: "desktop-official",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      ...(homePage ? [{ type: "website", label: "工具官网", url: homePage }] : []),
      ...(webPage ? [{ type: "web", label: `${name} 网页版`, url: webPage }] : []),
      { type: "desktop", label: desktopLabel },
      ...(tutorial && tutorial !== downloadPage
        ? [{ type: "tutorial", label: "使用教程", url: tutorial }]
        : [])
    ]
  };
}

const newVendors = [
  {
    id: "gamma",
    name: "Gamma",
    initial: "G",
    color: "#7c5cff",
    description: "提供 AI 演示文稿、文档和网页内容生成工具。",
    website: "https://gamma.app/",
    tutorial: "https://help.gamma.app/en/articles/11080604-what-s-gamma",
    products: [
      webProduct({
        id: "gamma-app",
        name: "Gamma",
        category: "办公自动化",
        description: "在浏览器中通过 AI 创建演示文稿、文档和可分享网页。",
        website: "https://gamma.app/",
        tutorial: "https://help.gamma.app/en/articles/11080604-what-s-gamma"
      })
    ]
  },
  {
    id: "krea",
    name: "Krea",
    initial: "K",
    color: "#111111",
    description: "提供实时图像、视频生成与视觉内容增强工具。",
    website: "https://www.krea.ai/",
    tutorial: "https://docs.krea.ai/",
    products: [
      webProduct({
        id: "krea-ai",
        name: "Krea",
        category: "图像创作",
        description: "在浏览器中生成、编辑、增强图像和视频内容。",
        website: "https://www.krea.ai/",
        tutorial: "https://docs.krea.ai/"
      }),
      webProduct({
        id: "krea-agent-platform",
        name: "Krea Agent Platform",
        category: "图像与设计",
        description: "提供官方 MCP 与 Agent Skills，把 Krea 图像、视频和增强能力连接到兼容 AI 工具。",
        website: "https://www.krea.ai/mcp",
        tutorial: "https://www.krea.ai/skills",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    id: "meshy",
    name: "Meshy",
    initial: "M",
    color: "#6c5ce7",
    description: "提供 AI 3D 模型生成、贴图和智能体工作流。",
    website: "https://www.meshy.ai/",
    tutorial: "https://docs.meshy.ai/",
    products: [
      webProduct({
        id: "meshy-ai",
        name: "Meshy",
        category: "3D 创作",
        description: "通过文本或图像生成 3D 模型、纹理和动画资产。",
        website: "https://www.meshy.ai/",
        tutorial: "https://docs.meshy.ai/"
      }),
      webProduct({
        id: "meshy-3d-agent",
        name: "Meshy 3D Agent",
        category: "智能体",
        description: "面向 3D 创作任务的智能体，可通过官方 MCP 与 Skill 接入兼容 AI 工具。",
        website: "https://www.meshy.ai/3d-agent",
        tutorial: "https://docs.meshy.ai/en/agent/overview"
      }),
      webProduct({
        id: "meshy-developer-platform",
        name: "Meshy Developer Platform",
        category: "3D 创作",
        description: "提供官方 API、MCP 与 Skill 接入说明，用于把 Meshy 3D 能力连接到兼容 AI 工具。",
        website: "https://docs.meshy.ai/",
        tutorial: "https://docs.meshy.ai/en/agent/mcp-and-skill",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    id: "shengshu",
    name: "生数科技",
    initial: "S",
    color: "#4967ff",
    description: "开发 Vidu 视频生成模型及面向创作流程的智能体产品。",
    website: "https://www.shengshu.com/",
    tutorial: "https://www.vidu.com/zh/",
    products: [
      webProduct({
        id: "shengshu-vidu",
        name: "Vidu",
        category: "视频创作",
        description: "通过文本、图片或参考主体生成与编辑视频。",
        website: "https://www.vidu.com/zh/",
        tutorial: "https://www.vidu.com/zh/"
      }),
      webProduct({
        id: "shengshu-vidu-claw",
        name: "Vidu Claw",
        category: "智能体",
        description: "面向视频创作流程的智能体，可规划并执行多步骤内容生产任务。",
        website: "https://www.vidu.com/zh/vidu-claw",
        tutorial: "https://www.vidu.com/zh/vidu-claw"
      })
    ]
  },
  {
    id: "pixverse",
    name: "PixVerse",
    initial: "P",
    color: "#7c3aed",
    description: "提供 AI 视频生成、编辑和创作智能体。",
    website: "https://pixverse.ai/en",
    tutorial: "https://pixverse.ai/en",
    products: [
      webProduct({
        id: "pixverse-ai-video",
        name: "PixVerse",
        category: "视频创作",
        description: "在浏览器中通过文本、图像和角色素材生成视频。",
        website: "https://pixverse.ai/en",
        tutorial: "https://pixverse.ai/en"
      }),
      webProduct({
        id: "pixverse-agent",
        name: "PixVerse Agent",
        category: "智能体",
        description: "理解自然语言创作意图并自动组织视频生成步骤的智能体。",
        website: "https://pixverse.ai/en/agent",
        tutorial: "https://pixverse.ai/en/agent"
      }),
      webProduct({
        id: "pixverse-developer-platform",
        name: "PixVerse Developer Platform",
        category: "视频创作",
        description: "提供官方 API 与 MCP Server，把 PixVerse 视频能力连接到兼容 AI 工具。",
        website: "https://platform.pixverse.ai/",
        tutorial: "https://github.com/PixVerseAI/PixVerse-MCP",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    id: "udio",
    name: "Udio",
    initial: "U",
    color: "#171717",
    description: "提供基于提示词的 AI 音乐创作与分享服务。",
    website: "https://www.udio.com/",
    tutorial: "https://help.udio.com/en/",
    products: [
      webProduct({
        id: "udio-ai-music",
        name: "Udio",
        category: "音频创作",
        description: "在浏览器中创作、编辑和分享 AI 音乐作品。",
        website: "https://www.udio.com/",
        tutorial: "https://help.udio.com/en/"
      })
    ]
  },
  {
    id: "obsidian",
    name: "Obsidian",
    initial: "O",
    color: "#7c3aed",
    description: "提供本地优先的知识库与可扩展笔记工具。",
    website: "https://obsidian.md/",
    tutorial: "https://help.obsidian.md/",
    products: [
      desktopProduct({
        id: "obsidian-desktop",
        name: "Obsidian",
        category: "文档与知识库",
        description: "本地优先的 Windows 知识库，可通过官方插件机制接入 AI 扩展。",
        downloadPage: "https://obsidian.md/download",
        homePage: "https://obsidian.md/",
        tutorial: "https://help.obsidian.md/",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    id: "discord",
    name: "Discord",
    initial: "D",
    color: "#5865f2",
    description: "提供社区通信平台及可接入 AI 的官方 App 与 Bot 开发能力。",
    website: "https://discord.com/",
    tutorial: "https://discord.com/developers/docs/intro",
    products: [
      desktopProduct({
        id: "discord-desktop",
        name: "Discord",
        category: "项目与协作",
        description: "Windows 社区通信客户端，可通过官方 App 与 Bot 平台连接 AI 服务。",
        downloadPage: "https://discord.com/download",
        homePage: "https://discord.com/",
        webPage: "https://discord.com/app",
        tutorial: "https://discord.com/developers/docs/intro",
        directoryKind: "ai-connectable"
      })
    ]
  }
];

const productUpdates = [
  ["bytedance", desktopProduct({
    id: "bytedance-capcut-desktop",
    name: "CapCut",
    category: "视频创作",
    description: "CapCut 官方 Windows 视频编辑器，包含 AI 视频、字幕和画面处理能力。",
    downloadPage: "https://www.capcut.com/tools/desktop-video-editor",
    homePage: "https://www.capcut.com/",
    webPage: "https://www.capcut.com/editor",
    tutorial: "https://www.capcut.com/resource",
    directoryKind: "ai-tool"
  })],
  ["microsoft", desktopProduct({
    id: "microsoft-vscode",
    name: "Visual Studio Code",
    category: "编程与调试",
    description: "Windows 代码编辑器，支持 AI 编程扩展、Agent 模式与 MCP Server。",
    downloadPage: "https://code.visualstudio.com/download",
    homePage: "https://code.visualstudio.com/",
    tutorial: "https://code.visualstudio.com/docs/copilot/chat/mcp-servers",
    directoryKind: "ai-tool"
  })],
  ["clickup", desktopProduct({
    id: "clickup-brain-max",
    name: "ClickUp Brain MAX",
    category: "智能体",
    description: "面向桌面工作的 AI 超级应用，可搜索工作内容并执行跨应用任务。",
    downloadPage: "https://clickup.com/brain/max",
    homePage: "https://clickup.com/brain",
    tutorial: "https://clickup.com/brain/max",
    directoryKind: "ai-tool"
  })],
  ["slack", desktopProduct({
    id: "slack-workspace",
    name: "Slack",
    category: "项目与协作",
    description: "团队协作工作空间，可通过官方 MCP 向已授权的 AI 客户端提供内容与操作能力。",
    downloadPage: "https://slack.com/downloads/windows",
    homePage: "https://slack.com/",
    webPage: "https://app.slack.com/",
    tutorial: "https://docs.slack.dev/ai/slack-mcp-server/",
    directoryKind: "ai-connectable"
  })],
  ["miro", desktopProduct({
    id: "miro-workspace",
    name: "Miro",
    category: "项目与协作",
    description: "协作白板与 Windows 工作空间，可通过官方 MCP 读取或更新用户授权的看板。",
    downloadPage: "https://miro.com/apps/",
    homePage: "https://miro.com/",
    webPage: "https://miro.com/app/dashboard/",
    tutorial: "https://help.miro.com/hc/en-us/articles/31625301583890-How-to-enable-Miro-s-MCP-Server-user-guide",
    directoryKind: "ai-connectable"
  })],
  ["linear", desktopProduct({
    id: "linear-workspace",
    name: "Linear",
    category: "项目与协作",
    description: "项目与 Issue 管理工作空间，可通过官方 MCP 接入兼容 AI 工具。",
    downloadPage: "https://linear.app/download",
    homePage: "https://linear.app/",
    tutorial: "https://linear.app/docs/mcp",
    directoryKind: "ai-connectable"
  })],
  ["clickup", desktopProduct({
    id: "clickup-workspace",
    name: "ClickUp",
    category: "项目与协作",
    description: "任务、文档与团队协作工作空间，可通过官方 MCP 接入授权 AI 客户端。",
    downloadPage: "https://clickup.com/download",
    homePage: "https://clickup.com/",
    webPage: "https://app.clickup.com/",
    tutorial: "https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server",
    directoryKind: "ai-connectable"
  })],
  ["zoom", desktopProduct({
    id: "zoom-workplace",
    name: "Zoom Workplace",
    category: "项目与协作",
    description: "会议、聊天、白板与 Windows 协作空间，可通过官方 MCP 接入授权 AI 客户端。",
    downloadPage: "https://www.zoom.com/en/products/virtual-meetings/download-center/",
    homePage: "https://www.zoom.com/",
    webPage: "https://app.zoom.us/wc/",
    tutorial: "https://developers.zoom.us/docs/mcp/zoom-mcp-server/",
    directoryKind: "ai-connectable"
  })]
];

function resourceTarget(productId) {
  return {
    productId,
    compatibility: "official",
    moduleId: "resource-link",
    installProfileId: "",
    capabilities: ["website"],
    enabled: true
  };
}

const newResources = [
  {
    id: "krea-mcp-server",
    name: "Krea MCP Server",
    resourceTypes: ["mcp"],
    description: "Krea 官方远程 MCP，可从兼容智能体生成图像、视频并运行增强工作流。",
    website: "https://www.krea.ai/mcp",
    tutorial: "https://www.krea.ai/mcp",
    publisherVendorId: "krea",
    publisher: "Krea",
    sourceKind: "official",
    sourceProductIds: ["krea-agent-platform"],
    targets: ["claude-desktop", "openclaw-agent", "codex-cli", "cursor-desktop", "nous-hermes-agent"].map(resourceTarget),
    versionRef: "rolling-official-service",
    requestedPermissions: ["提交生成、增强或工作流任务前必须确认，相关操作可能消耗 Krea 账户额度。"],
    credentialRequirements: ["使用 Krea OAuth 登录；目录与客户端不保存账号凭据。"],
    installScope: "仅打开官方连接说明；当前不写入本地配置。",
    uninstallPlan: "从目标 AI 工具删除 MCP 连接，并在 Krea 撤销授权会话。",
    provenanceEvidence: ["https://www.krea.ai/mcp"],
    lastVerifiedAt: verifiedAt
  },
  {
    id: "krea-agent-skills",
    name: "Krea Agent Skills",
    resourceTypes: ["skill"],
    description: "Krea 官方 Skill 包，可从兼容编程智能体调用图像、视频与增强工作流。",
    website: "https://www.krea.ai/skills",
    tutorial: "https://www.krea.ai/skills",
    publisherVendorId: "krea",
    publisher: "Krea",
    sourceKind: "official",
    sourceProductIds: ["krea-agent-platform"],
    targets: ["claude-code", "cursor-desktop", "github-copilot", "codex-cli", "windsurf-editor", "openclaw-agent"].map(resourceTarget),
    versionRef: "rolling-official-repository",
    requestedPermissions: ["执行生成或增强任务前必须确认，相关操作可能消耗 Krea 账户额度。"],
    credentialRequirements: ["使用 Krea API Token；凭据必须由目标工具或系统凭据存储管理。"],
    installScope: "仅打开官方 Skill 安装说明；当前不写入本地目录。",
    uninstallPlan: "从目标智能体删除 Skill 文件，并在 Krea 设置中撤销对应 API Token。",
    provenanceEvidence: ["https://www.krea.ai/skills", "https://github.com/krea-ai/skills"],
    lastVerifiedAt: verifiedAt
  },
  {
    id: "meshy-mcp-server",
    name: "Meshy MCP Server",
    resourceTypes: ["mcp"],
    description: "Meshy 官方 MCP 接入说明，可从兼容 AI 工具创建和管理 3D 生成任务。",
    website: "https://docs.meshy.ai/en/agent/mcp-and-skill",
    tutorial: "https://docs.meshy.ai/en/agent/mcp-and-skill",
    publisherVendorId: "meshy",
    publisher: "Meshy",
    sourceKind: "official",
    sourceProductIds: ["meshy-developer-platform"],
    targets: ["claude-desktop", "cursor-desktop", "windsurf-editor", "codex-cli", "microsoft-vscode"].map(resourceTarget),
    versionRef: "rolling-official-docs",
    requestedPermissions: ["提交 3D 生成或下载任务前必须确认，相关操作可能消耗 Meshy 账户额度。"],
    credentialRequirements: ["使用 Meshy API Key；凭据必须由目标工具或系统凭据存储管理。"],
    installScope: "仅打开官方接入说明；当前不写入本地配置。",
    uninstallPlan: "从目标工具删除 MCP 连接，并在 Meshy 控制台撤销对应 API Key。",
    provenanceEvidence: ["https://docs.meshy.ai/en/agent/mcp-and-skill"],
    lastVerifiedAt: verifiedAt
  },
  {
    id: "meshy-3d-skill",
    name: "Meshy 3D Skill",
    resourceTypes: ["skill"],
    description: "Meshy 官方 3D Skill 接入说明，用于从兼容编程智能体调用 3D 创作能力。",
    website: "https://docs.meshy.ai/en/agent/mcp-and-skill",
    tutorial: "https://docs.meshy.ai/en/agent/mcp-and-skill",
    publisherVendorId: "meshy",
    publisher: "Meshy",
    sourceKind: "official",
    sourceProductIds: ["meshy-developer-platform"],
    targets: ["claude-code", "gemini-cli", "opencode", "openclaw-agent"].map(resourceTarget),
    versionRef: "rolling-official-docs",
    requestedPermissions: ["执行生成任务前必须确认，相关操作可能消耗 Meshy 账户额度。"],
    credentialRequirements: ["使用 Meshy API Key；凭据必须由目标工具或系统凭据存储管理。"],
    installScope: "仅打开官方 Skill 安装说明；当前不写入本地目录。",
    uninstallPlan: "从目标智能体删除 Skill 文件，并在 Meshy 控制台撤销对应 API Key。",
    provenanceEvidence: ["https://docs.meshy.ai/en/agent/mcp-and-skill"],
    lastVerifiedAt: verifiedAt
  },
  {
    id: "pixverse-mcp-server",
    name: "PixVerse MCP Server",
    resourceTypes: ["mcp"],
    description: "PixVerse 官方 MCP Server，可从兼容 AI 工具调用视频生成、延长、转场和声音能力。",
    website: "https://github.com/PixVerseAI/PixVerse-MCP",
    tutorial: "https://github.com/PixVerseAI/PixVerse-MCP",
    publisherVendorId: "pixverse",
    publisher: "PixVerse",
    sourceKind: "official",
    sourceProductIds: ["pixverse-developer-platform"],
    targets: ["claude-desktop", "cursor-desktop"].map(resourceTarget),
    versionRef: "v2.0.0",
    requestedPermissions: ["提交视频生成或素材上传任务前必须确认，相关操作可能消耗 PixVerse API Credits。"],
    credentialRequirements: ["需要 PixVerse API Key；凭据必须由目标工具或系统凭据存储管理。"],
    installScope: "仅打开官方安装说明；当前不安装 Python、UV 或 MCP 包。",
    uninstallPlan: "从目标 AI 工具删除 MCP 配置，并在 PixVerse Platform 撤销 API Key。",
    provenanceEvidence: ["https://github.com/PixVerseAI/PixVerse-MCP"],
    lastVerifiedAt: verifiedAt
  }
];

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const productOwners = new Map(
  catalog.vendors.flatMap((vendor) => vendor.products.map((product) => [product.id, vendor.id]))
);
let nextVendorOrder = Math.max(-1, ...catalog.vendors.map((vendor) => vendor.order ?? 0)) + 1;

function upsertProduct(vendor, product) {
  const owner = productOwners.get(product.id);
  if (owner && owner !== vendor.id) throw new Error(`产品 ID 已属于其他厂商：${product.id}`);
  const existing = vendor.products.find((entry) => entry.id === product.id);
  if (existing) applyDefinition(existing, product, ["enabled", "order"]);
  else vendor.products.push(product);
  productOwners.set(product.id, vendor.id);
}

for (const definition of newVendors) {
  let vendor = catalog.vendors.find((entry) => entry.id === definition.id);
  if (!vendor) {
    vendor = {
      id: definition.id,
      name: definition.name,
      initial: definition.initial,
      mark: definition.initial,
      color: definition.color,
      description: definition.description,
      website: definition.website,
      tutorial: definition.tutorial,
      enabled: true,
      order: nextVendorOrder++,
      iconUrl: "",
      products: []
    };
    catalog.vendors.push(vendor);
  } else {
    applyDefinition(vendor, { ...definition, mark: definition.initial }, [
      "enabled", "order", "iconAsset", "iconUrl", "requiresCrossBorderNetwork", "products"
    ]);
  }
  for (const product of definition.products) upsertProduct(vendor, product);
}

for (const [vendorId, product] of productUpdates) {
  const vendor = catalog.vendors.find((entry) => entry.id === vendorId);
  if (!vendor) throw new Error(`缺少厂商：${vendorId}`);
  upsertProduct(vendor, product);
}

let nextResourceOrder = Math.max(-1, ...catalog.resources.map((resource) => resource.order ?? 0)) + 1;
for (const definition of newResources) {
  const existing = catalog.resources.find((resource) => resource.id === definition.id);
  if (existing) applyDefinition(existing, definition, ["enabled", "order"]);
  else catalog.resources.push({ ...definition, enabled: true, order: nextResourceOrder++ });
}

for (const resourceId of ["miro-mcp-server", "linear-mcp-server"]) {
  const resource = catalog.resources.find((entry) => entry.id === resourceId);
  if (!resource) throw new Error(`缺少资源：${resourceId}`);
  if (!resource.targets.some((target) => target.productId === "microsoft-vscode")) {
    resource.targets.push(resourceTarget("microsoft-vscode"));
  }
}

catalog.updatedAt = verifiedAt;
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const fallbacks = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
fallbacks.reviewedAt = verifiedAt;
fallbacks.vendors.obsidian = {
  evidenceUrl: "https://obsidian.md/brand",
  reason: "官方品牌页要求商业场景先联系授权，当前使用经过审阅的文字兜底标识。"
};
fallbacks.vendors.gamma = {
  evidenceUrl: "https://gamma.app/about",
  reason: "官方页面未提供可独立核验并适用于第三方目录的方形品牌素材，当前使用文字兜底标识。"
};
fallbacks.vendors.udio = {
  evidenceUrl: "https://help.udio.com/en/",
  reason: "官方帮助中心已确认产品身份，但尚未找到可独立核验并适用于第三方目录的品牌素材，当前使用文字兜底标识。"
};
fs.writeFileSync(fallbackPath, `${JSON.stringify(fallbacks, null, 2)}\n`, "utf8");

process.stdout.write(
  `Expanded ${catalog.vendors.length} vendors, ${catalog.vendors.flatMap((vendor) => vendor.products).length} products and ${catalog.resources.length} resources\n`
);
