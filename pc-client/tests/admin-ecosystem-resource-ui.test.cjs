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
    "data-resource-store-kind",
    "data-resource-source-channel",
    "data-resource-field",
    "data-resource-type",
    "data-resource-source-product",
    "data-resource-optional-field=\"reviewStatus\"",
    "data-resource-optional-field=\"riskLevel\"",
    "data-resource-metadata-field",
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
  assert.match(script, /resourcesForSelectedStore\(\)/);
  assert.match(script, /resourceStoreSourceStats\(/);
  assert.match(script, /resourceSourceChannel\(resource\)/);
  assert.match(script, /resourceTypes:\s*\[selectedResourceStoreKind\(\)\]/);
  assert.match(script, /module\.requiresProfile && !matchingProfile/);
  assert.match(script, /resourceMetadataSnapshot\(resource\)/);
  assert.match(script, /data-resource-metadata-field="sourcePlatform"/);
  assert.match(script, /data-resource-metadata-field="canonicalSource"/);
  assert.match(script, /data-resource-metadata-field="licenseId"/);
  assert.match(script, /data-resource-metadata-field="discoveredVia"/);
  assert.doesNotMatch(script, /data-resource-metadata-json/);
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

test("client renders the editable catalog resource-store label", () => {
  const app = read("src/App.tsx");
  const displayLabel = app.slice(
    app.indexOf("function resourceStoreDisplayLabel"),
    app.indexOf("function resourceCompatibilityLabel")
  );
  assert.match(displayLabel, /return catalogDisplayField\(store, "label", language\);/);
  assert.doesNotMatch(displayLabel, /resources\.store\./);
});

test("PC resource cards expose only catalog-backed safety details", () => {
  const app = read("src/App.tsx");
  const language = read("src/language/index.ts");

  for (const field of [
    "requestedPermissions",
    "credentialRequirements",
    "installScope",
    "versionRef",
    "uninstallPlan",
    "lastVerifiedAt",
    "provenanceEvidence"
  ]) {
    assert.match(app, new RegExp(`resource\\.${field}`));
  }
  assert.match(app, /selectedEntry\.publisher &&/);
  assert.match(app, /data-aihub-resource-publisher/);
  assert.match(app, /\{selectedEntry\.publisher\.name\}/);
  assert.match(app, /className="resourceRelationFacts"/);
  assert.doesNotMatch(app, /data-aihub-publisher-parent/);
  assert.match(app, /resourceCompatibilityLabel\(target\.compatibility\)/);
  assert.match(app, /resourceTargetPresentation\(resource, target\)/);
  assert.match(app, /window\.open\(link\.href\)/);
  assert.match(language, /"resources\.compatibility\.protocolCompatible"/);
  assert.match(language, /"resources\.openWebsite"/);
  assert.match(language, /"resources\.openTutorial"/);
});

test("every resource store lists canonical resources before one detail without changing product or vendor pages", () => {
  const app = read("src/App.tsx");

  assert.match(app, /createMarketplace\(/);
  assert.doesNotMatch(app, /resourceProductsByType\(/);
  for (const level of ["resources", "detail"]) {
    assert.match(
      app,
      new RegExp(`data-aihub-resource-level=["']${level}["']`)
    );
  }
  assert.match(app, /data-aihub-action="open-resource-detail"/);
  assert.doesNotMatch(app, /data-aihub-action="open-resource-tool"/);
  assert.match(app, /action="back-resource-list"/);
  assert.match(app, /marker="host"/);
  assert.match(app, /data-aihub-resource-compatible-hosts/);
  assert.match(app, /key=\{resource\.id\}/);
  assert.match(app, /activeResourceStores\.map\(\(store\) =>/);
  assert.match(app, /function VendorsPage\(/);
  assert.match(app, /function VendorPage\(/);
  assert.match(app, /selectedVendor \? \(/);
  assert.match(app, /const availableActions = status\?\.ok/);
  assert.doesNotMatch(
    app,
    /action === "inspect"[\s\S]{0,300}executeExtension\(target\.installProfileId, "install"\)/,
    "inspection must authorize display, not silently install"
  );
});

test("global search owns one result page across vendor and resource channels", () => {
  const app = read("src/App.tsx");

  assert.match(app, /searchCatalog\(/);
  assert.match(app, /view === "search"/);
  assert.match(app, /function SearchResultsPage\(/);
  assert.match(app, /data-aihub-search-result-kind="vendor"/);
  assert.match(app, /data-aihub-search-result-kind="resource"/);
});
