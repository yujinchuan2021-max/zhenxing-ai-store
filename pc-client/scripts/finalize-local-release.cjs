"use strict";

const path = require("node:path");
const {
  finalizeActivatedRelease
} = require("../admin/local-release-deployment.cjs");
const {
  readLocalReleaseTransactionReceipt
} = require("./lib/local-release-transaction-receipt.cjs");

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
process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
