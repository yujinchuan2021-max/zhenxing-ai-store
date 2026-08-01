"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  readLocalReleaseTransactionReceipt
} = require("../scripts/lib/local-release-transaction-receipt.cjs");

function receipt(overrides = {}) {
  return {
    ok: false,
    backupName: "auto-20260801T000000Z-catalog-v00000030-0.1.23",
    retiredName: "",
    expectedCurrent: {
      version: "0.1.24",
      sha256: "a".repeat(64),
      source: {
        revision: "b".repeat(40),
        dirty: false,
        versionTag: "v0.1.24"
      }
    },
    retiredCleanupPending: false,
    stagingCleanupPending: true,
    staleLockCleanupPending: false,
    activationLockCleanupPending: false,
    activationLockCleanupErrorCode: null,
    ...overrides
  };
}

function withReceipt(value, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-runtime-receipt-"));
  try {
    const receiptPath = path.join(root, "receipt.json");
    fs.writeFileSync(receiptPath, JSON.stringify(value), "utf8");
    return callback(receiptPath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("preserves activation cleanup state needed by finalize and rollback commands", () => {
  const value = withReceipt(receipt(), (receiptPath) =>
    readLocalReleaseTransactionReceipt(receiptPath)
  );
  assert.equal(value.stagingCleanupPending, true);
  assert.equal(value.retiredCleanupPending, false);
  assert.equal(value.staleLockCleanupPending, false);
  assert.equal(value.activationLockCleanupPending, false);
});

test("rejects a receipt that claims success while cleanup is pending", () => {
  assert.throws(
    () =>
      withReceipt(receipt({ ok: true }), (receiptPath) =>
        readLocalReleaseTransactionReceipt(receiptPath)
      ),
    /内容无效/
  );
});

test("prepare writes pending cleanup as a failed durable command result", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../scripts/prepare-local-release.cjs"),
    "utf8"
  );
  assert.match(source, /localReleaseCommandResult\(/);
  assert.match(source, /if \(!receipt\.ok\) process\.exitCode = 2/);
});
