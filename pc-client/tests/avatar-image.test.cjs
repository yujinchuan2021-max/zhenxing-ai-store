"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MAX_AVATAR_BYTES,
  parseAvatarDataUrl
} = require("../shared/avatar-image.cjs");

test("accepts only a bounded image data URL with a matching file signature", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
  assert.deepEqual(
    parseAvatarDataUrl(`data:image/jpeg;base64,${jpeg.toString("base64")}`),
    { mimeType: "image/jpeg", data: jpeg }
  );
  assert.equal(parseAvatarDataUrl(""), null);
});

test("rejects spoofed, malformed and oversized avatar data", () => {
  assert.throws(
    () => parseAvatarDataUrl("data:image/png;base64,aGVsbG8="),
    /无效/
  );
  assert.throws(
    () =>
      parseAvatarDataUrl(
        `data:image/jpeg;base64,${Buffer.alloc(MAX_AVATAR_BYTES + 1, 0xff).toString("base64")}`
      ),
    /超过/
  );
  assert.throws(() => parseAvatarDataUrl("https://example.com/avatar.png"));
});
