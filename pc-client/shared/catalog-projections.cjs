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

function normalizedSearchIdentity(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().toLocaleLowerCase()
    : "";
}

function identityMatchRank(query, ...values) {
  let rank = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const identity = normalizedSearchIdentity(value);
    if (!identity) continue;
    if (identity === query) return 0;
    if (identity.startsWith(query)) rank = Math.min(rank, 1);
    else if (identity.includes(query)) rank = Math.min(rank, 2);
  }
  return rank;
}

function searchCatalog({ vendors, resources, resourceStores, query }) {
  const displayQuery = typeof query === "string" ? query.trim() : "";
  const normalizedQuery = normalizedSearchIdentity(displayQuery);
  if (!normalizedQuery) {
    return { query: "", vendors: [], resources: [] };
  }

  const vendorResults = [];
  for (const vendor of Array.isArray(vendors) ? vendors : []) {
    if (vendor.enabled === false) continue;
    const vendorRank = identityMatchRank(
      normalizedQuery,
      vendor.id,
      vendor.name
    );
    for (const directoryKind of DIRECTORY_KINDS) {
      const rankedProducts = (vendor.products || [])
        .filter(
          (product) =>
            product.enabled !== false &&
            resolvedDirectoryKind(product) === directoryKind
        )
        .map((product) => ({
          product,
          rank: identityMatchRank(normalizedQuery, product.id, product.name)
        }));
      const products = Number.isFinite(vendorRank)
        ? rankedProducts
        : rankedProducts.filter(({ rank }) => Number.isFinite(rank));
      if (!products.length) continue;
      products.sort(
        (left, right) =>
          left.rank - right.rank ||
          (left.product.order ?? 0) - (right.product.order ?? 0) ||
          left.product.name.localeCompare(right.product.name, "zh-CN")
      );
      vendorResults.push({
        rank: Math.min(vendorRank, ...products.map(({ rank }) => rank)),
        vendor,
        products: products.map(({ product }) => product),
        directoryKind
      });
    }
  }
  vendorResults.sort(
    (left, right) =>
      left.rank - right.rank ||
      (left.vendor.order ?? 0) - (right.vendor.order ?? 0) ||
      left.vendor.name.localeCompare(right.vendor.name, "zh-CN") ||
      DIRECTORY_KINDS.indexOf(left.directoryKind) -
        DIRECTORY_KINDS.indexOf(right.directoryKind)
  );

  const resourceResults = [];
  const stores = (Array.isArray(resourceStores) ? resourceStores : [])
    .filter((store) => store.enabled !== false)
    .sort(
      (left, right) =>
        (left.order ?? 0) - (right.order ?? 0) ||
        left.label.localeCompare(right.label, "zh-CN")
    );
  for (const store of stores) {
    const storeRank = identityMatchRank(
      normalizedQuery,
      store.id,
      store.label
    );
    for (const row of resourceTargetsByType(resources, vendors, store.id)) {
      const rank = Math.min(
        storeRank,
        identityMatchRank(
          normalizedQuery,
          row.resource.id,
          row.resource.name
        ),
        identityMatchRank(normalizedQuery, row.vendor.id, row.vendor.name),
        identityMatchRank(normalizedQuery, row.product.id, row.product.name)
      );
      if (!Number.isFinite(rank)) continue;
      resourceResults.push({ rank, store, ...row });
    }
  }
  resourceResults.sort(
    (left, right) =>
      left.rank - right.rank ||
      (left.store.order ?? 0) - (right.store.order ?? 0) ||
      left.store.label.localeCompare(right.store.label, "zh-CN") ||
      (left.vendor.order ?? 0) - (right.vendor.order ?? 0) ||
      left.vendor.name.localeCompare(right.vendor.name, "zh-CN") ||
      (left.product.order ?? 0) - (right.product.order ?? 0) ||
      left.product.name.localeCompare(right.product.name, "zh-CN") ||
      (left.resource.order ?? 0) - (right.resource.order ?? 0) ||
      left.resource.name.localeCompare(right.resource.name, "zh-CN")
  );

  return {
    query: displayQuery,
    vendors: vendorResults.map(({ rank, ...result }) => result),
    resources: resourceResults.map(({ rank, ...result }) => result)
  };
}

module.exports = {
  DIRECTORY_KINDS,
  projectVendorsByDirectory,
  resourceProductsByType,
  resourceTargetsByType,
  searchCatalog,
  resolvedDirectoryKind
};
