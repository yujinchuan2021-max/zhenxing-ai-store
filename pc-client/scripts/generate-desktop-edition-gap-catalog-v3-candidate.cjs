"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const inputs = Object.freeze({
  baseCatalogV3: Object.freeze({
    path: "docs/research/auralogs-mcp-catalog-v3-candidate-2026-08-15.json",
    sha256: "dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8"
  }),
  research: Object.freeze({
    path: "docs/research/2026-08-15-minimax-desktop-edition-gap-audit.md",
    sha256: "1cf62980e52d9f543dc7ac5af0fbc3f3367e75376400cf2a8e57e6c9aab002a2"
  }),
  researchBatch2: Object.freeze({
    path: "docs/research/2026-08-15-desktop-edition-gap-audit-batch2.md",
    sha256: "49c67c7adeaba18bce9968a53c148382665828da3250826b3c546ac6d15dba0c"
  })
});
const outputPath =
  "docs/research/desktop-edition-gap-catalog-v3-candidate-2026-08-15.json";

const desktopProducts = Object.freeze({
  "minimax-agent": Object.freeze({
    id: "minimax-agent",
    name: "MiniMax Code（原 MiniMax Agent）",
    kind: "桌面端",
    moduleId: "desktop-official",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    capabilities: ["website", "tutorial"],
    category: "智能体",
    description:
      "MiniMax 官方 Windows/macOS 桌面 Agent，同时保留网页版；可访问用户授权的本地数据、浏览器会话和第三方账户并执行浏览器操作，本目录只打开官网下载页，不托管安装。",
    website: "https://agent.minimax.io/",
    tutorial: "https://agent.minimax.io/",
    productType: "desktop-official",
    requirements: [],
    installProfileId: "",
    entryPoints: [
      { type: "web", label: "MiniMax 网页版", url: "https://agent.minimax.io/" },
      { type: "desktop", label: "MiniMax 桌面版" }
    ],
    officialDownload: {
      url: "https://agent.minimax.io/download",
      kind: "download-page"
    },
    enabled: true,
    order: 1,
    directoryKind: "ai-tool"
  }),
  "notion-desktop": Object.freeze({
    id: "notion-desktop",
    name: "Notion",
    kind: "桌面端",
    category: "智能体",
    description:
      "Notion 官方 Windows/macOS 桌面客户端，集成文档、知识库、协作与 Notion AI；需登录，功能取决于账户、套餐和组织权限，客户端由厂商自动更新。",
    website: "https://www.notion.com/desktop",
    tutorial: "https://www.notion.com/en-gb/help/notion-for-desktop",
    productType: "desktop-official",
    moduleId: "desktop-official",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    requirements: [],
    installProfileId: "",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "website", label: "Notion 官网", url: "https://www.notion.com/" },
      { type: "web", label: "Notion 网页版", url: "https://www.notion.so/" },
      { type: "desktop", label: "Notion 桌面版" }
    ],
    enabled: true,
    order: 0,
    directoryKind: "ai-tool",
    officialDownload: {
      url: "https://www.notion.com/desktop",
      kind: "download-page"
    }
  }),
  "replit-agent": Object.freeze({
    id: "replit-agent",
    enabled: true,
    order: 0,
    directoryKind: "ai-tool",
    name: "Replit",
    kind: "桌面端",
    category: "编程开发",
    description:
      "Replit 官方 Windows/macOS/Linux 桌面客户端，包含 Replit Agent 与 Workspace；需要联网和账户，项目、部署及第三方连接仍由 Replit 云服务承载。",
    website: "https://replit.com/desktop",
    tutorial: "https://docs.replit.com/learn/build-with-agent",
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
      { type: "website", label: "Replit 官网", url: "https://replit.com/" },
      { type: "web", label: "Replit Agent 网页版", url: "https://replit.com/ai" },
      { type: "tutorial", label: "Replit Agent 教程", url: "https://docs.replit.com/learn/build-with-agent" },
      { type: "desktop", label: "Replit 桌面版" }
    ],
    officialDownload: {
      url: "https://replit.com/desktop",
      kind: "download-page"
    }
  }),
  "flowith-os": Object.freeze({
    id: "flowith-os",
    enabled: true,
    order: 1,
    directoryKind: "ai-tool",
    name: "FlowithOS",
    kind: "桌面端",
    category: "智能体",
    description:
      "Flowith 官方 Windows/macOS 桌面执行引擎，可访问本地文件、终端、浏览器会话和桌面应用；需要 Flowith 账户，本目录只打开官网下载页，不托管安装。",
    website: "https://flowith.io/home/",
    tutorial:
      "https://doc.flowith.io/cn/oracle-mode-zhi-neng-ti-mo-shi/flowithos-zhi-neng-ti-cao-zuo-xi-tong/xia-zai-zhu-ce",
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
        type: "tutorial",
        label: "FlowithOS 使用说明",
        url: "https://doc.flowith.io/cn/oracle-mode-zhi-neng-ti-mo-shi/flowithos-zhi-neng-ti-cao-zuo-xi-tong/xia-zai-zhu-ce"
      },
      { type: "desktop", label: "FlowithOS 桌面版" }
    ],
    officialDownload: {
      url: "https://flowith.io/home/",
      kind: "download-page"
    }
  }),
  "gemini-web": Object.freeze({
    id: "gemini-web",
    name: "Gemini",
    kind: "桌面端",
    category: "AI 对话",
    description:
      "Google Gemini 网页版及官方 macOS 桌面客户端；桌面版仅支持 Apple Silicon，并可能请求屏幕、辅助功能、语音和用户明确选择的本地目录权限。",
    website: "https://gemini.google/mac/",
    tutorial: "https://support.google.com/gemini/answer/17011627?hl=en",
    productType: "desktop-official",
    moduleId: "desktop-official",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    requirements: [],
    installProfileId: "",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "web", label: "Gemini 网页版", url: "https://gemini.google.com/" },
      { type: "desktop", label: "Gemini macOS 桌面版" }
    ],
    officialDownload: {
      url: "https://gemini.google/mac/",
      kind: "download-page"
    },
    enabled: true,
    order: 0,
    directoryKind: "ai-tool"
  }),
  "baidu-comate": Object.freeze({
    id: "baidu-comate",
    name: "Comate AI IDE",
    kind: "桌面端",
    category: "编程开发",
    description:
      "百度官方 Windows/macOS/Linux 独立 AI IDE，同时保留插件和教程入口；需登录，可访问本地项目、终端命令及导入的第三方扩展设置。",
    website: "https://comate.baidu.com/",
    tutorial: "https://comate.baidu.com/zh/docs",
    productType: "desktop-official",
    moduleId: "desktop-official",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    requirements: [],
    installProfileId: "",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "website", label: "Comate 官网", url: "https://comate.baidu.com/" },
      { type: "tutorial", label: "Comate 文档", url: "https://comate.baidu.com/zh/docs" },
      { type: "desktop", label: "Comate AI IDE 桌面版" }
    ],
    officialDownload: {
      url: "https://comate.baidu.com/zh/download/ai-ide",
      kind: "download-page"
    },
    enabled: true,
    order: 1,
    directoryKind: "ai-tool"
  }),
  "kortix-command-center": Object.freeze({
    id: "kortix-command-center",
    name: "Kortix",
    kind: "桌面端",
    category: "智能体",
    description:
      "Kortix 官方 Windows/macOS/Linux 桌面客户端及 Web 平台；Agent 可访问仓库、文件、终端、沙箱、密钥和连接器，源码采用 Elastic License 2.0。",
    website: "https://github.com/kortix-ai/suna/releases",
    tutorial: "https://kortix.com/docs/",
    productType: "desktop-official",
    moduleId: "desktop-official",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    requirements: [],
    installProfileId: "",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "web", label: "打开 Kortix", url: "https://kortix.com/" },
      { type: "tutorial", label: "Kortix 文档", url: "https://kortix.com/docs/" },
      { type: "desktop", label: "Kortix Desktop" }
    ],
    officialDownload: {
      url: "https://github.com/kortix-ai/suna/releases",
      kind: "download-page"
    },
    enabled: true,
    order: 0,
    directoryKind: "ai-tool"
  }),
  "github-copilot": Object.freeze({
    id: "github-copilot",
    name: "GitHub Copilot",
    kind: "桌面端",
    category: "编程开发",
    description:
      "GitHub 官方 Windows/macOS/Linux Copilot app，同时保留网页、教程和独立 CLI；需账户与相应套餐，可读取和修改仓库、运行命令并创建分支或 PR。",
    website: "https://github.com/features/copilot",
    tutorial: "https://docs.github.com/en/copilot/how-tos/github-copilot-app/getting-started",
    productType: "desktop-official",
    moduleId: "desktop-official",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    requirements: [],
    installProfileId: "",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "website", label: "GitHub Copilot", url: "https://github.com/features/copilot" },
      { type: "tutorial", label: "Copilot app 教程", url: "https://docs.github.com/en/copilot/how-tos/github-copilot-app/getting-started" },
      { type: "desktop", label: "GitHub Copilot app" }
    ],
    officialDownload: {
      url: "https://github.com/features/ai/github-app",
      kind: "download-page"
    },
    enabled: true,
    order: 0,
    directoryKind: "ai-tool"
  })
});

const existingOwners = Object.freeze({
  "minimax-agent": "minimax",
  "notion-desktop": "notion",
  "replit-agent": "replit",
  "gemini-web": "google",
  "baidu-comate": "baidu",
  "kortix-command-center": "kortix",
  "github-copilot": "github"
});
const existingProductTypes = Object.freeze({
  "minimax-agent": "web",
  "notion-desktop": "web",
  "replit-agent": "web",
  "gemini-web": "web",
  "baidu-comate": "web",
  "kortix-command-center": "web",
  "github-copilot": "tutorial"
});

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function reject(message) {
  throw new Error(`Desktop edition gap candidate rejected: ${message}`);
}

function assertFrozenInputHashes(actualHashes) {
  for (const [name, input] of Object.entries(inputs)) {
    if (actualHashes?.[name] !== input.sha256) {
      reject(`frozen input drift: ${input.path}`);
    }
  }
}

function findProduct(catalog, productId) {
  const matches = catalog.vendors.flatMap((vendor) =>
    vendor.products
      .filter(({ id }) => id === productId)
      .map((product) => ({ vendor, product }))
  );
  if (matches.length !== 1) reject(`product identity cardinality: ${productId}`);
  return matches[0];
}

function buildCandidate(baseCandidate) {
  const baseCatalog = baseCandidate?.catalog;
  const productCount = baseCatalog?.vendors?.reduce(
    (count, vendor) => count + vendor.products.length,
    0
  );
  const targetCount = baseCatalog?.resources?.reduce(
    (count, resource) => count + resource.targets.length,
    0
  );
  if (
    baseCandidate?.candidateOnly !== true ||
    baseCandidate?.freezeOnly !== true ||
    baseCandidate?.publishable !== false ||
    baseCatalog?.schemaVersion !== 3 ||
    baseCatalog?.vendors?.length !== 375 ||
    productCount !== 616 ||
    baseCatalog?.resources?.length !== 280 ||
    targetCount !== 866 ||
    baseCatalog?.resourceConnections?.length !== 10
  ) reject("base catalog v3 contract mismatch");

  validateCatalog(baseCatalog);
  if (baseCatalog.vendors.some((vendor) =>
    vendor.products.some(({ id }) => id === "flowith-os")
  )) reject("FlowithOS product identity already exists");

  const originalProducts = {};
  for (const [productId, vendorId] of Object.entries(existingOwners)) {
    const located = findProduct(baseCatalog, productId);
    if (
      located.vendor.id !== vendorId ||
      located.product.productType !== existingProductTypes[productId]
    ) {
      reject(`existing product contract mismatch: ${productId}`);
    }
    originalProducts[productId] = structuredClone(located.product);
  }
  const originalAgentNeo = structuredClone(findProduct(baseCatalog, "flowith-agent-neo").product);
  const originalMiniMaxCli = structuredClone(findProduct(baseCatalog, "minimax-cli").product);

  const catalog = structuredClone(baseCatalog);
  for (const [productId, vendorId] of Object.entries(existingOwners)) {
    const vendor = catalog.vendors.find(({ id }) => id === vendorId);
    const index = vendor.products.findIndex(({ id }) => id === productId);
    vendor.products[index] = structuredClone(desktopProducts[productId]);
  }
  catalog.vendors
    .find(({ id }) => id === "flowith")
    .products.push(structuredClone(desktopProducts["flowith-os"]));
  validateCatalog(catalog);

  assert.deepEqual(findProduct(catalog, "flowith-agent-neo").product, originalAgentNeo);
  assert.deepEqual(findProduct(catalog, "minimax-cli").product, originalMiniMaxCli);
  assert.deepEqual(catalog.resources, baseCatalog.resources);
  assert.deepEqual(catalog.resourceConnections, baseCatalog.resourceConnections);

  const summary = {
    vendors: catalog.vendors.length,
    products: catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0),
    resources: catalog.resources.length,
    targets: catalog.resources.reduce((count, resource) => count + resource.targets.length, 0),
    resourceConnections: catalog.resourceConnections.length,
    updatedProducts: 7,
    appendedProducts: 1
  };
  assert.deepEqual(summary, {
    vendors: 375,
    products: 617,
    resources: 280,
    targets: 866,
    resourceConnections: 10,
    updatedProducts: 7,
    appendedProducts: 1
  });

  const reversed = structuredClone(catalog);
  for (const [productId, vendorId] of Object.entries(existingOwners)) {
    const vendor = reversed.vendors.find(({ id }) => id === vendorId);
    const index = vendor.products.findIndex(({ id }) => id === productId);
    vendor.products[index] = originalProducts[productId];
  }
  const flowithProducts = reversed.vendors.find(({ id }) => id === "flowith").products;
  assert.deepEqual(flowithProducts.pop(), desktopProducts["flowith-os"]);
  assert.deepEqual(reversed, baseCatalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: "2026-08-15T00:00:00.000Z",
    title: "Official desktop edition gap catalog v3 candidate",
    inputs,
    summary,
    catalog,
    safety: {
      candidateOnly: true,
      freezeOnly: true,
      publishable: false,
      officialDownloadPagesOnly: true,
      managedInstall: false,
      directArtifacts: false,
      credentialsCollected: false,
      productsUpdated: 7,
      productsAdded: 1,
      resourcesAdded: 0,
      resourceTargetsAdded: 0,
      resourceConnectionsAdded: 0,
      catalogWritten: false,
      stateWritten: false,
      signed: false,
      published: false
    }
  };
}

function main() {
  const rawInputs = Object.fromEntries(
    Object.entries(inputs).map(([name, input]) => [
      name,
      fs.readFileSync(path.join(root, input.path))
    ])
  );
  assertFrozenInputHashes(Object.fromEntries(
    Object.entries(rawInputs).map(([name, raw]) => [name, sha256(raw)])
  ));
  const candidate = buildCandidate(JSON.parse(rawInputs.baseCatalogV3.toString("utf8")));
  fs.writeFileSync(
    path.join(root, outputPath),
    `${JSON.stringify(candidate, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`${JSON.stringify({ outputPath, summary: candidate.summary })}\n`);
}

if (require.main === module) main();

module.exports = {
  assertFrozenInputHashes,
  buildCandidate,
  desktopProducts,
  inputs,
  outputPath
};
