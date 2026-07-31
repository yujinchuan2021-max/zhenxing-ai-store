"use strict";

const FINGERPRINT_PATTERN = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function localReleaseTrustFromCertificate(certificate, now = Date.now()) {
  const certificateExpiry = Date.parse(certificate?.valid_to || "");
  if (
    !Buffer.isBuffer(certificate?.raw) ||
    certificate.raw.length < 1 ||
    certificate.subjectaltname !== "DNS:localhost" ||
    !/Caddy Local Authority/.test(String(certificate.issuer?.CN || "")) ||
    !FINGERPRINT_PATTERN.test(String(certificate.fingerprint256 || "")) ||
    !Number.isFinite(certificateExpiry) ||
    certificateExpiry <= now + 60_000
  ) {
    throw new Error("Caddy 返回的 localhost 证书结构无效");
  }
  return {
    schemaVersion: 1,
    origin: "https://localhost:4443",
    fingerprint256: certificate.fingerprint256,
    expiresAt: new Date(
      Math.min(now + 7 * 24 * 60 * 60 * 1000, certificateExpiry - 60_000)
    ).toISOString()
  };
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
