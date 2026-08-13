"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  WINDOWS_PACKAGE_MANAGER_PRODUCTS,
  rowsAreApproved
} = require("../shared/windows-package-manager-catalog.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const configuredCatalogPath = process.env.AIHUB_CATALOG_PATH || "";
if (configuredCatalogPath && !path.isAbsolute(configuredCatalogPath)) {
  throw new Error("AIHUB_CATALOG_PATH must be absolute");
}
const catalogPath =
  configuredCatalogPath || path.join(root, "admin", "data", "catalog-v1.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

if (!rowsAreApproved()) {
  throw new Error("Windows 包管理器目录未通过客户端固定哈希审核");
}

const productIndex = new Map();
for (const vendor of catalog.vendors) {
  for (const product of vendor.products) {
    if (productIndex.has(product.id)) {
      throw new Error(`目录产品 ID 重复：${product.id}`);
    }
    productIndex.set(product.id, { vendor, product });
  }
}

for (const [productId, definition] of Object.entries(
  WINDOWS_PACKAGE_MANAGER_PRODUCTS
)) {
  const located = productIndex.get(productId);
  if (!located) throw new Error(`目录缺少包管理器产品：${productId}`);
  if (located.vendor.id !== definition.vendorId) {
    throw new Error(
      `包管理器产品厂商不一致：${productId} (${located.vendor.id} != ${definition.vendorId})`
    );
  }
  if (
    !["desktop-official", "desktop-reviewed"].includes(
      located.product.productType
    )
  ) {
    throw new Error(`包管理器产品类型不受支持：${productId}`);
  }

  Object.assign(located.product, {
    kind: "桌面端",
    productType: "desktop-reviewed",
    moduleId: "desktop-managed",
    installProfileId: definition.profileId,
    requirements: [...definition.requirements],
    installPolicy: "client-managed-installer",
    downloadPolicy: "package-manager",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    capabilities: [...definition.capabilities]
  });
  const entryPoints = Array.isArray(located.product.entryPoints)
    ? located.product.entryPoints
        .filter((entry) => entry?.type !== "desktop")
        .map((entry) => ({ ...entry }))
    : [];
  entryPoints.push({
    type: "desktop",
    label: `${located.product.name} 一键安装`
  });
  located.product.entryPoints = entryPoints;
  delete located.product.download;
}

catalog.updatedAt = new Date().toISOString();
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify({
    managedByWindowsPackageManager: Object.keys(
      WINDOWS_PACKAGE_MANAGER_PRODUCTS
    ).length,
    vendors: catalog.vendors.length,
    products: [...productIndex.keys()].length
  })
);
