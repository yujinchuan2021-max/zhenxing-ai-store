"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  runWhenManagedDownloadSlotAvailable
} = require("../shared/managed-download-refresh.cjs");
const {
  CLEANUP_QUEUE_RECORD_KEY,
  MAX_SUPERSEDED_PACKAGE_RECEIPTS,
  cancelSupersededPackageCleanupForProduct,
  commitManagedDownloadReplacement,
  createSupersededPackageReceipt,
  retrySupersededPackageCleanup
} = require("../shared/managed-download-replacement.cjs");

const EXPECTED_FILE_NAME = "Claude-Setup-x64.exe";

function downloadRecord(name, sha256, fileSize) {
  return {
    productId: "claude-desktop",
    filePath: `C:\\Downloads\\${name}`,
    downloadRoot: "C:\\Downloads",
    sha256,
    fileSize
  };
}

test("a busy global download slot preserves the trusted installer", () => {
  const trustedPackages = new Set(["claude-desktop"]);

  const result = runWhenManagedDownloadSlotAvailable(
    {
      productId: "claude-desktop",
      activeProductIds: ["ollama-cli"]
    },
    () => {
      trustedPackages.delete("claude-desktop");
      return { ok: true };
    }
  );

  assert.deepEqual(result, {
    executed: false,
    reason: "global-slot-busy",
    activeProductId: "ollama-cli"
  });
  assert.equal(trustedPackages.has("claude-desktop"), true);
});

test("a failed replacement commit keeps the previous trusted package record", async () => {
  const previous = downloadRecord(
    "Claude-Setup-x64.exe",
    "a".repeat(64),
    10
  );
  const next = downloadRecord(
    "Claude-Setup-x64 (1).exe",
    "b".repeat(64),
    20
  );
  let stored = { "claude-desktop": previous };
  let cleanupCalled = false;

  await assert.rejects(
    commitManagedDownloadReplacement({
      productId: "claude-desktop",
      currentRecords: stored,
      expectedPreviousRecord: previous,
      trustedPreviousRecord: previous,
      nextRecord: next,
      expectedFileName: EXPECTED_FILE_NAME,
      writeRecords() {
        throw new Error("record commit failed");
      },
      cleanupPrevious: async () => {
        cleanupCalled = true;
        return { ok: true };
      }
    }),
    /record commit failed/
  );

  assert.equal(stored["claude-desktop"], previous);
  assert.equal(cleanupCalled, false);
});

test("replacement commits the new record before exact old-package cleanup", async () => {
  const previous = downloadRecord(
    "Claude-Setup-x64.exe",
    "a".repeat(64),
    10
  );
  const next = downloadRecord(
    "Claude-Setup-x64 (1).exe",
    "b".repeat(64),
    20
  );
  let stored = { "claude-desktop": previous };

  const result = await commitManagedDownloadReplacement({
    productId: "claude-desktop",
    currentRecords: stored,
    expectedPreviousRecord: previous,
    trustedPreviousRecord: previous,
    nextRecord: next,
    expectedFileName: EXPECTED_FILE_NAME,
    writeRecords(records) {
      stored = records;
    },
    cleanupPrevious: async (receipt) => {
      assert.equal(stored["claude-desktop"], next);
      assert.equal(
        stored[CLEANUP_QUEUE_RECORD_KEY][0].filePath,
        previous.filePath
      );
      assert.equal(receipt.filePath, previous.filePath);
      return { ok: false, error: "old package is locked" };
    }
  });

  assert.equal(stored["claude-desktop"], next);
  assert.equal(result.cleanup.ok, false);
  assert.equal(result.cleanup.pendingCount, 1);
  assert.equal(
    result.cleanup.results[0].error,
    "old package is locked"
  );
  assert.equal(stored[CLEANUP_QUEUE_RECORD_KEY].length, 1);
});

test("replacement refuses to overwrite a record changed during download", async () => {
  const previous = downloadRecord(
    "Claude-Setup-x64.exe",
    "a".repeat(64),
    10
  );
  const changed = { ...previous, sha256: "c".repeat(64) };
  let writeCalled = false;

  await assert.rejects(
    commitManagedDownloadReplacement({
      productId: "claude-desktop",
      currentRecords: { "claude-desktop": changed },
      expectedPreviousRecord: previous,
      trustedPreviousRecord: previous,
      nextRecord: { ...previous, sha256: "b".repeat(64) },
      expectedFileName: EXPECTED_FILE_NAME,
      writeRecords() {
        writeCalled = true;
      },
      cleanupPrevious: async () => ({ ok: true })
    }),
    /changed during download/i
  );
  assert.equal(writeCalled, false);
});

test("a locked old package remains durably queued and is cleaned after restart", async () => {
  const previous = downloadRecord(
    "Claude-Setup-x64.exe",
    "a".repeat(64),
    10
  );
  const next = downloadRecord(
    "Claude-Setup-x64 (1).exe",
    "b".repeat(64),
    20
  );
  let stored = { "claude-desktop": previous };

  await commitManagedDownloadReplacement({
    productId: "claude-desktop",
    currentRecords: stored,
    expectedPreviousRecord: previous,
    trustedPreviousRecord: previous,
    nextRecord: next,
    expectedFileName: EXPECTED_FILE_NAME,
    now: () => "2026-08-01T00:00:00.000Z",
    writeRecords(records) {
      stored = structuredClone(records);
    },
    cleanupPrevious: async () => ({
      ok: false,
      error: "sharing violation"
    })
  });

  const persistedAfterRestart = structuredClone(stored);
  assert.equal(persistedAfterRestart[CLEANUP_QUEUE_RECORD_KEY].length, 1);
  let cleanedPath = "";
  const retried = await retrySupersededPackageCleanup({
    currentRecords: persistedAfterRestart,
    expectedFileNameForProduct: () => EXPECTED_FILE_NAME,
    cleanupReceipt: async (receipt, currentRecord) => {
      cleanedPath = receipt.filePath;
      assert.equal(currentRecord.filePath, next.filePath);
      return { ok: true, filePath: receipt.filePath };
    },
    writeRecords(records) {
      stored = structuredClone(records);
    }
  });

  assert.equal(cleanedPath, previous.filePath);
  assert.equal(retried.cleanup.ok, true);
  assert.equal(retried.cleanup.cleanedCount, 1);
  assert.equal(retried.cleanup.pendingCount, 0);
  assert.equal(Object.hasOwn(stored, CLEANUP_QUEUE_RECORD_KEY), false);
  assert.deepEqual(stored["claude-desktop"], next);
});

test("clearing a product record cancels only that product's superseded cleanup", () => {
  const claudeReceipt = createSupersededPackageReceipt(
    downloadRecord("Claude-Setup-x64.exe", "a".repeat(64), 10),
    EXPECTED_FILE_NAME,
    "2026-08-01T00:00:00.000Z"
  );
  const otherRecord = {
    productId: "other-product",
    filePath: "C:\\Downloads\\Other.exe",
    downloadRoot: "C:\\Downloads",
    sha256: "c".repeat(64),
    fileSize: 30
  };
  const otherReceipt = createSupersededPackageReceipt(
    otherRecord,
    "Other.exe",
    "2026-08-01T00:00:01.000Z"
  );
  const records = {
    "claude-desktop": downloadRecord(
      "Claude-Setup-x64 (1).exe",
      "b".repeat(64),
      20
    ),
    "other-product": { ...otherRecord, filePath: "C:\\Downloads\\Other (1).exe" },
    [CLEANUP_QUEUE_RECORD_KEY]: [claudeReceipt, otherReceipt]
  };

  const result = cancelSupersededPackageCleanupForProduct(
    records,
    "claude-desktop"
  );

  assert.equal(result.canceledCount, 1);
  assert.equal(records[CLEANUP_QUEUE_RECORD_KEY].length, 2);
  assert.deepEqual(result.records["claude-desktop"], records["claude-desktop"]);
  assert.deepEqual(result.records["other-product"], records["other-product"]);
  assert.deepEqual(result.records[CLEANUP_QUEUE_RECORD_KEY], [otherReceipt]);
});

test("cleanup retry never deletes an old package after its current record was cleared", async () => {
  const receipt = createSupersededPackageReceipt(
    downloadRecord("Claude-Setup-x64.exe", "a".repeat(64), 10),
    EXPECTED_FILE_NAME,
    "2026-08-01T00:00:00.000Z"
  );
  let stored = { [CLEANUP_QUEUE_RECORD_KEY]: [receipt] };
  let cleanupCalls = 0;
  let writeCalls = 0;

  const result = await retrySupersededPackageCleanup({
    currentRecords: stored,
    expectedFileNameForProduct: () => EXPECTED_FILE_NAME,
    cleanupReceipt: async () => {
      cleanupCalls += 1;
      return { ok: true };
    },
    writeRecords(records) {
      writeCalls += 1;
      stored = structuredClone(records);
    }
  });

  assert.equal(cleanupCalls, 0);
  assert.equal(writeCalls, 1);
  assert.equal(result.cleanup.ok, true);
  assert.equal(result.cleanup.cleanedCount, 0);
  assert.equal(result.cleanup.canceledCount, 1);
  assert.equal(result.cleanup.pendingCount, 0);
  assert.equal(result.cleanup.results[0].reason, "current-record-missing");
  assert.equal(Object.hasOwn(stored, CLEANUP_QUEUE_RECORD_KEY), false);
});

test("tampered cleanup receipts fail closed before any deletion adapter runs", async () => {
  const receipt = createSupersededPackageReceipt(
    downloadRecord("Claude-Setup-x64.exe", "a".repeat(64), 10),
    EXPECTED_FILE_NAME,
    "2026-08-01T00:00:00.000Z"
  );
  let cleanupCalled = false;
  let writeCalled = false;

  await assert.rejects(
    retrySupersededPackageCleanup({
      currentRecords: {
        [CLEANUP_QUEUE_RECORD_KEY]: [
          { ...receipt, filePath: "C:\\Windows\\System32\\notepad.exe" }
        ]
      },
      expectedFileNameForProduct: () => EXPECTED_FILE_NAME,
      cleanupReceipt: async () => {
        cleanupCalled = true;
        return { ok: true };
      },
      writeRecords() {
        writeCalled = true;
      }
    }),
    /exact root/i
  );
  assert.equal(cleanupCalled, false);
  assert.equal(writeCalled, false);
});

test("cleanup queue limit blocks another replacement before record commit", async () => {
  const previous = downloadRecord(
    "Claude-Setup-x64.exe",
    "a".repeat(64),
    10
  );
  const next = downloadRecord(
    "Claude-Setup-x64 (1).exe",
    "b".repeat(64),
    20
  );
  const queue = Array.from(
    { length: MAX_SUPERSEDED_PACKAGE_RECEIPTS },
    (_, index) =>
      createSupersededPackageReceipt(
        {
          productId: `product-${index}`,
          filePath: `C:\\Downloads\\Package-${index}.exe`,
          downloadRoot: "C:\\Downloads",
          sha256: index.toString(16).padStart(64, "0"),
          fileSize: index + 1
        },
        `Package-${index}.exe`,
        "2026-08-01T00:00:00.000Z"
      )
  );
  let writeCalled = false;

  await assert.rejects(
    commitManagedDownloadReplacement({
      productId: "claude-desktop",
      currentRecords: {
        "claude-desktop": previous,
        [CLEANUP_QUEUE_RECORD_KEY]: queue
      },
      expectedPreviousRecord: previous,
      trustedPreviousRecord: previous,
      nextRecord: next,
      expectedFileName: EXPECTED_FILE_NAME,
      writeRecords() {
        writeCalled = true;
      },
      cleanupPrevious: async () => ({ ok: true })
    }),
    /queue is full/i
  );
  assert.equal(writeCalled, false);
});

test("a failed receipt rewrite keeps the durable receipt for another retry", async () => {
  const current = downloadRecord(
    "Claude-Setup-x64 (1).exe",
    "b".repeat(64),
    20
  );
  const receipt = createSupersededPackageReceipt(
    downloadRecord("Claude-Setup-x64.exe", "a".repeat(64), 10),
    EXPECTED_FILE_NAME,
    "2026-08-01T00:00:00.000Z"
  );
  const stored = {
    "claude-desktop": current,
    [CLEANUP_QUEUE_RECORD_KEY]: [receipt]
  };

  const result = await retrySupersededPackageCleanup({
    currentRecords: stored,
    expectedFileNameForProduct: () => EXPECTED_FILE_NAME,
    cleanupReceipt: async () => ({ ok: true, missing: true }),
    writeRecords() {
      throw new Error("disk full");
    }
  });

  assert.equal(result.cleanup.ok, false);
  assert.match(result.cleanup.error, /disk full/);
  assert.equal(result.cleanup.pendingCount, 1);
  assert.equal(result.records, stored);
  assert.equal(stored[CLEANUP_QUEUE_RECORD_KEY].length, 1);
});
