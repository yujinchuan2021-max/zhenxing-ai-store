"use strict";

const {
  normalizeTrustedKeys
} = require("./signed-release.cjs");

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseReleaseUrl(value, allowLocalhost) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error("发布地址无效");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("发布地址无效");
  }
  const local =
    allowLocalhost &&
    parsed.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(parsed.hostname);
  if (
    (!local && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    parsed.toString() !== value
  ) {
    throw new Error("发布地址必须使用可信 HTTPS");
  }
  return parsed;
}

function validateReleaseChannel(value, { kind, allowLocalhost = false }) {
  const fields = new Set([
    "schemaVersion",
    "kind",
    "releaseUrl",
    "allowedReleaseOrigins",
    "trustedKeys"
  ]);
  if (
    !isPlainObject(value) ||
    Object.keys(value).length !== fields.size ||
    Object.keys(value).some((field) => !fields.has(field)) ||
    value.schemaVersion !== 2 ||
    value.kind !== kind ||
    !["catalog", "update"].includes(kind) ||
    !Array.isArray(value.allowedReleaseOrigins) ||
    value.allowedReleaseOrigins.length < 1 ||
    value.allowedReleaseOrigins.length > 4 ||
    new Set(value.allowedReleaseOrigins).size !==
      value.allowedReleaseOrigins.length
  ) {
    throw new Error("发布通道结构无效");
  }
  const release = parseReleaseUrl(value.releaseUrl, allowLocalhost);
  const origins = value.allowedReleaseOrigins.map((origin) => {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("发布来源必须是完整 origin");
    }
    const local =
      allowLocalhost &&
      parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(parsed.hostname);
    if (
      (!local && parsed.protocol !== "https:") ||
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("发布来源必须是完整 origin");
    }
    return origin;
  });
  if (!origins.includes(release.origin)) {
    throw new Error("发布地址不属于客户端固定来源");
  }
  normalizeTrustedKeys(value.trustedKeys);
  return {
    schemaVersion: 2,
    kind,
    releaseUrl: release.toString(),
    allowedReleaseOrigins: origins,
    trustedKeys: value.trustedKeys.map((entry) => ({
      keyId: entry.keyId,
      publicKey: entry.publicKey
    }))
  };
}

function validateDisabledReleaseChannel(value, kind) {
  if (
    !isPlainObject(value) ||
    value.schemaVersion !== 2 ||
    value.kind !== kind ||
    value.releaseUrl !== "" ||
    !Array.isArray(value.allowedReleaseOrigins) ||
    value.allowedReleaseOrigins.length !== 0 ||
    !Array.isArray(value.trustedKeys) ||
    value.trustedKeys.length !== 0
  ) {
    throw new Error("禁用的发布通道配置无效");
  }
  return {
    schemaVersion: 2,
    kind,
    releaseUrl: "",
    allowedReleaseOrigins: [],
    trustedKeys: []
  };
}

function readReleaseChannel(value, options) {
  return value?.releaseUrl === ""
    ? validateDisabledReleaseChannel(value, options.kind)
    : validateReleaseChannel(value, options);
}

module.exports = {
  readReleaseChannel,
  validateReleaseChannel
};
