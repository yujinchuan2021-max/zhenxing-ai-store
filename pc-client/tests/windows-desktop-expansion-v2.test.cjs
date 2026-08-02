const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../admin/data/catalog-v1.json");
const {
  existingProductUpdates,
  existingVendorProducts,
  newVendors
} = require("../catalog/windows-desktop-expansion-v2.cjs");

const catalogProducts = new Map(
  catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, { vendor, product }])
  )
);

test("the second Windows pass records the complete reviewed research batch", () => {
  assert.equal(newVendors.length, 51);
  assert.equal(
    newVendors.reduce((total, vendor) => total + vendor.products.length, 0),
    70
  );
  assert.equal(Object.values(existingVendorProducts).flat().length, 9);
  assert.equal(Object.keys(existingProductUpdates).length, 3);

  for (const definition of newVendors) {
    const vendor = catalog.vendors.find((item) => item.id === definition.id);
    assert.ok(vendor, definition.id);
    assert.match(vendor.initial, /^[A-Z]$/, definition.id);
    for (const expected of definition.products) {
      const located = catalogProducts.get(expected.id);
      assert.equal(located?.vendor.id, definition.id, expected.id);
      assert.equal(located?.product.productType, "desktop-official", expected.id);
    }
  }
});

test("new official desktop entries cannot gain managed execution authority", () => {
  const expansionIds = new Set([
    ...newVendors.flatMap((vendor) => vendor.products.map((product) => product.id)),
    ...Object.values(existingVendorProducts).flatMap((products) =>
      products.map((product) => product.id)
    )
  ]);
  for (const productId of expansionIds) {
    const product = catalogProducts.get(productId)?.product;
    assert.ok(product, productId);
    assert.equal(product.productType, "desktop-official", productId);
    assert.equal(product.moduleId, "desktop-official", productId);
    assert.equal(product.installProfileId, "", productId);
    assert.deepEqual(product.requirements, [], productId);
    assert.deepEqual(product.capabilities, ["website", "tutorial"], productId);
    assert.equal(product.download, undefined, productId);
    assert.equal(
      product.entryPoints.some(
        (entry) => entry.type === "desktop" && Object.hasOwn(entry, "url")
      ),
      false,
      productId
    );
  }
});

test("same visual product merges Web and Windows while CLI remains independent", () => {
  for (const productId of [
    "perplexity-web",
    "poe",
    "manus-desktop",
    "deepl-desktop",
    "notion-desktop",
    "fireflies-desktop"
  ]) {
    const product = catalogProducts.get(productId)?.product;
    assert.ok(product, productId);
    assert.equal(product.entryPoints.some((entry) => entry.type === "desktop"), true);
    assert.equal(product.entryPoints.some((entry) => entry.type === "web"), true);
  }

  assert.equal(catalogProducts.get("nous-hermes-agent")?.product.kind, "CLI");
  assert.equal(catalogProducts.get("nous-hermes-desktop")?.product.kind, "桌面端");
  assert.equal(catalogProducts.get("goose-desktop")?.product.kind, "桌面端");
  assert.equal(catalogProducts.has("goose-cli"), false);
});

test("candidate, unsupported and retired desktop products stay out of the catalog", () => {
  for (const productId of [
    "skales",
    "nextchat",
    "chatall",
    "pearai",
    "nvidia-chatrtx",
    "backyard-ai-desktop",
    "void-editor",
    "openhands-desktop",
    "fellou-desktop",
    "deepseek-desktop",
    "grok-desktop"
  ]) {
    assert.equal(catalogProducts.has(productId), false, productId);
  }
});

test("existing products gain Windows entry points without duplicate product cards", () => {
  assert.equal(
    catalog.vendors
      .find((vendor) => vendor.id === "openwebui")
      .products.filter((product) => product.name === "Open WebUI").length,
    1
  );
  assert.equal(
    catalog.vendors
      .find((vendor) => vendor.id === "perplexity")
      .products.filter((product) => product.name === "Perplexity").length,
    1
  );
  const jianying = catalogProducts.get("jianying").product;
  assert.equal(
    jianying.entryPoints.some(
      (entry) => entry.type === "external" && entry.label === "CapCut 全球版"
    ),
    true
  );
});
