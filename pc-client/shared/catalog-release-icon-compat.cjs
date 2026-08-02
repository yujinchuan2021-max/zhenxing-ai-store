"use strict";

const {
  validateVendorIconAsset
} = require("./vendor-icon.cjs");
const {
  allowedAssetHost,
  isAllowedPublishedVendorIconUrl
} = require("./catalog-published-icon-url.cjs");

function materializeLegacyVendorIconUrls(catalog, assetOrigin) {
  let base;
  try {
    base = new URL(assetOrigin);
  } catch {
    throw new Error("目录 Logo 发布来源无效");
  }
  if (
    base.protocol !== "https:" ||
    !allowedAssetHost(base.hostname.toLowerCase()) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error("目录 Logo 发布来源无效");
  }
  const released = structuredClone(catalog);
  for (const vendor of released.vendors || []) {
    if (vendor.iconAsset) {
      const asset = validateVendorIconAsset(vendor.iconAsset);
      vendor.iconUrl = new URL(asset.path, `${base.origin}/`).href;
      delete vendor.iconAsset;
    } else if (vendor.iconUrl && !isAllowedPublishedVendorIconUrl(vendor.iconUrl)) {
      throw new Error(`厂商 Logo 发布地址无效：${vendor.id}`);
    }
  }
  return released;
}

module.exports = {
  isAllowedPublishedVendorIconUrl,
  materializeLegacyVendorIconUrls
};
