"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  existingProductUpdates,
  existingVendorProducts,
  newVendors
} = require("../catalog/windows-desktop-expansion-v2.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.resolve(__dirname, "..");
const configuredCatalogPath = process.env.AIHUB_CATALOG_PATH || "";
if (configuredCatalogPath && !path.isAbsolute(configuredCatalogPath)) {
  throw new Error("AIHUB_CATALOG_PATH must be absolute");
}
const catalogPath =
  configuredCatalogPath || path.join(root, "admin", "data", "catalog-v1.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

function allProducts() {
  return catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => ({ vendor, product }))
  );
}

function findProduct(productId) {
  return allProducts().find(({ product }) => product.id === productId) || null;
}

function nextOrder(items) {
  return items.reduce((highest, item) => Math.max(highest, item.order || 0), -1) + 1;
}

function upsertProduct(vendor, definition) {
  const existing = vendor.products.find((product) => product.id === definition.id);
  if (existing) {
    applyDefinition(existing, { ...definition, directoryKind: "ai-tool" }, [
      "enabled",
      "order"
    ]);
    // This script restores the researched official-download baseline before
    // the client-owned execution policies are applied. Do not retain a
    // managed installer payload from an earlier run while the product is
    // temporarily back on the official-only policy.
    if (!Object.hasOwn(definition, "download")) delete existing.download;
    delete existing.extensions;
    return "updated";
  }
  const product = {
    ...definition,
    directoryKind: "ai-tool",
    order: nextOrder(vendor.products)
  };
  delete product.extensions;
  vendor.products.push(product);
  return "added";
}

const before = {
  vendors: catalog.vendors.length,
  products: allProducts().length
};
let addedVendors = 0;
let addedProducts = 0;
let updatedProducts = 0;

for (const [vendorId, products] of Object.entries(existingVendorProducts)) {
  const target = catalog.vendors.find((vendor) => vendor.id === vendorId);
  if (!target) throw new Error(`catalog vendor not found: ${vendorId}`);
  for (const product of products) {
    const result = upsertProduct(target, product);
    if (result === "added") addedProducts += 1;
    else updatedProducts += 1;
  }
}

for (const definition of newVendors) {
  let target = catalog.vendors.find((vendor) => vendor.id === definition.id);
  if (!target) {
    target = {
      ...definition,
      products: [],
      order: nextOrder(catalog.vendors)
    };
    catalog.vendors.push(target);
    addedVendors += 1;
  } else {
    const { products, ...metadata } = definition;
    applyDefinition(target, metadata, ["enabled", "order", "iconAsset", "iconUrl"]);
  }
  for (const product of definition.products) {
    const result = upsertProduct(target, product);
    if (result === "added") addedProducts += 1;
    else updatedProducts += 1;
  }
}

for (const [productId, update] of Object.entries(existingProductUpdates)) {
  const located = findProduct(productId);
  if (!located) throw new Error(`catalog product not found: ${productId}`);
  applyDefinition(
    located.product,
    { ...update, directoryKind: "ai-tool" },
    ["enabled", "order"]
  );
  delete located.product.extensions;
  updatedProducts += 1;
}

catalog.updatedAt = new Date().toISOString();
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const after = {
  vendors: catalog.vendors.length,
  products: allProducts().length
};
console.log(
  JSON.stringify({
    before,
    after,
    addedVendors,
    addedProducts,
    updatedProducts
  })
);
