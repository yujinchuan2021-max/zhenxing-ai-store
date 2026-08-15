"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const main = fs.readFileSync(
  path.resolve(__dirname, "../electron/main.cjs"),
  "utf8"
);
const preload = fs.readFileSync(
  path.resolve(__dirname, "../electron/preload.cjs"),
  "utf8"
);
const renderer = fs.readFileSync(
  path.resolve(__dirname, "../src/App.tsx"),
  "utf8"
);

test("Electron locates App Installer directly and never shells out to winget", () => {
  const locator = main.match(
    /async function resolveWindowsPackageManagerExecutable[\s\S]*?function windowsPackageManagerFailure/
  )?.[0];
  const runner = main.match(
    /async function runWindowsPackageManager[\s\S]*?async function scanWindowsPackageManager/
  )?.[0];
  assert.ok(locator);
  assert.ok(runner);
  assert.match(locator, /Get-AppxPackage -Name Microsoft\.DesktopAppInstaller/);
  assert.match(locator, /InstallLocation 'winget\.exe'/);
  assert.match(locator, /execFileAsync\([\s\S]*?shell: false/);
  assert.match(runner, /wingetArgsFor\(operation, plan\)/);
  assert.match(runner, /execFileAsync\(executable, args,[\s\S]*?shell: false/);
  assert.doesNotMatch(`${locator}\n${runner}`, /shell:\s*true|spawn\(/);
});

test("package-manager inventory is scanned once and matched by fixed package id", () => {
  const bulk = main.match(
    /async function detectDesktopProducts[\s\S]*?async function uninstallTrustedAppxProduct/
  )?.[0];
  const detector = main.match(
    /async function detectWindowsPackageManagerProduct[\s\S]*?async function scanWindowsApps/
  )?.[0];
  assert.ok(bulk);
  assert.ok(detector);
  assert.match(bulk, /createDesktopProductScanSnapshot\(\{ includeWindowsPackageManager \}\)/);
  assert.match(detector, /findWingetListEntry\([\s\S]*?product\.packageManager\.packageId/);
  assert.match(detector, /availableVersion: String\(entry\?\.availableVersion/);
  assert.match(detector, /matchesDesktopIdentity\(expectedNames, candidate\.Name\)/);
  assert.match(detector, /matchesDesktopIdentity\(expectedNames, candidate\.displayname\)/);
  assert.match(detector, /path\.isAbsolute\(proposed\)/);
  assert.match(detector, /fs\.realpathSync\.native\(proposed\)/);
});

test("install admission and uninstall both stay behind the static package registry", () => {
  const admission = main.match(
    /async function authorizeCurrentWindowsPackageManagerProduct[\s\S]*?async function reconcileWindowsPackageManagerProduct/
  )?.[0];
  const reconcile = main.match(
    /async function reconcileWindowsPackageManagerProduct[\s\S]*?async function uninstallWindowsPackageManagerProduct/
  )?.[0];
  const ownership = main.match(
    /function claimWindowsPackageManagerInstallation[\s\S]*?async function scanWindowsApps/
  )?.[0];
  const uninstall = main.match(
    /async function uninstallWindowsPackageManagerProduct[\s\S]*?async function scanApprovedProductInventory/
  )?.[0];
  const uninstallHandler = main.match(
    /ipcMain\.handle\("desktop:uninstall"[\s\S]*?ipcMain\.handle\("desktop:open-location"/
  )?.[0];
  assert.ok(admission);
  assert.ok(reconcile);
  assert.ok(ownership);
  assert.ok(uninstall);
  assert.ok(uninstallHandler);
  assert.match(admission, /authorizeFreshCatalogProduct\(/);
  assert.match(admission, /resolveManagedProductActionContext\(/);
  assert.match(admission, /context\.downloadPolicy !== "package-manager"/);
  assert.match(admission, /context\.installProfileId !== product\.profileId/);
  assert.match(reconcile, /getWindowsPackageManagerProduct\(productId\)/);
  assert.match(
    reconcile,
    /authorizeCurrentWindowsPackageManagerProduct\(productId\)/
  );
  assert.match(reconcile, /activeDesktopOperationEntries\.add\(productId\)/);
  assert.match(reconcile, /claimWindowsPackageManagerInstallation\(/);
  assert.match(ownership, /createWindowsPackageManagerReceipt\(/);
  assert.match(ownership, /setWindowsPackageManagerRecord\(/);
  assert.match(reconcile, /shouldOwnAfter = !before\.installed \|\| before\.ownership === "managed"/);
  assert.match(uninstall, /windowsPackageManagerReceiptMatches\(/);
  assert.match(uninstall, /ms-settings:appsfeatures/);
  assert.match(uninstall, /removeWindowsPackageManagerRecordStrict\(productId\)/);
  assert.match(uninstallHandler, /windowsPackageManagerPlan\(productId\)/);
  assert.ok(
    uninstallHandler.indexOf("windowsPackageManagerPlan(productId)") <
      uninstallHandler.indexOf("const probe = DESKTOP_PROBES[productId]")
  );
});

test("Store packages keep the VPN warning and official repair flow inside the fixed driver", () => {
  const confirmation = main.match(
    /async function confirmWindowsPackageManagerInstall[\s\S]*?async function authorizeCurrentWindowsPackageManagerProduct/
  )?.[0];
  const reconcile = main.match(
    /async function reconcileWindowsPackageManagerProduct[\s\S]*?async function uninstallWindowsPackageManagerProduct/
  )?.[0];
  assert.ok(confirmation);
  assert.ok(reconcile);
  assert.match(confirmation, /product\.packageManager\.source === "msstore"/);
  assert.match(confirmation, /WPM_STORE_CONFIRM/);
  assert.match(confirmation, /runMicrosoftStoreRepairTool\(\)/);
  assert.match(reconcile, /product\.packageManager\.source === "msstore"/);
  assert.match(reconcile, /runMicrosoftStoreRepairTool\(\)/);
});

test("package-manager installation is not exposed to the renderer", () => {
  assert.doesNotMatch(main, /ipcMain\.handle\("desktop-package:reconcile"/);
  assert.doesNotMatch(preload, /reconcileDesktopPackage|desktop-package:reconcile/);
  assert.doesNotMatch(renderer, /reconcileDesktopPackage/);
});

test("desktop products without a direct package open the official download page", () => {
  const install = renderer.match(
    /const installUsingUnifiedRule[\s\S]*?const requestUnifiedInstall/
  )?.[0];
  assert.ok(install);
  assert.match(
    install,
    /if \(behavior\.managedDesktop\) \{\s*window\.open\(product\.website\);\s*return;\s*\}/
  );
  assert.doesNotMatch(install, /managed-package-manager|reconcileDesktopPackage/);
});

test("package-manager detection scans its three Windows inventories in parallel", () => {
  const detector = main.match(
    /async function detectWindowsPackageManagerProduct[\s\S]*?async function scanWindowsApps/
  )?.[0];
  assert.ok(detector);
  assert.match(
    detector,
    /await Promise\.all\(\[[\s\S]*?scanWindowsPackageManager\(\)[\s\S]*?scanWindowsApps\(\)[\s\S]*?scanRegistryAppsWithStatus\(\)[\s\S]*?\]\)/
  );
});

test("the legacy package-manager installer has no renderer entry point", () => {
  const reconcile = main.match(
    /async function reconcileWindowsPackageManagerProduct[\s\S]*?async function uninstallWindowsPackageManagerProduct/
  )?.[0];
  assert.ok(reconcile);
  assert.match(reconcile, /getDesktopOperationController\(\)/);
  assert.match(reconcile, /operationController\.begin\(productId, "install"\)/);
  assert.match(reconcile, /launchProcessWithGrace\(/);
  assert.match(reconcile, /operationTask/);
  assert.doesNotMatch(main, /ipcMain\.handle\("desktop-package:reconcile"/);
  assert.doesNotMatch(preload, /reconcileDesktopPackage/);
  assert.doesNotMatch(renderer, /reconcileDesktopPackage/);
});
