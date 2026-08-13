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
const candidatePath = path.join(root, "docs/research/platform-support-batch12-canonical-merge-candidate-draft89-active6-2026-08-07.json");
const evidencePath = (batch) => path.join(root, `docs/research/platform-support-evidence-batch${batch}-draft89-active6-2026-08-07.json`);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const forbiddenFields = new Set([
  "command", "args", "env", "headers", "credentials", "script",
  "artifactUrl", "installProfileId", "moduleId", "downloadUrl", "profile"
]);

function assertNoForbiddenKeys(value, at = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoForbiddenKeys(item, `${at}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!forbiddenFields.has(key), `${at}.${key} is forbidden`);
    assertNoForbiddenKeys(item, `${at}.${key}`);
  }
}

test("Batch 1+2 combined candidate is a verified product-only, candidate-only transformation", () => {
  const stateRaw = fs.readFileSync(statePath, "utf8");
  const state = JSON.parse(stateRaw);
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const evidenceInputs = new Map(candidate.source.evidenceInputs.map((input) => {
    const raw = fs.readFileSync(path.join(root, input.path), "utf8");
    return [input.batch, { input, raw, evidence: JSON.parse(raw) }];
  }));
  const baseline = state.draft.catalog;
  const catalog = structuredClone(baseline);
  const products = new Map(catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, { vendor, product }])
  ));

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.recommendedConsumption, false);
  assert.equal(candidate.supersededBy, "docs/research/platform-support-batch123-canonical-merge-candidate-draft89-active6-2026-08-07.json");
  assert.equal(state.draft.revision, candidate.source.draftRevision);
  assert.equal(state.channels.v2.activeCatalogVersion, candidate.source.v2ActiveCatalogVersion);
  assert.equal(state.channels.v2.activeReleaseId, candidate.source.v2ActiveReleaseId);
  assert.equal(products.size, candidate.source.productCount);
  assert.equal(catalog.resources.length, candidate.source.resourceCount);
  assert.equal(catalog.resources.reduce((total, resource) => total + resource.targets.length, 0), candidate.source.targetCount);
  assert.equal(catalog.resourceStores.length, candidate.source.resourceStoreCount);
  assert.equal(sha256(stateRaw), candidate.source.stateSha256);
  assert.equal(sha256(JSON.stringify(baseline)), candidate.source.draftCatalogJsonSha256);
  assert.equal(evidenceInputs.size, 2);

  const recordsByBatch = new Map();
  for (const [batch, { input, raw, evidence }] of evidenceInputs) {
    assert.equal(sha256(raw), input.sha256);
    assert.equal(evidence.sourceRevision, candidate.source.draftRevision);
    assert.equal(evidence.activeReleaseId, candidate.source.v2ActiveReleaseId);
    assert.equal(evidence.records.length, input.productCount);
    assert.equal(evidence.records.reduce((total, record) => total + record.claims.length, 0), input.claimCount);
    recordsByBatch.set(batch, new Map(evidence.records.map((record) => [record.productId, record])));
  }

  assert.equal(candidate.proposedChanges.length, 50);
  const changed = new Set();
  const statuses = { supported: 0, unknown: 0, unsupported: 0, blocked: 0 };
  let claims = 0;
  for (const change of candidate.proposedChanges) {
    assert.ok(!changed.has(change.productId), `duplicate or cross-batch overlap: ${change.productId}`);
    changed.add(change.productId);
    const record = recordsByBatch.get(change.sourceBatch)?.get(change.productId);
    const matched = products.get(change.productId);
    assert.ok(record, `missing exact evidence record: ${change.productId}`);
    assert.ok(matched, `missing catalog product: ${change.productId}`);
    assert.equal(record.vendorId, change.vendorId);
    assert.equal(matched.vendor.id, change.vendorId);
    assert.deepEqual(validateOptionalPlatformSupport(record.claims, { now: evidenceInputs.get(change.sourceBatch).evidence.checkedAt }), { configured: true });
    assertNoForbiddenKeys(record, change.productId);
    matched.product.platformSupport = structuredClone(record.claims);
    for (const claim of record.claims) {
      claims += 1;
      statuses[claim.status] += 1;
    }
  }

  assert.equal(changed.size, 50);
  assert.equal(claims, 151);
  assert.deepEqual(statuses, { supported: 125, unknown: 22, unsupported: 4, blocked: 0 });
  assert.deepEqual(statuses, {
    supported: candidate.summary.supported,
    unknown: candidate.summary.unknown,
    unsupported: candidate.summary.unsupported,
    blocked: candidate.summary.blocked
  });
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.doesNotThrow(() => validatePublication(catalog, defaultReleaseSettings()));
  assert.equal(sha256(JSON.stringify(catalog)), candidate.summary.candidateCatalogJsonSha256);

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

test("Batch 1+2 candidate preserves the signed v2 release and all execution gates", async () => {
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
