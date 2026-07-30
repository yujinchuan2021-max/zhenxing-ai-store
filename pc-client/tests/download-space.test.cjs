const assert = require("node:assert/strict");
const test = require("node:test");

const { assessDownloadSpace } = require("../shared/download-space.cjs");

test("checks only remaining package bytes plus the safety reserve", () => {
  assert.deepEqual(
    assessDownloadSpace({
      availableBytes: 3_000,
      totalBytes: 2_000,
      receivedBytes: 500,
      safetyReserveBytes: 1_000
    }),
    {
      ok: true,
      availableBytes: 3_000,
      requiredBytes: 2_500,
      shortfallBytes: 0,
      remainingBytes: 1_500,
      reserveBytes: 1_000
    }
  );
});

test("reports the exact disk-space shortfall", () => {
  assert.deepEqual(
    assessDownloadSpace({
      availableBytes: 2_000,
      totalBytes: 2_000,
      receivedBytes: 500,
      safetyReserveBytes: 1_000
    }),
    {
      ok: false,
      availableBytes: 2_000,
      requiredBytes: 2_500,
      shortfallBytes: 500,
      remainingBytes: 1_500,
      reserveBytes: 1_000
    }
  );
});

test("rejects an unknown package size before writing", () => {
  assert.throws(
    () =>
      assessDownloadSpace({
        availableBytes: 10_000,
        totalBytes: 0,
        receivedBytes: 0,
        safetyReserveBytes: 1_000
      }),
    /无法确认安装包大小/
  );
});
