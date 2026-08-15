"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { defaultReleaseSettings, validatePublication } = require("../admin/config-validation.cjs");
const { createReleaseStore } = require("../admin/release-store.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const { EXTENSION_INSTALL_REGISTRY } = require("../shared/extension-install-registry.cjs");
const { validatePlatformSupportClaims } = require("../shared/resource-platform-availability.cjs");
const { verifySignedEnvelope } = require("../shared/signed-release.cjs");

const root = path.resolve(__dirname, "..");
const statePath = path.join(root, "admin/published/catalog-store/state.json");
const candidatePath = path.join(root, "docs/research/resource-store-platform-support-combined-candidate-draft89-active6-2026-08-07.json");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const forbidden = new Set(["command", "args", "env", "headers", "credentials", "script", "secret", "endpoint", "path", "targetOverride"]);

function readJson(relative) {
  const raw = fs.readFileSync(path.join(root, relative), "utf8");
  return { raw, value: JSON.parse(raw) };
}

function unknownClaims(runtime, canonicalSource) {
  return ["windows", "macos", "linux"].map((platform) => ({
    platform,
    runtime,
    status: "unknown",
    architectures: ["unknown"],
    evidence: [{ kind: "first-party", url: canonicalSource, observedAt: "2026-08-07T00:00:00.000Z" }]
  }));
}

function mcpClaims(input, row) {
  if (row.platformClaims) return row.platformClaims;
  if (!input.claimSets) return unknownClaims(row.runtime, row.canonicalSource);
  return input.claimSets[row.claimSetId].claims.map((claim) => ({
    platform: claim.platform,
    runtime: claim.runtime,
    status: claim.status,
    architectures: claim.architectures,
    evidence: [{ kind: claim.evidence.kind, url: row.canonicalSource, observedAt: claim.evidence.observedAt }]
  }));
}

function pluginClaims(input, row) {
  return ["windows", "macos", "linux"].map((platform) => ({
    platform,
    runtime: row.runtimeByPlatform[platform],
    status: row.statusByPlatform[platform],
    architectures: ["unknown"],
    evidence: row.evidence.map((url) => ({ kind: "first-party", url, observedAt: input.source.observedAt }))
  }));
}

function assertNoForbiddenKeys(value, at = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoForbiddenKeys(item, `${at}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!forbidden.has(key), `${at}.${key} is forbidden`);
    assertNoForbiddenKeys(item, `${at}.${key}`);
  }
}

function collectContributions(inputs) {
  const contributions = [];
  for (const input of inputs) {
    if (input.id === "skill") {
      for (const row of input.data.resourceClaims) {
        const target = input.data.targets.find((item) => item.resourceId === row.resourceId);
        contributions.push({
          input,
          resourceId: row.resourceId,
          hosts: target.hostProductIds,
          claims: row.claims,
          targetRecords: target.hostProductIds.map((productId) => ({
            productId,
            moduleId: target.moduleId,
            installProfileId: target.profileIds[0] || "",
            capabilities: target.capabilities
          })),
          review: null
        });
      }
    } else if (input.resourceType === "mcp") {
      for (const row of input.data.resources) contributions.push({ input, resourceId: row.resourceId, hosts: row.hosts, claims: mcpClaims(input.data, row), targetRecords: row.targetTuples || [], review: row.communityReview || null });
    } else if (input.id === "plugin") {
      for (const row of input.data.resourceClaims) contributions.push({
        input,
        resourceId: row.resourceId,
        hosts: [row.hostProductId],
        claims: pluginClaims(input.data, row),
        targetRecords: [{
          productId: row.hostProductId,
          moduleId: row.moduleId,
          installProfileId: row.profileId,
          capabilities: row.capabilities
        }],
        review: null
      });
    } else {
      for (const row of input.data.resources) contributions.push({ input, resourceId: row.resourceId, hosts: [row.hostProductId], claims: row.resourcePlatformClaims, targetRecords: [{ productId: row.hostProductId, ...row.targetTuple }], review: null });
    }
  }
  return contributions;
}

test("combined resource-store candidate normalizes every evidence input without changing the catalog", () => {
  const stateRaw = fs.readFileSync(statePath, "utf8");
  const state = JSON.parse(stateRaw);
  const baseline = state.draft.catalog;
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const inputs = candidate.source.evidenceInputs.map((metadata) => {
    const { raw, value } = readJson(metadata.path);
    assert.equal(sha256(raw), metadata.sha256);
    return { ...metadata, data: value };
  });
  const catalog = structuredClone(baseline);
  const resources = new Map(catalog.resources.map((resource) => [resource.id, resource]));
  const contributions = collectContributions(inputs);
  const byResource = new Map();
  for (const contribution of contributions) (byResource.get(contribution.resourceId) || byResource.set(contribution.resourceId, []).get(contribution.resourceId)).push(contribution);
  const sourceTuples = new Set(contributions.flatMap((contribution) => contribution.hosts.map((host) => `${contribution.resourceId}|${host}`)));
  const activeTuples = new Set(catalog.resources.flatMap((resource) => resource.targets.map((target) => `${resource.id}|${target.productId}`)));

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.recommendedConsumption, true);
  assert.equal(state.draft.revision, candidate.source.draftRevision);
  assert.equal(state.channels.v2.activeCatalogVersion, candidate.source.v2ActiveCatalogVersion);
  assert.equal(state.channels.v2.activeReleaseId, candidate.source.v2ActiveReleaseId);
  assert.equal(sha256(stateRaw), candidate.source.stateSha256);
  assert.equal(catalog.vendors.reduce((total, vendor) => total + vendor.products.length, 0), candidate.source.productCount);
  assert.equal(resources.size, candidate.source.resourceCount);
  assert.equal(activeTuples.size, candidate.source.targetCount);
  assert.equal(catalog.resourceStores.length, candidate.source.resourceStoreCount);
  assert.equal(contributions.length, candidate.summary.resourceContributions);
  assert.equal(byResource.size, candidate.summary.uniqueResources);
  const multiTypeCanonicalResourceIds = catalog.resources.filter((resource) => resource.resourceTypes.length > 1).map((resource) => resource.id).sort();
  assert.equal(candidate.summary.multiTypeCanonicalResourceCount, 3);
  assert.deepEqual(candidate.summary.multiTypeCanonicalResourceIds.slice().sort(), multiTypeCanonicalResourceIds);
  assert.equal(candidate.summary.duplicateContributionAliasCount, contributions.length - byResource.size);
  assert.equal(sourceTuples.size, candidate.summary.uniqueTargetTuples);
  assert.equal(candidate.summary.duplicateTargetReferenceAliasCount, contributions.reduce((count, contribution) => count + contribution.hosts.length, 0) - sourceTuples.size);
  assert.deepEqual([...sourceTuples].sort(), [...activeTuples].sort());
  assertNoForbiddenKeys(contributions.map((contribution) => contribution.claims));

  const platformStatus = {
    windows: { supported: 0, unknown: 0, unsupported: 0, blocked: 0 },
    macos: { supported: 0, unknown: 0, unsupported: 0, blocked: 0 },
    linux: { supported: 0, unknown: 0, unsupported: 0, blocked: 0 }
  };
  const runtimeCounts = { native: 0, remote: 0, wsl: 0, container: 0, browser: 0 };
  const statusCounts = { supported: 0, unknown: 0, unsupported: 0, blocked: 0 };
  let mergedClaims = 0;
  for (const [resourceId, rows] of byResource) {
    const resource = resources.get(resourceId);
    assert.ok(resource, `missing resource ${resourceId}`);
    const merged = new Map();
    for (const row of rows) {
      assert.ok(resource.resourceTypes.includes(row.input.resourceType), `${resourceId} misses ${row.input.resourceType}`);
      assert.deepEqual(validatePlatformSupportClaims(row.claims, { now: candidate.generatedFromCheckedAt }), { valid: true, reason: null });
      for (const claim of row.claims) {
        const key = `${claim.platform}|${claim.runtime}|${claim.status}|${claim.architectures.join(",")}`;
        const output = merged.get(key) || { ...claim, evidence: [] };
        for (const evidence of claim.evidence) if (!output.evidence.some((item) => JSON.stringify(item) === JSON.stringify(evidence))) output.evidence.push(evidence);
        merged.set(key, output);
      }
      for (const targetRecord of row.targetRecords) {
        const target = resource.targets.find((item) => item.productId === targetRecord.productId);
        if (!target) continue;
        for (const field of ["moduleId", "installProfileId", "capabilities", "compatibility", "enabled"]) {
          if (targetRecord[field] !== undefined) assert.deepEqual(target[field], targetRecord[field]);
        }
      }
    }
    const claims = [...merged.values()];
    assert.deepEqual(validatePlatformSupportClaims(claims, { now: candidate.generatedFromCheckedAt }), { valid: true, reason: null });
    mergedClaims += claims.length;
    for (const claim of claims) {
      platformStatus[claim.platform][claim.status] = (platformStatus[claim.platform][claim.status] || 0) + 1;
      runtimeCounts[claim.runtime] = (runtimeCounts[claim.runtime] || 0) + 1;
      statusCounts[claim.status] = (statusCounts[claim.status] || 0) + 1;
    }
  }
  assert.equal(mergedClaims, candidate.summary.resourcePlatformClaims);
  assert.deepEqual(platformStatus, candidate.summary.byPlatformStatus);
  assert.deepEqual(runtimeCounts, candidate.summary.byRuntime);
  assert.deepEqual(statusCounts, candidate.summary.byStatus);
  assert.equal(activeTuples.size * 3, candidate.summary.resourceHostPlatformPreviews);

  const profileIds = catalog.resources.flatMap((resource) => resource.targets.filter((target) => target.installProfileId).map((target) => target.installProfileId));
  assert.equal(profileIds.length, 8);
  assert.ok(profileIds.every((profileId) => EXTENSION_INSTALL_REGISTRY[profileId] && EXTENSION_INSTALL_REGISTRY[profileId].platformSupport === undefined));
  assert.equal(candidate.summary.profilePlatformClaims, 0);
  assert.equal(candidate.summary.available, 0);
  assert.equal(candidate.summary.managedEligible, 0);
  assert.equal(candidate.provenancePreservation.communityReviews.find((review) => review.resourceId === "ableton-mcp-extended").blocked, true);
  assert.equal(candidate.provenancePreservation.communityReviews.find((review) => review.resourceId === "ableton-mcp-extended").licenseStatus, "not-confirmed-in-current-first-party-pass");
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.doesNotThrow(() => validatePublication(catalog, defaultReleaseSettings()));
  assert.deepEqual(catalog, baseline);
  assert.ok(catalog.resources.every((resource) => resource.platformSupport === undefined));
  assert.ok(catalog.resources.every((resource) => resource.targets.every((target) => target.platformSupport === undefined)));
});

test("combined candidate preserves the signed v2 active release and does not sign", async () => {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const store = createReleaseStore({
    rootDirectory: path.join(root, "admin/published/catalog-store"),
    signingKeyProvider: async () => { throw new Error("candidate test must not sign"); }
  });
  const v2 = await store.readChannel("v2");
  const release = await store.readRelease(v2.activeRelease.releaseId, { channel: "v2" });
  assert.doesNotThrow(() => verifySignedEnvelope(release.envelope, { kind: "catalog", trustedKeys: state.trustedKeys }));
  assert.equal(v2.activeCatalogVersion, 6);
  assert.equal(release.envelope.payload.catalog.resources.length, 146);
  assert.equal(release.envelope.payload.catalog.resources.reduce((total, resource) => total + resource.targets.length, 0), 513);
});
