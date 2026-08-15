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
} = require("../scripts/generate-agentic-news-affiliate-hermes-catalog-v3-candidate.cjs");

const root = path.resolve(__dirname, "..");
const candidateRelativePath =
  "docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json";
const candidatePath = path.join(root, candidateRelativePath);
const generatorRelativePath =
  "scripts/generate-agentic-news-affiliate-hermes-catalog-v3-candidate.cjs";
const inputs = Object.freeze({
  baseAdeuCatalogV3: {
    path: "docs/research/adeu-mcp-catalog-v3-candidate-2026-08-14.json",
    sha256: "1cc5da97e4a371a71c0e0118109156858c183e16f52159224768e20e8c6dea03"
  },
  registryResearch: {
    path: "docs/research/official-mcp-registry-next10b-first-party-review-2026-08-15.md",
    sha256: "8b9db20e3085798950b00a5c44c1451b4e2a0581c69b6fd5cb36f91281ad09ff"
  },
  hermesResearch: {
    path: "docs/research/hermes-official-skill-seeds-next-batch-review-2026-08-15.md",
    sha256: "f727bfe946a333ebe604abc24ba9862e2ccd4640ca2e83a562061ec85f5d2270"
  }
});
const hermesRevision = "642b735dbdbae4f01f5df0b9288d5f67a7e530f4";
const hermesRepository = "https://github.com/NousResearch/hermes-agent";
const hermesDirectory =
  `${hermesRepository}/tree/${hermesRevision}/optional-skills/communication/one-three-one-rule`;
const affiliateRepository = "https://github.com/bobberrisford/affiliatemcp";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function sha256(relativePath) {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex");
}

function target(productId) {
  return {
    productId,
    compatibility: "official",
    moduleId: "resource-link",
    installProfileId: "",
    capabilities: ["website"],
    enabled: true
  };
}

test("Agentic News, Affiliate Networks, and Hermes candidate exists", () => {
  assert.equal(fs.existsSync(candidatePath), true, "candidate must exist");
});

test("candidate appends the exact three evidence-backed link-only resources", () => {
  for (const input of Object.values(inputs)) {
    assert.equal(sha256(input.path), input.sha256, `frozen input drift: ${input.path}`);
  }

  const base = readJson(inputs.baseAdeuCatalogV3.path);
  const candidate = readJson(candidateRelativePath);
  assert.deepEqual(candidate, buildCandidate(base));
  assert.deepEqual(Object.keys(candidate).sort(), [
    "candidateOnly", "catalog", "freezeOnly", "generatedAt", "inputs",
    "publishable", "safety", "schemaVersion", "summary", "targetRelease", "title"
  ]);
  assert.deepEqual(
    [candidate.schemaVersion, candidate.candidateOnly, candidate.freezeOnly, candidate.publishable],
    [1, true, true, false]
  );
  assert.equal(candidate.targetRelease, "next-major");
  assert.deepEqual(candidate.inputs, inputs);
  assert.deepEqual(candidate.summary, {
    resources: 270,
    targets: 821,
    resourceConnections: 10,
    appendedResources: 3
  });
  assert.equal(candidate.catalog.schemaVersion, 3);
  assert.equal(candidate.catalog.updatedAt, base.catalog.updatedAt);
  assert.equal(candidate.catalog.resources.length, 270);
  assert.equal(
    candidate.catalog.resources.reduce((count, item) => count + item.targets.length, 0),
    821
  );
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);
  assert.equal(Object.hasOwn(candidate, "resourceConnections"), false);

  const added = candidate.catalog.resources.slice(-3);
  const expected = [
    {
      id: "agentic-news-mcp",
      order: 262,
      name: "Agentic News MCP",
      publisher: "Agentic News",
      resourceTypes: ["mcp"],
      riskLevel: "guarded",
      versionRef: "registry@1.0.0+rolling-official-service",
      website: "https://agentic-news.ai/mcp",
      tutorial: "https://agentic-news.ai/mcp",
      targets: ["claude-desktop", "cursor-desktop", "microsoft-vscode", "windsurf-editor"],
      licenseId: "service-terms",
      sourceRevision: "registry-1.0.0+rolling-service",
      externalId: "official-mcp-registry:ai.agentic-news/mcp@1.0.0"
    },
    {
      id: "affiliate-networks-mcp",
      order: 263,
      name: "Affiliate Networks MCP",
      publisher: "Robert Berrisford",
      resourceTypes: ["mcp"],
      riskLevel: "unsafe",
      versionRef: "registry@0.19.0+signed-release-v0.19.0+commit-9248d42",
      website: `${affiliateRepository}/releases/tag/v0.19.0`,
      tutorial: `${affiliateRepository}/tree/v0.19.0`,
      targets: ["claude-desktop", "claude-code", "codex-cli"],
      licenseId: "MIT",
      sourceRevision: "v0.19.0+9248d42",
      externalId:
        "official-mcp-registry:ai.agenticaffiliate/affiliate-networks-mcp@0.19.0"
    },
    {
      id: "hermes-one-three-one-rule",
      order: 264,
      name: "One-Three-One Rule",
      publisher: "Willard Moore",
      resourceTypes: ["skill"],
      riskLevel: "low",
      versionRef: `SKILL.md@1.0.0+${hermesRevision}`,
      website: hermesDirectory,
      tutorial:
        `${hermesRepository}/blob/${hermesRevision}/optional-skills/communication/one-three-one-rule/SKILL.md`,
      targets: ["nous-hermes-agent"],
      licenseId: "MIT",
      sourceRevision: hermesRevision,
      externalId:
        "github:nousresearch/hermes-agent#optional-skills/communication/one-three-one-rule"
    }
  ];

  const resourceKeys = [
    "credentialRequirements", "description", "enabled", "id", "installScope",
    "lastVerifiedAt", "metadataSnapshot", "name", "order", "provenanceEvidence",
    "publisher", "requestedPermissions", "resourceTypes", "reviewStatus", "riskLevel",
    "sourceKind", "targets", "tutorial", "uninstallPlan", "versionRef", "website"
  ].sort();
  for (const [index, resource] of added.entries()) {
    const facts = expected[index];
    assert.deepEqual(Object.keys(resource).sort(), resourceKeys);
    assert.deepEqual(
      {
        id: resource.id,
        order: resource.order,
        name: resource.name,
        publisher: resource.publisher,
        resourceTypes: resource.resourceTypes,
        riskLevel: resource.riskLevel,
        versionRef: resource.versionRef,
        website: resource.website,
        tutorial: resource.tutorial,
        targets: resource.targets.map(({ productId }) => productId),
        licenseId: resource.metadataSnapshot.licenseId,
        sourceRevision: resource.metadataSnapshot.sourceRevision,
        externalId: resource.metadataSnapshot.externalId
      },
      facts
    );
    assert.equal(resource.enabled, true);
    assert.equal(resource.sourceKind, "official");
    assert.equal(resource.reviewStatus, "manually-reviewed");
    assert.equal(resource.metadataSnapshot.provenanceStatus, "first-party-verified");
    assert.equal(resource.metadataSnapshot.licenseStatus, "verified");
    assert.equal(Object.hasOwn(resource, "publisherVendorId"), false);
    assert.equal(Object.hasOwn(resource, "sourceProductIds"), false);
    assert.deepEqual(resource.targets, facts.targets.map(target));
    assert.equal(
      candidate.catalog.resourceConnections.some(({ resourceId }) => resourceId === resource.id),
      false,
      `${resource.id} must remain link-only without a new relationship edge`
    );
  }

  const [news, affiliate, hermes] = added;
  for (const pattern of [/监控 agent/, /提交反馈/, /collection/, /subprocessors/]) {
    assert.match(news.description, pattern);
  }
  for (const pattern of [/API access/, /OAuth 2\.0 with PKCE/, /key hash/, /tool-call log/, /不请求、收集、保存、代理、校验或转发/]) {
    assert.match(news.credentialRequirements.join("\n"), pattern);
  }
  assert.deepEqual(news.provenanceEvidence, [
    "https://agentic-news.ai/mcp",
    "https://agentic-news.ai/terms",
    "https://agentic-news.ai/privacy"
  ]);

  for (const pattern of [/社区实现/, /并非.*官方集成/, /read-only|只读/, /配置/, /凭据/, /cache/, /experimental/]) {
    assert.match(`${affiliate.description}\n${affiliate.requestedPermissions.join("\n")}`, pattern);
  }
  for (const pattern of [/用户自备/, /hosted connector/, /OAuth/, /加密 vault/, /不请求、收集、保存、代理、校验或转发/]) {
    assert.match(affiliate.credentialRequirements.join("\n"), pattern);
  }
  assert.deepEqual(affiliate.provenanceEvidence, [
    `${affiliateRepository}/releases/tag/v0.19.0`,
    `${affiliateRepository}/tree/v0.19.0`,
    `${affiliateRepository}/blob/v0.19.0/LICENCE`
  ]);

  for (const pattern of [/一个问题/, /三个选项/, /一个建议/, /完成定义/, /实施计划/, /不自带命令、网络、凭据/]) {
    assert.match(hermes.description, pattern);
  }
  assert.match(hermes.credentialRequirements.join("\n"), /未声明账户、API key、OAuth、token/);
  assert.match(hermes.requestedPermissions.join("\n"), /不预先授予/);
  assert.deepEqual(hermes.provenanceEvidence, [
    hermesDirectory,
    `${hermesRepository}/blob/${hermesRevision}/optional-skills/communication/one-three-one-rule/SKILL.md`,
    `${hermesRepository}/blob/${hermesRevision}/website/docs/reference/optional-skills-catalog.md`,
    `${hermesRepository}/blob/${hermesRevision}/LICENSE`
  ]);

  for (const resource of added) {
    assert.match(resource.installScope, /^仅打开/);
    assert.match(resource.installScope, /不.*安装|不复制或安装/);
    assert.match(resource.uninstallPlan, /没有托管卸载状态/);
  }

  const forbiddenFields = new Set([
    "args", "command", "credential", "credentialValue", "credentialValues",
    "credentials", "endpoint", "env", "headers", "installArgs", "installCommand",
    "installPackage", "installRuntime", "managedInstall", "package", "path", "runtime",
    "runtimeConfig", "script", "secret", "token", "value"
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenFields.has(key), false, `forbidden runtime field: ${key}`);
      visit(child);
    }
  };
  added.forEach(visit);
  assert.doesNotMatch(JSON.stringify(added), /clawhub|@aws\/agents-build/i);

  assert.equal(validateCatalog(candidate.catalog), candidate.catalog);
  const reversed = structuredClone(candidate.catalog);
  assert.deepEqual(reversed.resources.splice(-3), added);
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

test("generator fails closed on frozen drift and active or historical semantic duplicates", () => {
  assert.throws(
    () => assertFrozenInputHashes({
      baseAdeuCatalogV3: "0".repeat(64),
      registryResearch: inputs.registryResearch.sha256,
      hermesResearch: inputs.hermesResearch.sha256
    }),
    /frozen input drift/
  );

  const base = readJson(inputs.baseAdeuCatalogV3.path);
  const duplicateName = structuredClone(base);
  duplicateName.catalog.resources.at(-1).name = "Agentic News MCP";
  duplicateName.catalog.resources.at(-1).publisher = "Agentic News";
  assert.throws(() => buildCandidate(duplicateName), /semantic identity already exists/);

  const duplicateExternalId = structuredClone(base);
  duplicateExternalId.catalog.resources.at(-1).metadataSnapshot.externalId =
    "official-mcp-registry:ai.agenticaffiliate/affiliate-networks-mcp@0.19.0";
  assert.throws(() => buildCandidate(duplicateExternalId), /semantic identity already exists/);

  const duplicateSource = structuredClone(base);
  duplicateSource.catalog.resources.at(-1).tutorial =
    `${hermesRepository}/blob/0000000000000000000000000000000000000000/optional-skills/communication/one-three-one-rule/SKILL.md`;
  assert.throws(() => buildCandidate(duplicateSource), /semantic identity already exists/);

  assert.throws(
    () => buildCandidate(base, [{
      path: "docs/research/historical-collision.json",
      raw: JSON.stringify({ resource: { id: "affiliate-networks-mcp" } })
    }]),
    /historical semantic identity already exists/
  );
  assert.throws(
    () => buildCandidate(base, [{
      path: "docs/research/historical-canonical-collision.json",
      raw: JSON.stringify({ resource: { canonicalSource: affiliateRepository } })
    }]),
    /historical semantic identity already exists/
  );
});

test("history dedupe skips only three hash-verified inherited resources", () => {
  const base = readJson(inputs.baseAdeuCatalogV3.path);
  const currentRaw = fs.readFileSync(candidatePath, "utf8");
  const current = JSON.parse(currentRaw);
  const currentSha = sha256(candidateRelativePath);
  const anchor = { path: candidateRelativePath, raw: currentRaw };
  const successorPath =
    "docs/research/future-agentic-affiliate-hermes-catalog-v3-candidate.json";
  const direct = structuredClone(current);
  direct.inputs = {
    parent: { path: candidateRelativePath, sha256: currentSha }
  };
  const inherited = direct.catalog.resources.slice(-3);

  assert.equal(
    currentSha,
    "265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20"
  );
  assert.deepEqual(inherited, current.catalog.resources.slice(-3));
  assert.deepEqual(inherited.map(({ id }) => id), [
    "agentic-news-mcp",
    "affiliate-networks-mcp",
    "hermes-one-three-one-rule"
  ]);
  assert.doesNotThrow(() => buildCandidate(base, [anchor, {
    path: successorPath,
    raw: JSON.stringify(direct)
  }]));

  const extraCanonicalIdentity = structuredClone(direct);
  extraCanonicalIdentity.catalog.resources.push({
    id: "renamed-independent-agentic-copy",
    name: "Renamed news assistant",
    publisher: "Independent publisher",
    metadataSnapshot: { canonicalSource: "https://agentic-news.ai/mcp" }
  });
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/successor-with-independent-agentic-copy-candidate.json",
      raw: JSON.stringify(extraCanonicalIdentity)
    }]),
    /historical semantic identity already exists/
  );

  const duplicateExact = structuredClone(direct);
  duplicateExact.catalog.resources.push(structuredClone(inherited[0]));
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/successor-with-two-agentic-news-resources-candidate.json",
      raw: JSON.stringify(duplicateExact)
    }]),
    /historical semantic identity already exists/
  );

  const forgedHash = structuredClone(direct);
  forgedHash.inputs.parent.sha256 = "0".repeat(64);
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/forged-hash-agentic-successor-candidate.json",
      raw: JSON.stringify(forgedHash)
    }]),
    /historical semantic identity already exists/
  );

  const forgedPath = structuredClone(direct);
  forgedPath.inputs.parent.path = "docs/research/not-the-frozen-candidate.json";
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/forged-path-agentic-successor-candidate.json",
      raw: JSON.stringify(forgedPath)
    }]),
    /historical semantic identity already exists/
  );

  const unknownAncestor = structuredClone(direct);
  unknownAncestor.inputs = {
    parent: {
      path: "docs/research/unknown-agentic-ancestor-candidate.json",
      sha256: "f".repeat(64)
    }
  };
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/unknown-agentic-successor-candidate.json",
      raw: JSON.stringify(unknownAncestor)
    }]),
    /historical semantic identity already exists/
  );

  const cycleA = structuredClone(direct);
  const cycleB = structuredClone(direct);
  cycleA.inputs = {
    parent: { path: "docs/research/agentic-cycle-b-candidate.json", sha256: "a".repeat(64) }
  };
  cycleB.inputs = {
    parent: { path: "docs/research/agentic-cycle-a-candidate.json", sha256: "b".repeat(64) }
  };
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/agentic-cycle-a-candidate.json",
      raw: JSON.stringify(cycleA)
    }, {
      path: "docs/research/agentic-cycle-b-candidate.json",
      raw: JSON.stringify(cycleB)
    }]),
    /historical semantic identity already exists/
  );
});

test("generator is byte-idempotent", () => {
  const generatorPath = path.join(root, generatorRelativePath);
  childProcess.execFileSync(process.execPath, [generatorPath], { cwd: root, stdio: "pipe" });
  const first = sha256(candidateRelativePath);
  childProcess.execFileSync(process.execPath, [generatorPath], { cwd: root, stdio: "pipe" });
  assert.equal(sha256(candidateRelativePath), first);
});
