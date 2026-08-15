"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const { Pool } = createRequire(path.join(root, "identity", "package.json"))("pg");
const {
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
  provisionWorkflowOfficialPublisherIdentity,
  resolveWorkflowOfficialPublisherPublicIdentity,
  rollbackProvisionedWorkflowOfficialPublisherIdentity,
  verifyWorkflowOfficialPublisherIdentity
} = require("../identity/workflow-official-publisher-service-identity.cjs");

const runId = crypto.randomBytes(8).toString("hex");
const container = `aihub-workflow-publisher-identity-${runId}`;
const network = `aihub-workflow-publisher-network-${runId}`;
const password = crypto.randomBytes(24).toString("base64url");

function docker(args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
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

async function expectsCode(fn, code) {
  await assert.rejects(fn, (error) => error?.code === code);
}

async function expectsRelationshipGuard(pool, statement) {
  await assert.rejects(
    () => pool.query(statement, [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]),
    (error) => /workflow service identities cannot have browser relations/i.test(String(error?.message || ""))
  );
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
    stage = "candidate-migrations";
    await pool.query(sql("identity/schema.sql"));
    await pool.query(sql("identity/migrations/candidates/0002-workflow-reviewer-service-identity.sql"));
    await pool.query(sql("identity/migrations/candidates/0003-workflow-official-publisher-service-identity.sql"));

    stage = "provision-and-verify";
    const first = await provisionWorkflowOfficialPublisherIdentity(pool);
    assert.equal(first.created, true);
    assert.deepEqual(await verifyWorkflowOfficialPublisherIdentity(pool), {
      identityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
    });
    assert.deepEqual(await resolveWorkflowOfficialPublisherPublicIdentity(pool), {
      identityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
      displayName: "枕星 AI"
    });
    const row = await pool.query(
      `SELECT identity_kind, status, email, normalized_email, phone, normalized_phone, password_hash
         FROM public.users WHERE id = $1`,
      [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
    );
    assert.deepEqual(row.rows[0], {
      identity_kind: "workflow-official-publisher-service",
      status: "disabled",
      email: null,
      normalized_email: null,
      phone: null,
      normalized_phone: null,
      password_hash: null
    });
    assert.equal((await pool.query(
      `SELECT count(*)::int AS count FROM public.users u
        JOIN public.community_profiles p ON p.user_id = u.id
       WHERE u.id = $1 AND u.status = 'active'`,
      [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
    )).rows[0].count, 0);

    stage = "relationship-guards";
    for (const statement of [
      "INSERT INTO public.community_profiles (user_id, nickname) VALUES ($1, 'forbidden')",
      "INSERT INTO public.profile_avatars (user_id, mime_type, content) VALUES ($1, 'image/png', decode('00', 'hex'))",
      "INSERT INTO public.devices (user_id, id, name) VALUES ($1, '77777777-7777-4777-8777-777777777777', 'forbidden')",
      "INSERT INTO public.sessions (id, user_id, device_id, access_hash, access_expires_at, refresh_hash, refresh_expires_at) VALUES ('88888888-8888-4888-8888-888888888888', $1, '77777777-7777-4777-8777-777777777777', 'forbidden-access', now(), 'forbidden-refresh', now())",
      "INSERT INTO public.community_handoffs (credential_hash, user_id, audience, expires_at) VALUES ('forbidden-handoff', $1, 'community-browser', now())",
      "INSERT INTO public.email_change_challenges (id, user_id, normalized_email, code_hash, expires_at, created_ip) VALUES ('99999999-9999-4999-8999-999999999999', $1, 'claim@example.invalid', 'forbidden', now(), '127.0.0.1')"
    ]) {
      await expectsRelationshipGuard(pool, statement);
    }
    for (const statement of [
      "UPDATE public.users SET status = 'active' WHERE id = $1",
      "UPDATE public.users SET email = 'claim@example.invalid', normalized_email = 'claim@example.invalid' WHERE id = $1",
      "UPDATE public.users SET password_hash = 'not-a-password' WHERE id = $1"
    ]) {
      await assert.rejects(() => pool.query(statement, [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]));
    }

    stage = "idempotency-and-zero-reference-rollback";
    const repeated = await provisionWorkflowOfficialPublisherIdentity(pool);
    assert.equal(repeated.created, false);
    assert.equal(repeated.receipt, null);
    await expectsCode(
      () => rollbackProvisionedWorkflowOfficialPublisherIdentity(pool, repeated.receipt),
      "WORKFLOW_OFFICIAL_PUBLISHER_ROLLBACK_DENIED"
    );
    assert.deepEqual(await rollbackProvisionedWorkflowOfficialPublisherIdentity(pool, first.receipt), { removed: true });
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM public.users WHERE id = $1",
      [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
    )).rows[0].count, 0);
    await pool.query(sql("identity/migrations/candidates/0003-workflow-official-publisher-service-identity.rollback.sql"));
    await pool.query(sql("identity/migrations/candidates/0003-workflow-official-publisher-service-identity.sql"));

    stage = "conflict";
    await pool.query(
      `INSERT INTO public.users
        (id, email, normalized_email, username, normalized_username, community_username, password_hash)
       VALUES ($1, 'conflict@example.invalid', 'conflict@example.invalid', 'conflict', 'conflict',
               'zx_46564566f5f4599c8ce50609069', 'not-a-password')`,
      [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
    );
    await expectsCode(
      () => provisionWorkflowOfficialPublisherIdentity(pool),
      "WORKFLOW_OFFICIAL_PUBLISHER_IDENTITY_CONFLICT"
    );
    assert.equal(await resolveWorkflowOfficialPublisherPublicIdentity(pool), null);
    await pool.query("DELETE FROM public.users WHERE id = $1", [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]);

    stage = "workflow-reference-retention";
    const retained = await provisionWorkflowOfficialPublisherIdentity(pool);
    await pool.query(sql("community/migrations/candidates/0001-workflow-store.sql"));
    await pool.query(
      `INSERT INTO community_workflow.events (sequence, operation, actor_identity_id, event_data, created_at)
       VALUES (1, 'createDraft', $1, '{}'::jsonb, now())`,
      [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
    );
    await pool.query(
      `INSERT INTO community_workflow.idempotency (actor_identity_id, key_hash, request_hash, response, event_sequence)
       VALUES ($1, repeat('c', 64), repeat('d', 64), '{}'::jsonb, 1)`,
      [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
    );
    await expectsCode(
      () => rollbackProvisionedWorkflowOfficialPublisherIdentity(pool, retained.receipt),
      "WORKFLOW_OFFICIAL_PUBLISHER_RETENTION_REQUIRED"
    );
    await assert.rejects(
      () => pool.query(sql("identity/migrations/candidates/0003-workflow-official-publisher-service-identity.rollback.sql")),
      /must be absent before rollback/i
    );
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM public.users WHERE id = $1",
      [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
    )).rows[0].count, 1);

    process.stdout.write(JSON.stringify({
      ok: true,
      provision: true,
      repeat: true,
      conflict: true,
      sixRelationshipGuards: true,
      zeroReferenceRollback: true,
      retainedAfterWorkflowReferences: true,
      publicProjection: true
    }) + "\n");
  } catch (error) {
    error.workflowOfficialPublisherStage = stage;
    throw error;
  } finally {
    await pool?.end().catch(() => {});
    try { docker(["rm", "-f", container]); } catch {}
    try { docker(["network", "rm", network]); } catch {}
  }
}

main().catch((error) => {
  process.stderr.write(`${error.name}: ${error.workflowOfficialPublisherStage || "unknown"}:${error.code || "FAILED"}\n`);
  process.exitCode = 1;
});

