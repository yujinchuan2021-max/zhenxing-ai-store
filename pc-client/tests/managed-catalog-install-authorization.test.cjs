"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  authorizeFreshCatalogProduct,
  authorizeFreshDesktopDownloadOnlyProduct,
  evaluateFreshCatalogProductAuthorization
} = require("../shared/managed-catalog-install-authorization.cjs");
const {
  desktopDownloadOnlyProductIds,
  getDesktopDownloadOnlyProfile,
  SIGNED_CATALOG_MODULE_ID,
  SIGNED_CATALOG_PROFILE_ID
} = require("../shared/desktop-download-only.cjs");

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

function desktopDownloadOnlyCatalog(productId, overrides = {}) {
  const profile = getDesktopDownloadOnlyProfile(productId);
  const artifact = {
    url: `https://${profile.allowedDomains[0]}/catalog.exe`,
    fileName: "catalog.exe",
    artifactKind: "exe"
  };
  return {
    source: "remote",
    catalogVersion: 84,
    catalog: {
      vendors: [{
        id: profile.vendorId,
        enabled: true,
        products: [{
          id: productId,
          enabled: true,
          productType: "desktop-download-only",
          moduleId: "desktop-download-only",
          installProfileId: profile.profileId,
          capabilities: ["website", "tutorial", "install"],
          download: artifact,
          ...overrides
        }]
      }]
    }
  };
}

test("desktop-download-only admission requires an exact fixed profile and catalog artifact", async () => {
  for (const productId of desktopDownloadOnlyProductIds) {
    const catalogResult = desktopDownloadOnlyCatalog(productId);
    const result = await authorizeFreshDesktopDownloadOnlyProduct({
      productId,
      artifact: catalogResult.catalog.vendors[0].products[0].download,
      loadCatalog: async () => catalogResult
    });
    assert.equal(result.ok, true, productId);
  }

  const productId = "deepl-desktop";
  const catalogResult = desktopDownloadOnlyCatalog(productId);
  const authorizedArtifact = catalogResult.catalog.vendors[0].products[0].download;
  for (const overrides of [
    { moduleId: "backend-invented-module" },
    { productType: "desktop-reviewed" },
    { installProfileId: "desktop-download-only.other-product" },
    { download: { ...authorizedArtifact, url: "https://unapproved.example/catalog.exe" } },
    { download: { ...authorizedArtifact, command: "run" } }
  ]) {
    const result = await authorizeFreshDesktopDownloadOnlyProduct({
      productId,
      artifact: overrides.download || authorizedArtifact,
      loadCatalog: async () => desktopDownloadOnlyCatalog(productId, overrides)
    });
    assert.equal(result.ok, false, JSON.stringify(overrides));
  }
  const arbitraryFrontendArtifact = {
    ...authorizedArtifact,
    url: "https://appdownload.deepl.com/windows/other.exe",
    fileName: "other.exe"
  };
  const result = await authorizeFreshDesktopDownloadOnlyProduct({
    productId,
    artifact: arbitraryFrontendArtifact,
    loadCatalog: async () => catalogResult
  });
  assert.equal(result.ok, false, "frontend artifact must match the current catalog artifact");
});

test("signed catalog desktop downloads do not require a per-product client profile", async () => {
  const artifact = {
    url: "https://assets.tana.inc/desktop/Tana-Setup-windows.exe",
    fileName: "Tana-Setup-2026.29.20+c0082d7-windows.exe",
    artifactKind: "exe",
    mirrors: ["https://mirror.tana.inc/Tana-Setup-windows.exe"]
  };
  const catalogResult = {
    source: "remote", catalogVersion: 84,
    catalog: { vendors: [{ id: "tana", enabled: true, products: [{
      id: "tana-outliner", enabled: true,
      productType: "desktop-download-only",
      moduleId: SIGNED_CATALOG_MODULE_ID,
      installProfileId: SIGNED_CATALOG_PROFILE_ID,
      capabilities: ["website", "tutorial", "install"],
      download: artifact
    }] }] }
  };
  const accepted = await authorizeFreshDesktopDownloadOnlyProduct({
    productId: "tana-outliner", artifact, loadCatalog: async () => catalogResult
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.plan.allowedHosts.includes("assets.tana.inc"), true);
  assert.equal(accepted.plan.allowedHosts.includes("mirror.tana.inc"), true);
  for (const product of [
    { ...catalogResult.catalog.vendors[0].products[0], installProfileId: "desktop-download-only.tana-outliner" },
    { ...catalogResult.catalog.vendors[0].products[0], moduleId: "desktop-download-only" },
    { ...catalogResult.catalog.vendors[0].products[0], moduleId: "other" },
    { ...catalogResult.catalog.vendors[0].products[0], download: { ...artifact, command: "run" } }
  ]) {
    const result = await authorizeFreshDesktopDownloadOnlyProduct({
      productId: "tana-outliner", artifact: product.download,
      loadCatalog: async () => ({ ...catalogResult, catalog: { vendors: [{ ...catalogResult.catalog.vendors[0], products: [product] }] } })
    });
    assert.equal(result.ok, false);
  }
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
  const downloadRefresh = source.match(
    /ipcMain\.handle\("download:refresh"[\s\S]*?ipcMain\.handle\("download:pause"/
  )?.[0];
  const managedDownloadRequest = source.match(
    /async function startManagedDownloadFromRequest[\s\S]*?async function clearCompletedDownloadHistory/
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
  assert.ok(downloadRefresh);
  assert.ok(managedDownloadRequest);
  assert.ok(installerLaunch);
  assert.ok(cliReconcile);
  assert.ok(resourceLifecycle);
  assert.match(downloadStart, /authorizeCurrentCatalogProduct\(productId\)/);
  assert.match(downloadStart, /startManagedDownloadFromRequest\(productId, artifact\)/);
  assert.match(managedDownloadRequest, /authorizeCurrentDesktopDownloadOnlyProduct\(productId, artifact\)/);
  assert.match(managedDownloadRequest, /plan\.downloadPolicy === "desktop-download-only"/);
  assert.match(downloadRefresh, /authorizeCurrentDesktopDownloadOnlyProduct\(productId, artifact\)/);
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
