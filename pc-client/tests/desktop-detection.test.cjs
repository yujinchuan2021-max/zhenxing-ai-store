"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  bindRegistryEvidenceToAuthenticode,
  matchesDesktopIdentity,
  resolveDesktopLegacyMigration,
  resolveDesktopPresence,
  signatureInspectionIsConclusive,
  selectTrustedDesktopRegistryMatch
} = require("../shared/desktop-detection.cjs");

test("a legacy Comfy installation produces only a migration hint", () => {
  assert.equal(
    resolveDesktopLegacyMigration({
      currentInstalled: false,
      legacyInstallId: "comfy-desktop-v1",
      legacyRegistryMatched: true,
      legacyExecutableSignature: { ok: true, status: "Valid" }
    }),
    "comfy-desktop-v1"
  );
  assert.equal(
    resolveDesktopLegacyMigration({
      currentInstalled: true,
      legacyInstallId: "comfy-desktop-v1",
      legacyRegistryMatched: true,
      legacyExecutableSignature: { ok: true, status: "Valid" }
    }),
    ""
  );
  assert.equal(
    resolveDesktopLegacyMigration({
      currentInstalled: false,
      legacyInstallId: "comfy-desktop-v1",
      legacyRegistryMatched: true,
      legacyExecutableSignature: { ok: false, status: "NotSigned" }
    }),
    ""
  );
});

test("registry presence is accepted only with the allowed Authenticode result", () => {
  const registryMatch = { displayname: "Claude" };
  assert.equal(
    bindRegistryEvidenceToAuthenticode({
      registryMatch,
      executableSignature: { ok: true, status: "Valid", signer: "Anthropic" }
    }),
    registryMatch
  );
  for (const executableSignature of [
    null,
    { ok: false, status: "NotSigned", signer: "" },
    { ok: false, status: "Valid", signer: "Wrong Vendor" }
  ]) {
    assert.equal(
      bindRegistryEvidenceToAuthenticode({
        registryMatch,
        executableSignature
      }),
      null
    );
  }
});

test("a transient Windows signature inspection failure is inconclusive", () => {
  for (const status of ["Unknown", "UnknownError", "NotFound", ""]) {
    assert.equal(signatureInspectionIsConclusive({ status }), false);
  }
  for (const status of ["Valid", "NotSigned", "HashMismatch", "NotTrusted"]) {
    assert.equal(signatureInspectionIsConclusive({ status }), true);
  }
  assert.equal(signatureInspectionIsConclusive(null), false);
});

test("an appx product cannot be impersonated by an untrusted same-name uninstall entry", () => {
  const fakeEntry = { displayname: "ChatGPT", displayicon: "C:\\Fake\\ChatGPT.exe" };
  assert.equal(
    selectTrustedDesktopRegistryMatch({
      uninstallPolicy: null,
      uninstallRecord: { entry: fakeEntry }
    }),
    null
  );
  assert.equal(
    selectTrustedDesktopRegistryMatch({
      uninstallPolicy: { displayName: /^ChatGPT$/i },
      uninstallRecord: { entry: fakeEntry }
    }),
    fakeEntry
  );
});

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
