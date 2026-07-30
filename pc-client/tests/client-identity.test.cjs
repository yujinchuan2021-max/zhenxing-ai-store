"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  clientIdToDeviceId,
  readOrCreateClientId
} = require("../shared/client-identity.cjs");

test("derives a stable UUID-shaped device identity from the client identity", () => {
  assert.equal(
    clientIdToDeviceId("client-00112233445566778899aabbccddeeff"),
    "00112233-4455-6677-8899-aabbccddeeff"
  );
  assert.throws(() => clientIdToDeviceId("damaged"));
});

test("persists one anonymous stable client identity", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-client-id-"));
  try {
    const filePath = path.join(root, "identity.txt");
    const first = readOrCreateClientId(
      filePath,
      () => Buffer.alloc(16, 0xab)
    );
    const second = readOrCreateClientId(
      filePath,
      () => Buffer.alloc(16, 0xcd)
    );
    assert.equal(first, "client-abababababababababababababababab");
    assert.equal(second, first);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("replaces a damaged identity without using machine identifiers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-client-id-"));
  try {
    const filePath = path.join(root, "identity.txt");
    fs.writeFileSync(filePath, "not-a-client-id", "utf8");
    assert.equal(
      readOrCreateClientId(filePath, () => Buffer.alloc(16, 1)),
      "client-01010101010101010101010101010101"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
