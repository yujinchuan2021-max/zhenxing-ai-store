"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  isSoftwareUpdatePublished,
  normalizeSoftwareUpdateHighWater,
  recordSoftwareUpdateHighWater,
  validateSoftwareUpdatePayload,
  verifySoftwareUpdateRelease
} = require("../shared/software-update-release.cjs");
const {
  createSignedEnvelope
} = require("../shared/signed-release.cjs");

function keys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    privateKey,
    trustedKeys: [{
      keyId: "software-test-2026",
      publicKey: publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64")
    }]
  };
}

function payload() {
  return {
    schemaVersion: 1,
    releaseVersion: 3,
    publishedAt: "2026-08-15T00:00:00.000Z",
    rollout: { percentage: 100, salt: "software-stable-2026" },
    entries: [
      {
        id: "environment:python",
        kind: "environment",
        subjectId: "python",
        mode: "environment-download",
        version: "3.13.14"
      },
      {
        id: "extension:mcp.codex.openai-developer-docs",
        kind: "extension",
        subjectId: "mcp.codex.openai-developer-docs",
        mode: "extension",
        version: "2026-08-04"
      },
      {
        id: "product:codex-cli",
        kind: "product",
        subjectId: "codex-cli",
        mode: "managed-cli",
        version: "0.146.0"
      },
      {
        id: "product:docker-desktop",
        kind: "product",
        subjectId: "docker-desktop",
        mode: "package-manager",
        version: null
      }
    ]
  };
}

test("validates one exact, sorted software update release", () => {
  assert.deepEqual(validateSoftwareUpdatePayload(payload()), payload());
  assert.throws(
    () => validateSoftwareUpdatePayload({ ...payload(), command: "cmd.exe" }),
    /软件更新清单/
  );
  const invalid = payload();
  invalid.entries[0].url = "https://attacker.example/update.exe";
  assert.throws(() => validateSoftwareUpdatePayload(invalid), /软件更新条目/);
});

test("accepts an empty signed release so administrators can withdraw all offers", () => {
  assert.deepEqual(
    validateSoftwareUpdatePayload({ ...payload(), releaseVersion: 4, entries: [] }).entries,
    []
  );
});

test("signs, verifies, rolls out, and rejects replayed software releases", () => {
  const fixture = keys();
  const envelope = createSignedEnvelope({
    kind: "software-updates",
    keyId: "software-test-2026",
    payload: payload(),
    privateKey: fixture.privateKey
  });
  const verified = verifySoftwareUpdateRelease(envelope, {
    trustedKeys: fixture.trustedKeys,
    clientId: "client-software-1234",
    highWater: normalizeSoftwareUpdateHighWater()
  });
  assert.equal(verified.eligible, true);
  assert.equal(verified.releaseVersion, 3);
  const highWater = recordSoftwareUpdateHighWater(
    normalizeSoftwareUpdateHighWater(),
    verified
  );
  assert.equal(highWater.releaseVersion, 3);

  const older = payload();
  older.releaseVersion = 2;
  const olderEnvelope = createSignedEnvelope({
    kind: "software-updates",
    keyId: "software-test-2026",
    payload: older,
    privateKey: fixture.privateKey
  });
  assert.throws(
    () => verifySoftwareUpdateRelease(olderEnvelope, {
      trustedKeys: fixture.trustedKeys,
      clientId: "client-software-1234",
      highWater
    }),
    /旧版本|回退/
  );
});

test("authorizes only an exact locally supported update identity", () => {
  const release = validateSoftwareUpdatePayload(payload());
  assert.equal(isSoftwareUpdatePublished(release, {
    kind: "environment",
    subjectId: "python",
    mode: "environment-download",
    version: "3.13.14"
  }), true);
  assert.equal(isSoftwareUpdatePublished(release, {
    kind: "environment",
    subjectId: "python",
    mode: "environment-download",
    version: "3.14.0"
  }), false);
  assert.equal(isSoftwareUpdatePublished(release, {
    kind: "product",
    subjectId: "docker-desktop",
    mode: "package-manager",
    version: "4.99.0"
  }), true);
  assert.equal(isSoftwareUpdatePublished(release, {
    kind: "product",
    subjectId: "docker-desktop",
    mode: "managed-installer",
    version: "4.99.0"
  }), false);
});
