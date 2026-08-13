"use strict";

const {
  isRolloutEligible,
  validateRollout,
  verifySignedEnvelope
} = require("./signed-release.cjs");
const { compareVersions, parseVersion } = require("./update.cjs");

const UPDATE_CHANNELS = new Set(["stable", "beta"]);
const UPDATE_PAYLOAD_FIELDS = new Set([
  "version",
  "publishedAt",
  "downloadUrl",
  "sha256",
  "fileSize",
  "platform",
  "arch",
  "channel",
  "notes",
  "rollout"
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeAllowedOrigins(origins, { allowLocalhost = false } = {}) {
  if (
    !Array.isArray(origins) ||
    origins.length < 1 ||
    origins.length > 8 ||
    new Set(origins).size !== origins.length
  ) {
    throw new Error("Update download origins are invalid");
  }

  return origins.map((origin) => {
    if (typeof origin !== "string") {
      throw new Error("Update download origin must be an exact HTTPS origin");
    }
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("Update download origin must be an exact HTTPS origin");
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
      parsed.hash ||
      parsed.hostname.includes("*")
    ) {
      throw new Error("Update download origin must be an exact HTTPS origin");
    }
    return origin;
  });
}

function normalizePublishedAt(value) {
  if (typeof value !== "string") {
    throw new Error("Update publishedAt must be an ISO-8601 timestamp");
  }
  const milliseconds = Date.parse(value);
  if (
    Number.isNaN(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    throw new Error("Update publishedAt must be a canonical ISO-8601 timestamp");
  }
  return value;
}

function normalizeDownloadUrl(value, allowedOrigins, { allowLocalhost = false } = {}) {
  if (typeof value !== "string" || value.length < 1 || value.length > 2048) {
    throw new Error("Update download URL is invalid");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Update download URL is invalid");
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
    !allowedOrigins.includes(parsed.origin)
  ) {
    throw new Error("Update download URL does not use a pinned HTTPS origin");
  }
  return parsed.href;
}

function validateUpdatePayload(
  payload,
  allowedDownloadOrigins,
  { allowLocalhost = false } = {}
) {
  const allowedOrigins = normalizeAllowedOrigins(allowedDownloadOrigins, {
    allowLocalhost
  });
  if (
    !isPlainObject(payload) ||
    Object.keys(payload).length !== UPDATE_PAYLOAD_FIELDS.size ||
    Object.keys(payload).some((field) => !UPDATE_PAYLOAD_FIELDS.has(field))
  ) {
    throw new Error("Signed update payload structure is invalid");
  }

  parseVersion(payload.version);
  if (
    typeof payload.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(payload.sha256)
  ) {
    throw new Error("Update SHA-256 must be 64 lowercase hexadecimal characters");
  }
  if (
    !Number.isSafeInteger(payload.fileSize) ||
    payload.fileSize < 1
  ) {
    throw new Error("Update fileSize must be a positive safe integer");
  }
  if (payload.platform !== "win32" || payload.arch !== "x64") {
    throw new Error("Update release must target win32 x64");
  }
  if (!UPDATE_CHANNELS.has(payload.channel)) {
    throw new Error("Update channel must be stable or beta");
  }
  if (
    !Array.isArray(payload.notes) ||
    payload.notes.length > 20 ||
    payload.notes.some(
      (note) =>
        typeof note !== "string" ||
        note.length < 1 ||
        note.length > 300
    )
  ) {
    throw new Error("Update notes are invalid");
  }

  return {
    version: payload.version,
    publishedAt: normalizePublishedAt(payload.publishedAt),
    downloadUrl: normalizeDownloadUrl(payload.downloadUrl, allowedOrigins, {
      allowLocalhost
    }),
    sha256: payload.sha256,
    fileSize: payload.fileSize,
    platform: "win32",
    arch: "x64",
    channel: payload.channel,
    notes: [...payload.notes],
    rollout: validateRollout(payload.rollout)
  };
}

function validateSignedUpdateRelease(
  envelope,
  { trustedKeys, allowedDownloadOrigins, allowLocalhost = false }
) {
  const payload = verifySignedEnvelope(envelope, {
    kind: "update",
    trustedKeys
  });
  return validateUpdatePayload(payload, allowedDownloadOrigins, {
    allowLocalhost
  });
}

function evaluateUpdateRelease(release, currentVersion, clientId) {
  if (!isPlainObject(release)) {
    throw new Error("Validated update release is required");
  }
  parseVersion(currentVersion);
  parseVersion(release.version);

  if (compareVersions(release.version, currentVersion) <= 0) {
    return {
      status: "current",
      currentVersion,
      version: release.version,
      eligible: false
    };
  }
  if (!isRolloutEligible(clientId, release.rollout)) {
    return {
      status: "not-eligible",
      currentVersion,
      version: release.version,
      eligible: false
    };
  }
  return {
    status: "available",
    currentVersion,
    version: release.version,
    eligible: true,
    release
  };
}

function verifyAndEvaluateUpdateRelease(
  envelope,
  {
    trustedKeys,
    allowedDownloadOrigins,
    allowLocalhost = false,
    currentVersion,
    clientId
  }
) {
  const release = validateSignedUpdateRelease(envelope, {
    trustedKeys,
    allowedDownloadOrigins,
    allowLocalhost
  });
  return evaluateUpdateRelease(release, currentVersion, clientId);
}

module.exports = {
  UPDATE_CHANNELS,
  evaluateUpdateRelease,
  normalizeAllowedOrigins,
  validateSignedUpdateRelease,
  validateUpdatePayload,
  verifyAndEvaluateUpdateRelease
};
