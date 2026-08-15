"use strict";

const crypto = require("node:crypto");
const {
  canonicalize,
  isRolloutEligible,
  validateRollout,
  verifySignedEnvelope
} = require("./signed-release.cjs");

const ENTRY_KEYS = Object.freeze([
  "id",
  "kind",
  "subjectId",
  "mode",
  "version"
]);
const PAYLOAD_KEYS = Object.freeze([
  "schemaVersion",
  "releaseVersion",
  "publishedAt",
  "rollout",
  "entries"
]);
const KINDS = new Set(["environment", "extension", "product"]);
const MODES = new Set([
  "environment-download",
  "extension",
  "managed-cli",
  "package-manager"
]);
const EXACT_VERSION_MODES = new Set([
  "environment-download",
  "extension",
  "managed-cli"
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, keys) {
  return (
    isPlainObject(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function validIdentity(value) {
  return (
    typeof value === "string" &&
    /^[a-z0-9][a-z0-9._:-]{0,191}$/i.test(value)
  );
}

function validVersion(value) {
  return (
    typeof value === "string" &&
    /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/.test(value)
  );
}

function validTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validateSoftwareUpdateEntry(entry) {
  if (
    !hasExactKeys(entry, ENTRY_KEYS) ||
    !validIdentity(entry.id) ||
    !KINDS.has(entry.kind) ||
    !validIdentity(entry.subjectId) ||
    !MODES.has(entry.mode) ||
    entry.id !== `${entry.kind}:${entry.subjectId}` ||
    (entry.kind === "environment" && entry.mode !== "environment-download") ||
    (entry.kind === "extension" && entry.mode !== "extension") ||
    (entry.kind === "product" && !["managed-cli", "package-manager"].includes(entry.mode)) ||
    (EXACT_VERSION_MODES.has(entry.mode) && !validVersion(entry.version)) ||
    (entry.mode === "package-manager" && entry.version !== null)
  ) {
    throw new Error("软件更新条目无效");
  }
  return { ...entry };
}

function validateSoftwareUpdatePayload(value) {
  if (
    !hasExactKeys(value, PAYLOAD_KEYS) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.releaseVersion) ||
    value.releaseVersion < 1 ||
    !validTimestamp(value.publishedAt) ||
    !Array.isArray(value.entries) ||
    value.entries.length > 4096
  ) {
    throw new Error("软件更新清单无效");
  }
  const rollout = validateRollout(value.rollout);
  const entries = value.entries.map(validateSoftwareUpdateEntry);
  const ids = entries.map((entry) => entry.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id, index) => index > 0 && ids[index - 1].localeCompare(id) >= 0)
  ) {
    throw new Error("软件更新条目必须唯一并按身份排序");
  }
  return {
    schemaVersion: 1,
    releaseVersion: value.releaseVersion,
    publishedAt: value.publishedAt,
    rollout,
    entries
  };
}

function softwareUpdatePayloadSha256(payload) {
  return crypto
    .createHash("sha256")
    .update(canonicalize(validateSoftwareUpdatePayload(payload)), "utf8")
    .digest("hex");
}

function normalizeSoftwareUpdateHighWater(value) {
  if (value == null) {
    return { schemaVersion: 1, releaseVersion: 0, payloadSha256: "" };
  }
  if (
    !hasExactKeys(value, ["schemaVersion", "releaseVersion", "payloadSha256"]) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.releaseVersion) ||
    value.releaseVersion < 0 ||
    typeof value.payloadSha256 !== "string" ||
    (value.payloadSha256 !== "" && !/^[a-f0-9]{64}$/.test(value.payloadSha256)) ||
    (value.releaseVersion === 0) !== (value.payloadSha256 === "")
  ) {
    throw new Error("软件更新防回退记录无效");
  }
  return { ...value };
}

function assertNotReplayed(payload, highWater) {
  const highest = normalizeSoftwareUpdateHighWater(highWater);
  const payloadSha256 = softwareUpdatePayloadSha256(payload);
  if (payload.releaseVersion < highest.releaseVersion) {
    throw new Error("软件更新清单是旧版本，已拒绝回退");
  }
  if (
    payload.releaseVersion === highest.releaseVersion &&
    highest.payloadSha256 &&
    payloadSha256 !== highest.payloadSha256
  ) {
    throw new Error("软件更新清单版本发生冲突");
  }
  return payloadSha256;
}

function verifySoftwareUpdateRelease(
  envelope,
  { trustedKeys, clientId, highWater = null }
) {
  const payload = validateSoftwareUpdatePayload(
    verifySignedEnvelope(envelope, {
      kind: "software-updates",
      trustedKeys
    })
  );
  const payloadSha256 = assertNotReplayed(payload, highWater);
  return {
    ...payload,
    eligible: isRolloutEligible(clientId, payload.rollout),
    payloadSha256
  };
}

function recordSoftwareUpdateHighWater(current, release) {
  const highest = normalizeSoftwareUpdateHighWater(current);
  if (
    !release ||
    !Number.isSafeInteger(release.releaseVersion) ||
    !/^[a-f0-9]{64}$/.test(String(release.payloadSha256 || ""))
  ) {
    throw new Error("软件更新防回退记录参数无效");
  }
  if (release.releaseVersion < highest.releaseVersion) return highest;
  return {
    schemaVersion: 1,
    releaseVersion: release.releaseVersion,
    payloadSha256: release.payloadSha256
  };
}

function isSoftwareUpdatePublished(
  release,
  { kind, subjectId, mode, version }
) {
  if (!release || release.eligible === false || !validVersion(version)) {
    return false;
  }
  const id = `${kind}:${subjectId}`;
  const entry = Array.isArray(release.entries)
    ? release.entries.find((candidate) => candidate.id === id)
    : null;
  if (
    !entry ||
    entry.kind !== kind ||
    entry.subjectId !== subjectId ||
    entry.mode !== mode
  ) {
    return false;
  }
  return mode === "package-manager" ? entry.version === null : entry.version === version;
}

module.exports = {
  isSoftwareUpdatePublished,
  normalizeSoftwareUpdateHighWater,
  recordSoftwareUpdateHighWater,
  softwareUpdatePayloadSha256,
  validateSoftwareUpdatePayload,
  verifySoftwareUpdateRelease
};
