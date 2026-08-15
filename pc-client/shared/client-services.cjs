"use strict";

const CLIENT_SERVICE_FIELDS = new Set([
  "schemaVersion",
  "identityOrigin",
  "communityOrigin"
]);
const LOCAL_CLIENT_SERVICES = Object.freeze({
  schemaVersion: 1,
  identityOrigin: "http://127.0.0.1:4180",
  communityOrigin: "http://127.0.0.1:8088"
});

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isLoopbackHostname(value) {
  const hostname = String(value || "").toLowerCase().replace(/\.$/, "");
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname) ||
    /^\[::ffff:127(?:\.\d{1,3}){3}\]$/.test(hostname) ||
    /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]+\]$/.test(hostname)
  );
}

function validateServiceOrigin(value, { label, variant }) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error(`${label}地址无效`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label}地址无效`);
  }
  if (
    parsed.origin !== value ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${label}地址必须是完整 origin`);
  }

  const loopback = isLoopbackHostname(parsed.hostname);
  if (
    variant === "local" &&
    (!loopback || !["http:", "https:"].includes(parsed.protocol))
  ) {
    throw new Error(`本地包的${label}地址必须是本机回环 origin`);
  }
  if (
    variant === "production" &&
    (loopback || parsed.protocol !== "https:")
  ) {
    throw new Error(`正式包的${label}地址必须是非回环 HTTPS origin`);
  }
  if (
    variant === "development" &&
    parsed.protocol !== "https:" &&
    !(loopback && parsed.protocol === "http:")
  ) {
    throw new Error(`${label}地址必须使用 HTTPS 或本机回环 HTTP`);
  }
  return parsed.origin;
}

function validateClientServices(value, { variant }) {
  if (
    !["development", "local", "production"].includes(variant) ||
    !isPlainObject(value) ||
    Object.keys(value).length !== CLIENT_SERVICE_FIELDS.size ||
    Object.keys(value).some((field) => !CLIENT_SERVICE_FIELDS.has(field)) ||
    value.schemaVersion !== 1
  ) {
    throw new Error("客户端服务配置结构无效");
  }
  return Object.freeze({
    schemaVersion: 1,
    identityOrigin: validateServiceOrigin(value.identityOrigin, {
      label: "身份服务",
      variant
    }),
    communityOrigin: validateServiceOrigin(value.communityOrigin, {
      label: "社区",
      variant
    })
  });
}

function resolveClientServices({
  isPackaged,
  localReleaseAcceptance = false,
  upgradeFixture = false,
  packagedConfig,
  env = {}
}) {
  if (isPackaged) {
    return validateClientServices(
      upgradeFixture ? LOCAL_CLIENT_SERVICES : packagedConfig,
      {
        variant:
          localReleaseAcceptance || upgradeFixture ? "local" : "production"
      }
    );
  }
  return validateClientServices(
    {
      schemaVersion: 1,
      identityOrigin:
        env.AIHUB_IDENTITY_ORIGIN || LOCAL_CLIENT_SERVICES.identityOrigin,
      communityOrigin:
        env.AIHUB_COMMUNITY_PUBLIC_ORIGIN ||
        LOCAL_CLIENT_SERVICES.communityOrigin
    },
    { variant: "development" }
  );
}

module.exports = {
  LOCAL_CLIENT_SERVICES,
  isLoopbackHostname,
  resolveClientServices,
  validateClientServices
};
