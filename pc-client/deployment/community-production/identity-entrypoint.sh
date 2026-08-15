#!/bin/sh
set -eu

password_file="${AIHUB_IDENTITY_DATABASE_PASSWORD_FILE:?identity database password file is required}"
[ -f "$password_file" ] || {
  echo "identity database secret file is missing" >&2
  exit 1
}

password="$(node -e 'const fs=require("node:fs"); const value=fs.readFileSync(process.argv[1],"utf8").trim(); if(value.length<32||value.length>512||/[\r\n]/.test(value)) process.exit(1); process.stdout.write(encodeURIComponent(value));' "$password_file")"
export AIHUB_IDENTITY_DATABASE_URL="postgres://aihub:${password}@identity-database:5432/aihub"

if [ -n "${AIHUB_WORKFLOW_OFFICIAL_BOOTSTRAP_MODE:-}" ]; then
  [ "$AIHUB_WORKFLOW_OFFICIAL_BOOTSTRAP_MODE" = run ] || {
    echo "workflow official bootstrap mode is invalid" >&2
    exit 1
  }
  exec node /app/identity/workflow-official-bootstrap-production.cjs
fi

if [ -n "${AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE:-}" ]; then
  case "$AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE" in hold|preflight) ;; *)
    echo "workflow reviewer provision mode is invalid" >&2
    exit 1 ;;
  esac
  exec node /app/identity/workflow-reviewer-production-provision.cjs
fi

if [ -n "${AIHUB_WORKFLOW_MIGRATION_MODE:-}" ]; then
  exec node /app/identity/workflow-migrate.cjs
fi

if [ "${AIHUB_IDENTITY_SCHEMA_MODE:-automatic}" != migrate ]; then
  secret_file="${AIHUB_COMMUNITY_INTERNAL_SECRET_FILE:?community internal secret file is required}"
  [ -f "$secret_file" ] || { echo "community internal secret file is missing" >&2; exit 1; }
  AIHUB_COMMUNITY_INTERNAL_SECRET="$(cat "$secret_file")"
  [ "${#AIHUB_COMMUNITY_INTERNAL_SECRET}" -ge 32 ] || {
    echo "community internal secret is invalid" >&2
    exit 1
  }
  export AIHUB_COMMUNITY_INTERNAL_SECRET
fi

exec node server.cjs
