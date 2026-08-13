const crypto = require("node:crypto");

const DEFAULT_HOST = "skill.cocoloop.com";
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
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== host || url.pathname.startsWith(API_PREFIX)) return null;
  url.hash = "";
  return url.toString();
}

function tagValues(xml, tag) {
  const expression = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(expression)].map((match) => text(match[1]));
}

function parseRobotsTxt(content) {
  return [...String(content || "").matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)].map((match) => match[1]);
}

function parseSitemapIndexXml(xml, baseUrl, host = DEFAULT_HOST) {
  return [...new Set(tagValues(xml, "loc").map((value) => publicCocoLoopUrl(value, baseUrl, host)).filter(Boolean))];
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
  const entries = [...String(xml || "").matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)];
  return entries.map((match) => {
    const block = match[1];
    const pageUrl = publicCocoLoopUrl(tagValues(block, "loc")[0], sitemapUrl, host);
    if (!pageUrl) return null;
    const idMatch = new URL(pageUrl).pathname.match(/^\/skills\/([^/]+)\/?$/i);
    return {
      externalId: idMatch ? decodeURIComponent(idMatch[1]) : null,
      pageUrl,
      lastmod: tagValues(block, "lastmod")[0] || null,
      discoveredVia: "cocoloop"
    };
  }).filter(Boolean);
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
  const externalLinks = allLinks.filter((url) => !url.includes("cocoloop.com"));
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

function cacheKey(url) {
  return crypto.createHash("sha256").update(url).digest("hex");
}

module.exports = {
  API_PREFIX,
  CANONICAL_SCENARIO_TAGS,
  DEFAULT_HOST,
  cacheKey,
  normalizeAgentCompatibility,
  normalizeScenarioTags,
  parseRobotsTxt,
  parseSitemapIndexXml,
  parseSkillHtml,
  parseSkillSitemapXml,
  publicCocoLoopUrl
};
