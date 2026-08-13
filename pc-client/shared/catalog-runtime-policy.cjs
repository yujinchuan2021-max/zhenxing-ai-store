"use strict";

function resolvePackagedCatalogFallback({ cached, error = "" }) {
  if (cached?.eligible && cached.catalog) {
    return {
      source: "cache",
      catalog: cached.catalog,
      catalogVersion: cached.catalogVersion,
      error
    };
  }
  return {
    source: "unavailable",
    catalog: null,
    error: error || "后台目录暂不可用"
  };
}

module.exports = {
  resolvePackagedCatalogFallback
};
