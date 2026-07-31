const HTML_ENTITY_REPLACEMENTS = Object.freeze({
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"'
});

const GENERIC_SOURCE_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "npmjs.com",
  "www.npmjs.com"
]);

const DISCOVERY_RULES = Object.freeze([
  { pattern: /(?:^|[\s/_-])(products?|solutions?)(?:$|[\s/_-])/i, weight: 5 },
  { pattern: /(?:^|[\s/_-])(download|desktop|windows|macos)(?:$|[\s/_-])/i, weight: 5 },
  { pattern: /(?:^|[\s/_-])(agent|agents|claw)(?:$|[\s/_-])/i, weight: 5 },
  { pattern: /(?:^|[\s/_-])(cli|command.line)(?:$|[\s/_-])/i, weight: 4 },
  { pattern: /(?:^|[\s/_-])(apps?|platform|studio|work)(?:$|[\s/_-])/i, weight: 3 },
  { pattern: /(?:^|[\s/_-])(features?|tools?|labs?)(?:$|[\s/_-])/i, weight: 2 },
  { pattern: /(?:^|[\s/_-])(docs?|help|guide|tutorial)(?:$|[\s/_-])/i, weight: 1 }
]);

const NOISE_PATTERN = /(?:privacy|terms|legal|cookie|security|careers?|jobs?|events?|login|sign[-_ ]?in|sign[-_ ]?up|pricing|contact|about|investors?|shareholders?|governance|site[-_ ]?map)(?:[\s/_-]|$)/i;
const RESEARCH_LEAD_PATTERN = /(?:^|\/)(?:blog|news|press|resources?|engineering|solutions?|features?|capabilities|docs?|help|support)(?:\/|$)/i;
const PRODUCT_SURFACE_PATTERN = /(?:^|\/)(?:products?\/[^/]+|download(?:\/|$)|apps?\/[^/]+)(?:\/|$)/i;
const AI_RELEVANCE_PATTERN = /\b(?:ai|agent|assistant|copilot|model|llm|chat|code|coding|studio|claw|gemini|claude|qwen|kimi|doubao|hunyuan)\b|(?:智能|模型|助手|代码|编程|千问|元宝|豆包)/i;

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, encoded) => {
      const radix = encoded[0].toLowerCase() === "x" ? 16 : 10;
      const digits = radix === 16 ? encoded.slice(1) : encoded;
      const codePoint = Number.parseInt(digits, radix);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/&([a-z]+);/gi, (entity, name) =>
      Object.hasOwn(HTML_ENTITY_REPLACEMENTS, name.toLowerCase())
        ? HTML_ENTITY_REPLACEMENTS[name.toLowerCase()]
        : entity
    );
}

function cleanText(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|ref$|source$|campaign$|locale$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function sourceScope(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const hostname = url.hostname.replace(/^www\./, "");
  let pathPrefix = "/";
  if (GENERIC_SOURCE_HOSTS.has(url.hostname)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const requiredSegments = hostname === "github.com" ? 2 : 2;
    if (segments.length < requiredSegments) return null;
    pathPrefix = `/${segments.slice(0, requiredSegments).join("/")}`;
  }
  return { hostname, pathPrefix };
}

function collectVendorSources(vendor) {
  const values = [vendor.website, vendor.tutorial];
  for (const product of vendor.products || []) {
    values.push(product.website, product.tutorial);
  }
  const urls = [];
  const scopes = [];
  const seenUrls = new Set();
  const seenScopes = new Set();
  for (const value of values) {
    const normalized = normalizeUrl(value);
    const scope = sourceScope(value);
    if (!normalized || !scope) continue;
    if (!seenUrls.has(normalized)) {
      seenUrls.add(normalized);
      urls.push(normalized);
    }
    const key = `${scope.hostname}${scope.pathPrefix}`;
    if (!seenScopes.has(key)) {
      seenScopes.add(key);
      scopes.push(scope);
    }
  }
  return { urls, scopes };
}

function isWithinScopes(value, scopes) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const url = new URL(normalized);
  const hostname = url.hostname.replace(/^www\./, "");
  return scopes.some(
    (scope) =>
      scope.hostname === hostname &&
      (scope.pathPrefix === "/" ||
        url.pathname === scope.pathPrefix ||
        url.pathname.startsWith(`${scope.pathPrefix}/`))
  );
}

function extractHtmlPage(html, pageUrl, scopes) {
  const source = String(html || "");
  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const descriptionMatch = source.match(
    /<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["'][^>]*>/i
  );
  const reverseDescriptionMatch = source.match(
    /<meta\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i
  );
  const links = [];
  const externalLinks = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of source.matchAll(anchorPattern)) {
    const url = normalizeUrl(match[1], pageUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const link = { url, text: cleanText(match[2]).slice(0, 240) };
    if (isWithinScopes(url, scopes)) links.push(link);
    else externalLinks.push(link);
  }
  return {
    title: cleanText(titleMatch?.[1]).slice(0, 300),
    description: cleanText(
      descriptionMatch?.[1] || reverseDescriptionMatch?.[1]
    ).slice(0, 500),
    links,
    externalLinks
  };
}

function parseSitemapXml(xml, sitemapUrl, scopes) {
  const urls = [];
  const seen = new Set();
  for (const match of String(xml || "").matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
    const value = normalizeUrl(cleanText(match[1]), sitemapUrl);
    if (!value || !isWithinScopes(value, scopes) || seen.has(value)) continue;
    seen.add(value);
    urls.push(value);
  }
  return urls;
}

function scoreDiscoveryLink(link, page = {}) {
  const value = `${link.url || ""} ${link.text || ""}`;
  if (NOISE_PATTERN.test(value)) return -10;
  let score = 0;
  for (const rule of DISCOVERY_RULES) {
    if (rule.pattern.test(value)) score += rule.weight;
  }
  const pathSegments = (() => {
    try {
      return new URL(link.url).pathname.split("/").filter(Boolean).length;
    } catch {
      return 99;
    }
  })();
  if (link.text && link.text.length >= 3 && link.text.length <= 80) score += 1;
  if (pathSegments >= 1 && pathSegments <= 3) score += 1;
  return score;
}

function discoveryDisposition(link) {
  const value = `${link.url || ""} ${link.text || ""}`;
  if (NOISE_PATTERN.test(value)) return "ignore";
  let url;
  try {
    url = new URL(link.url);
  } catch {
    return "ignore";
  }
  const productSurface = PRODUCT_SURFACE_PATTERN.test(url.pathname);
  const documentationHost = /(?:^|[-.])(?:docs?|help|support)\./i.test(
    url.hostname
  );
  const researchPath = RESEARCH_LEAD_PATTERN.test(url.pathname);
  const researchHost = /^(?:www\.)?blog\./i.test(url.hostname);
  const directDistribution =
    /\.(?:exe|msi|msix|dmg|pkg|deb|rpm|appimage|zip)(?:$|[?#])/i.test(link.url || "") ||
    /\/api\/desktop\//i.test(url.pathname) ||
    /\/download\/(?:linux|mac(?:os)?|windows)(?:\/|$)/i.test(url.pathname);
  const namedInstallSurface =
    /\b(download|desktop|windows app|mac app|command[ -]?line|\bcli\b)\b/i.test(
      value
    );
  const namedAgentSurface =
    /\b(?:[a-z0-9]+[ -])?(agent|claw|work|studio|code)\b/i.test(link.text || "") &&
    cleanText(link.text).length <= 80;
  const relevanceValue = `${url.pathname} ${link.text || ""}`;
  if (
    productSurface &&
    !documentationHost &&
    !researchPath &&
    !researchHost &&
    !directDistribution &&
    AI_RELEVANCE_PATTERN.test(relevanceValue)
  ) {
    return "candidate";
  }
  if (documentationHost || researchPath || researchHost || directDistribution) return "lead";
  if (namedInstallSurface || namedAgentSurface) return "candidate";
  return "lead";
}

function productTokens(value) {
  return cleanText(value)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3 && !["desktop", "web", "official"].includes(token));
}

function canonicalPathname(value) {
  const segments = String(value || "/").split("/").filter(Boolean);
  if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(segments[0] || "")) segments.shift();
  return segments.length > 0 ? `/${segments.join("/")}` : "/";
}

function baseDomain(hostname) {
  const segments = String(hostname || "").replace(/^www\./, "").split(".");
  return segments.length >= 2 ? segments.slice(-2).join(".") : segments[0];
}

function matchExistingProduct(link, products) {
  const candidateUrl = normalizeUrl(link.url);
  if (!candidateUrl) return null;
  const candidate = new URL(candidateUrl);
  const textTokens = new Set(productTokens(link.text));
  for (const product of products || []) {
    const productUrl = normalizeUrl(product.website);
    if (productUrl === candidateUrl) return product.id;
    if (productUrl) {
      const known = new URL(productUrl);
      const candidatePath = canonicalPathname(candidate.pathname);
      const knownPath = canonicalPathname(known.pathname);
      if (
        known.hostname.replace(/^www\./, "") ===
          candidate.hostname.replace(/^www\./, "") &&
        (candidatePath === knownPath ||
          (knownPath !== "/" && candidatePath.startsWith(`${knownPath}/`)) ||
          (candidatePath !== "/" && knownPath.startsWith(`${candidatePath}/`)))
      ) {
        return product.id;
      }
    }
    const tokens = productTokens(product.name);
    if (tokens.length > 0 && tokens.every((token) => textTokens.has(token))) {
      return product.id;
    }
  }
  const inferredType = inferProductType(link);
  if (inferredType === "desktop" || inferredType === "cli") {
    const compatible = (products || []).filter((product) =>
      inferredType === "desktop"
        ? String(product.productType || "").startsWith("desktop") ||
          product.productType === "local-model"
        : String(product.productType || "").includes("cli")
    );
    const related = compatible.filter((product) => {
      const productUrl = normalizeUrl(product.website);
      if (!productUrl) return false;
      const known = new URL(productUrl);
      return (
        baseDomain(known.hostname) === baseDomain(candidate.hostname) ||
        /^(?:download(?:\s+app)?|cli|windows|macos|linux)$/i.test(
          cleanText(link.text)
        )
      );
    });
    if (related.length === 1) return related[0].id;
    if (inferredType === "desktop") {
      const namedDesktop = compatible.filter((product) =>
        /\b(?:desktop|app)\b/i.test(product.name || "")
      );
      if (namedDesktop.length === 1) return namedDesktop[0].id;
    }
  }
  if (inferredType === "agent") {
    const relatedAgents = (products || []).filter((product) => {
      if (!/agent/i.test(`${product.name || ""} ${product.description || ""}`)) {
        return false;
      }
      const productUrl = normalizeUrl(product.website);
      return (
        productUrl &&
        baseDomain(new URL(productUrl).hostname) === baseDomain(candidate.hostname)
      );
    });
    if (relatedAgents.length === 1) return relatedAgents[0].id;
  }
  return null;
}

function inferProductType(link) {
  const value = `${link.url || ""} ${link.text || ""}`.toLowerCase();
  if (/\b(cli|command[ -]?line|terminal|npm|pip)\b/.test(value)) return "cli";
  if (/\b(desktop|windows|macos|download|installer)\b/.test(value)) {
    return "desktop";
  }
  if (/\b(agent|agents|claw)\b/.test(value)) return "agent";
  return "web-or-feature";
}

module.exports = {
  cleanText,
  collectVendorSources,
  discoveryDisposition,
  extractHtmlPage,
  inferProductType,
  isWithinScopes,
  matchExistingProduct,
  normalizeUrl,
  parseSitemapXml,
  scoreDiscoveryLink,
  sourceScope
};
