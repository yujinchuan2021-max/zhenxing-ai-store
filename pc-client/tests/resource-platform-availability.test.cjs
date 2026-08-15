"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  projectResourcePlatformAvailability,
  validatePlatformSupportClaims
} = require("../shared/resource-platform-availability.cjs");

const NOW = "2026-08-07T12:00:00.000Z";

function claim(overrides = {}) {
  return {
    platform: "windows",
    runtime: "native",
    status: "supported",
    architectures: ["x64"],
    evidence: [{
      kind: "first-party",
      url: "https://example.com/platform-support",
      observedAt: "2026-08-07T00:00:00.000Z"
    }],
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    platform: "windows",
    runtime: "native",
    architecture: "x64",
    runtimeDependencies: [],
    ...overrides
  };
}

function project(overrides = {}) {
  return projectResourcePlatformAvailability({
    resourceSupport: [claim()],
    hostSupport: [claim()],
    profileSupport: [claim()],
    requested: request(),
    now: NOW,
    ...overrides
  });
}

test("canonical platform claims use a strict, fresh first-party evidence shape", () => {
  assert.deepEqual(validatePlatformSupportClaims([claim()], { now: NOW }), {
    valid: true,
    reason: null
  });
  for (const invalid of [
    claim({ platform: "android" }),
    claim({ runtime: "docker" }),
    claim({ status: "maybe" }),
    claim({ architectures: ["amd64"] }),
    claim({ evidence: [] }),
    claim({ evidence: [{ kind: "community", url: "https://example.com", observedAt: NOW }] }),
    claim({ evidence: [{ kind: "first-party", url: "http://example.com", observedAt: NOW }] }),
    claim({ evidence: [{ kind: "first-party", url: "https://user:pass@example.com", observedAt: NOW }] }),
    { ...claim(), command: "run" }
  ]) {
    assert.equal(validatePlatformSupportClaims([invalid], { now: NOW }).valid, false);
  }
  assert.equal(validatePlatformSupportClaims([claim({
    evidence: [{
      kind: "first-party",
      url: "https://example.com/platform-support",
      observedAt: "2025-08-05T00:00:00.000Z"
    }]
  })], { now: NOW }).reason, "PLATFORM_EVIDENCE_STALE");
});

test("resource, host, fixed profile and requested platform intersect once", () => {
  assert.deepEqual(project(), {
    available: true,
    managedEligible: true,
    reason: null,
    platform: "windows",
    runtime: "native",
    architecture: "x64"
  });
  assert.equal(project({ resourceSupport: [claim({ status: "unknown" })] }).available, false);
  assert.equal(project({ hostSupport: [claim({ status: "blocked" })] }).available, false);
  assert.equal(project({ profileSupport: undefined }).managedEligible, false);
  assert.equal(project({
    hostSupport: [claim({ architectures: ["arm64"] })]
  }).reason, "PLATFORM_INTERSECTION_EMPTY");
  assert.equal(project({
    resourceSupport: [claim({ architectures: ["universal"] })]
  }).available, true);
  assert.equal(project({ catalogMayChoosePlatform: true }).reason,
    "PLATFORM_PROJECTION_INPUT_INVALID");
});

test("browser and remote can cross platforms only through explicit non-native claims", () => {
  const browserMac = claim({
    platform: "macos",
    runtime: "browser",
    architectures: ["universal"]
  });
  assert.equal(project({
    resourceSupport: [browserMac],
    hostSupport: [browserMac],
    profileSupport: [browserMac],
    requested: request({
      platform: "macos",
      runtime: "browser",
      architecture: "arm64"
    })
  }).available, true);
  assert.equal(project({
    resourceSupport: [browserMac],
    hostSupport: [browserMac],
    profileSupport: [browserMac],
    requested: request({ platform: "macos", architecture: "arm64" })
  }).available, false);
});

test("WSL is Windows-only and container remains an explicit dependency", () => {
  assert.equal(project({
    requested: request({ runtimeDependencies: ["container"] })
  }).reason, "PLATFORM_REQUEST_INVALID");
  const wsl = claim({ runtime: "wsl" });
  assert.equal(project({
    resourceSupport: [wsl],
    hostSupport: [wsl],
    profileSupport: [wsl],
    requested: request({ runtime: "wsl", runtimeDependencies: [] })
  }).reason, "RUNTIME_DEPENDENCY_MISSING");
  assert.equal(project({
    resourceSupport: [wsl],
    hostSupport: [wsl],
    profileSupport: [wsl],
    requested: request({ runtime: "wsl", runtimeDependencies: ["wsl"] })
  }).available, true);
  assert.equal(validatePlatformSupportClaims([
    claim({ platform: "linux", runtime: "wsl" })
  ], { now: NOW }).reason, "WSL_REQUIRES_WINDOWS");

  const container = claim({ runtime: "container" });
  assert.equal(project({
    resourceSupport: [container],
    hostSupport: [container],
    profileSupport: [container],
    requested: request({ runtime: "container", runtimeDependencies: [] })
  }).reason, "RUNTIME_DEPENDENCY_MISSING");
  assert.equal(project({
    resourceSupport: [container],
    hostSupport: [container],
    profileSupport: [container],
    requested: request({ runtime: "container", runtimeDependencies: ["container"] })
  }).available, true);
  assert.equal(project({
    resourceSupport: [container],
    hostSupport: [container],
    profileSupport: [container],
    requested: request()
  }).available, false);
});

test("native, WSL and container fixed profiles cannot approve multiple platforms", () => {
  assert.equal(project({
    profileSupport: [
      claim(),
      claim({ platform: "macos" })
    ]
  }).reason, "PROFILE_NOT_PLATFORM_SPECIFIC");
});
