"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  IdentityMigrationDatabaseError,
  assertIdentityMigrationDatabase,
  initializeIdentitySchema
} = require("../identity/migration-database-contract.cjs");

test("migration accepts only the fixed aihub database and returns a safe contract result", async () => {
  const calls = [];
  const result = await assertIdentityMigrationDatabase({
    query: async (statement) => {
      calls.push(statement);
      return { rows: [{ database: "aihub", user: "aihub" }] };
    }
  });

  assert.deepEqual(result, { database: "aihub", user: "aihub" });
  assert.deepEqual(calls, ["SELECT current_database() AS database, current_user AS user"]);
});

test("migration preflight preserves the real pool query receiver", async () => {
  const calls = [];
  const pool = {
    query(statement) {
      assert.strictEqual(this, pool);
      calls.push(statement);
      return Promise.resolve({ rows: [{ database: "aihub", user: "aihub" }] });
    }
  };

  await initializeIdentitySchema({
    schemaMode: "migrate",
    pool,
    schema: "CREATE TABLE receiver_preserved ()"
  });
  assert.deepEqual(calls, [
    "SELECT current_database() AS database, current_user AS user",
    "CREATE TABLE receiver_preserved ()"
  ]);
});

test("migration never submits schema SQL after the target database preflight fails", async () => {
  const calls = [];
  const pool = {
    query: async (statement) => {
      calls.push(statement);
      if (statement.startsWith("SELECT current_database")) {
        throw Object.assign(new Error('database "aihub" does not exist'), { code: "3D000" });
      }
      return { rows: [] };
    }
  };

  await assert.rejects(
    () => initializeIdentitySchema({ schemaMode: "migrate", pool, schema: "CREATE TABLE never_runs ()" }),
    (error) => error instanceof IdentityMigrationDatabaseError && error.code === "IDENTITY_DATABASE_MISSING"
  );
  assert.deepEqual(calls, ["SELECT current_database() AS database, current_user AS user"]);
});

test("migration rejects a missing, wrong, or inaccessible target database before schema execution", async () => {
  for (const [outcome, code] of [
    [{ error: Object.assign(new Error('database "aihub" does not exist'), { code: "3D000" }) }, "IDENTITY_DATABASE_MISSING"],
    [{ error: Object.assign(new Error("password authentication failed"), { code: "28P01" }) }, "IDENTITY_DATABASE_UNAVAILABLE"],
    [{ row: { database: "postgres", user: "aihub" } }, "IDENTITY_DATABASE_TARGET_MISMATCH"],
    [{ row: { database: "aihub", user: "unexpected-user" } }, "IDENTITY_DATABASE_PRINCIPAL_MISMATCH"]
  ]) {
    const query = outcome.error
      ? async () => { throw outcome.error; }
      : async () => ({ rows: [outcome.row] });
    await assert.rejects(
      () => assertIdentityMigrationDatabase({ query }),
      (error) => error instanceof IdentityMigrationDatabaseError && error.code === code && error.status === 503 &&
        !/database|password|postgres/i.test(error.message)
    );
  }
});
