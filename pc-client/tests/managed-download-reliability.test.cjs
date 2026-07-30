const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertDownloadCanFinalize,
  classifyPartialForStart,
  isCurrentDownloadAttempt,
  isReusablePartialEvidence,
  parsePlainObjectJson,
  raiseDownloadIntent,
  removeRecordMetadata,
  selectCleanupFailurePartial
} = require("../shared/managed-download-reliability.cjs");

test("record JSON readers reject every non-plain top-level value", () => {
  assert.deepEqual(parsePlainObjectJson('{"ollama":{"fileSize":42}}'), {
    ollama: { fileSize: 42 }
  });
  for (const source of ["[]", "null", "42", '"record"', "true", "{"]) {
    assert.deepEqual(parsePlainObjectJson(source), {}, source);
  }
});

test("download intent is monotonic: download < pause < cancel", () => {
  assert.equal(raiseDownloadIntent("download", "pause"), "pause");
  assert.equal(raiseDownloadIntent("pause", "download"), "pause");
  assert.equal(raiseDownloadIntent("pause", "cancel"), "cancel");
  assert.equal(raiseDownloadIntent("cancel", "pause"), "cancel");
  assert.equal(raiseDownloadIntent("cancel", "download"), "cancel");
});

test("EOF finalization requires complete bytes and only the current attempt", () => {
  const entry = { attemptId: "attempt-2", intent: "cancel" };
  assert.equal(isCurrentDownloadAttempt(entry, "attempt-2"), true);
  assert.doesNotThrow(() =>
    assertDownloadCanFinalize({
      receivedBytes: 1_000,
      totalBytes: 1_000,
      isCurrentAttempt: () =>
        isCurrentDownloadAttempt(entry, "attempt-2")
    })
  );
  assert.throws(
    () =>
      assertDownloadCanFinalize({
        receivedBytes: 999,
        totalBytes: 1_000,
        isCurrentAttempt: () => true
      }),
    (error) => error.code === "DOWNLOAD_INCOMPLETE"
  );
  assert.throws(
    () =>
      assertDownloadCanFinalize({
        receivedBytes: 1_000,
        totalBytes: 1_000,
        isCurrentAttempt: () => false
      }),
    (error) => error.code === "DOWNLOAD_ATTEMPT_INTERRUPTED"
  );
});

test("only a real non-zero partial file is resumable evidence", () => {
  assert.equal(
    isReusablePartialEvidence({ partialExists: true, receivedBytes: 1 }),
    true
  );
  assert.equal(
    isReusablePartialEvidence({ partialExists: true, receivedBytes: 0 }),
    false
  );
  assert.equal(
    isReusablePartialEvidence({ partialExists: false, receivedBytes: 100 }),
    false
  );
  assert.equal(isReusablePartialEvidence(null), false);
});

test("classifies a full partial for promotion without a Range EOF request", () => {
  assert.equal(
    classifyPartialForStart({
      partialExists: true,
      receivedBytes: 1_000,
      totalBytes: 1_000
    }),
    "promote"
  );
  assert.equal(
    classifyPartialForStart({
      partialExists: true,
      receivedBytes: 500,
      totalBytes: 1_000
    }),
    "resume"
  );
  for (const partial of [
    { partialExists: false, receivedBytes: 500, totalBytes: 1_000 },
    { partialExists: true, receivedBytes: 0, totalBytes: 1_000 },
    { partialExists: true, receivedBytes: 500, totalBytes: 0 },
    { partialExists: true, receivedBytes: 1_001, totalBytes: 1_000 }
  ]) {
    assert.equal(classifyPartialForStart(partial), "restart");
  }
});

test("cleanup failure keeps the safest available partial evidence", () => {
  const validated = { partialExists: true, receivedBytes: 500 };
  const remaining = { partialExists: false, receivedBytes: 0 };
  assert.equal(
    selectCleanupFailurePartial(remaining, validated),
    remaining
  );
  assert.equal(
    selectCleanupFailurePartial(null, validated),
    validated
  );
  assert.equal(selectCleanupFailurePartial(null, null), null);
});

test("invalid receipt cleanup removes metadata only and preserves other records", () => {
  const suspiciousReceipt = {
    productId: "ollama",
    targetPath: "C:\\Users\\someone\\unrelated-file.exe",
    partialPath: "C:\\Users\\someone\\unrelated-file.exe.part"
  };
  const records = {
    ollama: suspiciousReceipt,
    comfyui: { productId: "comfyui", receivedBytes: 512 }
  };

  const result = removeRecordMetadata(records, "ollama");

  assert.equal(result.removed, true);
  assert.deepEqual(result.nextRecords, {
    comfyui: { productId: "comfyui", receivedBytes: 512 }
  });
  assert.equal(records.ollama, suspiciousReceipt);
  assert.equal(records.ollama.targetPath, suspiciousReceipt.targetPath);
});
