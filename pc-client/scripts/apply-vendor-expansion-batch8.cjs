"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const verifiedAt = "2026-08-03T14:30:00.000Z";

function desktopProduct({
  id,
  name,
  category,
  description,
  downloadPage,
  homePage,
  webPage = "",
  webLabel = "",
  tutorial,
  desktopLabel = "获取 Windows 客户端"
}) {
  return {
    id,
    enabled: true,
    order: 0,
    directoryKind: "ai-tool",
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
      ...(webPage
        ? [{ type: "web", label: webLabel || `${name} 网页版`, url: webPage }]
        : []),
      { type: "desktop", label: desktopLabel },
      ...(tutorial && tutorial !== downloadPage
        ? [{ type: "tutorial", label: "使用教程", url: tutorial }]
        : [])
    ]
  };
}

const definitions = [
  {
    id: "on1",
    name: "ON1",
    initial: "O",
    color: "#111111",
    description: "开发面向摄影工作流的 AI 照片编辑、增强和管理软件。",
    website: "https://www.on1.com/",
    tutorial: "https://www.on1.com/products/photo-raw/",
    products: [
      desktopProduct({
        id: "on1-photo-raw",
        name: "ON1 Photo RAW",
        category: "图像创作",
        description: "Windows RAW 照片编辑与管理工具，内置降噪、放大、智能蒙版和生成式擦除等 AI 能力；账号、显卡与功能边界以官方要求为准。",
        downloadPage: "https://www.on1.com/products/photo-raw/download/",
        homePage: "https://www.on1.com/products/photo-raw/",
        tutorial: "https://www.on1.com/products/photo-raw/specs/",
        desktopLabel: "获取 ON1 Photo RAW Windows 版"
      })
    ]
  },
  {
    id: "capture-one",
    name: "Capture One",
    initial: "C",
    color: "#111111",
    description: "开发面向摄影师与影像团队的专业拍摄和照片编辑软件。",
    website: "https://www.captureone.com/",
    tutorial: "https://support.captureone.com/",
    products: [
      desktopProduct({
        id: "capture-one-pro",
        name: "Capture One Pro",
        category: "图像创作",
        description: "专业 Windows RAW 照片编辑与联机拍摄工具，支持人物、主体和背景等 AI 蒙版；试用、订阅与设备支持以官方说明为准。",
        downloadPage: "https://www.captureone.com/en/account/download",
        homePage: "https://www.captureone.com/en/products/capture-one-pro",
        webPage: "https://www.captureone.com/en/products/capture-one-live",
        webLabel: "Capture One Live 网页协作",
        tutorial: "https://support.captureone.com/hc/en-us/articles/360002601658-Overview-of-Layers-and-Masks",
        desktopLabel: "获取 Capture One Windows 版"
      })
    ]
  },
  {
    id: "dxo",
    name: "DxO",
    initial: "D",
    color: "#202020",
    description: "开发基于成像科学和机器学习的专业照片处理软件。",
    website: "https://www.dxo.com/",
    tutorial: "https://userguides.dxo.com/photolab/en/overview/",
    products: [
      desktopProduct({
        id: "dxo-photolab",
        name: "DxO PhotoLab",
        category: "图像创作",
        description: "Windows RAW 照片编辑器，提供 DeepPRIME 降噪、AI 蒙版和 Windows ML 加速；硬件、账号和试用要求以官方说明为准。",
        downloadPage: "https://www.dxo.com/en/dxo-photolab/",
        homePage: "https://www.dxo.com/en/dxo-photolab/",
        tutorial: "https://userguides.dxo.com/photolab/en/overview/",
        desktopLabel: "获取 DxO PhotoLab Windows 版"
      })
    ]
  },
  {
    id: "craft",
    name: "Craft",
    initial: "C",
    color: "#e7468a",
    description: "提供跨平台文档、知识整理与内置 AI Assistant。",
    website: "https://www.craft.do/",
    tutorial: "https://support.craft.do/en/ai-assistant",
    products: [
      desktopProduct({
        id: "craft-desktop",
        name: "Craft",
        category: "文档与知识库",
        description: "合并 Web 与 Windows 入口的文档和知识工作台，内置 AI Assistant；模型、额度、编辑能力和数据范围以官方方案为准。",
        downloadPage: "https://www.craft.do/download",
        homePage: "https://www.craft.do/",
        webPage: "https://docs.craft.do/",
        tutorial: "https://support.craft.do/en/ai-assistant/using",
        desktopLabel: "获取 Craft Windows 版"
      })
    ]
  },
  {
    id: "capacities",
    name: "Capacities",
    initial: "C",
    color: "#cb5739",
    description: "提供基于对象和关联关系的知识工作台与 AI Assistant。",
    website: "https://capacities.io/",
    tutorial: "https://docs.capacities.io/reference/ai-assistant",
    products: [
      desktopProduct({
        id: "capacities-desktop",
        name: "Capacities",
        category: "文档与知识库",
        description: "合并 Web 与 Windows 入口的知识工作台，可在笔记上下文中使用 AI 聊天、整理和自动填充；部分能力需要订阅或自备模型密钥。",
        downloadPage: "https://capacities.io/download-app",
        homePage: "https://capacities.io/",
        webPage: "https://app.capacities.io/",
        tutorial: "https://docs.capacities.io/reference/ai-assistant",
        desktopLabel: "获取 Capacities Windows 版"
      })
    ]
  },
  {
    id: "evernote",
    name: "Evernote",
    initial: "E",
    color: "#00a82d",
    description: "提供跨平台笔记、任务、资料整理和 AI 辅助能力。",
    website: "https://evernote.com/",
    tutorial: "https://help.evernote.com/hc/en-us/articles/46319409880211-AI-Assistant",
    products: [
      desktopProduct({
        id: "evernote-desktop",
        name: "Evernote",
        category: "文档与知识库",
        description: "合并 Web 与 Windows 入口的笔记工作台，支持 AI Assistant、语义检索和内容整理；AI 能力受账号、版本与地区支持范围限制。",
        downloadPage: "https://evernote.com/download",
        homePage: "https://evernote.com/",
        webPage: "https://www.evernote.com/client/web",
        tutorial: "https://help.evernote.com/hc/en-us/articles/46319409880211-AI-Assistant",
        desktopLabel: "获取 Evernote Windows 版"
      })
    ]
  },
  {
    id: "dropbox",
    name: "Dropbox",
    initial: "D",
    color: "#0061ff",
    description: "提供云端内容协作、检索以及 Dropbox Dash AI 工作台。",
    website: "https://www.dropbox.com/",
    tutorial: "https://help.dropbox.com/installs/dash-desktop-app-overview",
    products: [
      desktopProduct({
        id: "dropbox-dash",
        name: "Dropbox Dash",
        category: "文档与知识库",
        description: "合并 Web 与 Windows 入口的 AI 通用搜索和内容工作台，可检索已授权应用与本地文件；桌面版下载需要先登录 Dash。",
        downloadPage: "https://help.dropbox.com/installs/download-install-dropbox-dash",
        homePage: "https://dash.dropbox.com/",
        webPage: "https://dash.ai/",
        tutorial: "https://help.dropbox.com/installs/dash-desktop-app-overview",
        desktopLabel: "获取 Dropbox Dash Windows 版"
      })
    ]
  },
  {
    id: "tana",
    name: "Tana",
    initial: "T",
    color: "#101828",
    description: "提供结构化知识管理、会议记录和 AI 工作流。",
    website: "https://tana.inc/",
    tutorial: "https://tana.inc/help/working-with-ai",
    products: [
      desktopProduct({
        id: "tana-outliner",
        name: "Tana Outliner",
        category: "文档与知识库",
        description: "合并 Web 与 Windows 入口的结构化知识工作台，支持 AI 聊天、会议记录、命令和语音输入；AI 功能需要联网。",
        downloadPage: "https://tana.inc/download",
        homePage: "https://tana.inc/",
        webPage: "https://home.tana.inc/",
        tutorial: "https://tana.inc/help/working-with-ai",
        desktopLabel: "获取 Tana Windows 版"
      })
    ]
  },
  {
    id: "heptabase",
    name: "Heptabase",
    initial: "H",
    color: "#ffb400",
    description: "提供卡片、白板和 AI Agent 结合的可视化知识工作台。",
    website: "https://heptabase.com/",
    tutorial: "https://support.heptabase.com/en/articles/10505755-how-can-i-get-an-api-key-to-use-ai-in-heptabase",
    products: [
      desktopProduct({
        id: "heptabase-desktop",
        name: "Heptabase",
        category: "文档与知识库",
        description: "合并 Web 与 Windows 入口的卡片和白板知识工作台，支持 AI Agent；模型、额度、自备密钥与数据访问范围以官方设置为准。",
        downloadPage: "https://heptabase.com/download",
        homePage: "https://heptabase.com/",
        webPage: "https://app.heptabase.com/",
        tutorial: "https://support.heptabase.com/en/articles/10505755-how-can-i-get-an-api-key-to-use-ai-in-heptabase",
        desktopLabel: "获取 Heptabase Windows 版"
      })
    ]
  },
  {
    id: "acd-systems",
    name: "ACD Systems",
    initial: "A",
    color: "#1a73e8",
    description: "开发面向 Windows 的照片管理、RAW 编辑和本地 AI 影像工具。",
    website: "https://www.acdsee.com/",
    tutorial: "https://help.acdsystems.com/en/acdsee-ultimate-19/",
    products: [
      desktopProduct({
        id: "acdsee-photo-studio-ultimate",
        name: "ACDSee Photo Studio Ultimate",
        category: "图像创作",
        description: "Windows 照片管理、RAW 和图层编辑工具，提供本地 AI 降噪、人像、蒙版、关键词和人脸识别；版本、订阅与硬件要求以官方说明为准。",
        downloadPage: "https://www.acdsee.com/en/products/photo-studio-ultimate/",
        homePage: "https://www.acdsee.com/en/products/photo-studio-ultimate/",
        tutorial: "https://help.acdsystems.com/en/acdsee-ultimate-19/",
        desktopLabel: "获取 ACDSee Windows 版"
      })
    ]
  },
  {
    id: "boris-fx",
    name: "Boris FX",
    initial: "B",
    color: "#111111",
    description: "提供专业视频后期、特效和创意软件，包括 Vegas Pro。",
    website: "https://borisfx.com/",
    tutorial: "https://www.vegascreativesoftware.com/vegas-pro/learn/",
    products: [
      desktopProduct({
        id: "vegas-pro",
        name: "Vegas Pro",
        category: "视频创作",
        description: "Windows 专业视频编辑器，提供 AI 蒙版、文本式剪辑、语音转文字、字幕、画幅重构和放大等能力；当前获取流程需要 Boris FX Hub 与账号。",
        downloadPage: "https://vfx.borisfx.com/vegas-pro-free-trial",
        homePage: "https://www.vegascreativesoftware.com/vegas-pro/",
        tutorial: "https://www.vegascreativesoftware.com/vegas-pro/learn/",
        desktopLabel: "获取 Vegas Pro Windows 版"
      })
    ]
  },
  {
    id: "zoner",
    name: "Zoner",
    initial: "Z",
    color: "#db1f2a",
    description: "开发 Windows 照片管理、RAW 编辑和轻量视频创作软件。",
    website: "https://www.zoner.com/en",
    tutorial: "https://learn.zoner.com/getting-started-with-zoner-photo-studio-x/",
    products: [
      desktopProduct({
        id: "zoner-studio",
        name: "Zoner Studio",
        category: "图像创作",
        description: "Windows 照片与轻量视频工作台，提供自动增强、人脸识别、AI 去背景和 AI 蒙版；试用、账号和订阅范围以官方说明为准。",
        downloadPage: "https://www.zoner.com/en/download",
        homePage: "https://www.zoner.com/en",
        tutorial: "https://learn.zoner.com/getting-started-with-zoner-photo-studio-x/",
        desktopLabel: "获取 Zoner Studio Windows 版"
      })
    ]
  }
];

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const obsoleteDraftProductIds = new Set([
  "craft-docs",
  "capacities-notes",
  "tana-desktop"
]);
for (const vendor of catalog.vendors) {
  vendor.products = vendor.products.filter(
    (product) => !obsoleteDraftProductIds.has(product.id)
  );
}
const productOwners = new Map(
  catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, vendor.id])
  )
);
let nextVendorOrder = Math.max(
  -1,
  ...catalog.vendors.map((vendor) => vendor.order ?? 0)
) + 1;

function upsertProduct(vendor, product) {
  const owner = productOwners.get(product.id);
  if (owner && owner !== vendor.id) {
    throw new Error(`产品 ID 已属于其他厂商：${product.id}`);
  }
  const existing = vendor.products.find((entry) => entry.id === product.id);
  if (existing) applyDefinition(existing, product, ["enabled", "order"]);
  else vendor.products.push(product);
  productOwners.set(product.id, vendor.id);
}

for (const definition of definitions) {
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
      "enabled",
      "order",
      "iconAsset",
      "iconUrl",
      "requiresCrossBorderNetwork",
      "products"
    ]);
  }
  for (const product of definition.products) upsertProduct(vendor, product);
}

catalog.updatedAt = verifiedAt;
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

process.stdout.write(
  `Expanded ${catalog.vendors.length} vendors, ${catalog.vendors.flatMap((vendor) => vendor.products).length} products and ${catalog.resources.length} resources\n`
);
