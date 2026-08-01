"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  authorizeFreshCatalogProduct,
  evaluateFreshCatalogProductAuthorization
} = require("../shared/managed-catalog-install-authorization.cjs");

function remoteCatalog({ vendorEnabled = true, productEnabled = true } = {}) {
  return {
    source: "remote",
    catalogVersion: 31,
    catalog: {
      vendors: [
        {
          id: "anthropic",
          enabled: vendorEnabled,
          products: [
            {
              id: "claude-desktop",
              enabled: productEnabled
            }
          ]
        }
      ]
    }
  };
}

test("a fresh remote catalog authorizes exactly one enabled product", async () => {
  const result = await authorizeFreshCatalogProduct({
    productId: "claude-desktop",
    loadCatalog: async () => remoteCatalog()
  });
  assert.deepEqual(result, {
    ok: true,
    productId: "claude-desktop",
    catalogVersion: 31
  });
});

test("cached or unavailable catalogs fail closed for new installs", async () => {
  for (const catalogResult of [
    { ...remoteCatalog(), source: "cache" },
    { source: "unavailable", catalog: null }
  ]) {
    const result = evaluateFreshCatalogProductAuthorization({
      catalogResult,
      productId: "claude-desktop"
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "ACTIVE_CATALOG_UNAVAILABLE");
  }
  const thrown = await authorizeFreshCatalogProduct({
    productId: "claude-desktop",
    loadCatalog: async () => {
      throw new Error("network offline");
    }
  });
  assert.equal(thrown.ok, false);
  assert.equal(thrown.errorCode, "ACTIVE_CATALOG_UNAVAILABLE");
});

test("vendor disablement, product disablement and deletion revoke authorization", () => {
  for (const catalogResult of [
    remoteCatalog({ vendorEnabled: false }),
    remoteCatalog({ productEnabled: false }),
    { ...remoteCatalog(), catalog: { vendors: [] } }
  ]) {
    const result = evaluateFreshCatalogProductAuthorization({
      catalogResult,
      productId: "claude-desktop"
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "CATALOG_PRODUCT_DISABLED");
  }
});

test("duplicate enabled product identities fail closed", () => {
  const catalogResult = remoteCatalog();
  catalogResult.catalog.vendors.push({
    id: "duplicate",
    enabled: true,
    products: [{ id: "claude-desktop", enabled: true }]
  });
  const result = evaluateFreshCatalogProductAuthorization({
    catalogResult,
    productId: "claude-desktop"
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "CATALOG_PRODUCT_DISABLED");
});

test("main process reauthorizes every new managed install boundary", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const downloadStart = source.match(
    /ipcMain\.handle\("download:start"[\s\S]*?ipcMain\.handle\("download:refresh"/
  )?.[0];
  const refresh = source.match(
    /async function startFreshManagedDownload[\s\S]*?async function clearCompletedDownloadHistory/
  )?.[0];
  const installerLaunch = source.match(
    /ipcMain\.handle\("installer:launch"[\s\S]*?ipcMain\.handle\("desktop:operation-get"/
  )?.[0];
  const cliDeploy = source.match(
    /ipcMain\.handle\("cli:deploy"[\s\S]*?ipcMain\.handle\("cli:uninstall"/
  )?.[0];

  assert.ok(downloadStart);
  assert.ok(refresh);
  assert.ok(installerLaunch);
  assert.ok(cliDeploy);
  assert.match(downloadStart, /authorizeCurrentCatalogProduct\(productId\)/);
  assert.match(refresh, /authorizeCurrentCatalogProduct\(productId\)/);
  assert.match(installerLaunch, /authorizeCurrentCatalogProduct\(productId\)/);
  assert.match(cliDeploy, /authorizeCurrentCatalogProduct\(productId\)/);
  assert.doesNotMatch(
    source.match(
      /ipcMain\.handle\("cli:uninstall"[\s\S]*?function createWindow/
    )?.[0] || "",
    /authorizeCurrentCatalogProduct/
  );
});
