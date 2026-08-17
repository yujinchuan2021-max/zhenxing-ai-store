"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const fallbackPath = path.join(root, "admin", "data", "vendor-icon-fallbacks.json");
const verifiedAt = "2026-08-03T16:00:00.000Z";

function product({
  id,
  name,
  category,
  description,
  website,
  tutorial,
  directoryKind,
  mode = "web",
  order = 0,
  homePage = website
}) {
  const common = {
    id,
    enabled: true,
    order,
    directoryKind,
    name,
    category,
    description,
    website,
    tutorial,
    installProfileId: "",
    requirements: []
  };
  if (mode === "tutorial") {
    return {
      ...common,
      kind: "其他产品",
      productType: "tutorial",
      moduleId: "tutorial-link",
      installPolicy: "open-tutorial",
      downloadPolicy: "none",
      signaturePolicy: "not-applicable",
      uninstallPolicy: "not-managed",
      capabilities: ["tutorial"]
    };
  }
  if (mode === "desktop") {
    return {
      ...common,
      kind: "桌面端",
      productType: "desktop-official",
      moduleId: "desktop-official",
      installPolicy: "open-official-download",
      downloadPolicy: "official-page",
      signaturePolicy: "vendor-controlled",
      uninstallPolicy: "vendor-managed",
      capabilities: ["website", "tutorial"],
      entryPoints: [
        { type: "website", label: "工具官网", url: homePage },
        { type: "desktop", label: `获取 ${name}` },
        ...(tutorial !== website
          ? [{ type: "tutorial", label: "使用教程", url: tutorial }]
          : [])
      ]
    };
  }
  return {
    ...common,
    kind: "其他产品",
    productType: "web",
    moduleId: "web-link",
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

const aiTool = (definition) => product({ ...definition, directoryKind: "ai-tool" });
const connectable = (definition) =>
  product({ ...definition, directoryKind: "ai-connectable" });

function vendor(id, name, initial, color, description, website, tutorial, products) {
  return { id, name, initial, color, description, website, tutorial, products };
}

const vendorDefinitions = [
  vendor(
    "copilotkit",
    "CopilotKit",
    "C",
    "#243147",
    "面向 Agent 应用的开源前端与运行时工具。",
    "https://www.copilotkit.ai/",
    "https://docs.copilotkit.ai/",
    [
      aiTool({
        id: "copilotkit-agent-ui",
        name: "CopilotKit",
        category: "智能体",
        description: "用于构建 Agent 聊天、生成式 UI、共享状态与人机协作界面的 TypeScript 开发框架。",
        website: "https://docs.copilotkit.ai/",
        tutorial: "https://docs.copilotkit.ai/concepts/architecture",
        mode: "tutorial"
      })
    ]
  ),
  vendor(
    "composio",
    "Composio",
    "C",
    "#7c5cff",
    "为 Agent 提供第三方工具、连接账户与授权管理。",
    "https://composio.dev/",
    "https://docs.composio.dev/docs/quickstart",
    [
      connectable({
        id: "composio-agent-tools",
        name: "Composio",
        category: "智能体",
        description: "让 Agent 连接第三方应用并按用户隔离认证会话的 Web 工具平台；凭据由 Composio 与目标应用管理。",
        website: "https://composio.dev/",
        tutorial: "https://docs.composio.dev/docs/quickstart"
      })
    ]
  ),
  vendor(
    "arcade",
    "Arcade",
    "A",
    "#6750a4",
    "提供 Agent 工具调用、授权与 MCP Gateway。",
    "https://www.arcade.dev/",
    "https://docs.arcade.dev/en/guides/tool-calling",
    [
      connectable({
        id: "arcade-agent-tools",
        name: "Arcade",
        category: "智能体",
        description: "面向 Agent 的工具调用和标准化授权平台，可通过 MCP Gateway 聚合并筛选多个服务。",
        website: "https://www.arcade.dev/",
        tutorial: "https://docs.arcade.dev/en/guides/tool-calling"
      })
    ]
  ),
  vendor(
    "deepset",
    "deepset",
    "D",
    "#00a98f",
    "维护 Haystack 开源 Agent 与 RAG 编排框架。",
    "https://www.deepset.ai/",
    "https://docs.haystack.deepset.ai/",
    [
      aiTool({
        id: "haystack-agent-framework",
        name: "Haystack",
        category: "智能体",
        description: "用于生产级 Agent、RAG 与多模态搜索的 Python 编排框架，不作为 Windows 桌面软件展示。",
        website: "https://haystack.deepset.ai/",
        tutorial: "https://docs.haystack.deepset.ai/docs/agents",
        mode: "tutorial"
      })
    ]
  ),
  vendor(
    "mem0",
    "Mem0",
    "M",
    "#111827",
    "提供面向 Agent 的托管记忆层与开源工具。",
    "https://mem0.ai/",
    "https://docs.mem0.ai/introduction",
    [
      connectable({
        id: "mem0-agent-memory",
        name: "Mem0 Platform",
        category: "智能体",
        description: "面向用户、Agent 与会话的托管记忆平台；记忆写入、更新和删除仍受用户账户与目标工具控制。",
        website: "https://mem0.ai/",
        tutorial: "https://docs.mem0.ai/platform/overview"
      })
    ]
  ),
  vendor(
    "zep",
    "Zep",
    "Z",
    "#f97316",
    "提供 Agent 记忆、Graph RAG 与上下文组装平台。",
    "https://www.getzep.com/",
    "https://help.getzep.com/v2/concepts",
    [
      connectable({
        id: "zep-agent-memory",
        name: "Zep",
        category: "智能体",
        description: "保存对话并构建用户级知识图谱的 Agent 记忆与上下文平台；企业记忆 MCP 不包含在普通入口中。",
        website: "https://www.getzep.com/",
        tutorial: "https://help.getzep.com/v2/memory"
      })
    ]
  ),
  vendor(
    "browserbase",
    "Browserbase",
    "B",
    "#151515",
    "提供云端浏览器基础设施与 AI 原生浏览器 SDK。",
    "https://www.browserbase.com/",
    "https://docs.browserbase.com/welcome/what-is-browserbase",
    [
      connectable({
        id: "browserbase-platform",
        name: "Browserbase",
        category: "智能体",
        description: "供 Agent 使用的云端浏览器基础设施，支持持久会话、实时观察与浏览器交互；不是本机浏览器。",
        website: "https://www.browserbase.com/",
        tutorial: "https://docs.browserbase.com/use-cases/agents"
      }),
      aiTool({
        id: "browserbase-stagehand",
        name: "Stagehand",
        category: "智能体",
        description: "Browserbase 维护的 JavaScript/Python AI 浏览器 SDK，仅提供官方文档入口，不自动执行包安装。",
        website: "https://www.stagehand.dev/",
        tutorial: "https://docs.browserbase.com/welcome/getting-started",
        mode: "tutorial",
        order: 1
      })
    ]
  ),
  vendor(
    "firecrawl",
    "Firecrawl",
    "F",
    "#f97316",
    "提供面向 AI 应用的网页搜索、抓取和结构化提取服务。",
    "https://www.firecrawl.dev/",
    "https://docs.firecrawl.dev/introduction",
    [
      connectable({
        id: "firecrawl-platform",
        name: "Firecrawl",
        category: "智能体",
        description: "提供网页搜索、抓取、爬取和结构化提取的 Web 数据 API；CLI、Skill 与 MCP 作为子入口而非重复产品。",
        website: "https://www.firecrawl.dev/",
        tutorial: "https://docs.firecrawl.dev/introduction"
      })
    ]
  ),
  vendor(
    "tavily",
    "Tavily",
    "T",
    "#2563eb",
    "提供面向 AI Agent 的实时搜索与网页提取。",
    "https://www.tavily.com/",
    "https://docs.tavily.com/documentation/mcp",
    [
      connectable({
        id: "tavily-search-platform",
        name: "Tavily",
        category: "浏览器与搜索",
        description: "面向 AI Agent 的实时搜索和网页提取平台；API key 或 OAuth 由厂商与目标客户端管理。",
        website: "https://www.tavily.com/",
        tutorial: "https://docs.tavily.com/documentation/mcp"
      })
    ]
  ),
  vendor(
    "apify",
    "Apify",
    "A",
    "#97d700",
    "提供可由 Agent 调用的云端 Web 自动化平台。",
    "https://apify.com/",
    "https://docs.apify.com/get-started/agent-onboarding",
    [
      connectable({
        id: "apify-platform",
        name: "Apify Platform",
        category: "工作流自动化",
        description: "可通过 MCP、API 和 CLI 调用 Actors 的 Web 自动化平台；运行 Actor 和访问结果仍需用户授权。",
        website: "https://apify.com/",
        tutorial: "https://docs.apify.com/get-started/agent-onboarding"
      })
    ]
  ),
  vendor(
    "qdrant",
    "Qdrant",
    "Q",
    "#dc244c",
    "提供向量数据库与面向 Agent 的记忆检索能力。",
    "https://qdrant.tech/",
    "https://qdrant.tech/documentation/",
    [
      connectable({
        id: "qdrant-vector-database",
        name: "Qdrant",
        category: "数据库与数据",
        description: "向量数据库平台，可为 Agent 保存和检索向量记忆；写入与删除权限由用户自己的实例控制。",
        website: "https://qdrant.tech/",
        tutorial: "https://qdrant.tech/documentation/qdrant-mcp-server/"
      })
    ]
  ),
  vendor(
    "weaviate",
    "Weaviate",
    "W",
    "#00b894",
    "提供开源与托管向量数据库。",
    "https://weaviate.io/",
    "https://docs.weaviate.io/weaviate",
    [
      connectable({
        id: "weaviate-vector-database",
        name: "Weaviate",
        category: "数据库与数据",
        description: "支持语义检索与 Agent 接入的向量数据库；内置 MCP 默认关闭，写入能力也保留厂商安全默认值。",
        website: "https://weaviate.io/",
        tutorial: "https://docs.weaviate.io/weaviate/configuration/mcp-server"
      })
    ]
  ),
  vendor(
    "neon-database",
    "Neon",
    "N",
    "#00e599",
    "提供 Serverless Postgres 与面向开发工具的数据库接入。",
    "https://neon.com/",
    "https://neon.com/docs/introduction",
    [
      connectable({
        id: "neon-postgres",
        name: "Neon Postgres",
        category: "数据库与数据",
        description: "Serverless Postgres 平台，支持项目、分支、SQL 与迁移管理；连接串和数据库权限不由目录保存。",
        website: "https://neon.com/",
        tutorial: "https://neon.com/docs/ai/neon-mcp-server"
      })
    ]
  ),
  vendor(
    "gitbook",
    "GitBook",
    "G",
    "#346ddb",
    "提供文档编写、发布与 AI 可读内容服务。",
    "https://www.gitbook.com/",
    "https://gitbook.com/docs",
    [
      connectable({
        id: "gitbook-docs-platform",
        name: "GitBook",
        category: "内容管理与发布",
        description: "文档编写与发布平台；官方 MCP 只读取已发布内容，不读取草稿、分析数据或内部用户数据。",
        website: "https://www.gitbook.com/",
        tutorial: "https://gitbook.com/docs/publishing-documentation/mcp-servers-for-published-docs"
      })
    ]
  ),
  vendor(
    "new-relic",
    "New Relic",
    "N",
    "#1ce783",
    "提供应用、基础设施与日志可观测性平台。",
    "https://newrelic.com/",
    "https://docs.newrelic.com/",
    [
      connectable({
        id: "new-relic-observability",
        name: "New Relic",
        category: "可观测性",
        description: "可观测性平台；官方 MCP 仍处于 Preview，需按区域端点、RBAC 和最小权限配置。",
        website: "https://newrelic.com/",
        tutorial: "https://docs.newrelic.com/docs/agentic-ai/mcp/setup/"
      })
    ]
  ),
  vendor(
    "sider",
    "Sider",
    "S",
    "#7157ff",
    "提供多模型 AI 助手、浏览器 Agent 与 Windows 客户端。",
    "https://sider.ai/",
    "https://sider.ai/apps/windows",
    [
      aiTool({
        id: "sider-windows",
        name: "Sider for Windows",
        category: "AI 对话",
        description: "Sider 官方 Windows 图形客户端，提供多模型聊天、浏览器 Agent、文件与创作能力。",
        website: "https://sider.ai/apps/windows",
        tutorial: "https://sider.ai/download?windowsDl=1",
        homePage: "https://sider.ai/",
        mode: "desktop"
      })
    ]
  )
];

const resourceTargets = () =>
  ["codex-cli", "claude-code", "claude-desktop", "cursor-desktop"].map(
    (productId) => ({
      productId,
      compatibility: "protocol-compatible",
      moduleId: "resource-link",
      installProfileId: "",
      capabilities: ["website"],
      enabled: true
    })
  );

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
    targets: resourceTargets(),
    versionRef,
    requestedPermissions: [requestedPermissions],
    credentialRequirements: [credentialRequirements],
    installScope: "仅打开发布者官方接入文档；不执行命令、不写入目标工具配置，也不保存凭据。",
    uninstallPlan: "从目标 AI 工具中删除对应连接；保留厂商账户、数据和未由枕星AI助手 创建的配置。",
    provenanceEvidence: [website],
    lastVerifiedAt: verifiedAt
  };
}

const resourceDefinitions = [
  resource({
    id: "composio-mcp",
    name: "Composio MCP",
    description: "Composio 官方 MCP 入口，可为每个用户会话发现、认证并调用第三方工具。",
    website: "https://docs.composio.dev/docs/quickstart",
    publisherVendorId: "composio",
    publisher: "Composio",
    sourceProductId: "composio-agent-tools",
    requestedPermissions: "可代表用户调用已连接的第三方工具；每次敏感写入、发送或删除操作都需确认。",
    credentialRequirements: "连接账户、OAuth token 和 API key 由 Composio 与目标应用管理，目录不保存。"
  }),
  resource({
    id: "arcade-mcp-gateway",
    name: "Arcade MCP Gateway",
    description: "Arcade 官方 MCP Gateway，可聚合并筛选多个 MCP Server 与工具。",
    website: "https://docs.arcade.dev/en/guides/mcp-gateways",
    publisherVendorId: "arcade",
    publisher: "Arcade",
    sourceProductId: "arcade-agent-tools",
    requestedPermissions: "仅暴露任务需要的工具；聚合后的每个下游工具仍需单独审核其读写权限。",
    credentialRequirements: "Arcade 与下游服务的授权由用户账户管理，目录不保存 token。"
  }),
  resource({
    id: "mem0-mcp",
    name: "Mem0 MCP",
    description: "Mem0 官方 MCP，可新增、搜索、更新和删除 Agent 记忆。",
    website: "https://docs.mem0.ai/platform/mem0-mcp",
    publisherVendorId: "mem0",
    publisher: "Mem0",
    sourceProductId: "mem0-agent-memory",
    requestedPermissions: "可写入、修改及批量删除记忆；更新和删除操作必须由用户确认。",
    credentialRequirements: "Mem0 API key 由目标 AI 工具保存，目录不接收或转存。"
  }),
  resource({
    id: "zep-docs-mcp",
    name: "Zep Documentation MCP",
    description: "Zep 官方公共文档检索 MCP，与企业版用户记忆 MCP 明确分离。",
    website: "https://help.getzep.com/docs-mcp-server",
    publisherVendorId: "zep",
    publisher: "Zep",
    sourceProductId: "zep-agent-memory",
    requestedPermissions: "只检索 Zep 公共文档，不读取或修改用户记忆。",
    credentialRequirements: "按 Zep 官方文档配置；目录不保存任何账户凭据。"
  }),
  resource({
    id: "browserbase-mcp",
    name: "Browserbase MCP Server",
    description: "Browserbase 官方 MCP，可控制云端浏览器并与网页交互。",
    website: "https://docs.browserbase.com/integrations/mcp/introduction",
    publisherVendorId: "browserbase",
    publisher: "Browserbase",
    sourceProductId: "browserbase-platform",
    requestedPermissions: "可点击、填写并访问浏览器登录态；提交表单、发送消息、购买或删除前必须确认。",
    credentialRequirements: "Browserbase 项目凭据与网站登录态由用户和目标工具管理。"
  }),
  resource({
    id: "firecrawl-mcp",
    name: "Firecrawl MCP Server",
    description: "Firecrawl 官方 MCP，提供网页抓取、爬取、搜索与批量提取。",
    website: "https://docs.firecrawl.dev/mcp",
    publisherVendorId: "firecrawl",
    publisher: "Firecrawl",
    sourceProductId: "firecrawl-platform",
    requestedPermissions: "会向外部网站发起抓取和搜索请求；需遵守目标网站条款及数据使用边界。",
    credentialRequirements: "Firecrawl API key 由目标 AI 工具管理，目录不保存。"
  }),
  resource({
    id: "tavily-mcp",
    name: "Tavily MCP Server",
    description: "Tavily 官方 MCP，为 AI 客户端提供实时搜索和网页提取。",
    website: "https://docs.tavily.com/documentation/mcp",
    publisherVendorId: "tavily",
    publisher: "Tavily",
    sourceProductId: "tavily-search-platform",
    requestedPermissions: "会向互联网发送搜索或提取请求；用户应检查来源和结果用途。",
    credentialRequirements: "OAuth 或 Tavily API key 由 Tavily 与目标客户端管理。"
  }),
  resource({
    id: "apify-mcp",
    name: "Apify MCP Server",
    description: "Apify 官方 MCP，可发现和运行 Actors 并读取其存储与结果。",
    website: "https://docs.apify.com/integrations/mcp",
    publisherVendorId: "apify",
    publisher: "Apify",
    sourceProductId: "apify-platform",
    requestedPermissions: "可运行 Actors、产生费用并访问任务存储；运行前必须确认 Actor 和输入范围。",
    credentialRequirements: "Apify token 与 Actor 所需凭据由用户账户管理，目录不保存。"
  }),
  resource({
    id: "pinecone-mcp",
    name: "Pinecone MCP Server",
    description: "Pinecone 官方 MCP，可管理索引、写入、搜索和重排数据。",
    website: "https://docs.pinecone.io/guides/operations/mcp-server",
    publisherVendorId: "pinecone",
    publisher: "Pinecone",
    sourceProductId: "pinecone-vector-database",
    requestedPermissions: "可创建索引并写入数据，不是只读资源；变更索引前必须确认。",
    credentialRequirements: "Pinecone API key 和项目权限由目标 AI 工具管理。",
    versionRef: "ga-rolling-service"
  }),
  resource({
    id: "qdrant-mcp",
    name: "Qdrant MCP Server",
    description: "Qdrant 官方 MCP，可为 Agent 保存和检索向量记忆。",
    website: "https://qdrant.tech/documentation/qdrant-mcp-server/",
    publisherVendorId: "qdrant",
    publisher: "Qdrant",
    sourceProductId: "qdrant-vector-database",
    requestedPermissions: "可写入和检索用户选择的向量集合；覆盖或删除数据前必须确认。",
    credentialRequirements: "Qdrant 实例地址、API key 与 embedding 模型配置由目标工具管理。"
  }),
  resource({
    id: "weaviate-mcp",
    name: "Weaviate MCP Server",
    description: "Weaviate 内置官方 MCP，支持 schema、查询和可选写入。",
    website: "https://docs.weaviate.io/weaviate/configuration/mcp-server",
    publisherVendorId: "weaviate",
    publisher: "Weaviate",
    sourceProductId: "weaviate-vector-database",
    requestedPermissions: "MCP 与写入能力默认关闭；启用写入、修改 schema 或删除数据前必须确认。",
    credentialRequirements: "实例地址与认证凭据由用户自己的 Weaviate 环境管理。"
  }),
  resource({
    id: "neon-mcp",
    name: "Neon MCP Server",
    description: "Neon 官方 MCP，可管理项目、分支、数据库、SQL 与迁移。",
    website: "https://neon.com/docs/ai/neon-mcp-server",
    publisherVendorId: "neon-database",
    publisher: "Neon",
    sourceProductId: "neon-postgres",
    requestedPermissions: "可运行 SQL、修改 schema 和迁移；官方建议仅用于开发测试，不连接生产或 PII 数据库。",
    credentialRequirements: "Neon OAuth、项目和数据库权限由 Neon 与目标客户端管理。"
  }),
  resource({
    id: "gitbook-published-docs-mcp",
    name: "GitBook Published Docs MCP",
    description: "GitBook 为每个已发布站点提供的只读 HTTP MCP。",
    website: "https://gitbook.com/docs/publishing-documentation/mcp-servers-for-published-docs",
    publisherVendorId: "gitbook",
    publisher: "GitBook",
    sourceProductId: "gitbook-docs-platform",
    requestedPermissions: "只读取站点已发布内容，不读取草稿、分析数据或内部用户数据。",
    credentialRequirements: "受保护站点的身份验证由 GitBook 与目标客户端管理。"
  }),
  resource({
    id: "new-relic-mcp",
    name: "New Relic MCP Server",
    description: "New Relic 官方 MCP（Preview），可查询可观测性数据并执行部分运维动作。",
    website: "https://docs.newrelic.com/docs/agentic-ai/mcp/setup/",
    publisherVendorId: "new-relic",
    publisher: "New Relic",
    sourceProductId: "new-relic-observability",
    requestedPermissions: "会代表用户查询数据或采取动作；必须使用 RBAC、标签过滤和最小权限。",
    credentialRequirements: "按账户区域使用 US/EU 端点，New Relic 身份与授权由目标客户端管理。",
    versionRef: "preview-rolling-service"
  })
];

function applyCatalogBacklogClosure(catalog, fallbacks) {
  const productOwners = new Map(
    catalog.vendors.flatMap((entry) =>
      entry.products.map((item) => [item.id, entry.id])
    )
  );
  let nextVendorOrder =
    Math.max(-1, ...catalog.vendors.map((entry) => entry.order ?? 0)) + 1;

  for (const definition of vendorDefinitions) {
    let target = catalog.vendors.find((entry) => entry.id === definition.id);
    if (!target) {
      target = {
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
      catalog.vendors.push(target);
    } else {
      applyDefinition(
        target,
        {
          name: definition.name,
          initial: definition.initial,
          mark: definition.initial,
          color: definition.color,
          description: definition.description,
          website: definition.website,
          tutorial: definition.tutorial
        },
        ["enabled", "order", "iconUrl", "iconAsset"]
      );
    }
    for (const item of definition.products) {
      const owner = productOwners.get(item.id);
      if (owner && owner !== target.id) {
        throw new Error(`产品 ID 已属于其他厂商：${item.id}`);
      }
      const existing = target.products.find((entry) => entry.id === item.id);
      if (existing) applyDefinition(existing, item, ["enabled", "order"]);
      else target.products.push(structuredClone(item));
      productOwners.set(item.id, target.id);
    }
  }

  let nextResourceOrder =
    Math.max(-1, ...catalog.resources.map((item) => item.order ?? 0)) + 1;
  for (const definition of resourceDefinitions) {
    const existing = catalog.resources.find((entry) => entry.id === definition.id);
    if (existing) applyDefinition(existing, definition, ["enabled", "order"]);
    else {
      catalog.resources.push({
        ...structuredClone(definition),
        enabled: true,
        order: nextResourceOrder++
      });
    }
  }

  if (!catalog.updatedAt || Date.parse(catalog.updatedAt) < Date.parse(verifiedAt)) {
    catalog.updatedAt = verifiedAt;
  }
  validateCatalog(catalog);

  fallbacks.vendors ||= {};
  if (!fallbacks.reviewedAt || Date.parse(fallbacks.reviewedAt) < Date.parse(verifiedAt)) {
    fallbacks.reviewedAt = verifiedAt;
  }
  for (const definition of vendorDefinitions) {
    const target = catalog.vendors.find((entry) => entry.id === definition.id);
    if (target.iconAsset) {
      delete fallbacks.vendors[definition.id];
      continue;
    }
    fallbacks.vendors[definition.id] = {
      evidenceUrl: definition.website,
      reason:
        "厂商与产品身份已由官方来源核验；在未确认可用于第三方目录的方形品牌素材前使用文字兜底，禁止使用 favicon、搜索图片或相似厂商图标。"
    };
  }
  return { catalog, fallbacks };
}

function main() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const fallbacks = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
  applyCatalogBacklogClosure(catalog, fallbacks);
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  fs.writeFileSync(fallbackPath, `${JSON.stringify(fallbacks, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Closed catalog backlog at ${catalog.vendors.length} vendors, ${catalog.vendors.flatMap((entry) => entry.products).length} products and ${catalog.resources.length} resources\n`
  );
}

if (require.main === module) main();

module.exports = {
  applyCatalogBacklogClosure,
  resourceDefinitions,
  vendorDefinitions,
  verifiedAt
};
