"use strict";

const path = require("node:path");
const {
  finalizeLocalReleaseDeliveryTransaction
} = require("../shared/local-release-delivery.cjs");
const {
  localReleaseCommandResult
} = require("../shared/local-release-command-result.cjs");

const root = path.resolve(__dirname, "..");
const receiptPath = path.resolve(String(process.argv[2] || ""));
const result = finalizeLocalReleaseDeliveryTransaction({
  deliveryDirectory: path.join(root, "release-local-server-client"),
  receiptPath
});
const commandResult = localReleaseCommandResult(result);
process.stdout.write(`${JSON.stringify(commandResult, null, 2)}\n`);
if (!commandResult.ok) process.exitCode = 2;
