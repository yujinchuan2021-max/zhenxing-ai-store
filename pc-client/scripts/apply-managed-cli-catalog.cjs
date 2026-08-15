"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  INSTALL_MODES,
  INSTALL_REGISTRY
} = require("../shared/install-registry.cjs");
const {
  CLI_REVIEW_BLOCKERS
} = require("../shared/windows-cli-review-decisions.cjs");

const catalogPath = path.join(__dirname, "..", "admin", "data", "catalog-v1.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const managedCli = new Map(
  Object.entries(INSTALL_REGISTRY).filter(
    ([, registration]) => registration.mode === INSTALL_MODES.MANAGED_CLI
  )
);
const seen = new Set();

for (const vendor of catalog.vendors) {
  for (const product of vendor.products) {
    const registration = managedCli.get(product.id);
    if (!registration) continue;
    if (seen.has(product.id)) {
      throw new Error(`Managed CLI product is duplicated: ${product.id}`);
    }
    if (vendor.id !== registration.vendorId) {
      throw new Error(
        `Managed CLI vendor mismatch: ${product.id} belongs to ${registration.vendorId}`
      );
    }
    Object.assign(product, {
      kind: registration.kind,
      moduleId: registration.moduleId,
      installPolicy: "client-managed-cli",
      downloadPolicy: "none",
      signaturePolicy: "not-applicable",
      uninstallPolicy: "client-managed",
      capabilities: [...registration.capabilities],
      productType: registration.productType,
      requirements: [...registration.requirements],
      installProfileId: registration.profileId
    });
    seen.add(product.id);
  }
}

const missing = [...managedCli.keys()].filter((productId) => !seen.has(productId));
if (missing.length) {
  throw new Error(`Managed CLI products missing from catalog: ${missing.join(", ")}`);
}

const blockedSeen = new Set();
for (const vendor of catalog.vendors) {
  for (const product of vendor.products) {
    if (product.productType !== "cli-official" && product.moduleId !== "cli-official") {
      continue;
    }
    if (!CLI_REVIEW_BLOCKERS[product.id]) {
      throw new Error(`CLI product has no managed contract or blocker: ${product.id}`);
    }
    Object.assign(product, {
      moduleId: "cli-official",
      installPolicy: "open-official-install",
      downloadPolicy: "none",
      signaturePolicy: "not-applicable",
      uninstallPolicy: "not-managed",
      capabilities: ["website", "tutorial"],
      productType: "cli-official",
      requirements: [],
      installProfileId: ""
    });
    blockedSeen.add(product.id);
  }
}

const obsoleteBlockers = Object.keys(CLI_REVIEW_BLOCKERS).filter(
  (productId) => !blockedSeen.has(productId)
);
if (obsoleteBlockers.length) {
  throw new Error(`CLI blockers no longer match the catalog: ${obsoleteBlockers.join(", ")}`);
}

catalog.updatedAt = new Date().toISOString();
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(
  `Updated ${seen.size} managed CLI products; retained ${blockedSeen.size} reviewed official-only products.`
);
