"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { runProductionOrderChild } = require("../scripts/lib/managed-download-production-order-lifecycle.cjs");

const root = path.resolve(__dirname, "..");
const electron = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const runner = path.join(root, "scripts", "fixtures", "managed-download-production-order-runner.cjs");

async function runFixture(order, { forceExtraList = false, expectFailure = false } = {}) {
  assert.equal(fs.existsSync(runner), true, "production-order runner is required");
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), `aihub-download-order-${order}-`));
  const result = await runProductionOrderChild({
    executable: electron,
    args: [runner],
    cwd: root,
    env: {
      ...process.env,
      AIHUB_MANAGED_DOWNLOAD_PRODUCTION_ORDER: order,
      AIHUB_MANAGED_DOWNLOAD_PRODUCTION_ORDER_FORCE_EXTRA_LIST: forceExtraList ? "1" : "0",
      AIHUB_MANAGED_DOWNLOAD_QUEUE_USER_DATA: userData,
      AIHUB_MANAGED_DOWNLOAD_QUEUE_NO_OUTPUT: "1"
    },
    profileDirectory: userData,
    timeoutMs: 120_000
  });
  const expectedResult = expectFailure ? {
    exitClass: "exit-1",
    stderrClass: "fixed-runner-code",
    stage: "evidence-gates",
    boundary: "entered",
    checkpointValid: true,
    childAbsent: true,
    treeAbsent: true,
    terminationClass: "controlled-failure",
    profileAbsent: true,
    cleanupBlocked: false,
    cleanupCode: null
  } : {
    exitClass: "exit-0",
    stderrClass: "empty",
    stage: "exit-request-ready",
    boundary: "completed",
    checkpointValid: true,
    childAbsent: true,
    treeAbsent: true,
    terminationClass: "controlled-success",
    profileAbsent: true,
    cleanupBlocked: false,
    cleanupCode: null
  };
  assert.deepEqual(result, expectedResult);
}

test("production order converges when downloading status precedes the queued enqueue reply", async () => {
  await runFixture("status-before-reply");
});

test("production order converges when the queued enqueue reply precedes downloading status", async () => {
  await runFixture("reply-before-status");
});

test("production order rejects one extra list call even after the baseline is already many", async () => {
  await runFixture("reply-before-status", { forceExtraList: true, expectFailure: true });
});
