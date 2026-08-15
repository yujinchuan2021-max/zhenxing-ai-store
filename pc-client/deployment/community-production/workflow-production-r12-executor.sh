#!/bin/bash
set -euo pipefail

PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
export PATH LC_ALL=C
RUN_ID='workflow-production-r12'
PROJECT='zhenxing-community-production'
CONTROL_ROOT='/opt/zhenxing-ai/shared/workflow-production-r12'
EVIDENCE_ROOT='/opt/zhenxing-ai/shared/backups/workflow-production-r12-evidence'
BACKUP_ROOT='/opt/zhenxing-ai/shared/backups'

fail() { printf '%s\n' 'r12 fixed executor blocked' >&2; exit 1; }
[[ $# -eq 1 ]] || fail
operation="$1"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
release_root="$(cd "$script_dir/../.." && pwd -P)"
[[ "$release_root" == /opt/zhenxing-ai/releases/community-production-r12-* && ! -L "$script_dir" ]] || fail
[[ -f "$CONTROL_ROOT/environment.sh" && ! -L "$CONTROL_ROOT/environment.sh" ]] || fail
# shellcheck source=/dev/null
source "$CONTROL_ROOT/environment.sh"
[[ "${COMPOSE_PROJECT_NAME:-}" == "$PROJECT" ]] || fail
base="$script_dir/compose.server.yaml"
overlay="$script_dir/compose.workflow-production.yaml"
disabled="$script_dir/compose.workflow-production-r12-disabled.yaml"
backup_pointer="$CONTROL_ROOT/verified-backup-path"
old_admin='zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9'
old_identity='zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392'
target_admin='zhenxing-ai/admin:0.1.40-src-186ff057efd3'
target_identity='zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e'
compose_baseline=(/usr/bin/docker compose -p "$PROJECT" -f "$base" -f "$disabled")
compose_target=(/usr/bin/docker compose -p "$PROJECT" -f "$base" -f "$overlay")
verify_compose() {
  local admin_image="$1" identity_image="$2"; shift 2
  local config
  config="$(AIHUB_ADMIN_CMS_IMAGE="$admin_image" AIHUB_IDENTITY_IMAGE="$identity_image" "$@" config --format json)" || fail
  printf '%s' "$config" | "$release_root/.workflow-runtime/node-v24.18.1-linux-x64/bin/node" -e '
const fs=require("node:fs");
const expectedAdmin=process.argv[1],expectedIdentity=process.argv[2];
try {
  const value=JSON.parse(fs.readFileSync(0,"utf8"));
  const keys=Object.keys(value.services||{}).sort();
  const required=["admin","caddy","community","community-database","identity","identity-database"];
  if(!required.every((key)=>keys.includes(key))||value.services.admin.image!==expectedAdmin||value.services.identity.image!==expectedIdentity) throw new Error();
} catch { process.exitCode=1; }
' "$admin_image" "$identity_image"
  [[ $? -eq 0 ]] || fail
}
compose_for() {
  local profile="$1"; shift
  case "$profile" in
    baseline) verify_compose "$old_admin" "$old_identity" "${compose_baseline[@]}"; AIHUB_ADMIN_CMS_IMAGE="$old_admin" AIHUB_IDENTITY_IMAGE="$old_identity" "${compose_baseline[@]}" "$@" ;;
    target) verify_compose "$target_admin" "$target_identity" "${compose_target[@]}"; AIHUB_ADMIN_CMS_IMAGE="$target_admin" AIHUB_IDENTITY_IMAGE="$target_identity" "${compose_target[@]}" "$@" ;;
    *) fail ;;
  esac
}
verify_image() {
  local image="$1" expected_id="$2"
  [[ "$(/usr/bin/docker image inspect --format '{{.Id}}' "$image")" == "$expected_id" ]] || fail
}
load_required_images() {
  "$release_root/.workflow-runtime/node-v24.18.1-linux-x64/bin/node" "$script_dir/workflow-image-archive.cjs" verify-rollback "$release_root/artifacts/identity-19a-rollback-image.tar" >/dev/null
  "$release_root/.workflow-runtime/node-v24.18.1-linux-x64/bin/node" "$script_dir/workflow-image-archive.cjs" verify-old-admin "$release_root/artifacts/admin-old-b6ea4c5bd0e9.tar" >/dev/null
  /usr/bin/docker load -i "$release_root/artifacts/identity-19a-rollback-image.tar" >/dev/null
  /usr/bin/docker load -i "$release_root/artifacts/admin-old-b6ea4c5bd0e9.tar" >/dev/null
  /usr/bin/docker load -i "$release_root/artifacts/identity-r11-image.tar" >/dev/null
  /usr/bin/docker load -i "$release_root/artifacts/admin-active7-image.tar" >/dev/null
  verify_image "$old_identity" 'sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567'
  verify_image "$old_admin" 'sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2'
  verify_image "$target_identity" 'sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748'
  verify_image "$target_admin" 'sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd'
}

case "$operation" in
  backup:verified)
    load_required_images
    verify_compose "$old_admin" "$old_identity" "${compose_baseline[@]}"
    backup="$(AIHUB_ADMIN_CMS_IMAGE="$old_admin" AIHUB_IDENTITY_IMAGE="$old_identity" /bin/bash "$script_dir/backup.sh" "$base" "$disabled" "$BACKUP_ROOT")"
    [[ -n "$backup" && "$backup" != *$'\n'* && "$backup" == "$BACKUP_ROOT"/community-production-* ]] || fail
    backup_real="$(realpath -e -- "$backup")" || fail
    [[ "$backup_real" == "$backup" && -d "$backup" && ! -L "$backup" && -f "$backup/SHA256SUMS" && ! -L "$backup/SHA256SUMS" ]] || fail
    umask 077; printf '%s\n' "$backup" > "$backup_pointer"; chmod 0600 "$backup_pointer"
    ;;
  recreate:admin|recreate:identity)
    service="${operation#recreate:}"
    compose_for target up -d --no-deps --no-build --pull never --wait --wait-timeout 90 "$service"
    ;;
  activate:active7)
    /usr/bin/test -f "$backup_pointer"
    "$release_root/.workflow-runtime/node-v24.18.1-linux-x64/bin/node" "$script_dir/catalog-active7-state-activation.cjs" activate \
      "$AIHUB_ADMIN_PUBLISHED_DIR/catalog-store" "$CONTROL_ROOT/catalog-activation-backup" "$EVIDENCE_ROOT"
    ;;
  verify:workflow-migrate)
    verify_compose "$target_admin" "$target_identity" "${compose_target[@]}"
    backup="$(cat "$backup_pointer")"
    AIHUB_ADMIN_CMS_IMAGE="$target_admin" AIHUB_IDENTITY_IMAGE="$target_identity" /bin/bash "$script_dir/run-workflow-production-migration.sh" "$base" "$overlay" "$backup" verify
    ;;
  verify:workflow-reviewer-provision)
    compose_for target --profile workflow-reviewer-provision run --rm -T --no-deps -e AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE=preflight workflow-reviewer-provision >/dev/null
    ;;
  verify:workflow-official-bootstrap)
    verify_compose "$target_admin" "$target_identity" "${compose_target[@]}"
    AIHUB_ADMIN_CMS_IMAGE="$target_admin" AIHUB_IDENTITY_IMAGE="$target_identity" "$release_root/.workflow-runtime/node-v24.18.1-linux-x64/bin/node" "$script_dir/workflow-official-bootstrap-production-wrapper.cjs" \
      "$EVIDENCE_ROOT" http://127.0.0.1:4173 "$AIHUB_PUBLIC_HOST" "$base" "$overlay"
    ;;
  rollback)
    if [[ -d "$CONTROL_ROOT/catalog-activation-backup" ]]; then
      "$release_root/.workflow-runtime/node-v24.18.1-linux-x64/bin/node" "$script_dir/catalog-active7-state-activation.cjs" rollback \
        "$AIHUB_ADMIN_PUBLISHED_DIR/catalog-store" "$CONTROL_ROOT/catalog-activation-backup"
    fi
    compose_for baseline up -d --no-deps --no-build --pull never --wait --wait-timeout 90 admin
    compose_for baseline up -d --no-deps --no-build --pull never --wait --wait-timeout 90 identity
    ;;
  *) fail ;;
esac
