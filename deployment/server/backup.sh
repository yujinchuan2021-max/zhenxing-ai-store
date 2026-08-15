#!/bin/sh
set -eu

deployment_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_root=${AIHUB_BACKUP_DIR:-/opt/zhenxing-ai/shared/backups}
target="$backup_root/$timestamp"

compose() {
  docker compose --env-file "$deployment_dir/.env" -f "$deployment_dir/compose.yaml" "$@"
}

umask 077
mkdir -p "$target"

compose exec -T identity-database \
  pg_dump -U aihub -d aihub -Fc > "$target/identity.pgdump"
compose exec -T community-database sh -ec \
  'mariadb-dump -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' \
  > "$target/community.sql"
gzip "$target/community.sql"
compose exec -T community \
  tar -czf - /var/lib/flarum /var/www/html/storage /var/www/html/public/assets \
  > "$target/community-files.tar.gz"
compose exec -T admin \
  tar -czf - /app/admin/data /app/admin/published /app/catalog /app/updates \
  > "$target/admin-data.tar.gz"

sha256sum "$target"/* > "$target/SHA256SUMS"
printf '%s\n' "$target"
