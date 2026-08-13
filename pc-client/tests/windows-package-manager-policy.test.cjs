"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  INSTALL_MODES,
  getInstallRegistration,
  getProductIntakeDossier,
  publicInstallProfiles
} = require("../shared/install-registry.cjs");
const {
  resolveManagedProductActionContext
} = require("../shared/managed-product-action-context.cjs");
const {
  resolveProductBehavior,
  validateProductPolicy
} = require("../shared/product-policy.cjs");
const {
  APPROVED_ROWS_SHA256,
  WINDOWS_PACKAGE_MANAGER_PRODUCTS,
  rowsAreApproved,
  rowsSha256
} = require("../shared/windows-package-manager-catalog.cjs");

function firefoxProduct() {
  const registration = getInstallRegistration("mozilla-firefox");
  return {
    id: "mozilla-firefox",
    enabled: true,
    order: 1,
    directoryKind: "ai",
    name: "Mozilla Firefox",
    kind: registration.kind,
    category: "AI 浏览器",
    description: "Mozilla Firefox Windows 客户端。",
    website: "https://www.firefox.com/en-US/download/windows/",
    tutorial: "https://support.mozilla.org/",
    productType: registration.productType,
    moduleId: registration.moduleId,
    installProfileId: registration.profileId,
    requirements: [...registration.requirements],
    installPolicy: "client-managed-installer",
    downloadPolicy: "package-manager",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    capabilities: [...registration.capabilities]
  };
}

test("the reviewed package-manager catalog is hash locked and client owned", () => {
  assert.equal(Object.keys(WINDOWS_PACKAGE_MANAGER_PRODUCTS).length, 132);
  assert.equal(rowsSha256(), APPROVED_ROWS_SHA256);
  assert.equal(rowsAreApproved(), true);

  const firefox = getInstallRegistration("mozilla-firefox");
  assert.equal(firefox.mode, INSTALL_MODES.MANAGED_PACKAGE_MANAGER);
  assert.equal(firefox.packageManager.packageId, "Mozilla.Firefox");
  assert.equal(
    getProductIntakeDossier("mozilla-firefox").architecture,
    "windows-package-manager"
  );

  const comet = getInstallRegistration("perplexity-comet");
  assert.equal(comet.mode, INSTALL_MODES.MANAGED_PACKAGE_MANAGER);
  assert.equal(comet.packageManager.packageId, "Perplexity.Comet");
});

test("backend metadata can select only the exact fixed package-manager profile", () => {
  const product = firefoxProduct();
  assert.equal(validateProductPolicy(product, "mozilla"), "");

  const behavior = resolveProductBehavior(product);
  assert.equal(behavior.managedDesktop, true);
  assert.equal(behavior.managedDownload, false);
  assert.equal(behavior.installMode, INSTALL_MODES.MANAGED_PACKAGE_MANAGER);

  assert.notEqual(validateProductPolicy(product, "attacker"), "");
  assert.notEqual(
    validateProductPolicy(
      { ...product, installProfileId: "desktop.attacker" },
      "mozilla"
    ),
    ""
  );
  assert.notEqual(
    validateProductPolicy(
      { ...product, packageId: "Attacker.Package" },
      "mozilla"
    ),
    ""
  );
});

test("public profiles and action contexts never expose package IDs or downloads", () => {
  const product = firefoxProduct();
  const profile = publicInstallProfiles().find(
    (candidate) => candidate.productId === product.id
  );

  assert.equal(profile.mode, INSTALL_MODES.MANAGED_PACKAGE_MANAGER);
  assert.equal(profile.downloadPolicy, "package-manager");
  assert.equal(Object.hasOwn(profile, "packageManager"), false);
  assert.equal(Object.hasOwn(profile, "packageId"), false);
  assert.equal(Object.hasOwn(profile, "download"), false);

  const context = resolveManagedProductActionContext({
    productId: product.id,
    vendors: [
      {
        id: "mozilla",
        enabled: true,
        products: [product]
      }
    ],
    localInventory: [profile],
    requireCatalogEnabled: true
  });
  assert.equal(context.downloadPolicy, "package-manager");
  assert.equal(Object.hasOwn(context, "packageManager"), false);
  assert.equal(Object.hasOwn(context, "packageId"), false);
  assert.equal(Object.hasOwn(context, "download"), false);
});
