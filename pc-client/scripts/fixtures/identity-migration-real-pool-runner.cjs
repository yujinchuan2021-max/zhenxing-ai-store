"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("../../identity/node_modules/pg");
const {
  IdentityMigrationDatabaseError,
  initializeIdentitySchema
} = require("../../identity/migration-database-contract.cjs");

async function run() {
  const pool = new Pool({
    connectionString: process.env.AIHUB_IDENTITY_DATABASE_URL
  });
  try {
    if (process.env.AIHUB_IDENTITY_MIGRATION_TEST_MODE === "legacy-bare-query") {
      const { query } = pool;
      await query("SELECT current_database() AS database, current_user AS user");
      process.stdout.write(`${JSON.stringify({ ok: true, legacy: true })}\n`);
      return;
    }
    const schema = fs.readFileSync(path.resolve(__dirname, "../../identity/schema.sql"), "utf8");
    await initializeIdentitySchema({ schemaMode: "migrate", pool, schema });
    process.stdout.write(`${JSON.stringify({ ok: true })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      code: error instanceof IdentityMigrationDatabaseError ? error.code :
        process.env.AIHUB_IDENTITY_MIGRATION_TEST_MODE === "legacy-bare-query"
          ? "LEGACY_RECEIVER_FAILURE"
          : "UNEXPECTED"
    })}\n`);
  } finally {
    await pool.end();
  }
}

void run();
