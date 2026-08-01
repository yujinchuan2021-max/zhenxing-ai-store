"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { getManagedDownload } = require("../shared/managed-downloads.cjs");
const {
  validateWindowsInstallerIdentity
} = require("../shared/windows-installer-identity.cjs");

const MACHINE = Object.freeze({ x86: 0x014c, x64: 0x8664 });

function peFixture(architecture) {
  const buffer = Buffer.alloc(0x200);
  buffer.write("MZ", 0, "ascii");
  buffer.writeUInt32LE(0x80, 0x3c);
  buffer.write("PE\0\0", 0x80, "binary");
  buffer.writeUInt16LE(MACHINE[architecture], 0x84);
  return buffer;
}

const OBSERVED_VERSION_INFO = Object.freeze({
  "chatgpt-desktop": Object.freeze({
    ProductName: "Store Installer",
    FileDescription: "Store Installer",
    OriginalFilename: "StoreInstaller.exe",
    CompanyName: "Microsoft Corporation"
  }),
  "claude-desktop": Object.freeze({
    ProductName: "Claude",
    FileDescription: "Claude Setup",
    OriginalFilename: "ClaudeSetup.exe",
    CompanyName: "Anthropic, PBC"
  }),
  "comfy-desktop": Object.freeze({
    ProductName: "Comfy Desktop",
    FileDescription: "Comfy Desktop",
    OriginalFilename: "",
    CompanyName: "Comfy Org"
  }),
  "ollama-cli": Object.freeze({
    ProductName: "Ollama                                                      ",
    FileDescription: "Ollama Setup                                                ",
    OriginalFilename: "                                                  ",
    CompanyName: "Ollama                                                      "
  })
});

test("the four core desktop downloads carry an executable identity contract", () => {
  for (const productId of Object.keys(OBSERVED_VERSION_INFO)) {
    const plan = getManagedDownload(productId);
    assert.ok(plan.expectedInstallerIdentity, productId);
    assert.ok(
      ["store-bootstrapper", "vendor-installer"].includes(plan.installerKind),
      productId
    );
    const expected = plan.expectedInstallerIdentity;
    const result = validateWindowsInstallerIdentity({
      buffer: peFixture(expected.architecture),
      versionInfo: OBSERVED_VERSION_INFO[productId],
      expected
    });
    assert.equal(result.ok, true, productId);
  }
});

test("installer inspection and launch share the same hash, signature and identity gate", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const inspection = source.match(
    /async function inspectManagedDesktopDownloadRecord[\s\S]*?function removeTrustedCompletedPackage/
  )?.[0];
  const launch = source.match(
    /ipcMain\.handle\("installer:launch"[\s\S]*?ipcMain\.handle\("desktop:operation-get"/
  )?.[0];
  assert.ok(inspection);
  assert.ok(launch);
  assert.match(inspection, /inspectWindowsInstallerIdentity\(/);
  assert.match(launch, /inspectCompletedDownloadRecord\(productId\)/);
  assert.doesNotMatch(launch, /productId === "chatgpt-desktop"/);
});

test("fresh installer retrieval is a dedicated reviewed IPC action", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../electron/preload.cjs"),
    "utf8"
  );
  const app = fs.readFileSync(
    path.resolve(__dirname, "../src/App.tsx"),
    "utf8"
  );
  assert.match(main, /ipcMain\.handle\("download:refresh"/);
  assert.match(main, /startFreshManagedDownload\(productId\)/);
  assert.match(preload, /refreshDownload:[\s\S]*?"download:refresh"/);
  assert.match(app, /intent === "refresh"/);
  assert.match(app, /window\.aihubPC\.refreshDownload\(product\.id\)/);
});

test("a replacement is fully verified before its record commit and old-package cleanup", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const completion = main.match(
    /function beginManagedDownloadAttempt[\s\S]*?return advanceManagedDownloadCompleted\(/
  )?.[0];
  assert.ok(completion);
  const verifyAt = completion.indexOf(
    "inspectManagedDesktopDownloadRecord("
  );
  const commitAt = completion.indexOf("commitManagedDownloadReplacement({");
  assert.ok(verifyAt >= 0);
  assert.ok(commitAt > verifyAt);
  assert.doesNotMatch(
    main.match(
      /function startFreshManagedDownloadAfterAdmission[\s\S]*?function startFreshManagedDownload\(/
    )?.[0] || "",
    /removeTrustedCompletedPackage\(/
  );
  assert.match(completion, /expectedFileName: plan\.fileName/);
  assert.match(main, /async function retryPersistedSupersededPackageCleanup/);
  assert.match(
    main,
    /await retryPersistedSupersededPackageCleanup\(\)[\s\S]*?managedDownloadCleanupCapacity\(records\)/
  );
  assert.match(
    main,
    /await configureSystemNetwork\(\)[\s\S]*?await retryPersistedSupersededPackageCleanup\(\)/
  );
});

test("a failed refresh cannot block launching the retained trusted package", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const launch = main.match(
    /ipcMain\.handle\("installer:launch"[\s\S]*?const operationController/
  )?.[0];
  assert.ok(launch);
  assert.match(
    launch,
    /const retainedCompletedRecord = trustedCompletedDownloadRecord\(productId\)/
  );
  assert.match(
    launch,
    /activeDownloads\.has\(productId\) \|\| !retainedCompletedRecord/
  );
});

test("an unavailable Windows signature probe is neither cached nor treated as absence", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const verifier = main.match(
    /async function verifyExpectedSignature[\s\S]*?function parseRegistryOutput/
  )?.[0];
  const detector = main.match(
    /async function detectDesktopProduct[\s\S]*?async function detectDesktopProducts/
  )?.[0];
  assert.ok(verifier);
  assert.ok(detector);
  assert.match(
    verifier,
    /if \(signatureInspectionIsConclusive\(result\)\) \{[\s\S]*?trustedSignatureCache\.set/
  );
  assert.match(detector, /const registryEvidenceScanSucceeded =/);
  assert.match(
    detector,
    /registryScanSucceeded: registryEvidenceScanSucceeded/
  );
});

test("desktop detection reports a signed legacy Comfy installation as migration-only evidence", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const detector = main.match(
    /async function detectDesktopProduct[\s\S]*?async function detectDesktopProducts/
  )?.[0];

  assert.ok(detector);
  assert.match(detector, /probe\.legacyInstall/);
  assert.match(detector, /resolveDesktopLegacyMigration\(/);
  assert.match(detector, /legacyInstall/);
});

test("Claude Appx uninstall opens Windows package management instead of silently removing the package", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const appxUninstall = main.match(
    /async function uninstallTrustedAppxProduct[\s\S]*?async function closeReviewedProcesses/
  )?.[0];

  assert.ok(appxUninstall);
  assert.match(appxUninstall, /uninstallStrategy === "windows-settings"/);
  assert.match(appxUninstall, /shell\.openExternal\("ms-settings:appsfeatures"\)/);
});
