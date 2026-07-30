"use strict";

const { restoreDownloadTask } = require("./download-task.cjs");

const EXPIRABLE_PHASES = new Set(["paused", "failed"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function timestampMs(value) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : null;
}

function normalizeNow(now) {
  const candidate = typeof now === "function" ? now() : now;
  const parsed =
    candidate instanceof Date
      ? candidate.getTime()
      : typeof candidate === "number"
        ? candidate
        : Date.parse(candidate);
  if (!Number.isFinite(parsed)) {
    throw new TypeError("下载任务恢复时间无效");
  }
  return parsed;
}

function inspectValidatedPartial(value, productId) {
  if (value === null) return { kind: "none" };
  if (
    !isPlainObject(value) ||
    value.kind !== "validated" ||
    value.productId !== productId
  ) {
    return { kind: "unsafe" };
  }
  const updatedAtMs = timestampMs(value.updatedAt);
  if (updatedAtMs === null) return { kind: "unsafe" };
  return { kind: "validated", updatedAtMs };
}

/**
 * Sanitizes persisted managed-download task records and plans stale cleanup.
 *
 * This module deliberately performs no filesystem writes or deletes. Callers
 * may execute `discardPartialProductIds` only through their existing
 * product-scoped partial cleanup routine, which must revalidate the path.
 *
 * `inspectPartial(productId)` must return one of:
 * - null: no partial metadata/file exists;
 * - { kind: "validated", productId, updatedAt }: caller has validated the
 *   product-scoped partial evidence;
 * - anything else: unsafe/unknown evidence, so expiration fails closed.
 */
function planManagedDownloadTaskRecovery({
  records,
  isSupported,
  inspectPartial = () => null,
  now = Date.now,
  staleAfterMs
}) {
  if (
    typeof isSupported !== "function" ||
    typeof inspectPartial !== "function" ||
    !Number.isSafeInteger(staleAfterMs) ||
    staleAfterMs < 1
  ) {
    throw new TypeError("下载任务恢复参数无效");
  }

  const nowMs = normalizeNow(now);
  const source = isPlainObject(records) ? records : {};
  const sanitizedRecords = {};
  const expiredProductIds = [];
  const discardPartialProductIds = [];
  const rejectedProductIds = [];
  let changed = source !== records;

  for (const [productId, value] of Object.entries(source)) {
    let supported = false;
    try {
      supported = isSupported(productId) === true;
    } catch {
      supported = false;
    }
    const task = supported ? restoreDownloadTask(value) : null;
    if (!task || task.productId !== productId) {
      rejectedProductIds.push(productId);
      changed = true;
      continue;
    }

    if (!EXPIRABLE_PHASES.has(task.phase)) {
      sanitizedRecords[productId] = task;
      continue;
    }

    const taskUpdatedAtMs = timestampMs(task.updatedAt);
    if (
      taskUpdatedAtMs === null ||
      nowMs < taskUpdatedAtMs ||
      nowMs - taskUpdatedAtMs < staleAfterMs
    ) {
      sanitizedRecords[productId] = task;
      continue;
    }

    let partial;
    try {
      partial = inspectValidatedPartial(inspectPartial(productId), productId);
    } catch {
      partial = { kind: "unsafe" };
    }
    if (partial.kind === "unsafe") {
      sanitizedRecords[productId] = task;
      continue;
    }
    if (
      partial.kind === "validated" &&
      (nowMs < partial.updatedAtMs ||
        nowMs - partial.updatedAtMs < staleAfterMs)
    ) {
      sanitizedRecords[productId] = task;
      continue;
    }

    expiredProductIds.push(productId);
    if (partial.kind === "validated") {
      discardPartialProductIds.push(productId);
    }
    changed = true;
  }

  return {
    records: sanitizedRecords,
    changed,
    rejectedProductIds,
    expiredProductIds,
    discardPartialProductIds
  };
}

module.exports = {
  planManagedDownloadTaskRecovery
};
