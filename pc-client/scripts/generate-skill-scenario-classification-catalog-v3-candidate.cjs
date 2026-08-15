"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { canonicalScenarioTags } = require("../shared/catalog-taxonomy.cjs");

const root = path.resolve(__dirname, "..");
const inputs = Object.freeze({
  baseCatalogV3: Object.freeze({
    path: "docs/research/desktop-edition-gap-catalog-v3-candidate-2026-08-15.json",
    sha256: "354003c55e69abded51e16858b75f654d3ee642c36b46ff42c03791660c485b8"
  }),
  research: Object.freeze({
    path: "docs/research/2026-08-15-official-skill-scenario-classification-review.md",
    sha256: "ac27f5465c4dffe71885a73d4c1d9ad6810bb3ea83ce9da3761f2b4828349076"
  })
});
const outputPath =
  "docs/research/skill-scenario-classification-catalog-v3-candidate-2026-08-15.json";

const reviewLedger = Object.freeze([
  ["openai-codex-skills-catalog", "official", null],
  ["openai-chatgpt-apps-skill", "official", ["programming-development"]],
  ["anythingllm-agent-skills", "official", ["agent-multi-agent", "automation-rpa"]],
  ["minimax-official-skills", "official", null],
  ["pika-mcp-skills", "official", ["video-audio"]],
  ["hf-agent-skills", "official", ["agent-multi-agent"]],
  ["openclaw-clawhub-skills", "official", null],
  ["hermes-agent-skills", "official", ["agent-multi-agent"]],
  ["cline-official-skills-plugins", "official", ["programming-development", "agent-multi-agent"]],
  ["opencode-agent-skills", "official", ["programming-development", "agent-multi-agent"]],
  ["matlab-agentic-toolkit", "official", ["programming-development", "data-analytics"]],
  ["simulink-agentic-toolkit", "official", ["programming-development", "3d-cad-industrial"]],
  ["nvidia-omniverse-agent-skills", "official", ["programming-development", "3d-cad-industrial"]],
  ["cesium-agent-skills", "official", ["programming-development", "3d-cad-industrial"]],
  ["meshy-3d-skill", "official", ["3d-cad-industrial"]],
  ["krea-agent-skills", "official", ["image-design", "video-audio"]],
  ["openclaw-summarize-skill", "reviewed-community", ["knowledge-docs", "writing-content", "video-audio", "browser-information-collection"]],
  ["openclaw-wacli-skill", "reviewed-community", ["social-communication"]],
  ["openclaw-mcporter-skill", "reviewed-community", ["programming-development", "agent-multi-agent"]],
  ["openclaw-weather-skill", "reviewed-community", ["life-health", "browser-information-collection"]],
  ["aws-agent-toolkit-agents-build", "official", ["programming-development", "agent-multi-agent", "automation-rpa", "cybersecurity-operations"]],
  ["hermes-one-three-one-rule", "official", ["office-collaboration", "writing-content"]]
].map(([resourceId, sourceKind, scenarioTags]) => Object.freeze({
  resourceId,
  sourceKind,
  scenarioTags: scenarioTags ? Object.freeze(scenarioTags) : null
})));

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function reject(message) {
  throw new Error(`Skill scenario classification candidate rejected: ${message}`);
}

function assertFrozenInputHashes(actualHashes) {
  for (const [name, input] of Object.entries(inputs)) {
    if (actualHashes?.[name] !== input.sha256) {
      reject(`frozen input drift: ${input.path}`);
    }
  }
}

function buildCandidate(baseCandidate) {
  const baseCatalog = baseCandidate?.catalog;
  const productCount = baseCatalog?.vendors?.reduce(
    (count, vendor) => count + vendor.products.length,
    0
  );
  const targetCount = baseCatalog?.resources?.reduce(
    (count, resource) => count + resource.targets.length,
    0
  );
  if (
    baseCandidate?.candidateOnly !== true ||
    baseCandidate?.freezeOnly !== true ||
    baseCandidate?.publishable !== false ||
    baseCatalog?.schemaVersion !== 3 ||
    baseCatalog?.vendors?.length !== 375 ||
    productCount !== 617 ||
    baseCatalog?.resources?.length !== 280 ||
    targetCount !== 866 ||
    baseCatalog?.resourceConnections?.length !== 10
  ) reject("base catalog v3 contract mismatch");
  validateCatalog(baseCatalog);

  const baseSkills = baseCatalog.resources.filter((resource) =>
    resource.resourceTypes.includes("skill")
  );
  const missing = baseSkills.filter((resource) =>
    !Array.isArray(resource.scenarioTags) || resource.scenarioTags.length === 0
  );
  if (baseSkills.length !== 126 || missing.length !== 22) {
    reject("Skill scenario coverage drift");
  }
  assert.deepEqual(
    missing.map(({ id }) => id),
    reviewLedger.map(({ resourceId }) => resourceId)
  );
  for (let index = 0; index < missing.length; index += 1) {
    if (
      missing[index].sourceKind !== reviewLedger[index].sourceKind ||
      Object.hasOwn(missing[index], "scenarioTags")
    ) reject(`reviewed Skill identity drift: ${reviewLedger[index].resourceId}`);
  }
  for (const { resourceId, scenarioTags } of reviewLedger) {
    if (!scenarioTags) continue;
    try {
      assert.deepEqual(canonicalScenarioTags(scenarioTags), scenarioTags);
    } catch {
      reject(`non-canonical scenario tags: ${resourceId}`);
    }
  }

  const catalog = structuredClone(baseCatalog);
  const byId = new Map(catalog.resources.map((resource) => [resource.id, resource]));
  for (const { resourceId, scenarioTags } of reviewLedger) {
    if (scenarioTags) byId.get(resourceId).scenarioTags = [...scenarioTags];
  }
  validateCatalog(catalog);

  const skills = catalog.resources.filter((resource) =>
    resource.resourceTypes.includes("skill")
  );
  const tagged = skills.filter((resource) =>
    Array.isArray(resource.scenarioTags) && resource.scenarioTags.length > 0
  );
  const unclassified = skills.filter((resource) =>
    !Array.isArray(resource.scenarioTags) || resource.scenarioTags.length === 0
  );
  const summary = {
    vendors: catalog.vendors.length,
    products: catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0),
    resources: catalog.resources.length,
    targets: catalog.resources.reduce((count, resource) => count + resource.targets.length, 0),
    resourceConnections: catalog.resourceConnections.length,
    skillResources: skills.length,
    previouslyClassifiedSkills: 104,
    newlyClassifiedSkills: 19,
    classifiedSkills: tagged.length,
    unclassifiedSkills: unclassified.length
  };
  assert.deepEqual(summary, {
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
  assert.deepEqual(
    unclassified.map(({ id }) => id),
    reviewLedger.filter(({ scenarioTags }) => !scenarioTags).map(({ resourceId }) => resourceId)
  );

  const reversed = structuredClone(catalog);
  const reversedById = new Map(reversed.resources.map((resource) => [resource.id, resource]));
  for (const { resourceId, scenarioTags } of reviewLedger) {
    if (scenarioTags) delete reversedById.get(resourceId).scenarioTags;
  }
  assert.deepEqual(reversed, baseCatalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: "2026-08-15T00:00:00.000Z",
    title: "Skill scenario classification catalog v3 candidate",
    inputs,
    summary,
    catalog,
    safety: {
      candidateOnly: true,
      freezeOnly: true,
      publishable: false,
      resourceIdentitiesChanged: false,
      productsChanged: false,
      resourceTargetsChanged: false,
      resourceConnectionsChanged: false,
      scenariosAdded: 19,
      broadCollectionsLeftUnclassified: 3,
      catalogWritten: false,
      stateWritten: false,
      signed: false,
      published: false
    }
  };
}

function main() {
  const rawInputs = Object.fromEntries(
    Object.entries(inputs).map(([name, input]) => [
      name,
      fs.readFileSync(path.join(root, input.path))
    ])
  );
  assertFrozenInputHashes(Object.fromEntries(
    Object.entries(rawInputs).map(([name, raw]) => [name, sha256(raw)])
  ));
  const candidate = buildCandidate(JSON.parse(rawInputs.baseCatalogV3.toString("utf8")));
  fs.writeFileSync(
    path.join(root, outputPath),
    `${JSON.stringify(candidate, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`${JSON.stringify({ outputPath, summary: candidate.summary })}\n`);
}

if (require.main === module) main();

module.exports = {
  assertFrozenInputHashes,
  buildCandidate,
  inputs,
  outputPath,
  reviewLedger
};
