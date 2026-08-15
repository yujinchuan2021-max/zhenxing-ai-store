#!/bin/bash
set -euo pipefail

PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
export PATH LC_ALL=C
RUN_ID='workflow-production-r12'
UNIT='zhenxing-ai-workflow-production-r12.service'
SYSTEMD_RUN='/usr/bin/systemd-run'
PROJECT='zhenxing-community-production'
SHARED_ROOT='/opt/zhenxing-ai/shared'
CONTROL_ROOT='/opt/zhenxing-ai/shared/workflow-production-r12'
BACKUP_ROOT='/opt/zhenxing-ai/shared/backups'
EVIDENCE_ROOT='/opt/zhenxing-ai/shared/backups/workflow-production-r12-evidence'
RELEASES_ROOT='/opt/zhenxing-ai/releases'
DEPLOY_UID='1000'
DEPLOY_GID='1000'
STATUS_FILE="$CONTROL_ROOT/status.json"
RECEIPT_FILE="$CONTROL_ROOT/receipt.json"
REQUEST_FILE="$CONTROL_ROOT/request.json"
ENVIRONMENT_FILE="$CONTROL_ROOT/environment.sh"
worker_status_finalized=0

fail() { printf '%s\n' 'r12 durable launcher blocked' >&2; exit 1; }
sha256_file() { sha256sum -- "$1" | awk '{print $1}'; }
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
script_path="$script_dir/$(basename -- "${BASH_SOURCE[0]}")"
release_root="$(cd "$script_dir/../.." && pwd -P)"
node=''

validate_release_path() {
  [[ "$release_root" == "$RELEASES_ROOT"/community-production-r12-* && "$(dirname -- "$release_root")" == "$RELEASES_ROOT" &&
     "$(basename -- "$release_root")" =~ ^community-production-r12-[A-Za-z0-9][A-Za-z0-9-]{5,64}$ &&
     "$script_path" == "$release_root/deployment/community-production/workflow-production-r12-launcher.sh" &&
     -f "$script_path" && ! -L "$script_path" ]] || fail
}
validate_deployment_caller() {
  local uid="${EUID:-$(id -u)}" gid="$(id -g)"
  if [[ "$uid" == 0 ]]; then
    [[ "${SUDO_UID:-}" == "$DEPLOY_UID" && "${SUDO_GID:-}" == "$DEPLOY_GID" ]] || fail
  else
    [[ "$uid" == "$DEPLOY_UID" && "$gid" == "$DEPLOY_GID" && ! -v SUDO_UID && ! -v SUDO_GID ]] || fail
  fi
}
prepare_workflow_node() {
  # shellcheck source=/dev/null
  source "$script_dir/workflow-node-runtime.sh"
  preflight_workflow_node_runtime
  node="$(prepare_workflow_node_runtime)"
}

write_json() {
  local target="$1" content="$2" temporary="$CONTROL_ROOT/.${1##*/}.$$"
  umask 077; printf '%s\n' "$content" > "$temporary"; chmod 0600 "$temporary"; chown "$DEPLOY_UID:$DEPLOY_GID" "$temporary"; mv -T "$temporary" "$target"; sync -f "$target"
}
read_prepared_controls() {
  local marker="$release_root/.aihub-workflow-release-prepared.json"
  "$node" "$script_dir/workflow-production-release-bundle.cjs" verify-prepared "$release_root" >/dev/null
  prepared_marker_sha256="$(sha256_file "$marker")"
  deployment_manifest_sha256="$(sha256_file "$script_dir/manifest.json")"
  bundle_manifest_sha256="$(sha256_file "$release_root/.aihub-workflow-release-bundle.json")"
  IFS='|' read -r deployment_set_digest marker_manifest_sha256 payload_digest < <(
    "$node" - "$marker" <<'NODE'
const fs=require("node:fs");const value=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));const hex=/^[0-9a-f]{64}$/;
const keys=["deploymentSetDigest","deploymentManifestSha256","payloadDigest"];
if(value.format!=="aihub-workflow-production-release-prepared-v1"||value.verified!==true||keys.some((key)=>!hex.test(value[key]||"")))process.exit(1);
process.stdout.write(keys.map((key)=>value[key]).join("|")+"\n");
NODE
  )
  [[ "$marker_manifest_sha256" == "$deployment_manifest_sha256" ]] || fail
}
write_status() {
  local state="$1" exit_code="$2" failure_stage="${3:-null}" failure_code="${4:-null}" rollback_code="${5:-null}"
  case "$state" in queued|running|succeeded|failed) ;; *) fail ;; esac
  case "$failure_stage" in null|launcher|prepared-context|backup|recreate-admin|recreate-identity|activation|workflow-migration|reviewer-provision|official-bootstrap|target-verification) ;; *) fail ;; esac
  case "$failure_code" in null|R12_STEP_FAILED|R12_ROLLBACK_FAILED|R12_PREPARED_CONTEXT_INVALID|R12_LAUNCHER_FAILED|R12_TERMINAL_INVALID) ;; *) fail ;; esac
  case "$rollback_code" in null|R12_ROLLBACK_FAILED) ;; *) fail ;; esac
  local terminal
  terminal="{\"schema\":\"aihub-r12-durable-status-v1\",\"runId\":\"$RUN_ID\",\"unit\":\"$UNIT\",\"state\":\"$state\",\"terminal\":$([[ "$state" == succeeded || "$state" == failed ]] && printf true || printf false),\"exitCode\":$exit_code,\"failureStage\":$([[ "$failure_stage" == null ]] && printf null || printf '\"%s\"' "$failure_stage"),\"failureCode\":$([[ "$failure_code" == null ]] && printf null || printf '\"%s\"' "$failure_code"),\"rollbackCode\":$([[ "$rollback_code" == null ]] && printf null || printf '\"%s\"' "$rollback_code")}"
  write_json "$STATUS_FILE" "$terminal"
}
record_worker_exit() {
  local code=$?
  trap - EXIT HUP INT TERM
  if [[ "$worker_status_finalized" != 1 ]]; then
    [[ "$code" != 0 ]] || code=1
    write_status failed "$code" launcher R12_LAUNCHER_FAILED null || true
  fi
  exit "$code"
}
validate_environment_value() {
  local name="$1" value="$2"
  [[ -n "$value" && "$value" != *$'\n'* && "$value" != *$'\r'* && "$value" != *$'\t'* ]] || fail
  case "$name" in
    COMPOSE_PROJECT_NAME) [[ "$value" == "$PROJECT" ]] || fail ;;
    AIHUB_*_DIR) [[ "$value" == /* && -d "$value" && ! -L "$value" && "$(realpath -e -- "$value")" == "$value" ]] || fail ;;
    AIHUB_PUBLIC_HOST|AIHUB_COMMUNITY_PUBLIC_HOST) [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9.-]{0,252}[A-Za-z0-9]$ ]] || fail ;;
    AIHUB_CADDY_*_VOLUME) [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail ;;
    AIHUB_FORUM_ADMIN_EMAIL) [[ "$value" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || fail ;;
    *) fail ;;
  esac
}
write_environment() {
  local temporary="$CONTROL_ROOT/.environment.$$" name value
  local names=(COMPOSE_PROJECT_NAME AIHUB_ADMIN_DATA_DIR AIHUB_ADMIN_PUBLISHED_DIR AIHUB_ADMIN_OUTPUT_DIR AIHUB_IDENTITY_DB_DIR AIHUB_COMMUNITY_DB_DIR AIHUB_COMMUNITY_CONFIG_DIR AIHUB_COMMUNITY_STORAGE_DIR AIHUB_COMMUNITY_ASSETS_DIR AIHUB_SECRET_DIR AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR AIHUB_PUBLIC_HOST AIHUB_COMMUNITY_PUBLIC_HOST AIHUB_CADDY_DATA_VOLUME AIHUB_CADDY_CONFIG_VOLUME AIHUB_CADDY_CMS_SECRET_VOLUME AIHUB_FORUM_ADMIN_EMAIL)
  umask 077; : > "$temporary"
  for name in "${names[@]}"; do
    [[ -v "$name" ]] || fail
    value="${!name}"; validate_environment_value "$name" "$value"
    printf 'export %s=%q\n' "$name" "$value" >> "$temporary"
  done
  chmod 0600 "$temporary"; chown "$DEPLOY_UID:$DEPLOY_GID" "$temporary"; mv -T "$temporary" "$ENVIRONMENT_FILE"
}
write_request() {
  write_json "$REQUEST_FILE" "{\"schema\":\"aihub-r12-durable-request-v1\",\"runId\":\"$RUN_ID\",\"unit\":\"$UNIT\",\"releaseRoot\":\"$release_root\",\"deploymentSetDigest\":\"$deployment_set_digest\",\"deploymentManifestSha256\":\"$deployment_manifest_sha256\",\"preparedMarkerSha256\":\"$prepared_marker_sha256\",\"bundleManifestSha256\":\"$bundle_manifest_sha256\",\"payloadDigest\":\"$payload_digest\",\"backupRoot\":\"$BACKUP_ROOT\",\"evidenceRoot\":\"$EVIDENCE_ROOT\"}"
}
write_receipt() {
  write_json "$RECEIPT_FILE" "{\"schema\":\"aihub-r12-durable-receipt-v1\",\"accepted\":true,\"runId\":\"$RUN_ID\",\"unit\":\"$UNIT\",\"deploymentSetDigest\":\"$deployment_set_digest\",\"deploymentManifestSha256\":\"$deployment_manifest_sha256\",\"preparedMarkerSha256\":\"$prepared_marker_sha256\",\"bundleManifestSha256\":\"$bundle_manifest_sha256\",\"payloadDigest\":\"$payload_digest\",\"statusPath\":\"$STATUS_FILE\",\"evidenceRoot\":\"$EVIDENCE_ROOT\"}"
}
verify_request_controls() {
  local request_values request_release request_set request_manifest request_marker request_bundle request_payload
  [[ -f "$REQUEST_FILE" && ! -L "$REQUEST_FILE" && "$(stat -c '%u:%g %a %h' "$REQUEST_FILE")" == "$DEPLOY_UID:$DEPLOY_GID 600 1" ]] || fail
  request_values="$("$node" - "$REQUEST_FILE" <<'NODE'
const fs=require("node:fs");const value=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const allowed=["backupRoot","bundleManifestSha256","deploymentManifestSha256","deploymentSetDigest","evidenceRoot","payloadDigest","preparedMarkerSha256","releaseRoot","runId","schema","unit"].sort();
if(!value||Array.isArray(value)||JSON.stringify(Object.keys(value).sort())!==JSON.stringify(allowed)||value.schema!=="aihub-r12-durable-request-v1"||value.runId!=="workflow-production-r12"||value.unit!=="zhenxing-ai-workflow-production-r12.service"||value.backupRoot!=="/opt/zhenxing-ai/shared/backups"||value.evidenceRoot!=="/opt/zhenxing-ai/shared/backups/workflow-production-r12-evidence")process.exit(1);
const fields=[value.releaseRoot,value.deploymentSetDigest,value.deploymentManifestSha256,value.preparedMarkerSha256,value.bundleManifestSha256,value.payloadDigest];
if(fields.some((field)=>typeof field!=="string"||field.includes("|")))process.exit(1);process.stdout.write(fields.join("|")+"\n");
NODE
  )" || fail
  IFS='|' read -r request_release request_set request_manifest request_marker request_bundle request_payload <<< "$request_values"
  read_prepared_controls
  [[ "$request_release" == "$release_root" && "$request_set" == "$deployment_set_digest" &&
     "$request_manifest" == "$deployment_manifest_sha256" && "$request_marker" == "$prepared_marker_sha256" &&
     "$request_bundle" == "$bundle_manifest_sha256" && "$request_payload" == "$payload_digest" ]] || fail
}
unit_absent() {
  local values line load='' active='' sub='' count=0
  values="$(/usr/bin/systemctl show --no-pager --property=LoadState --property=ActiveState --property=SubState "$UNIT")" || fail
  while IFS= read -r line; do
    count=$((count + 1))
    case "$line" in LoadState=*) [[ -z "$load" ]] || fail; load="${line#LoadState=}" ;; ActiveState=*) [[ -z "$active" ]] || fail; active="${line#ActiveState=}" ;; SubState=*) [[ -z "$sub" ]] || fail; sub="${line#SubState=}" ;; *) fail ;; esac
  done <<< "$values"
  [[ "$count" == 3 && "$load" == not-found && "$active" == inactive && "$sub" == dead ]] || fail
}
launch() {
  validate_release_path
  validate_deployment_caller
  [[ -d "$SHARED_ROOT" && ! -L "$SHARED_ROOT" && "$(realpath -e -- "$SHARED_ROOT")" == "$SHARED_ROOT" ]] || fail
  [[ -d "$BACKUP_ROOT" && ! -L "$BACKUP_ROOT" && "$(realpath -e -- "$BACKUP_ROOT")" == "$BACKUP_ROOT" ]] || fail
  unit_absent
  [[ ! -e "$CONTROL_ROOT" && ! -L "$CONTROL_ROOT" && ! -e "$EVIDENCE_ROOT" && ! -L "$EVIDENCE_ROOT" ]] || fail
  install -d -m 0700 -o "$DEPLOY_UID" -g "$DEPLOY_GID" "$CONTROL_ROOT" "$EVIDENCE_ROOT"
  prepare_workflow_node
  read_prepared_controls
  write_environment
  write_request
  write_status queued null
  local runner=("$SYSTEMD_RUN")
  if [[ "${EUID:-$(id -u)}" != 0 ]]; then runner=(sudo -n "$SYSTEMD_RUN"); fi
  if ! "${runner[@]}" --quiet --unit="$UNIT" --collect --no-block --service-type=exec --property="User=$DEPLOY_UID" --property="Group=$DEPLOY_GID" --property="WorkingDirectory=$script_dir" --property='UMask=0077' --property='NoNewPrivileges=yes' --property='PrivateTmp=yes' --property='StandardOutput=null' --property='StandardError=null' /usr/bin/env -i PATH="$PATH" LC_ALL=C /bin/bash "$script_path" __run; then
    write_status failed 1 launcher R12_LAUNCHER_FAILED null
    fail
  fi
  write_receipt
  cat "$RECEIPT_FILE"
}
status() { validate_deployment_caller; [[ -f "$STATUS_FILE" && ! -L "$STATUS_FILE" && "$(stat -c '%u:%g %a %h' "$STATUS_FILE")" == "$DEPLOY_UID:$DEPLOY_GID 600 1" ]] || fail; cat "$STATUS_FILE"; }
read_terminal() {
  local terminal_file="$1" command_code="$2"
  "$node" - "$terminal_file" "$command_code" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2]; const commandCode = Number(process.argv[3]);
const stages = new Set(["prepared-context", "backup", "recreate-admin", "recreate-identity", "activation", "workflow-migration", "reviewer-provision", "official-bootstrap", "target-verification"]);
const codes = new Set(["R12_STEP_FAILED", "R12_PREPARED_CONTEXT_INVALID"]);
try {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  const keys = ["schema", "status", "runId", "stage", "code", "rollbackCode"];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key)) || value.schema !== "aihub-r12-terminal-v1" || value.runId !== "workflow-production-r12") throw new Error();
  if (commandCode === 0 && value.status === "pass" && value.stage === null && value.code === null && value.rollbackCode === null) process.stdout.write("pass|null|null|null");
  else if (commandCode !== 0 && value.status === "blocked" && stages.has(value.stage) && codes.has(value.code) && (value.rollbackCode === null || value.rollbackCode === "R12_ROLLBACK_FAILED")) process.stdout.write(`blocked|${value.stage}|${value.code}|${value.rollbackCode || "null"}`);
  else throw new Error();
} catch { process.exitCode = 1; }
NODE
}
run_worker() {
  trap record_worker_exit EXIT HUP INT TERM
  validate_release_path
  [[ "${EUID:-$(id -u)}" == "$DEPLOY_UID" && "$(id -g)" == "$DEPLOY_GID" ]] || fail
  [[ "$(awk -F: -v expected="/system.slice/$UNIT" '$3 == expected { print $3; exit }' /proc/self/cgroup)" == "/system.slice/$UNIT" ]] || fail
  prepare_workflow_node
  verify_request_controls
  [[ -f "$ENVIRONMENT_FILE" && ! -L "$ENVIRONMENT_FILE" && "$(stat -c '%u:%g %a %h' "$ENVIRONMENT_FILE")" == "$DEPLOY_UID:$DEPLOY_GID 600 1" ]] || fail
  # shellcheck source=/dev/null
  source "$ENVIRONMENT_FILE"
  write_status running null
  set +e
  local terminal_file="$CONTROL_ROOT/.coordinator-terminal.$$" terminal
  umask 077
  /usr/bin/env -i PATH="$PATH" LC_ALL=C "$node" "$script_dir/workflow-production-r12-prepared-coordinator.cjs" > "$terminal_file"
  local code=$?
  set -e
  chmod 0600 "$terminal_file"; chown "$DEPLOY_UID:$DEPLOY_GID" "$terminal_file"
  if ! terminal="$(read_terminal "$terminal_file" "$code")"; then
    rm -f -- "$terminal_file"
    write_status failed 1 launcher R12_TERMINAL_INVALID null
    worker_status_finalized=1
    exit 1
  fi
  rm -f -- "$terminal_file"
  IFS='|' read -r terminal_status terminal_stage terminal_code terminal_rollback <<< "$terminal"
  if [[ "$terminal_status" == pass ]]; then write_status succeeded 0 null null null
  else write_status failed 1 "$terminal_stage" "$terminal_code" "$terminal_rollback"; fi
  worker_status_finalized=1
  [[ "$terminal_status" == pass ]] && exit 0 || exit 1
}
[[ $# -eq 1 ]] || fail
case "$1" in launch) launch ;; status) status ;; __run) run_worker ;; *) fail ;; esac
