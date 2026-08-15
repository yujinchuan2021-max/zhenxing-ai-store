"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
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
const outputPath =
  "docs/research/brave-search-mcp-catalog-v3-candidate-2026-08-14.json";
const revision = "937e85a61f69e36f5a88e44308d47836a8d5d523";
const repository = `https://github.com/brave/brave-search-mcp-server/tree/${revision}`;

const braveResource = Object.freeze({
  id: "brave-search-mcp-server",
  enabled: true,
  order: 257,
  name: "Brave Search MCP Server",
  resourceTypes: ["mcp"],
  description:
    "Brave 官方 MCP Server，通过 Brave Search API 提供网页、新闻、图片、视频、本地与摘要搜索；网络访问、API 配额和费用由用户自己的 Brave 账号承担。",
  website: repository,
  tutorial: `https://github.com/brave/brave-search-mcp-server/blob/${revision}/README.md`,
  publisherVendorId: "brave",
  publisher: "Brave Software, Inc.",
  sourceKind: "official",
  reviewStatus: "manually-reviewed",
  riskLevel: "guarded",
  sourceProductIds: [],
  targets: [
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
  ],
  versionRef: `package.json@2.1.0+${revision}`,
  requestedPermissions: [
    "向 Brave Search API 发送用户查询并读取搜索结果；调用前由目标宿主展示工具与影响。"
  ],
  credentialRequirements: [
    "用户自行在目标宿主保存 BRAVE_API_KEY；枕星 AI 不收集、保存或转发该密钥。"
  ],
  installScope:
    "仅打开固定 commit 的 Brave 官方说明；不写入 Claude Desktop 或 VS Code 配置，不运行 NPX/Docker，不启动 stdio/http server。",
  uninstallPlan:
    "枕星 AI 未写入配置或安装运行时，因此没有托管卸载状态；用户自行添加的连接与 API key 仍由目标宿主和 Brave 账号管理。",
  provenanceEvidence: [
    repository,
    `https://github.com/brave/brave-search-mcp-server/blob/${revision}/README.md`,
    `https://github.com/brave/brave-search-mcp-server/blob/${revision}/package.json`,
    `https://github.com/brave/brave-search-mcp-server/blob/${revision}/LICENSE`
  ],
  lastVerifiedAt: "2026-08-14T00:00:00.000Z",
  metadataSnapshot: {
    sourcePlatform: "github",
    discoveredVia: "cocoloop",
    sourcePage: repository,
    canonicalSource: repository,
    originalAuthor: "Brave Software, Inc.",
    licenseId: "MIT",
    sourceRevision: revision,
    provenanceStatus: "first-party-verified",
    externalId: "github:brave/brave-search-mcp-server",
    observedAt: "2026-08-14T00:00:00.000Z",
    licenseStatus: "verified"
  }
});

function reject(message) {
  throw new Error(`Brave Search MCP candidate rejected: ${message}`);
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

function githubRepositoryKeys(resource) {
  const urls = [
    resource.website,
    resource.tutorial,
    ...(resource.provenanceEvidence || []),
    resource.metadataSnapshot?.sourcePage,
    resource.metadataSnapshot?.canonicalSource
  ];
  return new Set(urls.flatMap((value) => {
    try {
      const url = new URL(value);
      const [owner, name] = url.pathname.split("/").filter(Boolean);
      return url.hostname === "github.com" && owner && name
        ? [`github:${owner.toLowerCase()}/${name.toLowerCase()}`]
        : [];
    } catch {
      return [];
    }
  }));
}

function assertNoSemanticDuplicate(resources) {
  const candidateId = braveResource.id.toLowerCase();
  const candidateName = braveResource.name.trim().toLowerCase();
  const candidateRepos = githubRepositoryKeys(braveResource);
  for (const resource of resources) {
    if (
      resource.id?.toLowerCase() === candidateId ||
      resource.name?.trim().toLowerCase() === candidateName ||
      resource.metadataSnapshot?.externalId?.toLowerCase() ===
        braveResource.metadataSnapshot.externalId
    ) {
      reject(`semantic identity already exists: ${resource.id}`);
    }
    for (const key of githubRepositoryKeys(resource)) {
      if (candidateRepos.has(key)) reject(`canonical source already exists: ${resource.id}`);
    }
  }
}

function buildCandidate(baseCandidate) {
  if (
    baseCandidate?.candidateOnly !== true ||
    baseCandidate?.freezeOnly !== true ||
    baseCandidate?.publishable !== false ||
    baseCandidate?.catalog?.schemaVersion !== 3 ||
    baseCandidate.catalog.resources?.length !== 262 ||
    baseCandidate.catalog.resources.reduce(
      (count, resource) => count + resource.targets.length,
      0
    ) !== 796 ||
    baseCandidate.catalog.resourceConnections?.length !== 10
  ) {
    reject("base catalog v3 contract mismatch");
  }
  validateCatalog(baseCandidate.catalog);
  assertNoSemanticDuplicate(baseCandidate.catalog.resources);

  const catalog = structuredClone(baseCandidate.catalog);
  const originalConnections = structuredClone(catalog.resourceConnections);
  catalog.resources.push(structuredClone(braveResource));
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
    resources: 263,
    targets: 798,
    resourceConnections: 10,
    appendedResources: 1
  });
  assert.deepEqual(catalog.resourceConnections, originalConnections);

  const reversed = structuredClone(catalog);
  const removed = reversed.resources.pop();
  assert.deepEqual(removed, braveResource);
  assert.deepEqual(reversed, baseCandidate.catalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: "2026-08-14T00:00:00.000Z",
    title: "Brave Search MCP catalog v3 incremental candidate",
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
    JSON.parse(rawInputs.baseCatalogV3.toString("utf8"))
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
