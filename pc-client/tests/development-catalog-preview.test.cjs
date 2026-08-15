"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("browser development preview loads the published backend catalog", async () => {
  const {
    DEVELOPMENT_CATALOG_URL,
    loadDevelopmentCatalog
  } = require("../shared/development-catalog.cjs");
  const requested = [];
  const result = await loadDevelopmentCatalog(async (url) => {
    requested.push(url);
    return {
      ok: true,
      async json() {
        return {
          schemaVersion: 1,
          kind: "catalog",
          keyId: "catalog-test",
          payload: {
            catalogVersion: 13,
            catalog: {
              schemaVersion: 1,
              vendors: Array.from({ length: 49 }, (_, index) => ({
                id: `vendor-${index}`,
                name: `Vendor ${index}`,
                ...(index === 0
                  ? {
                      iconAsset: {
                        path: `vendor-icons/${"a".repeat(64)}.png`,
                        sha256: "a".repeat(64),
                        mimeType: "image/png"
                      }
                    }
                  : index === 1
                    ? {
                        iconUrl: `https://127.0.0.1:4443/vendor-icons/${"b".repeat(64)}.png`
                      }
                  : {}),
                products: []
              }))
            }
          },
          signature: "test"
        };
      }
    };
  });

  assert.deepEqual(requested, [DEVELOPMENT_CATALOG_URL]);
  assert.equal(result.source, "remote");
  assert.equal(result.catalogVersion, 13);
  assert.equal(result.catalog.vendors.length, 49);
  assert.equal(
    result.catalog.vendors[0].iconUrl,
    `/__aihub-local-catalog/vendor-icons/${"a".repeat(64)}.png`
  );
  assert.equal(
    result.catalog.vendors[1].iconUrl,
    `/__aihub-local-catalog/vendor-icons/${"b".repeat(64)}.png`
  );

  const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
  const vite = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
  assert.match(app, /loadDevelopmentCatalog/);
  assert.match(app, /import\.meta\.env\.DEV/);
  assert.match(vite, /127\.0\.0\.1:4173/);
  assert.match(vite, /__aihub-local-catalog/);
  assert.match(vite, /"Cache-Control": "no-store"/);
});

test("browser development preview prebundles every shared CommonJS UI module", () => {
  const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
  const vite = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
  const sharedModules = [
    ...new Set(
      [...app.matchAll(/from\s+"(@aihub-shared\/[^"]+\.cjs)"/g)].map(
        (match) => match[1]
      )
    )
  ].sort();
  const configuredModules = (field) => {
    const match = vite.match(
      new RegExp(`\\b${field}: \\[([\\s\\S]*?)\\n    \\]`)
    );
    assert.ok(match, `vite optimizeDeps.${field} must be an array`);
    return [
      ...match[1].matchAll(/"([^"]+)"/g)
    ]
      .map((entry) => entry[1])
      .sort();
  };

  assert.ok(sharedModules.length > 0);
  for (const field of ["include", "needsInterop"]) {
    assert.deepEqual(
      configuredModules(field),
      sharedModules,
      `vite optimizeDeps.${field} must exactly match App shared CommonJS imports`
    );
  }
});

test("development catalog loader rejects an invalid published envelope", async () => {
  const { loadDevelopmentCatalog } = require("../shared/development-catalog.cjs");
  const result = await loadDevelopmentCatalog(async () => ({
    ok: true,
    async json() {
      return { payload: { catalogVersion: 13, catalog: { vendors: [] } } };
    }
  }));

  assert.equal(result.source, "built-in");
  assert.equal(result.catalog, null);
  assert.match(result.error, /invalid/i);
});
