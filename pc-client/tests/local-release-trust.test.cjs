"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  resolveCertificateVerificationCode,
  readLocalReleaseTrust,
  shouldTrustLocalReleaseCertificate,
  validateLocalReleaseTrust
} = require("../shared/local-release-trust.cjs");
const {
  electronLocalhostChain,
  rootTrust
} = require("./local-release-certificates.cjs");

const now = Date.parse("2026-08-02T02:00:00.000Z");

test("accepts a rotated localhost leaf only when it chains to the pinned root", () => {
  const trust = validateLocalReleaseTrust(rootTrust(), now);
  assert.equal(
    shouldTrustLocalReleaseCertificate(
      trust,
      { hostname: "localhost", certificate: electronLocalhostChain() },
      now
    ),
    true
  );
  assert.equal(
    shouldTrustLocalReleaseCertificate(
      trust,
      { hostname: "localhost:4443", certificate: electronLocalhostChain() },
      now
    ),
    true
  );
  assert.equal("fingerprint256" in trust, false);
});

test("rejects invalid trust schemas, roots and expiry metadata", () => {
  const valid = rootTrust();
  for (const candidate of [
    { ...valid, schemaVersion: 1 },
    { ...valid, origin: "https://example.com" },
    { ...valid, rootFingerprint256: "AA" },
    { ...valid, rootCertificatePem: "not a certificate" },
    { ...valid, expiresAt: "2026-08-20T00:00:00.000Z" },
    { ...valid, extra: true }
  ]) {
    assert.throws(() => validateLocalReleaseTrust(candidate, now));
  }
});

test("never trusts another hostname, fingerprint, root or invalid leaf", () => {
  const trust = validateLocalReleaseTrust(rootTrust(), now);
  const wrongFingerprint = electronLocalhostChain();
  wrongFingerprint.fingerprint = `sha256/${Buffer.alloc(32, 0xbb).toString("base64")}`;
  for (const request of [
    { hostname: "127.0.0.1", certificate: electronLocalhostChain() },
    { hostname: "example.com", certificate: electronLocalhostChain() },
    { hostname: "localhost", certificate: wrongFingerprint },
    { hostname: "localhost", certificate: { data: "invalid", fingerprint: "invalid" } }
  ]) {
    assert.equal(shouldTrustLocalReleaseCertificate(trust, request, now), false);
  }
  assert.equal(
    shouldTrustLocalReleaseCertificate(
      { ...trust, rootFingerprint256: Array(32).fill("AA").join(":") },
      { hostname: "localhost", certificate: electronLocalhostChain() },
      now
    ),
    false
  );
  assert.equal(
    shouldTrustLocalReleaseCertificate(
      trust,
      { hostname: "localhost", certificate: electronLocalhostChain() },
      Date.parse("2026-08-03T00:00:00.000Z")
    ),
    false
  );
});

test("overrides only the pinned local chain and delegates every other certificate to Chromium", () => {
  const trust = validateLocalReleaseTrust(rootTrust(), now);
  assert.equal(
    resolveCertificateVerificationCode(
      trust,
      {
        hostname: "localhost",
        verificationResult: "net::ERR_CERT_AUTHORITY_INVALID",
        certificate: electronLocalhostChain()
      },
      now
    ),
    0
  );
  assert.equal(
    resolveCertificateVerificationCode(
      trust,
      {
        hostname: "github.com",
        verificationResult: "net::OK",
        certificate: { fingerprint: "sha256/public-certificate" }
      },
      now
    ),
    -3
  );
  assert.equal(
    resolveCertificateVerificationCode(
      trust,
      {
        hostname: "localhost",
        verificationResult: "net::OK",
        certificate: electronLocalhostChain()
      },
      now
    ),
    -3
  );
  assert.equal(
    resolveCertificateVerificationCode(
      trust,
      {
        hostname: "localhost",
        verificationResult: "net::ERR_CERT_REVOKED",
        certificate: electronLocalhostChain()
      },
      now
    ),
    -2
  );
  const wrongFingerprint = electronLocalhostChain();
  wrongFingerprint.fingerprint = "sha256/untrusted-local-certificate";
  assert.equal(
    resolveCertificateVerificationCode(
      trust,
      {
        hostname: "localhost",
        verificationResult: "net::OK",
        certificate: wrongFingerprint
      },
      now
    ),
    -2
  );
});

test("production builds do not read the local trust resource", () => {
  assert.equal(
    readLocalReleaseTrust({
      resourcesPath: path.resolve("does-not-exist"),
      acceptanceBuild: false,
      now
    }),
    null
  );
});

test("acceptance builds require a valid pinned root resource", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-local-trust-"));
  try {
    fs.writeFileSync(
      path.join(root, "local-release-trust.json"),
      JSON.stringify(rootTrust()),
      "utf8"
    );
    assert.deepEqual(
      readLocalReleaseTrust({
        resourcesPath: root,
        acceptanceBuild: true,
        now
      }),
      rootTrust()
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
