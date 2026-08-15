"use strict";

const {
  verifyCatalogRelease
} = require("./catalog-release.cjs");

const DEFAULT_CACHE_TTL_MS = 15_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const WORKFLOW_BINDING_KINDS = new Set([
  "skill-context",
  "mcp-tool",
  "mcp-resource",
  "mcp-prompt",
  "plugin-host-extension",
  "connector-authorized-connection"
]);

function normalizeCatalogUrl(value, { sourceMode = "raw-catalog" } = {}) {
  const url = new URL(String(value || ""));
  if (
    sourceMode === "signed-internal-admin" &&
    url.href === "http://admin:4173/catalog-release.json"
  ) {
    return url.href;
  }
  const localHttpHosts = new Set(["127.0.0.1", "localhost"]);
  if (
    sourceMode !== "raw-catalog" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    url.pathname !== "/catalog-v1.json" ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && localHttpHosts.has(url.hostname))
    )
  ) {
    throw new Error(
      "Identity active catalog URL must use HTTPS or the fixed local admin endpoint"
    );
  }
  return url.href;
}

function enabledProductIdsFromCatalog(catalog) {
  if (
    !catalog ||
    ![1, 2, 3].includes(catalog.schemaVersion) ||
    !Array.isArray(catalog.vendors)
  ) {
    throw new Error("Identity active catalog response is invalid");
  }
  const ids = [];
  const uniqueIds = new Set();
  for (const vendor of catalog.vendors) {
    if (!vendor || typeof vendor !== "object" || !Array.isArray(vendor.products)) {
      throw new Error("Identity active catalog response is invalid");
    }
    if (vendor.enabled === false) continue;
    for (const product of vendor.products) {
      if (!product || typeof product !== "object") {
        throw new Error("Identity active catalog response is invalid");
      }
      if (product.enabled === false) continue;
      const productId = String(product.id || "").trim();
      if (!productId || uniqueIds.has(productId)) {
        throw new Error("Identity active catalog contains an invalid product ID");
      }
      uniqueIds.add(productId);
      ids.push(productId);
    }
  }
  return ids;
}

function workflowDependencyProjection(catalog) {
  const productIds = new Set(enabledProductIdsFromCatalog(catalog));
  const enabledStores = new Set(
    (Array.isArray(catalog.resourceStores) ? catalog.resourceStores : [])
      .filter((store) => store && store.enabled !== false && typeof store.id === "string")
      .map((store) => store.id)
  );
  const resourceBindings = new Set();
  for (const resource of Array.isArray(catalog.resources) ? catalog.resources : []) {
    if (
      !resource ||
      resource.enabled === false ||
      !["automated-reviewed", "manually-reviewed"].includes(resource.reviewStatus) ||
      !["low", "guarded"].includes(resource.riskLevel)
    ) {
      continue;
    }
    const resourceId = String(resource.id || "").trim();
    const resourceTypes = Array.isArray(resource.resourceTypes) ? resource.resourceTypes : [];
    if (!resourceId || !resourceTypes.some((type) => enabledStores.has(type))) continue;
    for (const target of Array.isArray(resource.targets) ? resource.targets : []) {
      if (
        !target ||
        target.enabled === false ||
        !productIds.has(target.productId) ||
        typeof target.moduleId !== "string" ||
        !target.moduleId.trim() ||
        typeof target.installProfileId !== "string" ||
        !target.installProfileId.trim()
      ) {
        continue;
      }
      for (const bindingKind of Array.isArray(target.agentBindingKinds) ? target.agentBindingKinds : []) {
        if (WORKFLOW_BINDING_KINDS.has(bindingKind)) {
          resourceBindings.add(`${resourceId}\u0000${target.productId}\u0000${bindingKind}`);
        }
      }
    }
  }
  return { productIds, resourceBindings };
}

function createActiveCatalogProductSource({
  catalogUrl,
  sourceMode = "raw-catalog",
  trustedKeys,
  highestCatalogVersion = 0,
  highestCatalogSha256 = "",
  fetchCatalog = globalThis.fetch,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  now = () => Date.now()
}) {
  const normalizedUrl = normalizeCatalogUrl(catalogUrl, { sourceMode });
  const signedRelease = sourceMode === "signed-internal-admin";
  let highWater = {
    catalogVersion: highestCatalogVersion,
    catalogSha256: highestCatalogSha256
  };
  if (
    typeof fetchCatalog !== "function" ||
    typeof now !== "function" ||
    !Number.isSafeInteger(cacheTtlMs) ||
    cacheTtlMs < 1_000 ||
    cacheTtlMs > 300_000 ||
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 100 ||
    requestTimeoutMs > 30_000
  ) {
    throw new TypeError("Identity active catalog source configuration is invalid");
  }

  let cached = null;
  let pending = null;
  let failed = false;

  async function fetchProjection() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchCatalog(normalizedUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response || response.ok !== true) {
        throw new Error(`HTTP ${response?.status || 0}`);
      }
      let catalog = await response.json();
      if (signedRelease) {
        const release = verifyCatalogRelease(catalog, {
          trustedKeys,
          clientId: "identity-active-catalog",
          highestCatalogVersion: highWater.catalogVersion,
          highestCatalogSha256: highWater.catalogSha256
        });
        if (!release.eligible) {
          throw new Error("Identity is not eligible for the active catalog release");
        }
        highWater = {
          catalogVersion: release.catalogVersion,
          catalogSha256: release.catalogSha256
        };
        catalog = release.catalog;
      }
      const projection = workflowDependencyProjection(catalog);
      cached = {
        projection,
        expiresAt: now() + cacheTtlMs
      };
      failed = false;
      return projection;
    } catch (error) {
      cached = null;
      failed = true;
      const wrapped = new Error("Identity active catalog is unavailable");
      wrapped.code = "TEMPORARILY_UNAVAILABLE";
      wrapped.status = 503;
      wrapped.cause = error;
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
  }

  function freshProjection() {
    return cached && now() < cached.expiresAt ? cached.projection : null;
  }

  function loadProjection() {
    const fresh = freshProjection();
    if (fresh) return Promise.resolve(fresh);
    if (!pending) {
      pending = fetchProjection().finally(() => {
        pending = null;
      });
    }
    return pending;
  }

  function readiness() {
    if (freshProjection()) return Object.freeze({ ready: true, status: "ready" });
    return Object.freeze({
      ready: false,
      status: pending ? "loading" : failed ? "unavailable" : "cold"
    });
  }

  async function warm() {
    await loadProjection();
    return true;
  }

  async function enabledProductIds() {
    return new Set((await loadProjection()).productIds);
  }

  async function hasCanonicalDependency(tuple) {
    const projection = await loadProjection();
    if (
      tuple &&
      Object.keys(tuple).length === 2 &&
      tuple.kind === "product" &&
      typeof tuple.canonicalId === "string"
    ) {
      return projection.productIds.has(tuple.canonicalId);
    }
    if (
      tuple &&
      Object.keys(tuple).length === 4 &&
      tuple.kind === "resource" &&
      typeof tuple.canonicalId === "string" &&
      typeof tuple.hostProductId === "string" &&
      WORKFLOW_BINDING_KINDS.has(tuple.bindingKind)
    ) {
      return projection.resourceBindings.has(
        `${tuple.canonicalId}\u0000${tuple.hostProductId}\u0000${tuple.bindingKind}`
      );
    }
    return false;
  }

  return Object.freeze({ enabledProductIds, hasCanonicalDependency, readiness, warm });
}

module.exports = {
  createActiveCatalogProductSource,
  enabledProductIdsFromCatalog,
  normalizeCatalogUrl,
  workflowDependencyProjection
};
