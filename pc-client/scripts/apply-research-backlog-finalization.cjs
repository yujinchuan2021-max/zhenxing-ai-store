"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const fallbackPath = path.join(root, "admin", "data", "vendor-icon-fallbacks.json");
const verifiedAt = "2026-08-03T17:00:00.000Z";

function baseProduct({
  id,
  name,
  category,
  description,
  website,
  tutorial,
  directoryKind,
  kind,
  productType,
  moduleId,
  installPolicy,
  capabilities,
  entryPoints
}) {
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
    productType,
    moduleId,
    installProfileId: "",
    requirements: [],
    installPolicy,
    downloadPolicy: productType === "desktop-official" ? "official-page" : "none",
    signaturePolicy:
      productType === "desktop-official" ? "vendor-controlled" : "not-applicable",
    uninstallPolicy:
      productType === "desktop-official" ? "vendor-managed" : "not-managed",
    capabilities,
    ...(entryPoints ? { entryPoints } : {})
  };
}

const web = (definition) =>
  baseProduct({
    ...definition,
    kind: "其他产品",
    productType: "web",
    moduleId: "web-link",
    installPolicy: "open-product-website",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "web", label: `打开 ${definition.name}`, url: definition.website },
      ...(definition.tutorial !== definition.website
        ? [{ type: "tutorial", label: "使用教程", url: definition.tutorial }]
        : [])
    ]
  });

const cli = (definition) =>
  baseProduct({
    ...definition,
    kind: "CLI",
    productType: "cli-official",
    moduleId: "cli-official",
    installPolicy: "open-official-install",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "website", label: "CLI 官网", url: definition.website },
      { type: "cli", label: "查看 CLI 安装说明" },
      ...(definition.tutorial !== definition.website
        ? [{ type: "tutorial", label: "使用教程", url: definition.tutorial }]
        : [])
    ]
  });

const desktop = (definition) =>
  baseProduct({
    ...definition,
    website: definition.downloadPage,
    kind: "桌面端",
    productType: "desktop-official",
    moduleId: "desktop-official",
    installPolicy: "open-official-download",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "website", label: "工具官网", url: definition.homePage },
      ...(definition.webPage
        ? [{ type: "web", label: `${definition.name} 网页版`, url: definition.webPage }]
        : []),
      { type: "desktop", label: `获取 ${definition.name} Windows 版` },
      ...(definition.tutorial !== definition.downloadPage
        ? [{ type: "tutorial", label: "使用教程", url: definition.tutorial }]
        : [])
    ]
  });

function vendor(id, name, initial, color, description, website, tutorial, products) {
  return { id, name, initial, color, description, website, tutorial, products };
}

const vendorDefinitions = [
  vendor(
    "skales",
    "Skales",
    "S",
    "#111827",
    "提供本地优先的多模型 AI 桌面工作区。",
    "https://skales.app/",
    "https://docs.skales.app/",
    [
      desktop({
        id: "skales-desktop",
        name: "Skales",
        category: "AI 对话",
        description: "Windows 本地优先 AI 工作区；官方安装器尚未代码签名，可能触发 SmartScreen，因此只打开官方页面。",
        downloadPage: "https://skales.app/",
        homePage: "https://skales.app/",
        tutorial: "https://docs.skales.app/",
        directoryKind: "ai-tool"
      })
    ]
  ),
  vendor(
    "ptc",
    "PTC",
    "P",
    "#0066b3",
    "提供 CAD、PLM、工业物联网和数字化工程产品。",
    "https://www.ptc.com/",
    "https://www.ptc.com/en/products/creo/capabilities",
    [
      web({
        id: "onshape-ai-advisor",
        name: "Onshape AI Advisor",
        category: "3D 与工业仿真",
        description: "Onshape 内置帮助型 AI Advisor，不自动生成 CAD 设计；可用性受方案和管理员设置约束。",
        website: "https://www.onshape.com/en/features/ai-advisor",
        tutorial: "https://www.onshape.com/en/resource-center/what-is-new/ai-advisor-configurable-variable-studios-simulation",
        directoryKind: "ai-connectable"
      }),
      desktop({
        id: "ptc-creo",
        name: "PTC Creo / Creo+",
        category: "3D 与工业仿真",
        description: "Windows CAD 产品族；Advise 为正式能力，Assist 仍为 Beta、Automate 仍为 Alpha，预览能力不按正式功能宣传。",
        downloadPage: "https://www.ptc.com/en/products/creo/capabilities",
        homePage: "https://www.ptc.com/en/products/creo",
        tutorial: "https://www.ptc.com/en/news/2026/ptc-brings-ai-powered-guidance-to-the-design-environment-with-creo-13",
        directoryKind: "ai-connectable"
      })
    ]
  ),
  vendor(
    "allplan",
    "ALLPLAN",
    "A",
    "#e30613",
    "提供建筑、工程和施工设计软件。",
    "https://www.allplan.com/",
    "https://www.allplan.com/products/allplan/",
    [
      desktop({
        id: "allplan",
        name: "ALLPLAN",
        category: "3D 与工业仿真",
        description: "Windows BIM 产品，包含 AI Visualizer V2；许可证、显卡和系统要求以 ALLPLAN 官方说明为准。",
        downloadPage: "https://www.allplan.com/products/allplan/",
        homePage: "https://www.allplan.com/products/allplan/",
        tutorial: "https://www.allplan.com/us_en/system/releasenotes/2026/allplan-2026-0-1/",
        directoryKind: "ai-connectable"
      })
    ]
  ),
  vendor(
    "biorender",
    "BioRender",
    "B",
    "#0f766e",
    "提供面向生命科学的科研插图与图表平台。",
    "https://www.biorender.com/",
    "https://www.biorender.com/ai-tools",
    [
      web({
        id: "biorender-ai",
        name: "BioRender AI",
        category: "图像创作",
        description: "科研插图 Web 产品；部分生成能力仍处于 Beta，结果需要人工核验并遵守方案、点数和发布许可。",
        website: "https://www.biorender.com/ai-tools",
        tutorial: "https://help.biorender.com/hc/en-gb/articles/37585527817629-How-to-generate-custom-and-fully-editable-figures-with-BioRender-AI",
        directoryKind: "ai-tool"
      })
    ]
  ),
  vendor(
    "benchling",
    "Benchling",
    "B",
    "#5b4be8",
    "提供生命科学研发数据与协作平台。",
    "https://www.benchling.com/",
    "https://www.benchling.com/ai",
    [
      web({
        id: "benchling-ai",
        name: "Benchling AI",
        category: "数据库与数据",
        description: "面向企业生命科学研发的 AI 与数据平台，访问受租户、管理员、实验数据和合规策略约束。",
        website: "https://www.benchling.com/ai",
        tutorial: "https://www.benchling.com/ai/connectors",
        directoryKind: "ai-connectable"
      })
    ]
  ),
  vendor(
    "anytype",
    "Anytype",
    "A",
    "#111111",
    "提供本地优先的知识、对象和协作工作区。",
    "https://anytype.io/",
    "https://doc.anytype.io/anytype-docs/getting-started/install-and-setup",
    [
      desktop({
        id: "anytype-desktop",
        name: "Anytype",
        category: "文档与知识库",
        description: "本地优先的 Windows 可视化工作区；网页、桌面和本地 API 属于同一产品身份。",
        downloadPage: "https://anytype.io/downloads",
        homePage: "https://anytype.io/",
        tutorial: "https://doc.anytype.io/anytype-docs/getting-started/install-and-setup",
        directoryKind: "ai-connectable"
      }),
      cli({
        id: "anytype-cli",
        name: "Anytype CLI",
        category: "文档与知识库",
        description: "运行在命令行中的 Anytype 工具和无头服务示例；它不是可视化桌面软件，当前仅打开官方说明。",
        website: "https://developers.anytype.io/docs/examples/featured/cli/",
        tutorial: "https://developers.anytype.io/docs/examples/overview/",
        directoryKind: "ai-connectable"
      })
    ]
  )
];

const existingVendorProducts = [
  {
    vendorId: "pixverse",
    products: [
      cli({
        id: "pixverse-cli",
        name: "PixVerse CLI",
        category: "视频创作",
        description: "运行在命令行中的图像与视频生成工具，要求 Node.js 20+、OAuth 和账户点数；它不是可视化桌面软件。",
        website: "https://pixverse.ai/en",
        tutorial: "https://pixverse.ai/en/blog/pixverse-cli-generate-ai-videos-images-from-terminal",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "corel",
    products: [
      desktop({
        id: "paintshop-pro",
        name: "PaintShop Pro",
        category: "图像与设计",
        description: "Windows 图像编辑产品，包含官方 AI 能力；公开品牌仍主要使用 2023 版本，不将其描述为持续更新的新版本。",
        downloadPage: "https://www.paintshoppro.com/en/products/paintshop-pro/",
        homePage: "https://www.paintshoppro.com/en/products/paintshop-pro/",
        tutorial: "https://www.paintshoppro.com/en/products/paintshop-pro/ultimate/",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "databricks",
    products: [
      web({
        id: "databricks-apps",
        name: "Databricks Apps",
        category: "网站与建站",
        description: "在 Databricks 上构建和托管数据与 AI 应用的独立产品，工作区身份和凭据由 Databricks 管理。",
        website: "https://www.databricks.com/product/databricks-apps",
        tutorial: "https://www.databricks.com/product/databricks-apps",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    vendorId: "laiye",
    products: [
      web({
        id: "laiye-adp",
        name: "来也智能体文档处理",
        category: "文档与知识库",
        description: "面向企业文档理解和处理的智能体产品；API、MCP、CLI 与 Skill 是入口或资源，不重复建立一级产品。",
        website: "https://laiye.com/product/adp-platform",
        tutorial: "https://documents.laiye.com/",
        directoryKind: "ai-tool"
      }),
      desktop({
        id: "laiye-rpa",
        name: "来也 RPA",
        category: "工作流自动化",
        description: "可接入大模型的 Windows/Linux 流程自动化产品；自动化能操作业务系统，执行前必须确认权限。",
        downloadPage: "https://laiye.com/product/rpa-platform",
        homePage: "https://laiye.com/product/rpa-platform",
        tutorial: "https://documents.laiye.com/",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    vendorId: "neo4j",
    products: [
      desktop({
        id: "neo4j-enterprise-studio",
        name: "Neo4j Enterprise Studio",
        category: "数据库与数据",
        description: "企业图数据开发与管理产品，不是 Aura Agent 或 Neo4j Desktop 的别名；授权和部署由 Neo4j 账户管理。",
        downloadPage: "https://neo4j.com/product/enterprise-studio/",
        homePage: "https://neo4j.com/product/enterprise-studio/",
        tutorial: "https://neo4j.com/product/enterprise-studio/",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    vendorId: "open-interpreter",
    products: [
      desktop({
        id: "open-interpreter-desktop",
        name: "Open Interpreter Desktop",
        category: "智能体",
        description: "可跨应用、文件和浏览器执行操作的可视化产品；首次运行可能涉及 UAC，高风险提交、发送和删除必须确认。",
        downloadPage: "https://www.openinterpreter.com/desktop",
        homePage: "https://www.openinterpreter.com/desktop",
        tutorial: "https://www.openinterpreter.com/docs/desktop/install",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "qlik",
    products: [
      web({
        id: "qlik-discovery-agent",
        name: "Qlik Discovery Agent",
        category: "智能体",
        description: "基于 Qlik Analytics Engine 发现异常和洞察的企业智能体，依赖 Qlik 应用、数据权限和账户。",
        website: "https://www.qlik.com/us/products/discovery-agent",
        tutorial: "https://www.qlik.com/us/products/discovery-agent",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "siemens",
    products: [
      desktop({
        id: "siemens-eigen-engineering-agent",
        name: "Eigen Engineering Agent",
        category: "工程计算与仿真",
        description: "连接 TIA Portal 的受许可工程组件，需要受支持版本、组织账户和许可证；不是通用独立 Agent。",
        downloadPage: "https://www.siemens.com/en-us/products/tia-portal/",
        homePage: "https://press.siemens.com/global/en/pressrelease/siemens-launches-eigen-engineering-agent-bringing-purpose-built-ai-industrial",
        tutorial: "https://www.siemens.com/en-us/products/tia-portal/",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    vendorId: "thoughtspot",
    products: [
      web({
        id: "thoughtspot-analyst-studio",
        name: "ThoughtSpot Analyst Studio",
        category: "数据库与数据",
        description: "面向数据团队的 SQL、Python 与 AI 分析工作区；连接、查询和模型凭据由 ThoughtSpot 账户管理。",
        website: "https://www.thoughtspot.com/product/analyst-studio",
        tutorial: "https://www.thoughtspot.com/product/analyst-studio",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    vendorId: "uipath",
    products: [
      desktop({
        id: "uipath-studio",
        name: "UiPath Studio",
        category: "工作流自动化",
        description: "Windows 自动化开发产品，与 Agent Builder 有宿主关系但不是同一产品；自动化执行前仍需权限和人工确认。",
        downloadPage: "https://www.uipath.com/product/studio",
        homePage: "https://www.uipath.com/product/studio",
        tutorial: "https://www.uipath.com/platform/agentic-automation/agentic-ai/agent-builder",
        directoryKind: "ai-connectable"
      })
    ]
  }
];

const resourceTarget = (productId) => ({
  productId,
  compatibility: "protocol-compatible",
  moduleId: "resource-link",
  installProfileId: "",
  capabilities: ["website"],
  enabled: true
});

function resource({
  id,
  name,
  description,
  website,
  publisherVendorId,
  publisher,
  sourceProductId,
  requestedPermissions,
  credentialRequirements,
  versionRef = "rolling-official-docs"
}) {
  return {
    id,
    name,
    resourceTypes: ["mcp"],
    description,
    website,
    tutorial: website,
    publisherVendorId,
    publisher,
    sourceKind: "official",
    sourceProductIds: [sourceProductId],
    targets: [
      resourceTarget("codex-cli"),
      resourceTarget("claude-code"),
      resourceTarget("claude-desktop"),
      resourceTarget("cursor-desktop")
    ],
    versionRef,
    requestedPermissions: [requestedPermissions],
    credentialRequirements: [credentialRequirements],
    installScope: "仅打开官方 MCP 接入说明；不执行命令、不写入目标工具配置、不保存密钥。",
    uninstallPlan: "从目标 AI 工具删除 MCP 连接并在发布者账户撤销授权；不删除源产品中的数据。",
    provenanceEvidence: [website],
    lastVerifiedAt: verifiedAt
  };
}

const resourceDefinitions = [
  resource({
    id: "anytype-mcp",
    name: "Anytype MCP",
    description: "Anytype 官方 MCP 接入，可在用户授权范围内访问本地优先工作区。",
    website: "https://developers.anytype.io/docs/examples/featured/mcp/",
    publisherVendorId: "anytype",
    publisher: "Anytype",
    sourceProductId: "anytype-desktop",
    requestedPermissions: "可读取或修改 Anytype 对象；创建、批量修改和删除前必须确认。",
    credentialRequirements: "Anytype API key 和用户授权范围由 Anytype 与目标客户端管理。"
  }),
  resource({
    id: "benchling-mcp",
    name: "Benchling MCP",
    description: "Benchling 官方企业租户 MCP，用于把受控研发数据接入兼容 AI 客户端。",
    website: "https://help.benchling.com/hc/en-us/articles/40342713479437-Configure-Benchling-s-MCP-Server-for-other-MCP-clients",
    publisherVendorId: "benchling",
    publisher: "Benchling",
    sourceProductId: "benchling-ai",
    requestedPermissions: "可能访问敏感实验和研发数据；所有读写动作受租户、管理员和合规策略约束。",
    credentialRequirements: "企业租户 OAuth/DCR；租户端点是账户模板，不是公共固定 URL。"
  }),
  resource({
    id: "zep-memory-mcp",
    name: "Zep Memory MCP（企业版，需启用）",
    description: "仅面向 Zep Enterprise、需厂商按账户启用的记忆 MCP，不作为普通一键安装项。",
    website: "https://help.getzep.com/v3/memory-mcp-server",
    publisherVendorId: "zep",
    publisher: "Zep",
    sourceProductId: "zep-agent-memory",
    requestedPermissions: "可搜索和新增用户记忆；涉及用户上下文和长期记忆，写入前必须确认。",
    credentialRequirements: "Zep Enterprise、厂商启用和企业 IdP；普通账户不可直接使用。",
    versionRef: "enterprise-account-enabled"
  })
];

function upsertProduct(catalog, targetVendor, productDefinition, productOwners) {
  const owner = productOwners.get(productDefinition.id);
  if (owner && owner !== targetVendor.id) {
    throw new Error(`产品 ID 已属于其他厂商：${productDefinition.id}`);
  }
  const existing = targetVendor.products.find(
    (product) => product.id === productDefinition.id
  );
  if (existing) applyDefinition(existing, productDefinition, ["enabled", "order"]);
  else {
    const nextOrder =
      Math.max(-1, ...targetVendor.products.map((product) => product.order ?? 0)) + 1;
    targetVendor.products.push({ ...productDefinition, order: nextOrder });
  }
  productOwners.set(productDefinition.id, targetVendor.id);
}

function applyFinalization(catalog, fallbacks) {
  const productOwners = new Map(
    catalog.vendors.flatMap((vendorEntry) =>
      vendorEntry.products.map((productEntry) => [productEntry.id, vendorEntry.id])
    )
  );
  let nextVendorOrder =
    Math.max(-1, ...catalog.vendors.map((vendorEntry) => vendorEntry.order ?? 0)) + 1;

  for (const definition of vendorDefinitions) {
    let targetVendor = catalog.vendors.find((vendorEntry) => vendorEntry.id === definition.id);
    if (!targetVendor) {
      targetVendor = {
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
      catalog.vendors.push(targetVendor);
    }
    for (const productDefinition of definition.products) {
      upsertProduct(catalog, targetVendor, productDefinition, productOwners);
    }
  }

  for (const definition of existingVendorProducts) {
    const targetVendor = catalog.vendors.find(
      (vendorEntry) => vendorEntry.id === definition.vendorId
    );
    if (!targetVendor) throw new Error(`缺少既有厂商：${definition.vendorId}`);
    for (const productDefinition of definition.products) {
      upsertProduct(catalog, targetVendor, productDefinition, productOwners);
    }
  }

  const adobeVendor = catalog.vendors.find((vendorEntry) => vendorEntry.id === "adobe");
  if (!adobeVendor) throw new Error("缺少既有厂商：adobe");
  upsertProduct(
    catalog,
    adobeVendor,
    desktop({
      id: "adobe-creative-cloud",
      name: "Adobe Creative Cloud",
      category: "图像与设计",
      description: "Adobe 创意工具套件及官方 AI 能力；Windows 安装、更新和卸载由 Adobe Creative Cloud 管理。",
      downloadPage: "https://www.adobe.com/download/creative-cloud",
      homePage: "https://www.adobe.com/creativecloud.html",
      tutorial: "https://developer.adobe.com/adobe-for-creativity/getting-started/",
      directoryKind: "ai-connectable"
    }),
    productOwners
  );

  const codaVendor = catalog.vendors.find((vendorEntry) => vendorEntry.id === "coda");
  if (!codaVendor) throw new Error("缺少既有厂商：coda");
  applyDefinition(
    codaVendor,
    {
      name: "Superhuman Docs",
      initial: "S",
      mark: "S",
      description: "原 Coda，现已更名为 Superhuman Docs，提供协作文档、结构化数据、自动化与 Docs AI。",
      website: "https://docs.superhuman.com/",
      tutorial: "https://help.superhuman.com/hc/en-us/articles/46210093285773-What-s-changing-Coda-becomes-Superhuman-Docs"
    },
    ["enabled", "order", "color", "iconUrl", "iconAsset"]
  );
  upsertProduct(
    catalog,
    codaVendor,
    web({
      id: "coda-ai",
      name: "Superhuman Docs AI（原 Coda AI）",
      category: "文档与知识库",
      description: "在协作文档中起草内容、构建和更新表格、整理数据并处理评论；Windows 桌面版尚未发布。",
      website: "https://docs.superhuman.com/",
      tutorial: "https://help.superhuman.com/hc/en-us/articles/46210093285773-What-s-changing-Coda-becomes-Superhuman-Docs",
      directoryKind: "ai-tool"
    }),
    productOwners
  );

  let nextResourceOrder =
    Math.max(-1, ...catalog.resources.map((entry) => entry.order ?? 0)) + 1;
  for (const definition of resourceDefinitions) {
    const existing = catalog.resources.find((entry) => entry.id === definition.id);
    if (existing) applyDefinition(existing, definition, ["enabled", "order"]);
    else catalog.resources.push({ ...definition, enabled: true, order: nextResourceOrder++ });
  }

  catalog.updatedAt = verifiedAt;
  validateCatalog(catalog);

  fallbacks.vendors ||= {};
  fallbacks.reviewedAt = verifiedAt;
  for (const definition of vendorDefinitions) {
    const targetVendor = catalog.vendors.find((entry) => entry.id === definition.id);
    if (targetVendor.iconAsset) delete fallbacks.vendors[definition.id];
    else {
      fallbacks.vendors[definition.id] = {
        evidenceUrl: definition.website,
        reason: "厂商与产品身份已由官方来源核验；在未确认可用于第三方目录的方形品牌素材前使用文字兜底，禁止使用 favicon、搜索图片或相似厂商图标。"
      };
    }
  }
}

function main() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const fallbacks = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
  applyFinalization(catalog, fallbacks);
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  fs.writeFileSync(fallbackPath, `${JSON.stringify(fallbacks, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Finalized research backlog at ${catalog.vendors.length} vendors, ${catalog.vendors.flatMap((vendorEntry) => vendorEntry.products).length} products and ${catalog.resources.length} resources\n`
  );
}

if (require.main === module) main();

module.exports = {
  applyFinalization,
  existingVendorProducts,
  resourceDefinitions,
  vendorDefinitions,
  verifiedAt
};
