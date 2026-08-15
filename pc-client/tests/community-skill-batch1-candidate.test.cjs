const assert = require("node:assert/strict");
const test = require("node:test");
const batch = require("../docs/research/community-skill-batch1-candidate-2026-08-07.json");

const forbidden = new Set(["command", "args", "env", "headers", "credentials", "script", "secret", "token", "path"]);
function visit(value) { if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) { assert.equal(forbidden.has(key), false, `forbidden key: ${key}`); visit(child); } }

test("community Skill Batch 1 is candidate-only, canonical, deduplicated, and non-executable", () => {
  assert.equal(batch.candidateOnly, true);
  assert.equal(batch.publishable, false);
  assert.equal(batch.candidates.length, 20);
  const identities = new Set();
  const taxonomy = {};
  for (const candidate of batch.candidates) {
    assert.match(candidate.canonicalSource, /^https:\/\//);
    assert.match(candidate.originalAuthor.url, /^https:\/\//);
    assert.ok(["reviewed-community", "community"].includes(candidate.sourceKind));
    assert.ok(["low", "guarded", "unsafe"].includes(candidate.riskLevel));
    assert.ok(candidate.rawTags.length > 0 && candidate.normalizedTags.length > 0);
    assert.equal(identities.has(candidate.canonicalKey), false, candidate.canonicalKey);
    identities.add(candidate.canonicalKey);
    for (const tag of candidate.normalizedTags) taxonomy[tag] = (taxonomy[tag] || 0) + 1;
    if (candidate.license.status === "unresolved") assert.match(candidate.decision, /^blocked-/);
  }
  assert.deepEqual(taxonomy, batch.summary.classificationCoverage);
  visit(batch);
});
