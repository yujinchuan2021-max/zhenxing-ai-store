"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const observedAt = "2026-08-15T00:00:00.000Z";
const outputPath = "docs/research/official-mcp-registry-run3-ready4-catalog-v3-candidate-2026-08-15.json";
const outputSha256 = "16116ca707a3dd344a252229758e359e3e4ba123fb6f4fbb8958166b689984e8";
const inputs = Object.freeze({
  baseCatalogV3: {
    path: "docs/research/official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json",
    sha256: "3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba"
  },
  first10Research: {
    path: "docs/research/official-mcp-registry-run3-first10-primary-review-2026-08-15.md",
    sha256: "b46d323dcecd3e3814da3fa4726bc6c32e5ed4db201aa156c14f8caeeb4c7125"
  },
  sourceSignalsResearch: {
    path: "docs/research/official-mcp-registry-run3-source-signals-review-2026-08-15.md",
    sha256: "8f9d03ccb558a2b36740168e6807eb9c05bf64f50fb8057fc3408b15a243d419"
  }
});

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

function metadata({ sourcePage, canonicalSource, author, licenseId, revision, externalId }) {
  return {
    sourcePlatform: "first-party-review",
    discoveredVia: "official-mcp-registry",
    sourcePage,
    canonicalSource,
    originalAuthor: author,
    licenseId,
    sourceRevision: revision,
    provenanceStatus: "first-party-verified",
    externalId,
    observedAt,
    licenseStatus: "verified"
  };
}

const newResources = Object.freeze([
  {
    id: "anomalyarmor-mcp",
    enabled: true,
    order: 275,
    name: "AnomalyArmor MCP",
    resourceTypes: ["mcp"],
    description: "AnomalyArmor 官方 MCP 提供数据可观测性、告警与资产管理能力，并包含规则、指标、目标与作业的写入或删除操作；仅提供第一方说明链接。",
    website: "https://docs.anomalyarmor.ai/integrations/mcp-server",
    tutorial: "https://docs.anomalyarmor.ai/integrations/mcp-server",
    publisher: "AnomalyArmor",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [target("claude-code"), target("cursor-desktop"), target("claude-desktop")],
    versionRef: "pypi:armor-mcp@0.6.1+352e8dbc2c49aac1401edacd3d24758dc2b1f752",
    requestedPermissions: [
      "可读取仓库元数据和有界聚合，并可确认、解决或忽略告警，创建、更新或删除规则、资产、计划、指标、检查、目标与标签。",
      "部分 intelligence jobs 会产生费用；所有写入、删除和付费操作都必须由用户在发布方与宿主侧自行确认。"
    ],
    credentialRequirements: [
      "Remote 使用 OAuth，local 使用用户自行管理的 API key；发布方支持立即撤销，用户须在 AnomalyArmor 与宿主中自行管理。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 OAuth、API key、仓库凭据、目标凭据或其他认证材料。"
    ],
    installScope: "仅打开 AnomalyArmor 第一方 MCP、认证、保留与删除说明；不下载、安装、启动、配置或连接 server，不调用工具或付费作业。",
    uninstallPlan: "枕星 AI 未安装或连接任何内容；用户自行建立的 OAuth/API key 与宿主配置须在 AnomalyArmor 和对应宿主中自行删除或撤销。",
    provenanceEvidence: [
      "https://pypi.org/project/armor-mcp/0.6.1/",
      "https://docs.anomalyarmor.ai/integrations/mcp-server",
      "https://docs.anomalyarmor.ai/api/authentication",
      "https://docs.anomalyarmor.ai/security/data-retention"
    ],
    lastVerifiedAt: observedAt,
    metadataSnapshot: metadata({
      sourcePage: "https://docs.anomalyarmor.ai/integrations/mcp-server",
      canonicalSource: "https://github.com/anomalyarmor/agents",
      author: "AnomalyArmor",
      licenseId: "MIT",
      revision: "352e8dbc2c49aac1401edacd3d24758dc2b1f752",
      externalId: "official-mcp-registry:ai.anomalyarmor/armor-mcp@0.6.1"
    })
  },
  {
    id: "borealhost-mcp",
    enabled: true,
    order: 276,
    name: "BorealHost MCP",
    resourceTypes: ["mcp"],
    description: "BorealHost 官方 MCP 可购买和配置托管、部署站点并管理 DNS、文件、SSH、备份、域名、扩缩容与删除；属于高风险商业与基础设施操作，仅提供说明链接。",
    website: "https://github.com/alainsvrd/borealhost-mcp",
    tutorial: "https://borealhost.ai/",
    publisher: "BorealHost.ai",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [target("cursor-desktop"), target("windsurf-editor")],
    versionRef: "ai.borealhost/mcp@0.3.0+rolling-service",
    requestedPermissions: [
      "可购买和配置托管、管理订阅与账单、部署或下线站点、写删 DNS 和文件、管理 SSH keys、恢复备份、注册域名、扩缩容与删除账户。",
      "购买、付款、域名、基础设施变更与删除可能产生费用、停机或不可逆影响，必须由用户在发布方与宿主侧自行确认。"
    ],
    credentialRequirements: [
      "服务使用 scoped API keys；发布方提供 key rotation 与账户删除，用户须在 BorealHost 和宿主中自行管理。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 API key、登录凭据、结账材料、SSH key 或支付数据。"
    ],
    installScope: "仅打开 BorealHost 第一方仓库、产品、条款与隐私说明；不下载、安装、运行、购买、付款、配置或连接任何服务。",
    uninstallPlan: "枕星 AI 未安装或连接任何内容；用户自行建立的 API key、订阅与宿主配置须在 BorealHost 和对应宿主中自行轮换、删除或取消。",
    provenanceEvidence: [
      "https://github.com/alainsvrd/borealhost-mcp",
      "https://borealhost.ai/",
      "https://borealhost.ai/en/legal/conditions-utilisation/",
      "https://borealhost.ai/en/legal/confidentialite/"
    ],
    lastVerifiedAt: observedAt,
    metadataSnapshot: metadata({
      sourcePage: "https://github.com/alainsvrd/borealhost-mcp",
      canonicalSource: "https://github.com/alainsvrd/borealhost-mcp",
      author: "BorealHost.ai",
      licenseId: "LicenseRef-Proprietary-Service",
      revision: "0.3.0+rolling-service",
      externalId: "official-mcp-registry:ai.borealhost/mcp@0.3.0"
    })
  },
  {
    id: "chronary-mcp",
    enabled: true,
    order: 277,
    name: "Chronary MCP",
    resourceTypes: ["mcp"],
    description: "Chronary 官方 MCP 可管理 agents、calendars、events、webhooks 与 iCal 对象，并包含创建、更新、取消、释放和删除操作；仅提供说明链接。",
    website: "https://docs.chronary.ai/mcp/tools-reference/",
    tutorial: "https://docs.chronary.ai/mcp/tools-reference/",
    publisher: "Chronary",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [
      target("claude-desktop"), target("claude-code"), target("cursor-desktop"),
      target("microsoft-vscode"), target("github-copilot"), target("windsurf-editor")
    ],
    versionRef: "npm:@chronary/mcp@1.5.2",
    requestedPermissions: [
      "可创建、更新或删除 agents、calendars、events、webhooks 与 iCal 对象，并可取消或释放事件以及读取 scheduling/availability 数据。",
      "日历写入、取消、删除和 webhook 变更必须由用户在 Chronary 与宿主侧自行确认。"
    ],
    credentialRequirements: [
      "使用 organization/agent-scoped API keys；发布方支持 scoped-key revocation，删除 agent 会撤销其 keys。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 Chronary API key、日历凭据或其他认证材料。"
    ],
    installScope: "仅打开 Chronary 第一方 MCP、工具、审计与账户删除说明；不下载、安装、启动、配置或连接 server，不访问或修改日历。",
    uninstallPlan: "枕星 AI 未安装或连接任何内容；用户自行建立的 keys 与宿主配置须在 Chronary 和对应宿主中自行撤销或删除。",
    provenanceEvidence: [
      "https://github.com/Chronary/chronary-mcp",
      "https://docs.chronary.ai/mcp/tools-reference/",
      "https://docs.chronary.ai/api-reference/audit-log/",
      "https://docs.chronary.ai/api-reference/account/"
    ],
    lastVerifiedAt: observedAt,
    metadataSnapshot: metadata({
      sourcePage: "https://docs.chronary.ai/mcp/tools-reference/",
      canonicalSource: "https://github.com/Chronary/chronary-mcp",
      author: "Chronary",
      licenseId: "Apache-2.0",
      revision: "chronary-mcp/1.5.2",
      externalId: "official-mcp-registry:ai.chronary/mcp@1.5.2"
    })
  },
  {
    id: "foura-mcp",
    enabled: true,
    order: 278,
    name: "FourA MCP",
    resourceTypes: ["mcp"],
    description: "FourA 官方 MCP 提供开放网络 HTTP、旋转代理和完整浏览器访问，可携带 cookies、headers 与 session material 并产生外部副作用；仅提供说明链接。",
    website: "https://foura.ai/docs/mcp/server",
    tutorial: "https://foura.ai/docs/mcp/server",
    publisher: "FourA",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [
      target("claude-desktop"), target("claude-code"), target("cursor-desktop"),
      target("windsurf-editor"), target("microsoft-vscode")
    ],
    versionRef: "npm:@fouradata/mcp@0.6.0",
    requestedPermissions: [
      "可向开放网络发起 HTTP 请求、使用旋转代理和完整浏览器、携带 cookies/headers/session、处理 anti-bot challenge 并重放保存的请求。",
      "非 GET 请求、浏览器操作与第三方站点访问可能产生外部副作用；用户必须确认目标授权、站点条款与费用。"
    ],
    credentialRequirements: [
      "使用用户自行管理的 FourA API key；禁用、重生成或删除会阻止后续认证，用户须在 FourA 与宿主中自行操作。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 API key、cookies、Authorization headers、sessions 或目标站点凭据。"
    ],
    installScope: "仅打开 FourA 第一方 MCP、API key 与 Activity Log 说明；不下载、安装、启动、配置或连接 server，不访问目标网站或消耗 credits。",
    uninstallPlan: "枕星 AI 未安装或连接任何内容；用户自行建立的 API key、session 与宿主配置须在 FourA 和对应宿主中自行删除或撤销。",
    provenanceEvidence: [
      "https://github.com/fouradata/mcp",
      "https://foura.ai/docs/mcp/server",
      "https://foura.ai/docs/dashboard/api-keys",
      "https://foura.ai/docs/dashboard/activity-log"
    ],
    lastVerifiedAt: observedAt,
    metadataSnapshot: metadata({
      sourcePage: "https://foura.ai/docs/mcp/server",
      canonicalSource: "https://github.com/fouradata/mcp",
      author: "FourA",
      licenseId: "MIT",
      revision: "fouradata-mcp/0.6.0",
      externalId: "official-mcp-registry:ai.foura/mcp@0.6.0"
    })
  }
]);

const forbiddenFields = new Set([
  "args", "command", "credential", "credentialValue", "credentialValues", "credentials",
  "endpoint", "env", "headers", "installArgs", "installCommand", "installPackage",
  "installRuntime", "managedInstall", "package", "runtime", "runtimeConfig", "script",
  "secret", "token", "value"
]);

function reject(message) {
  throw new Error(`Official Registry ready4 candidate rejected: ${message}`);
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function assertFrozenInputHashes(actual) {
  for (const [name, input] of Object.entries(inputs)) {
    if (actual?.[name] !== input.sha256) reject(`frozen input drift: ${input.path}`);
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
      return `github:${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
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
    externalId: String(value?.metadataSnapshot?.externalId || "").trim().toLowerCase(),
    sources: new Set([
      value?.website, value?.tutorial, value?.metadataSnapshot?.sourcePage,
      value?.metadataSnapshot?.canonicalSource
    ].map(canonicalSourceKey).filter(Boolean))
  };
}

function sameIdentity(candidate, expected) {
  const left = identity(candidate);
  const right = identity(expected);
  return left.id === right.id ||
    (left.name && left.name === right.name && left.publisher === right.publisher) ||
    (left.externalId && left.externalId === right.externalId) ||
    [...left.sources].some((source) => right.sources.has(source));
}

function assertNoCurrentDuplicates(resources) {
  for (const expected of newResources) {
    const duplicate = resources.find((resource) => sameIdentity(resource, expected));
    if (duplicate) reject(`semantic identity already exists: ${duplicate.id}`);
  }
}

function parseHistory(entries) {
  const parsed = entries.map((entry) => ({
    path: entry.path,
    raw: entry.raw,
    value: JSON.parse(entry.raw),
    actualSha256: sha256(entry.raw)
  }));
  const byPath = new Map();
  for (const entry of parsed) {
    if (byPath.has(entry.path)) reject(`duplicate historical path: ${entry.path}`);
    byPath.set(entry.path, entry);
  }
  return { parsed, byPath };
}

function exactInheritedResources(value) {
  if (value?.candidateOnly !== true || value?.freezeOnly !== true || value?.publishable !== false || !Array.isArray(value?.catalog?.resources)) return null;
  return newResources.every((expected) => {
    const matches = value.catalog.resources.filter((resource) => resource.id === expected.id);
    return matches.length === 1 && isDeepStrictEqual(matches[0], expected);
  }) ? value.catalog.resources : null;
}

function assertNoHistoricalDuplicates(entries) {
  const { parsed, byPath } = parseHistory(entries);
  const anchor = byPath.get(outputPath);
  const anchorFrozen = anchor?.actualSha256 === outputSha256 && exactInheritedResources(anchor.value) !== null;
  const hasAncestry = (entry, visited = new Set()) => {
    if (exactInheritedResources(entry.value) === null || visited.has(entry.path)) return false;
    const next = new Set(visited).add(entry.path);
    for (const input of Object.values(entry.value.inputs || {})) {
      if (!input || typeof input !== "object" || !isDeepStrictEqual(Object.keys(input).sort(), ["path", "sha256"])) continue;
      if (input.path === outputPath && input.sha256 === outputSha256 && anchorFrozen) return true;
      const parent = byPath.get(input.path);
      if (parent && input.sha256 === parent.actualSha256 && hasAncestry(parent, next)) return true;
    }
    return false;
  };
  for (const entry of parsed) {
    if (entry.path === outputPath) continue;
    const inherited = hasAncestry(entry) ? exactInheritedResources(entry.value) : null;
    const resources = Array.isArray(entry.value?.catalog?.resources) ? entry.value.catalog.resources : [];
    const skipped = new Set();
    for (const resource of resources) {
      if (inherited === resources) {
        const index = newResources.findIndex((expected, i) => !skipped.has(i) && isDeepStrictEqual(resource, expected));
        if (index !== -1) {
          skipped.add(index);
          continue;
        }
      }
      if (newResources.some((expected) => sameIdentity(resource, expected))) {
        reject(`historical semantic identity already exists: ${entry.path}`);
      }
    }
  }
}

function assertNoForbiddenFields(value) {
  if (Array.isArray(value)) return value.forEach(assertNoForbiddenFields);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenFields.has(key)) reject(`forbidden runtime field: ${key}`);
    assertNoForbiddenFields(child);
  }
}

function applyCorrections(catalog) {
  const godot = catalog.resources.find((resource) => resource.id === "godot-mcp");
  const sentry = catalog.resources.find((resource) => resource.id === "sentry-mcp");
  if (!godot || godot.publisher !== "Godot Engine" || godot.publisherVendorId !== "godot" || !isDeepStrictEqual(godot.sourceProductIds, ["godot-engine"])) {
    reject("Godot source fact baseline drift");
  }
  if (!sentry || sentry.description !== "Sentry 官方托管及开源 MCP 服务，为编码代理提供排障上下文。") {
    reject("Sentry license wording baseline drift");
  }
  godot.publisher = "tomyud1";
  delete godot.publisherVendorId;
  delete godot.sourceProductIds;
  godot.description = "社区作者 tomyud1 维护的 Godot MCP，可运行项目并创建、修改或删除场景节点与脚本；与 Godot Engine 项目不存在已核验的官方发布关系。";
  godot.versionRef = "github:godot-mcp@0.5.0+f794f7f4d3029172c06a7ebee02543e12dbf60ef";
  godot.provenanceEvidence = [
    "https://github.com/tomyud1/godot-mcp/tree/f794f7f4d3029172c06a7ebee02543e12dbf60ef",
    "https://github.com/tomyud1/godot-mcp/blob/f794f7f4d3029172c06a7ebee02543e12dbf60ef/mcp-server/package.json",
    "https://github.com/tomyud1/godot-mcp/blob/f794f7f4d3029172c06a7ebee02543e12dbf60ef/mcp-server/server.json",
    "https://github.com/tomyud1/godot-mcp/blob/f794f7f4d3029172c06a7ebee02543e12dbf60ef/LICENSE"
  ];
  godot.lastVerifiedAt = observedAt;
  godot.metadataSnapshot = metadata({
    sourcePage: godot.provenanceEvidence[0],
    canonicalSource: "https://github.com/tomyud1/godot-mcp",
    author: "tomyud1",
    licenseId: "MIT",
    revision: "f794f7f4d3029172c06a7ebee02543e12dbf60ef",
    externalId: "official-mcp-registry:io.github.tomyud1/godot-mcp@0.5.0"
  });

  sentry.description = "Sentry 官方托管及源码可公开查看的 MCP 服务；固定 0.25.0 package 的许可口径以 FSL-1.1-ALv2 为准。";
  sentry.versionRef = "rolling-official-service+package-0.25.0@0340251967cff36b8cff316dec0346c223bcbff8";
  sentry.provenanceEvidence = [
    "https://github.com/getsentry/sentry-mcp",
    "https://github.com/getsentry/sentry-mcp/blob/0340251967cff36b8cff316dec0346c223bcbff8/packages/mcp-server/package.json",
    "https://github.com/getsentry/sentry-mcp/blob/main/docs/security.md"
  ];
  sentry.lastVerifiedAt = observedAt;
  sentry.metadataSnapshot = metadata({
    sourcePage: sentry.provenanceEvidence[1],
    canonicalSource: "https://github.com/getsentry/sentry-mcp",
    author: "Sentry",
    licenseId: "FSL-1.1-ALv2",
    revision: "0340251967cff36b8cff316dec0346c223bcbff8",
    externalId: "official-mcp-registry:io.github.getsentry/sentry-mcp@0.25.0"
  });
}

function buildCandidate(baseCandidate, historyEntries = []) {
  if (
    baseCandidate?.candidateOnly !== true || baseCandidate?.freezeOnly !== true || baseCandidate?.publishable !== false ||
    baseCandidate?.catalog?.schemaVersion !== 3 || baseCandidate.catalog.vendors?.length !== 375 ||
    baseCandidate.catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0) !== 616 ||
    baseCandidate.catalog.resources?.length !== 275 ||
    baseCandidate.catalog.resources.reduce((count, resource) => count + resource.targets.length, 0) !== 845 ||
    baseCandidate.catalog.resourceConnections?.length !== 10
  ) reject("base catalog v3 contract mismatch");
  validateCatalog(baseCandidate.catalog);
  assertNoCurrentDuplicates(baseCandidate.catalog.resources);
  assertNoHistoricalDuplicates(historyEntries);
  newResources.forEach(assertNoForbiddenFields);

  const catalog = structuredClone(baseCandidate.catalog);
  applyCorrections(catalog);
  catalog.resources.push(...newResources.map((resource) => structuredClone(resource)));
  validateCatalog(catalog);
  const summary = {
    vendors: catalog.vendors.length,
    products: catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0),
    resources: catalog.resources.length,
    targets: catalog.resources.reduce((count, resource) => count + resource.targets.length, 0),
    resourceConnections: catalog.resourceConnections.length,
    appendedResources: newResources.length,
    correctedResources: 2
  };
  assert.deepEqual(summary, {
    vendors: 375, products: 616, resources: 279, targets: 861,
    resourceConnections: 10, appendedResources: 4, correctedResources: 2
  });

  const reversed = structuredClone(catalog);
  assert.deepEqual(reversed.resources.splice(-newResources.length), newResources);
  for (const id of ["godot-mcp", "sentry-mcp"]) {
    const index = reversed.resources.findIndex((resource) => resource.id === id);
    reversed.resources[index] = structuredClone(baseCandidate.catalog.resources.find((resource) => resource.id === id));
  }
  assert.deepEqual(reversed, baseCandidate.catalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: observedAt,
    title: "Official MCP Registry run3 ready4 and provenance corrections catalog v3 candidate",
    inputs,
    summary,
    catalog,
    safety: {
      candidateOnly: true,
      freezeOnly: true,
      publishable: false,
      linkOnlyNewTargets: true,
      correctedProvenanceFacts: true,
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
  const directory = path.join(root, "docs", "research");
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && /candidate|review|index/i.test(entry.name) && entry.name !== path.basename(inputs.baseCatalogV3.path))
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((entry) => ({
      path: `docs/research/${entry.name}`,
      raw: fs.readFileSync(path.join(directory, entry.name), "utf8")
    }));
}

function main() {
  const rawInputs = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, fs.readFileSync(path.join(root, input.path))]));
  assertFrozenInputHashes(Object.fromEntries(Object.entries(rawInputs).map(([name, raw]) => [name, sha256(raw)])));
  const candidate = buildCandidate(JSON.parse(rawInputs.baseCatalogV3.toString("utf8")), historyEntries());
  fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, summary: candidate.summary })}\n`);
}

if (require.main === module) main();

module.exports = { assertFrozenInputHashes, buildCandidate, newResources };
