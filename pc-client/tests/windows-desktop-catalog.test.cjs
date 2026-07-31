"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { cliInstallPlans } = require("../shared/install-registry.cjs");
const catalog = require("../admin/data/catalog-v1.json");
const {
  WINDOWS_DESKTOP_PRODUCTS
} = require("../shared/windows-desktop-catalog.cjs");
const {
  getInstallRegistration
} = require("../shared/install-registry.cjs");
const {
  getManagedDownload,
  matchesManagedDownload
} = require("../shared/managed-downloads.cjs");

test("every reviewed Windows desktop uses one local execution whitelist", () => {
  assert.equal(Object.keys(WINDOWS_DESKTOP_PRODUCTS).length, 23);
  const products = new Map(
    catalog.vendors.flatMap((vendor) =>
      vendor.products.map((product) => [product.id, { vendor, product }])
    )
  );
  for (const [productId, definition] of Object.entries(
    WINDOWS_DESKTOP_PRODUCTS
  )) {
    const catalogEntry = products.get(productId);
    assert.ok(catalogEntry, productId);
    assert.equal(catalogEntry.vendor.id, definition.vendorId, productId);
    assert.equal(catalogEntry.product.productType, "desktop-reviewed", productId);
    assert.equal(catalogEntry.product.moduleId, "desktop-managed", productId);
    assert.equal(
      catalogEntry.product.installProfileId,
      definition.profileId,
      productId
    );
    assert.equal(
      matchesManagedDownload(productId, catalogEntry.product.download),
      true,
      productId
    );
    assert.equal(getInstallRegistration(productId)?.vendorId, definition.vendorId);
    assert.ok(getManagedDownload(productId)?.expectedSigner instanceof RegExp);
    assert.match(definition.download.url, /^https:\/\//);
    assert.match(definition.download.fileName, /Windows-x64\.exe$/i);
    if (definition.download.expectedSha256) {
      assert.match(definition.download.expectedSha256, /^[a-f0-9]{64}$/);
    }
  }
});

test("Comet only accepts its official entrypoint and reviewed R2 bucket", () => {
  assert.deepEqual(getManagedDownload("perplexity-comet").allowedHosts, [
    "www.perplexity.ai",
    "pplx-browser-binaries.a0adf9b772aecba4fa8883581f3c9180.r2.cloudflarestorage.com"
  ]);
});

test("WSL stays an environment dependency instead of a standalone product", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.some((product) => product.id === "wsl"), false);
  assert.deepEqual(
    products.find((product) => product.id === "nvidia-ai-workbench")
      .requirements,
    ["wsl", "docker", "git"]
  );
});

test("non-desktop features and extensions are not advertised as installers", () => {
  const types = Object.fromEntries(
    catalog.vendors
      .flatMap((vendor) => vendor.products)
      .filter((product) =>
        [
          "claude-cowork",
          "kimi-claw-desktop",
          "baidu-comate",
          "nous-hermes-agent",
          "cline-agent"
        ].includes(product.id)
      )
      .map((product) => [product.id, product.productType])
  );
  assert.deepEqual(types, {
    "claude-cowork": "web",
    "kimi-claw-desktop": "tutorial",
    "baidu-comate": "web",
    "nous-hermes-agent": "cli-official",
    "cline-agent": "tutorial"
  });
});

test("OpenClaw exposes native Windows Hub and a managed WSL deployment", () => {
  const products = new Map(
    catalog.vendors
      .flatMap((vendor) => vendor.products)
      .map((product) => [product.id, product])
  );
  const windowsHub = products.get("openclaw-windows-hub");
  const wslGateway = products.get("openclaw-wsl-gateway");

  assert.equal(windowsHub?.productType, "desktop-reviewed");
  assert.equal(windowsHub?.moduleId, "desktop-managed");
  assert.equal(windowsHub?.installProfileId, "desktop.openclaw-windows-hub.windows");
  assert.deepEqual(windowsHub?.requirements, []);

  assert.equal(wslGateway?.productType, "cli");
  assert.equal(wslGateway?.moduleId, "cli-managed");
  assert.equal(wslGateway?.installProfileId, "cli.openclaw-wsl");
  assert.deepEqual(wslGateway?.requirements, ["wsl"]);
  assert.equal(
    cliInstallPlans()["openclaw-wsl-gateway"].driver,
    "companion-runtime"
  );
  assert.equal(
    cliInstallPlans()["openclaw-wsl-gateway"].distribution,
    "OpenClawGateway"
  );
  assert.equal(
    cliInstallPlans()["openclaw-wsl-gateway"].requiresInstallDirectory,
    false
  );

  const openClawAdapter = WINDOWS_DESKTOP_PRODUCTS["openclaw-windows-hub"].adapter;
  assert.equal(openClawAdapter.uninstallMode, "automatic");
  assert.deepEqual(openClawAdapter.closeProcessNames, [
    "OpenClaw.Tray.WinUI.exe"
  ]);
  assert.equal(openClawAdapter.closeProcessStrategy, "force-after-grace");
  assert.deepEqual(openClawAdapter.uninstall.launchArguments, [
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART"
  ]);
});
