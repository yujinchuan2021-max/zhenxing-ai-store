import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import {
  createIsolatedAcceptanceProfile,
  launchPackagedClientCdp,
  removeIsolatedAcceptanceProfile
} from "./lib/packaged-client-cdp.mjs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { canonicalize, verifySignedEnvelope } = require("../shared/signed-release.cjs");

const executable = path.resolve(process.argv[2] || "");
const expectedPackageAsarSha256 = process.argv[3] ? String(process.argv[3]).toLowerCase() : undefined;
const expectedCatalogChannelSha256 = process.argv[4] ? String(process.argv[4]).toLowerCase() : undefined;
const expectedUpdateChannelSha256 = process.argv[5] ? String(process.argv[5]).toLowerCase() : undefined;
if (!process.argv[2] || !fs.existsSync(executable) || ![expectedPackageAsarSha256, expectedCatalogChannelSha256, expectedUpdateChannelSha256].every((value) => /^[a-f0-9]{64}$/.test(value || ""))) {
  throw new Error("Usage: node scripts/check-packaged-catalog.mjs <package.exe> <app-asar-sha256> <catalog-channel-sha256> <update-channel-sha256>");
}

const overrideUrl = process.env.AIHUB_PACKAGED_CATALOG_URL;
if (overrideUrl && process.env.AIHUB_PACKAGED_GATE_TEST !== "1") {
  throw new Error("Catalog URL override is test-only");
}

const profile = createIsolatedAcceptanceProfile("aihub-catalog-check-");
let client;
try {
  client = await launchPackagedClientCdp({ executable, profile, expectedPackageAsarSha256, expectedCatalogChannelSha256, expectedUpdateChannelSha256 });
  const deadline = Date.now() + 20_000;
  while (
    Date.now() < deadline &&
    !(await client.evaluate("Boolean(window.aihubPC?.getCatalog)"))
  ) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  let packagedBrand = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    packagedBrand = await client.evaluate(`(() => {
      const icon = document.querySelector(".brandMark img");
      return {
        present: Boolean(icon),
        complete: icon?.complete === true,
        naturalWidth: icon?.naturalWidth || 0,
        src: icon?.getAttribute("src") || ""
      };
    })()`);
    if (packagedBrand.present && packagedBrand.complete && packagedBrand.naturalWidth > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (
    !packagedBrand.present ||
    !packagedBrand.complete ||
    packagedBrand.naturalWidth < 1 ||
    packagedBrand.src !== "./brand-icon.png"
  ) {
    throw new Error(`Packaged brand DOM gate failed: ${JSON.stringify(packagedBrand)}`);
  }
  const catalog = await client.evaluate(`window.aihubPC.getCatalog().then((result) => {
    const vendors = result?.catalog?.vendors || [];
    const products = vendors.flatMap((vendor) => vendor.products || []);
    return {
      source: result?.source,
      error: result?.error,
      catalogVersion: result?.catalogVersion,
      vendors: vendors.length,
      products: products.map((product) => ({ id: product.id, moduleId: product.moduleId })),
      resourceStoreIds: (result?.catalog?.resourceStores || []).map((store) => store.id),
      homeCarouselSlides: result?.catalog?.homeCarousel?.slides?.length || 0
    };
  })`);
  const embeddedChannel = JSON.parse(fs.readFileSync(client.runtimeClosure.catalogChannel, "utf8"));
  const catalogUrl = overrideUrl || embeddedChannel?.releaseUrl;
  if (!/^https:\/\//i.test(catalogUrl || "")) {
    throw new Error("Portable embedded catalog channel is invalid");
  }
  const catalogHost = new URL(catalogUrl).hostname;
  const loopbackCatalog = ["localhost", "127.0.0.1", "[::1]"].includes(
    catalogHost
  );
  const remote = await new Promise((resolve, reject) => {
    const request = https.get(catalogUrl, { rejectUnauthorized: !loopbackCatalog }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ response, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(15_000, () => request.destroy(new Error("catalog HTTPS timeout")));
    request.on("error", reject);
  });
  if (remote.response.statusCode !== 200) throw new Error(`Catalog URL returned ${remote.response.statusCode}`);
  if (!String(remote.response.headers["content-type"] || "").includes("application/json")) {
    throw new Error("Catalog URL Content-Type is not JSON");
  }
  const envelope = JSON.parse(remote.body.toString("utf8"));
  verifySignedEnvelope(envelope, { kind: "catalog", trustedKeys: embeddedChannel.trustedKeys });
  const normalizedSha256 = crypto.createHash("sha256").update(canonicalize(envelope.payload.catalog)).digest("hex");
  if (normalizedSha256 !== envelope.payload.catalogSha256) {
    throw new Error("Catalog normalized SHA-256 does not match the signed payload");
  }
  const vendors = catalog?.vendors || 0;
  if (catalog?.source !== "remote" || !vendors) {
    throw new Error(
      `Packaged catalog unavailable: ${JSON.stringify({
        source: catalog?.source,
        error: catalog?.error,
        vendors
      })}`
    );
  }
  const products = catalog.products || [];
  const productIds = new Set(products.map((product) => product.id));
  const requiredProductIds = [
    "poe",
    "nous-hermes-desktop",
    "jan-desktop",
    "figma-design",
    "github-platform",
    "google-chrome-devtools",
    "docker-desktop"
  ];
  if (
    vendors < 116 ||
    products.length < 244 ||
    requiredProductIds.some((productId) => !productIds.has(productId))
  ) {
    throw new Error(
      `Packaged catalog is incomplete: ${JSON.stringify({
        vendors,
        products: products.length,
        missing: requiredProductIds.filter((productId) => !productIds.has(productId))
      })}`
    );
  }
  if (process.env.AIHUB_PACKAGED_EXPECT_DRAFT84 === "1") {
    const stores = new Set(catalog.resourceStoreIds || []);
    const readyCli = products.filter(
      (product) => product.moduleId === "cli-managed" &&
        !["openclaw-wsl-gateway", "augment-auggie-cli"].includes(product.id)
    );
    const anytype = products.find((product) => product.id === "anytype-cli");
    const desktop = products.filter(
      (product) => product.moduleId === "desktop-download-only"
    );
    if (
      catalog.catalogVersion !== 1 ||
      envelope.payload.draftRevision !== 84 ||
      products.length !== 615 ||
      catalog.homeCarouselSlides !== 3 ||
      !["skill", "mcp", "connector", "plugin"].every((id) => stores.has(id)) ||
      readyCli.length !== 32 ||
      desktop.length !== 14 ||
      anytype?.moduleId !== "cli-deploy-only"
    ) {
      throw new Error(`Draft84 packaged catalog contract failed: ${JSON.stringify({
        catalogVersion: catalog.catalogVersion,
        draftRevision: envelope.payload.draftRevision,
        products: products.length,
        slides: catalog.homeCarouselSlides,
        stores: [...stores],
        readyCli: readyCli.length,
        desktop: desktop.length,
        anytypeModule: anytype?.moduleId
      })}`);
    }
    const resource = await client.evaluate(`(() => {
      const ids = ["skill", "mcp", "connector", "plugin"];
      const buttons = ids.map((id) => document.querySelector(
        '[data-aihub-resource-store-id="' + id + '"]'
      ));
      buttons[0]?.click();
      return { stores: buttons.filter(Boolean).length };
    })()`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const levels = await client.evaluate(`(() => ({
        tools: Boolean(document.querySelector('[data-aihub-resource-level="tools"]')),
        tool: Boolean(document.querySelector('[data-aihub-action="open-resource-tool"]'))
      }))()`);
      if (levels.tools && levels.tool) {
        await client.evaluate(`document.querySelector('[data-aihub-action="open-resource-tool"]')?.click()`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    await client.evaluate(`document.querySelector('[data-aihub-action="open-resource-detail"]')?.click()`);
    const levels = await client.evaluate(`(() => ({
      resources: Boolean(document.querySelector('[data-aihub-resource-level="resources"]')),
      detail: Boolean(document.querySelector('[data-aihub-resource-level="detail"]'))
    }))()`);
    if (resource.stores !== 4 || !levels.detail) {
      throw new Error(`Draft84 resource navigation contract failed: ${JSON.stringify({ resource, levels })}`);
    }
  }
  const dom = await client.evaluate(`(() => {
    const candidate = [...document.querySelectorAll("button,a")].find((element) =>
      /(?:全部\\s*)?AI\\s*厂商|厂商目录/.test(element.innerText || "")
    );
    candidate?.click();
    return { clicked: Boolean(candidate) };
  })()`);
  let rendered = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    rendered = await client.evaluate(`(() => {
    const body = document.body?.innerText || "";
    return {
      vendorCards: document.querySelectorAll("[data-aihub-vendor-id]").length,
      blocked: /远程目录返回\\s*502|目录暂不可用/.test(body)
    };
  })()`);
    if (rendered.vendorCards > 0 || rendered.blocked) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!dom.clicked || rendered.vendorCards < 1 || rendered.blocked) {
    throw new Error(`Packaged catalog DOM gate failed: ${JSON.stringify({ dom, rendered })}`);
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      source: catalog.source,
      catalogVersion: catalog.catalogVersion,
      vendors,
      products: products.length
      ,vendorCards: rendered.vendorCards
      ,brandIconLoaded: packagedBrand.naturalWidth > 0
      ,normalizedSha256
    })}\n`
  );
} finally {
  try {
    await client?.close();
  } finally {
    await removeIsolatedAcceptanceProfile(profile);
  }
}
