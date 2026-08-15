const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const candidatePath = path.join(root, "docs/research/community-skill-store-cocoloop-small-batch3-candidate-active7-2026-08-14.json");
const activePath = path.join(root, "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json");
const ledgerManifest = [
  "community-skill-store-batch2-canonical-merge-candidate-draft89-active6-2026-08-09.json",
  "community-skill-store-batch3-canonical-merge-candidate-draft89-active6-2026-08-09.json",
  "community-skill-store-cocoloop-next-batch-candidate-active7-2026-08-13.json",
  "community-skill-store-cocoloop-small-batch2-candidate-active7-2026-08-14.json",
  "community-skill-store-index-re-review-2026-08-09.json",
  "community-skill-store-listing-batch1-candidate-draft89-active6-2026-08-08.json",
  "community-skill-store-listing-batch1-canonical-merge-candidate-draft89-active6-2026-08-08.json"
];
function discoverLedgerPaths() {
  const directory = path.join(root, "docs/research");
  return fs.readdirSync(directory)
    .filter((file) => /^community-skill-store-.*(?:candidate|review|index).*\.json$/i.test(file))
    .map((file) => path.join(directory, file))
    .filter((file) => file !== candidatePath)
    .sort();
}

const id = (value) => String(value).trim().toLowerCase();
const name = (value) => String(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
function collectReviewIdentities(value, result = { ids: new Set(), names: new Set(), canonicals: new Set() }) {
  if (Array.isArray(value)) { value.forEach((item) => collectReviewIdentities(item, result)); return result; }
  if (!value || typeof value !== "object") return result;
  const idFields = ["cocoloopId", "candidateId", "resourceId"];
  const canonicalFields = ["canonicalKey", "externalId", "canonicalSource"];
  const identified = [...idFields, ...canonicalFields].some((field) => Object.hasOwn(value, field));
  for (const field of idFields) if (value[field] != null) result.ids.add(id(value[field]));
  for (const field of canonicalFields) if (value[field] != null) result.canonicals.add(id(value[field]));
  if (identified && value.name != null) result.names.add(name(value.name));
  for (const [key, child] of Object.entries(value)) {
    if (["resource", "proposedResource"].includes(key) && child && typeof child === "object") {
      if (child.id != null) result.ids.add(id(child.id));
      if (child.name != null) result.names.add(name(child.name));
    }
    collectReviewIdentities(child, result);
  }
  return result;
}
const forbiddenFieldNames = ["endpoint", "endpoints", "command", "commands", "args", "env", "headers", "credentials", "token", "apiKey", "install", "runtime", "script", "scripts", "executable", "shell", "powershell", "cmd", "download", "downloadPolicy", "installCommand", "packageName", "packageSpec", "artifact", "workflowId", "agentBinding", "managedInstall"];
function forbiddenKeys(value, found = [], pathParts = []) {
  const forbidden = new Set(forbiddenFieldNames.map((key) => key.toLowerCase()));
  if (Array.isArray(value)) value.forEach((item, index) => forbiddenKeys(item, found, [...pathParts, String(index)]));
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
    const current = [...pathParts, key];
    const negativeSafetyAttestation = pathParts.length === 1 && pathParts[0] === "safety" && ["managedInstall", "agentBinding"].includes(key) && child === false;
    if (forbidden.has(key.toLowerCase()) && !negativeSafetyAttestation) found.push(current.join("."));
    forbiddenKeys(child, found, current);
  }
  return found;
}

function assertProposedNovelty(change, active, history) {
  assert.equal(active.ids.has(id(change.resource.id)), false, "resource ID must be novel in active7");
  assert.equal(active.names.has(name(change.resource.name)), false, "resource name must be novel in active7");
  assert.equal(active.canonicals.has(id(change.canonicalKey)), false, "canonical key must be novel in active7");
  assert.equal(history.ids.has(id(change.resource.id)), false, "resource ID must be novel in history");
  assert.equal(history.names.has(name(change.resource.name)), false, "resource name must be novel in history");
  assert.equal(history.canonicals.has(id(change.canonicalKey)), false, "canonical key must be novel in history");
}

test("proposed identities reject semantic history collisions without treating URL/order numbers as IDs", () => {
  const active = { ids: new Set(), names: new Set(), canonicals: new Set() };
  const makeChange = (resourceId, resourceName, canonicalKey) => ({ resourceId, canonicalKey, resource: { id: resourceId, name: resourceName } });
  assert.throws(() => assertProposedNovelty(makeChange("800", "new", "new:key"), active, collectReviewIdentities({ cocoloopId: 800, name: "old" })), { name: "AssertionError" });
  assert.throws(() => assertProposedNovelty(makeChange("new", "  WEATHER  ", "new:key"), active, collectReviewIdentities({ candidateId: "old", name: "weather" })), { name: "AssertionError" });
  assert.throws(() => assertProposedNovelty(makeChange("new", "new", "github:owner/repo#skill"), active, collectReviewIdentities({ canonicalKey: "GITHUB:OWNER/REPO#SKILL" })), { name: "AssertionError" });
  assert.doesNotThrow(() => assertProposedNovelty(makeChange("800", "new", "new:key"), active, collectReviewIdentities({ sourceUrl: "https://example.test/800", order: 800 })));
});

test("forbidden execution and credential keys are rejected recursively", () => {
  const nested = { proposedChanges: [{ resource: { metadataSnapshot: Object.fromEntries(forbiddenFieldNames.map((key) => [key, "x"])) } }] };
  assert.deepEqual(forbiddenKeys(nested), forbiddenFieldNames.map((key) => `proposedChanges.0.resource.metadataSnapshot.${key}`));
});

test("CocoLoop small batch 3 freezes one novel link-only active7 candidate", () => {
  assert.equal(fs.existsSync(candidatePath), true, "candidate must exist");
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const active = JSON.parse(fs.readFileSync(activePath, "utf8")).payload.catalog;
  const ledgerPaths = discoverLedgerPaths();
  assert.deepEqual(ledgerPaths.map((file) => path.basename(file)), ledgerManifest);
  const prior = collectReviewIdentities(ledgerPaths.map((file) => JSON.parse(fs.readFileSync(file, "utf8"))));
  const activeIdentities = {
    ids: new Set(active.resources.map((resource) => id(resource.id))),
    names: new Set(active.resources.map((resource) => name(resource.name))),
    canonicals: new Set(active.resources.map((resource) => resource.metadataSnapshot?.externalId).filter(Boolean).map(id))
  };

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.freezeOnly, true);
  assert.deepEqual(candidate.discovery, { observed: 5, candidate: 1, deferred: 2, blocked: 2, nonCandidate: 4 });
  assert.equal(candidate.reviewLedger.length, 5);
  for (const entry of candidate.reviewLedger) {
    assert.equal(activeIdentities.ids.has(id(entry.cocoloopId)), false);
    assert.equal(activeIdentities.names.has(name(entry.name)), false);
    assert.equal(prior.ids.has(id(entry.cocoloopId)), false);
    assert.equal(prior.names.has(name(entry.name)), false);
  }

  assert.equal(candidate.proposedChanges.length, 1);
  const change = candidate.proposedChanges[0];
  const resource = change.resource;
  assert.equal(change.resourceId, "openclaw-weather-skill");
  assert.equal(change.canonicalKey, "github:openclaw/openclaw#skills/weather");
  assertProposedNovelty(change, activeIdentities, prior);
  assert.equal(resource.publisher, "OpenClaw Foundation");
  assert.deepEqual(resource.sourceProductIds, []);
  assert.deepEqual(resource.targets, [{ productId: "openclaw-agent", compatibility: "official", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true }]);
  assert.equal(resource.versionRef, "6f99d3405cec1221c4fd9fa30f89795acc5f427d");
  assert.equal(resource.metadataSnapshot.sourceRevision, resource.versionRef);
  assert.equal(resource.metadataSnapshot.licenseId, "MIT");
  assert.equal(resource.tutorial, `https://github.com/openclaw/openclaw/blob/${resource.versionRef}/skills/weather/SKILL.md`);
  assert.deepEqual(resource.provenanceEvidence, [resource.tutorial, `https://github.com/openclaw/openclaw/blob/${resource.versionRef}/LICENSE`]);
  assert.deepEqual(forbiddenKeys(candidate), []);

  const projected = structuredClone(active);
  projected.resources.push(resource);
  const validated = validateCatalog(projected);
  assert.equal(validated.resources.length, 251);
  assert.equal(validated.resources.reduce((sum, item) => sum + item.targets.length, 0), 778);
  validated.resources = validated.resources.filter((item) => item.id !== resource.id);
  assert.deepEqual(validated, active);
});
