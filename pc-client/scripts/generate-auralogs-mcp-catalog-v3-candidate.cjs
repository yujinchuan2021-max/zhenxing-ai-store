"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const inputs = Object.freeze({
  baseCatalogV3: {
    path: "docs/research/official-mcp-registry-run3-ready4-catalog-v3-candidate-2026-08-15.json",
    sha256: "16116ca707a3dd344a252229758e359e3e4ba123fb6f4fbb8958166b689984e8"
  },
  primaryResearch: {
    path: "docs/research/official-mcp-registry-run3-next10-primary-review-2026-08-15.md",
    sha256: "c9cea0f78dc2c9d98c8487e4c91cd11743bbaaff507d58abd06b1a148676838a"
  }
});
const outputPath = "docs/research/auralogs-mcp-catalog-v3-candidate-2026-08-15.json";
const outputSha256 = "dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8";
const observedAt = "2026-08-15T00:00:00.000Z";

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

const resource = Object.freeze({
  id: "auralogs-mcp",
  enabled: true,
  order: 279,
  name: "Auralogs MCP",
  resourceTypes: ["mcp"],
  description:
    "Auralogs 官方托管 MCP 以七个只读工具提供生产日志与 AI 分析查询；公开 MIT 仓库仅含 Registry metadata、安装说明和展示资产，不是托管 server 的开源实现。",
  website: "https://github.com/auralogs-ai/auralogs-mcp",
  tutorial: "https://docs.auralogs.ai/read-api/overview/",
  publisher: "Auralogs",
  sourceKind: "official",
  reviewStatus: "manually-reviewed",
  riskLevel: "unsafe",
  targets: [
    target("claude-desktop"),
    target("claude-code"),
    target("cursor-desktop"),
    target("cline-agent"),
    target("codex-cli")
  ],
  versionRef: "official-mcp-registry:ai.auralogs/auralogs@0.1.0+hosted-service",
  requestedPermissions: [
    "发布方记录七个只读工具：list_projects、get_project、list_logs、search_logs、get_log、list_analyses、get_analysis；不包含写入工具。",
    "读取生产日志与 AI 分析仍属高风险：内容可能含 secret、个人标识、授权片段、事故细节、stack trace 或支付错误上下文，并会暴露给用户选择的 AI 宿主。"
  ],
  credentialRequirements: [
    "发布方称 project-scoped read key 以 SHA-256 哈希保存，撤销后下一次请求立即返回 401；这是发布方服务声明，不是枕星 AI 的密钥托管能力。",
    "枕星 AI 不请求、收集、保存、代理、校验或转发 read key、日志、授权材料、模型密钥、账户凭据或其他认证与业务数据。"
  ],
  installScope:
    "仅打开 Auralogs 第一方仓库与说明；不下载、不安装、不配置、不连接、不查询 MCP，不访问日志或 AI 分析。Privacy 与 Terms 当前均渲染产品首页，legal operator、账户删除、备份和 processor 条款仍是发布前缺口。",
  uninstallPlan:
    "枕星 AI 未安装或连接任何内容；用户自行连接后须在宿主中移除配置并在 Auralogs dashboard 撤销 read key。发布方当前按套餐声明 7、30 或 90 天日志保留，但账户删除、备份与 processor 生命周期尚未闭合。",
  provenanceEvidence: [
    "https://github.com/auralogs-ai/auralogs-mcp",
    "https://github.com/auralogs-ai/auralogs-mcp/blob/main/server.json",
    "https://github.com/auralogs-ai/auralogs-mcp/blob/main/README.md",
    "https://github.com/auralogs-ai/auralogs-mcp/blob/main/LICENSE",
    "https://auralogs.ai/",
    "https://auralogs.ai/privacy",
    "https://auralogs.ai/terms"
  ],
  lastVerifiedAt: observedAt,
  metadataSnapshot: {
    sourcePlatform: "first-party-review",
    discoveredVia: "official-mcp-registry",
    sourcePage: "https://github.com/auralogs-ai/auralogs-mcp/blob/main/server.json",
    canonicalSource: "https://github.com/auralogs-ai/auralogs-mcp",
    originalAuthor: "Auralogs",
    licenseId: "MIT",
    sourceRevision: "registry-0.1.0+hosted-service",
    provenanceStatus: "first-party-verified",
    externalId: "official-mcp-registry:ai.auralogs/auralogs@0.1.0",
    observedAt,
    licenseStatus: "verified"
  }
});

const forbiddenRuntimeFields = new Set([
  "args", "command", "credential", "credentialValue", "credentialValues", "credentials",
  "endpoint", "env", "headers", "installArgs", "installCommand", "installPackage",
  "installRuntime", "managedInstall", "package", "path", "runtime", "runtimeConfig",
  "script", "secret", "token", "value"
]);

function reject(message) {
  throw new Error(`Auralogs MCP candidate rejected: ${message}`);
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function assertFrozenInputHashes(actualHashes) {
  for (const [name, input] of Object.entries(inputs)) {
    if (actualHashes?.[name] !== input.sha256) reject(`frozen input drift: ${input.path}`);
  }
}

function normalizeText(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function canonicalSourceKey(value) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.toLowerCase() === "github.com" && parts.length >= 2) {
      return `github:${parts[0].toLowerCase()}/${parts[1].replace(/\.git$/i, "").toLowerCase()}`;
    }
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return null;
  }
}

function identity(value) {
  return {
    id: String(value?.id || "").trim().toLowerCase(),
    name: normalizeText(value?.name),
    publisher: normalizeText(value?.publisher),
    externalId: String(value?.metadataSnapshot?.externalId || value?.externalId || "").trim().toLowerCase(),
    sources: new Set([
      value?.website, value?.tutorial, value?.sourcePage, value?.canonicalSource,
      value?.metadataSnapshot?.sourcePage, value?.metadataSnapshot?.canonicalSource
    ].map(canonicalSourceKey).filter(Boolean))
  };
}

function sameIdentity(candidate) {
  const left = identity(candidate);
  const right = identity(resource);
  return left.id === right.id ||
    (left.name && left.name === right.name && left.publisher === right.publisher) ||
    (left.externalId && left.externalId === right.externalId) ||
    [...left.sources].some((source) => right.sources.has(source));
}

function assertNoCurrentDuplicates(resources) {
  const duplicate = resources.find(sameIdentity);
  if (duplicate) reject(`semantic identity already exists: ${duplicate.id}`);
}

function assertNoHistoricalDuplicates(entries) {
  const parsedEntries = entries.map((entry) => ({
    ...entry,
    value: JSON.parse(entry.raw),
    actualSha256: sha256(entry.raw)
  }));
  const entriesByPath = new Map();
  for (const entry of parsedEntries) {
    if (entriesByPath.has(entry.path)) reject(`duplicate historical path: ${entry.path}`);
    entriesByPath.set(entry.path, entry);
  }

  const containsExactResource = (value) => {
    if (
      value?.candidateOnly !== true || value?.freezeOnly !== true ||
      value?.publishable !== false || !Array.isArray(value?.catalog?.resources)
    ) return false;
    const matches = value.catalog.resources.filter(({ id }) => id === resource.id);
    return matches.length === 1 && isDeepStrictEqual(matches[0], resource);
  };
  const anchor = entriesByPath.get(outputPath);
  const anchorIsFrozen =
    anchor?.actualSha256 === outputSha256 && containsExactResource(anchor.value);
  const hasVerifiedAncestry = (entry, visited = new Set()) => {
    if (!containsExactResource(entry.value) || visited.has(entry.path)) return false;
    const nextVisited = new Set(visited).add(entry.path);
    for (const input of Object.values(entry.value.inputs || {})) {
      if (
        !input || typeof input !== "object" ||
        !isDeepStrictEqual(Object.keys(input).sort(), ["path", "sha256"])
      ) continue;
      if (input.path === outputPath && input.sha256 === outputSha256 && anchorIsFrozen) {
        return true;
      }
      const parent = entriesByPath.get(input.path);
      if (
        parent && input.sha256 === parent.actualSha256 &&
        hasVerifiedAncestry(parent, nextVisited)
      ) return true;
    }
    return false;
  };

  for (const entry of parsedEntries) {
    if (entry.path === outputPath) {
      if (!anchorIsFrozen) reject(`frozen output anchor mismatch: ${entry.path}`);
      continue;
    }
    const inheritedResources = hasVerifiedAncestry(entry)
      ? entry.value.catalog.resources
      : null;
    let duplicate = false;
    const visit = (child) => {
      if (duplicate || !child || typeof child !== "object") return;
      if (!Array.isArray(child) && sameIdentity(child)) duplicate = true;
      if (child === inheritedResources) {
        let skipped = false;
        for (const nested of child) {
          if (!skipped && isDeepStrictEqual(nested, resource)) {
            skipped = true;
            continue;
          }
          visit(nested);
        }
        return;
      }
      for (const nested of Object.values(child)) visit(nested);
    };
    visit(entry.value);
    if (duplicate) reject(`historical semantic identity already exists: ${entry.path}`);
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
    baseCandidate?.candidateOnly !== true || baseCandidate?.freezeOnly !== true ||
    baseCandidate?.publishable !== false || baseCandidate?.catalog?.schemaVersion !== 3 ||
    baseCandidate.catalog.vendors?.length !== 375 ||
    baseCandidate.catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0) !== 616 ||
    baseCandidate.catalog.resources?.length !== 279 ||
    baseCandidate.catalog.resources.reduce((count, item) => count + item.targets.length, 0) !== 861 ||
    baseCandidate.catalog.resourceConnections?.length !== 10
  ) reject("base catalog v3 contract mismatch");
  validateCatalog(baseCandidate.catalog);
  assertNoCurrentDuplicates(baseCandidate.catalog.resources);
  assertNoHistoricalDuplicates(historyEntries);
  assertNoForbiddenRuntimeFields(resource);

  const catalog = structuredClone(baseCandidate.catalog);
  catalog.resources.push(structuredClone(resource));
  validateCatalog(catalog);
  const summary = {
    resources: catalog.resources.length,
    targets: catalog.resources.reduce((count, item) => count + item.targets.length, 0),
    resourceConnections: catalog.resourceConnections.length,
    appendedResources: 1
  };
  assert.deepEqual(summary, { resources: 280, targets: 866, resourceConnections: 10, appendedResources: 1 });
  assert.deepEqual(catalog.resourceConnections, baseCandidate.catalog.resourceConnections);
  const reversed = structuredClone(catalog);
  assert.deepEqual(reversed.resources.pop(), resource);
  assert.deepEqual(reversed, baseCandidate.catalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: observedAt,
    title: "Auralogs MCP catalog v3 incremental candidate",
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
  const researchDir = path.join(root, "docs", "research");
  return fs.readdirSync(researchDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") &&
      /candidate|review|index/i.test(entry.name) &&
      entry.name !== path.basename(inputs.baseCatalogV3.path))
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((entry) => ({ path: `docs/research/${entry.name}`, raw: fs.readFileSync(path.join(researchDir, entry.name), "utf8") }));
}

function main() {
  const rawInputs = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, fs.readFileSync(path.join(root, input.path))]));
  assertFrozenInputHashes(Object.fromEntries(Object.entries(rawInputs).map(([name, raw]) => [name, sha256(raw)])));
  const candidate = buildCandidate(JSON.parse(rawInputs.baseCatalogV3.toString("utf8")), historyEntries());
  fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, summary: candidate.summary })}\n`);
}

if (require.main === module) main();

module.exports = { assertFrozenInputHashes, buildCandidate, resource };
