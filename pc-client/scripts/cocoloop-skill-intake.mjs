import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DEFAULT_HOST,
  canonicalSkillRecord,
  cacheKey,
  checkpointPlan,
  fetchPageWith,
  inspectPhase2StopMarker,
  parseRobotsTxt,
  parsePublicSkillMetadata,
  phase2BatchStopReason,
  phase2InputManifestHash,
  parseSitemapIndexXml,
  parseSkillSitemapXml,
  publicCocoLoopUrl,
  readBodyBytes,
  replaceAtomicWithRetry,
  runWithPhase2Owner,
  validateCheckpoint,
  validatePublicResponse,
  validatePhase2Bindings,
  validatePhase2Extension,
  validatePhase2ParserMigration
} = require("../shared/cocoloop-skill-intake.cjs");

const root = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.join(root, "output", "research", "cocoloop-skill-intake");
const shardDirectory = path.join(outputDirectory, "shards");
const indexPath = path.join(outputDirectory, "candidate-index.ndjson");
const summaryPath = path.join(outputDirectory, "candidate-index-summary.json");
const checkpointPath = path.join(outputDirectory, "checkpoint.json");
const stoppedPath = path.join(outputDirectory, "stopped.json");
const phase2Directory = path.join(outputDirectory, "phase2-first1000");
const phase2RecordsPath = path.join(phase2Directory, "metadata.ndjson");
const phase2FailuresPath = path.join(phase2Directory, "failures.ndjson");
const phase2CheckpointPath = path.join(phase2Directory, "checkpoint.json");
const phase2SummaryPath = path.join(phase2Directory, "summary.json");
const phase2LockPath = path.join(phase2Directory, "owner.lock");
const parserArtifactPath = path.join(root, "shared", "cocoloop-skill-metadata-parser.cjs");
const baseUrl = `https://${DEFAULT_HOST}`;
const rateMs = Math.max(250, Number(process.argv.find((value) => value.startsWith("--rate-ms="))?.slice(10) || 1500));
const retries = Math.max(0, Math.min(5, Number(process.argv.find((value) => value.startsWith("--retries="))?.slice(10) || 3)));
const maxResponseBytes = 2_000_000;
const phase2RateMs = 1500;

function assertPublicUrl(value) {
  const url = publicCocoLoopUrl(value, baseUrl, new URL(baseUrl).hostname);
  if (!url) throw new Error(`blocked non-public CocoLoop URL: ${value}`);
  return url;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function fetchPage(url) {
  try { return await fetchPageWith(fetch, url, maxResponseBytes); }
  catch (error) { if (error.safetyStop) atomicJson(path.join(phase2Directory, "stopped.json"), error.stopRecord); throw error; }
}

async function fetchText(url, kind) {
  const publicUrl = assertPublicUrl(url);
  if (new URL(publicUrl).pathname.startsWith("/api/")) throw new Error("/api/ is forbidden");
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(publicUrl, { headers: { accept: kind === "xml" ? "application/xml,text/xml;q=0.9" : "text/html,application/xhtml+xml;q=0.9", "user-agent": "AIHub-CocoLoop-Research/1.0 (+candidate-only; no-api)" } });
      if (response.status === 403 || response.status === 429) {
        atomicJson(stoppedPath, { stopped: true, status: response.status, url: publicUrl, observedAt: new Date().toISOString() });
        throw Object.assign(new Error(`safety stop HTTP ${response.status}: ${publicUrl}`), { safetyStop: true });
      }
      validatePublicResponse({ status: response.status, url: response.url, contentType: response.headers.get("content-type") || "" }, kind);
      const bytes = await readBodyBytes(response, maxResponseBytes);
      const content = new TextDecoder().decode(bytes);
      return { url: publicUrl, status: response.status, contentType: response.headers.get("content-type") || "", observedAt: new Date().toISOString(), text: content };
    } catch (error) {
      lastError = error;
      if (error.safetyStop) throw error;
      if (attempt < retries) await sleep(2 ** attempt * 1000);
    }
  }
  throw lastError;
}

function atomicJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  const descriptor = fs.openSync(temporary, "w");
  try { fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  replaceAtomicWithRetry(fs.renameSync, temporary, filePath);
}

function appendJsonLine(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const descriptor = fs.openSync(filePath, "a");
  try { fs.writeSync(descriptor, `${JSON.stringify(value)}\n`); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function atomicNdjson(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  const descriptor = fs.openSync(temporary, "w");
  try { fs.writeFileSync(descriptor, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "")); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.renameSync(temporary, filePath);
}

function fileState(filePath) {
  const bytes = fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.alloc(0);
  if (bytes.length && bytes.at(-1) !== 0x0a) throw new Error(`partial NDJSON tail: ${filePath}`);
  return { bytes: bytes.length, sha256: cacheKey(bytes), lines: bytes.length ? bytes.toString("utf8").trimEnd().split(/\r?\n/).length : 0 };
}

async function runPhase2(targetCount = 1000) {
  if (![1000, 5000].includes(targetCount)) throw new Error("Phase2 target must be 1000 or 5000");
  fs.mkdirSync(phase2Directory, { recursive: true });
  const runId = "phase2-first1000-2026-08-14";
  const pages = fs.readFileSync(indexPath, "utf8").split(/\r?\n/).filter(Boolean).slice(0, targetCount).map(JSON.parse);
  const phase1IndexSha256 = cacheKey(fs.readFileSync(indexPath));
  const bindings = phase2Bindings(pages);
  let checkpoint = fs.existsSync(phase2CheckpointPath) ? JSON.parse(fs.readFileSync(phase2CheckpointPath, "utf8")) : { version: 1, runId, targetCount: 1000, phase1IndexSha256, ...bindings, nextIndex: 0, counts: { http2xx: 0, parsed: 0, parseFailure: 0, http404: 0, fetchFailure: 0, redirectBoundary: 0, http429: 0, http403: 0, bytes: 0 }, records: fileState(phase2RecordsPath), failures: fileState(phase2FailuresPath), observedAt: new Date().toISOString() };
  if (targetCount === 5000 && checkpoint.targetCount === 1000) {
    const readIds = (filePath) => fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line).externalId);
    validatePhase2Bindings(checkpoint, { phase1IndexSha256, ...phase2Bindings(pages.slice(0, 1000)) });
    for (const [filePath, expected] of [[phase2RecordsPath, checkpoint.records], [phase2FailuresPath, checkpoint.failures]]) assertFileState(filePath, expected);
    validatePhase2Extension(checkpoint, pages, [...readIds(phase2RecordsPath), ...readIds(phase2FailuresPath)]);
    checkpoint.first1000InputManifestSha256 = checkpoint.inputManifestSha256;
    Object.assign(checkpoint, bindings, { targetCount, batchStartIndex: 1000, batchCounts: { completed: 0, fetchFailure: 0, parseFailure: 0, otherFailure: 0, consecutiveFailures: 0 } });
    atomicJson(phase2CheckpointPath, checkpoint);
  }
  if (checkpoint.targetCount !== targetCount) throw new Error("Phase2 target drift");
  validatePhase2Bindings(checkpoint, { phase1IndexSha256, ...bindings });
  for (const [filePath, expected] of [[phase2RecordsPath, checkpoint.records], [phase2FailuresPath, checkpoint.failures]]) assertFileState(filePath, expected);
  if (checkpoint.nextIndex === pages.length) {
    if (cacheKey(fs.readFileSync(phase2SummaryPath)) !== checkpoint.summarySha256) throw new Error("Phase2 summary drift");
    return JSON.parse(fs.readFileSync(phase2SummaryPath, "utf8"));
  }
  for (let index = checkpoint.nextIndex; index < pages.length; index += 1) {
    const page = pages[index];
    let result;
    try { result = await fetchPage(page.pageUrl); } catch (error) { if (error.safetyStop) throw error; result = { statusClass: "fetch-failure", bytes: 0 }; }
    checkpoint.counts.bytes += result.bytes;
    if (result.statusClass === "http-2xx") {
      checkpoint.counts.http2xx += 1;
      try { appendJsonLine(phase2RecordsPath, parsePublicSkillMetadata(result.html, page.pageUrl, new Date().toISOString(), runId)); checkpoint.counts.parsed += 1; checkpoint.batchCounts.consecutiveFailures = 0; }
      catch { appendJsonLine(phase2FailuresPath, { externalId: page.externalId, pageUrl: page.pageUrl, statusClass: "parse-failure", runId }); checkpoint.counts.parseFailure += 1; checkpoint.batchCounts.parseFailure += 1; checkpoint.batchCounts.consecutiveFailures += 1; }
    } else {
      appendJsonLine(phase2FailuresPath, { externalId: page.externalId, pageUrl: page.pageUrl, statusClass: result.statusClass, runId });
      if (result.statusClass === "http-404") checkpoint.counts.http404 += 1;
      if (result.statusClass === "fetch-failure") checkpoint.counts.fetchFailure += 1;
      if (result.statusClass === "redirect-boundary") checkpoint.counts.redirectBoundary += 1;
      if (result.statusClass === "fetch-failure") checkpoint.batchCounts.fetchFailure += 1; else checkpoint.batchCounts.otherFailure += 1;
      checkpoint.batchCounts.consecutiveFailures += 1;
    }
    checkpoint.nextIndex = index + 1;
    checkpoint.batchCounts.completed += 1;
    checkpoint.records = fileState(phase2RecordsPath); checkpoint.failures = fileState(phase2FailuresPath);
    atomicJson(phase2CheckpointPath, checkpoint);
    const stopReason = phase2BatchStopReason(checkpoint.batchCounts);
    if (stopReason) { atomicJson(path.join(phase2Directory, "stopped.json"), { stopped: true, statusClass: stopReason, completed: checkpoint.batchCounts.completed }); throw Object.assign(new Error(`Phase2 safety stop: ${stopReason}`), { safetyStop: true }); }
    if (checkpoint.nextIndex % 500 === 0) process.stdout.write(`${JSON.stringify({ progress: checkpoint.nextIndex, counts: checkpoint.counts })}\n`);
    await sleep(phase2RateMs);
  }
  const summary = { candidateOnly: true, status: "metadata-observed-unreviewed", runId, targetCount: pages.length, concurrency: 1, minimumDelayMs: phase2RateMs, requestTimeoutMs: 20000, counts: checkpoint.counts, records: checkpoint.records, failures: checkpoint.failures, observedAt: checkpoint.observedAt, completedAt: new Date().toISOString() };
  atomicJson(phase2SummaryPath, summary);
  checkpoint.summarySha256 = cacheKey(fs.readFileSync(phase2SummaryPath)); atomicJson(phase2CheckpointPath, checkpoint);
  return summary;
}

function compactPhase2() {
  const checkpoint = JSON.parse(fs.readFileSync(phase2CheckpointPath, "utf8"));
  if (checkpoint.nextIndex !== checkpoint.targetCount) throw new Error("Phase2 is incomplete");
  const read = (filePath) => fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const records = new Map(read(phase2RecordsPath).map((row) => [row.externalId, row]));
  const failures = new Map(read(phase2FailuresPath).map((row) => [row.externalId, row]));
  for (const key of records.keys()) if (failures.has(key)) throw new Error(`Phase2 outcome conflict: ${key}`);
  if (records.size + failures.size !== checkpoint.targetCount) throw new Error("Phase2 outcome count mismatch");
  atomicNdjson(phase2RecordsPath, [...records.values()]); atomicNdjson(phase2FailuresPath, [...failures.values()]);
  checkpoint.records = fileState(phase2RecordsPath); checkpoint.failures = fileState(phase2FailuresPath);
  const prior = JSON.parse(fs.readFileSync(phase2SummaryPath, "utf8"));
  const pages = fs.readFileSync(indexPath, "utf8").split(/\r?\n/).filter(Boolean).slice(0, checkpoint.targetCount).map(JSON.parse);
  const bindings = phase2Bindings(pages);
  Object.assign(checkpoint, bindings);
  const summary = { ...prior, ...bindings, configuredConcurrency: 1, observedMaximumConcurrency: 2, concurrencyNote: "executor timeout left a prior process briefly active; final outputs were locally compacted to one outcome per input", acceptedResponseBytes: checkpoint.counts.bytes, records: checkpoint.records, failures: checkpoint.failures };
  delete summary.concurrency;
  atomicJson(phase2SummaryPath, summary); checkpoint.summarySha256 = cacheKey(fs.readFileSync(phase2SummaryPath)); atomicJson(phase2CheckpointPath, checkpoint);
  return summary;
}

function assertFileState(filePath, expected) {
  const actual = fileState(filePath);
  for (const key of ["bytes", "sha256", "lines"]) if (actual[key] !== expected[key]) throw new Error(`Phase2 ${key} drift: ${filePath}`);
}

function phase2Bindings(pages) {
  return { inputManifestSha256: phase2InputManifestHash(pages), parserArtifactSha256: cacheKey(fs.readFileSync(parserArtifactPath)), parserSchema: "phase2-minimal-v2" };
}

function migratePhase2ParserLocal() {
  if (inspectPhase2StopMarker(path.join(phase2Directory, "stopped.json"))) throw new Error("Phase2 stop marker blocks parser migration");
  const lockStat = fs.lstatSync(phase2LockPath);
  if (!lockStat.isFile() || lockStat.isSymbolicLink() || fs.realpathSync(phase2LockPath) !== path.resolve(phase2LockPath)) throw new Error("unsafe Phase2 owner lock");
  const owner = JSON.parse(fs.readFileSync(phase2LockPath, "utf8"));
  if (JSON.stringify(Object.keys(owner).sort()) !== JSON.stringify(["parserSchema", "pid", "runId", "runToken"]) || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error("invalid Phase2 owner lock schema");
  try { process.kill(owner.pid, 0); throw new Error("Phase2 owner PID is still live"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  const checkpoint = JSON.parse(fs.readFileSync(phase2CheckpointPath, "utf8"));
  for (const [filePath, expected] of [[phase2RecordsPath, checkpoint.records], [phase2FailuresPath, checkpoint.failures]]) assertFileState(filePath, expected);
  const indexBytes = fs.readFileSync(indexPath);
  const pages = indexBytes.toString("utf8").split(/\r?\n/).filter(Boolean).slice(0, checkpoint.targetCount).map(JSON.parse);
  const migrated = validatePhase2ParserMigration(checkpoint, { phase1IndexSha256: cacheKey(indexBytes), inputManifestSha256: phase2InputManifestHash(pages), parserArtifactSha256: cacheKey(fs.readFileSync(parserArtifactPath)), parserSchema: "phase2-minimal-v2" });
  atomicJson(phase2CheckpointPath, migrated);
  return { migrated: true, parserArtifactSha256: migrated.parserArtifactSha256, metadataFetched: 0 };
}

function shardFile(shardUrl) {
  return path.join(shardDirectory, `${path.basename(new URL(shardUrl).pathname, ".xml")}.ndjson`);
}

function writeShard(shardUrl, rows) {
  fs.mkdirSync(shardDirectory, { recursive: true });
  const filePath = shardFile(shardUrl);
  const temporary = `${filePath}.${process.pid}.tmp`;
  const descriptor = fs.openSync(temporary, "w");
  try { fs.writeFileSync(descriptor, rows.map((row) => JSON.stringify(canonicalSkillRecord(row))).join("\n") + (rows.length ? "\n" : ""), "utf8"); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.renameSync(temporary, filePath);
}

function inspectShard(shardUrl) {
  const filePath = shardFile(shardUrl);
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`unsafe shard artifact: ${filePath}`);
  const bytes = fs.readFileSync(filePath);
  if (bytes.length && bytes.at(-1) !== 0x0a) throw new Error(`partial shard NDJSON tail: ${filePath}`);
  const lines = bytes.toString("utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const row = JSON.parse(line);
    if (JSON.stringify(Object.keys(row)) !== JSON.stringify(["externalId", "pageUrl", "lastmod", "discoveredVia", "status"])) throw new Error(`invalid shard record shape: ${filePath}`);
    if (row.pageUrl !== assertPublicUrl(row.pageUrl) || row.externalId !== new URL(row.pageUrl).pathname.split("/").at(-1) || row.discoveredVia !== "cocoloop" || row.status !== "discovered-unreviewed") throw new Error(`invalid shard record: ${filePath}`);
  }
  return { outputSha256: cacheKey(bytes), outputBytes: bytes.length, lineCount: lines.length };
}

function verifyShard(shardUrl, expected) {
  const actual = inspectShard(shardUrl);
  for (const field of ["outputSha256", "outputBytes", "lineCount"]) if (actual[field] !== expected[field]) throw new Error(`shard ${field} drift: ${shardUrl}`);
  return actual;
}

function shardAggregate(shardUrls, checkpoint) {
  return cacheKey(JSON.stringify(shardUrls.map((url) => [url, checkpoint.completedShards[url]])));
}

function compactLegacyCheckpoint(checkpoint) {
  for (const [shardUrl, entry] of Object.entries(checkpoint.completedShards || {})) {
    if (Array.isArray(entry.rows)) {
      writeShard(shardUrl, entry.rows);
      checkpoint.completedShards[shardUrl] = { rowCount: entry.rowCount, sourceHash: entry.sourceHash };
    }
  }
  return checkpoint;
}

function buildIndex(shardUrls) {
  const seenUrls = new Map();
  const seenIds = new Map();
  let entryCount = 0; let duplicateCount = 0; let missingExternalId = 0; let missingLastmod = 0;
  const temporary = `${indexPath}.${process.pid}.tmp`;
  const output = fs.openSync(temporary, "w");
  try {
    for (const shardUrl of shardUrls) {
      for (const line of fs.readFileSync(shardFile(shardUrl), "utf8").split(/\r?\n/).filter(Boolean)) {
        const row = JSON.parse(line); entryCount += 1;
        if (!row.externalId) missingExternalId += 1;
        const priorId = seenUrls.get(row.pageUrl); const priorUrl = seenIds.get(row.externalId);
        if (priorId && priorId !== row.externalId) throw new Error(`canonical URL conflict: ${row.pageUrl}`);
        if (priorUrl && priorUrl !== row.pageUrl) throw new Error(`external ID conflict: ${row.externalId}`);
        if (priorId) { duplicateCount += 1; continue; }
        seenUrls.set(row.pageUrl, row.externalId); seenIds.set(row.externalId, row.pageUrl);
        if (!row.lastmod) missingLastmod += 1;
        fs.writeSync(output, `${JSON.stringify(row)}\n`);
      }
    }
    fs.fsyncSync(output);
  } finally { fs.closeSync(output); }
  fs.renameSync(temporary, indexPath);
  return { entryCount, uniqueCount: seenUrls.size, duplicateCount, missingExternalId, missingLastmod };
}

function finalizeLocal(checkpoint, shardUrls) {
  for (const shardUrl of shardUrls) checkpoint.completedShards[shardUrl] = { ...checkpoint.completedShards[shardUrl], ...inspectShard(shardUrl) };
  checkpoint.shardOutputAggregateSha256 = shardAggregate(shardUrls, checkpoint);
  const stats = buildIndex(shardUrls);
  const finalBytes = fs.readFileSync(indexPath);
  checkpoint.outputOffset = finalBytes.length;
  checkpoint.outputPrefixHash = cacheKey(finalBytes);
  checkpoint.indexOutputSha256 = cacheKey(finalBytes);
  checkpoint.nextShard = null;
  checkpoint.completedShardCount = shardUrls.length;
  checkpoint.discoveredCount = Object.values(checkpoint.completedShards).reduce((sum, value) => sum + value.lineCount, 0);
  const previous = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, "utf8")) : {};
  const summary = { sourcePlatform: "cocoloop", statusClass: "discovered-unreviewed", sitemapIndex: checkpoint.sitemapIndex, shardCount: shardUrls.length, ...stats, errorCount: 0, observedAt: previous.observedAt || new Date().toISOString(), canonicalSourcePolicy: "original-author-only; unresolved stays candidate-only", metadataDetailsFetched: 0, shardOutputAggregateSha256: checkpoint.shardOutputAggregateSha256 };
  atomicJson(summaryPath, summary);
  checkpoint.summarySha256 = cacheKey(fs.readFileSync(summaryPath));
  atomicJson(checkpointPath, checkpoint);
  return summary;
}

function verifyComplete(checkpoint, shardUrls) {
  if (checkpoint.completedShardCount !== shardUrls.length || checkpoint.nextShard !== null || !checkpoint.shardOutputAggregateSha256) return null;
  for (const shardUrl of shardUrls) verifyShard(shardUrl, checkpoint.completedShards[shardUrl]);
  if (shardAggregate(shardUrls, checkpoint) !== checkpoint.shardOutputAggregateSha256) throw new Error("shard output aggregate drift");
  const indexBytes = fs.readFileSync(indexPath);
  if (cacheKey(indexBytes) !== checkpoint.indexOutputSha256) throw new Error("final index hash drift");
  if (cacheKey(fs.readFileSync(summaryPath)) !== checkpoint.summarySha256) throw new Error("summary hash drift");
  return JSON.parse(fs.readFileSync(summaryPath, "utf8"));
}

async function runIndex() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const robots = await fetchText(new URL("/robots.txt", baseUrl).toString(), "text");
  const declared = parseRobotsTxt(robots.text).map((url) => assertPublicUrl(url));
  const indexUrl = declared.find((url) => new URL(url).pathname.endsWith("sitemap-index.xml")) || assertPublicUrl(new URL("/sitemap-index.xml", baseUrl).toString());
  const index = await fetchText(indexUrl, "xml");
  const shardUrls = parseSitemapIndexXml(index.text, index.url, new URL(baseUrl).hostname);
  const indexHash = cacheKey(index.text);
  const shardManifestHash = cacheKey(JSON.stringify(shardUrls));
  let checkpoint = fs.existsSync(checkpointPath) ? compactLegacyCheckpoint(JSON.parse(fs.readFileSync(checkpointPath, "utf8"))) : { version: 1, sitemapIndex: indexUrl, completedShards: {} };
  if (checkpoint.sitemapIndex !== indexUrl) checkpoint = { version: 1, sitemapIndex: indexUrl, completedShards: {} };
  const outputBytes = fs.existsSync(indexPath) ? fs.readFileSync(indexPath) : Buffer.alloc(0);
  if (checkpoint.indexHash) validateCheckpoint(checkpoint, { indexHash, shardManifestHash, outputBytes });
  const completed = verifyComplete(checkpoint, shardUrls);
  if (completed) return completed;
  checkpoint.indexHash = indexHash;
  checkpoint.shardManifestHash = shardManifestHash;
  checkpoint.shardCount = shardUrls.length;
  checkpoint.outputOffset = outputBytes.length;
  checkpoint.outputPrefixHash = cacheKey(outputBytes);
  atomicJson(checkpointPath, checkpoint);
  for (const shardUrl of checkpointPlan(shardUrls, checkpoint)) {
    const shard = await fetchText(shardUrl, "xml");
    const parsed = parseSkillSitemapXml(shard.text, shard.url, new URL(baseUrl).hostname);
    writeShard(shardUrl, parsed);
    checkpoint.completedShards[shardUrl] = { rowCount: parsed.length, sourceHash: `sha256:${cacheKey(shard.text)}`, ...inspectShard(shardUrl) };
    checkpoint.nextShard = shardUrls.find((url) => !Object.hasOwn(checkpoint.completedShards, url)) || null;
    checkpoint.completedShardCount = Object.keys(checkpoint.completedShards).length;
    checkpoint.discoveredCount = Object.values(checkpoint.completedShards).reduce((sum, value) => sum + value.rowCount, 0);
    atomicJson(checkpointPath, checkpoint);
    await sleep(rateMs);
  }
  return finalizeLocal(checkpoint, shardUrls);
}

let summary;
if (process.argv.includes("--phase2-migrate-parser-local")) summary = migratePhase2ParserLocal();
else if (process.argv.includes("--phase2-compact-local")) summary = compactPhase2();
else if (process.argv.includes("--phase2-first1000")) {
  const runToken = crypto.randomUUID();
  summary = await runWithPhase2Owner(phase2LockPath, { pid: process.pid, runToken, runId: "phase2-first1000-2026-08-14", parserSchema: "phase2-minimal-v2" }, path.join(phase2Directory, "stopped.json"), () => runPhase2());
}
else if (process.argv.includes("--phase2-first5000")) {
  const runToken = crypto.randomUUID();
  summary = await runWithPhase2Owner(phase2LockPath, { pid: process.pid, runToken, runId: "phase2-first1000-2026-08-14", parserSchema: "phase2-minimal-v2" }, path.join(phase2Directory, "stopped.json"), () => runPhase2(5000));
}
else if (process.argv.includes("--repair-local")) {
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  const shardUrls = Object.keys(checkpoint.completedShards);
  summary = verifyComplete(checkpoint, shardUrls) || finalizeLocal(checkpoint, shardUrls);
} else summary = await runIndex();
process.stdout.write(`${JSON.stringify({ summary, metadataFetched: 0 }, null, 2)}\n`);
