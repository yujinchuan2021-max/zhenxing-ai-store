"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { getManagedDownload } = require("../shared/managed-downloads.cjs");
const CORE_DESKTOP_DOWNLOADS = [
  "chatgpt-desktop",
  "claude-desktop",
  "comfy-desktop",
  "ollama-cli"
];

test("the four core desktop downloads carry a direct HTTPS file contract", () => {
  for (const productId of CORE_DESKTOP_DOWNLOADS) {
    const plan = getManagedDownload(productId);
    assert.ok(plan, productId);
    assert.equal(new URL(plan.url).protocol, "https:", productId);
    assert.ok(plan.allowedHosts.includes(new URL(plan.url).hostname), productId);
    assert.match(plan.fileName, /\.(?:exe|msi|msix|zip)$/i, productId);
  }
});

test("desktop packages open directly without installer-content validation", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const launch = source.match(
    /ipcMain\.handle\("installer:launch"[\s\S]*?ipcMain\.handle\("desktop:operation-get"/
  )?.[0];
  assert.ok(launch);
  assert.match(launch, /inspectCompletedDownloadRecord\(productId\)/);
  assert.match(launch, /shell\.openPath\(resolvedFile\)/);
  assert.match(launch, /verificationMode:\s*"manual-installer"/);
  assert.match(
    launch,
    /if \(managedDownload\?\.installerKind === "store-bootstrapper"\)[\s\S]*?showDesktopInstallConfirmation/
  );
  assert.doesNotMatch(
    launch,
    /inspectWindowsInstallerIdentity|fileSha256|verifyExpectedSignature|installPortableDesktopProduct|operationController\.begin\(/
  );
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
  assert.match(
    app,
    /window\.aihubPC\.refreshDownload\(product\.id, product\.download\)/
  );
});

test("a fresh desktop download commits the file before old-package cleanup", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const completion = main.match(
    /function beginManagedDownloadAttempt[\s\S]*?return advanceManagedDownloadCompleted\(/
  )?.[0];
  assert.ok(completion);
  const commitAt = completion.indexOf("commitManagedDownloadReplacement({");
  assert.ok(commitAt >= 0);
  assert.doesNotMatch(completion, /inspectManagedDesktopDownloadRecord\(/);
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

test("PowerShell JSON probes force UTF-8 before reading localized identities", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  assert.match(
    main,
    /const POWERSHELL_UTF8_OUTPUT =\s*\n?\s*"\[Console\]::OutputEncoding=\[System\.Text\.UTF8Encoding\]::new\(\$false\)"/
  );
  assert.ok(
    (main.match(/POWERSHELL_UTF8_OUTPUT,/g) || []).length >= 4,
    "every JSON-producing PowerShell probe must preserve localized text"
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
