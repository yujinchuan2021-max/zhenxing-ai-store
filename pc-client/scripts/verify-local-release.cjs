"use strict";

const path = require("node:path");
const {
  verifyReleaseBundle
} = require("../admin/release-bundle-verifier.cjs");

const result = verifyReleaseBundle({
  bundleDirectory: path.resolve(__dirname, "..", "deployment", "local")
    + path.sep + "runtime" + path.sep + "current"
});
process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
