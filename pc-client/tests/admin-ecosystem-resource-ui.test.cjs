"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("admin edits product directory projections and top-level ecosystem resources", () => {
  const html = read("admin/public/index.html");
  const script = read("admin/public/app.js");
  const server = read("admin/server.cjs");

  assert.match(html, /data-view="resources"/);
  for (const marker of [
    'data-product-field="directoryKind"',
    'data-action="add-resource"',
    'data-action="delete-resource"',
    "data-resource-store-field",
    "data-resource-field",
    "data-resource-type",
    "data-resource-source-product",
    "data-resource-target-field",
    "data-resource-target-module",
    "data-resource-target-profile"
  ]) {
    assert.match(script, new RegExp(marker));
  }
  assert.doesNotMatch(html, /data-view="extensions"/);
  assert.doesNotMatch(script, /data-(?:extension|action="add-extension)/);
  assert.match(server, /resourceModules,\s*\n\s*extensionModules: resourceModules/);
  assert.match(server, /validateCatalog\(normalizeCatalog\(catalog\)\)/);
  assert.match(script, /resourceIdLocked/);
  assert.match(script, /module\.requiresProfile && !matchingProfile/);
});

test("admin blocks deleting products still referenced by ecosystem resources", () => {
  const script = read("admin/public/app.js");
  assert.match(script, /resource\.sourceProductIds/);
  assert.match(script, /resource\.targets\.some/);
  assert.match(script, /请先从生态资源/);
});

test("admin does not claim new resource targets are verified", () => {
  const script = read("admin/public/app.js");
  const defaults = [...script.matchAll(/compatibility:\s*"([^"]+)"/g)].map(
    (match) => match[1]
  );
  assert.ok(defaults.length >= 2);
  assert.deepEqual(new Set(defaults), new Set(["protocol-compatible"]));
});

test("PC resource cards expose only catalog-backed safety details", () => {
  const app = read("src/App.tsx");
  const language = read("src/language/index.ts");

  for (const field of [
    "requestedPermissions",
    "credentialRequirements",
    "installScope",
    "provenanceEvidence"
  ]) {
    assert.match(app, new RegExp(`resource\\.${field}`));
  }
  assert.match(app, /resourceCompatibilityLabel\(target\.compatibility\)/);
  assert.match(app, /window\.open\(resource\.tutorial\)/);
  assert.match(language, /"resources\.compatibility\.protocolCompatible"/);
  assert.match(language, /"resources\.openOfficialGuide"/);
});

test("every resource store drills down from tools to resources to one detail", () => {
  const app = read("src/App.tsx");

  assert.match(app, /resourceProductsByType\(/);
  for (const level of ["tools", "resources", "detail"]) {
    assert.match(
      app,
      new RegExp(`data-aihub-resource-level=["']${level}["']`)
    );
  }
  for (const action of [
    "open-resource-tool",
    "open-resource-detail",
    "back-resource-tools",
    "back-resource-list"
  ]) {
    assert.match(app, new RegExp(`data-aihub-action=["']${action}["']`));
  }
  assert.match(app, /data-aihub-resource-filter="letter"/);
  assert.match(app, /filteredProductDirectories/);
});

test("global search owns one result page across vendor and resource channels", () => {
  const app = read("src/App.tsx");

  assert.match(app, /searchCatalog\(/);
  assert.match(app, /view === "search"/);
  assert.match(app, /function SearchResultsPage\(/);
  assert.match(app, /data-aihub-search-result-kind="vendor"/);
  assert.match(app, /data-aihub-search-result-kind="resource"/);
});
