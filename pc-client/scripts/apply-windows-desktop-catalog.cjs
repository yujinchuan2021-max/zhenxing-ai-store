"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  WINDOWS_DESKTOP_PRODUCTS
} = require("../shared/windows-desktop-catalog.cjs");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
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
  kind: "桌面端",
  productType: "desktop-reviewed",
  moduleId: "desktop-managed",
  installPolicy: "client-managed-installer",
  downloadPolicy: "client-managed",
  signaturePolicy: "client-reviewed",
  uninstallPolicy: "client-managed"
};

const openClawVendor = catalog.vendors.find((vendor) => vendor.id === "openclaw");
if (!openClawVendor) throw new Error("catalog vendor not found: openclaw");
if (!findProduct("openclaw-wsl-gateway")) {
  openClawVendor.products.push({
    id: "openclaw-wsl-gateway",
    name: "OpenClaw WSL Gateway",
    kind: "CLI",
    category: "智能体",
    description: "由 OpenClaw Windows Hub 官方配置流程创建并管理专属 OpenClawGateway；AI Hub 分别检测发行版、CLI、服务就绪和配对状态。",
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
    order: Math.max(...openClawVendor.products.map((product) => product.order || 0)) + 1,
    extensions: []
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
  applyPolicy(located.product, {
    ...managedPolicy,
    name: definition.label,
    requirements: [...definition.requirements],
    installProfileId: definition.profileId,
    capabilities: [...definition.capabilities],
    download: {
      url: definition.download.url,
      fileName: definition.download.fileName
    }
  });
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
  capabilities: ["website", "tutorial", "install", "open", "uninstall"],
  extensions: []
});

findProduct("openclaw-windows-hub").product.componentProductIds = [
  "openclaw-wsl-gateway"
];

const linkPolicies = {
  web: {
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
    managedWindowsDesktops: Object.keys(WINDOWS_DESKTOP_PRODUCTS).length,
    vendors: catalog.vendors.length,
    products: catalog.vendors.reduce(
      (count, vendor) => count + vendor.products.length,
      0
    )
  })
);
