"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
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
const outputPath =
  "docs/research/adadvisor-adramp-mcp-catalog-v3-candidate-2026-08-14.json";
const outputSha256 = "68d0a4e7d68f5a2bac778116fa0e6bc56df298f4c39c9d929896c3cd9120032f";
const registrySnapshot =
  "https://registry.modelcontextprotocol.io/v0.1/servers?limit=10&version=latest&cursor=agency.kesey%2Fpretrip%3A1.0.1";

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

const resources = Object.freeze([
  Object.freeze({
    id: "adadvisor-mcp-server",
    enabled: true,
    order: 259,
    name: "AdAdvisor MCP Server",
    resourceTypes: ["mcp"],
    description:
      "AdAdvisor 官方托管的 Meta Ads MCP 服务可读取广告数据，并创建 campaign、上传 creative、构建 audience、暂停或调整广告；发布方称修改先以 draft 供用户批准并保留 audit log，但批准后仍可能影响真实预算。",
    website: "https://adadvisor.ai/mcp",
    tutorial: "https://adadvisor.ai/mcp",
    publisher: "AdAdvisor, Inc.",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [
      target("claude-desktop"),
      target("claude-code"),
      target("cursor-desktop"),
      target("windsurf-editor")
    ],
    versionRef: "registry@1.0.1+rolling-official-service",
    requestedPermissions: [
      "服务可读取 Meta Ads 账户、广告表现和业务上下文数据。",
      "服务可创建 campaign、上传 creative、构建 audience、暂停或调整广告，批准后可能影响真实投放和预算。",
      "发布方称修改先形成 draft、需用户明确批准并保留 audit log；这些是发布方声明，不是枕星 AI 独立验证。"
    ],
    credentialRequirements: [
      "用户须自行登录 AdAdvisor，并在发布方流程中通过 Meta OAuth 授权自己的广告账户；枕星 AI 不发起该流程。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发账号登录材料、OAuth 授权、API key 或其他认证信息。"
    ],
    installScope:
      "仅打开 AdAdvisor 第一方 MCP 说明页；不登录、不发起 OAuth、不保存连接、不写宿主配置、不调用 MCP 工具，也不创建、暂停或调整任何广告。",
    uninstallPlan:
      "枕星 AI 未安装或连接任何内容，因此没有托管卸载状态；用户须在 AdAdvisor 与 Meta 的官方账户控制中审查、断开或撤销自行建立的授权。",
    provenanceEvidence: [
      "https://adadvisor.ai/mcp",
      "https://adadvisor.ai/terms",
      registrySnapshot
    ],
    lastVerifiedAt: "2026-08-14T00:00:00.000Z",
    metadataSnapshot: {
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
    }
  }),
  Object.freeze({
    id: "adramp-google-ads-mcp",
    enabled: true,
    order: 260,
    name: "AdRamp Google Ads MCP",
    resourceTypes: ["mcp"],
    description:
      "AdRamp 官方托管的 Google Ads MCP 服务按发布方说明仅以 OAuth 读取账户、campaign、ad group、keyword、search term 与表现数据，不能修改 campaign 或预算；广告业务数据仍属敏感信息。",
    website: "https://adramp.ai/mcp/",
    tutorial: "https://adramp.ai/mcp/",
    publisher: "Product Stream Technologies SRL",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "guarded",
    targets: [
      target("claude-code"),
      target("cursor-desktop"),
      target("microsoft-vscode"),
      target("windsurf-editor")
    ],
    versionRef: "registry@1.0.3+rolling-official-service",
    requestedPermissions: [
      "服务读取 Google Ads 账户、campaign、ad group、keyword、search term 与 performance metrics。",
      "发布方称 OAuth scope 为只读，不能暂停 campaign、修改预算或更改账户；这些是发布方声明，不是枕星 AI 独立验证。",
      "发布方称广告数据仅实时转发且不在其服务器保存；用户仍须按敏感业务数据审查授权范围。"
    ],
    credentialRequirements: [
      "发布方称使用 AdRamp 服务无需 AdRamp 账户或 API key；这是发布方声明，不是枕星 AI 对凭据需求的独立验证。",
      "用户须自行在 Google 官方流程中授予只读 OAuth 访问，并可在 Google 账户中撤销；枕星 AI 不发起该流程。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 Google 登录材料、OAuth 授权、API key 或其他认证信息。"
    ],
    installScope:
      "仅打开 AdRamp 第一方 MCP 说明页；不登录、不发起 OAuth、不保存连接、不写宿主配置、不调用 MCP 工具，也不读取或修改任何广告数据。",
    uninstallPlan:
      "枕星 AI 未安装或连接任何内容，因此没有托管卸载状态；用户须在 Google 账户的官方授权管理中撤销自行建立的访问。",
    provenanceEvidence: [
      "https://adramp.ai/mcp/",
      "https://adramp.ai/terms/",
      registrySnapshot
    ],
    lastVerifiedAt: "2026-08-14T00:00:00.000Z",
    metadataSnapshot: {
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
    }
  })
]);

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
  "token",
  "value"
]);

function reject(message) {
  throw new Error(`AdAdvisor/AdRamp MCP candidate rejected: ${message}`);
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

function sourceKeys(resource) {
  return new Set([
    resource.website,
    resource.tutorial,
    resource.sourcePage,
    resource.canonicalSource,
    resource.metadataSnapshot?.sourcePage,
    resource.metadataSnapshot?.canonicalSource
  ].filter(Boolean).map((value) => {
    try {
      const url = new URL(value);
      return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
    } catch {
      return null;
    }
  }).filter(Boolean));
}

function externalId(resource) {
  return String(
    resource.metadataSnapshot?.externalId || resource.externalId || ""
  ).trim().toLowerCase();
}

function hasSameSemanticIdentity(candidate, resource) {
  const candidateSources = sourceKeys(candidate);
  return String(resource.id || "").trim().toLowerCase() === candidate.id ||
    (normalizeText(resource.name) === normalizeText(candidate.name) &&
      normalizeText(resource.publisher) === normalizeText(candidate.publisher)) ||
    externalId(resource) === externalId(candidate) ||
    [...sourceKeys(resource)].some((key) => candidateSources.has(key));
}

function assertNoSemanticDuplicates(existingResources) {
  const seen = [...existingResources];
  for (const candidate of resources) {
    const duplicate = seen.find((resource) => hasSameSemanticIdentity(candidate, resource));
    if (duplicate) reject(`semantic identity already exists: ${duplicate.id}`);
    seen.push(candidate);
  }
}

function assertNoHistoricalSemanticDuplicates(historyEntries) {
  const parsedEntries = historyEntries.map((entry) => ({
    ...entry,
    value: JSON.parse(entry.raw),
    actualSha256: sha256(entry.raw)
  }));
  const entriesByPath = new Map();
  for (const entry of parsedEntries) {
    if (entriesByPath.has(entry.path)) reject(`duplicate historical path: ${entry.path}`);
    entriesByPath.set(entry.path, entry);
  }

  const containsExactResources = (value) => {
    if (
      value?.candidateOnly !== true ||
      value?.freezeOnly !== true ||
      value?.publishable !== false ||
      !Array.isArray(value?.catalog?.resources)
    ) return false;
    const matches = value.catalog.resources.filter(({ id }) =>
      resources.some((candidate) => candidate.id === id)
    );
    return matches.length === resources.length && resources.every((candidate) =>
      matches.some((match) => isDeepStrictEqual(match, candidate))
    );
  };
  const anchor = entriesByPath.get(outputPath);
  const anchorIsFrozen =
    anchor?.actualSha256 === outputSha256 && containsExactResources(anchor.value);
  const hasVerifiedAncestry = (entry, visited = new Set()) => {
    if (!containsExactResources(entry.value) || visited.has(entry.path)) return false;
    const nextVisited = new Set(visited).add(entry.path);
    for (const input of Object.values(entry.value.inputs || {})) {
      if (
        !input ||
        typeof input !== "object" ||
        !isDeepStrictEqual(Object.keys(input).sort(), ["path", "sha256"])
      ) continue;
      if (
        input.path === outputPath &&
        input.sha256 === outputSha256 &&
        anchorIsFrozen
      ) return true;
      const parent = entriesByPath.get(input.path);
      if (
        parent &&
        input.sha256 === parent.actualSha256 &&
        hasVerifiedAncestry(parent, nextVisited)
      ) return true;
    }
    return false;
  };

  for (const entry of parsedEntries) {
    if (entry.path === outputPath) continue;
    const inheritedResources = hasVerifiedAncestry(entry)
      ? entry.value.catalog.resources
      : null;
    let duplicate = false;
    const visit = (value) => {
      if (duplicate || !value || typeof value !== "object") return;
      if (!Array.isArray(value) && resources.some((candidate) =>
        hasSameSemanticIdentity(candidate, value)
      )) duplicate = true;
      if (value === inheritedResources) {
        for (const child of value) {
          if (resources.some((candidate) => isDeepStrictEqual(child, candidate))) continue;
          visit(child);
        }
        return;
      }
      for (const child of Object.values(value)) visit(child);
    };
    visit(entry.value);
    if (duplicate) {
      reject(`historical semantic identity already exists: ${entry.path}`);
    }
  }
}

function assertNoForbiddenRuntimeFields(value) {
  if (Array.isArray(value)) return value.forEach(assertNoForbiddenRuntimeFields);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenRuntimeFields.has(key)) reject(`forbidden runtime field: ${key}`);
    assertNoForbiddenRuntimeFields(child);
  }
}

function buildCandidate(baseCandidate, historyEntries = []) {
  if (
    baseCandidate?.candidateOnly !== true ||
    baseCandidate?.freezeOnly !== true ||
    baseCandidate?.publishable !== false ||
    baseCandidate?.catalog?.schemaVersion !== 3 ||
    baseCandidate.catalog.resources?.length !== 264 ||
    baseCandidate.catalog.resources.reduce(
      (count, resource) => count + resource.targets.length,
      0
    ) !== 801 ||
    baseCandidate.catalog.resourceConnections?.length !== 10
  ) {
    reject("AWS base catalog v3 contract mismatch");
  }
  validateCatalog(baseCandidate.catalog);
  assertNoSemanticDuplicates(baseCandidate.catalog.resources);
  assertNoHistoricalSemanticDuplicates(historyEntries);
  resources.forEach(assertNoForbiddenRuntimeFields);

  const catalog = structuredClone(baseCandidate.catalog);
  const originalConnections = structuredClone(catalog.resourceConnections);
  catalog.resources.push(...structuredClone(resources));
  validateCatalog(catalog);

  const summary = {
    resources: catalog.resources.length,
    targets: catalog.resources.reduce(
      (count, resource) => count + resource.targets.length,
      0
    ),
    resourceConnections: catalog.resourceConnections.length,
    appendedResources: resources.length
  };
  assert.deepEqual(summary, {
    resources: 266,
    targets: 809,
    resourceConnections: 10,
    appendedResources: 2
  });
  assert.deepEqual(catalog.resourceConnections, originalConnections);

  const reversed = structuredClone(catalog);
  assert.deepEqual(reversed.resources.splice(-2), resources);
  assert.deepEqual(reversed, baseCandidate.catalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: "2026-08-14T00:00:00.000Z",
    title: "AdAdvisor and AdRamp MCP catalog v3 incremental candidate",
    inputs,
    summary,
    catalog,
    safety: {
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
    }
  };
}

function historyEntries() {
  const researchDir = path.join(root, "docs/research");
  return fs.readdirSync(researchDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        /candidate|review|index/i.test(entry.name) &&
        entry.name !== path.basename(inputs.baseAwsCatalogV3.path)
    )
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((entry) => ({
      path: `docs/research/${entry.name}`,
      raw: fs.readFileSync(path.join(researchDir, entry.name), "utf8")
    }));
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
    JSON.parse(rawInputs.baseAwsCatalogV3.toString("utf8")),
    historyEntries()
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
