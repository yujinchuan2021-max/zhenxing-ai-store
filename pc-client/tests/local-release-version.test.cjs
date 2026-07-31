"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const packageJson = require("../package.json");
const localReleaseConfig = require("../electron-builder.local-release.cjs");

test("the local acceptance client uses the package version without a stale override", () => {
  assert.equal(localReleaseConfig.extraMetadata.version, packageJson.version);
});

test("the portable acceptance client isolates Windows profile directories instead of touching the live user profile", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../scripts/verify-local-release-client.mjs"),
    "utf8"
  );
  const cdpSource = fs.readFileSync(
    path.resolve(__dirname, "../scripts/lib/packaged-client-cdp.mjs"),
    "utf8"
  );
  assert.match(source, /createIsolatedAcceptanceProfile/);
  assert.match(source, /launchPackagedClientCdp/);
  assert.match(source, /verifyManagedDownloadPause/);
  assert.match(cdpSource, /APPDATA:\s*profile\.appData/);
  assert.match(cdpSource, /LOCALAPPDATA:\s*profile\.localAppData/);
  assert.match(cdpSource, /--user-data-dir=\$\{profile\.userData\}/);
  assert.match(cdpSource, /assertNoExistingAIHubProcesses\(\)/);
});

test("local packaging refuses an expired trust pin before building artifacts", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../scripts/package-local-release.cjs"),
    "utf8"
  );
  assert.match(source, /validateLocalReleaseTrust\(/);
  assert.match(source, /channelFromResources\("local-release-trust\.json"\)/);
});

test("one-command local upgrade packages before publishing and ends with packaged acceptance", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../scripts/upgrade-local-release.ps1"),
    "utf8"
  );
  const recreateIndex = source.indexOf('Invoke-NpmScript "release:local:recreate-server"');
  const pinIndex = source.indexOf('Invoke-NpmScript "release:local:pin-tls"');
  const packageIndex = source.indexOf('Invoke-NpmScript "package:win:local-release"');
  const prepareIndex = source.indexOf('Invoke-NpmScript "release:local:prepare"');
  const verifyIndex = source.indexOf('Invoke-NpmScript "release:local:verify"');
  const remountIndex = source.indexOf(
    'Invoke-NpmScript "release:local:recreate-server"',
    recreateIndex + 1
  );
  const serverAcceptanceIndex = source.indexOf(
    'Invoke-NpmScript "release:local:test-server"'
  );
  const acceptanceIndex = source.indexOf('Invoke-NpmScript "release:local:test-client"');
  assert.ok(recreateIndex >= 0);
  assert.ok(pinIndex > recreateIndex);
  assert.ok(packageIndex > pinIndex);
  assert.ok(prepareIndex > packageIndex);
  assert.ok(verifyIndex > prepareIndex);
  assert.ok(remountIndex > verifyIndex);
  assert.ok(serverAcceptanceIndex > remountIndex);
  assert.ok(acceptanceIndex > serverAcceptanceIndex);
});

test("the local HTTPS allowlist serves signed build provenance", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../deployment/local/Caddyfile"),
    "utf8"
  );
  assert.match(source, /@manifest path[^\r\n]*\/build-provenance\.json/);
  assert.match(source, /@allowedFiles path[^\r\n]*\/build-provenance\.json/);
});
