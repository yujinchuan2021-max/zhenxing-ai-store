"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { defaultReleaseSettings, validatePublication } = require("../admin/config-validation.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const { validateOptionalPlatformSupport } = require("../admin/platform-support-candidate.cjs");
const { createReleaseStore } = require("../admin/release-store.cjs");
const { verifySignedEnvelope } = require("../shared/signed-release.cjs");

const root = path.resolve(__dirname, "..");
const statePath = path.join(root, "admin/published/catalog-store/state.json");
const evidencePath = path.join(root, "docs/research/platform-support-evidence-batch1-draft89-active6-2026-08-07.json");
const candidatePath = path.join(root, "docs/research/platform-support-batch1-canonical-merge-candidate-draft89-active6-2026-08-07.json");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("Batch 1 merge candidate is a verified product-only, candidate-only transformation", () => {
  const stateRaw = fs.readFileSync(statePath, "utf8");
  const evidenceRaw = fs.readFileSync(evidencePath, "utf8");
  const state = JSON.parse(stateRaw);
  const evidence = JSON.parse(evidenceRaw);
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const baseline = state.draft.catalog;
  const catalog = structuredClone(baseline);
  const productById = new Map(catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, { vendor, product }])
  ));

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(state.draft.revision, candidate.source.draftRevision);
  assert.equal(state.channels.v2.activeCatalogVersion, candidate.source.v2ActiveCatalogVersion);
  assert.equal(state.channels.v2.activeReleaseId, candidate.source.v2ActiveReleaseId);
  assert.equal(productById.size, candidate.source.productCount);
  assert.equal(catalog.resources.length, candidate.source.resourceCount);
  assert.equal(catalog.resources.reduce((total, resource) => total + resource.targets.length, 0), candidate.source.targetCount);
  assert.equal(sha256(stateRaw), candidate.source.stateSha256);
  assert.equal(sha256(evidenceRaw), candidate.source.evidenceSha256);
  assert.equal(sha256(JSON.stringify(baseline)), candidate.source.draftCatalogJsonSha256);

  const records = new Map(evidence.records.map((record) => [record.productId, record]));
  assert.equal(candidate.proposedChanges.length, 20);
  assert.equal(records.size, 20);
  let claimCount = 0;
  const statuses = { supported: 0, unknown: 0, unsupported: 0, blocked: 0 };
  for (const change of candidate.proposedChanges) {
    const record = records.get(change.productId);
    const matched = productById.get(change.productId);
    assert.ok(record);
    assert.ok(matched);
    assert.equal(change.vendorId, record.vendorId);
    assert.equal(change.vendorId, matched.vendor.id);
    assert.equal(change.claimCount, record.claims.length);
    assert.equal(change.platformSupportJsonSha256, sha256(JSON.stringify(record.claims)));
    assert.deepEqual(validateOptionalPlatformSupport(record.claims, { now: evidence.checkedAt }), { configured: true });
    matched.product.platformSupport = structuredClone(record.claims);
    for (const claim of record.claims) {
      claimCount += 1;
      statuses[claim.status] += 1;
      assert.deepEqual(Object.keys(claim).sort(), ["architectures", "evidence", "platform", "runtime", "status"]);
      assert.equal(Object.keys(claim.evidence[0]).sort().join(","), "kind,observedAt,url");
    }
  }
  assert.deepEqual(statuses, { supported: 54, unknown: 7, unsupported: 0, blocked: 0 });
  assert.equal(claimCount, 61);
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.doesNotThrow(() => validatePublication(catalog, defaultReleaseSettings()));
  assert.equal(sha256(JSON.stringify(catalog)), candidate.summary.candidateCatalogJsonSha256);

  const changed = new Set(candidate.proposedChanges.map((change) => change.productId));
  for (const vendor of catalog.vendors) for (const product of vendor.products) {
    const originalVendor = baseline.vendors.find((item) => item.id === vendor.id);
    const original = originalVendor.products.find((item) => item.id === product.id);
    const restored = structuredClone(product);
    delete restored.platformSupport;
    assert.deepEqual(restored, original);
    if (!changed.has(product.id)) assert.equal(product.platformSupport, undefined);
  }
  assert.deepEqual(catalog.resources, baseline.resources);
  assert.deepEqual(catalog.resourceStores, baseline.resourceStores);
  assert.ok(catalog.resources.every((resource) => resource.platformSupport === undefined));
  assert.ok(catalog.resources.every((resource) => resource.targets.every((target) => target.platformSupport === undefined)));
});

test("Batch 1 preserves the signed v2 release and does not create Agent-ready resource intersections", async () => {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const store = createReleaseStore({
    rootDirectory: path.join(root, "admin/published/catalog-store"),
    signingKeyProvider: async () => { throw new Error("candidate test must not sign"); }
  });
  const v2 = await store.readChannel("v2");
  const release = await store.readRelease(v2.activeRelease.releaseId, { channel: "v2" });
  assert.doesNotThrow(() => verifySignedEnvelope(release.envelope, {
    kind: "catalog",
    trustedKeys: state.trustedKeys
  }));
  const catalog = release.envelope.payload.catalog;
  assert.equal(v2.activeCatalogVersion, 6);
  assert.equal(catalog.vendors.reduce((total, vendor) => total + vendor.products.length, 0), 615);
  assert.equal(catalog.resources.length, 146);
  assert.equal(catalog.resources.reduce((total, resource) => total + resource.targets.length, 0), 513);
  assert.ok(catalog.resources.every((resource) => resource.platformSupport === undefined));
  assert.ok(catalog.resources.every((resource) => resource.targets.every((target) => target.platformSupport === undefined)));
});
