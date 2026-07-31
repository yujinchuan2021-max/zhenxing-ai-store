"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { sha256Hex } = require("../shared/sha256-portable.cjs");

test("portable SHA-256 matches Node for ASCII, Unicode and long contracts", () => {
  for (const value of [
    "",
    "abc",
    "产品执行契约",
    JSON.stringify({ productId: "sample", rows: Array.from({ length: 200 }, (_, index) => index) })
  ]) {
    assert.equal(
      sha256Hex(value),
      crypto.createHash("sha256").update(value).digest("hex")
    );
  }
});
