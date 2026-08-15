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
    path: "docs/research/deepseek-harness-product-catalog-v3-candidate-2026-08-15.json",
    sha256: "ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7"
  },
  research: {
    path: "docs/research/official-unbound-mcp-host-evidence-d12-d16-2026-08-15.md",
    sha256: "df5225c2ffba72597c703073ccb5372d776ca7e01376871917ddbaa04200ecdf"
  }
});
const outputPath =
  "docs/research/official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json";
const outputSha256 = "3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba";
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

function metadata({ sourcePage, canonicalSource, author, licenseId, revision, externalId }) {
  return {
    sourcePlatform: "first-party-review",
    discoveredVia: "first-party-review",
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

const resources = Object.freeze([
  {
    id: "pagerduty-official-mcp",
    enabled: true,
    order: 270,
    name: "PagerDuty MCP Server",
    resourceTypes: ["mcp"],
    description:
      "PagerDuty 官方 MCP family 同时提供托管 remote 与开源 self-hosted 形态；默认只读，但用户可显式启用创建、更新或删除 incidents、services、schedule overrides 与 event orchestrations 等写工具，因此仅提供说明链接。",
    website: "https://support.pagerduty.com/main/docs/pagerduty-mcp-server",
    tutorial: "https://support.pagerduty.com/main/docs/pagerduty-mcp-server",
    publisher: "PagerDuty",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [
      target("claude-desktop"),
      target("cursor-desktop"),
      target("microsoft-vscode")
    ],
    versionRef: "hosted-rolling+local-upstream-main",
    requestedPermissions: [
      "默认工具面只读；若用户自行启用写工具，可创建、更新或删除 incidents、services、schedule overrides 与 event orchestrations，并可 acknowledge、resolve 或 escalate incidents。",
      "写工具可能直接影响事故响应和 on-call 运营，必须由用户在发布方与宿主侧自行配置并确认。"
    ],
    credentialRequirements: [
      "托管服务使用 PagerDuty OAuth 或 API key；self-hosted 形态使用 User API Token，均由用户在 PagerDuty 与宿主中自行管理和撤销。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 PagerDuty OAuth、API key、User API Token 或其他认证材料。"
    ],
    installScope:
      "仅打开 PagerDuty 官方说明、源码与许可页面；不下载、安装、启动、配置或连接 server，不写宿主配置，不调用 MCP 工具，也不接触 PagerDuty 数据或凭据。",
    uninstallPlan:
      "枕星 AI 未安装或连接任何内容，因此没有托管卸载状态；用户自行建立的 OAuth/API key/token 与宿主配置须在 PagerDuty 和对应宿主中自行删除或撤销。",
    provenanceEvidence: [
      "https://support.pagerduty.com/main/docs/pagerduty-mcp-server",
      "https://github.com/PagerDuty/pagerduty-mcp-server",
      "https://github.com/PagerDuty/pagerduty-mcp-server/blob/main/LICENSE",
      "https://pagerduty.github.io/pagerduty-mcp-server/docs/remote-server/setup"
    ],
    lastVerifiedAt: observedAt,
    metadataSnapshot: metadata({
      sourcePage: "https://support.pagerduty.com/main/docs/pagerduty-mcp-server",
      canonicalSource: "https://github.com/PagerDuty/pagerduty-mcp-server",
      author: "PagerDuty",
      licenseId: "Apache-2.0",
      revision: "hosted-rolling+local-upstream-main",
      externalId: "census:D12:pagerduty:official-mcp"
    })
  },
  {
    id: "launchdarkly-official-mcp",
    enabled: true,
    order: 271,
    name: "LaunchDarkly MCP Server",
    resourceTypes: ["mcp"],
    description:
      "LaunchDarkly 官方 hosted/local MCP 可读取并管理 feature flags、AgentControl configs 与 observability data；创建 flag、跨环境启用、修改 targeting rules 或配置都可能改变生产行为，因此仅提供说明链接。",
    website: "https://launchdarkly.com/docs/home/getting-started/mcp",
    tutorial: "https://launchdarkly.com/docs/home/getting-started/mcp-hosted",
    publisher: "LaunchDarkly",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [
      target("claude-desktop"),
      target("claude-code"),
      target("cursor-desktop"),
      target("microsoft-vscode"),
      target("github-copilot"),
      target("windsurf-editor")
    ],
    versionRef: "hosted-rolling+local-v0.6.2",
    requestedPermissions: [
      "工具可读取、创建和管理 feature flags、AgentControl configs 与 observability data，并可能访问日志、trace 与错误信息。",
      "创建 flag、跨环境启用或修改 targeting/config 会改变产品运行行为，必须由用户在 LaunchDarkly 与宿主中自行授权和确认。"
    ],
    credentialRequirements: [
      "Hosted 形态使用 LaunchDarkly OAuth；local 形态使用具备相应权限的 API access token，均由用户在发布方控制面自行撤销或删除。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 LaunchDarkly OAuth、API access token 或其他认证材料。"
    ],
    installScope:
      "仅打开 LaunchDarkly 官方 MCP、条款、源码与许可页面；不下载、安装、启动、配置或连接 server，不发起 OAuth，不调用工具，也不读取或更改 flags、configs 或 observability data。",
    uninstallPlan:
      "枕星 AI 未安装或连接任何内容，因此没有托管卸载状态；用户自行建立的 OAuth/token 与宿主配置须在 LaunchDarkly 和对应宿主中自行删除或撤销。",
    provenanceEvidence: [
      "https://launchdarkly.com/docs/home/getting-started/mcp",
      "https://launchdarkly.com/docs/home/getting-started/mcp-hosted",
      "https://launchdarkly.com/docs/home/getting-started/mcp-local",
      "https://github.com/launchdarkly/mcp-server/tree/v0.6.2",
      "https://github.com/launchdarkly/mcp-server/blob/v0.6.2/LICENSE"
    ],
    lastVerifiedAt: observedAt,
    metadataSnapshot: metadata({
      sourcePage: "https://launchdarkly.com/docs/home/getting-started/mcp",
      canonicalSource: "https://github.com/launchdarkly/mcp-server",
      author: "LaunchDarkly",
      licenseId: "MIT",
      revision: "hosted-rolling+local-v0.6.2",
      externalId: "census:D13:launchdarkly:official-mcp"
    })
  },
  {
    id: "snyk-studio-mcp",
    enabled: true,
    order: 272,
    name: "Snyk Studio MCP",
    resourceTypes: ["mcp"],
    description:
      "Snyk Studio MCP 是由 Snyk CLI 驱动的本地服务，可扫描源码、依赖、IaC、容器与 SBOM，并可能执行 Gradle/Maven 等工具、建立 workspace trust 或上传代码；AI Hub 仅提供官方说明链接。",
    website: "https://docs.snyk.io/integrations/snyk-studio-agentic-integrations",
    tutorial: "https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/getting-started-with-snyk-studio",
    publisher: "Snyk",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [
      target("claude-code"),
      target("codex-cli"),
      target("cursor-desktop"),
      target("gemini-cli"),
      target("microsoft-vscode"),
      target("github-copilot"),
      target("windsurf-editor")
    ],
    versionRef: "snyk-cli-rolling+studio-mcp-v1.15.3",
    requestedPermissions: [
      "本地服务可读取并扫描源码、依赖、IaC、容器与 SBOM，建立 folder trust，并可能执行 Gradle/Maven 等第三方工具获取 dependency tree。",
      "部分分析可能临时 clone 或上传代码并按 Snyk retention policy 缓存；宿主也可能依据 findings 修改 workspace，所有外发与修改均须用户自行审查。"
    ],
    credentialRequirements: [
      "Snyk CLI 支持 OAuth 2.0、PAT 与 legacy API token，并可能把授权材料保存在本机；用户须在 Snyk 和本机自行撤销、重置或登出。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 Snyk OAuth、PAT、API token 或其他认证材料。"
    ],
    installScope:
      "仅打开 Snyk 官方说明、固定 release、源码与许可页面；不下载或运行 CLI/server，不信任 workspace，不触发扫描、外发或修改代码，不写宿主配置，也不接触凭据。",
    uninstallPlan:
      "枕星 AI 未安装或配置任何内容，因此没有托管卸载状态；用户自行安装的 CLI/server、workspace trust、缓存、授权与宿主配置须按 Snyk 和对应宿主说明自行移除或撤销。",
    provenanceEvidence: [
      "https://docs.snyk.io/integrations/snyk-studio-agentic-integrations",
      "https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/getting-started-with-snyk-studio",
      "https://github.com/snyk/studio-mcp/releases/tag/v1.15.3",
      "https://github.com/snyk/studio-mcp/blob/v1.15.3/LICENSE"
    ],
    lastVerifiedAt: observedAt,
    metadataSnapshot: metadata({
      sourcePage: "https://docs.snyk.io/integrations/snyk-studio-agentic-integrations",
      canonicalSource: "https://github.com/snyk/studio-mcp",
      author: "Snyk",
      licenseId: "Apache-2.0",
      revision: "snyk-cli-rolling+studio-mcp-v1.15.3",
      externalId: "census:D14:snyk:studio-mcp"
    })
  },
  {
    id: "twilio-docs-mcp",
    enabled: true,
    order: 273,
    name: "Twilio Docs MCP",
    resourceTypes: ["mcp"],
    description:
      "Twilio 官方 Public Beta remote MCP 当前只检索公开 OpenAPI、Docs 与 Support 内容，不需要 Twilio 账户或 API key，也不代表用户执行 Twilio API；服务能力与可用性仍可能在 Beta 期间变化。",
    website: "https://www.twilio.com/docs/ai/mcp",
    tutorial: "https://www.twilio.com/docs/ai/mcp",
    publisher: "Twilio",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "guarded",
    targets: [
      target("claude-desktop"),
      target("claude-code"),
      target("cursor-desktop"),
      target("codex-cli")
    ],
    versionRef: "public-beta-rolling-service",
    requestedPermissions: [
      "当前工具仅搜索和检索 Twilio、SendGrid 与 Segment 的公开文档、支持内容及 OpenAPI schema，不执行 Twilio API，也不修改 Twilio 账户或资源。",
      "用户问题会发送给 Twilio-hosted retrieval service；未来计划中的 OAuth execute-ready 工具不属于本候选记录。"
    ],
    credentialRequirements: [
      "发布方明确当前服务无需 Twilio 账户、API key 或其他认证；从宿主移除该连接即可停止使用当前服务。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发任何 Twilio 登录材料、API key、OAuth 或其他认证信息。"
    ],
    installScope:
      "仅打开 Twilio 官方 MCP 与条款页面；不建立 remote connection，不写宿主配置，不调用 search/retrieve 工具，不发送问题或读取文档结果，也不接触任何账户或凭据。",
    uninstallPlan:
      "枕星 AI 未建立或保存连接，因此没有托管卸载状态；用户自行添加的当前无认证连接须在对应宿主中自行删除或停用。",
    provenanceEvidence: [
      "https://www.twilio.com/docs/ai/mcp",
      "https://www.twilio.com/en-us/legal/tos"
    ],
    lastVerifiedAt: observedAt,
    metadataSnapshot: metadata({
      sourcePage: "https://www.twilio.com/docs/ai/mcp",
      canonicalSource: "https://www.twilio.com/docs/ai/mcp",
      author: "Twilio",
      licenseId: "service-terms",
      revision: "public-beta-rolling-service",
      externalId: "census:D15:twilio:docs-mcp"
    })
  },
  {
    id: "square-official-mcp",
    enabled: true,
    order: 274,
    name: "Square MCP Server",
    resourceTypes: ["mcp"],
    description:
      "Square 官方 Beta MCP 提供 Block-hosted remote 与开源 local 形态，可访问 customers、orders、catalog、payments 等 Square API 资源；生产写入可能造成财务与业务影响，因此仅提供说明链接。",
    website: "https://developer.squareup.com/docs/mcp",
    tutorial: "https://developer.squareup.com/docs/mcp",
    publisher: "Block / Square",
    sourceKind: "official",
    reviewStatus: "manually-reviewed",
    riskLevel: "unsafe",
    targets: [
      target("claude-desktop"),
      target("goose-desktop"),
      target("cursor-desktop"),
      target("windsurf-editor")
    ],
    versionRef: "remote-beta-rolling+local-0.1.2",
    requestedPermissions: [
      "服务可访问 customers、orders、catalog、payments 等 Square API 资源；remote 只访问 production，local 仅在显式 read-only 限制时禁写。",
      "创建或修改订单、目录、客户与支付等 merchant resources 可能产生财务或业务影响，用户须自行选择 scopes，并优先在 Square Sandbox 验证 local 配置。"
    ],
    credentialRequirements: [
      "Remote 使用 seller OAuth，local 使用 Square access token；用户须在 Square Dashboard/Developer Console 与宿主中自行管理和撤销。",
      "枕星 AI 不请求、收集、保存、代理、校验或转发 Square OAuth、access token 或其他认证材料。"
    ],
    installScope:
      "仅打开 Square 官方 MCP、源码与许可页面；不下载、安装、启动、配置或连接 server，不发起 OAuth，不调用 Square API/MCP 工具，也不读取或修改 merchant data。",
    uninstallPlan:
      "枕星 AI 未安装或连接任何内容，因此没有托管卸载状态；用户自行建立的 OAuth/token 与宿主配置须在 Square 和对应宿主中自行删除或撤销。",
    provenanceEvidence: [
      "https://developer.squareup.com/docs/mcp",
      "https://github.com/square/square-mcp-server/releases/tag/0.1.2",
      "https://github.com/square/square-mcp-server/blob/0.1.2/LICENSE",
      "https://developer.squareup.com/docs/oauth-api/best-practices"
    ],
    lastVerifiedAt: observedAt,
    metadataSnapshot: metadata({
      sourcePage: "https://developer.squareup.com/docs/mcp",
      canonicalSource: "https://github.com/square/square-mcp-server",
      author: "Block / Square",
      licenseId: "Apache-2.0",
      revision: "remote-beta-rolling+local-0.1.2",
      externalId: "census:D16:square:official-mcp"
    })
  }
]);

const forbiddenRuntimeFields = new Set([
  "args", "command", "credential", "credentialValue", "credentialValues",
  "credentials", "endpoint", "env", "headers", "installArgs", "installCommand",
  "installPackage", "installRuntime", "managedInstall", "package", "runtime",
  "runtimeConfig", "script", "secret", "token", "value"
]);

function reject(message) {
  throw new Error(`D12-D16 candidate rejected: ${message}`);
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
      return `github:${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
    }
    return `${host}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
  } catch {
    return null;
  }
}

function sourceKeys(resource) {
  return new Set([
    resource?.website,
    resource?.tutorial,
    resource?.sourcePage,
    resource?.canonicalSource,
    resource?.metadataSnapshot?.sourcePage,
    resource?.metadataSnapshot?.canonicalSource
  ].map(canonicalSourceKey).filter(Boolean));
}

function externalId(resource) {
  return String(resource?.metadataSnapshot?.externalId || resource?.externalId || "")
    .trim()
    .toLowerCase();
}

const identityCache = new WeakMap();

function semanticIdentity(value) {
  if (!value || typeof value !== "object") {
    return { id: "", name: "", publisher: "", externalId: "", sources: new Set() };
  }
  if (!identityCache.has(value)) {
    identityCache.set(value, {
      id: String(value.id || "").trim().toLowerCase(),
      name: normalizeText(value.name),
      publisher: normalizeText(value.publisher),
      externalId: externalId(value),
      sources: sourceKeys(value)
    });
  }
  return identityCache.get(value);
}

function hasSameSemanticIdentity(candidate, expected) {
  const candidateIdentity = semanticIdentity(candidate);
  const expectedIdentity = semanticIdentity(expected);
  return candidateIdentity.id === expectedIdentity.id ||
    (candidateIdentity.name !== "" &&
      candidateIdentity.name === expectedIdentity.name &&
      candidateIdentity.publisher === expectedIdentity.publisher) ||
    (candidateIdentity.externalId !== "" &&
      candidateIdentity.externalId === expectedIdentity.externalId) ||
    [...candidateIdentity.sources].some((key) => expectedIdentity.sources.has(key));
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

  const exactResourceArray = (value) => {
    if (
      value?.candidateOnly !== true ||
      value?.freezeOnly !== true ||
      value?.publishable !== false ||
      !Array.isArray(value?.catalog?.resources)
    ) return null;
    return resources.every((expected) => {
      const matches = value.catalog.resources.filter(({ id }) => id === expected.id);
      return matches.length === 1 && isDeepStrictEqual(matches[0], expected);
    }) ? value.catalog.resources : null;
  };
  const anchor = entriesByPath.get(outputPath);
  const anchorIsFrozen =
    anchor?.actualSha256 === outputSha256 && exactResourceArray(anchor.value) !== null;
  const hasVerifiedAncestry = (entry, visited = new Set()) => {
    if (exactResourceArray(entry.value) === null || visited.has(entry.path)) return false;
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
      ? exactResourceArray(entry.value)
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
    baseCandidate.catalog.vendors?.length !== 375 ||
    baseCandidate.catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0) !== 616 ||
    baseCandidate.catalog.resources?.length !== 270 ||
    baseCandidate.catalog.resources.reduce((count, item) => count + item.targets.length, 0) !== 821 ||
    baseCandidate.catalog.resourceConnections?.length !== 10
  ) reject("base catalog v3 contract mismatch");

  validateCatalog(baseCandidate.catalog);
  assertNoSemanticDuplicates(baseCandidate.catalog.resources);
  assertNoHistoricalSemanticDuplicates(historyEntries);
  resources.forEach(assertNoForbiddenRuntimeFields);

  const catalog = structuredClone(baseCandidate.catalog);
  catalog.resources.push(...resources.map((item) => structuredClone(item)));
  validateCatalog(catalog);

  const summary = {
    vendors: catalog.vendors.length,
    products: catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0),
    resources: catalog.resources.length,
    targets: catalog.resources.reduce((count, item) => count + item.targets.length, 0),
    resourceConnections: catalog.resourceConnections.length,
    appendedResources: resources.length
  };
  assert.deepEqual(summary, {
    vendors: 375,
    products: 616,
    resources: 275,
    targets: 845,
    resourceConnections: 10,
    appendedResources: 5
  });

  const reversed = structuredClone(catalog);
  assert.deepEqual(reversed.resources.splice(-resources.length), resources);
  assert.deepEqual(reversed, baseCandidate.catalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: observedAt,
    title: "PagerDuty, LaunchDarkly, Snyk, Twilio, and Square MCP catalog v3 candidate",
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
      entry.name !== path.basename(inputs.baseCatalogV3.path)
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
    JSON.parse(rawInputs.baseCatalogV3.toString("utf8")),
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
