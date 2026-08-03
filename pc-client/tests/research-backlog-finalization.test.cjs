"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../admin/data/catalog-v1.json");
const fallbacks = require("../admin/data/vendor-icon-fallbacks.json");
const {
  applyFinalization,
  existingVendorProducts,
  resourceDefinitions,
  vendorDefinitions
} = require("../scripts/apply-research-backlog-finalization.cjs");

const PRODUCT_IDS = Object.freeze([
  "skales-desktop",
  "pixverse-cli",
  "onshape-ai-advisor",
  "allplan",
  "ptc-creo",
  "biorender-ai",
  "benchling-ai",
  "anytype-desktop",
  "anytype-cli",
  "paintshop-pro",
  "databricks-apps",
  "laiye-adp",
  "laiye-rpa",
  "neo4j-enterprise-studio",
  "open-interpreter-desktop",
  "qlik-discovery-agent",
  "siemens-eigen-engineering-agent",
  "thoughtspot-analyst-studio",
  "uipath-studio"
]);

function allProducts(source = catalog) {
  return source.vendors.flatMap((vendor) => vendor.products);
}

test("the final research closure is exactly 19 products and three link-only MCP resources", () => {
  assert.equal(vendorDefinitions.length, 6);
  assert.equal(
    vendorDefinitions.flatMap((vendor) => vendor.products).length,
    8
  );
  assert.equal(
    existingVendorProducts.flatMap((vendor) => vendor.products).length,
    11
  );
  assert.equal(resourceDefinitions.length, 3);

  const products = allProducts();
  for (const productId of PRODUCT_IDS) {
    const matches = products.filter((product) => product.id === productId);
    assert.equal(matches.length, 1, productId);
    assert.equal(matches[0].installProfileId, "", productId);
    assert.equal("download" in matches[0], false, productId);
  }
  for (const resource of resourceDefinitions) {
    assert.equal(
      resource.targets.every(
        (target) =>
          target.moduleId === "resource-link" &&
          target.installProfileId === "" &&
          JSON.stringify(target.capabilities) === JSON.stringify(["website"])
      ),
      true,
      resource.id
    );
    assert.equal(
      "command" in resource || "args" in resource || "download" in resource,
      false,
      resource.id
    );
  }
});

test("finalization is idempotent and preserves reviewed fallback behavior", () => {
  const nextCatalog = structuredClone(catalog);
  const nextFallbacks = structuredClone(fallbacks);
  applyFinalization(nextCatalog, nextFallbacks);
  const once = JSON.stringify({ nextCatalog, nextFallbacks });
  applyFinalization(nextCatalog, nextFallbacks);
  assert.equal(JSON.stringify({ nextCatalog, nextFallbacks }), once);

  for (const definition of vendorDefinitions) {
    const vendor = nextCatalog.vendors.find((entry) => entry.id === definition.id);
    assert.ok(vendor, definition.id);
    if (!vendor.iconAsset) assert.ok(nextFallbacks.vendors[definition.id]);
  }
});

test("Adobe and Superhuman Docs update existing identities instead of duplicating cards", () => {
  const products = allProducts();
  const adobe = products.filter((product) => product.id === "adobe-creative-cloud");
  assert.equal(adobe.length, 1);
  assert.equal(adobe[0].website, "https://www.adobe.com/download/creative-cloud");
  assert.deepEqual(
    adobe[0].entryPoints.map((entry) => entry.type),
    ["website", "desktop", "tutorial"]
  );

  const docsVendor = catalog.vendors.filter((vendor) => vendor.id === "coda");
  assert.equal(docsVendor.length, 1);
  assert.equal(docsVendor[0].name, "Superhuman Docs");
  assert.equal(docsVendor[0].products.length, 1);
  assert.match(docsVendor[0].products[0].name, /Superhuman Docs AI/);
  assert.match(docsVendor[0].products[0].name, /Coda AI/);
  assert.equal(
    docsVendor[0].products[0].entryPoints.some(
      (entry) => entry.type === "desktop"
    ),
    false
  );
});

test("Superhuman Go remains out while official Windows status conflicts", () => {
  assert.equal(allProducts().some((product) => product.id === "superhuman-go"), false);
});

test("new CLIs are separate command-line products, not desktop buttons", () => {
  const byId = new Map(allProducts().map((product) => [product.id, product]));
  for (const productId of ["pixverse-cli", "anytype-cli"]) {
    const product = byId.get(productId);
    assert.equal(product.kind, "CLI", productId);
    assert.equal(product.productType, "cli-official", productId);
    assert.match(product.description, /命令行/, productId);
    assert.equal(
      product.entryPoints.some((entry) => entry.type === "desktop"),
      false,
      productId
    );
  }
});
