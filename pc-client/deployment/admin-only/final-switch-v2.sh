#!/bin/sh
# Run on the approved production host only, after image/data delivery is verified.
set -eu

: "${AIHUB_ADMIN_IMAGE:?set verified image}" "${AIHUB_PUBLIC_HOST:?set public host}"
: "${AIHUB_ADMIN_DATA_DIR:?set persistent data dir}" "${AIHUB_ADMIN_PUBLISHED_DIR:?set persistent published dir}"
: "${AIHUB_ADMIN_OUTPUT_DIR:?set persistent output dir}" "${AIHUB_SOURCE_CONTENT_DIGEST:?set source digest}"
: "${AIHUB_RELEASE_DIR:?set release contract dir}" "${AIHUB_BACKUP_DIR:?set backup root}"

project=zhenxing-ai-readonly
old_admin=zhenxing-ai-admin-1
admin=${project}-admin-1
caddy=${project}-caddy-1
v1_sha=6eb104a4e2834ecf9f943756e4d362563aeaa04713b64008db81b8d190594456
v2_sha=1832bdc815c1084f8da3cb9adcf1b23e97f19f6c58dc65c72a587a008ef60878

compose() { docker compose -p "$project" -f "$AIHUB_RELEASE_DIR/compose.server.yaml" "$@"; }
fail() {
  incident="$AIHUB_BACKUP_DIR/final-switch-v2-incident-$(date -u +%Y%m%dT%H%M%SZ)"
  umask 077; mkdir -p "$incident"
  compose ps >"$incident/compose-ps.txt" 2>&1 || true
  docker logs --timestamps "$caddy" >"$incident/caddy.log" 2>&1 || true
  docker inspect "$caddy" >"$incident/caddy-inspect.json" 2>&1 || true
  compose down >/dev/null 2>&1 || true
  docker start "$old_admin" >/dev/null 2>&1 || true
  printf 'FAIL %s; rollback=%s\n' "$1" "$incident" >&2
  exit 1
}
check() { printf 'PASS %s expected=%s actual=%s\n' "$1" "$2" "$3"; }

compose config --quiet || exit 1
docker stop "$old_admin" >/dev/null || exit 1
compose up -d --no-build >/dev/null || fail compose-up

i=0
while [ "$i" -lt 45 ]; do
  a=$(docker inspect -f '{{.State.Health.Status}}' "$admin" 2>/dev/null || true)
  c=$(docker inspect -f '{{.State.Health.Status}}' "$caddy" 2>/dev/null || true)
  [ "$a" = healthy ] && [ "$c" = healthy ] && break
  i=$((i + 1)); sleep 1
done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$admin" 2>/dev/null)" = healthy ] || fail admin-health
[ "$(docker inspect -f '{{.State.Health.Status}}' "$caddy" 2>/dev/null)" = healthy ] || fail caddy-health

ready=$(curl -fsS http://127.0.0.1:4173/ready) || fail ready-http
printf '%s' "$ready" | grep -q '"mode":"read-only"' || fail ready-mode
# Current read-only response uses signingKeyId:null (not legacy keyId).
printf '%s' "$ready" | grep -q '"signingKeyId":null' || fail ready-signing-key
check ready '200/read-only/no-signing-key' "$ready"

post=$(curl -sS -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:4173/api/catalog) || fail post-api-request
[ "$post" = 503 ] || fail post-api-status
check post-api 503 "$post"

private=$(docker exec "$caddy" wget -q -O - http://127.0.0.1:2015/health) || fail private-health-request
printf '%s' "$private" | grep -q '"mode":"read-only"' || fail private-health-body
check caddy-private-health 200 "$private"

for spec in "v1 /catalog-release.json $v1_sha" "v2 /channels/v2/catalog-release.json $v2_sha"; do
  set -- $spec
  actual=$(curl -fsS "http://127.0.0.1:4173$2" | sha256sum | awk '{print $1}') || fail "$1-release-request"
  [ "$actual" = "$3" ] || fail "$1-transport-sha"
  check "$1-transport-sha" "$3" "$actual"
done

icon=/vendor-icons/6025a4347a8eaed17e31eaebf7834e33ec4af26cc7f59be586ac59ba5157fa1c.png
icon_status=$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:4173$icon") || fail vendor-icon-request
[ "$icon_status" = 200 ] || fail vendor-icon-status
check vendor-icon 200 "$icon_status"

for path in /health /catalog-release.json /channels/v2/catalog-release.json "$icon"; do
  code=$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' "https://$AIHUB_PUBLIC_HOST$path") || fail "public-$path"
  [ "$code" = 200 ] || fail "public-$path-status"
  check "public-$path" 200 "$code"
done

if curl --noproxy '*' -fsS --connect-timeout 5 "http://$AIHUB_PUBLIC_HOST:4173/ready" >/dev/null; then
  fail public-admin-exposed
fi
check public-admin  'unreachable' unreachable
printf 'PASS final-switch-v2\n'
