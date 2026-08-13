"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createVendorIconStore } = require("../admin/vendor-icon-store.cjs");

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00
]);

test("admin stores vendor logos by hash and records their official source", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-logo-store-"));
  const store = createVendorIconStore({
    rootDirectory: root,
    manifestPath: path.join(root, "vendor-icon-sources.json"),
    clock: class extends Date {
      constructor() { super("2026-08-02T00:00:00.000Z"); }
    }
  });
  const asset = store.save({
    vendorId: "vendor-one",
    dataUrl: `data:image/png;base64,${PNG.toString("base64")}`,
    sourceUrl: "https://vendor.example/brand"
  });
  assert.equal(store.verifyCatalog({ vendors: [{ iconAsset: asset }] }), 1);
  assert.equal(fs.existsSync(path.join(root, ...asset.path.split("/"))), true);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "vendor-icon-sources.json"), "utf8")
  );
  assert.deepEqual(manifest.assets[asset.sha256].vendorIds, ["vendor-one"]);
  assert.equal(
    manifest.assets[asset.sha256].sourceUrl,
    "https://vendor.example/brand"
  );
  assert.throws(() =>
    store.save({
      vendorId: "vendor-one",
      dataUrl: `data:image/png;base64,${PNG.toString("base64")}`,
      sourceUrl: "http://vendor.example/logo"
    })
  );
});
