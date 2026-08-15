"use strict";

const assert = require("node:assert/strict");

const STAGE0 = Object.freeze({
  schema: "aihub-workflow-production-fresh-host-stage0-v1",
  host: "47.236.62.189",
  hostKeyFingerprint: "SHA256:q4aNRJbw9Pday5Wfq9W1bVErTe1b4Yz6nn7aM+gLDrI",
  keyPairName: "zhenxingai-deploy",
  loginUser: "admin",
  allowedUbuntuVersions: Object.freeze(["24.04"]),
  architecture: "x86_64",
  adminUser: "admin",
  adminUid: 1000,
  adminGid: 1000,
  cpuMinimum: 2,
  diskTotalMinimumBytes: 45 * 1024 ** 3,
  diskAvailableMinimumBytes: 30 * 1024 ** 3,
  kernelMinimum: "5.15",
  glibcMinimum: "2.35",
  dockerMajorMinimum: 26,
  composeMajorMinimum: 2,
  aptPackages: Object.freeze([
    "bash", "ca-certificates", "coreutils", "docker-compose-v2", "docker.io", "iproute2", "openssl", "util-linux"
  ]),
  publicPorts: Object.freeze([80, 443]),
  loopbackPorts: Object.freeze([4173, 4174]),
  publicHosts: Object.freeze(["zhenxingai.com", "community.zhenxingai.com"]),
  directories: Object.freeze([
    "/opt/zhenxing-ai",
    "/opt/zhenxing-ai/releases",
    "/opt/zhenxing-ai/staging",
    "/opt/zhenxing-ai/shared",
    "/opt/zhenxing-ai/shared/backups",
    "/opt/zhenxing-ai/shared/admin/data",
    "/opt/zhenxing-ai/shared/admin/published",
    "/opt/zhenxing-ai/shared/admin/output",
    "/opt/zhenxing-ai/shared/data/identity-postgres",
    "/opt/zhenxing-ai/shared/data/community-mariadb",
    "/opt/zhenxing-ai/shared/data/community-config",
    "/opt/zhenxing-ai/shared/data/community-storage",
    "/opt/zhenxing-ai/shared/data/community-assets",
    "/opt/zhenxing-ai/shared/secrets/community-production",
    "/opt/zhenxing-ai/shared/secrets/workflow-production"
  ])
});

const ENVIRONMENT = Object.freeze({
  schema: "aihub-workflow-production-fresh-host-environment-v1",
  keys: Object.freeze([
    "AIHUB_FRESH_HOST_LOGIN_USER",
    "COMPOSE_PROJECT_NAME",
    "AIHUB_ADMIN_CMS_IMAGE",
    "AIHUB_ADMIN_DATA_DIR",
    "AIHUB_ADMIN_PUBLISHED_DIR",
    "AIHUB_ADMIN_OUTPUT_DIR",
    "AIHUB_IDENTITY_DB_DIR",
    "AIHUB_COMMUNITY_DB_DIR",
    "AIHUB_COMMUNITY_CONFIG_DIR",
    "AIHUB_COMMUNITY_STORAGE_DIR",
    "AIHUB_COMMUNITY_ASSETS_DIR",
    "AIHUB_SECRET_DIR",
    "AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR",
    "AIHUB_FORUM_ADMIN_EMAIL",
    "AIHUB_PUBLIC_HOST",
    "AIHUB_COMMUNITY_PUBLIC_HOST",
    "AIHUB_CADDY_DATA_VOLUME",
    "AIHUB_CADDY_CONFIG_VOLUME",
    "AIHUB_CADDY_CMS_SECRET_VOLUME",
    "AIHUB_RESOURCE_SUBMISSIONS_ENABLED",
    "AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION",
    "AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED",
    "AIHUB_WORKFLOW_STORE_ENABLED",
    "AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED",
    "AIHUB_WORKFLOW_STORE_SCHEMA_VERSION"
  ])
});

const OBSERVATION_KEYS = Object.freeze([
  "loginUser", "osId", "osVersion", "architecture", "systemdPid1", "systemdState",
  "kernel", "glibc", "cpuCount", "memoryBytes", "diskTotalBytes", "diskAvailableBytes",
  "adminState", "uid1000State", "directoryState", "packageState", "dockerState",
  "composeState", "occupiedPorts", "dnsHostsExact"
]);

const BLOCK_CODES = Object.freeze({
  platform: "FRESH_HOST_PLATFORM_DRIFT",
  login: "FRESH_HOST_LOGIN_IDENTITY_DRIFT",
  cpu: "FRESH_HOST_CPU_UNDERSIZED",
  disk: "FRESH_HOST_DISK_UNDERSIZED",
  identity: "FRESH_HOST_IDENTITY_CONFLICT",
  directory: "FRESH_HOST_DIRECTORY_CONFLICT",
  package: "FRESH_HOST_PACKAGE_CONFLICT",
  docker: "FRESH_HOST_DOCKER_DRIFT",
  port: "FRESH_HOST_PORT_CONFLICT",
  dns: "FRESH_HOST_DNS_DRIFT",
  observation: "FRESH_HOST_OBSERVATION_INVALID"
});

function versionAtLeast(actual, minimum) {
  if (!/^\d+(?:\.\d+){1,3}(?:[-+].*)?$/.test(actual || "")) return false;
  const left = actual.split(/[+-]/, 1)[0].split(".").map(Number);
  const right = minimum.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

function validateLoginIdentity(actual, frozen) {
  for (const value of [actual, frozen]) {
    assert.match(value || "", /^[a-z_][a-z0-9_-]{0,31}$/, "fresh-host login identity is invalid");
  }
  assert.equal(frozen.includes("REQUIRED"), false, "fresh-host login identity is not frozen");
  assert.equal(actual, frozen, "fresh-host login identity is not frozen");
  return actual;
}

function blocked(code) {
  return Object.freeze({
    schema: STAGE0.schema,
    status: "blocked",
    code,
    eligibleForTransfer: false,
    prepareAuthorized: false,
    launchAuthorized: false,
    repeatSafe: false
  });
}

function validateStage0Observation(observation, { phase, loginUser }) {
  if (!observation || typeof observation !== "object" || Array.isArray(observation) ||
      Object.keys(observation).length !== OBSERVATION_KEYS.length ||
      OBSERVATION_KEYS.some((key) => !Object.hasOwn(observation, key)) ||
      !["preflight", "verify"].includes(phase)) return blocked(BLOCK_CODES.observation);
  try { validateLoginIdentity(observation.loginUser, loginUser); } catch { return blocked(BLOCK_CODES.login); }
  if (observation.osId !== "ubuntu" || !STAGE0.allowedUbuntuVersions.includes(observation.osVersion) ||
      observation.architecture !== STAGE0.architecture || observation.systemdPid1 !== true ||
      !["running", "degraded"].includes(observation.systemdState) ||
      !versionAtLeast(observation.kernel, STAGE0.kernelMinimum) || !versionAtLeast(observation.glibc, STAGE0.glibcMinimum)) {
    return blocked(BLOCK_CODES.platform);
  }
  if (!Number.isSafeInteger(observation.cpuCount) || observation.cpuCount < STAGE0.cpuMinimum) return blocked(BLOCK_CODES.cpu);
  if (!Number.isSafeInteger(observation.diskTotalBytes) || !Number.isSafeInteger(observation.diskAvailableBytes) ||
      observation.diskTotalBytes < STAGE0.diskTotalMinimumBytes || observation.diskAvailableBytes < STAGE0.diskAvailableMinimumBytes ||
      observation.diskAvailableBytes > observation.diskTotalBytes) return blocked(BLOCK_CODES.disk);
  if (!["absent", "exact"].includes(observation.adminState) || !["absent", "admin"].includes(observation.uid1000State) ||
      (observation.adminState === "exact") !== (observation.uid1000State === "admin")) return blocked(BLOCK_CODES.identity);
  if (!["absent", "exact"].includes(observation.directoryState)) return blocked(BLOCK_CODES.directory);
  if (!["absent", "exact"].includes(observation.packageState)) return blocked(BLOCK_CODES.package);
  if (!["absent", "ready"].includes(observation.dockerState) || !["absent", "ready"].includes(observation.composeState) ||
      (observation.dockerState === "ready") !== (observation.composeState === "ready")) return blocked(BLOCK_CODES.docker);
  if (!Array.isArray(observation.occupiedPorts) || observation.occupiedPorts.some((port) =>
    ![...STAGE0.publicPorts, ...STAGE0.loopbackPorts].includes(port)) || observation.occupiedPorts.length !== 0) return blocked(BLOCK_CODES.port);
  if (observation.dnsHostsExact !== true) return blocked(BLOCK_CODES.dns);
  const installed = observation.adminState === "exact" && observation.directoryState === "exact" &&
    observation.packageState === "exact" && observation.dockerState === "ready";
  if (phase === "verify" && !installed) return blocked(BLOCK_CODES.package);
  if (phase === "preflight" && !(!installed || installed)) return blocked(BLOCK_CODES.observation);
  return Object.freeze({
    schema: STAGE0.schema,
    status: "pass",
    code: null,
    eligibleForTransfer: true,
    prepareAuthorized: false,
    launchAuthorized: false,
    repeatSafe: installed
  });
}

function parseEnvironmentTemplate(source) {
  assert.equal(typeof source, "string");
  const result = {};
  for (const line of source.split(/\r?\n/)) {
    if (line === "" || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=([^\r\n]*)$/.exec(line);
    assert.ok(match, "fresh-host environment line is invalid");
    const [, key, value] = match;
    assert.equal(ENVIRONMENT.keys.includes(key), true, "fresh-host environment key is not allowlisted");
    assert.equal(Object.hasOwn(result, key), false, "fresh-host environment key is duplicated");
    assert.equal(/[\0\r\n`$]/.test(value), false, "fresh-host environment value is unsafe");
    result[key] = value;
  }
  assert.deepEqual(Object.keys(result).sort(), [...ENVIRONMENT.keys].sort());
  return Object.freeze(result);
}

module.exports = {
  BLOCK_CODES,
  ENVIRONMENT,
  STAGE0,
  parseEnvironmentTemplate,
  validateLoginIdentity,
  validateStage0Observation,
  versionAtLeast
};
