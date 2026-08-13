"use strict";

const { X509Certificate } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const FINGERPRINT_PATTERN = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const MIN_ROOT_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ROOT_VALIDITY_MS = 11 * 366 * 24 * 60 * 60 * 1000;

function parseCertificate(data) {
  try {
    return new X509Certificate(data);
  } catch {
    return null;
  }
}

function certificateIsValidAt(certificate, now) {
  const validFrom = Date.parse(certificate.validFrom);
  const validTo = Date.parse(certificate.validTo);
  return (
    Number.isFinite(validFrom) &&
    Number.isFinite(validTo) &&
    validFrom <= now &&
    validTo > now
  );
}

function validateLocalReleaseTrust(value, now = Date.now()) {
  const fields = new Set([
    "schemaVersion",
    "origin",
    "rootFingerprint256",
    "rootCertificatePem",
    "expiresAt"
  ]);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.size ||
    Object.keys(value).some((field) => !fields.has(field)) ||
    value.schemaVersion !== 2 ||
    value.origin !== "https://localhost:4443" ||
    typeof value.rootFingerprint256 !== "string" ||
    !FINGERPRINT_PATTERN.test(value.rootFingerprint256) ||
    typeof value.rootCertificatePem !== "string" ||
    typeof value.expiresAt !== "string"
  ) {
    throw new Error("本地发布根证书固定配置无效");
  }
  const root = parseCertificate(value.rootCertificatePem);
  const expiresAt = Date.parse(value.expiresAt);
  const certificateExpiry = root ? Date.parse(root.validTo) : NaN;
  if (
    !root ||
    !root.ca ||
    root.subject !== root.issuer ||
    !root.checkIssued(root) ||
    !root.verify(root.publicKey) ||
    root.fingerprint256 !== value.rootFingerprint256 ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(certificateExpiry) ||
    new Date(expiresAt).toISOString() !== value.expiresAt ||
    expiresAt !== certificateExpiry ||
    Date.parse(root.validFrom) > now ||
    expiresAt <= now + MIN_ROOT_VALIDITY_MS ||
    expiresAt > now + MAX_ROOT_VALIDITY_MS
  ) {
    throw new Error("本地发布根证书已过期、期限不足或证书结构无效");
  }
  return {
    schemaVersion: 2,
    origin: value.origin,
    rootFingerprint256: value.rootFingerprint256,
    rootCertificatePem: root.toString(),
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
    throw new Error("本地发布根证书资源目录无效");
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

function requestHostname(value) {
  const hostname = String(value || "").toLowerCase();
  if (hostname === "localhost" || hostname === "localhost:4443") {
    return "localhost";
  }
  if (hostname === "127.0.0.1" || hostname === "127.0.0.1:4443") {
    return "127.0.0.1";
  }
  return null;
}

function electronFingerprint(certificate) {
  return `sha256/${Buffer.from(
    certificate.fingerprint256.replaceAll(":", ""),
    "hex"
  ).toString("base64")}`;
}

function certificateChain(certificate) {
  const chain = [];
  const seen = new Set();
  let current = certificate;
  while (current && chain.length < 8) {
    const parsed = parseCertificate(current.data);
    if (!parsed || seen.has(parsed.fingerprint256)) return null;
    chain.push(parsed);
    seen.add(parsed.fingerprint256);
    if (!current.issuerCert || current.issuerCert === current) break;
    current = current.issuerCert;
  }
  return current?.issuerCert && chain.length === 8 ? null : chain;
}

function chainsToPinnedRoot(chain, root, now) {
  if (!chain?.length || chain[0].ca) return false;
  for (const certificate of chain) {
    if (!certificateIsValidAt(certificate, now)) return false;
  }
  for (let index = 0; index < chain.length - 1; index += 1) {
    const child = chain[index];
    const issuer = chain[index + 1];
    if (
      !issuer.ca ||
      !child.checkIssued(issuer) ||
      !child.verify(issuer.publicKey)
    ) {
      return false;
    }
  }
  const last = chain.at(-1);
  if (last.fingerprint256 === root.fingerprint256) return true;
  return (
    root.ca &&
    last.checkIssued(root) &&
    last.verify(root.publicKey)
  );
}

function shouldTrustLocalReleaseCertificate(trust, request, now = Date.now()) {
  const hostname = requestHostname(request?.hostname);
  const root = parseCertificate(trust?.rootCertificatePem);
  const chain = certificateChain(request?.certificate);
  const leaf = chain?.[0];
  if (
    !trust ||
    !hostname ||
    !root ||
    root.fingerprint256 !== trust.rootFingerprint256 ||
    Date.parse(trust.expiresAt) <= now ||
    !leaf ||
    request.certificate.fingerprint !== electronFingerprint(leaf) ||
    (hostname === "127.0.0.1"
      ? leaf.checkIP(hostname)
      : leaf.checkHost(hostname, {
          wildcards: false,
          partialWildcards: false,
          multiLabelWildcards: false,
          singleLabelSubdomains: false
        })) !== hostname
  ) {
    return false;
  }
  return chainsToPinnedRoot(chain, root, now);
}

function resolveCertificateVerificationCode(trust, request, now = Date.now()) {
  if (!requestHostname(request?.hostname)) return -3;
  if (!shouldTrustLocalReleaseCertificate(trust, request, now)) return -2;
  if (request.verificationResult === "net::ERR_CERT_AUTHORITY_INVALID") {
    return 0;
  }
  return request.verificationResult === "net::OK" ? -3 : -2;
}

module.exports = {
  resolveCertificateVerificationCode,
  readLocalReleaseTrust,
  shouldTrustLocalReleaseCertificate,
  validateLocalReleaseTrust
};
