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

test("streams a response without Content-Length while reserving disk for each write", () => {
  const response = {
    status: 200,
    headers: new Headers(),
    chunks: [Buffer.alloc(400), Buffer.alloc(600)]
  };
  let receivedBytes = 0;

  const preflight = assessDownloadSpace({
    availableBytes: 10_000,
    totalBytes: Number(response.headers.get("content-length") || 0),
    receivedBytes,
    safetyReserveBytes: 1_000
  });
  assert.equal(preflight.ok, true);
  assert.equal(preflight.sizeKnown, false);

  for (const chunk of response.chunks) {
    const live = assessDownloadSpace({
      availableBytes: 10_000 - receivedBytes,
      totalBytes: 0,
      receivedBytes,
      safetyReserveBytes: 1_000,
      nextWriteBytes: chunk.length
    });
    assert.equal(live.ok, true);
    assert.equal(live.requiredBytes, 1_000 + chunk.length);
    receivedBytes += chunk.length;
  }
  assert.equal(receivedBytes, 1_000);
});

test("unknown-size streaming stops before a chunk would consume the safety reserve", () => {
  const space = assessDownloadSpace({
    availableBytes: 1_200,
    totalBytes: 0,
    receivedBytes: 4_096,
    safetyReserveBytes: 1_000,
    nextWriteBytes: 400
  });
  assert.equal(space.ok, false);
  assert.equal(space.shortfallBytes, 200);
});
