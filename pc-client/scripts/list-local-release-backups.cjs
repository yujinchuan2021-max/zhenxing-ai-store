"use strict";

const path = require("node:path");
const {
  listBackups
} = require("../admin/local-release-deployment.cjs");

const runtimeDirectory = path.resolve(
  __dirname,
  "..",
  "deployment",
  "local",
  "runtime"
);
process.stdout.write(
  `${JSON.stringify(
    { ok: true, backups: listBackups(runtimeDirectory) },
    null,
    2
  )}\n`
);
