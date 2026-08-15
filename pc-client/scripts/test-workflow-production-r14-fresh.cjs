"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyWorkflowProductionReleaseBundle } = require("../deployment/community-production/workflow-production-release-bundle.cjs");
const { OFFICIAL_IMAGES, exportOfficialImages, officialImageExportFailureStage } = require("./workflow-production-r12-official-image-export.cjs");
const { BASE_SERVICE_FAILURE_CODES_BY_STAGE, INNER_FAILURE_CODES_BY_STAGE, RELEASE: INNER_RELEASE, RELEASE_NAME: INNER_RELEASE_NAME, safeBaseServiceProjection } = require("./workflow-production-r14-fresh-inner.cjs");

const root = path.resolve(__dirname, "..");
const FRESH_CANDIDATE = Object.freeze({
  bundleName: "workflow-production-r14-e177ec06-memory-gate-removed-20260811.bundle",
  deploymentSetDigest: "e177ec0681071769f776c873d5bd34cf42684c2720e523749bc9652a68c7a6cf",
  deploymentManifestSha256: "bf6a40fe5f873d93c37b50e277db84648036798f7e34f672ca3327786e67da87",
  payloadDigest: "626ba670e1252ef1c6535e6ae2bff0353ed2e5762a368930fe2e8e44a309b27e",
  bundleManifestSha256: "ae15278da93970232b243ff3c6e49566fa06075be939be3a2ae5278d58a14b1c",
  bundleTableSha256: "5e2003cf0ba7be016f5c84fb26de99288b038148cb391a889e2ef79982d2114c",
  releaseName: "community-production-r14-e177ec06",
  innerSha256: "453a1f1e72edc89eaff72aa476db2407ce2e74490161d9250fc5349f48ef1b83"
});
const bundle = path.join(root, "output", FRESH_CANDIDATE.bundleName);
const STAGING_BUNDLE = `/opt/zhenxing-ai/staging/${FRESH_CANDIDATE.releaseName}.bundle`;
const RELEASE_ROOT = `/opt/zhenxing-ai/releases/${FRESH_CANDIDATE.releaseName}`;
const innerSource = path.join(root, "scripts", "workflow-production-r14-fresh-inner.cjs");
const outerImage = "aihub-workflow-release-prepare-test:ubuntu24-dind";
const outerImageId = "sha256:2f5e683c88da8f770a788cb9ab72e213d70cc7a2ae2c007e2b41ae8a99f4ed40";
const suffix = crypto.randomBytes(5).toString("hex");
const container = `aihub-workflow-r14-fresh-${suffix}`;
const volume = `${container}-docker`;
const output = path.join(root, "output", `workflow-production-r14-fresh-${suffix}`);
const reportPath = path.join(output, "report.json");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-r14-fresh-"));

function run(file, args, options = {}) { const value = spawnSync(file, args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...options }); if (value.error) throw value.error; return value; }
function docker(args, options) { return run("docker", args, options); }
function must(value, stage) { if (value.status !== 0) throw Object.assign(new Error("r14 fresh driver blocked"), { stage }); return value; }
function inner(script) { return docker(["exec", container, "/bin/bash", "-lc", script]); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function commandSucceeded(value) { return Boolean(value && value.status === 0 && !value.error && !value.signal); }
function outerFailure(stage, code) { return Object.assign(new Error("r14 fresh driver blocked"), { outerFailure: { stage, code } }); }
function requireFreshCandidate(closure, innerSha256) {
  try {
    for (const field of ["deploymentSetDigest", "deploymentManifestSha256", "payloadDigest", "bundleManifestSha256", "bundleTableSha256"]) assert.equal(closure?.[field], FRESH_CANDIDATE[field]);
    assert.equal(path.basename(bundle), FRESH_CANDIDATE.bundleName);
    assert.equal(path.basename(STAGING_BUNDLE, ".bundle"), FRESH_CANDIDATE.releaseName);
    assert.equal(path.basename(RELEASE_ROOT), FRESH_CANDIDATE.releaseName);
    assert.equal(INNER_RELEASE_NAME, FRESH_CANDIDATE.releaseName);
    assert.equal(INNER_RELEASE, RELEASE_ROOT);
    assert.equal(innerSha256, FRESH_CANDIDATE.innerSha256);
  } catch { throw outerFailure("candidate-binding", "R14_FRESH_CANDIDATE_BINDING_FAILED"); }
  return Object.fromEntries(["bundleName", "deploymentSetDigest", "deploymentManifestSha256", "payloadDigest", "bundleManifestSha256", "bundleTableSha256", "releaseName"].map((field) => [field, FRESH_CANDIDATE[field]]));
}
function ensureOuterDockerAvailable(dockerCall) {
  try { if (commandSucceeded(dockerCall(["info"]))) return; } catch {}
  throw outerFailure("outer-docker-unavailable", "R14_FRESH_OUTER_DOCKER_UNAVAILABLE");
}
function cleanupCall(dockerCall, args) { try { return commandSucceeded(dockerCall(args)) ? 0 : 1; } catch { return 1; } }
function cleanupQuery(dockerCall, args) {
  try {
    const value = dockerCall(args);
    return commandSucceeded(value) ? { status: 0, count: String(value.stdout || "").trim() ? 1 : 0 } : { status: 1, count: null };
  } catch { return { status: 1, count: null }; }
}
function cleanupOuterResources({ dockerCall, container, volume, containerCreated, volumeCreated, removeTemporary, privateRootPresent }) {
  const containerRemovalStatus = containerCreated ? cleanupCall(dockerCall, ["rm", "-f", container]) : 0;
  const volumeRemovalStatus = volumeCreated ? cleanupCall(dockerCall, ["volume", "rm", volume]) : 0;
  const containerQuery = containerCreated ? cleanupQuery(dockerCall, ["ps", "-aq", "--filter", `name=^/${container}$`]) : { status: 0, count: 0 };
  const volumeQuery = volumeCreated ? cleanupQuery(dockerCall, ["volume", "ls", "-q", "--filter", `name=^${volume}$`]) : { status: 0, count: 0 };
  let temporaryRemovalStatus = 0; try { removeTemporary(); } catch { temporaryRemovalStatus = 1; }
  let privateRootQueryStatus = 0; let privateRoots = 0;
  try { privateRoots = privateRootPresent() ? 1 : 0; } catch { privateRootQueryStatus = 1; privateRoots = null; }
  return {
    completed: containerRemovalStatus === 0 && volumeRemovalStatus === 0 && containerQuery.status === 0 && volumeQuery.status === 0 && containerQuery.count === 0 && volumeQuery.count === 0 && temporaryRemovalStatus === 0 && privateRootQueryStatus === 0 && privateRoots === 0,
    containerCreated: Boolean(containerCreated), volumeCreated: Boolean(volumeCreated),
    containers: containerQuery.count, networks: 0, volumes: volumeQuery.count, privateRoots,
    containerRemovalStatus, volumeRemovalStatus, containerQueryStatus: containerQuery.status, volumeQueryStatus: volumeQuery.status,
    temporaryRemovalStatus, privateRootQueryStatus
  };
}
const INNER_TERMINAL_INVALID = Object.freeze({ stage: "inner-terminal-invalid", code: "R14_FRESH_INNER_TERMINAL_INVALID" });
function rejectInnerTerminal() { throw Object.assign(new Error("r14 fresh inner terminal invalid"), { innerTerminal: INNER_TERMINAL_INVALID }); }
function projectInnerTerminal(value) {
  try {
    assert.deepEqual(Object.keys(value).sort(), ["candidateOnly", "checks", "cleanup", "deployable", "failure", "schema", "serverConnected", "serverWritten", "status"]);
    assert.equal(value.schema, "aihub-workflow-production-r14-fresh-local-v1");
    assert.equal(value.candidateOnly, true); assert.equal(value.deployable, false);
    assert.equal(value.serverConnected, false); assert.equal(value.serverWritten, false);
    assert.equal(value.status, "blocked"); assert.deepEqual(Object.keys(value.checks), []);
    assert.deepEqual(Object.keys(value.cleanup).sort(), ["completed", "containers", "downStatus", "networks", "privateRoots", "volumes"]);
    assert.equal(value.cleanup.completed, true);
    for (const key of ["containers", "downStatus", "networks", "privateRoots", "volumes"]) assert.equal(value.cleanup[key], 0);
    const baseServiceFailure = Object.hasOwn(BASE_SERVICE_FAILURE_CODES_BY_STAGE, value.failure.stage);
    assert.deepEqual(Object.keys(value.failure).sort(), baseServiceFailure ? ["baseServices", "code", "stage"] : ["code", "stage"]);
    assert.equal(INNER_FAILURE_CODES_BY_STAGE[value.failure.stage], value.failure.code);
    if (baseServiceFailure) safeBaseServiceProjection(value.failure.baseServices, value.failure.stage);
    return baseServiceFailure ? { stage: value.failure.stage, code: value.failure.code, baseServices: value.failure.baseServices } : { stage: value.failure.stage, code: value.failure.code };
  } catch { return rejectInnerTerminal(); }
}

async function main() {
  fs.mkdirSync(output, { recursive: false });
  const report = { schema: "aihub-workflow-production-r14-fresh-driver-v1", candidateOnly: true, deployable: false, serverConnected: false, serverWritten: false, packaged: false, status: "blocked", checks: {}, cleanup: { completed: false } };
  let stage = "local-closure"; let volumeCreated = false; let containerCreated = false;
  try {
    const closure = verifyWorkflowProductionReleaseBundle(bundle);
    requireFreshCandidate(closure, sha256File(innerSource));
    stage = "outer-docker-prerequisite";
    ensureOuterDockerAvailable(docker);
    const inspected = JSON.parse(must(docker(["image", "inspect", outerImage]), "outer image").stdout)[0]; assert.equal(inspected.Id, outerImageId);
    report.inputs = { deploymentSetDigest: closure.deploymentSetDigest, deploymentManifestSha256: closure.deploymentManifestSha256, payloadDigest: closure.payloadDigest, bundleManifestSha256: closure.bundleManifestSha256, bundleTableSha256: closure.bundleTableSha256, identitySourceDigest: closure.identitySourceDigest, outerImageId, innerSha256: sha256File(innerSource) };
    stage = "official-image-export";
    const official = path.join(temporary, "official"); fs.mkdirSync(official); exportOfficialImages({ docker, archiveDirectory: official, statSync: fs.statSync });
    stage = "outer-start";
    must(docker(["volume", "create", volume]), "outer volume");
    volumeCreated = true;
    must(docker(["run", "-d", "--privileged", "--cgroupns=private", "--name", container, "--mount", `type=volume,src=${volume},dst=/var/lib/docker`, outerImage, "dockerd", "--host=unix:///var/run/docker.sock", "--feature", "containerd-snapshotter=true"]), "outer container");
    containerCreated = true;
    const deadline = Date.now() + 60_000; while (Date.now() < deadline && docker(["exec", container, "docker", "info"]).status !== 0) await new Promise((resolve) => setTimeout(resolve, 500));
    must(docker(["exec", container, "docker", "info"]), "outer Docker ready");
    stage = "prepared-release";
    must(inner("mkdir -p /opt/zhenxing-ai/staging /opt/zhenxing-ai/releases /opt/zhenxing-ai/official"), "roots");
    must(docker(["cp", bundle, `${container}:${STAGING_BUNDLE}`]), "copy bundle");
    must(inner(`chown -R 1000:1000 ${STAGING_BUNDLE}; find ${STAGING_BUNDLE} -type d -exec chmod 0700 {} +; find ${STAGING_BUNDLE} -type f -exec chmod 0600 {} +`), "normalize transfer");
    must(inner(`SUDO_UID=1000 SUDO_GID=1000 AIHUB_WORKFLOW_RELEASE_PREPARE_ISOLATED_ACCEPTANCE=1 /bin/bash ${STAGING_BUNDLE}/payload/deployment/community-production/prepare-workflow-production-release.sh ${STAGING_BUNDLE} ${RELEASE_ROOT}`), "prepare release");
    for (const image of OFFICIAL_IMAGES) must(docker(["cp", path.join(official, `${image.name}.tar`), `${container}:/opt/zhenxing-ai/official/${image.name}.tar`]), `copy ${image.name}`);
    must(docker(["cp", innerSource, `${container}:/opt/zhenxing-ai/r14-fresh-inner.cjs`]), "copy inner");
    stage = "fresh-single-stack";
    const execution = docker(["exec", "--env", "NODE_USE_SYSTEM_CA=1", container, `${RELEASE_ROOT}/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`, "--use-system-ca", "/opt/zhenxing-ai/r14-fresh-inner.cjs"], { timeout: 2_700_000 });
    const innerReportPath = path.join(output, "inner-report.json"); must(docker(["cp", `${container}:/opt/zhenxing-ai/r14-fresh-report.json`, innerReportPath]), "copy inner report");
    const innerReport = JSON.parse(fs.readFileSync(innerReportPath, "utf8"));
    if (innerReport.status === "blocked") throw Object.assign(new Error("r14 fresh inner blocked"), { innerTerminal: projectInnerTerminal(innerReport) });
    assert.equal(execution.status, 0); assert.equal(innerReport.status, "pass");
    report.innerReportSha256 = sha256File(innerReportPath); report.checks = innerReport.checks; report.status = "pass";
  } catch (error) {
    report.failure = error?.outerFailure || error?.innerTerminal || { stage: officialImageExportFailureStage(error?.stage, stage), code: "R14_FRESH_DRIVER_FAILED" };
    try {
      const target = path.join(output, "inner-report.json");
      if (containerCreated && !fs.existsSync(target) && docker(["cp", `${container}:/opt/zhenxing-ai/r14-fresh-report.json`, target]).status === 0) report.innerReportSha256 = sha256File(target);
      if (!error?.innerTerminal && fs.existsSync(target)) {
        try { report.failure = projectInnerTerminal(JSON.parse(fs.readFileSync(target, "utf8"))); }
        catch (terminalError) { report.failure = terminalError?.innerTerminal || { stage: "fresh-single-stack", code: "R14_FRESH_DRIVER_FAILED" }; }
      }
    } catch {}
    process.exitCode = 1;
  } finally {
    report.cleanup = cleanupOuterResources({ dockerCall: docker, container, volume, containerCreated, volumeCreated, removeTemporary: () => fs.rmSync(temporary, { recursive: true, force: true }), privateRootPresent: () => fs.existsSync(temporary) });
    if (!report.cleanup.completed && report.status === "pass") report.status = "partial";
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  assert.equal(report.status, "pass", `r14 fresh driver blocked at ${report.failure?.stage || "cleanup"}`);
  process.stdout.write(`${JSON.stringify({ ok: true, reportPath })}\n`);
}

module.exports = { FRESH_CANDIDATE, INNER_TERMINAL_INVALID, RELEASE_ROOT, cleanupOuterResources, ensureOuterDockerAvailable, projectInnerTerminal, requireFreshCandidate };
if (require.main === module) main().catch(() => { process.exitCode = 1; });
