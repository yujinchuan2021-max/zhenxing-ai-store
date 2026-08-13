import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createVendorIconStore } = require("../admin/vendor-icon-store.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const dataDirectory = path.join(root, "admin", "data");
const sourceManifestPath = path.join(dataDirectory, "vendor-icon-sources.json");
const fallbackManifestPath = path.join(dataDirectory, "vendor-icon-fallbacks.json");
const store = createVendorIconStore({
  rootDirectory: dataDirectory,
  manifestPath: sourceManifestPath
});
const timeoutMs = 6500;
const concurrency = 8;
const reviewedIconSources = Object.freeze({
  zoner: {
    assetUrl: "https://www.zoner.com/__img/zs/favicon/apple-touch-icon.png",
    sourceUrl: "https://www.zoner.com/en"
  },
  on1: {
    assetUrl: "https://on1-wp.s3.amazonaws.com/wp-content/uploads/2019/10/08141917/cropped-site-icon-black-bg-512-192x192.png",
    sourceUrl: "https://www.on1.com/press/"
  },
  "capture-one": {
    assetUrl: "https://www.captureone.com/apple-icon.png?2733b5e0918cb121",
    sourceUrl: "https://www.captureone.com/en/products/capture-one-pro"
  },
  dxo: {
    assetUrl: "https://www.dxo.com/icon.svg",
    sourceUrl: "https://www.dxo.com/en/dxo-photolab/"
  },
  craft: {
    assetUrl: "https://www.craft.do/favicons/light/light_192.png",
    sourceUrl: "https://www.craft.do/download"
  },
  capacities: {
    assetUrl: "https://capacities.io/favicon.png",
    sourceUrl: "https://capacities.io/download-app"
  },
  evernote: {
    assetUrl: "https://evernote.com/images/evernote-logo-serp.png",
    sourceUrl: "https://evernote.com/blog/introducing-v11"
  },
  dropbox: {
    assetUrl: "https://cdn.prod.website-files.com/65dcd70b48edc3a7b446950e/68f7935417b88ae7c10aaad8_webclip-256px.png",
    sourceUrl: "https://dash.dropbox.com/"
  },
  tana: {
    assetUrl: "https://tana.inc/apple-touch-icon-tana.png",
    sourceUrl: "https://tana.inc/download"
  },
  heptabase: {
    assetUrl: "https://heptabase.com/assets/images/apple-touch-icon.png",
    sourceUrl: "https://heptabase.com/download"
  },
  opera: {
    assetUrl: "https://cdn-production-opera-website.operacdn.com/staticfiles/assets/images/favicon/opera/apple-touch-icon-180x180.00d9278d6de6.png",
    sourceUrl: "https://www.opera.com/one"
  },
  mozilla: {
    assetUrl: "https://www.firefox.com/media/img/favicons/firefox/browser/favicon-196x196.59e3822720be.png",
    sourceUrl: "https://www.firefox.com/en-US/download/windows/"
  },
  invokeai: {
    assetUrl: "https://invoke.ai/favicon.svg",
    sourceUrl: "https://invoke.ai/download/"
  },
  upscayl: {
    assetUrl: "https://upscayl.org/logo/64x64.png",
    sourceUrl: "https://upscayl.org/download"
  },
  fotor: {
    assetUrl: "https://static.fotor.com/web/_next/static/images/favicon-d4b8dbe4630a2bc790117e61267bbb33.png",
    sourceUrl: "https://www.fotor.com/windows/index.html"
  },
  cyberlink: {
    assetUrl: "https://dl-asset.cyberlink.com/web/stat/edms/prog/newhomepage/img/logo-630x630.jpg",
    sourceUrl: "https://www.cyberlink.com/"
  },
  amd: {
    assetUrl: "https://avatars.githubusercontent.com/u/430818?s=256&v=4",
    sourceUrl: "https://github.com/amd"
  },
  github: {
    assetUrl: "https://github.githubassets.com/favicons/favicon.png",
    sourceUrl: "https://github.com/logos"
  },
  intel: {
    assetUrl: "https://www.intel.cn/etc.clientlibs/settings/wcm/designs/intel/default/resources/favicon-32x32.png",
    sourceUrl: "https://www.intel.com/"
  },
  zapier: {
    assetUrl: "https://zapier.com/favicon.ico",
    sourceUrl: "https://zapier.com/press"
  },
  mongodb: {
    assetUrl: "https://www.mongodb.com/assets/images/global/favicon.ico",
    sourceUrl: "https://www.mongodb.com/company/newsroom/brand-resources"
  },
  datadog: {
    assetUrl: "https://corp.dd-static.net/img/favicons/apple-touch-icon.png",
    sourceUrl: "https://www.datadoghq.com/about/resources/"
  },
  penpot: {
    assetUrl: "https://penpot.app/favicon.ico",
    sourceUrl: "https://penpot.app/media-kit"
  },
  webflow: {
    assetUrl: "https://dhygzobemt712.cloudfront.net/Logo/Social_Circle_Blue.png",
    sourceUrl: "https://brand.webflow.com/brand-assets"
  },
  activepieces: {
    assetUrl: "https://www.activepieces.com/logo.svg",
    sourceUrl: "https://www.activepieces.com/"
  },
  affine: {
    assetUrl: "https://affine.pro/favicon-96.png",
    sourceUrl: "https://affine.pro/"
  },
  aftershoot: {
    assetUrl: "https://aftershoot.com/wp-content/uploads/2025/08/aftershoot-logo-favicon.webp",
    sourceUrl: "https://aftershoot.com/"
  },
  agno: {
    assetUrl: "https://cdn.prod.website-files.com/6796d350b8c706e4533e7e32/68a85d04c4b355c4accb0f9f_256.png",
    sourceUrl: "https://www.agno.com/"
  },
  anydesk: {
    assetUrl: "https://anydesk.com.cn/_static/img/favicon/apple-touch-icon.png",
    sourceUrl: "https://anydesk.com.cn/zhs"
  },
  audacity: {
    assetUrl: "https://www.audacityteam.org/apple-touch-icon.png",
    sourceUrl: "https://www.audacityteam.org/"
  },
  augment: {
    assetUrl: "https://www.augmentcode.com/favicon.svg",
    sourceUrl: "https://www.augmentcode.com/"
  },
  bardeen: {
    assetUrl: "https://cdn.prod.website-files.com/67a4e756231fbcd6386ec06a/68ef8291b04588fc181bb136_Bardeen-Webclip.svg",
    sourceUrl: "https://www.bardeen.ai/"
  },
  braintrust: {
    assetUrl: "https://www.braintrust.dev/icon180.png?v=2",
    sourceUrl: "https://www.braintrust.dev/"
  },
  canarymail: {
    assetUrl: "https://cdn.prod.website-files.com/6774d6b0372116ea34d8e8a9/67a5f7ed1a0bdbaa336ce531_Logo%20for%20App%20icon%20CR%20256.png",
    sourceUrl: "https://canarymail.io/"
  },
  cloudinary: {
    assetUrl: "https://cloudinary-res.cloudinary.com/image/upload/f_auto,q_auto/c_scale,w_196/v1597183771/website/cloudinary_web_favicon.png",
    sourceUrl: "https://cloudinary.com/"
  },
  coderabbit: {
    assetUrl: "https://www.coderabbit.ai/android-chrome-512x512.png?v=4",
    sourceUrl: "https://www.coderabbit.ai/"
  },
  cognition: {
    assetUrl: "https://devin.ai/favicon.svg",
    sourceUrl: "https://devin.ai/"
  },
  continue: {
    assetUrl: "https://continue.dev/icon-192.png",
    sourceUrl: "https://continue.dev/"
  },
  daytona: {
    assetUrl: "https://framerusercontent.com/images/6WPclDLAHHQgPFeA2DRTW1OXVSU.png",
    sourceUrl: "https://www.daytona.io/"
  },
  e2b: {
    assetUrl: "https://cdn.prod.website-files.com/6717bb6618f6a40d53ac2929/6a2a7d84c914ca7bc2dd1aab_Favicon_512x512.png",
    sourceUrl: "https://e2b.dev/"
  },
  "factory-ai": {
    assetUrl: "https://factory.ai/favicon.svg",
    sourceUrl: "https://factory.ai/"
  },
  gitbutler: {
    assetUrl: "https://gitbutler.com/favicon/favicon.svg",
    sourceUrl: "https://gitbutler.com/"
  },
  greptile: {
    assetUrl: "https://www.greptile.com/greptile-brand-mark.png",
    sourceUrl: "https://www.greptile.com/"
  },
  helicone: {
    assetUrl: "https://www.helicone.ai/static/logo.webp",
    sourceUrl: "https://www.helicone.ai/"
  },
  kilo: {
    assetUrl: "https://kilo.ai/favicon/favicon.svg?v=2",
    sourceUrl: "https://kilo.ai/"
  },
  mastra: {
    assetUrl: "https://mastra.ai/favicon/new-brand/icon-512.png",
    sourceUrl: "https://mastra.ai/favicon/new-brand/icon-512.png"
  },
  onlyoffice: {
    assetUrl: "https://static-site.onlyoffice.com/public/images/favicons/favicon325.png",
    sourceUrl: "https://www.onlyoffice.com/"
  },
  opusclip: {
    assetUrl: "https://cdn.prod.website-files.com/6388604483b03a9ecb34d695/6435197bfb1d6e486e04c37b_webclip.png",
    sourceUrl: "https://www.opus.pro/"
  },
  pandadoc: {
    assetUrl: "https://www.pandadoc.com/favicon.ico?favicon.0hplvhjssgw-1.ico",
    sourceUrl: "https://www.pandadoc.com/"
  },
  qodo: {
    assetUrl: "https://www.qodo.ai/wp-content/uploads/2025/03/qodo-fav-300x300.png",
    sourceUrl: "https://www.qodo.ai/"
  },
  "spark-mail": {
    assetUrl: "https://cdn-rdstaticassets.readdle.com/assets/spark/spark3/common/favicon-icons/spark-icon-180x180.png?1770301849",
    sourceUrl: "https://sparkmailapp.com/"
  },
  tailscale: {
    assetUrl: "https://tailscale.com/favicon.svg",
    sourceUrl: "https://tailscale.com/"
  },
  taskade: {
    assetUrl: "https://www.taskade.com/favicon.svg",
    sourceUrl: "https://www.taskade.com/"
  },
  zendesk: {
    assetUrl: "https://d1eipm3vz40hy0.cloudfront.net/images/logos/favicons/zendesk-icon-152.png",
    sourceUrl: "https://d1eipm3vz40hy0.cloudfront.net/images/logos/favicons/zendesk-icon-152.png"
  },
  "zeroclaw-labs": {
    assetUrl: "https://www.zeroclawlabs.ai/images/zeroclawlabs.png",
    sourceUrl: "https://www.zeroclawlabs.ai/"
  }
});
const officialGitHubOrganizations = Object.freeze({
  cline: ["cline", "184127137"],
  langchain: ["langchain-ai", "126733545"],
  openwebui: ["open-webui", "158137808"],
  thinkinai: ["ThinkInAIXYZ", "195535817"],
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
  "blackmagic-design": ["blackmagicdesign", "8433013"],
  ableton: ["Ableton", "14052912"],
  amazon: ["aws", "2232217"],
  nvidia: ["NVIDIA", "1728152"],
  nousresearch: ["NousResearch", "134168893"],
  "open-home-foundation": ["OpenHomeFoundation", "159245737"],
  redis: ["redis", "1529926"],
  stability: ["Stability-AI", "100950301"],
  supabase: ["supabase", "54469796"],
  uipath: ["UiPath", "375663"],
  krea: ["krea-ai", "108735617"],
  meshy: ["meshy-dev", "160386200"],
  shengshu: ["shengshu-ai", "133188292"],
  pixverse: ["PixVerseAI", "204290266"],
  discord: ["discord", "1965106"],
  ansys: ["ansys", "66023092"],
  cesium: ["CesiumGS", "54716382"],
  openhands: ["OpenHands", "225919603"],
  "significant-gravitas": ["Significant-Gravitas", "130738209"],
  agent0ai: ["agent0ai", "216033749"],
  "browser-use": ["browser-use", "192012301"],
  skyvern: ["Skyvern-AI", "141457985"],
  "foundation-agents": ["FoundationAgents", "198047230"],
  "rightnow-ai": ["RightNow-AI", "226207176"],
  "near-ai": ["nearai", "29134221"],
  hkuds: ["HKUDS", "118165258"],
  nanoco: ["nanocoai", "255066954"],
  astrbot: ["AstrBotDevs", "197911947"],
  kortix: ["kortix-ai", "170767358"],
  "swe-agent": ["SWE-agent", "166046056"],
  letta: ["letta-ai", "177780362"],
  rowboat: ["rowboatlabs", "172591271"],
  plandex: ["plandex-ai", "148917357"],
  "simular-ai": ["simular-ai", "99358647"],
  bytebot: ["bytebot-ai", "154629106"],
  voltagent: ["VoltAgent", "201282378"],
  qupath: ["qupath", "21292410"],
  screenpipe: ["screenpipe", "259178917"],
  "docling-project": ["docling-project", "188446108"]
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
  const reviewedSource = reviewedIconSources[vendor.id];
  if (reviewedSource) {
    try {
      const response = await fetchWithTimeout(reviewedSource.assetUrl, {
        accept: "image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml,*/*;q=0.2",
        timeoutMs: 20_000
      });
      if (!response.ok) throw new Error(`icon HTTP ${response.status}`);
      const data = await readLimited(response, 384 * 1024);
      const mimeType = mimeTypeFor(data);
      if (!mimeType) throw new Error("unsupported icon format");
      const asset = store.save({
        vendorId: vendor.id,
        dataUrl: `data:${mimeType};base64,${data.toString("base64")}`,
        sourceUrl: reviewedSource.sourceUrl
      });
      return { vendor, asset, sourceUrl: reviewedSource.sourceUrl };
    } catch (error) {
      return { vendor, error: `reviewed icon unavailable: ${error.message}` };
    }
  }
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
  if (!githubOrganization) {
    return { vendor, error: "no reviewed official icon source" };
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
      const candidateUrl = new URL(candidate.url);
      if (
        vendor.id !== "github" &&
        candidateUrl.hostname === "github.githubassets.com" &&
        candidateUrl.pathname.startsWith("/favicons/")
      ) continue;
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

function reviewedTextFallbacks() {
  const manifest = JSON.parse(fs.readFileSync(fallbackManifestPath, "utf8"));
  return new Set(Object.keys(manifest.vendors || {}));
}

function hasExactReviewedSource(vendorId) {
  return Boolean(
    reviewedIconSources[vendorId] || officialGitHubOrganizations[vendorId]
  );
}

function removeUnrelatedSharedAssets(catalog, textFallbacks) {
  const manifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
  for (const vendor of catalog.vendors) {
    if (textFallbacks.has(vendor.id)) {
      delete vendor.iconAsset;
      continue;
    }
    const source = vendor.iconAsset && manifest.assets[vendor.iconAsset.sha256];
    if (!source) continue;
    const sourceUrl = new URL(source.sourceUrl);
    const reviewedSource = reviewedIconSources[vendor.id];
    const githubOrganization = officialGitHubOrganizations[vendor.id];
    const reviewedGitHubUrl = githubOrganization && `https://github.com/${githubOrganization[0]}`;
    if (
      source.vendorIds.length > 1 ||
      (reviewedSource && source.sourceUrl !== reviewedSource.sourceUrl) ||
      (reviewedGitHubUrl && source.sourceUrl !== reviewedGitHubUrl) ||
      (vendor.id !== "github" && sourceUrl.hostname === "github.githubassets.com")
    ) delete vendor.iconAsset;
  }
}

function syncSourceManifest(catalog) {
  const manifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
  const vendorIdsByHash = new Map();
  for (const vendor of catalog.vendors) {
    if (!vendor.iconAsset) continue;
    const ids = vendorIdsByHash.get(vendor.iconAsset.sha256) || [];
    ids.push(vendor.id);
    vendorIdsByHash.set(vendor.iconAsset.sha256, ids);
  }
  for (const [sha256, source] of Object.entries(manifest.assets)) {
    const vendorIds = vendorIdsByHash.get(sha256);
    if (!vendorIds?.length) delete manifest.assets[sha256];
    else source.vendorIds = vendorIds.sort();
  }
  fs.writeFileSync(sourceManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const fallbackManifest = JSON.parse(
    fs.readFileSync(fallbackManifestPath, "utf8")
  );
  const textFallbacks = reviewedTextFallbacks();
  removeUnrelatedSharedAssets(catalog, textFallbacks);
  const queue = catalog.vendors.filter(
    (vendor) =>
      !vendor.iconAsset &&
      (!textFallbacks.has(vendor.id) || hasExactReviewedSource(vendor.id))
  );
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
    delete fallbackManifest.vendors[vendor.id];
  }
  validateCatalog(catalog);
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    fallbackManifestPath,
    `${JSON.stringify(fallbackManifest, null, 2)}\n`,
    "utf8"
  );
  syncSourceManifest(catalog);
  const imported = results.filter((result) => result.asset).length;
  process.stdout.write(`Imported ${imported}/${queue.length}; total ${catalog.vendors.filter((vendor) => vendor.iconAsset).length}/${catalog.vendors.length}\n`);
}

await main();
