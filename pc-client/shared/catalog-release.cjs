"use strict";

const { sha256, validateCatalog } = require("./catalog.cjs");
const {
  canonicalize,
  isRolloutEligible,
  validateRollout,
  verifySignedEnvelope
} = require("./signed-release.cjs");

const PAYLOAD_FIELDS = new Set([
  "schemaVersion",
  "releaseId",
  "catalogVersion",
  "publishedAt",
  "draftRevision",
  "parentReleaseId",
  "sourceReleaseId",
  "notes",
  "rollout",
  "catalogSha256",
  "catalog"
]);
const CACHE_FIELDS = new Set([
  "schemaVersion",
  "sourceUrl",
  "cachedAt",
  "envelope"
]);
const RELEASE_ID_PATTERN = /^catalog-v\d{8}-[a-f0-9]{12}-[a-f0-9]{8}$/;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactFields(value, fields) {
  return (
    isPlainObject(value) &&
    Object.keys(value).length === fields.size &&
    Object.keys(value).every((field) => fields.has(field))
  );
}

function canonicalTimestamp(value, label) {
  if (typeof value !== "string") throw new Error(`${label}无效`);
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== value
  ) {
    throw new Error(`${label}必须使用 canonical ISO 时间`);
  }
  return value;
}

function catalogReleaseSha256(catalog) {
  return sha256(canonicalize(catalog));
}

function validateCatalogReleasePayloadIntegrity(payload) {
  if (
    !hasExactFields(payload, PAYLOAD_FIELDS) ||
    payload.schemaVersion !== 1 ||
    typeof payload.releaseId !== "string" ||
    !RELEASE_ID_PATTERN.test(payload.releaseId) ||
    !Number.isSafeInteger(payload.catalogVersion) ||
    payload.catalogVersion < 1 ||
    !Number.isSafeInteger(payload.draftRevision) ||
    payload.draftRevision < 1 ||
    (payload.parentReleaseId !== null &&
      !RELEASE_ID_PATTERN.test(payload.parentReleaseId)) ||
    (payload.sourceReleaseId !== null &&
      !RELEASE_ID_PATTERN.test(payload.sourceReleaseId)) ||
    typeof payload.notes !== "string" ||
    payload.notes.length > 500 ||
    typeof payload.catalogSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(payload.catalogSha256) ||
    !hasExactFields(payload.rollout, new Set(["percentage", "salt"])) ||
    !isPlainObject(payload.catalog)
  ) {
    throw new Error("目录发布内容结构无效");
  }

  const publishedAt = canonicalTimestamp(payload.publishedAt, "目录发布时间");
  const rollout = validateRollout(payload.rollout);
  const digest = catalogReleaseSha256(payload.catalog);
  if (digest !== payload.catalogSha256) {
    throw new Error("目录内容摘要与签名发布记录不一致");
  }

  return {
    schemaVersion: 1,
    releaseId: payload.releaseId,
    catalogVersion: payload.catalogVersion,
    publishedAt,
    draftRevision: payload.draftRevision,
    parentReleaseId: payload.parentReleaseId,
    sourceReleaseId: payload.sourceReleaseId,
    notes: payload.notes,
    rollout,
    catalogSha256: digest,
    catalog: payload.catalog
  };
}

function validateCatalogReleasePayload(payload) {
  const release = validateCatalogReleasePayloadIntegrity(payload);
  return {
    ...release,
    catalog: validateCatalog(release.catalog)
  };
}

function verifyCatalogReleaseIntegrity(envelope, { trustedKeys }) {
  return validateCatalogReleasePayloadIntegrity(
    verifySignedEnvelope(envelope, {
      kind: "catalog",
      trustedKeys
    })
  );
}

function normalizeHighestVersion(value) {
  const candidate = value === undefined ? 0 : value;
  if (!Number.isSafeInteger(candidate) || candidate < 0) {
    throw new Error("目录最高版本记录无效");
  }
  return candidate;
}

function verifyCatalogRelease(
  envelope,
  {
    trustedKeys,
    clientId,
    highestCatalogVersion = 0,
    highestCatalogSha256 = ""
  }
) {
  const highestVersion = normalizeHighestVersion(highestCatalogVersion);
  if (
    typeof highestCatalogSha256 !== "string" ||
    (highestCatalogSha256 !== "" &&
      !/^[a-f0-9]{64}$/.test(highestCatalogSha256))
  ) {
    throw new Error("目录最高版本摘要记录无效");
  }

  const signedPayload = verifySignedEnvelope(envelope, {
    kind: "catalog",
    trustedKeys
  });
  const release = validateCatalogReleasePayload(signedPayload);
  if (release.catalogVersion < highestVersion) {
    throw new Error("目录发布版本低于客户端已接受的最高版本");
  }
  if (
    release.catalogVersion === highestVersion &&
    highestCatalogSha256 &&
    release.catalogSha256 !== highestCatalogSha256
  ) {
    throw new Error("同一目录版本的内容与客户端已接受记录不一致");
  }

  return {
    ...release,
    eligible: isRolloutEligible(clientId, release.rollout),
    highestCatalogVersion: Math.max(highestVersion, release.catalogVersion)
  };
}

function normalizeSourceUrl(value, allowLocalhost = false) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error("目录缓存来源无效");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("目录缓存来源无效");
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
    throw new Error("目录缓存来源必须是 canonical HTTPS 地址");
  }
  return value;
}

function verifyCatalogReleaseCache(
  cache,
  {
    expectedSourceUrl,
    trustedKeys,
    clientId,
    highestCatalogVersion = 0,
    highestCatalogSha256 = "",
    allowLocalhost = false
  }
) {
  if (
    !hasExactFields(cache, CACHE_FIELDS) ||
    cache.schemaVersion !== 1
  ) {
    throw new Error("目录签名缓存结构无效");
  }
  const sourceUrl = normalizeSourceUrl(cache.sourceUrl, allowLocalhost);
  const expected = normalizeSourceUrl(expectedSourceUrl, allowLocalhost);
  if (sourceUrl !== expected) {
    throw new Error("目录签名缓存来源与当前通道不一致");
  }
  const cachedAt = canonicalTimestamp(cache.cachedAt, "目录缓存时间");
  const release = verifyCatalogRelease(cache.envelope, {
    trustedKeys,
    clientId,
    highestCatalogVersion,
    highestCatalogSha256
  });
  if (Date.parse(cachedAt) < Date.parse(release.publishedAt)) {
    throw new Error("目录缓存时间早于目录发布时间");
  }
  return {
    ...release,
    sourceUrl,
    cachedAt
  };
}

module.exports = {
  catalogReleaseSha256,
  validateCatalogReleasePayload,
  verifyCatalogReleaseIntegrity,
  verifyCatalogRelease,
  verifyCatalogReleaseCache
};
