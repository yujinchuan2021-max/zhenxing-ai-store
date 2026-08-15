"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const server = fs.readFileSync(path.join(root, "identity", "server.cjs"), "utf8");
const compose = fs.readFileSync(path.join(deployment, "compose.server.yaml"), "utf8");
const migration = fs.readFileSync(path.join(deployment, "run-migrations.sh"), "utf8");
const dockerignore = fs.readFileSync(path.join(root, ".dockerignore"), "utf8");
const { identitySchemaMode } = require("../identity/schema-mode.cjs");

test("identity schema mode is explicit and rejects unknown production behavior", () => {
  assert.equal(identitySchemaMode({}), "automatic");
  assert.equal(identitySchemaMode({ AIHUB_IDENTITY_SCHEMA_MODE: "external" }), "external");
  assert.equal(identitySchemaMode({ AIHUB_IDENTITY_SCHEMA_MODE: "migrate" }), "migrate");
  assert.throws(
    () => identitySchemaMode({ AIHUB_IDENTITY_SCHEMA_MODE: "skip-maybe" }),
    /invalid/
  );
});

test("Identity build context admits only its two explicit deployment helpers", () => {
  assert.match(dockerignore, /^!deployment\/$/m);
  assert.match(dockerignore, /^!deployment\/community-production\/$/m);
  assert.match(dockerignore, /^!deployment\/community-production\/identity-entrypoint\.sh$/m);
  assert.match(dockerignore, /^!deployment\/community-production\/workflow-migrate\.cjs$/m);
  assert.doesNotMatch(dockerignore, /^!deployment\/(?:\*\*|community-production\/\*\*)$/m);
});

test("Identity build context admits only the canonical Workflow modules and candidate migration", () => {
  for (const value of [
    "!community/workflow-store.cjs",
    "!community/workflow-persistence.cjs",
    "!community/migrations/candidates/0001-workflow-store.sql",
    "!community/migrations/candidates/0001-workflow-store.rollback.sql"
  ]) assert.match(dockerignore, new RegExp(`^${value.replaceAll(".", "\\.")}$`, "m"));
  assert.doesNotMatch(dockerignore, /^!community\/(?:\*\*|migrations\/\*\*)$/m);
});

test("root build context re-excludes Admin data and secret file shapes", () => {
  const dataGuard = dockerignore.indexOf("admin/data/*");
  assert.ok(dataGuard >= 0);
  for (const allowed of [
    "!admin/data/catalog-v1.json",
    "!admin/data/release-settings.json",
    "!admin/data/vendor-icon-fallbacks.json",
    "!admin/data/vendor-icon-sources.json"
  ]) {
    assert.ok(dockerignore.indexOf(allowed) > dataGuard, allowed);
  }
  assert.match(dockerignore, /^\*\*\/\*\.pem$/m);
  assert.match(dockerignore, /^\*\*\/\*\.key$/m);
  assert.match(dockerignore, /^\*\*\/\.env\*$/m);
});

test("identity runtime skips schema and migrate mode exits before listening", () => {
  assert.match(server, /identitySchemaMode\(\)/);
  assert.match(server, /schemaMode !== "external"[\s\S]*?initializeDatabase\(\)/);
  assert.match(server, /schemaMode === "migrate"[\s\S]*?pool\.end\(\)[\s\S]*?return/);
  const listen = server.indexOf("server.listen");
  const migrateExit = server.indexOf('schemaMode === "migrate"');
  assert.ok(migrateExit >= 0 && listen > migrateExit);
});

test("production compose separates the identity migration from the runtime", () => {
  const migrateBlock = compose.match(/\n  identity-migrate:\n[\s\S]*?(?=\n  identity:\n)/)?.[0] || "";
  assert.match(compose, /identity-migrate:/);
  assert.match(compose, /profiles: \["migration"\]/);
  assert.match(compose, /AIHUB_IDENTITY_SCHEMA_MODE: migrate/);
  assert.match(compose, /AIHUB_IDENTITY_SCHEMA_MODE: external/);
  assert.match(compose, /restart: "no"/);
  assert.doesNotMatch(migrateBlock, /ports:/);
  assert.doesNotMatch(migrateBlock, /community_internal/);
});

test("production compose separates the Flarum migration from the runtime", () => {
  const migrateBlock = compose.match(/\n  community-migrate:\n[\s\S]*?(?=\n  community:\n)/)?.[0] || "";
  assert.match(migrateBlock, /profiles: \["migration"\]/);
  assert.match(migrateBlock, /AIHUB_FLARUM_MODE: migrate/);
  assert.match(compose, /AIHUB_FLARUM_MODE: runtime/);
  assert.match(migrateBlock, /restart: "no"/);
  assert.doesNotMatch(migrateBlock, /ports:|community_internal|community_management/);
});

test("migration runner requires a verified backup and never starts applications", () => {
  assert.match(migration, /sha256sum -c SHA256SUMS/);
  assert.match(migration, /--profile migration run --rm identity-migrate/);
  assert.match(migration, /--profile migration run --rm community-migrate/);
  assert.doesNotMatch(migration, /\bup\b|\badmin\b|\bcaddy\b/);
});

test("deployment source manifest verifies with its documented canonical digest", () => {
  const verify = require("../deployment/community-production/verify-manifest.cjs");
  assert.equal(verify.verifyManifest(), true);
});
