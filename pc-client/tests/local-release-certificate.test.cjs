"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  localReleaseTrustFromCertificate,
  retryLocalReleaseCertificateRead
} = require("../shared/local-release-certificate.cjs");
const {
  leafCertificatePem,
  rootCertificatePem,
  rootTrust,
  tlsLocalhostChain
} = require("./local-release-certificates.cjs");

test("builds stable root trust from the live Caddy localhost chain", () => {
  const now = Date.parse("2026-08-02T02:00:00.000Z");
  assert.deepEqual(
    localReleaseTrustFromCertificate(
      tlsLocalhostChain(),
      rootCertificatePem,
      now
    ),
    rootTrust()
  );
  assert.throws(() =>
    localReleaseTrustFromCertificate(
      tlsLocalhostChain(),
      leafCertificatePem,
      now
    )
  );
  assert.throws(() =>
    localReleaseTrustFromCertificate(
      { raw: Buffer.from("not a certificate") },
      rootCertificatePem,
      now
    )
  );
});

test("retries transient certificate transport failures with a strict cap", async () => {
  let reads = 0;
  const waits = [];
  const certificate = { raw: Buffer.from("ok") };
  const result = await retryLocalReleaseCertificateRead({
    attempts: 4,
    baseDelayMs: 10,
    readCertificate: async () => {
      reads += 1;
      if (reads < 3) throw new Error("socket reset");
      return certificate;
    },
    wait: async (milliseconds) => waits.push(milliseconds)
  });
  assert.equal(result, certificate);
  assert.equal(reads, 3);
  assert.deepEqual(waits, [10, 20]);
});
