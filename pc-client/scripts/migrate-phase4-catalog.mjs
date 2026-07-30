import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  normalizeSourcePreferences
} = require("../shared/environment-download.cjs");

const targets = [
  path.resolve("admin/data/catalog-v1.json")
];

for (const target of targets) {
  const catalog = JSON.parse(fs.readFileSync(target, "utf8"));
  catalog.environmentDownloads ||= {
    strategy: "official-first",
    probeTimeoutMs: 5000,
    sources: normalizeSourcePreferences()
  };
  catalog.vendors.forEach((vendor, vendorIndex) => {
    vendor.enabled ??= true;
    vendor.order ??= vendorIndex;
    vendor.iconUrl ??= "";
    vendor.products.forEach((product, productIndex) => {
      product.enabled ??= true;
      product.order ??= productIndex;
    });
  });
  fs.writeFileSync(target, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}
