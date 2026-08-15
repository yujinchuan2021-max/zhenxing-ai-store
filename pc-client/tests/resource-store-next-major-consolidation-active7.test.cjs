"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const researchDirectory = path.join(root, "docs/research");
const consolidationRelativePath = "docs/research/resource-store-next-major-consolidation-active7-2026-08-14.json";
const consolidationPath = path.join(root, consolidationRelativePath);
const activeRelativePath = "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json";
const activePath = path.join(root, activeRelativePath);
const activeSha256 = "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4";

const includedBatchDefinitions = [
  {
    batchId: "cocoloop-next-batch-active7",
    candidate: {
      path: "docs/research/community-skill-store-cocoloop-next-batch-candidate-active7-2026-08-13.json",
      sha256: "e82aaf9fc999a700ab07931d1bbe07010ad39095f5f68059681d3393aa180928"
    },
    evidence: [
      {
        role: "focused-test",
        path: "tests/community-skill-store-cocoloop-next-batch-candidate.test.cjs",
        sha256: "bbfef791dd18a2e4465318ef93d9686a2b1e2e597af9cebb927c4edfd9425f17"
      },
      {
        role: "frozen-handoff",
        path: "docs/research/community-skill-store-cocoloop-next-batch-frozen-handoff-2026-08-13.md",
        sha256: "354cfa0d1762ed90af805e33fb23844b6e5b8fa8cadef90d2c516fa822320fca"
      }
    ],
    sourceProposalCount: 2,
    includedResourceIds: ["openclaw-summarize-skill", "openclaw-wacli-skill"]
  },
  {
    batchId: "cocoloop-small-batch2-active7",
    candidate: {
      path: "docs/research/community-skill-store-cocoloop-small-batch2-candidate-active7-2026-08-14.json",
      sha256: "f8f5d0669a1368cd9ab5995b11b815af314c5fd196aff4719b343c2fa24bbe75"
    },
    evidence: [
      {
        role: "research",
        path: "docs/research/community-skill-store-cocoloop-small-batch2-research-2026-08-14.md",
        sha256: "e4652674829b1d9500203c8b27092b573deab6e8a42ab16f8bc09306f27a1d51"
      },
      {
        role: "focused-test",
        path: "tests/community-skill-store-cocoloop-small-batch2-candidate.test.cjs",
        sha256: "93b998112fc284655ac145900a9711cd8760c69ae37b4e1ed43b757c9ddb2ade"
      },
      {
        role: "frozen-handoff",
        path: "docs/research/community-skill-store-cocoloop-small-batch2-frozen-handoff-2026-08-14.md",
        sha256: "61f9acf4e2f998d21dd8aeefa8da8e352fd92e5d92a20201a9542bed87ac6b7f"
      }
    ],
    sourceProposalCount: 1,
    includedResourceIds: ["openclaw-mcporter-skill"]
  },
  {
    batchId: "cocoloop-small-batch3-active7",
    candidate: {
      path: "docs/research/community-skill-store-cocoloop-small-batch3-candidate-active7-2026-08-14.json",
      sha256: "464d035403d2afac8c437f3a5c2b7ebb6552c253c9f45dfb63367735d4372282"
    },
    evidence: [
      {
        role: "research",
        path: "docs/research/community-skill-store-cocoloop-small-batch3-research-2026-08-14.md",
        sha256: "8c162dacbac85c9f433e675be98571e684d5ce931c5713d693ab2df86b4f4159"
      },
      {
        role: "focused-test",
        path: "tests/community-skill-store-cocoloop-small-batch3-candidate.test.cjs",
        sha256: "d4082ce06769b1fda758862c6ffc559e02a7f05444443e8d228d48a39e51ba5a"
      },
      {
        role: "frozen-handoff",
        path: "docs/research/community-skill-store-cocoloop-small-batch3-frozen-handoff-2026-08-14.md",
        sha256: "e3d09a12b015799d33dd0fe0041d28014bd1d3ab53657125e93ede4e38e3c709"
      }
    ],
    sourceProposalCount: 1,
    includedResourceIds: ["openclaw-weather-skill"]
  },
  {
    batchId: "mcp-connector-small-batch-active7",
    candidate: {
      path: "docs/research/mcp-connector-small-batch-candidate-active7-2026-08-14.json",
      sha256: "ee151bc52a47f42b96d113be26652247ec1dd257178a3706799efd18463715cd"
    },
    evidence: [
      {
        role: "focused-test",
        path: "tests/mcp-connector-small-batch-active7-candidate.test.cjs",
        sha256: "e2e702718cd32f4503b9f4963a06d09a0c0c95973edebbd3ae11effdba7c08c4"
      },
      {
        role: "frozen-handoff",
        path: "docs/research/2026-08-14-mcp-connector-small-batch-handoff.md",
        sha256: "516a6884bbcd5088d27e9ca3872101652c9819bec1f3489d4adc253e9917f7df"
      }
    ],
    sourceProposalCount: 2,
    includedResourceIds: ["lovable-official-mcp", "lucid-claude-connector"]
  },
  {
    batchId: "mcp-official-small-batch2-active7",
    candidate: {
      path: "docs/research/mcp-connector-official-small-batch2-candidate-active7-2026-08-14.json",
      sha256: "f2df99357f958ef3dd7fe512640cfc5a3eda9e66ceff788ea1cda7d08afe2962"
    },
    evidence: [
      {
        role: "research",
        path: "docs/research/mcp-connector-official-small-batch2-research-2026-08-14.md",
        sha256: "9c97b3073e803e13a57a08cd33f4357081af1e300592e7da5d3f20c65cdad161"
      },
      {
        role: "focused-test",
        path: "tests/mcp-connector-official-small-batch2-active7-candidate.test.cjs",
        sha256: "64fe6246a85cae5264b7a16f23fd588533d5fc6485707177c6bcb24689d9fadc"
      },
      {
        role: "frozen-handoff",
        path: "docs/research/mcp-connector-official-small-batch2-frozen-handoff-2026-08-14.md",
        sha256: "9d2f205d81026b33015b71c80aafa0eede04ca3adaa45a3668d59550852f2eb8"
      }
    ],
    sourceProposalCount: 1,
    includedResourceIds: ["microsoft-learn-mcp-server"]
  }
];

const excludedBatchDefinitions = [
  {
    batchId: "skill-listing-batch1-active6",
    candidate: {
      path: "docs/research/community-skill-store-listing-batch1-candidate-draft89-active6-2026-08-08.json",
      sha256: "a74ccb8c45de2d168f47fd8fc05c96e793059a3f9cfbc1543440078726bafc70"
    },
    sourceProposalCount: 14,
    reasonCode: "already-present-in-active7"
  },
  {
    batchId: "skill-listing-batch1-canonical-merge-active6",
    candidate: {
      path: "docs/research/community-skill-store-listing-batch1-canonical-merge-candidate-draft89-active6-2026-08-08.json",
      sha256: "acae78bdce33b5cc3f44f22ab9be96d71a908133af5fdf666d68a860a60dd58d"
    },
    sourceProposalCount: 14,
    reasonCode: "already-present-in-active7"
  },
  {
    batchId: "skill-batch2-canonical-merge-active6",
    candidate: {
      path: "docs/research/community-skill-store-batch2-canonical-merge-candidate-draft89-active6-2026-08-09.json",
      sha256: "0439b82a47a6e0af98ac526f3c769810eda526e07ca0b7078c958b18acd2da24"
    },
    sourceProposalCount: 50,
    reasonCode: "already-present-in-active7"
  },
  {
    batchId: "skill-batch3-canonical-merge-active6",
    candidate: {
      path: "docs/research/community-skill-store-batch3-canonical-merge-candidate-draft89-active6-2026-08-09.json",
      sha256: "64ab2e07eb345ba6d258329ac3fd52d684b0dfa93de5bff7bc0dcd4292777523"
    },
    sourceProposalCount: 40,
    reasonCode: "already-present-in-active7"
  }
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
}

function extractProposalRows(candidate) {
  const containers = [
    ...(Array.isArray(candidate.proposedResources) ? candidate.proposedResources : []),
    ...(Array.isArray(candidate.ready) ? candidate.ready : []),
    ...(Array.isArray(candidate.readyResources) ? candidate.readyResources : []),
    ...(Array.isArray(candidate.proposedChanges) ? candidate.proposedChanges : [])
  ];
  return containers
    .map((row) => ({ wrapper: row, resource: row?.resource || row?.proposedResource || row }))
    .filter(({ resource }) => resource && Array.isArray(resource.resourceTypes)
      && resource.resourceTypes.some((type) => ["skill", "mcp", "connector", "plugin"].includes(type)));
}

function discoverNonemptyCandidateBatches() {
  return fs.readdirSync(researchDirectory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => `docs/research/${file}`)
    .filter((relativePath) => relativePath !== consolidationRelativePath)
    .filter((relativePath) => {
      const value = readJson(relativePath);
      return value.candidateOnly === true && extractProposalRows(value).length > 0;
    })
    .sort();
}

function normalizeText(value) {
  return String(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeSourceIdentity(value) {
  const source = String(value);
  if (!/^https?:\/\//i.test(source)) return normalizeText(source);
  const parsed = new URL(source);
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString().replace(/\/$/, "");
}

function sourceIdentities(wrapper, resource) {
  return new Set([
    wrapper.canonicalKey,
    wrapper.canonicalIdentity,
    wrapper.canonicalSource,
    resource.metadataSnapshot?.externalId,
    resource.metadataSnapshot?.canonicalSource,
    resource.metadataSnapshot?.sourcePage,
    resource.website
  ].filter(Boolean).map(normalizeSourceIdentity));
}

function canonicalIdentity(wrapper, resource) {
  return wrapper.canonicalKey
    || resource.metadataSnapshot?.externalId
    || `url:${resource.website}`;
}

function canonicalSource(resource) {
  return resource.metadataSnapshot?.canonicalSource || resource.website;
}

function channelFor(wrapper, resource) {
  return wrapper.channel || resource.resourceTypes[0];
}

const forbiddenFieldNames = new Set([
  "endpoint", "command", "args", "env", "headers", "credentials", "token", "apikey",
  "install", "runtime", "script", "executable", "shell", "powershell", "cmd"
]);

function forbiddenKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => forbiddenKeys(child, [...pathParts, String(index)]));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const current = [...pathParts, key];
    return [
      ...(forbiddenFieldNames.has(key.toLowerCase()) ? [current.join(".")] : []),
      ...forbiddenKeys(child, current)
    ];
  });
}

function assertNovelIdentity(identity, active, seen, label) {
  assert.equal(active.has(identity), false, `${label} must not collide with active7`);
  assert.equal(seen.has(identity), false, `${label} must not collide across included batches`);
  seen.add(identity);
}

test("next-major consolidation binds the exact nonempty candidate inventory and source bytes", () => {
  assert.equal(fs.existsSync(consolidationPath), true, "next-major consolidation artifact must exist");
  const candidate = readJson(consolidationRelativePath);
  const expectedBatchPaths = [...includedBatchDefinitions, ...excludedBatchDefinitions]
    .map((batch) => batch.candidate.path)
    .sort();

  assert.deepEqual(discoverNonemptyCandidateBatches(), expectedBatchPaths);
  assert.deepEqual(Object.keys(candidate), [
    "schemaVersion", "candidateOnly", "publishable", "freezeOnly", "targetRelease", "generatedAt", "title",
    "baseline", "summary", "sourceBatches", "excludedBatches", "deduplication", "proposedResources", "safety"
  ]);
  assert.deepEqual([candidate.schemaVersion, candidate.candidateOnly, candidate.publishable, candidate.freezeOnly, candidate.targetRelease], [1, true, false, true, "next-major"]);
  assert.deepEqual(candidate.baseline, {
    activeReleaseId: "catalog-v00000007-8c49e1972186-0cec5335",
    activeCatalogPath: activeRelativePath,
    activeCatalogSha256: activeSha256,
    resources: 250,
    targets: 777
  });
  assert.equal(sha256(activeRelativePath), activeSha256);
  assert.deepEqual(candidate.summary, {
    examinedNonemptyCandidateOnlyBatches: 9,
    includedSourceBatches: 5,
    excludedSourceBatches: 4,
    proposedResources: 7,
    proposedTargets: 11,
    byChannel: { skill: 4, mcp: 2, connector: 1, plugin: 0 },
    sourceFocusedTests: { tests: 10, passed: 10, failed: 0 }
  });

  assert.equal(candidate.sourceBatches.length, includedBatchDefinitions.length);
  for (const [index, expected] of includedBatchDefinitions.entries()) {
    const actual = candidate.sourceBatches[index];
    assert.deepEqual(Object.keys(actual), ["batchId", "candidate", "evidence", "sourceProposalCount", "includedResourceIds", "currentReadOnlyAudit"]);
    assert.deepEqual(actual, { ...expected, currentReadOnlyAudit: "pass-current-bytes" });
    assert.equal(sha256(actual.candidate.path), actual.candidate.sha256);
    for (const evidence of actual.evidence) assert.equal(sha256(evidence.path), evidence.sha256);
    const sourceRows = extractProposalRows(readJson(actual.candidate.path));
    assert.deepEqual(sourceRows.map(({ resource }) => resource.id), actual.includedResourceIds);
  }

  assert.deepEqual(candidate.excludedBatches, excludedBatchDefinitions);
  const active = readJson(activeRelativePath).payload.catalog;
  const activeIds = new Set(active.resources.map((resource) => normalizeText(resource.id)));
  for (const excluded of candidate.excludedBatches) {
    assert.equal(sha256(excluded.candidate.path), excluded.candidate.sha256);
    const rows = extractProposalRows(readJson(excluded.candidate.path));
    assert.equal(rows.length, excluded.sourceProposalCount);
    assert.ok(rows.every(({ resource }) => activeIds.has(normalizeText(resource.id))), `${excluded.batchId} must already be represented in active7`);
  }

  const expectedResources = includedBatchDefinitions.flatMap((batch) => {
    return extractProposalRows(readJson(batch.candidate.path)).map(({ wrapper, resource }) => ({
      sourceBatchId: batch.batchId,
      channel: channelFor(wrapper, resource),
      credentialPolicy: "never-collect",
      canonicalIdentity: canonicalIdentity(wrapper, resource),
      canonicalSource: canonicalSource(resource),
      resource
    }));
  });
  assert.deepEqual(candidate.proposedResources, expectedResources, "consolidation must preserve source resources byte-semantically");
});

test("consolidated resources are semantically novel, CompatibleHost-only, link-only, and exactly reversible", () => {
  const candidate = readJson(consolidationRelativePath);
  const active = readJson(activeRelativePath).payload.catalog;
  const activeIdentities = {
    ids: new Set(active.resources.map((resource) => normalizeText(resource.id))),
    names: new Set(active.resources.map((resource) => normalizeText(resource.name))),
    sources: new Set(active.resources.flatMap((resource) => [...sourceIdentities({}, resource)]))
  };
  const seen = { ids: new Set(), names: new Set(), sources: new Set() };
  const products = new Set(active.vendors.flatMap((vendor) => vendor.products.map((product) => product.id)));
  const vendorIds = new Set(active.vendors.map((vendor) => vendor.id));

  assert.deepEqual(candidate.deduplication, {
    dimensions: ["id", "name", "canonicalIdentity", "canonicalSource", "sourcePage", "website"],
    comparedAgainst: ["active7", "included-source-batches", "other-candidateOnly-proposal-rows"],
    otherProposalRowsScanned: 118,
    result: "pass-no-semantic-collision"
  });
  assert.equal(candidate.proposedResources.length, 7);

  for (const [index, row] of candidate.proposedResources.entries()) {
    assert.deepEqual(Object.keys(row), ["sourceBatchId", "channel", "credentialPolicy", "canonicalIdentity", "canonicalSource", "resource"]);
    assert.equal(row.credentialPolicy, "never-collect");
    assert.ok(["skill", "mcp", "connector", "plugin"].includes(row.channel));
    assert.deepEqual(row.resource.resourceTypes, [row.channel]);
    assertNovelIdentity(normalizeText(row.resource.id), activeIdentities.ids, seen.ids, `proposedResources[${index}].resource.id`);
    assertNovelIdentity(normalizeText(row.resource.name), activeIdentities.names, seen.names, `proposedResources[${index}].resource.name`);
    for (const identity of sourceIdentities(row, row.resource)) {
      assertNovelIdentity(identity, activeIdentities.sources, seen.sources, `proposedResources[${index}] source identity ${identity}`);
    }
    assert.equal(typeof row.resource.publisher, "string");
    assert.ok(row.resource.publisher.length > 0);
    assert.deepEqual(row.resource.sourceProductIds, [], "publisher must remain factual provenance, not a parent product");
    if (row.resource.publisherVendorId) assert.ok(vendorIds.has(row.resource.publisherVendorId));
    assert.deepEqual(forbiddenKeys(row), []);
    assert.ok(row.resource.targets.length > 0);
    for (const target of row.resource.targets) {
      assert.ok(products.has(target.productId), `${target.productId} must be an active7 CompatibleHost`);
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

  const selectedSourcePaths = new Set(includedBatchDefinitions.map((batch) => batch.candidate.path));
  const otherRows = discoverNonemptyCandidateBatches()
    .filter((relativePath) => !selectedSourcePaths.has(relativePath))
    .flatMap((relativePath) => extractProposalRows(readJson(relativePath)));
  assert.equal(otherRows.length, candidate.deduplication.otherProposalRowsScanned);
  const otherIdentities = {
    ids: new Set(otherRows.map(({ resource }) => normalizeText(resource.id))),
    names: new Set(otherRows.map(({ resource }) => normalizeText(resource.name))),
    sources: new Set(otherRows.flatMap(({ wrapper, resource }) => [...sourceIdentities(wrapper, resource)]))
  };
  for (const row of candidate.proposedResources) {
    assert.equal(otherIdentities.ids.has(normalizeText(row.resource.id)), false);
    assert.equal(otherIdentities.names.has(normalizeText(row.resource.name)), false);
    for (const identity of sourceIdentities(row, row.resource)) assert.equal(otherIdentities.sources.has(identity), false);
  }

  const projected = structuredClone(active);
  projected.resources.push(...candidate.proposedResources.map((row) => structuredClone(row.resource)));
  const validated = validateCatalog(projected);
  assert.equal(validated.resources.length, 257);
  assert.equal(validated.resources.reduce((count, resource) => count + resource.targets.length, 0), 788);
  const proposedIds = new Set(candidate.proposedResources.map((row) => row.resource.id));
  validated.resources = validated.resources.filter((resource) => !proposedIds.has(resource.id));
  assert.deepEqual(validated, active, "stripping all seven proposals must restore exact active7");
  assert.deepEqual(candidate.safety, {
    candidateOnly: true,
    resourceLinkOnly: true,
    websiteCapabilityOnly: true,
    emptyInstallProfileOnly: true,
    credentialPolicy: "never-collect",
    publisherRelation: "factual-only",
    targetRelation: "CompatibleHost-only",
    managedExecution: false,
    catalogWritten: false,
    stateWritten: false,
    channelWritten: false,
    signed: false,
    published: false,
    packaged: false,
    networkInstall: false
  });
});

test("semantic and execution guards fail closed on normalized collisions and nested runtime fields", () => {
  const active = new Set([normalizeText("  OpenClaw Weather Skill  ")]);
  assert.throws(
    () => assertNovelIdentity(normalizeText("OPENCLAW   WEATHER SKILL"), active, new Set(), "normalized name"),
    { name: "AssertionError" }
  );
  assert.deepEqual(
    forbiddenKeys({ resource: { metadataSnapshot: { endpoint: "https://example.test", env: { TOKEN: "x" } } } }),
    ["resource.metadataSnapshot.endpoint", "resource.metadataSnapshot.env", "resource.metadataSnapshot.env.TOKEN"]
  );
  assert.notEqual(
    normalizeSourceIdentity("github:openclaw/openclaw#skills/weather"),
    normalizeSourceIdentity("github:openclaw/openclaw#skills/mcporter"),
    "non-HTTP canonical fragments are semantic identity, not disposable URL fragments"
  );
});
