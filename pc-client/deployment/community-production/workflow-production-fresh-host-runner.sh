#!/bin/bash
set -euo pipefail

PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
export PATH LC_ALL=C
[[ -z "${NODE_PATH+x}" && -z "${NODE_OPTIONS+x}" && -z "${DOCKER_HOST+x}" && -z "${DOCKER_CONTEXT+x}" && -z "${COMPOSE_FILE+x}" ]] || exit 1
RUN_ID='workflow-production-r25'
PROJECT='zhenxing-community-production'
CONTROL_ROOT='/opt/zhenxing-ai/shared/workflow-production-r25'
EVIDENCE_ROOT='/opt/zhenxing-ai/shared/backups/workflow-production-r25-evidence'
TARGET_ADMIN='zhenxing-ai/admin:0.1.40-src-186ff057efd3'
TARGET_IDENTITY='zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e'
TARGET_FLARUM='zhenxing-ai/flarum:community-candidate-8b13962a36bf'
POSTGRES='postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'
MARIADB='mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4'
CADDY='caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'

stage='prepared-context'
asset_writes=true
secret_writes=false
catalog_writes=false
database_writes=false
services_started=false
terminal_finalized=0
compose=()

fail() { exit 1; }
boolean() { [[ "$1" == true ]] && printf true || printf false; }
write_terminal() {
  local status="$1" stop_code="$2" stopped="$3" healthy="$4" output="$CONTROL_ROOT/terminal.json" temporary="$CONTROL_ROOT/.terminal.$$"
  local code='null' stage_json='null' counts='null'
  if [[ "$status" == failed ]]; then
    code='"R16_INITIALIZE_LAUNCH_FAILED"'
    stage_json="\"$stage\""
  else
    counts=3
  fi
  umask 077
  printf '{"schema":"aihub-workflow-production-fresh-host-terminal-v1","status":"%s","runId":"workflow-production-r25","stage":%s,"code":%s,"stopCode":%s,"serverConnected":true,"serverWritten":true,"assetWrites":%s,"secretWrites":%s,"catalogWrites":%s,"databaseWrites":%s,"servicesStarted":%s,"productionExposed":%s,"servicesHealthy":%s,"servicesStoppedOnFailure":%s,"sourcePosts":%s,"events":%s,"idempotency":%s,"eventHead":%s,"publicWorkflowCount":%s,"resourceTablesAbsent":%s,"secretValuesEmitted":false}\n' \
    "$status" "$stage_json" "$code" "$stop_code" "$(boolean "$asset_writes")" "$(boolean "$secret_writes")" \
    "$(boolean "$catalog_writes")" "$(boolean "$database_writes")" "$(boolean "$services_started")" \
    "$([[ "$status" == pass ]] && printf true || printf false)" "$healthy" "$(boolean "$stopped")" \
    "$counts" "$([[ "$status" == pass ]] && printf 9 || printf null)" "$([[ "$status" == pass ]] && printf 9 || printf null)" \
    "$([[ "$status" == pass ]] && printf 9 || printf null)" "$counts" "$([[ "$status" == pass ]] && printf true || printf null)" > "$temporary"
  chmod 0600 "$temporary"; chown root:root "$temporary"; mv -T "$temporary" "$output"; sync -f "$output"
}
on_exit() {
  local code=$?
  trap - EXIT HUP INT TERM
  if [[ "$terminal_finalized" != 1 ]]; then
    [[ "$code" != 0 ]] || code=1
    local stopped=false stop_code=null
    if [[ "$services_started" == true ]]; then
      stop_code='"R16_STOP_FAILED"'
      write_terminal failed "$stop_code" false 0 || true
      if [[ ${#compose[@]} -gt 0 ]] && AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "${compose[@]}" stop caddy community identity admin community-database identity-database >/dev/null 2>&1; then
        stopped=true; stop_code=null
      fi
    fi
    write_terminal failed "$stop_code" "$stopped" 0 || true
    cat "$CONTROL_ROOT/terminal.json" 2>/dev/null || true
  fi
  exit "$code"
}
trap on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

[[ $# -eq 1 && "$1" == __run ]] || fail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
release_root="$(cd "$script_dir/../.." && pwd -P)"
[[ "$release_root" == /opt/zhenxing-ai/releases/community-production-r25-* && ! -L "$script_dir" ]] || fail
runtime="$release_root/.workflow-runtime/node-v24.18.1-linux-x64/bin/node"
[[ -f "$runtime" && ! -L "$runtime" && "$(stat -c '%u:%g:%a:%h' "$runtime")" == '1000:1000:555:1' ]] || fail
"$runtime" "$script_dir/workflow-production-release-bundle.cjs" verify-prepared "$release_root" >/dev/null 2>&1
[[ -d "$CONTROL_ROOT" && ! -L "$CONTROL_ROOT" && -d "$EVIDENCE_ROOT" && ! -L "$EVIDENCE_ROOT" ]] || fail

env_template="$script_dir/workflow-production-fresh-host.env.template"
[[ -f "$env_template" && ! -L "$env_template" ]] || fail
set -a
# shellcheck source=/dev/null
source "$env_template"
set +a
[[ "$AIHUB_FRESH_HOST_LOGIN_USER" == admin && "$COMPOSE_PROJECT_NAME" == "$PROJECT" && "$AIHUB_ADMIN_CMS_IMAGE" == "$TARGET_ADMIN" ]] || fail
base="$script_dir/compose.server.yaml"
overlay="$script_dir/compose.workflow-production.yaml"
compose=(/usr/bin/docker compose -p "$PROJECT" -f "$base" -f "$overlay")
preflight=("$runtime" "$script_dir/workflow-production-fresh-host-preflight.cjs")
"${preflight[@]}" preflight > "$CONTROL_ROOT/preflight.json"
chmod 0600 "$CONTROL_ROOT/preflight.json"

stage='secret-authority'
secret_writes=true
/bin/bash "$script_dir/workflow-production-fresh-secret-authority.sh" issue > "$CONTROL_ROOT/secret-authority.json"
chmod 0600 "$CONTROL_ROOT/secret-authority.json"

stage='image-supply-chain'
"$runtime" "$script_dir/workflow-image-archive.cjs" verify-flarum "$release_root/artifacts/flarum-8b13962a36bf.tar" >/dev/null 2>&1
/usr/bin/docker load -i "$release_root/artifacts/admin-active7-image.tar" >/dev/null 2>&1
/usr/bin/docker load -i "$release_root/artifacts/identity-r11-image.tar" >/dev/null 2>&1
/usr/bin/docker load -i "$release_root/artifacts/flarum-8b13962a36bf.tar" >/dev/null 2>&1
/usr/bin/docker pull "$POSTGRES" >/dev/null 2>&1
/usr/bin/docker pull "$MARIADB" >/dev/null 2>&1
/usr/bin/docker pull "$CADDY" >/dev/null 2>&1
[[ "$(/usr/bin/docker image inspect --format '{{.Id}}' "$TARGET_ADMIN")" == sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd ]] || fail
[[ "$(/usr/bin/docker image inspect --format '{{.Id}}' "$TARGET_IDENTITY")" == sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748 ]] || fail
[[ "$(/usr/bin/docker image inspect --format '{{.Id}}' "$TARGET_FLARUM")" == sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12 ]] || fail

/usr/bin/docker volume create "$AIHUB_CADDY_DATA_VOLUME" >/dev/null
/usr/bin/docker volume create "$AIHUB_CADDY_CONFIG_VOLUME" >/dev/null
SUDO_UID=1000 SUDO_GID=1000 /bin/bash "$script_dir/seed-caddy-secret-volume.sh" "$AIHUB_CADDY_CMS_SECRET_VOLUME" "$AIHUB_SECRET_DIR/community_cms_gateway" >/dev/null

stage='catalog-install'
catalog_writes=true
"$runtime" "$script_dir/catalog-active7-fresh-install.cjs" > "$CONTROL_ROOT/catalog-install.json"
chmod 0600 "$CONTROL_ROOT/catalog-install.json"
AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "${compose[@]}" config --format json >/dev/null 2>&1

stage='database-start'
database_writes=true
services_started=true
AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "${compose[@]}" up -d --no-build --pull never --wait --wait-timeout 180 identity-database community-database admin >/dev/null 2>&1

stage='identity-migration'
AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "${compose[@]}" --profile migration run --rm --no-deps identity-migrate >/dev/null 2>&1
stage='community-migration'
AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "${compose[@]}" --profile migration run --rm --no-deps community-migrate >/dev/null 2>&1

stage='reviewer-provision'
coproc REVIEWER {
  AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "${compose[@]}" --profile workflow-reviewer-provision run --rm -T --no-deps \
    -e AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE=hold workflow-reviewer-provision 2>/dev/null
}
IFS= read -r reviewer_ready <&"${REVIEWER[0]}" || fail
printf '%s' "$reviewer_ready" | "$runtime" -e '
const fs=require("node:fs");const v=JSON.parse(fs.readFileSync(0,"utf8"));
if(v.phase!=="ready"||typeof v.identityMigrationCreated!=="boolean"||typeof v.workflowMigrationCreated!=="boolean")process.exit(1);' || fail
printf '%s\n' commit >&"${REVIEWER[1]}"
wait "$REVIEWER_PID" || fail

stage='service-start'
AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 identity >/dev/null 2>&1
AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 community >/dev/null 2>&1
AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 caddy >/dev/null 2>&1

stage='official-bootstrap'
AIHUB_ADMIN_CMS_IMAGE="$TARGET_ADMIN" "$runtime" "$script_dir/workflow-official-bootstrap-production-wrapper.cjs" \
  "$EVIDENCE_ROOT" http://127.0.0.1:4173 "$AIHUB_PUBLIC_HOST" "$base" "$overlay" >/dev/null 2>&1

stage='target-verification'
"${preflight[@]}" target > "$CONTROL_ROOT/target.json"
chmod 0600 "$CONTROL_ROOT/target.json"
"$runtime" - "$CONTROL_ROOT/target.json" <<'NODE'
const fs=require("node:fs");const v=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const keys=["schema","status","phase","preparedExact","environmentExact","servicesHealthy","sourcePosts","events","idempotency","eventHead","resourceTablesAbsent","publicWorkflowCount","secretValuesEmitted","initializeAuthorized","launchAuthorized"];
if(JSON.stringify(Object.keys(v))!==JSON.stringify(keys)||v.schema!=="aihub-workflow-production-fresh-host-preflight-v1"||v.status!=="pass"||v.phase!=="target"||v.servicesHealthy!==6||v.sourcePosts!==3||v.events!==9||v.idempotency!==9||v.eventHead!==9||v.publicWorkflowCount!==3||v.resourceTablesAbsent!==true||v.secretValuesEmitted!==false)process.exit(1);
NODE

write_terminal pass null false 6
terminal_finalized=1
trap - EXIT HUP INT TERM
cat "$CONTROL_ROOT/terminal.json"
