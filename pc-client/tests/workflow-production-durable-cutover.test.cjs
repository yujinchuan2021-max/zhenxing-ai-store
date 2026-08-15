"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const launcherPath = path.join(deployment, "workflow-production-cutover-launcher.sh");
const cutoverPath = path.join(deployment, "workflow-production-cutover.sh");
const existingStatePath = path.join(deployment, "workflow-production-existing-state.cjs");
const linuxGatePath = path.join(root, "scripts", "test-workflow-production-durable-cutover-linux.cjs");

test("durable cutover uses one fixed system transient unit instead of an SSH child", () => {
  assert.equal(fs.existsSync(launcherPath), true, "manifest-controlled durable launcher is missing");
  const source = fs.readFileSync(launcherPath, "utf8");

  assert.match(source, /RUN_ID='workflow-production-r11'/);
  assert.match(source, /UNIT='zhenxing-ai-workflow-production-r11\.service'/);
  assert.match(source, /SYSTEMD_RUN='\/usr\/bin\/systemd-run'/);
  assert.match(source, /--unit="\$UNIT"/);
  assert.match(source, /--service-type=exec/);
  assert.match(source, /--no-block/);
  assert.match(source, /\/usr\/bin\/env -i/);
  assert.match(source, /StandardOutput=null/);
  assert.match(source, /StandardError=null/);
  assert.doesNotMatch(source, /nohup|setsid|disown|trap\s+['"]{0,1}(?:''|:)['"]{0,1}\s+HUP|systemd-run\s+--user/);
});

test("launch is single-use, pins prepared controls, and keeps runtime values out of the unit", () => {
  const source = fs.readFileSync(launcherPath, "utf8");

  assert.match(source, /CONTROL_ROOT='\/opt\/zhenxing-ai\/shared\/workflow-production-r11'/);
  assert.match(source, /EVIDENCE_ROOT='\/opt\/zhenxing-ai\/shared\/backups\/workflow-production-r11-evidence'/);
  assert.match(source, /mkdir -- "\$CONTROL_ROOT"/);
  assert.match(source, /verify-prepared "\$release_root"/);
  assert.match(source, /deploymentSetDigest/);
  assert.match(source, /deploymentManifestSha256/);
  assert.match(source, /preparedMarkerSha256/);
  assert.match(source, /bundleManifestSha256/);
  assert.match(source, /payloadDigest/);
  assert.match(source, /verify_request_controls/);
  assert.match(source, /environment\.sh/);
  assert.match(source, /chmod 0600/);
  assert.doesNotMatch(source, /--setenv|EnvironmentFile=|Environment=/);
});

test("poll is fixed read-only state and the worker records a terminal result", () => {
  const source = fs.readFileSync(launcherPath, "utf8");

  assert.match(source, /case "\$command" in[\s\S]*launch\)[\s\S]*status\)[\s\S]*__run\)/);
  assert.match(source, /status\.json/);
  assert.match(source, /receipt\.json/);
  assert.match(source, /"succeeded"/);
  assert.match(source, /"failed"/);
  assert.match(source, /trap record_worker_exit EXIT/);
  assert.match(source, /worker_status_finalized/);
  assert.match(source, /\/proc\/self\/cgroup/);
  assert.match(source, /\/system\.slice\/\$UNIT/);
  assert.doesNotMatch(source, /systemctl show --property=MainPID/);
  assert.doesNotMatch(source.match(/status\)[\s\S]*?;;/)?.[0] || "", /mkdir|mv|rm|install|systemd-run/);
});

test("cutover accepts exactly the two empty baselines or retained official bootstrap on the old images", () => {
  const source = fs.readFileSync(cutoverPath, "utf8");
  const existingStateSource = fs.readFileSync(existingStatePath, "utf8");

  assert.match(source, /zhenxing-ai\/admin:community-candidate-b6ea4c5bd0e9/);
  assert.match(source, /sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2/);
  assert.match(source, /zhenxing-ai\/identity:workflow-readiness-candidate-19a223a18392/);
  assert.match(source, /sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567/);
  assert.match(source, /workflow-production-existing-state\.cjs/);
  assert.match(existingStateSource, /legacy-enabled-online-empty/);
  assert.match(existingStateSource, /rolled-back-disabled-empty/);
  assert.match(existingStateSource, /disabled-retained-official-bootstrap/);
  assert.match(source, /reviewerForbiddenRelations/);
  assert.match(source, /identity_kind='workflow-reviewer-service'/);
  assert.match(source, /status='disabled'/);
  assert.match(source, /community_profiles/);
  assert.match(source, /sessions/);
  assert.match(existingStateSource, /AIHUB_WORKFLOW_STORE_ENABLED/);
  assert.match(existingStateSource, /WORKFLOW_ONLY_FLAG_PROFILE/);
  assert.match(existingStateSource, /return "workflow-only"/);
  assert.match(existingStateSource, /return "legacy-enabled"/);
  assert.match(existingStateSource, /return "disabled"/);
  assert.match(source, /trap restore_disabled_base EXIT HUP INT TERM/);
  assert.doesNotMatch(source, /trap\s+['"]{0,1}(?:''|:)['"]{0,1}\s+HUP/);
});

test("true-Linux gate kills the caller session while the fixed system unit keeps running", () => {
  assert.equal(fs.existsSync(linuxGatePath), true, "true-Linux durable launcher gate is missing");
  const source = fs.readFileSync(linuxGatePath, "utf8");

  assert.match(source, /ubuntu@sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea/);
  assert.match(source, /\/sbin\/init/);
  assert.match(source, /systemctl is-system-running/);
  assert.match(source, /kill -HUP \$\$/);
  assert.match(source, /zhenxing-ai-workflow-production-r11\.service/);
  assert.match(source, /Workflow durable run already exists/);
  assert.match(source, /cutoverCalls/);
  assert.match(source, /hupReachedCutover/);
  assert.match(source, /secretValueHits/);
  assert.doesNotMatch(source, /ssh|scp|\/opt\/zhenxing-ai\/shared\/backups\/community-production-20260809T063635Z/);
});
