"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  parseVendorIconDataUrl,
  validateVendorIconAsset,
  verifyVendorIconAssetFile
} = require("../shared/vendor-icon.cjs");
const {
  resolveCatalogIconUrls
} = require("../shared/catalog-icon-runtime.cjs");

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00
]);

test("vendor icon assets are content addressed and resolved beside the signed catalog", () => {
  const parsed = parseVendorIconDataUrl(
    `data:image/png;base64,${PNG.toString("base64")}`
  );
  const catalog = resolveCatalogIconUrls(
    { vendors: [{ id: "demo", iconAsset: parsed.asset }] },
    "https://catalog.example/releases/catalog-release.json"
  );
  assert.equal(
    catalog.vendors[0].iconUrl,
    `https://catalog.example/releases/${parsed.asset.path}`
  );
});

test("vendor icon validation rejects traversal, mismatched hashes and tampered files", () => {
  const parsed = parseVendorIconDataUrl(
    `data:image/png;base64,${PNG.toString("base64")}`
  );
  assert.throws(() =>
    validateVendorIconAsset({
      ...parsed.asset,
      path: `vendor-icons/../${parsed.asset.sha256}.png`
    })
  );
  assert.throws(() =>
    validateVendorIconAsset({ ...parsed.asset, sha256: "b".repeat(64) })
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-vendor-icon-"));
  const filePath = path.join(root, ...parsed.asset.path.split("/"));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG);
  assert.equal(verifyVendorIconAssetFile(root, parsed.asset).fileSize, PNG.length);
  fs.appendFileSync(filePath, "tampered");
  assert.throws(() => verifyVendorIconAssetFile(root, parsed.asset), /哈希/);
});

test("vendor icon assets accept a bounded canonical ICO", () => {
  const ico = Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]);
  const parsed = parseVendorIconDataUrl(
    `data:image/x-icon;base64,${ico.toString("base64")}`
  );
  assert.equal(parsed.asset.mimeType, "image/x-icon");
  assert.match(parsed.asset.path, /\.ico$/);
});

test("vendor icon assets accept inert SVG and reject executable or remote SVG", () => {
  const safe = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>');
  const parsed = parseVendorIconDataUrl(
    `data:image/svg+xml;base64,${safe.toString("base64")}`
  );
  assert.equal(parsed.asset.mimeType, "image/svg+xml");
  for (const source of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://tracker.example/a"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'
  ]) {
    assert.throws(() => parseVendorIconDataUrl(
      `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`
    ));
  }
});
