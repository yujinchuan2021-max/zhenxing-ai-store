"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const dns = require("node:dns/promises");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { STAGE0, parseEnvironmentTemplate, validateLoginIdentity } = require("./workflow-production-fresh-host-contract.cjs");
const { createR12FixedCollector, targetFailureTerminal, targetStep } = require("./workflow-production-r12-fixed-collector.cjs");

const RELEASE_PATTERN = /^\/opt\/zhenxing-ai\/releases\/community-production-(?:r25|r26|r27)-[A-Za-z0-9][A-Za-z0-9-]{5,64}$/;
const DATA_DIRECTORIES = Object.freeze(STAGE0.directories.filter((entry) =>
  entry.includes("/shared/admin/") || entry.includes("/shared/data/") || entry.includes("/shared/secrets/")));
const REQUIRED_ENVIRONMENT = Object.freeze({
  AIHUB_FRESH_HOST_LOGIN_USER: "admin",
  COMPOSE_PROJECT_NAME: "zhenxing-community-production",
  AIHUB_ADMIN_CMS_IMAGE: "zhenxing-ai/admin:0.1.40-src-186ff057efd3",
  AIHUB_PUBLIC_HOST: "zhenxingai.com",
  AIHUB_COMMUNITY_PUBLIC_HOST: "community.zhenxingai.com",
  AIHUB_RESOURCE_SUBMISSIONS_ENABLED: "0",
  AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION: "0",
  AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED: "0",
  AIHUB_WORKFLOW_STORE_ENABLED: "1",
  AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED: "1",
  AIHUB_WORKFLOW_STORE_SCHEMA_VERSION: "1"
});

function blocked(code) {
  const error = new Error("fresh-host preflight blocked");
  error.code = code;
  return error;
}
function fixedRun(file, args, options = {}) {
  const result = spawnSync(file, args, { encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 30000, shell: false, ...options });
  if (result.error || result.signal || result.status !== 0) throw blocked("FRESH_HOST_FIXED_COMMAND_FAILED");
  return result.stdout;
}
function exactEnvironment(releaseRoot) {
  const file = path.join(releaseRoot, "deployment", "community-production", "workflow-production-fresh-host.env.template");
  const values = parseEnvironmentTemplate(fs.readFileSync(file, "utf8"));
  validateLoginIdentity(values.AIHUB_FRESH_HOST_LOGIN_USER, STAGE0.loginUser);
  for (const [key, value] of Object.entries(REQUIRED_ENVIRONMENT)) assert.equal(values[key], value);
  for (const key of ["AIHUB_ADMIN_DATA_DIR", "AIHUB_ADMIN_PUBLISHED_DIR", "AIHUB_ADMIN_OUTPUT_DIR", "AIHUB_IDENTITY_DB_DIR", "AIHUB_COMMUNITY_DB_DIR", "AIHUB_COMMUNITY_CONFIG_DIR", "AIHUB_COMMUNITY_STORAGE_DIR", "AIHUB_COMMUNITY_ASSETS_DIR", "AIHUB_SECRET_DIR", "AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR"]) {
    assert.equal(values[key].startsWith("/opt/zhenxing-ai/shared/"), true);
    assert.equal(path.posix.normalize(values[key]), values[key]);
  }
  return values;
}
function assertEmptyDirectory(directory, fsImpl = fs) {
  const stat = fsImpl.lstatSync(directory);
  const expectedMode = directory.includes("/shared/secrets/") ? 0o700 : 0o755;
  if (fsImpl.realpathSync(directory) !== directory || !stat.isDirectory() || stat.isSymbolicLink() ||
      stat.uid !== 1000 || stat.gid !== 1000 || (stat.mode & 0o777) !== expectedMode ||
      !Number.isSafeInteger(stat.nlink) || stat.nlink < 2) {
    throw blocked("FRESH_HOST_DIRECTORY_CONFLICT");
  }
  if (fsImpl.readdirSync(directory).length !== 0) throw blocked("FRESH_HOST_NOT_EMPTY");
}
function validateReusableCaddyDataVolume(inspection, options = {}) {
  const fileSystem = options.fs || fs;
  const parseCertificate = options.parseCertificate || ((bytes) => new crypto.X509Certificate(bytes));
  const name = "zhenxing-ai-community-production-caddy-data";
  const mountpoint = `/var/lib/docker/volumes/${name}/_data`;
  try {
    assert.equal(Array.isArray(inspection), true);
    assert.equal(inspection.length, 1);
    const volume = inspection[0];
    assert.equal(volume.Name, name);
    assert.equal(volume.Driver, "local");
    assert.equal(volume.Scope, "local");
    assert.equal(volume.Mountpoint, mountpoint);
    assert.equal(volume.Labels, null);
    assert.equal(volume.Options, null);
    const root = fileSystem.lstatSync(mountpoint);
    assert.equal(fileSystem.realpathSync(mountpoint), mountpoint);
    assert.equal(root.isDirectory(), true);
    assert.equal(root.isSymbolicLink(), false);
    assert.equal(`${root.uid}:${root.gid}`, "65534:65534");
    assert.equal(root.mode & 0o777, 0o755);
    for (const host of STAGE0.publicHosts) {
      const base = path.posix.join(mountpoint, "caddy", "certificates", "acme.zerossl.com-v2-dv90", host, host);
      for (const suffix of [".crt", ".key", ".json"]) {
        const target = `${base}${suffix}`;
        const stat = fileSystem.lstatSync(target);
        assert.equal(stat.isFile(), true);
        assert.equal(stat.isSymbolicLink(), false);
        assert.equal(`${stat.uid}:${stat.gid}`, "65534:65534");
        assert.equal(stat.mode & 0o777, 0o600);
        assert.equal(stat.nlink, 1);
        assert.equal(stat.size > 0 && stat.size < 65536, true);
      }
      const certificate = parseCertificate(fileSystem.readFileSync(`${base}.crt`), host);
      assert.equal(certificate.checkHost(host), host);
    }
    return true;
  } catch {
    throw blocked("FRESH_HOST_CADDY_DATA_VOLUME_CONFLICT");
  }
}
function targetBlockedOutput(error) {
  return Object.freeze({
    schema: "aihub-workflow-production-fresh-host-preflight-v1",
    status: "blocked",
    phase: "target",
    failure: targetFailureTerminal(error),
    secretValuesEmitted: false,
    initializeAuthorized: false,
    launchAuthorized: false
  });
}

function createFreshHostPreflight(options = {}) {
  const execute = options.execute || fixedRun;
  const resolve4 = options.resolve4 || dns.resolve4;
  const fileSystem = options.fs || fs;
  return Object.freeze({
    async preflight(releaseRoot) {
      if (!RELEASE_PATTERN.test(releaseRoot) || fileSystem.realpathSync(releaseRoot) !== releaseRoot) throw blocked("FRESH_HOST_RELEASE_INVALID");
      const deployment = path.join(releaseRoot, "deployment", "community-production");
      const runtime = path.join(releaseRoot, ".workflow-runtime", "node-v24.18.1-linux-x64", "bin", "node");
      const bundle = require(path.join(deployment, "workflow-production-release-bundle.cjs"));
      bundle.verifyPreparedRelease(releaseRoot);
      const environment = exactEnvironment(releaseRoot);
      const projectContainers = execute("/usr/bin/docker", ["ps", "-aq", "--filter", "label=com.docker.compose.project=zhenxing-community-production"]).trim();
      if (projectContainers !== "") throw blocked("FRESH_HOST_PROJECT_EXISTS");
      for (const directory of DATA_DIRECTORIES) assertEmptyDirectory(directory);
      const volumes = execute("/usr/bin/docker", ["volume", "ls", "-q"]).split(/\r?\n/).filter(Boolean);
      if (volumes.includes(environment.AIHUB_CADDY_DATA_VOLUME)) {
        validateReusableCaddyDataVolume(JSON.parse(execute("/usr/bin/docker", ["volume", "inspect", environment.AIHUB_CADDY_DATA_VOLUME])), { fs: fileSystem });
      }
      for (const volume of [environment.AIHUB_CADDY_CONFIG_VOLUME, environment.AIHUB_CADDY_CMS_SECRET_VOLUME]) {
        if (volumes.includes(volume)) throw blocked("FRESH_HOST_VOLUME_EXISTS");
      }
      const listeners = execute("/usr/bin/ss", ["-H", "-ltn"]);
      if (/(?:^|[\s:])(?:80|443|4173|4174)(?:\s|$)/m.test(listeners)) throw blocked("FRESH_HOST_PORT_CONFLICT");
      for (const host of STAGE0.publicHosts) {
        const addresses = await resolve4(host);
        if (!Array.isArray(addresses) || !addresses.includes(STAGE0.host)) throw blocked("FRESH_HOST_DNS_DRIFT");
      }
      return Object.freeze({
        schema: "aihub-workflow-production-fresh-host-preflight-v1",
        status: "pass",
        phase: "pre-initialize",
        preparedExact: true,
        environmentExact: true,
        emptyHostExact: true,
        dnsExact: true,
        secretValuesEmitted: false,
        initializeAuthorized: false,
        launchAuthorized: false
      });
    },
    async target(releaseRoot) {
      if (!RELEASE_PATTERN.test(releaseRoot) || fileSystem.realpathSync(releaseRoot) !== releaseRoot) throw blocked("FRESH_HOST_RELEASE_INVALID");
      const deployment = path.join(releaseRoot, "deployment", "community-production");
      const environment = exactEnvironment(releaseRoot);
      Object.assign(process.env, environment);
      const bundle = require(path.join(deployment, "workflow-production-release-bundle.cjs"));
      bundle.verifyPreparedRelease(releaseRoot);
      const collector = createR12FixedCollector({ releaseRoot });
      const existing = await targetStep("existing-state", () => require(path.join(deployment, "workflow-production-existing-state.cjs")));
      const snapshot = await collector.target();
      const workflowReceipt = await targetStep("existing-state", () => existing.verifyExistingWorkflowState({ ...snapshot.workflowStateInput, mode: "target" }));
      await targetStep("final-target-assertions", () => {
        assert.equal(workflowReceipt.baseline, "workflow-only-retained-official-bootstrap");
        assert.deepEqual(snapshot.resourceSubmissionTables, []);
        assert.equal(snapshot.publicWorkflowCount, 3);
      });
      return Object.freeze({
        schema: "aihub-workflow-production-fresh-host-preflight-v1",
        status: "pass",
        phase: "target",
        preparedExact: true,
        environmentExact: true,
        servicesHealthy: 6,
        sourcePosts: 3,
        events: 9,
        idempotency: 9,
        eventHead: 9,
        resourceTablesAbsent: true,
        publicWorkflowCount: 3,
        secretValuesEmitted: false,
        initializeAuthorized: false,
        launchAuthorized: false
      });
    }
  });
}

async function main(argv = process.argv.slice(2)) {
  assert.equal(argv.length, 1);
  assert.equal(["preflight", "target"].includes(argv[0]), true);
  const releaseRoot = fs.realpathSync(path.resolve(__dirname, "..", ".."));
  const result = await createFreshHostPreflight()[argv[0]](releaseRoot);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) main().catch((error) => {
  const target = process.argv.slice(2)[0] === "target";
  const output = target
    ? targetBlockedOutput(error)
    : { schema: "aihub-workflow-production-fresh-host-preflight-v1", status: "blocked", code: /^FRESH_HOST_[A-Z_]+$/.test(error?.code || "") ? error.code : "FRESH_HOST_PREFLIGHT_FAILED", secretValuesEmitted: false, initializeAuthorized: false, launchAuthorized: false };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = 1;
});

module.exports = { DATA_DIRECTORIES, REQUIRED_ENVIRONMENT, assertEmptyDirectory, createFreshHostPreflight, exactEnvironment, targetBlockedOutput, validateReusableCaddyDataVolume };
