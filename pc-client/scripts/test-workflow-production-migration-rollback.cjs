"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const runner = path.join(deployment, "run-workflow-production-migration.sh");
const image = process.argv[2] || "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392";
if (!/^zhenxing-ai\/identity:[a-z0-9][a-z0-9._-]{0,127}$/i.test(image)) throw new Error("candidate Identity image name is invalid");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-rollback-"));
const backup = path.join(temporary, "backup");
const secret = path.join(temporary, "identity-db-password");
const compose = path.join(temporary, "compose.yaml");
const schema = path.join(root, "identity", "schema.sql").replaceAll("\\", "/");
const password = "isolated-workflow-rollback-password-0123456789";
const bash = process.env.AIHUB_BASH || (process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  return { status: result.status, output: `${result.stdout || ""}${result.stderr || ""}` };
}

function dockerCompose(args) {
  return run("docker", ["compose", "-f", compose, ...args]);
}

function bashPath(nativePath) {
  if (process.platform !== "win32") return nativePath;
  const result = run(bash, ["-lc", `cygpath -u '${nativePath.replaceAll("'", "'\\''")}'`]);
  must(result, "convert path for Git Bash");
  return result.output.trim();
}

function must(result, description) {
  assert.equal(result.status, 0, `${description}: ${result.output.slice(0, 1000)}`);
}

function writeBackup() {
  fs.mkdirSync(backup);
  for (const name of ["identity.pgdump", "community.sql"]) fs.writeFileSync(path.join(backup, name), "isolated placeholder\n");
  const sums = ["identity.pgdump", "community.sql"].map((name) => {
    const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(backup, name))).digest("hex");
    return `${digest}  ${name}`;
  });
  fs.writeFileSync(path.join(backup, "SHA256SUMS"), `${sums.join("\n")}\n`);
}

function writeCompose() {
  fs.writeFileSync(secret, password, { mode: 0o600 });
  fs.writeFileSync(compose, `services:\n  identity-database:\n    image: postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193\n    environment:\n      POSTGRES_DB: aihub\n      POSTGRES_USER: aihub\n      POSTGRES_PASSWORD_FILE: /run/secrets/identity_db_password\n    volumes:\n      - identity_database:/var/lib/postgresql/data\n      - ${schema}:/docker-entrypoint-initdb.d/001-schema.sql:ro\n    secrets: [identity_db_password]\n    healthcheck:\n      test: [\"CMD-SHELL\", \"pg_isready -h 127.0.0.1 -U aihub -d aihub\"]\n      interval: 1s\n      timeout: 3s\n      retries: 20\n  workflow-migrate:\n    image: ${image}\n    profiles: [\"workflow-migration\"]\n    environment:\n      AIHUB_IDENTITY_DATABASE_PASSWORD_FILE: /run/secrets/identity_db_password\n      AIHUB_IDENTITY_SCHEMA_MODE: external\n      AIHUB_WORKFLOW_MIGRATION_MODE: verify\n    secrets: [identity_db_password]\n    depends_on:\n      identity-database: { condition: service_healthy }\n    restart: \"no\"\n    read_only: true\n    tmpfs: [\"/tmp\"]\nsecrets:\n  identity_db_password:\n    file: ${secret.replaceAll("\\", "/")}\nvolumes:\n  identity_database:\n`);
}

function wrapper(action) {
  return run(bash, [bashPath(runner), bashPath(compose), bashPath(path.join(temporary, "unused-overlay.yaml")), bashPath(backup), action]);
}

try {
  assert.equal(run("docker", ["image", "inspect", image]).status, 0, "candidate Identity image must be present");
  writeBackup();
  writeCompose();
  fs.writeFileSync(path.join(temporary, "unused-overlay.yaml"), "services: {}\n");
  must(dockerCompose(["up", "-d", "--wait", "identity-database"]), "start isolated PostgreSQL");

  const preApply = wrapper("rollback");
  must(preApply, "pre-apply rollback must be a safe no-op");
  assert.match(preApply.output, /migration was not applied; rollback is a no-op/);

  must(wrapper("apply"), "apply");
  must(wrapper("verify"), "verify");
  must(wrapper("rollback"), "zero-event production wrapper rollback");
  const absent = dockerCompose(["exec", "-T", "identity-database", "psql", "-U", "aihub", "-d", "aihub", "-Atqc", "SELECT to_regclass('community_workflow.events')"]);
  must(absent, "verify schema absence");
  assert.equal(absent.output.trim(), "");

  must(wrapper("apply"), "reapply");
  const insert = dockerCompose(["exec", "-T", "identity-database", "psql", "-U", "aihub", "-d", "aihub", "-v", "ON_ERROR_STOP=1", "-c", "INSERT INTO users (id, email, normalized_email, username, normalized_username, community_username, password_hash) VALUES ('11111111-1111-4111-8111-111111111111', 'rollback@example.test', 'rollback@example.test', 'rollback', 'rollback', 'zx_111111111111411181111111111', 'not-a-real-credential'); INSERT INTO community_workflow.events (sequence, operation, actor_identity_id, event_data, created_at) VALUES (1, 'createDraft', '11111111-1111-4111-8111-111111111111', '{}'::jsonb, now());"]);
  must(insert, "write a foreign-key-valid Workflow event");
  const refused = wrapper("rollback");
  assert.notEqual(refused.status, 0, "written events must refuse schema rollback");
  assert.match(refused.output, /refuses rollback after Workflow events/);
  const retained = dockerCompose(["exec", "-T", "identity-database", "psql", "-U", "aihub", "-d", "aihub", "-Atqc", "SELECT count(*) FROM community_workflow.events"]);
  must(retained, "verify retained Workflow event");
  assert.equal(retained.output.trim(), "1");
  process.stdout.write(JSON.stringify({ ok: true, preApplyNoop: true, zeroEventRollback: true, writtenEventRefused: true }) + "\n");
} finally {
  dockerCompose(["down", "--remove-orphans", "--volumes"]);
  fs.rmSync(temporary, { recursive: true, force: true });
}
