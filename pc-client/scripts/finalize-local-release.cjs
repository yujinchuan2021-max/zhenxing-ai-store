"use strict";

const path = require("node:path");
const {
  finalizeActivatedRelease
} = require("../admin/local-release-deployment.cjs");
const {
  readLocalReleaseTransactionReceipt
} = require("./lib/local-release-transaction-receipt.cjs");
const {
  localReleaseCommandResult
} = require("../shared/local-release-command-result.cjs");

const receiptPath = path.resolve(String(process.argv[2] || ""));
const runtimeDirectory = path.resolve(
  __dirname,
  "..",
  "deployment",
  "local",
  "runtime"
);
const receipt = readLocalReleaseTransactionReceipt(receiptPath);
const result = finalizeActivatedRelease({
  runtimeDirectory,
  ...receipt
});
const commandResult = localReleaseCommandResult({
  ...result,
  retiredCleanupPending: receipt.retiredCleanupPending,
  stagingCleanupPending: receipt.stagingCleanupPending,
  staleLockCleanupPending: receipt.staleLockCleanupPending,
  activationLockCleanupPending:
    receipt.activationLockCleanupPending ||
    result.activationLockCleanupPending,
  activationLockCleanupErrorCode:
    result.activationLockCleanupErrorCode ||
    receipt.activationLockCleanupErrorCode
});
process.stdout.write(`${JSON.stringify(commandResult, null, 2)}\n`);
if (!commandResult.ok) process.exitCode = 2;
