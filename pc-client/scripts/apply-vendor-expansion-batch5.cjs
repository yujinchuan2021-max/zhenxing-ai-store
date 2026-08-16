"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const catalogPath = path.join(__dirname, "..", "admin", "data", "catalog-v1.json");
const fallbackPath = path.join(__dirname, "..", "admin", "data", "vendor-icon-fallbacks.json");

function product(type, id, name, category, description, website, tutorial, directoryKind) {
  const policies = {
    web: ["其他产品", "web-link", "open-product-website", "none", "not-applicable", "not-managed", ["website", "tutorial"]],
    "desktop-official": ["桌面端", "desktop-official", "open-official-download", "official-page", "vendor-controlled", "vendor-managed", ["website", "tutorial"]],
    tutorial: ["其他产品", "tutorial-link", "open-tutorial", "none", "not-applicable", "not-managed", ["tutorial"]]
  };
  const [kind, moduleId, installPolicy, downloadPolicy, signaturePolicy, uninstallPolicy, capabilities] = policies[type];
  return {
    id,
    enabled: true,
    order: 0,
    directoryKind,
    name,
    kind,
    category,
    description,
    website,
    tutorial,
    productType: type,
    moduleId,
    installProfileId: "",
    requirements: [],
    installPolicy,
    downloadPolicy,
    signaturePolicy,
    uninstallPolicy,
    capabilities
  };
}

const specs = [
  {
    id: "replit", name: "Replit", initial: "R", color: "#f26207",
    description: "提供浏览器内开发环境、部署平台和 AI 应用构建智能体。",
    website: "https://replit.com/", tutorial: "https://docs.replit.com/learn/build-with-agent",
    product: product("web", "replit-agent", "Replit Agent", "编程开发", "通过自然语言规划、编写、调试并发布应用和网站的浏览器 AI 开发环境。", "https://replit.com/ai", "https://docs.replit.com/learn/build-with-agent", "ai-tool")
  },
  {
    id: "stackblitz", name: "StackBlitz", initial: "S", color: "#1389fd",
    description: "开发浏览器原生开发环境和 AI 全栈应用构建产品 Bolt。",
    website: "https://stackblitz.com/", tutorial: "https://support.bolt.new/building/intro-bolt",
    product: product("web", "bolt-new", "Bolt", "编程开发", "在浏览器中通过 AI 生成、编辑和发布网站、Web 应用及移动应用。", "https://bolt.new/", "https://support.bolt.new/building/intro-bolt", "ai-tool")
  },
  {
    id: "lovable", name: "Lovable", initial: "L", color: "#ff5f87",
    description: "提供通过自然语言构建、迭代和部署 Web 应用的 AI 开发平台。",
    website: "https://lovable.dev/", tutorial: "https://docs.lovable.dev/introduction/welcome",
    product: product("web", "lovable-ai-app-builder", "Lovable", "编程开发", "通过 AI 对话构建、迭代并部署全栈 Web 应用。", "https://lovable.dev/", "https://docs.lovable.dev/introduction/welcome", "ai-tool")
  },
  {
    id: "brave", name: "Brave", initial: "B", color: "#fb542b",
    description: "开发注重隐私的浏览器及其内置 AI 助手 Leo。",
    website: "https://brave.com/", tutorial: "https://brave.com/leo/",
    product: product("desktop-official", "brave-browser-leo", "Brave Browser（含 Leo）", "AI 对话", "Brave Windows 浏览器内置 Leo AI；Leo 不是独立安装的软件。", "https://brave.com/download/", "https://brave.com/leo/", "ai-tool")
  },
  {
    id: "tabnine", name: "Tabnine", initial: "T", color: "#6f55ff",
    description: "提供面向多种 IDE 和企业代码库的 AI 编程助手。",
    website: "https://www.tabnine.com/", tutorial: "https://docs.tabnine.com/main/welcome/readme/supported-ides",
    product: product("tutorial", "tabnine-ai-code-assistant", "Tabnine AI Code Assistant", "编程开发", "安装在受支持 IDE 中的 AI 代码助手；不同 IDE 通过各自官方市场接入。", "https://www.tabnine.com/", "https://docs.tabnine.com/main/welcome/readme/supported-ides", "ai-tool")
  },
  {
    id: "ideogram", name: "Ideogram", initial: "I", color: "#111111",
    description: "提供浏览器中的 AI 图像生成、文字排版和图像编辑工具。",
    website: "https://ideogram.ai/", tutorial: "https://docs.ideogram.ai/using-ideogram/getting-started/generating-images",
    product: product("web", "ideogram-web", "Ideogram", "图像创作", "直接在浏览器中通过文字提示浏览、生成和编辑图像。", "https://ideogram.ai/", "https://docs.ideogram.ai/using-ideogram/getting-started/generating-images", "ai-tool")
  },
  {
    id: "recraft", name: "Recraft", initial: "R", color: "#5a5cf0",
    description: "提供 AI 位图、矢量、品牌视觉和设计工作区。",
    website: "https://www.recraft.ai/", tutorial: "https://www.recraft.ai/docs",
    product: product("web", "recraft-studio", "Recraft Studio", "图像创作", "浏览器中的 AI 图像、矢量、样机、背景和品牌视觉生成编辑平台。", "https://www.recraft.ai/", "https://www.recraft.ai/docs", "ai-tool")
  },
  {
    id: "luma", name: "Luma AI", initial: "L", color: "#111111",
    description: "提供面向创作者的 AI 图像和视频生成平台。",
    website: "https://lumalabs.ai/", tutorial: "https://lumalabs.ai/llm-info",
    product: product("web", "luma-app", "Luma App", "视频创作", "使用当前 Luma App 入口通过文本、图像和提示生成视频。", "https://app.lumalabs.ai/", "https://lumalabs.ai/llm-info", "ai-tool")
  },
  {
    id: "heygen", name: "HeyGen", initial: "H", color: "#7559ff",
    description: "提供浏览器中的 AI 视频、数字人和视频翻译平台。",
    website: "https://www.heygen.com/", tutorial: "https://www.heygen.com/tool/ai-video-generator",
    product: product("web", "heygen-ai-video", "HeyGen AI Video", "视频创作", "在浏览器中使用 AI 数字人、脚本和翻译能力制作视频。", "https://www.heygen.com/tool/ai-video-generator", "https://www.heygen.com/tool/ai-video-generator", "ai-tool")
  },
  {
    id: "synthesia", name: "Synthesia", initial: "S", color: "#7257f2",
    description: "提供面向企业的浏览器 AI 视频与数字人制作平台。",
    website: "https://www.synthesia.io/", tutorial: "https://docs.synthesia.io/docs/video-creation",
    product: product("web", "synthesia-ai-video", "Synthesia", "视频创作", "通过提示词、文档、URL、脚本和数字人在浏览器中创建企业视频。", "https://www.synthesia.io/", "https://docs.synthesia.io/docs/video-creation", "ai-tool")
  },
  {
    id: "ibm", name: "IBM", initial: "I", color: "#0f62fe",
    description: "提供企业软件、云服务以及 watsonx 人工智能平台。",
    website: "https://www.ibm.com/", tutorial: "https://www.ibm.com/products/watsonx-ai",
    product: product("web", "watsonx-ai", "IBM watsonx.ai", "智能体", "面向企业的 AI 开发 Studio，覆盖基础模型、Agent 工具、API、RAG 和部署。", "https://www.ibm.com/products/watsonx-ai", "https://www.ibm.com/products/watsonx-ai", "ai-tool")
  },
  {
    id: "deepgram", name: "Deepgram", initial: "D", color: "#13ef95",
    description: "提供语音识别、语音合成和实时 Voice Agent 开发平台。",
    website: "https://deepgram.com/", tutorial: "https://developers.deepgram.com/",
    product: product("web", "deepgram-voice-ai-platform", "Deepgram Voice AI Platform", "音频创作", "提供 Voice Agent、实时转写、语音合成、Playground 与 API/SDK 的开发平台。", "https://developers.deepgram.com/", "https://developers.deepgram.com/reference/deepgram-api-overview", "ai-tool")
  },
  {
    id: "pinecone", name: "Pinecone", initial: "P", color: "#11133f",
    description: "提供面向生产 AI 应用的托管向量数据库和检索能力。",
    website: "https://www.pinecone.io/", tutorial: "https://docs.pinecone.io/guides/get-started/overview",
    product: product("web", "pinecone-vector-database", "Pinecone Vector Database", "数据库与数据", "面向 AI 应用的托管向量数据库，提供嵌入、检索、重排、API 和开发工具接入。", "https://www.pinecone.io/", "https://docs.pinecone.io/guides/get-started/overview", "ai-connectable")
  },
  {
    id: "oracle", name: "Oracle", initial: "O", color: "#f80000",
    description: "提供数据库、企业软件和 Oracle Cloud Infrastructure。",
    website: "https://www.oracle.com/", tutorial: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/home.htm",
    product: product("web", "oracle-cloud-infrastructure", "Oracle Cloud Infrastructure", "云服务与运维", "可连接企业数据、API 和 Agent 的云平台；枕星AI助手 仅打开官方平台与文档。", "https://www.oracle.com/artificial-intelligence/enterprise-ai/", "https://docs.oracle.com/en-us/iaas/Content/generative-ai/home.htm", "ai-connectable")
  },
  {
    id: "sap", name: "SAP", initial: "S", color: "#0a6ed1",
    description: "提供企业应用、数据平台以及 SAP Business AI。",
    website: "https://www.sap.com/", tutorial: "https://help.sap.com/docs/sap-ai-core/generative-ai/generative-ai-hub",
    product: product("web", "sap-business-ai-platform", "SAP Business AI Platform", "办公自动化", "用于构建、集成和治理跨企业系统的 AI Agent、应用与工作流。", "https://www.sap.com/products/ai-platform.html", "https://help.sap.com/docs/sap-ai-core/generative-ai/generative-ai-hub", "ai-connectable")
  }
];

const fallbackEvidence = {
  "01ai": ["https://platform.01.ai/useragreement", "官方品牌条款要求取得事先书面许可后才能使用 01.AI Logo，当前目录使用文字标识。"],
  replit: ["https://replit.com/brand", "官方 Brand Center 的具体素材许可尚待复核，当前使用文字兜底。"],
  stackblitz: ["https://developer.stackblitz.com/public/img/logo/readme", "官方 Logo resource 已定位，落库前仍需固定具体 SVG 与使用条件。"],
  lovable: ["https://lovable.dev/brand", "官方 Brand Hub 已定位，落库前仍需固定具体素材及其品牌规范。"],
  brave: ["https://brave.com/brave-branding-assets/", "官方 Logo Package 已定位，落库前仍需审核包内版本与使用规范。"],
  tabnine: ["https://github.com/tabnine", "尚未找到面向第三方目录的官方品牌素材包，当前使用文字兜底。"],
  ideogram: ["https://ideogram.ai/tos", "官网链接的代码组织不等同于可复用企业 Logo，当前使用文字兜底。"],
  recraft: ["https://www.recraft.ai/legal/terms", "尚未确认可用于第三方目录的官方品牌素材与许可，当前使用文字兜底。"],
  luma: ["https://lumalabs.ai/legal/terms-of-service", "官方条款限制未经许可使用品牌标识，当前使用文字兜底。"],
  heygen: ["https://www.heygen.com/brand-kit", "官方 Brand Kit 已定位，落库前仍需固定具体 SVG 与使用规范。"],
  synthesia: ["https://www.synthesia.io/", "尚未找到对外品牌素材页或官网确认的代码组织，当前使用文字兜底。"],
  ibm: ["https://www.ibm.com/legal/copyright-trademark", "官方法律页要求其他公司取得明确许可，当前使用文字兜底。"],
  deepgram: ["https://deepgram.com/terms", "官方条款限制未经许可使用商标，当前使用文字兜底。"],
  pinecone: ["https://www.pinecone.io/newsroom/", "官方 Logo 集合已定位，落库前仍需审核具体素材及其使用条件。"],
  oracle: ["https://www.oracle.com/legal/logos/", "Oracle Logo 指南要求书面授权，当前使用文字兜底。"],
  sap: ["https://www.sap.com/design-system/digital/foundations/identity/logo/", "官方素材包已定位，落库前仍需确认目录场景符合品牌规范。"]
};

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const productOwners = new Map(
  catalog.vendors.flatMap((vendor) => vendor.products.map((entry) => [entry.id, vendor.id]))
);
let nextVendorOrder = Math.max(-1, ...catalog.vendors.map((entry) => entry.order ?? 0)) + 1;

for (const { product: nextProduct, ...definition } of specs) {
  const owner = productOwners.get(nextProduct.id);
  if (owner && owner !== definition.id) throw new Error(`产品 ID 已属于其他厂商：${nextProduct.id}`);

  let vendor = catalog.vendors.find((entry) => entry.id === definition.id);
  if (!vendor) {
    vendor = {
      ...definition,
      enabled: true,
      order: nextVendorOrder++,
      mark: definition.initial,
      iconUrl: "",
      products: []
    };
    catalog.vendors.push(vendor);
  } else {
    applyDefinition(vendor, { ...definition, mark: definition.initial }, [
      "enabled", "order", "iconAsset", "iconUrl", "requiresCrossBorderNetwork", "products"
    ]);
  }

  const productIndex = vendor.products.findIndex((entry) => entry.id === nextProduct.id);
  if (productIndex < 0) vendor.products.push(nextProduct);
  else applyDefinition(vendor.products[productIndex], nextProduct, ["enabled", "order"]);
  productOwners.set(nextProduct.id, vendor.id);
}

const productsById = new Map(
  catalog.vendors.flatMap((vendor) => vendor.products.map((entry) => [entry.id, entry]))
);
const restrictedLogoVendor = catalog.vendors.find((vendor) => vendor.id === "01ai");
if (restrictedLogoVendor) {
  delete restrictedLogoVendor.iconAsset;
  restrictedLogoVendor.iconUrl = "";
}
productsById.get("canva-windows").name = "Canva for Windows";
productsById.get("canva-design").name = "Canva Design Platform";
productsById.get("openai-codex").description = productsById
  .get("openai-codex")
  .description.replace(/迁移证据$/, "");

const vendorIdsByName = new Map(catalog.vendors.map((vendor) => [vendor.name, vendor.id]));
for (const resource of catalog.resources) {
  resource.publisherVendorId ||= vendorIdsByName.get(resource.publisher);
}

catalog.updatedAt = "2026-08-03T12:00:00.000Z";
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
const fallbacks = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
fallbacks.reviewedAt = "2026-08-03T12:00:00.000Z";
for (const [vendorId, [evidenceUrl, reason]] of Object.entries(fallbackEvidence)) {
  if (!catalog.vendors.find((vendor) => vendor.id === vendorId)?.iconAsset) {
    fallbacks.vendors[vendorId] = { evidenceUrl, reason };
  }
}
fs.writeFileSync(fallbackPath, `${JSON.stringify(fallbacks, null, 2)}\n`, "utf8");
process.stdout.write(`Expanded ${catalog.vendors.length} vendors and ${catalog.vendors.flatMap((vendor) => vendor.products).length} products\n`);
