"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  advanceUpgradeJournal,
  beginUpgradeJournal,
  completeUpgradeJournal,
  readUpgradeJournal,
  restoreRuntimeSnapshot,
  sealUpgradeJournalReceipts,
  upgradeJournalStatus,
  verifyUpgradeJournalReceipts,
  verifyRuntimeSnapshotRestored
} = require("../shared/local-release-upgrade-journal.cjs");

const version = "0.1.24";
const revision = "a".repeat(40);

function fixture({ current = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-upgrade-journal-"));
  const transactionRoot = path.join(root, "transactions");
  const runtimeDirectory = path.join(root, "runtime");
  fs.mkdirSync(runtimeDirectory, { recursive: true });
  if (current) {
    fs.mkdirSync(path.join(runtimeDirectory, "current", "public"), {
      recursive: true
    });
    fs.writeFileSync(
      path.join(runtimeDirectory, "current", "public", "release.json"),
      "previous\n"
    );
  }
  return {
    root,
    transactionRoot,
    runtimeDirectory,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

const phasesToServicesActive = [
  "delivery-activating",
  "delivery-active",
  "runtime-activating",
  "runtime-active",
  "services-staging",
  "services-staged",
  "services-promoting",
  "services-active"
];

function prepareReceiptsForAcceptance(value) {
  let journal = beginUpgradeJournal({
    transactionRoot: value.transactionRoot,
    runtimeDirectory: value.runtimeDirectory,
    version,
    revision
  });
  for (const phase of phasesToServicesActive) {
    journal = advanceUpgradeJournal({
      transactionRoot: value.transactionRoot,
      phase
    });
  }
  for (const [key, receiptPath] of Object.entries(journal.receiptPaths)) {
    fs.writeFileSync(receiptPath, `${JSON.stringify({ key, version })}\n`);
  }
  return journal;
}

test("a single fixed journal snapshots the previous runtime before mutation", () => {
  const value = fixture();
  try {
    const journal = beginUpgradeJournal({
      transactionRoot: value.transactionRoot,
      runtimeDirectory: value.runtimeDirectory,
      version,
      revision
    });
    assert.equal(journal.phase, "created");
    assert.equal(journal.runtimeSnapshot.existed, true);
    assert.equal(journal.runtimeSnapshot.files.length, 1);
    assert.ok(fs.existsSync(path.join(value.transactionRoot, "pending.json")));
    assert.throws(
      () =>
        beginUpgradeJournal({
          transactionRoot: value.transactionRoot,
          runtimeDirectory: value.runtimeDirectory,
          version,
          revision
        }),
      /already pending/
    );
  } finally {
    value.cleanup();
  }
});

test("pre-acceptance phases can only move forward or enter rollback", () => {
  const value = fixture();
  try {
    beginUpgradeJournal({
      transactionRoot: value.transactionRoot,
      runtimeDirectory: value.runtimeDirectory,
      version,
      revision
    });
    assert.throws(
      () =>
        advanceUpgradeJournal({
          transactionRoot: value.transactionRoot,
          phase: "runtime-active"
        }),
      /cannot advance/
    );
    assert.equal(
      advanceUpgradeJournal({
        transactionRoot: value.transactionRoot,
        phase: "delivery-activating"
      }).phase,
      "delivery-activating"
    );
    assert.equal(
      advanceUpgradeJournal({
        transactionRoot: value.transactionRoot,
        phase: "rollback-started"
      }).phase,
      "rollback-started"
    );
    assert.throws(
      () =>
        advanceUpgradeJournal({
          transactionRoot: value.transactionRoot,
          phase: "accepted"
        }),
      /cannot advance/
    );
  } finally {
    value.cleanup();
  }
});

test("acceptance requires exact sealed child receipts", () => {
  const value = fixture();
  try {
    const journal = prepareReceiptsForAcceptance(value);
    assert.throws(
      () =>
        advanceUpgradeJournal({
          transactionRoot: value.transactionRoot,
          phase: "accepted"
        }),
      /must be sealed/
    );

    const sealed = sealUpgradeJournalReceipts({
      transactionRoot: value.transactionRoot
    });
    assert.equal(sealed.phase, "services-active");
    assert.equal(
      Object.values(sealed.receiptDigests).every((digest) =>
        /^[a-f0-9]{64}$/.test(digest)
      ),
      true
    );
    assert.equal(
      verifyUpgradeJournalReceipts({
        transactionRoot: value.transactionRoot
      }).verified,
      true
    );

    fs.writeFileSync(journal.receiptPaths.runtime, '{"tampered":true}\n');
    assert.throws(
      () =>
        advanceUpgradeJournal({
          transactionRoot: value.transactionRoot,
          phase: "accepted"
        }),
      /differs from its sealed digest/
    );
    assert.throws(
      () =>
        verifyUpgradeJournalReceipts({
          transactionRoot: value.transactionRoot
        }),
      /differs from its sealed digest/
    );

    sealUpgradeJournalReceipts({ transactionRoot: value.transactionRoot });
    assert.equal(
      advanceUpgradeJournal({
        transactionRoot: value.transactionRoot,
        phase: "accepted"
      }).phase,
      "accepted"
    );
  } finally {
    value.cleanup();
  }
});

test("accepted journals cannot discard their receipt seals", () => {
  const value = fixture();
  try {
    prepareReceiptsForAcceptance(value);
    sealUpgradeJournalReceipts({ transactionRoot: value.transactionRoot });
    advanceUpgradeJournal({
      transactionRoot: value.transactionRoot,
      phase: "accepted"
    });
    const pending = path.join(value.transactionRoot, "pending.json");
    const journal = JSON.parse(fs.readFileSync(pending, "utf8"));
    journal.receiptDigests.delivery = null;
    fs.writeFileSync(pending, `${JSON.stringify(journal)}\n`);
    assert.throws(
      () => readUpgradeJournal({ transactionRoot: value.transactionRoot }),
      /receipts are not sealed/
    );
  } finally {
    value.cleanup();
  }
});

test("runtime recovery is idempotent across the rename fault window", () => {
  const value = fixture();
  try {
    const journal = beginUpgradeJournal({
      transactionRoot: value.transactionRoot,
      runtimeDirectory: value.runtimeDirectory,
      version,
      revision
    });
    const current = path.join(value.runtimeDirectory, "current");
    fs.writeFileSync(path.join(current, "public", "release.json"), "candidate\n");

    // Simulate a hard exit immediately after recovery retires the rejected tree.
    fs.renameSync(current, path.join(journal.transactionPath, "runtime-rejected"));
    assert.deepEqual(
      restoreRuntimeSnapshot({
        transactionRoot: value.transactionRoot,
        runtimeDirectory: value.runtimeDirectory
      }),
      { restored: true, previousRuntime: true }
    );
    assert.equal(
      fs.readFileSync(path.join(current, "public", "release.json"), "utf8"),
      "previous\n"
    );
    assert.deepEqual(
      restoreRuntimeSnapshot({
        transactionRoot: value.transactionRoot,
        runtimeDirectory: value.runtimeDirectory
      }),
      { restored: true, previousRuntime: true }
    );
    assert.equal(
      verifyRuntimeSnapshotRestored({
        transactionRoot: value.transactionRoot,
        runtimeDirectory: value.runtimeDirectory
      }).restored,
      true
    );
  } finally {
    value.cleanup();
  }
});

test("runtime recovery reconstructs the snapshot in place when Windows retains the directory", () => {
  const value = fixture();
  const originalRenameSync = fs.renameSync;
  try {
    const journal = beginUpgradeJournal({
      transactionRoot: value.transactionRoot,
      runtimeDirectory: value.runtimeDirectory,
      version,
      revision
    });
    const current = path.join(value.runtimeDirectory, "current");
    fs.writeFileSync(path.join(current, "public", "release.json"), "candidate\n");
    fs.writeFileSync(path.join(current, "public", "candidate-only.json"), "next\n");

    fs.renameSync = (source, destination) => {
      if (
        path.resolve(source) === path.resolve(current) &&
        path.resolve(destination) ===
          path.resolve(journal.transactionPath, "runtime-rejected")
      ) {
        const error = new Error("Windows directory is still mounted");
        error.code = "EPERM";
        throw error;
      }
      return originalRenameSync(source, destination);
    };

    assert.deepEqual(
      restoreRuntimeSnapshot({
        transactionRoot: value.transactionRoot,
        runtimeDirectory: value.runtimeDirectory
      }),
      { restored: true, previousRuntime: true, inPlace: true }
    );
    assert.equal(
      fs.readFileSync(path.join(current, "public", "release.json"), "utf8"),
      "previous\n"
    );
    assert.equal(
      fs.existsSync(path.join(current, "public", "candidate-only.json")),
      false
    );
    assert.equal(
      verifyRuntimeSnapshotRestored({
        transactionRoot: value.transactionRoot,
        runtimeDirectory: value.runtimeDirectory
      }).restored,
      true
    );
  } finally {
    fs.renameSync = originalRenameSync;
    value.cleanup();
  }
});

test("first-release recovery removes an unaccepted runtime", () => {
  const value = fixture({ current: false });
  try {
    beginUpgradeJournal({
      transactionRoot: value.transactionRoot,
      runtimeDirectory: value.runtimeDirectory,
      version,
      revision
    });
    fs.mkdirSync(path.join(value.runtimeDirectory, "current"));
    fs.writeFileSync(path.join(value.runtimeDirectory, "current", "next"), "next");
    assert.deepEqual(
      restoreRuntimeSnapshot({
        transactionRoot: value.transactionRoot,
        runtimeDirectory: value.runtimeDirectory
      }),
      { restored: true, previousRuntime: false }
    );
    assert.equal(fs.existsSync(path.join(value.runtimeDirectory, "current")), false);
  } finally {
    value.cleanup();
  }
});

test("a journal is removed only after a complete finalize or rollback sequence", () => {
  const value = fixture();
  try {
    beginUpgradeJournal({
      transactionRoot: value.transactionRoot,
      runtimeDirectory: value.runtimeDirectory,
      version,
      revision
    });
    assert.throws(
      () => completeUpgradeJournal({ transactionRoot: value.transactionRoot }),
      /not complete/
    );
    advanceUpgradeJournal({
      transactionRoot: value.transactionRoot,
      phase: "rollback-started"
    });
    for (const phase of [
      "runtime-rolled-back",
      "services-rolled-back",
      "delivery-rolled-back"
    ]) {
      advanceUpgradeJournal({ transactionRoot: value.transactionRoot, phase });
    }
    assert.equal(
      completeUpgradeJournal({ transactionRoot: value.transactionRoot }).completed,
      true
    );
    assert.deepEqual(upgradeJournalStatus({ transactionRoot: value.transactionRoot }), {
      pending: false,
      transactionRoot: path.resolve(value.transactionRoot)
    });
  } finally {
    value.cleanup();
  }
});

test("a linked or damaged active journal is rejected instead of starting anew", (t) => {
  const value = fixture();
  try {
    beginUpgradeJournal({
      transactionRoot: value.transactionRoot,
      runtimeDirectory: value.runtimeDirectory,
      version,
      revision
    });
    const pending = path.join(value.transactionRoot, "pending.json");
    fs.writeFileSync(pending, "{}\n");
    assert.throws(
      () => readUpgradeJournal({ transactionRoot: value.transactionRoot }),
      /journal is invalid/
    );

    if (process.platform === "win32") return;
    fs.rmSync(pending);
    fs.symlinkSync(path.join(value.root, "outside"), pending);
    assert.throws(
      () => readUpgradeJournal({ transactionRoot: value.transactionRoot }),
      /not trusted/
    );
  } finally {
    value.cleanup();
  }
});

test("a non-initializing journal cannot discard its recovery snapshot", () => {
  const value = fixture();
  try {
    beginUpgradeJournal({
      transactionRoot: value.transactionRoot,
      runtimeDirectory: value.runtimeDirectory,
      version,
      revision
    });
    const pending = path.join(value.transactionRoot, "pending.json");
    const journal = JSON.parse(fs.readFileSync(pending, "utf8"));
    journal.runtimeSnapshot = null;
    fs.writeFileSync(pending, `${JSON.stringify(journal)}\n`);
    assert.throws(
      () => readUpgradeJournal({ transactionRoot: value.transactionRoot }),
      /has no runtime snapshot/
    );
  } finally {
    value.cleanup();
  }
});
