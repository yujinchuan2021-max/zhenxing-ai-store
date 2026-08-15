"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const launcherSource = path.join(root, "deployment", "community-production", "workflow-production-cutover-launcher.sh");
const ubuntu = "ubuntu@sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea";
const testImage = "aihub-workflow-durable-systemd-test:ubuntu24-r1";
const imageContract = "aihub-workflow-durable-systemd-ubuntu24-r1";
const suffix = crypto.randomBytes(5).toString("hex");
const container = `aihub-workflow-durable-${suffix}`;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-durable-"));
const fixtureRoot = path.join(temporary, "community-production-durable-r10-test");
const fixtureDeployment = path.join(fixtureRoot, "deployment", "community-production");
const outputDirectory = path.join(root, "output", `workflow-production-durable-cutover-linux-${suffix}`);
const reportPath = path.join(outputDirectory, "report.json");
const releaseRoot = "/opt/zhenxing-ai/releases/community-production-durable-r10-test";
const launcher = `${releaseRoot}/deployment/community-production/workflow-production-cutover-launcher.sh`;
const statusPath = "/opt/zhenxing-ai/shared/workflow-production-r11/status.json";
const receiptPath = "/opt/zhenxing-ai/fixture/receipt-from-parent.json";
const unit = "zhenxing-ai-workflow-production-r11.service";
const secretValue = `durable-secret-${crypto.randomBytes(24).toString("hex")}`;

function run(command, args, options = {}) {
  const value = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options
  });
  if (value.error) throw value.error;
  return value;
}

function must(value, label) {
  assert.equal(value.status, 0, `${label}: ${String(value.stderr || value.stdout).slice(-4000)}`);
  return value;
}

function docker(args, options = {}) {
  return run("docker", args, options);
}

function inner(script, environment = {}) {
  const args = ["exec"];
  for (const [name, value] of Object.entries(environment)) args.push("--env", `${name}=${value}`);
  args.push(container, "/bin/bash", "-lc", script);
  return docker(args);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filename) {
  return sha256(fs.readFileSync(filename));
}

function writeFile(filename, body, mode = 0o644) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, body, { encoding: "utf8", mode });
  fs.chmodSync(filename, mode);
}

function buildTestImage() {
  const inspect = docker(["image", "inspect", testImage, "--format", "{{ index .Config.Labels \"com.aihub.test-contract\" }}"]);
  if (inspect.status === 0) {
    assert.equal(inspect.stdout.trim(), imageContract, "durable systemd test image contract drifted");
    return;
  }
  const dockerfile = [
    `FROM ${ubuntu}`,
    "ENV container=docker DEBIAN_FRONTEND=noninteractive",
    "RUN apt-get update && apt-get install -y --no-install-recommends systemd systemd-sysv nodejs ca-certificates && rm -rf /var/lib/apt/lists/*",
    "RUN getent group 1000 >/dev/null || groupadd --gid 1000 deploy; getent passwd 1000 >/dev/null || useradd --uid 1000 --gid 1000 --create-home deploy",
    "RUN systemctl mask systemd-remount-fs.service dev-hugepages.mount sys-fs-fuse-connections.mount",
    `LABEL com.aihub.test-contract=${imageContract}`,
    "STOPSIGNAL SIGRTMIN+3",
    "CMD [\"/sbin/init\"]",
    ""
  ].join("\n");
  must(docker(["build", "--pull=false", "--tag", testImage, "--file", "-", temporary], { input: dockerfile }), "build fixed systemd test image");
}

function createPreparedFixture() {
  fs.mkdirSync(fixtureDeployment, { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "artifacts"));
  fs.copyFileSync(launcherSource, path.join(fixtureDeployment, "workflow-production-cutover-launcher.sh"));
  fs.chmodSync(path.join(fixtureDeployment, "workflow-production-cutover-launcher.sh"), 0o755);

  const launcherSha256 = sha256File(launcherSource);
  const manifest = `${JSON.stringify({
    schema: "aihub-workflow-durable-systemd-fixture-manifest-v1",
    launcherSha256
  })}\n`;
  const deploymentSetDigest = sha256(Buffer.from(`durable-fixture-set:${launcherSha256}`, "utf8"));
  const payloadDigest = sha256(Buffer.from(`durable-fixture-payload:${launcherSha256}`, "utf8"));
  const bundle = `${JSON.stringify({
    schema: "aihub-workflow-durable-systemd-fixture-bundle-v1",
    deploymentSetDigest,
    deploymentManifestSha256: sha256(Buffer.from(manifest, "utf8")),
    launcherSha256,
    payloadDigest
  })}\n`;
  const marker = `${JSON.stringify({
    format: "aihub-workflow-production-release-prepared-v1",
    verified: true,
    deploymentSetDigest,
    deploymentManifestSha256: sha256(Buffer.from(manifest, "utf8")),
    payloadDigest
  })}\n`;

  writeFile(path.join(fixtureDeployment, "manifest.json"), manifest);
  writeFile(path.join(fixtureRoot, ".aihub-workflow-release-bundle.json"), bundle);
  writeFile(path.join(fixtureRoot, ".aihub-workflow-release-prepared.json"), marker);
  writeFile(path.join(fixtureDeployment, "compose.server.yaml"), "services: {}\n");
  writeFile(path.join(fixtureDeployment, "compose.workflow-production.yaml"), "services: {}\n");
  writeFile(path.join(fixtureRoot, "artifacts", "identity-r7-image.tar"), "durable fixture only\n");
  writeFile(path.join(fixtureDeployment, "workflow-node-runtime.sh"), [
    "#!/bin/bash",
    "preflight_workflow_node_runtime() { :; }",
    "prepare_workflow_node_runtime() { printf '%s\\n' /usr/bin/node; }",
    ""
  ].join("\n"), 0o755);
  writeFile(path.join(fixtureDeployment, "workflow-production-release-bundle.cjs"), [
    '"use strict";',
    'const crypto = require("node:crypto");',
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const sha256 = (filename) => crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");',
    'if (process.argv[2] !== "verify-prepared" || !path.isAbsolute(process.argv[3] || "")) process.exit(2);',
    'const release = process.argv[3];',
    'const marker = JSON.parse(fs.readFileSync(path.join(release, ".aihub-workflow-release-prepared.json"), "utf8"));',
    'const bundle = JSON.parse(fs.readFileSync(path.join(release, ".aihub-workflow-release-bundle.json"), "utf8"));',
    'const manifest = path.join(release, "deployment", "community-production", "manifest.json");',
    'const launcher = path.join(release, "deployment", "community-production", "workflow-production-cutover-launcher.sh");',
    'if (marker.format !== "aihub-workflow-production-release-prepared-v1" || marker.verified !== true) process.exit(3);',
    'for (const key of ["deploymentSetDigest", "deploymentManifestSha256", "payloadDigest"]) {',
    '  if (!/^[0-9a-f]{64}$/.test(marker[key] || "") || marker[key] !== bundle[key]) process.exit(4);',
    '}',
    'if (marker.deploymentManifestSha256 !== sha256(manifest) || bundle.launcherSha256 !== sha256(launcher)) process.exit(5);',
    ""
  ].join("\n"));
  writeFile(path.join(fixtureDeployment, "workflow-production-cutover.sh"), [
    "#!/bin/bash",
    "set -euo pipefail",
    "[[ $# -eq 5 ]] || exit 20",
    "evidence_root=\"$4\"",
    "target=\"$evidence_root/workflow-production-cutover-stub\"",
    "mkdir -- \"$target\"",
    "trap 'printf reached > \"$target/hup-reached\"; exit 129' HUP",
    "counter=/opt/zhenxing-ai/fixture/cutover-calls",
    "[[ ! -e \"$counter\" ]] || exit 21",
    "printf 1 > \"$counter\"",
    "printf started > \"$target/started\"",
    "sleep 5",
    "printf '{\"schema\":\"aihub-workflow-durable-stub-v1\",\"completed\":true}\\n' > \"$target/terminal.json\"",
    ""
  ].join("\n"), 0o755);
  return { deploymentSetDigest, launcherSha256, payloadDigest };
}

const launchEnvironment = Object.freeze({
  SUDO_UID: "1000",
  SUDO_GID: "1000",
  COMPOSE_PROJECT_NAME: "aihubworkflowdurabler7",
  AIHUB_ADMIN_DATA_DIR: "/opt/zhenxing-ai/fixture/admin-data",
  AIHUB_ADMIN_PUBLISHED_DIR: "/opt/zhenxing-ai/fixture/admin-published",
  AIHUB_ADMIN_OUTPUT_DIR: "/opt/zhenxing-ai/fixture/admin-output",
  AIHUB_IDENTITY_DB_DIR: "/opt/zhenxing-ai/fixture/identity-db",
  AIHUB_COMMUNITY_DB_DIR: "/opt/zhenxing-ai/fixture/community-db",
  AIHUB_COMMUNITY_CONFIG_DIR: "/opt/zhenxing-ai/fixture/community-config",
  AIHUB_COMMUNITY_STORAGE_DIR: "/opt/zhenxing-ai/fixture/community-storage",
  AIHUB_COMMUNITY_ASSETS_DIR: "/opt/zhenxing-ai/fixture/community-assets",
  AIHUB_SECRET_DIR: "/opt/zhenxing-ai/fixture/secrets",
  AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR: "/opt/zhenxing-ai/fixture/secrets",
  AIHUB_FORUM_ADMIN_EMAIL: "workflow-durable@example.invalid",
  AIHUB_PUBLIC_HOST: "workflow-durable.invalid",
  AIHUB_COMMUNITY_PUBLIC_HOST: "community.workflow-durable.invalid",
  AIHUB_CADDY_DATA_VOLUME: "aihub-workflow-durable-caddy-data",
  AIHUB_CADDY_CONFIG_VOLUME: "aihub-workflow-durable-caddy-config",
  AIHUB_CADDY_CMS_SECRET_VOLUME: "aihub-workflow-durable-caddy-secret"
});

function waitForSystemd() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const state = inner("systemctl is-system-running 2>/dev/null || true").stdout.trim();
    if (state === "running" || state === "degraded") return state;
  }
  throw new Error("systemd did not reach a usable state");
}

async function waitForTerminal(report) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const current = inner(`SUDO_UID=1000 SUDO_GID=1000 /bin/bash ${launcher} status`, launchEnvironment);
    if (current.status === 0) {
      const status = JSON.parse(current.stdout);
      if (status.state === "running" && !report.checks.runningObserved) {
        report.checks.runningObserved = true;
        const unitState = must(inner(`systemctl show ${unit} --property=Id --property=MainPID --property=Environment --property=ExecStart --property=ActiveState`), "inspect fixed transient unit").stdout;
        report.checks.unit = {
          fixed: unitState.includes(`Id=${unit}`),
          active: unitState.includes("ActiveState=active"),
          environmentEmpty: /^Environment=$/m.test(unitState),
          secretValueHits: unitState.includes(secretValue) ? 1 : 0
        };
      }
      if (status.state === "succeeded" || status.state === "failed") return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("durable worker did not write a terminal status");
}

(async () => {
  const report = {
    schema: "aihub-workflow-production-durable-cutover-linux-v1",
    candidateOnly: true,
    deployable: false,
    serverConnected: false,
    status: "running",
    inputs: {},
    checks: { runningObserved: false },
    cleanup: { completed: false }
  };
  try {
    buildTestImage();
    const fixture = createPreparedFixture();
    fs.mkdirSync(outputDirectory, { recursive: false });
    report.inputs = {
      image: testImage,
      imageId: JSON.parse(must(docker(["image", "inspect", testImage]), "inspect systemd test image").stdout)[0].Id,
      imageContract,
      ubuntu,
      launcherSha256: fixture.launcherSha256,
      deploymentSetDigest: fixture.deploymentSetDigest,
      payloadDigest: fixture.payloadDigest
    };

    must(docker([
      "run", "-d", "--privileged", "--cgroupns=private", "--name", container,
      "--tmpfs", "/run", "--tmpfs", "/run/lock", "--tmpfs", "/tmp",
      testImage, "/sbin/init"
    ]), "start true-Linux systemd fixture");
    report.checks.systemdState = waitForSystemd();
    must(inner("mkdir -p /opt/zhenxing-ai/releases /opt/zhenxing-ai/shared/backups /opt/zhenxing-ai/fixture; chown 1000:1000 /opt/zhenxing-ai/shared /opt/zhenxing-ai/shared/backups /opt/zhenxing-ai/fixture"), "create fixed durable roots");
    must(docker(["cp", fixtureRoot, `${container}:${releaseRoot}`]), "copy exact launcher fixture");
    must(inner(`chown -R 1000:1000 ${releaseRoot}; find ${releaseRoot} -type d -exec chmod 0755 {} +; find ${releaseRoot} -type f -exec chmod 0644 {} +; chmod 0755 ${launcher} ${releaseRoot}/deployment/community-production/workflow-node-runtime.sh ${releaseRoot}/deployment/community-production/workflow-production-cutover.sh`), "normalize prepared fixture metadata");
    const fixtureDirectories = Object.values(launchEnvironment).filter((value) => value.startsWith("/opt/zhenxing-ai/fixture/"));
    must(inner(`mkdir -p ${[...new Set(fixtureDirectories)].join(" ")}; chown -R 1000:1000 /opt/zhenxing-ai/fixture; chmod 0700 /opt/zhenxing-ai/fixture/secrets`), "create allowlisted runtime directories");
    must(docker(["exec", "-i", container, "/bin/bash", "-c", "umask 077; cat > /opt/zhenxing-ai/fixture/secrets/community_cms_gateway"], { input: secretValue }), "stream fixture secret outside argv");
    must(inner("chown 1000:1000 /opt/zhenxing-ai/fixture/secrets/community_cms_gateway; chmod 0600 /opt/zhenxing-ai/fixture/secrets/community_cms_gateway"), "normalize fixture secret metadata");

    const parentHupCommand = `set -euo pipefail; trap 'exit 129' HUP; /bin/bash ${launcher} launch > ${receiptPath}; test -s ${receiptPath}; kill -HUP $$`;
    const parent = inner(parentHupCommand, launchEnvironment);
    assert.notEqual(parent.status, 0, "caller session HUP did not terminate the caller");
    assert.equal(inner(`test -s ${receiptPath}`).status, 0, `durable launcher did not write a receipt: ${String(parent.stderr).slice(-2000)}`);
    report.checks.parentSessionHup = true;

    const terminal = await waitForTerminal(report);
    report.checks.observedTerminal = terminal;
    report.checks.preCutoverDiagnostics = {
      cutoverCallFile: inner("test -e /opt/zhenxing-ai/fixture/cutover-calls").status === 0,
      evidenceEntries: inner("find /opt/zhenxing-ai/shared/backups/workflow-production-r11-evidence -mindepth 1 -maxdepth 2 -printf '%P\\n' 2>/dev/null || true").stdout.trim().split(/\r?\n/).filter(Boolean),
      unitJournal: inner(`journalctl --no-pager --unit ${unit} 2>/dev/null || true`).stdout.slice(-4000)
    };
    assert.equal(terminal.state, "succeeded");
    assert.equal(terminal.exitCode, 0);
    assert.equal(terminal.evidencePath, "/opt/zhenxing-ai/shared/backups/workflow-production-r11-evidence/workflow-production-cutover-stub");
    assert.equal(report.checks.runningObserved, true, "worker was never observed after caller HUP");
    assert.deepEqual(report.checks.unit, { fixed: true, active: true, environmentEmpty: true, secretValueHits: 0 });
    const receipt = JSON.parse(must(inner(`cat ${receiptPath}`), "read durable receipt").stdout);
    assert.equal(receipt.accepted, true);
    assert.equal(receipt.runId, "workflow-production-r11");
    assert.equal(receipt.unit, unit);
    assert.equal(receipt.statusPath, statusPath);
    const stubTerminal = JSON.parse(must(inner("cat /opt/zhenxing-ai/shared/backups/workflow-production-r11-evidence/workflow-production-cutover-stub/terminal.json"), "read cutover stub terminal").stdout);
    assert.deepEqual(stubTerminal, { schema: "aihub-workflow-durable-stub-v1", completed: true });
    const hupReachedCutover = inner("test -e /opt/zhenxing-ai/shared/backups/workflow-production-r11-evidence/workflow-production-cutover-stub/hup-reached").status === 0;
    assert.equal(hupReachedCutover, false, "caller HUP reached the systemd-owned cutover");
    const cutoverCalls = Number(must(inner("cat /opt/zhenxing-ai/fixture/cutover-calls"), "read cutover call count").stdout.trim());
    assert.equal(cutoverCalls, 1);

    const repeated = inner(`/bin/bash ${launcher} launch`, launchEnvironment);
    assert.notEqual(repeated.status, 0, "repeated durable launch unexpectedly succeeded");
    assert.match(repeated.stderr, /Workflow durable run already exists/);
    assert.equal(Number(must(inner("cat /opt/zhenxing-ai/fixture/cutover-calls"), "re-read cutover call count").stdout.trim()), 1);
    const journal = inner(`journalctl --no-pager --unit ${unit} 2>/dev/null || true`).stdout;
    const collected = `${JSON.stringify(receipt)}${JSON.stringify(terminal)}${JSON.stringify(stubTerminal)}${journal}`;
    const secretValueHits = collected.includes(secretValue) ? 1 : 0;
    assert.equal(secretValueHits, 0);
    report.checks = {
      ...report.checks,
      receiptAccepted: true,
      terminal,
      cutoverStubTerminal: stubTerminal,
      hupReachedCutover,
      cutoverCalls,
      repeatedLaunchRejected: true,
      secretValueHits
    };
    report.status = "pass";
  } catch (error) {
    report.status = "blocked";
    report.failure = {
      name: error?.name || "Error",
      message: String(error?.message || error || "failure").replaceAll(secretValue, "[REDACTED]").slice(-4000)
    };
    process.exitCode = 1;
  } finally {
    const removal = docker(["rm", "-f", container]);
    const containerResidue = docker(["ps", "-aq", "--filter", `name=^/${container}$`]).stdout.trim();
    try { fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
    report.cleanup = {
      completed: !containerResidue && !fs.existsSync(temporary),
      containerResidue: containerResidue ? 1 : 0,
      temporaryRemoved: !fs.existsSync(temporary),
      removalStatus: removal.status === 0 || /No such container/i.test(removal.stderr || "") ? 0 : removal.status,
      retainedFixedTestImage: testImage
    };
    if (!report.cleanup.completed && report.status === "pass") {
      report.status = "partial";
      process.exitCode = 1;
    }
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ ok: report.status === "pass", reportPath })}\n`);
  }
})();
