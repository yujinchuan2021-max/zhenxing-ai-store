"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const catalog = require("../admin/data/catalog-v1.json");
const {
  buildProductDirectory,
  validateProductComponentLinks
} = require("../shared/product-components.cjs");

test("keeps the OpenClaw WSL CLI as an independent top-level product", () => {
  const vendor = catalog.vendors.find((candidate) => candidate.id === "openclaw");
  const directory = buildProductDirectory(vendor.products);
  const windowsHub = directory.roots.find(
    (product) => product.id === "openclaw-windows-hub"
  );

  assert.ok(windowsHub);
  assert.deepEqual(
    directory.childrenByProductId[windowsHub.id].map((product) => product.id),
    []
  );
  assert.equal(
    directory.roots.some((product) => product.id === "openclaw-wsl-gateway"),
    true
  );
});

test("rejects missing, duplicate, cross-vendor, and cyclic component links", () => {
  const vendors = [
    {
      id: "one",
      products: [
        { id: "parent", componentProductIds: ["child", "child"] },
        { id: "child", componentProductIds: ["parent"] }
      ]
    },
    { id: "two", products: [{ id: "foreign" }] }
  ];

  assert.match(validateProductComponentLinks(vendors), /duplicate/i);
  vendors[0].products[0].componentProductIds = ["missing"];
  assert.match(validateProductComponentLinks(vendors), /missing/i);
  vendors[0].products[0].componentProductIds = ["foreign"];
  assert.match(validateProductComponentLinks(vendors), /same vendor/i);
  vendors[0].products[0].componentProductIds = ["child"];
  assert.match(validateProductComponentLinks(vendors), /cycle/i);
  vendors[0].products[0].componentProductIds = ["cli"];
  vendors[0].products.push({ id: "cli", kind: "CLI" });
  assert.match(validateProductComponentLinks(vendors), /top-level/i);
});
