"use strict";

const path = require("node:path");
const {
  createManualBackup
} = require("../admin/local-release-deployment.cjs");

const runtimeDirectory = path.resolve(
  __dirname,
  "..",
  "deployment",
  "local",
  "runtime"
);
const result = createManualBackup({ runtimeDirectory });
process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
