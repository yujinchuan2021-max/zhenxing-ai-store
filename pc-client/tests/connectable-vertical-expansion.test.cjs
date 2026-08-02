"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");

const productIds = ["blender", "godot-engine", "unreal-engine", "ableton-live",
  "obs-studio", "n8n-platform", "uipath-platform", "home-assistant",
  "adobe-creative-cloud", "autodesk-fusion", "sketchup", "davinci-resolve", "affinity"];
const resourceIds = ["blender-mcp", "godot-mcp", "unreal-mcp",
  "ableton-mcp-extended", "obs-mcp", "n8n-mcp-server", "uipath-mcp-server",
  "home-assistant-mcp-server", "adobe-for-creativity", "autodesk-fusion-mcp",
  "sketchup-claude-connector", "davinci-resolve-mcp", "affinity-ai-connector"];

productIds.push("zapier-platform", "monday-work-management", "mongodb-platform",
  "grafana-platform", "datadog-platform", "elastic-platform");
resourceIds.push("zapier-mcp", "monday-platform-mcp", "mongodb-mcp-server",
  "grafana-mcp", "datadog-mcp-server", "elastic-agent-builder-mcp");
productIds.push("roblox-studio", "penpot-platform", "webflow-platform",
  "miro-workspace", "matlab", "simulink", "nvidia-omniverse");
resourceIds.push("roblox-studio-mcp-server", "penpot-mcp-server",
  "webflow-mcp-server", "miro-mcp-server", "matlab-mcp-core-server",
  "matlab-agentic-toolkit", "simulink-agentic-toolkit",
  "nvidia-omniverse-mcp", "nvidia-omniverse-agent-skills");

const batch3VendorIds = ["gitlab", "salesforce", "servicenow", "hashicorp",
  "pulumi", "browserstack", "circleci", "clickup", "box", "pipedream",
  "make", "zoom", "shopify"];
const batch3ProductIds = ["gitlab-platform", "salesforce-platform",
  "servicenow-platform", "azure-devops", "terraform-platform", "pulumi-cloud",
  "browserstack-test-platform", "circleci-platform", "clickup-workspace",
  "box-content-cloud", "pipedream-platform", "make-platform",
  "google-workspace", "zoom-workplace", "shopify-storefront"];
const batch3ResourceIds = ["gitlab-mcp-server", "salesforce-hosted-mcp-servers",
  "servicenow-mcp-server", "microsoft-azure-devops-mcp",
  "terraform-mcp-server", "pulumi-mcp-server", "browserstack-mcp-server",
  "circleci-mcp", "clickup-mcp-server", "box-mcp-server", "pipedream-mcp",
  "make-mcp-server", "google-gmail-mcp", "google-drive-mcp",
  "google-docs-mcp", "google-sheets-mcp", "google-slides-mcp",
  "google-calendar-mcp", "google-chat-mcp", "google-people-mcp",
  "zoom-mcp-server", "shopify-storefront-mcp"];

const industryVendorIds = ["wolfram-research", "ansys", "cesium", "siemens",
  "esri", "synopsys"];
const industryProductIds = ["wolfram-mathematica", "wolfram-cloud",
  "ansys-lumerical", "cesiumjs", "siemens-xcelerator-developer-portal",
  "arcgis-location-platform", "synopsys-verdi"];
const industryResourceIds = ["wolfram-local-mcp", "wolfram-cloud-mcp",
  "ansys-pylumerical-mcp", "cesium-ai-integrations-mcp",
  "cesium-agent-skills", "siemens-xcelerator-developer-portal-mcp",
  "esri-arcgis-location-platform-mcp", "synopsys-verdi-assistant-mcp"];

const batch4VendorIds = ["databricks", "snowflake", "redis", "neo4j",
  "confluent", "paypal", "wix", "automattic", "semrush", "intercom"];
const batch4ProductIds = ["azure-cloud-platform", "aws-cloud-platform",
  "databricks-data-intelligence-platform", "snowflake-ai-data-cloud",
  "redis-database", "neo4j-graph-database", "confluent-cloud",
  "paypal-commerce-platform", "wix-platform", "wordpress-com",
  "semrush-platform", "intercom-platform", "intercom-fin"];
const batch4UpdatedResourceIds = ["microsoft-azure-mcp", "aws-mcp-servers"];
const batch4NewResourceIds = ["databricks-managed-mcp-directory",
  "snowflake-managed-mcp",
  "redis-mcp-server", "neo4j-mcp-server", "confluent-cloud-global-mcp",
  "confluent-cloud-regional-mcp", "paypal-mcp-server", "wix-mcp",
  "wordpress-com-mcp", "semrush-mcp", "intercom-mcp-server",
  "intercom-fin-agent-api-mcp"];
const batch4ResourceIds = [...batch4UpdatedResourceIds, ...batch4NewResourceIds];

productIds.push(...batch3ProductIds, ...industryProductIds, ...batch4ProductIds);
resourceIds.push(...batch3ResourceIds, ...industryResourceIds, ...batch4ResourceIds);

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", relative), "utf8"));
}

test("vertical AI-connectable expansion is categorized and remains link-only", () => {
  const catalog = read("admin/data/catalog-v1.json");
  assert.doesNotThrow(() => validateCatalog(catalog));
  const vendors = new Map(catalog.vendors.map((vendor) => [vendor.id, vendor]));
  const products = new Map(catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, product])));
  const resources = new Map(catalog.resources.map((resource) => [resource.id, resource]));
  for (const id of batch3VendorIds) assert.ok(vendors.has(id), `missing vendor ${id}`);
  for (const id of industryVendorIds) assert.ok(vendors.has(id), `missing vendor ${id}`);
  for (const id of batch4VendorIds) assert.ok(vendors.has(id), `missing vendor ${id}`);
  assert.equal(catalog.vendors.filter((vendor) => vendor.id === "microsoft").length, 1);
  assert.equal(catalog.vendors.filter((vendor) => vendor.id === "google").length, 1);
  assert.equal(catalog.vendors.filter((vendor) => vendor.id === "amazon").length, 1);
  for (const id of productIds) {
    assert.equal(products.get(id)?.directoryKind, "ai-connectable", `missing ${id}`);
    assert.notEqual(products.get(id)?.category, "AI 接入");
  }
  for (const id of resourceIds) {
    const resource = resources.get(id);
    assert.ok(resource, `missing ${id}`);
    assert.ok(["official", "reviewed-community", "community"].includes(resource.sourceKind));
    for (const item of resource.targets) {
      assert.equal(products.get(item.productId)?.directoryKind, "ai-tool",
        `non-AI target ${id}/${item.productId}`);
      assert.equal(item.moduleId, "resource-link");
      assert.deepEqual(item.capabilities, ["website"]);
      assert.equal(item.installProfileId, "");
    }
  }
  for (const id of batch3ResourceIds) {
    assert.equal(resources.get(id)?.sourceKind, "official", `non-official ${id}`);
    assert.deepEqual(resources.get(id)?.resourceTypes, ["mcp"], `non-MCP ${id}`);
  }
  for (const id of industryResourceIds) {
    assert.equal(resources.get(id)?.sourceKind, "official", `non-official ${id}`);
    assert.deepEqual(resources.get(id)?.resourceTypes,
      [id === "cesium-agent-skills" ? "skill" : "mcp"], `wrong type ${id}`);
  }
  for (const id of batch4ResourceIds) {
    assert.equal(resources.get(id)?.sourceKind, "official", `non-official ${id}`);
    assert.deepEqual(resources.get(id)?.resourceTypes, ["mcp"], `wrong type ${id}`);
  }
  assert.deepEqual(resources.get("microsoft-azure-mcp")?.sourceProductIds,
    ["azure-cloud-platform"]);
  assert.deepEqual(resources.get("aws-mcp-servers")?.sourceProductIds,
    ["aws-cloud-platform"]);
  assert.equal(resources.get("confluent-cloud-global-mcp")?.sourceProductIds[0],
    "confluent-cloud");
  assert.equal(resources.get("confluent-cloud-regional-mcp")?.sourceProductIds[0],
    "confluent-cloud");
  assert.equal(resources.get("confluent-cloud-global-mcp")?.targets.find(
    (entry) => entry.productId === "claude-desktop")?.compatibility,
    "protocol-compatible");
  assert.equal(resources.get("intercom-mcp-server")?.sourceProductIds[0],
    "intercom-platform");
  assert.equal(resources.get("intercom-fin-agent-api-mcp")?.sourceProductIds[0],
    "intercom-fin");
  assert.equal(resources.get("semrush-mcp")?.targets.some(
    (entry) => entry.productId === "gemini-cli"), false);
  const googleResources = batch3ResourceIds.filter((id) => id.startsWith("google-"));
  assert.equal(googleResources.length, 8);
  assert.equal(new Set(googleResources.map((id) => resources.get(id)?.website)).size, 1);
  for (const id of googleResources) {
    assert.deepEqual(resources.get(id)?.sourceProductIds, ["google-workspace"]);
  }
  assert.ok(catalog.resourceStores.some((store) => store.id === "connector"));
  assert.equal(products.get("obs-studio").category, "直播与录制");
  assert.equal(products.get("autodesk-fusion").category, "3D 创作");
  assert.equal(products.get("ableton-live").category, "音频制作");
  assert.equal(products.get("mongodb-platform").category, "数据库与数据");
  assert.equal(products.get("grafana-platform").category, "可观测性");
  assert.equal(products.get("matlab").category, "工程计算与仿真");
  assert.equal(products.get("nvidia-omniverse").category, "3D 与工业仿真");
  assert.equal(products.get("wolfram-mathematica").category, "工程计算与仿真");
  assert.equal(products.get("cesiumjs").category, "地图与地理空间");
  assert.equal(products.get("arcgis-location-platform").category, "地图与地理空间");
  assert.equal(products.get("databricks-data-intelligence-platform").category,
    "数据库与数据");
  assert.equal(products.get("wix-platform").category, "网站与建站");
  assert.equal(products.get("wordpress-com").category, "内容管理与发布");
  assert.equal(products.get("semrush-platform").category, "营销与搜索");
  assert.equal(products.get("intercom-fin").category, "客户服务");
});

test("compact example receives all source products and remains valid", () => {
  const catalog = read("catalog/catalog-v1.example.json");
  assert.doesNotThrow(() => validateCatalog(catalog));
  const products = new Map(catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, product])));
  const ids = new Set(products.keys());
  for (const id of productIds) assert.ok(ids.has(id), `missing example ${id}`);
  const resources = new Map(catalog.resources.map((resource) => [resource.id, resource]));
  for (const id of [...batch3ResourceIds, ...industryResourceIds, ...batch4NewResourceIds]) {
    assert.ok(resources.has(id), `missing example resource ${id}`);
    assert.ok(resources.get(id).targets.length > 0, `targetless example resource ${id}`);
    for (const target of resources.get(id).targets) {
      assert.equal(products.get(target.productId)?.directoryKind, "ai-tool",
        `non-AI example target ${id}/${target.productId}`);
    }
  }
});
