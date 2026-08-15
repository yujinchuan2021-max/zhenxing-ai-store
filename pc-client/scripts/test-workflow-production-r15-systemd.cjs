"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const launcherSource = path.join(deployment, "workflow-production-fresh-host-launcher.sh");
const terminalSource = path.join(deployment, "workflow-production-fresh-host-terminal.cjs");
const runtimeHelperSource = path.join(deployment, "workflow-node-runtime.sh");
const runtimeSource = path.join(deployment, "runtime");
const image = "aihub-workflow-durable-systemd-test:ubuntu24-r1";
const imageContract = "aihub-workflow-durable-systemd-ubuntu24-r1";
const suffix = crypto.randomBytes(5).toString("hex");
const redMode = process.argv[2] === "red";
assert.equal(process.argv.length <= 3 && (process.argv[2] === undefined || redMode), true);
const container = `aihub-workflow-r22-systemd-${suffix}`;
const output = path.join(root, "output", `workflow-production-r22-systemd-${suffix}`);
const reportPath = path.join(output, "report.json");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-r22-systemd-"));
const fixtureRoot = path.join(temporary, `community-production-r22-systemd-${suffix}`);
const fixtureDeployment = path.join(fixtureRoot, "deployment", "community-production");
const releaseRoot = `/opt/zhenxing-ai/releases/community-production-r22-systemd-${suffix}`;
const launcher = `${releaseRoot}/deployment/community-production/workflow-production-fresh-host-launcher.sh`;
const unit = "zhenxing-ai-workflow-production-r22.service";
const statusPath = "/opt/zhenxing-ai/shared/workflow-production-r22/status.json";
const receiptPath = "/opt/zhenxing-ai/fixture/receipt.json";
const callPath = "/opt/zhenxing-ai/fixture/worker-calls";
const canary = crypto.randomBytes(32).toString("hex");

function run(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  return result;
}
function docker(args, options) { return run("docker", args, options); }
function must(result, label) { assert.equal(result.status, 0, `${label}: ${String(result.stderr || result.stdout).slice(-1000)}`); return result; }
function inner(script, environment = {}) {
  const args = ["exec"];
  for (const [name, value] of Object.entries(environment)) args.push("--env", `${name}=${value}`);
  args.push(container, "/bin/bash", "-lc", script);
  return docker(args);
}
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function write(filename, body, mode = 0o644) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, body, { mode });
  fs.chmodSync(filename, mode);
}
function createFixture() {
  fs.mkdirSync(fixtureDeployment, { recursive: true });
  fs.copyFileSync(launcherSource, path.join(fixtureDeployment, "workflow-production-fresh-host-launcher.sh"));
  if (redMode) {
    const target = path.join(fixtureDeployment, "workflow-production-fresh-host-launcher.sh");
    const source = fs.readFileSync(target, "utf8");
    const oldShape = source.replace("LC_ALL=C SUDO_UID=1000 SUDO_GID=1000 /bin/bash", "LC_ALL=C /bin/bash");
    assert.notEqual(oldShape, source);
    fs.writeFileSync(target, oldShape);
  }
  fs.copyFileSync(terminalSource, path.join(fixtureDeployment, "workflow-production-fresh-host-terminal.cjs"));
  fs.copyFileSync(runtimeHelperSource, path.join(fixtureDeployment, "workflow-node-runtime.sh"));
  fs.cpSync(runtimeSource, path.join(fixtureDeployment, "runtime"), { recursive: true });
  fs.chmodSync(path.join(fixtureDeployment, "workflow-production-fresh-host-launcher.sh"), 0o755);
  const manifest = `${JSON.stringify({ schema: "aihub-r22-systemd-fixture-manifest-v1", launcherSha256: sha256(fs.readFileSync(path.join(fixtureDeployment, "workflow-production-fresh-host-launcher.sh"))) })}\n`;
  const deploymentSetDigest = sha256(Buffer.from(`r22-systemd-set:${manifest}`));
  const payloadDigest = sha256(Buffer.from(`r22-systemd-payload:${manifest}`));
  const deploymentManifestSha256 = sha256(Buffer.from(manifest));
  write(path.join(fixtureDeployment, "manifest.json"), manifest);
  write(path.join(fixtureRoot, ".aihub-workflow-release-bundle.json"), `${JSON.stringify({ deploymentSetDigest, deploymentManifestSha256, payloadDigest })}\n`);
  write(path.join(fixtureRoot, ".aihub-workflow-release-prepared.json"), `${JSON.stringify({ format: "aihub-workflow-production-release-prepared-v1", verified: true, deploymentSetDigest, deploymentManifestSha256, payloadDigest })}\n`);
  write(path.join(fixtureDeployment, "workflow-production-release-bundle.cjs"), [
    '"use strict";',
    'const c=require("node:crypto"),f=require("node:fs"),p=require("node:path");',
    'if(process.argv[2]!=="verify-prepared"||process.argv.length!==4)process.exit(2);',
    'const r=process.argv[3],m=JSON.parse(f.readFileSync(p.join(r,".aihub-workflow-release-prepared.json"))),b=JSON.parse(f.readFileSync(p.join(r,".aihub-workflow-release-bundle.json")));',
    'const h=x=>c.createHash("sha256").update(f.readFileSync(x)).digest("hex");',
    'if(m.format!=="aihub-workflow-production-release-prepared-v1"||m.verified!==true||m.deploymentManifestSha256!==h(p.join(r,"deployment/community-production/manifest.json")))process.exit(3);',
    'for(const k of ["deploymentSetDigest","deploymentManifestSha256","payloadDigest"])if(!/^[0-9a-f]{64}$/.test(m[k]||"")||m[k]!==b[k])process.exit(4);',
    ''
  ].join("\n"));
  write(path.join(fixtureDeployment, "workflow-production-fresh-host-runner.sh"), [
    "#!/bin/bash", "set -euo pipefail", "[[ $# -eq 1 && \"$1\" == __run ]]", `printf 1 > ${callPath}`, "sleep 3",
    `printf '%s\\n' '${JSON.stringify({ schema: "aihub-workflow-production-fresh-host-terminal-v1", status: "pass", runId: "workflow-production-r22", stage: null, code: null, stopCode: null, serverConnected: true, serverWritten: true, assetWrites: true, secretWrites: true, catalogWrites: true, databaseWrites: true, servicesStarted: true, productionExposed: true, servicesHealthy: 6, servicesStoppedOnFailure: false, sourcePosts: 3, events: 9, idempotency: 9, eventHead: 9, publicWorkflowCount: 3, resourceTablesAbsent: true, secretValuesEmitted: false })}'`, ""
  ].join("\n"), 0o755);
  return { deploymentSetDigest, deploymentManifestSha256, payloadDigest };
}
function waitSystemd() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const state = inner("systemctl is-system-running 2>/dev/null || true").stdout.trim();
    if (["running", "degraded"].includes(state)) return state;
  }
  throw new Error("systemd not ready");
}
async function waitTerminal(report) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = inner(`SUDO_UID=1000 SUDO_GID=1000 /bin/bash ${launcher} status`);
    if (result.status === 0) {
      const status = JSON.parse(result.stdout);
      if (status.state === "running") report.checks.runningObserved = true;
      if (status.terminal) return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("terminal not written");
}

(async () => {
  const report = { schema: "aihub-workflow-production-r22-systemd-v1", candidateOnly: true, deployable: false, serverConnected: false, serverWritten: false, status: "blocked", checks: { redMode, runningObserved: false }, cleanup: { completed: false } };
  try {
    const inspect = JSON.parse(must(docker(["image", "inspect", image]), "systemd image").stdout)[0];
    assert.equal(inspect.Config.Labels["com.aihub.test-contract"], imageContract);
    report.inputs = { imageId: inspect.Id, imageContract, launcherSha256: sha256(fs.readFileSync(launcherSource)), ...createFixture() };
    must(docker(["run", "-d", "--privileged", "--cgroupns=private", "--name", container, "--tmpfs", "/run", "--tmpfs", "/run/lock", "--tmpfs", "/tmp", image, "/sbin/init"]), "start PID1 fixture");
    report.checks.systemdState = waitSystemd();
    must(inner("mkdir -p /opt/zhenxing-ai/releases /opt/zhenxing-ai/shared/backups /opt/zhenxing-ai/fixture"), "roots");
    must(docker(["cp", fixtureRoot, `${container}:${releaseRoot}`]), "copy fixture");
    must(inner(`chown -R 1000:1000 ${releaseRoot}; find ${releaseRoot} -type d -exec chmod 0755 {} +; find ${releaseRoot} -type f -exec chmod 0644 {} +; chmod 0755 ${launcher} ${releaseRoot}/deployment/community-production/workflow-node-runtime.sh ${releaseRoot}/deployment/community-production/workflow-production-fresh-host-runner.sh`), "fixture metadata");
    must(docker(["exec", "-i", container, "/bin/bash", "-c", "umask 077; cat > /opt/zhenxing-ai/fixture/canary"], { input: canary }), "canary");
    const parent = inner(`set -euo pipefail; trap 'exit 129' HUP; SUDO_UID=1000 SUDO_GID=1000 /bin/bash ${launcher} launch > ${receiptPath}; kill -HUP $$`);
    assert.notEqual(parent.status, 0);
    report.checks.parentSessionHup = true;
    const terminal = await waitTerminal(report);
    assert.equal(terminal.state, redMode ? "failed" : "succeeded");
    const receipt = JSON.parse(must(inner(`cat ${receiptPath}`), "receipt").stdout);
    assert.equal(receipt.runId, "workflow-production-r22");
    assert.equal(receipt.unit, unit);
    if (redMode) {
      assert.equal(terminal.failureStage, "runtime-preflight");
      assert.equal(terminal.failureCode, "R16_RUNTIME_PREFLIGHT_FAILED");
      assert.notEqual(inner(`test -e ${callPath}`).status, 0);
      report.checks = { ...report.checks, oldReceiptPresent: true, workerCalls: 0, terminal };
      report.status = "pass";
    } else {
      assert.equal(must(inner(`cat ${callPath}`), "call count").stdout.trim(), "1");
      assert.notEqual(inner(`SUDO_UID=1000 SUDO_GID=1000 /bin/bash ${launcher} launch`).status, 0);
      assert.equal(must(inner(`cat ${callPath}`), "repeat call count").stdout.trim(), "1");
      const unitState = must(inner(`systemctl show ${unit} --property=Id --property=Environment --property=ExecStart`), "unit state").stdout;
      const journal = inner(`journalctl --no-pager --unit ${unit} 2>/dev/null || true`).stdout;
      assert.equal(`${JSON.stringify(receipt)}${JSON.stringify(terminal)}${unitState}${journal}`.includes(canary), false);
      report.checks = { ...report.checks, fixedUnit: unitState.includes(`Id=${unit}`), cleanEnvironment: /^Environment=$/m.test(unitState), workerCalls: 1, repeatedLaunchRejected: true, secretValueHits: 0, terminal };
      report.status = "pass";
    }
  } catch (error) {
    report.failure = { code: "R16_SYSTEMD_GATE_FAILED" };
    process.exitCode = 1;
  } finally {
    const removal = docker(["rm", "-f", container]);
    const residue = docker(["ps", "-aq", "--filter", `name=^/${container}$`]).stdout.trim();
    try { fs.rmSync(temporary, { recursive: true, force: true }); } catch {}
    report.cleanup = { completed: !residue && !fs.existsSync(temporary), containers: residue ? 1 : 0, networks: 0, volumes: 0, privateRoots: fs.existsSync(temporary) ? 1 : 0, removalStatus: removal.status === 0 || /No such container/i.test(removal.stderr || "") ? 0 : removal.status };
    if (!report.cleanup.completed && report.status === "pass") report.status = "partial";
    fs.mkdirSync(output, { recursive: false });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  assert.equal(report.status, "pass");
  process.stdout.write(`${JSON.stringify({ ok: true, reportPath })}\n`);
})().catch(() => { process.exitCode = 1; });
