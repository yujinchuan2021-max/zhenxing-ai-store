"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("Flarum runtime is schema-external and migration mode exits without Apache", () => {
  const runtime = read("community", "flarum", "docker-entrypoint.sh");
  const production = read("community", "flarum", "production-entrypoint.sh");
  const migration = read("community", "flarum", "migration-entrypoint.sh");
  const dockerfile = read("community", "flarum", "Dockerfile");

  assert.doesNotMatch(runtime, /php flarum (?:install|migrate|extension:enable)/);
  assert.doesNotMatch(runtime, /(?:CREATE TABLE|INSERT(?: IGNORE)? INTO|DELETE FROM)\s+/);
  assert.match(runtime, /config\.php.*must be created by the explicit migration job/i);
  assert.match(production, /AIHUB_FLARUM_MODE:-runtime/);
  assert.match(production, /runtime\)\s*exec aihub-flarum-entrypoint/);
  assert.match(production, /migrate\)\s*exec aihub-flarum-migration-entrypoint/);
  assert.match(migration, /php flarum install/);
  assert.match(migration, /php flarum migrate/);
  assert.match(migration, /php flarum extension:enable/);
  assert.match(
    migration,
    /php flarum cache:clear\s+mkdir -p \/var\/www\/html\/storage\/formatter\s+chown www-data:www-data \/var\/www\/html\/storage\/formatter/
  );
  assert.match(migration, /exit 0/);
  assert.doesNotMatch(migration, /docker-php-entrypoint|apache2-foreground/);
  assert.match(dockerfile, /COPY migration-entrypoint\.sh \/usr\/local\/bin\/aihub-flarum-migration-entrypoint/);
});

test("Flarum runtime repairs the writable session directory before Apache starts", () => {
  const runtime = read("community", "flarum", "docker-entrypoint.sh");
  const sessionDirectory = runtime.indexOf(
    "install -d -m 0750 -o www-data -g www-data /var/www/html/storage/sessions"
  );
  const apache = runtime.indexOf('exec docker-php-entrypoint "$@"');

  assert.ok(sessionDirectory >= 0, "runtime does not create storage/sessions");
  assert.ok(apache > sessionDirectory, "Apache starts before session storage is ready");
});
