import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DEFAULT_HOST,
  cacheKey,
  parseRobotsTxt,
  parseSitemapIndexXml,
  parseSkillHtml,
  parseSkillSitemapXml,
  publicCocoLoopUrl
} = require("../shared/cocoloop-skill-intake.cjs");

const root = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.join(root, "output", "research", "cocoloop-skill-intake");
const cacheDirectory = path.join(outputDirectory, "cache");
const indexPath = path.join(outputDirectory, "candidate-index.ndjson");
const summaryPath = path.join(outputDirectory, "candidate-index-summary.json");
const baseUrl = process.argv.find((value) => value.startsWith("--base-url="))?.slice(11) || `https://${DEFAULT_HOST}`;
const rateMs = Math.max(250, Number(process.argv.find((value) => value.startsWith("--rate-ms="))?.slice(10) || 1500));
const retries = Math.max(0, Math.min(5, Number(process.argv.find((value) => value.startsWith("--retries="))?.slice(10) || 3)));
const metadata = process.argv.includes("--metadata");
const acknowledgeEstimate = process.argv.includes("--ack-estimate");
const limit = Math.max(1, Number(process.argv.find((value) => value.startsWith("--limit="))?.slice(8) || 20));

function assertPublicUrl(value) {
  const url = publicCocoLoopUrl(value, baseUrl, new URL(baseUrl).hostname);
  if (!url) throw new Error(`blocked non-public CocoLoop URL: ${value}`);
  return url;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function fetchText(url, kind) {
  const publicUrl = assertPublicUrl(url);
  if (new URL(publicUrl).pathname.startsWith("/api/")) throw new Error("/api/ is forbidden");
  fs.mkdirSync(cacheDirectory, { recursive: true });
  const cachePath = path.join(cacheDirectory, `${cacheKey(publicUrl)}.json`);
  if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(publicUrl, { headers: { accept: kind === "xml" ? "application/xml,text/xml;q=0.9" : "text/html,application/xhtml+xml;q=0.9", "user-agent": "AIHub-CocoLoop-Research/1.0 (+candidate-only; no-api)" } });
      const content = await response.text();
      if (content.length > 2_000_000) throw new Error("public response exceeds 2 MiB");
      const result = { url: publicUrl, status: response.status, contentType: response.headers.get("content-type") || "", observedAt: new Date().toISOString(), text: content };
      fs.writeFileSync(`${cachePath}.${process.pid}.tmp`, `${JSON.stringify(result)}\n`, "utf8");
      fs.renameSync(`${cachePath}.${process.pid}.tmp`, cachePath);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(2 ** attempt * 1000);
    }
  }
  throw lastError;
}

function indexStats(rows, shardUrls) {
  const seen = new Set(); let duplicates = 0; let missingExternalId = 0; let missingLastmod = 0;
  for (const row of rows) { if (seen.has(row.pageUrl)) duplicates += 1; seen.add(row.pageUrl); if (!row.externalId) missingExternalId += 1; if (!row.lastmod) missingLastmod += 1; }
  return { shardCount: shardUrls.length, entryCount: rows.length, uniqueCount: seen.size, duplicateCount: duplicates, missingExternalId, missingLastmod, observedAt: new Date().toISOString() };
}

async function runIndex() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const robots = await fetchText(new URL("/robots.txt", baseUrl).toString(), "text");
  const declared = parseRobotsTxt(robots.text).map((url) => assertPublicUrl(url));
  const indexUrl = declared.find((url) => new URL(url).pathname.endsWith("sitemap-index.xml")) || assertPublicUrl(new URL("/sitemap-index.xml", baseUrl).toString());
  const index = await fetchText(indexUrl, "xml");
  const shardUrls = parseSitemapIndexXml(index.text, index.url, new URL(baseUrl).hostname);
  const rows = [];
  for (const shardUrl of shardUrls) { const shard = await fetchText(shardUrl, "xml"); rows.push(...parseSkillSitemapXml(shard.text, shard.url, new URL(baseUrl).hostname)); await sleep(rateMs); }
  const deduped = [...new Map(rows.map((row) => [row.pageUrl, row])).values()];
  fs.writeFileSync(`${indexPath}.${process.pid}.tmp`, deduped.map((row) => JSON.stringify(row)).join("\n") + (deduped.length ? "\n" : ""), "utf8");
  fs.renameSync(`${indexPath}.${process.pid}.tmp`, indexPath);
  const summary = { sourcePlatform: "cocoloop", sitemapIndex: indexUrl, ...indexStats(rows, shardUrls), canonicalSourcePolicy: "original-author-only; unresolved stays candidate-only", metadataDetailsFetched: 0 };
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

function estimateMetadata(count) {
  const requests = Math.min(count, limit) + 2;
  const seconds = (Math.min(count, limit) + 1) * rateMs / 1000;
  return { pages: Math.min(count, limit), requestsIncludingBootstrap: requests, estimatedMinimumSeconds: Math.ceil(seconds), estimatedMinimumHours: Number((seconds / 3600).toFixed(2)), estimatedDiskBytesAt200KiBPerPage: Math.min(count, limit) * 200 * 1024 };
}

const summary = await runIndex();
const estimate = estimateMetadata(summary.uniqueCount);
if (metadata && !acknowledgeEstimate) {
  process.stdout.write(`${JSON.stringify({ summary, metadataEstimate: estimate, stopped: true, reason: "metadata crawl requires explicit --ack-estimate" }, null, 2)}\n`);
  process.exit(0);
}
if (metadata) {
  const rows = fs.readFileSync(indexPath, "utf8").trim().split(/\r?\n/).filter(Boolean).slice(0, limit).map((line) => JSON.parse(line));
  const details = [];
  for (const row of rows) { const page = await fetchText(row.pageUrl, "html"); details.push(parseSkillHtml(page.text, row.pageUrl, page.observedAt)); await sleep(rateMs); }
  fs.writeFileSync(path.join(outputDirectory, "metadata-sample.json"), `${JSON.stringify({ sourcePlatform: "cocoloop", candidateOnly: true, ...estimate, details }, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify({ summary, metadataEstimate: estimate, metadataFetched: metadata ? Math.min(summary.uniqueCount, limit) : 0 }, null, 2)}\n`);
