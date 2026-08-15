#!/bin/bash
set -euo pipefail

PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
export PATH LC_ALL=C

RUN_ID='workflow-production-r11'
UNIT='zhenxing-ai-workflow-production-r11.service'
SYSTEMD_RUN='/usr/bin/systemd-run'
DEPLOY_UID='1000'
DEPLOY_GID='1000'
SHARED_ROOT='/opt/zhenxing-ai/shared'
CONTROL_ROOT='/opt/zhenxing-ai/shared/workflow-production-r11'
BACKUP_ROOT='/opt/zhenxing-ai/shared/backups'
EVIDENCE_ROOT='/opt/zhenxing-ai/shared/backups/workflow-production-r11-evidence'
RELEASES_ROOT='/opt/zhenxing-ai/releases'
STATUS_FILE="$CONTROL_ROOT/status.json"
RECEIPT_FILE="$CONTROL_ROOT/receipt.json"
REQUEST_FILE="$CONTROL_ROOT/request.json"
ENVIRONMENT_FILE="$CONTROL_ROOT/environment.sh"
worker_status_finalized=0

fail() { printf '%s\n' "$1" >&2; exit 1; }
sha256_file() { sha256sum -- "$1" | awk '{print $1}'; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
script_path="$script_dir/$(basename -- "${BASH_SOURCE[0]}")"
release_root="$(cd "$script_dir/../.." && pwd -P)"
base="$script_dir/compose.server.yaml"
overlay="$script_dir/compose.workflow-production.yaml"
identity_archive="$release_root/artifacts/identity-r11-image.tar"

validate_release_path() {
  [[ "$release_root" == "$RELEASES_ROOT"/community-production-* &&
     "$(dirname -- "$release_root")" == "$RELEASES_ROOT" &&
     "$(basename -- "$release_root")" =~ ^community-production-[A-Za-z0-9][A-Za-z0-9-]{5,80}$ ]] ||
    fail "Workflow durable launcher is not in a canonical prepared release"
  [[ "$script_path" == "$release_root/deployment/community-production/workflow-production-cutover-launcher.sh" &&
     -f "$script_path" && ! -L "$script_path" ]] ||
    fail "Workflow durable launcher path is invalid"
}

validate_deployment_caller() {
  local current_uid current_gid
  current_uid="${EUID:-$(id -u)}"
  current_gid="$(id -g)"
  if [[ "$current_uid" == '0' ]]; then
    [[ "${SUDO_UID:-}" == "$DEPLOY_UID" && "${SUDO_GID:-}" == "$DEPLOY_GID" ]] ||
      fail "Workflow durable launcher root caller is not the approved sudo deployment identity"
  else
    [[ "$current_uid" == "$DEPLOY_UID" && "$current_gid" == "$DEPLOY_GID" &&
       ! -v SUDO_UID && ! -v SUDO_GID ]] ||
      fail "Workflow durable launcher caller is not the approved deployment identity"
  fi
}

validate_control_file() {
  local file="$1" mode="$2" metadata
  [[ -f "$file" && ! -L "$file" ]] || fail "Workflow durable control file is unavailable"
  metadata="$(stat -c '%u:%g %a %h' -- "$file")"
  [[ "$metadata" == "$DEPLOY_UID:$DEPLOY_GID $mode 1" ]] ||
    fail "Workflow durable control file metadata drifted"
}

write_status() {
  local state="$1" exit_code="$2" evidence_path="$3" temporary
  temporary="$CONTROL_ROOT/.status.$$"
  [[ ! -e "$temporary" && ! -L "$temporary" ]] || fail "Workflow durable status temporary file exists"
  umask 077
  printf '{"schema":"aihub-workflow-production-durable-status-v1","runId":"%s","unit":"%s","state":"%s","exitCode":%s,"evidenceRoot":"%s","evidencePath":%s,"updatedAt":"%s"}\n' \
    "$RUN_ID" "$UNIT" "$state" "$exit_code" "$EVIDENCE_ROOT" \
    "$([[ -n "$evidence_path" ]] && printf '"%s"' "$evidence_path" || printf 'null')" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$temporary"
  chmod 0600 -- "$temporary"
  chown "$DEPLOY_UID:$DEPLOY_GID" -- "$temporary"
  mv -T -- "$temporary" "$STATUS_FILE"
  sync -f "$STATUS_FILE"
}

record_worker_exit() {
  local worker_status=$?
  trap - EXIT
  if [[ "$worker_status_finalized" != '1' ]]; then
    [[ "$worker_status" -ne 0 ]] || worker_status=1
    write_status "failed" "$worker_status" "" || true
  fi
  exit "$worker_status"
}

prepare_workflow_node() {
  source "$script_dir/workflow-node-runtime.sh"
  preflight_workflow_node_runtime
  workflow_node="$(prepare_workflow_node_runtime)"
}

read_prepared_controls() {
  local marker="$release_root/.aihub-workflow-release-prepared.json"
  "$workflow_node" "$script_dir/workflow-production-release-bundle.cjs" verify-prepared "$release_root" >/dev/null
  prepared_marker_sha256="$(sha256_file "$marker")"
  deployment_manifest_sha256="$(sha256_file "$script_dir/manifest.json")"
  bundle_manifest_sha256="$(sha256_file "$release_root/.aihub-workflow-release-bundle.json")"
  IFS='|' read -r deployment_set_digest marker_manifest_sha256 payload_digest < <(
    "$workflow_node" - "$marker" <<'NODE'
const fs = require("node:fs");
const value = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const hex = /^[0-9a-f]{64}$/;
for (const key of ["deploymentSetDigest", "deploymentManifestSha256", "payloadDigest"]) {
  if (!hex.test(value[key] || "")) process.exit(1);
}
if (value.format !== "aihub-workflow-production-release-prepared-v1" || value.verified !== true) process.exit(1);
process.stdout.write(`${value.deploymentSetDigest}|${value.deploymentManifestSha256}|${value.payloadDigest}\n`);
NODE
  )
  [[ "$marker_manifest_sha256" == "$deployment_manifest_sha256" ]] ||
    fail "Workflow durable prepared manifest hash drifted"
}

write_request() {
  local temporary="$CONTROL_ROOT/.request.$$"
  umask 077
  printf '{"schema":"aihub-workflow-production-durable-request-v1","runId":"%s","unit":"%s","releaseRoot":"%s","deploymentSetDigest":"%s","deploymentManifestSha256":"%s","preparedMarkerSha256":"%s","bundleManifestSha256":"%s","payloadDigest":"%s","backupRoot":"%s","evidenceRoot":"%s"}\n' \
    "$RUN_ID" "$UNIT" "$release_root" "$deployment_set_digest" "$deployment_manifest_sha256" \
    "$prepared_marker_sha256" "$bundle_manifest_sha256" "$payload_digest" "$BACKUP_ROOT" "$EVIDENCE_ROOT" > "$temporary"
  chmod 0600 -- "$temporary"
  chown "$DEPLOY_UID:$DEPLOY_GID" -- "$temporary"
  mv -T -- "$temporary" "$REQUEST_FILE"
}

validate_environment_value() {
  local name="$1" value="$2"
  [[ -n "$value" && "$value" != *$'\n'* && "$value" != *$'\r'* && "$value" != *$'\t'* ]] ||
    fail "Workflow durable environment value is invalid"
  case "$name" in
    AIHUB_*_DIR)
      [[ "$value" == /* && "$(realpath -e -- "$value")" == "$value" && -d "$value" && ! -L "$value" ]] ||
        fail "Workflow durable directory environment is invalid"
      ;;
    COMPOSE_PROJECT_NAME|AIHUB_CADDY_DATA_VOLUME|AIHUB_CADDY_CONFIG_VOLUME|AIHUB_CADDY_CMS_SECRET_VOLUME)
      [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail "Workflow durable name environment is invalid"
      ;;
    AIHUB_PUBLIC_HOST|AIHUB_COMMUNITY_PUBLIC_HOST)
      [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9.-]{0,252}[A-Za-z0-9]$ ]] || fail "Workflow durable host environment is invalid"
      ;;
    AIHUB_FORUM_ADMIN_EMAIL)
      [[ "$value" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || fail "Workflow durable email environment is invalid"
      ;;
    *) fail "Workflow durable environment name is not allowlisted" ;;
  esac
}

write_environment() {
  local temporary="$CONTROL_ROOT/.environment.$$" name value
  local names=(
    COMPOSE_PROJECT_NAME
    AIHUB_ADMIN_DATA_DIR AIHUB_ADMIN_PUBLISHED_DIR AIHUB_ADMIN_OUTPUT_DIR
    AIHUB_IDENTITY_DB_DIR AIHUB_COMMUNITY_DB_DIR AIHUB_COMMUNITY_CONFIG_DIR
    AIHUB_COMMUNITY_STORAGE_DIR AIHUB_COMMUNITY_ASSETS_DIR
    AIHUB_SECRET_DIR AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR
    AIHUB_FORUM_ADMIN_EMAIL AIHUB_PUBLIC_HOST AIHUB_COMMUNITY_PUBLIC_HOST
    AIHUB_CADDY_DATA_VOLUME AIHUB_CADDY_CONFIG_VOLUME AIHUB_CADDY_CMS_SECRET_VOLUME
  )
  umask 077
  : > "$temporary"
  for name in "${names[@]}"; do
    [[ -v "$name" ]] || fail "Workflow durable required environment is missing"
    value="${!name}"
    validate_environment_value "$name" "$value"
    printf 'export %s=%q\n' "$name" "$value" >> "$temporary"
  done
  printf 'export AIHUB_WORKFLOW_PRODUCTION_TEMPORARY_ACCEPTANCE=1\n' >> "$temporary"
  chmod 0600 -- "$temporary"
  chown "$DEPLOY_UID:$DEPLOY_GID" -- "$temporary"
  mv -T -- "$temporary" "$ENVIRONMENT_FILE"
}

write_receipt() {
  local temporary="$CONTROL_ROOT/.receipt.$$"
  umask 077
  printf '{"schema":"aihub-workflow-production-durable-receipt-v1","accepted":true,"runId":"%s","unit":"%s","deploymentSetDigest":"%s","deploymentManifestSha256":"%s","preparedMarkerSha256":"%s","bundleManifestSha256":"%s","payloadDigest":"%s","statusPath":"%s","evidenceRoot":"%s"}\n' \
    "$RUN_ID" "$UNIT" "$deployment_set_digest" "$deployment_manifest_sha256" "$prepared_marker_sha256" \
    "$bundle_manifest_sha256" "$payload_digest" "$STATUS_FILE" "$EVIDENCE_ROOT" > "$temporary"
  chmod 0600 -- "$temporary"
  chown "$DEPLOY_UID:$DEPLOY_GID" -- "$temporary"
  mv -T -- "$temporary" "$RECEIPT_FILE"
  sync -f "$RECEIPT_FILE"
}

verify_request_controls() {
  local request_values request_release request_set request_manifest request_marker request_bundle request_payload
  validate_control_file "$REQUEST_FILE" 600
  request_values="$("$workflow_node" - "$REQUEST_FILE" <<'NODE'
const fs = require("node:fs");
const value = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const keys = Object.keys(value).sort();
const allowed = ["backupRoot","bundleManifestSha256","deploymentManifestSha256","deploymentSetDigest","evidenceRoot","payloadDigest","preparedMarkerSha256","releaseRoot","runId","schema","unit"].sort();
if (JSON.stringify(keys) !== JSON.stringify(allowed)) process.exit(1);
const fields = [value.releaseRoot,value.deploymentSetDigest,value.deploymentManifestSha256,value.preparedMarkerSha256,value.bundleManifestSha256,value.payloadDigest];
if (value.schema !== "aihub-workflow-production-durable-request-v1" || value.runId !== "workflow-production-r11" || value.unit !== "zhenxing-ai-workflow-production-r11.service") process.exit(1);
if (value.backupRoot !== "/opt/zhenxing-ai/shared/backups" || value.evidenceRoot !== "/opt/zhenxing-ai/shared/backups/workflow-production-r11-evidence") process.exit(1);
if (fields.some((field) => typeof field !== "string" || field.includes("|"))) process.exit(1);
process.stdout.write(fields.join("|") + "\n");
NODE
  )" || fail "Workflow durable request is invalid"
  IFS='|' read -r request_release request_set request_manifest request_marker request_bundle request_payload <<< "$request_values"
  read_prepared_controls
  [[ "$request_release" == "$release_root" && "$request_set" == "$deployment_set_digest" &&
     "$request_manifest" == "$deployment_manifest_sha256" && "$request_marker" == "$prepared_marker_sha256" &&
     "$request_bundle" == "$bundle_manifest_sha256" && "$request_payload" == "$payload_digest" ]] ||
    fail "Workflow durable prepared controls changed after launch"
}

launch() {
  validate_release_path
  validate_deployment_caller
  [[ -x "$SYSTEMD_RUN" ]] || fail "Workflow durable systemd launcher is unavailable"
  [[ -d "$SHARED_ROOT" && ! -L "$SHARED_ROOT" && "$(realpath -e -- "$SHARED_ROOT")" == "$SHARED_ROOT" ]] ||
    fail "Workflow durable shared root is invalid"
  [[ -d "$BACKUP_ROOT" && ! -L "$BACKUP_ROOT" && "$(realpath -e -- "$BACKUP_ROOT")" == "$BACKUP_ROOT" ]] ||
    fail "Workflow durable backup root is invalid"
  [[ ! -e "$CONTROL_ROOT" && ! -L "$CONTROL_ROOT" ]] || fail "Workflow durable run already exists"
  mkdir -- "$CONTROL_ROOT"
  chmod 0700 -- "$CONTROL_ROOT"
  chown "$DEPLOY_UID:$DEPLOY_GID" -- "$CONTROL_ROOT"
  [[ ! -e "$EVIDENCE_ROOT" && ! -L "$EVIDENCE_ROOT" ]] || fail "Workflow durable evidence root already exists"
  mkdir -- "$EVIDENCE_ROOT"
  chmod 0700 -- "$EVIDENCE_ROOT"
  chown "$DEPLOY_UID:$DEPLOY_GID" -- "$EVIDENCE_ROOT"
  prepare_workflow_node
  read_prepared_controls
  write_request
  write_environment
  write_status queued null ""
  sync -f "$CONTROL_ROOT"

  local runner=("$SYSTEMD_RUN")
  if [[ "${EUID:-$(id -u)}" != '0' ]]; then runner=(sudo -n "$SYSTEMD_RUN"); fi
  "${runner[@]}" --quiet --unit="$UNIT" --collect --no-block --service-type=exec \
    --property="User=$DEPLOY_UID" --property="Group=$DEPLOY_GID" \
    --property="WorkingDirectory=$script_dir" --property='UMask=0077' \
    --property='NoNewPrivileges=yes' --property='PrivateTmp=yes' \
    --property='StandardOutput=null' --property='StandardError=null' \
    /usr/bin/env -i PATH="$PATH" LC_ALL=C /bin/bash "$script_path" __run
  write_receipt
  cat -- "$RECEIPT_FILE"
}

status() {
  validate_deployment_caller
  [[ -d "$CONTROL_ROOT" && ! -L "$CONTROL_ROOT" ]] || fail "Workflow durable run is unavailable"
  validate_control_file "$STATUS_FILE" 600
  cat -- "$STATUS_FILE"
}

run_worker() {
  trap record_worker_exit EXIT
  validate_release_path
  [[ "${EUID:-$(id -u)}" == "$DEPLOY_UID" && "$(id -g)" == "$DEPLOY_GID" ]] ||
    fail "Workflow durable worker identity is invalid"
  local unit_cgroup=""
  [[ -r /proc/self/cgroup ]] || fail "Workflow durable worker cgroup is unavailable"
  unit_cgroup="$(awk -F: -v expected="/system.slice/$UNIT" '$3 == expected { print $3; exit }' /proc/self/cgroup)"
  [[ "$unit_cgroup" == "/system.slice/$UNIT" ]] || fail "Workflow durable worker is outside the fixed system unit"
  prepare_workflow_node
  verify_request_controls
  validate_control_file "$ENVIRONMENT_FILE" 600
  # shellcheck source=/dev/null
  source "$ENVIRONMENT_FILE"
  write_status running null ""

  set +e
  /bin/bash "$script_dir/workflow-production-cutover.sh" \
    "$base" "$overlay" "$BACKUP_ROOT" "$EVIDENCE_ROOT" "$identity_archive"
  local cutover_status=$?
  set -e
  local evidence_path="" evidence_count
  evidence_count="$(find -P "$EVIDENCE_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'workflow-production-cutover-*' -print | wc -l)"
  if [[ "$evidence_count" == '1' ]]; then
    evidence_path="$(find -P "$EVIDENCE_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'workflow-production-cutover-*' -print)"
  elif [[ "$evidence_count" != '0' ]]; then
    cutover_status=1
  fi
  if [[ "$cutover_status" == '0' ]]; then
    write_status "succeeded" 0 "$evidence_path"
  else
    write_status "failed" "$cutover_status" "$evidence_path"
  fi
  worker_status_finalized=1
  exit "$cutover_status"
}

[[ $# -eq 1 ]] || fail "usage: workflow-production-cutover-launcher.sh launch|status"
command="$1"
case "$command" in
  launch) launch ;;
  status) status ;;
  __run) run_worker ;;
  *) fail "usage: workflow-production-cutover-launcher.sh launch|status" ;;
esac
