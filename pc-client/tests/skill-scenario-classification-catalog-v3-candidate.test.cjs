"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFrozenInputHashes,
  buildCandidate,
  inputs,
  reviewLedger
} = require("../scripts/generate-skill-scenario-classification-catalog-v3-candidate.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const { canonicalScenarioTags } = require("../shared/catalog-taxonomy.cjs");

const candidatePath = path.resolve(
  __dirname,
  "../docs/research/skill-scenario-classification-catalog-v3-candidate-2026-08-15.json"
);

test("Skill scenario classification catalog v3 candidate exists", () => {
  assert.equal(fs.existsSync(candidatePath), true, "candidate must exist");
});

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8"));
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function byResourceId(catalog) {
  return new Map(catalog.resources.map((resource) => [resource.id, resource]));
}

test("candidate adds the exact 19 reviewed scenario classifications and leaves three broad collections unclassified", () => {
  const base = readJson(inputs.baseCatalogV3.path);
  const candidate = readJson(path.relative(path.resolve(__dirname, ".."), candidatePath));
  const baseById = byResourceId(base.catalog);
  const nextById = byResourceId(candidate.catalog);

  assert.deepEqual(candidate.inputs, inputs);
  for (const input of Object.values(inputs)) {
    assert.equal(sha256(fs.readFileSync(path.resolve(__dirname, "..", input.path))), input.sha256);
  }
  assert.deepEqual(candidate.summary, {
    vendors: 375,
    products: 617,
    resources: 280,
    targets: 866,
    resourceConnections: 10,
    skillResources: 126,
    previouslyClassifiedSkills: 104,
    newlyClassifiedSkills: 19,
    classifiedSkills: 123,
    unclassifiedSkills: 3
  });
  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.freezeOnly, true);
  assert.equal(candidate.publishable, false);
  assert.doesNotThrow(() => validateCatalog(candidate.catalog));

  for (const { resourceId, sourceKind, scenarioTags } of reviewLedger) {
    const before = baseById.get(resourceId);
    const after = nextById.get(resourceId);
    assert.equal(before.sourceKind, sourceKind, resourceId);
    assert.equal(Object.hasOwn(before, "scenarioTags"), false, resourceId);
    if (scenarioTags) {
      assert.deepEqual(after.scenarioTags, scenarioTags, resourceId);
      assert.deepEqual(canonicalScenarioTags(after.scenarioTags), scenarioTags, resourceId);
      const reversed = structuredClone(after);
      delete reversed.scenarioTags;
      assert.deepEqual(reversed, before, resourceId);
    } else {
      assert.equal(Object.hasOwn(after, "scenarioTags"), false, resourceId);
      assert.deepEqual(after, before, resourceId);
    }
  }

  const reviewedIds = new Set(reviewLedger.map(({ resourceId }) => resourceId));
  for (const [resourceId, before] of baseById) {
    if (!reviewedIds.has(resourceId)) assert.deepEqual(nextById.get(resourceId), before, resourceId);
  }
  assert.deepEqual(candidate.catalog.vendors, base.catalog.vendors);
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);
});

test("frozen inputs and the exact missing-Skill review surface fail closed", () => {
  const hashes = Object.fromEntries(
    Object.entries(inputs).map(([name, input]) => [name, input.sha256])
  );
  assert.doesNotThrow(() => assertFrozenInputHashes(hashes));
  for (const key of Object.keys(inputs)) {
    assert.throws(
      () => assertFrozenInputHashes({ ...hashes, [key]: "0".repeat(64) }),
      /frozen input drift/
    );
  }

  const base = readJson(inputs.baseCatalogV3.path);
  const alreadyTagged = structuredClone(base);
  byResourceId(alreadyTagged.catalog).get("openai-chatgpt-apps-skill").scenarioTags = [
    "programming-development"
  ];
  assert.throws(() => buildCandidate(alreadyTagged), /coverage drift|identity drift/);

  const wrongSource = structuredClone(base);
  byResourceId(wrongSource.catalog).get("openclaw-weather-skill").sourceKind = "official";
  assert.throws(() => buildCandidate(wrongSource), /identity drift/);

  const reordered = structuredClone(base);
  const firstIndex = reordered.catalog.resources.findIndex(
    ({ id }) => id === "openai-codex-skills-catalog"
  );
  const secondIndex = reordered.catalog.resources.findIndex(
    ({ id }) => id === "openai-chatgpt-apps-skill"
  );
  [reordered.catalog.resources[firstIndex], reordered.catalog.resources[secondIndex]] = [
    reordered.catalog.resources[secondIndex],
    reordered.catalog.resources[firstIndex]
  ];
  assert.throws(() => buildCandidate(reordered), /Expected values|identity drift/);
});

test("pure scenario candidate build is byte-idempotent and equals the frozen artifact", () => {
  const base = readJson(inputs.baseCatalogV3.path);
  const first = `${JSON.stringify(buildCandidate(base), null, 2)}\n`;
  const second = `${JSON.stringify(buildCandidate(base), null, 2)}\n`;
  assert.equal(first, second);
  assert.equal(first, fs.readFileSync(candidatePath, "utf8"));
});
