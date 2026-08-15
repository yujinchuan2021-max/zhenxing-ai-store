"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const action = String(process.env.AIHUB_WORKFLOW_MIGRATION_MODE || "verify");
if (!["apply", "verify", "rollback"].includes(action)) {
  throw new Error("Workflow migration action must be apply, verify, or rollback");
}

const migrations = path.resolve(__dirname, "../community/migrations/candidates");
const pool = new Pool({ connectionString: process.env.AIHUB_IDENTITY_DATABASE_URL });

async function schemaExists() {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.schemata
        WHERE schema_name = 'community_workflow'
     ) AS present`
  );
  return result.rows[0]?.present === true;
}

async function verifyApplied() {
  const result = await pool.query(
    `SELECT
       to_regclass('community_workflow.event_head') IS NOT NULL AS event_head,
       to_regclass('community_workflow.events') IS NOT NULL AS events,
       to_regclass('community_workflow.idempotency') IS NOT NULL AS idempotency,
       EXISTS (
         SELECT 1 FROM pg_trigger
          WHERE tgname = 'community_workflow_events_append_only' AND NOT tgisinternal
       ) AS append_only`
  );
  const row = result.rows[0] || {};
  if (!(row.event_head === true && row.events === true && row.idempotency === true && row.append_only === true)) {
    throw new Error("Workflow migration verification failed");
  }
}

async function main() {
  if (action === "apply") {
    if (await schemaExists()) throw new Error("Workflow schema already exists; use verify");
    await pool.query(fs.readFileSync(path.join(migrations, "0001-workflow-store.sql"), "utf8"));
    await verifyApplied();
    return;
  }
  if (action === "rollback") {
    if (!(await schemaExists())) throw new Error("Workflow schema is not present");
    await pool.query(fs.readFileSync(path.join(migrations, "0001-workflow-store.rollback.sql"), "utf8"));
    if (await schemaExists()) throw new Error("Workflow rollback verification failed");
    return;
  }
  await verifyApplied();
}

main()
  .finally(() => pool.end())
  .catch((error) => {
    process.stderr.write(`Workflow migration failed: ${error.message}\n`);
    process.exitCode = 1;
  });
