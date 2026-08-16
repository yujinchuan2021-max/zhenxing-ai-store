const { contextBridge, ipcRenderer } = require("electron");

const now = "2026-08-06T00:00:00.000Z";
const fixtureQuery = new URLSearchParams(globalThis.location?.search || "");
const fixtureLanguage = fixtureQuery.get("fixtureLanguage") === "en" ? "en" : "zh";
const fixtureHome = fixtureQuery.get("fixtureHome") || "carousel";
const canonicalModuleId = "desktop-download-only.signed-catalog";
const startupDelayMs = Number(process.env.AIHUB_STARTUP_CATALOG_DELAY_MS || 0);
const startupMode = process.env.AIHUB_STARTUP_CATALOG_MODE === "cache" ? "cache" : "remote";
const submissionMode = process.env.AIHUB_SUBMISSION_FIXTURE_MODE || "disabled";
const submissionEnabled = submissionMode !== "disabled" && submissionMode !== "anonymous";
const submissionAuthenticated = submissionMode !== "disabled" && submissionMode !== "anonymous";
const workflowMode = process.env.AIHUB_WORKFLOW_FIXTURE_MODE || "disabled";
const workflowEnabled = workflowMode !== "disabled" && workflowMode !== "disabled-auth";
const workflowAuthenticated = workflowEnabled || workflowMode === "disabled-auth";
const workflowPublicMode = fixtureQuery.get("workflowPublicMode") || process.env.AIHUB_WORKFLOW_PUBLIC_FIXTURE_MODE || "disabled";
const workflowPublicEnabled = workflowPublicMode !== "disabled";
const agentBridgeMode = fixtureQuery.get("agentBridgeMode") || process.env.AIHUB_AGENT_BRIDGE_FIXTURE_MODE || "disabled";
const fixedCliLifecycleMode = process.env.AIHUB_FIXED_CLI_LIFECYCLE_FIXTURE_MODE || "disabled";
const fixedCliLifecycleAvailable = ["enabled", "error", "busy", "busy-update", "busy-uninstall"].includes(fixedCliLifecycleMode);
const managedDownloadQueueMode = process.env.AIHUB_MANAGED_DOWNLOAD_QUEUE_FIXTURE_MODE || "disabled";
const managedDownloadQueueEnabled = ["enabled", "installed"].includes(managedDownloadQueueMode);
const managedDownloadProductionOrderEnabled = Boolean(process.env.AIHUB_MANAGED_DOWNLOAD_PRODUCTION_ORDER);
const submissionCalls = [];
const workflowCalls = [];
const workflowPublicCalls = [];
const agentBridgeCalls = [];
const fixedCliLifecycleCalls = [];
const managedDownloadQueueCalls = [];
const managementActionCalls = [];
const heldManagementActions = new Map();
const managedDownloadQueueTasks = new Map();
let managedDownloadRetrySequence = 0;
let managedDownloadRecordAvailable = false;
const downloadTaskListeners = new Set();
const managedDownloadQueueStatusDelays = new Map();
const managedDownloadQueueDeferredEnqueues = new Map();
let managedDownloadQueueListDelayMs = 0;
let managedDownloadQueueHeldList = false;
const managedDownloadQueueHeldStatuses = new Map();
const fixedCliPlans = new Map();
const fixedCliInstalled = new Set();
const fixedCliProfiles = new Map([
  ["google-antigravity-cli", "cli.antigravity"],
  ["moonshot-kimi-code-cli", "cli.kimi-code"]
]);
if (["busy-update", "busy-uninstall"].includes(fixedCliLifecycleMode)) fixedCliInstalled.add("google-antigravity-cli");
let workflowPublicCapabilityCalls = 0;
const submissionId = "11111111-1111-4111-8111-111111111111";
let submissionRevision = 1;
let fixtureSubmissions = [];
let workflowRevision = 1;
let fixtureWorkflows = [];
const submissionSuccess = (value) => ({ ok: true, value });
const submissionFailure = (status, code, messageKey) => ({ ok: false, error: { status, code, messageKey } });

function submissionError(status, code) {
  const message = code === "REVISION_CONFLICT"
    ? "投稿已在其他位置更新，请刷新后重试"
    : code === "RATE_LIMITED"
      ? "操作过于频繁，请稍后重试"
      : "投稿服务暂时不可用，请稍后重试";
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function ownerSubmission(overrides = {}) {
  return {
    submissionId,
    expectedRevision: submissionRevision,
    status: "draft",
    proposal: {
      submissionKind: "skill",
      title: "Fixture submission",
      summary: "A safe fixture proposal.",
      canonicalSource: "https://example.invalid/fixture-submission",
      evidenceRefs: ["https://example.invalid/evidence"]
    },
    allowedActions: ["update", "submit", "withdraw"],
    evidenceRequired: false,
    ...(submissionMode === "leak" ? { reviewerId: "must-not-render", riskLevel: "unsafe", merge: "must-not-render" } : {}),
    ...overrides
  };
}

function ownerWorkflow(overrides = {}) {
  return {
    workflowId: "22222222-2222-4222-8222-222222222222",
    expectedRevision: workflowRevision,
    status: "draft",
    sourceCommunityPostId: "42",
    provenance: { licenseId: "MIT", derivedFrom: [], discoveredVia: [] },
    content: {
      title: "Fixture workflow",
      summary: "A safe workflow fixture.",
      inputs: [], outputs: [], instructions: [], dependencies: [], secretPlaceholders: []
    },
    latestReleaseVersion: null,
    rejectionReason: null,
    postReferences: [],
    allowedActions: ["update", "submit"],
    ...(workflowMode === "leak" ? { reviewerId: "must-not-render", riskLevel: "unsafe", audit: "must-not-render" } : {}),
    ...overrides
  };
}

function publicWorkflow(overrides = {}) {
  const dependencies = workflowPublicMode === "composer"
    ? [
        { kind: "resource", canonicalId: "fixture-official-skill", hostProductId: "codex-cli", bindingKind: "skill", permissions: ["read"] },
        { kind: "resource", canonicalId: "fixture-official-mcp", hostProductId: "codex-cli", bindingKind: "mcp", permissions: ["read"] },
        { kind: "resource", canonicalId: "fixture-official-plugin", hostProductId: "codex-cli", bindingKind: "plugin", permissions: ["read"] },
        { kind: "resource", canonicalId: "fixture-official-connector", hostProductId: "codex-cli", bindingKind: "connector", permissions: ["read"] }
      ]
    : Array.from({ length: 4 }, (_, index) => ({ kind: "product", canonicalId: `fixture-dependency-with-a-long-canonical-identifier-${index + 1}`, permissions: ["none"] }));
  return {
    workflowId: "33333333-3333-4333-8333-333333333333",
    version: 1,
    author: { displayName: "Fixture public submitter" },
    ...(!["missing", "unsafe-omitted"].includes(workflowPublicMode) ? {
      originalAuthorDisplayName: workflowPublicMode === "named"
        ? "原作者示例 Fixture Original Author with a deliberately long bilingual public display name"
        : "Fixture original author"
    } : {}),
    sourceCommunityPostId: "42",
    provenance: {
      canonicalSource: { kind: "community-post", canonicalId: "42" },
      licenseId: "CC-BY-4.0",
      derivedFrom: []
    },
    content: {
      title: "Fixture public workflow with a deliberately long title for narrow previews",
      summary: "A safe, public, data-only fixture workflow with a deliberately long summary for wrapping checks.",
      inputs: [{ name: "prompt", type: "string", required: true, description: "Fixture input" }],
      outputs: [{ name: "result", type: "string", description: "Fixture output" }],
      instructions: ["Read the workflow documentation.", "Confirm any future guarded action."],
      dependencies
    },
    reviewStatus: "manually-reviewed",
    riskLevel: workflowPublicMode === "guarded" ? "guarded" : "low",
    requiresPerUseConfirmation: workflowPublicMode === "guarded",
    releasedAt: now,
    ...(workflowPublicMode === "leak" ? { reviewerId: "must-not-render", audit: "must-not-render", evidenceUrl: "https://must-not-render.test" } : {}),
    ...overrides
  };
}

if (submissionMode === "leak") fixtureSubmissions = [ownerSubmission()];
if (workflowMode === "leak") fixtureWorkflows = [ownerWorkflow()];

function product(overrides) {
  return {
    enabled: true,
    order: 1,
    directoryKind: "ai-tool",
    kind: "桌面端",
    category: "效率",
    description: "隔离已安装页预览样本",
    website: "https://example.invalid",
    tutorial: "https://example.invalid/tutorial",
    requirements: [],
    installPolicy: "client-managed-installer",
    downloadPolicy: "client-managed",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    capabilities: ["website", "install", "open", "uninstall"],
    ...overrides
  };
}

const catalog = {
  schemaVersion: 3,
  updatedAt: now,
  brand: {
    name: "枕星AI助手",
    mark: "枕",
    slogan: "中文目录品牌标语",
    localized: { en: { slogan: "Localized catalog brand slogan" } }
  },
  extraSections: [{
    id: "fixture-extra",
    title: "中文扩展入口",
    localized: { en: { title: "Localized extra section" } },
    description: "fixture",
    url: "https://example.invalid/extra",
    enabled: true
  }],
  community: {
    title: "中文目录社区",
    description: "中文目录社区简介",
    provider: "Fixture Community Provider",
    url: "https://example.invalid/community",
    enabled: true,
    localized: { en: { title: "Localized community title", description: "Localized community description" } }
  },
  home: {
    banners: [{
      eyebrow: "中文横幅标签",
      title: "中文横幅标题",
      description: "中文横幅简介",
      action: "中文横幅动作",
      localized: { en: { eyebrow: "Localized banner eyebrow", title: "Localized banner title", description: "Localized banner description", action: "Localized banner action" } }
    }],
    featuredVendorIds: []
  },
  homeCarousel: {
    autoplayMs: 5000,
    slides: [
      {
        id: "fixture-carousel-one",
        imageUrl: "/assets/home-carousel/constellation.svg",
        imageAlt: "",
        title: "隔离轮播第一张",
        description: "用于验证边缘翻页、圆点与语言数据边界。",
        localized: { en: { imageAlt: "Localized slide image alt", title: "Localized slide title", description: "Localized slide description" } },
        primaryAction: { label: "查看厂商", href: "/vendors", localized: { en: { label: "Localized slide action" } } },
        secondaryAction: { label: "打开原始来源", href: "https://example.invalid/carousel-secondary", localized: { en: { label: "Localized secondary action" } } },
        sort: 0,
        enabled: true
      },
      {
        id: "fixture-carousel-two",
        imageUrl: "/assets/home-carousel/aurora-grid.svg",
        imageAlt: "",
        title: "隔离轮播第二张",
        description: "键盘方向键必须仍可切换轮播。",
        localized: { en: { imageAlt: "Localized slide image alt", title: "Localized slide title", description: "Localized slide description" } },
        primaryAction: { label: "查看 Skill", href: "/resources/skill", localized: { en: { label: "Localized slide action" } } },
        secondaryAction: { label: "打开原始来源", href: "https://example.invalid/carousel-secondary", localized: { en: { label: "Localized secondary action" } } },
        sort: 1,
        enabled: true
      }
    ]
  },
  vendors: [
    {
      id: "fixture-vendor",
      enabled: true,
      order: 1,
      name: "Fixture Vendor",
      initial: "F",
      mark: "F",
      color: "#49D6DD",
      description: "隔离预览专用厂商",
      localized: { en: { name: "Localized vendor name", description: "Localized vendor description" } },
      website: "https://example.invalid",
      tutorial: "https://example.invalid/tutorial",
      products: [
        product({
          id: "fixture-managed-desktop",
          name: "Fixture Managed Desktop",
          productType: "desktop-reviewed",
          moduleId: "desktop-managed",
          installProfileId: "desktop.fixture-managed"
        }),
        product({
          id: "fixture-external-store",
          name: "Fixture External Store Installation",
          productType: "desktop-official",
          installPolicy: "open-official-download",
          downloadPolicy: "official-page",
          signaturePolicy: "vendor-controlled",
          uninstallPolicy: "vendor-managed",
          capabilities: ["website", "open", "uninstall"]
        }),
        product({
          id: "fixture-vendor-managed",
          name: "Fixture Vendor-managed Desktop",
          productType: "desktop-official",
          installPolicy: "open-official-install",
          downloadPolicy: "official-page",
          signaturePolicy: "vendor-controlled",
          uninstallPolicy: "vendor-managed",
          capabilities: ["website", "open", "uninstall"]
        }),
        product({
          id: "fixture-cli",
          name: "Fixture CLI",
          kind: "CLI",
          productType: "cli",
          moduleId: "managed-cli",
          installProfileId: "cli.fixture",
          installPolicy: "client-managed-cli",
          capabilities: ["website", "open", "uninstall"]
        }),
        product({
          id: "google-antigravity-cli",
          name: "Fixture Antigravity CLI",
          kind: "CLI",
          productType: "cli",
          moduleId: "cli-managed",
          installProfileId: "cli.antigravity",
          installPolicy: "client-managed-cli",
          downloadPolicy: "client-managed",
          signaturePolicy: "client-reviewed",
          uninstallPolicy: "client-managed",
          capabilities: ["website", "install", "update", "repair", "open", "uninstall"]
        }),
        product({
          id: "moonshot-kimi-code-cli",
          name: "Fixture Moonshot Kimi Code Command Line Interface With A Long Preview Name",
          kind: "CLI",
          productType: "cli",
          moduleId: "cli-managed",
          installProfileId: "cli.kimi-code",
          installPolicy: "client-managed-cli",
          downloadPolicy: "client-managed",
          signaturePolicy: "client-reviewed",
          uninstallPolicy: "client-managed",
          capabilities: ["website", "install", "update", "repair", "open", "uninstall"]
        }),
        product({
          id: "fixture-canonical-package",
          name: "Fixture Canonical Package",
          productType: "desktop-download-only",
          moduleId: canonicalModuleId,
          installProfileId: canonicalModuleId,
          downloadPolicy: "desktop-download-only",
          installPolicy: "client-managed-download",
          download: {
            url: "https://example.invalid/Fixture-Setup.exe",
            fileName: "Fixture-Setup.exe",
            artifactKind: "exe"
          }
        }),
        product({
          id: "fixture-running-canonical",
          name: "Fixture Running Download",
          localized: { en: { name: "Localized task product name", description: "Localized task product description" } },
          productType: "desktop-download-only",
          moduleId: canonicalModuleId,
          installProfileId: canonicalModuleId,
          downloadPolicy: "desktop-download-only",
          installPolicy: "client-managed-download",
          download: {
            url: "https://example.invalid/Running-Setup.exe",
            fileName: "Running-Setup.exe",
            artifactKind: "exe"
          }
        }),
        product({
          id: "fixture-missing-canonical",
          name: "Fixture Missing Package",
          productType: "desktop-download-only",
          moduleId: canonicalModuleId,
          installProfileId: canonicalModuleId,
          downloadPolicy: "desktop-download-only",
          installPolicy: "client-managed-download",
          download: {
            url: "https://example.invalid/Missing-Setup.exe",
            fileName: "Missing-Setup.exe",
            artifactKind: "exe"
          }
        }),
        product({
          id: "fixture-queue-long-canonical",
          name: "Fixture Queue Download With A Deliberately Long Bilingual Product Name",
          productType: "desktop-download-only",
          moduleId: canonicalModuleId,
          installProfileId: canonicalModuleId,
          downloadPolicy: "desktop-download-only",
          installPolicy: "client-managed-download",
          download: {
            url: "https://example.invalid/Queue-Long-Setup.exe",
            fileName: "Queue-Long-Setup.exe",
            artifactKind: "exe"
          }
        }),
        product({
          id: "fixture-queue-second-canonical",
          name: "Fixture Queue Second Package",
          productType: "desktop-download-only",
          moduleId: canonicalModuleId,
          installProfileId: canonicalModuleId,
          downloadPolicy: "desktop-download-only",
          installPolicy: "client-managed-download",
          download: {
            url: "https://example.invalid/Queue-Second-Setup.exe",
            fileName: "Queue-Second-Setup.exe",
            artifactKind: "exe"
          }
        }),
        product({
          id: "fixture-queue-third-canonical",
          name: "Fixture Queue Third Package",
          productType: "desktop-download-only",
          moduleId: canonicalModuleId,
          installProfileId: canonicalModuleId,
          downloadPolicy: "desktop-download-only",
          installPolicy: "client-managed-download",
          download: {
            url: "https://example.invalid/Queue-Third-Setup.exe",
            fileName: "Queue-Third-Setup.exe",
            artifactKind: "exe"
          }
        }),
        product({
          id: "fixture-invalid-canonical-package",
          name: "Fixture Invalid Canonical Package",
          productType: "desktop-download-only",
          moduleId: canonicalModuleId,
          installProfileId: canonicalModuleId,
          downloadPolicy: "desktop-download-only",
          installPolicy: "client-managed-download",
          download: {
            url: "https://example.invalid/Invalid-Setup.exe",
            fileName: "Invalid-Setup.exe",
            artifactKind: "exe",
            command: "cmd.exe"
          }
        }),
        product({
          id: "codex-cli",
          name: "Fixture Codex CLI",
          description: "中文目录产品简介",
          localized: { en: { name: "Localized product name", description: "Localized product description" } },
          kind: "CLI",
          productType: "cli",
          moduleId: "managed-cli",
          installProfileId: "cli.fixture-codex",
          scenarioTags: ["agent-multi-agent"],
          agentTag: true,
          agentChannel: "mature-agent"
        }),
        product({
          id: "fixture-game-host",
          name: "Fixture Game Host",
          productType: "web",
          scenarioTags: ["gaming", "game-development"]
        })
      ]
    },
    {
      id: "anytype",
      enabled: true,
      order: 2,
      name: "Anytype Fixture",
      initial: "A",
      mark: "A",
      color: "#49D6DD",
      description: "隔离 CLI 重试预览专用厂商",
      website: "https://example.invalid",
      tutorial: "https://example.invalid/tutorial",
      products: [
        product({
          id: "anytype-cli",
          name: "Fixture Deploy-only CLI",
          kind: "CLI",
          productType: "cli-deploy-only",
          moduleId: "cli-deploy-only",
          installProfileId: "cli-deploy-only.anytype",
          installPolicy: "client-managed-cli-deploy-only",
          downloadPolicy: "none",
          signaturePolicy: "client-reviewed",
          uninstallPolicy: "not-managed",
          capabilities: ["website", "tutorial", "install", "open"]
        })
      ]
    }
  ],
  resources: [
    {
      id: "fixture-official-skill",
      enabled: true,
      order: 0,
      name: "Fixture Official Skill",
      resourceTypes: ["skill"],
      description: "Official link-only fixture resource.",
      localized: { en: { name: "Localized resource name", description: "Localized resource description" } },
      website: "https://example.invalid/official-skill",
      tutorial: "https://example.invalid/official-skill/tutorial",
      publisher: "Fixture Publisher",
      sourceKind: "official",
      reviewStatus: "manually-reviewed",
      riskLevel: "low",
      scenarioTags: ["programming-development"],
      sourceProductIds: [],
      targets: [
        { productId: "codex-cli", compatibility: "official", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true },
        { productId: "fixture-game-host", compatibility: "protocol-compatible", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true }
      ]
    },
    {
      id: "fixture-official-game-skill",
      enabled: true,
      order: 1,
      name: "Fixture Official Game Skill",
      resourceTypes: ["skill"],
      description: "Official gaming Skill fixture.",
      website: "https://example.invalid/official-game-skill",
      tutorial: "https://example.invalid/official-game-skill/tutorial",
      sourceKind: "official",
      reviewStatus: "manually-reviewed",
      riskLevel: "low",
      scenarioTags: ["gaming"],
      sourceProductIds: [],
      targets: [{ productId: "fixture-game-host", compatibility: "official", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true }]
    },
    {
      id: "fixture-community-skill",
      enabled: true,
      order: 1,
      name: "Fixture Community Skill With A Deliberately Long Name",
      resourceTypes: ["skill"],
      description: "Reviewed community link-only Skill fixture.",
      website: "https://example.invalid/community-skill",
      tutorial: "https://example.invalid/community-skill/tutorial",
      sourceKind: "reviewed-community",
      reviewStatus: "manually-reviewed",
      riskLevel: "guarded",
      scenarioTags: ["programming-development"],
      sourceProductIds: [],
      targets: [{ productId: "codex-cli", compatibility: "protocol-compatible", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true }]
    },
    {
      id: "fixture-community-game-skill",
      enabled: true,
      order: 2,
      name: "Fixture Community Game Skill",
      resourceTypes: ["skill"],
      description: "Reviewed community gaming Skill fixture.",
      website: "https://example.invalid/community-game-skill",
      tutorial: "https://example.invalid/community-game-skill/tutorial",
      sourceKind: "reviewed-community",
      reviewStatus: "manually-reviewed",
      riskLevel: "guarded",
      scenarioTags: ["gaming"],
      sourceProductIds: [],
      targets: [{ productId: "fixture-game-host", compatibility: "protocol-compatible", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true }]
    },
    {
      id: "openai-codex-mcp-config",
      enabled: true,
      order: 0,
      name: "Fixture Managed MCP",
      resourceTypes: ["mcp"],
      description: "Managed fixture resource.",
      website: "https://developers.openai.com/mcp",
      tutorial: "https://developers.openai.com/mcp",
      sourceKind: "official",
      reviewStatus: "manually-reviewed",
      riskLevel: "low",
      sourceProductIds: [],
      targets: [{ productId: "codex-cli", compatibility: "official", moduleId: "mcp-managed", installProfileId: "mcp.codex.openai-developer-docs", capabilities: ["website", "install"], enabled: true }]
    },
    {
      id: "fixture-unsafe-community-mcp",
      enabled: true,
      order: 1,
      name: "Fixture Unsafe Community MCP",
      resourceTypes: ["mcp"],
      description: "Community fixture resource with a warning.",
      website: "https://example.invalid/community-mcp",
      tutorial: "https://example.invalid/community-mcp/tutorial",
      sourceKind: "community",
      reviewStatus: "rejected",
      riskLevel: "unsafe",
      metadataSnapshot: {
        sourcePlatform: "fixture-platform",
        discoveredVia: "fixture-index",
        sourcePage: "https://example.invalid/community-mcp/source",
        canonicalSource: "https://example.invalid/community-mcp/author",
        originalAuthor: "Fixture Author",
        observedAt: now,
        externalReference: { stars: 42, installCount: 7 }
      },
      sourceProductIds: [],
      targets: [{ productId: "fixture-game-host", compatibility: "protocol-compatible", moduleId: "mcp-managed", installProfileId: "mcp.codex.openai-developer-docs", capabilities: ["website", "install"], enabled: true }]
    },
    {
      id: "fixture-community-plugin",
      enabled: true,
      order: 0,
      name: "Fixture Community Plugin",
      resourceTypes: ["plugin"],
      description: "Reviewed community fixture plugin.",
      website: "https://example.invalid/community-plugin",
      tutorial: "https://example.invalid/community-plugin/tutorial",
      sourceKind: "reviewed-community",
      reviewStatus: "automated-reviewed",
      riskLevel: "guarded",
      sourceProductIds: [],
      targets: [{ productId: "codex-cli", compatibility: "protocol-compatible", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true }]
    },
    {
      id: "fixture-community-connector",
      enabled: true,
      order: 0,
      name: "Fixture Community Connector",
      resourceTypes: ["mcp", "connector"],
      description: "Community link-only fixture connector.",
      website: "https://example.invalid/community-connector",
      tutorial: "https://example.invalid/community-connector/tutorial",
      publisher: "Fixture Connection Publisher",
      sourceKind: "community",
      reviewStatus: "unreviewed",
      riskLevel: "guarded",
      sourceProductIds: [],
      targets: [
        { productId: "fixture-game-host", compatibility: "protocol-compatible", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true },
        { productId: "codex-cli", compatibility: "protocol-compatible", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true }
      ]
    }
  ],
  resourceConnections: [
    {
      resourceId: "fixture-community-connector",
      hostProductId: "fixture-game-host",
      connectionMode: "remote-mcp",
      bindingKind: "mcp-tool"
    },
    {
      resourceId: "fixture-community-connector",
      hostProductId: "codex-cli",
      connectionMode: "chatgpt-app",
      bindingKind: "connector-authorized-connection"
    }
  ],
  resourceStores: [
    { id: "skill", label: "Skill 商店（夹具）", localized: { en: { label: "Localized Skill Store" } }, enabled: true, order: 0 },
    { id: "mcp", label: "Fixture MCP Store", enabled: true, order: 1 },
    { id: "plugin", label: "Fixture Plugin Store", enabled: true, order: 2 },
    { id: "connector", label: "Fixture Connector Store", enabled: true, order: 3 }
  ]
};

const desktopStatus = (overrides = {}) => ({
  installed: true,
  version: "1.0.0",
  location: "C:\\Fixture",
  executable: "C:\\Fixture\\fixture.exe",
  appId: "fixture.app",
  canOpen: true,
  canUninstall: true,
  detection: "installed",
  ...overrides
});

function completedDownloadTask(productId, fileName) {
  return {
  schemaVersion: 1,
  productId,
  attemptId: "fixture-attempt",
  attempt: 1,
  revision: 1,
  phase: "completed",
  resumable: false,
  progress: {
    receivedBytes: 1024,
    totalBytes: 1024,
    bytesPerSecond: 0,
    etaSeconds: null,
    percent: 100,
    availableBytes: null,
    requiredBytes: null,
    remainingBytes: null,
    reserveBytes: null,
    installDiskBytes: null,
    installAvailableBytes: null,
    downloadDirectory: "C:\\Fixture\\Downloads",
    installSpaceOk: null,
    spaceOk: null
  },
  errorCode: null,
  errorMessage: null,
  filePath: `C:\\Fixture\\Downloads\\${fileName}`,
  sha256: "fixture",
  fileSize: 1024,
  createdAt: now,
  updatedAt: now,
  logs: []
  };
}

const downloadTasks = {
  "fixture-canonical-package": completedDownloadTask(
    "fixture-canonical-package",
    "Fixture-Setup.exe"
  ),
  "fixture-invalid-canonical-package": completedDownloadTask(
    "fixture-invalid-canonical-package",
    "Invalid-Setup.exe"
  ),
  "fixture-running-canonical": {
    ...completedDownloadTask("fixture-running-canonical", "Running-Setup.exe"),
    phase: "downloading",
    resumable: true,
    progress: {
      ...completedDownloadTask("fixture-running-canonical", "Running-Setup.exe").progress,
      receivedBytes: 512,
      totalBytes: 1024,
      percent: 50
    }
  }
};

const downloadStarts = [];

async function getFixtureCatalog() {
  if (startupDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, startupDelayMs));
  }
  const responseCatalog = structuredClone(catalog);
  if (fixtureHome === "banner") delete responseCatalog.homeCarousel;
  responseCatalog.vendors[0].name = startupMode === "remote" ? "Startup Remote Vendor" : "Startup Cache Vendor";
  responseCatalog.home.featuredVendorIds = [responseCatalog.vendors[0].id];
  return { source: startupMode, catalog: responseCatalog, error: "" };
}

function queuePresentation(phase) {
  return {
    state: phase === "downloaded" ? "completed" : ["failed", "cancelled"].includes(phase) ? "failed" : "active",
    canCancel: ["queued", "downloading"].includes(phase),
    canRetry: ["failed", "cancelled"].includes(phase)
  };
}

function queueTask(productId, phase, receivedBytes = 0, totalBytes = 0, errorCode, overrides = {}) {
  return {
    taskId: overrides.taskId || `fixture-queue-${productId}`,
    productId,
    profileId: canonicalModuleId,
    phase,
    progress: {
      receivedBytes,
      totalBytes,
      bytesPerSecond: phase === "downloading" ? 1024 : 0,
      percent: totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : null
    },
    presentation: overrides.presentation || queuePresentation(phase),
    ...(errorCode ? { errorCode } : {})
  };
}

if (managedDownloadQueueMode !== "installed") {
  managedDownloadQueueTasks.set(
    "fixture-running-canonical",
    queueTask("fixture-running-canonical", "downloading", 512, 1024, undefined, {
      taskId: "fixture-attempt"
    })
  );
}
if (managedDownloadQueueMode === "installed") {
  managedDownloadQueueTasks.set(
    "fixture-canonical-package",
    queueTask("fixture-canonical-package", "downloaded", 1024, 1024)
  );
}

function pumpManagedDownloadQueue() {
  const active = [...managedDownloadQueueTasks.values()]
    .filter((task) => task.phase === "downloading").length;
  let available = Math.max(0, 3 - active);
  for (const task of managedDownloadQueueTasks.values()) {
    if (!available || task.phase !== "queued") continue;
    task.phase = "downloading";
    task.progress.bytesPerSecond = 1024;
    available -= 1;
  }
}

function emitFixtureDownloadTask(task) {
  const current = downloadTasks[task.productId] || completedDownloadTask(
    task.productId,
    "Fixture-Queue.exe"
  );
  const sameAttempt = current.attemptId === task.taskId;
  const event = {
    ...current,
    productId: task.productId,
    attemptId: task.taskId,
    attempt: sameAttempt ? current.attempt : current.attempt + 1,
    revision: sameAttempt ? current.revision + 1 : 1,
    phase: task.phase === "downloaded" ? "completed" : task.phase === "cancelled" ? "canceled" : task.phase === "failed" ? "failed" : "downloading"
  };
  downloadTasks[task.productId] = event;
  for (const listener of downloadTaskListeners) listener(structuredClone(event));
}

function managedDownloadQueueBridge() {
  if (!managedDownloadQueueEnabled) return {};
  return {
    enqueueManagedDownload: async (input) => {
      managedDownloadQueueCalls.push({ method: "enqueue", input: structuredClone(input) });
      const deferred = managedDownloadQueueDeferredEnqueues.get(input.productId);
      if (deferred) {
        const task = queueTask(input.productId, "queued", 0, 1024, undefined, {
          taskId: deferred.taskId
        });
        const result = { ok: true, task: structuredClone(task) };
        managedDownloadQueueTasks.set(input.productId, task);
        managedDownloadQueueCalls.push({
          method: "enqueue-held",
          input: { productId: input.productId, taskId: task.taskId }
        });
        return new Promise((resolve) => {
          deferred.resolve = () => resolve(structuredClone(result));
        });
      }
      const existing = managedDownloadQueueTasks.get(input.productId);
      if (existing && ["queued", "downloading", "downloaded"].includes(existing.phase)) {
        return { ok: true, reused: true, task: structuredClone(existing) };
      }
      const active = [...managedDownloadQueueTasks.values()].filter((task) => task.phase === "downloading").length;
      const task = queueTask(input.productId, active < 3 ? "downloading" : "queued", active < 3 ? 256 : 0, 1024);
      managedDownloadQueueTasks.set(input.productId, task);
      return { ok: true, task: structuredClone(task) };
    },
    listManagedDownloadTasks: async () => {
      managedDownloadQueueCalls.push({ method: "list" });
      const snapshot = managedDownloadQueueHeldList?.snapshot || [...managedDownloadQueueTasks.values()].map((task) => structuredClone(task));
      if (managedDownloadQueueHeldList?.snapshot && !managedDownloadQueueHeldList.resolve) {
        managedDownloadQueueCalls.push({ method: "list-held" });
        return new Promise((resolve) => {
          managedDownloadQueueHeldList.resolve = resolve;
        });
      }
      const delay = managedDownloadQueueListDelayMs;
      managedDownloadQueueListDelayMs = 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      return snapshot;
    },
    getManagedDownloadTaskStatus: async ({ productId }) => {
      managedDownloadQueueCalls.push({ method: "status", input: { productId } });
      managedDownloadQueueCalls.push({ method: "status-call", input: { productId } });
      const task = managedDownloadQueueTasks.get(productId);
      const snapshot = task && structuredClone(task);
      if (managedDownloadQueueHeldStatuses.has(productId)) {
        return new Promise((resolve) => {
          managedDownloadQueueHeldStatuses.set(productId, { snapshot, resolve });
        });
      }
      const delay = managedDownloadQueueStatusDelays.get(productId) || 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      managedDownloadQueueCalls.push({ method: "status-resolve", input: { productId } });
      managedDownloadQueueCalls.push({ method: "status-resolved", input: { productId } });
      return snapshot ? { ok: true, task: snapshot } : { ok: false, errorCode: "TASK_NOT_FOUND" };
    },
    cancelManagedDownload: async (input) => {
      const { productId } = input;
      managedDownloadQueueCalls.push({ method: "cancel", input: structuredClone(input) });
      const task = managedDownloadQueueTasks.get(productId);
      if (!task) return { ok: false, errorCode: "TASK_NOT_FOUND" };
      task.phase = "cancelled";
      task.progress.bytesPerSecond = 0;
      pumpManagedDownloadQueue();
      return { ok: true, task: structuredClone(task) };
    },
    retryManagedDownload: async (input) => {
      managedDownloadQueueCalls.push({ method: "retry", input: structuredClone(input) });
      const task = managedDownloadQueueTasks.get(input.productId);
      if (!task) return { ok: false, errorCode: "TASK_NOT_FOUND" };
      task.taskId = `${task.taskId}-retry-${++managedDownloadRetrySequence}`;
      task.phase = "queued";
      task.progress.receivedBytes = 0;
      task.progress.percent = 0;
      pumpManagedDownloadQueue();
      return { ok: true, task: structuredClone(task) };
    },
    fixtureSetManagedDownloadQueueTask: (productId, phase, receivedBytes = 1024, totalBytes = 1024, errorCode, overrides = {}) => {
      const task = managedDownloadQueueTasks.get(productId) || queueTask(productId, phase, receivedBytes, totalBytes, errorCode, overrides);
      task.phase = phase;
      task.taskId = overrides.taskId || task.taskId;
      task.progress.receivedBytes = receivedBytes;
      task.progress.totalBytes = totalBytes;
      task.progress.percent = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : null;
      task.progress.bytesPerSecond = phase === "downloading" ? 1024 : 0;
      task.presentation = overrides.presentation || queuePresentation(phase);
      if (errorCode) task.errorCode = errorCode;
      managedDownloadQueueTasks.set(productId, task);
      pumpManagedDownloadQueue();
      if (overrides.emit !== false) emitFixtureDownloadTask(task);
      return structuredClone(task);
    },
    fixtureEmitDownloadTask: (task) => {
      downloadTasks[task.productId] = structuredClone(task);
      for (const listener of downloadTaskListeners) listener(structuredClone(task));
    },
    fixtureDelayManagedDownloadQueueStatus: (productId, delay) => {
      managedDownloadQueueStatusDelays.set(productId, delay);
    },
    fixtureDelayManagedDownloadQueueList: (delay) => {
      managedDownloadQueueListDelayMs = delay;
    },
    fixtureHoldManagedDownloadQueueList: (tasks) => {
      managedDownloadQueueHeldList = { snapshot: structuredClone(tasks), resolve: null };
    },
    fixtureReleaseManagedDownloadQueueList: () => {
      if (!managedDownloadQueueHeldList?.resolve) return false;
      const held = managedDownloadQueueHeldList;
      managedDownloadQueueHeldList = false;
      managedDownloadQueueCalls.push({ method: "list-resolved" });
      held.resolve(held.snapshot);
      return true;
    },
    fixtureHoldManagedDownloadQueueStatus: (productId) => {
      managedDownloadQueueHeldStatuses.set(productId, null);
    },
    fixtureResolveManagedDownloadQueueStatus: (productId) => {
      const held = managedDownloadQueueHeldStatuses.get(productId);
      if (!held?.resolve) return false;
      managedDownloadQueueHeldStatuses.delete(productId);
      managedDownloadQueueCalls.push({ method: "status-resolve", input: { productId } });
      managedDownloadQueueCalls.push({ method: "status-resolved", input: { productId } });
      held.resolve(held.snapshot ? { ok: true, task: held.snapshot } : { ok: false, errorCode: "TASK_NOT_FOUND" });
      return true;
    },
    fixtureHoldManagedDownloadQueueEnqueue: (productId, taskId) => {
      managedDownloadQueueDeferredEnqueues.set(productId, { taskId, resolve: null });
    },
    fixtureResolveManagedDownloadQueueEnqueue: (productId) => {
      const deferred = managedDownloadQueueDeferredEnqueues.get(productId);
      if (!deferred?.resolve) return false;
      managedDownloadQueueDeferredEnqueues.delete(productId);
      managedDownloadQueueCalls.push({
        method: "enqueue-resolved",
        input: { productId, taskId: deferred.taskId }
      });
      deferred.resolve();
      return true;
    },
    fixtureDeleteManagedDownloadQueueTask: (productId) => {
      managedDownloadQueueTasks.delete(productId);
      managedDownloadQueueDeferredEnqueues.delete(productId);
    },
    fixtureGetManagedDownloadQueueCalls: () => structuredClone(managedDownloadQueueCalls)
  };
}

function runManagementAction(key, value) {
  managementActionCalls.push(key);
  if (!heldManagementActions.has(key)) {
    return Promise.resolve(structuredClone(value));
  }
  return new Promise((resolve, reject) => {
    heldManagementActions.set(key, {
      resolve,
      reject,
      value: structuredClone(value)
    });
  });
}

const fixtureApi = {
  ...managedDownloadQueueBridge(),
  getSettings: async () => ({
    downloadDirectory: "C:\\Fixture\\Downloads",
    cliInstallDirectory: "C:\\Fixture\\CLI",
    language: fixtureLanguage
  }),
  getIdentity: async () => (submissionAuthenticated || workflowAuthenticated)
    ? {
        status: "authenticated",
        user: {
          id: "fixture-owner-immutable-id",
          username: "fixture-owner",
          profile: { nickname: "Fixture Owner", bio: "", avatarUrl: "" }
        }
      }
    : ({ status: "anonymous" }),
  getPersonalCenter: async () => ({
    user: {
      id: "fixture-owner-immutable-id",
      username: "fixture-owner",
      profile: { nickname: "Fixture Owner", bio: "", avatarUrl: "" }
    },
    sessions: [], notifications: [], interactions: [],
    social: { followers: 0, following: 0 },
    readingHistory: [], readingHistoryCapped: false,
    summary: { unreadNotifications: 0, unreadDirectMessages: 0, favorites: 0, likes: 0 },
    sources: { account: "ready", community: "unavailable" }, generatedAt: now
  }),
  getSubmissionCapability: async () => submissionSuccess({
    enabled: submissionEnabled,
    supportedKinds: ["vendor", "agent", "skill", "mcp", "plugin", "connector"],
    temporarilyUnavailableKinds: ["workflow"],
    authenticationRequired: true,
    proposalSchemaVersion: 1
  }),
  getWorkflowStoreCapability: async () => submissionSuccess({
    enabled: workflowEnabled,
    schemaVersion: 1,
    execution: false,
    workflowSubmissionLookup: false
  }),
  getWorkflowPublicCapability: async () => {
    workflowPublicCapabilityCalls += 1;
    return submissionSuccess({ enabled: workflowPublicEnabled, schemaVersion: 1, execution: false });
  },
  listPublicWorkflows: async (input = {}) => {
    workflowPublicCalls.push({ method: "list", input });
    if (workflowPublicMode === "unavailable") return submissionFailure(503, "PUBLIC_WORKFLOW_UNAVAILABLE", "workflow.public.unavailable");
    if (workflowPublicMode === "empty" || !workflowPublicEnabled) return submissionSuccess({ items: [], next: null });
    return submissionSuccess({ items: [publicWorkflow()], next: null });
  },
  getPublicWorkflow: async (input) => {
    workflowPublicCalls.push({ method: "get", input });
    if (["unavailable", "detail-unavailable"].includes(workflowPublicMode)) return submissionFailure(404, "PUBLIC_WORKFLOW_UNAVAILABLE", "workflow.public.unavailable");
    return submissionSuccess(publicWorkflow());
  },
  resolvePublicWorkflow: async (input) => {
    workflowPublicCalls.push({ method: "resolve", input });
    if (["unavailable", "detail-unavailable"].includes(workflowPublicMode)) return submissionFailure(404, "PUBLIC_WORKFLOW_UNAVAILABLE", "workflow.public.unavailable");
    return submissionSuccess(publicWorkflow());
  },
  getLocalAgentBridgeCapability: async () => submissionSuccess({
    schemaVersion: 1,
    enabled: agentBridgeMode === "enabled",
    execution: false,
    operations: agentBridgeMode === "enabled" ? ["search", "get", "plan", "request"] : []
  }),
  searchLocalAgentBridge: async (input) => {
    agentBridgeCalls.push({ method: "search", input });
    return submissionFailure(503, "BRIDGE_DISABLED", "agent.bridge.disabled");
  },
  getLocalAgentBridge: async (input) => {
    agentBridgeCalls.push({ method: "get", input });
    return submissionFailure(503, "BRIDGE_DISABLED", "agent.bridge.disabled");
  },
  planLocalAgentBridge: async (input) => {
    agentBridgeCalls.push({ method: "plan", input });
    return submissionFailure(503, "BRIDGE_DISABLED", "agent.bridge.disabled");
  },
  requestLocalAgentBridge: async (input) => {
    agentBridgeCalls.push({ method: "request", input });
    return submissionFailure(503, "BRIDGE_DISABLED", "agent.bridge.disabled");
  },
  getFixedCliLifecycleStatus: async (input) => {
    fixedCliLifecycleCalls.push({ method: "status", input });
    if (!fixedCliLifecycleAvailable) return submissionFailure(503, "FIXED_PROFILE_UNAVAILABLE", "cli.lifecycle.unavailable");
    const installed = fixedCliInstalled.has(input.productId);
    return submissionSuccess({ productId: input.productId, installed, managed: installed, detection: installed ? "installed" : "absent" });
  },
  planFixedCliLifecycle: async (input) => {
    fixedCliLifecycleCalls.push({ method: "plan", input });
    if (!fixedCliLifecycleAvailable) return submissionFailure(503, "FIXED_PROFILE_UNAVAILABLE", "cli.lifecycle.unavailable");
    if (fixedCliLifecycleMode === "error") return submissionFailure(503, "FIXED_PROFILE_UNAVAILABLE", "cli.lifecycle.unavailable");
    if (fixedCliLifecycleMode.startsWith("busy")) await new Promise((resolve) => setTimeout(resolve, 120));
    const plan = { planId: `fixture-plan-${fixedCliLifecycleCalls.length}`, productId: input.productId, profileId: fixedCliProfiles.get(input.productId), moduleId: "cli-managed", operation: input.operation, driver: "portable-binary", requirements: [], receiptRequired: input.operation !== "install", rollbackRequired: input.operation !== "uninstall", state: "confirmation-required" };
    fixedCliPlans.set(plan.planId, plan);
    return submissionSuccess(plan);
  },
  confirmFixedCliLifecycle: async (input) => {
    fixedCliLifecycleCalls.push({ method: "confirm", input });
    if (!fixedCliLifecycleAvailable) return submissionFailure(503, "FIXED_PROFILE_UNAVAILABLE", "cli.lifecycle.unavailable");
    return submissionSuccess({ planId: input.planId, confirmationId: input.confirmationId, state: "confirmed" });
  },
  applyFixedCliLifecycle: async (input) => {
    fixedCliLifecycleCalls.push({ method: "apply", input });
    if (!fixedCliLifecycleAvailable) return submissionFailure(503, "FIXED_PROFILE_UNAVAILABLE", "cli.lifecycle.unavailable");
    const plan = fixedCliPlans.get(input.planId);
    if (plan?.operation === "uninstall") fixedCliInstalled.delete(plan.productId);
    else if (plan) fixedCliInstalled.add(plan.productId);
    const installed = Boolean(plan && fixedCliInstalled.has(plan.productId));
    return submissionSuccess({ planId: input.planId, state: "applied", receipt: { ownership: "aihub", action: plan?.operation || "install", persisted: installed, version: "1.0.0" }, status: { productId: plan?.productId || "google-antigravity-cli", installed, managed: installed, detection: installed ? "installed" : "absent", ...(installed ? { version: "1.0.0" } : {}) }, rollback: { required: plan?.operation !== "uninstall", executed: false } });
  },
  recheckFixedCliLifecycle: async (input) => {
    fixedCliLifecycleCalls.push({ method: "recheck", input });
    if (!fixedCliLifecycleAvailable) return submissionFailure(503, "FIXED_PROFILE_UNAVAILABLE", "cli.lifecycle.unavailable");
    const installed = fixedCliInstalled.has(input.productId);
    return submissionSuccess({ productId: input.productId, installed, managed: installed, detection: installed ? "installed" : "absent", ...(installed ? { version: "1.0.0" } : {}) });
  },
  createWorkflowDraft: async ({ idempotencyKey, draft }) => {
    workflowCalls.push({ method: "create", idempotencyKey, draft });
    if (workflowMode === "conflict") return submissionFailure(409, "REVISION_CONFLICT", "workflow.store.conflict");
    if (workflowMode === "rate") return submissionFailure(429, "RATE_LIMITED", "workflow.store.rateLimited");
    if (workflowMode === "unavailable") return submissionFailure(503, "SERVICE_UNAVAILABLE", "workflow.store.serviceUnavailable");
    if (workflowMode === "busy") await new Promise((resolve) => setTimeout(resolve, 500));
    workflowRevision += 1;
    const next = ownerWorkflow({
      expectedRevision: workflowRevision,
      sourceCommunityPostId: draft.sourceCommunityPostId,
      provenance: structuredClone(draft.provenance),
      content: structuredClone(draft.content)
    });
    fixtureWorkflows = [next];
    return submissionSuccess(next);
  },
  listOwnWorkflowDrafts: async () => {
    if (workflowMode === "refresh-busy") {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return submissionSuccess({ items: structuredClone(fixtureWorkflows), next: null });
  },
  getOwnWorkflowDraft: async () => submissionSuccess(structuredClone(fixtureWorkflows[0] || ownerWorkflow())),
  updateWorkflowDraft: async ({ content, ...input }) => {
    workflowCalls.push({ method: "update", ...input, content });
    workflowRevision += 1;
    const current = fixtureWorkflows[0] || ownerWorkflow();
    const next = ownerWorkflow({ ...current, content: structuredClone(content), expectedRevision: workflowRevision });
    fixtureWorkflows = [next];
    return submissionSuccess(next);
  },
  submitWorkflowDraft: async (input) => {
    workflowCalls.push({ method: "submit", ...input });
    workflowRevision += 1;
    return submissionSuccess(ownerWorkflow({ status: "submitted", expectedRevision: workflowRevision, allowedActions: ["withdraw"] }));
  },
  withdrawWorkflowDraft: async (input) => {
    workflowCalls.push({ method: "withdraw", ...input });
    workflowRevision += 1;
    return submissionSuccess(ownerWorkflow({ status: "draft", expectedRevision: workflowRevision, allowedActions: ["update", "submit"] }));
  },
  attachWorkflowPost: async (input) => {
    workflowCalls.push({ method: "attach", ...input });
    return submissionSuccess({ draft: ownerWorkflow(), postReference: null });
  },
  detachWorkflowPost: async (input) => {
    workflowCalls.push({ method: "detach", ...input });
    return submissionSuccess({ draft: ownerWorkflow(), postReference: null });
  },
  reportWorkflowRelease: async (input) => {
    workflowCalls.push({ method: "report", ...input });
    return submissionSuccess({ reportId: "fixture-report", workflowId: input.workflowId, version: input.version, status: "received", createdAt: now });
  },
  createSubmission: async ({ idempotencyKey, submission }) => {
    submissionCalls.push({ method: "create", idempotencyKey, submission });
    if (submissionMode === "conflict") return submissionFailure(409, "REVISION_CONFLICT", "resources.submit.conflict");
    if (submissionMode === "rate") return submissionFailure(429, "RATE_LIMITED", "resources.submit.rateLimited");
    if (submissionMode === "unavailable") return submissionFailure(503, "SERVICE_UNAVAILABLE", "resources.submit.serviceUnavailable");
    if (submissionMode === "busy") await new Promise((resolve) => setTimeout(resolve, 500));
    submissionRevision += 1;
    const next = ownerSubmission({ proposal: structuredClone(submission), expectedRevision: submissionRevision });
    fixtureSubmissions = [next];
    return submissionSuccess(next);
  },
  listOwnSubmissions: async () => {
    if (submissionMode === "refresh-busy") {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return submissionSuccess({ items: structuredClone(fixtureSubmissions), page: { offset: 0, limit: 20, nextOffset: null } });
  },
  getOwnSubmission: async () => submissionSuccess(structuredClone(fixtureSubmissions[0] || ownerSubmission())),
  updateSubmissionDraft: async ({ submission, ...input }) => {
    submissionCalls.push({ method: "update", ...input, submission });
    submissionRevision += 1;
    const next = ownerSubmission({ proposal: structuredClone(submission), expectedRevision: submissionRevision });
    fixtureSubmissions = [next];
    return submissionSuccess(next);
  },
  submitSubmission: async (input) => {
    submissionCalls.push({ method: "submit", ...input });
    submissionRevision += 1;
    return submissionSuccess(ownerSubmission({ status: "submitted", expectedRevision: submissionRevision, allowedActions: ["evidence", "withdraw"], evidenceRequired: true }));
  },
  addSubmissionEvidence: async ({ evidenceRefs, ...input }) => {
    submissionCalls.push({ method: "evidence", ...input, evidenceRefs });
    submissionRevision += 1;
    return submissionSuccess(ownerSubmission({ status: "needs-evidence", expectedRevision: submissionRevision, allowedActions: ["evidence", "withdraw"], evidenceRequired: true }));
  },
  withdrawSubmission: async (input) => {
    submissionCalls.push({ method: "withdraw", ...input });
    submissionRevision += 1;
    return submissionSuccess(ownerSubmission({ status: "withdrawn", expectedRevision: submissionRevision, allowedActions: [] }));
  },
  getCatalog: getFixtureCatalog,
  checkSoftwareUpdates: async () => ({
    status: "available",
    releaseVersion: 1,
    publishedAt: now,
    publishedEntries: 1,
    message: "后台已发布 1 项软件更新"
  }),
  scanManagedInventory: async () => ({
    checkedAt: now,
    profiles: [
      {
        id: "desktop.fixture-managed",
        label: "Fixture Managed Desktop",
        moduleId: "desktop-managed",
        productId: "fixture-managed-desktop",
        vendorId: "fixture-vendor",
        productType: "desktop-reviewed",
        kind: "desktop",
        mode: "managed-installer",
        requirements: [],
        capabilities: ["install", "open", "uninstall"]
      },
      {
        id: "cli.fixture",
        label: "Fixture CLI",
        moduleId: "managed-cli",
        productId: "fixture-cli",
        vendorId: "fixture-vendor",
        productType: "cli",
        kind: "cli",
        mode: "managed-cli",
        requirements: [],
        capabilities: ["open", "uninstall"]
      }
    ],
    desktopStatuses: {
      "fixture-managed-desktop": desktopStatus(),
      "fixture-external-store": desktopStatus({ appId: "fixture.store" }),
      "fixture-vendor-managed": desktopStatus({ appId: "fixture.vendor" })
    },
    cliStatuses: {
      "fixture-cli": {
        installed: true,
        version: "1.0.0",
        directory: "C:\\Fixture\\CLI",
        detection: "installed",
        managed: true,
        canUninstall: true,
        ownership: "managed"
      },
      "anytype-cli": {
        installed: false,
        version: "",
        directory: "C:\\Fixture\\CLI",
        detection: "absent",
        managed: true,
        canUninstall: false,
        ownership: "none",
        requiresInstallDirectory: false
      }
    }
  }),
  scanEnvironment: async () => ({
    platform: "win32",
    architecture: "x64",
    checkedAt: now,
    checks: [
      {
        id: "docker",
        name: "Fixture Docker Environment",
        installed: true,
        location: "C:\\Fixture\\Docker\\Docker.exe",
        version: "26.0.0",
        canOpen: true,
        canUninstall: true,
        detection: "installed"
      },
      {
        id: "node",
        name: "Fixture Node Environment",
        installed: true,
        location: "C:\\Fixture\\Node\\node.exe",
        version: "22.0.0",
        recommendedVersion: "24.18.0",
        canUpdate: true,
        canOpen: true,
        canUninstall: true,
        detection: "installed"
      }
    ],
    wslDistributions: []
  }),
  getEnvironmentPackage: async () => ({ ready: false }),
  getEnvironmentOperation: async () => null,
  updateEnvironment: async (environmentId) =>
    runManagementAction(`prepare-update:${environmentId}`, {
      downloaded: true,
      intent: "update",
      recommendedVersion: "24.18.0",
      message: "fixture update ready"
    }),
  openEnvironmentUpdater: async (environmentId) =>
    runManagementAction(`open-updater:${environmentId}`, {
      launched: true,
      intent: "update",
      recommendedVersion: "24.18.0",
      requiresRecheck: true,
      message: "fixture updater opened"
    }),
  openDesktopApp: async (productId) =>
    runManagementAction(`open:${productId}`, true),
  closeDesktopApp: async (productId) =>
    runManagementAction(`close:${productId}`, { ok: true, closed: true }),
  openDesktopLocation: async (productId) =>
    runManagementAction(`open-files:${productId}`, true),
  uninstallDesktopProduct: async (productId) =>
    runManagementAction(`uninstall:${productId}`, {
      launched: false,
      canceled: true
    }),
  uninstallEnvironment: async (environmentId) =>
    runManagementAction(`uninstall-environment:${environmentId}`, {
      launched: false,
      canceled: true
    }),
  showDownloadInFolder: async (productId) =>
    runManagementAction(`show-package:${productId}`, { ok: true }),
  deleteDownloadedPackage: async (productId) =>
    runManagementAction(`delete-package:${productId}`, {
      ok: false,
      canceled: false,
      error: "fixture retained"
    }),
  getDownloadTask: async (productId) => downloadTasks[productId] || null,
  getDownloadRecord: async (productId) => {
    managedDownloadQueueCalls.push({ method: "get-record", input: { productId } });
    return managedDownloadRecordAvailable && productId === "fixture-missing-canonical"
      ? {
          productId,
          filePath: "C:\\Fixture\\Downloads\\Missing-Setup.exe",
          sha256: "a".repeat(64),
          fileSize: 1024,
          downloadedAt: now
        }
      : null;
  },
  getPartialDownload: async () => null,
  startDownload: async (productId) => {
    downloadStarts.push(productId);
    return { ok: false, error: "fixture download must not run" };
  },
  launchInstaller: async (productId, intent) => {
    managedDownloadQueueCalls.push({ method: "launch-installer", input: { productId, intent } });
    return { launched: false, canceled: true };
  },
  getDesktopOperation: async () => null,
  getCliStatus: async (productId) =>
    productId === "anytype-cli"
      ? {
          installed: false,
          version: "",
          directory: "C:\\Fixture\\CLI",
          detection: "absent",
          managed: true,
          canUninstall: false,
          ownership: "none",
          requiresInstallDirectory: false
        }
      : {
          installed: false,
          version: "",
          directory: "",
          detection: "absent",
          managed: false,
          canUninstall: false,
          ownership: "none"
        },
  reconcileCli: async () => ({ ok: false, error: "fixture CLI deployment failed" }),
  listExtensions: async () => [
    {
      profileId: "fixture-resource-profile",
      label: "Fixture Managed MCP Resource",
      resourceType: "mcp",
      hostProductId: "fixture-managed-desktop",
      ok: true,
      state: "installed",
      managed: true,
      enabled: true,
      allowedActions: ["uninstall"]
    }
  ],
  executeExtension: async () => ({
    ok: true,
    state: "installed",
    managed: true,
    enabled: true,
    allowedActions: ["uninstall"]
  }),
  onDownloadTask: (callback) => {
    downloadTaskListeners.add(callback);
    return () => downloadTaskListeners.delete(callback);
  },
  onDesktopOperation: () => () => {},
  onEnvironmentOperation: () => () => {},
  onCliLog: () => () => {},
  onTaskNotificationOpen: () => () => {},
  onDownloadProgress: () => () => {},
  fixtureGetDownloadStarts: () => [...downloadStarts],
  fixtureHoldManagementAction: (key) => {
    heldManagementActions.set(key, null);
  },
  fixtureResolveManagementAction: (key, rejected = false) => {
    const held = heldManagementActions.get(key);
    if (!held?.resolve) return false;
    heldManagementActions.delete(key);
    if (rejected) held.reject(new Error("fixture rejected"));
    else held.resolve(held.value);
    return true;
  },
  fixtureGetManagementActionCalls: () => [...managementActionCalls],
  fixtureSetManagedDownloadRecordAvailable: (available) => {
    managedDownloadRecordAvailable = available === true;
  },
  fixtureGetSubmissionCalls: () => structuredClone(submissionCalls),
  fixtureGetWorkflowCalls: () => structuredClone(workflowCalls),
  fixtureGetWorkflowPublicCalls: () => structuredClone(workflowPublicCalls),
  fixtureGetWorkflowPublicCapabilityCalls: () => workflowPublicCapabilityCalls,
  fixtureGetAgentBridgeCalls: () => structuredClone(agentBridgeCalls),
  fixtureGetFixedCliLifecycleCalls: () => structuredClone(fixedCliLifecycleCalls)
};

function productionOrderBridge() {
  if (!managedDownloadProductionOrderEnabled) return fixtureApi;
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const context = vm.createContext({
    require(specifier) {
      if (specifier !== "electron") throw new Error("fixture preload dependency rejected");
      return {
        contextBridge: {
          exposeInMainWorld(_name, api) { context.bridge = api; }
        },
        ipcRenderer
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "..", "electron", "preload.cjs"), "utf8"),
    context,
    { filename: "electron/preload.cjs" }
  );
  const actual = context.bridge;
  const diagnostics = {
    enqueueSettled: false,
    eventDelivered: false,
    eventAccepted: false,
    attemptMatch: false,
    deliveredCount: 0,
    listCalls: 0,
    statusCalls: 0,
    statusCallsAtLastDelivery: 0,
    lastStatusPhase: "none",
    lastDeliveredAttemptId: ""
  };
  const countClass = (count) => count === 0 ? "zero" : count === 1 ? "one" : "many";
  const getCatalog = async () => {
    const result = await actual.getCatalog();
    const catalog = result?.catalog;
    const vendor = catalog?.vendors?.find((entry) =>
      entry.products?.some((product) => product.id === "wondershare-filmora")
    );
    const product = vendor?.products?.find((entry) => entry.id === "wondershare-filmora");
    if (!vendor || !product) throw new Error("fixture catalog product missing");
    return {
      ...result,
      catalog: {
        ...catalog,
        vendors: [{ ...vendor, logo: "", products: [{ ...product, icon: "" }] }],
        resources: [],
        home: {
          ...(catalog.home || {}),
          featuredVendorIds: [vendor.id],
          featuredProductIds: [product.id],
          featuredResourceIds: []
        }
      }
    };
  };
  const onDownloadTask = (callback) => actual.onDownloadTask((task) => {
    diagnostics.eventDelivered = true;
    diagnostics.deliveredCount += 1;
    diagnostics.statusCallsAtLastDelivery = diagnostics.statusCalls;
    diagnostics.lastDeliveredAttemptId = task?.attemptId || "";
    callback(task);
  });
  const getStatus = async (input) => {
    diagnostics.statusCalls += 1;
    if (diagnostics.eventDelivered && diagnostics.statusCalls > diagnostics.statusCallsAtLastDelivery) {
      diagnostics.eventAccepted = true;
    }
    const result = await actual.getManagedDownloadTaskStatus(input);
    diagnostics.lastStatusPhase = result?.task?.phase || "none";
    diagnostics.attemptMatch = Boolean(
      diagnostics.lastDeliveredAttemptId &&
      result?.task?.taskId === diagnostics.lastDeliveredAttemptId
    );
    return result;
  };
  return {
    ...fixtureApi,
    getCatalog,
    enqueueManagedDownload: async (input) => {
      const result = await actual.enqueueManagedDownload(input);
      diagnostics.enqueueSettled = true;
      return result;
    },
    listManagedDownloadTasks: async () => {
      diagnostics.listCalls += 1;
      return actual.listManagedDownloadTasks();
    },
    getManagedDownloadTaskStatus: getStatus,
    cancelManagedDownload: async (input) => await actual.cancelManagedDownload(input),
    retryManagedDownload: actual.retryManagedDownload,
    onDownloadTask,
    fixtureGetProductionOrderDiagnostics: () => ({
      enqueueSettled: diagnostics.enqueueSettled,
      eventDelivered: diagnostics.eventDelivered,
      eventAccepted: diagnostics.eventAccepted,
      attemptMatch: diagnostics.attemptMatch,
      deliveredCountClass: countClass(diagnostics.deliveredCount),
      listCallCount: diagnostics.listCalls,
      listCallCountClass: countClass(diagnostics.listCalls),
      statusCallCount: diagnostics.statusCalls,
      statusCallCountClass: countClass(diagnostics.statusCalls),
      lastStatusPhase: diagnostics.lastStatusPhase
    })
  };
}

contextBridge.exposeInMainWorld("aihubPC", productionOrderBridge());
