#!/bin/sh
set -eu

read_secret() {
  file="$1"
  label="$2"
  [ -f "$file" ] || { echo "$label secret file is missing" >&2; exit 1; }
  bytes="$(wc -c < "$file")"
  [ "$bytes" -ge 32 ] && [ "$bytes" -le 4096 ] || {
    echo "$label secret file is invalid" >&2
    exit 1
  }
  cat "$file"
}

if [ -n "${AIHUB_FORUM_DB_PASSWORD_FILE:-}" ]; then
  AIHUB_FORUM_DB_PASSWORD="$(read_secret "$AIHUB_FORUM_DB_PASSWORD_FILE" forum-database)"
  export AIHUB_FORUM_DB_PASSWORD
fi
if [ -n "${AIHUB_FORUM_ADMIN_PASSWORD_FILE:-}" ]; then
  AIHUB_FORUM_ADMIN_PASSWORD="$(read_secret "$AIHUB_FORUM_ADMIN_PASSWORD_FILE" forum-admin)"
  export AIHUB_FORUM_ADMIN_PASSWORD
fi
if [ -n "${AIHUB_FORUM_API_KEY_FILE:-}" ]; then
  AIHUB_FORUM_API_KEY="$(read_secret "$AIHUB_FORUM_API_KEY_FILE" forum-api-key)"
  export AIHUB_FORUM_API_KEY
fi
if [ -n "${AIHUB_FORUM_PASSWORD_TOKEN_FILE:-}" ]; then
  AIHUB_FORUM_PASSWORD_TOKEN="$(read_secret "$AIHUB_FORUM_PASSWORD_TOKEN_FILE" forum-password-token)"
  export AIHUB_FORUM_PASSWORD_TOKEN
fi
if [ -n "${AIHUB_COMMUNITY_INTERNAL_SECRET_FILE:-}" ]; then
  AIHUB_COMMUNITY_INTERNAL_SECRET="$(read_secret "$AIHUB_COMMUNITY_INTERNAL_SECRET_FILE" community-internal)"
  export AIHUB_COMMUNITY_INTERNAL_SECRET
fi
if [ -n "${AIHUB_COMMUNITY_MANAGEMENT_SECRET_FILE:-}" ]; then
  AIHUB_COMMUNITY_MANAGEMENT_SECRET="$(read_secret "$AIHUB_COMMUNITY_MANAGEMENT_SECRET_FILE" community-management)"
  export AIHUB_COMMUNITY_MANAGEMENT_SECRET
fi

case "${AIHUB_FLARUM_MODE:-runtime}" in
  runtime)
    exec aihub-flarum-entrypoint "$@"
    ;;
  migrate)
    exec aihub-flarum-migration-entrypoint
    ;;
  *)
    echo "AIHUB_FLARUM_MODE must be runtime or migrate" >&2
    exit 64
    ;;
esac
