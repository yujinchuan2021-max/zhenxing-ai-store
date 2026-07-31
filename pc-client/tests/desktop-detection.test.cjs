"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  matchesDesktopIdentity,
  resolveDesktopPresence
} = require("../shared/desktop-detection.cjs");

test("short product names do not match unrelated Windows package substrings", () => {
  assert.equal(matchesDesktopIdentity(["ima", "ima.copilot"], "ima"), true);
  assert.equal(
    matchesDesktopIdentity(["ima", "ima.copilot"], "Microsoft.WebpImageExtension"),
    false
  );
  assert.equal(
    matchesDesktopIdentity(["ima", "ima.copilot"], "Microsoft.WebpImageExtension_1.2.14.0_x64__8wekyb3d8bbwe"),
    false
  );
});

test("trusted desktop identity ignores a stale Start Apps entry", () => {
  assert.deepEqual(
    resolveDesktopPresence({
      evidencePolicy: "trusted-install-identity",
      registryMatched: false,
      packageMatched: false,
      startMatched: true,
      registryScanSucceeded: true,
      windowsAppsScanSucceeded: true
    }),
    {
      installed: false,
      detection: "absent"
    }
  );
});

test("discovery-only products may use a Start Apps entry", () => {
  assert.deepEqual(
    resolveDesktopPresence({
      evidencePolicy: "discovery",
      registryMatched: false,
      packageMatched: false,
      startMatched: true,
      registryScanSucceeded: true,
      windowsAppsScanSucceeded: true
    }),
    {
      installed: true,
      detection: "installed"
    }
  );
});

test("an incomplete trusted scan remains unknown", () => {
  assert.deepEqual(
    resolveDesktopPresence({
      evidencePolicy: "trusted-install-identity",
      registryMatched: false,
      packageMatched: false,
      startMatched: true,
      registryScanSucceeded: false,
      windowsAppsScanSucceeded: true
    }),
    {
      installed: false,
      detection: "unknown"
    }
  );
});
