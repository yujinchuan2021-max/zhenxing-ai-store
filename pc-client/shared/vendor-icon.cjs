"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  MAX_AVATAR_BYTES,
  parseAvatarDataUrl
} = require("./avatar-image.cjs");

const VENDOR_ICON_MAX_BYTES = MAX_AVATAR_BYTES;
const MIME_TO_EXTENSION = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/svg+xml": "svg"
});
const EXTENSION_TO_MIME = Object.freeze(
  Object.fromEntries(
    Object.entries(MIME_TO_EXTENSION).map(([mimeType, extension]) => [
      extension,
      mimeType
    ])
  )
);
const VENDOR_ICON_PATH_PATTERN =
  /^vendor-icons\/([a-f0-9]{64})\.(png|jpg|webp|ico|svg)$/;

function parseSafeSvgDataUrl(value) {
  const match = typeof value === "string"
    ? value.match(/^data:image\/svg\+xml;base64,([A-Za-z0-9+/]+={0,2})$/)
    : null;
  if (!match) return null;
  const data = Buffer.from(match[1], "base64");
  if (
    !data.length ||
    data.length > VENDOR_ICON_MAX_BYTES ||
    data.toString("base64") !== match[1]
  ) {
    throw new Error("厂商 Logo SVG 文件无效或超过 384 KB");
  }
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    throw new Error("厂商 Logo SVG 必须使用 UTF-8");
  }
  if (
    !/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(source) ||
    /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|object|embed)\b|\son[a-z]+\s*=|javascript:|(?:href|xlink:href)\s*=\s*["'](?!#)|url\(\s*["']?(?:https?:|\/\/)|@import/i.test(source)
  ) {
    throw new Error("厂商 Logo SVG 包含外部资源或可执行内容");
  }
  return { mimeType: "image/svg+xml", data };
}

function exactObject(value, fields) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    Object.keys(value).every((field) => fields.includes(field))
  );
}

function validateVendorIconAsset(value) {
  if (!exactObject(value, ["path", "sha256", "mimeType"])) {
    throw new Error("厂商 Logo 资产结构无效");
  }
  const match =
    typeof value.path === "string"
      ? value.path.match(VENDOR_ICON_PATH_PATTERN)
      : null;
  if (
    !match ||
    typeof value.sha256 !== "string" ||
    value.sha256 !== match[1] ||
    EXTENSION_TO_MIME[match[2]] !== value.mimeType
  ) {
    throw new Error("厂商 Logo 资产路径、哈希或类型无效");
  }
  return value;
}

function parseVendorIconDataUrl(value) {
  let parsed = parseSafeSvgDataUrl(value);
  const iconMatch = typeof value === "string"
    ? value.match(/^data:image\/x-icon;base64,([A-Za-z0-9+/]+={0,2})$/)
    : null;
  if (parsed) {
    // Already validated as inert, self-contained SVG.
  } else if (iconMatch) {
    const data = Buffer.from(iconMatch[1], "base64");
    if (
      !data.length ||
      data.length > VENDOR_ICON_MAX_BYTES ||
      data.toString("base64") !== iconMatch[1] ||
      data.length < 6 ||
      !data.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]))
    ) {
      throw new Error("厂商 Logo ICO 文件无效或超过 384 KB");
    }
    parsed = { mimeType: "image/x-icon", data };
  } else {
    try {
      parsed = parseAvatarDataUrl(value);
    } catch {
      throw new Error("厂商 Logo 仅支持不超过 384 KB 的 PNG、JPEG、WebP、ICO 或安全 SVG 图片");
    }
  }
  if (!parsed) throw new Error("厂商 Logo 图片不能为空");
  const sha256 = crypto.createHash("sha256").update(parsed.data).digest("hex");
  const extension = MIME_TO_EXTENSION[parsed.mimeType];
  return {
    asset: {
      path: `vendor-icons/${sha256}.${extension}`,
      sha256,
      mimeType: parsed.mimeType
    },
    data: parsed.data
  };
}

function vendorIconFilePath(rootDirectory, asset) {
  const validated = validateVendorIconAsset(asset);
  const root = path.resolve(rootDirectory);
  const target = path.resolve(root, ...validated.path.split("/"));
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error("厂商 Logo 资产路径越界");
  }
  return target;
}

function verifyVendorIconAssetFile(rootDirectory, asset) {
  const target = vendorIconFilePath(rootDirectory, asset);
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch {
    throw new Error(`厂商 Logo 资产不存在：${asset.path}`);
  }
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size < 1 ||
    stat.size > VENDOR_ICON_MAX_BYTES
  ) {
    throw new Error(`厂商 Logo 资产文件无效：${asset.path}`);
  }
  const data = fs.readFileSync(target);
  const parsed = parseVendorIconDataUrl(
    `data:${asset.mimeType};base64,${data.toString("base64")}`
  );
  if (parsed.asset.sha256 !== asset.sha256) {
    throw new Error(`厂商 Logo 资产哈希不一致：${asset.path}`);
  }
  return { filePath: target, fileSize: stat.size };
}

function vendorIconAssetFromPath(assetPath) {
  const match =
    typeof assetPath === "string"
      ? assetPath.match(VENDOR_ICON_PATH_PATTERN)
      : null;
  if (!match) throw new Error("厂商 Logo 资产路径无效");
  return validateVendorIconAsset({
    path: assetPath,
    sha256: match[1],
    mimeType: EXTENSION_TO_MIME[match[2]]
  });
}

module.exports = {
  VENDOR_ICON_MAX_BYTES,
  VENDOR_ICON_PATH_PATTERN,
  parseVendorIconDataUrl,
  validateVendorIconAsset,
  vendorIconAssetFromPath,
  vendorIconFilePath,
  verifyVendorIconAssetFile
};
