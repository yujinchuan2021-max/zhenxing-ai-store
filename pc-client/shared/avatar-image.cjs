"use strict";

const MAX_AVATAR_BYTES = 384 * 1024;
const DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function hasExpectedSignature(mimeType, data) {
  if (mimeType === "image/jpeg") {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      data.length >= 8 &&
      data.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    );
  }
  return (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function parseAvatarDataUrl(value) {
  if (value === "") return null;
  if (typeof value !== "string") throw new Error("头像数据无效");
  const match = value.match(DATA_URL_PATTERN);
  if (!match) throw new Error("头像只支持 JPG、PNG 或 WebP");
  const mimeType = `image/${match[1]}`;
  const data = Buffer.from(match[2], "base64");
  if (
    data.length === 0 ||
    data.length > MAX_AVATAR_BYTES ||
    data.toString("base64") !== match[2] ||
    !hasExpectedSignature(mimeType, data)
  ) {
    throw new Error("头像文件无效或超过 384 KB");
  }
  return { mimeType, data };
}

module.exports = {
  MAX_AVATAR_BYTES,
  parseAvatarDataUrl
};
