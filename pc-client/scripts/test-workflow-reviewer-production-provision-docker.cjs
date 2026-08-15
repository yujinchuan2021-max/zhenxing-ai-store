"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const root = path.resolve(__dirname, "..");
const image = "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392";
const suffix = crypto.randomBytes(6).toString("hex");
const network = `aihub-workflow-reviewer-provision-${suffix}`;
const database = `aihub-workflow-reviewer-db-${suffix}`;
const secrets = `aihub-workflow-reviewer-secrets-${suffix}`;
const password = crypto.randomBytes(32).toString("hex");

function docker(args, options = {}) {
  const result = spawnSync("docker", args, { cwd: root, encoding: "utf8", windowsHide: true, ...options });
  if (!options.allowFailure) assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr || result.stdout}`);
  return result;
}

function psql(statement, input) {
  const args = ["exec", "-i", database, "psql", "-v", "ON_ERROR_STOP=1", "-U", "aihub", "-d", "aihub", "-Atq"];
  if (statement) args.push("-c", statement);
  return docker(args, { input }).stdout.trim();
}

async function waitDatabase() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const ready = docker(["exec", database, "psql", "-U", "aihub", "-d", "aihub", "-Atqc", "SELECT 1"], { allowFailure: true });
    if (ready.status === 0 && ready.stdout.trim() === "1") return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("isolated reviewer database did not become ready");
}

async function resetDatabase() {
  docker(["rm", "-f", database], { allowFailure: true });
  docker([
    "run", "-d", "--rm", "--name", database, "--network", network, "--network-alias", "identity-database",
    "-e", "POSTGRES_DB=aihub", "-e", "POSTGRES_USER=aihub", "-e", `POSTGRES_PASSWORD=${password}`,
    "postgres:17-alpine"
  ]);
  await waitDatabase();
  psql("", fs.readFileSync(path.join(root, "identity", "schema.sql"), "utf8"));
}

async function provision(control, beforeControl) {
  const child = spawn("docker", [
    "run", "--rm", "-i", "--network", network,
    "-e", "AIHUB_IDENTITY_DATABASE_PASSWORD_FILE=/run/secrets/identity_db_password",
    "-e", "AIHUB_IDENTITY_SCHEMA_MODE=external",
    "-e", "AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE=hold",
    "-e", "AIHUB_WORKFLOW_REVIEW_SECRET_FILE=/run/secrets/workflow_review_secret",
    "-v", `${secrets}:/run/secrets:ro`, image
  ], { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const first = JSON.parse(await once(lines, "line").then(([line]) => line));
  assert.equal(first.phase, "ready");
  await beforeControl?.(first);
  child.stdin.end(`${control}\n`);
  const output = [];
  lines.on("line", (line) => output.push(JSON.parse(line)));
  const [code] = await once(child, "close");
  assert.equal(stderr.includes(password), false);
  assert.equal(stderr.includes("r".repeat(64)), false);
  return { code, first, output, stderr };
}

function preflight(allowFailure = false) {
  const result = docker([
    "run", "--rm", "--network", network,
    "-e", "AIHUB_IDENTITY_DATABASE_PASSWORD_FILE=/run/secrets/identity_db_password",
    "-e", "AIHUB_IDENTITY_SCHEMA_MODE=external",
    "-e", "AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE=preflight",
    "-e", "AIHUB_WORKFLOW_REVIEW_SECRET_FILE=/run/secrets/workflow_review_secret",
    "-v", `${secrets}:/run/secrets:ro`, image
  ], { allowFailure });
  assert.equal(`${result.stdout}${result.stderr}`.includes(password), false);
  return result;
}

async function main() {
  const result = { candidateOnly: true, image, checks: {} };
  try {
    docker(["network", "create", network]);
    docker(["volume", "create", secrets]);
    docker([
      "run", "--rm", "-i", "--user", "0:0", "-v", `${secrets}:/run/secrets`, "node:24-alpine",
      "sh", "-ec",
      "umask 077; IFS= read -r db; IFS= read -r review; printf %s \"$db\" > /run/secrets/identity_db_password; printf %s \"$review\" > /run/secrets/workflow_review_secret; chown 1000:1000 /run/secrets/*; chmod 0400 /run/secrets/*"
    ], { input: `${password}\n${"r".repeat(64)}\n` });

    await resetDatabase();
    const emptyPreflight = JSON.parse(preflight().stdout);
    assert.deepEqual(emptyPreflight, {
      phase: "preflight",
      provisionable: true,
      identityMigrationPresent: false,
      identityPresent: false,
      workflowMigrationPresent: false
    });
    psql(`INSERT INTO public.users
      (id, email, normalized_email, username, normalized_username, community_username, password_hash)
      VALUES ('5f16d5ac-6663-5905-b920-c2140ac6769c', 'conflict@example.invalid', 'conflict@example.invalid',
              'conflict', 'conflict', 'zx_5f16d5ac66635905b920c2140ac', 'not-a-password')`);
    const conflict = preflight(true);
    assert.notEqual(conflict.status, 0);
    assert.match(conflict.stderr, /WORKFLOW_REVIEWER_SERVICE_IDENTITY_CONFLICT/);
    psql("DELETE FROM public.users WHERE id='5f16d5ac-6663-5905-b920-c2140ac6769c'");
    result.checks.readOnlyPreflight = true;

    const rolledBack = await provision("rollback");
    assert.equal(rolledBack.code, 0, rolledBack.stderr);
    assert.deepEqual(rolledBack.output, [{ phase: "rolled-back" }]);
    assert.equal(psql("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='identity_kind')"), "f");
    assert.equal(psql("SELECT to_regclass('community_workflow.events') IS NULL"), "t");
    result.checks.zeroEventRollback = true;

    const committed = await provision("commit");
    assert.equal(committed.code, 0, committed.stderr);
    assert.deepEqual(committed.output, [{ phase: "committed" }]);
    assert.equal(psql("SELECT identity_kind || ':' || status FROM public.users WHERE id='5f16d5ac-6663-5905-b920-c2140ac6769c'"), "workflow-reviewer-service:disabled");
    assert.equal(psql("SELECT to_regclass('community_workflow.events') IS NOT NULL"), "t");
    result.checks.commit = true;

    await resetDatabase();
    const retained = await provision("rollback", async () => {
      psql(`INSERT INTO community_workflow.events (sequence, operation, actor_identity_id, event_data, created_at)
            VALUES (1, 'reviewSubmission', '5f16d5ac-6663-5905-b920-c2140ac6769c', '{}'::jsonb, now());
            INSERT INTO community_workflow.idempotency (actor_identity_id, key_hash, request_hash, response, event_sequence)
            VALUES ('5f16d5ac-6663-5905-b920-c2140ac6769c', repeat('a',64), repeat('b',64), '{}'::jsonb, 1);`);
    });
    assert.notEqual(retained.code, 0);
    assert.match(retained.stderr, /WORKFLOW_REVIEWER_SERVICE_IDENTITY_RETENTION_REQUIRED/);
    assert.equal(psql("SELECT count(*) FROM community_workflow.events"), "1");
    assert.equal(psql("SELECT count(*) FROM public.users WHERE id='5f16d5ac-6663-5905-b920-c2140ac6769c'"), "1");
    result.checks.writtenEventRetention = true;
    result.ok = true;
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    docker(["rm", "-f", database], { allowFailure: true });
    docker(["volume", "rm", secrets], { allowFailure: true });
    docker(["network", "rm", network], { allowFailure: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.name}: ${error.message}\n`);
  process.exitCode = 1;
});
