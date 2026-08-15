const assert = require("node:assert/strict");
const test = require("node:test");

const currentState = require("../admin/published/catalog-store/state.json");
const batch = require("../docs/research/community-skill-store-listing-batch1-candidate-draft89-active6-2026-08-08.json");
const reviewedIndex = require("../docs/research/community-skill-batch1-complete-candidate-2026-08-08.json");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  planCanonicalResourceIntake,
  resourceStoreChannelStats,
  resourceTargetPresentation
} = require("../shared/resource-store.cjs");
const { isCanonicalScenarioTags } = require("../shared/catalog-taxonomy.cjs");

const forbidden = new Set([
  "command",
  "args",
  "env",
  "headers",
  "credentials",
  "script",
  "secret",
  "token",
  "endpoint",
  "invoke",
  "binding"
]);

const state = currentState;

function visit(value) {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(forbidden.has(key), false, `forbidden candidate key: ${key}`);
    visit(child);
  }
}

function products(catalog) {
  return catalog.vendors.flatMap((vendor) => vendor.products || []);
}

test("community Skill listing Batch 1 is canonical, provenance-complete, and link-only", () => {
  assert.equal(batch.candidateOnly, true);
  assert.equal(batch.publishable, false);
  assert.equal(state.draft.revision, 90);
  assert.equal(state.channels.v2.activeReleaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  assert.equal(batch.readyResources.length, 14);
  assert.equal(batch.decisionSummary.notInThisListingBatch, 86);
  assert.equal(batch.decisionSummary.hardBlocked, 41);

  const catalog = state.draft.catalog;
  const currentIds = new Set(catalog.resources.map((resource) => resource.id));
  const currentCanonicalSources = new Set(
    catalog.resources.flatMap((resource) => [
      resource.website,
      ...(resource.provenanceEvidence || [])
    ])
  );
  const productIds = new Set(products(catalog).map((product) => product.id));
  const reviewedById = new Map(
    reviewedIndex.candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  const ids = new Set();
  const canonicalKeys = new Set();

  for (const item of batch.readyResources) {
    assert.equal(ids.has(item.resourceId), false);
    assert.equal(canonicalKeys.has(item.canonicalKey), false);
    assert.equal(currentIds.has(item.resourceId), true);
    assert.equal(currentCanonicalSources.has(item.canonicalSource), true);
    ids.add(item.resourceId);
    canonicalKeys.add(item.canonicalKey);

    const indexed = reviewedById.get(item.resourceId);
    assert.ok(indexed);
    assert.equal(indexed.canonicalKey, item.canonicalKey);
    assert.equal(indexed.decision, "external-link-only");
    assert.equal(indexed.license.status, "resolved");
    assert.equal(indexed.provenanceStatus, "first-party-verified");
    assert.equal(isCanonicalScenarioTags(item.normalizedTags), true);

    const plan = planCanonicalResourceIntake(catalog.resources, item.intakeCandidate);
    assert.equal(plan.action, "update-canonical");
    assert.equal(plan.sourceChannel, "community");
    assert.equal(plan.metadataSnapshot.canonicalSource, item.canonicalSource);
    assert.equal(plan.metadataSnapshot.licenseId, item.license.spdx);
    assert.equal(plan.metadataSnapshot.provenanceStatus, "first-party-verified");

    const resource = item.proposedResource;
    assert.equal(resource.sourceKind, "reviewed-community");
    assert.equal(resource.reviewStatus, "manually-reviewed");
    assert.equal(resource.riskLevel, "guarded");
    assert.equal(resource.website, item.canonicalSource);
    assert.equal(resource.publisher, item.originalAuthor.name);
    assert.ok(resource.provenanceEvidence.includes(item.license.evidence));
    assert.equal(resource.targets.length, 3);
    for (const target of resource.targets) {
      assert.equal(productIds.has(target.productId), true);
      assert.equal(target.moduleId, "resource-link");
      assert.equal(target.installProfileId, "");
      assert.deepEqual(target.capabilities, ["website"]);
      assert.equal(resourceTargetPresentation(resource, target).managed, false);
    }
  }

  assert.equal(batch.canonicalDedupe.selectedDuplicates, 0);
  assert.equal(
    batch.canonicalDedupe.exactExistingCatalogMergeCandidates[0].existingResourceId,
    "openai-chatgpt-apps-skill"
  );
  visit(batch);
});

test("community Skill listing Batch 1 projects through the existing catalog schema without managed actions", () => {
  const projectedCatalog = structuredClone(state.draft.catalog);
  const validated = validateCatalog(projectedCatalog);
  const stats = resourceStoreChannelStats(validated.resources, "skill");
  const targetCount = validated.resources.reduce(
    (count, resource) => count + resource.targets.length,
    0
  );
  const managedTargets = validated.resources.flatMap((resource) =>
    resource.targets.filter((target) => target.moduleId !== "resource-link")
  );

  assert.equal(validated.resources.length, 250);
  assert.equal(targetCount, 777);
  assert.deepEqual(stats, {
    total: 120,
    official: 16,
    community: 104,
    sourceKinds: {
      official: 16,
      "reviewed-community": 104,
      community: 0
    }
  });
  assert.equal(managedTargets.length, 8);
  assert.equal(
    batch.readyResources.flatMap((item) => item.proposedResource.targets).length,
    42
  );
  for (const item of batch.readyResources) {
    assert.deepEqual(
      validated.resources.find((resource) => resource.id === item.resourceId)
        .metadataSnapshot,
      item.intakeCandidate.metadataSnapshot
    );
  }
});

test("catalog provenance snapshots are strict data-only allowlists", () => {
  const item = batch.readyResources[0];
  const resource = {
    ...structuredClone(item.proposedResource),
    metadataSnapshot: structuredClone(item.intakeCandidate.metadataSnapshot)
  };
  const catalog = structuredClone(state.draft.catalog);
  const resourceIndex = catalog.resources.findIndex((entry) => entry.id === resource.id);
  catalog.resources[resourceIndex] = resource;
  assert.doesNotThrow(() => validateCatalog(catalog));

  for (const forbiddenField of ["command", "script", "secret", "headers"]) {
    const invalid = structuredClone(catalog);
    invalid.resources[resourceIndex].metadataSnapshot[forbiddenField] = "blocked";
    assert.throws(() => validateCatalog(invalid), /metadata|生态资源/i);
  }
});
