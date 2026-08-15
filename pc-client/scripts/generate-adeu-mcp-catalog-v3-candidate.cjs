"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
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
const outputPath = "docs/research/adeu-mcp-catalog-v3-candidate-2026-08-14.json";
const outputSha256 = "1cc5da97e4a371a71c0e0118109156858c183e16f52159224768e20e8c6dea03";
const sourceRevision = "55f271eb7024d428e5a8f62819ff1376a138166c";
const sourceRoot = `https://github.com/dealfluence/adeu/tree/${sourceRevision}`;

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
  id: "adeu-mcp-server",
  enabled: true,
  order: 261,
  name: "Adeu MCP Server",
  resourceTypes: ["mcp"],
  description:
    "Adeu 的第一方开源 MCP server（ai.adeu/adeu 2.4.0；Node 包 @adeu/mcp-server 2.4.0）可读取本地 DOCX 或活动 Word 文档，并把批改、表格、评论及修订写回原生 Track Changes；错误目标、接受或拒绝修订、清理 metadata 和只读锁均可能造成数据损失。",
  website: sourceRoot,
  tutorial: `${sourceRoot}#readme`,
  publisher: "Dealfluence Oy / Adeu",
  sourceKind: "official",
  reviewStatus: "manually-reviewed",
  riskLevel: "unsafe",
  targets: [
    target("claude-desktop"),
    target("gemini-cli"),
    target("cursor-desktop"),
    target("windsurf-editor")
  ],
  versionRef: `ai.adeu/adeu@2.4.0+commit-${sourceRevision}`,
  requestedPermissions: [
    "服务可读取磁盘中的 DOCX 或当前活动 Word 文档；用户选择的 LLM provider 仍可能处理 agent 读取的文档文本。",
    "服务可批量改写正文与表格、添加或回复评论、写回 Track Changes、接受或拒绝修订、清理 metadata，并设置只读锁。",
    "读取或写入错误文档，以及接受或拒绝修订、删除评论、清理 metadata 或锁定文件，都可能造成不可逆的数据损失；DOCX scope 仅过滤工具列表，不是访问控制。",
    "第一方说明中的 Cloud 与邮箱工具需要认证，但公开源码边界、授权范围、凭据保存和撤销生命周期尚未闭合；本候选不把它们归入已核验的本地 OSS 能力。"
  ],
  credentialRequirements: [
    "发布方称本地 core 无需 Adeu 账户或 API key；这是发布方声明，不是枕星 AI 对外部服务凭据需求的独立验证。",
    "用户选择的 LLM provider 或未来 Cloud 功能所需凭据由用户在对应服务中自行管理；本候选不连接 Cloud 或邮箱能力。",
    "枕星 AI 不请求、收集、保存、代理、校验或转发 Adeu、LLM、Cloud、邮箱登录材料、API key、授权或其他认证信息。"
  ],
  installScope:
    "仅打开固定到审核提交的 Adeu 第一方源码与说明；不下载、不安装、不配置、不启动或运行 Node 22、Python 3.12、Word COM、MCP server、extension 或任何本地进程。",
  uninstallPlan:
    "枕星 AI 未安装、配置、启动或连接任何内容，因此没有托管卸载状态；若用户自行安装，须按对应宿主和发布方说明自行移除并核查外部凭据。",
  provenanceEvidence: [
    sourceRoot,
    `https://github.com/dealfluence/adeu/blob/${sourceRevision}/LICENSE`,
    `https://github.com/dealfluence/adeu/blob/${sourceRevision}/README.md`,
    `https://github.com/dealfluence/adeu/blob/${sourceRevision}/python/server.json`,
    `https://github.com/dealfluence/adeu/blob/${sourceRevision}/node/packages/mcp-server/package.json`
  ],
  lastVerifiedAt: "2026-08-14T00:00:00.000Z",
  metadataSnapshot: {
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
  "token",
  "value"
]);

function reject(message) {
  throw new Error(`Adeu MCP candidate rejected: ${message}`);
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

function sourceKeys(candidate) {
  return new Set([
    candidate.website,
    candidate.tutorial,
    candidate.sourcePage,
    candidate.canonicalSource,
    candidate.metadataSnapshot?.sourcePage,
    candidate.metadataSnapshot?.canonicalSource
  ].filter(Boolean).map((value) => {
    try {
      const url = new URL(value);
      return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
    } catch {
      return null;
    }
  }).filter(Boolean));
}

function externalId(candidate) {
  return String(
    candidate.metadataSnapshot?.externalId || candidate.externalId || ""
  ).trim().toLowerCase();
}

function hasSameSemanticIdentity(candidate) {
  const candidateSources = sourceKeys(resource);
  return String(candidate.id || "").trim().toLowerCase() === resource.id ||
    (normalizeText(candidate.name) === normalizeText(resource.name) &&
      normalizeText(candidate.publisher) === normalizeText(resource.publisher)) ||
    externalId(candidate) === externalId(resource) ||
    [...sourceKeys(candidate)].some((key) => candidateSources.has(key));
}

function assertNoSemanticDuplicates(existingResources) {
  const duplicate = existingResources.find(hasSameSemanticIdentity);
  if (duplicate) reject(`semantic identity already exists: ${duplicate.id}`);
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

  const containsExactResource = (value) => {
    if (
      value?.candidateOnly !== true ||
      value?.freezeOnly !== true ||
      value?.publishable !== false ||
      !Array.isArray(value?.catalog?.resources)
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
      if (!Array.isArray(value) && hasSameSemanticIdentity(value)) duplicate = true;
      if (value === inheritedResources) {
        let skipped = false;
        for (const child of value) {
          if (!skipped && isDeepStrictEqual(child, resource)) {
            skipped = true;
            continue;
          }
          visit(child);
        }
        return;
      }
      for (const child of Object.values(value)) visit(child);
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
    baseCandidate?.candidateOnly !== true ||
    baseCandidate?.freezeOnly !== true ||
    baseCandidate?.publishable !== false ||
    baseCandidate?.catalog?.schemaVersion !== 3 ||
    baseCandidate.catalog.resources?.length !== 266 ||
    baseCandidate.catalog.resources.reduce(
      (count, item) => count + item.targets.length,
      0
    ) !== 809 ||
    baseCandidate.catalog.resourceConnections?.length !== 10
  ) {
    reject("advertising base catalog v3 contract mismatch");
  }
  validateCatalog(baseCandidate.catalog);
  assertNoSemanticDuplicates(baseCandidate.catalog.resources);
  assertNoHistoricalSemanticDuplicates(historyEntries);
  assertNoForbiddenRuntimeFields(resource);

  const catalog = structuredClone(baseCandidate.catalog);
  const originalConnections = structuredClone(catalog.resourceConnections);
  catalog.resources.push(structuredClone(resource));
  validateCatalog(catalog);

  const summary = {
    resources: catalog.resources.length,
    targets: catalog.resources.reduce((count, item) => count + item.targets.length, 0),
    resourceConnections: catalog.resourceConnections.length,
    appendedResources: 1
  };
  assert.deepEqual(summary, {
    resources: 267,
    targets: 813,
    resourceConnections: 10,
    appendedResources: 1
  });
  assert.deepEqual(catalog.resourceConnections, originalConnections);

  const reversed = structuredClone(catalog);
  assert.deepEqual(reversed.resources.pop(), resource);
  assert.deepEqual(reversed, baseCandidate.catalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: "2026-08-14T00:00:00.000Z",
    title: "Adeu MCP catalog v3 incremental candidate",
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
        entry.name !== path.basename(inputs.baseAdsCatalogV3.path)
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
    JSON.parse(rawInputs.baseAdsCatalogV3.toString("utf8")),
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
