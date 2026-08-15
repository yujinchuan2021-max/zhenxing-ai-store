"use strict";

const crypto = require("node:crypto");

const CONTRACT = Object.freeze({
  path: "docs/research/official-mcp-registry-run3-full-review-completion-contract-2026-08-15.md",
  sha256: "51ed5a17b048a280c7da80002a46998d235367f1890d8c9e8a3af258960a6085",
  bytes: 39770
});

const INPUTS = Object.freeze([
  ["intakeCheckpoint", "output/research/official-mcp-registry-intake-2026-08-15-run3/checkpoint.json", "955910bb1b580e9cbe6b60487d2219b3ad08e7c962a09d1b17208b716255d634", 60760],
  ["registryIndex", "output/research/official-mcp-registry-intake-2026-08-15-run3/registry-index.ndjson", "a0ac7fe2e126b7c65eb4b6ff700ea71a5fb95c17b2db57518d9fd1fb5606ba7a", 20711984],
  ["intakeSummary", "output/research/official-mcp-registry-intake-2026-08-15-run3/summary.json", "f1891db11db3e4ef1afd139b776a9120bae6a359df751766c2f49e393b6eada0", 498],
  ["triageLedger", "output/research/official-mcp-registry-triage-2026-08-15-run3/ledger.ndjson", "e9c1ac9931bb97ca87826e726eaeaaa09a9705c1804982450c5cac125516757d", 5445085],
  ["namespaceClusters", "output/research/official-mcp-registry-triage-2026-08-15-run3/namespace-clusters.json", "ecd9cdc40858b429b2b90f7f8189b1f454549012fcbc51262b96d8f31f938466", 2225485],
  ["priorEvidence", "output/research/official-mcp-registry-triage-2026-08-15-run3/prior-evidence.json", "8f3bd80be42280f0110f194e2abc474a2f52c28d534ade8b6e9efe5a42b01a1b", 6360],
  ["triageSummary", "output/research/official-mcp-registry-triage-2026-08-15-run3/summary.json", "7f3360d0008137161fae4f0abce50c01dae96737fbc6f56c14b29060bcc188e3", 1729],
  ["triageHandoff", "docs/research/official-mcp-registry-run3-complete-triage-handoff-2026-08-15.md", "627dae3b82e749c451925a21bd9812055443de0814aa99ca98bae94f6a40cddc", 6749],
  ["firstReview", "docs/research/official-mcp-registry-run3-first10-primary-review-2026-08-15.md", "b46d323dcecd3e3814da3fa4726bc6c32e5ed4db201aa156c14f8caeeb4c7125", 24677],
  ["secondReview", "docs/research/official-mcp-registry-run3-next10-primary-review-2026-08-15.md", "c9cea0f78dc2c9d98c8487e4c91cd11743bbaaff507d58abd06b1a148676838a", 25862],
  ["candidate", "docs/research/auralogs-mcp-catalog-v3-candidate-2026-08-15.json", "dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8", 1790395],
  ["candidateHandoff", "docs/research/auralogs-mcp-catalog-v3-frozen-handoff-2026-08-15.md", "4c637ee4613357e48b5482febcee38e8c05b58c6bcf3b7ce635503449ab80049", 5476]
].map(([key, path, sha256, bytes]) => Object.freeze({ key, path, sha256, bytes })));

const OUTPUT_DIRECTORY = "output/research/official-mcp-registry-run3-final-disposition";
const DATA_FILES = Object.freeze([
  "input-manifest.json",
  "batch-plan.json",
  "completion-ledger.ndjson",
  "evidence-manifest.ndjson",
  "checkpoint.json",
  "summary.json"
]);
const ALL_FILES = Object.freeze([...DATA_FILES, "MANIFEST.sha256"]);
const FACT_FIELDS = Object.freeze(["version", "repository", "license", "publisher", "auth", "permissions", "tools", "hosts", "endpoint"]);
const CHANGED_FIELDS = Object.freeze([...FACT_FIELDS, "status"]);
const ROUTES = Object.freeze(["lifecycle", "metadata-drift", "metadata-only-light", "manual-primary"]);
const ABSENT_SHA256 = sha256("ABSENT");
const REVIEWED_KEYS_MANIFEST_SHA256 = "39341c46fa4fc1064f726dbcbe322f478976c382e9bf743e101f858309da7d20";
const REVIEWED_KEYS_MANIFEST_BYTES = 523;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function rawCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compactLine(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new TypeError(`${label} is not valid JSON: ${error.message}`);
  }
}

function parseNdjson(bytes, label) {
  const text = bytes.toString("utf8");
  if (!text.endsWith("\n") || text.charCodeAt(0) === 0xfeff || /\r/.test(text)) {
    throw new TypeError(`${label} canonical byte boundary drift`);
  }
  return text.slice(0, -1).split("\n").map((line, index) => {
    if (!line || /\s+$/.test(line)) throw new TypeError(`${label} line ${index + 1} drift`);
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new TypeError(`${label} line ${index + 1} is invalid JSON: ${error.message}`);
    }
  });
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    throw new TypeError(`${label} keys drift`);
  }
}

function assertHex(value, label) {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new TypeError(`${label} must be lowercase SHA-256`);
}

function readFrozen(files, descriptor) {
  const bytes = files[descriptor.key];
  if (!Buffer.isBuffer(bytes) || bytes.length !== descriptor.bytes || sha256(bytes) !== descriptor.sha256) {
    throw new Error(`Frozen input drift: ${descriptor.path}`);
  }
  return bytes;
}

function reviewedKeys(firstReview, secondReview) {
  const rowPattern = /^\|\s*\d+\s*\|\s*`([^`]+)`\s*\|/gm;
  const keys = [];
  for (const bytes of [firstReview, secondReview]) {
    const text = bytes.toString("utf8");
    let match;
    while ((match = rowPattern.exec(text))) keys.push(match[1]);
  }
  const unique = [...new Set(keys)].sort(rawCompare);
  const manifest = Buffer.from(unique.map((key) => `${key}\n`).join(""), "utf8");
  if (keys.length !== 20 || unique.length !== 20 || manifest.length !== REVIEWED_KEYS_MANIFEST_BYTES || sha256(manifest) !== REVIEWED_KEYS_MANIFEST_SHA256) {
    throw new Error("Frozen reviewed publication-key manifest drift");
  }
  return unique;
}

function namespaceOf(stableServerKey) {
  const slash = stableServerKey.indexOf("/");
  if (slash < 1 || slash !== stableServerKey.lastIndexOf("/") || slash === stableServerKey.length - 1) {
    throw new TypeError(`Invalid stable server key: ${stableServerKey}`);
  }
  return stableServerKey.slice(0, slash);
}

function publicationName(publicationKey) {
  const at = publicationKey.lastIndexOf("@");
  if (at < 3 || at === publicationKey.length - 1) throw new TypeError(`Invalid publication key: ${publicationKey}`);
  return publicationKey.slice(0, at);
}

function repositoryStableKey(repository) {
  if (!repository) return "";
  if (typeof repository !== "object" || Array.isArray(repository)) throw new TypeError("Repository shape drift");
  const source = typeof repository.source === "string" ? repository.source.toLowerCase() : "";
  const id = repository.id == null ? "" : String(repository.id);
  const subfolder = repository.subfolder == null ? "" : String(repository.subfolder).replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  let ownerRepo = "";
  if (typeof repository.url === "string") {
    try {
      const url = new URL(repository.url);
      if (url.protocol === "https:" && !url.username && !url.password) {
        const parts = url.pathname.replace(/\.git\/?$/i, "").split("/").filter(Boolean);
        ownerRepo = url.hostname.toLowerCase() === "github.com" && parts.length >= 2
          ? `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`
          : `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "").toLowerCase()}`;
      }
    } catch {
      ownerRepo = "";
    }
  }
  return `${source}|${id}|${ownerRepo}|${subfolder}`;
}

function resourceIdentityMap(resources, expectedCount = null) {
  if (!Array.isArray(resources) || (expectedCount !== null && resources.length !== expectedCount)) throw new TypeError("Candidate Resource boundary drift");
  const exact = new Map();
  const lineage = new Map();
  for (const resource of resources) {
    if (!resource || typeof resource.id !== "string") throw new TypeError("Candidate Resource identity drift");
    const externalId = resource.metadataSnapshot?.externalId;
    if (typeof externalId !== "string" || !externalId.startsWith("official-mcp-registry:")) continue;
    const publicationKey = externalId.slice("official-mcp-registry:".length);
    const stableServerKey = publicationName(publicationKey);
    if (exact.has(publicationKey) || lineage.has(stableServerKey)) throw new TypeError("Candidate Registry identity collision");
    exact.set(publicationKey, resource.id);
    lineage.set(stableServerKey, resource.id);
  }
  return { exact, lineage };
}

function candidateIdentityMap(candidate) {
  return resourceIdentityMap(candidate?.catalog?.resources, 280);
}

function resolveCanonicalDuplicate(publicationKey, resources) {
  const stableServerKey = publicationName(publicationKey);
  const identities = resourceIdentityMap(resources);
  const exact = identities.exact.get(publicationKey);
  if (exact) return { kind: "exact", resourceId: exact };
  const lineage = identities.lineage.get(stableServerKey);
  return lineage ? { kind: "lineage", resourceId: lineage } : null;
}

function routeFor(index, triage) {
  if (index.status === "deprecated") return "lifecycle";
  if (index.status !== "active") throw new TypeError(`Unsupported Registry lifecycle: ${index.status}`);
  if (triage.warningCount > 0) return "metadata-drift";
  if (triage.evidenceLane === "package-only" || triage.evidenceLane === "insufficient-evidence") return "metadata-only-light";
  if (triage.evidenceLane === "repository" || triage.evidenceLane === "website") return "manual-primary";
  throw new TypeError(`Unreviewed row has unsupported evidence lane: ${triage.evidenceLane}`);
}

function inputManifest(files, reviewedPublicationKeys) {
  const contractBytes = files.contract;
  if (!Buffer.isBuffer(contractBytes) || contractBytes.length !== CONTRACT.bytes || sha256(contractBytes) !== CONTRACT.sha256) {
    throw new Error("Frozen completion contract drift");
  }
  return {
    schema: "official-mcp-registry-run3-final-input-manifest-v1",
    candidateOnly: true,
    publishable: false,
    snapshotIsolation: false,
    contract: { path: CONTRACT.path, sha256: CONTRACT.sha256, bytes: CONTRACT.bytes },
    inputs: INPUTS.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })),
    reviewedPublicationKeys,
    reviewedPublicationKeysManifest: { sha256: REVIEWED_KEYS_MANIFEST_SHA256, bytes: REVIEWED_KEYS_MANIFEST_BYTES },
    expected: { registryRows: 21698, triageRows: 21698, triageUnreviewed: 21642, reviewedRows: 20, terminalRows: 21622 }
  };
}

function sourceSnapshotSha(files) {
  return sha256(jsonBytes({
    checkpointSha256: INPUTS[0].sha256,
    registryIndexSha256: INPUTS[1].sha256,
    intakeSummarySha256: INPUTS[2].sha256,
    snapshotIsolation: false,
    records: 21698
  }));
}

function validateFrozenControls(files, indexRows, triageRows) {
  const intakeCheckpoint = parseJson(files.intakeCheckpoint, "Intake checkpoint");
  const intakeSummary = parseJson(files.intakeSummary, "Intake summary");
  const triageSummary = parseJson(files.triageSummary, "Triage summary");
  const clusters = parseJson(files.namespaceClusters, "Namespace clusters");
  const priorEvidence = parseJson(files.priorEvidence, "Prior evidence");
  if (intakeCheckpoint.completed !== true || intakeCheckpoint.exhausted !== true || intakeCheckpoint.records !== 21698
    || intakeCheckpoint.index?.sha256 !== INPUTS[1].sha256 || intakeCheckpoint.summary?.sha256 !== INPUTS[2].sha256) {
    throw new Error("Intake checkpoint lineage drift");
  }
  if (intakeSummary.records !== 21698 || intakeSummary.uniqueNames !== 21698 || intakeSummary.snapshotIsolation !== false
    || intakeSummary.byStatus?.active !== 21451 || intakeSummary.byStatus?.deprecated !== 247 || intakeSummary.byStatus?.deleted !== 0) {
    throw new Error("Intake summary arithmetic drift");
  }
  if (triageSummary.records !== 21698 || triageSummary.uniqueNamespaces !== 13911
    || triageSummary.countsByDisposition?.unreviewed !== 21642 || triageSummary.recordsWithWarnings !== 334) {
    throw new Error("Triage summary arithmetic drift");
  }
  if (!Array.isArray(priorEvidence) || priorEvidence.length !== 15 || new Set(priorEvidence.map((entry) => entry.path)).size !== 15
    || priorEvidence.some((entry) => !/^[0-9a-f]{64}$/.test(entry.sha256) || !Array.isArray(entry.registryIds))) {
    throw new Error("Prior-evidence manifest drift");
  }
  if (!Array.isArray(clusters) || clusters.length !== 13911) throw new Error("Namespace cluster count drift");
  const derived = new Map();
  const triageById = new Map(triageRows.map((row) => [row.registryId, row]));
  for (const registry of indexRows) {
    const triage = triageById.get(registry.registryId);
    const namespace = namespaceOf(registry.name);
    const value = derived.get(namespace) || { namespace, records: 0, catalogResolved: 0, sourceSignals: 0, priorObserved: 0, unreviewed: 0 };
    value.records += 1;
    value.catalogResolved += Number(triage.catalogResolved);
    value.sourceSignals += Number(triage.disposition === "catalog-source-signal");
    value.priorObserved += Number(triage.disposition === "prior-research-observed");
    value.unreviewed += Number(triage.disposition === "unreviewed");
    derived.set(namespace, value);
  }
  const clusterMap = new Map();
  for (const cluster of clusters) {
    exactKeys(cluster, ["namespace", "records", "catalogResolved", "sourceSignals", "priorObserved", "unreviewed"], "Namespace cluster");
    if (clusterMap.has(cluster.namespace)) throw new TypeError("Namespace cluster duplicate");
    clusterMap.set(cluster.namespace, cluster);
  }
  for (const [namespace, expected] of derived) {
    if (JSON.stringify(clusterMap.get(namespace)) !== JSON.stringify(expected)) throw new Error(`Namespace cluster join drift: ${namespace}`);
  }
}

function buildRows(files, inputManifestSha256, reviewedPublicationKeys) {
  const indexRows = parseNdjson(files.registryIndex, "Registry index");
  const triageRows = parseNdjson(files.triageLedger, "Triage ledger");
  if (indexRows.length !== 21698 || triageRows.length !== 21698) throw new Error("Run3 row arithmetic drift");
  const indexById = new Map();
  for (const row of indexRows) {
    if (!row || row.registryId !== `${row.name}@${row.version}` || indexById.has(row.registryId)) throw new TypeError("Registry index identity drift");
    indexById.set(row.registryId, row);
  }
  const triageById = new Map();
  for (const row of triageRows) {
    if (!row || !indexById.has(row.registryId) || triageById.has(row.registryId)) throw new TypeError("Triage join drift");
    triageById.set(row.registryId, row);
  }
  if (triageById.size !== indexById.size) throw new TypeError("Index/triage join is not one-to-one");
  validateFrozenControls(files, indexRows, triageRows);
  const reviewed = new Set(reviewedPublicationKeys);
  for (const key of reviewed) {
    if (!indexById.has(key) || triageById.get(key).disposition !== "unreviewed") throw new TypeError(`Reviewed publication drift: ${key}`);
  }
  const unreviewed = triageRows.filter((row) => row.disposition === "unreviewed");
  if (unreviewed.length !== 21642) throw new Error("Triage unreviewed arithmetic drift");
  const candidate = parseJson(files.candidate, "Candidate");
  const canonical = candidateIdentityMap(candidate);
  const snapshotSha256 = sourceSnapshotSha(files);
  const rows = [];
  for (const triage of unreviewed) {
    if (reviewed.has(triage.registryId)) continue;
    const index = indexById.get(triage.registryId);
    const stableServerKey = index.name;
    const namespaceKey = namespaceOf(stableServerKey);
    const initialRoute = routeFor(index, triage);
    const exactResourceId = canonical.exact.get(index.registryId) || null;
    const lineageResourceId = exactResourceId ? null : canonical.lineage.get(stableServerKey) || null;
    const duplicateResourceId = exactResourceId || lineageResourceId;
    const factFingerprints = {
      version: sha256(index.version),
      repository: index.repository ? sha256(jsonBytes({ stableKey: repositoryStableKey(index.repository) })) : ABSENT_SHA256,
      license: ABSENT_SHA256,
      publisher: ABSENT_SHA256,
      auth: ABSENT_SHA256,
      permissions: ABSENT_SHA256,
      tools: ABSENT_SHA256,
      hosts: ABSENT_SHA256,
      endpoint: ABSENT_SHA256
    };
    let reasonCodes;
    if (duplicateResourceId) reasonCodes = [exactResourceId ? "DUPLICATE_EXACT" : "DUPLICATE_LINEAGE"];
    else if (initialRoute === "lifecycle") reasonCodes = [index.status === "deleted" ? "LIFECYCLE_DELETED" : "LIFECYCLE_DEPRECATED"];
    else if (initialRoute === "metadata-drift") reasonCodes = ["NORMALIZATION_WARNING"];
    else if (initialRoute === "metadata-only-light") reasonCodes = ["METADATA_ONLY"];
    else reasonCodes = [
      "PUBLISHER_UNCLOSED", "REPOSITORY_UNCLOSED", "VERSION_UNCLOSED", "LICENSE_UNCLOSED", "AUTH_UNCLOSED",
      "REVOKE_UNCLOSED", "RETENTION_UNCLOSED", "HOST_UNCLOSED", "PERMISSIONS_UNCLOSED", "TOOLS_UNCLOSED", "RISK_UNBOUNDED"
    ];
    rows.push({
      index,
      triage,
      stableServerKey,
      publicationKey: index.registryId,
      namespaceKey,
      repositoryStableKey: repositoryStableKey(index.repository),
      sourceSnapshotSha256: snapshotSha256,
      initialRoute,
      disposition: duplicateResourceId ? "duplicate" : "deferred",
      reasonCodes,
      canonicalResourceId: duplicateResourceId,
      factFingerprints
    });
  }
  if (rows.length !== 21622 || new Set(rows.map((row) => row.publicationKey)).size !== 21622) throw new Error("Terminal remainder arithmetic drift");
  const routeCounts = Object.fromEntries(ROUTES.map((route) => [route, rows.filter((row) => row.initialRoute === route).length]));
  if (JSON.stringify(routeCounts) !== JSON.stringify({ lifecycle: 246, "metadata-drift": 332, "metadata-only-light": 1623, "manual-primary": 19421 })) {
    throw new Error("Frozen route partition drift");
  }
  return rows;
}

function makeBatchPlan(rows, inputManifestSha256) {
  const ordered = [...rows].sort((left, right) =>
    ROUTES.indexOf(left.initialRoute) - ROUTES.indexOf(right.initialRoute)
    || rawCompare(left.namespaceKey, right.namespaceKey)
    || rawCompare(left.repositoryStableKey, right.repositoryStableKey)
    || rawCompare(left.stableServerKey, right.stableServerKey)
    || rawCompare(left.publicationKey, right.publicationKey)
  );
  const batches = [];
  let previousBatchSha256 = null;
  for (let start = 0; start < ordered.length;) {
    const first = ordered[start];
    let end = start;
    while (end < ordered.length && end - start < 10) {
      const row = ordered[end];
      if (row.initialRoute !== first.initialRoute || row.namespaceKey !== first.namespaceKey || row.repositoryStableKey !== first.repositoryStableKey) break;
      end += 1;
    }
    const publicationKeys = ordered.slice(start, end).map((row) => row.publicationKey);
    const batchIdentity = {
      inputManifestSha256,
      index: batches.length,
      route: first.initialRoute,
      namespaceKey: first.namespaceKey,
      repositoryStableKeySha256: sha256(first.repositoryStableKey || "ABSENT"),
      publicationKeys,
      previousBatchSha256
    };
    const batchSha256 = sha256(jsonBytes(batchIdentity));
    const id = `sha256:${batchSha256}`;
    batches.push({
      index: batches.length,
      id,
      route: first.initialRoute,
      namespaceKey: first.namespaceKey,
      repositoryStableKeySha256: batchIdentity.repositoryStableKeySha256,
      publicationKeys,
      previousBatchSha256,
      batchSha256
    });
    for (const row of ordered.slice(start, end)) row.reviewBatchId = id;
    previousBatchSha256 = batchSha256;
    start = end;
  }
  if (batches.some((batch) => batch.publicationKeys.length < 1 || batch.publicationKeys.length > 10)) throw new Error("Batch size drift");
  return {
    schema: "official-mcp-registry-run3-completion-batch-plan-v1",
    inputManifestSha256,
    rows: rows.length,
    batchSizeLimit: 10,
    batches: batches.length,
    routeOrder: [...ROUTES],
    items: batches
  };
}

function evidenceFor(row, inputManifestSha256, observedAt) {
  return {
    schema: "official-mcp-registry-primary-evidence-v1",
    stableServerKey: row.stableServerKey,
    publicationKey: row.publicationKey,
    inputManifestSha256,
    sources: [{
      kind: "registry",
      url: "https://registry.modelcontextprotocol.io/v0.1/servers",
      observedAt,
      revision: `rolling-latest@${observedAt}`,
      contentSha256: INPUTS[1].sha256,
      claimIds: ["registry-identity", "registry-status", "registry-version"]
    }],
    factFingerprints: row.factFingerprints,
    reviewDocumentPath: CONTRACT.path,
    reviewDocumentSha256: CONTRACT.sha256
  };
}

function ledgerFor(row, evidenceSha256, observedAt) {
  const duplicate = row.disposition === "duplicate";
  return {
    schema: "official-mcp-registry-run3-final-disposition-v1",
    stableServerKey: row.stableServerKey,
    publicationKey: row.publicationKey,
    namespaceKey: row.namespaceKey,
    sourceSnapshotSha256: row.sourceSnapshotSha256,
    status: row.index.status,
    initialRoute: row.initialRoute,
    disposition: row.disposition,
    reasonCodes: row.reasonCodes,
    canonicalResourceId: row.canonicalResourceId,
    approvedRevision: null,
    evidenceClosure: {
      publisher: "gap",
      repository: "gap",
      version: duplicate ? "closed" : "gap",
      license: "gap",
      auth: "gap",
      revoke: "gap",
      retention: "gap",
      hosts: "gap",
      permissions: "gap",
      tools: "gap",
      endpoint: row.index.hasRemotes ? "gap" : "not-applicable",
      risk: "unknown"
    },
    factFingerprints: row.factFingerprints,
    compatibleHostIds: [],
    publicEvidenceUrls: [],
    evidenceManifestSha256: evidenceSha256,
    evidenceObservedAt: observedAt,
    reviewBatchId: row.reviewBatchId,
    candidateEligible: false,
    recommendation: duplicate ? "canonical-only" : row.index.status === "active" ? "do-not-recommend" : "stop-recommending"
  };
}

function makeCheckpoint(inputManifestSha256, batchPlanSha256, batches, ledgerRows, evidenceRows) {
  let previousCheckpointSha256 = null;
  let finalCheckpoint;
  const ledgerByKey = new Map(ledgerRows.map((row) => [row.publicationKey, row]));
  const evidenceByKey = new Map(evidenceRows.map((row) => [row.publicationKey, row]));
  const rollingLedger = crypto.createHash("sha256");
  const rollingEvidence = crypto.createHash("sha256");
  const counts = { "ready-link-only": 0, deferred: 0, blocked: 0, duplicate: 0 };
  let completedRows = 0;
  for (const batch of batches) {
    for (const key of batch.publicationKeys) {
      const ledger = ledgerByKey.get(key);
      rollingLedger.update(compactLine(ledger));
      rollingEvidence.update(compactLine(evidenceByKey.get(key)));
      counts[ledger.disposition] += 1;
      completedRows += 1;
    }
    const isFinal = batch.index === batches.length - 1;
    const ledgerSha256 = isFinal
      ? sha256(Buffer.concat(ledgerRows.map(compactLine)))
      : rollingLedger.copy().digest("hex");
    const evidenceManifestSha256 = isFinal
      ? sha256(Buffer.concat(evidenceRows.map(compactLine)))
      : rollingEvidence.copy().digest("hex");
    finalCheckpoint = {
      schema: "official-mcp-registry-run3-completion-checkpoint-v1",
      inputManifestSha256,
      batchPlanSha256,
      completedBatchIndex: batch.index,
      completedRows,
      counts: { ...counts },
      lastPublicationKey: isFinal ? ledgerRows.at(-1).publicationKey : batch.publicationKeys.at(-1),
      ledgerSha256,
      evidenceManifestSha256,
      previousCheckpointSha256,
      stopReason: null
    };
    previousCheckpointSha256 = sha256(jsonBytes(finalCheckpoint));
  }
  return finalCheckpoint;
}

function assertSafeTerminalBytes(bytes, label) {
  const text = bytes.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff || /\r/.test(text) || !text.endsWith("\n") || /[ \t]+$/m.test(text)) throw new Error(`${label} canonical bytes drift`);
  const withoutRegistrySource = text.replaceAll("https://registry.modelcontextprotocol.io/v0.1/servers", "");
  const prohibited = /(?:\"(?:command|args|env|headers|credentials|token|secret|cookie|rawBody|rawHeaders)\"\s*:)|(?:https?:\/\/[^\"\s]+)/i;
  if (prohibited.test(withoutRegistrySource)) throw new Error(`${label} contains prohibited execution, credential, raw, or URL data`);
}

function buildFinalDisposition(files) {
  exactKeys(files, ["contract", ...INPUTS.map(({ key }) => key)], "Frozen input set");
  for (const descriptor of INPUTS) readFrozen(files, descriptor);
  const reviewedPublicationKeys = reviewedKeys(files.firstReview, files.secondReview);
  const manifestObject = inputManifest(files, reviewedPublicationKeys);
  const inputManifestBytes = jsonBytes(manifestObject);
  const inputManifestSha256 = sha256(inputManifestBytes);
  const rows = buildRows(files, inputManifestSha256, reviewedPublicationKeys);
  const batchPlan = makeBatchPlan(rows, inputManifestSha256);
  const batchPlanBytes = jsonBytes(batchPlan);
  const batchPlanSha256 = sha256(batchPlanBytes);
  const observedAt = parseJson(files.intakeSummary, "Intake summary").observedAt;
  if (observedAt !== "2026-08-14T23:19:47.334Z") throw new Error("Frozen observation timestamp drift");
  const orderedRows = [...rows].sort((left, right) => rawCompare(left.publicationKey, right.publicationKey));
  const evidenceRows = orderedRows.map((row) => evidenceFor(row, inputManifestSha256, observedAt));
  const evidenceBytes = Buffer.concat(evidenceRows.map(compactLine));
  const ledgerRows = orderedRows.map((row, index) => ledgerFor(row, sha256(compactLine(evidenceRows[index])), observedAt));
  const ledgerBytes = Buffer.concat(ledgerRows.map(compactLine));
  const checkpoint = makeCheckpoint(inputManifestSha256, batchPlanSha256, batchPlan.items, ledgerRows, evidenceRows);
  const checkpointBytes = jsonBytes(checkpoint);
  const terminalCounts = {
    "ready-link-only": ledgerRows.filter((row) => row.disposition === "ready-link-only").length,
    deferred: ledgerRows.filter((row) => row.disposition === "deferred").length,
    blocked: ledgerRows.filter((row) => row.disposition === "blocked").length,
    duplicate: ledgerRows.filter((row) => row.disposition === "duplicate").length
  };
  const routeCounts = Object.fromEntries(ROUTES.map((route) => [route, ledgerRows.filter((row) => row.initialRoute === route).length]));
  const outputMetrics = {
    "input-manifest.json": { bytes: inputManifestBytes.length, lines: inputManifestBytes.toString("utf8").split("\n").length - 1, sha256: inputManifestSha256 },
    "batch-plan.json": { bytes: batchPlanBytes.length, lines: batchPlanBytes.toString("utf8").split("\n").length - 1, sha256: batchPlanSha256 },
    "completion-ledger.ndjson": { bytes: ledgerBytes.length, lines: ledgerRows.length, sha256: sha256(ledgerBytes) },
    "evidence-manifest.ndjson": { bytes: evidenceBytes.length, lines: evidenceRows.length, sha256: sha256(evidenceBytes) },
    "checkpoint.json": { bytes: checkpointBytes.length, lines: checkpointBytes.toString("utf8").split("\n").length - 1, sha256: sha256(checkpointBytes) }
  };
  const summary = {
    schema: "official-mcp-registry-run3-final-disposition-summary-v1",
    completed: true,
    candidateOnly: true,
    publishable: false,
    snapshotIsolation: false,
    input: { registryRows: 21698, triageRows: 21698, triageUnreviewed: 21642, reviewedRows: 20, terminalRows: 21622 },
    terminalCounts,
    routeCounts,
    diffCounts: { added: 0, changed: 0, deprecated: 0, deleted: 0, unchanged: 0 },
    candidateEligible: terminalCounts["ready-link-only"],
    networkRequests: 0,
    networkStops: 0,
    pending: 0,
    batches: batchPlan.batches,
    maxBatchSize: Math.max(...batchPlan.items.map((batch) => batch.publicationKeys.length)),
    outputs: outputMetrics
  };
  const summaryBytes = jsonBytes(summary);
  const data = {
    "input-manifest.json": inputManifestBytes,
    "batch-plan.json": batchPlanBytes,
    "completion-ledger.ndjson": ledgerBytes,
    "evidence-manifest.ndjson": evidenceBytes,
    "checkpoint.json": checkpointBytes,
    "summary.json": summaryBytes
  };
  for (const [name, bytes] of Object.entries(data)) assertSafeTerminalBytes(bytes, name);
  const manifestBytes = Buffer.from([...DATA_FILES]
    .sort((left, right) => rawCompare(`${OUTPUT_DIRECTORY}/${left}`, `${OUTPUT_DIRECTORY}/${right}`))
    .map((name) => `${sha256(data[name])}  ${OUTPUT_DIRECTORY}/${name}\n`)
    .join(""), "utf8");
  data["MANIFEST.sha256"] = manifestBytes;
  if (checkpoint.completedRows !== 21622 || Object.values(terminalCounts).reduce((sum, count) => sum + count, 0) !== 21622 || summary.pending !== 0) {
    throw new Error("Final completion arithmetic drift");
  }
  return { files: data, summary, ledgerRows, evidenceRows, batchPlan, checkpoint };
}

const SNAPSHOT_KEYS = ["schema", "snapshotSha256", "snapshotIsolation", "records"];
const RECORD_KEYS = ["stableServerKey", "publicationKey", "status", "factFingerprints"];
const CATALOG_KEYS = ["schema", "catalogSha256", "resources"];
const RESOURCE_KEYS = ["resourceId", "stableServerKey", "approvedRevision"];

function validateSnapshot(snapshot, label) {
  exactKeys(snapshot, SNAPSHOT_KEYS, label);
  if (snapshot.schema !== "official-mcp-registry-reconciliation-snapshot-v1" || snapshot.snapshotIsolation !== false || !Array.isArray(snapshot.records)) throw new TypeError(`${label} schema drift`);
  assertHex(snapshot.snapshotSha256, `${label}.snapshotSha256`);
  const map = new Map();
  for (const record of snapshot.records) {
    exactKeys(record, RECORD_KEYS, `${label} record`);
    namespaceOf(record.stableServerKey);
    if (publicationName(record.publicationKey) !== record.stableServerKey || !["active", "deprecated", "deleted"].includes(record.status) || map.has(record.stableServerKey)) throw new TypeError(`${label} record identity drift`);
    exactKeys(record.factFingerprints, FACT_FIELDS, `${label} factFingerprints`);
    for (const field of FACT_FIELDS) assertHex(record.factFingerprints[field], `${label}.${field}`);
    map.set(record.stableServerKey, record);
  }
  return map;
}

function approvedRevisionSha(revision) {
  if (revision == null) return null;
  exactKeys(revision, ["publicationKey", "publisherRevision", "evidenceManifestSha256", "reviewDocumentSha256", "candidateBaselineSha256"], "approvedRevision");
  exactKeys(revision.publisherRevision, ["kind", "value"], "publisherRevision");
  if (!["commit", "tag", "package-release", "hosted-observation"].includes(revision.publisherRevision.kind) || typeof revision.publisherRevision.value !== "string" || !revision.publisherRevision.value) throw new TypeError("approvedRevision publisher revision drift");
  for (const field of ["evidenceManifestSha256", "reviewDocumentSha256", "candidateBaselineSha256"]) assertHex(revision[field], `approvedRevision.${field}`);
  return sha256(jsonBytes(revision));
}

function validateApprovedCatalog(catalog) {
  exactKeys(catalog, CATALOG_KEYS, "approvedCatalog");
  if (catalog.schema !== "official-mcp-registry-approved-catalog-v1" || !Array.isArray(catalog.resources)) throw new TypeError("approvedCatalog schema drift");
  assertHex(catalog.catalogSha256, "approvedCatalog.catalogSha256");
  const map = new Map();
  const ids = new Set();
  for (const resource of catalog.resources) {
    exactKeys(resource, RESOURCE_KEYS, "approved resource");
    if (typeof resource.resourceId !== "string" || !resource.resourceId || ids.has(resource.resourceId) || map.has(resource.stableServerKey)) throw new TypeError("approved resource identity drift");
    namespaceOf(resource.stableServerKey);
    const revisionSha256 = approvedRevisionSha(resource.approvedRevision);
    if (!revisionSha256 || publicationName(resource.approvedRevision.publicationKey) !== resource.stableServerKey) {
      throw new TypeError("approved resource revision binding drift");
    }
    ids.add(resource.resourceId);
    map.set(resource.stableServerKey, { ...resource, approvedRevisionSha256: revisionSha256 });
  }
  return map;
}

function changedFields(previous, current, added) {
  const fields = [];
  for (const field of FACT_FIELDS) {
    if (added ? current.factFingerprints[field] !== ABSENT_SHA256 : previous.factFingerprints[field] !== current.factFingerprints[field]) fields.push(field);
  }
  if (added || previous.status !== current.status) fields.push("status");
  return fields;
}

function reconcile(previousSnapshot, currentSnapshot, approvedCatalog) {
  const before = JSON.stringify([previousSnapshot, currentSnapshot, approvedCatalog]);
  const previous = validateSnapshot(previousSnapshot, "previousSnapshot");
  const current = validateSnapshot(currentSnapshot, "currentSnapshot");
  const approved = validateApprovedCatalog(approvedCatalog);
  for (const stableServerKey of approved.keys()) {
    if (!previous.has(stableServerKey) && !current.has(stableServerKey)) {
      throw new Error(`Approved Resource is absent from both snapshots: ${stableServerKey}`);
    }
  }
  const diff = { added: 0, changed: 0, deprecated: 0, deleted: 0, unchanged: 0 };
  const entries = [];
  for (const stableServerKey of [...new Set([...previous.keys(), ...current.keys()])].sort(rawCompare)) {
    const prior = previous.get(stableServerKey) || null;
    const next = current.get(stableServerKey) || null;
    if (!next) throw new Error(`Rolling snapshot absence is not deletion: ${stableServerKey}`);
    const binding = approved.get(stableServerKey) || null;
    if (binding && !binding.approvedRevisionSha256) throw new Error(`Approved revision missing: ${stableServerKey}`);
    const fields = changedFields(prior, next, !prior);
    let changeKind;
    if (next.status === "deleted") changeKind = "deleted";
    else if (next.status === "deprecated") changeKind = "deprecated";
    else if (!prior) changeKind = "added";
    else if (prior.publicationKey !== next.publicationKey || fields.length) changeKind = "changed";
    else changeKind = "unchanged";
    diff[changeKind] += 1;
    if (changeKind === "unchanged") continue;
    if (prior && prior.publicationKey !== next.publicationKey && !fields.includes("version")) {
      fields.unshift("version");
    }
    const orderedFields = CHANGED_FIELDS.filter((field) => fields.includes(field));
    let priority = "P2";
    let action = "manual-review";
    if (changeKind === "deleted") {
      priority = "P0";
      action = "stop-recommending";
    } else if (changeKind === "deprecated") {
      priority = binding ? "P1" : "P2";
      action = "stop-recommending";
    } else if (binding && orderedFields.some((field) => ["repository", "publisher", "endpoint"].includes(field))) {
      priority = "P0";
    } else if (binding) {
      priority = "P1";
    }
    entries.push({
      stableServerKey,
      previousPublicationKey: prior?.publicationKey || null,
      currentPublicationKey: next.publicationKey,
      changeKind,
      changedFields: orderedFields,
      approvedResourceId: binding?.resourceId || null,
      approvedRevisionSha256: binding?.approvedRevisionSha256 || null,
      action,
      priority
    });
  }
  entries.sort((left, right) => ["P0", "P1", "P2"].indexOf(left.priority) - ["P0", "P1", "P2"].indexOf(right.priority) || rawCompare(left.stableServerKey, right.stableServerKey));
  if (before !== JSON.stringify([previousSnapshot, currentSnapshot, approvedCatalog])) throw new Error("reconcile mutated an input");
  return {
    schema: "official-mcp-registry-review-queue-v1",
    previousSnapshotSha256: previousSnapshot.snapshotSha256,
    currentSnapshotSha256: currentSnapshot.snapshotSha256,
    approvedCatalogSha256: approvedCatalog.catalogSha256,
    diff,
    entries
  };
}

module.exports = Object.freeze({
  buildFinalDisposition,
  reconcile,
  resolveCanonicalDuplicate,
  contract: Object.freeze({ CONTRACT, INPUTS, OUTPUT_DIRECTORY, ALL_FILES, ABSENT_SHA256 })
});
