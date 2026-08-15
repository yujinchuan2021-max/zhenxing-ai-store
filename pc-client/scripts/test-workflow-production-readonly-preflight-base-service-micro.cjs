"use strict";

// Local-only diagnostic for the pre-migration base-service control-plane seam.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const TEST_IMAGE = "aihub-workflow-release-prepare-test:ubuntu24-dind";
const TEST_IMAGE_ID = "sha256:2f5e683c88da8f770a788cb9ab72e213d70cc7a2ae2c007e2b41ae8a99f4ed40";
const POSTGRES_REF = "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193";
const POSTGRES_ARCHIVE_REF = "postgres:17-alpine";
const POSTGRES_ID = "sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193";
const REPORT_SCHEMA = "aihub-workflow-production-base-service-micro-v1";
const SETUP_STAGES = Object.freeze(["image-contract-ready", "inner-daemon-ready", "transfer-normalized", "prepared-runtime-ready"]);
const SETUP_FAILURE_REASONS = Object.freeze(["setup-image-contract", "setup-inner-daemon", "setup-transfer-normalization", "setup-prepared-runtime"]);
const FAILURE_REASONS = Object.freeze(["mount-secret", "cgroup-security", "oci-runtime", "image-platform", "daemon", "unknown", ...SETUP_FAILURE_REASONS]);
const MICRO_STAGES = Object.freeze([
  { id: "A", service: "identity-database", args: ["--network", "none"] },
  { id: "B", service: "identity-database", args: ["--network", "none", "--security-opt", "no-new-privileges:true"] },
  { id: "C", service: "identity-database", args: ["--network", "none", "--security-opt", "no-new-privileges:true", "--memory", "256m", "--cpus", "0.40", "--pids-limit", "192"] },
  { id: "D", service: "identity-database", args: ["--network", "none", "--security-opt", "no-new-privileges:true", "--memory", "256m", "--cpus", "0.40", "--pids-limit", "192", "--mount", "type=bind,src=/workspace/identity-db,dst=/var/lib/postgresql/data"] },
  { id: "E", service: "identity-database", args: ["--network", "none", "--security-opt", "no-new-privileges:true", "--memory", "256m", "--cpus", "0.40", "--pids-limit", "192", "--mount", "type=bind,src=/workspace/identity-db,dst=/var/lib/postgresql/data", "--mount", "type=bind,src=/workspace/secrets/identity_db_password,dst=/run/secrets/identity_db_password,readonly", "-e", "POSTGRES_PASSWORD_FILE=/run/secrets/identity_db_password"] },
  { id: "F", service: "identity-database", args: [] }
]);

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function fixedObject(value, keys) { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function isSafeLinuxTransferMode(mode) { return Number.isInteger(mode) && (mode & 0o7022) === 0; }
function normalizedLinuxTransferMode(isDirectory) { return isDirectory ? 0o700 : 0o600; }
function walkRegular(root) {
  const real = fs.realpathSync(root);
  const rootStat = fs.lstatSync(real);
  assert.equal(rootStat.isDirectory(), true, "transfer root is not a directory");
  assert.equal(rootStat.isSymbolicLink(), false, "transfer root is a symlink");
  const entries = [real];
  for (const entry of fs.readdirSync(real, { withFileTypes: true })) {
    const target = path.join(real, entry.name);
    const stat = fs.lstatSync(target);
    assert.equal(stat.isSymbolicLink(), false, "transfer entry is a symlink");
    assert.ok(stat.isDirectory() || stat.isFile(), "transfer entry is not regular");
    entries.push(target);
    if (stat.isDirectory()) entries.push(...walkRegular(target));
  }
  return entries;
}
function assertSafeTransferModes(root) {
  for (const entry of walkRegular(root)) {
    const stat = fs.lstatSync(entry);
    assert.equal(isSafeLinuxTransferMode(stat.mode), true, "transfer source mode is unsafe");
    if (stat.isFile()) assert.equal(stat.nlink, 1, "transfer source is a hard link");
  }
  return true;
}

function classifyMicroFailure(stderr) {
  const text = String(stderr || "").toLowerCase();
  if (/mount|secret|bind source path|permission denied/.test(text)) return "mount-secret";
  if (/operation not permitted|cgroup|sysctl/.test(text)) return "cgroup-security";
  if (/oci|runc|shim|exec format/.test(text)) return "oci-runtime";
  if (/manifest|platform/.test(text)) return "image-platform";
  if (/daemon|docker info|connection refused/.test(text)) return "daemon";
  return "unknown";
}

function createMicroReport({ status, lastCompletedStage, failureReason, service, cleanup }) {
  const report = {
    schema: REPORT_SCHEMA, candidateOnly: true, deployable: false, status,
    lastCompletedStage, failureReason, service, cleanup,
    terminal: { finalized: true, exitCode: status === "pass" ? 0 : 1 }
  };
  validateMicroReport(report);
  return report;
}

function validateMicroReport(report) {
  assert.ok(fixedObject(report, ["schema", "candidateOnly", "deployable", "status", "lastCompletedStage", "failureReason", "service", "cleanup", "terminal"]), "micro report keys drifted");
  assert.equal(report.schema, REPORT_SCHEMA);
  assert.equal(report.candidateOnly, true);
  assert.equal(report.deployable, false);
  assert.ok(["pass", "blocked", "partial"].includes(report.status));
  assert.ok([...SETUP_STAGES, ...MICRO_STAGES.map((stage) => stage.id), null].includes(report.lastCompletedStage));
  assert.ok([...FAILURE_REASONS, null].includes(report.failureReason));
  assert.ok(!(report.lastCompletedStage === null && report.failureReason === "unknown"), "setup failure must be classified");
  assert.ok(["identity-database", "community-database", "admin", null].includes(report.service));
  assert.ok(fixedObject(report.cleanup, ["completed", "containers", "networks", "volumes", "privateRoots"]));
  assert.equal(typeof report.cleanup.completed, "boolean");
  for (const key of ["containers", "networks", "volumes", "privateRoots"]) assert.ok(Number.isInteger(report.cleanup[key]) && report.cleanup[key] >= 0);
  assert.ok(fixedObject(report.terminal, ["finalized", "exitCode"]));
  assert.equal(report.terminal.finalized, true);
  assert.equal(report.terminal.exitCode, report.status === "pass" ? 0 : 1);
  return true;
}

function runMicroPlan({ runStage }) {
  assert.equal(typeof runStage, "function");
  let lastCompletedStage = null;
  for (const stage of MICRO_STAGES) {
    const result = runStage(stage);
    assert.ok(result && typeof result.ok === "boolean" && typeof result.stderr === "string");
    if (!result.ok) return { status: "blocked", lastCompletedStage, failureReason: classifyMicroFailure(result.stderr), service: stage.id === "F" ? "identity-database" : null };
    lastCompletedStage = stage.id;
  }
  return { status: "pass", lastCompletedStage, failureReason: null, service: null };
}

function call(command, args, options = {}) { return spawnSync(command, args, { encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024, ...options }); }
function docker(args, options) { return call("docker", args, options); }
function must(value, label) { assert.equal(value.status, 0, label); return value; }
function atomicWrite(target, report) {
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(report)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, target);
}
function exactImage(image) {
  const value = docker(["image", "inspect", TEST_IMAGE]);
  assert.equal(value.status, 0, "fixed DinD image is missing");
  const inspected = JSON.parse(value.stdout)[0];
  assert.equal(inspected.Id, TEST_IMAGE_ID, "fixed DinD image ID drifted");
  assert.equal(inspected.Os, "linux", "fixed DinD OS drifted");
  assert.equal(inspected.Architecture, "amd64", "fixed DinD architecture drifted");
  return image;
}

function stageProgram() {
  return `"use strict";
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const stages = ${JSON.stringify(MICRO_STAGES)};
const postgres = ${JSON.stringify(POSTGRES_REF)};
const compose = ["compose", "--env-file", "/workspace/base/.env", "--project-name", "aihub-base-service-micro", "-f", "/workspace/base/compose.server.yaml", "-f", "/workspace/base/compose.workflow-production.yaml", "-f", "/workspace/base/compose.windows-acceptance.yaml", "-f", "/workspace/base/ports.override.yaml", "-f", "/workspace/base/caddy.override.yaml"];
function run(args) { return spawnSync("docker", args, { encoding: "utf8" }); }
function once(stage) {
  if (stage.id === "F") return run([...compose, "up", "-d", "identity-database"]);
  const name = "aihub-base-micro-" + stage.id.toLowerCase();
  const result = run(["run", "--pull=never", "--rm", "--name", name, ...stage.args, postgres, "/bin/true"]);
  return result;
}
for (const stage of stages) {
  const result = once(stage);
  if (result.status !== 0) { process.stdout.write(JSON.stringify({ ok:false, stage:stage.id, stderr:String(result.stderr || "") })); process.exitCode=1; break; }
  process.stdout.write(JSON.stringify({ ok:true, stage:stage.id }) + "\\n");
}`;
}

function runLocalMicro(bundleRoot) {
  const suffix = crypto.randomBytes(5).toString("hex");
  const container = `aihub-base-service-micro-${suffix}`;
  const volume = `${container}-docker`;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-base-service-micro-"));
  const output = path.join(root, "output", `workflow-production-base-service-micro-${suffix}`);
  const reportPath = path.join(output, "report.json");
  const releaseName = `community-production-r11-base-micro-${suffix}`;
  const prepared = `/opt/zhenxing-ai/releases/${releaseName}`;
  const archive = path.join(temporary, "postgres.tar");
  const program = path.join(temporary, "micro.cjs");
  let started = false;
  let volumeCreated = false;
  let result = { status: "blocked", lastCompletedStage: null, failureReason: "setup-image-contract", service: null };
  let lastCompletedStage = null;
  let setupFailureReason = "setup-image-contract";
  let cleanup = { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0 };
  try {
    assert.equal(process.argv.length, 3, "exactly one bundle path is required");
    exactImage();
    fs.mkdirSync(output, { recursive: false, mode: 0o700 });
    must(docker(["image", "inspect", POSTGRES_REF]), "pinned PostgreSQL image is missing");
    must(docker(["save", "-o", archive, POSTGRES_ARCHIVE_REF]), "save pinned PostgreSQL archive");
    fs.writeFileSync(program, stageProgram(), { encoding: "utf8", mode: 0o600 });
    lastCompletedStage = "image-contract-ready";
    setupFailureReason = "setup-inner-daemon";
    must(docker(["volume", "create", volume]), "create DinD volume"); volumeCreated = true;
    must(docker(["run", "-d", "--privileged", "--name", container, "--mount", `type=volume,src=${volume},dst=/var/lib/docker`, TEST_IMAGE, "dockerd", "--host=unix:///var/run/docker.sock", "--feature", "containerd-snapshotter=true"]), "start fixed DinD"); started = true;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && docker(["exec", container, "docker", "info"]).status !== 0) {}
    must(docker(["exec", container, "docker", "info"]), "wait fixed DinD");
    lastCompletedStage = "inner-daemon-ready";
    setupFailureReason = "setup-transfer-normalization";
    const copy = (source, destination) => must(docker(["cp", source, `${container}:${destination}`]), "copy micro input");
    must(docker(["exec", container, "/bin/bash", "-lc", "install -d -m 0755 -o 1000 -g 1000 /opt/zhenxing-ai/staging /opt/zhenxing-ai/releases /workspace/base /workspace/identity-db /workspace/secrets"]), "create fixed micro roots");
    copy(bundleRoot, `/opt/zhenxing-ai/staging/${releaseName}.bundle`);
    must(docker(["exec", container, "/bin/bash", "-lc", `test -d /opt/zhenxing-ai/staging/${releaseName}.bundle && test ! -L /opt/zhenxing-ai/staging/${releaseName}.bundle; chown -R 1000:1000 /opt/zhenxing-ai/staging/${releaseName}.bundle; find -P /opt/zhenxing-ai/staging/${releaseName}.bundle -type d -exec chmod 700 {} +; find -P /opt/zhenxing-ai/staging/${releaseName}.bundle -type f -exec chmod 600 {} +`]), "normalize transferred bundle modes");
    lastCompletedStage = "transfer-normalized";
    setupFailureReason = "setup-prepared-runtime";
    must(docker(["exec", container, "/bin/bash", "-lc", `SUDO_UID=1000 SUDO_GID=1000 /bin/bash /opt/zhenxing-ai/staging/${releaseName}.bundle/payload/deployment/community-production/prepare-workflow-production-release.sh /opt/zhenxing-ai/staging/${releaseName}.bundle ${prepared}`]), "prepare fixed release");
    const runtime = `${prepared}/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`;
    must(docker(["exec", container, "/bin/bash", "-lc", `${runtime} --version | grep -Fx v24.18.1`]), "verify prepared runtime");
    lastCompletedStage = "prepared-runtime-ready";
    copy(archive, "/workspace/postgres.tar"); copy(program, "/workspace/micro.cjs");
    must(docker(["exec", container, "/bin/bash", "-lc", "docker load -i /workspace/postgres.tar >/dev/null; docker image inspect --format '{{.Id}}' postgres:17-alpine | grep -Fx 'sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'; for n in identity_db_password forum_db_password forum_db_root_password forum_admin_password forum_api_key forum_password_token community_internal community_management community_cms_gateway workflow_review_secret; do printf '%s' 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef > /workspace/secrets/$n; chmod 0400 /workspace/secrets/$n; done; printf '\\n' >> /workspace/secrets/forum_api_key; install -d /workspace/admin-data /workspace/admin-published /workspace/admin-output /workspace/community-db /workspace/community-config /workspace/community-storage /workspace/community-assets; docker volume create aihub-base-service-micro-caddy-data >/dev/null; docker volume create aihub-base-service-micro-caddy-config >/dev/null; docker volume create aihub-base-service-micro-caddy-secret >/dev/null; cp /opt/zhenxing-ai/staging/" + releaseName + ".bundle/payload/deployment/community-production/compose.server.yaml /workspace/base/compose.server.yaml; cp /opt/zhenxing-ai/staging/" + releaseName + ".bundle/payload/deployment/community-production/compose.workflow-production.yaml /workspace/base/compose.workflow-production.yaml; cp /opt/zhenxing-ai/staging/" + releaseName + ".bundle/payload/deployment/community-production/compose.windows-acceptance.yaml /workspace/base/compose.windows-acceptance.yaml; printf 'services:\\n  identity-database:\\n    ports: !reset []\\n' > /workspace/base/ports.override.yaml; printf 'services: {}\\n' > /workspace/base/caddy.override.yaml; cat > /workspace/base/.env <<'EOF'\\nAIHUB_ADMIN_CMS_IMAGE=postgres:17-alpine\\nAIHUB_ADMIN_DATA_DIR=/workspace/admin-data\\nAIHUB_ADMIN_PUBLISHED_DIR=/workspace/admin-published\\nAIHUB_ADMIN_OUTPUT_DIR=/workspace/admin-output\\nAIHUB_IDENTITY_DB_DIR=/workspace/identity-db\\nAIHUB_COMMUNITY_DB_DIR=/workspace/community-db\\nAIHUB_COMMUNITY_CONFIG_DIR=/workspace/community-config\\nAIHUB_COMMUNITY_STORAGE_DIR=/workspace/community-storage\\nAIHUB_COMMUNITY_ASSETS_DIR=/workspace/community-assets\\nAIHUB_SECRET_DIR=/workspace/secrets\\nAIHUB_WORKFLOW_PRODUCTION_SECRET_DIR=/workspace/secrets\\nAIHUB_FORUM_ADMIN_EMAIL=base-service-micro@example.invalid\\nAIHUB_PUBLIC_HOST=base-service-micro.localhost\\nAIHUB_COMMUNITY_PUBLIC_HOST=community.base-service-micro.localhost\\nAIHUB_CADDY_DATA_VOLUME=aihub-base-service-micro-caddy-data\\nAIHUB_CADDY_CONFIG_VOLUME=aihub-base-service-micro-caddy-config\\nAIHUB_CADDY_CMS_SECRET_VOLUME=aihub-base-service-micro-caddy-secret\\nEOF" ]), "prepare fixed micro inputs");
    const execution = docker(["exec", container, "/bin/bash", "-lc", `env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin ${runtime} /workspace/micro.cjs`]);
    const lines = String(execution.stdout || "").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const failed = lines.find((line) => line.ok === false);
    result = failed ? runMicroPlan({ runStage: (stage) => stage.id < failed.stage ? { ok: true, stderr: "" } : stage.id === failed.stage ? { ok: false, stderr: failed.stderr } : { ok: true, stderr: "" } }) : { status: "pass", lastCompletedStage: "F", failureReason: null, service: null };
  } catch (_) {
    result = { status: "blocked", lastCompletedStage, failureReason: setupFailureReason, service: null };
  } finally {
    if (started && docker(["rm", "-f", container]).status !== 0) cleanup.containers = 1;
    if (volumeCreated && docker(["volume", "rm", volume]).status !== 0) cleanup.volumes = 1;
    try { fs.rmSync(temporary, { recursive: true, force: true }); } catch (_) { cleanup.privateRoots = 1; }
    cleanup.completed = Object.values(cleanup).slice(1).every((value) => value === 0);
    if (!cleanup.completed) result.status = "partial";
    const report = createMicroReport({ ...result, cleanup });
    if (!fs.existsSync(output)) fs.mkdirSync(output, { recursive: true, mode: 0o700 });
    atomicWrite(reportPath, report);
    process.stdout.write(`${JSON.stringify({ status: report.status, reportPath })}\n`);
  }
}

module.exports = { FAILURE_REASONS, MICRO_STAGES, REPORT_SCHEMA, SETUP_STAGES, TEST_IMAGE, TEST_IMAGE_ID, assertSafeTransferModes, classifyMicroFailure, createMicroReport, isSafeLinuxTransferMode, normalizedLinuxTransferMode, runMicroPlan, validateMicroReport };
if (require.main === module) runLocalMicro(path.resolve(process.argv[2] || ""));
