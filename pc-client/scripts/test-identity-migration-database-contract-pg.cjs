"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const image = "postgres:17-alpine";
const nodeImage = "node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd";
const volume = `aihub-identity-migration-contract-${crypto.randomBytes(6).toString("hex")}`;
const runtimeVolume = `aihub-identity-migration-node-${crypto.randomBytes(6).toString("hex")}`;

function docker(args, options = {}) {
  return execFileSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function run() {
  docker(["volume", "create", volume]);
  docker(["volume", "create", runtimeVolume]);
  try {
    docker([
      "run", "--rm", "--user", "0:0",
      "--mount", `type=volume,src=${volume},dst=/data`,
      "--entrypoint", "/bin/sh", image, "-ec",
      "chown 70:70 /data",
    ]);
    docker([
      "run", "--rm", "--pull", "never", "--user", "0:0",
      "--mount", `type=volume,src=${runtimeVolume},dst=/runtime`,
      "--entrypoint", "/bin/sh", nodeImage, "-ec",
      "cp -a /usr/local/. /runtime/",
    ]);

    const fixture = String.raw`set -eu
initdb -D /data -U aihub --auth=trust >/dev/null
pg_ctl -D /data -o '-h 127.0.0.1 -k /tmp' -w start >/dev/null
trap 'pg_ctl -D /data -m immediate stop >/dev/null 2>&1 || true' EXIT
node=/node/bin/node
pool_runner=/workspace/scripts/fixtures/identity-migration-real-pool-runner.cjs
run_pool() {
  AIHUB_IDENTITY_DATABASE_URL="$1" "$node" "$pool_runner"
}
run_legacy_pool() {
  AIHUB_IDENTITY_MIGRATION_TEST_MODE=legacy-bare-query AIHUB_IDENTITY_DATABASE_URL="$1" "$node" "$pool_runner"
}

# pg_isready is a server-acceptance probe: it returns success even before the
# requested database exists. The actual Node pg.Pool preflight must reject it.
pg_isready -h 127.0.0.1 -U aihub -d aihub >/dev/null
missing=$(run_pool 'postgres://aihub@127.0.0.1:5432/aihub')
if [ "$missing" != '{"ok":false,"code":"IDENTITY_DATABASE_MISSING"}' ]; then
  printf '%s\n' "$missing"
  exit 41
fi

# This is the explicit one-time POSTGRES_DB initialization action. Migration
# itself never creates the database.
createdb -h 127.0.0.1 -U aihub aihub
tcp_database=$(psql -X -h 127.0.0.1 -U aihub -d aihub -Atqc 'SELECT current_database()')
socket_database=$(psql -X -h /tmp -U aihub -d aihub -Atqc 'SELECT current_database()')
legacy=$(run_legacy_pool 'postgres://aihub@127.0.0.1:5432/aihub')
if [ "$legacy" != '{"ok":false,"code":"LEGACY_RECEIVER_FAILURE"}' ]; then
  printf '%s\n' "$legacy"
  exit 42
fi
valid=$(run_pool 'postgres://aihub@127.0.0.1:5432/aihub')
if [ "$valid" != '{"ok":true}' ]; then
  printf '%s\n' "$valid"
  exit 43
fi
wrong_database=$(run_pool 'postgres://aihub@127.0.0.1:5432/postgres')
if [ "$wrong_database" != '{"ok":false,"code":"IDENTITY_DATABASE_TARGET_MISMATCH"}' ]; then
  printf '%s\n' "$wrong_database"
  exit 44
fi
wrong_user=$(run_pool 'postgres://missing-user@127.0.0.1:5432/aihub')
if [ "$wrong_user" != '{"ok":false,"code":"IDENTITY_DATABASE_UNAVAILABLE"}' ]; then
  printf '%s\n' "$wrong_user"
  exit 45
fi

# Apply, rollback, and reapply the candidate workflow migration against the
# same explicitly initialized Identity database. The real Node pg.Pool applies
# identity/schema.sql twice to prove the actual migration path is repeat-safe.
repeat=$(run_pool 'postgres://aihub@127.0.0.1:5432/aihub')
if [ "$repeat" != '{"ok":true}' ]; then
  printf '%s\n' "$repeat"
  exit 46
fi
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U aihub -d aihub -f /workspace/community/migrations/candidates/0001-workflow-store.sql >/dev/null
first_schema=$(psql -X -h 127.0.0.1 -U aihub -d aihub -Atqc "SELECT CASE WHEN to_regclass('community_workflow.events') IS NOT NULL THEN 'true' ELSE 'false' END")
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U aihub -d aihub -f /workspace/community/migrations/candidates/0001-workflow-store.rollback.sql >/dev/null
after_rollback=$(psql -X -h 127.0.0.1 -U aihub -d aihub -Atqc "SELECT CASE WHEN to_regclass('community_workflow.events') IS NULL THEN 'true' ELSE 'false' END")
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U aihub -d aihub -f /workspace/community/migrations/candidates/0001-workflow-store.sql >/dev/null
after_reapply=$(psql -X -h 127.0.0.1 -U aihub -d aihub -Atqc "SELECT CASE WHEN to_regclass('community_workflow.events') IS NOT NULL THEN 'true' ELSE 'false' END")

printf '{"ok":true,"realPool":true,"legacyReceiverRejected":true,"pgIsReadyBeforeDatabase":true,"tcpDatabase":"%s","socketDatabase":"%s","firstSchema":%s,"afterRollback":%s,"afterReapply":%s}\n' "$tcp_database" "$socket_database" "$first_schema" "$after_rollback" "$after_reapply"`;

    const output = docker([
      "run", "--rm", "--network", "none", "--user", "70:70",
      "--mount", `type=volume,src=${volume},dst=/data`,
      "--mount", `type=volume,src=${runtimeVolume},dst=/node,readonly`,
      "--mount", `type=bind,src=${root},dst=/workspace,readonly`,
      "--entrypoint", "/bin/sh", image, "-ec", fixture,
    ]);
    const result = JSON.parse(output.split(/\r?\n/).at(-1));
    assert.deepEqual(result, {
      ok: true,
      realPool: true,
      legacyReceiverRejected: true,
      pgIsReadyBeforeDatabase: true,
      tcpDatabase: "aihub",
      socketDatabase: "aihub",
      firstSchema: true,
      afterRollback: true,
      afterReapply: true,
    });
    return result;
  } finally {
    docker(["volume", "rm", "-f", volume]);
    docker(["volume", "rm", "-f", runtimeVolume]);
  }
}

const result = run();
process.stdout.write(`${JSON.stringify(result)}\n`);
