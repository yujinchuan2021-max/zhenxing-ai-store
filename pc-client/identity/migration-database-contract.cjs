"use strict";

const IDENTITY_DATABASE = "aihub";
const IDENTITY_DATABASE_USER = "aihub";

class IdentityMigrationDatabaseError extends Error {
  constructor(code) {
    super("Identity migration storage is unavailable");
    this.name = "IdentityMigrationDatabaseError";
    this.code = code;
    this.status = 503;
  }
}

async function assertIdentityMigrationDatabase(pool) {
  if (!pool || typeof pool.query !== "function") {
    throw new IdentityMigrationDatabaseError("IDENTITY_DATABASE_UNAVAILABLE");
  }
  let result;
  try {
    result = await pool.query("SELECT current_database() AS database, current_user AS user");
  } catch (error) {
    throw new IdentityMigrationDatabaseError(
      error?.code === "3D000" ? "IDENTITY_DATABASE_MISSING" : "IDENTITY_DATABASE_UNAVAILABLE"
    );
  }
  const row = result?.rows?.[0];
  if (row?.database !== IDENTITY_DATABASE) {
    throw new IdentityMigrationDatabaseError("IDENTITY_DATABASE_TARGET_MISMATCH");
  }
  if (row?.user !== IDENTITY_DATABASE_USER) {
    throw new IdentityMigrationDatabaseError("IDENTITY_DATABASE_PRINCIPAL_MISMATCH");
  }
  return Object.freeze({ database: IDENTITY_DATABASE, user: IDENTITY_DATABASE_USER });
}

async function initializeIdentitySchema({ schemaMode, pool, schema } = {}) {
  if (!pool || typeof pool.query !== "function" || typeof schema !== "string") {
    throw new IdentityMigrationDatabaseError("IDENTITY_DATABASE_UNAVAILABLE");
  }
  if (schemaMode === "migrate") {
    await assertIdentityMigrationDatabase(pool);
  }
  await pool.query(schema);
}

module.exports = {
  IDENTITY_DATABASE,
  IDENTITY_DATABASE_USER,
  IdentityMigrationDatabaseError,
  assertIdentityMigrationDatabase,
  initializeIdentitySchema
};
