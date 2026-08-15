"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const launcherPath = path.join(deployment, "workflow-production-fresh-host-launcher.sh");
const runnerPath = path.join(deployment, "workflow-production-fresh-host-runner.sh");
const terminalPath = path.join(deployment, "workflow-production-fresh-host-terminal.cjs");

function terminal(overrides = {}) {
  return {
    schema: "aihub-workflow-production-fresh-host-terminal-v1",
    status: "pass",
    runId: "workflow-production-r25",
    stage: null,
    code: null,
    stopCode: null,
    serverConnected: true,
    serverWritten: true,
    assetWrites: true,
    secretWrites: true,
    catalogWrites: true,
    databaseWrites: true,
    servicesStarted: true,
    productionExposed: true,
    servicesHealthy: 6,
    servicesStoppedOnFailure: false,
    sourcePosts: 3,
    events: 9,
    idempotency: 9,
    eventHead: 9,
    publicWorkflowCount: 3,
    resourceTablesAbsent: true,
    secretValuesEmitted: false,
    ...overrides
  };
}

test("r25 durable fresh-host terminal distinguishes real server writes from a local freeze", () => {
  const { validateFreshHostTerminal } = require(terminalPath);
  assert.deepEqual(validateFreshHostTerminal(terminal(), 0), terminal());
  const failed = terminal({
    status: "failed", stage: "official-bootstrap", code: "R16_INITIALIZE_LAUNCH_FAILED",
    productionExposed: false,
    servicesHealthy: 0, servicesStoppedOnFailure: true, sourcePosts: null, events: null,
    idempotency: null, eventHead: null, publicWorkflowCount: null, resourceTablesAbsent: null
  });
  assert.deepEqual(validateFreshHostTerminal(failed, 1), failed);
  assert.throws(() => validateFreshHostTerminal(terminal({ serverConnected: false }), 0));
  assert.throws(() => validateFreshHostTerminal({ ...terminal(), raw: "secret/path" }, 0));
  assert.throws(() => validateFreshHostTerminal(failed, 0));
  assert.throws(() => validateFreshHostTerminal({ ...failed, servicesStoppedOnFailure: false }, 1));
  assert.deepEqual(validateFreshHostTerminal({ ...failed, servicesStoppedOnFailure: false, stopCode: "R16_STOP_FAILED" }, 1).stopCode, "R16_STOP_FAILED");
});

test("r25 launcher owns one fixed root system unit and rechecks prepared controls in clean env", () => {
  const source = fs.readFileSync(launcherPath, "utf8");
  assert.match(source, /RUN_ID='workflow-production-r25'/);
  assert.match(source, /UNIT='zhenxing-ai-workflow-production-r25\.service'/);
  assert.match(source, /CONTROL_ROOT='\/opt\/zhenxing-ai\/shared\/workflow-production-r25'/);
  assert.match(source, /EVIDENCE_ROOT='\/opt\/zhenxing-ai\/shared\/backups\/workflow-production-r25-evidence'/);
  assert.match(source, /workflow-node-runtime\.sh/);
  assert.match(source, /verify-prepared/);
  for (const field of ["deploymentSetDigest", "deploymentManifestSha256", "preparedMarkerSha256", "bundleManifestSha256", "payloadDigest"]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /\/usr\/bin\/systemd-run/);
  assert.match(source, /--property=['"]User=root['"]/);
  assert.match(source, /\/usr\/bin\/env -i PATH="\$PATH" LC_ALL=C SUDO_UID=1000 SUDO_GID=1000 \/bin\/bash "\$script_path" __run/);
  assert.match(source, /\/usr\/bin\/env -i PATH="\$PATH" LC_ALL=C \/bin\/bash "\$script_dir\/workflow-production-fresh-host-runner\.sh" __run/);
  assert.doesNotMatch(source, /SUDO_UID="?\$|SUDO_GID="?\$/);
  assert.match(source, /\/system\.slice\/\$UNIT/);
  assert.match(source, /workflow-production-fresh-host-terminal\.cjs/);
  assert.match(source, /case "\$1" in launch\) launch ;; status\) status ;; __run\) run_worker ;; \*\) fail ;; esac/);
  assert.doesNotMatch(source, /nohup|setsid|NODE_PATH|NODE_OPTIONS|caller.*(?:command|path|env)/i);
});

test("r25 worker projects only the fixed early failure stage and code pairs", () => {
  const source = fs.readFileSync(launcherPath, "utf8");
  const pairs = {
    "worker-context": "R16_WORKER_CONTEXT_FAILED",
    "runtime-preflight": "R16_RUNTIME_PREFLIGHT_FAILED",
    "prepared-context": "R16_PREPARED_CONTEXT_INVALID",
    "status-write": "R16_STATUS_WRITE_FAILED"
  };
  for (const [stage, code] of Object.entries(pairs)) {
    assert.match(source, new RegExp(stage));
    assert.match(source, new RegExp(code));
  }
  assert.match(source, /worker_failure_stage/);
  assert.match(source, /worker_failure_code/);
  assert.doesNotMatch(source, /failure_(?:stage|code)=.*(?:stderr|stdout|message|path|env|secret)/i);
});

test("the durable status preserves a preflight block as prepared-context", () => {
  const source = fs.readFileSync(launcherPath, "utf8");
  assert.match(source, /prepared-context:R16_INITIALIZE_LAUNCH_FAILED/);
});

test("r25 fresh worker has one write phase and failure preserves evidence while stopping exact services", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /RUN_ID='workflow-production-r25'/);
  assert.match(source, /CONTROL_ROOT='\/opt\/zhenxing-ai\/shared\/workflow-production-r25'/);
  assert.match(source, /\[\[ \$# -eq 1 && "\$1" == __run \]\]/);
  assert.doesNotMatch(source, /preflight\|initialize\|verify/);
  assert.match(source, /trap .*EXIT HUP INT TERM/);
  assert.match(source, /write_terminal/);
  assert.match(source, /compose.* stop caddy community identity admin community-database identity-database/);
  assert.match(source, /serverConnected/);
  assert.match(source, /assetWrites/);
  assert.match(source, /secretWrites/);
  assert.match(source, /catalogWrites/);
  assert.match(source, /databaseWrites/);
  assert.match(source, /productionExposed/);
  assert.doesNotMatch(source, /"serverConnected":false|"serverWritten":false/);
  assert.doesNotMatch(source, /docker compose down|down --volumes|docker system prune|\bDELETE\b|resource-submissions\.sql/i);
});
