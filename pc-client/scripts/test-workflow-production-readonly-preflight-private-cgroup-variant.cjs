"use strict";

// Local-only runner plan. Execution is separately CTO-authorized.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyWorkflowProductionReleaseBundle } = require("../deployment/community-production/workflow-production-release-bundle.cjs");

const REPORT_SCHEMA = "aihub-workflow-production-private-cgroup-variant-v1";
const FAILURE_REASONS = Object.freeze(["cgroup-preflight", "private-b", "local-dind-incompatible", null]);
const STAGES = Object.freeze(["B", "C", null]);
const SUBTREE_STATES = Object.freeze(["enabled", "missing", "unusable"]);
const PRIVATE_B_ARGS = Object.freeze(["--network", "none", "--security-opt", "no-new-privileges:true"]);
const PRIVATE_C_ARGS = Object.freeze([...PRIVATE_B_ARGS, "--memory", "256m", "--cpus", "0.40", "--pids-limit", "192"]);
const TEST_IMAGE = "aihub-workflow-release-prepare-test:ubuntu24-dind";
const TEST_IMAGE_ID = "sha256:2f5e683c88da8f770a788cb9ab72e213d70cc7a2ae2c007e2b41ae8a99f4ed40";
const POSTGRES_REF = "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193";
const POSTGRES_ARCHIVE_REF = "postgres:17-alpine";
const POSTGRES_ID = "sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193";
const root = path.resolve(__dirname, "..");

function exact(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function outerArgs(container) {
  assert.match(container, /^[a-z0-9][a-z0-9-]{0,62}$/);
  return ["run", "-d", "--privileged", "--cgroupns=private", "--name", container];
}

function validateOuterCgroupInspect(inspect) {
  assert.ok(inspect && inspect.HostConfig && typeof inspect.HostConfig === "object", "outer namespace metadata is unavailable");
  assert.equal(inspect.HostConfig.CgroupnsMode, "private", "outer cgroup namespace drifted");
  return true;
}

function validateCandidateArgs(bArgs, cArgs) {
  assert.deepEqual(bArgs, PRIVATE_B_ARGS, "private B network/security contract drifted");
  assert.deepEqual(cArgs, PRIVATE_C_ARGS, "private C resource contract drifted");
  return true;
}

function validateCgroupMetadata(metadata) {
  assert.ok(exact(metadata, ["effectiveNamespacePrivate", "cgroupV2", "controllers", "subtreeControl"]), "cgroup metadata keys drifted");
  assert.equal(typeof metadata.effectiveNamespacePrivate, "boolean");
  assert.equal(typeof metadata.cgroupV2, "boolean");
  assert.ok(exact(metadata.controllers, ["cpu", "memory", "pids"]), "cgroup controller keys drifted");
  for (const controller of Object.values(metadata.controllers)) assert.equal(typeof controller, "boolean");
  assert.ok(SUBTREE_STATES.includes(metadata.subtreeControl));
  return true;
}

function cgroupUsable(metadata) {
  validateCgroupMetadata(metadata);
  return metadata.effectiveNamespacePrivate && metadata.cgroupV2 && metadata.controllers.cpu && metadata.controllers.memory && metadata.controllers.pids && metadata.subtreeControl === "enabled";
}

function runPrivatePlan({ metadata, runB, runC }) {
  assert.equal(typeof runB, "function");
  assert.equal(typeof runC, "function");
  if (!cgroupUsable(metadata)) return { status: "blocked", lastCompletedStage: null, failureReason: "cgroup-preflight" };
  if (runB() !== true) return { status: "blocked", lastCompletedStage: null, failureReason: "private-b" };
  if (runC() !== true) return { status: "blocked", lastCompletedStage: "B", failureReason: "local-dind-incompatible" };
  return { status: "pass", lastCompletedStage: "C", failureReason: null };
}

function createVariantReport({ status, lastCompletedStage, failureReason, metadata, cleanup }) {
  const report = { schema: REPORT_SCHEMA, candidateOnly: true, deployable: false, status, ...metadata, lastCompletedStage, failureReason, cleanup, terminal: { finalized: true, exitCode: status === "pass" ? 0 : 1 } };
  validateVariantReport(report);
  return report;
}

function validateVariantReport(report) {
  assert.ok(exact(report, ["schema", "candidateOnly", "deployable", "status", "effectiveNamespacePrivate", "cgroupV2", "controllers", "subtreeControl", "lastCompletedStage", "failureReason", "cleanup", "terminal"]), "variant report keys drifted");
  assert.equal(report.schema, REPORT_SCHEMA);
  assert.equal(report.candidateOnly, true);
  assert.equal(report.deployable, false);
  assert.ok(["pass", "blocked", "partial"].includes(report.status));
  validateCgroupMetadata({
    effectiveNamespacePrivate: report.effectiveNamespacePrivate,
    cgroupV2: report.cgroupV2,
    controllers: report.controllers,
    subtreeControl: report.subtreeControl
  });
  assert.ok(STAGES.includes(report.lastCompletedStage));
  assert.ok(FAILURE_REASONS.includes(report.failureReason));
  assert.ok(exact(report.cleanup, ["completed", "containers", "networks", "volumes", "privateRoots"]));
  assert.equal(typeof report.cleanup.completed, "boolean");
  for (const key of ["containers", "networks", "volumes", "privateRoots"]) assert.ok(Number.isInteger(report.cleanup[key]) && report.cleanup[key] >= 0);
  assert.ok(exact(report.terminal, ["finalized", "exitCode"]));
  assert.equal(report.terminal.finalized, true);
  assert.equal(report.terminal.exitCode, report.status === "pass" ? 0 : 1);
  return true;
}

function createCgroupProbeProgram() {
  return `"use strict";
const fs=require("node:fs");
const root="/sys/fs/cgroup";
const list=(file)=>fs.readFileSync(file,"utf8").trim().split(/\\s+/).filter(Boolean);
const controllers=new Set(list(root+"/cgroup.controllers"));
let writable=true; try { fs.accessSync(root+"/cgroup.subtree_control",fs.constants.W_OK); } catch { writable=false; }
const enabled=new Set(list(root+"/cgroup.subtree_control"));
process.stdout.write(JSON.stringify({cgroupV2:fs.readFileSync("/proc/self/mountinfo","utf8").includes(" - cgroup2 "),controllers:{cpu:controllers.has("cpu"),memory:controllers.has("memory"),pids:controllers.has("pids")},subtreeControl:writable&&["cpu","memory","pids"].every((key)=>enabled.has("+"+key)||enabled.has(key))?"enabled":writable?"missing":"unusable"}));`;
}

function call(command, args, options = {}) { return spawnSync(command, args, { encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024, ...options }); }
function docker(args, options) { return call("docker", args, options); }
function must(value, label) { assert.equal(value.status, 0, label); return value; }
function atomicWrite(target, value) { const tmp = `${target}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 }); fs.renameSync(tmp, target); }
function normalizeTransferredBundle(container, incoming) {
  return must(docker(["exec", container, "/bin/bash", "-lc", `test -d ${incoming} && test ! -L ${incoming}; chown -R 1000:1000 ${incoming}; find -P ${incoming} -type d -exec chmod 700 {} +; find -P ${incoming} -type f -exec chmod 600 {} +`]), "normalize transferred bundle");
}

function runLocal(bundleRoot) {
  assert.equal(process.argv.length, 3, "exactly one bundle path is required");
  verifyWorkflowProductionReleaseBundle(bundleRoot);
  const suffix = crypto.randomBytes(5).toString("hex");
  const container = `aihub-private-cgroup-${suffix}`;
  const volume = `${container}-docker`;
  const stagingName = `community-production-r11-private-cgroup-${suffix}`;
  const incoming = `/opt/zhenxing-ai/staging/${stagingName}.bundle`;
  const release = `/opt/zhenxing-ai/releases/${stagingName}`;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-private-cgroup-"));
  const reportRoot = path.join(root, "output", `workflow-production-private-cgroup-${suffix}`);
  const reportPath = path.join(reportRoot, "report.json");
  const archive = path.join(temporary, "postgres.tar");
  const probe = path.join(temporary, "probe.cjs");
  let started = false;
  let volumeCreated = false;
  let metadata = { effectiveNamespacePrivate: false, cgroupV2: false, controllers: { cpu: false, memory: false, pids: false }, subtreeControl: "unusable" };
  let result = { status: "blocked", lastCompletedStage: null, failureReason: "cgroup-preflight" };
  const cleanup = { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0 };
  try {
    const image = JSON.parse(must(docker(["image", "inspect", TEST_IMAGE]), "inspect fixed DinD image").stdout)[0];
    assert.equal(image.Id, TEST_IMAGE_ID, "fixed DinD image ID drifted");
    must(docker(["image", "inspect", POSTGRES_REF]), "inspect fixed PostgreSQL image");
    must(docker(["save", "-o", archive, POSTGRES_ARCHIVE_REF]), "save fixed PostgreSQL archive");
    fs.writeFileSync(probe, createCgroupProbeProgram(), { encoding: "utf8", mode: 0o600 });
    fs.mkdirSync(reportRoot, { recursive: false, mode: 0o700 });
    must(docker(["volume", "create", volume]), "create private DinD volume"); volumeCreated = true;
    must(docker([...outerArgs(container), "--mount", `type=volume,src=${volume},dst=/var/lib/docker`, TEST_IMAGE, "dockerd", "--host=unix:///var/run/docker.sock", "--feature", "containerd-snapshotter=true"]), "start private DinD"); started = true;
    const before = JSON.parse(must(docker(["inspect", container]), "inspect private DinD namespace").stdout)[0];
    metadata.effectiveNamespacePrivate = validateOuterCgroupInspect(before);
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && docker(["exec", container, "docker", "info"]).status !== 0) {}
    must(docker(["exec", container, "docker", "info"]), "wait private DinD");
    const after = JSON.parse(must(docker(["inspect", container]), "reinspect private DinD namespace").stdout)[0];
    metadata.effectiveNamespacePrivate = validateOuterCgroupInspect(after);
    must(docker(["exec", container, "/bin/bash", "-lc", "install -d -m 0755 -o 1000 -g 1000 /opt/zhenxing-ai/staging /opt/zhenxing-ai/releases /workspace"]), "create private runner roots");
    must(docker(["cp", bundleRoot, `${container}:${incoming}`]), "copy fixed bundle");
    normalizeTransferredBundle(container, incoming);
    must(docker(["exec", container, "/bin/bash", "-lc", `SUDO_UID=1000 SUDO_GID=1000 /bin/bash ${incoming}/payload/deployment/community-production/prepare-workflow-production-release.sh ${incoming} ${release}`]), "prepare fixed release");
    const runtime = `${release}/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`;
    must(docker(["exec", container, "/bin/bash", "-lc", `${runtime} --version | grep -Fx v24.18.1`]), "verify prepared runtime");
    must(docker(["cp", archive, `${container}:/workspace/postgres.tar`]), "copy PostgreSQL archive");
    must(docker(["cp", probe, `${container}:/workspace/probe.cjs`]), "copy cgroup probe");
    must(docker(["exec", container, "/bin/bash", "-lc", `docker load -i /workspace/postgres.tar >/dev/null; docker image inspect --format '{{.Id}}' ${POSTGRES_ARCHIVE_REF} | grep -Fx '${POSTGRES_ID}'`]), "load fixed PostgreSQL image");
    const probeResult = must(docker(["exec", container, "/bin/bash", "-lc", `env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin ${runtime} /workspace/probe.cjs`]), "run prepared cgroup probe");
    const probed = JSON.parse(probeResult.stdout);
    metadata = { effectiveNamespacePrivate: metadata.effectiveNamespacePrivate, ...probed };
    const run = (args) => docker(["exec", container, "docker", "run", "--pull=never", "--rm", ...args, POSTGRES_REF, "/bin/true"]).status === 0;
    result = runPrivatePlan({ metadata, runB: () => run(PRIVATE_B_ARGS), runC: () => run(PRIVATE_C_ARGS) });
  } catch (_) {
    result = { status: "blocked", lastCompletedStage: null, failureReason: "cgroup-preflight" };
  } finally {
    if (started && docker(["rm", "-f", container]).status !== 0) cleanup.containers = 1;
    if (volumeCreated && docker(["volume", "rm", volume]).status !== 0) cleanup.volumes = 1;
    try { fs.rmSync(temporary, { recursive: true, force: true }); } catch (_) { cleanup.privateRoots = 1; }
    cleanup.completed = Object.values(cleanup).slice(1).every((value) => value === 0);
    if (!cleanup.completed) result.status = "partial";
    const report = createVariantReport({ ...result, metadata, cleanup });
    if (!fs.existsSync(reportRoot)) fs.mkdirSync(reportRoot, { recursive: true, mode: 0o700 });
    atomicWrite(reportPath, report);
    process.stdout.write(`${JSON.stringify({ status: report.status, reportPath })}\n`);
  }
}

module.exports = { FAILURE_REASONS, PRIVATE_B_ARGS, PRIVATE_C_ARGS, REPORT_SCHEMA, STAGES, cgroupUsable, createCgroupProbeProgram, createVariantReport, outerArgs, runPrivatePlan, validateCandidateArgs, validateCgroupMetadata, validateOuterCgroupInspect, validateVariantReport };
if (require.main === module) runLocal(path.resolve(process.argv[2] || ""));
