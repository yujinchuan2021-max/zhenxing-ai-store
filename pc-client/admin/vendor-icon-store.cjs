"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  parseVendorIconDataUrl,
  vendorIconFilePath,
  verifyVendorIconAssetFile
} = require("../shared/vendor-icon.cjs");

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, filePath);
}

function validSourceUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function createVendorIconStore({ rootDirectory, manifestPath, clock = Date }) {
  function readManifest() {
    if (!fs.existsSync(manifestPath)) return { schemaVersion: 1, assets: {} };
    const value = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (
      value?.schemaVersion !== 1 ||
      !value.assets ||
      typeof value.assets !== "object" ||
      Array.isArray(value.assets)
    ) {
      throw new Error("厂商 Logo 来源清单无效");
    }
    return value;
  }

  function save({ vendorId, dataUrl, sourceUrl }) {
    if (
      typeof vendorId !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(vendorId) ||
      !validSourceUrl(sourceUrl)
    ) {
      throw new Error("厂商 Logo 必须填写有效的官方 HTTPS 来源");
    }
    const parsed = parseVendorIconDataUrl(dataUrl);
    const target = vendorIconFilePath(rootDirectory, parsed.asset);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) {
      const temporary = `${target}.tmp`;
      fs.writeFileSync(temporary, parsed.data, { flag: "wx" });
      fs.renameSync(temporary, target);
    }
    verifyVendorIconAssetFile(rootDirectory, parsed.asset);

    const manifest = readManifest();
    const previous = manifest.assets[parsed.asset.sha256];
    manifest.assets[parsed.asset.sha256] = {
      ...parsed.asset,
      sourceUrl,
      updatedAt: new clock().toISOString(),
      vendorIds: [...new Set([...(previous?.vendorIds || []), vendorId])].sort()
    };
    writeJsonAtomic(manifestPath, manifest);
    return parsed.asset;
  }

  function verifyCatalog(catalog) {
    let count = 0;
    for (const vendor of catalog?.vendors || []) {
      if (!vendor.iconAsset) continue;
      verifyVendorIconAssetFile(rootDirectory, vendor.iconAsset);
      count += 1;
    }
    return count;
  }

  return Object.freeze({ save, verifyCatalog });
}

module.exports = {
  createVendorIconStore
};
