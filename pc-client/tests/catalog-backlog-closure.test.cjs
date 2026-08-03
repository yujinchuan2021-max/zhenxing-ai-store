"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  applyCatalogBacklogClosure,
  resourceDefinitions,
  vendorDefinitions
} = require("../scripts/apply-catalog-backlog-closure.cjs");

const root = path.join(__dirname, "..");
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, "admin", "data", "catalog-v1.json"), "utf8")
);
const fallbacks = JSON.parse(
  fs.readFileSync(
    path.join(root, "admin", "data", "vendor-icon-fallbacks.json"),
    "utf8"
  )
);

const EXPECTED_VENDOR_IDS = [
  "apify",
  "arcade",
  "browserbase",
  "composio",
  "copilotkit",
  "deepset",
  "firecrawl",
  "gitbook",
  "mem0",
  "neon-database",
  "new-relic",
  "qdrant",
  "sider",
  "tavily",
  "weaviate",
  "zep"
];
const EXPECTED_PRODUCT_IDS = [
  "apify-platform",
  "arcade-agent-tools",
  "browserbase-platform",
  "browserbase-stagehand",
  "composio-agent-tools",
  "copilotkit-agent-ui",
  "firecrawl-platform",
  "gitbook-docs-platform",
  "haystack-agent-framework",
  "mem0-agent-memory",
  "neon-postgres",
  "new-relic-observability",
  "qdrant-vector-database",
  "sider-windows",
  "tavily-search-platform",
  "weaviate-vector-database",
  "zep-agent-memory"
];
const EXPECTED_RESOURCE_IDS = [
  "apify-mcp",
  "arcade-mcp-gateway",
  "browserbase-mcp",
  "composio-mcp",
  "firecrawl-mcp",
  "gitbook-published-docs-mcp",
  "mem0-mcp",
  "neon-mcp",
  "new-relic-mcp",
  "pinecone-mcp",
  "qdrant-mcp",
  "tavily-mcp",
  "weaviate-mcp",
  "zep-docs-mcp"
];

test("backlog closure is the fixed 16-vendor, 17-product, 14-resource batch", () => {
  assert.equal(vendorDefinitions.length, 16);
  assert.equal(
    vendorDefinitions.flatMap((vendor) => vendor.products).length,
    17
  );
  assert.equal(resourceDefinitions.length, 14);
  assert.deepEqual(
    vendorDefinitions.map((vendor) => vendor.id).sort(),
    EXPECTED_VENDOR_IDS
  );
  assert.deepEqual(
    vendorDefinitions
      .flatMap((vendor) => vendor.products.map((product) => product.id))
      .sort(),
    EXPECTED_PRODUCT_IDS
  );
  assert.deepEqual(
    resourceDefinitions.map((resource) => resource.id).sort(),
    EXPECTED_RESOURCE_IDS
  );
});

test("the fixed batch applies idempotently and validates without catalog counts", () => {
  const nextCatalog = structuredClone(catalog);
  const nextFallbacks = structuredClone(fallbacks);
  applyCatalogBacklogClosure(nextCatalog, nextFallbacks);
  assert.doesNotThrow(() => validateCatalog(nextCatalog));
  const once = JSON.stringify({ nextCatalog, nextFallbacks });
  applyCatalogBacklogClosure(nextCatalog, nextFallbacks);
  assert.equal(JSON.stringify({ nextCatalog, nextFallbacks }), once);

  for (const definition of vendorDefinitions) {
    const vendor = nextCatalog.vendors.find((item) => item.id === definition.id);
    assert.ok(vendor, definition.id);
    if (!vendor.iconAsset) assert.ok(nextFallbacks.vendors[definition.id]);
  }
});

test("graphical products and resources remain link-only catalog data", () => {
  const products = vendorDefinitions.flatMap((vendor) => vendor.products);
  assert.deepEqual(
    products.filter((product) => product.productType === "desktop-official").map((product) => product.id),
    ["sider-windows"]
  );
  assert.equal(
    products.find((product) => product.id === "sider-windows").website,
    "https://sider.ai/apps/windows"
  );
  for (const product of products) {
    assert.equal(product.installProfileId, "", product.id);
    assert.equal(Object.hasOwn(product, "download"), false, product.id);
    assert.equal("command" in product || "args" in product, false, product.id);
    assert.ok(["web-link", "tutorial-link", "desktop-official"].includes(product.moduleId));
    for (const entry of product.entryPoints || []) {
      assert.equal("command" in entry || "args" in entry || "path" in entry, false, product.id);
      if (entry.url) assert.match(entry.url, /^https:\/\//, product.id);
    }
  }

  for (const resource of resourceDefinitions) {
    assert.equal("command" in resource || "args" in resource || "download" in resource, false, resource.id);
    assert.equal(resource.targets.length > 0, true, resource.id);
    for (const target of resource.targets) {
      assert.deepEqual(
        {
          moduleId: target.moduleId,
          installProfileId: target.installProfileId,
          capabilities: target.capabilities
        },
        {
          moduleId: "resource-link",
          installProfileId: "",
          capabilities: ["website"]
        },
        resource.id
      );
      assert.equal("command" in target || "args" in target || "url" in target, false, resource.id);
    }
  }
});
