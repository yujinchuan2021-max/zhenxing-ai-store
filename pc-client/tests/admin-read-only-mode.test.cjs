"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  isAdminReadOnly,
  isAdminReadOnlyWriteBlocked
} = require("../admin/read-only-mode.cjs");

const server = fs.readFileSync(
  path.join(__dirname, "..", "admin", "server.cjs"),
  "utf8"
);
const compose = fs.readFileSync(
  path.join(__dirname, "..", "deployment", "admin-only", "compose.server.yaml"),
  "utf8"
);
const dockerfile = fs.readFileSync(
  path.join(__dirname, "..", "deployment", "admin-only", "Dockerfile"),
  "utf8"
);
const caddyfile = fs.readFileSync(
  path.join(__dirname, "..", "deployment", "admin-only", "Caddyfile"),
  "utf8"
);

test("only an explicit 1 enables the production admin read-only mode", () => {
  assert.equal(isAdminReadOnly({ AIHUB_ADMIN_READ_ONLY: "1" }), true);
  assert.equal(isAdminReadOnly({ AIHUB_ADMIN_READ_ONLY: "true" }), false);
  assert.equal(isAdminReadOnly({}), false);
});

test("read-only mode has one exact community action write exception", () => {
  assert.equal(isAdminReadOnlyWriteBlocked(true, "POST", "/api/community-management/actions"), false);
  for (const pathname of [
    "/api/catalog",
    "/api/config",
    "/api/release/rollback",
    "/api/community-management",
    "/api/community-management/actions/"
  ]) {
    assert.equal(isAdminReadOnlyWriteBlocked(true, "POST", pathname), true, pathname);
  }
  assert.equal(isAdminReadOnlyWriteBlocked(true, "GET", "/api/catalog"), false);
  assert.equal(isAdminReadOnlyWriteBlocked(false, "POST", "/api/catalog"), false);
});

test("read-only admin neither loads a signing key nor reaches write routes", () => {
  assert.match(
    server,
    /const signingKey = adminReadOnly \? null : loadSigningKey\(/ 
  );
  const ensureDraftStart = server.indexOf("async function ensureDraft()");
  const firstDraftWrite = server.indexOf("await releaseStore.saveDraft", ensureDraftStart);
  assert.ok(ensureDraftStart >= 0 && firstDraftWrite > ensureDraftStart);
  assert.match(
    server.slice(ensureDraftStart, firstDraftWrite),
    /if \(adminReadOnly\) \{[\s\S]*?return state;/
  );

  const handlerStart = server.indexOf("async function handleApi");
  const originGuard = server.indexOf('request.headers["x-aihub-admin"]', handlerStart);
  assert.ok(handlerStart >= 0 && originGuard > handlerStart);
  assert.match(
    server.slice(handlerStart, originGuard),
    /if \(isAdminReadOnlyWriteBlocked\(adminReadOnly, request\.method, pathname\)\) \{[\s\S]*?503/
  );
  assert.match(
    server.slice(handlerStart, originGuard),
    /request\.method === "POST" && pathname === "\/api\/community-management\/actions"/
  );
});

test("the admin-only deployment forces the no-key read-only contract", () => {
  assert.match(compose, /AIHUB_ADMIN_READ_ONLY: "1"/);
  assert.doesNotMatch(compose, /AIHUB_ADMIN_ENV_FILE|AIHUB_CATALOG_SIGNING_PRIVATE_KEY/);
  assert.doesNotMatch(dockerfile, /catalog-signing-private\.pem/);
});

test("Caddy healthcheck uses its private loopback-only listener", () => {
  assert.match(
    compose,
    /wget -q -O \/dev\/null http:\/\/127\.0\.0\.1:2015\/health/
  );
  assert.match(caddyfile, /http:\/\/:2015 \{\s+bind 127\.0\.0\.1/);
});
