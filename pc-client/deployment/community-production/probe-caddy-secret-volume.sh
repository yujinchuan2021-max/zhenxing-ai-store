#!/bin/bash
set -euo pipefail

caddy_image='caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'
node_image='node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32'
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "usage: $0 ABSOLUTE_SECRET_FILE ABSOLUTE_EVIDENCE_DIR [HIGH_PORT]" >&2
  exit 2
fi

secret_file="$1"
evidence_dir="$2"
probe_port="${3:-14174}"
[[ "$(id -u)" == "0" ]] || { echo "Caddy secret probe must run as root" >&2; exit 1; }
[[ "$secret_file" == /* && "$evidence_dir" == /* ]] || { echo "Probe paths must be absolute" >&2; exit 1; }
[[ "$probe_port" =~ ^[0-9]+$ && "$probe_port" -gt 1024 && "$probe_port" -le 65535 ]] || { echo "Probe port is invalid" >&2; exit 1; }
[[ ! "$probe_port" =~ ^(4173|4174)$ ]] || { echo "Probe port conflicts with local Admin" >&2; exit 1; }

prefix="aihub-caddy-secret-probe-$$"
network="$prefix-net"
secret_volume="$prefix-secret"
data_volume="$prefix-data"
config_volume="$prefix-config"
mock="$prefix-mock"
caddy="$prefix-caddy"
captured=0

mkdir -p "$evidence_dir"
chmod 700 "$evidence_dir"

capture() {
  [[ "$captured" == "0" ]] || return 0
  captured=1
  docker inspect "$caddy" > "$evidence_dir/caddy-inspect.json" 2>/dev/null || true
  docker logs --timestamps "$caddy" > "$evidence_dir/caddy.log" 2>&1 || true
  docker inspect "$mock" > "$evidence_dir/mock-inspect.json" 2>/dev/null || true
  docker logs --timestamps "$mock" > "$evidence_dir/mock.log" 2>&1 || true
}

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  capture
  docker rm -f "$caddy" "$mock" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  docker volume rm "$secret_volume" "$data_volume" "$config_volume" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT HUP INT TERM

docker network create "$network" >/dev/null
docker volume create "$data_volume" >/dev/null
docker volume create "$config_volume" >/dev/null
bash "$script_dir/seed-caddy-secret-volume.sh" "$secret_volume" "$secret_file" >/dev/null

docker run -d --name "$mock" --network "$network" --network-alias admin \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
  -v "$script_dir/caddy-secret-probe-mock.cjs:/app/mock.cjs:ro" \
  "$node_image" node /app/mock.cjs >/dev/null

docker run -d --name "$caddy" --network "$network" --network-alias caddy \
  --user 0:0 --read-only --tmpfs /tmp --cap-drop ALL \
  --cap-add CHOWN --cap-add SETGID --cap-add SETUID --cap-add NET_BIND_SERVICE \
  --security-opt no-new-privileges:true \
  --health-cmd 'wget -q -O /dev/null http://127.0.0.1:2015/health' \
  --health-interval 1s --health-timeout 3s --health-retries 20 \
  -p "127.0.0.1:$probe_port:4174" \
  -e AIHUB_PUBLIC_HOST=root.probe.invalid \
  -e AIHUB_COMMUNITY_PUBLIC_HOST=community.probe.invalid \
  -v "$script_dir/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v "$script_dir/caddy-entrypoint.sh:/usr/local/bin/aihub-caddy-entrypoint:ro" \
  -v "$secret_volume:/run/aihub-caddy-secret:ro" \
  -v "$data_volume:/data" -v "$config_volume:/config" \
  --entrypoint /bin/sh "$caddy_image" /usr/local/bin/aihub-caddy-entrypoint >/dev/null

for _ in $(seq 1 90); do
  [[ "$(docker inspect "$caddy" --format '{{.State.Health.Status}}' 2>/dev/null || true)" == "healthy" ]] && break
  sleep 1
done
[[ "$(docker inspect "$caddy" --format '{{.State.Health.Status}}')" == "healthy" ]] || { echo "Caddy probe did not become healthy" >&2; exit 1; }
sleep 3
health_passes="$(docker inspect "$caddy" --format '{{json .State.Health.Log}}' | grep -o '"ExitCode":0' | wc -l | tr -d ' ')"
[[ "$health_passes" -ge 3 ]] || { echo "Caddy probe has fewer than three passing health checks" >&2; exit 1; }

get_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$probe_port/api/community-management")"
action_status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H 'Origin: http://127.0.0.1:4174' -H 'X-AIHub-CSRF: 1' -H 'Content-Type: application/json' \
  --data '{"action":"set-post-hidden","postId":"42","hidden":true}' \
  "http://127.0.0.1:$probe_port/api/community-management/actions")"
near_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$probe_port/api/community-management-extra")"
write_status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data '{}' "http://127.0.0.1:$probe_port/api/catalog")"
[ "$get_status" = "200" ] && [ "$action_status" = "200" ] && [ "$near_status" = "404" ] && [ "$write_status" = "503" ] || { echo "Caddy probe route contract failed" >&2; exit 1; }

docker exec --user 0:0 "$caddy" sh -ec "awk '/^Uid:|^Gid:|^CapEff:/{print}' /proc/1/status" > "$evidence_dir/caddy-process.txt"
grep -Eq '^Uid:[[:space:]]+65534[[:space:]]+65534[[:space:]]+65534[[:space:]]+65534$' "$evidence_dir/caddy-process.txt"
grep -Eq '^Gid:[[:space:]]+65534[[:space:]]+65534[[:space:]]+65534[[:space:]]+65534$' "$evidence_dir/caddy-process.txt"
grep -Eq '^CapEff:[[:space:]]+0+$' "$evidence_dir/caddy-process.txt"
docker exec --user 0:0 "$caddy" stat -c '%u:%g:%a' /run/aihub-caddy-secret/community_cms_gateway | grep -qx '0:0:400'
docker exec --user 65534:65534 "$caddy" sh -ec 'test ! -r /run/aihub-caddy-secret/community_cms_gateway'
docker exec --user 0:0 "$caddy" sh -ec "! find /run/aihub-caddy-secret -maxdepth 1 -name '.community_cms_gateway.tmp.*' | grep -q ."

capture
if grep -F -f "$secret_file" "$evidence_dir/caddy-inspect.json" "$evidence_dir/caddy.log" "$evidence_dir/mock-inspect.json" "$evidence_dir/mock.log" >/dev/null; then
  echo "Caddy secret leaked into probe evidence" >&2
  exit 1
fi

printf '{"status":"pass","port":%s,"healthPasses":%s}\n' "$probe_port" "$health_passes" > "$evidence_dir/report.json"
echo "Caddy managed-volume secret probe passed"
