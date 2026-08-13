"use strict";

function normalizeCliTaskNotification(payload, allowedProducts) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.keys(payload).length !== 4 ||
    !allowedProducts ||
    !Object.hasOwn(allowedProducts, payload.productId) ||
    !Number.isSafeInteger(payload.generation) ||
    payload.generation < 1 ||
    !["install", "update", "repair", "uninstall"].includes(payload.operation) ||
    !["completed", "failed"].includes(payload.outcome)
  ) {
    return null;
  }
  return {
    productId: payload.productId,
    generation: payload.generation,
    operation: payload.operation,
    outcome: payload.outcome
  };
}

function normalizeCliTrayTask(payload, allowedProducts) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.keys(payload).length !== 4 ||
    !allowedProducts ||
    !Object.hasOwn(allowedProducts, payload.productId) ||
    !Number.isSafeInteger(payload.generation) ||
    payload.generation < 1 ||
    !["install", "update", "repair", "uninstall"].includes(payload.operation) ||
    !["running", "completed", "failed", "canceled"].includes(payload.phase)
  ) {
    return null;
  }
  return {
    productId: payload.productId,
    generation: payload.generation,
    operation: payload.operation,
    phase: payload.phase
  };
}

function rememberNotificationKey(records, key, timestamp, limit = 500) {
  if (
    !(records instanceof Map) ||
    typeof key !== "string" ||
    !key ||
    !Number.isFinite(timestamp) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    records.has(key)
  ) {
    return false;
  }
  records.set(key, timestamp);
  while (records.size > limit) {
    records.delete(records.keys().next().value);
  }
  return true;
}

module.exports = {
  normalizeCliTrayTask,
  normalizeCliTaskNotification,
  rememberNotificationKey
};
