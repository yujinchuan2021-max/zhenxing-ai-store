"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  isFixedCatalogDesktopDownloadOnlyProduct,
  isSignedCatalogDesktopDownloadOnlyProduct
} = require("../shared/managed-product-action-context.cjs");
const {
  evaluateFreshDesktopDownloadOnlyAuthorization
} = require("../shared/managed-catalog-install-authorization.cjs");
const { resolveProductBehavior } = require("../shared/product-policy.cjs");
const {
  getWindowsPackageManagerProduct
} = require("../shared/windows-package-manager-catalog.cjs");

const main = fs.readFileSync(path.resolve(__dirname, "../electron/main.cjs"), "utf8");
const active5Catalog = require("../admin/published/catalog-store/releases/catalog-v00000005-9654219dbedb-3f44cffa.json").payload.catalog;
const active6Catalog = require("../admin/published/catalog-store/releases/catalog-v00000006-567e671621f1-3dcee587.json").payload.catalog;
const canonicalProductIds = [
  "microsoft-power-bi-desktop",
  "alibaba-quark-ai-browser",
  "alibaba-dingtalk-ai"
];

function functionSource(name) {
  const match = new RegExp(`async\\s+function\\s+${name}\\s*\\(`).exec(main);
  assert.ok(match, `missing ${name}`);
  const params = main.indexOf("(", match.index);
  let parameterDepth = 0;
  let open = -1;
  for (let index = params; index < main.length; index += 1) {
    if (main[index] === "(") parameterDepth += 1;
    if (main[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      open = main.indexOf("{", index);
      break;
    }
  }
  assert.ok(open >= 0, `missing body for ${name}`);
  let depth = 0;
  for (let index = open; index < main.length; index += 1) {
    if (main[index] === "{") depth += 1;
    if (main[index] === "}") depth -= 1;
    if (depth === 0) return main.slice(match.index, index + 1);
  }
  assert.fail(`unterminated ${name}`);
}

function active5Product(productId) {
  return active5Catalog.vendors
    .flatMap((vendor) => vendor.products || [])
    .find((product) => product.id === productId);
}

test("active5 canonical desktop downloads skip colliding legacy Winget detection", async () => {
  for (const productId of canonicalProductIds) {
    const product = active5Product(productId);
    assert.ok(product, `${productId} must exist in active5`);
    assert.equal(product.productType, "desktop-download-only");
    assert.equal(product.moduleId, "desktop-download-only.signed-catalog");
    assert.equal(product.installProfileId, "desktop-download-only.signed-catalog");
    assert.ok(getWindowsPackageManagerProduct(productId), `${productId} legacy Winget row`);
    assert.equal(isSignedCatalogDesktopDownloadOnlyProduct({
      productId,
      vendors: active5Catalog.vendors
    }), true, `${productId} canonical contract`);
    assert.equal(resolveProductBehavior(product).canInstall, true, productId);
    assert.equal(resolveProductBehavior(product).managedDownload, true, productId);
    assert.equal(evaluateFreshDesktopDownloadOnlyAuthorization({
      catalogResult: { source: "remote", catalog: active5Catalog },
      productId,
      artifact: product.download
    }).ok, true, `${productId} download authorization`);
  }

  let wingetCalls = 0;
  const detector = vm.runInNewContext(`(${functionSource("detectDesktopProduct")})`, {
    getWindowsPackageManagerProduct: () => ({ packageManager: "winget" }),
    isFixedCatalogDesktopDownloadOnlyProduct,
    isSignedCatalogDesktopDownloadOnlyProduct,
    signedCatalogDesktopDownloadOnlyAbsentStatus: () => ({
      installed: false,
      canOpen: false,
      canUninstall: false,
      detection: "absent"
    }),
    detectWindowsPackageManagerProduct: async () => {
      wingetCalls += 1;
      return { installed: false, detection: "unknown" };
    }
  });

  for (const productId of canonicalProductIds) {
    const status = await detector(productId, null, {
      source: "remote",
      catalog: active5Catalog
    });
    assert.equal(status.detection, "absent", productId);
  }
  assert.equal(wingetCalls, 0);
});

test("legacy Winget-managed unknown detection remains unchanged", async () => {
  let wingetCalls = 0;
  const detector = vm.runInNewContext(`(${functionSource("detectDesktopProduct")})`, {
    getWindowsPackageManagerProduct: () => ({ packageManager: "winget" }),
    isFixedCatalogDesktopDownloadOnlyProduct,
    isSignedCatalogDesktopDownloadOnlyProduct,
    signedCatalogDesktopDownloadOnlyAbsentStatus: () => ({ detection: "absent" }),
    detectWindowsPackageManagerProduct: async () => {
      wingetCalls += 1;
      return { installed: false, detection: "unknown" };
    }
  });
  const status = await detector("bytedance-feishu", null, {
    source: "remote",
    catalog: active5Catalog
  });
  assert.equal(status.detection, "unknown");
  assert.equal(wingetCalls, 1);
});

test("active6 fixed desktop download treats inconclusive legacy Winget detection as absent", async () => {
  const productId = "wondershare-filmora";
  const product = active6Catalog.vendors
    .flatMap((vendor) => vendor.products || [])
    .find((candidate) => candidate.id === productId);
  assert.equal(product?.productType, "desktop-download-only");
  assert.equal(product?.moduleId, "desktop-download-only");
  assert.equal(product?.installProfileId, "desktop-download-only.wondershare-filmora");
  assert.equal(evaluateFreshDesktopDownloadOnlyAuthorization({
    catalogResult: { source: "remote", catalog: active6Catalog },
    productId,
    artifact: product.download
  }).ok, true);

  const detector = vm.runInNewContext(`(${functionSource("detectDesktopProduct")})`, {
    getWindowsPackageManagerProduct: () => ({ packageManager: "winget" }),
    isFixedCatalogDesktopDownloadOnlyProduct,
    isSignedCatalogDesktopDownloadOnlyProduct,
    signedCatalogDesktopDownloadOnlyAbsentStatus: () => ({
      installed: false,
      detection: "absent"
    }),
    detectWindowsPackageManagerProduct: async () => ({
      installed: false,
      detection: "unknown"
    })
  });

  const status = await detector(productId, null, {
    source: "remote",
    catalog: active6Catalog
  });
  assert.equal(status.detection, "absent");
});

test("active6 fixed desktop download preserves conclusive Winget installed status", async () => {
  const productId = "wondershare-filmora";
  const product = active6Catalog.vendors
    .flatMap((vendor) => vendor.products || [])
    .find((candidate) => candidate.id === productId);
  assert.equal(resolveProductBehavior(product).canInstall, true);
  const detector = vm.runInNewContext(`(${functionSource("detectDesktopProduct")})`, {
    getWindowsPackageManagerProduct: () => ({ packageManager: "winget" }),
    isFixedCatalogDesktopDownloadOnlyProduct,
    isSignedCatalogDesktopDownloadOnlyProduct,
    signedCatalogDesktopDownloadOnlyAbsentStatus: () => ({
      installed: false,
      detection: "absent"
    }),
    detectWindowsPackageManagerProduct: async () => ({
      installed: true,
      detection: "installed",
      version: "14.2.0"
    })
  });

  const status = await detector(productId, null, {
    source: "remote",
    catalog: active6Catalog
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(status)),
    { installed: true, detection: "installed", version: "14.2.0" }
  );
});

test("desktop inventory shares the catalog snapshot and disables Winget only for canonical collisions", async () => {
  const snapshots = [];
  const detector = vm.runInNewContext(`(${functionSource("detectDesktopProducts")})`, {
    DESKTOP_PROBES: {},
    windowsPackageManagerPlan: () => ({ packageManager: "winget" }),
    resolveCatalog: async () => ({ source: "remote", catalog: active5Catalog }),
    isSignedCatalogDesktopDownloadOnlyProduct,
    createDesktopProductScanSnapshot: async (options) => {
      snapshots.push(options);
      return { registryScan: { ok: true, entries: [] }, windowsApps: { ok: true } };
    },
    detectDesktopProduct: async (productId, _snapshot, catalogResult) => ({
      productId,
      catalogResult
    }),
    scanManagedDesktopInventory: async (options) => ({
      snapshot: await options.createSnapshot(),
      statuses: await Promise.all(
        options.productIds.map((productId) => options.detectProduct(productId, {}))
      )
    })
  });

  const result = await detector(canonicalProductIds);
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.includeWindowsPackageManager),
    [false]
  );
  assert.deepEqual(result.statuses.map((status) => status.productId), canonicalProductIds);
  assert.ok(result.statuses.every((status) => status.catalogResult.catalog === active5Catalog));
});
