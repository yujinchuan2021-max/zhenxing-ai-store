#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
community_files_contract="$script_dir/community-files-backup-contract.json"
[[ -f "$community_files_contract" && ! -L "$community_files_contract" ]] || {
  echo "community files backup contract is missing or unsafe" >&2
  exit 1
}

if [[ $# -eq 2 ]]; then
  compose_file="$1"
  backup_root="$2"
  compose_args=(-f "$compose_file")
elif [[ $# -eq 3 ]]; then
  base="$1"
  overlay="$2"
  backup_root="$3"
  source "$script_dir/workflow-cutover-compose-files.sh"
  resolve_workflow_cutover_compose_files "$base" "$overlay"
  compose_args=()
  for compose_file in "${workflow_cutover_compose_files[@]}"; do
    compose_args+=(-f "$compose_file")
  done
else
  echo "usage: backup.sh ABSOLUTE_BASE_COMPOSE [ABSOLUTE_PRODUCTION_OVERLAY] ABSOLUTE_BACKUP_ROOT" >&2
  exit 2
fi
case "$backup_root" in /*) ;; *) echo "backup root must be absolute" >&2; exit 1 ;; esac
[[ "$backup_root" != "/" ]] || { echo "backup root cannot be /" >&2; exit 1; }

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
work="$backup_root/.community-production-$stamp.incomplete"
final="$backup_root/community-production-$stamp"
[[ ! -e "$work" && ! -e "$final" ]] || { echo "backup target exists" >&2; exit 1; }
mkdir -p "$work"
trap 'rm -rf -- "$work"' EXIT INT TERM

docker compose "${compose_args[@]}" exec -T identity-database \
  pg_dump -U aihub -d aihub --format=custom --no-owner > "$work/identity.pgdump"
docker compose "${compose_args[@]}" exec -T community-database sh -ec \
  'MYSQL_PWD="$(cat /run/secrets/forum_db_password)" exec mariadb-dump --single-transaction --routines --triggers -u aihub_forum aihub_forum' \
  > "$work/community.sql"
cp -- "$community_files_contract" "$work/COMMUNITY-FILES.json"
docker compose "${compose_args[@]}" exec -T community sh -ec '
  for root in /var/lib/flarum /var/www/html/storage /var/www/html/public/assets; do
    if [ ! -d "$root" ] || [ -L "$root" ]; then
      echo "community file roots must be real directories" >&2
      exit 1
    fi
  done
  if find -P /var/lib/flarum /var/www/html/storage /var/www/html/public/assets \
    -type l -print -quit | grep -q .; then
    echo "community file roots must not contain symlinks" >&2
    exit 1
  fi
  formatter=/var/www/html/storage/formatter
  if [ -L "$formatter" ] || { [ -e "$formatter" ] && [ ! -d "$formatter" ]; }; then
    echo "formatter path must be a real directory" >&2
    exit 1
  fi
  exec tar -C / --exclude=var/www/html/storage/formatter -cf - \
    var/lib/flarum var/www/html/storage var/www/html/public/assets
' \
  > "$work/community-files.tar"

archive_entries="$(tar -tf "$work/community-files.tar")"
for required in var/lib/flarum/ var/www/html/storage/ var/www/html/public/assets/; do
  printf '%s\n' "$archive_entries" | grep -Fx "$required" >/dev/null || {
    echo "community files archive is missing a required root" >&2
    exit 1
  }
done
if printf '%s\n' "$archive_entries" | grep -E '^var/www/html/storage/formatter(/|$)' >/dev/null; then
  echo "generated formatter cache entered the community files archive" >&2
  exit 1
fi
if tar -tvf "$work/community-files.tar" | grep -Ev '^[-d]' >/dev/null; then
  echo "community files archive contains an unsafe entry type" >&2
  exit 1
fi

docker compose "${compose_args[@]}" images --format json > "$work/IMAGES.json"
(cd "$work" && sha256sum identity.pgdump community.sql community-files.tar COMMUNITY-FILES.json IMAGES.json > SHA256SUMS)
(cd "$work" && sha256sum -c SHA256SUMS >/dev/null)
mv "$work" "$final"
trap - EXIT INT TERM
printf '%s\n' "$final"
