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

test("local TLS pinning delegates writes to the locked deployment boundary", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../scripts/pin-local-release-tls.cjs"),
    "utf8"
  );
  assert.match(source, /writeLocalReleaseTrustOverlay\(/);
  assert.doesNotMatch(source, /fs\.writeFileSync\(/);
  assert.doesNotMatch(source, /fs\.mkdirSync\(/);
});

test("local prepare retains rollback state, attests both Windows artifacts and cleans failed staging", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../scripts/prepare-local-release.cjs"),
    "utf8"
  );
  assert.match(source, /attestedArtifactPaths:\s*\[installerPath, portablePath\]/);
  assert.match(source, /retainPreviousRelease:\s*true/);
  assert.match(source, /discardStagedBundleCandidateBestEffort\(/);
  assert.match(source, /rollbackActivatedRelease\(/);
  assert.match(source, /else\s*\{[\s\S]*finalizeActivatedRelease\(/);
  assert.doesNotMatch(source, /discardActivatedLocalReleaseBackup/);
});

test("one-command local upgrade packages before publishing and ends with packaged acceptance", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../scripts/upgrade-local-release.ps1"),
    "utf8"
  );
  const containerSource = fs.readFileSync(
    path.resolve(__dirname, "../scripts/rebuild-local-app-services.ps1"),
    "utf8"
  );
  const packageIndex = source.indexOf('Invoke-NpmScript "package:win:local-release"');
  const prepareIndex = source.indexOf(
    'Invoke-NodeScript "scripts/prepare-local-release.cjs"'
  );
  const verifyIndex = source.indexOf('Invoke-NpmScript "release:local:verify"');
  const serverAcceptanceIndex = source.indexOf(
    'Invoke-NpmScript "release:local:test-server"'
  );
  const acceptanceIndex = source.indexOf('Invoke-NpmScript "release:local:test-client"');
  const testIndex = source.indexOf('Invoke-NpmScript "test"');
  const buildIndex = source.indexOf('Invoke-NpmScript "build"');
  const auditIndex = source.indexOf("Invoke-NpmAudit", buildIndex);
  const rebuildIndex = source.indexOf(
    'Invoke-NpmScript "release:local:rebuild-app-services"',
    auditIndex
  );
  const recreateIndex = source.indexOf(
    'Invoke-NpmScript "release:local:recreate-server"',
    rebuildIndex
  );
  const pinIndex = source.indexOf(
    'Invoke-NpmScript "release:local:pin-tls"',
    recreateIndex
  );
  const remountIndex = source.indexOf(
    'Invoke-NpmScript "release:local:recreate-server"',
    recreateIndex + 1
  );
  const rollbackIndex = source.indexOf(
    "rollback-local-release.cjs",
    prepareIndex
  );
  const finalizeIndex = source.indexOf(
    "finalize-local-release.cjs",
    acceptanceIndex
  );
  assert.ok(testIndex >= 0);
  assert.ok(buildIndex > testIndex);
  assert.ok(auditIndex > buildIndex);
  assert.ok(rebuildIndex > auditIndex);
  assert.ok(recreateIndex >= 0);
  assert.ok(recreateIndex > rebuildIndex);
  assert.ok(pinIndex > recreateIndex);
  assert.ok(packageIndex > pinIndex);
  assert.ok(prepareIndex > packageIndex);
  assert.ok(verifyIndex > prepareIndex);
  assert.ok(remountIndex > verifyIndex);
  assert.ok(serverAcceptanceIndex > remountIndex);
  assert.ok(acceptanceIndex > serverAcceptanceIndex);
  assert.ok(rollbackIndex > prepareIndex);
  assert.ok(finalizeIndex > acceptanceIndex);
  assert.match(
    source,
    /prepare-local-release\.cjs[\s\S]*\$TransactionPrepared = \$true[\s\S]*release:local:verify/
  );
  assert.match(source, /Restore-ReleaseServerAfterRollback/);
  assert.match(source, /Stop-ReleaseServerFailClosed/);
  assert.match(source, /-not \$TransactionPrepared[\s\S]*Remove-Item/);
  assert.match(source, /transaction receipt preserved for recovery/);
  assert.match(containerSource, /--build/);
  assert.match(containerSource, /--force-recreate/);
  assert.match(containerSource, /--no-cache/);
  assert.match(containerSource, /Stop-SelfBuiltServiceFailClosed/);
  assert.match(containerSource, /Stop-AllSelfBuiltServicesFailClosed/);
  assert.doesNotMatch(containerSource, /\[System\.IO\.Path\]::GetRelativePath/);
  assert.match(
    containerSource,
    /Test-ContainerSourceManifest[\s\S]*Stop-SelfBuiltServiceFailClosed[\s\S]*Repair-SelfBuiltServiceImage/
  );
  assert.match(containerSource, /Get-AdminSourceManifest/);
  assert.match(
    containerSource,
    /Get-ChildItem[^\r\n]*\$AdminRoot[^\r\n]*-Recurse[^\r\n]*-Filter "\*\.cjs"/
  );
  assert.match(containerSource, /Get-IdentitySourceManifest/);
  assert.match(containerSource, /Get-CommunitySourceManifest/);
  assert.match(containerSource, /admin\/public\/app\.js/);
  assert.match(containerSource, /identity\/server\.cjs/);
  assert.match(containerSource, /community\/flarum\/aihub-sso\.php/);
  const dockerIgnore = fs.readFileSync(
    path.resolve(__dirname, "../.dockerignore"),
    "utf8"
  );
  assert.match(dockerIgnore, /!identity\/\*\*[\s\S]*identity\/node_modules\//);
});

test("the local HTTPS allowlist serves signed build provenance", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../deployment/local/Caddyfile"),
    "utf8"
  );
  assert.match(source, /@manifest path[^\r\n]*\/build-provenance\.json/);
  assert.match(source, /@allowedFiles path[^\r\n]*\/build-provenance\.json/);
});
