"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  entryPointTypeMetadata
} = require("../shared/product-entry-points.cjs");

test("the backend exposes only fixed product entry primitives", () => {
  assert.deepEqual(
    entryPointTypeMetadata().map((entry) => [entry.type, entry.kind]),
    [
      ["website", "link"],
      ["web", "link"],
      ["desktop", "product-action"],
      ["cli", "product-action"],
      ["tutorial", "link"],
      ["external", "link"]
    ]
  );
});

test("the admin editor can add, remove, and reorder product entries", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../admin/public/app.js"),
    "utf8"
  );
  for (const action of [
    "add-product-entry",
    "delete-product-entry",
    "move-product-entry"
  ]) {
    assert.match(source, new RegExp(action));
  }
  assert.match(source, /data-product-entry-field/);
  assert.match(source, /不能填写命令、参数或本地路径/);
});

test("the server returns entry metadata without adding an execution endpoint", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../admin/server.cjs"),
    "utf8"
  );
  assert.match(source, /entryPointTypes: entryPointTypeMetadata\(\)/);
  assert.doesNotMatch(source, /api\/product-entry.*(?:execute|run|command)/i);
});

test("the vendor network notice switch stays inside the vendor editor", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../admin/public/app.js"),
    "utf8"
  );
  const homeEditor = source.slice(
    source.indexOf("function renderHome()"),
    source.indexOf("function renderVendors()")
  );
  const vendorEditor = source.slice(
    source.indexOf("function renderVendors()"),
    source.indexOf("function allProducts()")
  );
  assert.doesNotMatch(homeEditor, /data-vendor-requires-cross-border-network/);
  assert.match(vendorEditor, /data-vendor-requires-cross-border-network/);
  assert.match(source, /vendorRequiresCrossBorderNetwork/);
});
