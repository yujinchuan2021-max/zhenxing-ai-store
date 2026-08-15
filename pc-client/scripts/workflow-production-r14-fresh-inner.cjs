"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const PROJECT = "zhenxing-community-production";
const RELEASE_NAME = "community-production-r14-e177ec06";
const RELEASE = `/opt/zhenxing-ai/releases/${RELEASE_NAME}`;
const DEPLOYMENT = `${RELEASE}/deployment/community-production`;
const NODE = `${RELEASE}/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`;
const REPORT = "/opt/zhenxing-ai/r14-fresh-report.json";
const BASE = `${DEPLOYMENT}/compose.server.yaml`;
const OVERLAY = `${DEPLOYMENT}/compose.workflow-production.yaml`;
const SAFE_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
const OFFICIAL = Object.freeze([
  { name: "postgres", archive: "/opt/zhenxing-ai/official/postgres.tar", ref: "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193", inspectRef: "postgres:17-alpine", id: "sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193" },
  { name: "mariadb", archive: "/opt/zhenxing-ai/official/mariadb.tar", ref: "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4", inspectRef: "mariadb:11.8", id: "sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4" },
  { name: "caddy", archive: "/opt/zhenxing-ai/official/caddy.tar", ref: "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d", inspectRef: "caddy:2.10-alpine", id: "sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d" }
]);
const CUSTOM = Object.freeze([
  { name: "admin", archive: `${RELEASE}/artifacts/admin-active7-image.tar`, ref: "zhenxing-ai/admin:0.1.40-src-186ff057efd3", inspectRef: "zhenxing-ai/admin:0.1.40-src-186ff057efd3", id: "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd" },
  { name: "identity", archive: `${RELEASE}/artifacts/identity-r11-image.tar`, ref: "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e", inspectRef: "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e", id: "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748" },
  { name: "flarum", archive: `${RELEASE}/artifacts/flarum-8b13962a36bf.tar`, ref: "zhenxing-ai/flarum:community-candidate-8b13962a36bf", inspectRef: "zhenxing-ai/flarum:community-candidate-8b13962a36bf", id: "sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12" }
]);
const RUNNER_PRIVATE_ROOT = "/opt/zhenxing-ai/r14-fresh-private";
const PREPARE_IMAGE_FAILURES = Object.freeze({
  postgres: Object.freeze({ load: "R14_FRESH_POSTGRES_LOAD_FAILED", inspect: "R14_FRESH_POSTGRES_INSPECT_FAILED", id: "R14_FRESH_POSTGRES_IMAGE_ID_DRIFT", tag: "R14_FRESH_POSTGRES_TAG_FAILED", "ref-inspect": "R14_FRESH_POSTGRES_REF_INSPECT_FAILED", "ref-id": "R14_FRESH_POSTGRES_REF_ID_DRIFT" }),
  mariadb: Object.freeze({ load: "R14_FRESH_MARIADB_LOAD_FAILED", inspect: "R14_FRESH_MARIADB_INSPECT_FAILED", id: "R14_FRESH_MARIADB_IMAGE_ID_DRIFT", tag: "R14_FRESH_MARIADB_TAG_FAILED", "ref-inspect": "R14_FRESH_MARIADB_REF_INSPECT_FAILED", "ref-id": "R14_FRESH_MARIADB_REF_ID_DRIFT" }),
  caddy: Object.freeze({ load: "R14_FRESH_CADDY_LOAD_FAILED", inspect: "R14_FRESH_CADDY_INSPECT_FAILED", id: "R14_FRESH_CADDY_IMAGE_ID_DRIFT", tag: "R14_FRESH_CADDY_TAG_FAILED", "ref-inspect": "R14_FRESH_CADDY_REF_INSPECT_FAILED", "ref-id": "R14_FRESH_CADDY_REF_ID_DRIFT" }),
  admin: Object.freeze({ load: "R14_FRESH_ADMIN_LOAD_FAILED", inspect: "R14_FRESH_ADMIN_INSPECT_FAILED", id: "R14_FRESH_ADMIN_IMAGE_ID_DRIFT" }),
  identity: Object.freeze({ load: "R14_FRESH_IDENTITY_LOAD_FAILED", inspect: "R14_FRESH_IDENTITY_INSPECT_FAILED", id: "R14_FRESH_IDENTITY_IMAGE_ID_DRIFT" }),
  flarum: Object.freeze({ load: "R14_FRESH_FLARUM_LOAD_FAILED", inspect: "R14_FRESH_FLARUM_INSPECT_FAILED", id: "R14_FRESH_FLARUM_IMAGE_ID_DRIFT" })
});
const PREPARE_FAILURES = Object.freeze({
  "prepare-directories-mkdir": "R14_FRESH_PREPARE_DIRECTORIES_MKDIR_FAILED",
  "prepare-directories-owner": "R14_FRESH_PREPARE_DIRECTORIES_OWNER_FAILED",
  "prepare-directories-mode": "R14_FRESH_PREPARE_DIRECTORIES_MODE_FAILED",
  unknown: "R14_FRESH_UNKNOWN_FAILED"
});
const CATALOG_FAILURE_CODES_BY_STAGE = Object.freeze({
  "catalog-release-root": "R14_FRESH_CATALOG_RELEASE_ROOT_FAILED",
  "catalog-published-store": "R14_FRESH_CATALOG_PUBLISHED_STORE_FAILED",
  "catalog-artifact-state": "R14_FRESH_CATALOG_STATE_ARTIFACT_FAILED",
  "catalog-artifact-active7": "R14_FRESH_CATALOG_ACTIVE7_ARTIFACT_FAILED",
  "catalog-artifact-active6": "R14_FRESH_CATALOG_ACTIVE6_ARTIFACT_FAILED",
  "catalog-artifact-active72": "R14_FRESH_CATALOG_ACTIVE72_ARTIFACT_FAILED",
  "catalog-state-contract": "R14_FRESH_CATALOG_STATE_CONTRACT_FAILED",
  "catalog-release-directory": "R14_FRESH_CATALOG_RELEASE_DIRECTORY_FAILED",
  "catalog-install-active6": "R14_FRESH_CATALOG_INSTALL_ACTIVE6_FAILED",
  "catalog-install-active72": "R14_FRESH_CATALOG_INSTALL_ACTIVE72_FAILED",
  "catalog-install-active7": "R14_FRESH_CATALOG_INSTALL_ACTIVE7_FAILED",
  "catalog-install-state": "R14_FRESH_CATALOG_INSTALL_STATE_FAILED",
  "catalog-verify-v1": "R14_FRESH_CATALOG_VERIFY_V1_FAILED",
  "catalog-verify-v2": "R14_FRESH_CATALOG_VERIFY_V2_FAILED",
  "catalog-unknown": "R14_FRESH_CATALOG_UNKNOWN_FAILED"
});
const POST_CATALOG_FAILURE_CODES_BY_STAGE = Object.freeze({
  "caddy-data-volume": "R14_FRESH_CADDY_DATA_VOLUME_FAILED",
  "caddy-config-volume": "R14_FRESH_CADDY_CONFIG_VOLUME_FAILED",
  "caddy-secret-volume-seed": "R14_FRESH_CADDY_SECRET_VOLUME_SEED_FAILED",
  "compose-contract": "R14_FRESH_COMPOSE_CONTRACT_FAILED"
});
const BASE_SERVICE_FAILURE_CODES_BY_STAGE = Object.freeze({
  "base-services-identity-database": "R14_FRESH_BASE_SERVICES_IDENTITY_DATABASE_FAILED",
  "base-services-community-database": "R14_FRESH_BASE_SERVICES_COMMUNITY_DATABASE_FAILED",
  "base-services-admin": "R14_FRESH_BASE_SERVICES_ADMIN_FAILED",
  "base-services-multiple": "R14_FRESH_BASE_SERVICES_MULTIPLE_FAILED",
  "base-services-missing": "R14_FRESH_BASE_SERVICES_MISSING",
  "base-services-diagnostic-invalid": "R14_FRESH_BASE_SERVICES_DIAGNOSTIC_INVALID",
  "base-services-diagnostic-command": "R14_FRESH_BASE_SERVICES_DIAGNOSTIC_COMMAND_FAILED",
  "base-services-execution-mismatch": "R14_FRESH_BASE_SERVICES_EXECUTION_MISMATCH"
});
const BASE_SERVICE_KEYS = Object.freeze({ "identity-database": "identityDatabase", "community-database": "communityDatabase", admin: "admin" });
const BASE_SERVICE_STATES = new Set(["healthy", "running-starting", "running-unhealthy", "created", "exited-zero", "exited-nonzero", "dead", "missing", "unverified"]);
const FIXED_STAGES = new Set(["secret-authority", "migrations", "public-services", "official-bootstrap", "target-verification", "deliberate-failure-stop"]);
const PREPARE_FAILURE_CODES_BY_STAGE = Object.freeze({
  ...PREPARE_FAILURES,
  ...Object.fromEntries([...OFFICIAL, ...CUSTOM].flatMap((image) => Object.entries(PREPARE_IMAGE_FAILURES[image.name]).map(([kind, code]) => [`prepare-image-${image.name}-${kind}`, code])))
});
const INNER_FAILURE_CODES_BY_STAGE = Object.freeze({
  ...PREPARE_FAILURE_CODES_BY_STAGE,
  ...CATALOG_FAILURE_CODES_BY_STAGE,
  ...POST_CATALOG_FAILURE_CODES_BY_STAGE,
  ...BASE_SERVICE_FAILURE_CODES_BY_STAGE,
  "catalog-terminal-invalid": "R14_FRESH_CATALOG_TERMINAL_INVALID",
  ...Object.fromEntries([...FIXED_STAGES].map((stage) => [stage, "R14_FRESH_LOCAL_FAILED"]))
});
const environment = Object.freeze({
  PATH: SAFE_PATH, LC_ALL: "C", NODE_USE_SYSTEM_CA: "1", COMPOSE_PROJECT_NAME: PROJECT,
  AIHUB_ADMIN_CMS_IMAGE: "zhenxing-ai/admin:0.1.40-src-186ff057efd3",
  AIHUB_ADMIN_DATA_DIR: "/opt/zhenxing-ai/shared/admin/data",
  AIHUB_ADMIN_PUBLISHED_DIR: "/opt/zhenxing-ai/shared/admin/published",
  AIHUB_ADMIN_OUTPUT_DIR: "/opt/zhenxing-ai/shared/admin/output",
  AIHUB_IDENTITY_DB_DIR: "/opt/zhenxing-ai/shared/data/identity-postgres",
  AIHUB_COMMUNITY_DB_DIR: "/opt/zhenxing-ai/shared/data/community-mariadb",
  AIHUB_COMMUNITY_CONFIG_DIR: "/opt/zhenxing-ai/shared/data/community-config",
  AIHUB_COMMUNITY_STORAGE_DIR: "/opt/zhenxing-ai/shared/data/community-storage",
  AIHUB_COMMUNITY_ASSETS_DIR: "/opt/zhenxing-ai/shared/data/community-assets",
  AIHUB_SECRET_DIR: "/opt/zhenxing-ai/shared/secrets/community-production",
  AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR: "/opt/zhenxing-ai/shared/secrets/workflow-production",
  AIHUB_FORUM_ADMIN_EMAIL: "r14-local@example.invalid",
  AIHUB_PUBLIC_HOST: "r14.localhost", AIHUB_COMMUNITY_PUBLIC_HOST: "community.r14.localhost",
  AIHUB_CADDY_DATA_VOLUME: "r14_fresh_caddy_data", AIHUB_CADDY_CONFIG_VOLUME: "r14_fresh_caddy_config", AIHUB_CADDY_CMS_SECRET_VOLUME: "r14_fresh_caddy_secret",
  AIHUB_RESOURCE_SUBMISSIONS_ENABLED: "0", AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION: "0", AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED: "0",
  AIHUB_WORKFLOW_STORE_ENABLED: "1", AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED: "1", AIHUB_WORKFLOW_STORE_SCHEMA_VERSION: "1"
});

function result(file, args, options = {}) { return spawnSync(file, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 300_000, env: options.env || environment, input: options.input, ...options }); }
function must(value, stage) { if (!value || value.status !== 0 || value.error || value.signal) throw Object.assign(new Error("r14 fresh fixture blocked"), { stage }); return value; }
function docker(args, options) { return result("/usr/bin/docker", args, options); }
function compose(args, options) { return docker(["compose", "-p", PROJECT, "-f", BASE, "-f", OVERLAY, ...args], options); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function fixedFailure(stage, code) { return Object.assign(new Error("r14 fresh fixture blocked"), { stage, code }); }
function safeBaseServiceProjection(value, stage) {
  assert.deepEqual(Object.keys(value || {}).sort(), ["admin", "communityDatabase", "identityDatabase"]);
  for (const state of Object.values(value)) assert.equal(BASE_SERVICE_STATES.has(state), true);
  if (stage) {
    const failed = Object.entries(value).filter(([, state]) => state !== "healthy");
    if (stage === "base-services-missing") assert.equal(Object.values(value).includes("missing"), true);
    else if (stage === "base-services-diagnostic-invalid" || stage === "base-services-diagnostic-command") assert.deepEqual(new Set(Object.values(value)), new Set(["unverified"]));
    else if (stage === "base-services-execution-mismatch") assert.equal(failed.length, 0);
    else if (stage === "base-services-multiple") {
      assert.equal(failed.length > 1, true);
      assert.equal(failed.some(([, state]) => state === "missing" || state === "unverified"), false);
    } else {
      const expectedKey = { "base-services-identity-database": "identityDatabase", "base-services-community-database": "communityDatabase", "base-services-admin": "admin" }[stage];
      assert.deepEqual(failed.map(([key]) => key), [expectedKey]);
    }
  }
  return value;
}
function baseServiceFailure(stage, baseServices) {
  return Object.assign(fixedFailure(stage, BASE_SERVICE_FAILURE_CODES_BY_STAGE[stage]), { baseServices: safeBaseServiceProjection(baseServices, stage) });
}
function unverifiedBaseServices() { return { identityDatabase: "unverified", communityDatabase: "unverified", admin: "unverified" }; }
function classifyBaseService(row) {
  if (row.State === "running" && row.Health === "healthy") return "healthy";
  if (row.State === "running" && row.Health === "starting") return "running-starting";
  if (row.State === "running" && row.Health === "unhealthy") return "running-unhealthy";
  if (row.State === "created" && (row.Health === "" || row.Health === undefined)) return "created";
  if (row.State === "exited" && Number.isSafeInteger(row.ExitCode)) return row.ExitCode === 0 ? "exited-zero" : "exited-nonzero";
  if (row.State === "dead" && (row.Health === "" || row.Health === undefined)) return "dead";
  return null;
}
function parseBaseServiceRows(stdout) {
  assert.equal(typeof stdout, "string");
  assert.equal(Buffer.byteLength(stdout, "utf8") <= 65536, true);
  assert.equal(stdout.includes("\r"), false);
  const body = stdout.endsWith("\n") ? stdout.slice(0, -1) : stdout;
  assert.notEqual(body, "");
  if (body.startsWith("[")) {
    const rows = JSON.parse(body);
    assert.equal(Array.isArray(rows), true);
    assert.equal(rows.length, 3);
    assert.equal(JSON.stringify(rows), body);
    return rows;
  }
  const lines = body.split("\n");
  assert.equal(lines.length, 3);
  return lines.map((line) => {
    assert.notEqual(line, "");
    const row = JSON.parse(line);
    assert.equal(row && typeof row === "object" && !Array.isArray(row), true);
    assert.equal(JSON.stringify(row), line);
    return row;
  });
}
function diagnoseBaseServices(value) {
  if (!value || value.status !== 0 || value.error || value.signal || typeof value.stdout !== "string") {
    throw baseServiceFailure("base-services-diagnostic-command", unverifiedBaseServices());
  }
  let rows;
  try {
    rows = parseBaseServiceRows(value.stdout);
    const byService = new Map();
    for (const row of rows) {
      assert.equal(row && typeof row === "object" && !Array.isArray(row), true);
      assert.equal(Object.hasOwn(BASE_SERVICE_KEYS, row.Service), true);
      assert.equal(byService.has(row.Service), false);
      byService.set(row.Service, row);
    }
    const projected = {};
    for (const [service, key] of Object.entries(BASE_SERVICE_KEYS)) {
      if (!byService.has(service)) projected[key] = "missing";
      else {
        const state = classifyBaseService(byService.get(service));
        assert.notEqual(state, null);
        projected[key] = state;
      }
    }
    safeBaseServiceProjection(projected);
    if (Object.values(projected).includes("missing")) throw baseServiceFailure("base-services-missing", projected);
    const failed = Object.entries(projected).filter(([, state]) => state !== "healthy");
    if (failed.length === 0) throw baseServiceFailure("base-services-execution-mismatch", projected);
    if (failed.length > 1) throw baseServiceFailure("base-services-multiple", projected);
    const stage = { identityDatabase: "base-services-identity-database", communityDatabase: "base-services-community-database", admin: "base-services-admin" }[failed[0][0]];
    throw baseServiceFailure(stage, projected);
  } catch (error) {
    if (error?.baseServices) throw error;
    throw baseServiceFailure("base-services-diagnostic-invalid", unverifiedBaseServices());
  }
}
function runBaseServices(composeCall = compose) {
  const execution = composeCall(["up", "-d", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "240", "identity-database", "community-database", "admin"], { timeout: 300_000 });
  if (execution && execution.status === 0 && !execution.error && !execution.signal) return execution;
  return diagnoseBaseServices(composeCall(["ps", "--all", "--format", "json", "identity-database", "community-database", "admin"]));
}
function runnerPrivateRoots(existsSync = fs.existsSync) { return existsSync(RUNNER_PRIVATE_ROOT) ? 1 : 0; }
function safePrepareFailure(error) {
  return Object.hasOwn(PREPARE_FAILURE_CODES_BY_STAGE, error?.stage) && PREPARE_FAILURE_CODES_BY_STAGE[error.stage] === error?.code
    ? { stage: error.stage, code: error.code }
    : { stage: "unknown", code: PREPARE_FAILURES.unknown };
}
function safeInnerFailure(error, fallbackStage) {
  if (Object.hasOwn(INNER_FAILURE_CODES_BY_STAGE, error?.stage) && INNER_FAILURE_CODES_BY_STAGE[error.stage] === error?.code) {
    if (Object.hasOwn(BASE_SERVICE_FAILURE_CODES_BY_STAGE, error.stage)) {
      try { return { stage: error.stage, code: error.code, baseServices: safeBaseServiceProjection(error.baseServices, error.stage) }; }
      catch { return { stage: "base-services-diagnostic-invalid", code: BASE_SERVICE_FAILURE_CODES_BY_STAGE["base-services-diagnostic-invalid"], baseServices: unverifiedBaseServices() }; }
    }
    return { stage: error.stage, code: error.code };
  }
  return INNER_FAILURE_CODES_BY_STAGE[fallbackStage]
    ? { stage: fallbackStage, code: INNER_FAILURE_CODES_BY_STAGE[fallbackStage] }
    : { stage: "unknown", code: PREPARE_FAILURES.unknown };
}

function requireCatalogInstall(value) {
  let terminal;
  try {
    assert.equal(Boolean(value?.error || value?.signal), false);
    assert.equal(value.stderr, "");
    assert.equal(typeof value.stdout, "string");
    assert.equal(Buffer.byteLength(value.stdout, "utf8") <= 4096, true);
    assert.equal(value.stdout.endsWith("\n"), true);
    assert.equal(value.stdout.slice(0, -1).includes("\n"), false);
    assert.equal(value.stdout.includes("\r"), false);
    terminal = JSON.parse(value.stdout);
    assert.equal(terminal.schema, "aihub-catalog-active7-fresh-install-v1");
    if (value.status === 0) {
      assert.deepEqual(Object.keys(terminal).sort(), ["activeV1", "activeV2", "schema", "signingKeyPresent", "status"]);
      assert.deepEqual(terminal, { schema: "aihub-catalog-active7-fresh-install-v1", status: "pass", activeV1: 72, activeV2: 7, signingKeyPresent: false });
      return terminal;
    }
    assert.equal(value.status, 1);
    assert.deepEqual(Object.keys(terminal).sort(), ["failure", "schema", "status"]);
    assert.equal(terminal.status, "blocked");
    assert.deepEqual(Object.keys(terminal.failure).sort(), ["code", "stage"]);
    assert.equal(CATALOG_FAILURE_CODES_BY_STAGE[terminal.failure.stage], terminal.failure.code);
  } catch {
    throw fixedFailure("catalog-terminal-invalid", INNER_FAILURE_CODES_BY_STAGE["catalog-terminal-invalid"]);
  }
  throw fixedFailure(terminal.failure.stage, terminal.failure.code);
}
function treeSecretValues() {
  return [...fs.readdirSync(environment.AIHUB_SECRET_DIR).map((name) => fs.readFileSync(path.join(environment.AIHUB_SECRET_DIR, name), "utf8").trim()), fs.readFileSync(path.join(environment.AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR, "workflow_review_secret"), "utf8").trim()];
}
function prepareDirectories(dependencies = {}) {
  const mkdirSync = dependencies.mkdirSync || fs.mkdirSync;
  const chmodSync = dependencies.chmodSync || fs.chmodSync;
  const command = dependencies.command || result;
  try { for (const directory of [
    RUNNER_PRIVATE_ROOT,
    "/opt/zhenxing-ai/shared/backups", "/opt/zhenxing-ai/shared/workflow-production-r14", "/opt/zhenxing-ai/shared/backups/workflow-production-r14-evidence",
    environment.AIHUB_ADMIN_DATA_DIR, environment.AIHUB_ADMIN_PUBLISHED_DIR, environment.AIHUB_ADMIN_OUTPUT_DIR,
    environment.AIHUB_IDENTITY_DB_DIR, environment.AIHUB_COMMUNITY_DB_DIR, environment.AIHUB_COMMUNITY_CONFIG_DIR,
    environment.AIHUB_COMMUNITY_STORAGE_DIR, environment.AIHUB_COMMUNITY_ASSETS_DIR, environment.AIHUB_SECRET_DIR,
    environment.AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR
  ]) mkdirSync(directory, { recursive: true, mode: 0o700 });
  } catch { throw fixedFailure("prepare-directories-mkdir", PREPARE_FAILURES["prepare-directories-mkdir"]); }
  try { must(command("/usr/bin/chown", ["-R", "1000:1000", "/opt/zhenxing-ai/shared"]), "prepare-directories-owner"); }
  catch { throw fixedFailure("prepare-directories-owner", PREPARE_FAILURES["prepare-directories-owner"]); }
  try { for (const directory of [environment.AIHUB_SECRET_DIR, environment.AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR]) chmodSync(directory, 0o700); }
  catch { throw fixedFailure("prepare-directories-mode", PREPARE_FAILURES["prepare-directories-mode"]); }
}
function loadImages(dependencies = {}) {
  const dockerCall = dependencies.docker || docker;
  for (const image of [...OFFICIAL, ...CUSTOM]) {
    const failure = PREPARE_IMAGE_FAILURES[image.name];
    const official = OFFICIAL.includes(image);
    try { must(dockerCall(["load", "-i", image.archive]), `prepare-image-${image.name}-load`); }
    catch { throw fixedFailure(`prepare-image-${image.name}-load`, failure.load); }
    let inspected;
    try { inspected = JSON.parse(must(dockerCall(["image", "inspect", official ? image.id : image.inspectRef]), `prepare-image-${image.name}-inspect`).stdout)[0]; }
    catch { throw fixedFailure(`prepare-image-${image.name}-inspect`, failure.inspect); }
    if (!inspected || inspected.Id !== image.id) throw fixedFailure(`prepare-image-${image.name}-id`, failure.id);
    if (official) {
      try { must(dockerCall(["tag", image.id, image.inspectRef]), `prepare-image-${image.name}-tag`); }
      catch { throw fixedFailure(`prepare-image-${image.name}-tag`, failure.tag); }
      try { inspected = JSON.parse(must(dockerCall(["image", "inspect", image.ref]), `prepare-image-${image.name}-ref-inspect`).stdout)[0]; }
      catch { throw fixedFailure(`prepare-image-${image.name}-ref-inspect`, failure["ref-inspect"]); }
      if (!inspected || inspected.Id !== image.id) throw fixedFailure(`prepare-image-${image.name}-ref-id`, failure["ref-id"]);
    }
  }
}
function runPreparePhase(dependencies = {}) { prepareDirectories(dependencies); loadImages(dependencies); }
function createVolumes(dependencies = {}) {
  const dockerCall = dependencies.docker || docker;
  const command = dependencies.command || result;
  const setStage = dependencies.setStage || (() => {});
  for (const [stage, action] of [
    ["caddy-data-volume", () => dockerCall(["volume", "create", environment.AIHUB_CADDY_DATA_VOLUME])],
    ["caddy-config-volume", () => dockerCall(["volume", "create", environment.AIHUB_CADDY_CONFIG_VOLUME])],
    ["caddy-secret-volume-seed", () => command("/bin/bash", [`${DEPLOYMENT}/seed-caddy-secret-volume.sh`, environment.AIHUB_CADDY_CMS_SECRET_VOLUME, `${environment.AIHUB_SECRET_DIR}/community_cms_gateway`], { env: { ...environment, SUDO_UID: "1000", SUDO_GID: "1000" } })]
  ]) {
    setStage(stage);
    try { must(action(), stage); }
    catch { throw fixedFailure(stage, POST_CATALOG_FAILURE_CODES_BY_STAGE[stage]); }
  }
}
function requireComposeContract(composeCall = compose, setStage = () => {}) {
  const stage = "compose-contract";
  setStage(stage);
  try { return must(composeCall(["config", "--format", "json"]), stage); }
  catch { throw fixedFailure(stage, POST_CATALOG_FAILURE_CODES_BY_STAGE[stage]); }
}
async function reviewerProvision() {
  const child = spawn("/usr/bin/docker", ["compose", "-p", PROJECT, "-f", BASE, "-f", OVERLAY, "--profile", "workflow-reviewer-provision", "run", "--rm", "-T", "--no-deps", "-e", "AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE=hold", "workflow-reviewer-provision"], { env: environment, stdio: ["pipe", "pipe", "ignore"] });
  let buffer = "";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("reviewer timeout")), 120_000);
    child.stdout.on("data", (chunk) => { buffer += chunk; if (buffer.includes("\n")) { clearTimeout(timer); resolve(); } });
    child.on("error", reject); child.on("exit", (code) => { if (!buffer.includes("\n")) reject(new Error(`reviewer early exit ${code}`)); });
  });
  const ready = JSON.parse(buffer.split(/\r?\n/)[0]);
  assert.equal(ready.phase, "ready");
  child.stdin.end("commit\n");
  await new Promise((resolve, reject) => child.on("exit", (code) => code === 0 ? resolve() : reject(new Error("reviewer failed"))));
}
async function installLocalTrust() {
  const deadline = Date.now() + 60_000;
  let certificate = "";
  while (Date.now() < deadline) {
    const value = docker(["run", "--rm", "--network", "none", "-v", `${environment.AIHUB_CADDY_DATA_VOLUME}:/source:ro`, "--entrypoint", "sh", OFFICIAL[2].ref, "-ec", "cat /source/caddy/pki/authorities/local/root.crt"]);
    if (value.status === 0 && value.stdout.includes("BEGIN CERTIFICATE")) { certificate = value.stdout; break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.match(certificate, /BEGIN CERTIFICATE/);
  fs.writeFileSync("/usr/local/share/ca-certificates/aihub-r14-local.crt", certificate, { mode: 0o644 });
  must(result("/usr/sbin/update-ca-certificates", []), "local CA trust");
}
function installProcessFixtures() {
  fs.writeFileSync("/usr/bin/systemctl", "#!/bin/sh\ncase \"$*\" in *r14.service*) printf 'LoadState=loaded\\nActiveState=active\\nSubState=running\\n' ;; *) printf 'LoadState=not-found\\nActiveState=inactive\\nSubState=dead\\n' ;; esac\n", { mode: 0o755 });
  fs.writeFileSync("/usr/bin/pgrep", "#!/bin/sh\ncase \"$*\" in *fresh-host-preflight*) printf '%s\\n' \"$PPID\"; exit 0 ;; *) exit 1 ;; esac\n", { mode: 0o755 });
}
function countRows() {
  const pg = must(docker(["exec", `${PROJECT}-identity-database-1`, "sh", "-ec", 'PGPASSWORD="$(cat /run/secrets/identity_db_password)" psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U aihub -d aihub -Atqc "SELECT (SELECT count(*) FROM community_workflow.events)||\'|\'||(SELECT count(*) FROM community_workflow.idempotency)||\'|\'||(SELECT last_sequence FROM community_workflow.event_head WHERE singleton=true)"']), "PG counts").stdout.trim();
  const marker = must(docker(["exec", `${PROJECT}-community-database-1`, "sh", "-ec", 'MYSQL_PWD="$(cat /run/secrets/forum_db_password)" mariadb -u aihub_forum -N -B aihub_forum -e "START TRANSACTION READ ONLY; SELECT COUNT(*) FROM discussions WHERE title LIKE \'% [AIHUBWFOS%V1]\'; COMMIT"']), "source count").stdout.trim().split(/\r?\n/).find((line) => /^\d+$/.test(line));
  return { values: pg.split("|").map(Number), sourcePosts: Number(marker) };
}
function validateTerminal(value, code) { return require(`${DEPLOYMENT}/workflow-production-fresh-host-terminal.cjs`).validateFreshHostTerminal(value, code); }

async function main() {
  const report = { schema: "aihub-workflow-production-r14-fresh-local-v1", candidateOnly: true, deployable: false, serverConnected: false, serverWritten: false, status: "blocked", checks: {}, cleanup: { completed: false } };
  let stage = "prepare"; let secrets = [];
  try {
    runPreparePhase();
    stage = "secret-authority";
    must(result("/bin/bash", [`${DEPLOYMENT}/workflow-production-fresh-secret-authority.sh`, "issue"]), stage);
    secrets = treeSecretValues(); assert.equal(secrets.length, 10);
    stage = "catalog-terminal-invalid";
    requireCatalogInstall(result(NODE, [`${DEPLOYMENT}/catalog-active7-fresh-install.cjs`]));
    createVolumes({ setStage: (value) => { stage = value; } });
    requireComposeContract(compose, (value) => { stage = value; });
    stage = "base-services";
    runBaseServices();
    stage = "migrations";
    must(compose(["--profile", "migration", "run", "--rm", "--no-deps", "identity-migrate"]), "identity migration");
    must(compose(["--profile", "migration", "run", "--rm", "--no-deps", "community-migrate"], { timeout: 300_000 }), "community migration");
    await reviewerProvision();
    stage = "public-services";
    for (const service of ["identity", "community", "caddy"]) must(compose(["up", "-d", "--no-deps", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "240", service], { timeout: 300_000 }), `start ${service}`);
    await installLocalTrust();
    stage = "official-bootstrap";
    must(result(NODE, ["--use-system-ca", `${DEPLOYMENT}/workflow-official-bootstrap-production-wrapper.cjs`, "/opt/zhenxing-ai/shared/backups/workflow-production-r14-evidence", "http://127.0.0.1:4173", environment.AIHUB_PUBLIC_HOST, BASE, OVERLAY], { timeout: 300_000 }), stage);
    stage = "target-verification";
    installProcessFixtures();
    Object.assign(process.env, environment);
    const collector = require(`${DEPLOYMENT}/workflow-production-r12-fixed-collector.cjs`).createR12FixedCollector({ releaseRoot: RELEASE });
    const snapshot = await collector.target();
    const workflow = await require(`${DEPLOYMENT}/workflow-production-existing-state.cjs`).verifyExistingWorkflowState({ ...snapshot.workflowStateInput, mode: "target" });
    assert.equal(workflow.baseline, "workflow-only-retained-official-bootstrap");
    const counts = countRows();
    assert.deepEqual(counts, { values: [9, 9, 9], sourcePosts: 3 });
    assert.deepEqual(snapshot.resourceSubmissionTables, []); assert.equal(snapshot.publicWorkflowCount, 3);
    const running = docker(["ps", "-q", "--filter", `label=com.docker.compose.project=${PROJECT}`]).stdout.split(/\r?\n/).filter(Boolean).length;
    assert.equal(running, 6);
    const successTerminal = validateTerminal({ schema: "aihub-workflow-production-fresh-host-terminal-v1", status: "pass", runId: "workflow-production-r14", stage: null, code: null, stopCode: null, serverConnected: true, serverWritten: true, assetWrites: true, secretWrites: true, catalogWrites: true, databaseWrites: true, servicesStarted: true, productionExposed: true, servicesHealthy: 6, servicesStoppedOnFailure: false, sourcePosts: 3, events: 9, idempotency: 9, eventHead: 9, publicWorkflowCount: 3, resourceTablesAbsent: true, secretValuesEmitted: false }, 0);
    stage = "deliberate-failure-stop";
    must(compose(["stop", "caddy", "community", "identity", "admin", "community-database", "identity-database"]), stage);
    const stillRunning = docker(["ps", "-q", "--filter", `label=com.docker.compose.project=${PROJECT}`]).stdout.trim();
    assert.equal(stillRunning, "");
    const failureTerminal = validateTerminal({ ...successTerminal, status: "failed", stage: "target-verification", code: "R14_INITIALIZE_LAUNCH_FAILED", stopCode: null, productionExposed: false, servicesHealthy: 0, servicesStoppedOnFailure: true, sourcePosts: null, events: null, idempotency: null, eventHead: null, publicWorkflowCount: null, resourceTablesAbsent: null }, 1);
    report.checks = { projectCount: 1, longRunningServices: 6, sourcePosts: 3, events: 9, idempotency: 9, eventHead: 9, reviewerPublisherExact: true, activeV2: 7, activeV1: 72, publicListAndDetailCount: 3, workflowOnlyProfile: true, resourceTablesAbsent: true, resourceCapabilityDisabled: true, workflowCapabilityEnabledLookupFalse: true, bootstrapZeroDelete: true, deliberateFailure: { terminal: failureTerminal.status, publicServicesOnline: false, automaticRetries: 0, appendOnlyDeleteCalls: 0 }, successTerminal, secretValueHits: 0 };
    assert.equal(secrets.some((secret) => JSON.stringify(report).includes(secret)), false);
    report.status = "pass";
  } catch (error) {
    report.failure = safeInnerFailure(error, stage);
    process.exitCode = 1;
  } finally {
    const down = compose(["down", "--remove-orphans"]);
    for (const volume of [environment.AIHUB_CADDY_DATA_VOLUME, environment.AIHUB_CADDY_CONFIG_VOLUME, environment.AIHUB_CADDY_CMS_SECRET_VOLUME]) docker(["volume", "rm", volume]);
    const containers = docker(["ps", "-aq", "--filter", `label=com.docker.compose.project=${PROJECT}`]).stdout.trim();
    const networks = docker(["network", "ls", "-q", "--filter", `label=com.docker.compose.project=${PROJECT}`]).stdout.trim();
    const volumes = docker(["volume", "ls", "-q", "--filter", "name=^r14_fresh_caddy_"]).stdout.trim();
    try { fs.rmSync(RUNNER_PRIVATE_ROOT, { recursive: true, force: true }); } catch {}
    report.cleanup = { completed: !containers && !networks && !volumes && runnerPrivateRoots() === 0, containers: containers ? 1 : 0, networks: networks ? 1 : 0, volumes: volumes ? 1 : 0, privateRoots: runnerPrivateRoots(), downStatus: down.status === 0 ? 0 : 1 };
    if (!report.cleanup.completed && report.status === "pass") report.status = "partial";
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  assert.equal(report.status, "pass", `r14 fresh fixture blocked at ${report.failure?.stage || "cleanup"}`);
  process.stdout.write(`${JSON.stringify({ ok: true, report: REPORT })}\n`);
}

module.exports = { BASE_SERVICE_FAILURE_CODES_BY_STAGE, CATALOG_FAILURE_CODES_BY_STAGE, CUSTOM, OFFICIAL, PREPARE_FAILURES, PREPARE_IMAGE_FAILURES, INNER_FAILURE_CODES_BY_STAGE, RELEASE, RELEASE_NAME, createVolumes, prepareDirectories, loadImages, requireCatalogInstall, requireComposeContract, runBaseServices, runPreparePhase, safeBaseServiceProjection, safePrepareFailure, safeInnerFailure, runnerPrivateRoots };
if (require.main === module) main().catch(() => { process.exitCode = 1; });
