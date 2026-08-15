"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const tests = [
  "tests/managed-cli-lifecycle-candidate.test.cjs",
  "tests/managed-binary-cli.test.cjs",
  "tests/managed-portable-files.test.cjs",
  "tests/cli-driver-registry.test.cjs"
];
const result = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...tests], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true
});

process.exit(result.status ?? 1);
