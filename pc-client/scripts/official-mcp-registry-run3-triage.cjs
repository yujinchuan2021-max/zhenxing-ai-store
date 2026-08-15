"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(REPOSITORY_ROOT, "output", "research", "official-mcp-registry-intake-2026-08-15-run3", "registry-index.ndjson");
const INDEX_SHA256 = "a0ac7fe2e126b7c65eb4b6ff700ea71a5fb95c17b2db57518d9fd1fb5606ba7a";
const CATALOG_PATH = path.join(REPOSITORY_ROOT, "docs", "research", "official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json");
const CATALOG_SHA256 = "3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba";
const OUTPUT_PATH = path.join(REPOSITORY_ROOT, "output", "research", "official-mcp-registry-triage-2026-08-15-run3");

const DISPOSITIONS = [
  "catalog-exact-identity",
  "catalog-same-server-lineage",
  "catalog-source-signal",
  "prior-research-observed",
  "unreviewed"
];

function sourceKeys(value) {
  if (typeof value !== "string" || !value) return [];
  let url;
  try {
    url = new URL(value);
  } catch {
    return [];
  }
  if (url.protocol !== "https:" || url.username || url.password) return [];
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\.git\/?$/i, "").replace(/\/+$/, "") || "/";
  const keys = new Set([url.toString().replace(/\/$/, "")]);
  const segments = url.pathname.split("/").filter(Boolean);
  if (url.hostname.toLowerCase() === "github.com" && segments.length >= 2) {
    keys.add(`https://github.com/${segments[0].toLowerCase()}/${segments[1].toLowerCase()}`);
  }
  return [...keys];
}

function add(map, key, value) {
  if (!key) return;
  const values = map.get(key) || new Set();
  values.add(value);
  map.set(key, values);
}

function officialIdentity(resource) {
  const value = resource?.metadataSnapshot?.externalId;
  const prefix = "official-mcp-registry:";
  return typeof value === "string" && value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

function serverName(registryId) {
  const separator = registryId.lastIndexOf("@");
  return separator > 0 ? registryId.slice(0, separator) : null;
}

function buildOfficialRegistryTriage({ records, catalogResources, priorEvidence }) {
  if (!Array.isArray(records) || !Array.isArray(catalogResources) || !Array.isArray(priorEvidence)) {
    throw new TypeError("Official Registry triage inputs must be arrays");
  }
  const catalogIds = new Map();
  const catalogNames = new Map();
  const catalogSources = new Map();
  for (const resource of catalogResources) {
    if (!resource || typeof resource.id !== "string") throw new TypeError("catalog resource identity is invalid");
    const identity = officialIdentity(resource);
    if (identity) {
      add(catalogIds, identity, resource.id);
      add(catalogNames, serverName(identity), resource.id);
    }
    for (const value of [resource.website, resource.metadataSnapshot?.canonicalSource, resource.metadataSnapshot?.sourcePage]) {
      for (const key of sourceKeys(value)) add(catalogSources, key, resource.id);
    }
  }
  const priorNames = new Map();
  for (const evidence of priorEvidence) {
    if (!evidence || typeof evidence.path !== "string" || !Array.isArray(evidence.registryIds)) {
      throw new TypeError("prior evidence is invalid");
    }
    const file = path.basename(evidence.path);
    for (const identity of evidence.registryIds) add(priorNames, serverName(identity), file);
  }
  const seenIds = new Set();
  const seenNames = new Set();
  const counts = Object.fromEntries(DISPOSITIONS.map((value) => [value, 0]));
  const ledger = records.map((record) => {
    if (!record || record.registryId !== `${record.name}@${record.version}` || seenIds.has(record.registryId) || seenNames.has(record.name)) {
      throw new TypeError("Registry triage identity drift");
    }
    seenIds.add(record.registryId);
    seenNames.add(record.name);
    const exact = catalogIds.get(record.registryId);
    const lineage = catalogNames.get(record.name);
    const sourceMatches = new Set();
    for (const value of [record.repository?.url, record.websiteUrl]) {
      for (const key of sourceKeys(value)) {
        for (const resourceId of catalogSources.get(key) || []) sourceMatches.add(resourceId);
      }
    }
    const prior = priorNames.get(record.name);
    let disposition = "unreviewed";
    let matchedResourceIds = [];
    let priorEvidenceFiles = [];
    let evidenceLane = record.repository?.url
      ? "repository"
      : record.websiteUrl
        ? "website"
        : record.packages?.length
          ? "package-only"
          : "insufficient-evidence";
    if (exact) {
      disposition = "catalog-exact-identity";
      matchedResourceIds = [...exact].sort();
      evidenceLane = "catalog";
    } else if (lineage) {
      disposition = "catalog-same-server-lineage";
      matchedResourceIds = [...lineage].sort();
      evidenceLane = "catalog";
    } else if (sourceMatches.size) {
      disposition = "catalog-source-signal";
      matchedResourceIds = [...sourceMatches].sort();
      evidenceLane = "source-collision";
    } else if (prior) {
      disposition = "prior-research-observed";
      priorEvidenceFiles = [...prior].sort();
      evidenceLane = "prior-research";
    }
    counts[disposition] += 1;
    return {
      registryId: record.registryId,
      namespace: record.name.split("/", 1)[0],
      status: record.status,
      disposition,
      catalogResolved: disposition === "catalog-exact-identity" || disposition === "catalog-same-server-lineage",
      matchedResourceIds,
      priorEvidenceFiles,
      evidenceLane,
      warningCount: Array.isArray(record.normalizationWarnings) ? record.normalizationWarnings.length : 0
    };
  });
  return { ledger, counts };
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readBound(filePath, expectedSha256) {
  const bytes = fs.readFileSync(filePath);
  if (sha256(bytes) !== expectedSha256) throw new Error("Official Registry triage input drift");
  return bytes;
}

function discoverPriorEvidence(records) {
  const currentNames = new Set(records.map((record) => record.name));
  const directory = path.join(REPOSITORY_ROOT, "docs", "research");
  const pattern = /[A-Za-z0-9.-]+\/[A-Za-z0-9._-]+@[0-9A-Za-z][0-9A-Za-z._+-]{0,254}/g;
  const evidence = [];
  for (const name of fs.readdirSync(directory).sort()) {
    if (!/\.(?:json|md)$/.test(name) || name.includes("official-mcp-registry-run3-triage")) continue;
    const filePath = path.join(directory, name);
    const state = fs.lstatSync(filePath);
    if (!state.isFile() || state.isSymbolicLink()) continue;
    const bytes = fs.readFileSync(filePath);
    const registryIds = [...new Set((bytes.toString("utf8").match(pattern) || []).filter((value) => currentNames.has(serverName(value))))].sort();
    if (registryIds.length) {
      evidence.push({
        path: path.relative(REPOSITORY_ROOT, filePath).replaceAll(path.sep, "/"),
        sha256: sha256(bytes),
        registryIds
      });
    }
  }
  return evidence;
}

function countBy(values, key) {
  const counts = {};
  for (const value of values) counts[value[key]] = (counts[value[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function outputState(bytes) {
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function writeExclusive(filePath, bytes) {
  const descriptor = fs.openSync(filePath, "wx");
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function runOfficialRegistryTriage() {
  if (process.argv.length !== 2 || fs.existsSync(OUTPUT_PATH)) throw new Error("Official Registry triage output boundary invalid");
  const parent = path.dirname(OUTPUT_PATH);
  const parentState = fs.lstatSync(parent);
  if (!parentState.isDirectory() || parentState.isSymbolicLink()) throw new Error("Official Registry triage parent boundary invalid");
  const temporary = `${OUTPUT_PATH}.${process.pid}.${crypto.randomUUID()}.tmp`;
  if (fs.readdirSync(parent).some((name) => name.startsWith(`${path.basename(OUTPUT_PATH)}.`) && name.endsWith(".tmp"))) {
    throw new Error("Official Registry triage temporary artifact exists");
  }
  const indexBytes = readBound(INDEX_PATH, INDEX_SHA256);
  const indexText = indexBytes.toString("utf8");
  if (!indexText.endsWith("\n")) throw new Error("Official Registry triage index tail drift");
  const records = indexText.slice(0, -1).split("\n").map((line) => JSON.parse(line));
  const catalogBytes = readBound(CATALOG_PATH, CATALOG_SHA256);
  const catalog = JSON.parse(catalogBytes);
  const priorEvidence = discoverPriorEvidence(records);
  const result = buildOfficialRegistryTriage({ records, catalogResources: catalog.catalog.resources, priorEvidence });
  const clusters = [...result.ledger.reduce((map, row) => {
    const cluster = map.get(row.namespace) || {
      namespace: row.namespace,
      records: 0,
      catalogResolved: 0,
      sourceSignals: 0,
      priorObserved: 0,
      unreviewed: 0
    };
    cluster.records += 1;
    cluster.catalogResolved += Number(row.catalogResolved);
    cluster.sourceSignals += Number(row.disposition === "catalog-source-signal");
    cluster.priorObserved += Number(row.disposition === "prior-research-observed");
    cluster.unreviewed += Number(row.disposition === "unreviewed");
    map.set(row.namespace, cluster);
    return map;
  }, new Map()).values()].sort((left, right) => right.records - left.records || left.namespace.localeCompare(right.namespace));
  const ledgerBytes = Buffer.from(`${result.ledger.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  const clustersBytes = jsonBytes(clusters);
  const priorBytes = jsonBytes(priorEvidence);
  const summary = {
    schema: "official-mcp-registry-run3-triage-v1",
    completed: true,
    candidateOnly: true,
    publishable: false,
    sourceObservedAt: "2026-08-14T23:19:47.334Z",
    records: result.ledger.length,
    uniqueNamespaces: clusters.length,
    countsByDisposition: result.counts,
    countsByEvidenceLane: countBy(result.ledger, "evidenceLane"),
    countsByStatus: countBy(result.ledger, "status"),
    recordsWithWarnings: result.ledger.filter((row) => row.warningCount > 0).length,
    input: {
      registryIndex: { path: path.relative(REPOSITORY_ROOT, INDEX_PATH).replaceAll(path.sep, "/"), sha256: INDEX_SHA256 },
      catalogCandidate: { path: path.relative(REPOSITORY_ROOT, CATALOG_PATH).replaceAll(path.sep, "/"), sha256: CATALOG_SHA256 },
      priorEvidenceFiles: priorEvidence.length,
      priorEvidenceManifestSha256: sha256(Buffer.from(priorEvidence.map((value) => `${value.sha256}  ${value.path}\n`).join(""), "utf8"))
    },
    outputs: {
      ledger: outputState(ledgerBytes),
      namespaceClusters: outputState(clustersBytes),
      priorEvidence: outputState(priorBytes)
    }
  };
  const summaryBytes = jsonBytes(summary);
  fs.mkdirSync(temporary);
  writeExclusive(path.join(temporary, "ledger.ndjson"), ledgerBytes);
  writeExclusive(path.join(temporary, "namespace-clusters.json"), clustersBytes);
  writeExclusive(path.join(temporary, "prior-evidence.json"), priorBytes);
  writeExclusive(path.join(temporary, "summary.json"), summaryBytes);
  fs.renameSync(temporary, OUTPUT_PATH);
  return summary;
}

if (require.main === module) {
  try {
    const summary = runOfficialRegistryTriage();
    process.stdout.write(`${JSON.stringify({ completed: true, records: summary.records, countsByDisposition: summary.countsByDisposition })}\n`);
  } catch {
    process.stderr.write('{"completed":false,"statusClass":"local-triage-stop"}\n');
    process.exitCode = 1;
  }
}

module.exports = { buildOfficialRegistryTriage, runOfficialRegistryTriage };
