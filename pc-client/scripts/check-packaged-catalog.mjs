import fs from "node:fs";
import path from "node:path";
import {
  createIsolatedAcceptanceProfile,
  launchPackagedClientCdp,
  removeIsolatedAcceptanceProfile
} from "./lib/packaged-client-cdp.mjs";

const executable = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(executable)) {
  throw new Error("Usage: node scripts/check-packaged-catalog.mjs <package.exe>");
}

const profile = createIsolatedAcceptanceProfile("aihub-catalog-check-");
let client;
try {
  client = await launchPackagedClientCdp({ executable, profile });
  const deadline = Date.now() + 20_000;
  while (
    Date.now() < deadline &&
    !(await client.evaluate("Boolean(window.aihubPC?.getCatalog)"))
  ) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const catalog = await client.evaluate("window.aihubPC.getCatalog()");
  const vendors = catalog?.catalog?.vendors;
  if (catalog?.source !== "remote" || !Array.isArray(vendors) || !vendors.length) {
    throw new Error(
      `Packaged catalog unavailable: ${JSON.stringify({
        source: catalog?.source,
        error: catalog?.error,
        vendors: Array.isArray(vendors) ? vendors.length : 0
      })}`
    );
  }
  const products = vendors.flatMap((vendor) => vendor.products || []);
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
    vendors.length < 116 ||
    products.length < 244 ||
    requiredProductIds.some((productId) => !productIds.has(productId))
  ) {
    throw new Error(
      `Packaged catalog is incomplete: ${JSON.stringify({
        vendors: vendors.length,
        products: products.length,
        missing: requiredProductIds.filter((productId) => !productIds.has(productId))
      })}`
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      source: catalog.source,
      catalogVersion: catalog.catalogVersion,
      vendors: vendors.length,
      products: products.length
    })}\n`
  );
} finally {
  try {
    await client?.close();
  } finally {
    await removeIsolatedAcceptanceProfile(profile);
  }
}
