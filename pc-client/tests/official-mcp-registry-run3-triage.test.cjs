"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildOfficialRegistryTriage } = require("../scripts/official-mcp-registry-run3-triage.cjs");

function record(name, version, options = {}) {
  return {
    registryId: `${name}@${version}`,
    name,
    version,
    status: "active",
    repository: options.repositoryUrl ? { url: options.repositoryUrl } : null,
    websiteUrl: options.websiteUrl || null,
    packages: options.packages || [],
    normalizationWarnings: options.normalizationWarnings || []
  };
}

test("classifies every Registry identity without promoting source signals", () => {
  const result = buildOfficialRegistryTriage({
    records: [
      record("io.example/exact", "1.0.0"),
      record("io.example/lineage", "2.0.0"),
      record("io.example/source", "1.0.0", { repositoryUrl: "https://github.com/acme/source.git" }),
      record("io.example/prior", "2.0.0"),
      record("io.example/new", "1.0.0")
    ],
    catalogResources: [
      {
        id: "exact-resource",
        metadataSnapshot: { externalId: "official-mcp-registry:io.example/exact@1.0.0" }
      },
      {
        id: "lineage-resource",
        metadataSnapshot: { externalId: "official-mcp-registry:io.example/lineage@1.0.0" }
      },
      {
        id: "source-resource",
        metadataSnapshot: { canonicalSource: "https://github.com/acme/source/" }
      }
    ],
    priorEvidence: [
      { path: "prior-review.md", registryIds: ["io.example/prior@1.0.0"] }
    ]
  });

  assert.deepEqual(result.ledger, [
    {
      registryId: "io.example/exact@1.0.0",
      namespace: "io.example",
      status: "active",
      disposition: "catalog-exact-identity",
      catalogResolved: true,
      matchedResourceIds: ["exact-resource"],
      priorEvidenceFiles: [],
      evidenceLane: "catalog",
      warningCount: 0
    },
    {
      registryId: "io.example/lineage@2.0.0",
      namespace: "io.example",
      status: "active",
      disposition: "catalog-same-server-lineage",
      catalogResolved: true,
      matchedResourceIds: ["lineage-resource"],
      priorEvidenceFiles: [],
      evidenceLane: "catalog",
      warningCount: 0
    },
    {
      registryId: "io.example/source@1.0.0",
      namespace: "io.example",
      status: "active",
      disposition: "catalog-source-signal",
      catalogResolved: false,
      matchedResourceIds: ["source-resource"],
      priorEvidenceFiles: [],
      evidenceLane: "source-collision",
      warningCount: 0
    },
    {
      registryId: "io.example/prior@2.0.0",
      namespace: "io.example",
      status: "active",
      disposition: "prior-research-observed",
      catalogResolved: false,
      matchedResourceIds: [],
      priorEvidenceFiles: ["prior-review.md"],
      evidenceLane: "prior-research",
      warningCount: 0
    },
    {
      registryId: "io.example/new@1.0.0",
      namespace: "io.example",
      status: "active",
      disposition: "unreviewed",
      catalogResolved: false,
      matchedResourceIds: [],
      priorEvidenceFiles: [],
      evidenceLane: "insufficient-evidence",
      warningCount: 0
    }
  ]);
  assert.deepEqual(result.counts, {
    "catalog-exact-identity": 1,
    "catalog-same-server-lineage": 1,
    "catalog-source-signal": 1,
    "prior-research-observed": 1,
    unreviewed: 1
  });
});
