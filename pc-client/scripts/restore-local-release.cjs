"use strict";

const path = require("node:path");
const {
  restoreBackup
} = require("../admin/local-release-deployment.cjs");

const backupName = String(process.argv[2] || "").trim();
if (!backupName) {
  throw new Error("请提供要恢复的备份名称");
}
const runtimeDirectory = path.resolve(
  __dirname,
  "..",
  "deployment",
  "local",
  "runtime"
);
const result = restoreBackup({
  runtimeDirectory,
  backupName
});
process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
