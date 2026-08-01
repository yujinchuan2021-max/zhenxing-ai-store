"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  activateStagedBundle,
  createManualBackup,
  discardStagedBundleCandidateBestEffort,
  finalizeActivatedRelease,
  listBackups,
  rollbackActivatedRelease,
  restoreBackup,
  writeLocalReleaseTrustOverlay
} = require("../admin/local-release-deployment.cjs");
const {
  prepareReleaseBundle
} = require("../admin/release-bundle.cjs");
const {
  verifyReleaseBundle
} = require("../admin/release-bundle-verifier.cjs");
const {
  catalogReleaseSha256
} = require("../shared/catalog-release.cjs");
const {
  createArtifactBuildMetadata
} = require("../shared/release-provenance.cjs");

function signingKey() {
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  return { privateKey, source: "environment" };
}

function createBundle(
  root,
  name,
  version = "0.1.1",
  artifactContents = {}
) {
  const catalog = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "admin", "data", "catalog-v1.json"),
      "utf8"
    )
  );
  const artifactDirectory = path.join(root, "artifacts", name);
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const installer = path.join(
    artifactDirectory,
    `AI-Hub-${version}-Windows-x64-Setup.exe`
  );
  fs.writeFileSync(
    installer,
    artifactContents.setup || crypto.randomBytes(4096)
  );
  const artifactPaths = [installer];
  if (artifactContents.portable) {
    const portable = path.join(
      artifactDirectory,
      `AI-Hub-${version}-Windows-x64-Portable.exe`
    );
    fs.writeFileSync(portable, artifactContents.portable);
    artifactPaths.push(portable);
  }
  const outputDirectory = path.join(root, "runtime", "staging", name);
  prepareReleaseBundle({
    outputDirectory,
    baseUrl: "https://localhost:4443/",
    catalogEnvelope: {
      payload: {
        schemaVersion: 1,
        releaseId: "catalog-v00000001-aaaaaaaaaaaa-aaaaaaaa",
        catalogVersion: 1,
        publishedAt: "2026-07-30T00:00:00.000Z",
        draftRevision: 1,
        parentReleaseId: null,
        sourceReleaseId: null,
        notes: "",
        rollout: { percentage: 100, salt: "catalog-release-2026" },
        catalogSha256: catalogReleaseSha256(catalog),
        catalog
      }
    },
    installerPath: installer,
    version,
    buildProvenance: createArtifactBuildMetadata({
      version,
      source: {
        revision: "b".repeat(40),
        dirty: true,
        versionTag: null
      },
      artifactPaths,
      builtAt: "2026-07-30T00:30:00.000Z"
    }),
    signingKeys: {
      catalog: signingKey(),
      update: signingKey()
    },
    attestedArtifactPaths: artifactPaths,
    publishedAt: "2026-07-30T01:00:00.000Z"
  });
  return outputDirectory;
}

function convertToLegacyBundleV1(bundleDirectory) {
  const publicDirectory = path.join(bundleDirectory, "public");
  const manifestPath = path.join(publicDirectory, "release-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.schemaVersion = 1;
  delete manifest.build;
  manifest.files = manifest.files.filter(
    (entry) => entry.path !== "build-provenance.json"
  );
  fs.rmSync(path.join(publicDirectory, "build-provenance.json"));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function createActivationLock(runtimeDirectory, pid) {
  const lockDirectory = path.join(runtimeDirectory, ".activation-lock");
  fs.mkdirSync(lockDirectory);
  fs.writeFileSync(
    path.join(lockDirectory, "owner.json"),
    `${JSON.stringify({
      pid,
      startedAt: new Date().toISOString(),
      token: crypto.randomUUID()
    })}\n`
  );
  return lockDirectory;
}

function writeLocalRuntimeTrust(bundleDirectory) {
  const trustPath = path.join(
    bundleDirectory,
    "client-config",
    "local-release-trust.json"
  );
  fs.writeFileSync(
    trustPath,
    `${JSON.stringify({
      schemaVersion: 1,
      origin: "https://localhost:4443",
      fingerprint256: Array(32).fill("AA").join(":"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })}\n`
  );
  return trustPath;
}

function localRuntimeTrust(fingerprint = "AA") {
  return {
    schemaVersion: 1,
    origin: "https://localhost:4443",
    fingerprint256: Array(32).fill(fingerprint).join(":"),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}

test("activates, backs up, lists and restores only verified release bundles", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first"),
      now: new Date("2026-07-30T02:00:00.000Z")
    });
    writeLocalRuntimeTrust(path.join(runtimeDirectory, "current"));
    const manual = createManualBackup({
      runtimeDirectory,
      now: new Date("2026-07-30T02:01:00.000Z")
    });
    const sameSecond = createManualBackup({
      runtimeDirectory,
      now: new Date("2026-07-30T02:01:00.000Z")
    });
    assert.match(manual.backupName, /^manual-20260730T020100Z-/);
    assert.notEqual(sameSecond.backupName, manual.backupName);
    assert.equal(listBackups(runtimeDirectory).length, 2);

    const restored = restoreBackup({
      runtimeDirectory,
      backupName: manual.backupName,
      now: new Date("2026-07-30T02:02:00.000Z")
    });
    assert.equal(restored.catalogVersion, 1);
    assert.match(restored.backupName, /^auto-20260730T020200Z-/);
    assert.equal(
      fs.existsSync(
        path.join(
          runtimeDirectory,
          "current",
          "client-config",
          "local-release-trust.json"
        )
      ),
      false
    );

    const publicBytes = fs
      .readdirSync(path.join(runtimeDirectory, "current", "public"), {
        recursive: true
      })
      .filter((entry) =>
        fs
          .statSync(path.join(runtimeDirectory, "current", "public", entry))
          .isFile()
      )
      .map((entry) =>
        fs.readFileSync(
          path.join(runtimeDirectory, "current", "public", entry),
          "utf8"
        )
      )
      .join("\n");
    assert.doesNotMatch(publicBytes, /BEGIN PRIVATE KEY/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ordinary activation rejects a version downgrade while restore remains explicit", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "older", "0.1.1"),
      now: new Date("2026-08-01T01:00:00.000Z")
    });
    const olderBackup = createManualBackup({
      runtimeDirectory,
      now: new Date("2026-08-01T01:01:00.000Z")
    });
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "newer", "0.1.2"),
      now: new Date("2026-08-01T01:02:00.000Z")
    });

    const downgrade = createBundle(root, "downgrade", "0.1.1");
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: downgrade,
          now: new Date("2026-08-01T01:03:00.000Z")
        }),
      /版本倒退/
    );
    assert.equal(fs.existsSync(downgrade), false);
    assert.equal(
      verifyReleaseBundle({
        bundleDirectory: path.join(runtimeDirectory, "current")
      }).updateVersion,
      "0.1.2"
    );

    const restored = restoreBackup({
      runtimeDirectory,
      backupName: olderBackup.backupName,
      now: new Date("2026-08-01T01:04:00.000Z")
    });
    assert.equal(restored.updateVersion, "0.1.1");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("same-version activation is idempotent only for the same artifact and source", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.2")
    });
    const exactRetry = path.join(runtimeDirectory, "staging", "exact-retry");
    fs.cpSync(path.join(runtimeDirectory, "current"), exactRetry, {
      recursive: true
    });
    assert.equal(
      activateStagedBundle({
        runtimeDirectory,
        stagedBundleDirectory: exactRetry
      }).updateVersion,
      "0.1.2"
    );

    const conflictingRetry = createBundle(root, "conflicting-retry", "0.1.2");
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: conflictingRetry
        }),
      /同版本发布内容不一致/
    );
    assert.equal(fs.existsSync(conflictingRetry), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("same-version activation rejects a changed Portable artifact even when Setup is unchanged", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  const setup = crypto.randomBytes(4096);
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.2", {
        setup,
        portable: crypto.randomBytes(4096)
      })
    });
    const conflictingRetry = createBundle(
      root,
      "portable-conflict",
      "0.1.2",
      {
        setup,
        portable: crypto.randomBytes(4096)
      }
    );
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: conflictingRetry
        }),
      /同版本发布内容不一致/
    );
    assert.equal(fs.existsSync(conflictingRetry), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("allows a validated TLS trust overlay only for activated runtime bundles", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const current = path.join(runtimeDirectory, "current");
    writeLocalRuntimeTrust(current);
    assert.throws(
      () => verifyReleaseBundle({ bundleDirectory: current }),
      /未声明文件/
    );
    assert.equal(
      verifyReleaseBundle({
        bundleDirectory: current,
        allowLocalRuntimeTrust: true
      }).updateVersion,
      "0.1.1"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writes the local TLS trust overlay through the verified runtime boundary", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const result = writeLocalReleaseTrustOverlay({
      runtimeDirectory,
      trust: localRuntimeTrust("AB")
    });
    assert.equal(result.fingerprint256, Array(32).fill("AB").join(":"));
    assert.equal(result.activationLockCleanupPending, false);
    assert.equal(
      verifyReleaseBundle({
        bundleDirectory: path.join(runtimeDirectory, "current"),
        allowLocalRuntimeTrust: true
      }).updateVersion,
      "0.1.1"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("TLS trust pinning rejects a client-config junction before writing", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-outside-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const current = path.join(runtimeDirectory, "current");
    const clientConfig = path.join(current, "client-config");
    fs.renameSync(clientConfig, path.join(current, "client-config-original"));
    try {
      fs.symlinkSync(outside, clientConfig, "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.skip(`junction unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.throws(
      () =>
        writeLocalReleaseTrustOverlay({
          runtimeDirectory,
          trust: localRuntimeTrust("AC")
        }),
      /不可信|未声明|缺少/
    );
    assert.equal(
      fs.existsSync(path.join(outside, "local-release-trust.json")),
      false
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("TLS trust pinning shares the activation lock", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    createActivationLock(runtimeDirectory, process.pid);
    assert.throws(
      () =>
        writeLocalReleaseTrustOverlay({
          runtimeDirectory,
          trust: localRuntimeTrust("AD")
        }),
      /正在进行/
    );
    assert.equal(
      fs.existsSync(
        path.join(
          runtimeDirectory,
          "current",
          "client-config",
          "local-release-trust.json"
        )
      ),
      false
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("TLS trust pinning can safely replace an expired runtime overlay", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const trustPath = path.join(
      runtimeDirectory,
      "current",
      "client-config",
      "local-release-trust.json"
    );
    fs.writeFileSync(
      trustPath,
      `${JSON.stringify({
        ...localRuntimeTrust("AE"),
        expiresAt: new Date(Date.now() - 60_000).toISOString()
      })}\n`
    );

    const renewed = writeLocalReleaseTrustOverlay({
      runtimeDirectory,
      trust: localRuntimeTrust("AF")
    });

    assert.equal(renewed.fingerprint256, Array(32).fill("AF").join(":"));
    assert.equal(
      JSON.parse(fs.readFileSync(trustPath, "utf8")).fingerprint256,
      renewed.fingerprint256
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keeps the previous v2 release until the post-activation transaction resolves", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const rollbackCandidate = activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "second", "0.1.2"),
      retainPreviousRelease: true,
      now: new Date("2026-08-01T04:00:00.000Z")
    });
    assert.ok(rollbackCandidate.backupName);
    assert.equal(
      fs.existsSync(
        path.join(runtimeDirectory, "backups", rollbackCandidate.backupName)
      ),
      true
    );
    const rolledBack = rollbackActivatedRelease({
      runtimeDirectory,
      backupName: rollbackCandidate.backupName,
      retiredName: rollbackCandidate.retiredName
    });
    assert.equal(rolledBack.updateVersion, "0.1.1");
    assert.equal(
      fs.existsSync(
        path.join(runtimeDirectory, "backups", rollbackCandidate.backupName)
      ),
      false
    );

    const commitCandidate = activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "third", "0.1.3"),
      retainPreviousRelease: true,
      now: new Date("2026-08-01T04:01:00.000Z")
    });
    const finalized = finalizeActivatedRelease({
      runtimeDirectory,
      backupName: commitCandidate.backupName,
      retiredName: commitCandidate.retiredName
    });
    assert.equal(finalized.finalized, true);
    assert.equal(
      fs.existsSync(
        path.join(runtimeDirectory, "backups", commitCandidate.backupName)
      ),
      false
    );
    assert.equal(
      verifyReleaseBundle({
        bundleDirectory: path.join(runtimeDirectory, "current")
      }).updateVersion,
      "0.1.3"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("retains and rolls back a verified legacy v1 release during migration", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    convertToLegacyBundleV1(path.join(runtimeDirectory, "current"));
    const deployment = activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "second", "0.1.2"),
      allowLegacyV1Migration: true,
      retainPreviousRelease: true,
      now: new Date("2026-08-01T04:02:00.000Z")
    });
    assert.match(deployment.retiredName, /^discard-/);
    assert.equal(
      fs.existsSync(
        path.join(runtimeDirectory, "staging", deployment.retiredName)
      ),
      true
    );

    const rolledBack = rollbackActivatedRelease({
      runtimeDirectory,
      backupName: deployment.backupName,
      retiredName: deployment.retiredName
    });
    assert.equal(rolledBack.legacySchemaVersion, 1);
    assert.equal(
      JSON.parse(
        fs.readFileSync(
          path.join(
            runtimeDirectory,
            "current",
            "public",
            "release-manifest.json"
          ),
          "utf8"
        )
      ).schemaVersion,
      1
    );
    assert.equal(
      fs.existsSync(
        path.join(runtimeDirectory, "staging", deployment.retiredName)
      ),
      false
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rolls an unaccepted first activation back to an empty runtime", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    const deployment = activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1"),
      retainPreviousRelease: true
    });
    const rolledBack = rollbackActivatedRelease({
      runtimeDirectory,
      backupName: deployment.backupName,
      retiredName: deployment.retiredName
    });
    assert.equal(rolledBack.restoredReleaseKind, "none");
    assert.equal(fs.existsSync(path.join(runtimeDirectory, "current")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("removes a partial prepare candidate without crossing the staging boundary", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  const staged = path.join(runtimeDirectory, "staging", "partial-prepare");
  const outside = path.join(root, "outside.txt");
  try {
    fs.mkdirSync(staged, { recursive: true });
    fs.writeFileSync(path.join(staged, "partial.bin"), "partial");
    fs.writeFileSync(outside, "keep");
    const cleanup = discardStagedBundleCandidateBestEffort(
      runtimeDirectory,
      staged
    );
    assert.equal(cleanup.cleanupPending, false);
    assert.equal(fs.existsSync(staged), false);
    assert.equal(fs.readFileSync(outside, "utf8"), "keep");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects traversal and a tampered backup before restore", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: path.join(root, "outside")
        }),
      /直接子目录/
    );
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first"),
      now: new Date("2026-07-30T02:00:00.000Z")
    });
    const backup = createManualBackup({
      runtimeDirectory,
      now: new Date("2026-07-30T02:01:00.000Z")
    });
    assert.throws(
      () =>
        restoreBackup({
          runtimeDirectory,
          backupName: "../escape"
        }),
      /备份名称/
    );

    const manifest = path.join(
      backup.backupDirectory,
      "public",
      "release-manifest.json"
    );
    fs.appendFileSync(manifest, "tampered");
    assert.throws(
      () =>
        restoreBackup({
          runtimeDirectory,
          backupName: backup.backupName
        })
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("replaces a fully verified legacy v1 current only when explicitly allowed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1"),
      now: new Date("2026-08-01T00:00:00.000Z")
    });
    const manifestPath = path.join(
      runtimeDirectory,
      "current",
      "public",
      "release-manifest.json"
    );
    convertToLegacyBundleV1(path.join(runtimeDirectory, "current"));

    const staged = createBundle(root, "second", "0.1.2");
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: staged,
          now: new Date("2026-08-01T00:01:00.000Z")
        }),
      /清单结构/
    );
    assert.equal(
      JSON.parse(fs.readFileSync(manifestPath, "utf8")).schemaVersion,
      1
    );

    const migratedStaged = createBundle(root, "second-migration", "0.1.2");
    const result = activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: migratedStaged,
      allowLegacyV1Migration: true,
      now: new Date("2026-08-01T00:02:00.000Z")
    });
    assert.equal(result.updateVersion, "0.1.2");
    assert.equal(result.backupName, "");
    assert.equal(result.migratedLegacyCurrent, true);
    assert.equal(result.discardedIncompatibleCurrent, true);
    assert.equal(result.retiredCleanupPending, false);
    assert.deepEqual(
      fs
        .readdirSync(path.join(runtimeDirectory, "staging"))
        .filter((name) => name.startsWith("discard-")),
      []
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("never discards a corrupted v2 current during legacy migration", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const current = path.join(runtimeDirectory, "current");
    const catalogPath = path.join(current, "public", "catalog-release.json");
    fs.appendFileSync(catalogPath, "tampered");
    const staged = createBundle(root, "second", "0.1.2");
    assert.throws(() =>
      activateStagedBundle({
        runtimeDirectory,
        stagedBundleDirectory: staged,
        allowLegacyV1Migration: true
      })
    );
    assert.equal(fs.readFileSync(catalogPath, "utf8").endsWith("tampered"), true);
    assert.equal(fs.existsSync(staged), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects v1-shaped metadata that retains undeclared v2 files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const current = path.join(runtimeDirectory, "current");
    const provenancePath = path.join(
      current,
      "public",
      "build-provenance.json"
    );
    const provenance = fs.readFileSync(provenancePath);
    convertToLegacyBundleV1(current);
    fs.writeFileSync(provenancePath, provenance);
    const staged = createBundle(root, "second", "0.1.2");
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: staged,
          allowLegacyV1Migration: true
        }),
      /未声明文件/
    );
    assert.equal(fs.existsSync(provenancePath), true);
    assert.equal(fs.existsSync(staged), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("restores the previous current when final activation verification fails", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  const originalRename = fs.renameSync;
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const staged = createBundle(root, "second", "0.1.2");
    const current = path.join(runtimeDirectory, "current");
    fs.renameSync = (source, destination) => {
      originalRename(source, destination);
      if (
        path.resolve(source) === path.resolve(staged) &&
        path.resolve(destination) === path.resolve(current)
      ) {
        fs.appendFileSync(
          path.join(destination, "public", "release-manifest.json"),
          "tampered"
        );
      }
    };
    assert.throws(() =>
      activateStagedBundle({
        runtimeDirectory,
        stagedBundleDirectory: staged
      })
    );
    fs.renameSync = originalRename;
    assert.equal(
      verifyReleaseBundle({ bundleDirectory: current }).updateVersion,
      "0.1.1"
    );
  } finally {
    fs.renameSync = originalRename;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a staging bundle reached through a symlink or junction", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  try {
    const realBundle = createBundle(root, "real", "0.1.1");
    const linkedBundle = path.join(root, "runtime", "staging", "linked");
    try {
      fs.symlinkSync(realBundle, linkedBundle, "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.skip(`symlink unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory: path.join(root, "runtime"),
          stagedBundleDirectory: linkedBundle
        }),
      /不可信目录/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a runtime junction before creating any child directories", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-outside-"));
  try {
    const runtimeDirectory = path.join(root, "runtime");
    try {
      fs.symlinkSync(outside, runtimeDirectory, "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.skip(`junction unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: path.join(
            runtimeDirectory,
            "staging",
            "missing"
          )
        }),
      /不是可信目录/
    );
    assert.equal(fs.existsSync(path.join(outside, "backups")), false);
    assert.equal(fs.existsSync(path.join(outside, "staging")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("rejects a parent junction before creating a missing runtime", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-outside-"));
  try {
    const linkedParent = path.join(root, "linked-parent");
    try {
      fs.symlinkSync(outside, linkedParent, "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.skip(`junction unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    const runtimeDirectory = path.join(linkedParent, "runtime");
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: path.join(
            runtimeDirectory,
            "staging",
            "missing"
          )
        }),
      /父级包含不可信目录/
    );
    assert.equal(fs.existsSync(path.join(outside, "runtime")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("an activation lock prevents a competing release from touching current", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const staged = createBundle(root, "second", "0.1.2");
    createActivationLock(runtimeDirectory, process.pid);
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: staged
        }),
      /正在进行/
    );
    assert.equal(
      verifyReleaseBundle({
        bundleDirectory: path.join(runtimeDirectory, "current")
      }).updateVersion,
      "0.1.1"
    );
    assert.equal(fs.existsSync(staged), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("recovers an activation lock whose owner process has exited", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const staged = createBundle(root, "second", "0.1.2");
    const exited = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
    assert.ok(Number.isSafeInteger(exited.pid));
    createActivationLock(runtimeDirectory, exited.pid);
    const result = activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: staged
    });
    assert.equal(result.updateVersion, "0.1.2");
    assert.equal(result.activationLockCleanupPending, false);
    assert.equal(fs.existsSync(path.join(runtimeDirectory, ".activation-lock")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("recovers an ownerless activation lock after the initialization grace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const staged = createBundle(root, "second", "0.1.2");
    const lockDirectory = path.join(runtimeDirectory, ".activation-lock");
    fs.mkdirSync(lockDirectory);
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lockDirectory, old, old);
    const result = activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: staged
    });
    assert.equal(result.updateVersion, "0.1.2");
    assert.equal(result.activationLockCleanupPending, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("recovers an invalid activation-lock owner after the grace period", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const staged = createBundle(root, "second", "0.1.2");
    const lockDirectory = path.join(runtimeDirectory, ".activation-lock");
    fs.mkdirSync(lockDirectory);
    fs.writeFileSync(path.join(lockDirectory, "owner.json"), "{invalid");
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lockDirectory, old, old);
    const result = activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: staged
    });
    assert.equal(result.updateVersion, "0.1.2");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("does not steal an ownerless activation lock during its grace period", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const staged = createBundle(root, "second", "0.1.2");
    fs.mkdirSync(path.join(runtimeDirectory, ".activation-lock"));
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: staged
        }),
      /正在初始化/
    );
    assert.equal(
      verifyReleaseBundle({
        bundleDirectory: path.join(runtimeDirectory, "current")
      }).updateVersion,
      "0.1.1"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a locked activation-lock cleanup does not turn success into failure", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  const originalRemove = fs.rmSync;
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const staged = createBundle(root, "second", "0.1.2");
    let blocked = true;
    fs.rmSync = (target, options) => {
      if (
        blocked &&
        path.resolve(target) ===
          path.resolve(runtimeDirectory, ".activation-lock")
      ) {
        blocked = false;
        const error = new Error("locked");
        error.code = "EBUSY";
        throw error;
      }
      return originalRemove(target, options);
    };
    const result = activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: staged
    });
    fs.rmSync = originalRemove;
    assert.equal(result.updateVersion, "0.1.2");
    assert.equal(result.activationLockCleanupPending, true);
    assert.equal(result.activationLockCleanupErrorCode, "EBUSY");
    assert.equal(
      verifyReleaseBundle({
        bundleDirectory: path.join(runtimeDirectory, "current")
      }).updateVersion,
      "0.1.2"
    );
  } finally {
    fs.rmSync = originalRemove;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("cleans a partial cross-volume current before restoring the old release", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  const originalRename = fs.renameSync;
  const originalCopy = fs.cpSync;
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    const staged = createBundle(root, "second", "0.1.2");
    const current = path.join(runtimeDirectory, "current");
    fs.renameSync = (source, destination) => {
      if (
        path.resolve(source) === path.resolve(staged) &&
        path.resolve(destination) === path.resolve(current)
      ) {
        const error = new Error("cross-volume");
        error.code = "EXDEV";
        throw error;
      }
      return originalRename(source, destination);
    };
    fs.cpSync = (source, destination, options) => {
      if (
        path.resolve(source) === path.resolve(staged) &&
        path.resolve(destination) === path.resolve(current)
      ) {
        fs.mkdirSync(destination, { recursive: true });
        fs.writeFileSync(path.join(destination, "partial.txt"), "partial");
        const error = new Error("partial copy failed");
        error.code = "EIO";
        throw error;
      }
      return originalCopy(source, destination, options);
    };
    assert.throws(
      () =>
        activateStagedBundle({
          runtimeDirectory,
          stagedBundleDirectory: staged
        }),
      /partial copy failed/
    );
    fs.renameSync = originalRename;
    fs.cpSync = originalCopy;
    assert.equal(
      verifyReleaseBundle({ bundleDirectory: current }).updateVersion,
      "0.1.1"
    );
    assert.equal(fs.existsSync(path.join(current, "partial.txt")), false);
  } finally {
    fs.renameSync = originalRename;
    fs.cpSync = originalCopy;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("cleans a partial manual-backup copy without touching current", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-"));
  const runtimeDirectory = path.join(root, "runtime");
  const originalCopy = fs.cpSync;
  try {
    activateStagedBundle({
      runtimeDirectory,
      stagedBundleDirectory: createBundle(root, "first", "0.1.1")
    });
    fs.cpSync = (source, destination, options) => {
      if (path.basename(destination).startsWith("manual-")) {
        fs.mkdirSync(destination, { recursive: true });
        fs.writeFileSync(path.join(destination, "partial.txt"), "partial");
        const error = new Error("backup copy failed");
        error.code = "EIO";
        throw error;
      }
      return originalCopy(source, destination, options);
    };
    assert.throws(
      () => createManualBackup({ runtimeDirectory }),
      /backup copy failed/
    );
    fs.cpSync = originalCopy;
    assert.equal(
      fs
        .readdirSync(path.join(runtimeDirectory, "backups"))
        .some((name) => name.startsWith("manual-")),
      false
    );
    assert.equal(
      verifyReleaseBundle({
        bundleDirectory: path.join(runtimeDirectory, "current")
      }).updateVersion,
      "0.1.1"
    );
  } finally {
    fs.cpSync = originalCopy;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
