"use strict";

const {
  resolveCatalogIconUrls
} = require("./catalog-icon-runtime.cjs");

const DEVELOPMENT_CATALOG_URL =
  "/__aihub-local-catalog/catalog-release.json";

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validCatalog(catalog) {
  return (
    plainObject(catalog) &&
    [1, 2].includes(catalog.schemaVersion) &&
    Array.isArray(catalog.vendors) &&
    catalog.vendors.every(
      (vendor) =>
        plainObject(vendor) &&
        typeof vendor.id === "string" &&
        vendor.id.length > 0 &&
        typeof vendor.name === "string" &&
        vendor.name.length > 0 &&
        Array.isArray(vendor.products)
    )
  );
}

function builtInFallback(error) {
  return {
    source: "built-in",
    catalog: null,
    error
  };
}

async function loadDevelopmentCatalog(fetchCatalog) {
  if (typeof fetchCatalog !== "function") {
    return builtInFallback("development catalog fetch is unavailable");
  }
  try {
    const response = await fetchCatalog(DEVELOPMENT_CATALOG_URL, {
      cache: "no-store",
      credentials: "omit"
    });
    if (!response?.ok) {
      return builtInFallback(
        `development catalog request failed: ${response?.status || "unknown"}`
      );
    }
    const envelope = await response.json();
    const catalogVersion = envelope?.payload?.catalogVersion;
    const catalog = envelope?.payload?.catalog;
    if (
      envelope?.schemaVersion !== 1 ||
      envelope?.kind !== "catalog" ||
      !Number.isSafeInteger(catalogVersion) ||
      catalogVersion <= 0 ||
      !validCatalog(catalog)
    ) {
      return builtInFallback("invalid development catalog envelope");
    }
    return {
      source: "remote",
      catalog: resolveCatalogIconUrls(
        catalog,
        response.url || DEVELOPMENT_CATALOG_URL
      ),
      catalogVersion,
      error: ""
    };
  } catch (error) {
    return builtInFallback(
      error instanceof Error ? error.message : "development catalog request failed"
    );
  }
}

module.exports = {
  DEVELOPMENT_CATALOG_URL,
  loadDevelopmentCatalog
};
