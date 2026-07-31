"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  resolvePackagedCatalogFallback
} = require("../shared/catalog-runtime-policy.cjs");

test("a packaged client never replaces backend data with the small built-in catalog", () => {
  assert.deepEqual(
    resolvePackagedCatalogFallback({
      cached: null,
      error: "目录通道未配置"
    }),
    {
      source: "unavailable",
      catalog: null,
      error: "目录通道未配置"
    }
  );
});

test("a packaged client keeps the last eligible verified catalog", () => {
  const catalog = { schemaVersion: 1, vendors: [{ id: "openclaw" }] };
  assert.deepEqual(
    resolvePackagedCatalogFallback({
      cached: { eligible: true, catalog, catalogVersion: 29 },
      error: "network unavailable"
    }),
    {
      source: "cache",
      catalog,
      catalogVersion: 29,
      error: "network unavailable"
    }
  );
});
