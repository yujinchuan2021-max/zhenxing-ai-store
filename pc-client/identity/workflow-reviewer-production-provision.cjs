"use strict";

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { Pool } = require("pg");
const {
  provisionWorkflowReviewerServiceIdentity,
  rollbackProvisionedWorkflowReviewerServiceIdentity,
  verifyWorkflowReviewerServiceIdentity,
  workflowReviewerServiceIdentityRecord
} = require("./workflow-reviewer-service-identity.cjs");

const CONTROL_TIMEOUT_MS = 30 * 60 * 1000;
const identityMigration = path.resolve(__dirname, "migrations/candidates/0002-workflow-reviewer-service-identity.sql");
const identityRollback = path.resolve(__dirname, "migrations/candidates/0002-workflow-reviewer-service-identity.rollback.sql");
const workflowMigrations = path.resolve(__dirname, "../community/migrations/candidates");

function contractError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function validateReviewerSecret(secretFile) {
  if (secretFile !== "/run/secrets/workflow_review_secret") {
    throw contractError("WORKFLOW_REVIEWER_SECRET_PATH_INVALID");
  }
  const value = fs.readFileSync(secretFile);
  if (value.length < 32 || value.length > 512 || [...value].some((byte) => byte < 0x20 || byte > 0x7e)) {
    throw contractError("WORKFLOW_REVIEWER_SECRET_INVALID");
  }
}

async function identityMigrationState(pool) {
  const result = await pool.query(
    `SELECT
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'identity_kind') AS identity_kind,
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_identity_kind_contract') AS identity_contract,
       to_regprocedure('public.reject_workflow_reviewer_service_browser_relation()') IS NOT NULL AS guard_function,
       (SELECT count(*)::int FROM pg_trigger
         WHERE tgname LIKE 'reject_workflow_reviewer_service_%' AND NOT tgisinternal) AS guard_triggers`
  );
  const row = result.rows[0] || {};
  const values = [row.identity_kind === true, row.identity_contract === true, row.guard_function === true, Number(row.guard_triggers) === 6];
  if (values.every(Boolean)) return "applied";
  if (values.every((value) => !value)) return "absent";
  throw contractError("WORKFLOW_REVIEWER_IDENTITY_SCHEMA_PARTIAL");
}

async function workflowMigrationState(pool) {
  const result = await pool.query(
    `SELECT
       to_regclass('community_workflow.event_head') IS NOT NULL AS event_head,
       to_regclass('community_workflow.events') IS NOT NULL AS events,
       to_regclass('community_workflow.idempotency') IS NOT NULL AS idempotency,
       EXISTS (SELECT 1 FROM pg_trigger
                WHERE tgname = 'community_workflow_events_append_only' AND NOT tgisinternal) AS append_only`
  );
  const row = result.rows[0] || {};
  const values = [row.event_head === true, row.events === true, row.idempotency === true, row.append_only === true];
  if (values.every(Boolean)) return "applied";
  if (values.every((value) => !value)) return "absent";
  throw contractError("WORKFLOW_SCHEMA_PARTIAL");
}

async function workflowRecordCount(pool) {
  if (await workflowMigrationState(pool) === "absent") return 0;
  const result = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM community_workflow.events) AS events,
       (SELECT count(*)::int FROM community_workflow.idempotency) AS idempotency`
  );
  return Number(result.rows[0]?.events || 0) + Number(result.rows[0]?.idempotency || 0);
}

async function preflight(pool) {
  const identityState = await identityMigrationState(pool);
  const expected = workflowReviewerServiceIdentityRecord();
  const collisions = await pool.query(
    `SELECT id FROM public.users
      WHERE id = $1 OR username = $2 OR normalized_username = $2 OR community_username = $3`,
    [expected.id, expected.username, expected.communityUsername]
  );
  let identityPresent = false;
  if (collisions.rowCount !== 0) {
    if (identityState !== "applied" || collisions.rowCount !== 1 || collisions.rows[0].id !== expected.id) {
      throw contractError("WORKFLOW_REVIEWER_SERVICE_IDENTITY_CONFLICT");
    }
    await verifyWorkflowReviewerServiceIdentity(pool);
    identityPresent = true;
  }
  const workflowState = await workflowMigrationState(pool);
  return Object.freeze({
    phase: "preflight",
    provisionable: true,
    identityMigrationPresent: identityState === "applied",
    identityPresent,
    workflowMigrationPresent: workflowState === "applied"
  });
}

async function prepare(pool) {
  validateReviewerSecret(process.env.AIHUB_WORKFLOW_REVIEW_SECRET_FILE || "");
  const identityState = await identityMigrationState(pool);
  const identityMigrationCreated = identityState === "absent";
  if (identityMigrationCreated) await pool.query(fs.readFileSync(identityMigration, "utf8"));

  let provision;
  let workflowMigrationCreated = false;
  try {
    provision = await provisionWorkflowReviewerServiceIdentity(pool);
    await verifyWorkflowReviewerServiceIdentity(pool);
    const workflowState = await workflowMigrationState(pool);
    workflowMigrationCreated = workflowState === "absent";
    if (workflowMigrationCreated) {
      await pool.query(fs.readFileSync(path.join(workflowMigrations, "0001-workflow-store.sql"), "utf8"));
    }
    if (await workflowMigrationState(pool) !== "applied") throw contractError("WORKFLOW_SCHEMA_VERIFY_FAILED");
    return { identityMigrationCreated, provision, workflowMigrationCreated };
  } catch (error) {
    await rollback(pool, { identityMigrationCreated, provision, workflowMigrationCreated }).catch(() => {});
    throw error;
  }
}

async function rollback(pool, state) {
  if (await workflowRecordCount(pool) !== 0) {
    throw contractError("WORKFLOW_REVIEWER_SERVICE_IDENTITY_RETENTION_REQUIRED");
  }
  if (state.workflowMigrationCreated && await workflowMigrationState(pool) === "applied") {
    await pool.query(fs.readFileSync(path.join(workflowMigrations, "0001-workflow-store.rollback.sql"), "utf8"));
  }
  if (state.provision?.receipt) {
    await rollbackProvisionedWorkflowReviewerServiceIdentity(pool, state.provision.receipt);
  }
  if (state.identityMigrationCreated && await identityMigrationState(pool) === "applied") {
    await pool.query(fs.readFileSync(identityRollback, "utf8"));
  }
}

function readControl() {
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let rejectSignal;
  let timeout;
  const signal = new Promise((_, reject) => { rejectSignal = reject; });
  const interrupt = () => rejectSignal(contractError("WORKFLOW_REVIEWER_CONTROL_INTERRUPTED"));
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  return Promise.race([
    new Promise((resolve, reject) => {
      lines.once("line", resolve);
      lines.once("close", () => reject(contractError("WORKFLOW_REVIEWER_CONTROL_CLOSED")));
    }),
    new Promise((_, reject) => { timeout = setTimeout(() => reject(contractError("WORKFLOW_REVIEWER_CONTROL_TIMEOUT")), CONTROL_TIMEOUT_MS); }),
    signal
  ]).finally(() => {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    clearTimeout(timeout);
    lines.close();
  });
}

async function run() {
  const databaseUrl = process.env.AIHUB_IDENTITY_DATABASE_URL;
  if (!databaseUrl) throw contractError("WORKFLOW_REVIEWER_DATABASE_UNAVAILABLE");
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  let state;
  try {
    if (process.env.AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE === "preflight") {
      process.stdout.write(`${JSON.stringify(await preflight(pool))}\n`);
      return;
    }
    if (process.env.AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE !== "hold") {
      throw contractError("WORKFLOW_REVIEWER_PROVISION_MODE_INVALID");
    }
    state = await prepare(pool);
    process.stdout.write(`${JSON.stringify({ phase: "ready", identityCreated: state.provision.created, identityMigrationCreated: state.identityMigrationCreated, workflowMigrationCreated: state.workflowMigrationCreated })}\n`);
    const control = await readControl();
    if (control === "commit") {
      await verifyWorkflowReviewerServiceIdentity(pool);
      if (await workflowMigrationState(pool) !== "applied") throw contractError("WORKFLOW_SCHEMA_VERIFY_FAILED");
      process.stdout.write(`${JSON.stringify({ phase: "committed" })}\n`);
      return;
    }
    if (control !== "rollback") throw contractError("WORKFLOW_REVIEWER_CONTROL_INVALID");
    await rollback(pool, state);
    process.stdout.write(`${JSON.stringify({ phase: "rolled-back" })}\n`);
  } catch (error) {
    if (state) await rollback(pool, state).catch(() => {});
    process.stderr.write(`Workflow reviewer production provision failed: ${error.code || "FAILED"}\n`);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

if (require.main === module) run();

module.exports = {
  CONTROL_TIMEOUT_MS,
  identityMigrationState,
  preflight,
  prepare,
  rollback,
  validateReviewerSecret,
  workflowMigrationState,
  workflowRecordCount
};
