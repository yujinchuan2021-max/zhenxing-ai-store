"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const { createSignedEnvelope } = require("../shared/signed-release.cjs");
const {
  evaluateUpdateRelease,
  validateSignedUpdateRelease,
  validateUpdatePayload,
  verifyAndEvaluateUpdateRelease
} = require("../shared/update-release.cjs");

function fixture() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    privateKey,
    trustedKeys: [
      {
        keyId: "update-test-2026",
        publicKey: publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64")
      }
    ]
  };
}

function payload(overrides = {}) {
  return {
    version: "0.2.0",
    publishedAt: "2026-07-30T00:00:00.000Z",
    downloadUrl:
      "https://downloads.aihub.example/releases/AI-Hub-0.2.0-x64.exe",
    sha256: "a".repeat(64),
    fileSize: 123456789,
    platform: "win32",
    arch: "x64",
    channel: "stable",
    notes: ["安全更新"],
    rollout: {
      percentage: 100,
      salt: "update-release-2026"
    },
    ...overrides
  };
}

function signed(updatePayload = payload()) {
  const keys = fixture();
  return {
    keys,
    envelope: createSignedEnvelope({
      kind: "update",
      keyId: "update-test-2026",
      payload: updatePayload,
      privateKey: keys.privateKey
    })
  };
}

const allowedDownloadOrigins = ["https://downloads.aihub.example"];

test("verifies and normalizes an exact signed Windows x64 update", () => {
  const { keys, envelope } = signed();
  const release = validateSignedUpdateRelease(envelope, {
    trustedKeys: keys.trustedKeys,
    allowedDownloadOrigins
  });

  assert.equal(release.version, "0.2.0");
  assert.equal(release.platform, "win32");
  assert.equal(release.arch, "x64");
  assert.equal(release.channel, "stable");
  assert.deepEqual(release.rollout, {
    percentage: 100,
    salt: "update-release-2026"
  });
});

test("rejects a payload changed after it was signed", () => {
  const { keys, envelope } = signed();
  const tampered = {
    ...envelope,
    payload: {
      ...envelope.payload,
      downloadUrl: "https://downloads.aihub.example/releases/attacker.exe"
    }
  };
  assert.throws(
    () =>
      validateSignedUpdateRelease(tampered, {
        trustedKeys: keys.trustedKeys,
        allowedDownloadOrigins
      }),
    /签名|signature/i
  );
});

test("requires the signed payload to have exactly the approved fields", () => {
  for (const candidate of [
    { ...payload(), arbitraryCommand: "powershell.exe" },
    Object.fromEntries(
      Object.entries(payload()).filter(([field]) => field !== "sha256")
    )
  ]) {
    assert.throws(
      () => validateUpdatePayload(candidate, allowedDownloadOrigins),
      /structure/i
    );
  }
});

test("strictly validates every security-sensitive payload field", () => {
  const invalidCases = [
    ["version", "v0.2.0"],
    ["publishedAt", "2026-07-30"],
    ["publishedAt", "2026-07-30T00:00:00Z"],
    ["downloadUrl", "http://downloads.aihub.example/release.exe"],
    ["downloadUrl", "https://user:pass@downloads.aihub.example/release.exe"],
    ["downloadUrl", "https://downloads.aihub.example/release.exe#fragment"],
    ["sha256", "A".repeat(64)],
    ["sha256", "a".repeat(63)],
    ["fileSize", 0],
    ["fileSize", Number.MAX_SAFE_INTEGER + 1],
    ["platform", "linux"],
    ["arch", "arm64"],
    ["channel", "nightly"],
    ["notes", [""]],
    ["notes", ["x".repeat(301)]],
    ["rollout", { percentage: 101, salt: "update-release-2026" }],
    ["rollout", { percentage: 50, salt: "short" }]
  ];

  for (const [field, value] of invalidCases) {
    assert.throws(
      () =>
        validateUpdatePayload(
          payload({ [field]: value }),
          allowedDownloadOrigins
        ),
      undefined,
      `${field}=${JSON.stringify(value)} must be rejected`
    );
  }
});

test("accepts only an exact pinned HTTPS download origin", () => {
  assert.throws(
    () =>
      validateUpdatePayload(
        payload({
          downloadUrl: "https://cdn.aihub.example/release.exe"
        }),
        allowedDownloadOrigins
      ),
    /pinned HTTPS origin/i
  );

  for (const origins of [
    [],
    ["http://downloads.aihub.example"],
    ["https://downloads.aihub.example/releases"],
    ["https://*.aihub.example"],
    [
      "https://downloads.aihub.example",
      "https://downloads.aihub.example"
    ]
  ]) {
    assert.throws(
      () => validateUpdatePayload(payload(), origins),
      /origin/i
    );
  }
});

test("loopback HTTP is available only to an explicit local test adapter", () => {
  const local = payload({
    downloadUrl: "http://127.0.0.1:4180/AI-Hub-0.2.0.exe"
  });
  assert.throws(
    () => validateUpdatePayload(local, ["http://127.0.0.1:4180"]),
    /origin/i
  );
  assert.equal(
    validateUpdatePayload(local, ["http://127.0.0.1:4180"], {
      allowLocalhost: true
    }).downloadUrl,
    local.downloadUrl
  );
});

test("allows stable and beta but rejects every other update channel", () => {
  assert.equal(
    validateUpdatePayload(
      payload({ channel: "stable" }),
      allowedDownloadOrigins
    ).channel,
    "stable"
  );
  assert.equal(
    validateUpdatePayload(
      payload({ channel: "beta" }),
      allowedDownloadOrigins
    ).channel,
    "beta"
  );
  assert.throws(
    () =>
      validateUpdatePayload(
        payload({ channel: "dev" }),
        allowedDownloadOrigins
      ),
    /stable or beta/
  );
});

test("evaluates version and deterministic rollout eligibility", () => {
  const release = validateUpdatePayload(payload(), allowedDownloadOrigins);
  assert.deepEqual(
    evaluateUpdateRelease(release, "0.2.0", "client-12345678"),
    {
      status: "current",
      currentVersion: "0.2.0",
      version: "0.2.0",
      eligible: false
    }
  );
  assert.deepEqual(
    evaluateUpdateRelease(release, "0.3.0", "client-12345678"),
    {
      status: "current",
      currentVersion: "0.3.0",
      version: "0.2.0",
      eligible: false
    }
  );

  const excluded = validateUpdatePayload(
    payload({ rollout: { percentage: 0, salt: "update-release-2026" } }),
    allowedDownloadOrigins
  );
  assert.deepEqual(
    evaluateUpdateRelease(excluded, "0.1.0", "client-12345678"),
    {
      status: "not-eligible",
      currentVersion: "0.1.0",
      version: "0.2.0",
      eligible: false
    }
  );

  const available = evaluateUpdateRelease(
    release,
    "0.1.0",
    "client-12345678"
  );
  assert.equal(available.status, "available");
  assert.equal(available.eligible, true);
  assert.equal(available.release.downloadUrl, payload().downloadUrl);
});

test("verifies before evaluating and rejects an untrusted signing key", () => {
  const trusted = signed();
  const untrusted = signed();

  assert.equal(
    verifyAndEvaluateUpdateRelease(trusted.envelope, {
      trustedKeys: trusted.keys.trustedKeys,
      allowedDownloadOrigins,
      currentVersion: "0.1.0",
      clientId: "client-12345678"
    }).status,
    "available"
  );
  assert.throws(
    () =>
      verifyAndEvaluateUpdateRelease(untrusted.envelope, {
        trustedKeys: trusted.keys.trustedKeys,
        allowedDownloadOrigins,
        currentVersion: "0.1.0",
        clientId: "client-12345678"
      }),
    /签名|signature/i
  );
});
