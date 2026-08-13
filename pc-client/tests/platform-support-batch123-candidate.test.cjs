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
const candidatePath = path.join(root, "docs/research/platform-support-batch123-canonical-merge-candidate-draft89-active6-2026-08-07.json");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const forbidden = new Set(["command", "args", "env", "headers", "credentials", "script", "artifactUrl", "installProfileId", "moduleId", "downloadUrl", "profile", "endpoint", "path"]);

function assertNoForbiddenKeys(value, at = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoForbiddenKeys(item, `${at}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!forbidden.has(key), `${at}.${key} is forbidden`);
    assertNoForbiddenKeys(item, `${at}.${key}`);
  }
}

test("Batch 1-3 combined product candidate is exact, adapter-validated, and catalog-only", () => {
  const stateRaw = fs.readFileSync(statePath, "utf8");
  const state = JSON.parse(stateRaw);
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const baseline = state.draft.catalog;
  const catalog = structuredClone(baseline);
  const products = new Map(catalog.vendors.flatMap((vendor) => vendor.products.map((product) => [product.id, { vendor, product }])));
  const inputs = new Map(candidate.source.evidenceInputs.map((input) => {
    const raw = fs.readFileSync(path.join(root, input.path), "utf8");
    return [input.batch, { input, raw, evidence: JSON.parse(raw) }];
  }));

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.recommendedConsumption, true);
  assert.equal(state.draft.revision, candidate.source.draftRevision);
  assert.equal(state.activeCatalogVersion, candidate.source.v1ActiveCatalogVersion);
  assert.equal(state.activeReleaseId, candidate.source.v1ActiveReleaseId);
  assert.equal(state.channels.v2.activeCatalogVersion, candidate.source.v2ActiveCatalogVersion);
  assert.equal(state.channels.v2.activeReleaseId, candidate.source.v2ActiveReleaseId);
  assert.equal(sha256(stateRaw), candidate.source.stateSha256);
  assert.equal(sha256(JSON.stringify(baseline)), candidate.source.draftCatalogJsonSha256);
  assert.equal(products.size, 615);
  assert.equal(catalog.resources.length, 146);
  assert.equal(catalog.resources.reduce((count, resource) => count + resource.targets.length, 0), 513);
  assert.equal(catalog.resourceStores.length, 4);

  const records = new Map();
  for (const [batch, { input, raw, evidence }] of inputs) {
    assert.equal(sha256(raw), input.sha256);
    assert.equal(evidence.sourceRevision, candidate.source.draftRevision);
    assert.equal(evidence.activeReleaseId, candidate.source.v2ActiveReleaseId);
    assert.equal(evidence.records.length, input.productCount);
    assert.equal(evidence.records.reduce((count, record) => count + record.claims.length, 0), input.claimCount);
    for (const record of evidence.records) {
      assert.ok(!records.has(record.productId), `cross-batch product overlap: ${record.productId}`);
      records.set(record.productId, { batch, evidence, record });
    }
  }
  assert.equal(records.size, 90);

  const changed = new Set();
  const statuses = { supported: 0, unknown: 0, unsupported: 0, blocked: 0 };
  let claimCount = 0;
  for (const change of candidate.proposedChanges) {
    assert.ok(!changed.has(change.productId), `duplicate candidate product: ${change.productId}`);
    changed.add(change.productId);
    const source = records.get(change.productId);
    const matched = products.get(change.productId);
    assert.ok(source, `missing exact evidence record: ${change.productId}`);
    assert.ok(matched, `missing catalog product: ${change.productId}`);
    assert.equal(source.batch, change.sourceBatch);
    assert.equal(source.record.vendorId, change.vendorId);
    assert.equal(matched.vendor.id, change.vendorId);
    assert.deepEqual(validateOptionalPlatformSupport(source.record.claims, { now: source.evidence.checkedAt }), { configured: true });
    assertNoForbiddenKeys(source.record, change.productId);
    matched.product.platformSupport = structuredClone(source.record.claims);
    for (const claim of source.record.claims) {
      claimCount += 1;
      statuses[claim.status] += 1;
    }
  }
  assert.equal(changed.size, 90);
  assert.deepEqual([...changed].sort(), [...records.keys()].sort());
  assert.equal(claimCount, 271);
  assert.deepEqual(statuses, { supported: 209, unknown: 58, unsupported: 4, blocked: 0 });
  assert.deepEqual(statuses, (({ supported, unknown, unsupported, blocked }) => ({ supported, unknown, unsupported, blocked }))(candidate.summary));

  const openCode = records.get("opencode").record.claims;
  assert.ok(openCode.some((claim) => claim.platform === "windows" && claim.runtime === "wsl" && claim.status === "supported"));
  assert.ok(openCode.some((claim) => claim.platform === "windows" && claim.runtime === "native" && claim.status === "unknown"));
  assert.ok(openCode.some((claim) => claim.platform === "macos" && claim.runtime === "native" && claim.status === "unknown"));
  assert.ok(openCode.some((claim) => claim.platform === "linux" && claim.runtime === "native" && claim.status === "supported"));
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.doesNotThrow(() => validatePublication(catalog, defaultReleaseSettings()));
  assert.equal(sha256(JSON.stringify(catalog)), candidate.summary.candidateCatalogJsonSha256);

  for (const vendor of catalog.vendors) for (const product of vendor.products) {
    const original = baseline.vendors.find((item) => item.id === vendor.id).products.find((item) => item.id === product.id);
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

test("Batch 1-3 candidate reads both signed channels without signing", async () => {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const store = createReleaseStore({
    rootDirectory: path.join(root, "admin/published/catalog-store"),
    signingKeyProvider: async () => { throw new Error("candidate test must not sign"); }
  });
  const legacy = await store.readChannel("v1");
  const v2 = await store.readChannel("v2");
  for (const [name, channel] of [["v1", legacy], ["v2", v2]]) {
    const release = await store.readRelease(channel.activeRelease.releaseId, { channel: name });
    assert.doesNotThrow(() => verifySignedEnvelope(release.envelope, { kind: "catalog", trustedKeys: state.trustedKeys }));
  }
  assert.equal(legacy.activeCatalogVersion, 72);
  assert.equal(v2.activeCatalogVersion, 6);
});
