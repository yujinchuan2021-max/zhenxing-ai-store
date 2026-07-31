"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FINGERPRINT_PATTERN =
  /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function validateLocalReleaseTrust(value, now = Date.now()) {
  const fields = new Set([
    "schemaVersion",
    "origin",
    "fingerprint256",
    "expiresAt"
  ]);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.size ||
    Object.keys(value).some((field) => !fields.has(field)) ||
    value.schemaVersion !== 1 ||
    value.origin !== "https://localhost:4443" ||
    typeof value.fingerprint256 !== "string" ||
    !FINGERPRINT_PATTERN.test(value.fingerprint256) ||
    typeof value.expiresAt !== "string"
  ) {
    throw new Error("本地发布证书固定配置无效");
  }
  const expiresAt = Date.parse(value.expiresAt);
  if (
    !Number.isFinite(expiresAt) ||
    new Date(expiresAt).toISOString() !== value.expiresAt ||
    expiresAt <= now ||
    expiresAt > now + 8 * 24 * 60 * 60 * 1000
  ) {
    throw new Error("本地发布证书固定配置已过期或期限过长");
  }
  return {
    schemaVersion: 1,
    origin: value.origin,
    fingerprint256: value.fingerprint256,
    expiresAt: value.expiresAt
  };
}

function readLocalReleaseTrust({
  resourcesPath,
  acceptanceBuild,
  now = Date.now()
}) {
  if (!acceptanceBuild) return null;
  if (typeof resourcesPath !== "string" || !path.isAbsolute(resourcesPath)) {
    throw new Error("本地发布证书资源目录无效");
  }
  return validateLocalReleaseTrust(
    JSON.parse(
      fs.readFileSync(
        path.join(resourcesPath, "local-release-trust.json"),
        "utf8"
      )
    ),
    now
  );
}

function shouldTrustLocalReleaseCertificate(
  trust,
  request,
  now = Date.now()
) {
  const hostname = String(request?.hostname || "").toLowerCase();
  const electronFingerprint = String(
    request?.certificate?.fingerprint || ""
  );
  const actualFingerprint = electronFingerprint.startsWith("sha256/")
    ? electronFingerprint.slice("sha256/".length)
    : "";
  const expectedFingerprint = trust
    ? Buffer.from(trust.fingerprint256.replaceAll(":", ""), "hex").toString(
        "base64"
      )
    : "";
  if (
    !trust ||
    !request ||
    !["localhost", "localhost:4443"].includes(hostname) ||
    actualFingerprint.length !== 44 ||
    actualFingerprint !== expectedFingerprint
  ) {
    return false;
  }
  return Date.parse(trust.expiresAt) > now;
}

function resolveCertificateVerificationCode(trust, request, now = Date.now()) {
  return shouldTrustLocalReleaseCertificate(trust, request, now) ? 0 : -3;
}

module.exports = {
  resolveCertificateVerificationCode,
  readLocalReleaseTrust,
  shouldTrustLocalReleaseCertificate,
  validateLocalReleaseTrust
};
