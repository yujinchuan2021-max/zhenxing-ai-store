"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const catalog = require("../admin/data/catalog-v1.json");
const {
  materializeLegacyVendorIconUrls
} = require("../shared/catalog-release-icon-compat.cjs");
const {
  resolveCatalogIconUrls
} = require("../shared/catalog-icon-runtime.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");

const LEGACY_VENDOR_FIELDS = new Set([
  "id", "enabled", "order", "name", "initial", "requiresCrossBorderNetwork",
  "mark", "iconUrl", "color", "description", "website", "tutorial", "products"
]);

test("published logos remain compatible with clients predating iconAsset", () => {
  const released = materializeLegacyVendorIconUrls(
    catalog,
    "https://localhost:4443"
  );

  assert.doesNotThrow(() => validateCatalog(released));
  assert.equal(released.vendors.some((vendor) => vendor.iconAsset), false);
  assert.equal(
    released.vendors.every((vendor) =>
      Object.keys(vendor).every((field) => LEGACY_VENDOR_FIELDS.has(field))
    ),
    true
  );
  const openai = released.vendors.find((vendor) => vendor.id === "openai");
  assert.match(
    openai.iconUrl,
    /^https:\/\/localhost:4443\/vendor-icons\/[a-f0-9]{64}\.png$/
  );
});

test("new clients accept only branded or loopback content-addressed logo URLs", () => {
  const released = materializeLegacyVendorIconUrls(
    catalog,
    "https://assets.zhenxingai.com"
  );
  assert.doesNotThrow(() =>
    resolveCatalogIconUrls(released, "https://zhenxingai.com/catalog-release.json")
  );

  const tampered = structuredClone(released);
  tampered.vendors.find((vendor) => vendor.iconUrl).iconUrl =
    "https://tracker.example/vendor-icons/" + "a".repeat(64) + ".png";
  assert.throws(
    () => resolveCatalogIconUrls(tampered, "https://zhenxingai.com/catalog-release.json"),
    /Logo 运行时地址无效/
  );
});
