#!/bin/bash
set -euo pipefail

PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
export PATH LC_ALL=C

RUN_ID='workflow-production-r28'
UNIT='zhenxing-ai-workflow-production-r28.service'
PROJECT='zhenxing-community-production'
OLD_RELEASE='/opt/zhenxing-ai/releases/community-production-r25-0967aaaf'
NEW_RELEASE='/opt/zhenxing-ai/releases/community-production-r28-d9fa8de8'
CONTROL='/opt/zhenxing-ai/shared/workflow-production-r28'
EVIDENCE='/opt/zhenxing-ai/shared/backups/workflow-production-r28-evidence'
BACKUPS='/opt/zhenxing-ai/shared/backups'
OLD_IMAGE='zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e'
OLD_IMAGE_ID='sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748'
NEW_IMAGE='zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8'
NEW_IMAGE_ID='sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01'
ACTIVE_STATE='cf0fbd33583792d0afcaf1822081b4a643fcf28d069e755003632f369ead2012'
UPDATE_FEED='8a9628eddc35424639e7b63a4792838df352158755c26ebed334e256e153ca99'
SQL_FILES=(
  identity/schema.sql
  identity/migrations/candidates/0001-resource-submissions.sql
  identity/migrations/candidates/0001-resource-submissions.rollback.sql
  identity/migrations/candidates/0002-workflow-reviewer-service-identity.sql
  identity/migrations/candidates/0002-workflow-reviewer-service-identity.rollback.sql
  identity/migrations/candidates/0003-workflow-official-publisher-service-identity.sql
  identity/migrations/candidates/0003-workflow-official-publisher-service-identity.rollback.sql
)

stage='context'
switched=0
finished=0
backup=''
old_identity_container=''
new_node="$NEW_RELEASE/.workflow-runtime/node-v24.18.1-linux-x64/bin/node"
new_deploy="$NEW_RELEASE/deployment/community-production"
old_deploy="$OLD_RELEASE/deployment/community-production"
status_file="$CONTROL/status.json"
before_file="$EVIDENCE/services-before.tsv"
after_file="$EVIDENCE/services-after.tsv"

fail() { printf '%s\n' 'r28 identity upgrade blocked' >&2; exit 1; }
sha() { sha256sum -- "$1" | awk '{print $1}'; }

write_status() {
  local state="$1" code="$2" rollback="$3" temporary="$CONTROL/.status.$$"
  umask 077
  printf '{"schema":"aihub-workflow-production-r28-identity-upgrade-v1","runId":"%s","state":"%s","terminal":%s,"stage":"%s","code":%s,"rollbackSucceeded":%s,"backup":%s,"oldImageId":"%s","newImageId":"%s"}\n' \
    "$RUN_ID" "$state" "$([[ "$state" == running ]] && printf false || printf true)" "$stage" \
    "$([[ "$code" == null ]] && printf null || printf '"%s"' "$code")" "$rollback" \
    "$([[ -z "$backup" ]] && printf null || printf '"%s"' "$backup")" "$OLD_IMAGE_ID" "$NEW_IMAGE_ID" > "$temporary"
  chmod 0600 "$temporary"; chown root:root "$temporary"; mv -T "$temporary" "$status_file"; sync -f "$status_file"
}

compose_old() { /usr/bin/docker compose -p "$PROJECT" -f "$old_deploy/compose.server.yaml" -f "$old_deploy/compose.workflow-production.yaml" "$@"; }
compose_new() { /usr/bin/docker compose -p "$PROJECT" -f "$new_deploy/compose.server.yaml" -f "$new_deploy/compose.workflow-production.yaml" "$@"; }

service_id() { compose_old ps -q "$1"; }
snapshot() {
  local output="$1" service id
  : > "$output"
  for service in admin identity-database identity community-database community caddy; do
    id="$(service_id "$service")"; [[ -n "$id" ]] || fail
    /usr/bin/docker inspect --format "$service|{{.Id}}|{{.Image}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}|{{.State.StartedAt}}" "$id" >> "$output"
  done
}

healthy_six() {
  local service id
  for service in admin identity-database identity community-database community caddy; do
    id="$(service_id "$service")"; [[ -n "$id" ]] || return 1
    [[ "$(/usr/bin/docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$id")" == 'running|healthy' ]] || return 1
  done
}

workflow_counts() {
  local db
  db="$(service_id identity-database)"; [[ -n "$db" ]] || fail
  /usr/bin/docker exec "$db" psql -X -v ON_ERROR_STOP=1 -U aihub -d aihub -At -c \
    "SELECT (SELECT count(*) FROM community_workflow.events)||'|'||(SELECT count(*) FROM community_workflow.idempotency)||'|'||(SELECT last_sequence FROM community_workflow.event_head WHERE singleton=true)||'|'||(SELECT count(*) FROM pg_class WHERE relname IN ('resource_submissions','resource_submission_idempotency','resource_submission_audit','resource_submission_source_revisions','resource_submission_abuse_reports'));"
}

same_other_services() {
  local service
  for service in admin identity-database community-database community caddy; do
    [[ "$(awk -F'|' -v s="$service" '$1==s{print $2"|"$3}' "$before_file")" == "$(awk -F'|' -v s="$service" '$1==s{print $2"|"$3}' "$after_file")" ]] || return 1
  done
}

public_checks() {
  [[ "$(curl --silent --show-error --output /dev/null --max-time 15 --write-out '%{http_code}' 'https://zhenxingai.com/health')" == 200 ]]
  [[ "$(curl --silent --show-error --output /dev/null --max-time 15 --write-out '%{http_code}' 'https://community.zhenxingai.com/')" == 200 ]]
  [[ "$(curl --silent --show-error --max-time 15 'https://zhenxingai.com/software-update-release.json' | sha256sum | awk '{print $1}')" == "$UPDATE_FEED" ]]
  curl --silent --show-error --fail --max-time 15 'https://zhenxingai.com/v1/community/workflow-store/public/list?limit=50' |
    "$new_node" -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const v=JSON.parse(s);if(!Array.isArray(v.items)||v.items.length!==3||v.next!==null)process.exit(1)})'
}

rollback_identity() {
  compose_old up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 identity >/dev/null
  [[ "$(/usr/bin/docker inspect --format '{{.Image}}' "$(service_id identity)")" == "$OLD_IMAGE_ID" ]]
  healthy_six
}

on_exit() {
  local exit_code=$?
  trap - EXIT HUP INT TERM
  if [[ "$finished" != 1 ]]; then
    if [[ "$switched" == 1 ]] && rollback_identity; then write_status failed R28_UPGRADE_FAILED true || true
    elif [[ "$switched" == 1 ]]; then write_status failed R28_ROLLBACK_FAILED false || true
    else write_status failed R28_PREFLIGHT_FAILED false || true
    fi
  fi
  exit "$exit_code"
}

[[ $# -eq 1 && "$1" == run ]] || fail
[[ "${EUID:-$(id -u)}:$(id -g)" == '0:0' && "${SUDO_UID:-}:${SUDO_GID:-}" == '1000:1000' ]] || fail
[[ "$(awk -F: -v expected="/system.slice/$UNIT" '$3==expected{print $3;exit}' /proc/self/cgroup)" == "/system.slice/$UNIT" ]] || fail
[[ "$(realpath -e -- "$0")" == "$CONTROL/upgrade.sh" && ! -L "$0" && "$(stat -c '%u:%g:%a:%h' "$0")" == '0:0:500:1' ]] || fail
[[ -d "$CONTROL" && ! -L "$CONTROL" && -d "$EVIDENCE" && ! -L "$EVIDENCE" && ! -e "$status_file" && ! -L "$status_file" ]] || fail
[[ -d "$OLD_RELEASE" && ! -L "$OLD_RELEASE" && -d "$NEW_RELEASE" && ! -L "$NEW_RELEASE" ]] || fail
[[ -x "$new_node" && ! -L "$new_node" ]] || fail
trap on_exit EXIT HUP INT TERM
write_status running null false

stage='prepared-release'
"$new_node" "$new_deploy/workflow-production-release-bundle.cjs" verify-prepared "$NEW_RELEASE" >/dev/null
set -a
# shellcheck source=/dev/null
source "$new_deploy/workflow-production-fresh-host.env.template"
set +a
[[ "$COMPOSE_PROJECT_NAME" == "$PROJECT" && "$AIHUB_PUBLIC_HOST" == zhenxingai.com && "$AIHUB_COMMUNITY_PUBLIC_HOST" == community.zhenxingai.com ]] || fail

stage='baseline'
healthy_six
snapshot "$before_file"
old_identity_container="$(service_id identity)"
[[ "$(/usr/bin/docker inspect --format '{{.Image}}' "$old_identity_container")" == "$OLD_IMAGE_ID" ]]
[[ "$(/usr/bin/docker inspect --format '{{ index .Config.Labels "com.aihub.source-content-sha256" }}' "$old_identity_container")" == '2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7' ]]
[[ "$(sha "$AIHUB_ADMIN_PUBLISHED_DIR/catalog-store/state.json")" == "$ACTIVE_STATE" ]]
[[ "$(workflow_counts)" == '9|9|9|0' ]]
for relative in "${SQL_FILES[@]}"; do cmp -s "$OLD_RELEASE/$relative" "$NEW_RELEASE/$relative" || fail; done

stage='image-load'
/usr/bin/docker load -i "$NEW_RELEASE/artifacts/identity-r11-image.tar" >/dev/null
[[ "$(/usr/bin/docker image inspect --format '{{.Id}}|{{.Config.User}}|{{ index .Config.Labels "com.aihub.source-content-sha256" }}' "$NEW_IMAGE")" == "$NEW_IMAGE_ID|node|d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8" ]]

stage='backup'
backup="$(/bin/bash "$new_deploy/backup.sh" "$new_deploy/compose.server.yaml" "$new_deploy/compose.workflow-production.yaml" "$BACKUPS")"
[[ "$backup" == "$BACKUPS"/community-production-* && -d "$backup" && ! -L "$backup" ]]
(cd "$backup" && sha256sum -c SHA256SUMS >/dev/null)

stage='restore-drill'
/bin/sh "$new_deploy/restore-drill.sh" "$backup" > "$EVIDENCE/restore-drill.txt"

stage='migration-verify'
/bin/bash "$new_deploy/run-workflow-production-migration.sh" "$new_deploy/compose.server.yaml" "$new_deploy/compose.workflow-production.yaml" "$backup" verify > "$EVIDENCE/migration-verify.txt"
[[ "$(workflow_counts)" == '9|9|9|0' ]]

stage='switch'
switched=1
compose_new up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 identity >/dev/null

stage='health'
snapshot "$after_file"
[[ "$(service_id identity)" != "$old_identity_container" ]]
[[ "$(/usr/bin/docker inspect --format '{{.Image}}' "$(service_id identity)")" == "$NEW_IMAGE_ID" ]]
healthy_six
same_other_services
[[ "$(sha "$AIHUB_ADMIN_PUBLISHED_DIR/catalog-store/state.json")" == "$ACTIVE_STATE" ]]
[[ "$(workflow_counts)" == '9|9|9|0' ]]
public_checks

stage='complete'
write_status succeeded null false
finished=1
trap - EXIT HUP INT TERM
printf '%s\n' 'r28 identity upgrade passed'
