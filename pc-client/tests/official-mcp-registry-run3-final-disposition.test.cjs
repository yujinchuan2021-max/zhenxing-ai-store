"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildFinalDisposition, reconcile, resolveCanonicalDuplicate, contract } = require("../shared/official-mcp-registry-final-disposition.cjs");
const { run } = require("../scripts/generate-official-mcp-registry-run3-final-disposition.cjs");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, ...contract.OUTPUT_DIRECTORY.split("/"));

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function jsonBytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function inputs() {
  const files = { contract: fs.readFileSync(path.join(root, ...contract.CONTRACT.path.split("/"))) };
  for (const input of contract.INPUTS) files[input.key] = fs.readFileSync(path.join(root, ...input.path.split("/")));
  return files;
}
function ndjson(bytes) {
  const text = bytes.toString("utf8");
  assert.equal(text.endsWith("\n"), true);
  return text.slice(0, -1).split("\n").map(JSON.parse);
}

test("builds and freezes exactly one terminal row and evidence record for all 21,622 remaining identities", () => {
  const first = buildFinalDisposition(inputs());
  const firstHashes = Object.fromEntries(Object.entries(first.files).map(([name, bytes]) => [name, sha256(bytes)]));
  const second = buildFinalDisposition(inputs());
  assert.deepEqual(Object.fromEntries(Object.entries(second.files).map(([name, bytes]) => [name, sha256(bytes)])), firstHashes);
  assert.deepEqual(Object.keys(first.files).sort(), [...contract.ALL_FILES].sort());
  for (const name of contract.ALL_FILES) assert.deepEqual(fs.readFileSync(path.join(outputPath, name)), first.files[name], name);

  assert.deepEqual(first.summary.input, { registryRows: 21698, triageRows: 21698, triageUnreviewed: 21642, reviewedRows: 20, terminalRows: 21622 });
  assert.deepEqual(first.summary.terminalCounts, { "ready-link-only": 0, deferred: 21622, blocked: 0, duplicate: 0 });
  assert.deepEqual(first.summary.routeCounts, { lifecycle: 246, "metadata-drift": 332, "metadata-only-light": 1623, "manual-primary": 19421 });
  assert.equal(first.summary.candidateEligible, 0);
  assert.equal(first.summary.pending, 0);
  assert.equal(first.summary.networkRequests, 0);
  assert.equal(first.summary.maxBatchSize <= 10, true);
  assert.equal(first.batchPlan.items.every((batch) => batch.publicationKeys.length >= 1 && batch.publicationKeys.length <= 10), true);
  assert.equal(first.checkpoint.completedRows, 21622);
  assert.equal(first.checkpoint.completedBatchIndex, first.batchPlan.items.length - 1);
  let previousBatchSha256 = null;
  for (const batch of first.batchPlan.items) {
    assert.equal(batch.previousBatchSha256, previousBatchSha256);
    assert.equal(batch.batchSha256, sha256(jsonBytes({
      inputManifestSha256: first.batchPlan.inputManifestSha256,
      index: batch.index,
      route: batch.route,
      namespaceKey: batch.namespaceKey,
      repositoryStableKeySha256: batch.repositoryStableKeySha256,
      publicationKeys: batch.publicationKeys,
      previousBatchSha256
    })));
    assert.equal(batch.id, `sha256:${batch.batchSha256}`);
    previousBatchSha256 = batch.batchSha256;
  }
  assert.match(first.checkpoint.previousCheckpointSha256, /^[0-9a-f]{64}$/);

  const ledger = ndjson(first.files["completion-ledger.ndjson"]);
  const evidence = ndjson(first.files["evidence-manifest.ndjson"]);
  assert.equal(ledger.length, 21622);
  assert.equal(evidence.length, 21622);
  assert.equal(new Set(ledger.map((row) => row.publicationKey)).size, 21622);
  assert.deepEqual(ledger.map((row) => row.publicationKey), [...ledger.map((row) => row.publicationKey)].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))));
  assert.deepEqual(evidence.map((row) => row.publicationKey), ledger.map((row) => row.publicationKey));
  const ledgerKeys = ["schema", "stableServerKey", "publicationKey", "namespaceKey", "sourceSnapshotSha256", "status", "initialRoute", "disposition", "reasonCodes", "canonicalResourceId", "approvedRevision", "evidenceClosure", "factFingerprints", "compatibleHostIds", "publicEvidenceUrls", "evidenceManifestSha256", "evidenceObservedAt", "reviewBatchId", "candidateEligible", "recommendation"];
  const evidenceKeys = ["schema", "stableServerKey", "publicationKey", "inputManifestSha256", "sources", "factFingerprints", "reviewDocumentPath", "reviewDocumentSha256"];
  const reasons = ["DUPLICATE_EXACT", "DUPLICATE_LINEAGE", "LIFECYCLE_DEPRECATED", "LIFECYCLE_DELETED", "NORMALIZATION_WARNING", "METADATA_ONLY", "PUBLISHER_UNCLOSED", "REPOSITORY_UNCLOSED", "VERSION_UNCLOSED", "LICENSE_UNCLOSED", "AUTH_UNCLOSED", "REVOKE_UNCLOSED", "RETENTION_UNCLOSED", "HOST_UNCLOSED", "PERMISSIONS_UNCLOSED", "TOOLS_UNCLOSED", "ENDPOINT_DRIFT", "RISK_UNBOUNDED", "PRIMARY_SOURCE_UNAVAILABLE", "REVIEW_BUDGET_EXHAUSTED", "IMPERSONATION", "MALICIOUS_OR_ILLEGAL", "NON_FUNCTIONING", "POLICY_BLOCK", "READY_LINK_ONLY"];
  for (let index = 0; index < ledger.length; index += 1) {
    const row = ledger[index];
    const proof = evidence[index];
    assert.deepEqual(Object.keys(row), ledgerKeys);
    assert.deepEqual(Object.keys(proof), evidenceKeys);
    assert.equal(row.disposition, "deferred");
    assert.equal(row.candidateEligible, false);
    assert.equal(row.canonicalResourceId, null);
    assert.equal(row.approvedRevision, null);
    assert.equal(row.publicEvidenceUrls.length, 0);
    assert.deepEqual(proof.sources, [{
      kind: "registry",
      url: "https://registry.modelcontextprotocol.io/v0.1/servers",
      observedAt: "2026-08-14T23:19:47.334Z",
      revision: "rolling-latest@2026-08-14T23:19:47.334Z",
      contentSha256: "a0ac7fe2e126b7c65eb4b6ff700ea71a5fb95c17b2db57518d9fd1fb5606ba7a",
      claimIds: ["registry-identity", "registry-status", "registry-version"]
    }]);
    assert.equal(row.reasonCodes.length > 0, true);
    assert.deepEqual(row.reasonCodes, [...new Set(row.reasonCodes)].sort((left, right) => reasons.indexOf(left) - reasons.indexOf(right)));
    assert.equal(row.evidenceManifestSha256, sha256(Buffer.from(`${JSON.stringify(proof)}\n`)));
  }

  const inputManifest = JSON.parse(first.files["input-manifest.json"]);
  assert.equal(inputManifest.inputs.length, 12);
  assert.deepEqual(inputManifest.inputs, contract.INPUTS.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })));
  assert.equal(inputManifest.reviewedPublicationKeys.length, 20);
  assert.deepEqual(inputManifest.reviewedPublicationKeysManifest, { sha256: "39341c46fa4fc1064f726dbcbe322f478976c382e9bf743e101f858309da7d20", bytes: 523 });

  const manifest = first.files["MANIFEST.sha256"].toString("utf8").trimEnd().split("\n");
  assert.equal(manifest.length, 6);
  assert.deepEqual(manifest.map((line) => line.slice(66)), [
    "output/research/official-mcp-registry-run3-final-disposition/batch-plan.json",
    "output/research/official-mcp-registry-run3-final-disposition/checkpoint.json",
    "output/research/official-mcp-registry-run3-final-disposition/completion-ledger.ndjson",
    "output/research/official-mcp-registry-run3-final-disposition/evidence-manifest.ndjson",
    "output/research/official-mcp-registry-run3-final-disposition/input-manifest.json",
    "output/research/official-mcp-registry-run3-final-disposition/summary.json"
  ]);
  for (const line of manifest) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match);
    const name = path.posix.basename(match[2]);
    assert.equal(match[1], sha256(first.files[name]));
  }
  const terminalText = Buffer.concat([first.files["completion-ledger.ndjson"], first.files["evidence-manifest.ndjson"]]).toString("utf8");
  assert.doesNotMatch(terminalText.replaceAll("https://registry.modelcontextprotocol.io/v0.1/servers", ""), /https?:\/\//i);
  assert.doesNotMatch(terminalText, /\"(?:command|args|env|headers|credentials|token|secret|cookie|rawBody|rawHeaders)\"\s*:/i);
});

test("fails closed on frozen input drift and does not confuse a shared repository with identity lineage", () => {
  const drifted = inputs();
  drifted.candidate = Buffer.from(drifted.candidate);
  drifted.candidate[100] ^= 1;
  assert.throws(() => buildFinalDisposition(drifted), /Frozen input drift/);
  const result = buildFinalDisposition(inputs());
  assert.equal(result.summary.terminalCounts.duplicate, 0);
  const manual = result.ledgerRows.find((row) => row.initialRoute === "manual-primary" && row.factFingerprints.repository !== contract.ABSENT_SHA256);
  assert.ok(manual);
  assert.equal(manual.disposition, "deferred");
  assert.deepEqual(manual.publicEvidenceUrls, []);
  assert.equal(manual.reasonCodes.includes("PUBLISHER_UNCLOSED"), true);
  assert.equal(manual.reasonCodes.includes("RISK_UNBOUNDED"), true);

  const sharedRepositoryGroups = new Map();
  for (const row of result.ledgerRows.filter((value) => value.factFingerprints.repository !== contract.ABSENT_SHA256)) {
    const group = sharedRepositoryGroups.get(row.factFingerprints.repository) || [];
    group.push(row);
    sharedRepositoryGroups.set(row.factFingerprints.repository, group);
  }
  const shared = [...sharedRepositoryGroups.values()].find((group) => new Set(group.map((row) => row.stableServerKey)).size > 1);
  assert.ok(shared, "expected a shared-repository multi-server group");
  assert.equal(shared.every((row) => row.disposition === "deferred" && row.canonicalResourceId === null), true);
});

test("canonical duplicate resolution accepts only exact publication or stable-server lineage", () => {
  const resources = [{
    id: "canonical-one",
    name: "Shared Name",
    publisher: "Publisher",
    website: "https://github.com/example/monorepo",
    metadataSnapshot: {
      externalId: "official-mcp-registry:example/one@1.0.0",
      canonicalSource: "https://github.com/example/monorepo"
    }
  }];
  assert.deepEqual(resolveCanonicalDuplicate("example/one@1.0.0", resources), { kind: "exact", resourceId: "canonical-one" });
  assert.deepEqual(resolveCanonicalDuplicate("example/one@2.0.0", resources), { kind: "lineage", resourceId: "canonical-one" });
  assert.equal(resolveCanonicalDuplicate("example/two@1.0.0", [{
    ...resources[0],
    id: "unrelated",
    metadataSnapshot: { ...resources[0].metadataSnapshot, externalId: "not-registry-identity" }
  }]), null);
  assert.throws(() => resolveCanonicalDuplicate("example/one@1.0.0", [resources[0], { ...resources[0], id: "second-copy" }]), /identity collision/);
});

const FACT_FIELDS = ["version", "repository", "license", "publisher", "auth", "permissions", "tools", "hosts", "endpoint"];
const H = Object.fromEntries(FACT_FIELDS.map((field, index) => [field, sha256(`${field}-${index}`)]));
function record(stableServerKey, version, status = "active", changes = {}) {
  return { stableServerKey, publicationKey: `${stableServerKey}@${version}`, status, factFingerprints: { ...H, version: sha256(version), ...changes } };
}
function snapshot(records, seed) {
  return { schema: "official-mcp-registry-reconciliation-snapshot-v1", snapshotSha256: sha256(seed), snapshotIsolation: false, records };
}
function approved(resourceId, stableServerKey, version) {
  return {
    resourceId,
    stableServerKey,
    approvedRevision: {
      publicationKey: `${stableServerKey}@${version}`,
      publisherRevision: { kind: "commit", value: sha256(`${stableServerKey}-commit`) },
      evidenceManifestSha256: sha256(`${stableServerKey}-evidence`),
      reviewDocumentSha256: sha256(`${stableServerKey}-review`),
      candidateBaselineSha256: sha256("catalog-baseline")
    }
  };
}

test("reconcile is pure, pins approved revisions, and classifies every explicit lifecycle and fact drift", () => {
  const previous = snapshot([
    record("example/a", "1.0.0"), record("example/b", "1.0.0"), record("example/c", "1.0.0"),
    record("example/d", "1.0.0"), record("example/e", "1.0.0"), record("example/g", "1.0.0")
  ], "previous");
  const current = snapshot([
    record("example/a", "1.0.0"), record("example/b", "2.0.0"),
    record("example/c", "1.0.0", "active", { repository: sha256("new-repository") }),
    record("example/d", "1.0.0", "deprecated"), record("example/e", "1.0.0", "deleted"),
    record("example/g", "1.0.0", "active", { publisher: sha256("new-publisher"), auth: sha256("new-auth") }),
    record("example/f", "1.0.0")
  ], "current");
  const catalog = {
    schema: "official-mcp-registry-approved-catalog-v1",
    catalogSha256: sha256("approved-catalog"),
    resources: [approved("resource-b", "example/b", "1.0.0"), approved("resource-c", "example/c", "1.0.0"), approved("resource-d", "example/d", "1.0.0")]
  };
  const before = structuredClone({ previous, current, catalog });
  const result = reconcile(previous, current, catalog);
  assert.deepEqual({ previous, current, catalog }, before);
  assert.deepEqual(result.diff, { added: 1, changed: 3, deprecated: 1, deleted: 1, unchanged: 1 });
  assert.deepEqual(result.entries.map((entry) => [entry.stableServerKey, entry.changeKind, entry.changedFields, entry.priority, entry.action]), [
    ["example/c", "changed", ["repository"], "P0", "manual-review"],
    ["example/e", "deleted", ["status"], "P0", "stop-recommending"],
    ["example/b", "changed", ["version"], "P1", "manual-review"],
    ["example/d", "deprecated", ["status"], "P1", "stop-recommending"],
    ["example/f", "added", ["version", "repository", "license", "publisher", "auth", "permissions", "tools", "hosts", "endpoint", "status"], "P2", "manual-review"],
    ["example/g", "changed", ["publisher", "auth"], "P2", "manual-review"]
  ]);
  assert.equal(result.entries.find((entry) => entry.stableServerKey === "example/b").approvedResourceId, "resource-b");
  assert.match(result.entries.find((entry) => entry.stableServerKey === "example/b").approvedRevisionSha256, /^[0-9a-f]{64}$/);
});

test("reconcile rejects absence-as-delete, unknown fields, missing revisions, and identity drift", () => {
  const prior = snapshot([record("example/a", "1.0.0")], "prior");
  const empty = snapshot([], "empty");
  const catalog = { schema: "official-mcp-registry-approved-catalog-v1", catalogSha256: sha256("catalog"), resources: [] };
  assert.throws(() => reconcile(empty, empty, { ...catalog, resources: [approved("orphan", "example/orphan", "1.0.0")] }), /approved.*snapshot|orphan/i);
  assert.throws(() => reconcile(prior, empty, catalog), /absence is not deletion/);
  assert.throws(() => reconcile({ ...prior, extra: true }, prior, catalog), /keys drift/);
  assert.throws(() => reconcile(prior, { ...prior, records: [{ ...prior.records[0], extra: true }] }, catalog), /keys drift/);
  assert.throws(() => reconcile(prior, prior, { ...catalog, resources: [{ resourceId: "a", stableServerKey: "example/a", approvedRevision: null }] }), /revision binding drift/);
  const wrong = approved("a", "example/a", "9.9.9");
  wrong.approvedRevision.publicationKey = "other/server@9.9.9";
  assert.throws(() => reconcile(prior, prior, { ...catalog, resources: [wrong] }), /revision binding drift/);
});

test("approved repository, publisher, and endpoint drift are independently P0", () => {
  for (const field of ["repository", "publisher", "endpoint"]) {
    const previous = snapshot([record(`example/${field}`, "1.0.0")], `previous-${field}`);
    const current = snapshot([record(`example/${field}`, "1.0.0", "active", { [field]: sha256(`changed-${field}`) })], `current-${field}`);
    const catalog = {
      schema: "official-mcp-registry-approved-catalog-v1",
      catalogSha256: sha256(`catalog-${field}`),
      resources: [approved(`resource-${field}`, `example/${field}`, "1.0.0")]
    };
    const result = reconcile(previous, current, catalog);
    assert.equal(result.entries.length, 1);
    assert.deepEqual(result.entries[0].changedFields, [field]);
    assert.equal(result.entries[0].priority, "P0");
  }
});

test("completed rerun verifies bytes and preserves every output mtime", () => {
  const before = Object.fromEntries(contract.ALL_FILES.map((name) => [name, fs.statSync(path.join(outputPath, name)).mtimeMs]));
  const result = run();
  const after = Object.fromEntries(contract.ALL_FILES.map((name) => [name, fs.statSync(path.join(outputPath, name)).mtimeMs]));
  assert.equal(result.written, false);
  assert.deepEqual(after, before);
});
