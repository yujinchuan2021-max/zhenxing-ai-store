"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const tests = [
  "tests/local-agent-bridge.test.cjs",
  "tests/local-agent-bridge-ipc.test.cjs",
  "tests/agent-capability-broker.test.cjs",
  "tests/managed-cli-lifecycle-candidate.test.cjs",
  "tests/cli-driver-registry.test.cjs",
  "tests/community-workflow-composition.test.cjs",
  "tests/community-workflow-persistence.test.cjs",
  "tests/cli-agent-coverage.test.cjs",
  "tests/cli-deploy-only.test.cjs",
  "tests/managed-binary-cli.test.cjs",
  "tests/managed-python-cli.test.cjs",
  "tests/managed-msi-cli.test.cjs",
  "tests/managed-wsl-cli.test.cjs",
  "tests/managed-portable-files.test.cjs",
  "tests/product-entry-points.test.cjs",
  "tests/installed-product-management.test.cjs"
];
const result = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...tests], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true
});

process.exit(result.status ?? 1);
