"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  resourceTargetPresentation,
  resourceSourceChannel
} = require("../shared/resource-store.cjs");
const { SCENARIO_TAGS } = require("../shared/catalog-taxonomy.cjs");
const { searchCatalog } = require("../shared/catalog-projections.cjs");
const { createReleaseStore } = require("../admin/release-store.cjs");
const { verifyCatalogRelease } = require("../shared/catalog-release.cjs");
const state = require("../admin/published/catalog-store/state.json");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("resource source channels preserve one canonical record and all 21 shared scenario tags", () => {
  const resource = { id: "shared", sourceKind: "reviewed-community" };
  assert.equal(resourceSourceChannel(resource), "community");
  assert.equal(SCENARIO_TAGS.length, 21);
  assert.ok(SCENARIO_TAGS.some((tag) => tag.id === "gaming"));
  assert.ok(SCENARIO_TAGS.some((tag) => tag.id === "game-development"));
});

test("signed v2 active7 exposes 104 community Skills as link-only resources", async () => {
  const store = createReleaseStore({
    rootDirectory: path.join(__dirname, "../admin/published/catalog-store"),
    signingKeyProvider: async () => { throw new Error("read-only test"); }
  });
  const channel = await store.readChannel("v2");
  const release = await store.readRelease(channel.activeRelease.releaseId, { channel: "v2" });
  const catalog = verifyCatalogRelease(release.envelope, { trustedKeys: state.trustedKeys }).catalog;
  const skills = catalog.resources.filter((resource) => resource.resourceTypes.includes("skill"));
  const community = skills.filter((resource) => resourceSourceChannel(resource) === "community");
  assert.equal(channel.activeRelease.releaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  assert.equal(catalog.vendors.flatMap((vendor) => vendor.products).length, 615);
  assert.equal(catalog.resources.length, 250);
  assert.equal(catalog.resources.reduce((count, resource) => count + resource.targets.length, 0), 777);
  assert.equal(catalog.resourceStores.length, 4);
  assert.equal(skills.length, 120);
  assert.equal(community.length, 104);
  assert.equal(community.flatMap((resource) => resource.targets).every((target) =>
    target.moduleId === "resource-link" &&
    target.installProfileId === "" &&
    target.capabilities.length === 1 &&
    target.capabilities[0] === "website"
  ), true);
});

test("unsafe or rejected resources remain link-only even if a fixed target resembles a managed profile", () => {
  const target = {
    productId: "codex-cli",
    moduleId: "mcp-managed",
    installProfileId: "mcp.codex.openai-developer-docs",
    capabilities: ["website", "install"]
  };
  for (const resource of [
    {
      id: "openai-codex-mcp-config",
      website: "https://developers.openai.com/mcp",
      reviewStatus: "rejected",
      riskLevel: "low"
    },
    {
      id: "openai-codex-mcp-config",
      website: "https://developers.openai.com/mcp",
      reviewStatus: "manually-reviewed",
      riskLevel: "unsafe"
    }
  ]) {
    const presentation = resourceTargetPresentation(resource, target);
    assert.equal(presentation.managed, false, `${resource.reviewStatus}/${resource.riskLevel}`);
    assert.deepEqual(presentation.links.map((link) => link.kind), ["website"]);
  }
});

test("resource search resolves canonical scenario aliases through its host product", () => {
  const result = searchCatalog({
    vendors: [{
      id: "fixture-vendor",
      enabled: true,
      order: 0,
      name: "Fixture vendor",
      products: [{
        id: "fixture-game-host",
        enabled: true,
        order: 0,
        name: "Fixture host",
        directoryKind: "ai-tool",
        scenarioTags: ["gaming"]
      }]
    }],
    resources: [{
      id: "fixture-resource",
      enabled: true,
      order: 0,
      name: "Fixture resource",
      sourceKind: "official",
      resourceTypes: ["skill"],
      targets: [{ productId: "fixture-game-host", enabled: true }]
    }],
    resourceStores: [{ id: "skill", label: "Skill", enabled: true, order: 0 }],
    query: "游戏"
  });
  assert.equal(result.resources.length, 1);
  assert.equal(result.resources[0].resource.id, "fixture-resource");
});

test("ResourceStorePage keeps resource-first source, category, and host filters explicit", () => {
  const app = read("src/App.tsx");
  const language = read("src/language/index.ts");

  for (const marker of [
    'marker="source-channel"',
    'marker="scenario"',
    'marker="host"',
    'marker="compatibility"',
    "createMarketplace",
    "catalogResourceConnections",
    "selectedResourceId",
    "data-aihub-resource-publisher",
    "data-aihub-resource-compatible-hosts",
    "data-aihub-resource-connection-modes",
    "data-aihub-resource-connection-mode",
    "data-aihub-resource-connection-host-id",
    "data-aihub-resource-connection-binding-kind",
    "data-aihub-resource-store-current",
    "resourceSourceChannel",
    "resourceReviewStatus",
    "resourceRiskLevel",
    "resources.channel.store",
    "resources.currentSource",
    "data-aihub-resource-source-context",
    "data-aihub-resource-empty-source",
    "switch-resource-source-official",
    "SCENARIO_TAGS",
    "marketplace.facets",
    "metadataSnapshot",
    "canonicalSource",
    "externalReference"
  ]) {
    assert.match(app, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const key of [
    "resources.channel.official",
    "resources.channel.community",
    "resources.communityEmptyTitle",
    "resources.communityEmptyDescription",
    "resources.communityEmptyAction",
    "resources.hostFilter",
    "resources.compatibilityFilter",
    "resources.compatibleHosts",
    "resources.connectionModes",
    "resources.connectionMode.remote-mcp",
    "resources.connectionMode.chatgpt-app",
    "nav.communityDiscussions",
    "resources.risk.guarded",
    "resources.risk.unsafe",
    "resources.externalData"
  ]) {
    assert.match(language, new RegExp(`"${key}"`));
  }
});

test("one global navigation entry leads to an unavailable candidate-submission seam", () => {
  const app = read("src/App.tsx");
  const language = read("src/language/index.ts");
  const styles = read("src/styles.css");

  assert.match(app, /function ContributionCallout/);
  assert.match(app, /className="sidebarContribution"/);
  assert.match(app, /navigate\("contribution"\)/);
  assert.match(app, /data-aihub-action="open-resource-submission"/);
  assert.equal((app.match(/data-aihub-action="submit-resource"/g) || []).length, 1);
  assert.match(app, /disabled/);
  for (const scope of ["vendor", "agent", "skill", "mcp", "plugin", "connector", "workflow"]) {
    assert.match(app, new RegExp(`"${scope}"`));
  }
  assert.doesNotMatch(app, /submitResource\s*\(/);
  for (const key of [
    "resources.submit.title",
    "resources.submit.unavailable",
    "resources.submit.candidateOnly"
  ]) {
    assert.match(language, new RegExp(`"${key}"`));
  }

  const submissionEntryRule = styles.match(/\.submissionTextLink\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(submissionEntryRule, /min-height:\s*44px/);
  assert.match(submissionEntryRule, /border:\s*1px solid/);
  assert.match(submissionEntryRule, /background:\s*color-mix\(/);
  assert.doesNotMatch(submissionEntryRule, /(?:border|padding):\s*0|background:\s*transparent/);
  assert.match(styles, /\.submissionTextLink:hover\s*\{[^}]*background:/);
  assert.match(styles, /\.submissionTextLink:focus-visible\s*\{[^}]*outline:/);
});
