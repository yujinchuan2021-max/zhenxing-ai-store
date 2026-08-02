"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  createSignedEnvelope
} = require("../shared/signed-release.cjs");
const {
  verifyRemoteEnvelope
} = require("../scripts/verify-local-release-https.cjs");

function fixture(sha256 = "a".repeat(64)) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const keyId = "update-test-key";
  const envelope = createSignedEnvelope({
    kind: "build-provenance",
    keyId,
    privateKey,
    payload: {
      schemaVersion: 2,
      version: "0.1.22",
      builtAt: "2026-08-01T00:00:00.000Z",
      source: {
        revision: "b".repeat(40),
        dirty: false,
        versionTag: "v0.1.22"
      },
      artifacts: [
        {
          name: "ZhenXing-AI-Local-0.1.22-Windows-x64-Setup.exe",
          sha256,
          fileSize: 4096
        }
      ]
    }
  });
  return {
    envelope,
    privateKey,
    trustedKeys: [
      {
        keyId,
        publicKey: publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64")
      }
    ]
  };
}

test("HTTPS acceptance verifies the signature and exact build attestation", () => {
  const expected = fixture();
  assert.deepEqual(
    verifyRemoteEnvelope(structuredClone(expected.envelope), {
      pathname: "/build-provenance.json",
      expectedKind: "build-provenance",
      trustedKeys: expected.trustedKeys,
      expectedEnvelope: expected.envelope
    }),
    expected.envelope
  );

  const forged = structuredClone(expected.envelope);
  forged.payload.artifacts[0].sha256 = "c".repeat(64);
  assert.throws(
    () =>
      verifyRemoteEnvelope(forged, {
        pathname: "/build-provenance.json",
        expectedKind: "build-provenance",
        trustedKeys: expected.trustedKeys,
        expectedEnvelope: expected.envelope
      }),
    /签名/
  );

  const alternate = createSignedEnvelope({
    kind: "build-provenance",
    keyId: expected.envelope.keyId,
    privateKey: expected.privateKey,
    payload: {
      ...expected.envelope.payload,
      artifacts: [
        {
          ...expected.envelope.payload.artifacts[0],
          sha256: "d".repeat(64)
        }
      ]
    }
  });
  assert.throws(
    () =>
      verifyRemoteEnvelope(alternate, {
        pathname: "/build-provenance.json",
        expectedKind: "build-provenance",
        trustedKeys: expected.trustedKeys,
        expectedEnvelope: expected.envelope
      }),
    /不一致/
  );
});
