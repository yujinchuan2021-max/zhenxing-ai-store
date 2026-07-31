import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  collectVendorSources,
  discoveryDisposition,
  extractHtmlPage,
  inferProductType,
  matchExistingProduct,
  normalizeUrl,
  parseSitemapXml,
  scoreDiscoveryLink
} = require("../shared/catalog-discovery.cjs");

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const outputDirectory = path.join(root, "output", "catalog-research");
const jsonOutputPath = path.join(outputDirectory, "official-product-candidates.json");
const markdownOutputPath = path.join(
  outputDirectory,
  "official-product-candidates.md"
);
const vendorOutputDirectory = path.join(outputDirectory, "vendors");

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

const selectedVendorIds = new Set(
  argumentValue("vendors", "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const maxPages = Math.max(
  1,
  Math.min(30, Number.parseInt(argumentValue("max-pages", "8"), 10) || 8)
);
const timeoutMs = Math.max(
  1000,
  Math.min(30000, Number.parseInt(argumentValue("timeout-ms", "8000"), 10) || 8000)
);
const minimumScore = Math.max(
  1,
  Math.min(20, Number.parseInt(argumentValue("minimum-score", "5"), 10) || 5)
);
const vendorConcurrency = Math.max(
  1,
  Math.min(12, Number.parseInt(argumentValue("concurrency", "6"), 10) || 6)
);
const resume = process.argv.includes("--resume");
const externalNoiseHosts = new Set([
  "discord.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "www.facebook.com",
  "www.instagram.com",
  "www.linkedin.com",
  "www.tiktok.com",
  "www.youtube.com"
]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function fetchText(url, expectedKind = "html") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept:
          expectedKind === "xml"
            ? "application/xml,text/xml;q=0.9,*/*;q=0.1"
            : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "user-agent":
          "AIHubCatalogResearch/1.0 (+local official-product audit; no publishing)"
      },
      redirect: "follow",
      signal: controller.signal
    });
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 2_000_000) {
      throw new Error(`response too large: ${contentLength}`);
    }
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("response exceeded 2 MB");
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: normalizeUrl(response.url) || url,
      contentType: response.headers.get("content-type") || "",
      text
    };
  } finally {
    clearTimeout(timer);
  }
}

function sitemapCandidates(sources) {
  return unique(
    sources.scopes
      .filter((scope) => scope.pathPrefix === "/")
      .map((scope) => `https://${scope.hostname}/sitemap.xml`)
  );
}

async function mapWithConcurrency(values, concurrency, callback) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
}

async function discoverVendor(vendor) {
  const sources = collectVendorSources(vendor);
  const report = {
    vendorId: vendor.id,
    vendorName: vendor.name,
    officialScopes: sources.scopes,
    checkedPages: [],
    failures: [],
    candidates: [],
    leads: []
  };
  const queue = [];
  const queued = new Set();
  const visited = new Set();
  const candidates = new Map();
  const leads = new Map();

  function enqueue(url, score = 0, evidenceUrl = url, text = "") {
    const normalized = normalizeUrl(url);
    if (!normalized || queued.has(normalized) || visited.has(normalized)) return;
    queued.add(normalized);
    queue.push({ url: normalized, score, evidenceUrl, text });
    queue.sort((left, right) => right.score - left.score);
  }

  for (const seed of sources.urls.slice(0, 24)) enqueue(seed, 20);

  await mapWithConcurrency(
    sitemapCandidates(sources).slice(0, 6),
    4,
    async (sitemapUrl) => {
      try {
        const response = await fetchText(sitemapUrl, "xml");
        if (!response.ok || !/xml/i.test(response.contentType)) return;
        for (const url of parseSitemapXml(response.text, sitemapUrl, sources.scopes)) {
          const link = { url, text: "" };
          const score = scoreDiscoveryLink(link);
          if (score >= minimumScore) enqueue(url, score, sitemapUrl);
        }
      } catch (error) {
        report.failures.push({
          url: sitemapUrl,
          error: String(error.message || error)
        });
      }
    }
  );

  while (queue.length > 0 && report.checkedPages.length < maxPages) {
    const next = queue.shift();
    queued.delete(next.url);
    if (visited.has(next.url)) continue;
    visited.add(next.url);
    try {
      const response = await fetchText(next.url);
      report.checkedPages.push({
        url: next.url,
        finalUrl: response.finalUrl,
        status: response.status
      });
      if (!response.ok || !/html|xhtml/i.test(response.contentType)) continue;
      const page = extractHtmlPage(response.text, response.finalUrl, sources.scopes);
      for (const link of page.links) {
        const score = scoreDiscoveryLink(link, page);
        if (score < minimumScore) continue;
        // Product ownership is vendor-scoped. A vendor page can mention an
        // integration from another vendor, but that must remain a review lead
        // instead of being silently treated as this vendor's existing product.
        const existingProductId = matchExistingProduct(link, vendor.products);
        const key = normalizeUrl(link.url);
        const finding = {
          url: key,
          label: link.text || page.title || key,
          inferredType: inferProductType(link),
          score,
          existingProductId,
          evidenceUrl: response.finalUrl
        };
        const disposition = existingProductId
          ? "candidate"
          : discoveryDisposition(link);
        const target = disposition === "candidate" ? candidates : leads;
        if (disposition !== "ignore") {
          const previous = target.get(key);
          if (!previous || previous.score < finding.score) target.set(key, finding);
        }
        enqueue(link.url, score, response.finalUrl, link.text);
      }
      for (const link of page.externalLinks) {
        const score = scoreDiscoveryLink(link, page);
        const hostname = new URL(link.url).hostname.toLowerCase();
        if (
          externalNoiseHosts.has(hostname) ||
          score < minimumScore ||
          discoveryDisposition(link) === "ignore"
        ) {
          continue;
        }
        const key = normalizeUrl(link.url);
        const finding = {
          url: key,
          label: link.text || key,
          inferredType: inferProductType(link),
          score,
          existingProductId: null,
          evidenceUrl: response.finalUrl,
          externalOfficialReference: true
        };
        const previous = leads.get(key);
        if (!previous || previous.score < finding.score) leads.set(key, finding);
      }
    } catch (error) {
      report.failures.push({ url: next.url, error: String(error.message || error) });
    }
  }

  report.candidates = [...candidates.values()]
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
    .slice(0, 100);
  report.leads = [...leads.values()]
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
    .slice(0, 100);
  report.summary = {
    checkedPages: report.checkedPages.length,
    failures: report.failures.length,
    matched: report.candidates.filter((candidate) => candidate.existingProductId).length,
    needsReview: report.candidates.filter((candidate) => !candidate.existingProductId).length,
    researchLeads: report.leads.length
  };
  return report;
}

function markdownReport(report) {
  const lines = [
    "# AI Hub 官方产品自动发现报告",
    "",
    `生成时间：${report.generatedAt}`,
    "",
    "> 这是候选证据，不会自动发布。只有人工核实产品归属、生命周期和安装策略后，才能写入后台目录。",
    "",
    `扫描厂商：${report.summary.vendors}；访问页面：${report.summary.checkedPages}；待审核候选：${report.summary.needsReview}；失败请求：${report.summary.failures}`,
    ""
  ];
  for (const vendor of report.vendors) {
    lines.push(`## ${vendor.vendorName} (${vendor.vendorId})`, "");
    lines.push(
      `访问 ${vendor.summary.checkedPages} 页；匹配现有目录 ${vendor.summary.matched} 条；高置信待审核 ${vendor.summary.needsReview} 条；研究线索 ${vendor.summary.researchLeads} 条；失败 ${vendor.summary.failures} 条。`,
      ""
    );
    const needsReview = vendor.candidates.filter((candidate) => !candidate.existingProductId);
    if (needsReview.length === 0) {
      lines.push("未发现达到阈值的新候选。", "");
    } else {
      lines.push("| 候选 | 推测类型 | 分数 | 证据页 |", "| --- | --- | ---: | --- |");
      for (const candidate of needsReview.slice(0, 30)) {
        lines.push(
          `| [${candidate.label.replace(/\|/g, "\\|")}](${candidate.url}) | ${candidate.inferredType} | ${candidate.score} | [来源](${candidate.evidenceUrl}) |`
        );
      }
      lines.push("");
    }
    if (vendor.leads.length > 0) {
      lines.push("研究线索（不是产品结论）：", "");
      for (const lead of vendor.leads.slice(0, 15)) {
        lines.push(`- [${lead.label.replace(/\[/g, "\\[")}](${lead.url})`);
      }
      lines.push("");
    }
    if (vendor.failures.length > 0) {
      lines.push("请求失败：", "");
      for (const failure of vendor.failures.slice(0, 10)) {
        lines.push(`- ${failure.url}: ${failure.error}`);
      }
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const vendors = catalog.vendors.filter(
  (vendor) => selectedVendorIds.size === 0 || selectedVendorIds.has(vendor.id)
);
if (vendors.length === 0) {
  throw new Error("No matching vendors. Use --vendors=openai,anthropic or omit it.");
}

fs.mkdirSync(vendorOutputDirectory, { recursive: true });
const vendorReports = await mapWithConcurrency(vendors, vendorConcurrency, async (vendor) => {
  const vendorOutputPath = path.join(vendorOutputDirectory, `${vendor.id}.json`);
  if (resume && fs.existsSync(vendorOutputPath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(vendorOutputPath, "utf8"));
      if (cached.catalogUpdatedAt === catalog.updatedAt) {
        process.stdout.write(`Resuming ${vendor.id} from checkpoint.\n`);
        return cached.report;
      }
    } catch {
      // A partial or old checkpoint is ignored and replaced atomically below.
    }
  }
  process.stdout.write(`Scanning ${vendor.id}...\n`);
  const report = await discoverVendor(vendor);
  const temporaryPath = `${vendorOutputPath}.${process.pid}.tmp`;
  fs.writeFileSync(
    temporaryPath,
    `${JSON.stringify({ catalogUpdatedAt: catalog.updatedAt, report }, null, 2)}\n`,
    "utf8"
  );
  fs.renameSync(temporaryPath, vendorOutputPath);
  return report;
});

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  catalogUpdatedAt: catalog.updatedAt,
  policy: {
    officialSourcesOnly: true,
    autoPublish: false,
    maxPages,
    timeoutMs,
    minimumScore,
    vendorConcurrency,
    resumedFromCheckpoints: resume
  },
  summary: {
    vendors: vendorReports.length,
    checkedPages: vendorReports.reduce((sum, vendor) => sum + vendor.summary.checkedPages, 0),
    failures: vendorReports.reduce((sum, vendor) => sum + vendor.summary.failures, 0),
    needsReview: vendorReports.reduce((sum, vendor) => sum + vendor.summary.needsReview, 0),
    researchLeads: vendorReports.reduce((sum, vendor) => sum + vendor.summary.researchLeads, 0)
  },
  vendors: vendorReports
};

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(markdownOutputPath, markdownReport(report), "utf8");
process.stdout.write(
  `${JSON.stringify({ summary: report.summary, jsonOutputPath, markdownOutputPath }, null, 2)}\n`
);
