"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  localReleaseTrustFromCertificate,
  retryLocalReleaseCertificateRead
} = require("../shared/local-release-certificate.cjs");

const fingerprint = Array.from({ length: 32 }, () => "AB").join(":");

test("builds a bounded localhost trust pin from the Caddy certificate", () => {
  const now = Date.parse("2026-08-01T00:00:00.000Z");
  const trust = localReleaseTrustFromCertificate(
    {
      raw: Buffer.from("certificate"),
      subjectaltname: "DNS:localhost",
      issuer: { CN: "Caddy Local Authority - 2026 ECC Root" },
      fingerprint256: fingerprint,
      valid_to: "Aug 15 00:00:00 2026 GMT"
    },
    now
  );
  assert.equal(trust.origin, "https://localhost:4443");
  assert.equal(trust.fingerprint256, fingerprint);
  assert.equal(trust.expiresAt, "2026-08-08T00:00:00.000Z");
  assert.throws(
    () =>
      localReleaseTrustFromCertificate(
        {
          raw: Buffer.from("certificate"),
          subjectaltname: "DNS:otherhost",
          issuer: { CN: "Caddy Local Authority" },
          fingerprint256: fingerprint,
          valid_to: "Aug 15 00:00:00 2026 GMT"
        },
        now
      ),
    /证书结构/
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
