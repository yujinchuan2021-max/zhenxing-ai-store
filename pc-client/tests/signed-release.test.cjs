"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  canonicalize,
  createSignedEnvelope,
  isRolloutEligible,
  rolloutBucket,
  verifySignedEnvelope
} = require("../shared/signed-release.cjs");

function fixture() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    privateKey,
    trustedKeys: [
      {
        keyId: "test-2026",
        publicKey: publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64")
      }
    ]
  };
}

test("canonical JSON is independent of object insertion order", () => {
  assert.equal(
    canonicalize({ z: 1, a: { y: true, x: ["ok", null] } }),
    canonicalize({ a: { x: ["ok", null], y: true }, z: 1 })
  );
});

test("signs and verifies an exact Ed25519 release envelope", () => {
  const keys = fixture();
  const envelope = createSignedEnvelope({
    kind: "catalog",
    keyId: "test-2026",
    payload: { catalogVersion: 3, rollout: { percentage: 100, salt: "test-salt" } },
    privateKey: keys.privateKey
  });
  assert.equal(
    verifySignedEnvelope(envelope, {
      kind: "catalog",
      trustedKeys: keys.trustedKeys
    }).catalogVersion,
    3
  );
});

test("rejects payload, rollout, key, and signature tampering", () => {
  const keys = fixture();
  const envelope = createSignedEnvelope({
    kind: "catalog",
    keyId: "test-2026",
    payload: { catalogVersion: 3 },
    privateKey: keys.privateKey
  });
  for (const tampered of [
    { ...envelope, payload: { catalogVersion: 4 } },
    { ...envelope, keyId: "other-key" },
    { ...envelope, signature: Buffer.alloc(64, 1).toString("base64") },
    { ...envelope, extra: true }
  ]) {
    assert.throws(
      () =>
        verifySignedEnvelope(tampered, {
          kind: "catalog",
          trustedKeys: keys.trustedKeys
        }),
      /签名|密钥|结构/
    );
  }
});

test("rollout assignment is stable and percentage boundaries are exact", () => {
  const clientId = "client-12345678";
  const bucket = rolloutBucket(clientId, "release-salt");
  assert.equal(bucket, rolloutBucket(clientId, "release-salt"));
  assert.equal(
    isRolloutEligible(clientId, {
      percentage: 0,
      salt: "release-salt"
    }),
    false
  );
  assert.equal(
    isRolloutEligible(clientId, {
      percentage: 100,
      salt: "release-salt"
    }),
    true
  );
  assert.equal(
    isRolloutEligible(clientId, {
      percentage: Math.floor(bucket),
      salt: "release-salt"
    }),
    false
  );
  assert.equal(
    isRolloutEligible(clientId, {
      percentage: Math.min(100, Math.floor(bucket) + 1),
      salt: "release-salt"
    }),
    true
  );
});
