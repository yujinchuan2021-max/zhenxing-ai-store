"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const packageJson = require("../package.json");
const localReleaseConfig = require("../electron-builder.local-release.cjs");

const upgradeSource = fs.readFileSync(
  path.resolve(__dirname, "../scripts/upgrade-local-release.ps1"),
  "utf8"
);

test("the local acceptance client uses the package version without a stale override", () => {
  assert.equal(localReleaseConfig.extraMetadata.version, packageJson.version);
  assert.equal(
    packageJson.scripts["test:release"],
    "node --test --test-reporter=dot tests/*.test.cjs"
  );
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

test("local packaging captures and continuously rechecks the tagged clean source", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../scripts/package-local-release.cjs"),
    "utf8"
  );
  assert.match(source, /validateLocalReleaseTrust\(/);
  assert.match(source, /channelFromResources\("local-release-trust\.json"\)/);
  assert.match(source, /requireClean:\s*true/);
  assert.match(source, /requireVersionTag:\s*true/);
  const sourceCaptureIndex = source.indexOf(
    "const releaseSource = inspectGitReleaseSource"
  );
  const buildIndex = source.indexOf('run("npm.cmd", ["run", "build"]');
  const builderIndex = source.indexOf('run("npx.cmd", [');
  assert.ok(sourceCaptureIndex >= 0 && sourceCaptureIndex < buildIndex);
  assert.ok(buildIndex < builderIndex);
  assert.match(source, /assertReleaseSourceUnchanged\(\);[\s\S]*run\("npm\.cmd"/);
  assert.match(
    source,
    /run\("npm\.cmd"[\s\S]*assertReleaseSourceUnchanged\(\);[\s\S]*run\("npx\.cmd"/
  );
  assert.match(
    source,
    /run\("npx\.cmd"[\s\S]*assertReleaseSourceUnchanged\(\);/
  );
});

test("the durable delivery retirement directory cannot dirty the tagged source mid-transaction", () => {
  const ignore = fs.readFileSync(path.resolve(__dirname, "../.gitignore"), "utf8");
  assert.match(ignore, /^\.release-local-server-client-retired-\*\/$/m);
});

test("recovery removes the release-server container before restoring Windows runtime files", () => {
  assert.match(
    upgradeSource,
    /docker compose -f \$ComposeFile rm -f -s release-server/
  );
  assert.match(
    upgradeSource,
    /ps -a -q release-server/
  );
});

test("rollback verifies signed previous releases without requiring the newer catalog policy", () => {
  const verifier = fs.readFileSync(
    path.resolve(__dirname, "../scripts/verify-local-release.cjs"),
    "utf8"
  );
  assert.match(
    upgradeSource,
    /verify-local-release\.cjs" @\([\s\S]*--allow-catalog-policy-drift/
  );
  assert.match(
    verifier,
    /args\.length === 1 && args\[0\] === "--allow-catalog-policy-drift"/
  );
  assert.match(verifier, /allowCatalogPolicyDrift/);
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

test("local prepare retains exact rollback state for the master transaction", () => {
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

test("one-command upgrade journals before every live mutation and advances all release boundaries", () => {
  const statusIndex = upgradeSource.lastIndexOf(
    "$Pending = Get-UpgradeJournalStatus"
  );
  const testIndex = upgradeSource.lastIndexOf(
    'Invoke-NpmScript "test:release"'
  );
  const buildIndex = upgradeSource.lastIndexOf('Invoke-NpmScript "build"');
  const auditIndex = upgradeSource.lastIndexOf("Invoke-NpmAudit");
  const sourceAuditIndex = upgradeSource.lastIndexOf(
    'Invoke-NpmScript "audit:desktop-sources"'
  );
  const layoutIndex = upgradeSource.lastIndexOf(
    'Invoke-NpmScript "test:product-layout"'
  );
  const beginIndex = upgradeSource.lastIndexOf(
    '"scripts/manage-local-release-upgrade-journal.cjs" `'
  );
  const deliveryStartingIndex = upgradeSource.lastIndexOf(
    'Set-UpgradeJournalPhase "delivery-activating"'
  );
  const recreateIndex = upgradeSource.indexOf(
    'Invoke-NpmScript "release:local:recreate-server"',
    deliveryStartingIndex
  );
  const packageIndex = upgradeSource.lastIndexOf(
    'Invoke-NodeScript "scripts/package-local-release.cjs"'
  );
  const runtimeStartingIndex = upgradeSource.lastIndexOf(
    'Set-UpgradeJournalPhase "runtime-activating"'
  );
  const prepareIndex = upgradeSource.lastIndexOf(
    'Invoke-NodeScript "scripts/prepare-local-release.cjs"'
  );
  const serviceStageIndex = upgradeSource.lastIndexOf(
    '"-Action", "stage"'
  );
  const servicePromoteIndex = upgradeSource.lastIndexOf(
    '"-Action", "promote"'
  );
  const acceptanceIndex = upgradeSource.lastIndexOf(
    'Invoke-NpmScript "release:local:test-client"'
  );
  const sealIndex = upgradeSource.lastIndexOf(
    "Seal-UpgradeJournalReceipts"
  );
  const acceptedIndex = upgradeSource.lastIndexOf(
    'Set-UpgradeJournalPhase "accepted"'
  );
  const receiptVerifyIndex = upgradeSource.indexOf(
    "Verify-SealedUpgradeReceipts",
    acceptedIndex
  );
  const runtimeFinalizeIndex = upgradeSource.lastIndexOf(
    "Invoke-RuntimeFinalizationFromJournal"
  );
  const serviceFinalizeIndex = upgradeSource.lastIndexOf(
    "Invoke-ServiceFinalizationFromJournal"
  );
  const deliveryFinalizeIndex = upgradeSource.lastIndexOf(
    "Invoke-DeliveryFinalizationFromJournal"
  );
  const completeIndex = upgradeSource.lastIndexOf("Complete-UpgradeJournal");

  assert.ok(statusIndex >= 0 && statusIndex < testIndex);
  assert.ok(buildIndex > testIndex);
  assert.ok(auditIndex > buildIndex);
  assert.ok(sourceAuditIndex > auditIndex);
  assert.ok(beginIndex > sourceAuditIndex);
  assert.ok(deliveryStartingIndex > beginIndex);
  assert.ok(recreateIndex > deliveryStartingIndex);
  assert.ok(packageIndex > recreateIndex);
  assert.ok(runtimeStartingIndex > packageIndex);
  assert.ok(prepareIndex > runtimeStartingIndex);
  assert.ok(serviceStageIndex > prepareIndex);
  assert.ok(servicePromoteIndex > serviceStageIndex);
  assert.ok(layoutIndex > servicePromoteIndex);
  assert.ok(acceptanceIndex > layoutIndex);
  assert.ok(sealIndex > acceptanceIndex);
  assert.ok(acceptedIndex > sealIndex);
  assert.ok(receiptVerifyIndex > acceptedIndex);
  assert.ok(runtimeFinalizeIndex > receiptVerifyIndex);
  assert.ok(serviceFinalizeIndex > runtimeFinalizeIndex);
  assert.ok(deliveryFinalizeIndex > serviceFinalizeIndex);
  assert.ok(completeIndex > deliveryFinalizeIndex);
});

test("the master journal supplies all exact child receipts without random temp paths", () => {
  assert.match(upgradeSource, /receiptPaths\.delivery/);
  assert.match(upgradeSource, /receiptPaths\.runtime/);
  assert.match(upgradeSource, /receiptPaths\.services/);
  assert.match(
    upgradeSource,
    /package-local-release\.cjs[\s\S]*receiptPaths\.delivery/
  );
  assert.match(
    upgradeSource,
    /prepare-local-release\.cjs[\s\S]*receiptPaths\.runtime/
  );
  assert.doesNotMatch(upgradeSource, /GetTempPath/);
  assert.doesNotMatch(upgradeSource, /NewGuid|randomUUID/);
  assert.doesNotMatch(upgradeSource, /TransactionPrepared/);
});

test("startup recovery fails closed on a corrupt fixed journal", () => {
  const statusCatch = upgradeSource.indexOf(
    "$JournalReadError = $_",
    upgradeSource.lastIndexOf("$Pending = Get-UpgradeJournalStatus")
  );
  const stopIndex = upgradeSource.indexOf(
    "Stop-AllReleaseServicesFailClosed",
    statusCatch
  );
  assert.ok(statusCatch >= 0 && stopIndex > statusCatch);
  assert.match(
    upgradeSource,
    /fixed local release journal is invalid and services could not be stopped fail-closed/i
  );
  assert.match(upgradeSource, /throw \$JournalReadError/);
});

test("pre-acceptance recovery is phase-idempotent and restores the durable runtime snapshot", () => {
  const recoveryStart = upgradeSource.indexOf(
    "function Recover-PendingLocalRelease"
  );
  const mainStart = upgradeSource.indexOf("Push-Location $ProjectRoot");
  const recoverySource = upgradeSource.slice(recoveryStart, mainStart);
  assert.match(
    recoverySource,
    /Stop-AllReleaseServicesFailClosed[\s\S]*rollback-started/
  );
  assert.match(
    recoverySource,
    /rollback-started[\s\S]*runtime-rolled-back[\s\S]*services-rolled-back[\s\S]*delivery-rolled-back/
  );
  assert.match(upgradeSource, /"restore-runtime"/);
  assert.match(upgradeSource, /"verify-runtime"/);
  assert.match(upgradeSource, /Remove-RuntimeRollbackArtifactsFromJournal/);
  assert.match(
    upgradeSource,
    /Remove-Item -LiteralPath \$Target -Recurse -Force/
  );
  assert.match(
    upgradeSource,
    /Test-TrustedReceiptFile -Path \$Receipt[\s\S]*rollback-local-release\.cjs/
  );
  assert.match(
    recoverySource,
    /delivery-rolled-back[\s\S]*Finalize-RolledBackServiceTransaction[\s\S]*Restore-ReleaseServerAfterRollback[\s\S]*Restore-LocalApplicationServicesAfterRollback[\s\S]*Complete-UpgradeJournal/
  );
});

test("accepted recovery completes each destructive finalizer before advancing its durable phase", () => {
  const recoveryStart = upgradeSource.indexOf(
    "function Recover-PendingLocalRelease"
  );
  const mainStart = upgradeSource.indexOf("Push-Location $ProjectRoot");
  const recoverySource = upgradeSource.slice(recoveryStart, mainStart);
  assert.match(
    recoverySource,
    /Verify-SealedUpgradeReceipts[\s\S]*phase -eq "accepted"[\s\S]*Invoke-RuntimeFinalizationFromJournal[\s\S]*Set-UpgradeJournalPhase "runtime-finalized"/
  );
  assert.match(
    recoverySource,
    /phase -eq "runtime-finalized"[\s\S]*Invoke-ServiceFinalizationFromJournal[\s\S]*Set-UpgradeJournalPhase "services-finalized"/
  );
  assert.match(
    recoverySource,
    /phase -eq "services-finalized"[\s\S]*Invoke-DeliveryFinalizationFromJournal[\s\S]*Set-UpgradeJournalPhase "delivery-finalized"/
  );
  assert.match(
    recoverySource,
    /Restore-AndVerifyAcceptedReleaseServices[\s\S]*Complete-UpgradeJournal/
  );
  assert.match(upgradeSource, /Test-RuntimeFinalizationAlreadyComplete/);
  assert.match(upgradeSource, /Test-DeliveryFinalizationAlreadyComplete/);
  assert.match(
    upgradeSource,
    /expectedCurrent\.source\.revision -ne \[string\]\$UpgradeJournal\.revision/
  );
  assert.match(
    upgradeSource,
    /expectedCurrent\.source\.versionTag -ne "v\$\(\$UpgradeJournal\.version\)"/
  );
});

test("the master transaction pins artifacts and service images to one Git source", () => {
  const sourceCaptureIndex = upgradeSource.lastIndexOf(
    "$ReleaseSource = Get-ExpectedReleaseSource"
  );
  const beginIndex = upgradeSource.indexOf(
    '"begin",',
    sourceCaptureIndex
  );
  const packageIndex = upgradeSource.lastIndexOf(
    'Invoke-NodeScript "scripts/package-local-release.cjs"'
  );
  const packagedSourceIndex = upgradeSource.lastIndexOf(
    "Assert-PackagedBuildSource -Source $ReleaseSource"
  );
  const serviceBeginIndex = upgradeSource.lastIndexOf(
    '"-Action", "begin"'
  );
  assert.ok(sourceCaptureIndex >= 0 && beginIndex > sourceCaptureIndex);
  assert.ok(packageIndex > beginIndex);
  assert.ok(packagedSourceIndex > packageIndex);
  assert.ok(serviceBeginIndex > packagedSourceIndex);
  assert.match(upgradeSource, /-ExpectedRevision/);
  assert.match(upgradeSource, /-ExpectedVersion/);
  assert.match(
    upgradeSource,
    /Build\.source\.revision -ne \[string\]\$Source\.revision/
  );
  assert.match(upgradeSource, /Build\.source\.versionTag -ne "v\$\(\$Source\.version\)"/);
});

test("service candidates are staged offline before their exact images are promoted", () => {
  const containerSource = fs.readFileSync(
    path.resolve(__dirname, "../scripts/rebuild-local-app-services.ps1"),
    "utf8"
  );
  assert.match(containerSource, /ValidateSet\("stage", "promote"\)/);
  assert.match(containerSource, /"build",\s*"--quiet",\s*"--no-cache"/);
  assert.match(
    containerSource,
    /git -c core\.autocrlf=false -C \$RepositoryRoot archive/
  );
  assert.match(containerSource, /"run", "--rm", "--network", "none"/);
  assert.match(containerSource, /"verify-candidate"/);
  assert.match(
    containerSource,
    /"verify-candidate",[\s\S]*"--inspection", \$InspectionPath[\s\S]*\) \| Out-Null/
  );
  assert.match(containerSource, /Assert-LiveContainersUnchanged/);
  assert.match(
    containerSource,
    /Assert-CandidatesStillVerified[\s\S]*"image", "tag"[\s\S]*"--no-build", "--force-recreate", "--wait"/
  );
  assert.match(
    containerSource,
    /ActualImage -ne \[string\]\$Entry\.candidateImageId/
  );
});

test("the local HTTPS allowlist serves signed build provenance", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../deployment/local/Caddyfile"),
    "utf8"
  );
  assert.match(source, /@manifest path[^\r\n]*\/build-provenance\.json/);
  assert.match(source, /@allowedFiles path[^\r\n]*\/build-provenance\.json/);
});
