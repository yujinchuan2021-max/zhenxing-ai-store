const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createResumeHeaders,
  resolveResumeResponse
} = require("../shared/download-resume.cjs");

test("requests the remaining bytes for a partial download", () => {
  assert.deepEqual(createResumeHeaders(1024), { Range: "bytes=1024-" });
  assert.deepEqual(createResumeHeaders(0), {});
});

test("appends only when the server confirms the exact range start", () => {
  assert.deepEqual(
    resolveResumeResponse({
      requestedBytes: 1024,
      status: 206,
      contentLength: "2048",
      contentRange: "bytes 1024-3071/4096"
    }),
    {
      append: true,
      receivedBytes: 1024,
      totalBytes: 4096
    }
  );
});

test("restarts safely when the server ignores a range request", () => {
  assert.deepEqual(
    resolveResumeResponse({
      requestedBytes: 1024,
      status: 200,
      contentLength: "4096",
      contentRange: ""
    }),
    {
      append: false,
      receivedBytes: 0,
      totalBytes: 4096
    }
  );
});

test("rejects a mismatched partial response", () => {
  assert.throws(
    () =>
      resolveResumeResponse({
        requestedBytes: 1024,
        status: 206,
        contentLength: "2048",
        contentRange: "bytes 2048-4095/4096"
      }),
    /断点位置不一致/
  );
});

test("rejects a partial response whose range length is inconsistent", () => {
  assert.throws(
    () =>
      resolveResumeResponse({
        requestedBytes: 1024,
        status: 206,
        contentLength: "1024",
        contentRange: "bytes 1024-3071/4096"
      }),
    /断点位置不一致/
  );
});
