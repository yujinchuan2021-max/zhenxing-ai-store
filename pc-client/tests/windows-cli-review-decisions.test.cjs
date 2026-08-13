"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const catalog = require("../admin/data/catalog-v1.json");
const {
  INSTALL_MODES,
  INSTALL_REGISTRY
} = require("../shared/install-registry.cjs");
const {
  CLI_REVIEW_BLOCKERS
} = require("../shared/windows-cli-review-decisions.cjs");

test("every Windows CLI is either locally managed or explicitly blocked", () => {
  const products = catalog.vendors.flatMap((vendor) =>
    (vendor.products || []).map((product) => ({ ...product, vendorId: vendor.id }))
  );
  const managedIds = new Set(
    Object.entries(INSTALL_REGISTRY)
      .filter(([, registration]) => registration.mode === INSTALL_MODES.MANAGED_CLI)
      .map(([productId]) => productId)
  );
  const blockedIds = new Set(Object.keys(CLI_REVIEW_BLOCKERS));
  const catalogCliIds = new Set(
    products
      .filter((product) =>
        product.productType === "cli" || product.productType === "cli-official"
      )
      .map((product) => product.id)
  );
  assert.equal(managedIds.size + blockedIds.size, catalogCliIds.size);

  for (const product of products.filter((entry) =>
    entry.productType === "cli" || entry.productType === "cli-official"
  )) {
    if (product.productType === "cli") {
      assert.ok(managedIds.has(product.id), `${product.id} is not in the local registry`);
      assert.ok(!blockedIds.has(product.id), `${product.id} is both managed and blocked`);
    } else {
      assert.ok(blockedIds.has(product.id), `${product.id} has no blocker decision`);
      assert.ok(!managedIds.has(product.id), `${product.id} is both official-only and managed`);
    }
  }

  for (const [productId, decision] of Object.entries(CLI_REVIEW_BLOCKERS)) {
    assert.equal(decision.verdict, "blocked");
    assert.ok(decision.reason.length > 10);
    assert.ok(decision.reviewUrls.length > 0);
    assert.ok(products.some((product) => product.id === productId));
  }
});

test("source projects are not duplicated or presented as standalone CLIs", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products || []);
  const byId = new Map(products.map((product) => [product.id, product]));

  assert.equal(byId.get("openmanus-cli")?.productType, "tutorial");
  assert.equal(byId.get("nanoclaw-cli")?.productType, "tutorial");
  assert.equal(byId.has("agenticseek-cli"), false);
  assert.equal(byId.get("agenticseek-self-hosted")?.productType, "tutorial");
});

test("only fixed reconcile drivers advertise update and repair", () => {
  for (const [productId, registration] of Object.entries(INSTALL_REGISTRY)) {
    if (registration.mode !== INSTALL_MODES.MANAGED_CLI) continue;

    const driver = registration.cli?.driver || "npm";
    const hasReconcileCapabilities = ["update", "repair"].every((capability) =>
      registration.capabilities.includes(capability)
    );

    assert.equal(registration.kind, "CLI", `${productId} must remain a CLI`);
    assert.equal(
      hasReconcileCapabilities,
      ["npm", "portable-binary", "python-venv", "managed-msi"].includes(driver) ||
        (driver === "wsl-managed" && registration.cli?.repairStrategy === "rebuild-owned-prefix"),
      `${productId} must not advertise update/repair without a fixed idempotent reconcile path`
    );
  }
});

test("binary and Python reconcile stage before replacing an owned CLI directory", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  for (const functionName of [
    "reconcileManagedBinaryCli",
    "reconcileManagedPythonCli"
  ]) {
    const body = source.match(
      new RegExp(`async function ${functionName}[\\s\\S]*?\\n}`)
    )?.[0] || "";
    assert.match(body, /receiptOwnsManagedCliLayout/);
    assert.match(body, /createManagedCliReconcileStagingPrefix/);
    assert.match(body, /replaceManagedCliDirectory/);
    assert.match(body, /openManagedCliTerminal/);
  }
  assert.match(source, /downloadManagedBinaryCli\(sender, productId, plan, stagingLayout\)/);
  assert.match(source, /createPythonPipInstallAction\(\{ productId, plan, prefix: stagingPrefix \}\)/);
});

test("managed MSI reconciliation stays receipt-gated and uses fixed Installer actions", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../electron/main.cjs"), "utf8");
  const body = source.match(/async function deployManagedMsiCli[\s\S]*?\n}\n\nasync function uninstallManagedMsiCli/)?.[0] || "";
  assert.match(body, /matchesManagedMsiReceipt/);
  assert.match(body, /\["\/i", msiPath,/);
  assert.match(body, /\["\/f", plan\.productCode,/);
  assert.match(body, /intent === "install" && msiInstalled/);
});
