"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runner = path.join(__dirname, "..", "scripts", "test-workflow-production-r15-systemd.cjs");

test("r22 PID1 gate uses the real runtime helper and preserves HUP/repeat/secret boundaries", () => {
  const source = fs.readFileSync(runner, "utf8");
  assert.match(source, /aihub-workflow-durable-systemd-test:ubuntu24-r1/);
  assert.match(source, /--cgroupns=private/);
  assert.match(source, /workflow-production-fresh-host-launcher\.sh/);
  assert.match(source, /zhenxing-ai-workflow-production-r22\.service/);
  assert.match(source, /workflow-node-runtime\.sh/);
  assert.doesNotMatch(source, /preflight_workflow_node_runtime\(\)\{|prepare_workflow_node_runtime\(\)\{/);
  assert.match(source, /kill -HUP \$\$/);
  assert.match(source, /workerCalls: 1/);
  assert.match(source, /repeatedLaunchRejected: true/);
  assert.match(source, /secretValueHits: 0/);
  assert.match(source, /const redMode = process\.argv\[2\] === "red"/);
  assert.match(source, /oldReceiptPresent: true, workerCalls: 0/);
  assert.doesNotMatch(source, /nohup|setsid|--cgroupns=host|\/sys\/fs\/cgroup:.*rw/i);
});
