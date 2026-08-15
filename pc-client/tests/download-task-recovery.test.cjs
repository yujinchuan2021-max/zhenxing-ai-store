"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  planManagedDownloadTaskRecovery
} = require("../shared/download-task-recovery.cjs");

const DAY = 24 * 60 * 60 * 1_000;
const NOW = Date.parse("2026-07-30T12:00:00.000Z");

function progress(receivedBytes = 128, totalBytes = 1_024) {
  return {
    receivedBytes,
    totalBytes,
    bytesPerSecond: 0,
    etaSeconds: null,
    percent: Math.round((receivedBytes / totalBytes) * 100),
    availableBytes: null,
    requiredBytes: null,
    remainingBytes: null,
    reserveBytes: null,
    installDiskBytes: null,
    installAvailableBytes: null,
    downloadDirectory: "D:\\AI Hub\\Downloads",
    installSpaceOk: null,
    spaceOk: null
  };
}

function task(
  productId,
  {
    phase = "paused",
    updatedAt = "2026-06-01T00:00:00.000Z",
    resumable = true
  } = {}
) {
  return {
    schemaVersion: 1,
    productId,
    attemptId: `attempt-${productId}`,
    attempt: 1,
    revision: 2,
    phase,
    resumable,
    progress: progress(),
    errorCode: phase === "failed" ? "DOWNLOAD_FAILED" : null,
    errorMessage: phase === "failed" ? "下载失败" : null,
    filePath: null,
    sha256: null,
    fileSize: null,
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt,
    logs: ["开始下载", phase === "failed" ? "下载失败" : "下载已暂停"]
  };
}

function plan(records, overrides = {}) {
  return planManagedDownloadTaskRecovery({
    records,
    isSupported: (productId) => productId !== "retired-product",
    inspectPartial: () => null,
    now: NOW,
    staleAfterMs: 30 * DAY,
    ...overrides
  });
}

test("sanitizes damaged, mismatched, and unsupported persisted records", () => {
  const valid = task("valid-product", {
    updatedAt: "2026-07-29T12:00:00.000Z"
  });
  const result = plan({
    "valid-product": valid,
    damaged: { ...task("damaged"), revision: -1 },
    "wrong-key": task("different-product"),
    "retired-product": task("retired-product")
  });

  assert.deepEqual(Object.keys(result.records), ["valid-product"]);
  assert.deepEqual(result.records["valid-product"], valid);
  assert.deepEqual(result.rejectedProductIds, [
    "damaged",
    "wrong-key",
    "retired-product"
  ]);
  assert.deepEqual(result.expiredProductIds, []);
  assert.deepEqual(result.discardPartialProductIds, []);
  assert.equal(result.changed, true);
});

test("expires stale paused metadata when no partial exists", () => {
  const result = plan({ comfy: task("comfy") });

  assert.deepEqual(result.records, {});
  assert.deepEqual(result.expiredProductIds, ["comfy"]);
  assert.deepEqual(result.discardPartialProductIds, []);
  assert.equal(result.changed, true);
});

test("plans product-scoped partial discard only from stale validated evidence", () => {
  const result = plan(
    { ollama: task("ollama", { phase: "failed" }) },
    {
      inspectPartial: (productId) => ({
        kind: "validated",
        productId,
        updatedAt: "2026-06-01T00:00:00.000Z"
      })
    }
  );

  assert.deepEqual(result.records, {});
  assert.deepEqual(result.expiredProductIds, ["ollama"]);
  assert.deepEqual(result.discardPartialProductIds, ["ollama"]);
});

test("keeps a stale task when its validated partial was updated recently", () => {
  const stale = task("python");
  const result = plan(
    { python: stale },
    {
      inspectPartial: (productId) => ({
        kind: "validated",
        productId,
        updatedAt: "2026-07-29T12:00:00.000Z"
      })
    }
  );

  assert.deepEqual(result.records, { python: stale });
  assert.deepEqual(result.expiredProductIds, []);
  assert.equal(result.changed, false);
});

test("fails closed when partial evidence is unsafe or inspection throws", () => {
  const unsafe = task("unsafe");
  const unavailable = task("unavailable");
  const result = plan(
    { unsafe, unavailable },
    {
      inspectPartial: (productId) => {
        if (productId === "unavailable") throw new Error("scan failed");
        return {
          kind: "validated",
          productId: "different-product",
          updatedAt: "2026-06-01T00:00:00.000Z"
        };
      }
    }
  );

  assert.deepEqual(result.records, { unsafe, unavailable });
  assert.deepEqual(result.expiredProductIds, []);
  assert.deepEqual(result.discardPartialProductIds, []);
  assert.equal(result.changed, false);
});

test("recovers interrupted download work without restoring a ghost running task", () => {
  const downloading = task("downloading", {
    phase: "downloading",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });
  const canceling = task("canceling", {
    phase: "canceling",
    resumable: false,
    updatedAt: "2026-06-01T00:00:00.000Z"
  });
  const clockRollback = task("clock-rollback", {
    updatedAt: "2026-07-31T00:00:00.000Z"
  });
  const result = plan(
    { downloading, canceling, "clock-rollback": clockRollback },
    {
      inspectPartial: (productId) =>
        productId === "downloading" || productId === "canceling"
          ? {
              kind: "validated",
              productId,
              updatedAt: "2026-06-01T00:00:00.000Z"
            }
          : null
    }
  );

  assert.equal(result.records.downloading.phase, "paused");
  assert.equal(result.records.downloading.resumable, true);
  assert.equal(result.records.canceling.phase, "failed");
  assert.equal(result.records.canceling.errorCode, "CANCEL_CLEANUP_FAILED");
  assert.deepEqual(result.discardPartialProductIds, ["canceling"]);
  assert.deepEqual(result.records["clock-rollback"], clockRollback);
});

test("treats the retention boundary as expired", () => {
  const boundary = new Date(NOW - 30 * DAY).toISOString();
  const result = plan({
    boundary: task("boundary", { updatedAt: boundary })
  });

  assert.deepEqual(result.expiredProductIds, ["boundary"]);
});

test("rejects invalid recovery configuration", () => {
  assert.throws(
    () =>
      planManagedDownloadTaskRecovery({
        records: {},
        isSupported: () => true,
        staleAfterMs: 0
      }),
    /参数无效/
  );
  assert.throws(
    () =>
      planManagedDownloadTaskRecovery({
        records: {},
        isSupported: () => true,
        staleAfterMs: DAY,
        now: "not-a-date"
      }),
    /时间无效/
  );
});
