"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  LOCAL_CLIENT_SERVICES,
  resolveClientServices,
  validateClientServices
} = require("../shared/client-services.cjs");

const productionServices = {
  schemaVersion: 1,
  identityOrigin: "https://identity.example.com",
  communityOrigin: "https://community.example.com"
};

test("accepts fixed loopback Local services and non-loopback HTTPS Production services", () => {
  assert.deepEqual(
    validateClientServices(LOCAL_CLIENT_SERVICES, { variant: "local" }),
    LOCAL_CLIENT_SERVICES
  );
  assert.deepEqual(
    validateClientServices(productionServices, { variant: "production" }),
    productionServices
  );
});

test("production services reject HTTP and every loopback spelling", () => {
  for (const identityOrigin of [
    "http://identity.example.com",
    "https://localhost",
    "https://service.localhost",
    "https://127.0.0.2",
    "https://[::1]",
    "https://[::ffff:7f00:1]"
  ]) {
    assert.throws(
      () =>
        validateClientServices(
          { ...productionServices, identityOrigin },
          { variant: "production" }
        ),
      /非回环 HTTPS origin/
    );
  }
});

test("service configuration rejects paths, credentials and unknown fields", () => {
  for (const value of [
    { ...productionServices, communityOrigin: "https://community.example.com/" },
    { ...productionServices, communityOrigin: "https://community.example.com/forum" },
    { ...productionServices, identityOrigin: "https://user@identity.example.com" },
    { ...productionServices, extra: true }
  ]) {
    assert.throws(
      () => validateClientServices(value, { variant: "production" }),
      /origin|结构/
    );
  }
});

test("packaged clients ignore environment service overrides", () => {
  assert.deepEqual(
    resolveClientServices({
      isPackaged: true,
      packagedConfig: productionServices,
      env: {
        AIHUB_IDENTITY_ORIGIN: "https://evil.example",
        AIHUB_COMMUNITY_PUBLIC_ORIGIN: "https://evil.example"
      }
    }),
    productionServices
  );
  assert.deepEqual(
    resolveClientServices({
      isPackaged: true,
      localReleaseAcceptance: true,
      packagedConfig: LOCAL_CLIENT_SERVICES,
      env: {
        AIHUB_IDENTITY_ORIGIN: "https://evil.example",
        AIHUB_COMMUNITY_PUBLIC_ORIGIN: "https://evil.example"
      }
    }),
    LOCAL_CLIENT_SERVICES
  );
  assert.deepEqual(
    resolveClientServices({
      isPackaged: true,
      upgradeFixture: true,
      packagedConfig: productionServices,
      env: {
        AIHUB_IDENTITY_ORIGIN: "https://evil.example",
        AIHUB_COMMUNITY_PUBLIC_ORIGIN: "https://evil.example"
      }
    }),
    LOCAL_CLIENT_SERVICES
  );
});

test("development mode may use environment service origins", () => {
  assert.deepEqual(
    resolveClientServices({
      isPackaged: false,
      env: {
        AIHUB_IDENTITY_ORIGIN: "https://identity.dev.example",
        AIHUB_COMMUNITY_PUBLIC_ORIGIN: "https://community.dev.example"
      }
    }),
    {
      schemaVersion: 1,
      identityOrigin: "https://identity.dev.example",
      communityOrigin: "https://community.dev.example"
    }
  );
});
