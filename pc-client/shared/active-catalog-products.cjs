"use strict";

const DEFAULT_CACHE_TTL_MS = 15_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;

function normalizeCatalogUrl(value) {
  const url = new URL(String(value || ""));
  const localHttpHosts = new Set(["127.0.0.1", "localhost", "admin"]);
  if (
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
    ![1, 2].includes(catalog.schemaVersion) ||
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

function createActiveCatalogProductSource({
  catalogUrl,
  fetchCatalog = globalThis.fetch,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  now = () => Date.now()
}) {
  const normalizedUrl = normalizeCatalogUrl(catalogUrl);
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

  async function fetchEnabledProductIds() {
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
      const ids = enabledProductIdsFromCatalog(await response.json());
      cached = {
        ids,
        expiresAt: now() + cacheTtlMs
      };
      return ids;
    } catch (error) {
      cached = null;
      const wrapped = new Error("Identity active catalog is unavailable");
      wrapped.cause = error;
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function enabledProductIds() {
    const timestamp = now();
    if (cached && timestamp < cached.expiresAt) {
      return new Set(cached.ids);
    }
    if (!pending) {
      pending = fetchEnabledProductIds().finally(() => {
        pending = null;
      });
    }
    return new Set(await pending);
  }

  return Object.freeze({ enabledProductIds });
}

module.exports = {
  createActiveCatalogProductSource,
  enabledProductIdsFromCatalog,
  normalizeCatalogUrl
};
