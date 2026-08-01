"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createActiveCatalogProductSource
} = require("../shared/active-catalog-products.cjs");

function response(value, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return structuredClone(value);
    }
  };
}

test("identity product discussions use enabled products from the backend active catalog and cache a successful read", async () => {
  let requests = 0;
  let now = 1_000;
  const source = createActiveCatalogProductSource({
    catalogUrl: "http://admin:4173/catalog-v1.json",
    cacheTtlMs: 5_000,
    now: () => now,
    fetchCatalog: async (url) => {
      requests += 1;
      assert.equal(url, "http://admin:4173/catalog-v1.json");
      return response({
        schemaVersion: 1,
        vendors: [
          {
            id: "enabled-vendor",
            enabled: true,
            products: [
              { id: "enabled-product", enabled: true },
              { id: "disabled-product", enabled: false }
            ]
          },
          {
            id: "disabled-vendor",
            enabled: false,
            products: [{ id: "hidden-by-vendor", enabled: true }]
          }
        ]
      });
    }
  });

  assert.deepEqual(
    [...(await source.enabledProductIds())],
    ["enabled-product"]
  );
  now += 4_999;
  assert.deepEqual(
    [...(await source.enabledProductIds())],
    ["enabled-product"]
  );
  assert.equal(requests, 1);
});

test("identity product discussions fail closed instead of using a stale catalog when the backend is unavailable", async () => {
  let now = 1_000;
  let available = true;
  const source = createActiveCatalogProductSource({
    catalogUrl: "http://admin:4173/catalog-v1.json",
    cacheTtlMs: 5_000,
    now: () => now,
    fetchCatalog: async () => {
      if (!available) throw new Error("admin unavailable");
      return response({
        schemaVersion: 1,
        vendors: [
          {
            id: "vendor",
            enabled: true,
            products: [{ id: "previously-enabled", enabled: true }]
          }
        ]
      });
    }
  });

  assert.equal((await source.enabledProductIds()).has("previously-enabled"), true);
  available = false;
  now += 5_001;
  await assert.rejects(
    () => source.enabledProductIds(),
    /active catalog is unavailable/
  );
});

test("identity uses the active admin URL while retaining one exact file contract for rollback", () => {
  const compose = fs.readFileSync(
    path.resolve(__dirname, "../deployment/local/compose.yaml"),
    "utf8"
  );
  const server = fs.readFileSync(
    path.resolve(__dirname, "../identity/server.cjs"),
    "utf8"
  );

  assert.match(
    compose,
    /identity-community:[\s\S]*?AIHUB_CATALOG_URL: http:\/\/admin:4173\/catalog-v1\.json/
  );
  assert.match(
    compose,
    /identity-community:[\s\S]*?depends_on:[\s\S]*?admin:[\s\S]*?condition: service_healthy/
  );
  assert.match(
    compose,
    /identity-community:[\s\S]*?AIHUB_CATALOG_FILE: \/app\/catalog\/catalog-v1\.json/
  );
  assert.match(compose, /\.\.\/\.\.\/admin\/data:\/app\/catalog:ro/);
  assert.doesNotMatch(compose, /admin\/published:\/app\/catalog/);
  assert.doesNotMatch(server, /admin["'],\s*["']published/);
  assert.doesNotMatch(server, /AIHUB_CATALOG_FILE/);
});
