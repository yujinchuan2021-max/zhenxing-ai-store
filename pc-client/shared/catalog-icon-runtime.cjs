"use strict";

const {
  isAllowedPublishedVendorIconUrl
} = require("./catalog-published-icon-url.cjs");

const ICON_ASSET_PATTERN = /^vendor-icons\/([a-f0-9]{64})\.(png|jpg|webp|ico|svg)$/;
const MIME_BY_EXTENSION = Object.freeze({
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  svg: "image/svg+xml"
});

function validateRuntimeAsset(value) {
  const match = typeof value?.path === "string"
    ? value.path.match(ICON_ASSET_PATTERN)
    : null;
  if (
    !match ||
    value.sha256 !== match[1] ||
    value.mimeType !== MIME_BY_EXTENSION[match[2]]
  ) {
    throw new Error("厂商 Logo 运行时资产无效");
  }
  return value;
}

function resolveAssetUrl(assetPath, releaseUrl) {
  if (/^https?:\/\//i.test(releaseUrl)) {
    return new URL(assetPath, releaseUrl).href;
  }
  const base = String(releaseUrl || "").replace(/[^/]*$/, "");
  return `${base}${assetPath}`;
}

function resolveCatalogIconUrls(catalog, releaseUrl) {
  if (!catalog || !Array.isArray(catalog.vendors)) return catalog;
  return {
    ...catalog,
    vendors: catalog.vendors.map((vendor) => {
      if (vendor.iconUrl) {
        if (!isAllowedPublishedVendorIconUrl(vendor.iconUrl)) {
          throw new Error("厂商 Logo 运行时地址无效");
        }
        return vendor;
      }
      if (!vendor.iconAsset) return vendor;
      const asset = validateRuntimeAsset(vendor.iconAsset);
      return {
        ...vendor,
        iconUrl: resolveAssetUrl(asset.path, releaseUrl)
      };
    })
  };
}

module.exports = {
  resolveCatalogIconUrls
};
