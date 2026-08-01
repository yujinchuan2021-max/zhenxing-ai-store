"use strict";

const fs = require("node:fs");
const path = require("node:path");

function readLocalReleaseTransactionReceipt(receiptPath) {
  if (typeof receiptPath !== "string" || !path.isAbsolute(receiptPath)) {
    throw new Error("发布事务结果文件必须是绝对路径");
  }
  const stat = fs.lstatSync(receiptPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("发布事务结果文件不可信");
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  const cleanupFields = [
    "retiredCleanupPending",
    "stagingCleanupPending",
    "staleLockCleanupPending",
    "activationLockCleanupPending"
  ];
  const cleanupValuesAreValid = cleanupFields.every(
    (name) => typeof receipt?.[name] === "boolean"
  );
  const cleanupPending =
    cleanupValuesAreValid &&
    cleanupFields.some((name) => receipt[name] === true);
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt) ||
    !cleanupValuesAreValid ||
    receipt.ok !== !cleanupPending ||
    typeof receipt.backupName !== "string" ||
    typeof receipt.retiredName !== "string" ||
    !receipt.expectedCurrent ||
    typeof receipt.expectedCurrent !== "object" ||
    Array.isArray(receipt.expectedCurrent) ||
    (receipt.activationLockCleanupErrorCode !== null &&
      typeof receipt.activationLockCleanupErrorCode !== "string")
  ) {
    throw new Error("发布事务结果内容无效");
  }
  return {
    backupName: receipt.backupName,
    retiredName: receipt.retiredName,
    expectedCurrent: receipt.expectedCurrent,
    retiredCleanupPending: receipt.retiredCleanupPending,
    stagingCleanupPending: receipt.stagingCleanupPending,
    staleLockCleanupPending: receipt.staleLockCleanupPending,
    activationLockCleanupPending: receipt.activationLockCleanupPending,
    activationLockCleanupErrorCode:
      receipt.activationLockCleanupErrorCode
  };
}

module.exports = {
  readLocalReleaseTransactionReceipt
};
