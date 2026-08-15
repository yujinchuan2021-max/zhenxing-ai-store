"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  MICROSOFT_STORE_PACKAGE_FAMILY_NAME,
  analyzeMicrosoftStoreHealth,
  buildMicrosoftStoreRepairDialog,
  microsoftStoreRepairSettingsUri
} = require("../shared/microsoft-store-repair.cjs");

function storePackage(overrides = {}) {
  return {
    Name: "Microsoft.WindowsStore",
    PackageFamilyName: MICROSOFT_STORE_PACKAGE_FAMILY_NAME,
    Publisher:
      "CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US",
    Version: "22606.1401.11.0",
    ...overrides
  };
}

test("Store health accepts only the fixed Microsoft package identity", () => {
  const healthy = analyzeMicrosoftStoreHealth({
    scanOk: true,
    packages: [storePackage()],
    endpointReachable: true
  });
  assert.equal(healthy.storePresent, true);
  assert.equal(healthy.packageFamilyName, MICROSOFT_STORE_PACKAGE_FAMILY_NAME);

  const lookalike = analyzeMicrosoftStoreHealth({
    scanOk: true,
    packages: [storePackage({ Publisher: "CN=Example Corp" })],
    endpointReachable: true
  });
  assert.equal(lookalike.storePresent, false);
});

test("Store repair follows Microsoft's cache-reset then advanced-repair path", () => {
  const health = analyzeMicrosoftStoreHealth({
    scanOk: true,
    packages: [storePackage()],
    endpointReachable: true
  });
  const presentation = buildMicrosoftStoreRepairDialog({ health });
  assert.deepEqual(presentation.actions, [
    "close",
    "open-repair-settings",
    "reset-cache"
  ]);
  assert.match(presentation.options.detail, /wsreset\.exe/);
  assert.match(presentation.options.detail, /先选“修复”.*再选“重置”/);
  assert.equal(
    microsoftStoreRepairSettingsUri(health),
    `ms-settings:appsfeatures-app?${MICROSOFT_STORE_PACKAGE_FAMILY_NAME}`
  );
});

test("a failed Store endpoint check offers network settings without changing them", () => {
  const health = analyzeMicrosoftStoreHealth({
    scanOk: true,
    packages: [storePackage()],
    endpointReachable: false
  });
  const presentation = buildMicrosoftStoreRepairDialog({
    language: "en",
    health
  });
  assert.deepEqual(presentation.actions, [
    "close",
    "open-proxy-settings",
    "reset-cache"
  ]);
  assert.match(presentation.options.detail, /will not change your VPN or proxy/i);
});

test("a missing Store package routes to Windows Update and Microsoft help", () => {
  const health = analyzeMicrosoftStoreHealth({
    scanOk: true,
    packages: [],
    endpointReachable: true
  });
  const presentation = buildMicrosoftStoreRepairDialog({ health });
  assert.deepEqual(presentation.actions, [
    "close",
    "open-windows-update",
    "open-official-help"
  ]);
});

test("Electron keeps Store repair fixed and Store-only", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  assert.match(source, /runMicrosoftStoreRepairTool/);
  assert.match(source, /wsreset\.exe/);
  assert.match(source, /ms-settings:network-proxy/);
  assert.match(source, /ms-settings:windowsupdate/);
  assert.match(source, /installerKind === "store-bootstrapper"/);
  assert.doesNotMatch(
    source.match(/async function runMicrosoftStoreRepairTool[\s\S]*?function showLocalizedOpenDialog/)?.[0] || "",
    /Set-ItemProperty|Add-AppxPackage|Remove-AppxPackage|Set-Service|sc\.exe/
  );
});
