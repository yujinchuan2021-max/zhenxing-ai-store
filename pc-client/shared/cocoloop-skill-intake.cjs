const crypto = require("node:crypto");
const fs = require("node:fs");
const { parsePublicSkillMetadata: stableParsePublicSkillMetadata } = require("./cocoloop-skill-metadata-parser.cjs");

const DEFAULT_HOST = "hub.cocoloop.cn";
const API_PREFIX = "/api/";
const CANONICAL_SCENARIO_TAGS = [
  "编程", "Agent", "多Agent", "自动化", "办公", "数据", "科研", "知识库", "内容", "图像", "视频音频", "3D/CAD", "游戏", "营销", "电商", "财务", "教育", "健康", "安全运维", "社交", "浏览器采集"
];

const SCENARIO_ALIASES = new Map([
  ["编程", ["code", "coding", "developer", "programming", "software"]],
  ["Agent", ["agent", "agents", "assistant", "ai agent"]],
  ["多Agent", ["multi-agent", "multi agent", "multiagent", "swarm"]],
  ["自动化", ["automation", "workflow", "workflows", "rpa"]],
  ["办公", ["office", "productivity", "document", "docs", "spreadsheet"]],
  ["数据", ["data", "database", "sql", "analytics"]],
  ["科研", ["research", "science", "academic"]],
  ["知识库", ["knowledge", "knowledge base", "memory", "rag"]],
  ["内容", ["content", "writing", "copywriting", "markdown"]],
  ["图像", ["image", "images", "photo", "vision"]],
  ["视频音频", ["video", "audio", "music", "voice"]],
  ["3D/CAD", ["3d", "cad", "mesh", "modeling"]],
  ["游戏", ["game", "games", "gaming", "game-development", "game development"]],
  ["营销", ["marketing", "seo", "advertising"]],
  ["电商", ["ecommerce", "e-commerce", "shop", "commerce"]],
  ["财务", ["finance", "financial", "trading", "accounting"]],
  ["教育", ["education", "learning", "teaching", "course"]],
  ["健康", ["health", "medical", "wellness"]],
  ["安全运维", ["security", "devops", "sre", "operations", "infrastructure"]],
  ["社交", ["social", "community", "messaging"]],
  ["浏览器采集", ["browser", "scraping", "crawler", "web research", "web extraction"]]
]);

const AGENT_COMPATIBILITY_ALIASES = new Map([
  ["Codex", ["codex", "openai codex"]],
  ["Claude Code", ["claude code", "claude-code"]],
  ["Claude Desktop", ["claude desktop", "claude-desktop"]],
  ["Cursor", ["cursor", "cursor desktop", "cursor-desktop"]],
  ["OpenClaw", ["openclaw", "clawhub"]],
  ["Hermes", ["hermes", "hermes agent", "nous hermes"]],
  ["Gemini CLI", ["gemini", "gemini cli", "gemini-cli"]],
  ["OpenCode", ["opencode", "open code"]],
  ["Cline", ["cline"]],
  ["GitHub Copilot", ["github copilot", "copilot"]]
]);

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function text(value) {
  return decodeEntities(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function publicCocoLoopUrl(value, baseUrl, host = DEFAULT_HOST) {
  let url;
  try {
    url = new URL(value, baseUrl);
  } catch {
    return null;
  }
  const publicPath =
    url.pathname === "/robots.txt" ||
    url.pathname === "/sitemap-index.xml" ||
    /^\/sitemaps\/skills-[1-9]\d*\.xml$/.test(url.pathname) ||
    /^\/skills\/[1-9]\d*\/?$/.test(url.pathname);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== host || url.search || url.hash || !publicPath) return null;
  url.hash = "";
  return url.toString();
}

function tagValues(xml, tag) {
  const expression = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(expression)].map((match) => text(match[1]));
}

function strictSitemapEntries(xml, rootTag, entryTag) {
  let value = String(xml || "").replace(/^\uFEFF/, "").trim();
  value = value.replace(/^<\?xml\s[^?]*\?>\s*/i, "");
  const root = value.match(new RegExp(`^<${rootTag}(?:\\s[^>]*)?>([\\s\\S]*)<\\/${rootTag}>$`, "i"));
  if (!root) throw new Error(`invalid or truncated ${rootTag} XML`);
  const body = root[1];
  const expression = new RegExp(`<${entryTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${entryTag}>`, "gi");
  const entries = [...body.matchAll(expression)];
  if (body.replace(expression, "").trim()) throw new Error(`unparsed content in ${rootTag}`);
  const seen = new Set();
  return entries.map((match) => {
    const locs = tagValues(match[1], "loc");
    if (locs.length !== 1) throw new Error(`${entryTag} must contain exactly one loc`);
    if (match[1].replace(/<(?:loc|lastmod)(?:\s[^>]*)?>[\s\S]*?<\/(?:loc|lastmod)>/gi, "").trim()) throw new Error(`unparsed content in ${entryTag}`);
    if (seen.has(locs[0])) throw new Error(`duplicate loc: ${locs[0]}`);
    seen.add(locs[0]);
    return { block: match[1], loc: locs[0] };
  });
}

function parseRobotsTxt(content) {
  return [...String(content || "").matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)].map((match) => match[1]);
}

function parseSitemapIndexXml(xml, baseUrl, host = DEFAULT_HOST) {
  const ignored = new Set([`https://${host}/sitemap.xml`, `https://${host}/sitemaps/topics.xml`]);
  const values = strictSitemapEntries(xml, "sitemapindex", "sitemap").map(({ loc }) => {
    let parsed;
    try { parsed = new URL(loc, baseUrl); } catch { throw new Error(`invalid sitemap loc: ${loc}`); }
    if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== host || parsed.search || parsed.hash) throw new Error(`invalid sitemap loc: ${loc}`);
    if (ignored.has(parsed.toString())) return null;
    const value = publicCocoLoopUrl(loc, baseUrl, host);
    if (!value || !/^\/sitemaps\/skills-[1-9]\d*\.xml$/.test(new URL(value).pathname)) throw new Error(`invalid Skill sitemap loc: ${loc}`);
    return value;
  }).filter(Boolean);
  if (new Set(values).size !== values.length) throw new Error("duplicate canonical sitemap loc");
  return values;
}

async function readBodyBytes(response, limit = 2_000_000) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new Error("public response exceeds byte limit");
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error("response body reader unavailable");
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel("byte limit exceeded"); throw new Error("public response exceeds byte limit"); }
      chunks.push(value);
    }
  } catch (error) {
    if (total <= limit) await reader.cancel("reader error").catch(() => {});
    throw error;
  }
  const result = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

function splitTokens(value) {
  return String(value || "").split(/[,;|/\n]+/).map((item) => item.trim()).filter(Boolean);
}

function normalizeScenarioTags(rawTags) {
  const mappingEvidence = [];
  const normalized = new Set();
  for (const rawTag of rawTags) {
    const lower = rawTag.toLowerCase();
    for (const [canonical, aliases] of SCENARIO_ALIASES) {
      const alias = aliases.slice().sort((left, right) => right.length - left.length).find((candidate) => lower === candidate || lower.includes(candidate));
      if (alias) {
        normalized.add(canonical);
        mappingEvidence.push({ rawTag, canonicalTag: canonical, matchedAlias: alias });
      }
    }
  }
  return { normalizedTags: CANONICAL_SCENARIO_TAGS.filter((tag) => normalized.has(tag)), mappingEvidence };
}

function normalizeAgentCompatibility(rawValues) {
  const normalized = new Set();
  const mappingEvidence = [];
  for (const rawValue of rawValues) {
    const lower = rawValue.toLowerCase();
    for (const [canonical, aliases] of AGENT_COMPATIBILITY_ALIASES) {
      const alias = aliases.slice().sort((left, right) => right.length - left.length).find((candidate) => lower === candidate || lower.includes(candidate));
      if (alias) {
        normalized.add(canonical);
        mappingEvidence.push({ rawValue, canonicalValue: canonical, matchedAlias: alias });
      }
    }
  }
  return { normalizedCompatibility: [...normalized], mappingEvidence };
}

function parseSkillSitemapXml(xml, sitemapUrl, host = DEFAULT_HOST) {
  const values = strictSitemapEntries(xml, "urlset", "url").map(({ block, loc }) => {
    const pageUrl = publicCocoLoopUrl(loc, sitemapUrl, host);
    if (!pageUrl) throw new Error(`invalid Skill loc: ${loc}`);
    const idMatch = new URL(pageUrl).pathname.match(/^\/skills\/([^/]+)\/?$/i);
    if (!idMatch) throw new Error(`missing external ID: ${pageUrl}`);
    return {
      externalId: decodeURIComponent(idMatch[1]),
      pageUrl,
      lastmod: tagValues(block, "lastmod")[0] || null,
      discoveredVia: "cocoloop"
    };
  });
  if (new Set(values.map((row) => row.pageUrl)).size !== values.length) throw new Error("duplicate canonical Skill loc");
  return values;
}

function attr(tag, name) {
  const match = String(tag || "").match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function metaValue(html, key) {
  const expression = new RegExp(`<meta[^>]+(?:name|property|itemprop)\\s*=\\s*["']${key}["'][^>]*>`, "i");
  const reverse = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+(?:name|property|itemprop)\\s*=\\s*["']${key}["'][^>]*>`, "i");
  const direct = String(html || "").match(expression);
  const tag = direct ? direct[0] : String(html || "").match(new RegExp(`<meta[^>]+(?:name|property|itemprop)\\s*=\\s*["']${key}["'][^>]*>`, "i"))?.[0];
  return tag ? attr(tag, "content") : (String(html || "").match(reverse)?.[1] || "");
}

function jsonLdObjects(html) {
  return [...String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => {
    try {
      const value = JSON.parse(match[1].trim());
      return Array.isArray(value) ? value : [value];
    } catch {
      return [];
    }
  });
}

function strictJsonLdObjects(html) {
  return [...String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => {
    let value;
    try { value = JSON.parse(match[1].trim()); } catch { throw new Error("invalid JSON-LD"); }
    return Array.isArray(value) ? value : [value];
  });
}

function parseSkillHtml(html, pageUrl, observedAt = new Date().toISOString()) {
  const objects = jsonLdObjects(html);
  const data = objects.find((value) => value && (value["@type"] === "SoftwareApplication" || value["@type"] === "Product" || value.name)) || {};
  const author = typeof data.author === "string" ? data.author : data.author?.name;
  const aggregate = data.aggregateRating || {};
  const rawTags = [...new Set([
    ...splitTokens(metaValue(html, "keywords")),
    ...splitTokens(metaValue(html, "tags")),
    ...splitTokens(data.keywords),
    ...[...String(html || "").matchAll(/\bdata-(?:tags|category)=["']([^"']+)["']/gi)].flatMap((match) => splitTokens(match[1]))
  ])];
  const tagMapping = normalizeScenarioTags(rawTags);
  const rawAgentCompatibility = [...new Set([
    ...splitTokens(metaValue(html, "agent-compatibility")),
    ...splitTokens(metaValue(html, "compatibility")),
    ...splitTokens(data.softwareRequirements),
    ...splitTokens(data.operatingSystem)
  ])];
  const compatibilityMapping = normalizeAgentCompatibility(rawAgentCompatibility);
  const allLinks = [...String(html || "").matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => { try { return new URL(match[1], pageUrl).toString(); } catch { return null; } }).filter(Boolean);
  const externalLinks = allLinks.filter((url) => !/(^|\.)cocoloop\.(?:com|cn)$/i.test(new URL(url).hostname));
  const canonicalSourceCandidates = externalLinks.filter((url) => /github\.com|gitlab\.com|npmjs\.com|pypi\.org|sourceforge\.net/i.test(url));
  const zipUrls = allLinks.filter((url) => /\.zip(?:$|[?#])/i.test(url));
  const idMatch = new URL(pageUrl).pathname.match(/^\/skills\/([^/]+)\/?$/i);
  return {
    externalId: idMatch ? decodeURIComponent(idMatch[1]) : null,
    pageUrl,
    observedAt,
    name: data.name || metaValue(html, "og:title") || text(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
    description: data.description || metaValue(html, "description") || metaValue(html, "og:description"),
    version: data.version || metaValue(html, "version") || null,
    authorDisplay: author || metaValue(html, "author") || null,
    category: data.category || metaValue(html, "category") || null,
    rawTags,
    normalizedTags: tagMapping.normalizedTags,
    mappingEvidence: tagMapping.mappingEvidence,
    agentCompatibility: {
      raw: rawAgentCompatibility,
      normalized: compatibilityMapping.normalizedCompatibility,
      mappingEvidence: compatibilityMapping.mappingEvidence
    },
    matureAgentEcosystemCandidate: /hermes/i.test(`${data.name || ""} ${author || ""} ${rawAgentCompatibility.join(" ")}`),
    externalReference: {
      ratingValue: aggregate.ratingValue || null,
      ratingCount: aggregate.ratingCount || null,
      stars: metaValue(html, "rating") || null,
      installCount: metaValue(html, "install-count") || null,
      favorites: metaValue(html, "favorites") || null,
      cls: metaValue(html, "cls") || null,
      sourcePlatform: "cocoloop",
      observedAt
    },
    securityDeclaration: metaValue(html, "security") || (/(安全|security|scan|CLS)/i.test(text(html)) ? text(html).match(/[^.。]*(?:安全|security|scan|CLS)[^.。]*/i)?.[0] || null : null),
    zipUrls,
    canonicalSourceCandidates: [...new Set(canonicalSourceCandidates)],
    provenanceStatus: "provenance-unresolved",
    canonicalSource: null,
    licenseStatus: "unverified",
    sourcePlatform: "cocoloop",
    discoveredVia: "cocoloop"
  };
}

function parsePublicSkillMetadata(html, pageUrl, observedAt, runId) {
  const expected = publicCocoLoopUrl(pageUrl, `https://${DEFAULT_HOST}`, DEFAULT_HOST);
  if (!expected || !/^\/skills\/[1-9]\d*$/.test(new URL(expected).pathname)) throw new Error("invalid public Skill page URL");
  const canonicalTags = [...String(html || "").matchAll(/<link[^>]+rel=["']canonical["'][^>]*>/gi)].map((match) => match[0]);
  if (canonicalTags.length !== 1) throw new Error("canonical must be unique");
  const canonical = attr(canonicalTags[0], "href");
  if (publicCocoLoopUrl(canonical, expected, DEFAULT_HOST) !== expected) throw new Error("canonical page mismatch");
  const applications = strictJsonLdObjects(html).filter((value) => value && value["@type"] === "SoftwareApplication");
  if (applications.length !== 1) throw new Error("SoftwareApplication identity must be unique");
  const data = applications[0];
  for (const identity of [data.url, data["@id"]].filter(Boolean)) if (publicCocoLoopUrl(identity, expected, DEFAULT_HOST) !== expected) throw new Error("SoftwareApplication identity mismatch");
  if (data.identifier != null) {
    const identifier = typeof data.identifier === "object" ? data.identifier.value : data.identifier;
    if (String(identifier) !== new URL(expected).pathname.split("/").at(-1)) throw new Error("SoftwareApplication identifier mismatch");
  }
  const clean = (value, limit, field) => {
    const raw = decodeEntities(String(value || "").replace(/<[^>]*>/g, " "));
    if (/[\u0000-\u001F\u007F]/.test(raw) || raw.length > limit || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw) || /(?:\+?\d[\d ()-]{8,}\d)/.test(raw)) throw new Error(`unsafe ${field}`);
    return raw.replace(/\s+/g, " ").trim();
  };
  const pageTitleRaw = clean(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 240, "pageTitle");
  const pageTitle = pageTitleRaw.replace(/ \| Skill下载_CocoLoop商店$/, "");
  const title = clean(data.name, 160, "title");
  const summary = clean(data.description || metaValue(html, "description") || metaValue(html, "og:description"), 500, "summary");
  if (!title || !summary) throw new Error("required public metadata missing");
  const keywordValues = splitTokens(metaValue(html, "keywords"));
  if (keywordValues.length > 24) throw new Error("too many tags");
  const keywords = keywordValues.map((value) => clean(value, 60, "tag")).filter((value) => value && !/^(?:Skill技能下载|CocoLoop|AI Agent|Skills|Skill商店|OpenClaw|Molili|MCP|Claude|AI工具|智能体|技能市场|AI Agent Skills|龙虾技能|OpenClaw Skill技能)$/i.test(value)).slice(0, 12);
  const normalized = { externalId: new URL(expected).pathname.split("/").at(-1), pageUrl: expected, title, pageTitle, summary, tags: keywords };
  return { ...normalized, contentHash: `sha256:${cacheKey(JSON.stringify(normalized))}`, status: "metadata-observed-unreviewed", observedAt, runId };
}

function cacheKey(url) {
  return crypto.createHash("sha256").update(url).digest("hex");
}

function phase2InputManifestHash(pages) {
  return cacheKey(JSON.stringify(pages.map(({ externalId, pageUrl }) => [String(externalId), String(pageUrl)])));
}

function validatePhase2Bindings(checkpoint, current) {
  for (const key of ["phase1IndexSha256", "inputManifestSha256", "parserArtifactSha256", "parserSchema"])
    if (checkpoint[key] !== current[key]) throw new Error(`Phase2 ${key} drift`);
}

function validatePhase2Extension(checkpoint, pages, outcomeIds) {
  if (checkpoint.targetCount !== 1000 || checkpoint.nextIndex !== 1000 || pages.length !== 5000) throw new Error("Phase2 extension boundary invalid");
  if (checkpoint.inputManifestSha256 !== phase2InputManifestHash(pages.slice(0, 1000))) throw new Error("Phase2 extension prefix drift");
  const expected = new Set(pages.slice(0, 1000).map(({ externalId }) => String(externalId)));
  const actual = new Set(outcomeIds.map(String));
  if (actual.size !== outcomeIds.length) throw new Error("Phase2 extension duplicate outcome");
  if (actual.size !== expected.size || [...actual].some((id) => !expected.has(id))) throw new Error("Phase2 extension outcome prefix drift");
}

function phase2BatchStopReason(counts) {
  if (counts.consecutiveFailures >= 10) return "consecutive-failures";
  if (counts.completed >= 100 && counts.fetchFailure / counts.completed > 0.02) return "fetch-failure-rate";
  if (counts.completed >= 100 && counts.parseFailure / counts.completed > 0.01) return "parse-failure-rate";
  return null;
}

function replaceAtomicWithRetry(rename, temporary, destination, options = {}) {
  const attempts = options.attempts || 5;
  const wait = options.wait || ((milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds));
  for (let attempt = 1; ; attempt += 1) {
    try { return rename(temporary, destination); }
    catch (error) {
      if (!["EPERM", "EBUSY"].includes(error.code) || attempt >= attempts) throw error;
      wait(50 * attempt);
    }
  }
}

function planPhase2CheckpointReconcile(checkpoint, temporary, current) {
  for (const key of ["targetCount", "phase1IndexSha256", "inputManifestSha256", "parserArtifactSha256", "parserSchema", "batchStartIndex", "first1000InputManifestSha256"])
    if (temporary[key] !== checkpoint[key]) throw new Error(`reconcile binding drift: ${key}`);
  if (temporary.nextIndex !== checkpoint.nextIndex + 1) throw new Error("reconcile requires exactly one committed outcome");
  if (temporary.nextIndex > temporary.targetCount || temporary.batchCounts.completed !== checkpoint.batchCounts.completed + 1) throw new Error("reconcile progress drift");
  if (!current.oldPrefixesMatch) throw new Error("reconcile old outcome prefix drift");
  for (const key of ["records", "failures"])
    for (const field of ["bytes", "sha256", "lines"])
      if (temporary[key][field] !== current[key][field]) throw new Error(`reconcile artifact drift: ${key}.${field}`);
  if (current.extraOutcomes.length !== 1) throw new Error("reconcile outcome cardinality drift");
  const outcome = current.extraOutcomes[0];
  if (String(outcome.externalId) !== String(current.expectedInput.externalId) || outcome.pageUrl !== current.expectedInput.pageUrl) throw new Error("reconcile outcome identity drift");
  const recordAdded = temporary.records.lines === checkpoint.records.lines + 1 && temporary.failures.lines === checkpoint.failures.lines;
  if (!recordAdded || temporary.counts.http2xx !== checkpoint.counts.http2xx + 1 || temporary.counts.parsed !== checkpoint.counts.parsed + 1 || temporary.counts.parseFailure !== checkpoint.counts.parseFailure || temporary.counts.fetchFailure !== checkpoint.counts.fetchFailure || temporary.batchCounts.parseFailure !== checkpoint.batchCounts.parseFailure || temporary.batchCounts.fetchFailure !== checkpoint.batchCounts.fetchFailure || temporary.batchCounts.otherFailure !== checkpoint.batchCounts.otherFailure || temporary.batchCounts.consecutiveFailures !== 0 || temporary.counts.bytes < checkpoint.counts.bytes) throw new Error("reconcile counter drift");
  return { action: "promote-tmp", nextIndex: temporary.nextIndex };
}

function validatePhase2ParserMigration(checkpoint, current) {
  if (checkpoint.parserArtifactSha256 !== "f4b70082f622f5daf16f9b1a597dcecc005bac89059ef5ceaeac732c80b22e9c") throw new Error("Phase2 parser migration source not allowlisted");
  for (const key of ["phase1IndexSha256", "inputManifestSha256", "parserSchema"])
    if (checkpoint[key] !== current[key]) throw new Error(`Phase2 parser migration ${key} drift`);
  if (checkpoint.targetCount !== 5000 || checkpoint.nextIndex < 1000 || checkpoint.nextIndex > 5000) throw new Error("Phase2 parser migration checkpoint boundary invalid");
  if (current.parserArtifactSha256 !== "0182e734cfe891f340e7c630b99f5c321dcdd916b1cca83bf5fd515b143919b8") throw new Error("Phase2 parser migration target not allowlisted");
  return { ...checkpoint, parserArtifactSha256: current.parserArtifactSha256 };
}

function classifyPhase2HttpStatus(status) {
  if (status === 403) return "http-403-stop";
  if (status === 429) return "http-429-stop";
  if (status >= 300 && status < 400) return "redirect-boundary";
  if (status === 404) return "http-404";
  if (status >= 200 && status < 300) return "http-2xx";
  return "fetch-failure";
}

async function fetchPageWith(fetchImpl, value, maxResponseBytes = 2_000_000) {
  const pageUrl = publicCocoLoopUrl(value, `https://${DEFAULT_HOST}`, DEFAULT_HOST);
  if (!pageUrl || !/^\/skills\/[1-9]\d*$/.test(new URL(pageUrl).pathname)) throw new Error("blocked non-public CocoLoop Skill URL");
  const response = await fetchImpl(pageUrl, { redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { accept: "text/html,application/xhtml+xml;q=0.9", "user-agent": "AIHub-CocoLoop-Research/1.0 (+candidate-only; no-api)" } });
  const classification = classifyPhase2HttpStatus(response.status);
  if (classification === "http-403-stop" || classification === "http-429-stop") {
    const statusClass = response.status === 429 ? "http-429" : "http-403";
    throw Object.assign(new Error(`safety stop HTTP ${response.status}`), { safetyStop: true, stopRecord: { stopped: true, statusClass, externalId: new URL(pageUrl).pathname.split("/").at(-1) } });
  }
  if (classification === "redirect-boundary" || classification === "http-404") return { statusClass: classification, bytes: 0 };
  validatePublicResponse({ status: response.status, url: response.url, contentType: response.headers.get("content-type") || "" }, "html");
  if (response.url !== pageUrl) throw new Error("redirect final URL mismatch");
  const bytes = await readBodyBytes(response, maxResponseBytes);
  return { statusClass: "http-2xx", bytes: bytes.byteLength, html: new TextDecoder().decode(bytes) };
}

function acquireExclusiveLock(filePath, owner) {
  let descriptor;
  try { descriptor = fs.openSync(filePath, "wx"); } catch (error) { if (error.code === "EEXIST") throw new Error("owner lock exists; manual stale-lock review required"); throw error; }
  fs.writeFileSync(descriptor, `${JSON.stringify(owner)}\n`); fs.fsyncSync(descriptor); fs.closeSync(descriptor);
  return () => { const current = JSON.parse(fs.readFileSync(filePath, "utf8")); if (current.runToken !== owner.runToken) throw new Error("lock ownership changed"); fs.unlinkSync(filePath); };
}

function inspectPhase2StopMarker(filePath, fileSystem = fs) {
  if (!fileSystem.existsSync(filePath)) return null;
  const stat = fileSystem.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || (fileSystem.realpathSync && fileSystem.realpathSync(filePath) !== require("node:path").resolve(filePath))) throw new Error("unsafe Phase2 stop marker");
  let marker;
  try { marker = JSON.parse(fileSystem.readFileSync(filePath, "utf8")); } catch { throw new Error("invalid Phase2 stop marker JSON"); }
  const http = new Set(["http-403", "http-429"]);
  const threshold = new Set(["consecutive-failures", "fetch-failure-rate", "parse-failure-rate"]);
  const keys = Object.keys(marker).sort();
  const expected = http.has(marker.statusClass) ? ["externalId", "statusClass", "stopped"] : threshold.has(marker.statusClass) ? ["completed", "statusClass", "stopped"] : [];
  if (marker.stopped !== true || JSON.stringify(keys) !== JSON.stringify(expected.sort()) || (http.has(marker.statusClass) && !/^[1-9]\d*$/.test(String(marker.externalId))) || (threshold.has(marker.statusClass) && (!Number.isSafeInteger(marker.completed) || marker.completed < 0 || marker.completed > 4000))) throw new Error("invalid Phase2 stop marker schema");
  return marker;
}

async function runWithPhase2Owner(lockPath, owner, stopPath, task) {
  const release = acquireExclusiveLock(lockPath, owner);
  try {
    const marker = inspectPhase2StopMarker(stopPath);
    if (marker) throw Object.assign(new Error(`Phase2 stopped: ${marker.statusClass}`), { safetyStop: true, stopRecord: marker });
    return await task();
  } finally { release(); }
}

function canonicalSkillRecord(row) {
  return {
    externalId: String(row.externalId),
    pageUrl: new URL(row.pageUrl).toString().replace(/\/$/, ""),
    lastmod: row.lastmod || null,
    discoveredVia: "cocoloop",
    status: "discovered-unreviewed"
  };
}

function dedupeSkillRows(rows) {
  const byUrl = new Map();
  const byId = new Map();
  let duplicateCount = 0;
  for (const row of rows) {
    const record = canonicalSkillRecord(row);
    const prior = byUrl.get(record.pageUrl);
    const priorUrl = byId.get(record.externalId);
    if (prior && prior.externalId !== record.externalId) throw new Error(`canonical URL conflict: ${record.pageUrl}`);
    if (priorUrl && priorUrl !== record.pageUrl) throw new Error(`external ID conflict: ${record.externalId}`);
    if (prior) duplicateCount += 1;
    if (!prior || (!prior.lastmod && record.lastmod)) byUrl.set(record.pageUrl, record);
    byId.set(record.externalId, record.pageUrl);
  }
  return { rows: [...byUrl.values()], duplicateCount };
}

function checkpointPlan(shardUrls, checkpoint = {}) {
  const completed = checkpoint.completedShards || {};
  return shardUrls.filter((url) => !Object.hasOwn(completed, url));
}

function validatePublicResponse(response, kind, host = DEFAULT_HOST) {
  if (!publicCocoLoopUrl(response.url, `https://${host}`, host)) throw new Error(`redirect left public boundary: ${response.url}`);
  if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
  if (kind === "xml" && !/(?:application|text)\/xml/i.test(response.contentType || "")) throw new Error(`unexpected XML content type: ${response.contentType}`);
  if (kind === "html" && !/text\/html/i.test(response.contentType || "")) throw new Error(`unexpected HTML content type: ${response.contentType}`);
}

function validateCheckpoint(checkpoint, current) {
  if (checkpoint.indexHash !== current.indexHash) throw new Error("index hash drift");
  if (checkpoint.shardManifestHash !== current.shardManifestHash) throw new Error("shard manifest drift");
  if (checkpoint.outputOffset > current.outputBytes.length) throw new Error("partial output tail");
  if (checkpoint.outputOffset > 0 && current.outputBytes[checkpoint.outputOffset - 1] !== 0x0a) throw new Error("partial NDJSON tail");
  const prefix = cacheKey(current.outputBytes.subarray(0, checkpoint.outputOffset));
  if (checkpoint.outputPrefixHash !== prefix) throw new Error("output prefix drift");
}

module.exports = {
  API_PREFIX,
  acquireExclusiveLock,
  CANONICAL_SCENARIO_TAGS,
  DEFAULT_HOST,
  cacheKey,
  classifyPhase2HttpStatus,
  canonicalSkillRecord,
  checkpointPlan,
  dedupeSkillRows,
  fetchPageWith,
  inspectPhase2StopMarker,
  validateCheckpoint,
  validatePublicResponse,
  normalizeAgentCompatibility,
  normalizeScenarioTags,
  parseRobotsTxt,
  readBodyBytes,
  runWithPhase2Owner,
  parseSitemapIndexXml,
  parseSkillHtml,
  parsePublicSkillMetadata: stableParsePublicSkillMetadata,
  planPhase2CheckpointReconcile,
  phase2BatchStopReason,
  phase2InputManifestHash,
  parseSkillSitemapXml,
  publicCocoLoopUrl,
  replaceAtomicWithRetry,
  validatePhase2Bindings,
  validatePhase2Extension,
  validatePhase2ParserMigration
};
