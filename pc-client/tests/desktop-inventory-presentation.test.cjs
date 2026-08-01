"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  reconcileDesktopInstalledEvidence,
  reconcileDesktopInventoryStage
} = require("../shared/desktop-inventory-presentation.cjs");

test("an externally removed desktop returns to its trusted downloaded package", () => {
  assert.equal(
    reconcileDesktopInventoryStage({
      currentStage: "installed",
      installed: false,
      detection: "absent",
      completedPackage: true
    }),
    "downloaded"
  );
});

test("an externally removed desktop without a trusted package becomes installable", () => {
  assert.equal(
    reconcileDesktopInventoryStage({
      currentStage: "installed",
      installed: false,
      detection: "absent",
      completedPackage: false
    }),
    "ready"
  );
});

test("an unknown desktop scan is not treated as an absent installation", () => {
  assert.equal(
    reconcileDesktopInventoryStage({
      currentStage: "installed",
      installed: false,
      detection: "unknown",
      completedPackage: true
    }),
    "detection-error"
  );
});

test("only trusted absence clears previously installed desktop evidence", () => {
  assert.equal(
    reconcileDesktopInstalledEvidence({
      hadInstalledEvidence: true,
      installed: false,
      detection: "absent"
    }),
    false
  );
  assert.equal(
    reconcileDesktopInstalledEvidence({
      hadInstalledEvidence: true,
      installed: false,
      detection: "unknown"
    }),
    true
  );
});
