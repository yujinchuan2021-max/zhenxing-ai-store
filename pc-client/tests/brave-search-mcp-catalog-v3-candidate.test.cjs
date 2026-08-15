"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  assertFrozenInputHashes,
  buildCandidate
} = require("../scripts/generate-brave-search-mcp-catalog-v3-candidate.cjs");

const root = path.resolve(__dirname, "..");
const candidatePath = path.join(
  root,
  "docs/research/brave-search-mcp-catalog-v3-candidate-2026-08-14.json"
);
const inputs = Object.freeze({
  baseCatalogV3: {
    path: "docs/research/catalog-v3-resource-connections-candidate-2026-08-14.json",
    sha256: "43bc18592106542d778ba47fc693fa42826b1febbdc166c7c9e2d9d617c95fd8"
  },
  upstreamResearch: {
    path: "docs/research/cocoloop-stop4069-review-queue-upstream-sample-2026-08-14.md",
    sha256: "747beaccd86d7e4eb46cbbd5470ba178dfcd5f1c7ccb0b41b408fcc9f9afedbc"
  }
});
const revision = "937e85a61f69e36f5a88e44308d47836a8d5d523";

function bytes(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(bytes(relativePath)).digest("hex");
}

function readJson(relativePath) {
  return JSON.parse(bytes(relativePath).toString("utf8"));
}

function githubRepositoryKeys(resource) {
  return [
    resource.website,
    resource.tutorial,
    ...(resource.provenanceEvidence || []),
    resource.metadataSnapshot?.sourcePage,
    resource.metadataSnapshot?.canonicalSource
  ].flatMap((value) => {
    try {
      const url = new URL(value);
      const [owner, name] = url.pathname.split("/").filter(Boolean);
      return url.hostname === "github.com" && owner && name
        ? [`github:${owner.toLowerCase()}/${name.toLowerCase()}`]
        : [];
    } catch {
      return [];
    }
  });
}

test("Brave Search MCP catalog v3 candidate exists", () => {
  assert.equal(
    fs.existsSync(candidatePath),
    true,
    "Brave Search MCP candidate must exist"
  );
});

test("candidate adds exactly one guarded link-only Brave MCP resource", () => {
  for (const input of Object.values(inputs)) {
    assert.equal(sha256(input.path), input.sha256, `frozen input drift: ${input.path}`);
  }
  const base = readJson(inputs.baseCatalogV3.path);
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  assert.deepEqual(candidate, buildCandidate(base));
  assert.deepEqual(Object.keys(candidate).sort(), [
    "candidateOnly",
    "catalog",
    "freezeOnly",
    "generatedAt",
    "inputs",
    "publishable",
    "safety",
    "schemaVersion",
    "summary",
    "targetRelease",
    "title"
  ]);
  assert.deepEqual(
    [candidate.schemaVersion, candidate.candidateOnly, candidate.freezeOnly, candidate.publishable],
    [1, true, true, false]
  );
  assert.equal(candidate.targetRelease, "next-major");
  assert.deepEqual(candidate.inputs, inputs);
  assert.deepEqual(candidate.summary, {
    resources: 263,
    targets: 798,
    resourceConnections: 10,
    appendedResources: 1
  });
  assert.equal(candidate.catalog.schemaVersion, 3);
  assert.equal(candidate.catalog.updatedAt, base.catalog.updatedAt);
  assert.equal(candidate.catalog.resources.length, 263);
  assert.equal(
    candidate.catalog.resources.reduce((count, resource) => count + resource.targets.length, 0),
    798
  );
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);
  assert.equal(
    candidate.catalog.resourceConnections.some(
      ({ resourceId }) => resourceId === "brave-search-mcp-server"
    ),
    false,
    "link-only resource must not invent a relationship edge"
  );

  const resource = candidate.catalog.resources.at(-1);
  assert.deepEqual(Object.keys(resource).sort(), [
    "credentialRequirements",
    "description",
    "enabled",
    "id",
    "installScope",
    "lastVerifiedAt",
    "metadataSnapshot",
    "name",
    "order",
    "provenanceEvidence",
    "publisher",
    "publisherVendorId",
    "requestedPermissions",
    "resourceTypes",
    "reviewStatus",
    "riskLevel",
    "sourceKind",
    "sourceProductIds",
    "targets",
    "tutorial",
    "uninstallPlan",
    "versionRef",
    "website"
  ]);
  assert.deepEqual(
    {
      id: resource.id,
      name: resource.name,
      publisherVendorId: resource.publisherVendorId,
      publisher: resource.publisher,
      sourceKind: resource.sourceKind,
      reviewStatus: resource.reviewStatus,
      riskLevel: resource.riskLevel,
      resourceTypes: resource.resourceTypes,
      versionRef: resource.versionRef
    },
    {
      id: "brave-search-mcp-server",
      name: "Brave Search MCP Server",
      publisherVendorId: "brave",
      publisher: "Brave Software, Inc.",
      sourceKind: "official",
      reviewStatus: "manually-reviewed",
      riskLevel: "guarded",
      resourceTypes: ["mcp"],
      versionRef: `package.json@2.1.0+${revision}`
    }
  );
  assert.deepEqual(resource.sourceProductIds, []);
  assert.deepEqual(resource.targets, [
    {
      productId: "claude-desktop",
      compatibility: "official",
      moduleId: "resource-link",
      installProfileId: "",
      capabilities: ["website"],
      enabled: true
    },
    {
      productId: "microsoft-vscode",
      compatibility: "official",
      moduleId: "resource-link",
      installProfileId: "",
      capabilities: ["website"],
      enabled: true
    }
  ]);
  assert.match(resource.credentialRequirements[0], /BRAVE_API_KEY/);
  assert.match(resource.credentialRequirements[0], /不收集、保存或转发/);
  assert.match(resource.installScope, /不写入.*配置/);
  assert.match(resource.installScope, /不运行 NPX\/Docker/);
  assert.deepEqual(resource.provenanceEvidence, [
    `https://github.com/brave/brave-search-mcp-server/tree/${revision}`,
    `https://github.com/brave/brave-search-mcp-server/blob/${revision}/README.md`,
    `https://github.com/brave/brave-search-mcp-server/blob/${revision}/package.json`,
    `https://github.com/brave/brave-search-mcp-server/blob/${revision}/LICENSE`
  ]);
  assert.deepEqual(resource.metadataSnapshot, {
    sourcePlatform: "github",
    discoveredVia: "cocoloop",
    sourcePage: `https://github.com/brave/brave-search-mcp-server/tree/${revision}`,
    canonicalSource: `https://github.com/brave/brave-search-mcp-server/tree/${revision}`,
    originalAuthor: "Brave Software, Inc.",
    licenseId: "MIT",
    sourceRevision: revision,
    provenanceStatus: "first-party-verified",
    externalId: "github:brave/brave-search-mcp-server",
    observedAt: "2026-08-14T00:00:00.000Z",
    licenseStatus: "verified"
  });

  const forbiddenFields = new Set([
    "args",
    "command",
    "credentials",
    "endpoint",
    "env",
    "headers",
    "secret",
    "token",
    "installRuntime",
    "runtimeConfig"
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenFields.has(key), false, `forbidden runtime field: ${key}`);
      visit(child);
    }
  };
  visit(resource);

  assert.equal(validateCatalog(candidate.catalog), candidate.catalog);
  const reversed = structuredClone(candidate.catalog);
  assert.deepEqual(reversed.resources.pop(), resource);
  assert.deepEqual(reversed, base.catalog);
  assert.deepEqual(candidate.safety, {
    candidateOnly: true,
    freezeOnly: true,
    publishable: false,
    linkOnlyNewTargets: true,
    credentialsCollected: false,
    runtimeConfigurationStored: false,
    catalogWritten: false,
    stateWritten: false,
    signed: false,
    published: false
  });
});

test("generator rejects frozen drift and active/history semantic identity collisions", () => {
  assert.throws(
    () => assertFrozenInputHashes({
      baseCatalogV3: "0".repeat(64),
      upstreamResearch: inputs.upstreamResearch.sha256
    }),
    /frozen input drift/
  );

  const base = readJson(inputs.baseCatalogV3.path);
  const candidateRepo = "github:brave/brave-search-mcp-server";
  assert.equal(
    base.catalog.resources.some(
      (resource) =>
        resource.id.toLowerCase() === "brave-search-mcp-server" ||
        resource.name.trim().toLowerCase() === "brave search mcp server" ||
        resource.metadataSnapshot?.externalId?.toLowerCase() === candidateRepo ||
        githubRepositoryKeys(resource).includes(candidateRepo)
    ),
    false,
    "base active/history projection already contains the Brave identity"
  );

  const duplicateName = structuredClone(base);
  duplicateName.catalog.resources.at(-1).name = "Brave Search MCP Server";
  assert.throws(() => buildCandidate(duplicateName), /semantic identity already exists/);

  const duplicateSource = structuredClone(base);
  duplicateSource.catalog.resources.at(-1).tutorial =
    "https://github.com/brave/brave-search-mcp-server";
  assert.throws(() => buildCandidate(duplicateSource), /canonical source already exists/);
});
