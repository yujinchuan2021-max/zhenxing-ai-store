"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { readResponseTextWithLimit } = require("./limited-response.cjs");

const REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0.1/servers";
const INTAKE_SCHEMA = "official-mcp-registry-full-v1";
const RECORD_KEYS = Object.freeze([
  "registryId", "name", "version", "title", "description", "websiteUrl",
  "repository", "packages", "transportKinds", "hasPackages", "hasRemotes",
  "packageCount", "packageRefCount", "remoteCount", "status", "statusMessage", "statusChangedAt",
  "publishedAt", "updatedAt", "isLatest", "classification", "candidateOnly",
  "publishable", "installProfileId", "discoveredVia", "reviewStatus",
  "normalizationWarnings"
]);
const NORMALIZATION_WARNINGS = Object.freeze([
  "description-omitted", "package-metadata-omitted",
  "package-registry-url-omitted", "published-at-missing",
  "remote-metadata-omitted", "repository-id-omitted",
  "repository-id-stringified", "repository-source-omitted",
  "repository-subfolder-omitted", "repository-url-omitted",
  "schema-url-omitted", "status-changed-at-missing",
  "status-message-omitted", "title-omitted", "updated-at-missing",
  "website-url-omitted"
]);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function exactFields(value, fields, label) {
  const source = object(value, label);
  if (Object.keys(source).sort().join("\0") !== [...fields].sort().join("\0")) {
    throw new TypeError(`${label} schema drift`);
  }
  return source;
}

function text(value, label, maximum, optional = false) {
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== "string" || value.length < 1 || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function httpsUrl(value, label, optional = false) {
  const raw = text(value, label, 2048, optional);
  if (raw === null) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new TypeError(`${label} must be a canonical HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw new TypeError(`${label} must be a canonical HTTPS URL`);
  }
  return parsed.toString();
}

function timestamp(value, label) {
  if (value === undefined || value === null) return null;
  const raw = text(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new TypeError(`${label} is invalid`);
  }
  return raw;
}

function optionalHttps(value, label, warnings, warning) {
  if (value === undefined || value === null || value === "") return null;
  try {
    return httpsUrl(value, label);
  } catch {
    warnings.add(warning);
    return null;
  }
}

function optionalMetadataText(value, label, maximum, warnings, warning) {
  if (value === undefined || value === null || value === "") return null;
  try {
    return text(value, label, maximum);
  } catch {
    warnings.add(warning);
    return null;
  }
}

function optionalTimestamp(value, label, warnings, warning) {
  if (value === undefined || value === null || value === "") {
    warnings.add(warning);
    return null;
  }
  try {
    return timestamp(value, label);
  } catch {
    warnings.add(warning);
    return null;
  }
}

function repository(value, warnings) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    warnings.add("repository-url-omitted");
    return null;
  }
  const source = value;
  let id = null;
  if (typeof source.id === "string") {
    id = optionalMetadataText(source.id, "repository.id", 255, warnings, "repository-id-omitted");
  } else if (Number.isSafeInteger(source.id)) {
    id = String(source.id);
    warnings.add("repository-id-stringified");
  } else if (source.id !== undefined && source.id !== null) {
    warnings.add("repository-id-omitted");
  }
  let subfolder = optionalMetadataText(source.subfolder, "repository.subfolder", 512, warnings, "repository-subfolder-omitted");
  if (subfolder && (subfolder.startsWith("/") || subfolder.includes("..") || subfolder.includes("\\"))) {
    warnings.add("repository-subfolder-omitted");
    subfolder = null;
  }
  const result = {
    url: optionalHttps(source.url, "repository.url", warnings, "repository-url-omitted"),
    source: optionalMetadataText(source.source, "repository.source", 64, warnings, "repository-source-omitted"),
    id,
    subfolder
  };
  return result;
}

function packageReference(value, warnings) {
  try {
    const source = object(value, "package");
    const transport = object(source.transport, "package.transport");
    if (!["stdio", "streamable-http", "sse"].includes(transport.type)) {
      throw new TypeError("package.transport is invalid");
    }
    const version = text(source.version, "package.version", 255, true);
    if (version === "latest") throw new TypeError("package.version must be immutable");
    return {
      reference: {
        registryType: text(source.registryType, "package.registryType", 64),
        registryBaseUrl: optionalHttps(source.registryBaseUrl, "package.registryBaseUrl", warnings, "package-registry-url-omitted"),
        identifier: text(source.identifier, "package.identifier", 2048),
        version
      },
      transportKind: transport.type
    };
  } catch {
    warnings.add("package-metadata-omitted");
    return null;
  }
}

function remoteTransportKind(value, warnings) {
  try {
    const source = object(value, "remote transport");
    const kind = text(source.type, "remote transport type", 32);
    if (!["streamable-http", "sse"].includes(kind)) throw new TypeError("remote transport type is invalid");
    return kind;
  } catch {
    warnings.add("remote-metadata-omitted");
    return null;
  }
}

function normalizeOfficialRegistryPage(value) {
  const page = object(value, "registry page");
  if (!Array.isArray(page.servers)) throw new TypeError("registry page servers must be an array");
  const metadata = object(page.metadata, "registry page metadata");
  if (!Number.isSafeInteger(metadata.count) || metadata.count !== page.servers.length) {
    throw new TypeError("registry page count mismatch");
  }
  if (metadata.count > 100) throw new TypeError("registry page count exceeds limit");
  const nextCursor = metadata.nextCursor === undefined || metadata.nextCursor === null || metadata.nextCursor === ""
    ? null
    : text(metadata.nextCursor, "registry page nextCursor", 512);
  const identities = new Set();
  const records = page.servers.map((entryValue) => {
    const warnings = new Set();
    const entry = object(entryValue, "registry entry");
    const server = object(entry.server, "registry server");
    optionalHttps(server.$schema, "server.$schema", warnings, "schema-url-omitted");
    const name = text(server.name, "server.name", 200);
    if (!/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(name)) throw new TypeError("server.name is invalid");
    const version = text(server.version, "server.version", 255);
    const registryId = `${name}@${version}`;
    if (identities.has(registryId)) throw new TypeError(`duplicate registry identity: ${registryId}`);
    identities.add(registryId);
    const official = object(entry._meta?.["io.modelcontextprotocol.registry/official"], "official registry metadata");
    const status = text(official.status, "official status", 16);
    if (!["active", "deprecated"].includes(status)) throw new TypeError("official status is invalid for a latest baseline");
    if (official.isLatest !== true) throw new TypeError("registry entry is not latest");
    const statusChangedAt = optionalTimestamp(official.statusChangedAt, "official statusChangedAt", warnings, "status-changed-at-missing");
    const publishedAt = optionalTimestamp(official.publishedAt, "official publishedAt", warnings, "published-at-missing");
    const updatedAt = optionalTimestamp(official.updatedAt, "official updatedAt", warnings, "updated-at-missing");
    let packages = server.packages === undefined ? [] : server.packages;
    let remotes = server.remotes === undefined ? [] : server.remotes;
    if (!Array.isArray(packages)) {
      warnings.add("package-metadata-omitted");
      packages = [];
    }
    if (!Array.isArray(remotes)) {
      warnings.add("remote-metadata-omitted");
      remotes = [];
    }
    const normalizedPackageValues = packages.map((value) => packageReference(value, warnings)).filter(Boolean);
    const normalizedPackages = normalizedPackageValues.map((value) => value.reference);
    const transportKinds = new Set();
    for (const item of normalizedPackageValues) transportKinds.add(item.transportKind);
    for (const item of remotes) {
      const kind = remoteTransportKind(item, warnings);
      if (kind) transportKinds.add(kind);
    }
    return validateRecord({
      registryId,
      name,
      version,
      title: optionalMetadataText(server.title, "server.title", 100, warnings, "title-omitted"),
      description: optionalMetadataText(server.description, "server.description", 100, warnings, "description-omitted"),
      websiteUrl: optionalHttps(server.websiteUrl, "server.websiteUrl", warnings, "website-url-omitted"),
      repository: repository(server.repository, warnings),
      packages: normalizedPackages,
      transportKinds: [...transportKinds].sort(),
      hasPackages: packages.length > 0,
      hasRemotes: remotes.length > 0,
      packageCount: packages.length,
      packageRefCount: normalizedPackages.length,
      remoteCount: remotes.length,
      status,
      statusMessage: optionalMetadataText(official.statusMessage, "official statusMessage", 500, warnings, "status-message-omitted"),
      statusChangedAt,
      publishedAt,
      updatedAt,
      isLatest: true,
      classification: "discovery-only",
      candidateOnly: true,
      publishable: false,
      installProfileId: "",
      discoveredVia: "official-mcp-registry",
      reviewStatus: "discovered-unreviewed",
      normalizationWarnings: [...warnings].sort()
    });
  });
  return { records, nextCursor };
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(canonical(value), null, 2)}\n`, "utf8");
}

function replaceAtomic(temporary, destination) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.renameSync(temporary, destination);
      return;
    } catch (error) {
      if (!new Set(["EPERM", "EBUSY", "EACCES"]).has(error.code)) throw error;
      lastError = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * (attempt + 1));
    }
  }
  throw lastError;
}

function atomicWrite(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const descriptor = fs.openSync(temporary, "wx");
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  replaceAtomic(temporary, filePath);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function atomicJson(filePath, value) {
  return atomicWrite(filePath, jsonBytes(value));
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is invalid JSON`, { cause: error });
  }
}

function pageName(index) {
  return `page-${String(index).padStart(6, "0")}.json`;
}

function assertWorkspaceShape(directory) {
  const root = fs.lstatSync(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error("Official Registry intake directory is not canonical");
  const allowed = new Set(["checkpoint.json", "pages", "registry-index.ndjson", "summary.json"]);
  for (const name of fs.readdirSync(directory)) {
    if (/\.tmp$/i.test(name)) throw new Error("unknown temporary intake artifact");
    if (!allowed.has(name)) throw new Error(`unknown intake artifact: ${name}`);
    const state = fs.lstatSync(path.join(directory, name));
    if (state.isSymbolicLink()) throw new Error(`linked intake artifact: ${name}`);
    if (name === "pages" ? !state.isDirectory() : !state.isFile()) {
      throw new Error(`invalid intake artifact type: ${name}`);
    }
  }
  const pagesDirectory = path.join(directory, "pages");
  if (!fs.existsSync(pagesDirectory)) return;
  for (const name of fs.readdirSync(pagesDirectory)) {
    if (/\.tmp$/i.test(name)) throw new Error("unknown temporary page artifact");
    if (!/^page-\d{6}\.json$/.test(name)) throw new Error(`unknown page artifact: ${name}`);
    const state = fs.lstatSync(path.join(pagesDirectory, name));
    if (!state.isFile() || state.isSymbolicLink()) throw new Error(`invalid page artifact type: ${name}`);
  }
}

function pageUrl(cursor, limit) {
  const url = new URL(REGISTRY_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("version", "latest");
  if (cursor) url.searchParams.set("cursor", cursor);
  return url.toString();
}

function stopError(statusClass) {
  return Object.assign(new Error(`Official Registry safety stop: ${statusClass}`), {
    safetyStop: true,
    statusClass
  });
}

function validationStatus(error) {
  const message = String(error?.message || "");
  if (/server\.\$schema/.test(message)) return "validation-schema-url";
  if (/websiteUrl/.test(message)) return "validation-website-url";
  if (/repository/i.test(message)) return "validation-repository";
  if (/package/i.test(message)) return "validation-package";
  if (/transport|remote/i.test(message)) return "validation-transport";
  if (/timestamp|publishedAt|updatedAt|statusChangedAt/i.test(message)) return "validation-timestamp";
  if (/status/i.test(message)) return "validation-status";
  if (/cursor/i.test(message)) return "validation-cursor";
  if (/count|servers|metadata/i.test(message)) return "validation-page";
  if (/identity|name|version/i.test(message)) return "validation-identity";
  return "validation-stop";
}

async function fetchOfficialRegistryPageWith(fetchImpl, url, maximumBytes = 32 * 1024 * 1024) {
  let response;
  try {
    response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      headers: {
        accept: "application/json",
        "user-agent": "ZhenXingAI-Official-MCP-Registry-Research/1.0 (+candidate-only)"
      }
    });
  } catch {
    throw stopError("fetch-failure");
  }
  if ([301, 302, 303, 307, 308].includes(response.status)) throw stopError("redirect-boundary");
  if ([401, 403, 429].includes(response.status)) throw stopError(`http-${response.status}`);
  if (response.status !== 200) throw stopError("http-non2xx");
  if (response.url && response.url !== url) throw stopError("response-url-drift");
  const contentType = String(response.headers?.get?.("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && contentType !== "text/json") throw stopError("content-type");
  let body;
  try {
    body = await readResponseTextWithLimit(response, maximumBytes);
  } catch {
    throw stopError("body-read");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw stopError("json-invalid");
  }
}

function validateRecord(value) {
  const record = exactFields(value, RECORD_KEYS, "registry record");
  const name = text(record.name, "registry record name", 200);
  if (!/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(name)) throw new TypeError("registry record name is invalid");
  const version = text(record.version, "registry record version", 255);
  if (record.registryId !== `${record.name}@${record.version}`) throw new TypeError("registry record identity drift");
  text(record.registryId, "registry record identity", 512);
  text(record.title, "registry record title", 100, true);
  text(record.description, "registry record description", 100, true);
  if (httpsUrl(record.websiteUrl, "registry record websiteUrl", true) !== record.websiteUrl) {
    throw new TypeError("registry record websiteUrl drift");
  }
  if (record.repository !== null) {
    const source = exactFields(record.repository, ["url", "source", "id", "subfolder"], "repository");
    if (httpsUrl(source.url, "repository.url", true) !== source.url) throw new TypeError("repository URL drift");
    text(source.source, "repository.source", 64, true);
    text(source.id, "repository.id", 255, true);
    const subfolder = text(source.subfolder, "repository.subfolder", 512, true);
    if (subfolder && (subfolder.startsWith("/") || subfolder.includes("..") || subfolder.includes("\\"))) {
      throw new TypeError("repository subfolder drift");
    }
  }
  if (!Array.isArray(record.packages)) throw new TypeError("package schema drift");
  for (const value of record.packages) {
    const source = exactFields(value, ["registryType", "registryBaseUrl", "identifier", "version"], "package");
    text(source.registryType, "package.registryType", 64);
    if (httpsUrl(source.registryBaseUrl, "package.registryBaseUrl", true) !== source.registryBaseUrl) {
      throw new TypeError("package registry URL drift");
    }
    text(source.identifier, "package.identifier", 2048);
    const packageVersion = text(source.version, "package.version", 255, true);
    if (packageVersion === "latest") throw new TypeError("package version drift");
  }
  if (!Array.isArray(record.transportKinds)) throw new TypeError("transport kind drift");
  const kinds = record.transportKinds.map((kind) => text(kind, "transport kind", 32));
  if (kinds.some((kind) => !["stdio", "streamable-http", "sse"].includes(kind)) || new Set(kinds).size !== kinds.length || kinds.join("\0") !== [...kinds].sort().join("\0")) {
    throw new TypeError("transport kind drift");
  }
  if (!Number.isSafeInteger(record.packageCount) || record.packageCount < record.packages.length || record.packageCount < 0) {
    throw new TypeError("package count drift");
  }
  if (!Number.isSafeInteger(record.packageRefCount) || record.packageRefCount !== record.packages.length) {
    throw new TypeError("package reference count drift");
  }
  if (!Number.isSafeInteger(record.remoteCount) || record.remoteCount < 0) throw new TypeError("remote count drift");
  if (record.hasPackages !== (record.packageCount > 0) || record.hasRemotes !== (record.remoteCount > 0)) {
    throw new TypeError("transport presence drift");
  }
  if (!["active", "deprecated"].includes(record.status)) throw new TypeError("registry record status drift");
  text(record.statusMessage, "registry record statusMessage", 500, true);
  timestamp(record.statusChangedAt, "registry record statusChangedAt");
  timestamp(record.publishedAt, "registry record publishedAt");
  timestamp(record.updatedAt, "registry record updatedAt");
  if (record.isLatest !== true || record.classification !== "discovery-only" || record.candidateOnly !== true || record.publishable !== false || record.installProfileId !== "" || record.discoveredVia !== "official-mcp-registry" || record.reviewStatus !== "discovered-unreviewed") {
    throw new TypeError("registry record trust boundary drift");
  }
  if (!Array.isArray(record.normalizationWarnings)) throw new TypeError("normalization warning drift");
  const warnings = record.normalizationWarnings.map((warning) => text(warning, "normalization warning", 64));
  if (warnings.some((warning) => !NORMALIZATION_WARNINGS.includes(warning)) || new Set(warnings).size !== warnings.length || warnings.join("\0") !== [...warnings].sort().join("\0")) {
    throw new TypeError("normalization warning drift");
  }
  void version;
  return record;
}

function validatePageArtifact(value, index, cursorIn) {
  const page = object(value, "page artifact");
  const keys = Object.keys(page).sort().join("\0");
  if (keys !== ["cursorIn", "cursorOut", "page", "records", "schema"].sort().join("\0")) {
    throw new TypeError("page artifact schema drift");
  }
  if (page.schema !== INTAKE_SCHEMA || page.page !== index || page.cursorIn !== cursorIn || !Array.isArray(page.records)) {
    throw new TypeError("page artifact binding drift");
  }
  page.records.forEach(validateRecord);
  if (page.cursorOut !== null) text(page.cursorOut, "page cursorOut", 512);
  return page;
}

function fileState(filePath) {
  const bytes = fs.readFileSync(filePath);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function loadCheckpoint(directory, limit) {
  const checkpointPath = path.join(directory, "checkpoint.json");
  if (!fs.existsSync(checkpointPath)) return null;
  const checkpoint = object(readJson(checkpointPath, "checkpoint"), "checkpoint");
  if (checkpoint.schema !== INTAKE_SCHEMA || checkpoint.registryUrl !== REGISTRY_URL || checkpoint.limit !== limit || checkpoint.version !== "latest" || !Array.isArray(checkpoint.pages)) {
    throw new Error("checkpoint binding drift");
  }
  let cursor = null;
  let records = 0;
  for (let index = 1; index <= checkpoint.pages.length; index += 1) {
    const expected = checkpoint.pages[index - 1];
    const filePath = path.join(directory, "pages", pageName(index));
    const state = fileState(filePath);
    if (state.sha256 !== expected.sha256 || state.bytes !== expected.bytes) throw new Error("checkpoint page drift");
    const page = validatePageArtifact(readJson(filePath, "page artifact"), index, cursor);
    if (page.cursorOut !== expected.cursorOut || page.records.length !== expected.records) throw new Error("checkpoint page metadata drift");
    cursor = page.cursorOut;
    records += page.records.length;
  }
  if (checkpoint.nextCursor !== cursor || checkpoint.records !== records) throw new Error("checkpoint aggregate drift");
  return checkpoint;
}

function reconcileDurablePage(directory, checkpoint) {
  const pagesDirectory = path.join(directory, "pages");
  const files = fs.existsSync(pagesDirectory)
    ? fs.readdirSync(pagesDirectory).filter((name) => /^page-\d{6}\.json$/.test(name)).sort()
    : [];
  if (files.length === checkpoint.pages.length) return false;
  if (files.length !== checkpoint.pages.length + 1 || files.at(-1) !== pageName(files.length)) {
    throw new Error("unrecognized page artifact drift");
  }
  for (let index = 1; index <= checkpoint.pages.length; index += 1) {
    if (files[index - 1] !== pageName(index)) throw new Error("page artifact sequence drift");
  }
  const index = files.length;
  const filePath = path.join(pagesDirectory, pageName(index));
  const artifact = validatePageArtifact(readJson(filePath, "orphan page artifact"), index, checkpoint.nextCursor);
  const previous = collectRecords(directory, checkpoint);
  const ids = new Set(previous.map((record) => record.registryId));
  const names = new Set(previous.map((record) => record.name));
  for (const record of artifact.records) {
    if (ids.has(record.registryId) || names.has(record.name)) throw new Error("orphan page identity duplicate");
    ids.add(record.registryId);
    names.add(record.name);
  }
  const priorCursors = new Set(checkpoint.pages.map((page) => page.cursorOut).filter(Boolean));
  if (artifact.cursorOut && priorCursors.has(artifact.cursorOut)) throw new Error("orphan page cursor cycle");
  const state = fileState(filePath);
  checkpoint.pages.push({
    page: index,
    cursorIn: artifact.cursorIn,
    cursorOut: artifact.cursorOut,
    records: artifact.records.length,
    ...state
  });
  checkpoint.records += artifact.records.length;
  checkpoint.nextCursor = artifact.cursorOut;
  checkpoint.exhausted = artifact.cursorOut === null;
  atomicJson(path.join(directory, "checkpoint.json"), checkpoint);
  return true;
}

function collectRecords(directory, checkpoint) {
  const records = [];
  for (let index = 1; index <= checkpoint.pages.length; index += 1) {
    const page = validatePageArtifact(
      readJson(path.join(directory, "pages", pageName(index)), "page artifact"),
      index,
      index === 1 ? null : checkpoint.pages[index - 2].cursorOut
    );
    records.push(...page.records);
  }
  const ids = new Set();
  const names = new Set();
  for (const record of records) {
    if (ids.has(record.registryId) || names.has(record.name)) throw new Error("registry identity duplicate across pages");
    ids.add(record.registryId);
    names.add(record.name);
  }
  return records;
}

function verifyCompleted(directory, checkpoint) {
  if (!checkpoint.completed || !checkpoint.index || !checkpoint.summary) throw new Error("completed checkpoint is incomplete");
  const indexPath = path.join(directory, "registry-index.ndjson");
  const summaryPath = path.join(directory, "summary.json");
  const indexState = fileState(indexPath);
  const summaryState = fileState(summaryPath);
  if (indexState.sha256 !== checkpoint.index.sha256 || indexState.bytes !== checkpoint.index.bytes || summaryState.sha256 !== checkpoint.summary.sha256 || summaryState.bytes !== checkpoint.summary.bytes) {
    throw new Error("completed output drift");
  }
  return readJson(summaryPath, "summary");
}

function acquireOwner(directory, runId) {
  const filePath = path.join(directory, "owner.lock");
  const owner = { pid: process.pid, runId, runToken: crypto.randomUUID(), schema: INTAKE_SCHEMA };
  const descriptor = fs.openSync(filePath, "wx");
  try {
    fs.writeFileSync(descriptor, jsonBytes(owner));
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  return { filePath, owner };
}

function releaseOwner(lock) {
  if (!fs.existsSync(lock.filePath)) return;
  const current = readJson(lock.filePath, "owner lock");
  if (current.runToken !== lock.owner.runToken) throw new Error("owner lock ownership drift");
  fs.unlinkSync(lock.filePath);
}

function finalize(directory, checkpoint, observedAt) {
  const records = collectRecords(directory, checkpoint);
  const indexBytes = Buffer.from(records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : ""), "utf8");
  const index = atomicWrite(path.join(directory, "registry-index.ndjson"), indexBytes);
  const byStatus = Object.fromEntries(["active", "deprecated", "deleted"].map((status) => [status, records.filter((record) => record.status === status).length]));
  const summaryValue = {
    schema: INTAKE_SCHEMA,
    completed: true,
    fullEnumeration: true,
    snapshotIsolation: false,
    registryUrl: REGISTRY_URL,
    version: "latest",
    limit: checkpoint.limit,
    observedAt,
    pages: checkpoint.pages.length,
    records: records.length,
    uniqueNames: new Set(records.map((record) => record.name)).size,
    byStatus,
    rawResponsesPersisted: 0,
    reviewStatus: "discovered-unreviewed"
  };
  const summary = atomicJson(path.join(directory, "summary.json"), summaryValue);
  Object.assign(checkpoint, { completed: true, index, summary });
  atomicJson(path.join(directory, "checkpoint.json"), checkpoint);
  return summaryValue;
}

async function runOfficialRegistryIntake(options) {
  const directory = path.resolve(options?.directory || "");
  const fetchImpl = options?.fetchImpl || fetch;
  const sleep = options?.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = options?.now || (() => new Date().toISOString());
  const runId = options?.runId || crypto.randomUUID();
  const limit = options?.limit ?? 100;
  const minimumDelayMs = options?.minimumDelayMs ?? 2000;
  if (!options?.directory || !Number.isSafeInteger(limit) || limit !== 100 || !Number.isSafeInteger(minimumDelayMs) || minimumDelayMs < 0) {
    throw new TypeError("Official Registry intake options are invalid");
  }
  fs.mkdirSync(directory, { recursive: true });
  const stoppedPath = path.join(directory, "stopped.json");
  if (fs.existsSync(stoppedPath)) throw new Error("Official Registry intake is stopped pending review");
  assertWorkspaceShape(directory);
  let checkpoint = loadCheckpoint(directory, limit);
  if (checkpoint?.completed) return verifyCompleted(directory, checkpoint);
  if (!checkpoint) {
    const existing = fs.readdirSync(directory);
    if (existing.length) throw new Error("Official Registry intake directory is not empty");
  }
  const lock = acquireOwner(directory, runId);
  try {
    checkpoint ||= {
      schema: INTAKE_SCHEMA,
      registryUrl: REGISTRY_URL,
      version: "latest",
      limit,
      startedAt: now(),
      nextCursor: null,
      pages: [],
      records: 0,
      exhausted: false,
      completed: false
    };
    reconcileDurablePage(directory, checkpoint);
    const known = collectRecords(directory, checkpoint);
    const knownIds = new Set(known.map((record) => record.registryId));
    const knownNames = new Set(known.map((record) => record.name));
    const returnedCursors = new Set(checkpoint.pages.map((page) => page.cursorOut).filter(Boolean));
    while (!checkpoint.exhausted) {
      const cursorIn = checkpoint.nextCursor;
      const currentPage = checkpoint.pages.length + 1;
      let normalized;
      try {
        normalized = normalizeOfficialRegistryPage(await fetchOfficialRegistryPageWith(fetchImpl, pageUrl(cursorIn, limit)));
        if (normalized.nextCursor && returnedCursors.has(normalized.nextCursor)) throw new Error("registry cursor cycle");
        for (const record of normalized.records) {
          if (knownIds.has(record.registryId) || knownNames.has(record.name)) throw new Error("registry identity duplicate across pages");
        }
        if (!normalized.records.length && normalized.nextCursor) throw new Error("empty registry page has next cursor");
      } catch (error) {
        const statusClass = error.safetyStop ? error.statusClass : validationStatus(error);
        atomicJson(stoppedPath, { stopped: true, statusClass, page: currentPage, cursor: cursorIn });
        throw error;
      }
      const artifact = {
        schema: INTAKE_SCHEMA,
        page: currentPage,
        cursorIn,
        cursorOut: normalized.nextCursor,
        records: normalized.records
      };
      const pagePath = path.join(directory, "pages", pageName(currentPage));
      const state = atomicJson(pagePath, artifact);
      checkpoint.pages.push({
        page: currentPage,
        cursorIn,
        cursorOut: normalized.nextCursor,
        records: normalized.records.length,
        ...state
      });
      checkpoint.records += normalized.records.length;
      checkpoint.nextCursor = normalized.nextCursor;
      checkpoint.exhausted = normalized.nextCursor === null;
      for (const record of normalized.records) {
        knownIds.add(record.registryId);
        knownNames.add(record.name);
      }
      if (normalized.nextCursor) returnedCursors.add(normalized.nextCursor);
      atomicJson(path.join(directory, "checkpoint.json"), checkpoint);
      if (!checkpoint.exhausted) await sleep(minimumDelayMs);
    }
    return finalize(directory, checkpoint, now());
  } finally {
    releaseOwner(lock);
  }
}

module.exports = {
  fetchOfficialRegistryPageWith,
  normalizeOfficialRegistryPage,
  runOfficialRegistryIntake
};
