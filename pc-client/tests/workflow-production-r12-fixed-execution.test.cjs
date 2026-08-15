"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  FIXED_OPERATIONS,
  R12_CONTROL,
  createR12FixedRunner,
  fixedOperationCommand
} = require("../deployment/community-production/workflow-production-r12-fixed-runner.cjs");

const RELEASE = "/opt/zhenxing-ai/releases/community-production-r12-2a114734";

test("r12 fixed runner maps every operation and rollback to one release-local argv without caller paths", async () => {
  assert.deepEqual(FIXED_OPERATIONS, [
    "backup:verified", "recreate:admin", "recreate:identity", "activate:active7",
    "verify:workflow-migrate", "verify:workflow-reviewer-provision", "verify:workflow-official-bootstrap"
  ]);
  for (const operation of [...FIXED_OPERATIONS, "rollback"]) {
    const command = fixedOperationCommand(RELEASE, operation);
    assert.equal(command.file, "/bin/bash");
    assert.deepEqual(command.args, [`${RELEASE}/deployment/community-production/workflow-production-r12-executor.sh`, operation]);
  }
  assert.throws(() => fixedOperationCommand(RELEASE, "docker compose down --volumes"), /fixed/i);
  assert.throws(() => fixedOperationCommand("/tmp/unsafe", "rollback"), /fixed/i);

  const calls = [];
  const runner = createR12FixedRunner({
    releaseRoot: RELEASE,
    execFile: async (file, args, options) => { calls.push({ file, args, options }); return { status: 0, stdout: "" }; }
  });
  for (const operation of FIXED_OPERATIONS) await runner.run(operation);
  await runner.rollback();
  assert.equal(calls.length, 8);
  assert.ok(calls.every(({ file, args, options }) => file === "/bin/bash" && args.length === 2 && options.shell === false &&
    JSON.stringify(Object.keys(options.env).sort()) === JSON.stringify(["LC_ALL", "PATH"]) &&
    options.env.PATH === "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"));
  await assert.rejects(() => runner.run("unsafe"), /fixed/i);
});

test("r12 fixed runner has no caller-controlled project, path, NODE options, or secret-bearing environment", () => {
  assert.deepEqual(R12_CONTROL, {
    runId: "workflow-production-r12",
    project: "zhenxing-community-production",
    root: "/opt/zhenxing-ai/shared/workflow-production-r12",
    evidenceRoot: "/opt/zhenxing-ai/shared/backups/workflow-production-r12-evidence"
  });
  assert.throws(() => createR12FixedRunner({ releaseRoot: RELEASE, execFile: async () => ({ status: 0 }), project: "evil" }), /fixed/i);
});

test("r12 fixed runner ignores successful command diagnostics but rejects every failed process shape without projecting them", async () => {
  const sensitive = "secret-looking compose progress";
  const success = createR12FixedRunner({ releaseRoot: RELEASE, execFile: async () => ({ status: 0, stdout: sensitive, stderr: sensitive }) });
  assert.equal(await success.run("recreate:admin"), true);
  for (const result of [
    { status: 1, stderr: sensitive },
    { status: null, error: Object.assign(new Error(sensitive), { code: "ENOBUFS" }), stderr: sensitive },
    { status: null, signal: "SIGKILL", stderr: sensitive }
  ]) {
    const runner = createR12FixedRunner({ releaseRoot: RELEASE, execFile: async () => result });
    await assert.rejects(() => runner.run("recreate:admin"), (error) => error.message === "r12 fixed runner is invalid" && !error.message.includes(sensitive));
  }
});

function executorSource() {
  return fs.readFileSync(path.join(__dirname, "..", "deployment", "community-production", "workflow-production-r12-executor.sh"), "utf8");
}

test("r12 executor has one fixed operation map and never accepts command text", () => {
  const source = executorSource();
  const disabled = fs.readFileSync(path.join(__dirname, "..", "deployment", "community-production", "compose.workflow-production-r12-disabled.yaml"), "utf8");
  for (const operation of [...FIXED_OPERATIONS, "rollback"]) assert.match(source, new RegExp(`${operation.replace(/[:]/g, ":")}`));
  assert.match(source, /identity-19a-rollback-image\.tar/);
  assert.match(source, /admin-old-b6ea4c5bd0e9\.tar/);
  assert.match(disabled, /identity:\s+image: zhenxing-ai\/identity:workflow-readiness-candidate-19a223a18392/);
  assert.match(source, /compose_baseline=/);
  assert.match(source, /compose_target=/);
  assert.match(source, /compose_baseline=.*-f "\$disabled"/);
  assert.match(source, /verify_compose/);
  assert.match(source, /AIHUB_ADMIN_CMS_IMAGE="\$old_admin"/);
  assert.match(source, /AIHUB_ADMIN_CMS_IMAGE="\$target_admin"/);
  assert.match(source, /AIHUB_IDENTITY_IMAGE="\$old_identity"/);
  assert.match(source, /AIHUB_IDENTITY_IMAGE="\$target_identity"/);
  assert.match(source, /baseline\) verify_compose "\$old_admin" "\$old_identity"/);
  assert.doesNotMatch(source, /baseline\) verify_compose "\$old_admin" "\$target_identity"/);
  assert.doesNotMatch(source, /\$\{COMMAND|eval |docker system prune|down --volumes|NODE_PATH|NODE_OPTIONS/);
});

test("r12 verified backup emits one canonical final directory after silent checksum verification", () => {
  const source = executorSource();
  const backup = fs.readFileSync(path.join(__dirname, "..", "deployment", "community-production", "backup.sh"), "utf8");
  assert.match(backup, /sha256sum -c SHA256SUMS >\/dev\/null/);
  assert.match(source, /"\$backup" != \*\$'\\n'\*/);
  assert.match(source, /realpath -e -- "\$backup"/);
});

test("r12 target and rollback recreate only Admin then Identity with fixed offline images", () => {
  const source = executorSource();
  assert.match(source, /--pull never --wait --wait-timeout 90/);
  assert.doesNotMatch(source, /-f "\$base" -f "\$overlay" -f "\$rollback_overlay"/);
  assert.doesNotMatch(source, /rollback-images\.yaml|printf 'services:/);
  const rollbackStart = source.indexOf("  rollback)");
  const catalogRollback = source.indexOf("catalog-active7-state-activation.cjs\" rollback", rollbackStart);
  const rollback = source.slice(rollbackStart, source.indexOf("  *) fail", rollbackStart));
  const adminRestore = rollback.indexOf("compose_for baseline up -d --no-deps --no-build --pull never --wait --wait-timeout 90 admin");
  const identityRestore = rollback.indexOf("compose_for baseline up -d --no-deps --no-build --pull never --wait --wait-timeout 90 identity");
  assert.ok(rollbackStart >= 0 && catalogRollback > rollbackStart && adminRestore >= 0 && identityRestore > adminRestore);
  assert.equal((rollback.match(/compose_for baseline up -d/g) || []).length, 2);
  assert.doesNotMatch(rollback, /identity-database|community-database|\bcommunity\b|\bcaddy\b/);
});
