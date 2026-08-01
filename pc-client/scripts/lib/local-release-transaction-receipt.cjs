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
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt) ||
    receipt.ok !== true ||
    typeof receipt.backupName !== "string" ||
    typeof receipt.retiredName !== "string" ||
    !receipt.expectedCurrent ||
    typeof receipt.expectedCurrent !== "object" ||
    Array.isArray(receipt.expectedCurrent)
  ) {
    throw new Error("发布事务结果内容无效");
  }
  return {
    backupName: receipt.backupName,
    retiredName: receipt.retiredName,
    expectedCurrent: receipt.expectedCurrent
  };
}

module.exports = {
  readLocalReleaseTransactionReceipt
};
