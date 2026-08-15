"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const launcherSource = path.join(root, "deployment", "community-production", "workflow-production-r12-launcher.sh");
const image = "aihub-workflow-durable-systemd-test:ubuntu24-r1";
const imageContract = "aihub-workflow-durable-systemd-ubuntu24-r1";
const suffix = crypto.randomBytes(5).toString("hex");
const container = `aihub-workflow-r12-systemd-${suffix}`;
const output = path.join(root, "output", `workflow-production-r12-systemd-${suffix}`);
const reportPath = path.join(output, "report.json");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-r12-systemd-"));
const fixtureRoot = path.join(temporary, `community-production-r12-systemd-${suffix}`);
const fixtureDeployment = path.join(fixtureRoot, "deployment", "community-production");
const releaseRoot = `/opt/zhenxing-ai/releases/community-production-r12-systemd-${suffix}`;
const launcher = `${releaseRoot}/deployment/community-production/workflow-production-r12-launcher.sh`;
const unit = "zhenxing-ai-workflow-production-r12.service";
const statusPath = "/opt/zhenxing-ai/shared/workflow-production-r12/status.json";
const receiptPath = "/opt/zhenxing-ai/fixture/receipt.json";
const callPath = "/opt/zhenxing-ai/fixture/coordinator-calls";
const secretValue = crypto.randomBytes(32).toString("hex");

function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options
  });
  if (result.error) throw result.error;
  return result;
}

function docker(args, options) { return run("docker", args, options); }
function must(result, label) {
  assert.equal(result.status, 0, `${label}: ${String(result.stderr || result.stdout).slice(-2000)}`);
  return result;
}
function inner(script, environment = {}) {
  const args = ["exec"];
  for (const [name, value] of Object.entries(environment)) args.push("--env", `${name}=${value}`);
  args.push(container, "/bin/bash", "-lc", script);
  return docker(args);
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function writeFile(filename, body, mode = 0o644) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, body, { encoding: "utf8", mode });
  fs.chmodSync(filename, mode);
}

function createPreparedFixture() {
  fs.mkdirSync(fixtureDeployment, { recursive: true });
  fs.copyFileSync(launcherSource, path.join(fixtureDeployment, "workflow-production-r12-launcher.sh"));
  fs.chmodSync(path.join(fixtureDeployment, "workflow-production-r12-launcher.sh"), 0o755);
  const manifest = `${JSON.stringify({ schema: "aihub-r12-systemd-fixture-manifest-v1", launcherSha256: sha256(fs.readFileSync(launcherSource)) })}\n`;
  const deploymentSetDigest = sha256(Buffer.from(`r12-systemd-set:${manifest}`, "utf8"));
  const payloadDigest = sha256(Buffer.from(`r12-systemd-payload:${manifest}`, "utf8"));
  const manifestSha256 = sha256(Buffer.from(manifest, "utf8"));
  const bundle = `${JSON.stringify({ schema: "aihub-r12-systemd-fixture-bundle-v1", deploymentSetDigest, deploymentManifestSha256: manifestSha256, payloadDigest })}\n`;
  const marker = `${JSON.stringify({ format: "aihub-workflow-production-release-prepared-v1", verified: true, deploymentSetDigest, deploymentManifestSha256: manifestSha256, payloadDigest })}\n`;
  writeFile(path.join(fixtureDeployment, "manifest.json"), manifest);
  writeFile(path.join(fixtureRoot, ".aihub-workflow-release-bundle.json"), bundle);
  writeFile(path.join(fixtureRoot, ".aihub-workflow-release-prepared.json"), marker);
  writeFile(path.join(fixtureDeployment, "workflow-node-runtime.sh"), [
    "#!/bin/bash",
    "preflight_workflow_node_runtime() { [[ -x /usr/bin/node ]]; }",
    "prepare_workflow_node_runtime() { printf '%s\\n' /usr/bin/node; }",
    ""
  ].join("\n"), 0o755);
  writeFile(path.join(fixtureDeployment, "workflow-production-release-bundle.cjs"), [
    '"use strict";',
    'const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");',
    'const sha=(file)=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");',
    'if(process.argv[2]!=="verify-prepared"||!path.isAbsolute(process.argv[3]||"")||process.argv.length!==4)process.exit(2);',
    'const root=process.argv[3],marker=JSON.parse(fs.readFileSync(path.join(root,".aihub-workflow-release-prepared.json"),"utf8"));',
    'const bundle=JSON.parse(fs.readFileSync(path.join(root,".aihub-workflow-release-bundle.json"),"utf8"));',
    'if(marker.format!=="aihub-workflow-production-release-prepared-v1"||marker.verified!==true)process.exit(3);',
    'for(const key of ["deploymentSetDigest","deploymentManifestSha256","payloadDigest"]){if(!/^[0-9a-f]{64}$/.test(marker[key]||"")||marker[key]!==bundle[key])process.exit(4);}',
    'if(marker.deploymentManifestSha256!==sha(path.join(root,"deployment/community-production/manifest.json")))process.exit(5);',
    ""
  ].join("\n"));
  writeFile(path.join(fixtureDeployment, "workflow-production-r12-prepared-coordinator.cjs"), [
    '"use strict";',
    'const fs=require("node:fs");',
    `const call=${JSON.stringify(callPath)},hup="/opt/zhenxing-ai/fixture/coordinator-hup";`,
    'process.on("SIGHUP",()=>{fs.writeFileSync(hup,"1");process.exit(129);});',
    'fs.writeFileSync(call,"1",{flag:"wx",mode:0o600});',
    'setTimeout(()=>{process.stdout.write(JSON.stringify({schema:"aihub-r12-terminal-v1",status:"pass",runId:"workflow-production-r12",stage:null,code:null,rollbackCode:null})+"\\n");},3000);',
    ""
  ].join("\n"));
  return { deploymentSetDigest, manifestSha256, payloadDigest };
}

const launchEnvironment = Object.freeze({
  SUDO_UID: "1000",
  SUDO_GID: "1000",
  COMPOSE_PROJECT_NAME: "zhenxing-community-production",
  AIHUB_ADMIN_DATA_DIR: "/opt/zhenxing-ai/fixture/admin-data",
  AIHUB_ADMIN_PUBLISHED_DIR: "/opt/zhenxing-ai/fixture/admin-published",
  AIHUB_ADMIN_OUTPUT_DIR: "/opt/zhenxing-ai/fixture/admin-output",
  AIHUB_IDENTITY_DB_DIR: "/opt/zhenxing-ai/fixture/identity-db",
  AIHUB_COMMUNITY_DB_DIR: "/opt/zhenxing-ai/fixture/community-db",
  AIHUB_COMMUNITY_CONFIG_DIR: "/opt/zhenxing-ai/fixture/community-config",
  AIHUB_COMMUNITY_STORAGE_DIR: "/opt/zhenxing-ai/fixture/community-storage",
  AIHUB_COMMUNITY_ASSETS_DIR: "/opt/zhenxing-ai/fixture/community-assets",
  AIHUB_SECRET_DIR: "/opt/zhenxing-ai/fixture/secrets",
  AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR: "/opt/zhenxing-ai/fixture/workflow-secrets",
  AIHUB_PUBLIC_HOST: "r12.localhost",
  AIHUB_COMMUNITY_PUBLIC_HOST: "community.r12.localhost",
  AIHUB_CADDY_DATA_VOLUME: "r12-systemd-caddy-data",
  AIHUB_CADDY_CONFIG_VOLUME: "r12-systemd-caddy-config",
  AIHUB_CADDY_CMS_SECRET_VOLUME: "r12-systemd-caddy-secret",
  AIHUB_FORUM_ADMIN_EMAIL: "r12-systemd@example.invalid"
});

function waitForSystemd() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const state = inner("systemctl is-system-running 2>/dev/null || true").stdout.trim();
    if (state === "running" || state === "degraded") return state;
  }
  throw new Error("systemd did not become ready");
}

async function waitForTerminal(report) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const value = inner(`SUDO_UID=1000 SUDO_GID=1000 /bin/bash ${launcher} status`, launchEnvironment);
    if (value.status === 0) {
      const status = JSON.parse(value.stdout);
      if (status.state === "running") report.checks.runningObserved = true;
      if (status.terminal === true) return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("r12 durable terminal was not written");
}

(async () => {
  const report = {
    schema: "aihub-workflow-production-r12-systemd-v1",
    candidateOnly: true,
    deployable: false,
    serverConnected: false,
    status: "blocked",
    checks: { runningObserved: false },
    cleanup: { completed: false }
  };
  try {
    const imageInspect = JSON.parse(must(docker(["image", "inspect", image]), "inspect fixed systemd image").stdout)[0];
    assert.equal(imageInspect.Config.Labels["com.aihub.test-contract"], imageContract);
    report.inputs = { imageContract, imageId: imageInspect.Id, launcherSha256: sha256(fs.readFileSync(launcherSource)), ...createPreparedFixture() };
    must(docker(["run", "-d", "--privileged", "--cgroupns=private", "--name", container, "--tmpfs", "/run", "--tmpfs", "/run/lock", "--tmpfs", "/tmp", image, "/sbin/init"]), "start r12 PID1 fixture");
    report.checks.systemdState = waitForSystemd();
    must(inner("mkdir -p /opt/zhenxing-ai/releases /opt/zhenxing-ai/shared/backups /opt/zhenxing-ai/fixture; chown 1000:1000 /opt/zhenxing-ai/shared /opt/zhenxing-ai/shared/backups /opt/zhenxing-ai/fixture"), "prepare fixed roots");
    must(docker(["cp", fixtureRoot, `${container}:${releaseRoot}`]), "copy r12 launcher fixture");
    must(inner(`chown -R 1000:1000 ${releaseRoot}; find ${releaseRoot} -type d -exec chmod 0755 {} +; find ${releaseRoot} -type f -exec chmod 0644 {} +; chmod 0755 ${launcher} ${releaseRoot}/deployment/community-production/workflow-node-runtime.sh`), "normalize fixture metadata");
    const directories = [...new Set(Object.values(launchEnvironment).filter((value) => value.startsWith("/opt/zhenxing-ai/fixture/")))];
    must(inner(`mkdir -p ${directories.join(" ")}; chown -R 1000:1000 /opt/zhenxing-ai/fixture; chmod 0700 /opt/zhenxing-ai/fixture/secrets /opt/zhenxing-ai/fixture/workflow-secrets`), "prepare environment directories");
    must(docker(["exec", "-i", container, "/bin/bash", "-c", "umask 077; cat > /opt/zhenxing-ai/fixture/secrets/canary"], { input: secretValue }), "stream canary outside argv");

    const parent = inner(`set -euo pipefail; trap 'exit 129' HUP; /bin/bash ${launcher} launch > ${receiptPath}; test -s ${receiptPath}; kill -HUP $$`, launchEnvironment);
    assert.notEqual(parent.status, 0);
    assert.equal(inner(`test -s ${receiptPath}`).status, 0);
    report.checks.parentSessionHup = true;

    const terminal = await waitForTerminal(report);
    assert.equal(terminal.state, "succeeded");
    assert.equal(terminal.exitCode, 0);
    assert.equal(report.checks.runningObserved, true);
    const receipt = JSON.parse(must(inner(`cat ${receiptPath}`), "read receipt").stdout);
    assert.equal(receipt.runId, "workflow-production-r12");
    assert.equal(receipt.unit, unit);
    assert.equal(receipt.statusPath, statusPath);
    assert.equal(must(inner(`cat ${callPath}`), "read coordinator call count").stdout.trim(), "1");
    assert.notEqual(inner(`/bin/bash ${launcher} launch`, launchEnvironment).status, 0);
    assert.equal(must(inner(`cat ${callPath}`), "re-read coordinator call count").stdout.trim(), "1");
    const unitState = must(inner(`systemctl show ${unit} --property=Id --property=Environment --property=ExecStart`), "inspect transient unit").stdout;
    const journal = inner(`journalctl --no-pager --unit ${unit} 2>/dev/null || true`).stdout;
    const projected = `${JSON.stringify(receipt)}${JSON.stringify(terminal)}${unitState}${journal}`;
    assert.equal(projected.includes(secretValue), false);
    assert.equal(inner("test -e /opt/zhenxing-ai/fixture/coordinator-hup").status, 1);
    report.checks = {
      ...report.checks,
      fixedUnit: unitState.includes(`Id=${unit}`),
      cleanEnvironment: /^Environment=$/m.test(unitState),
      coordinatorCalls: 1,
      repeatedLaunchRejected: true,
      workerHupObserved: false,
      secretValueHits: 0,
      terminal
    };
    report.status = "pass";
  } catch (error) {
    report.failure = { code: "R12_SYSTEMD_GATE_FAILED", message: String(error?.message || error).replaceAll(secretValue, "[REDACTED]").slice(-2000) };
    process.exitCode = 1;
  } finally {
    const removal = docker(["rm", "-f", container]);
    const residue = docker(["ps", "-aq", "--filter", `name=^/${container}$`]).stdout.trim();
    try { fs.rmSync(temporary, { recursive: true, force: true }); } catch {}
    report.cleanup = {
      completed: !residue && !fs.existsSync(temporary),
      containerResidue: residue ? 1 : 0,
      temporaryRemoved: !fs.existsSync(temporary),
      removalStatus: removal.status === 0 || /No such container/i.test(removal.stderr || "") ? 0 : removal.status
    };
    if (!report.cleanup.completed && report.status === "pass") report.status = "partial";
    fs.mkdirSync(output, { recursive: false });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }
  assert.equal(report.status, "pass", report.failure?.message || "r12 systemd gate blocked");
  process.stdout.write(`${JSON.stringify({ ok: true, reportPath })}\n`);
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

