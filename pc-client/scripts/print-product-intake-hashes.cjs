"use strict";

const {
  INSTALL_MODES,
  INSTALL_REGISTRY
} = require("../shared/install-registry.cjs");
const {
  executionContractSha256
} = require("../shared/product-intake-dossier.cjs");

const productIds = process.argv.slice(2);
if (!productIds.length) throw new Error("At least one product ID is required.");

for (const productId of productIds) {
  const registration = INSTALL_REGISTRY[productId];
  if (!registration || registration.mode !== INSTALL_MODES.MANAGED_CLI) {
    throw new Error(`Managed CLI registration not found: ${productId}`);
  }
  console.log(
    `${productId} ${executionContractSha256(productId, registration, null)}`
  );
}
