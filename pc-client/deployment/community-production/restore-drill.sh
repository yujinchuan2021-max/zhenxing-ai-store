#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
backup="${1:?usage: restore-drill.sh ABSOLUTE_BACKUP_DIRECTORY}"
case "$backup" in /*) ;; *) echo "backup directory must be absolute" >&2; exit 1 ;; esac
[ -d "$backup" ] || { echo "backup directory is missing" >&2; exit 1; }
(cd "$backup" && sha256sum -c SHA256SUMS)
contract="$script_dir/community-files-backup-contract.json"
[ -f "$contract" ] && [ ! -L "$contract" ] || { echo "community files backup contract is missing or unsafe" >&2; exit 1; }
[ -f "$backup/COMMUNITY-FILES.json" ] && [ ! -L "$backup/COMMUNITY-FILES.json" ] || {
  echo "community files backup contract evidence is missing or unsafe" >&2
  exit 1
}
cmp -s "$contract" "$backup/COMMUNITY-FILES.json" || {
  echo "community files backup contract does not match this release" >&2
  exit 1
}
[ -f "$backup/community-files.tar" ] && [ ! -L "$backup/community-files.tar" ] || {
  echo "community files archive is missing or unsafe" >&2
  exit 1
}
archive_entries="$(tar -tf "$backup/community-files.tar")"
if printf '%s\n' "$archive_entries" | grep -E '(^/|(^|/)\.\.(/|$))' >/dev/null; then
  echo "community files archive contains an unsafe path" >&2
  exit 1
fi
if tar -tvf "$backup/community-files.tar" | grep -Ev '^[-d]' >/dev/null; then
  echo "community files archive contains an unsafe entry type" >&2
  exit 1
fi
if ! printf '%s\n' "$archive_entries" | awk '
  NF {
    allowed = $0 == "var/lib/flarum" || index($0, "var/lib/flarum/") == 1 ||
      $0 == "var/www/html/storage" || index($0, "var/www/html/storage/") == 1 ||
      $0 == "var/www/html/public/assets" || index($0, "var/www/html/public/assets/") == 1
    if (!allowed) invalid = 1
  }
  END { exit invalid }
'; then
  echo "community files archive contains an unexpected member" >&2
  exit 1
fi
if ! printf '%s\n' "$archive_entries" | awk 'NF { if (++seen[$0] > 1) duplicate = 1 } END { exit duplicate }'; then
  echo "community files archive contains a duplicate member" >&2
  exit 1
fi
for required in var/lib/flarum/ var/www/html/storage/ var/www/html/public/assets/; do
  printf '%s\n' "$archive_entries" | grep -Fx "$required" >/dev/null || {
    echo "community files archive is missing a required root" >&2
    exit 1
  }
done
if printf '%s\n' "$archive_entries" | grep -E '^var/www/html/storage/formatter(/|$)' >/dev/null; then
  echo "formatter cache must not be present in the archive" >&2
  exit 1
fi

suffix="$$"
pg_name="aihub-restore-pg-$suffix"
db_name="aihub-restore-maria-$suffix"
files="$(mktemp -d)"
secret="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
cleanup() {
  docker rm -f "$pg_name" "$db_name" >/dev/null 2>&1 || true
  rm -rf -- "$files"
}
trap cleanup EXIT INT TERM

docker run -d --name "$pg_name" --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m \
  -e POSTGRES_PASSWORD="$secret" -e POSTGRES_DB=aihub \
  postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193 >/dev/null
docker run -d --name "$db_name" --tmpfs /var/lib/mysql:rw,noexec,nosuid,size=320m \
  -e MARIADB_ROOT_PASSWORD="$secret" -e MARIADB_DATABASE=aihub_forum \
  mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4 >/dev/null

i=0
until docker exec "$pg_name" pg_isready -U postgres -d aihub >/dev/null 2>&1; do i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done
i=0
until docker exec "$db_name" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; do i=$((i+1)); [ "$i" -lt 90 ] || exit 1; sleep 1; done

docker exec -i "$pg_name" pg_restore -U postgres -d aihub --no-owner < "$backup/identity.pgdump"
docker exec -e MYSQL_PWD="$secret" -i "$db_name" mariadb -u root aihub_forum < "$backup/community.sql"
docker exec "$pg_name" psql -U postgres -d aihub -Atc "select to_regclass('public.users'), to_regclass('public.community_profiles');" | grep -q users
docker exec -e MYSQL_PWD="$secret" "$db_name" mariadb -u root -N aihub_forum -e "select count(*) from users; select count(*) from discussions; select count(*) from posts; select count(*) from aihub_identity_links;" >/dev/null

tar -xf "$backup/community-files.tar" -C "$files"
[ -d "$files/var/lib/flarum" ] && [ -d "$files/var/www/html/storage" ] && [ -d "$files/var/www/html/public/assets" ]
[ ! -e "$files/var/www/html/storage/formatter" ]
printf '%s\n' "restore drill passed in isolated temporary databases with generated formatter cache excluded"
