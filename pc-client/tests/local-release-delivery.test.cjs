"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  activatePreparedLocalReleaseDelivery,
  activatePreparedLocalReleaseDeliveryTransaction,
  finalizeLocalReleaseDeliveryTransaction,
  localReleaseDeliveryNames,
  prepareLocalReleaseDeliveryTransaction,
  rollbackLocalReleaseDeliveryTransaction,
  verifyPreparedLocalReleaseDelivery
} = require("../shared/local-release-delivery.cjs");
const {
  createArtifactBuildMetadata,
  sha256File
} = require("../shared/release-provenance.cjs");
const {
  formatLocalReleaseChecksums
} = require("../shared/local-release-artifacts.cjs");

const VERSION = "0.1.24";
const SOURCE = {
  revision: "a".repeat(40),
  dirty: false,
  versionTag: "v0.1.24"
};

function createCandidate(parent, name = "candidate") {
  const directory = path.join(parent, name);
  fs.mkdirSync(directory);
  const names = localReleaseDeliveryNames(VERSION);
  for (const artifactName of names.artifacts) {
    fs.writeFileSync(
      path.join(directory, artifactName),
      crypto.randomBytes(128)
    );
  }
  const metadata = createArtifactBuildMetadata({
    version: VERSION,
    source: SOURCE,
    artifactPaths: names.artifacts.map((artifactName) =>
      path.join(directory, artifactName)
    ),
    builtAt: "2026-08-01T00:00:00.000Z"
  });
  fs.writeFileSync(
    path.join(directory, names.buildMetadata),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8"
  );
  const checksumInputs = [...names.artifacts, names.buildMetadata];
  fs.writeFileSync(
    path.join(directory, names.checksums),
    formatLocalReleaseChecksums(
      checksumInputs.map((fileName) => ({
        name: fileName,
        sha256: sha256File(path.join(directory, fileName))
      }))
    ),
    "utf8"
  );
  return { directory, names };
}

function activateTransaction(options) {
  prepareLocalReleaseDeliveryTransaction(options);
  return activatePreparedLocalReleaseDeliveryTransaction(options);
}

test("accepts only a complete self-consistent local delivery directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const { directory, names } = createCandidate(root);
    const verified = verifyPreparedLocalReleaseDelivery({
      directory,
      version: VERSION
    });
    assert.deepEqual(verified.files, [
      ...names.artifacts,
      names.buildMetadata,
      names.checksums
    ].sort());
    assert.deepEqual(
      verified.checksummedFiles,
      [...names.artifacts, names.buildMetadata].sort()
    );

    fs.rmSync(path.join(directory, names.artifacts[2]));
    assert.throws(
      () =>
        verifyPreparedLocalReleaseDelivery({
          directory,
          version: VERSION
        }),
      /blockmap|delivery/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects an unlisted same-version residual before delivery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const { directory, names } = createCandidate(root);
    fs.writeFileSync(
      path.join(directory, `${names.artifacts[0]}.old`),
      "stale",
      "utf8"
    );
    assert.throws(
      () =>
        verifyPreparedLocalReleaseDelivery({
          directory,
          version: VERSION
        }),
      /unexpected|delivery/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a checksum manifest that omits the Setup blockmap", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const { directory, names } = createCandidate(root);
    const checksumPath = path.join(directory, names.checksums);
    const withoutBlockmap = fs
      .readFileSync(checksumPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => !line.includes(".blockmap"))
      .join("\n");
    fs.writeFileSync(checksumPath, withoutBlockmap, "utf8");
    assert.throws(
      () =>
        verifyPreparedLocalReleaseDelivery({
          directory,
          version: VERSION
        }),
      /checksum manifest is incomplete/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("switches a verified candidate as one delivery and removes same-version leftovers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    fs.mkdirSync(deliveryDirectory);
    fs.writeFileSync(
      path.join(deliveryDirectory, "AI-Hub-Local-0.1.24-stale.txt"),
      "old",
      "utf8"
    );
    const { directory, names } = createCandidate(root);
    const result = activatePreparedLocalReleaseDelivery({
      candidateDirectory: directory,
      deliveryDirectory,
      version: VERSION
    });
    assert.equal(result.activated, true);
    assert.equal(result.cleanupPending, false);
    assert.equal(fs.existsSync(directory), false);
    assert.equal(
      fs.existsSync(
        path.join(deliveryDirectory, "AI-Hub-Local-0.1.24-stale.txt")
      ),
      false
    );
    assert.deepEqual(
      fs.readdirSync(deliveryDirectory).sort(),
      [...names.artifacts, names.buildMetadata, names.checksums].sort()
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("restores the previous delivery when the candidate cannot be activated", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  const originalRename = fs.renameSync;
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    fs.mkdirSync(deliveryDirectory);
    fs.writeFileSync(path.join(deliveryDirectory, "old.txt"), "old", "utf8");
    const { directory } = createCandidate(root);
    fs.renameSync = (source, destination) => {
      if (path.resolve(source) === path.resolve(directory)) {
        const error = new Error("candidate locked");
        error.code = "EPERM";
        throw error;
      }
      return originalRename(source, destination);
    };
    assert.throws(
      () =>
        activatePreparedLocalReleaseDelivery({
          candidateDirectory: directory,
          deliveryDirectory,
          version: VERSION
        }),
      /candidate locked/
    );
    fs.renameSync = originalRename;
    assert.equal(
      fs.readFileSync(path.join(deliveryDirectory, "old.txt"), "utf8"),
      "old"
    );
    assert.equal(fs.existsSync(directory), true);
  } finally {
    fs.renameSync = originalRename;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keeps the new verified delivery but reports pending cleanup when the retired directory is locked", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  const originalRemove = fs.rmSync;
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    fs.mkdirSync(deliveryDirectory);
    fs.writeFileSync(path.join(deliveryDirectory, "old.txt"), "old", "utf8");
    const { directory } = createCandidate(root);
    fs.rmSync = (target, options) => {
      if (path.basename(target).startsWith(".release-local-server-client-retired-")) {
        const error = new Error("retired delivery locked");
        error.code = "EBUSY";
        throw error;
      }
      return originalRemove(target, options);
    };
    const result = activatePreparedLocalReleaseDelivery({
      candidateDirectory: directory,
      deliveryDirectory,
      version: VERSION
    });
    fs.rmSync = originalRemove;
    assert.equal(result.activated, true);
    assert.equal(result.cleanupPending, true);
    assert.equal(result.cleanupErrorCode, "EBUSY");
    assert.match(path.basename(result.retiredDirectory), /^\.release-local-server-client-retired-/);
    assert.equal(
      verifyPreparedLocalReleaseDelivery({
        directory: deliveryDirectory,
        version: VERSION
      }).version,
      VERSION
    );
  } finally {
    fs.rmSync = originalRemove;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keeps the previous delivery until the delivery transaction is finalized", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    fs.mkdirSync(deliveryDirectory);
    fs.writeFileSync(path.join(deliveryDirectory, "old.txt"), "old", "utf8");
    const { directory } = createCandidate(
      root,
      "release-local-server-client-candidate-finalize"
    );
    const receiptPath = path.join(root, "delivery-transaction.json");
    const activation = activateTransaction({
      candidateDirectory: directory,
      deliveryDirectory,
      receiptPath,
      version: VERSION
    });
    assert.equal(activation.transactionPending, true);
    assert.equal(fs.existsSync(receiptPath), true);
    assert.equal(fs.existsSync(activation.retiredDirectory), true);
    assert.equal(
      fs.readFileSync(path.join(activation.retiredDirectory, "old.txt"), "utf8"),
      "old"
    );

    const finalized = finalizeLocalReleaseDeliveryTransaction({
      deliveryDirectory,
      receiptPath
    });
    assert.equal(finalized.finalized, true);
    assert.equal(finalized.cleanupPending, false);
    assert.equal(fs.existsSync(activation.retiredDirectory), false);
    assert.equal(
      verifyPreparedLocalReleaseDelivery({
        directory: deliveryDirectory,
        version: VERSION
      }).version,
      VERSION
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rolls a rejected delivery back to the exact previous directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    fs.mkdirSync(deliveryDirectory);
    fs.writeFileSync(path.join(deliveryDirectory, "old.txt"), "old", "utf8");
    const { directory } = createCandidate(
      root,
      "release-local-server-client-candidate-rollback"
    );
    const receiptPath = path.join(root, "delivery-transaction.json");
    const activation = activateTransaction({
      candidateDirectory: directory,
      deliveryDirectory,
      receiptPath,
      version: VERSION
    });

    const rolledBack = rollbackLocalReleaseDeliveryTransaction({
      deliveryDirectory,
      receiptPath
    });
    assert.equal(rolledBack.rolledBack, true);
    assert.equal(rolledBack.restoredPrevious, true);
    assert.equal(rolledBack.cleanupPending, false);
    assert.equal(
      fs.readFileSync(path.join(deliveryDirectory, "old.txt"), "utf8"),
      "old"
    );
    assert.equal(fs.existsSync(activation.retiredDirectory), false);
    assert.equal(fs.existsSync(directory), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rolls a rejected first delivery back to no public delivery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    const { directory } = createCandidate(
      root,
      "release-local-server-client-candidate-first"
    );
    const receiptPath = path.join(root, "delivery-transaction.json");
    activateTransaction({
      candidateDirectory: directory,
      deliveryDirectory,
      receiptPath,
      version: VERSION
    });

    const rolledBack = rollbackLocalReleaseDeliveryTransaction({
      deliveryDirectory,
      receiptPath
    });
    assert.equal(rolledBack.restoredPrevious, false);
    assert.equal(rolledBack.cleanupPending, false);
    assert.equal(fs.existsSync(deliveryDirectory), false);
    assert.equal(fs.existsSync(directory), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("preserves both recovery directories when activation and restoration fail", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  const originalRename = fs.renameSync;
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    fs.mkdirSync(deliveryDirectory);
    fs.writeFileSync(path.join(deliveryDirectory, "old.txt"), "old", "utf8");
    const { directory } = createCandidate(
      root,
      "release-local-server-client-candidate-double-failure"
    );
    const receiptPath = path.join(root, "delivery-transaction.json");
    fs.renameSync = (source, destination) => {
      if (path.resolve(source) === path.resolve(directory)) {
        const error = new Error("candidate activation failed");
        error.code = "EPERM";
        throw error;
      }
      if (
        path.basename(source).startsWith(".release-local-server-client-retired-") &&
        path.resolve(destination) === path.resolve(deliveryDirectory)
      ) {
        const error = new Error("previous delivery restoration failed");
        error.code = "EIO";
        throw error;
      }
      return originalRename(source, destination);
    };
    let failure;
    try {
      activateTransaction({
        candidateDirectory: directory,
        deliveryDirectory,
        receiptPath,
        version: VERSION
      });
    } catch (error) {
      failure = error;
    }
    fs.renameSync = originalRename;
    assert.ok(failure instanceof AggregateError);
    assert.equal(failure.deliveryRecoveryPending, true);
    assert.equal(fs.existsSync(receiptPath), true);
    assert.equal(fs.existsSync(directory), true);
    assert.equal(
      fs
        .readdirSync(root)
        .some((name) => name.startsWith(".release-local-server-client-retired-")),
      true
    );
  } finally {
    fs.renameSync = originalRename;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("recovers the prewritten transaction after a crash between the two directory renames", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    fs.mkdirSync(deliveryDirectory);
    fs.writeFileSync(path.join(deliveryDirectory, "old.txt"), "old", "utf8");
    const { directory } = createCandidate(
      root,
      "release-local-server-client-candidate-crash-window"
    );
    const receiptPath = path.join(root, "delivery-transaction.json");
    const prepared = prepareLocalReleaseDeliveryTransaction({
      candidateDirectory: directory,
      deliveryDirectory,
      receiptPath,
      version: VERSION
    });
    assert.equal(fs.existsSync(receiptPath), true);
    fs.renameSync(deliveryDirectory, prepared.retiredDirectory);

    const rolledBack = rollbackLocalReleaseDeliveryTransaction({
      deliveryDirectory,
      receiptPath
    });
    assert.equal(rolledBack.rolledBack, true);
    assert.equal(rolledBack.restoredPrevious, true);
    assert.equal(
      fs.readFileSync(path.join(deliveryDirectory, "old.txt"), "utf8"),
      "old"
    );
    assert.equal(fs.existsSync(directory), false);
    assert.equal(fs.existsSync(prepared.retiredDirectory), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("persists a retryable receipt when retired-delivery cleanup is locked", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  const originalRemove = fs.rmSync;
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    fs.mkdirSync(deliveryDirectory);
    fs.writeFileSync(path.join(deliveryDirectory, "old.txt"), "old", "utf8");
    const { directory } = createCandidate(
      root,
      "release-local-server-client-candidate-retry-cleanup"
    );
    const receiptPath = path.join(root, "delivery-transaction.json");
    const activation = activateTransaction({
      candidateDirectory: directory,
      deliveryDirectory,
      receiptPath,
      version: VERSION
    });
    fs.rmSync = (target, options) => {
      if (path.resolve(target) === path.resolve(activation.retiredDirectory)) {
        const error = new Error("retired delivery locked");
        error.code = "EBUSY";
        throw error;
      }
      return originalRemove(target, options);
    };
    const pending = finalizeLocalReleaseDeliveryTransaction({
      deliveryDirectory,
      receiptPath
    });
    fs.rmSync = originalRemove;
    assert.equal(pending.finalized, true);
    assert.equal(pending.cleanupPending, true);
    assert.equal(pending.cleanupErrorCode, "EBUSY");
    assert.equal(fs.existsSync(receiptPath), true);
    assert.equal(fs.existsSync(activation.retiredDirectory), true);

    const retried = finalizeLocalReleaseDeliveryTransaction({
      deliveryDirectory,
      receiptPath
    });
    assert.equal(retried.cleanupPending, false);
    assert.equal(fs.existsSync(activation.retiredDirectory), false);
  } finally {
    fs.rmSync = originalRemove;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a delivery transaction receipt whose recovery names were changed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    fs.mkdirSync(deliveryDirectory);
    fs.writeFileSync(path.join(deliveryDirectory, "old.txt"), "old", "utf8");
    const { directory } = createCandidate(
      root,
      "release-local-server-client-candidate-tamper"
    );
    const receiptPath = path.join(root, "delivery-transaction.json");
    prepareLocalReleaseDeliveryTransaction({
      candidateDirectory: directory,
      deliveryDirectory,
      receiptPath,
      version: VERSION
    });
    const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    receipt.candidateName = "..\\outside";
    fs.writeFileSync(receiptPath, JSON.stringify(receipt), "utf8");
    assert.throws(
      () =>
        rollbackLocalReleaseDeliveryTransaction({
          deliveryDirectory,
          receiptPath
        }),
      /receipt is invalid/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a delivery transaction receipt whose signed snapshot order changed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-delivery-"));
  try {
    const deliveryDirectory = path.join(root, "release-local-server-client");
    const { directory } = createCandidate(
      root,
      "release-local-server-client-candidate-order"
    );
    const receiptPath = path.join(root, "delivery-transaction.json");
    prepareLocalReleaseDeliveryTransaction({
      candidateDirectory: directory,
      deliveryDirectory,
      receiptPath,
      version: VERSION
    });
    const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    receipt.next.files.reverse();
    fs.writeFileSync(receiptPath, JSON.stringify(receipt), "utf8");
    assert.throws(
      () =>
        rollbackLocalReleaseDeliveryTransaction({
          deliveryDirectory,
          receiptPath
        }),
      /snapshot/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
