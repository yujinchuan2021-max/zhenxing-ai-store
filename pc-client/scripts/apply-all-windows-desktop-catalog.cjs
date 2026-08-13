"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const configuredCatalogPath = process.env.AIHUB_CATALOG_PATH || "";
if (configuredCatalogPath && !path.isAbsolute(configuredCatalogPath)) {
  throw new Error("AIHUB_CATALOG_PATH must be absolute");
}
const catalogPath =
  configuredCatalogPath || path.join(root, "admin", "data", "catalog-v1.json");
const stagingPath = path.join(
  path.dirname(catalogPath),
  `.${path.basename(catalogPath)}.${process.pid}.${Date.now()}.tmp`
);
const scripts = [
  "apply-windows-desktop-expansion-v2.cjs",
  "apply-windows-desktop-catalog.cjs",
  "apply-windows-package-manager-catalog.cjs"
];

function semanticJson(catalog) {
  const value = { ...catalog };
  delete value.updatedAt;
  return JSON.stringify(value);
}

const originalText = fs.readFileSync(catalogPath, "utf8");
const originalCatalog = JSON.parse(originalText);
fs.writeFileSync(stagingPath, originalText, { encoding: "utf8", flag: "wx" });

try {
  for (const script of scripts) {
    const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
      cwd: root,
      env: { ...process.env, AIHUB_CATALOG_PATH: stagingPath },
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    if (result.error || result.status !== 0) {
      throw new Error(
        result.error?.message ||
          result.stderr?.trim() ||
          result.stdout?.trim() ||
          `${script} failed`
      );
    }
  }

  const stagedCatalog = JSON.parse(fs.readFileSync(stagingPath, "utf8"));
  validateCatalog(stagedCatalog);
  const changed = semanticJson(stagedCatalog) !== semanticJson(originalCatalog);
  if (changed) fs.renameSync(stagingPath, catalogPath);
  process.stdout.write(
    `${JSON.stringify({
      changed,
      vendors: stagedCatalog.vendors.length,
      products: stagedCatalog.vendors.reduce(
        (total, vendor) => total + vendor.products.length,
        0
      )
    })}\n`
  );
} finally {
  try {
    fs.rmSync(stagingPath, { force: true });
  } catch {
    // Cleanup is intentionally limited to this exact staging file.
  }
}
