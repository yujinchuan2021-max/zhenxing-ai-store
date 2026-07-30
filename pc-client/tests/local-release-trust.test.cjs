"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  readLocalReleaseTrust,
  shouldTrustLocalReleaseCertificate,
  validateLocalReleaseTrust
} = require("../shared/local-release-trust.cjs");

const fingerprint = Array.from({ length: 32 }, () => "AA").join(":");
const now = Date.parse("2026-07-30T00:00:00.000Z");

function value(overrides = {}) {
  return {
    schemaVersion: 1,
    origin: "https://localhost:4443",
    fingerprint256: fingerprint,
    expiresAt: "2026-07-31T00:00:00.000Z",
    ...overrides
  };
}

test("accepts only a short-lived exact localhost TLS fingerprint", () => {
  const trust = validateLocalReleaseTrust(value(), now);
  const electronFingerprint = `sha256/${Buffer.from(
    fingerprint.replaceAll(":", ""),
    "hex"
  ).toString("base64")}`;
  assert.equal(
    shouldTrustLocalReleaseCertificate(trust, {
      hostname: "localhost",
      certificate: { fingerprint: electronFingerprint }
    }),
    true
  );
  for (const candidate of [
    value({ origin: "https://example.com" }),
    value({ fingerprint256: "AA" }),
    value({ expiresAt: "2026-08-20T00:00:00.000Z" }),
    { ...value(), extra: true }
  ]) {
    assert.throws(() => validateLocalReleaseTrust(candidate, now));
  }
});

test("never trusts another hostname or certificate", () => {
  const trust = validateLocalReleaseTrust(value(), now);
  const electronFingerprint = `sha256/${Buffer.from(
    fingerprint.replaceAll(":", ""),
    "hex"
  ).toString("base64")}`;
  assert.equal(
    shouldTrustLocalReleaseCertificate(trust, {
      hostname: "127.0.0.1",
      certificate: { fingerprint: electronFingerprint }
    }),
    false
  );
  assert.equal(
    shouldTrustLocalReleaseCertificate(trust, {
      hostname: "localhost",
      certificate: {
        fingerprint: `sha256/${Buffer.alloc(32, 0xbb).toString("base64")}`
      }
    }),
    false
  );
});

test("normalizes Chromium certificate fingerprints and host ports", () => {
  const trust = validateLocalReleaseTrust(value(), now);
  assert.equal(
    shouldTrustLocalReleaseCertificate(trust, {
      hostname: "localhost:4443",
      certificate: {
        fingerprint: `sha256/${Buffer.from(
          fingerprint.replaceAll(":", ""),
          "hex"
        ).toString("base64")}`
      }
    }),
    true
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

test("acceptance builds require a valid pinned trust resource", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-local-trust-"));
  try {
    fs.writeFileSync(
      path.join(root, "local-release-trust.json"),
      JSON.stringify(value()),
      "utf8"
    );
    assert.deepEqual(
      readLocalReleaseTrust({
        resourcesPath: root,
        acceptanceBuild: true,
        now
      }),
      value()
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
