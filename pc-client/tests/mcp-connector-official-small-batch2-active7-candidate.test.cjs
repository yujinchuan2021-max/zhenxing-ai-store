"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.join(__dirname, "..");
const activePath = path.join(root, "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json");
const candidatePath = path.join(root, "docs/research/mcp-connector-official-small-batch2-candidate-active7-2026-08-14.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function historicalJsonFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) historicalJsonFiles(filePath, output);
    else if (/\.json$/i.test(entry.name) && /(candidate|review|index)/i.test(entry.name) && filePath !== candidatePath) output.push(filePath);
  }
  return output;
}

function normalize(value) {
  return String(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function collectSemanticIdentities(value, output = { ids: new Set(), names: new Set(), canonicals: new Set() }) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSemanticIdentities(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const field of ["id", "resourceId", "candidateId"]) {
    if (value[field] !== undefined && value[field] !== null) output.ids.add(normalize(value[field]));
  }
  if (value.name !== undefined && value.name !== null) output.names.add(normalize(value.name));
  for (const field of ["canonicalKey", "externalId", "canonicalSource"]) {
    if (value[field] !== undefined && value[field] !== null) output.canonicals.add(normalize(value[field]));
  }
  Object.values(value).forEach((item) => collectSemanticIdentities(item, output));
  return output;
}

function findForbiddenKeys(value, pathParts = []) {
  const forbidden = new Set([
    "endpoint", "command", "args", "env", "headers", "credentials", "token", "apikey", "install",
    "runtime", "script", "executable", "shell", "powershell", "cmd"
  ]);
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, [...pathParts, String(index)]));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const current = [...pathParts, key];
    return [...(forbidden.has(key.toLowerCase()) ? [current.join(".")] : []), ...findForbiddenKeys(child, current)];
  });
}

test("official MCP small batch 2 is novel, exact, link-only, and reversible", () => {
  const active = readJson(activePath).payload.catalog;
  const candidate = readJson(candidatePath);
  const historyFiles = historicalJsonFiles(path.join(root, "docs"));
  const historyIdentities = collectSemanticIdentities(historyFiles.map(readJson));
  const activeIdentities = collectSemanticIdentities(active.resources);
  const compatibleHosts = new Set(active.vendors.flatMap((vendor) => vendor.products.map((product) => product.id)));

  assert.deepEqual(Object.keys(candidate), ["schemaVersion", "candidateOnly", "publishable", "freezeOnly", "generatedAt", "source", "summary", "ready", "deferred", "safety"]);
  assert.deepEqual(Object.keys(candidate.source), ["activeReleaseId", "activeCatalogPath", "activeCatalogSha256", "historicalSemanticScan"]);
  assert.deepEqual(candidate.summary, { ready: 1, mcp: 1, connector: 0, plugin: 0, deferred: 2 });
  assert.deepEqual([candidate.schemaVersion, candidate.candidateOnly, candidate.publishable, candidate.freezeOnly], [1, true, false, true]);
  assert.equal(candidate.source.activeReleaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  assert.equal(candidate.source.historicalSemanticScan, "docs/**/*.json with candidate, review, or index in basename");

  const row = candidate.ready[0];
  const resource = row.resource;
  assert.deepEqual(Object.keys(row), ["channel", "credentialPolicy", "fixedRevision", "license", "canonicalKey", "resource"]);
  assert.deepEqual([row.channel, row.credentialPolicy, row.fixedRevision, row.license], ["mcp", "no-auth", null, "service-terms"]);
  assert.deepEqual(Object.keys(resource), [
    "id", "enabled", "order", "name", "resourceTypes", "description", "website", "tutorial", "publisherVendorId", "publisher",
    "sourceKind", "reviewStatus", "riskLevel", "sourceProductIds", "targets", "versionRef", "requestedPermissions",
    "credentialRequirements", "installScope", "uninstallPlan", "provenanceEvidence", "lastVerifiedAt", "metadataSnapshot"
  ]);
  assert.deepEqual(Object.keys(resource.metadataSnapshot), ["sourcePlatform", "discoveredVia", "sourcePage", "canonicalSource", "originalAuthor", "licenseId", "sourceRevision", "provenanceStatus", "externalId", "observedAt", "licenseStatus"]);
  assert.equal(activeIdentities.ids.has(normalize(resource.id)), false);
  assert.equal(activeIdentities.names.has(normalize(resource.name)), false);
  assert.equal(activeIdentities.canonicals.has(normalize(row.canonicalKey)), false);
  assert.equal(historyIdentities.ids.has(normalize(resource.id)), false);
  assert.equal(historyIdentities.names.has(normalize(resource.name)), false);
  assert.equal(historyIdentities.canonicals.has(normalize(row.canonicalKey)), false);
  assert.equal(resource.metadataSnapshot.externalId, row.canonicalKey);
  assert.deepEqual(resource.resourceTypes, ["mcp"]);
  assert.deepEqual(resource.targets, [{
    productId: "microsoft-vscode", compatibility: "official", moduleId: "resource-link", installProfileId: "", capabilities: ["website"], enabled: true
  }]);
  assert.ok(resource.targets.every((target) => compatibleHosts.has(target.productId)));
  assert.deepEqual(findForbiddenKeys(candidate), []);

  const projected = structuredClone(active);
  projected.resources.push(resource);
  const validated = validateCatalog(projected);
  validated.resources = validated.resources.filter((item) => item.id !== resource.id);
  assert.deepEqual(validated, active);
  assert.deepEqual(candidate.safety, {
    candidateOnly: true, resourceLinkOnly: true, credentialPolicy: "no-auth", catalogWritten: false, stateWritten: false,
    channelWritten: false, signed: false, published: false, packaged: false
  });
});
