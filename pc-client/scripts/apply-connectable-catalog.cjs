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

function upsertById(items, next) {
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) items[index] = next;
  else items.push(next);
}

function target(productId, compatibility = "official") {
  return {
    productId,
    compatibility,
    moduleId: "resource-link",
    installProfileId: "",
    capabilities: ["website"],
    enabled: true
  };
}

for (const catalogPath of catalogPaths) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  catalog.categories ||= [...DEFAULT_PRODUCT_CATEGORIES];
  const nextOrder = Math.max(0, ...catalog.vendors.map((vendor) => vendor.order || 0)) + 1;
  const unityOrder =
    catalog.vendors.find((vendor) => vendor.id === "unity-technologies")?.order ??
    nextOrder;
  const orayOrder =
    catalog.vendors.find((vendor) => vendor.id === "oray")?.order ??
    unityOrder + 1;

  upsertById(catalog.vendors, {
    id: "unity-technologies",
    enabled: true,
    order: unityOrder,
    name: "Unity Technologies",
    initial: "U",
    mark: "U",
    color: "#111111",
    iconUrl: "",
    description: "提供 Unity 实时开发平台、编辑器内 AI 助手和官方 MCP 接入能力。",
    website: "https://unity.com",
    tutorial: "https://unity.com/features/ai",
    products: [
      {
        id: "unity-ai-assistant",
        enabled: true,
        order: 0,
        directoryKind: "ai-tool",
        name: "Unity 编辑器内 AI 助手",
        kind: "其他产品",
        category: "编程开发",
        description: "运行在 Unity 6 编辑器内、理解项目场景与组件上下文的 AI 助手。",
        website: "https://unity.com/features/ai",
        tutorial: "https://docs.unity3d.com/Packages/com.unity.ai.assistant@latest",
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
          {
            type: "website",
            label: "工具官网",
            url: "https://unity.com/features/ai"
          },
          {
            type: "tutorial",
            label: "安装说明",
            url: "https://docs.unity3d.com/Packages/com.unity.ai.assistant@latest"
          }
        ]
      },
      {
        id: "unity-editor",
        enabled: true,
        order: 1,
        directoryKind: "ai-connectable",
        name: "Unity Editor",
        kind: "桌面端",
        category: categoryForConnectableProduct("unity-editor"),
        description: "Unity 6 编辑器可通过官方 MCP Server 向兼容的 AI 编程工具提供项目上下文和编辑器操作。",
        website: "https://unity.com/download",
        tutorial: "https://docs.unity3d.com/Packages/com.unity.ai.assistant@latest/index.html?subfolder=%2Fmanual%2Fintegration%2Funity-mcp-get-started.html",
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
          {
            type: "website",
            label: "工具官网",
            url: "https://unity.com"
          },
          { type: "desktop", label: "Unity Windows 下载" },
          {
            type: "tutorial",
            label: "MCP 接入说明",
            url: "https://docs.unity3d.com/Packages/com.unity.ai.assistant@latest/index.html?subfolder=%2Fmanual%2Fintegration%2Funity-mcp-get-started.html"
          }
        ]
      }
    ]
  });

  const productIds = new Set(
    catalog.vendors.flatMap((vendor) =>
      vendor.products.map((product) => product.id)
    )
  );
  const availableTargets = (ids) =>
    ids.filter((productId) => productIds.has(productId)).map((productId) => target(productId));

  upsertById(catalog.vendors, {
    id: "oray",
    enabled: true,
    order: orayOrder,
    name: "贝锐",
    initial: "B",
    mark: "贝",
    color: "#f47b20",
    iconUrl: "",
    description: "提供向日葵远程控制、设备管理和 AweSun MCP 服务。",
    website: "https://www.oray.com",
    tutorial: "https://activity.sunlogin.oray.com/mcp",
    products: [
      {
        id: "sunlogin-windows",
        enabled: true,
        order: 0,
        directoryKind: "ai-connectable",
        name: "向日葵远程控制 Windows 版",
        kind: "桌面端",
        category: categoryForConnectableProduct("sunlogin-windows"),
        description: "向日葵 Windows 客户端可启用 AweSun MCP，把设备管理和远程操作能力提供给兼容的 AI 工具。",
        website: "https://sunlogin.oray.com/download",
        tutorial: "https://service.oray.com/question/50091.html",
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
          {
            type: "website",
            label: "工具官网",
            url: "https://sunlogin.oray.com"
          },
          { type: "desktop", label: "向日葵 Windows 下载" },
          {
            type: "tutorial",
            label: "MCP 接入说明",
            url: "https://service.oray.com/question/50091.html"
          }
        ]
      }
    ]
  });

  const unityResourceOrder =
    catalog.resources.find((resource) => resource.id === "unity-official-mcp-server")
      ?.order ?? catalog.resources.length;
  const unityTargets = availableTargets([
    "claude-code",
    "cursor-desktop",
    "github-copilot",
    "codex-cli",
    "gemini-cli"
  ]);
  if (unityTargets.length) upsertById(catalog.resources, {
    id: "unity-official-mcp-server",
    enabled: true,
    order: unityResourceOrder,
    name: "Unity 官方 MCP Server",
    resourceTypes: ["mcp"],
    description: "让 AI 编程工具读取 Unity 项目的场景、GameObject、组件、控制台和编辑器上下文。",
    website: "https://unity.com/features/ai",
    tutorial: "https://docs.unity3d.com/Packages/com.unity.ai.assistant@latest/index.html?subfolder=%2Fmanual%2Fintegration%2Funity-mcp-get-started.html",
    publisherVendorId: "unity-technologies",
    publisher: "Unity Technologies",
    sourceKind: "official",
    sourceProductIds: ["unity-editor"],
    targets: unityTargets,
    provenanceEvidence: [
      "https://unity.com/blog/unity-ai-how-to-get-started",
      "https://unity.com/features/ai"
    ],
    lastVerifiedAt: "2026-08-02T00:00:00.000Z"
  });

  const orayResourceOrder =
    catalog.resources.find((resource) => resource.id === "oray-awesun-mcp")
      ?.order ?? catalog.resources.length;
  const orayTargets = availableTargets([
    "opencode",
    "cursor-desktop",
    "trae-desktop"
  ]);
  if (orayTargets.length) upsertById(catalog.resources, {
    id: "oray-awesun-mcp",
    enabled: true,
    order: orayResourceOrder,
    name: "向日葵 AweSun MCP",
    resourceTypes: ["mcp"],
    description: "把向日葵的设备管理、远程会话和桌面控制能力以 MCP 接口提供给 AI 工具。",
    website: "https://activity.sunlogin.oray.com/mcp",
    tutorial: "https://service.oray.com/question/50091.html",
    publisherVendorId: "oray",
    publisher: "贝锐",
    sourceKind: "official",
    sourceProductIds: ["sunlogin-windows"],
    targets: orayTargets,
    provenanceEvidence: ["https://activity.sunlogin.oray.com/mcp"],
    lastVerifiedAt: "2026-08-02T00:00:00.000Z"
  });

  applyConnectableTaxonomy(catalog);
  catalog.updatedAt = "2026-08-02T12:00:00.000Z";
  validateCatalog(catalog);
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  process.stdout.write(`Updated ${catalogPath}\n`);
}
