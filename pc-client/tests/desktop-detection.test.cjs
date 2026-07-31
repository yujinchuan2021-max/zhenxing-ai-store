"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  resolveDesktopPresence
} = require("../shared/desktop-detection.cjs");

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
