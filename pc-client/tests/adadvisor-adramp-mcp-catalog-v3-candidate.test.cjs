"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  assertFrozenInputHashes,
  buildCandidate
} = require("../scripts/generate-adadvisor-adramp-mcp-catalog-v3-candidate.cjs");

const root = path.resolve(__dirname, "..");
const candidateRelativePath =
  "docs/research/adadvisor-adramp-mcp-catalog-v3-candidate-2026-08-14.json";
const candidatePath = path.join(root, candidateRelativePath);
const generatorRelativePath =
  "scripts/generate-adadvisor-adramp-mcp-catalog-v3-candidate.cjs";
const inputs = Object.freeze({
  baseAwsCatalogV3: {
    path: "docs/research/aws-agents-build-skill-catalog-v3-candidate-2026-08-14.json",
    sha256: "c7cd67c2b4b34fd19cfbe217d728f7d572c22db1df479e663372b257c067e74d"
  },
  upstreamResearch: {
    path: "docs/research/official-mcp-registry-next10-first-party-review-2026-08-14.md",
    sha256: "da43d7555f1e657a30dc4d233f445778760fcbee7fc49de892f21b6a25ed2a24"
  }
});
const registrySnapshot =
  "https://registry.modelcontextprotocol.io/v0.1/servers?limit=10&version=latest&cursor=agency.kesey%2Fpretrip%3A1.0.1";

function bytes(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(bytes(relativePath)).digest("hex");
}

function readJson(relativePath) {
  return JSON.parse(bytes(relativePath).toString("utf8"));
}

function expectedTarget(productId) {
  return {
    productId,
    compatibility: "official",
    moduleId: "resource-link",
    installProfileId: "",
    capabilities: ["website"],
    enabled: true
  };
}

test("AdAdvisor and AdRamp MCP catalog v3 candidate exists", () => {
  assert.equal(
    fs.existsSync(candidatePath),
    true,
    "AdAdvisor and AdRamp MCP candidate must exist"
  );
});

test("candidate adds exactly two first-party link-only MCP resources", () => {
  for (const input of Object.values(inputs)) {
    assert.equal(sha256(input.path), input.sha256, `frozen input drift: ${input.path}`);
  }

  const base = readJson(inputs.baseAwsCatalogV3.path);
  const candidate = readJson(candidateRelativePath);
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
    resources: 266,
    targets: 809,
    resourceConnections: 10,
    appendedResources: 2
  });
  assert.equal(candidate.catalog.schemaVersion, 3);
  assert.equal(candidate.catalog.updatedAt, base.catalog.updatedAt);
  assert.equal(candidate.catalog.resources.length, 266);
  assert.equal(
    candidate.catalog.resources.reduce((count, resource) => count + resource.targets.length, 0),
    809
  );
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);

  const [adAdvisor, adRamp] = candidate.catalog.resources.slice(-2);
  assert.deepEqual(
    [adAdvisor.id, adRamp.id],
    ["adadvisor-mcp-server", "adramp-google-ads-mcp"]
  );
  for (const resource of [adAdvisor, adRamp]) {
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
      "requestedPermissions",
      "resourceTypes",
      "reviewStatus",
      "riskLevel",
      "sourceKind",
      "targets",
      "tutorial",
      "uninstallPlan",
      "versionRef",
      "website"
    ]);
    assert.equal("publisherVendorId" in resource, false);
    assert.equal("sourceProductIds" in resource, false);
    assert.deepEqual(resource.resourceTypes, ["mcp"]);
    assert.equal(resource.sourceKind, "official");
    assert.equal(resource.reviewStatus, "manually-reviewed");
    assert.equal(resource.metadataSnapshot.licenseId, "service-terms");
    assert.equal(resource.metadataSnapshot.licenseStatus, "verified");
    assert.match(resource.metadataSnapshot.sourceRevision, /rolling-service$/);
    assert.equal(
      candidate.catalog.resourceConnections.some(({ resourceId }) => resourceId === resource.id),
      false,
      `${resource.id} must remain link-only without an invented relationship edge`
    );
  }

  assert.deepEqual(
    {
      order: adAdvisor.order,
      name: adAdvisor.name,
      publisher: adAdvisor.publisher,
      riskLevel: adAdvisor.riskLevel,
      versionRef: adAdvisor.versionRef
    },
    {
      order: 259,
      name: "AdAdvisor MCP Server",
      publisher: "AdAdvisor, Inc.",
      riskLevel: "unsafe",
      versionRef: "registry@1.0.1+rolling-official-service"
    }
  );
  assert.deepEqual(adAdvisor.targets, [
    expectedTarget("claude-desktop"),
    expectedTarget("claude-code"),
    expectedTarget("cursor-desktop"),
    expectedTarget("windsurf-editor")
  ]);
  assert.match(adAdvisor.description, /Meta Ads/);
  assert.match(adAdvisor.description, /真实预算/);
  assert.match(adAdvisor.requestedPermissions.join("\n"), /创建 campaign/);
  assert.match(adAdvisor.requestedPermissions.join("\n"), /上传 creative/);
  assert.match(adAdvisor.requestedPermissions.join("\n"), /暂停或调整广告/);
  assert.match(adAdvisor.requestedPermissions.join("\n"), /发布方声明/);
  assert.match(adAdvisor.credentialRequirements.join("\n"), /Meta OAuth/);
  assert.match(adAdvisor.installScope, /不发起 OAuth/);
  assert.match(adAdvisor.installScope, /不保存连接/);
  assert.match(adAdvisor.installScope, /不调用 MCP 工具/);
  assert.deepEqual(adAdvisor.provenanceEvidence, [
    "https://adadvisor.ai/mcp",
    "https://adadvisor.ai/terms",
    registrySnapshot
  ]);
  assert.deepEqual(adAdvisor.metadataSnapshot, {
    sourcePlatform: "official-mcp-registry",
    discoveredVia: "official-mcp-registry",
    sourcePage: "https://adadvisor.ai/mcp",
    canonicalSource: "https://adadvisor.ai/mcp",
    originalAuthor: "AdAdvisor, Inc.",
    licenseId: "service-terms",
    sourceRevision: "registry-1.0.1+rolling-service",
    provenanceStatus: "first-party-verified",
    externalId: "official-mcp-registry:ai.adadvisor/mcp-server@1.0.1",
    observedAt: "2026-08-14T00:00:00.000Z",
    licenseStatus: "verified"
  });

  assert.deepEqual(
    {
      order: adRamp.order,
      name: adRamp.name,
      publisher: adRamp.publisher,
      riskLevel: adRamp.riskLevel,
      versionRef: adRamp.versionRef
    },
    {
      order: 260,
      name: "AdRamp Google Ads MCP",
      publisher: "Product Stream Technologies SRL",
      riskLevel: "guarded",
      versionRef: "registry@1.0.3+rolling-official-service"
    }
  );
  assert.deepEqual(adRamp.targets, [
    expectedTarget("claude-code"),
    expectedTarget("cursor-desktop"),
    expectedTarget("microsoft-vscode"),
    expectedTarget("windsurf-editor")
  ]);
  assert.match(adRamp.description, /Google Ads/);
  assert.match(adRamp.description, /不能修改 campaign 或预算/);
  assert.match(adRamp.requestedPermissions.join("\n"), /OAuth scope 为只读/);
  assert.match(adRamp.requestedPermissions.join("\n"), /发布方声明/);
  assert.deepEqual(adRamp.credentialRequirements, [
    "发布方称使用 AdRamp 服务无需 AdRamp 账户或 API key；这是发布方声明，不是枕星 AI 对凭据需求的独立验证。",
    "用户须自行在 Google 官方流程中授予只读 OAuth 访问，并可在 Google 账户中撤销；枕星 AI 不发起该流程。",
    "枕星 AI 不请求、收集、保存、代理、校验或转发 Google 登录材料、OAuth 授权、API key 或其他认证信息。"
  ]);
  assert.match(adRamp.installScope, /不发起 OAuth/);
  assert.match(adRamp.installScope, /不保存连接/);
  assert.match(adRamp.installScope, /不调用 MCP 工具/);
  assert.deepEqual(adRamp.provenanceEvidence, [
    "https://adramp.ai/mcp/",
    "https://adramp.ai/terms/",
    registrySnapshot
  ]);
  assert.deepEqual(adRamp.metadataSnapshot, {
    sourcePlatform: "official-mcp-registry",
    discoveredVia: "official-mcp-registry",
    sourcePage: "https://adramp.ai/mcp/",
    canonicalSource: "https://adramp.ai/mcp/",
    originalAuthor: "Product Stream Technologies SRL",
    licenseId: "service-terms",
    sourceRevision: "registry-1.0.3+rolling-service",
    provenanceStatus: "first-party-verified",
    externalId: "official-mcp-registry:ai.adramp/google-ads@1.0.3",
    observedAt: "2026-08-14T00:00:00.000Z",
    licenseStatus: "verified"
  });

  const forbiddenFields = new Set([
    "args",
    "command",
    "credential",
    "credentialValue",
    "credentialValues",
    "credentials",
    "endpoint",
    "env",
    "headers",
    "installArgs",
    "installCommand",
    "installPackage",
    "installRuntime",
    "managedInstall",
    "package",
    "path",
    "runtime",
    "runtimeConfig",
    "script",
    "secret",
    "token",
    "value"
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenFields.has(key), false, `forbidden runtime field: ${key}`);
      visit(child);
    }
  };
  visit([adAdvisor, adRamp]);

  assert.equal(validateCatalog(candidate.catalog), candidate.catalog);
  const reversed = structuredClone(candidate.catalog);
  assert.deepEqual(reversed.resources.splice(-2), [adAdvisor, adRamp]);
  assert.deepEqual(reversed, base.catalog);
  assert.deepEqual(candidate.safety, {
    candidateOnly: true,
    freezeOnly: true,
    publishable: false,
    linkOnlyNewTargets: true,
    credentialsCollected: false,
    oauthInitiated: false,
    connectionsStored: false,
    runtimeConfigurationStored: false,
    catalogWritten: false,
    stateWritten: false,
    signed: false,
    published: false
  });
});

test("generator rejects frozen drift and current/history semantic collisions", () => {
  assert.throws(
    () => assertFrozenInputHashes({
      baseAwsCatalogV3: "0".repeat(64),
      upstreamResearch: inputs.upstreamResearch.sha256
    }),
    /frozen input drift/
  );

  const base = readJson(inputs.baseAwsCatalogV3.path);
  for (const mutation of [
    (resource) => { resource.id = "adadvisor-mcp-server"; },
    (resource) => {
      resource.name = "AdAdvisor MCP Server";
      resource.publisher = "AdAdvisor, Inc.";
    },
    (resource) => {
      resource.metadataSnapshot.externalId =
        "official-mcp-registry:ai.adramp/google-ads@1.0.3";
    },
    (resource) => { resource.website = "https://adramp.ai/mcp"; }
  ]) {
    const duplicate = structuredClone(base);
    mutation(duplicate.catalog.resources.at(-1));
    assert.throws(() => buildCandidate(duplicate), /semantic identity already exists/);
  }

  assert.throws(
    () => buildCandidate(base, [{
      path: "docs/research/old-candidate.json",
      raw: '{"externalId":"official-mcp-registry:ai.adadvisor/mcp-server@1.0.1"}'
    }]),
    /historical semantic identity already exists/
  );
});

test("history dedupe normalizes canonical URLs and names without matching prose", () => {
  const base = readJson(inputs.baseAwsCatalogV3.path);

  assert.throws(
    () => buildCandidate(base, [{
      path: "docs/research/renamed-adramp-candidate.json",
      raw: JSON.stringify({
        catalog: {
          resources: [{
            id: "renamed-resource",
            name: "Different resource",
            publisher: "Different publisher",
            website: "https://example.com/resource",
            metadataSnapshot: {
              externalId: "new-external-id",
              canonicalSource: "https://adramp.ai/mcp"
            }
          }]
        }
      })
    }]),
    /historical semantic identity already exists/
  );

  assert.throws(
    () => buildCandidate(base, [{
      path: "docs/research/renamed-adadvisor-candidate.json",
      raw: JSON.stringify({
        proposedResources: [{
          id: "another-id",
          name: "  ADADVISOR---MCP server  ",
          publisher: "adadvisor inc",
          metadataSnapshot: { externalId: "another-external-id" }
        }]
      })
    }]),
    /historical semantic identity already exists/
  );

  assert.doesNotThrow(() => buildCandidate(base, [{
    path: "docs/research/discovery-notes.json",
    raw: JSON.stringify({
      description:
        "Research prose mentions AdRamp Google Ads MCP and https://adramp.ai/mcp/ without defining a resource identity."
    })
  }]));
});

test("history dedupe skips only hash-verified structured successor ancestry", () => {
  const base = readJson(inputs.baseAwsCatalogV3.path);
  const currentRaw = fs.readFileSync(candidatePath, "utf8");
  const successorPath =
    "docs/research/adeu-mcp-catalog-v3-candidate-2026-08-14.json";
  const successorRaw = fs.readFileSync(path.join(root, successorPath), "utf8");
  const anchor = { path: candidateRelativePath, raw: currentRaw };
  const successor = { path: successorPath, raw: successorRaw };

  assert.equal(sha256(candidateRelativePath),
    "68d0a4e7d68f5a2bac778116fa0e6bc56df298f4c39c9d929896c3cd9120032f");
  assert.doesNotThrow(() => buildCandidate(base, [anchor, successor]));

  const directValue = JSON.parse(successorRaw);
  const successorWithIndependentCopy = structuredClone(directValue);
  successorWithIndependentCopy.catalog.resources.push({
    id: "renamed-independent-adadvisor-copy",
    name: "AdAdvisor MCP Server",
    publisher: "AdAdvisor, Inc."
  });
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/successor-with-independent-copy-candidate.json",
      raw: JSON.stringify(successorWithIndependentCopy)
    }]),
    /historical semantic identity already exists/
  );

  const forgedHash = structuredClone(directValue);
  forgedHash.inputs.baseAdsCatalogV3.sha256 = "0".repeat(64);
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/forged-hash-successor-candidate.json",
      raw: JSON.stringify(forgedHash)
    }]),
    /historical semantic identity already exists/
  );

  const forgedPath = structuredClone(directValue);
  forgedPath.inputs.baseAdsCatalogV3.path =
    "docs/research/not-the-advertising-candidate.json";
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/forged-path-successor-candidate.json",
      raw: JSON.stringify(forgedPath)
    }]),
    /historical semantic identity already exists/
  );

  const noAncestry = structuredClone(directValue);
  noAncestry.inputs = {};
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/no-ancestry-candidate.json",
      raw: JSON.stringify(noAncestry)
    }]),
    /historical semantic identity already exists/
  );

  const transitive = structuredClone(directValue);
  transitive.inputs = {
    baseAdeuCatalogV3: {
      path: successorPath,
      sha256: crypto.createHash("sha256").update(successorRaw).digest("hex")
    }
  };
  const transitiveEntry = {
    path: "docs/research/transitive-successor-candidate.json",
    raw: JSON.stringify(transitive)
  };
  assert.doesNotThrow(() => buildCandidate(base, [anchor, successor, transitiveEntry]));

  const forgedTransitive = structuredClone(transitive);
  forgedTransitive.inputs.baseAdeuCatalogV3.sha256 = "f".repeat(64);
  assert.throws(
    () => buildCandidate(base, [anchor, successor, {
      path: "docs/research/forged-transitive-successor-candidate.json",
      raw: JSON.stringify(forgedTransitive)
    }]),
    /historical semantic identity already exists/
  );

  const cycleA = structuredClone(directValue);
  const cycleB = structuredClone(directValue);
  cycleA.inputs = {
    parent: { path: "docs/research/cycle-b-candidate.json", sha256: "a".repeat(64) }
  };
  cycleB.inputs = {
    parent: { path: "docs/research/cycle-a-candidate.json", sha256: "b".repeat(64) }
  };
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/cycle-a-candidate.json",
      raw: JSON.stringify(cycleA)
    }, {
      path: "docs/research/cycle-b-candidate.json",
      raw: JSON.stringify(cycleB)
    }]),
    /historical semantic identity already exists/
  );
});

test("generator rejects base contract drift and is byte-idempotent", () => {
  const base = readJson(inputs.baseAwsCatalogV3.path);
  const invalid = structuredClone(base);
  invalid.catalog.resourceConnections.pop();
  assert.throws(() => buildCandidate(invalid), /base catalog v3 contract mismatch/);

  const generatorPath = path.join(root, generatorRelativePath);
  childProcess.execFileSync(process.execPath, [generatorPath], {
    cwd: root,
    stdio: "pipe"
  });
  const first = sha256(candidateRelativePath);
  childProcess.execFileSync(process.execPath, [generatorPath], {
    cwd: root,
    stdio: "pipe"
  });
  assert.equal(sha256(candidateRelativePath), first);
});
