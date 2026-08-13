"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_PRODUCT_CATEGORIES,
  validateCatalog
} = require("../shared/catalog.cjs");
const {
  applyConnectableTaxonomy,
  categoryForConnectableProduct
} = require("../catalog/ai-connectable-taxonomy.cjs");

const root = path.resolve(__dirname, "..");
const catalogPaths = [
  path.join(root, "admin", "data", "catalog-v1.json"),
  path.join(root, "catalog", "catalog-v1.example.json")
];
const verifiedAt = "2026-08-02T00:00:00.000Z";

function webProduct(id, name, description, website, tutorial) {
  return {
    id,
    enabled: true,
    order: 0,
    directoryKind: "ai-connectable",
    name,
    kind: "其他产品",
    category: categoryForConnectableProduct(id),
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
    capabilities: ["website", "tutorial"]
  };
}

function desktopProduct(id, name, description, website, tutorial) {
  return {
    id,
    enabled: true,
    order: 0,
    directoryKind: "ai-connectable",
    name,
    kind: "桌面端",
    category: categoryForConnectableProduct(id),
    description,
    website,
    tutorial,
    productType: "desktop-official",
    moduleId: "desktop-official",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    capabilities: ["website", "tutorial"]
  };
}

const vendorSpecs = [
  ["google", "Google", "G", "#4285f4", "提供搜索、浏览器、云服务与人工智能产品。", "https://www.google.com/", "https://developer.chrome.com/docs/devtools/agents/get-started"],
  ["notion", "Notion", "N", "#111111", "提供文档、知识库和协作工作空间。", "https://www.notion.com/", "https://developers.notion.com/guides/mcp/overview"],
  ["github", "GitHub", "G", "#24292f", "提供代码托管、协作和开发者平台。", "https://github.com/", "https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server"],
  ["canva", "Canva", "C", "#7d2ae8", "提供视觉设计与内容创作平台。", "https://www.canva.com/", "https://www.canva.dev/docs/mcp/"],
  ["figma", "Figma", "F", "#f24e1e", "提供协作式界面设计、原型和开发交付平台。", "https://www.figma.com/", "https://developers.figma.com/docs/figma-mcp-server/"],
  ["atlassian", "Atlassian", "A", "#1868db", "提供项目管理、知识协作和代码托管产品。", "https://www.atlassian.com/", "https://developer.atlassian.com/cloud/rovo-mcp/"],
  ["docker", "Docker", "D", "#2496ed", "提供容器开发平台和 Docker Desktop。", "https://www.docker.com/", "https://docs.docker.com/ai/mcp-catalog-and-toolkit/"],
  ["cloudflare", "Cloudflare", "C", "#f38020", "提供网络、开发者平台、安全和边缘计算服务。", "https://www.cloudflare.com/", "https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/"],
  ["linear", "Linear", "L", "#5e6ad2", "提供软件团队项目、Issue 和产品开发管理平台。", "https://linear.app/", "https://linear.app/docs/mcp"],
  ["sentry", "Sentry", "S", "#362d59", "提供应用错误监控、性能分析和开发者可观测平台。", "https://sentry.io/", "https://github.com/getsentry/sentry-mcp"],
  ["stripe", "Stripe", "S", "#635bff", "提供在线支付与金融基础设施平台。", "https://stripe.com/", "https://docs.stripe.com/mcp"],
  ["supabase", "Supabase", "S", "#3ecf8e", "提供数据库、认证、存储和应用后端平台。", "https://supabase.com/", "https://supabase.com/docs/guides/ai-tools/mcp"],
  ["slack", "Slack", "S", "#4a154b", "提供团队消息、协作和工作流平台。", "https://slack.com/", "https://docs.slack.dev/ai/slack-mcp-server/"],
  ["jetbrains", "JetBrains", "J", "#000000", "提供 IntelliJ IDEA 等开发工具。", "https://www.jetbrains.com/", "https://www.jetbrains.com/help/idea/mcp-server.html"],
  ["vercel", "Vercel", "V", "#000000", "提供前端云、部署和应用交付平台。", "https://vercel.com/", "https://vercel.com/docs/agent-resources/vercel-mcp"],
  ["postman", "Postman", "P", "#ff6c37", "提供 API 设计、测试、协作和监控平台。", "https://www.postman.com/", "https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/overview/"],
  ["asana", "Asana", "A", "#f06a6a", "提供团队工作管理与协作平台。", "https://asana.com/", "https://developers.asana.com/docs/mcp-server"],
  ["hubspot", "HubSpot", "H", "#ff7a59", "提供 CRM、营销、销售和客户服务平台。", "https://www.hubspot.com/", "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server"]
].map(([id, name, initial, color, description, website, tutorial]) => ({
  id,
  enabled: true,
  name,
  initial,
  mark: initial,
  color,
  description,
  website,
  tutorial,
  iconUrl: "",
  products: []
}));

const productSpecs = [
  ["figma", desktopProduct("figma-design", "Figma Desktop", "Figma Windows 客户端可通过官方 MCP Server 向兼容 AI 工具提供设计上下文和画布操作。", "https://www.figma.com/downloads/", "https://developers.figma.com/docs/figma-mcp-server/")],
  ["notion", webProduct("notion-workspace", "Notion Workspace", "可通过 Notion MCP 向兼容 AI 工具提供工作区页面和知识内容。", "https://www.notion.so/", "https://developers.notion.com/guides/mcp/get-started-with-mcp")],
  ["atlassian", webProduct("atlassian-jira", "Jira", "可通过 Atlassian Rovo MCP Server 向兼容 AI 工具提供 Jira 项目和 Issue。", "https://www.atlassian.com/software/jira", "https://developer.atlassian.com/cloud/rovo-mcp/")],
  ["atlassian", webProduct("atlassian-confluence", "Confluence", "可通过 Atlassian Rovo MCP Server 向兼容 AI 工具提供 Confluence 知识内容。", "https://www.atlassian.com/software/confluence", "https://developer.atlassian.com/cloud/rovo-mcp/")],
  ["atlassian", webProduct("atlassian-bitbucket", "Bitbucket", "可通过 Atlassian Rovo MCP Server 向兼容 AI 工具提供 Bitbucket 代码协作内容。", "https://bitbucket.org/product", "https://developer.atlassian.com/cloud/rovo-mcp/")],
  ["github", webProduct("github-platform", "GitHub", "可通过 GitHub MCP Server 向兼容 AI 工具提供仓库、Issue、PR 和工作流能力。", "https://github.com/", "https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server")],
  ["docker", desktopProduct("docker-desktop", "Docker Desktop", "官方 Windows 桌面产品，内置 MCP Toolkit、Catalog 和 Gateway；枕星 AI 仅打开官方下载入口。", "https://www.docker.com/products/docker-desktop/", "https://docs.docker.com/ai/mcp-catalog-and-toolkit/get-started/")],
  ["cloudflare", webProduct("cloudflare-platform", "Cloudflare Platform", "可通过 Cloudflare 官方 MCP Servers 向兼容 AI 工具提供账户和产品能力。", "https://www.cloudflare.com/", "https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/")],
  ["linear", webProduct("linear-workspace", "Linear", "可通过 Linear MCP Server 向兼容 AI 工具提供 Issue、项目和评论。", "https://linear.app/", "https://linear.app/docs/mcp")],
  ["sentry", webProduct("sentry-platform", "Sentry", "可通过 Sentry MCP 向兼容 AI 工具提供错误、项目和排障上下文。", "https://sentry.io/", "https://github.com/getsentry/sentry-mcp")],
  ["stripe", webProduct("stripe-platform", "Stripe Platform", "可通过 Stripe MCP Server 向兼容 AI 工具提供支付平台能力。", "https://stripe.com/", "https://docs.stripe.com/mcp")],
  ["supabase", webProduct("supabase-projects", "Supabase Projects", "可通过 Supabase MCP Server 向兼容 AI 工具提供项目上下文和开发能力。", "https://supabase.com/dashboard/projects", "https://supabase.com/docs/guides/ai-tools/mcp")],
  ["vercel", webProduct("vercel-projects", "Vercel Projects", "可通过 Vercel MCP 向兼容 AI 工具提供项目、部署和日志能力。", "https://vercel.com/", "https://vercel.com/docs/agent-resources/vercel-mcp")],
  ["slack", webProduct("slack-workspace", "Slack Workspace", "可通过 Slack MCP Server 向已登记并获授权的 AI 客户端提供工作区能力。", "https://slack.com/", "https://docs.slack.dev/ai/slack-mcp-server/")],
  ["jetbrains", desktopProduct("jetbrains-intellij-idea", "IntelliJ IDEA", "IntelliJ IDEA 2025.2 起内置官方 MCP Server；枕星 AI 仅打开官方下载与配置说明。", "https://www.jetbrains.com/idea/download/?section=windows", "https://www.jetbrains.com/help/idea/mcp-server.html")],
  ["canva", webProduct("canva-design", "Canva", "可通过 Canva MCP / AI Connector 向获准的 AI 工具提供设计和品牌资产能力。", "https://www.canva.com/", "https://www.canva.dev/docs/mcp/")],
  ["postman", desktopProduct("postman-api-platform", "Postman Desktop", "Postman Windows 客户端及平台可通过官方 MCP Server 向兼容 AI 工具提供 API 工作区和集合能力。", "https://www.postman.com/downloads/", "https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/overview/")],
  ["google", desktopProduct("google-chrome-devtools", "Google Chrome DevTools", "Google Chrome 可通过官方 Chrome DevTools MCP Server 向兼容 AI 编程工具提供页面检查、调试与浏览器自动化能力。", "https://www.google.com/chrome/", "https://developer.chrome.com/docs/devtools/agents/get-started")],
  ["asana", webProduct("asana-work-graph", "Asana Work Graph", "可通过 Asana MCP Server V2 向兼容 AI 工具提供工作管理能力。", "https://asana.com/", "https://developers.asana.com/docs/mcp-server")],
  ["hubspot", webProduct("hubspot-crm", "HubSpot CRM", "可通过 HubSpot MCP Server 向兼容 AI 工具提供 CRM 数据和操作。", "https://www.hubspot.com/products/crm", "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server")]
];

const resourceSpecs = [
  {
    id: "figma-mcp-server",
    name: "Figma MCP Server",
    publisherVendorId: "figma",
    sourceProductIds: ["figma-design"],
    website: "https://developers.figma.com/docs/figma-mcp-server/",
    tutorial: "https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/",
    description: "Figma 官方远程 MCP Server，另提供桌面本地服务。",
    credentials: ["用户 OAuth；凭据由 Figma 与目标 AI 工具管理，目录不保存令牌。"],
    permissions: ["读取设计上下文", "创建或修改画布内容前必须确认"],
    uninstall: "未写入本地配置；断开时在目标 AI 工具删除连接，并在 Figma 撤销 OAuth。",
    evidence: ["https://developers.figma.com/docs/figma-mcp-server/", "https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/"],
    targets: [["codex-cli", "official"], ["claude-code", "official"], ["cursor-desktop", "official"], ["github-copilot", "official"], ["gemini-cli", "official"], ["windsurf-editor", "official"]]
  },
  {
    id: "notion-mcp",
    name: "Notion MCP",
    publisherVendorId: "notion",
    sourceProductIds: ["notion-workspace"],
    website: "https://developers.notion.com/guides/mcp/overview",
    tutorial: "https://developers.notion.com/guides/mcp/get-started-with-mcp",
    description: "Notion 官方托管 MCP 服务，为 AI 工具提供工作区页面上下文。",
    credentials: ["用户 OAuth；托管服务不接受直接 Bearer Token，目录不保存令牌。"],
    permissions: ["按用户权限读取工作区", "创建或修改页面前必须确认"],
    uninstall: "未写入本地配置；断开时在目标 AI 工具删除连接，并在 Notion 撤销 OAuth。",
    evidence: ["https://developers.notion.com/guides/mcp/overview", "https://developers.notion.com/guides/mcp/get-started-with-mcp"],
    targets: [["claude-code", "official"], ["cursor-desktop", "official"], ["github-copilot", "official"]]
  },
  {
    id: "atlassian-rovo-mcp-server",
    name: "Atlassian Rovo MCP Server",
    publisherVendorId: "atlassian",
    sourceProductIds: ["atlassian-jira", "atlassian-confluence", "atlassian-bitbucket"],
    website: "https://developer.atlassian.com/cloud/rovo-mcp/",
    tutorial: "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/",
    description: "Atlassian 官方远程 MCP 服务，连接 Jira、Confluence 和 Bitbucket。",
    credentials: ["OAuth 2.1；用户选择 Atlassian 站点和授权范围，目录不保存令牌。"],
    permissions: ["搜索所选 Atlassian 站点", "创建或更新 Jira、Confluence、Bitbucket 数据前必须确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并在 Atlassian 撤销 OAuth。",
    evidence: ["https://developer.atlassian.com/cloud/rovo-mcp/", "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/"],
    targets: [["chatgpt-desktop", "official"], ["claude-desktop", "official"], ["claude-code", "official"], ["codex-cli", "official"], ["github-copilot", "official"], ["github-copilot-cli", "official"], ["cursor-desktop", "official"], ["windsurf-editor", "official"]]
  },
  {
    id: "github-copilot-mcp",
    name: "GitHub MCP Server",
    publisherVendorId: "github",
    sourceProductIds: ["github-platform"],
    website: "https://github.com/github/github-mcp-server",
    tutorial: "https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server",
    description: "GitHub 官方远程或本地 MCP Server，提供仓库、Issue、PR 和工作流能力。",
    credentials: ["优先 OAuth；也可使用最小 scope 的 PAT，凭据必须进入系统凭据存储。"],
    permissions: ["读取用户批准的仓库、Issue 和 PR", "修改仓库、Issue、PR 或工作流前必须确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并在 GitHub 撤销 OAuth 或 PAT。",
    evidence: ["https://github.com/github/github-mcp-server", "https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server"],
    targets: [["github-copilot", "official"], ["github-copilot-cli", "official"], ["claude-code", "official"], ["claude-desktop", "official"], ["codex-cli", "official"], ["cursor-desktop", "official"], ["gemini-cli", "official"], ["opencode", "official"], ["windsurf-editor", "official"], ["zed-editor", "official"]]
  },
  {
    id: "google-chrome-devtools-mcp",
    name: "Chrome DevTools MCP",
    publisherVendorId: "google",
    sourceProductIds: ["google-chrome-devtools"],
    website: "https://github.com/ChromeDevTools/chrome-devtools-mcp",
    tutorial: "https://developer.chrome.com/docs/devtools/agents/get-started",
    description: "Google Chrome DevTools 团队维护的官方 MCP Server，用于页面检查、调试与浏览器自动化。",
    credentials: ["使用本机 Chrome 会话；目录不保存浏览器账号、Cookie 或访问令牌。"],
    permissions: ["读取当前浏览器页面、控制标签页并执行调试操作", "访问登录态页面、提交表单或修改站点数据前必须确认"],
    uninstall: "枕星 AI 当前只打开官方接入说明；断开时从目标 AI 工具删除连接，并关闭专用调试会话。",
    evidence: ["https://developer.chrome.com/docs/devtools/agents/get-started", "https://github.com/ChromeDevTools/chrome-devtools-mcp"],
    targets: [["gemini-cli", "official"], ["claude-code", "official"], ["cline-agent", "official"], ["github-copilot", "official"], ["cursor-desktop", "official"]]
  },
  {
    id: "docker-mcp-toolkit",
    name: "Docker MCP Toolkit",
    publisherVendorId: "docker",
    sourceProductIds: ["docker-desktop"],
    website: "https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/",
    tutorial: "https://docs.docker.com/ai/mcp-catalog-and-toolkit/get-started/",
    description: "Docker Desktop 官方 MCP Toolkit、Catalog 与 Gateway。",
    credentials: ["需要本地 Docker Desktop；OAuth 凭据由 MCP Toolkit 管理。"],
    permissions: ["访问用户明确选择的 MCP 服务", "主机文件挂载和第三方服务器启用必须确认"],
    uninstall: "枕星 AI 未安装或修改 Toolkit；用户需在 Docker Desktop 中禁用 Toolkit/Gateway 并撤销授权。",
    evidence: ["https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/", "https://docs.docker.com/ai/mcp-catalog-and-toolkit/get-started/"],
    targets: [["claude-desktop", "official"], ["cursor-desktop", "official"], ["codex-cli", "official"]]
  },
  {
    id: "cloudflare-api-mcp-server",
    name: "Cloudflare API MCP Server",
    publisherVendorId: "cloudflare",
    sourceProductIds: ["cloudflare-platform"],
    website: "https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/",
    tutorial: "https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/",
    description: "Cloudflare 官方托管 API MCP Server 与产品专用 MCP Servers。",
    credentials: ["用户 OAuth；由用户选择 Cloudflare 账户和权限，目录不保存令牌。"],
    permissions: ["读取所选 Cloudflare 账户和产品", "DNS、Workers、R2、Zero Trust 写操作必须二次确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并在 Cloudflare 撤销 OAuth。",
    evidence: ["https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/"],
    targets: [["claude-desktop", "official"], ["windsurf-editor", "official"], ["codex-cli", "official"]]
  },
  {
    id: "linear-mcp-server",
    name: "Linear MCP Server",
    publisherVendorId: "linear",
    sourceProductIds: ["linear-workspace"],
    website: "https://linear.app/docs/mcp",
    tutorial: "https://linear.app/docs/mcp",
    description: "Linear 官方远程 MCP Server，提供 Issue、项目和评论能力。",
    credentials: ["支持 OAuth 2.1、Bearer Token 或 API Key；凭据必须进入系统凭据存储。"],
    permissions: ["默认使用官方只读端点", "升级为读写并创建或修改内容前必须确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并在 Linear 撤销 OAuth 或密钥。",
    evidence: ["https://linear.app/docs/mcp"],
    targets: [["claude-desktop", "official"], ["claude-code", "official"], ["codex-cli", "official"], ["cursor-desktop", "official"], ["github-copilot", "official"], ["windsurf-editor", "official"], ["zed-editor", "official"]]
  },
  {
    id: "sentry-mcp",
    name: "Sentry MCP",
    publisherVendorId: "sentry",
    sourceProductIds: ["sentry-platform"],
    website: "https://github.com/getsentry/sentry-mcp",
    tutorial: "https://github.com/getsentry/sentry-mcp/blob/main/docs/security.md",
    description: "Sentry 官方托管及开源 MCP 服务，为编码代理提供排障上下文。",
    credentials: ["优先 OAuth；也支持 Sentry Token，本地模式可能另需模型 API Key，均不得写入目录。"],
    permissions: ["读取所选组织和项目的错误数据", "写操作仅按排障所需最小范围并须确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并撤销 Sentry OAuth 或令牌。",
    evidence: ["https://github.com/getsentry/sentry-mcp", "https://github.com/getsentry/sentry-mcp/blob/main/docs/security.md"],
    targets: [["claude-code", "official"], ["cursor-desktop", "official"]]
  },
  {
    id: "stripe-mcp-server",
    name: "Stripe MCP Server",
    publisherVendorId: "stripe",
    sourceProductIds: ["stripe-platform"],
    website: "https://docs.stripe.com/mcp",
    tutorial: "https://docs.stripe.com/mcp",
    description: "Stripe 官方远程 MCP Server，目前为 Public preview。",
    credentials: ["优先 OAuth；否则使用受限 API Key，并保存到系统凭据存储。"],
    permissions: ["默认使用 Sandbox 和最小权限", "Live Mode、退款及其他支付写操作必须人工确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并在 Stripe 撤销 OAuth 或密钥。",
    evidence: ["https://docs.stripe.com/mcp"],
    targets: [["cursor-desktop", "official"], ["claude-code", "official"], ["chatgpt-desktop", "official"]]
  },
  {
    id: "supabase-mcp-server",
    name: "Supabase MCP Server",
    publisherVendorId: "supabase",
    sourceProductIds: ["supabase-projects"],
    website: "https://supabase.com/docs/guides/ai-tools/mcp",
    tutorial: "https://github.com/supabase/mcp",
    description: "Supabase 官方远程 MCP Server 与官方开源实现。",
    credentials: ["默认 OAuth；CI 可用 PAT，凭据必须进入系统凭据存储。"],
    permissions: ["限定 project_ref 并默认 read_only=true", "SQL、迁移、部署和项目管理操作必须确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并在 Supabase 撤销 OAuth 或 PAT。",
    evidence: ["https://supabase.com/docs/guides/ai-tools/mcp", "https://github.com/supabase/mcp"],
    targets: [["claude-code", "official"]]
  },
  {
    id: "vercel-mcp",
    name: "Vercel MCP",
    publisherVendorId: "vercel",
    sourceProductIds: ["vercel-projects"],
    website: "https://vercel.com/docs/agent-resources/vercel-mcp",
    tutorial: "https://vercel.com/docs/agent-resources/vercel-mcp",
    description: "Vercel 官方远程 MCP 服务，目前为 Beta。",
    credentials: ["用户 OAuth；仅接受 Vercel 已审核客户端，目录不保存令牌。"],
    permissions: ["读取限定项目的部署和日志", "部署或配置变更必须确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并在 Vercel 撤销 OAuth。",
    evidence: ["https://vercel.com/docs/agent-resources/vercel-mcp"],
    targets: [["claude-desktop", "official"], ["chatgpt-desktop", "official"], ["codex-cli", "official"], ["cursor-desktop", "official"], ["windsurf-editor", "official"], ["gemini-cli", "protocol-compatible"]]
  },
  {
    id: "slack-mcp-server",
    name: "Slack MCP Server",
    publisherVendorId: "slack",
    sourceProductIds: ["slack-workspace"],
    website: "https://docs.slack.dev/ai/slack-mcp-server/",
    tutorial: "https://docs.slack.dev/ai/slack-mcp-server/",
    description: "Slack 官方远程 MCP Server，需要已登记的 Slack 应用身份。",
    credentials: ["需要固定 Slack App ID、Client ID/Secret、confidential OAuth 和管理员审批。"],
    permissions: ["按 granular scopes 访问选定频道或私信", "发送消息或访问敏感会话前必须确认"],
    uninstall: "未写入本地配置；断开时删除客户端连接，在 Slack 撤销应用授权并按需删除内部应用。",
    evidence: ["https://docs.slack.dev/ai/slack-mcp-server/"],
    targets: [["claude-code", "protocol-compatible"], ["codex-cli", "protocol-compatible"], ["cursor-desktop", "protocol-compatible"]]
  },
  {
    id: "jetbrains-idea-mcp-server",
    name: "IntelliJ IDEA MCP Server",
    publisherVendorId: "jetbrains",
    sourceProductIds: ["jetbrains-intellij-idea"],
    website: "https://www.jetbrains.com/help/idea/mcp-server.html",
    tutorial: "https://www.jetbrains.com/help/idea/mcp-server.html",
    description: "IntelliJ IDEA 2025.2 起官方内置的 MCP Server。",
    credentials: ["本地 IDE 连接；目录不保存凭据、命令或任意配置。"],
    permissions: ["读取或修改当前项目", "构建、运行和终端命令必须逐项确认，禁止自动开启 Brave Mode"],
    uninstall: "枕星 AI 未修改 IDE；断开时在 IntelliJ IDEA 禁用 MCP Server 或从目标客户端删除连接。",
    evidence: ["https://www.jetbrains.com/help/idea/mcp-server.html"],
    targets: [["claude-code", "official"], ["codex-cli", "official"], ["cursor-desktop", "official"], ["windsurf-editor", "official"], ["github-copilot-cli", "official"]]
  },
  {
    id: "canva-mcp",
    name: "Canva MCP / AI Connector",
    publisherVendorId: "canva",
    sourceProductIds: ["canva-design"],
    website: "https://www.canva.dev/docs/mcp/",
    tutorial: "https://www.canva.dev/docs/mcp/",
    description: "Canva 官方托管 MCP / AI Connector。",
    credentials: ["每位用户需登录授权；自定义客户端还需 Canva 批准 redirect URI。"],
    permissions: ["读取设计和品牌资产", "生成、编辑、导出或管理品牌资产前必须确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并在 Canva 撤销授权。",
    evidence: ["https://www.canva.dev/docs/mcp/"],
    targets: [["claude-desktop", "official"], ["chatgpt-desktop", "official"], ["codex-cli", "official"], ["gemini-cli", "protocol-compatible"]]
  },
  {
    id: "postman-mcp-server",
    name: "Postman MCP Server",
    publisherVendorId: "postman",
    sourceProductIds: ["postman-api-platform"],
    website: "https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/overview/",
    tutorial: "https://learning.postman.com/latest-v-12/docs/reference/postman-api/postman-mcp-server/postman-mcp-remote-server",
    description: "Postman 官方远程或本地 MCP Server。",
    credentials: ["美国远程服务优先 OAuth；EU 或本地服务使用 API Key，凭据必须进入系统凭据存储。"],
    permissions: ["默认使用 Minimal 工具集", "修改工作区、集合、环境变量或监控前必须确认"],
    uninstall: "未写入本地配置；断开时删除目标 AI 工具连接，并在 Postman 撤销 OAuth 或 API Key。",
    evidence: ["https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/overview/", "https://learning.postman.com/latest-v-12/docs/reference/postman-api/postman-mcp-server/postman-mcp-remote-server"],
    targets: [["claude-code", "official"], ["cursor-desktop", "official"], ["codex-cli", "official"], ["windsurf-editor", "official"], ["gemini-cli", "official"]]
  },
  {
    id: "asana-mcp-server-v2",
    name: "Asana MCP Server V2",
    publisherVendorId: "asana",
    sourceProductIds: ["asana-work-graph"],
    website: "https://developers.asana.com/docs/mcp-server",
    tutorial: "https://developers.asana.com/docs/integrating-with-asanas-mcp-server",
    description: "Asana 官方远程 MCP Server V2，当前已 GA。",
    credentials: ["通常需要预注册 MCP OAuth App 并托管 Client ID/Secret；不支持动态客户端注册。"],
    permissions: ["按用户权限访问 Asana Work Graph", "创建、修改或删除任务等写操作前必须确认"],
    uninstall: "未写入本地配置；断开时删除客户端连接，在 Asana 撤销 OAuth 并按需删除 MCP App。",
    evidence: ["https://developers.asana.com/docs/mcp-server", "https://developers.asana.com/docs/integrating-with-asanas-mcp-server"],
    targets: [["claude-desktop", "official"], ["chatgpt-desktop", "official"], ["claude-code", "official"], ["codex-cli", "official"], ["cursor-desktop", "official"]]
  },
  {
    id: "hubspot-mcp-server",
    name: "HubSpot MCP Server",
    publisherVendorId: "hubspot",
    sourceProductIds: ["hubspot-crm"],
    website: "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server",
    tutorial: "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server",
    description: "HubSpot 官方远程 MCP Server，为兼容客户端提供 CRM 能力。",
    credentials: ["需要 HubSpot MCP Auth App、OAuth + PKCE；Client Secret 只能进入服务端密钥存储。"],
    permissions: ["按 CRM 对象使用最小 scope", "删除、批量修改或外发 CRM 数据必须确认"],
    uninstall: "未写入本地配置；断开时删除客户端连接，在 HubSpot 撤销 OAuth 并按需删除 Auth App。",
    evidence: ["https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server"],
    targets: [["claude-code", "protocol-compatible"], ["codex-cli", "protocol-compatible"], ["cursor-desktop", "protocol-compatible"]]
  }
];

function ensureVendor(catalog, spec) {
  let vendor = catalog.vendors.find((entry) => entry.id === spec.id);
  if (vendor) return vendor;
  const order = Math.max(-1, ...catalog.vendors.map((entry) => entry.order ?? 0)) + 1;
  vendor = { ...spec, order, products: [] };
  catalog.vendors.push(vendor);
  return vendor;
}

function upsertProduct(catalog, vendor, product) {
  const owner = catalog.vendors.find((entry) =>
    entry.products.some((candidate) => candidate.id === product.id)
  );
  if (owner && owner.id !== vendor.id) {
    throw new Error(`产品 ID 已属于其他厂商：${product.id}`);
  }
  const index = vendor.products.findIndex((entry) => entry.id === product.id);
  if (index >= 0 && vendor.products[index].directoryKind !== "ai-connectable") {
    throw new Error(`拒绝覆盖现有 AI 产品：${product.id}`);
  }
  const order = index >= 0
    ? vendor.products[index].order ?? product.order
    : Math.max(-1, ...vendor.products.map((entry) => entry.order ?? 0)) + 1;
  const next = { ...product, order };
  if (index >= 0) vendor.products[index] = next;
  else vendor.products.push(next);
}

function linkedTarget(productId, compatibility) {
  return {
    productId,
    compatibility,
    moduleId: "resource-link",
    installProfileId: "",
    capabilities: ["website"],
    enabled: true
  };
}

function upsertResource(catalog, spec) {
  const productIds = new Set(
    catalog.vendors.flatMap((vendor) => vendor.products.map((product) => product.id))
  );
  const targets = spec.targets
    .filter(([productId]) => productIds.has(productId))
    .map(([productId, compatibility]) => linkedTarget(productId, compatibility));
  if (!targets.length) return;

  const index = catalog.resources.findIndex((resource) => resource.id === spec.id);
  const order = index >= 0
    ? catalog.resources[index].order ?? 0
    : Math.max(-1, ...catalog.resources.map((resource) => resource.order ?? 0)) + 1;
  const vendor = catalog.vendors.find((entry) => entry.id === spec.publisherVendorId);
  const next = {
    id: spec.id,
    enabled: true,
    order,
    name: spec.name,
    resourceTypes: ["mcp"],
    description: spec.description,
    website: spec.website,
    tutorial: spec.tutorial,
    publisherVendorId: spec.publisherVendorId,
    publisher: vendor.name,
    sourceKind: "official",
    sourceProductIds: spec.sourceProductIds,
    targets,
    versionRef: "rolling-official-service",
    requestedPermissions: spec.permissions,
    credentialRequirements: spec.credentials,
    installScope: "仅打开官方接入文档；不写入本地配置。",
    uninstallPlan: spec.uninstall,
    provenanceEvidence: spec.evidence,
    lastVerifiedAt: verifiedAt
  };
  if (index >= 0) catalog.resources[index] = next;
  else catalog.resources.push(next);
}

function retargetExistingResource(catalog, resourceId, targetIds, metadata) {
  const resource = catalog.resources.find((entry) => entry.id === resourceId);
  if (!resource) return;
  const productIds = new Set(
    catalog.vendors.flatMap((vendor) => vendor.products.map((product) => product.id))
  );
  resource.targets = targetIds
    .filter((productId) => productIds.has(productId))
    .map((productId) => linkedTarget(productId, "protocol-compatible"));
  Object.assign(resource, metadata);
}

for (const catalogPath of catalogPaths) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  catalog.categories ||= [...DEFAULT_PRODUCT_CATEGORIES];
  catalog.resources ||= [];
  catalog.resources = catalog.resources.filter(
    (resource) => resource.id !== "github-mcp-server"
  );

  for (const spec of vendorSpecs) ensureVendor(catalog, spec);
  for (const [vendorId, product] of productSpecs) {
    const vendor = catalog.vendors.find((entry) => entry.id === vendorId);
    upsertProduct(catalog, vendor, product);
  }
  for (const resource of resourceSpecs) upsertResource(catalog, resource);
  retargetExistingResource(
    catalog,
    "microsoft-playwright-mcp",
    [
      "claude-code",
      "codex-cli",
      "github-copilot",
      "github-copilot-cli",
      "cursor-desktop",
      "gemini-cli",
      "amazon-kiro-ide",
      "opencode",
      "cline-agent",
      "windsurf-editor"
    ],
    {
      requestedPermissions: [
        "读取和控制用户明确选择的浏览器页面",
        "访问登录态页面、提交表单或下载文件前必须确认"
      ],
      credentialRequirements: [
        "使用本机浏览器会话；目录不保存 Cookie、账号或访问令牌。"
      ],
      installScope: "仅打开官方接入说明；不写入本地配置。"
    }
  );
  retargetExistingResource(
    catalog,
    "microsoft-azure-mcp",
    ["claude-code", "codex-cli", "github-copilot", "cursor-desktop"],
    {
      requestedPermissions: [
        "读取用户明确授权的 Azure 订阅与资源",
        "创建、修改或删除云资源前必须确认"
      ],
      credentialRequirements: [
        "需要 Azure 登录和最小权限授权；目录不保存云凭据。"
      ],
      installScope: "仅打开官方接入说明；不写入本地配置。"
    }
  );

  applyConnectableTaxonomy(catalog);

  catalog.updatedAt = "2026-08-02T12:00:00.000Z";
  validateCatalog(catalog);
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  process.stdout.write(`Updated ${catalogPath}\n`);
}
