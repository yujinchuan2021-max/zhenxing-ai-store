"use strict";

const { X509Certificate } = require("node:crypto");
const {
  shouldTrustLocalReleaseCertificate,
  validateLocalReleaseTrust
} = require("./local-release-trust.cjs");

function electronFingerprint(certificate) {
  return `sha256/${Buffer.from(
    certificate.fingerprint256.replaceAll(":", ""),
    "hex"
  ).toString("base64")}`;
}

function peerCertificateChain(certificate, depth = 0) {
  if (!Buffer.isBuffer(certificate?.raw) || depth >= 8) return null;
  const parsed = new X509Certificate(certificate.raw);
  const issuer = certificate.issuerCertificate;
  return {
    data: parsed.toString(),
    fingerprint: electronFingerprint(parsed),
    issuerCert:
      issuer && issuer !== certificate
        ? peerCertificateChain(issuer, depth + 1)
        : undefined
  };
}

function localReleaseTrustFromCertificate(
  certificate,
  rootCertificatePem,
  now = Date.now()
) {
  let root;
  try {
    root = new X509Certificate(rootCertificatePem);
  } catch {
    throw new Error("Caddy 本地根证书结构无效");
  }
  const trust = validateLocalReleaseTrust(
    {
      schemaVersion: 2,
      origin: "https://localhost:4443",
      rootFingerprint256: root.fingerprint256,
      rootCertificatePem: root.toString(),
      expiresAt: new Date(Date.parse(root.validTo)).toISOString()
    },
    now
  );
  const requestCertificate = peerCertificateChain(certificate);
  if (
    !requestCertificate ||
    !shouldTrustLocalReleaseCertificate(
      trust,
      { hostname: "localhost", certificate: requestCertificate },
      now
    )
  ) {
    throw new Error("Caddy 返回的 localhost 证书链未连接到固定根证书");
  }
  return trust;
}

async function retryLocalReleaseCertificateRead({
  readCertificate,
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  attempts = 6,
  baseDelayMs = 250
}) {
  if (
    typeof readCertificate !== "function" ||
    typeof wait !== "function" ||
    !Number.isSafeInteger(attempts) ||
    attempts < 1 ||
    attempts > 10 ||
    !Number.isSafeInteger(baseDelayMs) ||
    baseDelayMs < 1 ||
    baseDelayMs > 5000
  ) {
    throw new Error("本地发布证书重试参数无效");
  }
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await readCertificate();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(Math.min(baseDelayMs * 2 ** (attempt - 1), 2000));
      }
    }
  }
  throw lastError || new Error("无法读取本地发布证书");
}

module.exports = {
  localReleaseTrustFromCertificate,
  retryLocalReleaseCertificateRead
};
