"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  readResponseTextWithLimit
} = require("../shared/limited-response.cjs");

function response(chunks, headers = { "content-type": "application/json" }) {
  let index = 0;
  return {
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null
    },
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length
            ? { done: false, value: Buffer.from(chunks[index++]) }
            : { done: true },
        cancel: async () => {},
        releaseLock: () => {}
      })
    }
  };
}

test("reads a JSON response only up to the hard byte limit", async () => {
  assert.equal(
    await readResponseTextWithLimit(response(["{\"ok\":", "true}"]), 32),
    "{\"ok\":true}"
  );
  await assert.rejects(
    readResponseTextWithLimit(response(["1234", "5678"]), 7),
    /大小限制/
  );
});

test("rejects oversized content-length and non-JSON content", async () => {
  await assert.rejects(
    readResponseTextWithLimit(
      response([], {
        "content-type": "application/json",
        "content-length": "100"
      }),
      16
    ),
    /大小限制/
  );
  await assert.rejects(
    readResponseTextWithLimit(
      response(["<html>"], { "content-type": "text/html" }),
      16
    ),
    /不是 JSON/
  );
});
