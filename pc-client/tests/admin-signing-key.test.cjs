"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  loadSigningKey
} = require("../admin/signing-key.cjs");

test("creates and reuses one local Ed25519 development key", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-signing-"));
  try {
    const first = loadSigningKey({ dataDirectory: root, env: {} });
    const second = loadSigningKey({ dataDirectory: root, env: {} });
    assert.equal(first.keyId, second.keyId);
    assert.equal(first.publicKey, second.publicKey);
    assert.equal(first.source, "local-development");
    assert.match(
      fs.readFileSync(path.join(root, "catalog-signing-private.pem"), "utf8"),
      /PRIVATE KEY/
    );
    assert.equal(JSON.stringify(first).includes("PRIVATE KEY"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("uses an environment key without writing it to disk", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-signing-"));
  try {
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    const pem = privateKey.export({ format: "pem", type: "pkcs8" });
    const result = loadSigningKey({
      dataDirectory: root,
      env: { AIHUB_CATALOG_SIGNING_PRIVATE_KEY: pem }
    });
    assert.equal(result.source, "environment");
    assert.equal(
      fs.existsSync(path.join(root, "catalog-signing-private.pem")),
      false
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("production mode refuses to create a fallback private key", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-signing-"));
  try {
    assert.throws(
      () =>
        loadSigningKey({
          dataDirectory: root,
          env: {},
          requireEnvironment: true,
          environmentVariable: "AIHUB_UPDATE_SIGNING_PRIVATE_KEY"
        }),
      /AIHUB_UPDATE_SIGNING_PRIVATE_KEY/
    );
    assert.equal(fs.readdirSync(root).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
