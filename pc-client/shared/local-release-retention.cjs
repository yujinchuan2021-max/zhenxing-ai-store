"use strict";

const fs = require("node:fs");
const path = require("node:path");

function discardActivatedLocalReleaseBackup({
  runtimeDirectory,
  backupName
}) {
  if (
    typeof runtimeDirectory !== "string" ||
    !path.isAbsolute(runtimeDirectory) ||
    typeof backupName !== "string" ||
    !backupName.startsWith("auto-") ||
    path.basename(backupName) !== backupName ||
    /[\\/]/.test(backupName)
  ) {
    throw new TypeError("Local release backup name is invalid");
  }
  const backupsRoot = path.resolve(runtimeDirectory, "backups");
  const target = path.resolve(backupsRoot, backupName);
  if (path.dirname(target) !== backupsRoot) {
    throw new Error("Local release backup escaped its retention boundary");
  }
  if (!fs.existsSync(target)) return false;
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Local release backup is not a trusted directory");
  }
  fs.rmSync(target, { recursive: true, force: true });
  return true;
}

function discardActivatedLocalReleaseBackupBestEffort(options) {
  try {
    return {
      discarded: discardActivatedLocalReleaseBackup(options),
      cleanupPending: false,
      errorCode: null
    };
  } catch (error) {
    return {
      discarded: false,
      cleanupPending: true,
      errorCode:
        typeof error?.code === "string" && error.code ? error.code : "UNKNOWN"
    };
  }
}

module.exports = {
  discardActivatedLocalReleaseBackup,
  discardActivatedLocalReleaseBackupBestEffort
};
