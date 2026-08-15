"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  assertFrozenInputHashes,
  buildCandidate
} = require("../scripts/generate-adeu-mcp-catalog-v3-candidate.cjs");

const root = path.resolve(__dirname, "..");
const candidateRelativePath =
  "docs/research/adeu-mcp-catalog-v3-candidate-2026-08-14.json";
const candidatePath = path.join(root, candidateRelativePath);
const generatorRelativePath = "scripts/generate-adeu-mcp-catalog-v3-candidate.cjs";
const inputs = Object.freeze({
  baseAdsCatalogV3: {
    path: "docs/research/adadvisor-adramp-mcp-catalog-v3-candidate-2026-08-14.json",
    sha256: "68d0a4e7d68f5a2bac778116fa0e6bc56df298f4c39c9d929896c3cd9120032f"
  },
  upstreamResearch: {
    path: "docs/research/adeu-mcp-first-party-current-review-2026-08-14.md",
    sha256: "b39571459d01c06a26670b5e7db0e107930d10c3eac6b4119834ba9f03cccf20"
  }
});
const sourceRevision = "55f271eb7024d428e5a8f62819ff1376a138166c";
const sourceRoot = `https://github.com/dealfluence/adeu/tree/${sourceRevision}`;

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

test("Adeu MCP catalog v3 candidate exists", () => {
  assert.equal(fs.existsSync(candidatePath), true, "Adeu MCP candidate must exist");
});

test("candidate adds exactly one unsafe first-party link-only Adeu MCP resource", () => {
  for (const input of Object.values(inputs)) {
    assert.equal(sha256(input.path), input.sha256, `frozen input drift: ${input.path}`);
  }

  const base = readJson(inputs.baseAdsCatalogV3.path);
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
    resources: 267,
    targets: 813,
    resourceConnections: 10,
    appendedResources: 1
  });
  assert.equal(candidate.catalog.schemaVersion, 3);
  assert.equal(candidate.catalog.updatedAt, base.catalog.updatedAt);
  assert.equal(candidate.catalog.resources.length, 267);
  assert.equal(
    candidate.catalog.resources.reduce((count, item) => count + item.targets.length, 0),
    813
  );
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);

  const adeu = candidate.catalog.resources.at(-1);
  assert.deepEqual(Object.keys(adeu).sort(), [
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
  assert.equal(adeu.id, "adeu-mcp-server");
  assert.equal(adeu.name, "Adeu MCP Server");
  assert.equal(adeu.publisher, "Dealfluence Oy / Adeu");
  assert.equal(adeu.sourceKind, "official");
  assert.equal(adeu.reviewStatus, "manually-reviewed");
  assert.equal(adeu.riskLevel, "unsafe");
  assert.deepEqual(adeu.resourceTypes, ["mcp"]);
  assert.equal(Object.hasOwn(adeu, "publisherVendorId"), false);
  assert.equal(Object.hasOwn(adeu, "sourceProductIds"), false);
  assert.equal(adeu.website, sourceRoot);
  assert.equal(adeu.tutorial, `${sourceRoot}#readme`);
  assert.equal(adeu.versionRef, `ai.adeu/adeu@2.4.0+commit-${sourceRevision}`);
  assert.deepEqual(adeu.targets, [
    target("claude-desktop"),
    target("gemini-cli"),
    target("cursor-desktop"),
    target("windsurf-editor")
  ]);
  assert.equal(adeu.targets.some(({ productId }) => productId === "microsoft-vscode"), false);
  assert.equal(
    candidate.catalog.resourceConnections.some(({ resourceId }) => resourceId === adeu.id),
    false
  );

  assert.match(adeu.description, /ai\.adeu\/adeu 2\.4\.0/);
  assert.match(adeu.description, /@adeu\/mcp-server 2\.4\.0/);
  assert.match(adeu.description, /DOCX/);
  assert.match(adeu.description, /活动 Word/);
  assert.match(adeu.description, /Track Changes/);
  assert.match(adeu.description, /数据损失/);
  const permissions = adeu.requestedPermissions.join("\n");
  for (const fact of [
    /LLM provider/,
    /批量改写/,
    /表格/,
    /评论/,
    /接受或拒绝修订/,
    /metadata/,
    /只读锁/,
    /不是访问控制/,
    /Cloud 与邮箱工具/,
    /不把它们归入已核验的本地 OSS 能力/
  ]) assert.match(permissions, fact);
  assert.deepEqual(adeu.credentialRequirements, [
    "发布方称本地 core 无需 Adeu 账户或 API key；这是发布方声明，不是枕星 AI 对外部服务凭据需求的独立验证。",
    "用户选择的 LLM provider 或未来 Cloud 功能所需凭据由用户在对应服务中自行管理；本候选不连接 Cloud 或邮箱能力。",
    "枕星 AI 不请求、收集、保存、代理、校验或转发 Adeu、LLM、Cloud、邮箱登录材料、API key、授权或其他认证信息。"
  ]);
  for (const fact of [/固定到审核提交/, /不下载/, /不安装/, /不配置/, /不启动或运行/, /Node 22/, /Python 3\.12/, /Word COM/]) {
    assert.match(adeu.installScope, fact);
  }
  assert.deepEqual(adeu.provenanceEvidence, [
    sourceRoot,
    `https://github.com/dealfluence/adeu/blob/${sourceRevision}/LICENSE`,
    `https://github.com/dealfluence/adeu/blob/${sourceRevision}/README.md`,
    `https://github.com/dealfluence/adeu/blob/${sourceRevision}/python/server.json`,
    `https://github.com/dealfluence/adeu/blob/${sourceRevision}/node/packages/mcp-server/package.json`
  ]);
  assert.deepEqual(adeu.metadataSnapshot, {
    sourcePlatform: "github",
    discoveredVia: "first-party-review",
    sourcePage: sourceRoot,
    canonicalSource: "https://github.com/dealfluence/adeu",
    originalAuthor: "Dealfluence Oy / Adeu",
    licenseId: "MIT",
    sourceRevision,
    provenanceStatus: "first-party-verified",
    externalId: `github:dealfluence/adeu@${sourceRevision}#ai.adeu/adeu@2.4.0`,
    observedAt: "2026-08-14T00:00:00.000Z",
    licenseStatus: "verified"
  });

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
  visit(adeu);

  assert.equal(validateCatalog(candidate.catalog), candidate.catalog);
  const reversed = structuredClone(candidate.catalog);
  assert.deepEqual(reversed.resources.pop(), adeu);
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
      baseAdsCatalogV3: "0".repeat(64),
      upstreamResearch: inputs.upstreamResearch.sha256
    }),
    /frozen input drift/
  );

  const base = readJson(inputs.baseAdsCatalogV3.path);
  for (const mutation of [
    (item) => { item.id = "adeu-mcp-server"; },
    (item) => {
      item.name = "  ADEU---MCP server  ";
      item.publisher = "dealfluence oy adeu";
    },
    (item) => {
      item.metadataSnapshot.externalId =
        `github:dealfluence/adeu@${sourceRevision}#ai.adeu/adeu@2.4.0`;
    },
    (item) => { item.website = "https://github.com/dealfluence/adeu/"; }
  ]) {
    const duplicate = structuredClone(base);
    mutation(duplicate.catalog.resources.at(-1));
    assert.throws(() => buildCandidate(duplicate), /semantic identity already exists/);
  }

  assert.throws(
    () => buildCandidate(base, [{
      path: "docs/research/renamed-adeu-candidate.json",
      raw: JSON.stringify({
        proposedResources: [{
          id: "renamed-resource",
          name: "Different resource",
          publisher: "Different publisher",
          metadataSnapshot: {
            externalId: "new-external-id",
            canonicalSource: "https://github.com/dealfluence/adeu/"
          }
        }]
      })
    }]),
    /historical semantic identity already exists/
  );
  assert.doesNotThrow(() => buildCandidate(base, [{
    path: "docs/research/discovery-notes.json",
    raw: JSON.stringify({
      description: "Research prose mentions Adeu MCP Server and github.com/dealfluence/adeu."
    })
  }]));
});

test("history dedupe skips only a hash-verified exact inherited Adeu resource", () => {
  const base = readJson(inputs.baseAdsCatalogV3.path);
  const currentRaw = fs.readFileSync(candidatePath, "utf8");
  const successorPath =
    "docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json";
  const successorRaw = fs.readFileSync(path.join(root, successorPath), "utf8");
  const anchor = { path: candidateRelativePath, raw: currentRaw };
  const successor = { path: successorPath, raw: successorRaw };

  assert.equal(sha256(candidateRelativePath),
    "1cc5da97e4a371a71c0e0118109156858c183e16f52159224768e20e8c6dea03");
  assert.equal(sha256(successorPath),
    "265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20");
  const currentAdeu = readJson(candidateRelativePath).catalog.resources.at(-1);
  const directValue = JSON.parse(successorRaw);
  const inherited = directValue.catalog.resources.filter(({ id }) => id === "adeu-mcp-server");
  assert.equal(inherited.length, 1);
  assert.deepEqual(inherited[0], currentAdeu);
  assert.doesNotThrow(() => buildCandidate(base, [anchor, successor]));

  const extraCanonicalIdentity = structuredClone(directValue);
  extraCanonicalIdentity.catalog.resources.push({
    id: "renamed-independent-adeu-copy",
    name: "Renamed document assistant",
    publisher: "Independent publisher",
    metadataSnapshot: { canonicalSource: "https://github.com/dealfluence/adeu" }
  });
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/successor-with-independent-adeu-copy-candidate.json",
      raw: JSON.stringify(extraCanonicalIdentity)
    }]),
    /historical semantic identity already exists/
  );

  const duplicatedExactResource = structuredClone(directValue);
  duplicatedExactResource.catalog.resources.push(structuredClone(currentAdeu));
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/successor-with-two-exact-adeu-resources-candidate.json",
      raw: JSON.stringify(duplicatedExactResource)
    }]),
    /historical semantic identity already exists/
  );

  const forgedHash = structuredClone(directValue);
  forgedHash.inputs.baseAdeuCatalogV3.sha256 = "0".repeat(64);
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/forged-hash-adeu-successor-candidate.json",
      raw: JSON.stringify(forgedHash)
    }]),
    /historical semantic identity already exists/
  );

  const forgedPath = structuredClone(directValue);
  forgedPath.inputs.baseAdeuCatalogV3.path = "docs/research/not-the-adeu-candidate.json";
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/forged-path-adeu-successor-candidate.json",
      raw: JSON.stringify(forgedPath)
    }]),
    /historical semantic identity already exists/
  );

  const unknownAncestor = structuredClone(directValue);
  unknownAncestor.inputs = {
    parent: {
      path: "docs/research/unknown-adeu-ancestor-candidate.json",
      sha256: "f".repeat(64)
    }
  };
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/unknown-ancestor-adeu-successor-candidate.json",
      raw: JSON.stringify(unknownAncestor)
    }]),
    /historical semantic identity already exists/
  );

  const transitive = structuredClone(directValue);
  transitive.inputs = {
    parent: {
      path: successorPath,
      sha256: crypto.createHash("sha256").update(successorRaw).digest("hex")
    }
  };
  assert.doesNotThrow(() => buildCandidate(base, [anchor, successor, {
    path: "docs/research/transitive-adeu-successor-candidate.json",
    raw: JSON.stringify(transitive)
  }]));

  const cycleA = structuredClone(directValue);
  const cycleB = structuredClone(directValue);
  cycleA.inputs = {
    parent: { path: "docs/research/adeu-cycle-b-candidate.json", sha256: "a".repeat(64) }
  };
  cycleB.inputs = {
    parent: { path: "docs/research/adeu-cycle-a-candidate.json", sha256: "b".repeat(64) }
  };
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/adeu-cycle-a-candidate.json",
      raw: JSON.stringify(cycleA)
    }, {
      path: "docs/research/adeu-cycle-b-candidate.json",
      raw: JSON.stringify(cycleB)
    }]),
    /historical semantic identity already exists/
  );
});

test("generator rejects base contract drift and is byte-idempotent", () => {
  const base = readJson(inputs.baseAdsCatalogV3.path);
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
