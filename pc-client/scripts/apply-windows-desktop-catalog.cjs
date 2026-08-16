"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  WINDOWS_DESKTOP_PRODUCTS
} = require("../shared/windows-desktop-catalog.cjs");
const {
  getProductIntakeDossier
} = require("../shared/install-registry.cjs");

const root = path.resolve(__dirname, "..");
const configuredCatalogPath = process.env.AIHUB_CATALOG_PATH || "";
if (configuredCatalogPath && !path.isAbsolute(configuredCatalogPath)) {
  throw new Error("AIHUB_CATALOG_PATH must be absolute");
}
const catalogPath =
  configuredCatalogPath || path.join(root, "admin", "data", "catalog-v1.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

function findProduct(productId) {
  for (const vendor of catalog.vendors) {
    const product = vendor.products.find((candidate) => candidate.id === productId);
    if (product) return { vendor, product };
  }
  return null;
}

function applyPolicy(product, policy) {
  Object.assign(product, policy);
  if (policy.download === undefined) delete product.download;
  if (policy.installProfileId === undefined) delete product.installProfileId;
}

const managedPolicy = {
  directoryKind: "ai-tool",
  kind: "桌面端",
  productType: "desktop-reviewed",
  moduleId: "desktop-managed",
  installPolicy: "client-managed-installer",
  downloadPolicy: "client-managed",
  signaturePolicy: "client-reviewed",
  uninstallPolicy: "client-managed"
};

const officialDownloadPolicy = {
  directoryKind: "ai-tool",
  kind: "桌面端",
  productType: "desktop-official",
  moduleId: "desktop-official",
  installPolicy: "open-official-download",
  downloadPolicy: "official-page",
  signaturePolicy: "vendor-controlled",
  uninstallPolicy: "vendor-managed",
  installProfileId: "",
  capabilities: ["website", "tutorial"],
  download: undefined
};

const openClawVendor = catalog.vendors.find((vendor) => vendor.id === "openclaw");
if (!openClawVendor) throw new Error("catalog vendor not found: openclaw");
if (!findProduct("openclaw-wsl-gateway")) {
  openClawVendor.products.push({
    id: "openclaw-wsl-gateway",
    name: "OpenClaw WSL Gateway",
    directoryKind: "ai-tool",
    kind: "CLI",
    category: "智能体",
    description: "由 OpenClaw Windows Hub 官方配置流程创建并管理专属 OpenClawGateway；枕星AI助手 分别检测发行版、CLI、服务就绪和配对状态。",
    website: "https://docs.openclaw.ai/windows",
    tutorial: "https://docs.openclaw.ai/windows",
    productType: "cli",
    moduleId: "cli-managed",
    installProfileId: "cli.openclaw-wsl",
    requirements: ["wsl"],
    installPolicy: "client-managed-cli",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "client-managed",
    capabilities: ["website", "tutorial", "install", "open", "uninstall"],
    enabled: true,
    order: Math.max(...openClawVendor.products.map((product) => product.order || 0)) + 1
  });
}

for (const [productId, definition] of Object.entries(WINDOWS_DESKTOP_PRODUCTS)) {
  let located = findProduct(productId);
  if (!located && productId === "trae-solo-cn") {
    const vendor = catalog.vendors.find((candidate) => candidate.id === "bytedance");
    const order = Math.max(...vendor.products.map((product) => product.order || 0)) + 1;
    const product = {
      id: productId,
      name: "TRAE SOLO CN",
      category: "编程开发",
      description: "TRAE 官方 Windows 智能开发客户端，提供独立的 SOLO 工作模式。",
      website: "https://www.trae.cn/solo",
      tutorial: "https://docs.trae.cn/solo",
      enabled: true,
      order,
      requirements: []
    };
    vendor.products.push(product);
    located = { vendor, product };
  }
  if (!located) throw new Error(`catalog product not found: ${productId}`);
  if (located.vendor.id !== definition.vendorId) {
    throw new Error(`vendor mismatch for ${productId}`);
  }
  const approved = getProductIntakeDossier(productId);
  applyPolicy(
    located.product,
    approved
      ? {
          ...managedPolicy,
          name: definition.label,
          requirements: [...definition.requirements],
          installProfileId: definition.profileId,
          capabilities: [...definition.capabilities],
          download: {
            url: definition.download.url,
            fileName: definition.download.fileName
          }
        }
      : {
          ...officialDownloadPolicy,
          name: definition.label,
          requirements: [...definition.requirements]
        }
  );
}

const contentOverrides = {
  "trae-solo-cn": {
    description: "TRAE Work 官方 Windows 智能开发客户端；旧 TRAE SOLO 名称仅作为本机识别兼容项保留。",
    website: "https://www.trae.cn/ide/download",
    tutorial: "https://www.trae.cn/ide/download"
  },
  "alibaba-qwen-studio": {
    category: "AI 对话",
    description: "中国千问官方 Windows 桌面客户端，使用独立于全球 Qwen Desktop 的中国版分发渠道。",
    website: "https://b.qianwen.com/apps/qkhomepage_twofoufeb/routes/l5Utxkrh6",
    tutorial: "https://b.qianwen.com/apps/qkhomepage_twofoufeb/routes/l5Utxkrh6"
  },
  "bytedance-doubao": {
    description: "豆包官方 Windows 桌面客户端，由枕星AI助手 下载并校验已审核安装包。",
    website: "https://www.doubao.com/download/desktop"
  },
  "tencent-codebuddy": {
    category: "编程开发",
    description: "腾讯 CodeBuddy 官方 Windows AI 编程客户端，由枕星AI助手 管理已审核安装包。"
  },
  "amazon-kiro-ide": {
    category: "编程开发",
    description: "AWS Kiro 官方 Windows x64 用户级 AI 开发客户端，由枕星AI助手 管理已审核安装包。"
  },
  "perplexity-comet": {
    description: "Perplexity Comet 官方 Windows x64 AI 浏览器，由枕星AI助手 管理已审核安装包。"
  },
  "nvidia-ai-workbench": {
    description: "NVIDIA AI Workbench Desktop；桌面端可独立安装，本地 WSL、容器和 Git 环境由产品内的 Full Local 流程按需配置。"
  },
  opencode: {
    category: "编程开发",
    description: "OpenCode 官方 Windows 桌面客户端；可选连接 WSL 服务，但桌面应用本身是原生 Windows 产品。"
  },
  "wispr-flow-desktop": {
    website: "https://wisprflow.ai/"
  }
};

for (const [productId, content] of Object.entries(contentOverrides)) {
  Object.assign(findProduct(productId).product, content);
}

applyPolicy(findProduct("openclaw-wsl-gateway").product, {
  kind: "CLI",
  productType: "cli",
  moduleId: "cli-managed",
  installProfileId: "cli.openclaw-wsl",
  requirements: ["wsl"],
  installPolicy: "client-managed-cli",
  downloadPolicy: "none",
  signaturePolicy: "not-applicable",
  uninstallPolicy: "client-managed",
  capabilities: ["website", "tutorial", "install", "open", "uninstall"]
});

delete findProduct("openclaw-windows-hub").product.componentProductIds;

const linkPolicies = {
  web: {
    directoryKind: "ai-tool",
    kind: "其他产品",
    productType: "web",
    moduleId: "web-link",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-product-website",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["website", "tutorial"]
  },
  tutorial: {
    directoryKind: "ai-tool",
    kind: "其他产品",
    productType: "tutorial",
    moduleId: "tutorial-link",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-tutorial",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["tutorial"]
  },
  "cli-official": {
    directoryKind: "ai-tool",
    kind: "CLI",
    productType: "cli-official",
    moduleId: "cli-official",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-official-install",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["website", "tutorial"]
  }
};

for (const [productId, type] of Object.entries({
  "claude-cowork": "web",
  "kimi-claw-desktop": "tutorial",
  "baidu-comate": "web",
  "nous-hermes-agent": "cli-official",
  "cline-agent": "tutorial"
})) {
  const located = findProduct(productId);
  if (!located) throw new Error(`catalog product not found: ${productId}`);
  applyPolicy(located.product, linkPolicies[type]);
}

catalog.updatedAt = new Date().toISOString();
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({
    reviewedWindowsDesktops: Object.keys(WINDOWS_DESKTOP_PRODUCTS).filter(
      (productId) => getProductIntakeDossier(productId)
    ).length,
    officialPendingWindowsDesktops: Object.keys(WINDOWS_DESKTOP_PRODUCTS).filter(
      (productId) => !getProductIntakeDossier(productId)
    ).length,
    vendors: catalog.vendors.length,
    products: catalog.vendors.reduce(
      (count, vendor) => count + vendor.products.length,
      0
    )
  })
);
