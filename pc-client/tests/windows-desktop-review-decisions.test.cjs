"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const catalog = require("../admin/data/catalog-v1.json");
const {
  getWindowsDesktopReviewDecision
} = require("../shared/windows-desktop-review-decisions.cjs");
const {
  INSTALL_MODES,
  getInstallRegistration
} = require("../shared/install-registry.cjs");

const desktops = catalog.vendors.flatMap((vendor) =>
  vendor.products.filter(
    (product) =>
      product.productType === "desktop-reviewed" ||
      product.productType === "desktop-official" ||
      (product.productType === "local-model" &&
        product.installProfileId === "local-model.ollama")
  )
);

test("every Windows desktop catalog entry has an explicit execution decision", () => {
  assert.equal(desktops.length, 266);
  for (const product of desktops) {
    const decision = getWindowsDesktopReviewDecision(product);
    assert.ok(decision, product.id);
    assert.match(decision.reasonCode, /^[a-z0-9-]+$/, product.id);
    assert.ok(decision.reviewReference, product.id);
    if (decision.status === "managed") {
      assert.equal(product.capabilities.includes("install"), true, product.id);
    } else {
      assert.equal(decision.status, "official-only", product.id);
      assert.equal(product.productType, "desktop-official", product.id);
      assert.equal(product.capabilities.includes("install"), false, product.id);
    }
  }
});

test("package-manager promotions replace their obsolete direct-download blockers", () => {
  const byId = new Map(desktops.map((product) => [product.id, product]));
  for (const productId of [
    "perplexity-comet",
    "grammarly-windows",
    "obsidian-desktop",
    "notion-desktop",
    "deepl-desktop",
    "cherry-studio",
    "deepchat-desktop",
    "windsurf-editor"
  ]) {
    assert.equal(
      getInstallRegistration(productId)?.mode,
      INSTALL_MODES.MANAGED_PACKAGE_MANAGER,
      productId
    );
    assert.equal(
      getWindowsDesktopReviewDecision(byId.get(productId)).reasonCode,
      "client-owned-execution-contract",
      productId
    );
  }
});
