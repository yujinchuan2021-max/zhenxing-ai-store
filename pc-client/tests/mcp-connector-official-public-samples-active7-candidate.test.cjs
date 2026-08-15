"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const activePath = path.join(root, "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json");
const researchPath = path.join(root, "docs/research/mcp-connector-official-public-samples-2026-08-14.md");
const candidatePath = path.join(root, "docs/research/mcp-connector-official-public-samples-candidate-active7-2026-08-14.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function findForbiddenKeys(value, parts = []) {
  const forbidden = new Set([
    "endpoint", "command", "args", "env", "headers", "credentials", "token", "apikey", "installprofile",
    "runtime", "script", "executable", "shell", "powershell", "cmd"
  ]);
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, [...parts, String(index)]));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const current = [...parts, key];
    return [...(forbidden.has(key.toLowerCase()) ? [current.join(".")] : []), ...findForbiddenKeys(child, current)];
  });
}

test("official public MCP samples classify all 15 exactly without promoting unsafe or duplicate resources", () => {
  const candidate = readJson(candidatePath);
  const active = readJson(activePath).payload.catalog;
  const expected = [
    ["official-registry:ac.inference.sh/mcp@2.0.1", "blocked"],
    ["official-registry:ac.tandem/docs-mcp@0.3.2", "blocked"],
    ["official-registry:ag.hood/name-service@0.1.0", "blocked"],
    ["official-registry:agency.goji/goji@1.0.1", "blocked"],
    ["official-registry:agency.kesey/pretrip@1.0.1", "blocked"],
    ["docker:SQLite@b4ee623039a6c60053ce67269701ad9e95073306", "rejected"],
    ["docker:airtable-mcp-server@2a5896d0891d13558e1313155b177fc0a4bc95d6", "blocked"],
    ["docker:ais-fleet", "deferred"],
    ["docker:aks@e60444c3d739dc3606d9ff4cd3826019e02df8d9", "blocked"],
    ["docker:alfresco@141731818b6b40aae4ccc7ca8fccaf0c5800769f", "blocked"],
    ["toolhive:io.github.stacklok/adb-mysql-mcp-server@1.0.0", "blocked"],
    ["toolhive:io.github.stacklok/agentql-mcp@1.0.0", "blocked"],
    ["toolhive:io.github.stacklok/apollo-mcp-server@1.0.0", "blocked"],
    ["toolhive:io.github.stacklok/astra-db-mcp@1.0.0", "blocked"],
    ["toolhive:io.github.stacklok/atlassian-remote@1.0.0", "duplicate"]
  ];

  assert.deepEqual(Object.keys(candidate), [
    "schemaVersion", "candidateOnly", "publishable", "freezeOnly", "generatedAt", "source", "summary",
    "proposedResources", "reviewLedger", "safety"
  ]);
  assert.deepEqual([candidate.schemaVersion, candidate.candidateOnly, candidate.publishable, candidate.freezeOnly], [1, true, false, true]);
  assert.deepEqual(candidate.source, {
    researchPath: "docs/research/mcp-connector-official-public-samples-2026-08-14.md",
    researchSha256: "c4a0d25287f6134407656b4cb64ecd2587b7f634af02a3c01a8cf2787d42fb1b",
    activeReleaseId: "catalog-v00000007-8c49e1972186-0cec5335",
    activeCatalogPath: "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json",
    activeCatalogSha256: "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4",
    historicalSemanticScan: "docs/**/*.json with candidate, review, or index in basename"
  });
  assert.equal(sha256(activePath), candidate.source.activeCatalogSha256);
  assert.equal(sha256(researchPath), candidate.source.researchSha256);
  assert.deepEqual(candidate.summary, {
    observed: 15, proposed: 0, duplicate: 1, deferred: 1, blocked: 12, rejected: 1,
    byChannel: { mcp: 15, connector: 0, plugin: 0 }
  });
  assert.deepEqual(candidate.proposedResources, []);
  assert.deepEqual(candidate.reviewLedger.map(({ canonicalKey, decision }) => [canonicalKey, decision]), expected);
  assert.equal(new Set(candidate.reviewLedger.map((row) => row.canonicalKey)).size, 15);

  for (const row of candidate.reviewLedger) {
    assert.deepEqual(Object.keys(row), [
      "source", "channel", "canonicalKey", "displayName", "publisherStatus", "sourceRef", "versionRef",
      "license", "auth", "sideEffects", "active7Match", "historicalMatches", "decision", "reason"
    ]);
    assert.equal(row.channel, "mcp");
    assert.ok(["first-party", "third-party", "unverified"].includes(row.publisherStatus));
    assert.ok(["duplicate", "deferred", "blocked", "rejected"].includes(row.decision));
    assert.ok(row.reason.length > 20);
  }

  const activeIds = new Set(active.resources.map((row) => row.id));
  assert.equal(activeIds.has("airtable-mcp-server"), true);
  assert.equal(activeIds.has("atlassian-rovo-mcp-server"), true);
  const airtable = candidate.reviewLedger.find((row) => row.canonicalKey.startsWith("docker:airtable"));
  const atlassian = candidate.reviewLedger.find((row) => row.canonicalKey.includes("atlassian-remote"));
  assert.equal(airtable.active7Match, "implementation-conflict:airtable-mcp-server");
  assert.equal(airtable.decision, "blocked");
  assert.equal(atlassian.active7Match, "duplicate:atlassian-rovo-mcp-server");
  assert.equal(atlassian.decision, "duplicate");

  assert.deepEqual(findForbiddenKeys(candidate), []);
  assert.deepEqual(candidate.safety, {
    candidateOnly: true, resourceLinkOnly: true, credentialPolicy: "never-collect", catalogWritten: false,
    stateWritten: false, channelWritten: false, signed: false, published: false, packaged: false
  });
});
