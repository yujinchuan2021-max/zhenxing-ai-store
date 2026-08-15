"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "deployment", "community-production", "workflow-production-r12-launcher.sh"), "utf8");
const bundleSource = fs.readFileSync(path.join(__dirname, "..", "deployment", "community-production", "workflow-production-release-bundle.cjs"), "utf8");

test("r12 durable launcher has one fixed run and unit with zero-argument launch/status only", () => {
  assert.match(source, /RUN_ID='workflow-production-r12'/);
  assert.match(source, /UNIT='zhenxing-ai-workflow-production-r12\.service'/);
  assert.match(source, /CONTROL_ROOT='\/opt\/zhenxing-ai\/shared\/workflow-production-r12'/);
  assert.match(source, /--property='StandardOutput=null'/);
  assert.match(source, /--property='StandardError=null'/);
  assert.match(source, /\/usr\/bin\/env -i PATH="\$PATH" LC_ALL=C/);
  assert.doesNotMatch(source, /NODE_PATH|NODE_OPTIONS|down --volumes|docker system prune/);
  assert.match(source, /case "\$1" in launch\) launch ;; status\) status ;; __run\) run_worker ;; \*\) fail ;; esac/);
});

test("r12 durable launcher persists an allowlisted terminal record and rejects repeat or HUP-owned caller execution", () => {
  assert.match(source, /write_status\(\)/);
  assert.match(source, /record_worker_exit\(\)/);
  assert.match(source, /__run\) run_worker/);
  assert.match(source, /\[\[ ! -e "\$CONTROL_ROOT"/);
  assert.match(source, /trap record_worker_exit EXIT HUP INT TERM/);
  assert.match(source, /"\$node" "\$script_dir\/workflow-production-r12-prepared-coordinator\.cjs"/);
  assert.match(source, /"\$script_path" __run/);
  assert.match(source, /failureStage/);
  assert.match(source, /failureCode/);
  assert.match(source, /rollbackCode/);
  assert.match(source, /workflow-node-runtime\.sh/);
  assert.match(source, /preflight_workflow_node_runtime/);
  assert.match(source, /prepare_workflow_node_runtime/);
  assert.match(source, /verify_request_controls/);
  assert.match(source, /deploymentSetDigest/);
  assert.match(source, /deploymentManifestSha256/);
  assert.match(source, /preparedMarkerSha256/);
  assert.match(source, /bundleManifestSha256/);
  assert.match(source, /payloadDigest/);
  assert.match(source, /"\$load" == not-found/);
  assert.match(source, /"\$active" == inactive/);
  assert.match(source, /"\$sub" == dead/);
  assert.match(source, /\/system\.slice\/\$UNIT/);
  assert.match(source, /null\|launcher\|prepared-context/);
  assert.match(source, /write_status failed 1 launcher R12_LAUNCHER_FAILED null/);
  assert.doesNotMatch(source, /nohup|setsid|HUP-ignore|NODE_PATH|NODE_OPTIONS/);
});

test("r12 direct shell entries are frozen executable by the single bundle mode table", () => {
  assert.match(bundleSource, /deployment\/community-production\/workflow-production-r12-launcher\.sh/);
  assert.match(bundleSource, /deployment\/community-production\/workflow-production-r12-executor\.sh/);
});
