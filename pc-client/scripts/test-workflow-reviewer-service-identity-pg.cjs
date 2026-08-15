"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync, spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const { Pool } = createRequire(path.join(root, "identity", "package.json"))("pg");
const {
  WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
  WorkflowReviewerServiceIdentityError,
  provisionWorkflowReviewerServiceIdentity,
  rollbackProvisionedWorkflowReviewerServiceIdentity,
  verifyWorkflowReviewerServiceIdentity
} = require("../identity/workflow-reviewer-service-identity.cjs");

const runId = crypto.randomBytes(8).toString("hex");
const container = `aihub-workflow-reviewer-identity-${runId}`;
const network = `aihub-workflow-reviewer-network-${runId}`;
const password = crypto.randomBytes(24).toString("base64url");

function docker(args) {
  return execFileSync("docker", args, { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
}

function sql(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForDatabase(pool) {
  let lastError;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`isolated PostgreSQL did not become ready: ${lastError?.code || "unknown"}`);
}

async function expectsReject(fn, code) {
  await assert.rejects(fn, (error) => error?.code === code);
}

async function main() {
  const port = await freePort();
  let pool;
  let stage = "preflight";
  try {
    stage = "database-start";
    docker(["network", "create", network]);
    docker([
      "run", "-d", "--rm", "--name", container, "--network", network,
      "-e", "POSTGRES_DB=aihub", "-e", "POSTGRES_USER=aihub",
      "-e", `POSTGRES_PASSWORD=${password}`, "-p", `127.0.0.1:${port}:5432`,
      "postgres:17-alpine"
    ]);
    pool = new Pool({ connectionString: `postgres://aihub:${encodeURIComponent(password)}@127.0.0.1:${port}/aihub` });
    stage = "database-ready";
    await waitForDatabase(pool);
    stage = "identity-schema";
    await pool.query(sql("identity/schema.sql"));
    stage = "service-migration";
    await pool.query(sql("identity/migrations/candidates/0002-workflow-reviewer-service-identity.sql"));

    stage = "provision";
    const first = await provisionWorkflowReviewerServiceIdentity(pool);
    assert.equal(first.created, true);
    assert.equal((await verifyWorkflowReviewerServiceIdentity(pool)).identityId, WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID);
    const row = await pool.query("SELECT email, password_hash, status, identity_kind FROM public.users WHERE id = $1", [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]);
    assert.deepEqual(row.rows[0], { email: null, password_hash: null, status: "disabled", identity_kind: "workflow-reviewer-service" });
    for (const statement of [
      "INSERT INTO public.community_profiles (user_id, nickname) VALUES ($1, 'forbidden')",
      "INSERT INTO public.devices (user_id, id, name) VALUES ($1, '77777777-7777-4777-8777-777777777777', 'forbidden')",
      "INSERT INTO public.sessions (id, user_id, device_id, access_hash, access_expires_at, refresh_hash, refresh_expires_at) VALUES ('88888888-8888-4888-8888-888888888888', $1, '77777777-7777-4777-8777-777777777777', 'forbidden-access', now(), 'forbidden-refresh', now())",
      "INSERT INTO public.community_handoffs (credential_hash, user_id, audience, expires_at) VALUES ('forbidden-handoff', $1, 'community-browser', now())"
    ]) {
      await assert.rejects(() => pool.query(statement, [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]));
    }
    const repeated = await provisionWorkflowReviewerServiceIdentity(pool);
    assert.equal(repeated.created, false);
    await expectsReject(
      () => rollbackProvisionedWorkflowReviewerServiceIdentity(pool, repeated.receipt),
      "WORKFLOW_REVIEWER_SERVICE_IDENTITY_ROLLBACK_DENIED"
    );
    assert.deepEqual(await rollbackProvisionedWorkflowReviewerServiceIdentity(pool, first.receipt), { removed: true });
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM public.users WHERE id = $1", [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID])).rows[0].count, 0);

    stage = "conflict";
    await pool.query(
      `INSERT INTO public.users
        (id, email, normalized_email, username, normalized_username, community_username, password_hash)
       VALUES ($1, 'conflict@example.invalid', 'conflict@example.invalid', 'conflict', 'conflict', 'zx_5f16d5ac66635905b920c2140ac', 'not-a-password')`,
      [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]
    );
    await expectsReject(
      () => provisionWorkflowReviewerServiceIdentity(pool),
      "WORKFLOW_REVIEWER_SERVICE_IDENTITY_CONFLICT"
    );
    await pool.query("DELETE FROM public.users WHERE id = $1", [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]);

    stage = "retention";
    const retained = await provisionWorkflowReviewerServiceIdentity(pool);
    await pool.query(sql("community/migrations/candidates/0001-workflow-store.sql"));
    await pool.query(
      `INSERT INTO community_workflow.events (sequence, operation, actor_identity_id, event_data, created_at)
       VALUES (1, 'reviewSubmission', $1, '{}'::jsonb, now())`,
      [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]
    );
    await pool.query(
      `INSERT INTO community_workflow.idempotency (actor_identity_id, key_hash, request_hash, response, event_sequence)
       VALUES ($1, repeat('a', 64), repeat('b', 64), '{}'::jsonb, 1)`,
      [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]
    );
    await expectsReject(
      () => rollbackProvisionedWorkflowReviewerServiceIdentity(pool, retained.receipt),
      "WORKFLOW_REVIEWER_SERVICE_IDENTITY_RETENTION_REQUIRED"
    );
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM public.users WHERE id = $1", [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID])).rows[0].count, 1);
    process.stdout.write(JSON.stringify({ ok: true, provision: true, repeat: true, conflict: true, zeroEventRollback: true, retainedAfterWorkflowReferences: true }) + "\n");
  } catch (error) {
    error.workflowReviewerServiceIdentityStage = stage;
    throw error;
  } finally {
    await pool?.end().catch(() => {});
    try { docker(["rm", "-f", container]); } catch {}
    try { docker(["network", "rm", network]); } catch {}
  }
}

main().catch((error) => {
  process.stderr.write(`${error.name}: ${error.workflowReviewerServiceIdentityStage || "unknown"}:${error.code || "FAILED"}\n`);
  process.exitCode = 1;
});
