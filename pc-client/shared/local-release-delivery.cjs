"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  sha256File,
  validateArtifactBuildMetadata
} = require("./release-provenance.cjs");

const RELEASE_VERSION = /^(?:0|[1-9]\d*)\.\d+\.\d+$/;
const TRANSACTION_ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const CANDIDATE_NAME =
  /^release-local-server-client-candidate-[A-Za-z0-9._-]{1,96}$/;

function localReleaseDeliveryNames(version) {
  if (!RELEASE_VERSION.test(version || "")) {
    throw new TypeError("Local release delivery version is invalid");
  }
  const prefix = `ZhenXing-AI-Local-${version}`;
  return Object.freeze({
    artifacts: Object.freeze([
      `${prefix}-Windows-x64-Portable.exe`,
      `${prefix}-Windows-x64-Setup.exe`,
      `${prefix}-Windows-x64-Setup.exe.blockmap`
    ]),
    buildMetadata: `${prefix}-BUILD.json`,
    checksums: `${prefix}-SHA256.txt`
  });
}

function sameNames(actual, expected) {
  if (actual.length !== expected.length) return false;
  const normalizedActual = [...actual].sort();
  const normalizedExpected = [...expected].sort();
  return normalizedActual.every(
    (name, index) => name === normalizedExpected[index]
  );
}

function trustedDeliveryDirectory(directory) {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) {
    throw new TypeError("Local release delivery directory is invalid");
  }
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Local release delivery is not a trusted directory");
  }
  return path.resolve(directory);
}

function readChecksums(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  const lines = contents.endsWith("\n")
    ? contents.slice(0, -1).split(/\r?\n/)
    : [];
  if (lines.length < 1 || lines.some((line) => !line)) {
    throw new Error("Local release delivery checksum manifest is invalid");
  }
  const entries = lines.map((line) => {
    const match = /^([a-f0-9]{64})  ([^\\/\r\n]+)$/i.exec(line);
    if (!match) {
      throw new Error("Local release delivery checksum manifest is invalid");
    }
    return { name: match[2], sha256: match[1].toLowerCase() };
  });
  if (
    new Set(entries.map((entry) => entry.name.toLowerCase())).size !==
    entries.length
  ) {
    throw new Error("Local release delivery checksum manifest has duplicates");
  }
  return entries;
}

function verifyPreparedLocalReleaseDelivery({ directory, version }) {
  const resolved = trustedDeliveryDirectory(directory);
  const names = localReleaseDeliveryNames(version);
  const expectedFiles = [
    ...names.artifacts,
    names.buildMetadata,
    names.checksums
  ];
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  if (
    entries.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
    !sameNames(
      entries.map((entry) => entry.name),
      expectedFiles
    )
  ) {
    throw new Error(
      "Local release delivery has unexpected or missing files, including the Setup blockmap"
    );
  }

  const metadata = validateArtifactBuildMetadata(
    JSON.parse(
      fs.readFileSync(path.join(resolved, names.buildMetadata), "utf8")
    )
  );
  if (
    metadata.version !== version ||
    !sameNames(
      metadata.artifacts.map((entry) => entry.name),
      names.artifacts
    )
  ) {
    throw new Error(
      "Local release delivery build manifest is incomplete"
    );
  }
  for (const artifact of metadata.artifacts) {
    const artifactPath = path.join(resolved, artifact.name);
    const stat = fs.lstatSync(artifactPath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size !== artifact.fileSize ||
      sha256File(artifactPath) !== artifact.sha256
    ) {
      throw new Error(
        `Local release delivery artifact does not match its build manifest: ${artifact.name}`
      );
    }
  }

  const checksummedFiles = [...names.artifacts, names.buildMetadata];
  const checksums = readChecksums(path.join(resolved, names.checksums));
  if (!sameNames(checksums.map((entry) => entry.name), checksummedFiles)) {
    throw new Error("Local release delivery checksum manifest is incomplete");
  }
  for (const checksum of checksums) {
    if (sha256File(path.join(resolved, checksum.name)) !== checksum.sha256) {
      throw new Error(
        `Local release delivery checksum does not match: ${checksum.name}`
      );
    }
  }

  return Object.freeze({
    version,
    files: Object.freeze([...expectedFiles].sort()),
    checksummedFiles: Object.freeze([...checksummedFiles].sort()),
    source: metadata.source
  });
}

function assertSiblingDirectories(candidateDirectory, deliveryDirectory) {
  const candidate = path.resolve(candidateDirectory);
  const delivery = path.resolve(deliveryDirectory);
  if (
    candidate === delivery ||
    path.dirname(candidate) !== path.dirname(delivery)
  ) {
    throw new Error(
      "Prepared local release delivery must be a sibling of the live delivery"
    );
  }
  return { candidate, delivery, parent: path.dirname(delivery) };
}

function activatePreparedLocalReleaseDelivery({
  candidateDirectory,
  deliveryDirectory,
  version
}) {
  const paths = assertSiblingDirectories(
    candidateDirectory,
    deliveryDirectory
  );
  const verification = verifyPreparedLocalReleaseDelivery({
    directory: paths.candidate,
    version
  });
  let retiredDirectory = null;
  let replacedFiles = [];
  if (fs.existsSync(paths.delivery)) {
    trustedDeliveryDirectory(paths.delivery);
    replacedFiles = fs.readdirSync(paths.delivery).sort();
    retiredDirectory = path.join(
      paths.parent,
      `.release-local-server-client-retired-${crypto.randomUUID()}`
    );
    fs.renameSync(paths.delivery, retiredDirectory);
  }

  try {
    fs.renameSync(paths.candidate, paths.delivery);
  } catch (activationError) {
    if (retiredDirectory) {
      try {
        fs.renameSync(retiredDirectory, paths.delivery);
      } catch (restoreError) {
        const failure = new AggregateError(
          [activationError, restoreError],
          "Local release delivery activation failed and the previous delivery could not be restored"
        );
        failure.deliveryRecoveryPending = true;
        throw failure;
      }
    }
    throw activationError;
  }

  let cleanupPending = false;
  let cleanupErrorCode = null;
  if (retiredDirectory) {
    try {
      fs.rmSync(retiredDirectory, { recursive: true, force: true });
      retiredDirectory = null;
    } catch (error) {
      cleanupPending = true;
      cleanupErrorCode =
        typeof error?.code === "string" && error.code
          ? error.code
          : "UNKNOWN";
    }
  }
  return {
    activated: true,
    deliveryDirectory: paths.delivery,
    replacedFiles,
    retiredDirectory,
    cleanupPending,
    cleanupErrorCode,
    ...verification
  };
}

function exactKeys(value, names) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === names.length &&
    Object.keys(value).every((name) => names.includes(name))
  );
}

function snapshotDirectory(directory) {
  const resolved = trustedDeliveryDirectory(directory);
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  if (
    entries.length < 1 ||
    entries.length > 16 ||
    entries.some(
      (entry) =>
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !entry.name ||
        /[\\/]/.test(entry.name)
    )
  ) {
    throw new Error("Local release delivery snapshot is not a trusted file set");
  }
  return Object.freeze({
    files: Object.freeze(
      entries
        .map((entry) => {
          const filePath = path.join(resolved, entry.name);
          const stat = fs.lstatSync(filePath);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) {
            throw new Error(
              "Local release delivery snapshot contains an invalid file"
            );
          }
          return Object.freeze({
            name: entry.name,
            fileSize: stat.size,
            sha256: sha256File(filePath)
          });
        })
        .sort((left, right) => left.name.localeCompare(right.name))
    )
  });
}

function validateDirectorySnapshot(value) {
  if (
    !exactKeys(value, ["files"]) ||
    !Array.isArray(value.files) ||
    value.files.length < 1 ||
    value.files.length > 16
  ) {
    throw new Error("Local release delivery transaction snapshot is invalid");
  }
  const files = value.files.map((entry) => {
    if (
      !exactKeys(entry, ["name", "fileSize", "sha256"]) ||
      typeof entry.name !== "string" ||
      !entry.name ||
      /[\\/]/.test(entry.name) ||
      !Number.isSafeInteger(entry.fileSize) ||
      entry.fileSize < 1 ||
      !/^[a-f0-9]{64}$/.test(entry.sha256 || "")
    ) {
      throw new Error(
        "Local release delivery transaction snapshot file is invalid"
      );
    }
    return Object.freeze({ ...entry });
  });
  const names = files.map((entry) => entry.name);
  const sortedNames = [...names].sort((left, right) =>
    left.localeCompare(right)
  );
  if (
    new Set(names.map((name) => name.toLowerCase())).size !== names.length ||
    names.some((name, index) => name !== sortedNames[index])
  ) {
    throw new Error(
      "Local release delivery transaction snapshot has duplicate files"
    );
  }
  return Object.freeze({ files: Object.freeze(files) });
}

function sameSnapshot(left, right) {
  if (!left || !right || left.files.length !== right.files.length) return false;
  return left.files.every((entry, index) => {
    const expected = right.files[index];
    return (
      entry.name === expected.name &&
      entry.fileSize === expected.fileSize &&
      entry.sha256 === expected.sha256
    );
  });
}

function existingSnapshot(directory) {
  return fs.existsSync(directory) ? snapshotDirectory(directory) : null;
}

function assertSnapshot(directory, expected, label) {
  const actual = existingSnapshot(directory);
  if (!actual || !sameSnapshot(actual, expected)) {
    throw new Error(`Local release delivery ${label} does not match its transaction receipt`);
  }
  return actual;
}

function trustedReceiptPath(receiptPath, { mustExist }) {
  if (typeof receiptPath !== "string" || !path.isAbsolute(receiptPath)) {
    throw new TypeError("Local release delivery transaction receipt path is invalid");
  }
  const resolved = path.resolve(receiptPath);
  const parent = path.dirname(resolved);
  trustedDeliveryDirectory(parent);
  if (mustExist) {
    const stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(
        "Local release delivery transaction receipt is not a trusted file"
      );
    }
  } else if (fs.existsSync(resolved)) {
    throw new Error("Local release delivery transaction receipt already exists");
  }
  return resolved;
}

function writeReceiptAtomic(receiptPath, receipt) {
  const resolved = trustedReceiptPath(receiptPath, { mustExist: false });
  const temporary = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${crypto.randomUUID()}.tmp`
  );
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });
    fs.renameSync(temporary, resolved);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function validateReceipt(value, deliveryDirectory) {
  if (
    !exactKeys(value, [
      "schemaVersion",
      "transactionId",
      "version",
      "deliveryName",
      "candidateName",
      "retiredName",
      "previous",
      "next"
    ]) ||
    value.schemaVersion !== 1 ||
    !TRANSACTION_ID.test(value.transactionId || "") ||
    !RELEASE_VERSION.test(value.version || "") ||
    value.deliveryName !== path.basename(deliveryDirectory) ||
    value.deliveryName !== "release-local-server-client" ||
    !CANDIDATE_NAME.test(value.candidateName || "")
  ) {
    throw new Error("Local release delivery transaction receipt is invalid");
  }
  const expectedRetiredName = `.release-local-server-client-retired-${value.transactionId}`;
  if (
    (value.previous === null && value.retiredName !== null) ||
    (value.previous !== null && value.retiredName !== expectedRetiredName)
  ) {
    throw new Error("Local release delivery transaction receipt is inconsistent");
  }
  return Object.freeze({
    ...value,
    previous:
      value.previous === null ? null : validateDirectorySnapshot(value.previous),
    next: validateDirectorySnapshot(value.next)
  });
}

function readTransaction({ receiptPath, deliveryDirectory }) {
  const delivery = path.resolve(deliveryDirectory);
  if (path.basename(delivery) !== "release-local-server-client") {
    throw new Error("Local release delivery transaction target is invalid");
  }
  const resolvedReceipt = trustedReceiptPath(receiptPath, { mustExist: true });
  const receipt = validateReceipt(
    JSON.parse(fs.readFileSync(resolvedReceipt, "utf8")),
    delivery
  );
  const parent = path.dirname(delivery);
  const candidate = path.join(parent, receipt.candidateName);
  const retired = receipt.retiredName
    ? path.join(parent, receipt.retiredName)
    : null;
  assertSiblingDirectories(candidate, delivery);
  if (retired) assertSiblingDirectories(retired, delivery);
  return { receipt, delivery, candidate, retired };
}

function prepareLocalReleaseDeliveryTransaction({
  candidateDirectory,
  deliveryDirectory,
  receiptPath,
  version
}) {
  const paths = assertSiblingDirectories(
    candidateDirectory,
    deliveryDirectory
  );
  if (
    path.basename(paths.delivery) !== "release-local-server-client" ||
    !CANDIDATE_NAME.test(path.basename(paths.candidate))
  ) {
    throw new Error("Local release delivery transaction paths are invalid");
  }
  verifyPreparedLocalReleaseDelivery({
    directory: paths.candidate,
    version
  });
  const previous = fs.existsSync(paths.delivery)
    ? snapshotDirectory(paths.delivery)
    : null;
  const transactionId = crypto.randomUUID();
  const retiredName = previous
    ? `.release-local-server-client-retired-${transactionId}`
    : null;
  const retiredDirectory = retiredName
    ? path.join(paths.parent, retiredName)
    : null;
  if (retiredDirectory && fs.existsSync(retiredDirectory)) {
    throw new Error("Local release delivery retired transaction target exists");
  }
  const receipt = {
    schemaVersion: 1,
    transactionId,
    version,
    deliveryName: path.basename(paths.delivery),
    candidateName: path.basename(paths.candidate),
    retiredName,
    previous,
    next: snapshotDirectory(paths.candidate)
  };
  writeReceiptAtomic(receiptPath, receipt);
  return {
    transactionPending: true,
    receiptPath: path.resolve(receiptPath),
    deliveryDirectory: paths.delivery,
    candidateDirectory: paths.candidate,
    retiredDirectory
  };
}

function activatePreparedLocalReleaseDeliveryTransaction({
  candidateDirectory,
  deliveryDirectory,
  receiptPath
}) {
  const transaction = readTransaction({ receiptPath, deliveryDirectory });
  if (path.resolve(candidateDirectory) !== transaction.candidate) {
    throw new Error("Local release delivery candidate differs from its receipt");
  }
  const current = existingSnapshot(transaction.delivery);
  const candidate = existingSnapshot(transaction.candidate);
  const retired = transaction.retired
    ? existingSnapshot(transaction.retired)
    : null;

  if (
    current &&
    sameSnapshot(current, transaction.receipt.next) &&
    !candidate &&
    (!transaction.receipt.previous ||
      (retired && sameSnapshot(retired, transaction.receipt.previous)))
  ) {
    return {
      activated: true,
      transactionPending: true,
      deliveryDirectory: transaction.delivery,
      candidateDirectory: transaction.candidate,
      retiredDirectory: transaction.retired,
      cleanupPending: false,
      cleanupErrorCode: null
    };
  }
  if (!candidate || !sameSnapshot(candidate, transaction.receipt.next)) {
    throw new Error("Local release delivery candidate does not match its receipt");
  }

  if (transaction.receipt.previous) {
    if (
      current &&
      sameSnapshot(current, transaction.receipt.previous) &&
      !retired
    ) {
      fs.renameSync(transaction.delivery, transaction.retired);
    } else if (
      !current &&
      retired &&
      sameSnapshot(retired, transaction.receipt.previous)
    ) {
      // Recovery after a crash between the two directory renames.
    } else {
      throw new Error("Local release delivery activation state is inconsistent");
    }
  } else if (current || retired) {
    throw new Error("First local release delivery activation state is inconsistent");
  }

  try {
    fs.renameSync(transaction.candidate, transaction.delivery);
    assertSnapshot(
      transaction.delivery,
      transaction.receipt.next,
      "activated directory"
    );
  } catch (activationError) {
    if (
      transaction.receipt.previous &&
      !fs.existsSync(transaction.delivery) &&
      fs.existsSync(transaction.retired)
    ) {
      try {
        fs.renameSync(transaction.retired, transaction.delivery);
        assertSnapshot(
          transaction.delivery,
          transaction.receipt.previous,
          "restored previous directory"
        );
      } catch (restoreError) {
        const failure = new AggregateError(
          [activationError, restoreError],
          "Local release delivery activation failed and exact restoration is pending"
        );
        failure.deliveryRecoveryPending = true;
        throw failure;
      }
    }
    throw activationError;
  }

  return {
    activated: true,
    transactionPending: true,
    deliveryDirectory: transaction.delivery,
    candidateDirectory: transaction.candidate,
    retiredDirectory: transaction.retired,
    cleanupPending: false,
    cleanupErrorCode: null
  };
}

function cleanupDirectoryBestEffort(directory) {
  if (!directory || !fs.existsSync(directory)) {
    return { cleanupPending: false, cleanupErrorCode: null };
  }
  try {
    trustedDeliveryDirectory(directory);
    fs.rmSync(directory, { recursive: true, force: true });
    return { cleanupPending: false, cleanupErrorCode: null };
  } catch (error) {
    return {
      cleanupPending: true,
      cleanupErrorCode:
        typeof error?.code === "string" && error.code
          ? error.code
          : "UNKNOWN"
    };
  }
}

function finalizeLocalReleaseDeliveryTransaction({
  deliveryDirectory,
  receiptPath
}) {
  const transaction = readTransaction({ receiptPath, deliveryDirectory });
  assertSnapshot(
    transaction.delivery,
    transaction.receipt.next,
    "current directory"
  );
  if (fs.existsSync(transaction.candidate)) {
    throw new Error("Local release delivery candidate remains during finalization");
  }
  if (!transaction.receipt.previous) {
    return {
      finalized: true,
      previousDelivery: "none",
      cleanupPending: false,
      cleanupErrorCode: null
    };
  }
  assertSnapshot(
    transaction.retired,
    transaction.receipt.previous,
    "retired previous directory"
  );
  const cleanup = cleanupDirectoryBestEffort(transaction.retired);
  return {
    finalized: true,
    previousDelivery: "retired",
    ...cleanup
  };
}

function rollbackLocalReleaseDeliveryTransaction({
  deliveryDirectory,
  receiptPath
}) {
  const transaction = readTransaction({ receiptPath, deliveryDirectory });
  let current = existingSnapshot(transaction.delivery);
  let candidate = existingSnapshot(transaction.candidate);
  let retired = transaction.retired
    ? existingSnapshot(transaction.retired)
    : null;

  if (transaction.receipt.previous) {
    const currentIsPrevious =
      current && sameSnapshot(current, transaction.receipt.previous);
    const currentIsNext =
      current && sameSnapshot(current, transaction.receipt.next);
    const candidateIsNext =
      candidate && sameSnapshot(candidate, transaction.receipt.next);
    const retiredIsPrevious =
      retired && sameSnapshot(retired, transaction.receipt.previous);

    if (currentIsNext && !candidate && retiredIsPrevious) {
      fs.renameSync(transaction.delivery, transaction.candidate);
      try {
        fs.renameSync(transaction.retired, transaction.delivery);
      } catch (restoreError) {
        try {
          fs.renameSync(transaction.candidate, transaction.delivery);
        } catch (undoError) {
          const failure = new AggregateError(
            [restoreError, undoError],
            "Local release delivery rollback and rejected-delivery restoration both failed"
          );
          failure.deliveryRecoveryPending = true;
          throw failure;
        }
        throw restoreError;
      }
      assertSnapshot(
        transaction.delivery,
        transaction.receipt.previous,
        "rolled back previous directory"
      );
    } else if (!current && candidateIsNext && retiredIsPrevious) {
      fs.renameSync(transaction.retired, transaction.delivery);
      assertSnapshot(
        transaction.delivery,
        transaction.receipt.previous,
        "crash-recovered previous directory"
      );
    } else if (currentIsPrevious && candidateIsNext && !retired) {
      // Activation failed and already restored the previous directory.
    } else if (currentIsPrevious && !candidate && !retired) {
      return {
        rolledBack: true,
        restoredPrevious: true,
        cleanupPending: false,
        cleanupErrorCode: null
      };
    } else {
      throw new Error("Local release delivery rollback state is inconsistent");
    }
  } else {
    const currentIsNext =
      current && sameSnapshot(current, transaction.receipt.next);
    const candidateIsNext =
      candidate && sameSnapshot(candidate, transaction.receipt.next);
    if (currentIsNext && !candidate) {
      fs.renameSync(transaction.delivery, transaction.candidate);
    } else if (!current && candidateIsNext) {
      // The first activation failed before the candidate was published.
    } else if (!current && !candidate) {
      return {
        rolledBack: true,
        restoredPrevious: false,
        cleanupPending: false,
        cleanupErrorCode: null
      };
    } else {
      throw new Error("First local release delivery rollback state is inconsistent");
    }
  }

  const cleanup = cleanupDirectoryBestEffort(transaction.candidate);
  return {
    rolledBack: true,
    restoredPrevious: Boolean(transaction.receipt.previous),
    ...cleanup
  };
}

module.exports = {
  activatePreparedLocalReleaseDelivery,
  activatePreparedLocalReleaseDeliveryTransaction,
  finalizeLocalReleaseDeliveryTransaction,
  localReleaseDeliveryNames,
  prepareLocalReleaseDeliveryTransaction,
  rollbackLocalReleaseDeliveryTransaction,
  verifyPreparedLocalReleaseDelivery
};
