"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  assertFrozenInputHashes,
  buildCandidate
} = require("../scripts/generate-aws-agents-build-skill-catalog-v3-candidate.cjs");

const root = path.resolve(__dirname, "..");
const candidateRelativePath =
  "docs/research/aws-agents-build-skill-catalog-v3-candidate-2026-08-14.json";
const candidatePath = path.resolve(
  root,
  candidateRelativePath
);
const generatorRelativePath =
  "scripts/generate-aws-agents-build-skill-catalog-v3-candidate.cjs";
const inputs = Object.freeze({
  baseBraveCatalogV3: {
    path: "docs/research/brave-search-mcp-catalog-v3-candidate-2026-08-14.json",
    sha256: "990721f3f8e55923d7014eb603ed9c3059e7e06f66415991b08e7e3164aca219"
  },
  upstreamResearch: {
    path: "docs/research/aws-agents-build-skill-first-party-evidence-2026-08-14.md",
    sha256: "aefb6d0a43a6aab04f2ff0bb619ad38c03f7817e1ececd643d33840e7ff9ef29"
  }
});
const revision = "1beb63a6a1d0760bb444961ea62cdca362edae72";
const repository = "https://github.com/aws/agent-toolkit-for-aws";
const skillDirectory =
  `${repository}/tree/${revision}/plugins/aws-agents/skills/agents-build`;
const externalId =
  "github:aws/agent-toolkit-for-aws#plugins/aws-agents/skills/agents-build";

function bytes(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(bytes(relativePath)).digest("hex");
}

function readJson(relativePath) {
  return JSON.parse(bytes(relativePath).toString("utf8"));
}

test("AWS Agents Build Skill catalog v3 candidate exists", () => {
  assert.equal(
    fs.existsSync(candidatePath),
    true,
    "AWS Agents Build Skill candidate must exist"
  );
});

test("candidate adds exactly one unsafe link-only AWS Agents Build Skill", () => {
  for (const input of Object.values(inputs)) {
    assert.equal(sha256(input.path), input.sha256, `frozen input drift: ${input.path}`);
  }
  const base = readJson(inputs.baseBraveCatalogV3.path);
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
    resources: 264,
    targets: 801,
    resourceConnections: 10,
    appendedResources: 1
  });
  assert.equal(candidate.catalog.schemaVersion, 3);
  assert.equal(candidate.catalog.updatedAt, base.catalog.updatedAt);
  assert.equal(candidate.catalog.resources.length, 264);
  assert.equal(
    candidate.catalog.resources.reduce((count, resource) => count + resource.targets.length, 0),
    801
  );
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);
  assert.equal(
    candidate.catalog.resourceConnections.some(
      ({ resourceId }) => resourceId === "aws-agent-toolkit-agents-build"
    ),
    false,
    "link-only Skill must not invent a relationship edge"
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
      versionRef: resource.versionRef,
      sourceProductIds: resource.sourceProductIds
    },
    {
      id: "aws-agent-toolkit-agents-build",
      name: "AWS Agents Build",
      publisherVendorId: "amazon",
      publisher: "Amazon Web Services",
      sourceKind: "official",
      reviewStatus: "manually-reviewed",
      riskLevel: "unsafe",
      resourceTypes: ["skill"],
      versionRef: `SKILL.md@1.0.0+${revision}`,
      sourceProductIds: []
    }
  );
  assert.deepEqual(resource.targets, [
    {
      productId: "claude-code",
      compatibility: "official",
      moduleId: "resource-link",
      installProfileId: "",
      capabilities: ["website"],
      enabled: true
    },
    {
      productId: "codex-cli",
      compatibility: "official",
      moduleId: "resource-link",
      installProfileId: "",
      capabilities: ["website"],
      enabled: true
    },
    {
      productId: "cursor-desktop",
      compatibility: "official",
      moduleId: "resource-link",
      installProfileId: "",
      capabilities: ["website"],
      enabled: true
    }
  ]);
  assert.equal(resource.website, skillDirectory);
  assert.equal(
    resource.tutorial,
    `${repository}/blob/${revision}/plugins/aws-agents/skills/agents-build/SKILL.md`
  );

  for (const pattern of [
    /Bash/,
    /本地文件写入/,
    /AWS API\/IAM/,
    /VPC/,
    /网络/,
    /浏览器/,
    /代码解释器/,
    /支付与花费/,
    /永久删除/,
    /残留/
  ]) {
    assert.match(resource.description, pattern);
  }
  const permissions = resource.requestedPermissions.join("\n");
  for (const pattern of [
    /Bash/,
    /本地项目文件/,
    /AWS API/,
    /IAM/,
    /VPC/,
    /网络/,
    /浏览器自动化/,
    /Code Interpreter/,
    /Python\/JavaScript\/TypeScript/,
    /支付/,
    /实际花费/,
    /永久删除/,
    /残留/
  ]) {
    assert.match(permissions, pattern);
  }
  const credentials = resource.credentialRequirements.join("\n");
  for (const pattern of [
    /AWS access key/,
    /API key/,
    /token/,
    /provider secret/,
    /钱包密钥/,
    /不请求、收集、保存、代理、校验或转发/
  ]) {
    assert.match(credentials, pattern);
  }
  assert.match(resource.installScope, /仅打开固定 commit/);
  assert.match(resource.installScope, /不执行 Bash\/AgentCore\/AWS CLI\/CDK/);
  assert.match(resource.installScope, /不调用 AWS 或第三方 API/);
  assert.match(resource.installScope, /不创建、更新或删除本地及云状态/);
  assert.match(resource.uninstallPlan, /没有托管卸载状态/);
  assert.match(resource.uninstallPlan, /残留日志、ECR 镜像和本地文件/);

  assert.deepEqual(resource.provenanceEvidence, [
    skillDirectory,
    `${repository}/blob/${revision}/plugins/aws-agents/skills/agents-build/SKILL.md`,
    `${repository}/blob/${revision}/plugins/aws-agents/plugin.json`,
    `${repository}/blob/${revision}/plugins/aws-agents/.claude-plugin/plugin.json`,
    `${repository}/blob/${revision}/plugins/aws-agents/.codex-plugin/plugin.json`,
    `${repository}/blob/${revision}/plugins/aws-agents/.cursor-plugin/plugin.json`,
    `${repository}/blob/${revision}/README.md`,
    `${repository}/blob/${revision}/LICENSE`
  ]);
  assert.deepEqual(resource.metadataSnapshot, {
    sourcePlatform: "github",
    discoveredVia: "clawhub",
    sourcePage: skillDirectory,
    canonicalSource: skillDirectory,
    originalAuthor: "Amazon Web Services / aws-agentcore",
    licenseId: "Apache-2.0",
    sourceRevision: revision,
    provenanceStatus: "first-party-verified",
    externalId,
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
    "token"
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
  assert.doesNotMatch(JSON.stringify(resource), /knowledge-mcp\.global\.api\.aws|awsknowledge/);

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

test("generator rejects frozen drift and current-history semantic collisions", () => {
  assert.throws(
    () => assertFrozenInputHashes({
      baseBraveCatalogV3: "0".repeat(64),
      upstreamResearch: inputs.upstreamResearch.sha256
    }),
    /frozen input drift/
  );

  const base = readJson(inputs.baseBraveCatalogV3.path);
  assert.equal(
    base.catalog.resources.some(
      (resource) =>
        resource.id.toLowerCase() === "aws-agent-toolkit-agents-build" ||
        (resource.name.trim().toLowerCase() === "aws agents build" &&
          resource.publisher?.trim().toLowerCase() === "amazon web services") ||
        resource.metadataSnapshot?.externalId?.toLowerCase() === externalId ||
        [
          resource.website,
          resource.tutorial,
          resource.metadataSnapshot?.sourcePage,
          resource.metadataSnapshot?.canonicalSource
        ].some((value) => value?.includes("/plugins/aws-agents/skills/agents-build"))
    ),
    false,
    "frozen base/current-history projection already contains the AWS Skill identity"
  );

  const duplicateName = structuredClone(base);
  duplicateName.catalog.resources.at(-1).name = "AWS Agents Build";
  duplicateName.catalog.resources.at(-1).publisher = "Amazon Web Services";
  assert.throws(() => buildCandidate(duplicateName), /semantic identity already exists/);

  const duplicateExternalId = structuredClone(base);
  duplicateExternalId.catalog.resources.at(-1).metadataSnapshot.externalId = externalId;
  assert.throws(
    () => buildCandidate(duplicateExternalId),
    /semantic identity already exists/
  );

  const duplicateSource = structuredClone(base);
  duplicateSource.catalog.resources.at(-1).tutorial =
    `${repository}/blob/0000000000000000000000000000000000000000/plugins/aws-agents/skills/agents-build/SKILL.md`;
  assert.throws(
    () => buildCandidate(duplicateSource),
    /canonical Skill source already exists/
  );
});

test("empty sourceProductIds preserves the current catalog source-product contract", () => {
  const candidate = readJson(candidateRelativePath);
  const amazon = candidate.catalog.vendors.find(({ id }) => id === "amazon");
  const agentCore = amazon.products.find(({ id }) => id === "amazon-bedrock-agents");
  assert.deepEqual(
    { enabled: agentCore.enabled, directoryKind: agentCore.directoryKind },
    { enabled: true, directoryKind: "ai-tool" }
  );

  const invalid = structuredClone(candidate.catalog);
  invalid.resources.at(-1).sourceProductIds = ["amazon-bedrock-agents"];
  assert.throws(
    () => validateCatalog(invalid),
    /生态资源来源产品必须属于 AI 可接入目录：aws-agent-toolkit-agents-build/
  );
  assert.deepEqual(candidate.catalog.resources.at(-1).sourceProductIds, []);
});

test("generator is byte-idempotent", () => {
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
