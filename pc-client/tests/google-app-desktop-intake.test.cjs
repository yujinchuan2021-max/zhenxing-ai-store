"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  SIGNED_CATALOG_MODULE_ID,
  SIGNED_CATALOG_PROFILE_ID,
  validateSignedDesktopDownloadArtifact
} = require("../shared/desktop-download-only.cjs");
const {
  evaluateFreshDesktopDownloadOnlyAuthorization
} = require("../shared/managed-catalog-install-authorization.cjs");
const { resolveProductBehavior } = require("../shared/product-policy.cjs");

const candidate = require("../docs/research/google-app-desktop-catalog-intake-candidate-2026-08-06.json");
const active6Catalog = require("../admin/published/catalog-store/releases/catalog-v00000006-567e671621f1-3dcee587.json").payload.catalog;

function containsForbiddenField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenField);
  return Object.entries(value).some(([key, nested]) =>
    candidate.contract.forbiddenFields.includes(key) || containsForbiddenField(nested)
  );
}

test("Google app desktop intake stays within the existing canonical signed-download contract", () => {
  const product = candidate.proposedProduct;
  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.expectedSource.v2ActiveCatalogVersion, 6);
  assert.equal(
    candidate.expectedSource.v2ActiveReleaseId,
    "catalog-v00000006-567e671621f1-3dcee587"
  );
  assert.equal(product.moduleId, SIGNED_CATALOG_MODULE_ID);
  assert.equal(product.installProfileId, SIGNED_CATALOG_PROFILE_ID);
  assert.equal(product.productType, "desktop-download-only");
  assert.equal(validateSignedDesktopDownloadArtifact(product.download).ok, true);
  assert.equal(new URL(product.download.url).hostname, candidate.evidence.officialHost);
  assert.equal(product.download.fileName, "GoogleAppInstaller.exe");
  assert.equal(product.download.artifactKind, "exe");
  assert.equal(containsForbiddenField(candidate), false);
  assert.equal(resolveProductBehavior(product).managedDownload, true);
  assert.equal(resolveProductBehavior(product).canOpenInstalled, false);
  assert.equal(resolveProductBehavior(product).canUninstall, false);

  const catalog = JSON.parse(JSON.stringify(active6Catalog));
  const vendor = catalog.vendors.find((item) => item.id === candidate.vendorId);
  assert.ok(vendor);
  assert.equal(vendor.products.some((item) => item.id === candidate.productId), false);
  vendor.products.push(product);
  assert.doesNotThrow(() => validateCatalog(catalog));

  const authorization = evaluateFreshDesktopDownloadOnlyAuthorization({
    catalogResult: { source: "remote", catalogVersion: 6, catalog },
    productId: product.id,
    artifact: product.download
  });
  assert.equal(authorization.ok, true);
  assert.deepEqual(authorization.plan.allowedHosts, [candidate.evidence.officialHost]);
  assert.equal(authorization.plan.installerKind, "vendor-installer");
});
