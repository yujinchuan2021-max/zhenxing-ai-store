"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = Object.freeze({
  tag: "postgres:17-alpine",
  digestRef: "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193",
  id: "sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193"
});
const OUTER_IMAGE = "aihub-workflow-release-prepare-test:ubuntu24-dind";
const OUTER_IMAGE_ID = "sha256:2f5e683c88da8f770a788cb9ab72e213d70cc7a2ae2c007e2b41ae8a99f4ed40";
const EXPECTED_CHECKS = Object.freeze({
  loadStatus: true, imageId: IMAGE.id, imageIdExact: true,
  repoTagsCount: 0, fixedTagPresentBefore: false,
  repoDigestsCount: 0, fixedDigestPresentBefore: false,
  inspectById: true, inspectByTagBefore: false, inspectByDigestBefore: false, pinnedCreateBeforeTag: false,
  fixedTagCreatedFromExactId: true, inspectByTagAfter: true, inspectByDigestAfter: true, pinnedCreateAfterTag: true
});

function call(args, options = {}) { return spawnSync("docker", args, { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 300_000, ...options }); }
function ok(value) { return Boolean(value && value.status === 0 && !value.error && !value.signal); }
function inspect(args) {
  const value = call(args);
  if (!ok(value)) return null;
  try { const parsed = JSON.parse(value.stdout); return Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null; } catch { return null; }
}
function referenceChecksExact(checks) { try { assert.deepEqual(checks, EXPECTED_CHECKS); return true; } catch { return false; } }
function main() {
  const suffix = crypto.randomBytes(5).toString("hex");
  const outer = `aihub-r14-official-ref-${suffix}`;
  const volume = `${outer}-docker`;
  const nestedProbe = `${outer}-resolution`;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-r14-official-ref-"));
  const output = path.join(ROOT, "output", `workflow-production-r14-official-image-reference-${suffix}`);
  const archive = path.join(temporary, "postgres.tar");
  fs.mkdirSync(output, { recursive: false });
  const report = {
    schema: "aihub-workflow-production-r14-official-image-reference-v1",
    status: "blocked",
    candidateOnly: true,
    deployable: false,
    checks: {},
    cleanup: { completed: false }
  };
  let outerCreated = false; let volumeCreated = false; let nestedProbeCreated = false;
  try {
    const hostDigest = inspect(["image", "inspect", IMAGE.digestRef]);
    if (!hostDigest || hostDigest.Id !== IMAGE.id) throw new Error("host-contract");
    const outerImage = inspect(["image", "inspect", OUTER_IMAGE]);
    if (!outerImage || outerImage.Id !== OUTER_IMAGE_ID) throw new Error("outer-contract");
    if (!ok(call(["save", "--output", archive, IMAGE.digestRef]))) throw new Error("save");
    if (!ok(call(["volume", "create", volume]))) throw new Error("volume"); volumeCreated = true;
    if (!ok(call(["run", "-d", "--privileged", "--cgroupns=private", "--name", outer, "--mount", `type=volume,src=${volume},dst=/var/lib/docker`, OUTER_IMAGE, "dockerd", "--host=unix:///var/run/docker.sock", "--feature", "containerd-snapshotter=true"]))) throw new Error("outer"); outerCreated = true;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && !ok(call(["exec", outer, "docker", "info"]))) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    if (!ok(call(["exec", outer, "docker", "info"]))) throw new Error("daemon");
    if (!ok(call(["exec", outer, "mkdir", "-p", "/probe"]))) throw new Error("probe-root");
    if (!ok(call(["cp", archive, `${outer}:/probe/postgres.tar`]))) throw new Error("copy");
    const load = call(["exec", outer, "docker", "load", "-i", "/probe/postgres.tar"]);
    const byId = inspect(["exec", outer, "docker", "image", "inspect", IMAGE.id]);
    const byTagBefore = inspect(["exec", outer, "docker", "image", "inspect", IMAGE.tag]);
    const byDigestBefore = inspect(["exec", outer, "docker", "image", "inspect", IMAGE.digestRef]);
    const createBefore = call(["exec", outer, "docker", "create", "--pull", "never", "--name", nestedProbe, "--network", "none", "--entrypoint", "/bin/true", IMAGE.digestRef]);
    if (ok(createBefore)) { nestedProbeCreated = true; call(["exec", outer, "docker", "rm", "-f", nestedProbe]); nestedProbeCreated = false; }
    const tag = call(["exec", outer, "docker", "tag", IMAGE.id, IMAGE.tag]);
    const byTagAfter = inspect(["exec", outer, "docker", "image", "inspect", IMAGE.tag]);
    const byDigestAfter = inspect(["exec", outer, "docker", "image", "inspect", IMAGE.digestRef]);
    const createAfter = call(["exec", outer, "docker", "create", "--pull", "never", "--name", nestedProbe, "--network", "none", "--entrypoint", "/bin/true", IMAGE.digestRef]);
    if (ok(createAfter)) { nestedProbeCreated = true; call(["exec", outer, "docker", "rm", "-f", nestedProbe]); nestedProbeCreated = false; }
    report.checks = {
      loadStatus: ok(load),
      imageId: IMAGE.id,
      imageIdExact: byId?.Id === IMAGE.id,
      repoTagsCount: Array.isArray(byId?.RepoTags) ? byId.RepoTags.length : 0,
      fixedTagPresentBefore: Array.isArray(byId?.RepoTags) && byId.RepoTags.includes(IMAGE.tag),
      repoDigestsCount: Array.isArray(byId?.RepoDigests) ? byId.RepoDigests.length : 0,
      fixedDigestPresentBefore: Array.isArray(byId?.RepoDigests) && byId.RepoDigests.includes(IMAGE.digestRef),
      inspectById: byId?.Id === IMAGE.id,
      inspectByTagBefore: byTagBefore?.Id === IMAGE.id,
      inspectByDigestBefore: byDigestBefore?.Id === IMAGE.id,
      pinnedCreateBeforeTag: ok(createBefore),
      fixedTagCreatedFromExactId: ok(tag),
      inspectByTagAfter: byTagAfter?.Id === IMAGE.id,
      inspectByDigestAfter: byDigestAfter?.Id === IMAGE.id,
      pinnedCreateAfterTag: ok(createAfter)
    };
    if (!referenceChecksExact(report.checks)) throw new Error("projection");
    report.status = "pass";
  } catch {
    report.failure = { stage: "probe", code: "R14_OFFICIAL_IMAGE_REFERENCE_PROBE_FAILED" };
    process.exitCode = 1;
  } finally {
    if (nestedProbeCreated && outerCreated) call(["exec", outer, "docker", "rm", "-f", nestedProbe]);
    const outerRemoval = outerCreated ? call(["rm", "-f", outer]) : { status: 0 };
    const volumeRemoval = volumeCreated ? call(["volume", "rm", volume]) : { status: 0 };
    try { fs.rmSync(temporary, { recursive: true, force: true }); } catch {}
    const outerQuery = outerCreated ? call(["ps", "-aq", "--filter", `name=^/${outer}$`]) : { status: 0, stdout: "" };
    const volumeQuery = volumeCreated ? call(["volume", "ls", "-q", "--filter", `name=^${volume}$`]) : { status: 0, stdout: "" };
    report.cleanup = {
      completed: ok(outerRemoval) && ok(volumeRemoval) && ok(outerQuery) && ok(volumeQuery) && !String(outerQuery.stdout || "").trim() && !String(volumeQuery.stdout || "").trim() && !fs.existsSync(temporary),
      containers: String(outerQuery.stdout || "").trim() ? 1 : 0,
      networks: 0,
      volumes: String(volumeQuery.stdout || "").trim() ? 1 : 0,
      privateRoots: fs.existsSync(temporary) ? 1 : 0
    };
    if (!report.cleanup.completed && report.status === "pass") report.status = "partial";
    fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  if (report.status !== "pass") process.exitCode = 1;
  process.stdout.write(`${JSON.stringify({ ok: report.status === "pass", report: path.join(output, "report.json") })}\n`);
}

module.exports = { referenceChecksExact };
if (require.main === module) main();
