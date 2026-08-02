"use strict";

const DIRECTORY_KINDS = Object.freeze(["ai-tool", "ai-connectable"]);

function resolvedDirectoryKind(product) {
  return product?.directoryKind === "ai-connectable"
    ? "ai-connectable"
    : "ai-tool";
}

function projectVendorsByDirectory(
  vendors,
  directoryKind,
  { includeDisabled = false } = {}
) {
  if (!DIRECTORY_KINDS.includes(directoryKind)) {
    throw new TypeError("Unknown product directory");
  }
  return (Array.isArray(vendors) ? vendors : [])
    .filter((vendor) => includeDisabled || vendor.enabled !== false)
    .map((vendor) => ({
      ...vendor,
      products: (vendor.products || []).filter(
        (product) =>
          (includeDisabled || product.enabled !== false) &&
          resolvedDirectoryKind(product) === directoryKind
      )
    }))
    .filter((vendor) => vendor.products.length > 0);
}

function resourceTargetsByType(resources, vendors, resourceType) {
  const productOwners = new Map();
  for (const vendor of projectVendorsByDirectory(vendors, "ai-tool")) {
    for (const product of vendor.products) {
      productOwners.set(product.id, { vendor, product });
    }
  }

  const rows = [];
  for (const resource of Array.isArray(resources) ? resources : []) {
    if (
      resource.enabled === false ||
      !resource.resourceTypes?.includes(resourceType)
    ) {
      continue;
    }
    for (const target of resource.targets || []) {
      if (target.enabled === false) continue;
      const owner = productOwners.get(target.productId);
      if (!owner) continue;
      rows.push({ resource, target, ...owner });
    }
  }
  return rows.sort(
    (left, right) =>
      (left.vendor.order ?? 0) - (right.vendor.order ?? 0) ||
      left.vendor.name.localeCompare(right.vendor.name, "zh-CN") ||
      (left.product.order ?? 0) - (right.product.order ?? 0) ||
      left.product.name.localeCompare(right.product.name, "zh-CN") ||
      (left.resource.order ?? 0) - (right.resource.order ?? 0) ||
      left.resource.name.localeCompare(right.resource.name, "zh-CN")
  );
}

function resourceProductsByType(resources, vendors, resourceType) {
  const products = new Map();
  for (const row of resourceTargetsByType(resources, vendors, resourceType)) {
    let group = products.get(row.product.id);
    if (!group) {
      group = { vendor: row.vendor, product: row.product, rows: [] };
      products.set(row.product.id, group);
    }
    group.rows.push(row);
  }
  return [...products.values()];
}

module.exports = {
  DIRECTORY_KINDS,
  projectVendorsByDirectory,
  resourceProductsByType,
  resourceTargetsByType,
  resolvedDirectoryKind
};
