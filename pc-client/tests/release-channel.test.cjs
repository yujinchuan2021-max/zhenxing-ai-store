"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  readReleaseChannel
} = require("../shared/release-channel.cjs");

function trustedKeys() {
  const { publicKey } = crypto.generateKeyPairSync("ed25519");
  return [
    {
      keyId: "release-test",
      publicKey: publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64")
    }
  ];
}

test("accepts a strict signed release channel", () => {
  const result = readReleaseChannel(
    {
      schemaVersion: 2,
      kind: "catalog",
      releaseUrl: "https://catalog.example/releases/current.json",
      allowedReleaseOrigins: ["https://catalog.example"],
      trustedKeys: trustedKeys()
    },
    { kind: "catalog" }
  );
  assert.equal(result.releaseUrl, "https://catalog.example/releases/current.json");
});

test("allows loopback HTTP only for local development", () => {
  const value = {
    schemaVersion: 2,
    kind: "catalog",
    releaseUrl: "http://127.0.0.1:4173/catalog-release.json",
    allowedReleaseOrigins: ["http://127.0.0.1:4173"],
    trustedKeys: trustedKeys()
  };
  assert.throws(
    () => readReleaseChannel(value, { kind: "catalog" }),
    /HTTPS/
  );
  assert.equal(
    readReleaseChannel(value, {
      kind: "catalog",
      allowLocalhost: true
    }).releaseUrl,
    value.releaseUrl
  );
});

test("rejects loopback HTTPS outside the local channel", () => {
  const value = {
    schemaVersion: 2,
    kind: "catalog",
    releaseUrl: "https://localhost:4443/catalog-release.json",
    allowedReleaseOrigins: ["https://localhost:4443"],
    trustedKeys: trustedKeys()
  };
  assert.throws(
    () => readReleaseChannel(value, { kind: "catalog" }),
    /HTTPS/
  );
  assert.equal(
    readReleaseChannel(value, {
      kind: "catalog",
      allowLocalhost: true
    }).releaseUrl,
    value.releaseUrl
  );
});

test("rejects cross-origin releases, credentials, and unknown fields", () => {
  const base = {
    schemaVersion: 2,
    kind: "catalog",
    releaseUrl: "https://catalog.example/current.json",
    allowedReleaseOrigins: ["https://catalog.example"],
    trustedKeys: trustedKeys()
  };
  for (const value of [
    { ...base, releaseUrl: "https://other.example/current.json" },
    { ...base, releaseUrl: "https://user@catalog.example/current.json" },
    { ...base, extra: true }
  ]) {
    assert.throws(
      () => readReleaseChannel(value, { kind: "catalog" }),
      /发布|结构/
    );
  }
});

test("accepts only an exact empty disabled channel", () => {
  assert.deepEqual(
    readReleaseChannel(
      {
        schemaVersion: 2,
        kind: "update",
        releaseUrl: "",
        allowedReleaseOrigins: [],
        trustedKeys: []
      },
      { kind: "update" }
    ),
    {
      schemaVersion: 2,
      kind: "update",
      releaseUrl: "",
      allowedReleaseOrigins: [],
      trustedKeys: []
    }
  );
});
