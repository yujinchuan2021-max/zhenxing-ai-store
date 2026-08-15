#!/bin/sh
set -eu

target=/target/community_cms_gateway
temporary=/target/.community_cms_gateway.tmp.$$

cleanup() {
  [ -n "$temporary" ] && rm -f "$temporary"
}

fail() {
  echo "$1" >&2
  exit 1
}

trap cleanup EXIT HUP INT TERM
[ "$(id -u)" = "0" ] || fail "Caddy secret seed must run as root"
[ -d /target ] && [ -w /target ] || fail "Caddy secret target volume is unavailable"

umask 077
cat > "$temporary"
bytes="$(wc -c < "$temporary" | tr -d ' ')"
lines="$(wc -l < "$temporary" | tr -d ' ')"
[ "$bytes" -ge 32 ] && [ "$bytes" -le 512 ] && [ "$lines" = "0" ] || fail "Caddy secret input is invalid"
if LC_ALL=C grep -q '[^ -~]' "$temporary"; then
  fail "Caddy secret input is invalid"
fi

chown 0:0 "$temporary"
chmod 400 "$temporary"
mv -f "$temporary" "$target"
temporary=
trap - EXIT HUP INT TERM
