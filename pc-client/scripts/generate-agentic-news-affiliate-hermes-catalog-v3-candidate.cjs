"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
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
const outputPath =
  "docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json";
const outputSha256 = "265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20";
const hermesRevision = "642b735dbdbae4f01f5df0b9288d5f67a7e530f4";
const hermesRepository = "https://github.com/NousResearch/hermes-agent";
const hermesDirectory =
  `${hermesRepository}/tree/${hermesRevision}/optional-skills/communication/one-three-one-rule`;
const affiliateRepository = "https://github.com/bobberrisford/affiliatemcp";

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
  {
    id: "agentic-news-mcp",
    enabled: true,
    order: 262,
    name: "Agentic News MCP",
    resourceTypes: ["mcp"],
    description:
      "Agentic News 的第一方托管 MCP 服务可读取和个性化新闻，并创建或更新监控 agent、提交反馈及保存 collection；这些写入发生在 Agentic News 内，聊天、新闻和使用数据还可能由其列明的 LLM 与基础设施 subprocessors 处理。",
    website: "https://agentic-news.ai/mcp",
    tutorial: "https://agentic-news.ai/mcp",
    publisher: "Agentic News",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "guarded",
    targets: [
      target("claude-desktop"),
      target("cursor-desktop"),
      target("microsoft-vscode"),
      target("windsurf-editor")
    ],
    versionRef: "registry@1.0.0+rolling-official-service",
    requestedPermissions: [
      "服务可读取、检索和个性化新闻内容，并处理用户的聊天与使用数据。",
      "服务可创建或更新监控 agent、提交反馈并保存 collection，因而会写入用户在 Agentic News 内的状态；它不会因此获得向外部发布内容的授权。",
      "发布方说明部分个人化新闻、聊天和使用数据可能由其列明的 LLM 与基础设施 subprocessors 处理。"
    ],
    credentialRequirements: [
      "用户须自行拥有 Agentic News 账户，并在发布方流程中使用 API access 或 OAuth 2.0 with PKCE；发布方隐私说明涉及 key hash、OAuth session 与 tool-call log。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 Agentic News 登录材料、API access、OAuth 授权或其他认证信息。"
    ],
    installScope:
      "仅打开 Agentic News 第一方 MCP、条款与隐私说明；不下载、不安装、不登录、不发起 OAuth、不保存连接、不写宿主配置、不调用 MCP 工具，也不读取或修改新闻监控状态。",
    uninstallPlan:
      "枕星 AI 未安装、配置或连接任何内容，因此没有托管卸载状态；用户自行建立的账户、API 或 OAuth 关系须按发布方说明自行管理，本候选不声称已验证完整撤权时序。",
    provenanceEvidence: [
      "https://agentic-news.ai/mcp",
      "https://agentic-news.ai/terms",
      "https://agentic-news.ai/privacy"
    ],
    lastVerifiedAt: "2026-08-15T00:00:00.000Z",
    metadataSnapshot: {
      sourcePlatform: "official-mcp-registry",
      discoveredVia: "official-mcp-registry",
      sourcePage: "https://agentic-news.ai/mcp",
      canonicalSource: "https://agentic-news.ai/mcp",
      originalAuthor: "Agentic News",
      licenseId: "service-terms",
      sourceRevision: "registry-1.0.0+rolling-service",
      provenanceStatus: "first-party-verified",
      externalId: "official-mcp-registry:ai.agentic-news/mcp@1.0.0",
      observedAt: "2026-08-14T18:08:39.596Z",
      licenseStatus: "verified"
    }
  },
  {
    id: "affiliate-networks-mcp",
    enabled: true,
    order: 263,
    name: "Affiliate Networks MCP",
    resourceTypes: ["mcp"],
    description:
      "Robert Berrisford 维护的 Affiliate Networks MCP 0.19.0 是社区实现，并非各 affiliate network 的官方集成；发布方称外部 network API 数据访问只读，但本地 setup 会保存配置和用户自备凭据，可选 cache 还会写入结果，多数 adapter 仍属 experimental。",
    website: `${affiliateRepository}/releases/tag/v0.19.0`,
    tutorial: `${affiliateRepository}/tree/v0.19.0`,
    publisher: "Robert Berrisford",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [
      target("claude-desktop"),
      target("claude-code"),
      target("codex-cli")
    ],
    versionRef: "registry@0.19.0+signed-release-v0.19.0+commit-9248d42",
    requestedPermissions: [
      "发布方称 v0.19.0 对外部 affiliate network API 的数据访问为只读；这些 adapter 是社区实现，不能冒充对应 network 的官方集成或认证。",
      "若用户自行运行 setup，服务会在本机保存 network 配置和凭据；可选 cache 还会写入查询结果，多数 adapter 的成熟度仍为 experimental。",
      "枕星 AI 的 link-only 候选不读取 network 数据、不运行 setup、不写配置或 cache，也不调用任何 adapter。"
    ],
    credentialRequirements: [
      "本地模式要求用户自备各 affiliate network 的认证材料并自行保存在本机；可选 hosted connector 使用发布方 OAuth 与加密 vault，且只覆盖部分网络。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 affiliate network 登录材料、API key、OAuth 授权、vault 内容或其他认证信息。"
    ],
    installScope:
      "仅打开固定的 v0.19.0 signed release、源码与 MIT 许可；不克隆、下载、安装、运行或配置 server，不写宿主或本地配置，不保存凭据或 cache，也不调用任何 network API。",
    uninstallPlan:
      "枕星 AI 未安装、配置或连接任何内容，因此没有托管卸载状态；用户自行安装的 server、配置、cache、凭据或 hosted OAuth 关系须在对应本机和发布方或 network 控制面自行移除或撤销。",
    provenanceEvidence: [
      `${affiliateRepository}/releases/tag/v0.19.0`,
      `${affiliateRepository}/tree/v0.19.0`,
      `${affiliateRepository}/blob/v0.19.0/LICENCE`
    ],
    lastVerifiedAt: "2026-08-15T00:00:00.000Z",
    metadataSnapshot: {
      sourcePlatform: "github",
      discoveredVia: "official-mcp-registry",
      sourcePage: `${affiliateRepository}/releases/tag/v0.19.0`,
      canonicalSource: affiliateRepository,
      originalAuthor: "Robert Berrisford",
      licenseId: "MIT",
      sourceRevision: "v0.19.0+9248d42",
      provenanceStatus: "first-party-verified",
      externalId:
        "official-mcp-registry:ai.agenticaffiliate/affiliate-networks-mcp@0.19.0",
      observedAt: "2026-08-14T18:08:39.596Z",
      licenseStatus: "verified"
    }
  },
  {
    id: "hermes-one-three-one-rule",
    enabled: true,
    order: 264,
    name: "One-Three-One Rule",
    resourceTypes: ["skill"],
    description:
      "Willard Moore 编写并由 Nous Research 固定官方目录收录的 One-Three-One Rule 1.0.0，是纯文本决策格式：说明一个问题、恰好三个选项和一个建议，并给出完成定义与实施计划；它不自带命令、网络、凭据、辅助文件或必需状态写入。",
    website: hermesDirectory,
    tutorial:
      `${hermesRepository}/blob/${hermesRevision}/optional-skills/communication/one-three-one-rule/SKILL.md`,
    publisher: "Willard Moore",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "low",
    targets: [target("nous-hermes-agent")],
    versionRef: `SKILL.md@1.0.0+${hermesRevision}`,
    requestedPermissions: [
      "Skill 只提供一个问题、三个选项、一个建议、完成定义和实施计划的文本组织格式，不要求执行命令、访问网络、读取或写入文件或改变外部状态。",
      "格式生成的未来实施计划仍须由用户任务另行授权；本 Skill 不预先授予计划中任何安装、执行、文件、网络或外部写入权限。"
    ],
    credentialRequirements: [
      "固定 SKILL.md 未声明账户、API key、OAuth、token 或其他认证材料。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发任何登录材料、API key、OAuth、token 或其他认证信息。"
    ],
    installScope:
      "仅打开固定 commit 的 Hermes 官方目录条目与 SKILL.md；不复制或安装 Skill、不写 Hermes 配置、不执行任何计划、命令或工具，也不改变本地或外部状态。",
    uninstallPlan:
      "枕星 AI 未安装、复制或配置任何内容，因此没有托管卸载状态；用户自行复制的 Skill 须由用户在 Hermes 官方宿主中自行移除。",
    provenanceEvidence: [
      hermesDirectory,
      `${hermesRepository}/blob/${hermesRevision}/optional-skills/communication/one-three-one-rule/SKILL.md`,
      `${hermesRepository}/blob/${hermesRevision}/website/docs/reference/optional-skills-catalog.md`,
      `${hermesRepository}/blob/${hermesRevision}/LICENSE`
    ],
    lastVerifiedAt: "2026-08-15T00:00:00.000Z",
    metadataSnapshot: {
      sourcePlatform: "github",
      discoveredVia: "first-party-review",
      sourcePage: hermesDirectory,
      canonicalSource: hermesDirectory,
      originalAuthor: "Willard Moore",
      licenseId: "MIT",
      sourceRevision: hermesRevision,
      provenanceStatus: "first-party-verified",
      externalId:
        "github:nousresearch/hermes-agent#optional-skills/communication/one-three-one-rule",
      observedAt: "2026-08-15T00:00:00.000Z",
      licenseStatus: "verified"
    }
  }
]);

const forbiddenRuntimeFields = new Set([
  "args", "command", "credential", "credentialValue", "credentialValues",
  "credentials", "endpoint", "env", "headers", "installArgs", "installCommand",
  "installPackage", "installRuntime", "managedInstall", "package", "path", "runtime",
  "runtimeConfig", "script", "secret", "token", "value"
]);

function reject(message) {
  throw new Error(`Agentic/Affiliate/Hermes candidate rejected: ${message}`);
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

function canonicalSourceKey(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "github.com" && parts.length >= 2) {
      const owner = parts[0].toLowerCase();
      const repo = parts[1].toLowerCase();
      let rest = parts.slice(2);
      if (["blob", "tree"].includes(rest[0]) && rest.length >= 2) rest = rest.slice(2);
      if (rest.at(-1)?.toLowerCase() === "skill.md") rest = rest.slice(0, -1);
      return `github:${owner}/${repo}#${rest.join("/").toLowerCase()}`;
    }
    return `${host}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
  } catch {
    return null;
  }
}

function sourceKeys(resource) {
  return new Set([
    resource.website,
    resource.tutorial,
    resource.sourcePage,
    resource.canonicalSource,
    resource.metadataSnapshot?.sourcePage,
    resource.metadataSnapshot?.canonicalSource
  ].map(canonicalSourceKey).filter(Boolean));
}

function externalId(resource) {
  return String(resource.metadataSnapshot?.externalId || resource.externalId || "")
    .trim()
    .toLowerCase();
}

function hasSameSemanticIdentity(candidate, expected) {
  const expectedSources = sourceKeys(expected);
  return String(candidate.id || "").trim().toLowerCase() === expected.id ||
    (normalizeText(candidate.name) === normalizeText(expected.name) &&
      normalizeText(candidate.publisher) === normalizeText(expected.publisher)) ||
    (externalId(candidate) !== "" && externalId(candidate) === externalId(expected)) ||
    [...sourceKeys(candidate)].some((key) => expectedSources.has(key));
}

function assertNoSemanticDuplicates(existingResources) {
  for (const expected of resources) {
    const duplicate = existingResources.find((item) => hasSameSemanticIdentity(item, expected));
    if (duplicate) reject(`semantic identity already exists: ${duplicate.id}`);
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

  const containsExactResources = (value) =>
    value?.candidateOnly === true &&
    value?.freezeOnly === true &&
    value?.publishable === false &&
    Array.isArray(value?.catalog?.resources) &&
    resources.every((expected) => {
      const matches = value.catalog.resources.filter(({ id }) => id === expected.id);
      return matches.length === 1 && isDeepStrictEqual(matches[0], expected);
    });
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
      if (value === inheritedResources) {
        const skipped = new Set();
        for (const child of value) {
          const index = resources.findIndex(
            (expected, candidateIndex) =>
              !skipped.has(candidateIndex) && isDeepStrictEqual(child, expected)
          );
          if (index !== -1) {
            skipped.add(index);
            continue;
          }
          visit(child);
        }
        return;
      }
      if (!Array.isArray(value) && resources.some((item) => hasSameSemanticIdentity(value, item))) {
        duplicate = true;
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
    baseCandidate.catalog.resources?.length !== 267 ||
    baseCandidate.catalog.resources.reduce((count, item) => count + item.targets.length, 0) !== 813 ||
    baseCandidate.catalog.resourceConnections?.length !== 10
  ) reject("Adeu base catalog v3 contract mismatch");

  validateCatalog(baseCandidate.catalog);
  assertNoSemanticDuplicates(baseCandidate.catalog.resources);
  assertNoHistoricalSemanticDuplicates(historyEntries);
  resources.forEach(assertNoForbiddenRuntimeFields);

  const catalog = structuredClone(baseCandidate.catalog);
  const originalConnections = structuredClone(catalog.resourceConnections);
  catalog.resources.push(...resources.map((item) => structuredClone(item)));
  validateCatalog(catalog);

  const summary = {
    resources: catalog.resources.length,
    targets: catalog.resources.reduce((count, item) => count + item.targets.length, 0),
    resourceConnections: catalog.resourceConnections.length,
    appendedResources: resources.length
  };
  assert.deepEqual(summary, {
    resources: 270,
    targets: 821,
    resourceConnections: 10,
    appendedResources: 3
  });
  assert.deepEqual(catalog.resourceConnections, originalConnections);

  const reversed = structuredClone(catalog);
  assert.deepEqual(reversed.resources.splice(-resources.length), resources);
  assert.deepEqual(reversed, baseCandidate.catalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: "2026-08-15T00:00:00.000Z",
    title: "Agentic News, Affiliate Networks, and Hermes catalog v3 incremental candidate",
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
    .filter((entry) =>
      entry.isFile() &&
      entry.name.endsWith(".json") &&
      /candidate|review|index/i.test(entry.name) &&
      entry.name !== path.basename(inputs.baseAdeuCatalogV3.path)
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
  assertFrozenInputHashes(Object.fromEntries(
    Object.entries(rawInputs).map(([name, raw]) => [name, sha256(raw)])
  ));
  const candidate = buildCandidate(
    JSON.parse(rawInputs.baseAdeuCatalogV3.toString("utf8")),
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
