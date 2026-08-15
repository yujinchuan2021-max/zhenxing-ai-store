"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyWorkflowProductionReleaseBundle } = require("../deployment/community-production/workflow-production-release-bundle.cjs");
const { OFFICIAL_IMAGES, exportOfficialImages, officialImageExportFailureStage } = require("./workflow-production-r12-official-image-export.cjs");

const root = path.resolve(__dirname, "..");
const bundle = path.join(root, "output", "workflow-production-r12-15620c86-20260810.bundle");
const active6 = path.join(root, "output", "community-production-finalwin-20260806134532173", "admin-published", "catalog-store", "state.json");
const innerSource = path.join(root, "scripts", "workflow-production-r12-single-stack-inner.cjs");
const outerImage = "aihub-workflow-release-prepare-test:ubuntu24-dind";
const outerImageId = "sha256:2f5e683c88da8f770a788cb9ab72e213d70cc7a2ae2c007e2b41ae8a99f4ed40";
const suffix = crypto.randomBytes(5).toString("hex");
const container = `aihub-workflow-r12-single-stack-${suffix}`;
const volume = `aihub-workflow-r12-single-stack-${suffix}-docker`;
const output = path.join(root, "output", `workflow-production-r12-single-stack-${suffix}`);
const reportPath = path.join(output, "report.json");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-r12-single-stack-"));

function run(file, args, options = {}) {
  const value = spawnSync(file, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options
  });
  if (value.error) throw value.error;
  return value;
}
function docker(args, options) { return run("docker", args, options); }
function must(value, stage) {
  if (value.status !== 0) throw Object.assign(new Error("r12 single stack driver blocked"), { stage });
  return value;
}
function inner(script) { return docker(["exec", container, "/bin/bash", "-lc", script]); }
function sha256File(filename) { return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex"); }

(async () => {
  fs.mkdirSync(output, { recursive: false });
  const report = {
    schema: "aihub-workflow-production-r12-single-stack-driver-v1",
    candidateOnly: true,
    deployable: false,
    serverConnected: false,
    serverWritten: false,
    packaged: false,
    status: "blocked",
    checks: {},
    cleanup: { completed: false }
  };
  let stage = "local-closure";
  try {
    const closure = verifyWorkflowProductionReleaseBundle(bundle);
    assert.equal(closure.deploymentSetDigest, "15620c86f087b26a5f8d6687be3bfdab9ad4732d998c731bfe490578227463ff");
    assert.equal(sha256File(active6), "abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9");
    assert.equal(fs.statSync(active6).size, 1521912);
    const inspectedOuter = JSON.parse(must(docker(["image", "inspect", outerImage]), "outer-image").stdout)[0];
    assert.equal(inspectedOuter.Id, outerImageId);
    report.inputs = {
      deploymentSetDigest: closure.deploymentSetDigest,
      deploymentManifestSha256: closure.deploymentManifestSha256,
      payloadDigest: closure.payloadDigest,
      bundleManifestSha256: closure.bundleManifestSha256,
      bundleTableSha256: closure.bundleTableSha256,
      identitySourceDigest: closure.identitySourceDigest,
      outerImageId
    };

    stage = "official-image-export";
    const officialDirectory = path.join(temporary, "official");
    fs.mkdirSync(officialDirectory);
    exportOfficialImages({ docker, archiveDirectory: officialDirectory, statSync: fs.statSync });

    stage = "outer-start";
    must(docker(["volume", "create", volume]), "outer-volume");
    must(docker([
      "run", "-d", "--privileged", "--cgroupns=private", "--name", container,
      "--mount", `type=volume,src=${volume},dst=/var/lib/docker`,
      outerImage, "dockerd", "--host=unix:///var/run/docker.sock", "--feature", "containerd-snapshotter=true"
    ]), "outer-container");
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && docker(["exec", container, "docker", "info"]).status !== 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    must(docker(["exec", container, "docker", "info"]), "outer-docker-ready");

    stage = "prepared-release";
    must(inner("mkdir -p /opt/zhenxing-ai/staging /opt/zhenxing-ai/releases /opt/zhenxing-ai/official /opt/zhenxing-ai/fixture-r12"), "outer-roots");
    must(docker(["cp", bundle, `${container}:/opt/zhenxing-ai/staging/community-production-r12-15620c86.bundle`]), "copy-bundle");
    must(inner("chown -R 1000:1000 /opt/zhenxing-ai/staging/community-production-r12-15620c86.bundle; find /opt/zhenxing-ai/staging/community-production-r12-15620c86.bundle -type d -exec chmod 0700 {} +; find /opt/zhenxing-ai/staging/community-production-r12-15620c86.bundle -type f -exec chmod 0600 {} +"), "normalize-transfer");
    must(inner("SUDO_UID=1000 SUDO_GID=1000 AIHUB_WORKFLOW_RELEASE_PREPARE_ISOLATED_ACCEPTANCE=1 /bin/bash /opt/zhenxing-ai/staging/community-production-r12-15620c86.bundle/payload/deployment/community-production/prepare-workflow-production-release.sh /opt/zhenxing-ai/staging/community-production-r12-15620c86.bundle /opt/zhenxing-ai/releases/community-production-r12-15620c86"), "prepare-release");

    stage = "fixture-transfer";
    must(docker(["cp", path.join(root, "admin", "data"), `${container}:/opt/zhenxing-ai/fixture-r12/admin-data`]), "copy-admin-data");
    must(docker(["cp", path.join(root, "admin", "published"), `${container}:/opt/zhenxing-ai/fixture-r12/admin-published`]), "copy-admin-published");
    must(docker(["cp", active6, `${container}:/opt/zhenxing-ai/fixture-r12/active6-state.json`]), "copy-active6");
    must(docker(["cp", innerSource, `${container}:/opt/zhenxing-ai/r12-single-stack-inner.cjs`]), "copy-inner-runner");
    for (const image of OFFICIAL_IMAGES) {
      must(docker(["cp", path.join(officialDirectory, `${image.name}.tar`), `${container}:/opt/zhenxing-ai/official/${image.name}.tar`]), `copy-${image.name}`);
    }

    stage = "single-stack";
    const execution = docker([
      "exec", container,
      "/opt/zhenxing-ai/releases/community-production-r12-15620c86/.workflow-runtime/node-v24.18.1-linux-x64/bin/node",
      "--use-system-ca", "/opt/zhenxing-ai/r12-single-stack-inner.cjs"
    ], { timeout: 2_700_000 });
    const innerReportPath = path.join(output, "inner-report.json");
    must(docker(["cp", `${container}:/opt/zhenxing-ai/r12-single-stack-report.json`, innerReportPath]), "copy-inner-report");
    const innerReport = JSON.parse(fs.readFileSync(innerReportPath, "utf8"));
    assert.equal(execution.status, 0);
    assert.equal(innerReport.status, "pass");
    report.inner = innerReport;
    report.checks = {
      oneComposeProject: innerReport.checks.projectCount === 1,
      sixLongRunningServices: innerReport.checks.longRunningServices === 6,
      failureBoundaries: innerReport.checks.failureBoundaries,
      retainedCountsExact: JSON.stringify(innerReport.checks.baseline) === JSON.stringify({ events: 9, idempotency: 9, eventHead: 9, sourcePosts: 3, reviewer: 1, publisher: 1, resourceTablesAbsent: true }),
      targetCountsExact: innerReport.checks.target?.events === 9 && innerReport.checks.target?.idempotency === 9 && innerReport.checks.target?.eventHead === 9 && innerReport.checks.target?.sourcePosts === 3,
      secretValueHits: innerReport.checks.secretValueHits
    };
    report.status = "pass";
  } catch (error) {
    report.failure = { stage: officialImageExportFailureStage(error?.stage, stage), code: "R12_SINGLE_STACK_DRIVER_FAILED" };
    try {
      const innerReportPath = path.join(output, "inner-report.json");
      if (!fs.existsSync(innerReportPath) && docker(["cp", `${container}:/opt/zhenxing-ai/r12-single-stack-report.json`, innerReportPath]).status === 0) {
        report.inner = JSON.parse(fs.readFileSync(innerReportPath, "utf8"));
      }
    } catch {}
    process.exitCode = 1;
  } finally {
    const removal = docker(["rm", "-f", container]);
    const volumeRemoval = docker(["volume", "rm", volume]);
    try { fs.rmSync(temporary, { recursive: true, force: true }); } catch {}
    const containerResidue = docker(["ps", "-aq", "--filter", `name=^/${container}$`]).stdout.trim();
    const volumeResidue = docker(["volume", "ls", "-q", "--filter", `name=^${volume}$`]).stdout.trim();
    report.cleanup = {
      completed: !containerResidue && !volumeResidue && !fs.existsSync(temporary),
      containers: containerResidue ? 1 : 0,
      networks: 0,
      volumes: volumeResidue ? 1 : 0,
      privateRoots: fs.existsSync(temporary) ? 1 : 0,
      containerRemovalStatus: removal.status === 0 || /No such container/i.test(removal.stderr || "") ? 0 : removal.status,
      volumeRemovalStatus: volumeRemoval.status === 0 || /no such volume/i.test(volumeRemoval.stderr || "") ? 0 : volumeRemoval.status
    };
    if (!report.cleanup.completed && report.status === "pass") {
      report.status = "partial";
      process.exitCode = 1;
    }
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }
  assert.equal(report.status, "pass", `r12 single stack driver blocked at ${report.failure?.stage || "cleanup"}`);
  process.stdout.write(`${JSON.stringify({ ok: true, reportPath })}\n`);
})().catch(() => { process.exitCode = 1; });
