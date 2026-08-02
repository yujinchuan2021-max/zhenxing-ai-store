import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createVendorIconStore } = require("../admin/vendor-icon-store.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const dataDirectory = path.join(root, "admin", "data");
const store = createVendorIconStore({
  rootDirectory: dataDirectory,
  manifestPath: path.join(dataDirectory, "vendor-icon-sources.json")
});
const timeoutMs = 6500;
const concurrency = 8;
const officialGitHubOrganizations = Object.freeze({
  openai: ["openai", "14957082"],
  bytedance: ["bytedance", "4158466"],
  google: ["google", "1342004"],
  alibaba: ["alibaba", "1961952"],
  meta: ["facebook", "69631"],
  xai: ["xai-org", "130314967"],
  mistral: ["mistralai", "132372032"],
  huggingface: ["huggingface", "25720743"],
  groq: ["groq", "7464134"],
  jan: ["janhq", "102363196"],
  canva: ["Canva", "2562356"],
  asana: ["Asana", "1472111"],
  perplexity: ["perplexityai", "185426709"],
  iflytek: ["iflytek", "26786495"],
  bfl: ["black-forest-labs", "164064024"],
  suno: ["suno-ai", "99442120"],
  quora: ["quora", "68739"],
  monica: ["Monica-IM", "152768275"],
  "blackmagic-design": ["blackmagicdesign", "8433013"]
});

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ""])
  );
}

function iconCandidates(html, pageUrl) {
  const candidates = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (!/(?:^|\s)(?:apple-touch-icon(?:-precomposed)?|icon)(?:\s|$)/i.test(attrs.rel || "")) continue;
    if (!attrs.href) continue;
    try {
      const url = new URL(attrs.href, pageUrl);
      if (!["https:", "data:"].includes(url.protocol)) continue;
      const size = Math.max(
        0,
        ...String(attrs.sizes || "").split(/\s+/).map((value) => {
          const parsed = /^(\d+)x(\d+)$/i.exec(value);
          return parsed ? Number(parsed[1]) * Number(parsed[2]) : 0;
        })
      );
      candidates.push({
        url: url.href,
        score: size + (/apple-touch-icon/i.test(attrs.rel) ? 1_000_000 : 0)
      });
    } catch {
      // Ignore malformed icon declarations from otherwise valid official pages.
    }
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (!/^(?:msapplication-tileimage|og:logo)$/i.test(attrs.name || attrs.property || "")) continue;
    try {
      const url = new URL(attrs.content, pageUrl);
      if (url.protocol === "https:") candidates.push({ url: url.href, score: 500_000 });
    } catch {
      // Ignore malformed metadata.
    }
  }
  const base = new URL(pageUrl);
  for (const pathname of ["/apple-touch-icon.png", "/favicon.png", "/favicon.ico"]) {
    candidates.push({ url: new URL(pathname, base).href, score: 0 });
  }
  return [...new Map(
    candidates.sort((left, right) => right.score - left.score)
      .map((entry) => [entry.url, entry])
  ).values()].slice(0, 8);
}

function manifestUrls(html, pageUrl) {
  const urls = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (!/(?:^|\s)manifest(?:\s|$)/i.test(attrs.rel || "") || !attrs.href) continue;
    try {
      const url = new URL(attrs.href, pageUrl);
      if (url.protocol === "https:") urls.push(url.href);
    } catch {
      // Ignore malformed manifest links.
    }
  }
  const base = new URL(pageUrl);
  for (const pathname of ["/site.webmanifest", "/manifest.webmanifest", "/manifest.json"]) {
    urls.push(new URL(pathname, base).href);
  }
  return [...new Set(urls)].slice(0, 5);
}

function mimeTypeFor(data) {
  if (data.length >= 8 && data.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  )) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  if (
    data.length >= 6 &&
    data.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]))
  ) return "image/x-icon";
  const text = data.subarray(0, Math.min(data.length, 4096)).toString("utf8");
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text)) return "image/svg+xml";
  return "";
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "ZhenXingAI-CatalogLogoReview/1.0",
        accept: options.accept || "text/html,application/xhtml+xml"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readLimited(response, limit) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > limit) throw new Error("response too large");
  if (!response.body?.getReader) {
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length || data.length > limit) throw new Error("response too large");
    return data;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("response too large");
    }
    chunks.push(Buffer.from(value));
  }
  if (!size) throw new Error("empty response");
  return Buffer.concat(chunks, size);
}

async function discover(vendor) {
  const githubOrganization = officialGitHubOrganizations[vendor.id];
  if (githubOrganization) {
    const [organization, avatarId] = githubOrganization;
    try {
      const response = await fetchWithTimeout(
        `https://avatars.githubusercontent.com/u/${avatarId}?s=256&v=4`,
        { accept: "image/png,image/jpeg", timeoutMs: 20_000 }
      );
      if (response.ok) {
        const data = await readLimited(response, 384 * 1024);
        const mimeType = mimeTypeFor(data);
        if (mimeType) {
          const asset = store.save({
            vendorId: vendor.id,
            dataUrl: `data:${mimeType};base64,${data.toString("base64")}`,
            sourceUrl: `https://github.com/${organization}`
          });
          return { vendor, asset, sourceUrl: `https://github.com/${organization}` };
        }
      }
    } catch {
      // Fall back to the vendor's own site declarations below.
    }
  }
  let pageUrl = vendor.website;
  let html = "";
  try {
    const page = await fetchWithTimeout(vendor.website);
    if (!page.ok) throw new Error(`homepage HTTP ${page.status}`);
    pageUrl = page.url || vendor.website;
    html = (await readLimited(page, 4 * 1024 * 1024)).toString("utf8");
  } catch {
    // Official sites may block catalog crawlers; standard same-origin icon
    // paths below are still safe candidates.
  }
  const candidates = iconCandidates(html, pageUrl);
  for (const manifestUrl of manifestUrls(html, pageUrl)) {
    try {
      const response = await fetchWithTimeout(manifestUrl, { accept: "application/manifest+json,application/json" });
      if (!response.ok) continue;
      const manifest = JSON.parse((await readLimited(response, 256 * 1024)).toString("utf8"));
      for (const icon of Array.isArray(manifest.icons) ? manifest.icons : []) {
        if (!icon?.src) continue;
        const url = new URL(icon.src, response.url || manifestUrl);
        if (url.protocol === "https:") candidates.unshift({ url: url.href, score: 2_000_000 });
      }
    } catch {
      // A missing or unrelated manifest does not invalidate the vendor site.
    }
  }
  for (const candidate of [...new Map(candidates.map((entry) => [entry.url, entry])).values()].slice(0, 12)) {
    try {
      let data;
      let sourceUrl = candidate.url;
      if (candidate.url.startsWith("data:")) {
        const match = /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(candidate.url);
        if (!match) continue;
        data = Buffer.from(match[1], "base64");
        sourceUrl = pageUrl;
      } else {
        const response = await fetchWithTimeout(candidate.url, { accept: "image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml,*/*;q=0.2" });
        if (!response.ok) continue;
        data = await readLimited(response, 384 * 1024);
        sourceUrl = response.url || candidate.url;
      }
      const mimeType = mimeTypeFor(data);
      if (!mimeType) continue;
      const asset = store.save({
        vendorId: vendor.id,
        dataUrl: `data:${mimeType};base64,${data.toString("base64")}`,
        sourceUrl
      });
      return { vendor, asset, sourceUrl };
    } catch {
      // Try the next official-page candidate.
    }
  }
  return { vendor, error: "no supported raster icon found" };
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const queue = catalog.vendors.filter((vendor) => !vendor.iconAsset);
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const vendor = queue[cursor++];
      const result = await discover(vendor);
      results.push(result);
      process.stdout.write(`${result.asset ? "OK" : "MISS"} ${vendor.id}\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  for (const result of results) {
    if (!result.asset) continue;
    const vendor = catalog.vendors.find((entry) => entry.id === result.vendor.id);
    vendor.iconAsset = result.asset;
    vendor.iconUrl = "";
  }
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  const imported = results.filter((result) => result.asset).length;
  process.stdout.write(`Imported ${imported}/${queue.length}; total ${catalog.vendors.filter((vendor) => vendor.iconAsset).length}/${catalog.vendors.length}\n`);
}

await main();
