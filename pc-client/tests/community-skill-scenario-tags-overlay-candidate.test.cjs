"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { isCanonicalScenarioTags, SCENARIO_TAGS } = require("../shared/catalog-taxonomy.cjs");

const root = path.join(__dirname, "..");
const candidatePath = path.join(
  root,
  "docs/research/community-skill-scenario-tags-overlay-candidate-active7-2026-08-13.json"
);
const activePath = path.join(
  root,
  "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json"
);
const ledgers = [
  {
    batch: "B1",
    path: "docs/research/community-skill-store-listing-batch1-candidate-draft89-active6-2026-08-08.json",
    rows(value) { return value.readyResources; }
  },
  {
    batch: "B2",
    path: "docs/research/community-skill-store-batch2-canonical-merge-candidate-draft89-active6-2026-08-09.json",
    rows(value) { return value.reviewLedger; }
  },
  {
    batch: "B3",
    path: "docs/research/community-skill-store-batch3-canonical-merge-candidate-draft89-active6-2026-08-09.json",
    rows(value) { return value.reviewLedger; }
  }
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function sha256(relativePath) {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex");
}

test("active7 Skill scenario overlay is exact, evidence-backed, and reversible", () => {
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const active = readJson(path.relative(root, activePath)).payload.catalog;
  const skills = active.resources.filter((resource) => resource.resourceTypes.includes("skill"));
  const community = skills.filter((resource) => resource.sourceKind === "reviewed-community");
  const official = skills.filter((resource) => resource.sourceKind === "official");

  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.source.activeReleaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  assert.equal(candidate.source.activeCatalogVersion, 7);
  assert.equal(candidate.source.activeCatalogSha256, sha256(path.relative(root, activePath)));
  assert.deepEqual(candidate.taxonomy.ids, SCENARIO_TAGS.map((tag) => tag.id));
  assert.equal(candidate.summary.skillCount, 120);
  assert.equal(candidate.summary.taggedCount, 104);
  assert.equal(candidate.summary.unclassifiedCount, 16);
  assert.equal(candidate.overlays.length, 104);
  assert.equal(candidate.unclassified.length, 16);
  assert.equal(new Set(candidate.overlays.map((row) => row.resourceId)).size, 104);

  const expected = new Map();
  for (const ledger of ledgers) {
    const value = readJson(ledger.path);
    const source = candidate.source.reviewedLedgers.find((row) => row.batch === ledger.batch);
    assert.deepEqual(source, {
      batch: ledger.batch,
      path: ledger.path,
      sha256: sha256(ledger.path)
    });
    for (const row of ledger.rows(value)) {
      assert.equal(expected.has(row.resourceId), false, row.resourceId);
      expected.set(row.resourceId, {
        batch: ledger.batch,
        sourceLedger: ledger.path,
        canonicalKey: row.canonicalKey,
        scenarioTags: row.normalizedTags,
        evidenceMode: row.mappingEvidence
          ? "per-tag-first-party-evidence"
          : "frozen-normalized-tags",
        ...(row.mappingEvidence ? { mappingEvidence: row.mappingEvidence } : {})
      });
    }
  }
  assert.equal(expected.size, 104);
  assert.deepEqual([...expected.keys()].sort(), community.map((row) => row.id).sort());

  const overlayById = new Map(candidate.overlays.map((row) => [row.resourceId, row]));
  for (const [resourceId, evidence] of expected) {
    assert.deepEqual(overlayById.get(resourceId), { resourceId, ...evidence });
    assert.equal(isCanonicalScenarioTags(evidence.scenarioTags), true, resourceId);
    assert.ok(evidence.scenarioTags.length > 0 && evidence.scenarioTags.length <= 8, resourceId);
    if (evidence.mappingEvidence) {
      assert.deepEqual(
        evidence.mappingEvidence.map((item) => item.canonicalTag),
        evidence.scenarioTags,
        resourceId
      );
    }
  }

  assert.deepEqual(
    candidate.unclassified,
    official.map((resource) => ({
      resourceId: resource.id,
      sourceKind: "official",
      scenarioTags: [],
      reason: "no frozen per-resource scenario classification evidence"
    }))
  );

  const categoryCounts = Object.fromEntries(SCENARIO_TAGS.map((tag) => [tag.id, 0]));
  for (const row of candidate.overlays) {
    for (const tag of row.scenarioTags) categoryCounts[tag] += 1;
  }
  assert.deepEqual(candidate.summary.categoryCounts, categoryCounts);

  const projected = structuredClone(active);
  for (const resource of projected.resources) {
    const overlay = overlayById.get(resource.id);
    if (overlay) resource.scenarioTags = [...overlay.scenarioTags];
  }
  assert.equal(projected.resources.filter((resource) => resource.scenarioTags?.length).length, 104);
  for (const resource of projected.resources) delete resource.scenarioTags;
  assert.deepEqual(projected, active);
  assert.deepEqual(candidate.safety, {
    skillOnly: true,
    changesOnly: ["resources[].scenarioTags"],
    catalogWritten: false,
    stateWritten: false,
    signed: false,
    published: false
  });
});
