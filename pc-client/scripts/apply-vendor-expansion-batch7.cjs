"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const verifiedAt = "2026-08-02T18:20:00.000Z";

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
    id: "opera",
    name: "Opera",
    initial: "O",
    color: "#ff1b2d",
    description: "提供内置 Opera AI 与页面上下文能力的桌面浏览器。",
    website: "https://www.opera.com/one",
    tutorial: "https://help.opera.com/en/browser-ai-faq/",
    products: [
      desktopProduct({
        id: "opera-one",
        name: "Opera One",
        category: "浏览器与搜索",
        description: "Windows 浏览器，内置 Opera AI；页面上下文能力的可用范围以官方版本与地区说明为准。",
        downloadPage: "https://www.opera.com/one",
        homePage: "https://www.opera.com/one",
        tutorial: "https://help.opera.com/en/browser-ai-faq/",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    id: "mozilla",
    name: "Mozilla",
    initial: "M",
    color: "#ff7139",
    description: "开发 Firefox 浏览器及其可选择第三方 AI 服务的侧栏能力。",
    website: "https://www.mozilla.org/",
    tutorial: "https://support.mozilla.org/en-US/kb/ai-chatbot",
    products: [
      desktopProduct({
        id: "mozilla-firefox",
        name: "Firefox",
        category: "浏览器与搜索",
        description: "Windows 浏览器，可在侧栏选择兼容 AI 服务；发送内容前需确认第三方服务的数据规则。",
        downloadPage: "https://www.firefox.com/en-US/download/windows/",
        homePage: "https://www.firefox.com/",
        tutorial: "https://support.mozilla.org/en-US/kb/ai-chatbot",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    id: "invokeai",
    name: "InvokeAI",
    initial: "I",
    color: "#e6fd13",
    description: "提供本地运行的开源生成式图像工作流与官方桌面启动器。",
    website: "https://invoke.ai/",
    tutorial: "https://invoke.ai/start-here/installation/",
    products: [
      desktopProduct({
        id: "invokeai-community-edition",
        name: "Invoke Community Edition",
        category: "图像创作",
        description: "通过官方 Windows Launcher 安装、更新和启动本地生成式图像工作流。",
        downloadPage: "https://invoke.ai/download/",
        homePage: "https://invoke.ai/",
        tutorial: "https://invoke.ai/start-here/installation/",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    id: "upscayl",
    name: "Upscayl",
    initial: "U",
    color: "#4d8fe8",
    description: "提供在本地使用 AI 模型放大和增强图像的开源桌面工具。",
    website: "https://upscayl.org/",
    tutorial: "https://docs.upscayl.org/",
    products: [
      desktopProduct({
        id: "upscayl-desktop",
        name: "Upscayl Desktop",
        category: "图像创作",
        description: "Windows 本地图像放大工具，通常需要兼容 Vulkan 的显卡。",
        downloadPage: "https://upscayl.org/download",
        homePage: "https://upscayl.org/",
        tutorial: "https://docs.upscayl.org/",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    id: "fotor",
    name: "Fotor",
    initial: "F",
    color: "#12c2e9",
    description: "提供网页与 Windows 端的 AI 图像编辑、增强和设计工具。",
    website: "https://www.fotor.com/",
    tutorial: "https://support.fotor.com/hc/en-us",
    products: [
      desktopProduct({
        id: "fotor-windows",
        name: "Fotor",
        category: "图像创作",
        description: "合并网页与 Windows 入口的 AI 图片编辑、增强、批处理和设计工具。",
        downloadPage: "https://www.fotor.com/windows/index.html",
        homePage: "https://www.fotor.com/",
        webPage: "https://www.fotor.com/photo-editor-app/editor/basic",
        tutorial: "https://support.fotor.com/hc/en-us",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    id: "cyberlink",
    name: "CyberLink",
    initial: "C",
    color: "#111111",
    description: "提供带生成式 AI 与智能增强能力的 Windows 视频和图片创作软件。",
    website: "https://www.cyberlink.com/",
    tutorial: "https://www.cyberlink.com/learning",
    products: [
      desktopProduct({
        id: "cyberlink-powerdirector",
        name: "PowerDirector",
        category: "视频创作",
        description: "Windows 视频编辑器，包含生成、字幕、背景处理与音视频增强等 AI 能力；具体额度以官方方案为准。",
        downloadPage: "https://www.cyberlink.com/products/powerdirector-video-editing-software/overview_en_US.html",
        homePage: "https://www.cyberlink.com/products/powerdirector-video-editing-software/overview_en_US.html",
        tutorial: "https://www.cyberlink.com/learning",
        directoryKind: "ai-tool"
      }),
      desktopProduct({
        id: "cyberlink-photodirector",
        name: "PhotoDirector",
        category: "图像创作",
        description: "Windows 图片编辑器，包含生成式 AI、替换、增强与 AI Agent；具体额度以官方方案为准。",
        downloadPage: "https://www.cyberlink.com/products/photodirector-photo-editing-software-365/features_en_AU.html",
        homePage: "https://www.cyberlink.com/products/photodirector-photo-editing-software-365/features_en_AU.html",
        tutorial: "https://www.cyberlink.com/learning/photodirector-photo-editing-software",
        directoryKind: "ai-tool"
      })
    ]
  }
];

const productUpdates = [
  ["asana", desktopProduct({
    id: "asana-work-graph",
    name: "Asana",
    category: "项目与协作",
    description: "合并网页与 Windows 入口的工作管理产品，并可通过官方 MCP 接入已授权的项目数据。",
    downloadPage: "https://asana.com/download",
    homePage: "https://asana.com/",
    webPage: "https://app.asana.com/",
    tutorial: "https://help.asana.com/s/article/asana-desktop-app?language=en_US",
    directoryKind: "ai-connectable"
  })],
  ["monday", desktopProduct({
    id: "monday-work-management",
    name: "monday.com",
    category: "项目与协作",
    description: "合并网页与 Windows 入口的工作管理平台，并可通过官方 MCP 接入已授权的工作区。",
    downloadPage: "https://support.monday.com/hc/en-us/articles/115005316885-monday-com-s-desktop-app",
    homePage: "https://monday.com/",
    webPage: "https://auth.monday.com/",
    tutorial: "https://developer.monday.com/api-reference/docs/integrate-with-monday-mcp",
    directoryKind: "ai-connectable"
  })],
  ["box", desktopProduct({
    id: "box-content-cloud",
    name: "Box",
    category: "文档与知识库",
    description: "合并 Box 网页端与 Box Drive Windows 入口，并可通过 Box AI 和官方 MCP 处理授权内容。",
    downloadPage: "https://www.box.com/drive",
    homePage: "https://www.box.com/",
    webPage: "https://app.box.com/",
    tutorial: "https://support.box.com/hc/en-us/articles/50483150712723-Box-AI-for-Drive",
    directoryKind: "ai-connectable"
  })],
  ["redis", desktopProduct({
    id: "redis-insight",
    name: "Redis Insight",
    category: "数据库与数据",
    description: "Redis 官方 Windows 图形管理工具，包含用于数据库操作与排障的 AI 助手。",
    downloadPage: "https://redis.io/docs/latest/operate/redisinsight/install/install-on-desktop/",
    homePage: "https://redis.io/insight/",
    tutorial: "https://redis.io/docs/latest/operate/redisinsight/",
    directoryKind: "ai-connectable"
  })],
  ["neo4j", desktopProduct({
    id: "neo4j-desktop",
    name: "Neo4j Desktop",
    category: "数据库与数据",
    description: "Neo4j 官方 Windows 图形工作台，用于创建、管理和探索本地图数据库项目。",
    downloadPage: "https://neo4j.com/download/",
    homePage: "https://neo4j.com/product/developer-tools/",
    tutorial: "https://neo4j.com/docs/desktop/current/",
    directoryKind: "ai-connectable"
  })],
  ["mongodb", desktopProduct({
    id: "mongodb-compass",
    name: "MongoDB Compass",
    category: "数据库与数据",
    description: "MongoDB 官方 Windows 图形界面，支持通过自然语言生成查询并检查结果。",
    downloadPage: "https://www.mongodb.com/try/download/compass",
    homePage: "https://www.mongodb.com/products/tools/compass",
    tutorial: "https://www.mongodb.com/docs/compass/query-with-natural-language/",
    directoryKind: "ai-connectable"
  })],
  ["microsoft", desktopProduct({
    id: "microsoft-visual-studio",
    name: "Visual Studio",
    category: "编程与调试",
    description: "Windows 集成开发环境，提供 GitHub Copilot 辅助与兼容 MCP Server 的开发工作流。",
    downloadPage: "https://visualstudio.microsoft.com/downloads/",
    homePage: "https://visualstudio.microsoft.com/",
    tutorial: "https://learn.microsoft.com/en-us/visualstudio/ide/visual-studio-github-copilot-install-and-states?view=visualstudio",
    directoryKind: "ai-connectable"
  })],
  ["google", desktopProduct({
    id: "google-android-studio",
    name: "Android Studio",
    category: "编程与调试",
    description: "Android 官方 Windows 开发环境，受支持版本可使用 Gemini 辅助编程；能力取决于系统、账号与地区。",
    downloadPage: "https://developer.android.com/studio",
    homePage: "https://developer.android.com/studio",
    tutorial: "https://developer.android.com/studio/gemini/overview",
    directoryKind: "ai-connectable"
  })],
  ["adobe", desktopProduct({
    id: "adobe-acrobat-reader-ai",
    name: "Adobe Acrobat Reader",
    category: "文档与知识库",
    description: "合并 Acrobat Web 与 Windows Reader 入口；AI Assistant 的方案、登录与额度以官方说明为准。",
    downloadPage: "https://www.adobe.com/acrobat/pdf-reader.html",
    homePage: "https://www.adobe.com/acrobat.html",
    webPage: "https://acrobat.adobe.com/",
    tutorial: "https://helpx.adobe.com/acrobat/desktop/use-acrobat-ai/generative-ai-features/ai-get-answers.html",
    directoryKind: "ai-connectable"
  })],
  ["google", desktopProduct({
    id: "google-chrome-devtools",
    name: "Google Chrome",
    category: "浏览器与搜索",
    description: "Windows 浏览器，受支持地区与账号可使用 Gemini，并保留面向开发工具智能体的官方 DevTools 接入能力。",
    downloadPage: "https://www.google.com/chrome/download-chrome/",
    homePage: "https://www.google.com/chrome/",
    tutorial: "https://support.google.com/chrome/answer/16283624",
    directoryKind: "ai-connectable"
  })],
  ["microsoft", desktopProduct({
    id: "microsoft-edge-ai",
    name: "Microsoft Edge",
    category: "浏览器与搜索",
    description: "Windows 浏览器，可在侧栏使用 Copilot 处理用户授权的网页上下文；可用性取决于设备、市场与版本。",
    downloadPage: "https://www.microsoft.com/en-us/edge/download",
    homePage: "https://www.microsoft.com/en-us/edge/",
    tutorial: "https://support.microsoft.com/en-us/microsoft-copilot/getting-started-with-copilot-in-microsoft-edge",
    directoryKind: "ai-connectable"
  })]
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

if (!catalog.categories.includes("浏览器与搜索")) {
  catalog.categories.push("浏览器与搜索");
}
catalog.updatedAt = verifiedAt;
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

process.stdout.write(
  `Expanded ${catalog.vendors.length} vendors, ${catalog.vendors.flatMap((vendor) => vendor.products).length} products and ${catalog.resources.length} resources\n`
);
