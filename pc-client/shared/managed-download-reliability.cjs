"use strict";

const INTENT_PRIORITY = Object.freeze({
  download: 0,
  pause: 1,
  cancel: 2
});

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parsePlainObjectJson(text) {
  try {
    const value = JSON.parse(text);
    return isPlainObject(value) ? value : {};
  } catch {
    return {};
  }
}

function raiseDownloadIntent(current, requested) {
  if (
    !Object.prototype.hasOwnProperty.call(INTENT_PRIORITY, current) ||
    !Object.prototype.hasOwnProperty.call(INTENT_PRIORITY, requested)
  ) {
    throw new TypeError("Unknown managed download intent");
  }
  return INTENT_PRIORITY[requested] > INTENT_PRIORITY[current]
    ? requested
    : current;
}

function isCurrentDownloadAttempt(entry, attemptId) {
  return Boolean(entry && entry.attemptId === attemptId);
}

function createDownloadAbortError(message = "Managed download was interrupted") {
  const error = new Error(message);
  error.name = "AbortError";
  error.code = "DOWNLOAD_ATTEMPT_INTERRUPTED";
  return error;
}

function assertDownloadCanFinalize({
  receivedBytes,
  totalBytes,
  isCurrentAttempt
}) {
  if (
    !Number.isSafeInteger(receivedBytes) ||
    receivedBytes < 0 ||
    !Number.isSafeInteger(totalBytes) ||
    totalBytes < 0
  ) {
    const error = new Error("Invalid managed download byte counts");
    error.code = "DOWNLOAD_SIZE_INVALID";
    throw error;
  }
  if (totalBytes > 0 && receivedBytes !== totalBytes) {
    const error = new Error(
      `Managed download ended at ${receivedBytes} of ${totalBytes} bytes`
    );
    error.code = "DOWNLOAD_INCOMPLETE";
    throw error;
  }
  if (typeof isCurrentAttempt === "function" && !isCurrentAttempt()) {
    throw createDownloadAbortError("Managed download attempt was superseded");
  }
}

function isReusablePartialEvidence(partial) {
  return Boolean(
    partial?.partialExists &&
      Number.isSafeInteger(partial.receivedBytes) &&
      partial.receivedBytes > 0
  );
}

function classifyPartialForStart(partial) {
  if (!isReusablePartialEvidence(partial)) return "restart";
  if (
    !Number.isSafeInteger(partial.totalBytes) ||
    partial.totalBytes <= 0
  ) {
    return "restart";
  }
  if (partial.receivedBytes === partial.totalBytes) return "promote";
  return partial.receivedBytes < partial.totalBytes
    ? "resume"
    : "restart";
}

function selectCleanupFailurePartial(remainingPartial, validatedPartial) {
  return remainingPartial || validatedPartial || null;
}

function removeRecordMetadata(records, productId) {
  if (!isPlainObject(records) || typeof productId !== "string" || !productId) {
    throw new TypeError("Invalid managed download receipt metadata");
  }
  const nextRecords = { ...records };
  const removed = Object.prototype.hasOwnProperty.call(nextRecords, productId);
  delete nextRecords[productId];
  return { nextRecords, removed };
}

module.exports = {
  assertDownloadCanFinalize,
  classifyPartialForStart,
  createDownloadAbortError,
  isCurrentDownloadAttempt,
  isPlainObject,
  isReusablePartialEvidence,
  parsePlainObjectJson,
  raiseDownloadIntent,
  removeRecordMetadata,
  selectCleanupFailurePartial
};
