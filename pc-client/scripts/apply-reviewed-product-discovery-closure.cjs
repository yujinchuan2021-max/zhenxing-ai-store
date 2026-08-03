"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const verifiedAt = "2026-08-03T16:30:00.000Z";

function commonProduct({
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
  commonProduct({
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
  commonProduct({
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
  commonProduct({
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

const definitions = [
  {
    vendorId: "servicenow",
    products: [
      web({
        id: "servicenow-build-agent",
        name: "ServiceNow Build Agent",
        category: "编程开发",
        description: "面向 ServiceNow 应用与工作流的受治理开发智能体，可连接 MCP 客户端和常用编码工具。",
        website: "https://www.servicenow.com/products/vibe-coding.html",
        tutorial: "https://www.servicenow.com/products/vibe-coding.html",
        directoryKind: "ai-tool"
      }),
      web({
        id: "servicenow-ai-agents",
        name: "ServiceNow AI Agents",
        category: "智能体",
        description: "在 ServiceNow AI Platform 中构建、部署和治理企业智能体，权限与执行范围由组织配置控制。",
        website: "https://www.servicenow.com/products/ai-agents.html",
        tutorial: "https://www.servicenow.com/products/ai-agents.html",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "databricks",
    products: [
      web({
        id: "databricks-lakebase",
        name: "Databricks Lakebase",
        category: "数据库与数据",
        description: "面向数据应用与智能体的托管 PostgreSQL 数据库服务，访问范围沿用 Databricks 工作区权限。",
        website: "https://www.databricks.com/product/lakebase",
        tutorial: "https://www.databricks.com/product/lakebase",
        directoryKind: "ai-connectable"
      }),
      web({
        id: "databricks-agent-bricks",
        name: "Databricks Agent Bricks",
        category: "智能体",
        description: "用于构建、评估和治理数据智能体的平台产品，可连接企业数据、MCP 与外部工具。",
        website: "https://www.databricks.com/product/artificial-intelligence/agent-bricks",
        tutorial: "https://www.databricks.com/product/artificial-intelligence/agent-bricks",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "tabnine",
    products: [
      cli({
        id: "tabnine-cli",
        name: "Tabnine CLI",
        category: "编程开发",
        description: "运行在命令行中的编码智能体，用于终端内的代码、工作流和命令任务；它不是可视化桌面软件。",
        website: "https://www.tabnine.com/platform-cli/",
        tutorial: "https://www.tabnine.com/platform-cli/",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "cloudflare",
    products: [
      web({
        id: "cloudflare-agents",
        name: "Cloudflare Agents",
        category: "智能体",
        description: "基于 Cloudflare Workers 的智能体开发平台，提供状态、调度、WebHook 和 MCP 接入能力。",
        website: "https://www.cloudflare.com/products/agents/",
        tutorial: "https://developers.cloudflare.com/agents/",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "confluent",
    products: [
      web({
        id: "confluent-streaming-agents",
        name: "Confluent Streaming Agents",
        category: "智能体",
        description: "在托管 Kafka 与 Flink 数据流上构建实时智能体，支持 MCP 和 A2A；数据访问遵循 Confluent 权限。",
        website: "https://www.confluent.io/product/streaming-agents/",
        tutorial: "https://www.confluent.io/product/streaming-agents/",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "factory-ai",
    products: [
      desktop({
        id: "factory-droids",
        name: "Factory Droids",
        category: "智能体",
        description: "跨 Windows 桌面、网页、移动端与 CLI 同步的软件开发智能体；桌面端提供本机访问和结果预览。",
        downloadPage: "https://factory.ai/product/desktop",
        homePage: "https://factory.ai/product/droids",
        webPage: "https://app.factory.ai/",
        tutorial: "https://docs.factory.ai/welcome",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "grafana",
    products: [
      web({
        id: "grafana-agent-observability",
        name: "Grafana Agent Observability",
        category: "可观测性",
        description: "用于监控智能体会话、成本、质量和性能的 Grafana Cloud 能力；目前处于 Public Preview。",
        website: "https://grafana.com/docs/grafana-cloud/machine-learning/agent-observability/",
        tutorial: "https://grafana.com/docs/grafana-cloud/machine-learning/agent-observability/",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    vendorId: "hubspot",
    products: [
      web({
        id: "hubspot-customer-agent",
        name: "HubSpot Customer Agent",
        category: "客户服务",
        description: "基于 HubSpot 客户与知识数据回答问题、处理常见服务请求并把复杂会话转交人工。",
        website: "https://www.hubspot.com/products/artificial-intelligence/ai-customer-service-agent",
        tutorial: "https://www.hubspot.com/products/artificial-intelligence/ai-customer-service-agent",
        directoryKind: "ai-tool"
      }),
      web({
        id: "hubspot-prospecting-agent",
        name: "HubSpot Prospecting Agent",
        category: "营销与搜索",
        description: "在 HubSpot CRM 中研究账户、识别联系人并起草销售触达；自动发送前应由组织配置审核策略。",
        website: "https://www.hubspot.com/products/sales/ai-prospecting-agent",
        tutorial: "https://www.hubspot.com/products/sales/ai-prospecting-agent",
        directoryKind: "ai-tool"
      }),
      web({
        id: "hubspot-data-agent",
        name: "HubSpot Data Agent",
        category: "数据库与数据",
        description: "研究 CRM、通话、邮件、文档与网页并生成客户洞察；结果和执行仍受 HubSpot 账户权限控制。",
        website: "https://www.hubspot.com/products/artificial-intelligence/ai-data-agent",
        tutorial: "https://www.hubspot.com/products/artificial-intelligence/ai-data-agent",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "neo4j",
    products: [
      web({
        id: "neo4j-aura-agent",
        name: "Neo4j Aura Agent",
        category: "智能体",
        description: "使用图数据构建和部署可追溯智能体的托管产品，支持 REST 与 MCP 接入。",
        website: "https://neo4j.com/product/aura-agent/",
        tutorial: "https://neo4j.com/product/aura-agent/",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "sentry",
    products: [
      web({
        id: "sentry-seer-agent",
        name: "Sentry Seer Agent",
        category: "编程开发",
        description: "结合 Sentry 上下文分析错误、定位根因并提出或执行代码修复的开发智能体。",
        website: "https://sentry.io/product/seer/agent/",
        tutorial: "https://sentry.io/product/seer/agent/",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "uipath",
    products: [
      web({
        id: "uipath-agent-builder",
        name: "UiPath Agent Builder",
        category: "智能体",
        description: "用于设计、测试和治理企业智能体的 UiPath 平台产品，可与自动化流程和人工审批协同。",
        website: "https://www.uipath.com/platform/agentic-automation/agentic-ai/agent-builder",
        tutorial: "https://www.uipath.com/platform/agentic-automation/agentic-ai/agent-builder",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "zoom",
    products: [
      web({
        id: "zoom-virtual-agent",
        name: "Zoom Virtual Agent",
        category: "客户服务",
        description: "用于网站、应用和联络中心自助服务的对话式智能体，知识源和转人工规则由组织配置。",
        website: "https://www.zoom.com/en/products/virtual-agent/",
        tutorial: "https://www.zoom.com/en/products/virtual-agent/",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "asana",
    products: [
      web({
        id: "asana-ai-teammates",
        name: "Asana AI Teammates",
        category: "智能体",
        description: "在 Asana Work Graph 上协作并执行项目工作的团队智能体，沿用工作区中的访问权限。",
        website: "https://asana.com/product/ai/ai-teammates",
        tutorial: "https://asana.com/product/ai/ai-teammates",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "cisco",
    products: [
      web({
        id: "cisco-webex-ai-agent",
        name: "Webex AI Agent",
        category: "客户服务",
        description: "用于客户自助服务和联络中心流程的 Webex 智能体，支持语音与数字渠道。",
        website: "https://www.webex.com/us/en/products/customer-experience/ai-agent.html",
        tutorial: "https://www.webex.com/us/en/products/customer-experience/ai-agent.html",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "airtable",
    products: [
      desktop({
        id: "airtable-platform",
        name: "Airtable",
        category: "办公自动化",
        description: "可协作数据与业务应用平台，提供网页、Windows 客户端和官方远程 MCP；权限沿用用户角色。",
        downloadPage: "https://www.airtable.com/windows",
        homePage: "https://www.airtable.com/product",
        webPage: "https://airtable.com/login",
        tutorial: "https://support.airtable.com/v1/docs/using-the-airtable-mcp-server",
        directoryKind: "ai-connectable"
      })
    ]
  },
  {
    vendorId: "autodesk",
    products: [
      web({
        id: "autodesk-flow-studio",
        name: "Autodesk Flow Studio",
        category: "3D 创作",
        description: "把实拍或动画视频转换为可编辑 CG 场景的云端 AI 3D 工具，可导出到 Maya、Blender 和 Unreal。",
        website: "https://www.autodesk.com/products/flow-studio/overview",
        tutorial: "https://www.autodesk.com/products/flow-studio/product-details",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "lovable",
    products: [
      desktop({
        id: "lovable-ai-app-builder",
        name: "Lovable",
        category: "编程开发",
        description: "通过 AI 对话构建和部署 Web 应用，并在 Windows 桌面端管理项目、标签页与本地 MCP。",
        downloadPage: "https://lovable.dev/download",
        homePage: "https://lovable.dev/",
        webPage: "https://lovable.dev/",
        tutorial: "https://docs.lovable.dev/introduction/welcome",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "deepgram",
    products: [
      cli({
        id: "deepgram-cli",
        name: "Deepgram CLI",
        category: "音频创作",
        description: "运行在命令行中的 Deepgram 工具，用于语音转文字、文字转语音、账户操作、MCP 与插件；它不是可视化桌面软件。",
        website: "https://developers.deepgram.com/developer-tools/cli/getting-started",
        tutorial: "https://developers.deepgram.com/developer-tools/cli/installation",
        directoryKind: "ai-tool"
      })
    ]
  },
  {
    vendorId: "shopify",
    products: [
      web({
        id: "shopify-commerce-for-agents",
        name: "Shopify Commerce for Agents",
        category: "商业与支付",
        description: "让 AI 智能体接入商品目录、通用购物车和结账能力的 Shopify 平台，交易由用户和商家规则确认。",
        website: "https://www.shopify.com/commerce-for-agents",
        tutorial: "https://www.shopify.com/commerce-for-agents",
        directoryKind: "ai-connectable"
      })
    ]
  }
];

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const owners = new Map(
  catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, vendor.id])
  )
);

for (const definition of definitions) {
  const targetVendor = catalog.vendors.find(
    (vendor) => vendor.id === definition.vendorId
  );
  if (!targetVendor) throw new Error(`缺少既有厂商：${definition.vendorId}`);
  let nextOrder =
    Math.max(-1, ...targetVendor.products.map((product) => product.order ?? 0)) + 1;
  for (const productDefinition of definition.products) {
    const owner = owners.get(productDefinition.id);
    if (owner && owner !== targetVendor.id) {
      throw new Error(`产品 ID 已属于其他厂商：${productDefinition.id}`);
    }
    const existing = targetVendor.products.find(
      (product) => product.id === productDefinition.id
    );
    if (existing) applyDefinition(existing, productDefinition, ["enabled", "order"]);
    else targetVendor.products.push({ ...productDefinition, order: nextOrder++ });
    owners.set(productDefinition.id, targetVendor.id);
  }
}

catalog.updatedAt = verifiedAt;
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

process.stdout.write(
  `Closed reviewed product discovery at ${catalog.vendors.length} vendors and ${catalog.vendors.flatMap((vendor) => vendor.products).length} products\n`
);
