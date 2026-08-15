#!/bin/bash
set -euo pipefail

image='caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -ne 2 ]]; then
  echo "usage: $0 DOCKER_VOLUME ABSOLUTE_SECRET_FILE" >&2
  exit 2
fi

volume="$1"
secret_file="$2"
created_volume=0

cleanup() {
  status=$?
  trap - EXIT
  if [[ "$status" -ne 0 && "$created_volume" == "1" ]]; then
    docker volume rm "$volume" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

[[ "${EUID:-$(id -u)}" == "0" ]] || { echo "Caddy secret seeding must run as root" >&2; exit 1; }
[[ "$volume" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || { echo "Caddy secret volume name is invalid" >&2; exit 1; }
[[ "$secret_file" == /* && ! -L "$secret_file" && -f "$secret_file" ]] || { echo "Caddy source secret must be an absolute regular file, not a symlink" >&2; exit 1; }

if [[ -v SUDO_UID || -v SUDO_GID ]]; then
  [[ -v SUDO_UID && -v SUDO_GID && "$SUDO_UID" =~ ^[0-9]+$ && "$SUDO_GID" =~ ^[0-9]+$ ]] || {
    echo "Caddy source secret sudo caller identity is invalid" >&2
    exit 1
  }
  approved_owner="$SUDO_UID:$SUDO_GID"
else
  approved_owner="0:0"
fi

IFS=: read -r source_uid source_gid source_mode source_links source_bytes < <(stat -c '%u:%g:%a:%h:%s' -- "$secret_file")
[[ "$source_uid:$source_gid" == "$approved_owner" ]] || { echo "Caddy source secret owner is not the sudo caller" >&2; exit 1; }
[[ "$source_mode" == "600" ]] || { echo "Caddy source secret mode must remain 0600" >&2; exit 1; }
[[ "$source_links" == "1" ]] || { echo "Caddy source secret must have exactly one hard link" >&2; exit 1; }
[[ "$source_bytes" -ge 32 && "$source_bytes" -le 512 ]] || { echo "Caddy source secret length is invalid" >&2; exit 1; }
non_printing_bytes="$(LC_ALL=C tr -d '\040-\176' < "$secret_file" | wc -c | tr -d ' ')"
[[ "$non_printing_bytes" == "0" ]] || { echo "Caddy source secret contains control characters" >&2; exit 1; }
[[ -z "$(docker ps -q --filter "volume=$volume")" ]] || { echo "Caddy secret volume is attached to a running container" >&2; exit 1; }

if ! docker volume inspect "$volume" >/dev/null 2>&1; then
  docker volume create "$volume" >/dev/null
  created_volume=1
fi
cat -- "$secret_file" | docker run --rm -i --user 0:0 \
  -v "$volume:/target" \
  -v "$script_dir/caddy-secret-seed.sh:/usr/local/bin/aihub-caddy-secret-seed:ro" \
  --entrypoint /bin/sh "$image" /usr/local/bin/aihub-caddy-secret-seed

docker run --rm --user 0:0 -v "$volume:/target:ro" --entrypoint /bin/sh "$image" -ec \
  '[ "$(stat -c "%u:%g:%a" /target/community_cms_gateway)" = "0:0:400" ] && [ ! -e /target/.community_cms_gateway.tmp ]'
trap - EXIT
echo "Caddy CMS secret volume seeded"
