"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  digestCredential,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  verifyPassword
} = require("../shared/identity-security.cjs");

test("normalizes email and username identities", () => {
  assert.equal(normalizeEmail(" User@Example.COM "), "user@example.com");
  assert.deepEqual(normalizeUsername("测试_User"), {
    username: "测试_User",
    normalized: "测试_user"
  });
  assert.throws(() => normalizeEmail("bad"));
  assert.throws(() => normalizeUsername("../admin"));
});

test("hashes passwords with independent salts and verifies in constant shape", () => {
  const first = hashPassword("secure-password-123");
  const second = hashPassword("secure-password-123");
  assert.notEqual(first, second);
  assert.equal(verifyPassword("secure-password-123", first), true);
  assert.equal(verifyPassword("wrong-password-123", first), false);
  assert.equal(verifyPassword("secure-password-123", "damaged"), false);
});

test("stores only deterministic credential digests", () => {
  assert.equal(digestCredential("credential").length, 64);
  assert.notEqual(digestCredential("credential"), digestCredential("other"));
});
