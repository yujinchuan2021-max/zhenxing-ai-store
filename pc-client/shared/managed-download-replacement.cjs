"use strict";

const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");

const CLEANUP_QUEUE_RECORD_KEY = "__managedDownloadSupersededPackagesV1";
const CLEANUP_RECEIPT_SCHEMA_VERSION = 1;
const MAX_SUPERSEDED_PACKAGE_RECEIPTS = 16;
const CLEANUP_RECEIPT_KEYS = Object.freeze([
  "createdAt",
  "downloadRoot",
  "expectedFileName",
  "filePath",
  "fileSize",
  "productId",
  "schemaVersion",
  "sha256"
]);

function recordsMatch(left, right) {
  if (left === null || left === undefined) {
    return right === null || right === undefined;
  }
  if (right === null || right === undefined) return false;
  return (
    left.productId === right.productId &&
    left.filePath === right.filePath &&
    left.sha256 === right.sha256 &&
    left.fileSize === right.fileSize &&
    left.downloadRoot === right.downloadRoot
  );
}

function hasExpectedManagedDownloadName(targetPath, expectedFileName) {
  const expected = path.win32.parse(expectedFileName);
  const actual = path.win32.parse(path.win32.basename(targetPath));
  const suffix = actual.name.slice(expected.name.length);
  return (
    actual.ext.toLowerCase() === expected.ext.toLowerCase() &&
    (actual.name === expected.name ||
      (actual.name.startsWith(expected.name) && /^ \(\d+\)$/.test(suffix)))
  );
}

function assertPlainRecords(records) {
  if (!records || typeof records !== "object" || Array.isArray(records)) {
    throw new TypeError("Managed download records are invalid");
  }
}

function assertExpectedFileName(expectedFileName) {
  if (
    typeof expectedFileName !== "string" ||
    !expectedFileName ||
    expectedFileName.length > 260 ||
    path.win32.basename(expectedFileName) !== expectedFileName ||
    expectedFileName === "." ||
    expectedFileName === ".."
  ) {
    throw new TypeError("Managed download cleanup file name is invalid");
  }
}

function normalizeReceiptPath(value, fieldName) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 32_767 ||
    !path.win32.isAbsolute(value)
  ) {
    throw new TypeError(`Managed download cleanup ${fieldName} is invalid`);
  }
  return path.win32.resolve(value);
}

function validateSupersededPackageReceipt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Managed download cleanup receipt is invalid");
  }
  const keys = Object.keys(value).sort();
  if (!isDeepStrictEqual(keys, CLEANUP_RECEIPT_KEYS)) {
    throw new TypeError("Managed download cleanup receipt fields are invalid");
  }
  if (value.schemaVersion !== CLEANUP_RECEIPT_SCHEMA_VERSION) {
    throw new TypeError("Managed download cleanup receipt version is invalid");
  }
  if (
    typeof value.productId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,127}$/.test(value.productId)
  ) {
    throw new TypeError("Managed download cleanup product is invalid");
  }
  assertExpectedFileName(value.expectedFileName);
  const filePath = normalizeReceiptPath(value.filePath, "path");
  const downloadRoot = normalizeReceiptPath(value.downloadRoot, "root");
  const relative = path.win32.relative(downloadRoot, filePath);
  if (
    path.win32.dirname(filePath).toLowerCase() !== downloadRoot.toLowerCase() ||
    path.win32.isAbsolute(relative) ||
    relative.startsWith("..") ||
    !relative ||
    !hasExpectedManagedDownloadName(filePath, value.expectedFileName)
  ) {
    throw new TypeError("Managed download cleanup path escaped its exact root");
  }
  if (
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(value.sha256)
  ) {
    throw new TypeError("Managed download cleanup hash is invalid");
  }
  if (!Number.isSafeInteger(value.fileSize) || value.fileSize <= 0) {
    throw new TypeError("Managed download cleanup size is invalid");
  }
  if (
    typeof value.createdAt !== "string" ||
    !value.createdAt ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    new Date(value.createdAt).toISOString() !== value.createdAt
  ) {
    throw new TypeError("Managed download cleanup timestamp is invalid");
  }
  return Object.freeze({
    schemaVersion: CLEANUP_RECEIPT_SCHEMA_VERSION,
    productId: value.productId,
    filePath,
    downloadRoot,
    sha256: value.sha256.toLowerCase(),
    fileSize: value.fileSize,
    expectedFileName: value.expectedFileName,
    createdAt: value.createdAt
  });
}

function readSupersededPackageReceipts(records) {
  assertPlainRecords(records);
  const value = records[CLEANUP_QUEUE_RECORD_KEY];
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > MAX_SUPERSEDED_PACKAGE_RECEIPTS
  ) {
    throw new TypeError("Managed download cleanup queue is invalid or over limit");
  }
  const receipts = value.map(validateSupersededPackageReceipt);
  const identities = new Set();
  for (const receipt of receipts) {
    const identity = cleanupReceiptIdentity(receipt);
    if (identities.has(identity)) {
      throw new TypeError("Managed download cleanup queue contains duplicates");
    }
    identities.add(identity);
  }
  return receipts;
}

function cleanupReceiptIdentity(receipt) {
  return `${receipt.productId}\0${receipt.filePath.toLowerCase()}\0${receipt.sha256}`;
}

function createSupersededPackageReceipt(
  previousRecord,
  expectedFileName,
  createdAt = new Date().toISOString()
) {
  if (!previousRecord || typeof previousRecord !== "object") {
    throw new TypeError("Trusted replacement record is invalid");
  }
  return validateSupersededPackageReceipt({
    schemaVersion: CLEANUP_RECEIPT_SCHEMA_VERSION,
    productId: previousRecord.productId,
    filePath: previousRecord.filePath,
    downloadRoot: previousRecord.downloadRoot,
    sha256: previousRecord.sha256,
    fileSize: previousRecord.fileSize,
    expectedFileName,
    createdAt
  });
}

function recordsWithSupersededPackageReceipts(records, receipts) {
  const nextRecords = { ...records };
  if (receipts.length > 0) {
    nextRecords[CLEANUP_QUEUE_RECORD_KEY] = receipts;
  } else {
    delete nextRecords[CLEANUP_QUEUE_RECORD_KEY];
  }
  return nextRecords;
}

function queueSupersededPackageReceipt(receipts, receipt) {
  const identity = cleanupReceiptIdentity(receipt);
  if (receipts.some((candidate) => cleanupReceiptIdentity(candidate) === identity)) {
    return receipts;
  }
  if (receipts.length >= MAX_SUPERSEDED_PACKAGE_RECEIPTS) {
    throw new Error(
      "Managed download cleanup queue is full; retry cleanup before refreshing again"
    );
  }
  return [...receipts, receipt];
}

function managedDownloadCleanupCapacity(records) {
  const receipts = readSupersededPackageReceipts(records);
  return Object.freeze({
    pendingCount: receipts.length,
    maximum: MAX_SUPERSEDED_PACKAGE_RECEIPTS,
    canQueue: receipts.length < MAX_SUPERSEDED_PACKAGE_RECEIPTS
  });
}

function cancelSupersededPackageCleanupForProduct(records, productId) {
  assertPlainRecords(records);
  if (
    typeof productId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,127}$/.test(productId)
  ) {
    throw new TypeError("Managed download cleanup product is invalid");
  }

  const receipts = readSupersededPackageReceipts(records);
  const retained = receipts.filter((receipt) => receipt.productId !== productId);
  return {
    records: recordsWithSupersededPackageReceipts(records, retained),
    canceledCount: receipts.length - retained.length
  };
}

async function retrySupersededPackageCleanup({
  currentRecords,
  productId = null,
  expectedFileNameForProduct,
  cleanupReceipt,
  writeRecords
}) {
  assertPlainRecords(currentRecords);
  if (
    productId !== null &&
    (typeof productId !== "string" || !productId)
  ) {
    throw new TypeError("Managed download cleanup product filter is invalid");
  }
  if (
    typeof expectedFileNameForProduct !== "function" ||
    typeof cleanupReceipt !== "function" ||
    typeof writeRecords !== "function"
  ) {
    throw new TypeError("Managed download cleanup adapter is invalid");
  }

  const receipts = readSupersededPackageReceipts(currentRecords);
  const retained = [];
  const results = [];
  let cleanedCount = 0;
  let canceledCount = 0;

  for (const receipt of receipts) {
    if (productId && receipt.productId !== productId) {
      retained.push(receipt);
      continue;
    }
    const currentRecord = currentRecords[receipt.productId] || null;
    if (!currentRecord) {
      canceledCount += 1;
      results.push({
        receipt,
        ok: true,
        canceled: true,
        reason: "current-record-missing"
      });
      continue;
    }
    let expectedFileName = null;
    try {
      expectedFileName = expectedFileNameForProduct(receipt.productId);
    } catch {
      expectedFileName = null;
    }
    if (
      typeof expectedFileName !== "string" ||
      expectedFileName !== receipt.expectedFileName
    ) {
      retained.push(receipt);
      results.push({
        receipt,
        ok: false,
        error: "Cleanup receipt is not approved by the current local product plan"
      });
      continue;
    }

    let result;
    try {
      result = await cleanupReceipt(receipt, currentRecord);
    } catch (error) {
      result = {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Superseded package cleanup failed"
      };
    }
    if (result && result.ok === true) {
      if (result.canceled === true) canceledCount += 1;
      else cleanedCount += 1;
      results.push({ receipt, ...result, ok: true });
    } else {
      retained.push(receipt);
      results.push({
        receipt,
        ok: false,
        error:
          result && typeof result.error === "string" && result.error
            ? result.error
            : "Superseded package cleanup returned no success result"
      });
    }
  }

  const resolvedCount = cleanedCount + canceledCount;
  if (resolvedCount === 0) {
    const failedCount = results.filter((result) => !result.ok).length;
    return {
      records: currentRecords,
      cleanup: {
        ok: failedCount === 0,
        attemptedCount: results.length,
        cleanedCount: 0,
        canceledCount: 0,
        pendingCount: receipts.length,
        results
      }
    };
  }

  const nextRecords = recordsWithSupersededPackageReceipts(
    currentRecords,
    retained
  );
  try {
    writeRecords(nextRecords);
    const failedCount = results.filter((result) => !result.ok).length;
    return {
      records: nextRecords,
      cleanup: {
        ok: failedCount === 0,
        attemptedCount: results.length,
        cleanedCount,
        canceledCount,
        pendingCount: retained.length,
        results
      }
    };
  } catch (error) {
    return {
      records: currentRecords,
      cleanup: {
        ok: false,
        attemptedCount: results.length,
        cleanedCount,
        canceledCount,
        pendingCount: receipts.length,
        results,
        error:
          error instanceof Error
            ? `Cleanup receipt persistence failed: ${error.message}`
            : "Cleanup receipt persistence failed"
      }
    };
  }
}

async function commitManagedDownloadReplacement({
  productId,
  currentRecords,
  expectedPreviousRecord = null,
  trustedPreviousRecord = null,
  nextRecord,
  expectedFileName,
  writeRecords,
  cleanupPrevious,
  now = () => new Date().toISOString()
}) {
  if (
    typeof productId !== "string" ||
    !productId ||
    !nextRecord ||
    nextRecord.productId !== productId ||
    typeof writeRecords !== "function" ||
    typeof cleanupPrevious !== "function" ||
    typeof now !== "function"
  ) {
    throw new TypeError("Managed download replacement input is invalid");
  }
  assertExpectedFileName(expectedFileName);
  assertPlainRecords(currentRecords);

  const currentRecord = currentRecords[productId] || null;
  if (!isDeepStrictEqual(currentRecord, expectedPreviousRecord)) {
    throw new Error("Managed download record changed during download");
  }
  if (
    trustedPreviousRecord &&
    (!recordsMatch(trustedPreviousRecord, expectedPreviousRecord) ||
      trustedPreviousRecord.productId !== productId)
  ) {
    throw new Error("Trusted replacement record does not match the commit baseline");
  }

  let receipts = readSupersededPackageReceipts(currentRecords);
  if (
    trustedPreviousRecord &&
    path.win32.resolve(trustedPreviousRecord.filePath).toLowerCase() !==
      path.win32.resolve(nextRecord.filePath).toLowerCase()
  ) {
    receipts = queueSupersededPackageReceipt(
      receipts,
      createSupersededPackageReceipt(
        trustedPreviousRecord,
        expectedFileName,
        now()
      )
    );
  }

  const committedRecords = recordsWithSupersededPackageReceipts(
    { ...currentRecords, [productId]: nextRecord },
    receipts
  );
  writeRecords(committedRecords);

  const retried = await retrySupersededPackageCleanup({
    currentRecords: committedRecords,
    productId,
    expectedFileNameForProduct: (candidateProductId) =>
      candidateProductId === productId ? expectedFileName : null,
    cleanupReceipt: cleanupPrevious,
    writeRecords
  });

  return { record: retried.records[productId], cleanup: retried.cleanup };
}

module.exports = {
  CLEANUP_QUEUE_RECORD_KEY,
  MAX_SUPERSEDED_PACKAGE_RECEIPTS,
  cancelSupersededPackageCleanupForProduct,
  commitManagedDownloadReplacement,
  createSupersededPackageReceipt,
  managedDownloadCleanupCapacity,
  readSupersededPackageReceipts,
  recordsMatch,
  retrySupersededPackageCleanup,
  validateSupersededPackageReceipt
};
