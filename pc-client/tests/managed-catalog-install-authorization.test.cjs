"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  authorizeFreshCatalogProduct,
  evaluateFreshCatalogProductAuthorization
} = require("../shared/managed-catalog-install-authorization.cjs");

function remoteCatalog({
  vendorEnabled = true,
  productEnabled = true,
  capabilities = ["website", "install", "open", "uninstall"]
} = {}) {
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
              enabled: productEnabled,
              capabilities
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

test("removing install capability revokes direct IPC installation admission", () => {
  const result = evaluateFreshCatalogProductAuthorization({
    catalogResult: remoteCatalog({ capabilities: ["website", "open", "uninstall"] }),
    productId: "claude-desktop"
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "CATALOG_PRODUCT_CAPABILITY_DISABLED");
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
  const cliReconcile = source.match(
    /async function reconcileManagedCli[\s\S]*?async function scanApprovedProductInventory/
  )?.[0];
  const resourceLifecycle = source.match(
    /const manager = createExtensionResourceManager[\s\S]*?extensionIpcFacade = createExtensionIpcFacade\(manager, \{ listProfiles \}\)/
  )?.[0];

  assert.ok(downloadStart);
  assert.ok(refresh);
  assert.ok(installerLaunch);
  assert.ok(cliReconcile);
  assert.ok(resourceLifecycle);
  assert.match(downloadStart, /authorizeCurrentCatalogProduct\(productId\)/);
  assert.match(refresh, /authorizeCurrentCatalogProduct\(productId\)/);
  assert.match(installerLaunch, /authorizeCurrentCatalogProduct\(productId\)/);
  assert.match(
    cliReconcile,
    /authorizeCurrentCatalogProduct\(\s*productId,\s*intent\s*\)/
  );
  assert.match(resourceLifecycle, /authorizeFreshCatalogResource/);
  assert.doesNotMatch(
    source.match(
      /ipcMain\.handle\("cli:uninstall"[\s\S]*?function createWindow/
    )?.[0] || "",
    /authorizeCurrentCatalogProduct/
  );
});
