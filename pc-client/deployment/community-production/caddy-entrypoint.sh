#!/bin/sh
set -eu

secret_file=/run/aihub-caddy-secret/community_cms_gateway
runtime_user=nobody
runtime_uid=65534
runtime_gid=65534

fail() {
  echo "$1" >&2
  exit 1
}

[ "$(id -u)" = "0" ] || fail "Caddy bootstrap must start as root"
[ "$(id -u "$runtime_user")" = "$runtime_uid" ] || fail "Caddy runtime user is invalid"
[ "$(id -g "$runtime_user")" = "$runtime_gid" ] || fail "Caddy runtime group is invalid"
[ -r "$secret_file" ] && [ -s "$secret_file" ] || fail "CMS gateway secret file is unavailable"

secret="$(cat "$secret_file")"
case "$secret" in
  *'
'*|*[![:print:]]*) fail "CMS gateway secret file is invalid" ;;
esac
[ -n "$secret" ] || fail "CMS gateway secret file is invalid"

for state_dir in /data /config; do
  [ -d "$state_dir" ] || fail "Caddy state directory is unavailable"
  chown "$runtime_uid:$runtime_gid" "$state_dir"
  caddy_dir="$state_dir/caddy"
  if [ -e "$caddy_dir" ]; then
    [ -d "$caddy_dir" ] && [ ! -L "$caddy_dir" ] || fail "Caddy managed state path is invalid"
    chown "$runtime_uid:$runtime_gid" "$caddy_dir"
  fi
done

export AIHUB_COMMUNITY_CMS_SECRET="$secret"
unset secret
exec su -p -s /bin/sh "$runtime_user" -c \
  'exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile'
