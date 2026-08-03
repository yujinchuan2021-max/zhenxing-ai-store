"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../admin/data/catalog-v1.json");

const REVIEWED_PRODUCTS = Object.freeze([
  "servicenow-build-agent",
  "servicenow-ai-agents",
  "databricks-lakebase",
  "databricks-agent-bricks",
  "tabnine-cli",
  "cloudflare-agents",
  "confluent-streaming-agents",
  "factory-droids",
  "grafana-agent-observability",
  "hubspot-customer-agent",
  "hubspot-prospecting-agent",
  "hubspot-data-agent",
  "neo4j-aura-agent",
  "sentry-seer-agent",
  "uipath-agent-builder",
  "zoom-virtual-agent",
  "asana-ai-teammates",
  "cisco-webex-ai-agent",
  "airtable-platform",
  "autodesk-flow-studio",
  "lovable-ai-app-builder",
  "deepgram-cli",
  "shopify-commerce-for-agents"
]);

function allProducts() {
  return catalog.vendors.flatMap((vendor) => vendor.products);
}

test("reviewed discovery products exist once and stay on fixed modules", () => {
  const products = allProducts();
  for (const productId of REVIEWED_PRODUCTS) {
    const matches = products.filter((product) => product.id === productId);
    assert.equal(matches.length, 1, productId);
    assert.equal(matches[0].installProfileId, "", productId);
    assert.equal(Object.hasOwn(matches[0], "download"), false, productId);
  }
});

test("Web and Windows surfaces share one product card while CLIs stay separate", () => {
  const byId = new Map(allProducts().map((product) => [product.id, product]));

  for (const productId of [
    "factory-droids",
    "airtable-platform",
    "lovable-ai-app-builder"
  ]) {
    const product = byId.get(productId);
    assert.equal(product.productType, "desktop-official", productId);
    assert.equal(product.moduleId, "desktop-official", productId);
    assert.deepEqual(
      product.entryPoints.map((entry) => entry.type),
      ["website", "web", "desktop", "tutorial"],
      productId
    );
  }

  for (const productId of ["tabnine-cli", "deepgram-cli", "factory-cli"]) {
    const product = byId.get(productId);
    assert.equal(product.kind, "CLI", productId);
    assert.equal(product.productType, "cli-official", productId);
    assert.equal(
      product.entryPoints?.some((entry) => entry.type === "desktop") || false,
      false,
      productId
    );
    assert.match(product.description, /命令行|终端/, productId);
  }
});

test("reviewed products keep their intended directory split", () => {
  const byId = new Map(allProducts().map((product) => [product.id, product]));
  for (const productId of [
    "databricks-lakebase",
    "grafana-agent-observability",
    "airtable-platform",
    "shopify-commerce-for-agents"
  ]) {
    assert.equal(byId.get(productId).directoryKind, "ai-connectable", productId);
  }
  for (const productId of REVIEWED_PRODUCTS.filter(
    (id) => ![
      "databricks-lakebase",
      "grafana-agent-observability",
      "airtable-platform",
      "shopify-commerce-for-agents"
    ].includes(id)
  )) {
    assert.equal(byId.get(productId).directoryKind, "ai-tool", productId);
  }
});
