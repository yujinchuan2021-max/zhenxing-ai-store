"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { createResourceMarketplace } = require("../shared/resource-marketplace.cjs");

const root = path.resolve(__dirname, "..");
const inputs = Object.freeze({
  active7: {
    path: "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json",
    sha256: "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4"
  },
  consolidation: {
    path: "docs/research/resource-store-next-major-consolidation-active7-2026-08-14.json",
    sha256: "131182b35aaf510230c574f343c7174a860e8a1a1a0df5e3cd0e03558840373c"
  },
  scenarioTagsOverlay: {
    path: "docs/research/community-skill-scenario-tags-overlay-candidate-active7-2026-08-13.json",
    sha256: "4cd3a7fe2444103181d517eaf63ea344529cabf947e959779bdc5c3957d1582c"
  },
  resourceConnectionRelations: {
    path: "docs/research/resource-connection-relations-next-major-candidate-active7-2026-08-14.json",
    sha256: "7cd8e1c27a685b6f1e88e6680d7b73efde8404419a807bf2d848b10e634f7017"
  }
});
const outputPath =
  "docs/research/resource-store-next-major-catalog-candidate-active7-2026-08-14.json";

function bytes(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function reject(message) {
  throw new Error(`next-major catalog candidate rejected: ${message}`);
}

function assertFrozenInputHashes(actualHashes) {
  for (const [name, input] of Object.entries(inputs)) {
    if (actualHashes?.[name] !== input.sha256) reject(`frozen input drift: ${input.path}`);
  }
}

function buildCandidate({ activeEnvelope, consolidation, overlay, relations }) {
  const active = activeEnvelope.payload?.catalog;
  if (
    activeEnvelope.payload?.catalogVersion !== 7 ||
    active?.schemaVersion !== 2 ||
    active.resources?.length !== 250 ||
    active.resources.reduce((count, resource) => count + resource.targets.length, 0) !== 777
  ) {
    reject("active7 identity or totals mismatch");
  }
  if (
    consolidation.candidateOnly !== true ||
    consolidation.freezeOnly !== true ||
    consolidation.publishable !== false ||
    consolidation.proposedResources?.length !== 7
  ) {
    reject("consolidation contract mismatch");
  }
  if (
    overlay.candidateOnly !== true ||
    overlay.publishable !== false ||
    overlay.overlays?.length !== 104
  ) {
    reject("scenarioTags overlay contract mismatch");
  }
  if (
    relations.candidateOnly !== true ||
    relations.freezeOnly !== true ||
    relations.publishable !== false ||
    relations.resourceFamilies?.length !== 10
  ) {
    reject("resource relationship contract mismatch");
  }

  const catalog = structuredClone(active);
  const resourceById = new Map(catalog.resources.map((resource) => [resource.id, resource]));
  if (resourceById.size !== catalog.resources.length) reject("active7 resource ID collision");
  const communitySkillIds = new Set(
    active.resources
      .filter(
        (resource) =>
          resource.sourceKind === "reviewed-community" &&
          resource.resourceTypes.includes("skill")
      )
      .map((resource) => resource.id)
  );
  const officialSkillIds = new Set(
    active.resources
      .filter(
        (resource) =>
          resource.sourceKind === "official" && resource.resourceTypes.includes("skill")
      )
      .map((resource) => resource.id)
  );
  if (communitySkillIds.size !== 104 || officialSkillIds.size !== 16) {
    reject("active7 Skill source partition mismatch");
  }

  const taggedIds = new Set();
  for (const row of overlay.overlays) {
    const resource = resourceById.get(row.resourceId);
    if (
      !resource ||
      !resource.resourceTypes.includes("skill") ||
      resource.scenarioTags !== undefined ||
      taggedIds.has(row.resourceId) ||
      !Array.isArray(row.scenarioTags) ||
      row.scenarioTags.length === 0
    ) {
      reject(`invalid scenarioTags overlay: ${row.resourceId}`);
    }
    taggedIds.add(row.resourceId);
    resource.scenarioTags = structuredClone(row.scenarioTags);
  }
  if (
    taggedIds.size !== communitySkillIds.size ||
    [...communitySkillIds].some((id) => !taggedIds.has(id)) ||
    [...officialSkillIds].some((id) => taggedIds.has(id))
  ) {
    reject("scenarioTags overlay must exactly cover active7 reviewed-community Skills");
  }

  const consolidatedResources = consolidation.proposedResources.map((row) =>
    structuredClone(row.resource)
  );
  const relationshipResources = relations.resourceFamilies
    .map((family) => family.proposedResource)
    .filter(Boolean)
    .map((resource) => structuredClone(resource));
  if (relationshipResources.length !== 5) reject("projected relationship resource count mismatch");
  const appendedResources = [...consolidatedResources, ...relationshipResources];
  const appendedIds = new Set();
  for (const resource of appendedResources) {
    if (!resource?.id || resourceById.has(resource.id) || appendedIds.has(resource.id)) {
      reject(`appended resource ID collision: ${resource?.id || "unknown"}`);
    }
    if (!Array.isArray(resource.targets) || resource.targets.length === 0) {
      reject(`appended resource targets missing: ${resource.id}`);
    }
    for (const target of resource.targets) {
      if (
        target.moduleId !== "resource-link" ||
        target.installProfileId !== "" ||
        target.enabled !== true ||
        !Array.isArray(target.capabilities) ||
        target.capabilities.length !== 1 ||
        target.capabilities[0] !== "website"
      ) {
        reject(`appended resource is not link-only: ${resource.id}`);
      }
    }
    appendedIds.add(resource.id);
    resourceById.set(resource.id, resource);
    catalog.resources.push(resource);
  }
  if (appendedIds.size !== 12) reject("appended resource count mismatch");

  const resourceConnections = [];
  const connectionKeys = new Set();
  let bindingCount = 0;
  for (const family of relations.resourceFamilies) {
    for (const binding of family.connectionBindings) {
      bindingCount += 1;
      if (binding.status === "unbound") {
        if (binding.dependencies.length !== 0) {
          reject(`unbound dependencies leaked: ${family.resourceId}`);
        }
        continue;
      }
      if (binding.status !== "bound" || !family.proposedResource) {
        reject(`invalid bound relationship: ${family.resourceId}`);
      }
      for (const dependency of binding.dependencies) {
        if (
          dependency.kind !== "resource" ||
          dependency.canonicalId !== family.resourceId ||
          dependency.canonicalId !== family.proposedResource.id
        ) {
          reject(`relationship identity mismatch: ${family.resourceId}`);
        }
        const connection = {
          resourceId: dependency.canonicalId,
          hostProductId: dependency.hostProductId,
          connectionMode: binding.connectionMode,
          bindingKind: dependency.bindingKind
        };
        const key = Object.values(connection).join("\u0000");
        if (connectionKeys.has(key)) reject(`duplicate relationship edge: ${family.resourceId}`);
        connectionKeys.add(key);
        resourceConnections.push(connection);
      }
    }
  }
  if (bindingCount !== 12 || resourceConnections.length !== 10) {
    reject("relationship binding totals mismatch");
  }

  const storeMemberships = Object.fromEntries(
    ["skill", "mcp", "plugin", "connector"].map((store) => [
      store,
      catalog.resources.filter((resource) => resource.resourceTypes.includes(store)).length
    ])
  );
  const summary = {
    resources: catalog.resources.length,
    targets: catalog.resources.reduce((count, resource) => count + resource.targets.length, 0),
    storeMemberships,
    scenarioTaggedSkills: catalog.resources.filter(
      (resource) => resource.resourceTypes.includes("skill") && resource.scenarioTags?.length
    ).length,
    unclassifiedSkills: catalog.resources.filter(
      (resource) => resource.resourceTypes.includes("skill") && !resource.scenarioTags?.length
    ).length,
    appendedResources: appendedResources.length,
    resourceConnections: resourceConnections.length
  };
  assert.deepEqual(summary, {
    resources: 262,
    targets: 796,
    storeMemberships: { skill: 124, mcp: 126, plugin: 8, connector: 9 },
    scenarioTaggedSkills: 104,
    unclassifiedSkills: 20,
    appendedResources: 12,
    resourceConnections: 10
  });

  const reversed = structuredClone(catalog);
  reversed.resources = reversed.resources.filter((resource) => !appendedIds.has(resource.id));
  const reversedById = new Map(reversed.resources.map((resource) => [resource.id, resource]));
  for (const row of overlay.overlays) {
    assert.deepEqual(reversedById.get(row.resourceId)?.scenarioTags, row.scenarioTags);
    delete reversedById.get(row.resourceId).scenarioTags;
  }
  assert.deepEqual(reversed, active);

  const candidate = {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: "2026-08-14T00:00:00.000Z",
    title: "active7 next-major resource store catalog candidate",
    inputs,
    summary,
    catalog,
    resourceConnections,
    safety: {
      candidateOnly: true,
      freezeOnly: true,
      publishable: false,
      linkOnlyNewTargets: true,
      credentialsCollected: false,
      catalogWritten: false,
      stateWritten: false,
      signed: false,
      published: false
    }
  };

  validateCatalog(candidate.catalog);
  createResourceMarketplace({
    ...candidate.catalog,
    connections: candidate.resourceConnections
  });
  return candidate;
}

function main() {
  const rawInputs = Object.fromEntries(
    Object.entries(inputs).map(([name, input]) => [name, bytes(input.path)])
  );
  assertFrozenInputHashes(
    Object.fromEntries(Object.entries(rawInputs).map(([name, raw]) => [name, sha256(raw)]))
  );
  const candidate = buildCandidate({
    activeEnvelope: JSON.parse(rawInputs.active7.toString("utf8")),
    consolidation: JSON.parse(rawInputs.consolidation.toString("utf8")),
    overlay: JSON.parse(rawInputs.scenarioTagsOverlay.toString("utf8")),
    relations: JSON.parse(rawInputs.resourceConnectionRelations.toString("utf8"))
  });
  fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, summary: candidate.summary })}\n`);
}

if (require.main === module) main();

module.exports = { assertFrozenInputHashes, buildCandidate };
