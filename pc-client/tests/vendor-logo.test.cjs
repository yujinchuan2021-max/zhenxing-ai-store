"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const catalog = require("../admin/data/catalog-v1.json");
const sources = require("../admin/data/vendor-icon-sources.json");
const {
  verifyVendorIconAssetFile
} = require("../shared/vendor-icon.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");

test("vendor logos fail back to the catalog mark without leaking referrers", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "App.tsx"),
    "utf8"
  );

  assert.match(app, /vendor\.iconUrl && !iconFailed/);
  assert.match(app, /onError=\{\(\) => setIconFailed\(true\)\}/);
  assert.match(app, /referrerPolicy="no-referrer"/);
  assert.match(app, /loading=\{hero \? "eager" : "lazy"\}/);

  const admin = fs.readFileSync(
    path.join(__dirname, "..", "admin", "public", "app.js"),
    "utf8"
  );
  assert.match(admin, /data-action="upload-vendor-icon"/);
  assert.match(admin, /data-action="remove-vendor-icon"/);
  assert.match(admin, /\/api\/vendor-icon/);
  assert.doesNotMatch(admin, /图片图标（HTTPS/);
});

test("published catalog uses reviewed local logo assets with reliable fallbacks", () => {
  assert.doesNotThrow(() => validateCatalog(catalog));
  const withLogo = catalog.vendors.filter((vendor) => vendor.iconAsset);
  assert.ok(withLogo.length / catalog.vendors.length >= 0.95);
  assert.equal(
    catalog.vendors.every((vendor) => !vendor.iconUrl),
    true,
    "remote hotlinked vendor icons are forbidden"
  );
  for (const vendor of withLogo) {
    assert.doesNotThrow(() =>
      verifyVendorIconAssetFile(
        path.join(__dirname, "..", "admin", "data"),
        vendor.iconAsset
      )
    );
    const source = sources.assets[vendor.iconAsset.sha256];
    assert.ok(source, `${vendor.id} logo source missing`);
    assert.match(source.sourceUrl, /^https:\/\//);
    assert.ok(source.vendorIds.includes(vendor.id));
  }
});

test("catalog validation rejects arbitrary remote vendor icon URLs", () => {
  const invalid = structuredClone(catalog);
  invalid.vendors[0].iconUrl = "https://tracker.example/logo.png";
  assert.throws(() => validateCatalog(invalid), /厂商数据无效/);
});
