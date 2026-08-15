"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const { createResourceMarketplace } = require("../shared/resource-marketplace.cjs");
const {
  assertFrozenInputHashes,
  buildCandidate
} = require("../scripts/generate-resource-store-next-major-catalog-candidate.cjs");

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
const candidatePath = path.join(
  root,
  "docs/research/resource-store-next-major-catalog-candidate-active7-2026-08-14.json"
);

function bytes(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(bytes(relativePath).toString("utf8"));
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(bytes(relativePath)).digest("hex");
}

function expectedConnections(relations) {
  return relations.resourceFamilies.flatMap((family) =>
    family.connectionBindings.flatMap((binding) =>
      binding.status === "bound"
        ? binding.dependencies.map((dependency) => ({
            resourceId: dependency.canonicalId,
            hostProductId: dependency.hostProductId,
            connectionMode: binding.connectionMode,
            bindingKind: dependency.bindingKind
          }))
        : []
    )
  );
}

function sourceValues() {
  return {
    activeEnvelope: readJson(inputs.active7.path),
    consolidation: readJson(inputs.consolidation.path),
    overlay: readJson(inputs.scenarioTagsOverlay.path),
    relations: readJson(inputs.resourceConnectionRelations.path)
  };
}

test("next-major catalog candidate exists", () => {
  assert.equal(fs.existsSync(candidatePath), true, "next-major catalog candidate must exist");
});

test("next-major catalog candidate is the exact reversible active7 merge", () => {
  for (const input of Object.values(inputs)) {
    assert.equal(sha256(input.path), input.sha256, `frozen input drift: ${input.path}`);
  }

  const activeEnvelope = readJson(inputs.active7.path);
  const active = activeEnvelope.payload.catalog;
  const consolidation = readJson(inputs.consolidation.path);
  const overlay = readJson(inputs.scenarioTagsOverlay.path);
  const relations = readJson(inputs.resourceConnectionRelations.path);
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));

  assert.deepEqual(Object.keys(candidate).sort(), [
    "candidateOnly",
    "catalog",
    "freezeOnly",
    "generatedAt",
    "inputs",
    "publishable",
    "resourceConnections",
    "safety",
    "schemaVersion",
    "summary",
    "targetRelease",
    "title"
  ]);
  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.freezeOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.targetRelease, "next-major");
  assert.deepEqual(candidate.inputs, inputs);
  assert.equal(candidate.catalog.schemaVersion, 2);
  assert.equal(candidate.catalog.updatedAt, active.updatedAt);
  assert.equal(Object.hasOwn(candidate.catalog, "resourceConnections"), false);

  const consolidatedResources = consolidation.proposedResources.map((row) => row.resource);
  const relationshipResources = relations.resourceFamilies
    .map((family) => family.proposedResource)
    .filter(Boolean);
  const appendedResources = [...consolidatedResources, ...relationshipResources];
  const appendedIds = new Set(appendedResources.map((resource) => resource.id));
  assert.equal(consolidatedResources.length, 7);
  assert.equal(relationshipResources.length, 5);
  assert.equal(appendedIds.size, 12);
  assert.deepEqual(candidate.catalog.resources.slice(active.resources.length), appendedResources);

  const overlayById = new Map(
    overlay.overlays.map((row) => [row.resourceId, row.scenarioTags])
  );
  assert.equal(overlayById.size, 104);
  const activeProjection = candidate.catalog.resources.slice(0, active.resources.length);
  assert.equal(activeProjection.length, 250);
  for (let index = 0; index < active.resources.length; index += 1) {
    const expected = structuredClone(active.resources[index]);
    const scenarioTags = overlayById.get(expected.id);
    if (scenarioTags) expected.scenarioTags = scenarioTags;
    assert.deepEqual(activeProjection[index], expected, `active resource drift: ${expected.id}`);
  }

  assert.equal(candidate.catalog.resources.length, 262);
  assert.equal(
    candidate.catalog.resources.reduce((count, resource) => count + resource.targets.length, 0),
    796
  );
  assert.deepEqual(
    Object.fromEntries(["skill", "mcp", "plugin", "connector"].map((store) => [
      store,
      candidate.catalog.resources.filter((resource) => resource.resourceTypes.includes(store)).length
    ])),
    { skill: 124, mcp: 126, plugin: 8, connector: 9 }
  );
  assert.equal(
    candidate.catalog.resources.filter(
      (resource) => resource.resourceTypes.includes("skill") && resource.scenarioTags?.length
    ).length,
    104
  );
  assert.equal(
    candidate.catalog.resources.filter(
      (resource) => resource.resourceTypes.includes("skill") && !resource.scenarioTags?.length
    ).length,
    20
  );
  assert.deepEqual(candidate.summary, {
    resources: 262,
    targets: 796,
    storeMemberships: { skill: 124, mcp: 126, plugin: 8, connector: 9 },
    scenarioTaggedSkills: 104,
    unclassifiedSkills: 20,
    appendedResources: 12,
    resourceConnections: 10
  });

  for (const resource of appendedResources) {
    assert.ok(resource.targets.length > 0, `missing target: ${resource.id}`);
    for (const target of resource.targets) {
      assert.equal(target.moduleId, "resource-link", `${resource.id} target is not link-only`);
      assert.equal(target.installProfileId, "", `${resource.id} target has install profile`);
      assert.deepEqual(target.capabilities, ["website"], `${resource.id} target capabilities drift`);
    }
  }

  const connections = expectedConnections(relations);
  assert.equal(connections.length, 10);
  assert.deepEqual(candidate.resourceConnections, connections);
  for (const connection of candidate.resourceConnections) {
    assert.deepEqual(Object.keys(connection).sort(), [
      "bindingKind",
      "connectionMode",
      "hostProductId",
      "resourceId"
    ]);
  }
  const connectedIds = new Set(candidate.resourceConnections.map((row) => row.resourceId));
  assert.deepEqual(connectedIds, new Set(relationshipResources.map((resource) => resource.id)));
  for (const id of [
    "lovable-official-mcp",
    "lucid-claude-connector",
    "microsoft-learn-mcp-server",
    ...relations.resourceFamilies
      .filter((family) => !family.proposedResource)
      .map((family) => family.resourceId)
  ]) {
    assert.equal(connectedIds.has(id), false, `unproven connection leaked: ${id}`);
  }
  assert.equal(
    new Set(candidate.resourceConnections.map((row) => JSON.stringify(row))).size,
    10,
    "connection identity must use all four fields"
  );
  const dropbox = candidate.catalog.resources.find(
    (resource) => resource.id === "dropbox-official-ai-connections"
  );
  assert.deepEqual(
    dropbox.targets.map((target) => target.productId),
    ["chatgpt-desktop", "claude-desktop", "openai-codex", "cursor-desktop"]
  );
  assert.deepEqual(
    candidate.resourceConnections
      .filter((row) => row.resourceId === dropbox.id)
      .map((row) => `${row.connectionMode}:${row.hostProductId}:${row.bindingKind}`),
    [
      "remote-mcp:chatgpt-desktop:mcp-tool",
      "remote-mcp:claude-desktop:mcp-tool",
      "remote-mcp:openai-codex:mcp-tool",
      "remote-mcp:cursor-desktop:mcp-tool",
      "chatgpt-app:chatgpt-desktop:connector-authorized-connection",
      "claude-connector:claude-desktop:connector-authorized-connection"
    ]
  );

  const validated = validateCatalog(candidate.catalog);
  assert.equal(validated, candidate.catalog);
  const marketplace = createResourceMarketplace({
    ...candidate.catalog,
    connections: candidate.resourceConnections
  });
  assert.equal(marketplace.browse().length, 262);
  assert.equal(
    marketplace.browse().reduce((count, entry) => count + entry.connections.length, 0),
    10
  );

  const reversed = structuredClone(candidate.catalog);
  reversed.resources = reversed.resources.filter((resource) => !appendedIds.has(resource.id));
  for (const resource of reversed.resources) {
    if (overlayById.has(resource.id)) delete resource.scenarioTags;
  }
  assert.deepEqual(reversed, active);
  assert.deepEqual(candidate.safety, {
    candidateOnly: true,
    freezeOnly: true,
    publishable: false,
    linkOnlyNewTargets: true,
    credentialsCollected: false,
    catalogWritten: false,
    stateWritten: false,
    signed: false,
    published: false
  });
});

test("generator rejects frozen-input drift and malformed merge sources", () => {
  const actualHashes = Object.fromEntries(
    Object.entries(inputs).map(([name, input]) => [name, sha256(input.path)])
  );
  assert.throws(
    () => assertFrozenInputHashes({ ...actualHashes, active7: "0".repeat(64) }),
    /frozen input drift/
  );

  function rejected(mutator, pattern) {
    const values = sourceValues();
    mutator(values);
    assert.throws(() => buildCandidate(values), pattern);
  }

  rejected(
    ({ overlay }) => overlay.overlays.pop(),
    /scenarioTags overlay contract mismatch/
  );
  rejected(
    ({ overlay }) => {
      overlay.overlays[overlay.overlays.length - 1] = structuredClone(overlay.overlays[0]);
    },
    /invalid scenarioTags overlay/
  );
  rejected(
    ({ overlay }) => {
      overlay.overlays[0].resourceId = "openai-codex-skills-catalog";
    },
    /scenarioTags overlay must exactly cover active7 reviewed-community Skills/
  );
  rejected(
    ({ activeEnvelope, overlay }) => {
      activeEnvelope.payload.catalog.resources.find(
        (resource) => resource.id === overlay.overlays[0].resourceId
      ).scenarioTags = ["research"];
    },
    /invalid scenarioTags overlay/
  );
  rejected(
    ({ consolidation }) => {
      consolidation.proposedResources[1].resource.id =
        consolidation.proposedResources[0].resource.id;
    },
    /appended resource ID collision/
  );
  rejected(
    ({ relations }) => {
      relations.resourceFamilies.find((family) => !family.proposedResource)
        .connectionBindings[0].dependencies.push({
          kind: "resource",
          canonicalId: "invented-resource",
          hostProductId: "chatgpt-desktop",
          bindingKind: "mcp-tool"
        });
    },
    /unbound dependencies leaked/
  );
});
