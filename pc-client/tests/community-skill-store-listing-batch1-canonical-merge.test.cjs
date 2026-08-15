"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createCommunitySkillListingBatch1Candidate } = require("../admin/community-skill-listing-candidate.cjs");
const { catalogReleaseSha256, verifyCatalogReleaseIntegrity } = require("../shared/catalog-release.cjs");
const { createSignedEnvelope } = require("../shared/signed-release.cjs");

const root = path.resolve(__dirname, "..");
const statePath = path.join(root, "admin/published/catalog-store/state.json");
const sourceReleasePath = path.join(
  root,
  "admin/published/catalog-store/releases/catalog-v00000006-567e671621f1-3dcee587.json"
);
const batchPath = path.join(root, "docs/research/community-skill-store-listing-batch1-candidate-draft89-active6-2026-08-08.json");
const outputPath = path.join(root, "docs/research/community-skill-store-listing-batch1-canonical-merge-candidate-draft89-active6-2026-08-08.json");

function inputs() {
  const currentState = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const sourceRelease = JSON.parse(fs.readFileSync(sourceReleasePath, "utf8"));
  const state = structuredClone(currentState);
  state.draft.revision = 89;
  state.draft.updatedAt = sourceRelease.payload.catalog.updatedAt;
  state.draft.catalog.updatedAt = sourceRelease.payload.catalog.updatedAt;
  state.draft.catalog.resources = state.draft.catalog.resources.slice(0, 146);
  state.channels.v2.history = state.channels.v2.history.slice(0, 6);
  state.channels.v2.activeReleaseId = state.channels.v2.history.at(-1).releaseId;
  state.channels.v2.activeCatalogVersion = 6;
  const stateRaw = `${JSON.stringify(state, null, 2)}\n`;
  const batchRaw = fs.readFileSync(batchPath, "utf8");
  return {
    stateRaw,
    batchRaw,
    state,
    batch: JSON.parse(batchRaw)
  };
}

function stagedCatalog(state, candidate) {
  const catalog = structuredClone(state.draft.catalog);
  catalog.resources.push(
    ...candidate.proposedChanges.map((change) => structuredClone(change.resource))
  );
  return catalog;
}

test("checked-in canonical merge candidate exactly reproduces the current staging transform", () => {
  const { state, stateRaw, batch, batchRaw } = inputs();
  const expected = createCommunitySkillListingBatch1Candidate({ state, stateRaw, batch, batchRaw });
  const checkedIn = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.deepEqual(checkedIn, expected);
});

test("community Skill Batch 1 stages only link-only resources with preserved provenance snapshots", () => {
  const { state, stateRaw, batch, batchRaw } = inputs();
  const candidate = createCommunitySkillListingBatch1Candidate({ state, stateRaw, batch, batchRaw });
  const catalog = stagedCatalog(state, candidate);

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.proposedChanges.length, 14);
  assert.equal(candidate.summary.resourceDelta, 14);
  assert.equal(candidate.summary.targetDelta, 42);
  assert.equal(candidate.summary.managedTargetDelta, 0);
  assert.equal(candidate.summary.agentBindingDelta, 0);
  assert.equal(candidate.summary.workflowDependencyDelta, 0);
  assert.equal(catalog.resources.length, 160);
  assert.equal(catalog.resources.reduce((total, resource) => total + resource.targets.length, 0), 555);
  assert.equal(catalogReleaseSha256(catalog), candidate.summary.candidateCatalogCanonicalSha256);

  for (const change of candidate.proposedChanges) {
    const source = batch.readyResources.find((item) => item.resourceId === change.resourceId);
    assert.ok(source);
    assert.deepEqual(change.resource.metadataSnapshot, source.intakeCandidate.metadataSnapshot);
    assert.ok(change.resource.targets.every((target) =>
      target.moduleId === "resource-link" &&
      target.installProfileId === "" &&
      JSON.stringify(target.capabilities) === JSON.stringify(["website"])
    ));
  }
  assert.deepEqual(
    catalog.resources.slice(0, state.draft.catalog.resources.length),
    state.draft.catalog.resources
  );
});

test("metadata snapshots survive canonical signing and replay without granting a managed action", () => {
  const { state, stateRaw, batch, batchRaw } = inputs();
  const candidate = createCommunitySkillListingBatch1Candidate({ state, stateRaw, batch, batchRaw });
  const catalog = stagedCatalog(state, candidate);
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const keyId = "candidate-test-key";
  const payload = {
    schemaVersion: 1,
    releaseId: `catalog-v00000007-${catalogReleaseSha256(catalog).slice(0, 12)}-deadbeef`,
    catalogVersion: 7,
    publishedAt: "2026-08-08T00:00:00.000Z",
    draftRevision: state.draft.revision,
    parentReleaseId: state.channels.v2.activeReleaseId,
    sourceReleaseId: null,
    notes: "candidate-only test envelope",
    rollout: { percentage: 0, salt: "community-skill-candidate" },
    catalogSha256: catalogReleaseSha256(catalog),
    catalog
  };
  const envelope = createSignedEnvelope({ kind: "catalog", keyId, payload, privateKey });
  const replayed = verifyCatalogReleaseIntegrity(envelope, {
    trustedKeys: [{
      keyId,
      publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64")
    }]
  });
  const expected = candidate.proposedChanges[0].resource.metadataSnapshot;
  assert.deepEqual(
    replayed.catalog.resources.find((resource) => resource.id === candidate.proposedChanges[0].resourceId).metadataSnapshot,
    expected
  );
  assert.ok(
    replayed.catalog.resources
      .filter((resource) => candidate.proposedChanges.some((change) => change.resourceId === resource.id))
      .flatMap((resource) => resource.targets)
      .every((target) => target.moduleId === "resource-link" && target.installProfileId === "")
  );
});

test("legacy resources without metadata snapshots remain valid while unsafe snapshot fields fail closed", () => {
  const { state, stateRaw, batch, batchRaw } = inputs();
  assert.doesNotThrow(() => createCommunitySkillListingBatch1Candidate({ state, stateRaw, batch, batchRaw }));
  const invalid = structuredClone(batch);
  invalid.readyResources[0].intakeCandidate.metadataSnapshot.credentials = "never allowed";
  assert.throws(
    () => createCommunitySkillListingBatch1Candidate({ state, stateRaw, batch: invalid, batchRaw: JSON.stringify(invalid) }),
    /metadata snapshot invalid/
  );
});
