"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
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
const outputPath =
  "docs/research/aws-agents-build-skill-catalog-v3-candidate-2026-08-14.json";
const revision = "1beb63a6a1d0760bb444961ea62cdca362edae72";
const repository = "https://github.com/aws/agent-toolkit-for-aws";
const skillDirectory =
  `${repository}/tree/${revision}/plugins/aws-agents/skills/agents-build`;
const skillFile =
  `${repository}/blob/${revision}/plugins/aws-agents/skills/agents-build/SKILL.md`;

const awsAgentsBuildResource = Object.freeze({
  id: "aws-agent-toolkit-agents-build",
  enabled: true,
  order: 258,
  name: "AWS Agents Build",
  resourceTypes: ["skill"],
  description:
    "AWS 官方 Agents Build Skill 可通过 Bash 和本地文件写入扩展 AgentCore 项目，并调用 AWS API/IAM、修改 VPC 与网络、运行浏览器和代码解释器、启用支付与花费，或永久删除云资源；日志、ECR 镜像和本地文件等仍可能残留。",
  website: skillDirectory,
  tutorial: skillFile,
  publisherVendorId: "amazon",
  publisher: "Amazon Web Services",
  sourceKind: "official",
  reviewStatus: "manually-reviewed",
  riskLevel: "unsafe",
  sourceProductIds: [],
  targets: [
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
  ],
  versionRef: `SKILL.md@1.0.0+${revision}`,
  requestedPermissions: [
    "Skill 可指示目标宿主运行 Bash、AgentCore、AWS CLI 与 CDK 命令并读写本地项目文件；枕星 AI 仅打开固定说明，不执行命令或写入文件。",
    "流程可调用 AWS API，创建或更新 IAM 与 AgentCore 资源，并修改 VPC、子网、安全组、路由、NAT、端点和网络访问，可能影响可用性、暴露面与费用。",
    "流程可启动浏览器自动化与 Code Interpreter，访问网络、填写表单、执行 Python/JavaScript/TypeScript、读写本地文件或 S3、安装会话包并产生费用。",
    "支付流程可创建支付管理器、连接器、钱包工具与预算会话并产生实际花费；teardown 可永久删除运行时、Memory、凭据、策略与 IAM 资源，而日志、ECR 镜像和本地文件等可能残留。"
  ],
  credentialRequirements: [
    "用户须自行准备 AWS 账号、Region、本地 AWS 凭据、AgentCore CLI >=0.9.0 和按能力配置的 IAM；浏览器、支付或钱包功能还可能需要用户自有第三方账号、API key、provider secrets、wallet delegation 与 funding。",
    "枕星 AI 不请求、收集、保存、代理、校验或转发任何 AWS access key、IAM/JWT、API key、token、第三方或支付 provider secret、钱包密钥、授权或资金信息。"
  ],
  installScope:
    "仅打开固定 commit 的 AWS 官方 Skill 与说明；不克隆、下载或复制 Skill，不安装 plugin、MCP、package 或 runtime，不写宿主/AgentCore 配置，不执行 Bash/AgentCore/AWS CLI/CDK，不调用 AWS 或第三方 API，也不创建、更新或删除本地及云状态。",
  uninstallPlan:
    "枕星 AI 未安装或写入任何内容，因此没有托管卸载状态；用户自行安装的 Skill/plugin、创建的 AWS/第三方/支付/钱包资源与凭据，以及残留日志、ECR 镜像和本地文件，均须由用户在官方工具中审查并撤销或删除。",
  provenanceEvidence: [
    skillDirectory,
    skillFile,
    `${repository}/blob/${revision}/plugins/aws-agents/plugin.json`,
    `${repository}/blob/${revision}/plugins/aws-agents/.claude-plugin/plugin.json`,
    `${repository}/blob/${revision}/plugins/aws-agents/.codex-plugin/plugin.json`,
    `${repository}/blob/${revision}/plugins/aws-agents/.cursor-plugin/plugin.json`,
    `${repository}/blob/${revision}/README.md`,
    `${repository}/blob/${revision}/LICENSE`
  ],
  lastVerifiedAt: "2026-08-14T00:00:00.000Z",
  metadataSnapshot: {
    sourcePlatform: "github",
    discoveredVia: "clawhub",
    sourcePage: skillDirectory,
    canonicalSource: skillDirectory,
    originalAuthor: "Amazon Web Services / aws-agentcore",
    licenseId: "Apache-2.0",
    sourceRevision: revision,
    provenanceStatus: "first-party-verified",
    externalId:
      "github:aws/agent-toolkit-for-aws#plugins/aws-agents/skills/agents-build",
    observedAt: "2026-08-14T00:00:00.000Z",
    licenseStatus: "verified"
  }
});

const forbiddenRuntimeFields = new Set([
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

function reject(message) {
  throw new Error(`AWS Agents Build Skill candidate rejected: ${message}`);
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function assertFrozenInputHashes(actualHashes) {
  for (const [name, input] of Object.entries(inputs)) {
    if (actualHashes?.[name] !== input.sha256) {
      reject(`frozen input drift: ${input.path}`);
    }
  }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function githubSkillSourceKey(value) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "github.com" || parts.length < 2) return null;
    let rest = parts.slice(2);
    if (["blob", "tree"].includes(rest[0]) && rest.length >= 2) {
      rest = rest.slice(2);
    }
    if (rest.at(-1)?.toLowerCase() === "skill.md") rest = rest.slice(0, -1);
    return `github:${parts[0].toLowerCase()}/${parts[1].toLowerCase()}#${rest
      .join("/")
      .toLowerCase()}`;
  } catch {
    return null;
  }
}

function skillSourceKeys(resource) {
  return new Set([
    resource.website,
    resource.tutorial,
    resource.metadataSnapshot?.sourcePage,
    resource.metadataSnapshot?.canonicalSource
  ].map(githubSkillSourceKey).filter(Boolean));
}

function assertNoSemanticDuplicate(resources) {
  const candidateId = awsAgentsBuildResource.id.toLowerCase();
  const candidateName = normalizeText(awsAgentsBuildResource.name);
  const candidatePublisher = normalizeText(awsAgentsBuildResource.publisher);
  const candidateExternalId =
    awsAgentsBuildResource.metadataSnapshot.externalId.toLowerCase();
  const candidateSources = skillSourceKeys(awsAgentsBuildResource);

  for (const resource of resources) {
    if (
      resource.id?.toLowerCase() === candidateId ||
      (normalizeText(resource.name) === candidateName &&
        normalizeText(resource.publisher) === candidatePublisher) ||
      resource.metadataSnapshot?.externalId?.toLowerCase() === candidateExternalId
    ) {
      reject(`semantic identity already exists: ${resource.id}`);
    }
    for (const key of skillSourceKeys(resource)) {
      if (candidateSources.has(key)) {
        reject(`canonical Skill source already exists: ${resource.id}`);
      }
    }
  }
}

function assertNoForbiddenRuntimeFields(value) {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenRuntimeFields);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenRuntimeFields.has(key)) reject(`forbidden runtime field: ${key}`);
    assertNoForbiddenRuntimeFields(child);
  }
}

function buildCandidate(baseCandidate) {
  if (
    baseCandidate?.candidateOnly !== true ||
    baseCandidate?.freezeOnly !== true ||
    baseCandidate?.publishable !== false ||
    baseCandidate?.catalog?.schemaVersion !== 3 ||
    baseCandidate.catalog.resources?.length !== 263 ||
    baseCandidate.catalog.resources.reduce(
      (count, resource) => count + resource.targets.length,
      0
    ) !== 798 ||
    baseCandidate.catalog.resourceConnections?.length !== 10
  ) {
    reject("Brave base catalog v3 contract mismatch");
  }
  validateCatalog(baseCandidate.catalog);
  assertNoSemanticDuplicate(baseCandidate.catalog.resources);
  assertNoForbiddenRuntimeFields(awsAgentsBuildResource);

  const catalog = structuredClone(baseCandidate.catalog);
  const originalConnections = structuredClone(catalog.resourceConnections);
  catalog.resources.push(structuredClone(awsAgentsBuildResource));
  validateCatalog(catalog);

  const summary = {
    resources: catalog.resources.length,
    targets: catalog.resources.reduce(
      (count, resource) => count + resource.targets.length,
      0
    ),
    resourceConnections: catalog.resourceConnections.length,
    appendedResources: 1
  };
  assert.deepEqual(summary, {
    resources: 264,
    targets: 801,
    resourceConnections: 10,
    appendedResources: 1
  });
  assert.deepEqual(catalog.resourceConnections, originalConnections);

  const reversed = structuredClone(catalog);
  const removed = reversed.resources.pop();
  assert.deepEqual(removed, awsAgentsBuildResource);
  assert.deepEqual(reversed, baseCandidate.catalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: "2026-08-14T00:00:00.000Z",
    title: "AWS Agents Build Skill catalog v3 incremental candidate",
    inputs,
    summary,
    catalog,
    safety: {
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
    }
  };
}

function main() {
  const rawInputs = Object.fromEntries(
    Object.entries(inputs).map(([name, input]) => [
      name,
      fs.readFileSync(path.join(root, input.path))
    ])
  );
  assertFrozenInputHashes(
    Object.fromEntries(
      Object.entries(rawInputs).map(([name, raw]) => [name, sha256(raw)])
    )
  );
  const candidate = buildCandidate(
    JSON.parse(rawInputs.baseBraveCatalogV3.toString("utf8"))
  );
  fs.writeFileSync(
    path.join(root, outputPath),
    `${JSON.stringify(candidate, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`${JSON.stringify({ outputPath, summary: candidate.summary })}\n`);
}

if (require.main === module) main();

module.exports = {
  assertFrozenInputHashes,
  buildCandidate
};
