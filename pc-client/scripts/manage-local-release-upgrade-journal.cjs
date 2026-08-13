"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  advanceUpgradeJournal,
  beginUpgradeJournal,
  completeUpgradeJournal,
  restoreRuntimeSnapshot,
  sealUpgradeJournalReceipts,
  upgradeJournalStatus,
  verifyUpgradeJournalReceipts,
  verifyRuntimeSnapshotRestored
} = require("../shared/local-release-upgrade-journal.cjs");

const root = path.resolve(__dirname, "..");
const transactionRoot = path.join(
  root,
  "deployment",
  "local",
  "transactions"
);
const runtimeDirectory = path.join(root, "deployment", "local", "runtime");

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) return "";
  return String(args[index + 1]);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const args = process.argv.slice(2);
const action = String(args.shift() || "status");
let result;
switch (action) {
  case "status":
    if (args.length) throw new Error("status does not accept arguments");
    result = upgradeJournalStatus({ transactionRoot });
    break;
  case "begin": {
    const version = option(args, "--version");
    const revision = option(args, "--revision").toLowerCase();
    if (args.length !== 4) {
      throw new Error("begin requires --version and --revision");
    }
    const packageVersion = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    ).version;
    if (version !== packageVersion) {
      throw new Error("Local release transaction version differs from package.json");
    }
    result = beginUpgradeJournal({
      transactionRoot,
      runtimeDirectory,
      version,
      revision
    });
    break;
  }
  case "advance": {
    const phase = option(args, "--phase");
    if (args.length !== 2) throw new Error("advance requires --phase");
    result = advanceUpgradeJournal({ transactionRoot, phase });
    break;
  }
  case "seal":
    if (args.length) throw new Error("seal does not accept arguments");
    result = sealUpgradeJournalReceipts({ transactionRoot });
    break;
  case "verify-receipts":
    if (args.length) throw new Error("verify-receipts does not accept arguments");
    result = verifyUpgradeJournalReceipts({ transactionRoot });
    break;
  case "restore-runtime":
    if (args.length) throw new Error("restore-runtime does not accept arguments");
    result = restoreRuntimeSnapshot({ transactionRoot, runtimeDirectory });
    break;
  case "verify-runtime":
    if (args.length) throw new Error("verify-runtime does not accept arguments");
    result = verifyRuntimeSnapshotRestored({
      transactionRoot,
      runtimeDirectory
    });
    break;
  case "complete":
    if (args.length) throw new Error("complete does not accept arguments");
    result = completeUpgradeJournal({ transactionRoot });
    break;
  default:
    throw new Error(`Unknown local release transaction action: ${action}`);
}
print(result);
