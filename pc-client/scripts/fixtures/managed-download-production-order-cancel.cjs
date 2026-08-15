"use strict";

const { withProductionOrderHardTimeout } = require("../lib/managed-download-production-order-lifecycle.cjs");

function exactObject(value, keys) {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}

function classifyCancelResponse(value) {
  if (exactObject(value, ["ok"]) && value.ok === true) return "ok";
  if (
    exactObject(value, ["ok", "errorCode"]) && value.ok === false &&
    typeof value.errorCode === "string" && value.errorCode.length > 0
  ) return "rejected";
  return "malformed";
}

async function runProductionOrderCancelEvidence({
  checkpoint,
  readStatus,
  requestCancel,
  inspectMainCancel,
  inspectClearance,
  timeoutMs,
  now = () => performance.now()
}) {
  if (
    !checkpoint || typeof checkpoint.write !== "function" ||
    [readStatus, requestCancel, inspectMainCancel, inspectClearance].some((value) => typeof value !== "function") ||
    !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || typeof now !== "function"
  ) throw new Error("PRODUCTION_ORDER_CANCEL_INPUT_INVALID");
  const deadline = now() + timeoutMs;
  const remaining = (code) => {
    const value = Math.ceil(deadline - now());
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(code);
    return value;
  };
  const actual = {
    statusEnvelopeClass: "unavailable",
    cancelEnvelopeClass: "not-returned",
    taskAbsent: false,
    partCountClass: "unknown",
    formalCountClass: "unknown",
    responseOk: false
  };

  checkpoint.write("cancel-status", "entered");
  let status;
  try {
    status = await withProductionOrderHardTimeout(
      readStatus,
      remaining("PRODUCTION_ORDER_CANCEL_STATUS_TIMEOUT"),
      "PRODUCTION_ORDER_CANCEL_STATUS_TIMEOUT"
    );
  } catch {
    throw new Error("PRODUCTION_ORDER_CANCEL_STATUS_REJECTED");
  }
  if (
    !exactObject(status, ["envelopeClass", "requestReady"]) ||
    !["ok", "rejected", "malformed"].includes(status.envelopeClass) ||
    typeof status.requestReady !== "boolean"
  ) throw new Error("PRODUCTION_ORDER_CANCEL_STATUS_REJECTED");
  actual.statusEnvelopeClass = status.envelopeClass;
  if (status.envelopeClass !== "ok" || !status.requestReady) {
    throw new Error("PRODUCTION_ORDER_CANCEL_STATUS_REJECTED");
  }
  checkpoint.write("cancel-status", "completed");

  checkpoint.write("cancel-request", "entered");
  const rendererOutcome = Promise.resolve()
    .then(requestCancel)
    .then((value) => ({ settled: true, value }), () => ({ settled: false }));
  let main;
  try {
    for (;;) {
      const candidate = await withProductionOrderHardTimeout(
        inspectMainCancel,
        remaining("PRODUCTION_ORDER_CANCEL_MAIN_TIMEOUT"),
        "PRODUCTION_ORDER_CANCEL_MAIN_TIMEOUT"
      );
      if (
        !exactObject(candidate, ["settled", "resultClass"]) ||
        typeof candidate.settled !== "boolean" ||
        !["none", "ok", "rejected", "malformed"].includes(candidate.resultClass) ||
        (candidate.settled ? candidate.resultClass === "none" : candidate.resultClass !== "none")
      ) throw new Error("PRODUCTION_ORDER_CANCEL_MAIN_OBSERVATION_INVALID");
      if (candidate.settled) {
        main = candidate;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(1, remaining("PRODUCTION_ORDER_CANCEL_MAIN_TIMEOUT"))));
    }
  } catch (error) {
    if (error?.message === "PRODUCTION_ORDER_CANCEL_MAIN_OBSERVATION_INVALID") throw error;
    throw new Error("PRODUCTION_ORDER_CANCEL_MAIN_TIMEOUT");
  }
  checkpoint.write("cancel-request", "completed");

  checkpoint.write("cancel-settle", "entered");
  let renderer;
  try {
    renderer = await withProductionOrderHardTimeout(
      () => rendererOutcome,
      remaining("PRODUCTION_ORDER_CANCEL_RENDERER_TIMEOUT"),
      "PRODUCTION_ORDER_CANCEL_RENDERER_TIMEOUT"
    );
  } catch {
    throw new Error("PRODUCTION_ORDER_CANCEL_RENDERER_TIMEOUT");
  }
  if (!renderer.settled) throw new Error("PRODUCTION_ORDER_CANCEL_RENDERER_REJECTED");
  actual.cancelEnvelopeClass = classifyCancelResponse(renderer.value);
  actual.responseOk = actual.cancelEnvelopeClass === "ok";
  if (actual.cancelEnvelopeClass === "malformed") throw new Error("PRODUCTION_ORDER_CANCEL_RESPONSE_MALFORMED");
  if (!actual.responseOk) throw new Error("PRODUCTION_ORDER_CANCEL_RESPONSE_REJECTED");
  if (main.resultClass !== actual.cancelEnvelopeClass) throw new Error("PRODUCTION_ORDER_CANCEL_ENVELOPE_MISMATCH");
  checkpoint.write("cancel-settle", "completed");

  checkpoint.write("cancel-list-cleared", "entered");
  try {
    for (;;) {
      const clearance = await withProductionOrderHardTimeout(
        inspectClearance,
        remaining("PRODUCTION_ORDER_CANCEL_LIST_NOT_CLEARED"),
        "PRODUCTION_ORDER_CANCEL_LIST_NOT_CLEARED"
      );
      if (
        !exactObject(clearance, ["taskAbsent", "partCountClass", "formalCountClass"]) ||
        typeof clearance.taskAbsent !== "boolean" ||
        !["zero", "nonzero"].includes(clearance.partCountClass) ||
        !["zero", "nonzero"].includes(clearance.formalCountClass)
      ) throw new Error("PRODUCTION_ORDER_CANCEL_CLEARANCE_INVALID");
      Object.assign(actual, clearance);
      if (clearance.taskAbsent && clearance.partCountClass === "zero" && clearance.formalCountClass === "zero") break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(1, remaining("PRODUCTION_ORDER_CANCEL_LIST_NOT_CLEARED"))));
    }
  } catch {
    throw new Error("PRODUCTION_ORDER_CANCEL_LIST_NOT_CLEARED");
  }
  checkpoint.write("cancel-list-cleared", "completed");
  return actual;
}

module.exports = { runProductionOrderCancelEvidence };
