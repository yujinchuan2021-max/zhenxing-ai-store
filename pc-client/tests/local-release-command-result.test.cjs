"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  localReleaseCommandResult
} = require("../shared/local-release-command-result.cjs");

test("reports a completed release operation as successful only when cleanup is complete", () => {
  assert.deepEqual(
    localReleaseCommandResult({ finalized: true, cleanupPending: false }),
    { ok: true, finalized: true, cleanupPending: false }
  );
  assert.deepEqual(
    localReleaseCommandResult({
      finalized: true,
      cleanupPending: true,
      cleanupErrorCode: "EBUSY"
    }),
    {
      ok: false,
      finalized: true,
      cleanupPending: true,
      cleanupErrorCode: "EBUSY"
    }
  );
});

test("treats activation-lock and stale cleanup as an unsuccessful command result", () => {
  assert.equal(
    localReleaseCommandResult({
      rolledBack: true,
      cleanupPending: false,
      activationLockCleanupPending: true
    }).ok,
    false
  );
  assert.equal(
    localReleaseCommandResult({
      activated: true,
      staleLockCleanupPending: true
    }).ok,
    false
  );
});

test("finalize and rollback expose pending cleanup as a failed command exit", () => {
  for (const scriptName of [
    "finalize-local-release.cjs",
    "rollback-local-release.cjs"
  ]) {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", "scripts", scriptName),
      "utf8"
    );
    assert.match(source, /localReleaseCommandResult\(\{/);
    assert.match(
      source,
      /retiredCleanupPending: receipt\.retiredCleanupPending/
    );
    assert.match(
      source,
      /stagingCleanupPending: receipt\.stagingCleanupPending/
    );
    assert.match(
      source,
      /receipt\.activationLockCleanupPending \|\|[\s\S]*result\.activationLockCleanupPending/
    );
    assert.match(source, /if \(!commandResult\.ok\) process\.exitCode = 2/);
    assert.doesNotMatch(source, /\{ ok: true, \.\.\.result \}/);
  }
});

test("local packaging stages and activates one complete sibling delivery", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "scripts", "package-local-release.cjs"),
    "utf8"
  );
  assert.match(source, /release-local-server-client-candidate-/);
  assert.match(source, /activatePreparedLocalReleaseDelivery\(/);
  assert.match(source, /--transaction-receipt/);
  const prepareTransactionIndex = source.indexOf(
    "prepareLocalReleaseDeliveryTransaction("
  );
  const activateTransactionIndex = source.indexOf(
    "activatePreparedLocalReleaseDeliveryTransaction("
  );
  assert.ok(prepareTransactionIndex >= 0);
  assert.ok(activateTransactionIndex > prepareTransactionIndex);
  assert.match(source, /const checksumNames = \[\.\.\.deliveryNames\.artifacts, buildMetadataName\]/);
  assert.doesNotMatch(source, /fs\.mkdirSync\(artifactOutput/);
  assert.doesNotMatch(source, /ok: true/);
  assert.match(
    source,
    /transactionReceiptCreated[\s\S]*if \([\s\S]*!transactionReceiptCreated[\s\S]*fs\.rmSync\(candidateOutput/
  );
  assert.match(source, /deliveryRecoveryPending/);
  assert.match(
    source,
    /!transactionReceiptCreated[\s\S]*!deliveryRecoveryPending/
  );
});

test("delivery transaction commands fail when exact cleanup or restoration is pending", () => {
  for (const scriptName of [
    "finalize-local-release-delivery.cjs",
    "rollback-local-release-delivery.cjs"
  ]) {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", "scripts", scriptName),
      "utf8"
    );
    assert.match(source, /localReleaseCommandResult\(result\)/);
    assert.match(source, /if \(!commandResult\.ok\) process\.exitCode = 2/);
  }
});
