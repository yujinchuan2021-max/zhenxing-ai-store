"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  RESOURCE_STORE_KINDS,
  createResourceStore,
  listResourcesForStore,
  planCanonicalResourceIntake,
  resourceStoreChannelStats,
  normalizeResourceStoreKind
} = require("../shared/resource-store.cjs");

test("ResourceStore accepts only the four catalog kinds and keeps one resource identity", () => {
  assert.deepEqual(RESOURCE_STORE_KINDS, ["skill", "mcp", "connector", "plugin"]);
  assert.equal(normalizeResourceStoreKind("mcp"), "mcp");
  assert.throws(() => normalizeResourceStoreKind("extension"), /kind/i);

  const store = createResourceStore("connector");
  assert.equal(store.kind, "connector");
  const draft = store.create({
    id: "example-connector",
    order: 7,
    targetProductId: "claude-desktop"
  });
  assert.deepEqual(draft.resourceTypes, ["connector"]);
  assert.deepEqual(draft.targets, [{
    productId: "claude-desktop",
    compatibility: "protocol-compatible",
    moduleId: "resource-link",
    installProfileId: "",
    capabilities: ["website"],
    enabled: true
  }]);
  assert.deepEqual(Object.keys(draft).sort(), [
    "description", "enabled", "id", "name", "order", "resourceTypes",
    "reviewStatus", "riskLevel", "sourceKind", "sourceProductIds", "targets", "tutorial", "website"
  ]);
});

test("ResourceStore projects a kind without copying multi-kind resource records", () => {
  const shared = { id: "shared-resource", sourceKind: "reviewed-community", resourceTypes: ["skill", "mcp"], order: 3 };
  const resources = [
    { id: "late-mcp", sourceKind: "official", resourceTypes: ["mcp"], order: 8 },
    shared,
    { id: "early-mcp", sourceKind: "community", resourceTypes: ["mcp"], order: 1 }
  ];
  assert.deepEqual(createResourceStore("mcp").list(resources), [
    resources[2], shared, resources[0]
  ]);
  assert.equal(listResourcesForStore(resources, "skill")[0], shared);
  assert.deepEqual(
    listResourcesForStore(resources, "mcp", { sourceChannel: "community" }),
    [resources[2], shared]
  );
  assert.deepEqual(resourceStoreChannelStats(resources, "mcp"), {
    total: 3,
    official: 1,
    community: 2,
    sourceKinds: { official: 1, "reviewed-community": 1, community: 1 }
  });
  assert.deepEqual(planCanonicalResourceIntake(resources, {
    id: "shared-resource", sourceKind: "official", reviewStatus: "manually-reviewed", riskLevel: "low", resourceTypes: ["skill"],
    metadataSnapshot: {
      sourcePlatform: "cocoloop",
      discoveredVia: "cocoloop",
      sourcePage: "https://www.cocoloop.com/skills/shared-resource",
      canonicalSource: "https://example.com/shared-resource",
      originalAuthor: "Example Author",
      licenseId: "MIT",
      sourceRevision: "v1.2.3",
      provenanceStatus: "first-party-verified",
      externalId: "shared-resource",
      observedAt: "2026-08-07T00:00:00Z",
      licenseStatus: "verified",
      externalReference: { ratingValue: 4.8, ratingCount: 10, cls: "CLS-2" }
    }
  }), {
    action: "update-canonical",
    canonicalResourceId: "shared-resource",
    sourceChannel: "official",
    metadataSnapshot: {
      sourcePlatform: "cocoloop",
      discoveredVia: "cocoloop",
      sourcePage: "https://www.cocoloop.com/skills/shared-resource",
      canonicalSource: "https://example.com/shared-resource",
      originalAuthor: "Example Author",
      licenseId: "MIT",
      sourceRevision: "v1.2.3",
      provenanceStatus: "first-party-verified",
      externalId: "shared-resource",
      observedAt: "2026-08-07T00:00:00Z",
      licenseStatus: "verified",
      externalReference: { ratingValue: 4.8, ratingCount: 10, cls: "CLS-2" }
    },
    managedBindingEligible: true
  });
  assert.throws(() => planCanonicalResourceIntake(resources, {
    id: "unlicensed-resource", sourceKind: "community", reviewStatus: "manually-reviewed", riskLevel: "low", resourceTypes: ["skill"],
    metadataSnapshot: {
      sourcePlatform: "cocoloop",
      discoveredVia: "cocoloop",
      sourcePage: "https://www.cocoloop.com/skills/unlicensed-resource",
      canonicalSource: "https://example.com/unlicensed-resource",
      originalAuthor: "Example Author",
      sourceRevision: "v1.2.3",
      provenanceStatus: "first-party-verified",
      externalId: "unlicensed-resource",
      observedAt: "2026-08-07T00:00:00Z",
      licenseStatus: "unverified"
    }
  }));
  assert.throws(() => planCanonicalResourceIntake(resources, {
    id: "unsafe-resource", sourceKind: "community", reviewStatus: "rejected", riskLevel: "unsafe", resourceTypes: ["skill"],
    metadataSnapshot: {
      sourcePlatform: "cocoloop",
      discoveredVia: "cocoloop",
      sourcePage: "https://www.cocoloop.com/skills/unsafe-resource",
      provenanceStatus: "provenance-unresolved",
      externalId: "unsafe-resource",
      observedAt: "2026-08-07T00:00:00Z",
      licenseStatus: "unverified",
      zipUrl: "https://example.com/unsafe.zip"
    }
  }));
  assert.equal(planCanonicalResourceIntake(resources, {
    id: "unsafe-resource", sourceKind: "community", reviewStatus: "rejected", riskLevel: "unsafe", resourceTypes: ["skill"]
  }).managedBindingEligible, false);
  assert.equal(planCanonicalResourceIntake(resources, {
    id: "unresolved-resource", sourceKind: "community", reviewStatus: "unreviewed", riskLevel: "guarded", resourceTypes: ["skill"],
    metadataSnapshot: {
      sourcePlatform: "cocoloop",
      discoveredVia: "cocoloop",
      sourcePage: "https://www.cocoloop.com/skills/unresolved-resource",
      provenanceStatus: "provenance-unresolved",
      externalId: "unresolved-resource",
      observedAt: "2026-08-07T00:00:00Z",
      licenseStatus: "unverified"
    }
  }).managedBindingEligible, false);
});

test("catalog keeps the four resource stores fixed instead of accepting a new execution channel", () => {
  const catalog = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "admin", "data", "catalog-v1.json"),
    "utf8"
  ));
  catalog.resourceStores[0].id = "arbitrary-command-store";
  assert.throws(() => validateCatalog(catalog), /生态资源商店|资源商店/);
});
