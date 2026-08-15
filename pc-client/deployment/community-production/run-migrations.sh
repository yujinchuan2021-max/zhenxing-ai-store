#!/bin/sh
set -eu

compose_file="${1:?usage: run-migrations.sh COMPOSE_FILE VERIFIED_BACKUP_DIRECTORY}"
backup="${2:?usage: run-migrations.sh COMPOSE_FILE VERIFIED_BACKUP_DIRECTORY}"
case "$backup" in /*) ;; *) echo "backup directory must be absolute" >&2; exit 1 ;; esac
[ -f "$backup/SHA256SUMS" ] && [ -f "$backup/identity.pgdump" ] && [ -f "$backup/community.sql" ] || {
  echo "verified database backup is missing" >&2
  exit 1
}
(cd "$backup" && sha256sum -c SHA256SUMS)

docker compose -f "$compose_file" --profile migration run --rm identity-migrate
docker compose -f "$compose_file" --profile migration run --rm community-migrate
