const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const candidatePath = path.join(root, "docs/research/community-skill-store-cocoloop-next-batch-candidate-active7-2026-08-13.json");
const activePath = path.join(root, "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json");
const historicalLedgerPath = path.join(root, "docs/research/community-skill-store-index-re-review-2026-08-09.json");

test("CocoLoop next batch is a frozen, provenance-complete active7-deduped link-only candidate", () => {
  assert.equal(fs.existsSync(candidatePath), true, "frozen candidate artifact must exist");
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const active = JSON.parse(fs.readFileSync(activePath, "utf8")).payload.catalog;
  const historicalLedger = JSON.parse(fs.readFileSync(historicalLedgerPath, "utf8"));
  const activeIds = new Set(active.resources.map((resource) => resource.id));
  const activeCanonicalKeys = new Set(active.resources.map((resource) => resource.metadataSnapshot?.externalId).filter((value) => value?.startsWith("github:")));
  const historicalCanonicalKeys = new Set(historicalLedger.entries.map((entry) => entry.canonicalKey));
  const candidateIds = new Set();
  const candidateKeys = new Set();

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.freezeOnly, true);
  assert.equal(candidate.source.activeReleaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  const outcomeCounts = candidate.reviewLedger.reduce((counts, entry) => {
    counts[entry.outcome] = (counts[entry.outcome] || 0) + 1;
    return counts;
  }, {});
  assert.equal(candidate.discovery.requestedTop, 50);
  assert.equal(candidate.discovery.observed, candidate.reviewLedger.length);
  assert.equal(candidate.discovery.candidate, outcomeCounts.candidate || 0);
  assert.equal(candidate.discovery.deferred, outcomeCounts.deferred || 0);
  assert.equal(candidate.discovery.blocked, outcomeCounts.blocked || 0);
  assert.equal(candidate.discovery.existingBlockedDuplicate, outcomeCounts["existing-blocked-duplicate"] || 0);
  assert.equal(candidate.discovery.nonCandidate, candidate.reviewLedger.length - (outcomeCounts.candidate || 0));
  assert.deepEqual(candidate.discovery, { requestedTop: 50, observed: 10, candidate: 2, deferred: 6, blocked: 1, existingBlockedDuplicate: 1, nonCandidate: 8 });
  assert.equal(candidate.proposedChanges.length, 2);
  assert.equal(candidate.reviewLedger.length, 10);

  for (const change of candidate.proposedChanges) {
    const resource = change.resource;
    assert.equal(change.action, "create-canonical");
    assert.equal(activeIds.has(resource.id), false);
    assert.equal(activeCanonicalKeys.has(change.canonicalKey), false);
    assert.equal(historicalCanonicalKeys.has(change.canonicalKey), false);
    assert.equal(candidateIds.has(resource.id), false);
    assert.equal(candidateKeys.has(change.canonicalKey), false);
    candidateIds.add(resource.id);
    candidateKeys.add(change.canonicalKey);
    assert.equal(resource.sourceKind, "reviewed-community");
    assert.equal(resource.reviewStatus, "manually-reviewed");
    assert.equal(resource.riskLevel, "guarded");
    assert.equal(resource.metadataSnapshot.sourcePlatform, "github");
    assert.equal(resource.metadataSnapshot.discoveredVia, "cocoloop");
    assert.match(resource.metadataSnapshot.sourcePage, /^https:\/\/github\.com\//);
    assert.ok(resource.metadataSnapshot.sourcePage.includes(resource.versionRef));
    assert.match(resource.metadataSnapshot.canonicalSource, /^https:\/\/github\.com\//);
    assert.match(resource.metadataSnapshot.sourceRevision, /^[0-9a-f]{40}$/);
    assert.equal(resource.metadataSnapshot.provenanceStatus, "first-party-verified");
    assert.equal(resource.metadataSnapshot.licenseStatus, "verified");
    assert.equal(resource.versionRef, resource.metadataSnapshot.sourceRevision);
    assert.ok(resource.website.includes(resource.versionRef));
    assert.ok(resource.tutorial.includes(resource.versionRef));
    assert.ok(resource.provenanceEvidence.some((url) => url.includes(resource.versionRef) && url.endsWith("/LICENSE")));
    assert.ok(resource.targets.every((target) => target.moduleId === "resource-link" && target.installProfileId === "" && JSON.stringify(target.capabilities) === '["website"]'));
  }

  const projected = structuredClone(active);
  projected.resources.push(...candidate.proposedChanges.map((change) => change.resource));
  const validated = validateCatalog(projected);
  assert.equal(validated.resources.length, 252);
  assert.equal(validated.resources.reduce((count, resource) => count + resource.targets.length, 0), 779);
});
