const assert = require("node:assert/strict");
const test = require("node:test");

const batch = require("../docs/research/community-skill-batch1-complete-candidate-2026-08-08.json");
const forbidden = new Set(["command", "args", "env", "headers", "credentials", "script", "secret", "token", "endpoint", "path"]);

function visit(value) {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(forbidden.has(key), false, `forbidden candidate key: ${key}`);
    visit(child);
  }
}

test("community Skill Batch 1 complete index is canonical, unique, and non-executable", () => {
  assert.equal(batch.candidateOnly, true);
  assert.equal(batch.publishable, false);
  assert.equal(batch.candidates.length, 100);
  assert.equal(new Set(batch.candidates.map((item) => item.canonicalKey)).size, 100);
  const coverage = {};
  for (const item of batch.candidates) {
    assert.match(item.canonicalSource, /^https:\/\//);
    assert.match(item.originalAuthor.url, /^https:\/\//);
    assert.equal(item.sourceKind, "reviewed-community");
    assert.equal(item.sourcePlatform, "github");
    assert.equal(item.reviewStatus, "manually-reviewed");
    assert.equal(item.riskLevel, "guarded");
    assert.ok(item.rawTags.length);
    assert.ok(item.normalizedTags.length);
    assert.ok(item.aliasMergeCandidates);
    for (const tag of item.normalizedTags) coverage[tag] = (coverage[tag] || 0) + 1;
    if (item.license.status === "unresolved") assert.match(item.decision, /^blocked-/);
    visit(item);
  }
  assert.deepEqual(coverage, batch.summary.classificationCoverage);
  assert.equal(batch.summary.verifiedCandidates, 100);
  assert.equal(batch.summary.originalAuthorDirectLinkCoverage, 1);
  visit(batch);
});
