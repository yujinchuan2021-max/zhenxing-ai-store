"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  discardActivatedLocalReleaseBackup,
  discardActivatedLocalReleaseBackupBestEffort
} = require("../shared/local-release-retention.cjs");

test("discards only the exact backup created by the activated local release", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-retention-"));
  try {
    const backupName = "auto-20260731T201108Z-catalog-v00000029-0.1.20";
    const target = path.join(root, "backups", backupName);
    const retained = path.join(root, "backups", "keep-unrelated");
    fs.mkdirSync(target, { recursive: true });
    fs.mkdirSync(retained, { recursive: true });
    fs.writeFileSync(path.join(target, "artifact.bin"), "old", "utf8");

    assert.equal(
      discardActivatedLocalReleaseBackup({
        runtimeDirectory: root,
        backupName
      }),
      true
    );
    assert.equal(fs.existsSync(target), false);
    assert.equal(fs.existsSync(retained), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a backup name that could escape the local runtime", () => {
  const root = path.resolve(os.tmpdir(), "aihub-retention-boundary");
  assert.throws(
    () =>
      discardActivatedLocalReleaseBackup({
        runtimeDirectory: root,
        backupName: "..\\outside"
      }),
    /backup name/i
  );
});

test("reports a locked backup as pending without failing an activated release", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-retention-"));
  const originalRemove = fs.rmSync;
  try {
    const backupName = "auto-20260801T000000Z-catalog-v00000030-0.1.21";
    const target = path.join(root, "backups", backupName);
    fs.mkdirSync(target, { recursive: true });
    fs.rmSync = (candidate, options) => {
      if (path.resolve(candidate) === path.resolve(target)) {
        const error = new Error("locked");
        error.code = "EBUSY";
        throw error;
      }
      return originalRemove(candidate, options);
    };
    assert.deepEqual(
      discardActivatedLocalReleaseBackupBestEffort({
        runtimeDirectory: root,
        backupName
      }),
      { discarded: false, cleanupPending: true, errorCode: "EBUSY" }
    );
    assert.equal(fs.existsSync(target), true);
  } finally {
    fs.rmSync = originalRemove;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
