#!/bin/bash
set -euo pipefail

PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
export PATH LC_ALL=C
RUN_ID='workflow-production-r25'
UNIT='zhenxing-ai-workflow-production-r25.service'
SYSTEMD_RUN='/usr/bin/systemd-run'
CONTROL_ROOT='/opt/zhenxing-ai/shared/workflow-production-r25'
EVIDENCE_ROOT='/opt/zhenxing-ai/shared/backups/workflow-production-r25-evidence'
RELEASES_ROOT='/opt/zhenxing-ai/releases'
STATUS_FILE="$CONTROL_ROOT/status.json"
RECEIPT_FILE="$CONTROL_ROOT/receipt.json"
REQUEST_FILE="$CONTROL_ROOT/request.json"
worker_status_finalized=0
worker_failure_stage='worker-context'
worker_failure_code='R16_WORKER_CONTEXT_FAILED'
node=''

fail() { printf '%s\n' 'r25 durable fresh-host launcher blocked' >&2; exit 1; }
sha256_file() { sha256sum -- "$1" | awk '{print $1}'; }
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
script_path="$script_dir/$(basename -- "${BASH_SOURCE[0]}")"
release_root="$(cd "$script_dir/../.." && pwd -P)"

validate_release_path() {
  [[ "$release_root" == "$RELEASES_ROOT"/community-production-r25-* && "$(dirname -- "$release_root")" == "$RELEASES_ROOT" &&
     "$(basename -- "$release_root")" =~ ^community-production-r25-[A-Za-z0-9][A-Za-z0-9-]{5,64}$ &&
     "$script_path" == "$release_root/deployment/community-production/workflow-production-fresh-host-launcher.sh" &&
     -f "$script_path" && ! -L "$script_path" ]] || fail
}
validate_deployment_caller() {
  local uid="${EUID:-$(id -u)}" gid="$(id -g)"
  if [[ "$uid" == 0 ]]; then
    [[ "${SUDO_UID:-}" == 1000 && "${SUDO_GID:-}" == 1000 ]] || fail
  else
    [[ "$uid" == 1000 && "$gid" == 1000 && ! -v SUDO_UID && ! -v SUDO_GID ]] || fail
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
  umask 077
  printf '%s\n' "$content" > "$temporary"
  chmod 0600 "$temporary"
  chown root:root "$temporary"
  mv -T "$temporary" "$target"
  sync -f "$target"
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
  local state="$1" exit_code="$2" failure_stage="${3:-null}" failure_code="${4:-null}" stop_code="${5:-null}"
  case "$state" in queued|running|succeeded|failed) ;; *) fail ;; esac
  case "$failure_stage:$failure_code" in
    null:null|launcher:R16_LAUNCHER_FAILED|launcher:R16_SYSTEMD_RUN_FAILED|worker-context:R16_WORKER_CONTEXT_FAILED|runtime-preflight:R16_RUNTIME_PREFLIGHT_FAILED|prepared-context:R16_PREPARED_CONTEXT_INVALID|prepared-context:R16_INITIALIZE_LAUNCH_FAILED|status-write:R16_STATUS_WRITE_FAILED|launcher:R16_TERMINAL_INVALID|secret-authority:R16_INITIALIZE_LAUNCH_FAILED|image-supply-chain:R16_INITIALIZE_LAUNCH_FAILED|catalog-install:R16_INITIALIZE_LAUNCH_FAILED|database-start:R16_INITIALIZE_LAUNCH_FAILED|identity-migration:R16_INITIALIZE_LAUNCH_FAILED|community-migration:R16_INITIALIZE_LAUNCH_FAILED|reviewer-provision:R16_INITIALIZE_LAUNCH_FAILED|service-start:R16_INITIALIZE_LAUNCH_FAILED|official-bootstrap:R16_INITIALIZE_LAUNCH_FAILED|target-verification:R16_INITIALIZE_LAUNCH_FAILED) ;;
    *) fail ;;
  esac
  case "$stop_code" in null|R16_STOP_FAILED) ;; *) fail ;; esac
  write_json "$STATUS_FILE" "{\"schema\":\"aihub-r25-durable-status-v1\",\"runId\":\"$RUN_ID\",\"unit\":\"$UNIT\",\"state\":\"$state\",\"terminal\":$([[ "$state" == succeeded || "$state" == failed ]] && printf true || printf false),\"exitCode\":$exit_code,\"failureStage\":$([[ "$failure_stage" == null ]] && printf null || printf '\"%s\"' "$failure_stage"),\"failureCode\":$([[ "$failure_code" == null ]] && printf null || printf '\"%s\"' "$failure_code"),\"stopCode\":$([[ "$stop_code" == null ]] && printf null || printf '\"%s\"' "$stop_code")}" 
}
record_worker_exit() {
  local code=$?
  trap - EXIT HUP INT TERM
  if [[ "$worker_status_finalized" != 1 ]]; then
    [[ "$code" != 0 ]] || code=1
    write_status failed "$code" "$worker_failure_stage" "$worker_failure_code" null || true
  fi
  exit "$code"
}
write_request() {
  write_json "$REQUEST_FILE" "{\"schema\":\"aihub-r25-durable-request-v1\",\"runId\":\"$RUN_ID\",\"unit\":\"$UNIT\",\"releaseRoot\":\"$release_root\",\"deploymentSetDigest\":\"$deployment_set_digest\",\"deploymentManifestSha256\":\"$deployment_manifest_sha256\",\"preparedMarkerSha256\":\"$prepared_marker_sha256\",\"bundleManifestSha256\":\"$bundle_manifest_sha256\",\"payloadDigest\":\"$payload_digest\",\"evidenceRoot\":\"$EVIDENCE_ROOT\"}"
}
write_receipt() {
  write_json "$RECEIPT_FILE" "{\"schema\":\"aihub-r25-durable-receipt-v1\",\"accepted\":true,\"runId\":\"$RUN_ID\",\"unit\":\"$UNIT\",\"deploymentSetDigest\":\"$deployment_set_digest\",\"deploymentManifestSha256\":\"$deployment_manifest_sha256\",\"preparedMarkerSha256\":\"$prepared_marker_sha256\",\"bundleManifestSha256\":\"$bundle_manifest_sha256\",\"payloadDigest\":\"$payload_digest\"}"
}
verify_request_controls() {
  [[ -f "$REQUEST_FILE" && ! -L "$REQUEST_FILE" && "$(stat -c '%u:%g %a %h' "$REQUEST_FILE")" == '0:0 600 1' ]] || fail
  local values request_release request_set request_manifest request_marker request_bundle request_payload
  values="$("$node" - "$REQUEST_FILE" <<'NODE'
const fs=require("node:fs");const value=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const keys=["bundleManifestSha256","deploymentManifestSha256","deploymentSetDigest","evidenceRoot","payloadDigest","preparedMarkerSha256","releaseRoot","runId","schema","unit"].sort();
if(!value||Array.isArray(value)||JSON.stringify(Object.keys(value).sort())!==JSON.stringify(keys)||value.schema!=="aihub-r25-durable-request-v1"||value.runId!=="workflow-production-r25"||value.unit!=="zhenxing-ai-workflow-production-r25.service"||value.evidenceRoot!=="/opt/zhenxing-ai/shared/backups/workflow-production-r25-evidence")process.exit(1);
const fields=[value.releaseRoot,value.deploymentSetDigest,value.deploymentManifestSha256,value.preparedMarkerSha256,value.bundleManifestSha256,value.payloadDigest];
if(fields.some((field)=>typeof field!=="string"||field.includes("|")))process.exit(1);process.stdout.write(fields.join("|")+"\n");
NODE
  )" || fail
  IFS='|' read -r request_release request_set request_manifest request_marker request_bundle request_payload <<< "$values"
  read_prepared_controls
  [[ "$request_release" == "$release_root" && "$request_set" == "$deployment_set_digest" &&
     "$request_manifest" == "$deployment_manifest_sha256" && "$request_marker" == "$prepared_marker_sha256" &&
     "$request_bundle" == "$bundle_manifest_sha256" && "$request_payload" == "$payload_digest" ]] || fail
}
unit_absent() {
  local values line load='' active='' sub='' count=0
  values="$(/usr/bin/systemctl show --no-pager --property=LoadState --property=ActiveState --property=SubState "$UNIT")" || fail
  while IFS= read -r line; do
    count=$((count+1))
    case "$line" in LoadState=*) [[ -z "$load" ]] || fail; load="${line#LoadState=}" ;; ActiveState=*) [[ -z "$active" ]] || fail; active="${line#ActiveState=}" ;; SubState=*) [[ -z "$sub" ]] || fail; sub="${line#SubState=}" ;; *) fail ;; esac
  done <<< "$values"
  [[ "$count" == 3 && "$load" == not-found && "$active" == inactive && "$sub" == dead ]] || fail
}
launch() {
  validate_release_path
  validate_deployment_caller
  unit_absent
  [[ -d /opt/zhenxing-ai/shared && ! -L /opt/zhenxing-ai/shared && -d /opt/zhenxing-ai/shared/backups && ! -L /opt/zhenxing-ai/shared/backups ]] || fail
  [[ ! -e "$CONTROL_ROOT" && ! -L "$CONTROL_ROOT" && ! -e "$EVIDENCE_ROOT" && ! -L "$EVIDENCE_ROOT" ]] || fail
  install -d -m 0700 -o root -g root "$CONTROL_ROOT" "$EVIDENCE_ROOT"
  prepare_workflow_node
  read_prepared_controls
  write_request
  write_status queued null
  if ! "$SYSTEMD_RUN" --quiet --unit="$UNIT" --collect --no-block --service-type=exec --property='User=root' --property='Group=root' --property="WorkingDirectory=$script_dir" --property='UMask=0077' --property='NoNewPrivileges=yes' --property='PrivateTmp=yes' --property='StandardOutput=null' --property='StandardError=null' /usr/bin/env -i PATH="$PATH" LC_ALL=C SUDO_UID=1000 SUDO_GID=1000 /bin/bash "$script_path" __run; then
    write_status failed 1 launcher R16_SYSTEMD_RUN_FAILED null
    fail
  fi
  write_receipt
  cat "$RECEIPT_FILE"
}
status() {
  validate_deployment_caller
  [[ -f "$STATUS_FILE" && ! -L "$STATUS_FILE" && "$(stat -c '%u:%g %a %h' "$STATUS_FILE")" == '0:0 600 1' ]] || fail
  cat "$STATUS_FILE"
}
read_terminal() {
  "$node" - "$1" "$2" "$script_dir/workflow-production-fresh-host-terminal.cjs" <<'NODE'
const fs=require("node:fs");const value=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const result=require(process.argv[4]).validateFreshHostTerminal(value,Number(process.argv[3]));process.stdout.write(JSON.stringify(result));
NODE
}
run_worker() {
  trap record_worker_exit EXIT HUP INT TERM
  worker_failure_stage='worker-context'
  worker_failure_code='R16_WORKER_CONTEXT_FAILED'
  validate_release_path
  [[ "${EUID:-$(id -u)}" == 0 && "$(id -g)" == 0 ]] || fail
  [[ "$(awk -F: -v expected="/system.slice/$UNIT" '$3 == expected {print $3;exit}' /proc/self/cgroup)" == "/system.slice/$UNIT" ]] || fail
  worker_failure_stage='runtime-preflight'
  worker_failure_code='R16_RUNTIME_PREFLIGHT_FAILED'
  prepare_workflow_node
  worker_failure_stage='prepared-context'
  worker_failure_code='R16_PREPARED_CONTEXT_INVALID'
  verify_request_controls
  worker_failure_stage='status-write'
  worker_failure_code='R16_STATUS_WRITE_FAILED'
  write_status running null
  worker_failure_stage='launcher'
  worker_failure_code='R16_LAUNCHER_FAILED'
  local output="$CONTROL_ROOT/.worker-terminal.$$" validated code
  umask 077
  set +e
  /usr/bin/env -i PATH="$PATH" LC_ALL=C /bin/bash "$script_dir/workflow-production-fresh-host-runner.sh" __run > "$output"
  code=$?
  set -e
  chmod 0600 "$output"; chown root:root "$output"
  if ! validated="$(read_terminal "$output" "$code")"; then
    rm -f -- "$output"
    write_status failed 1 launcher R16_TERMINAL_INVALID null
    worker_status_finalized=1
    exit 1
  fi
  rm -f -- "$output"
  IFS='|' read -r state stage failure stop < <("$node" -e 'const v=JSON.parse(process.argv[1]);process.stdout.write([v.status,v.stage||"null",v.code||"null",v.stopCode||"null"].join("|")+"\n")' "$validated")
  if [[ "$state" == pass ]]; then write_status succeeded 0 null null null
  else write_status failed 1 "$stage" "$failure" "$stop"; fi
  worker_status_finalized=1
  [[ "$state" == pass ]]
}

[[ $# -eq 1 ]] || fail
case "$1" in launch) launch ;; status) status ;; __run) run_worker ;; *) fail ;; esac
