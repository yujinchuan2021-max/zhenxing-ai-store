const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const candidatePath = path.join(root, "docs/research/community-skill-store-cocoloop-small-batch2-candidate-active7-2026-08-14.json");
const activePath = path.join(root, "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json");
const priorCandidatePath = path.join(root, "docs/research/community-skill-store-cocoloop-next-batch-candidate-active7-2026-08-13.json");
const historicalPaths = [
  "docs/research/community-skill-store-listing-batch1-candidate-draft89-active6-2026-08-08.json",
  "docs/research/community-skill-store-batch2-canonical-merge-candidate-draft89-active6-2026-08-09.json",
  "docs/research/community-skill-store-batch3-canonical-merge-candidate-draft89-active6-2026-08-09.json",
  "docs/research/community-skill-store-index-re-review-2026-08-09.json"
].map((relativePath) => path.join(root, relativePath));

function normalizeId(value) {
  return String(value).trim().toLowerCase();
}

function normalizeName(value) {
  return String(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function collectActiveIdentities(resources) {
  return {
    ids: new Set(resources.map((resource) => normalizeId(resource.id))),
    names: new Set(resources.map((resource) => normalizeName(resource.name)))
  };
}

function collectReviewIdentities(values, identities = { ids: new Set(), names: new Set() }) {
  if (Array.isArray(values)) {
    values.forEach((value) => collectReviewIdentities(value, identities));
    return identities;
  }
  if (!values || typeof values !== "object") return identities;
  const idFields = ["cocoloopId", "candidateId", "resourceId", "canonicalKey", "externalId"];
  const hasIdentity = idFields.some((field) => Object.hasOwn(values, field));
  for (const field of idFields) {
    if (values[field] !== undefined && values[field] !== null) identities.ids.add(normalizeId(values[field]));
  }
  if (hasIdentity && values.name !== undefined && values.name !== null) identities.names.add(normalizeName(values.name));
  for (const [key, value] of Object.entries(values)) {
    if ((key === "resource" || key === "proposedResource") && value && typeof value === "object") {
      if (value.id !== undefined && value.id !== null) identities.ids.add(normalizeId(value.id));
      if (value.name !== undefined && value.name !== null) identities.names.add(normalizeName(value.name));
    }
    collectReviewIdentities(value, identities);
  }
  return identities;
}

function assertObservedNovelty(entry, activeIdentities, priorIdentities) {
  const id = normalizeId(entry.cocoloopId);
  const name = normalizeName(entry.name);
  assert.equal(activeIdentities.ids.has(id), false, `observed ID ${entry.cocoloopId} must not appear in active7`);
  assert.equal(activeIdentities.names.has(name), false, `observed name ${entry.name} must not appear in active7`);
  assert.equal(priorIdentities.ids.has(id), false, `observed ID ${entry.cocoloopId} must not appear in prior/history`);
  assert.equal(priorIdentities.names.has(name), false, `observed name ${entry.name} must not appear in prior/history`);
}

test("observed CocoLoop IDs and names reject active catalog string collisions", () => {
  const entry = { cocoloopId: "186", name: "mcporter" };
  const empty = { ids: new Set(), names: new Set() };
  assert.throws(() => assertObservedNovelty(entry, collectActiveIdentities([{ id: "186", name: "other" }]), empty), { name: "AssertionError" });
  assert.throws(() => assertObservedNovelty(entry, collectActiveIdentities([{ id: "other", name: "  MCPORTER  " }]), empty), { name: "AssertionError" });
});

test("numeric CocoLoop IDs in the prior ledger are rejected", () => {
  assert.throws(
    () => assertObservedNovelty(
      { cocoloopId: "186", name: "new-name" },
      { ids: new Set(), names: new Set() },
      collectReviewIdentities({ reviewLedger: [{ cocoloopId: 186, name: "different-name" }], order: 999 })
    ),
    { name: "AssertionError" }
  );
});

test("numeric IDs in explicit historical identity fields are rejected without scanning unrelated numbers", () => {
  assert.throws(
    () => assertObservedNovelty(
      { cocoloopId: "800", name: "another-new-name" },
      { ids: new Set(), names: new Set() },
      collectReviewIdentities({ entries: [{ candidateId: 800 }], sourceUrl: "https://example.test/skills/800", order: 800 })
    ),
    { name: "AssertionError" }
  );
  assert.doesNotThrow(() => assertObservedNovelty(
    { cocoloopId: "999", name: "unrelated" },
    { ids: new Set(), names: new Set() },
    collectReviewIdentities({ sourceUrl: "https://example.test/skills/999", order: 999 })
  ));
});

test("CocoLoop small batch 2 freezes an exact, deduped, link-only active7 candidate seam", () => {
  assert.equal(fs.existsSync(candidatePath), true, "frozen candidate artifact must exist");
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const active = JSON.parse(fs.readFileSync(activePath, "utf8")).payload.catalog;
  const priorCandidate = JSON.parse(fs.readFileSync(priorCandidatePath, "utf8"));
  const historical = historicalPaths.map((filePath) => JSON.parse(fs.readFileSync(filePath, "utf8")));
  const activeIdentities = collectActiveIdentities(active.resources);
  const priorIdentities = collectReviewIdentities([priorCandidate, ...historical]);

  assert.deepEqual(Object.keys(candidate), [
    "schemaVersion", "candidateOnly", "publishable", "freezeOnly", "generatedAt", "title",
    "source", "discovery", "proposedChanges", "reviewLedger", "safety", "rollback"
  ]);
  assert.deepEqual(Object.keys(candidate.source), [
    "discoveryOrigin", "robotsUrl", "sitemapIndex", "activeReleaseId", "activeCatalogVersion",
    "activeResources", "activeTargets", "activeCommunitySkills", "priorCandidateLedger", "historicalReviewLedgers"
  ]);
  assert.deepEqual(Object.keys(candidate.discovery), [
    "observed", "candidate", "deferred", "blocked", "nonCandidate"
  ]);
  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.freezeOnly, true);
  assert.equal(candidate.source.activeReleaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  assert.deepEqual(
    [active.resources.length, active.resources.reduce((count, resource) => count + resource.targets.length, 0), active.resources.filter((resource) => resource.sourceKind === "reviewed-community" && resource.resourceTypes.includes("skill")).length],
    [250, 777, 104]
  );

  const outcomeCounts = candidate.reviewLedger.reduce((counts, entry) => {
    counts[entry.outcome] = (counts[entry.outcome] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(candidate.discovery, { observed: 6, candidate: 1, deferred: 3, blocked: 2, nonCandidate: 5 });
  assert.equal(candidate.discovery.observed, candidate.reviewLedger.length);
  assert.equal(candidate.discovery.candidate, outcomeCounts.candidate || 0);
  assert.equal(candidate.discovery.deferred, outcomeCounts.deferred || 0);
  assert.equal(candidate.discovery.blocked, outcomeCounts.blocked || 0);
  assert.equal(candidate.discovery.nonCandidate, candidate.reviewLedger.length - (outcomeCounts.candidate || 0));
  assert.equal(candidate.proposedChanges.length, 1);

  const activeIds = new Set(active.resources.map((resource) => resource.id));
  const activeKeys = new Set(active.resources.map((resource) => resource.metadataSnapshot?.externalId).filter(Boolean));
  const change = candidate.proposedChanges[0];
  const resource = change.resource;
  assert.deepEqual(Object.keys(change), ["resourceId", "canonicalKey", "action", "resource"]);
  assert.deepEqual(Object.keys(resource), [
    "id", "enabled", "order", "name", "resourceTypes", "description", "website", "tutorial",
    "publisher", "sourceKind", "reviewStatus", "riskLevel", "sourceProductIds", "targets", "versionRef",
    "provenanceEvidence", "lastVerifiedAt", "metadataSnapshot"
  ]);
  assert.deepEqual(Object.keys(resource.metadataSnapshot), [
    "sourcePlatform", "discoveredVia", "sourcePage", "canonicalSource", "originalAuthor", "licenseId",
    "sourceRevision", "provenanceStatus", "externalId", "observedAt", "licenseStatus"
  ]);
  assert.equal(change.resourceId, "openclaw-mcporter-skill");
  assert.equal(change.canonicalKey, "github:openclaw/openclaw#skills/mcporter");
  assert.equal(change.action, "create-canonical");
  assert.equal(resource.id, change.resourceId);
  assert.equal(activeIds.has(resource.id), false);
  assert.equal(activeKeys.has(change.canonicalKey), false);
  assert.equal(priorIdentities.ids.has(normalizeId(change.canonicalKey)), false);
  assert.equal(resource.sourceKind, "reviewed-community");
  assert.equal(resource.reviewStatus, "manually-reviewed");
  assert.equal(resource.riskLevel, "guarded");
  assert.match(resource.versionRef, /^[0-9a-f]{40}$/);
  assert.equal(resource.versionRef, resource.metadataSnapshot.sourceRevision);
  assert.equal(resource.metadataSnapshot.provenanceStatus, "first-party-verified");
  assert.equal(resource.metadataSnapshot.licenseStatus, "verified");
  assert.equal(resource.metadataSnapshot.licenseId, "MIT");
  assert.ok(resource.website.includes(resource.versionRef));
  assert.ok(resource.tutorial.includes(resource.versionRef));
  assert.ok(resource.tutorial.endsWith("/skills/mcporter/SKILL.md"));
  assert.deepEqual(resource.provenanceEvidence, [
    `https://github.com/openclaw/openclaw/blob/${resource.versionRef}/skills/mcporter/SKILL.md`,
    `https://github.com/openclaw/openclaw/blob/${resource.versionRef}/LICENSE`
  ]);
  assert.deepEqual(resource.targets, [{
    productId: "openclaw-agent",
    compatibility: "official",
    moduleId: "resource-link",
    installProfileId: "",
    capabilities: ["website"],
    enabled: true
  }]);
  for (const forbiddenField of [
    "download", "downloadPolicy", "install", "installCommand", "commands", "script", "scripts",
    "packageName", "packageSpec", "artifact", "workflowId", "agentBinding", "managedInstall"
  ]) {
    assert.equal(Object.hasOwn(resource, forbiddenField), false, `resource must not contain ${forbiddenField}`);
  }

  const observedIds = new Set();
  const observedNames = new Set();
  for (const entry of candidate.reviewLedger) {
    assert.deepEqual(Object.keys(entry), ["rank", "cocoloopId", "cocoloopUrl", "name", "outcome", "reason"]);
    assert.match(entry.cocoloopId, /^[1-9]\d*$/);
    assert.equal(entry.cocoloopUrl, `https://hub.cocoloop.cn/skills/${entry.cocoloopId}`);
    assert.ok(["candidate", "deferred", "blocked"].includes(entry.outcome));
    assert.equal(observedIds.has(entry.cocoloopId), false);
    assert.equal(observedNames.has(entry.name), false);
    assertObservedNovelty(entry, activeIdentities, priorIdentities);
    observedIds.add(entry.cocoloopId);
    observedNames.add(entry.name);
  }

  assert.deepEqual(candidate.safety, {
    allTargets: "resource-link with empty installProfileId and website-only capability",
    cocoloopRole: "discovery only; no aggregator payload is catalog provenance",
    downloadedZip: false,
    executedThirdPartyContent: false,
    calledApi: false,
    managedInstall: false,
    agentBinding: false,
    workflowDependency: false,
    stateMutation: false
  });

  const projected = structuredClone(active);
  projected.resources.push(...candidate.proposedChanges.map((change) => change.resource));
  const validated = validateCatalog(projected);
  assert.equal(validated.resources.length, 251);
  assert.equal(validated.resources.reduce((count, item) => count + item.targets.length, 0), 778);
  const candidateIds = new Set(candidate.proposedChanges.map((change) => change.resourceId));
  validated.resources = validated.resources.filter((resource) => !candidateIds.has(resource.id));
  assert.deepEqual(validated, active, "stripping candidate resources must restore exact active7");
});
