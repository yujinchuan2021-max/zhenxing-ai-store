"use strict";

const path = require("node:path");
const {
  verifyReleaseBundle
} = require("../admin/release-bundle-verifier.cjs");

const args = process.argv.slice(2);
const allowCatalogPolicyDrift =
  args.length === 1 && args[0] === "--allow-catalog-policy-drift";
if (args.length && !allowCatalogPolicyDrift) {
  throw new Error("Unknown local release verification option");
}

const result = verifyReleaseBundle({
  bundleDirectory: path.resolve(__dirname, "..", "deployment", "local")
    + path.sep + "runtime" + path.sep + "current",
  allowLocalhost: true,
  allowLocalRuntimeTrust: true,
  allowCatalogPolicyDrift
});
process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
