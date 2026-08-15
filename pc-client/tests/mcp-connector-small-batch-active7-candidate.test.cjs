"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.join(__dirname, "..");
const activePath = path.join(root, "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json");
const candidatePath = path.join(root, "docs/research/mcp-connector-small-batch-candidate-active7-2026-08-14.json");
const historicalPaths = [
  "docs/research/mcp-candidate-index-draft89-active6-2026-08-07.json",
  "docs/research/mcp-needs-review-batch-2026-08-05.json",
  "docs/connector-candidate-index-gap-report-2026-08-07.md"
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assertExactKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
}

function findForbiddenKeys(value, pathParts = []) {
  const forbidden = new Set([
    "endpoint", "command", "args", "env", "headers", "credentials", "token", "apikey",
    "install", "runtime", "script", "executable", "shell", "powershell", "cmd"
  ]);
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenKeys(item, [...pathParts, String(index)]));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const current = [...pathParts, key];
    return [
      ...(forbidden.has(key.toLowerCase()) ? [current.join(".")] : []),
      ...findForbiddenKeys(child, current)
    ];
  });
}

test("MCP and Connector small batch is exact, deduplicated, reversible, and link-only", () => {
  const active = readJson(activePath).payload.catalog;
  const candidate = readJson(candidatePath);
  const expectedIds = ["lovable-official-mcp", "lucid-claude-connector"];

  assert.deepEqual({
    schemaVersion: candidate.schemaVersion,
    candidateOnly: candidate.candidateOnly,
    publishable: candidate.publishable,
    activeReleaseId: candidate.source.activeReleaseId,
    activeCatalogSha256: candidate.source.activeCatalogSha256,
    readyCount: candidate.summary.readyCount,
    deferredCount: candidate.summary.deferredCount
  }, {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    activeReleaseId: "catalog-v00000007-8c49e1972186-0cec5335",
    activeCatalogSha256: "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4",
    readyCount: 2,
    deferredCount: 2
  });
  assert.deepEqual(candidate.ready.map((row) => row.resource.id), expectedIds);
  assert.equal(new Set(candidate.ready.map((row) => row.resource.id)).size, 2);

  assertExactKeys(candidate, ["schemaVersion", "candidateOnly", "publishable", "generatedAt", "source", "summary", "ready", "deferred", "safety"], "candidate schema");
  assertExactKeys(candidate.source, ["activeReleaseId", "activeCatalogPath", "activeCatalogSha256", "deduplicatedAgainst"], "source schema");
  assertExactKeys(candidate.summary, ["readyCount", "readyByChannel", "deferredCount"], "summary schema");
  assertExactKeys(candidate.summary.readyByChannel, ["mcp", "connector", "plugin"], "readyByChannel schema");
  assertExactKeys(candidate.safety, ["candidateOnly", "resourceLinkOnly", "credentialPolicy", "catalogWritten", "stateWritten", "signed", "published"], "safety schema");
  for (const [index, row] of candidate.ready.entries()) {
    assertExactKeys(row, ["channel", "credentialPolicy", "fixedRevision", "license", "resource"], `ready[${index}] schema`);
    assertExactKeys(row.resource, index === 0
      ? ["id", "enabled", "order", "name", "resourceTypes", "description", "website", "tutorial", "publisherVendorId", "publisher", "sourceKind", "reviewStatus", "riskLevel", "sourceProductIds", "targets", "versionRef", "requestedPermissions", "credentialRequirements", "installScope", "uninstallPlan", "provenanceEvidence", "lastVerifiedAt"]
      : ["id", "enabled", "order", "name", "resourceTypes", "description", "website", "tutorial", "publisher", "sourceKind", "reviewStatus", "riskLevel", "sourceProductIds", "targets", "versionRef", "requestedPermissions", "credentialRequirements", "installScope", "uninstallPlan", "provenanceEvidence", "lastVerifiedAt"],
    `ready[${index}].resource schema`);
    for (const [targetIndex, target] of row.resource.targets.entries()) {
      assertExactKeys(target, ["productId", "compatibility", "moduleId", "installProfileId", "capabilities", "enabled"], `ready[${index}].resource.targets[${targetIndex}] schema`);
    }
  }
  for (const [index, row] of candidate.deferred.entries()) {
    assertExactKeys(row, ["channel", "name", "reason"], `deferred[${index}] schema`);
  }
  assert.deepEqual(findForbiddenKeys(candidate), [], "recursive executable/credential fields");

  const activeIds = new Set(active.resources.map((resource) => resource.id));
  const compatibleHostIds = new Set(active.vendors.flatMap((vendor) => vendor.products.map((product) => product.id)));
  const historical = historicalPaths.map((relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8"));
  for (const row of candidate.ready) {
    assert.equal(activeIds.has(row.resource.id), false, row.resource.id);
    assert.equal(historical.some((text) => text.includes(`\"${row.resource.id}\"`)), false, row.resource.id);
  }

  assert.deepEqual(candidate.ready[0], {
    channel: "mcp",
    credentialPolicy: "never-collect",
    fixedRevision: "0336e6db8026b0f02cb89d1451cc48ea3f469791",
    license: "Apache-2.0",
    resource: {
      id: "lovable-official-mcp",
      enabled: true,
      order: 124,
      name: "Lovable MCP",
      resourceTypes: ["mcp"],
      description: "Lovable 官方远程 MCP，让受支持的 AI 客户端在用户授权后创建、检查、迭代和部署 Lovable 项目。",
      website: "https://docs.lovable.dev/integrations/lovable-mcp-server",
      tutorial: "https://github.com/lovablelabs/mcp/tree/0336e6db8026b0f02cb89d1451cc48ea3f469791",
      publisherVendorId: "lovable",
      publisher: "Lovable",
      sourceKind: "official",
      reviewStatus: "manually-reviewed",
      riskLevel: "guarded",
      sourceProductIds: [],
      targets: ["chatgpt-desktop", "claude-desktop", "claude-code", "cursor-desktop", "microsoft-vscode"].map((productId) => ({
        productId, compatibility: "official", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true
      })),
      versionRef: "server.json@0.1.3+0336e6db8026b0f02cb89d1451cc48ea3f469791",
      requestedPermissions: ["继承用户完整 Lovable 账号权限；创建、编辑、部署、数据库写入和消耗额度前必须由目标客户端提示并取得用户确认。"],
      credentialRequirements: ["仅由 Lovable 与目标客户端完成 OAuth；枕星 AI 不收集、保存或转发令牌。"],
      installScope: "仅打开固定版本的一方接入说明；不写入客户端配置，不发起 OAuth。",
      uninstallPlan: "由用户在目标客户端移除连接，并在 Lovable 的第三方 MCP 客户端设置中撤销访问。",
      provenanceEvidence: [
        "https://docs.lovable.dev/integrations/lovable-mcp-server",
        "https://github.com/lovablelabs/mcp/blob/0336e6db8026b0f02cb89d1451cc48ea3f469791/server.json",
        "https://github.com/lovablelabs/mcp/blob/0336e6db8026b0f02cb89d1451cc48ea3f469791/LICENSE"
      ],
      lastVerifiedAt: "2026-08-14T00:00:00.000Z"
    }
  });

  const connector = candidate.ready[1];
  assert.deepEqual({ channel: connector.channel, credentialPolicy: connector.credentialPolicy, fixedRevision: connector.fixedRevision, license: connector.license }, {
    channel: "connector", credentialPolicy: "never-collect", fixedRevision: null, license: "service-terms"
  });
  assert.deepEqual(connector.resource.resourceTypes, ["connector"]);
  assert.deepEqual(connector.resource.targets, [{
    productId: "claude-desktop", compatibility: "official", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true
  }]);
  assert.equal(connector.resource.uninstallPlan, "不声明断开或撤销能力；当前 Lucid 一手帮助页只证明用户授权连接，未提供可复核的用户侧断开或撤销步骤，等待补证。");

  for (const { resource, credentialPolicy } of candidate.ready) {
    assert.equal(credentialPolicy, "never-collect");
    assert.ok(resource.targets.every((target) => target.moduleId === "resource-link" && target.installProfileId === ""));
    assert.ok(resource.targets.every((target) => JSON.stringify(target.capabilities) === '["website"]'));
    assert.ok(resource.targets.every((target) => compatibleHostIds.has(target.productId)), `${resource.id} targets are CompatibleHost products`);
  }

  const projected = structuredClone(active);
  projected.resources.push(...candidate.ready.map((row) => row.resource));
  assert.doesNotThrow(() => validateCatalog(projected));
  projected.resources.splice(active.resources.length);
  assert.deepEqual(projected, active);
  assert.deepEqual(candidate.safety, {
    candidateOnly: true,
    resourceLinkOnly: true,
    credentialPolicy: "never-collect",
    catalogWritten: false,
    stateWritten: false,
    signed: false,
    published: false
  });
});
