"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const { createResourceMarketplace } = require("../shared/resource-marketplace.cjs");

const root = path.resolve(__dirname, "..");
const paths = Object.freeze({
  candidate: "docs/research/resource-connection-relations-next-major-candidate-active7-2026-08-14.json",
  active7: "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json",
  nextMajor: "docs/research/resource-store-next-major-consolidation-active7-2026-08-14.json",
  census: "docs/research/comprehensive-ai-connector-resources-census-2026-08-14.md"
});
const hashes = Object.freeze({
  active7: "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4",
  nextMajor: "131182b35aaf510230c574f343c7174a860e8a1a1a0df5e3cd0e03558840373c",
  census: "aa177c0d7a268f5305c7a295ff112180fd345cda8240d20ba0f726afa35a9dfc"
});

const discoveryIdentities = [
  "openai:plugin-directory",
  "anthropic:connectors-directory",
  "microsoft:m365-copilot-connectors-gallery",
  "cursor:mcp-tools-collection",
  "cursor:plugin-marketplace",
  "github:github-mcp-registry",
  "perplexity:connectors-catalog",
  "mistral:vibe-mcp-connectors-directory"
];
const familyIdentities = [
  "dropbox:official-ai-connections",
  "openai:sharepoint-app",
  "openai:google-drive-app",
  "openai:slack-app",
  "anthropic:google-drive-integration",
  "pagerduty:official-mcp",
  "launchdarkly:official-mcp",
  "snyk:studio-mcp",
  "twilio:docs-mcp",
  "square:official-mcp"
];
const duplicateResourceIds = {
  H12: ["anthropic-claude-code-mcp"],
  H24: ["google-gemini-cli-extensions"],
  S01: ["airtable-mcp-server"],
  S09: ["box-mcp-server"],
  S10: ["notion-mcp"],
  S11: ["slack-mcp-server"],
  S12: ["atlassian-rovo-mcp-server"],
  S13: ["google-gmail-mcp", "google-drive-mcp", "google-docs-mcp", "google-sheets-mcp", "google-slides-mcp", "google-calendar-mcp", "google-chat-mcp", "google-people-mcp"],
  S14: ["figma-mcp-server"],
  S15: ["canva-mcp"],
  S16: ["linear-mcp-server"],
  S17: ["asana-mcp-server-v2"],
  S18: ["monday-platform-mcp"],
  S19: ["hubspot-mcp-server"],
  S20: ["salesforce-hosted-mcp-servers"],
  S21: ["stripe-mcp-server"],
  S22: ["sentry-mcp"],
  S23: ["github-copilot-mcp"],
  S24: ["gitlab-mcp-server"],
  S25: ["servicenow-mcp-server"],
  S26: ["clickup-mcp-server"],
  S27: ["intercom-mcp-server"],
  S28: ["zoom-mcp-server"],
  S29: ["paypal-mcp-server"],
  S30: ["shopify-storefront-mcp"],
  P01: ["zapier-mcp"],
  P02: ["pipedream-mcp"],
  P03: ["composio-mcp"],
  P04: ["make-mcp-server"],
  P05: ["n8n-mcp-server"],
  P10: ["apify-mcp"],
  D01: ["microsoft-azure-mcp"],
  D04: ["cloudflare-api-mcp-server"],
  D05: ["databricks-managed-mcp-directory"],
  D06: ["snowflake-managed-mcp"],
  D07: ["redis-mcp-server"],
  D08: ["neon-mcp"],
  D09: ["mongodb-mcp-server"],
  D10: ["supabase-mcp-server"],
  D11: ["vercel-mcp"],
  L01: ["adobe-for-creativity"],
  L02: ["sketchup-claude-connector"],
  L03: ["affinity-ai-connector"],
  L04: ["lovable-official-mcp"],
  L05: ["lucid-claude-connector"],
  L06: ["microsoft-learn-mcp-server"]
};
const bindingKinds = [
  "skill-context",
  "mcp-tool",
  "mcp-resource",
  "mcp-prompt",
  "plugin-host-extension",
  "connector-authorized-connection"
];
const boundTuplesByFamily = {
  S02: [
    "remote-mcp|chatgpt-desktop|mcp-tool",
    "remote-mcp|claude-desktop|mcp-tool",
    "remote-mcp|openai-codex|mcp-tool",
    "remote-mcp|cursor-desktop|mcp-tool",
    "chatgpt-app|chatgpt-desktop|connector-authorized-connection",
    "claude-connector|claude-desktop|connector-authorized-connection"
  ],
  S05: [
    "chatgpt-app|chatgpt-desktop|connector-authorized-connection"
  ],
  S06: [
    "chatgpt-app|chatgpt-desktop|connector-authorized-connection"
  ],
  S07: [
    "chatgpt-app|chatgpt-desktop|connector-authorized-connection"
  ],
  S08: [
    "claude-integration|claude-desktop|connector-authorized-connection"
  ],
  D12: [],
  D13: [],
  D14: [],
  D15: [],
  D16: []
};

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}
function readJson(relativePath) {
  return JSON.parse(read(relativePath).toString("utf8"));
}
function sha256(relativePath) {
  return crypto.createHash("sha256").update(read(relativePath)).digest("hex");
}
function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}
function censusRows() {
  const tick = String.fromCharCode(96);
  return read(paths.census)
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => {
      const id = line.match(/^\|\s+([HSPDLB]\d{2})\s+\|/);
      if (!id) return null;
      const spans = line.split(tick);
      const classification = spans.at(-2);
      if (!["ready-link-only", "duplicate", "provider-only", "deferred", "blocked"].includes(classification)) return null;
      return { censusId: id[1], canonicalIdentity: spans[1], classification };
    })
    .filter(Boolean);
}
function nextResources(nextMajor) {
  return nextMajor.proposedResources.map((row) => row.resource || row);
}
function runtimeKeys(value, trail = []) {
  const denied = new Set(["command", "args", "env", "headers", "credentials", "token", "apikey", "endpoint", "installprofile"]);
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => runtimeKeys(child, [...trail, String(index)]));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const current = [...trail, key];
    return [
      ...(denied.has(key.toLowerCase()) ? [current.join(".")] : []),
      ...runtimeKeys(child, current)
    ];
  });
}

test("candidate pins the three frozen inputs and stays candidate-only", () => {
  assert.equal(fs.existsSync(path.join(root, paths.candidate)), true);
  const candidate = readJson(paths.candidate);
  assert.deepEqual(
    [candidate.schemaVersion, candidate.candidateOnly, candidate.publishable, candidate.freezeOnly, candidate.targetRelease],
    [1, true, false, true, "next-major"]
  );
  assert.deepEqual(Object.keys(candidate), [
    "schemaVersion",
    "candidateOnly",
    "publishable",
    "freezeOnly",
    "targetRelease",
    "generatedAt",
    "title",
    "inputs",
    "summary",
    "bindingContract",
    "discoveryCollections",
    "resourceFamilies",
    "duplicateMappings",
    "providerOnly",
    "reviewLedger",
    "safety"
  ]);
  assert.deepEqual(candidate.inputs, {
    active7: { path: paths.active7, sha256: hashes.active7, resources: 250, targets: 777 },
    nextMajorConsolidation: { path: paths.nextMajor, sha256: hashes.nextMajor, proposedResources: 7 },
    connectorCensus: { path: paths.census, sha256: hashes.census, censusIds: 106 }
  });
  assert.equal(sha256(paths.active7), hashes.active7);
  assert.equal(sha256(paths.nextMajor), hashes.nextMajor);
  assert.equal(sha256(paths.census), hashes.census);
  assert.deepEqual(candidate.summary, {
    censusIds: 106,
    readyLinkOnly: 18,
    discoveryCollections: 8,
    canonicalResourceFamilies: 10,
    duplicateMappings: 46,
    duplicateResourceIds: 53,
    active7DuplicateRows: 43,
    nextMajorDuplicateRows: 3,
    providerOnly: 14,
    deferred: 22,
    blocked: 6,
    projectedResources: 5,
    connectionBindings: 12,
    boundDependencyTuples: 10,
    unboundBindings: 5
  });
  assert.deepEqual(candidate.safety, {
    relationSnapshotOnly: true,
    writesProduction: false,
    installsOrRunsConnectors: false,
    collectsCredentials: false,
    requiresCtoAudit: true
  });
  assert.deepEqual(runtimeKeys(candidate), []);
});

test("all 106 census IDs are classified once and ready is exactly 8 collections plus 10 families", () => {
  const candidate = readJson(paths.candidate);
  const census = censusRows();
  assert.equal(census.length, 106);
  assert.equal(new Set(census.map((row) => row.censusId)).size, 106);
  const censusByClass = Object.fromEntries(
    ["ready-link-only", "duplicate", "provider-only", "deferred", "blocked"].map(
      (classification) => [
        classification,
        sorted(census.filter((row) => row.classification === classification).map((row) => row.censusId))
      ]
    )
  );
  const candidateByClass = {
    "ready-link-only": sorted([
      ...candidate.discoveryCollections.map((row) => row.censusId),
      ...candidate.resourceFamilies.map((row) => row.censusId)
    ]),
    duplicate: sorted(Object.keys(candidate.duplicateMappings)),
    "provider-only": sorted(candidate.providerOnly),
    deferred: sorted(candidate.reviewLedger.deferred),
    blocked: sorted(candidate.reviewLedger.blocked)
  };
  assert.deepEqual(candidateByClass, censusByClass);
  assert.equal(Object.values(candidateByClass).flat().length, 106);
  assert.equal(new Set(Object.values(candidateByClass).flat()).size, 106);
  assert.deepEqual(candidate.discoveryCollections.map((row) => row.canonicalIdentity), discoveryIdentities);
  assert.deepEqual(candidate.resourceFamilies.map((row) => row.canonicalIdentity), familyIdentities);
  assert.equal(candidate.discoveryCollections.every((row) => row.relationKind === "discovery-collection" && row.resourceCreated === false), true);
  for (const row of candidate.discoveryCollections) {
    assert.deepEqual(Object.keys(row), [
      "censusId",
      "canonicalIdentity",
      "sourceUrl",
      "relationKind",
      "resourceCreated"
    ]);
  }
  for (const row of candidate.resourceFamilies) {
    assert.deepEqual(Object.keys(row), [
      "censusId",
      "canonicalIdentity",
      "resourceId",
      "sourceUrl",
      "credentialPolicy",
      "connectionBindings",
      "proposedResource"
    ]);
  }
  const identityById = new Map(census.map((row) => [row.censusId, row.canonicalIdentity]));
  for (const row of [...candidate.discoveryCollections, ...candidate.resourceFamilies]) {
    assert.equal(row.canonicalIdentity, identityById.get(row.censusId));
  }
});

test("46 duplicate rows resolve to 43 active7 plus 3 next-major rows without new cards", () => {
  const candidate = readJson(paths.candidate);
  const active = readJson(paths.active7).payload.catalog;
  const next = nextResources(readJson(paths.nextMajor));
  const activeIds = new Set(active.resources.map((resource) => resource.id));
  const nextIds = new Set(next.map((resource) => resource.id));
  assert.deepEqual(candidate.duplicateMappings, duplicateResourceIds);
  assert.equal(Object.keys(candidate.duplicateMappings).length, 46);
  assert.equal(Object.values(candidate.duplicateMappings).flat().length, 53);
  let activeRows = 0;
  let nextRows = 0;
  for (const [censusId, resourceIds] of Object.entries(candidate.duplicateMappings)) {
    const catalogIds = ["L04", "L05", "L06"].includes(censusId) ? nextIds : activeIds;
    if (catalogIds === activeIds) activeRows += 1;
    else nextRows += 1;
    for (const resourceId of resourceIds) assert.equal(catalogIds.has(resourceId), true, censusId + " -> " + resourceId);
  }
  assert.deepEqual([activeRows, nextRows], [43, 3]);
});

test("bindings use only the CONTEXT tuple and keep hostless MCP families explicitly unbound", () => {
  const candidate = readJson(paths.candidate);
  const active = readJson(paths.active7).payload.catalog;
  const hostIds = new Set(active.vendors.flatMap((vendor) => vendor.products.filter((product) => product.directoryKind === "ai-tool").map((product) => product.id)));
  assert.deepEqual(candidate.bindingContract, {
    dependencyTupleKeys: ["kind", "canonicalId", "hostProductId", "bindingKind"],
    allowedBindingKinds: bindingKinds,
    missingHostPolicy: "explicit-unbound",
    credentialPolicy: "never-collect"
  });
  const dropbox = candidate.resourceFamilies.find((row) => row.censusId === "S02");
  assert.equal(candidate.resourceFamilies.filter((row) => row.censusId === "S02").length, 1);
  assert.equal(dropbox.resourceId, "dropbox-official-ai-connections");
  assert.deepEqual(dropbox.connectionBindings.map((row) => row.connectionMode), ["remote-mcp", "chatgpt-app", "claude-connector"]);
  assert.equal(dropbox.connectionBindings.length, 3);
  let tupleCount = 0;
  let unboundCount = 0;
  for (const family of candidate.resourceFamilies) {
    const actualTuples = [];
    for (const binding of family.connectionBindings) {
      if (binding.status === "unbound") {
        unboundCount += 1;
        assert.deepEqual(Object.keys(binding), [
          "connectionMode",
          "status",
          "dependencies",
          "unboundReason"
        ]);
        assert.deepEqual(binding.dependencies, []);
        assert.equal(typeof binding.unboundReason, "string");
        assert.notEqual(binding.unboundReason.length, 0);
        continue;
      }
      assert.equal(binding.status, "bound");
      assert.deepEqual(Object.keys(binding), [
        "connectionMode",
        "status",
        "dependencies"
      ]);
      assert.equal(binding.dependencies.length > 0, true);
      assert.equal(binding.unboundReason, undefined);
      for (const dependency of binding.dependencies) {
        tupleCount += 1;
        assert.deepEqual(Object.keys(dependency), ["kind", "canonicalId", "hostProductId", "bindingKind"]);
        assert.equal(dependency.kind, "resource");
        assert.equal(dependency.canonicalId, family.resourceId);
        assert.equal(hostIds.has(dependency.hostProductId), true);
        assert.equal(bindingKinds.includes(dependency.bindingKind), true);
        actualTuples.push(
          binding.connectionMode +
            "|" +
            dependency.hostProductId +
            "|" +
            dependency.bindingKind
        );
      }
    }
    assert.deepEqual(actualTuples, boundTuplesByFamily[family.censusId]);
  }
  assert.deepEqual(
    [
      candidate.resourceFamilies.reduce((count, family) => count + family.connectionBindings.length, 0),
      tupleCount,
      unboundCount
    ],
    [12, 10, 5]
  );
  for (const censusId of ["D12", "D13", "D14", "D15", "D16"]) {
    const family = candidate.resourceFamilies.find((row) => row.censusId === censusId);
    assert.equal(family.proposedResource, null);
    assert.equal(family.connectionBindings.every((binding) => binding.status === "unbound" && binding.dependencies.length === 0), true);
  }
});

test("five projectable families validate through catalog and marketplace public seams and strip to exact active7", () => {
  const candidate = readJson(paths.candidate);
  const active = readJson(paths.active7).payload.catalog;
  const next = nextResources(readJson(paths.nextMajor));
  const families = candidate.resourceFamilies.filter((row) => row.proposedResource !== null);
  const resources = families.map((row) => row.proposedResource);
  assert.equal(resources.length, 5);
  const existingIds = new Set([...active.resources, ...next].map((resource) => resource.id));
  const existingWebsites = new Set([...active.resources, ...next].map((resource) => resource.website));
  for (const family of families) {
    const resource = family.proposedResource;
    assert.equal(family.credentialPolicy, "never-collect");
    assert.equal(resource.id, family.resourceId);
    assert.equal(existingIds.has(resource.id), false);
    assert.equal(existingWebsites.has(resource.website), false);
    const boundHosts = new Set(family.connectionBindings.flatMap((binding) => binding.dependencies.map((dependency) => dependency.hostProductId)));
    assert.deepEqual(sorted(resource.targets.map((target) => target.productId)), sorted(boundHosts));
    assert.equal(new Set(resource.targets.map((target) => target.productId)).size, resource.targets.length);
    for (const target of resource.targets) {
      assert.deepEqual(target, {
        productId: target.productId,
        compatibility: "official",
        moduleId: "resource-link",
        installProfileId: "",
        capabilities: ["website"],
        enabled: true
      });
    }
  }
  assert.equal(families.find((row) => row.censusId === "S02").proposedResource.targets.length, 4);
  const merged = {
    ...structuredClone(active),
    resources: [...structuredClone(active.resources), ...structuredClone(next), ...structuredClone(resources)]
  };
  const validated = validateCatalog(merged);
  assert.deepEqual(validated.resources.slice(0, active.resources.length), active.resources);
  assert.equal(validated.resources.length, 262);
  assert.equal(new Set(validated.resources.map((resource) => resource.id)).size, 262);
  const marketplace = createResourceMarketplace(validated);
  assert.equal(marketplace.browse().length, 262);
  for (const resource of resources) assert.ok(marketplace.detail(resource.id));
  const addedIds = new Set([...next, ...resources].map((resource) => resource.id));
  const stripped = {
    ...validated,
    resources: validated.resources.filter((resource) => !addedIds.has(resource.id))
  };
  assert.deepEqual(stripped, active);
});
