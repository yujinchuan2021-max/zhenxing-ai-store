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

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", relative), "utf8"));
}

test("vertical AI-connectable expansion is categorized and remains link-only", () => {
  const catalog = read("admin/data/catalog-v1.json");
  assert.doesNotThrow(() => validateCatalog(catalog));
  const products = new Map(catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, product])));
  const resources = new Map(catalog.resources.map((resource) => [resource.id, resource]));
  for (const id of productIds) {
    assert.equal(products.get(id)?.directoryKind, "ai-connectable", `missing ${id}`);
    assert.notEqual(products.get(id)?.category, "AI 接入");
  }
  for (const id of resourceIds) {
    const resource = resources.get(id);
    assert.ok(resource, `missing ${id}`);
    assert.ok(["official", "reviewed-community", "community"].includes(resource.sourceKind));
    for (const item of resource.targets) {
      assert.equal(item.moduleId, "resource-link");
      assert.deepEqual(item.capabilities, ["website"]);
      assert.equal(item.installProfileId, "");
    }
  }
  assert.ok(catalog.resourceStores.some((store) => store.id === "connector"));
  assert.equal(products.get("obs-studio").category, "直播与录制");
  assert.equal(products.get("autodesk-fusion").category, "3D 创作");
  assert.equal(products.get("ableton-live").category, "音频制作");
});

test("compact example receives all source products and remains valid", () => {
  const catalog = read("catalog/catalog-v1.example.json");
  assert.doesNotThrow(() => validateCatalog(catalog));
  const ids = new Set(catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => product.id)));
  for (const id of productIds) assert.ok(ids.has(id), `missing example ${id}`);
});
