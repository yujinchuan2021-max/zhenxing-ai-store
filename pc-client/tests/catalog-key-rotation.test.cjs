"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { publicKeyRecord } = require("../admin/signing-key.cjs");
const { createReleaseStore } = require("../admin/release-store.cjs");
const { verifyCatalogReleaseCache } = require("../shared/catalog-release.cjs");
const { resolvePackagedCatalogFallback } = require("../shared/catalog-runtime-policy.cjs");
const { assertReleasePackageReady } = require("../shared/release-package-policy.cjs");
const { createSignedEnvelope, verifySignedEnvelope } = require("../shared/signed-release.cjs");

const {
  buildCatalogTrustTransition,
  createCatalogKeyRotationCandidate
} = require("../scripts/create-catalog-key-rotation-candidate.cjs");
const {
  assertSafeRedactedStream,
  collectDependencyClosure,
  dependencyClosureSha256,
  redactEvidenceStream,
  writeEvidenceFiles
} = require("../scripts/run-catalog-key-rotation-evidence.cjs");

const root = path.resolve(__dirname, "..");

async function withCatalogKeyRotationTestCandidate(callback) {
  const outputDirectory = fs.realpathSync(path.join(root, "output"));
  const candidateDirectory = path.join(
    outputDirectory,
    `catalog-key-rotation-test-${crypto.randomUUID()}`
  );
  try {
    const result = createCatalogKeyRotationCandidate({ rootDirectory: root, candidateDirectory });
    return await callback({ candidateDirectory, result });
  } finally {
    if (fs.existsSync(candidateDirectory)) {
      const resolved = fs.realpathSync(candidateDirectory);
      assert.equal(path.dirname(resolved).toLowerCase(), outputDirectory.toLowerCase());
      assert.match(path.basename(resolved), /^catalog-key-rotation-test-[a-f0-9-]+$/);
      assert.equal(fs.lstatSync(resolved).isSymbolicLink(), false);
      const escaped = resolved.replaceAll("'", "''");
      const removal = spawnSync(
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference='Stop';[IO.Directory]::Delete('${escaped}',$true)`],
        { stdio: "ignore", windowsHide: true, shell: false, timeout: 10_000 }
      );
      assert.equal(removal.status, 0);
    }
    assert.equal(fs.existsSync(candidateDirectory), false);
  }
}

function aclFingerprint(file) {
  const escaped = file.replaceAll("'", "''");
  const result = spawnSync(
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `(Get-Acl -LiteralPath '${escaped}').Sddl`],
    { encoding: "utf8", windowsHide: true, shell: false, timeout: 10_000 }
  );
  assert.equal(result.status, 0);
  return crypto.createHash("sha256").update(result.stdout.trim()).digest("hex");
}

test("catalog trust rotation is staged without replacing 0.1.81 trust in place", () => {
  const oldKey = { keyId: "catalog-old", publicKey: "old-public" };
  const newKey = { keyId: "catalog-new", publicKey: "new-public" };
  const current = {
    schemaVersion: 2,
    kind: "catalog",
    catalogChannel: "v2",
    releaseUrl: "https://zhenxingai.com/channels/v2/catalog-release.json",
    allowedReleaseOrigins: ["https://zhenxingai.com"],
    trustedKeys: [oldKey]
  };

  const transition = buildCatalogTrustTransition({ current, oldKey, newKey });

  assert.deepEqual(transition.transitionChannel.trustedKeys, [oldKey, newKey]);
  assert.deepEqual(transition.retiredChannel.trustedKeys, [newKey]);
  assert.deepEqual(transition.stages.map((stage) => stage.code), [
    "ACTIVE7_OLD_ONLY",
    "CLIENT_0_1_82_DUAL_TRUST",
    "NEW_KEY_ACTIVATION_AFTER_ADOPTION",
    "NEXT_CLIENT_NEW_ONLY"
  ]);
  assert.equal(transition.stages[1].serverReleaseRemainsActive7, true);
  assert.equal(transition.stages[2].oldClientBehavior, "reject-new-remote-use-verified-active7-cache-or-unavailable");
  assert.equal(transition.stages[3].oldKeyTrusted, false);
  assert.equal(transition.v8Signed, false);
  assert.equal(transition.published, false);

  const evidenceFixture = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-key-rotation-evidence-"));
  try {
    const entry = path.join(evidenceFixture, "entry.cjs");
    const dependency = path.join(evidenceFixture, "dependency.cjs");
    fs.writeFileSync(entry, 'module.exports="entry";\n');
    fs.writeFileSync(dependency, 'module.exports="before";\n');
    const firstClosure = collectDependencyClosure({ rootDirectory: evidenceFixture, entryFiles: ["entry.cjs", "dependency.cjs"] });
    fs.writeFileSync(dependency, 'module.exports="after";\n');
    const secondClosure = collectDependencyClosure({ rootDirectory: evidenceFixture, entryFiles: ["entry.cjs", "dependency.cjs"] });
    assert.notEqual(dependencyClosureSha256(firstClosure), dependencyClosureSha256(secondClosure));

    const redacted = redactEvidenceStream(
      "\u001b[31mError: token=raw-token C:\\Users\\example\\secret.txt https://example.invalid -----BEGIN PRIVATE KEY-----raw-----END PRIVATE KEY-----\u001b[0m\n",
      { rootDirectory: root }
    );
    assertSafeRedactedStream(redacted);
    assert.doesNotMatch(redacted, /raw-token|example\.invalid|BEGIN PRIVATE KEY|C:\\Users/i);
    assert.throws(() => redactEvidenceStream("unknown\u001bXsequence", { rootDirectory: root }), /EVIDENCE_ANSI_UNSAFE/);

    const blockedDirectory = path.join(evidenceFixture, "blocked");
    const blocked = writeEvidenceFiles({
      evidenceDirectory: blockedDirectory,
      rootDirectory: root,
      stdout: "safe stdout\n",
      stderr: "Error: raw failure at C:\\secret\\file\n",
      outcome: { exitCode: 1, testCount: 0, passCount: 0, failCount: 1, passEligible: false },
      manifest: { schemaVersion: 1 }
    });
    assert.equal(blocked.status, "BLOCKED");
    assert.equal(fs.existsSync(path.join(blockedDirectory, "PASS.json")), false);
    assert.equal(fs.existsSync(path.join(blockedDirectory, "BLOCKED.json")), true);
  } finally {
    fs.rmSync(evidenceFixture, { recursive: true, force: true });
  }
});

test("local rotation candidate protects the private key and exposes public evidence only", async () => {
  const oldPrivateKey = path.join(root, "admin", "data", "catalog-signing-private.pem");
  const oldPrivateBefore = fs.lstatSync(oldPrivateKey);
  const oldAclBefore = aclFingerprint(oldPrivateKey);
  let normalCandidateDirectory;
  await withCatalogKeyRotationTestCandidate(async ({ candidateDirectory, result }) => {
    normalCandidateDirectory = candidateDirectory;
    const report = JSON.parse(fs.readFileSync(result.reportPath, "utf8"));
    const transition = JSON.parse(fs.readFileSync(result.transitionChannelPath, "utf8"));
    const retired = JSON.parse(fs.readFileSync(result.retiredChannelPath, "utf8"));
    const privateStat = fs.lstatSync(result.privateKeyPath);
    const serialized = JSON.stringify({ result: { ...result, privateKeyPath: undefined }, report, transition, retired });

    assert.equal(privateStat.isFile(), true);
    assert.equal(privateStat.isSymbolicLink(), false);
    assert.equal(privateStat.nlink, 1);
    assert.equal(report.privateKeyProtection.regular, true);
    assert.equal(report.privateKeyProtection.nonReparse, true);
    assert.equal(report.privateKeyProtection.linkCountOne, true);
    assert.equal(report.privateKeyProtection.inheritanceProtected, true);
    assert.equal(report.privateKeyProtection.ownerCurrentReleaseIdentity, true);
    assert.deepEqual(report.privateKeyProtection.ruleClasses, [
      "administrators-full-control",
      "current-release-identity-full-control",
      "system-full-control"
    ]);
    assert.equal(report.active7Verified, true);
    assert.equal(report.v8Signed, false);
    assert.equal(report.published, false);
    assert.equal(report.packaged, false);
    assert.equal(report.deployed, false);
    assert.equal(report.privateKeyExcludedFromGit, true);
    assert.equal(report.privateKeyExcludedFromPackage, true);
    assert.equal(transition.trustedKeys.length, 2);
    assert.equal(retired.trustedKeys.length, 1);
    assert.equal(transition.trustedKeys[1].keyId, report.newKeyId);
    assert.equal(retired.trustedKeys[0].keyId, report.newKeyId);
    assert.notEqual(report.newKeyId, report.oldKeyId);
    assert.match(report.newPublicKeyFingerprintSha256, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(serialized, /BEGIN PRIVATE KEY|PRIVATE KEY-----/);
  });
  assert.equal(fs.existsSync(normalCandidateDirectory), false);

  let failedCandidateDirectory;
  await assert.rejects(
    withCatalogKeyRotationTestCandidate(async ({ candidateDirectory }) => {
      failedCandidateDirectory = candidateDirectory;
      throw new Error("EXPECTED_FIXTURE_FAILURE");
    }),
    /EXPECTED_FIXTURE_FAILURE/
  );
  assert.equal(fs.existsSync(failedCandidateDirectory), false);

  const oldPrivateAfter = fs.lstatSync(oldPrivateKey);
  assert.equal(oldPrivateAfter.mtimeMs, oldPrivateBefore.mtimeMs);
  assert.equal(oldPrivateAfter.ctimeMs, oldPrivateBefore.ctimeMs);
  assert.equal(aclFingerprint(oldPrivateKey), oldAclBefore);
});

test("0.1.81 active7 and a future new-key envelope have an explicit bounded trust overlap", () => {
  const current = JSON.parse(fs.readFileSync(path.join(root, "catalog", "channel.server-connected-review.json"), "utf8"));
  const state = JSON.parse(fs.readFileSync(path.join(root, "admin", "published", "catalog-store", "state.json"), "utf8"));
  const v2 = state.channels.v2;
  const active = v2.history.find((entry) => entry.releaseId === v2.activeReleaseId);
  const active7 = JSON.parse(fs.readFileSync(path.join(root, "admin", "published", "catalog-store", "releases", active.fileName), "utf8"));
  const pair = crypto.generateKeyPairSync("ed25519");
  const nextKey = publicKeyRecord(pair.privateKey, "catalog");
  const transition = buildCatalogTrustTransition({ current, oldKey: current.trustedKeys[0], newKey: nextKey });

  assert.equal(verifySignedEnvelope(active7, { kind: "catalog", trustedKeys: current.trustedKeys }).catalogVersion, 7);
  assert.equal(verifySignedEnvelope(active7, { kind: "catalog", trustedKeys: transition.transitionChannel.trustedKeys }).catalogVersion, 7);
  assert.throws(() => verifySignedEnvelope(active7, { kind: "catalog", trustedKeys: transition.retiredChannel.trustedKeys }), /未受客户端信任/);

  const syntheticNewKeyEnvelope = createSignedEnvelope({
    kind: "catalog",
    keyId: nextKey.keyId,
    payload: active7.payload,
    privateKey: pair.privateKey
  });
  assert.equal(verifySignedEnvelope(syntheticNewKeyEnvelope, { kind: "catalog", trustedKeys: transition.transitionChannel.trustedKeys }).catalogVersion, 7);
  assert.equal(verifySignedEnvelope(syntheticNewKeyEnvelope, { kind: "catalog", trustedKeys: transition.retiredChannel.trustedKeys }).catalogVersion, 7);
  assert.throws(() => verifySignedEnvelope(syntheticNewKeyEnvelope, { kind: "catalog", trustedKeys: current.trustedKeys }), /未受客户端信任/);

  const verifiedActive7Cache = verifyCatalogReleaseCache({
    schemaVersion: 1,
    sourceUrl: current.releaseUrl,
    cachedAt: new Date(Date.parse(active7.payload.publishedAt) + 1_000).toISOString(),
    envelope: active7
  }, {
    expectedSourceUrl: current.releaseUrl,
    trustedKeys: transition.transitionChannel.trustedKeys,
    clientId: "catalog-key-rotation-test-client"
  });
  assert.deepEqual(
    resolvePackagedCatalogFallback({ cached: verifiedActive7Cache, error: "new-key remote rejected" }),
    {
      source: "cache",
      catalog: verifiedActive7Cache.catalog,
      catalogVersion: 7,
      error: "new-key remote rejected"
    }
  );
  assert.throws(
    () => verifyCatalogReleaseCache({
      schemaVersion: 1,
      sourceUrl: current.releaseUrl,
      cachedAt: new Date(Date.parse(active7.payload.publishedAt) + 1_000).toISOString(),
      envelope: active7
    }, {
      expectedSourceUrl: current.releaseUrl,
      trustedKeys: transition.retiredChannel.trustedKeys,
      clientId: "catalog-key-rotation-test-client"
    }),
    /未受客户端信任/
  );
  assert.deepEqual(resolvePackagedCatalogFallback({ cached: null, error: "new-key remote rejected" }), {
    source: "unavailable",
    catalog: null,
    error: "new-key remote rejected"
  });
});

test("the transition client package gate keeps active7 available before new-key activation", () => {
  const current = JSON.parse(fs.readFileSync(path.join(root, "catalog", "channel.server-connected-review.json"), "utf8"));
  const pair = crypto.generateKeyPairSync("ed25519");
  const nextKey = publicKeyRecord(pair.privateKey, "catalog");
  const transition = buildCatalogTrustTransition({ current, oldKey: current.trustedKeys[0], newKey: nextKey });
  const result = assertReleasePackageReady({
    variant: "server-connected-review",
    catalogChannel: transition.transitionChannel,
    updateChannel: {
      schemaVersion: 2,
      kind: "update",
      releaseUrl: "",
      allowedReleaseOrigins: [],
      trustedKeys: []
    },
    clientServices: {
      schemaVersion: 1,
      identityOrigin: "https://zhenxingai.com",
      communityOrigin: "https://community.zhenxingai.com"
    },
    catalogReleaseStoreDirectory: path.join(root, "admin", "published", "catalog-store")
  });
  assert.equal(result.catalog.trustedKeys.length, 2);
  assert.equal(result.catalog.catalogChannel, "v2");
});

test("the backend store appends a new signing key without rewriting old signed history", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-catalog-key-rotation-store-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const oldPair = crypto.generateKeyPairSync("ed25519");
  const newPair = crypto.generateKeyPairSync("ed25519");
  const oldKey = publicKeyRecord(oldPair.privateKey, "catalog");
  const newKey = publicKeyRecord(newPair.privateKey, "catalog");
  let signingKey = { keyId: oldKey.keyId, privateKey: oldPair.privateKey };
  const store = createReleaseStore({
    rootDirectory: directory,
    signingKeyProvider: async () => signingKey
  });
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "admin", "data", "catalog-v1.json"), "utf8"));
  const draft = await store.saveDraft({ catalog, expectedRevision: 0 });
  const first = await store.publish({
    channel: "v2",
    expectedDraftRevision: draft.revision,
    expectedActiveCatalogVersion: 0
  });
  signingKey = { keyId: newKey.keyId, privateKey: newPair.privateKey };
  const second = await store.publish({
    channel: "v2",
    expectedDraftRevision: draft.revision,
    expectedActiveCatalogVersion: 1
  });
  const persisted = JSON.parse(fs.readFileSync(path.join(directory, "state.json"), "utf8"));

  assert.deepEqual(persisted.trustedKeys.map((key) => key.keyId), [oldKey.keyId, newKey.keyId]);
  assert.deepEqual(persisted.channels.v2.history.map((entry) => entry.keyId), [oldKey.keyId, newKey.keyId]);
  assert.equal((await store.readRelease(first.release.releaseId, { channel: "v2" })).envelope.keyId, oldKey.keyId);
  assert.equal((await store.readRelease(second.release.releaseId, { channel: "v2" })).envelope.keyId, newKey.keyId);
});
