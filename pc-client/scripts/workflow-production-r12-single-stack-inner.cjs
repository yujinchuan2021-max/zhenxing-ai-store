"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PROJECT = "zhenxing-community-production";
const RELEASE = "/opt/zhenxing-ai/releases/community-production-r12-15620c86";
const DEPLOYMENT = `${RELEASE}/deployment/community-production`;
const NODE = `${RELEASE}/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`;
const FIXTURE = "/opt/zhenxing-ai/fixture-r12";
const CONTROL = "/opt/zhenxing-ai/shared/workflow-production-r12";
const BACKUPS = "/opt/zhenxing-ai/shared/backups";
const EVIDENCE = `${BACKUPS}/workflow-production-r12-evidence`;
const REPORT = "/opt/zhenxing-ai/r12-single-stack-report.json";
const BASE = `${DEPLOYMENT}/compose.server.yaml`;
const TARGET = `${DEPLOYMENT}/compose.workflow-production.yaml`;
const DISABLED = `${DEPLOYMENT}/compose.workflow-production-r12-disabled.yaml`;
const OLD_ADMIN = "zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9";
const OLD_IDENTITY = "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392";
const TARGET_ADMIN = "zhenxing-ai/admin:0.1.40-src-186ff057efd3";
const TARGET_IDENTITY = "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e";
const FIXED_FAILURES = Object.freeze([
  "recreate:admin",
  "recreate:identity",
  "activate:active7",
  "verify:workflow-migrate",
  "verify:workflow-reviewer-provision",
  "verify:workflow-official-bootstrap",
  "target-verification"
]);
const EXPECTED_STAGE = Object.freeze({
  "recreate:admin": "recreate-admin",
  "recreate:identity": "recreate-identity",
  "activate:active7": "activation",
  "verify:workflow-migrate": "workflow-migration",
  "verify:workflow-reviewer-provision": "reviewer-provision",
  "verify:workflow-official-bootstrap": "official-bootstrap",
  "target-verification": "target-verification"
});
const OFFICIAL_IMAGES = Object.freeze([
  Object.freeze({ archive: "/opt/zhenxing-ai/official/postgres.tar", ref: "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193", id: "sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193" }),
  Object.freeze({ archive: "/opt/zhenxing-ai/official/mariadb.tar", ref: "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4", id: "sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4" }),
  Object.freeze({ archive: "/opt/zhenxing-ai/official/caddy.tar", ref: "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d", id: "sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d" })
]);
const CUSTOM_IMAGES = Object.freeze([
  Object.freeze({ archive: `${RELEASE}/artifacts/identity-19a-rollback-image.tar`, ref: OLD_IDENTITY, id: "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567" }),
  Object.freeze({ archive: `${RELEASE}/artifacts/admin-old-b6ea4c5bd0e9.tar`, ref: OLD_ADMIN, id: "sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2" }),
  Object.freeze({ archive: `${RELEASE}/artifacts/identity-r11-image.tar`, ref: TARGET_IDENTITY, id: "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748" }),
  Object.freeze({ archive: `${RELEASE}/artifacts/admin-active7-image.tar`, ref: TARGET_ADMIN, id: "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd" }),
  Object.freeze({ archive: `${RELEASE}/artifacts/flarum-8b13962a36bf.tar`, ref: "zhenxing-ai/flarum:community-candidate-8b13962a36bf", id: "sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12" })
]);
const SAFE_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

function result(file, args, options = {}) {
  return spawnSync(file, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: options.env || { PATH: SAFE_PATH, LC_ALL: "C" },
    input: options.input,
    timeout: options.timeout || 300_000,
    ...options
  });
}
function must(value, stage) {
  if (!value || value.status !== 0 || value.error || value.signal) {
    const error = new Error("r12 single stack blocked");
    error.stage = stage;
    throw error;
  }
  return value;
}
function docker(args, options) { return result("/usr/bin/docker", args, options); }
function compose(profile, args, options = {}) {
  const files = profile === "target" ? [BASE, TARGET] : [BASE, DISABLED];
  const composeEnvironment = profile === "target" ? targetEnvironment() : baselineEnvironment();
  return docker(["compose", "-p", PROJECT, ...files.flatMap((file) => ["-f", file]), ...args], { ...options, env: composeEnvironment });
}
function writePrivate(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filename, value, { flag: "wx", mode: 0o600 });
  fs.chownSync(filename, 1000, 1000);
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function exactHexSecret() { return crypto.randomBytes(32).toString("hex"); }

const environment = Object.freeze({
  PATH: SAFE_PATH,
  LC_ALL: "C",
  COMPOSE_PROJECT_NAME: PROJECT,
  AIHUB_ADMIN_DATA_DIR: `${FIXTURE}/admin-data`,
  AIHUB_ADMIN_PUBLISHED_DIR: `${FIXTURE}/admin-published`,
  AIHUB_ADMIN_OUTPUT_DIR: `${FIXTURE}/admin-output`,
  AIHUB_IDENTITY_DB_DIR: `${FIXTURE}/identity-db`,
  AIHUB_COMMUNITY_DB_DIR: `${FIXTURE}/community-db`,
  AIHUB_COMMUNITY_CONFIG_DIR: `${FIXTURE}/community-config`,
  AIHUB_COMMUNITY_STORAGE_DIR: `${FIXTURE}/community-storage`,
  AIHUB_COMMUNITY_ASSETS_DIR: `${FIXTURE}/community-assets`,
  AIHUB_SECRET_DIR: `${FIXTURE}/secrets`,
  AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR: `${FIXTURE}/workflow-secrets`,
  AIHUB_PUBLIC_HOST: "r12.localhost",
  AIHUB_COMMUNITY_PUBLIC_HOST: "community.r12.localhost",
  AIHUB_CADDY_DATA_VOLUME: "r12_single_stack_caddy_data",
  AIHUB_CADDY_CONFIG_VOLUME: "r12_single_stack_caddy_config",
  AIHUB_CADDY_CMS_SECRET_VOLUME: "r12_single_stack_caddy_secret",
  AIHUB_FORUM_ADMIN_EMAIL: "r12-local@example.invalid"
});
function baselineEnvironment() { return { ...process.env, ...environment, AIHUB_ADMIN_CMS_IMAGE: OLD_ADMIN, AIHUB_IDENTITY_IMAGE: OLD_IDENTITY }; }
function targetEnvironment() { return { ...process.env, ...environment, AIHUB_ADMIN_CMS_IMAGE: TARGET_ADMIN, AIHUB_IDENTITY_IMAGE: TARGET_IDENTITY }; }

function installProcessFixtures() {
  const systemctl = [
    "#!/bin/sh",
    "case \"$*\" in",
    "  *zhenxing-ai-workflow-production-r12.service*) printf 'LoadState=loaded\\nActiveState=active\\nSubState=running\\n' ;;",
    "  *) printf 'LoadState=not-found\\nActiveState=inactive\\nSubState=dead\\n' ;;",
    "esac",
    ""
  ].join("\n");
  const pgrep = [
    "#!/bin/sh",
    "case \"$*\" in",
    "  *workflow-production-r12-prepared-coordinator*) printf '%s\\n' \"$PPID\"; exit 0 ;;",
    "  *) exit 1 ;;",
    "esac",
    ""
  ].join("\n");
  fs.writeFileSync("/usr/bin/systemctl", systemctl, { mode: 0o755 });
  fs.writeFileSync("/usr/bin/pgrep", pgrep, { mode: 0o755 });
}

function prepareFilesystem(secretValues) {
  for (const key of Object.keys(process.env)) if (key.startsWith("NODE_")) delete process.env[key];
  for (const [name, value] of Object.entries(environment)) process.env[name] = value;
  for (const directory of [
    FIXTURE, environment.AIHUB_ADMIN_OUTPUT_DIR, environment.AIHUB_IDENTITY_DB_DIR,
    environment.AIHUB_COMMUNITY_DB_DIR, environment.AIHUB_COMMUNITY_CONFIG_DIR,
    environment.AIHUB_COMMUNITY_STORAGE_DIR, environment.AIHUB_COMMUNITY_ASSETS_DIR,
    environment.AIHUB_SECRET_DIR, environment.AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR,
    CONTROL, BACKUPS, EVIDENCE
  ]) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  must(result("/usr/bin/chown", ["-R", "1000:1000", FIXTURE, CONTROL, BACKUPS]), "filesystem-owner");
  for (const directory of [environment.AIHUB_SECRET_DIR, environment.AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR]) fs.chmodSync(directory, 0o700);
  fs.chmodSync(environment.AIHUB_ADMIN_PUBLISHED_DIR, 0o755);
  fs.chownSync(environment.AIHUB_ADMIN_PUBLISHED_DIR, 1000, 1000);
  const secretNames = [
    "identity_db_password", "forum_db_password", "forum_db_root_password", "forum_admin_password",
    "forum_api_key", "forum_password_token", "community_internal", "community_management", "community_cms_gateway"
  ];
  for (const name of secretNames) {
    const body = exactHexSecret();
    secretValues.push(body);
    writePrivate(path.join(environment.AIHUB_SECRET_DIR, name), name === "forum_api_key" ? `${body}\n` : body);
  }
  const review = exactHexSecret();
  secretValues.push(review);
  writePrivate(path.join(environment.AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR, "workflow_review_secret"), review);
  const state = path.join(environment.AIHUB_ADMIN_PUBLISHED_DIR, "catalog-store", "state.json");
  fs.copyFileSync(`${FIXTURE}/active6-state.json`, state);
  fs.chownSync(state, 1000, 1000);
  fs.chmodSync(state, 0o600);
  const exports = Object.entries(environment).map(([name, value]) => `export ${name}=${JSON.stringify(value)}`).join("\n") + "\n";
  writePrivate(`${CONTROL}/environment.sh`, exports);
}

function loadImages() {
  for (const image of [...OFFICIAL_IMAGES, ...CUSTOM_IMAGES]) {
    must(docker(["load", "-i", image.archive]), "image-load");
    const inspect = JSON.parse(must(docker(["image", "inspect", image.ref]), "image-inspect").stdout)[0];
    assert.equal(inspect.Id, image.id);
  }
}

async function waitHealthy(services, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = compose("target", ["ps", "--format", "json"]);
    if (value.status === 0) {
      const rows = value.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
      if (services.every((service) => rows.some((row) => row.Service === service && row.Health === "healthy"))) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Object.assign(new Error("r12 single stack blocked"), { stage: "health" });
}

function createCaddyVolumes(secretValues) {
  for (const volume of [environment.AIHUB_CADDY_DATA_VOLUME, environment.AIHUB_CADDY_CONFIG_VOLUME, environment.AIHUB_CADDY_CMS_SECRET_VOLUME]) {
    must(docker(["volume", "create", volume]), "caddy-volume");
  }
  const cms = fs.readFileSync(path.join(environment.AIHUB_SECRET_DIR, "community_cms_gateway"), "utf8");
  must(docker([
    "run", "--rm", "-i", "--network", "none", "--user", "0:0",
    "-v", `${environment.AIHUB_CADDY_CMS_SECRET_VOLUME}:/target`, "--entrypoint", "sh",
    OFFICIAL_IMAGES[2].ref, "-ec",
    "umask 077; IFS= read -r value; printf %s \"$value\" > /target/community_cms_gateway; chown 0:0 /target/community_cms_gateway; chmod 0400 /target/community_cms_gateway"
  ], { input: `${cms}\n`, env: targetEnvironment() }), "caddy-secret-seed");
  assert.equal(secretValues.includes(cms), true);
}

async function installCaddyTrust() {
  const deadline = Date.now() + 60_000;
  let certificate;
  while (Date.now() < deadline) {
    const value = docker([
      "run", "--rm", "--network", "none", "-v", `${environment.AIHUB_CADDY_DATA_VOLUME}:/source:ro`,
      "--entrypoint", "sh", OFFICIAL_IMAGES[2].ref, "-ec", "cat /source/caddy/pki/authorities/local/root.crt"
    ]);
    if (value.status === 0 && value.stdout.includes("BEGIN CERTIFICATE")) { certificate = value.stdout; break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(typeof certificate, "string");
  fs.writeFileSync("/usr/local/share/ca-certificates/aihub-r12-local.crt", certificate, { mode: 0o644 });
  must(result("/usr/sbin/update-ca-certificates", []), "caddy-ca-trust");
}

function queryPostgres(sql) {
  const container = "zhenxing-community-production-identity-database-1";
  const program = 'PGPASSWORD="$(cat /run/secrets/identity_db_password)" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U aihub -d aihub -At -c "$1"';
  return must(docker(["exec", container, "/bin/sh", "-ec", program, "r12-acceptance", sql]), "postgres-read").stdout.trim();
}
function queryMaria(sql) {
  const container = "zhenxing-community-production-community-database-1";
  const program = 'MYSQL_PWD="$(cat /run/secrets/forum_db_password)" exec mariadb -u aihub_forum -N -B aihub_forum -e "$1"';
  return must(docker(["exec", container, "sh", "-ec", program, "r12-acceptance", sql]), "mariadb-read").stdout.trim();
}
function authoritativeSnapshot() {
  const postgres = queryPostgres("BEGIN READ ONLY; SELECT json_build_object('events',(SELECT count(*) FROM community_workflow.events),'idempotency',(SELECT count(*) FROM community_workflow.idempotency),'head',(SELECT last_sequence FROM community_workflow.event_head WHERE singleton=true),'eventRows',(SELECT json_agg(e ORDER BY sequence) FROM community_workflow.events e),'idempotencyRows',(SELECT json_agg(i ORDER BY event_sequence) FROM community_workflow.idempotency i),'reviewer',(SELECT count(*) FROM users WHERE identity_kind='workflow-reviewer-service'),'publisher',(SELECT count(*) FROM users WHERE identity_kind='workflow-official-publisher-service'))::text; COMMIT;");
  const maria = queryMaria("START TRANSACTION READ ONLY; SELECT CONCAT((SELECT COUNT(*) FROM discussions WHERE title LIKE '% [AIHUBWFOS%V1]'),'|',(SELECT COUNT(*) FROM posts WHERE content LIKE '%AIHUBWFOS%V1%')); COMMIT");
  const resources = queryPostgres("BEGIN READ ONLY; SELECT COUNT(*) FROM pg_class WHERE relname IN ('resource_submissions','resource_submission_idempotency','resource_submission_audit','resource_submission_source_revisions','resource_submission_abuse_reports'); COMMIT;");
  const pg = JSON.parse(postgres.split(/\r?\n/).find((line) => line.startsWith("{")) || "null");
  return Object.freeze({
    events: Number(pg.events),
    idempotency: Number(pg.idempotency),
    head: Number(pg.head),
    sourcePosts: Number(maria.split("|")[0]),
    sourcePostRows: Number(maria.split("|")[1]),
    reviewer: Number(pg.reviewer),
    publisher: Number(pg.publisher),
    resourceTables: Number(resources.split(/\r?\n/).find((line) => /^\d+$/.test(line)) || "-1"),
    digest: sha256(Buffer.from(JSON.stringify({ pg, maria }), "utf8"))
  });
}

function containerIds() {
  const names = ["identity-database", "community-database", "community", "caddy"];
  return Object.fromEntries(names.map((service) => {
    const inspect = JSON.parse(must(docker(["inspect", `${PROJECT}-${service}-1`]), "container-inspect").stdout)[0];
    return [service, inspect.Id];
  }));
}

function rotateEvidence(label) {
  const activation = `${CONTROL}/catalog-activation-backup`;
  if (fs.existsSync(activation)) fs.renameSync(activation, `${BACKUPS}/r12-${label}-catalog-activation-backup`);
  const pointer = `${CONTROL}/verified-backup-path`;
  if (fs.existsSync(pointer)) {
    const backup = fs.readFileSync(pointer, "utf8").trim();
    if (backup.startsWith(`${BACKUPS}/community-production-`) && fs.existsSync(backup)) fs.renameSync(backup, `${BACKUPS}/r12-${label}-verified-backup`);
  }
  if (fs.existsSync(EVIDENCE)) fs.renameSync(EVIDENCE, `${BACKUPS}/r12-${label}-evidence`);
  fs.mkdirSync(EVIDENCE, { mode: 0o700 });
  fs.chownSync(EVIDENCE, 1000, 1000);
}

function loadModules() {
  const local = (relative) => require(path.join(RELEASE, relative));
  return Object.freeze({
    coordinator: local("deployment/community-production/workflow-production-r12-prepared-coordinator.cjs"),
    bundle: local("deployment/community-production/workflow-production-release-bundle.cjs"),
    existing: local("deployment/community-production/workflow-production-existing-state.cjs"),
    collectorModule: local("deployment/community-production/workflow-production-r12-fixed-collector.cjs"),
    runnerModule: local("deployment/community-production/workflow-production-r12-fixed-runner.cjs")
  });
}

function coordinatorOptions(modules, collector, runner) {
  return {
    releaseRoot: RELEASE,
    execPath: process.execPath,
    env: process.env,
    platform: "linux",
    realpath: fs.realpathSync,
    lstat: fs.lstatSync,
    loadSameRelease() { return { bundle: modules.bundle, existing: modules.existing }; },
    collector,
    runner
  };
}

async function runFailure(modules, operation) {
  const collector = modules.collectorModule.createR12FixedCollector({ releaseRoot: RELEASE });
  const fixedRunner = modules.runnerModule.createRuntimeR12FixedRunner(RELEASE);
  const runner = operation === "target-verification" ? fixedRunner : Object.freeze({
    async run(current) {
      await fixedRunner.run(current);
      if (current === operation) throw new Error("deliberate runner-owned failure");
    },
    rollback(...args) { return fixedRunner.rollback(...args); }
  });
  const selectedCollector = operation === "target-verification" ? Object.freeze({
    baseline: (...args) => collector.baseline(...args),
    async target(...args) { await collector.target(...args); throw new Error("deliberate runner-owned failure"); }
  }) : collector;
  let fixed;
  try {
    await modules.coordinator.createR12PreparedCoordinator(coordinatorOptions(modules, selectedCollector, runner)).run();
  } catch (error) { fixed = error.failure; }
  assert.deepEqual(fixed, { stage: EXPECTED_STAGE[operation], code: "R12_STEP_FAILED" });
  await collector.baseline();
  return Object.freeze({ operation, stage: fixed.stage, rollbackExact: true });
}

async function main() {
  let currentStage = "prepared-context";
  const secretValues = [];
  const report = {
    schema: "aihub-workflow-production-r12-single-stack-v1",
    candidateOnly: true,
    deployable: false,
    serverConnected: false,
    status: "blocked",
    checks: {},
    failureMatrix: [],
    cleanup: { completed: false }
  };
  try {
    const modules = loadModules();
    modules.bundle.verifyPreparedRelease(RELEASE);
    installProcessFixtures();
    prepareFilesystem(secretValues);
    loadImages();
    createCaddyVolumes(secretValues);

    currentStage = "baseline-seed";
    must(compose("target", ["config", "--format", "json"]), "target-compose-config");
    must(compose("target", ["up", "-d", "--no-build", "--pull", "never", "identity-database", "community-database", "admin"]), "seed-base-services");
    must(compose("target", ["--profile", "migration", "run", "--rm", "--no-deps", "identity-migrate"]), "identity-migration");
    must(compose("target", ["--profile", "migration", "run", "--rm", "--no-deps", "community-migrate"]), "flarum-migration");
    must(compose("target", ["--profile", "workflow-migration", "run", "--rm", "--no-deps", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=apply", "workflow-migrate"]), "workflow-migration-apply");
    must(compose("target", ["--profile", "workflow-migration", "run", "--rm", "--no-deps", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=verify", "workflow-migrate"]), "workflow-migration-verify");
    must(compose("target", ["--profile", "workflow-reviewer-provision", "run", "--rm", "-T", "--no-deps", "workflow-reviewer-provision"], { input: "commit\n" }), "reviewer-provision");
    must(compose("target", ["up", "-d", "--no-build", "--pull", "never", "identity", "community", "caddy"]), "seed-runtime-services");
    await waitHealthy(["admin", "identity-database", "identity", "community-database", "community", "caddy"]);
    await installCaddyTrust();
    const seedEvidence = `${BACKUPS}/r12-retained-seed`;
    fs.mkdirSync(seedEvidence, { mode: 0o700 });
    must(result(NODE, ["--use-system-ca", `${DEPLOYMENT}/workflow-official-bootstrap-production-wrapper.cjs`, seedEvidence, "http://127.0.0.1:4173", environment.AIHUB_PUBLIC_HOST, BASE, TARGET], { env: targetEnvironment(), timeout: 300_000 }), "official-bootstrap-seed");
    const seeded = authoritativeSnapshot();
    assert.deepEqual({ events: seeded.events, idempotency: seeded.idempotency, head: seeded.head, sourcePosts: seeded.sourcePosts, reviewer: seeded.reviewer, publisher: seeded.publisher, resourceTables: seeded.resourceTables }, { events: 9, idempotency: 9, head: 9, sourcePosts: 3, reviewer: 1, publisher: 1, resourceTables: 0 });

    currentStage = "disabled-retained-baseline";
    const state = path.join(environment.AIHUB_ADMIN_PUBLISHED_DIR, "catalog-store", "state.json");
    fs.copyFileSync(`${FIXTURE}/active6-state.json`, state);
    fs.chownSync(state, 1000, 1000);
    fs.chmodSync(state, 0o600);
    must(compose("baseline", ["up", "-d", "--no-deps", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "90", "admin"]), "baseline-admin");
    must(compose("baseline", ["up", "-d", "--no-deps", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "90", "identity"]), "baseline-identity");
    await waitHealthy(["admin", "identity-database", "identity", "community-database", "community", "caddy"]);
    const untouchedBefore = containerIds();
    const baseline = authoritativeSnapshot();
    assert.equal(baseline.digest, seeded.digest);
    const collector = modules.collectorModule.createR12FixedCollector({ releaseRoot: RELEASE });
    await collector.baseline();
    report.checks.baseline = { events: 9, idempotency: 9, eventHead: 9, sourcePosts: 3, reviewer: 1, publisher: 1, resourceTablesAbsent: true };

    currentStage = "failure-matrix";
    for (const operation of FIXED_FAILURES) {
      report.failureMatrix.push(await runFailure(modules, operation));
      const afterFailure = authoritativeSnapshot();
      assert.equal(afterFailure.digest, baseline.digest);
      assert.deepEqual(containerIds(), untouchedBefore);
      rotateEvidence(operation.replaceAll(":", "-"));
    }

    currentStage = "success";
    const successCollector = modules.collectorModule.createR12FixedCollector({ releaseRoot: RELEASE });
    const successRunner = modules.runnerModule.createRuntimeR12FixedRunner(RELEASE);
    const success = await modules.coordinator.createR12PreparedCoordinator(coordinatorOptions(modules, successCollector, successRunner)).run();
    assert.equal(success.status, "pass");
    assert.equal(success.projectCount, 1);
    assert.equal(success.bootstrapReplayZero, true);
    const target = authoritativeSnapshot();
    assert.equal(target.digest, baseline.digest);
    assert.deepEqual(containerIds(), untouchedBefore);
    const targetReceipt = await successCollector.target();
    assert.equal(targetReceipt.publicWorkflowCount, 3);
    assert.deepEqual(targetReceipt.resourceSubmissionTables, []);
    const projectServices = must(docker(["ps", "--all", "--filter", `label=com.docker.compose.project=${PROJECT}`, "--format", "{{.Label \"com.docker.compose.service\"}}"]), "project-services").stdout.trim().split(/\r?\n/).filter(Boolean).sort();
    assert.deepEqual(projectServices, ["admin", "caddy", "community", "community-database", "identity", "identity-database"]);
    const logs = must(compose("target", ["logs", "--no-color"]), "secret-scan-logs");
    assert.equal(secretValues.some((value) => `${logs.stdout}${logs.stderr}`.includes(value)), false);
    report.checks = {
      ...report.checks,
      target: { events: 9, idempotency: 9, eventHead: 9, sourcePosts: 3, publicWorkflows: 3, resourceTablesAbsent: true, bootstrapReplayZero: true },
      failureBoundaries: FIXED_FAILURES.length,
      projectCount: 1,
      longRunningServices: 6,
      maxConcurrentOneShot: 1,
      untouchedContainerIdsExact: true,
      authoritativeDataDigestUnchanged: true,
      secretValueHits: 0
    };
    report.status = "pass";
  } catch {
    report.failure = { stage: currentStage, code: "R12_SINGLE_STACK_GATE_FAILED" };
    process.exitCode = 1;
  } finally {
    report.cleanup = { completed: false, delegatedToOuterRunner: true };
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  assert.equal(report.status, "pass", `r12 single stack blocked at ${report.failure?.stage || "unknown"}`);
}

main().catch(() => { process.exitCode = 1; });

