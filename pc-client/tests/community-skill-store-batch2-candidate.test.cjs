const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");

const state = require("../admin/published/catalog-store/state.json");
const batch1 = require("../docs/research/community-skill-store-listing-batch1-canonical-merge-candidate-draft89-active6-2026-08-08.json");
const batch2 = require("../docs/research/community-skill-store-batch2-canonical-merge-candidate-draft89-active6-2026-08-09.json");
const reReviewLedger = require("../docs/research/community-skill-store-index-re-review-2026-08-09.json");
const { createReleaseStore } = require("../admin/release-store.cjs");
const { verifyCatalogRelease } = require("../shared/catalog-release.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const { canonicalize } = require("../shared/signed-release.cjs");
const { resourceStoreChannelStats, resourceTargetPresentation } = require("../shared/resource-store.cjs");

const forbidden = new Set(["command", "args", "env", "headers", "credentials", "script", "secret", "token", "endpoint", "path"]);
const sha = (value) => crypto.createHash("sha256").update(canonicalize(value)).digest("hex");
function visit(value) {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(forbidden.has(key), false, `forbidden candidate key: ${key}`);
    visit(child);
  }
}
async function activeCatalog() {
  const store = createReleaseStore({ rootDirectory: path.resolve(__dirname, "../admin/published/catalog-store"), signingKeyProvider: async () => { throw new Error("read-only test"); } });
  const channel = await store.readChannel("v2");
  const release = await store.readRelease(channel.activeRelease.releaseId, { channel: "v2" });
  verifyCatalogRelease(release.envelope, { trustedKeys: state.trustedKeys });
  return { channel, catalog: release.envelope.payload.catalog };
}

test("community Skill Batch 2 remains a pinned, provenance-complete link-only merge candidate", async () => {
  const { channel, catalog } = await activeCatalog();
  assert.equal(channel.activeRelease.releaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  assert.equal(catalog.vendors.flatMap((vendor) => vendor.products || []).length, 615);
  assert.equal(catalog.resources.length, 250);
  assert.equal(catalog.resourceStores.length, 4);
  assert.equal(batch2.candidateOnly, true);
  assert.equal(batch2.publishable, false);
  assert.equal(batch2.proposedChanges.length, 50);
  assert.equal(batch2.reviewLedger.length, 50);
  assert.equal(reReviewLedger.entries.length, 100);
  assert.deepEqual(reReviewLedger.summary, {
    indexed: 100,
    stagedBatch1: 14,
    stagedBatch2: 20,
    deferred: 28,
    blocked: 38
  });
  const activeIds = new Set(catalog.resources.map((resource) => resource.id));
  const batch1Ids = new Set(batch1.proposedChanges.map((change) => change.resourceId));
  const resourceIds = new Set();
  const canonicalKeys = new Set();
  for (const change of batch2.proposedChanges) {
    const review = batch2.reviewLedger.find((item) => item.resourceId === change.resourceId);
    assert.ok(review);
    assert.equal(activeIds.has(change.resourceId), true);
    assert.equal(batch1Ids.has(change.resourceId), false);
    assert.equal(resourceIds.has(change.resourceId), false);
    assert.equal(canonicalKeys.has(review.canonicalKey), false);
    resourceIds.add(change.resourceId); canonicalKeys.add(review.canonicalKey);
    assert.equal(change.action, "create-canonical");
    assert.equal(change.resourceJsonSha256, sha(change.resource));
    assert.equal(change.resource.website, review.canonicalSource);
    assert.equal(change.resource.metadataSnapshot.sourceRevision, change.resource.versionRef);
    assert.equal(change.resource.metadataSnapshot.licenseStatus, "verified");
    assert.equal(change.resource.targets.length > 0, true);
    for (const target of change.resource.targets) {
      assert.equal(target.moduleId, "resource-link");
      assert.equal(target.installProfileId, "");
      assert.deepEqual(target.capabilities, ["website"]);
    assert.equal(resourceTargetPresentation(change.resource, target).managed, false);
    }
  }
  for (const entry of reReviewLedger.entries) {
    assert.equal(typeof entry.canonicalKey, "string");
    assert.equal(["staged-batch1", "staged-batch2", "deferred", "blocked"].includes(entry.reReviewStatus), true);
  }
  assert.equal(batch2.summary.managedTargetDelta, 0);
  assert.equal(batch2.summary.agentBindingDelta, 0);
  assert.equal(batch2.summary.workflowDependencyDelta, 0);
  visit(batch2);
});

test("Batch 1 then Batch 2 projects through the existing catalog without managed actions", async () => {
  const { catalog } = await activeCatalog();
  const projected = structuredClone(catalog);
  const validated = validateCatalog(projected);
  const targetCount = validated.resources.reduce((count, resource) => count + resource.targets.length, 0);
  const stats = resourceStoreChannelStats(validated.resources, "skill");
  assert.equal(validated.resources.length, 250);
  assert.equal(targetCount, 777);
  assert.deepEqual(stats, { total:120, official:16, community:104, sourceKinds:{ official:16, "reviewed-community":104, community:0 } });
  const batch2Targets = batch2.proposedChanges.flatMap((change) => change.resource.targets);
  assert.equal(batch2Targets.length, 119);
  assert.equal(batch2Targets.some((target) => target.installProfileId), false);
});
