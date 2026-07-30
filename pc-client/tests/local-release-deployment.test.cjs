"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  activateStagedBundle,
  createManualBackup,
  listBackups,
  restoreBackup
} = require("../admin/local-release-deployment.cjs");
const {
  prepareReleaseBundle
} = require("../admin/release-bundle.cjs");
const {
  catalogReleaseSha256
} = require("../shared/catalog-release.cjs");

function signingKey() {
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  return { privateKey, source: "environment" };
}

function createBundle(root, name, version = "0.1.1") {
  const catalog = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "admin", "data", "catalog-v1.json"),
      "utf8"
    )
  );
  const installer = path.join(
    root,
    `AI-Hub-${version}-Windows-x64-Setup.exe`
  );
  fs.writeFileSync(installer, crypto.randomBytes(4096));
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
    signingKeys: {
      catalog: signingKey(),
      update: signingKey()
    },
    publishedAt: "2026-07-30T01:00:00.000Z"
  });
  return outputDirectory;
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
