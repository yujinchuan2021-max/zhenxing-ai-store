"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { validateCatalog } = require("../shared/catalog.cjs");
const {
  projectVendorsByDirectory
} = require("../shared/catalog-projections.cjs");

const vendorIds = [
  "figma", "notion", "atlassian", "github", "google", "docker", "cloudflare",
  "linear", "sentry", "stripe", "supabase", "vercel", "slack",
  "jetbrains", "canva", "postman", "asana", "hubspot"
];
const productIds = [
  "figma-design", "notion-workspace", "atlassian-jira",
  "atlassian-confluence", "atlassian-bitbucket", "github-platform",
  "docker-desktop", "cloudflare-platform", "linear-workspace",
  "sentry-platform", "stripe-platform", "supabase-projects",
  "vercel-projects", "slack-workspace", "jetbrains-intellij-idea",
  "canva-design", "postman-api-platform", "google-chrome-devtools",
  "asana-work-graph", "hubspot-crm"
];
const resourceIds = [
  "figma-mcp-server", "notion-mcp", "atlassian-rovo-mcp-server",
  "github-copilot-mcp", "google-chrome-devtools-mcp", "docker-mcp-toolkit",
  "cloudflare-api-mcp-server",
  "linear-mcp-server", "sentry-mcp", "stripe-mcp-server",
  "supabase-mcp-server", "vercel-mcp", "slack-mcp-server",
  "jetbrains-idea-mcp-server", "canva-mcp", "postman-mcp-server",
  "asana-mcp-server-v2", "hubspot-mcp-server"
];

function readCatalog(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8")
  );
}

test("first official AI-connectable expansion keeps vendors singular and directories isolated", () => {
  const catalog = readCatalog("admin/data/catalog-v1.json");
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.equal(new Set(catalog.vendors.map((vendor) => vendor.id)).size, catalog.vendors.length);

  const vendorById = new Map(catalog.vendors.map((vendor) => [vendor.id, vendor]));
  const productById = new Map(
    catalog.vendors.flatMap((vendor) =>
      vendor.products.map((product) => [product.id, product])
    )
  );
  for (const id of vendorIds) {
    const vendor = vendorById.get(id);
    assert.ok(vendor, `missing vendor ${id}`);
    assert.equal(new URL(vendor.website).protocol, "https:");
    assert.equal(new URL(vendor.tutorial).protocol, "https:");
  }
  for (const id of productIds) {
    const product = productById.get(id);
    assert.ok(product, `missing product ${id}`);
    assert.equal(product.directoryKind, "ai-connectable");
    assert.doesNotMatch(`${product.id} ${product.name}`, /\bmcp\b/i);
    assert.equal(new URL(product.website).protocol, "https:");
    assert.equal(new URL(product.tutorial).protocol, "https:");
  }

  assert.equal(productById.get("notion-desktop").directoryKind, "ai-tool");
  assert.equal(productById.get("github-copilot").directoryKind, "ai-tool");
  assert.equal(productById.get("canva-windows").directoryKind, "ai-tool");
  assert.deepEqual(
    vendorById.get("atlassian").products.map((product) => product.id),
    ["atlassian-jira", "atlassian-confluence", "atlassian-bitbucket"]
  );
  assert.deepEqual(
    vendorById.get("jetbrains").products.map((product) => product.id),
    ["jetbrains-intellij-idea"]
  );

  const docker = productById.get("docker-desktop");
  assert.equal(docker.productType, "desktop-official");
  assert.equal(docker.moduleId, "desktop-official");
  assert.equal(docker.downloadPolicy, "official-page");
  assert.equal("download" in docker, false);

  const aiIds = new Set(
    projectVendorsByDirectory(catalog.vendors, "ai-tool")
      .flatMap((vendor) => vendor.products.map((product) => product.id))
  );
  const connectableIds = new Set(
    projectVendorsByDirectory(catalog.vendors, "ai-connectable")
      .flatMap((vendor) => vendor.products.map((product) => product.id))
  );
  for (const id of productIds) {
    assert.equal(aiIds.has(id), false, `${id} leaked into AI tools`);
    assert.equal(connectableIds.has(id), true, `${id} missing from connectable directory`);
  }
});

test("18 reviewed resources stay link-only and retain security metadata", () => {
  const catalog = readCatalog("admin/data/catalog-v1.json");
  const resources = new Map(catalog.resources.map((resource) => [resource.id, resource]));
  const productById = new Map(
    catalog.vendors.flatMap((vendor) =>
      vendor.products.map((product) => [product.id, product])
    )
  );

  for (const id of resourceIds) {
    const resource = resources.get(id);
    assert.ok(resource, `missing resource ${id}`);
    assert.deepEqual(resource.resourceTypes, ["mcp"]);
    assert.ok(resource.sourceProductIds.length > 0);
    assert.ok(resource.targets.length > 0);
    assert.ok(resource.credentialRequirements.length > 0);
    assert.ok(resource.requestedPermissions.length > 0);
    assert.ok(resource.uninstallPlan.length > 0);
    assert.equal(new URL(resource.website).protocol, "https:");
    assert.equal(new URL(resource.tutorial).protocol, "https:");
    for (const sourceProductId of resource.sourceProductIds) {
      assert.equal(productById.get(sourceProductId)?.directoryKind, "ai-connectable");
    }
    for (const target of resource.targets) {
      assert.equal(target.moduleId, "resource-link");
      assert.equal(target.installProfileId, "");
      assert.deepEqual(target.capabilities, ["website"]);
      assert.ok(["official", "protocol-compatible"].includes(target.compatibility));
    }
  }
  assert.equal(resources.has("github-mcp-server"), false);

  for (const resourceId of ["microsoft-playwright-mcp", "microsoft-azure-mcp"]) {
    const resource = resources.get(resourceId);
    assert.ok(resource.targets.length > 1, `${resourceId} has no real AI-tool targets`);
    assert.equal(
      resource.targets.some((target) =>
        ["microsoft-agent-framework", "microsoft-foundry"].includes(target.productId)
      ),
      false,
      `${resourceId} still points at a source platform instead of an AI client`
    );
    assert.ok(resource.requestedPermissions.length > 0);
    assert.ok(resource.credentialRequirements.length > 0);
  }
});

test("the compact example catalog receives the same source products and remains valid", () => {
  const catalog = readCatalog("catalog/catalog-v1.example.json");
  assert.doesNotThrow(() => validateCatalog(catalog));
  const products = new Set(
    catalog.vendors.flatMap((vendor) => vendor.products.map((product) => product.id))
  );
  for (const id of productIds) assert.ok(products.has(id), `missing example product ${id}`);
  for (const resource of catalog.resources) {
    for (const target of resource.targets) assert.equal(target.moduleId, "resource-link");
  }
});
