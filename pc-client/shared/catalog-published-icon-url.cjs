"use strict";

const PUBLISHED_VENDOR_ICON_PATH_PATTERN =
  /^vendor-icons\/([a-f0-9]{64})\.(png|jpg|webp|ico|svg)$/;

function allowedAssetHost(hostname) {
  return (
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "[::1]" ||
    hostname === "zhenxingai.com" ||
    hostname.endsWith(".zhenxingai.com")
  );
}

function isAllowedPublishedVendorIconUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      allowedAssetHost(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      PUBLISHED_VENDOR_ICON_PATH_PATTERN.test(url.pathname.replace(/^\//, ""))
    );
  } catch {
    return false;
  }
}

module.exports = {
  allowedAssetHost,
  isAllowedPublishedVendorIconUrl,
  PUBLISHED_VENDOR_ICON_PATH_PATTERN
};
