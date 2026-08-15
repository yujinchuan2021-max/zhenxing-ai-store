#!/bin/bash
set -euo pipefail

PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
export PATH LC_ALL=C
COMMON_ROOT='/opt/zhenxing-ai/shared/secrets/community-production'
WORKFLOW_ROOT='/opt/zhenxing-ai/shared/secrets/workflow-production'
COMMON_NAMES=(identity_db_password forum_db_password forum_db_root_password forum_admin_password forum_api_key forum_password_token community_internal community_management community_cms_gateway)
WORKFLOW_NAMES=(workflow_review_secret)
temporary=''

fail() { printf '%s\n' 'fresh secret authority blocked' >&2; exit 1; }
cleanup() { status=$?; trap - EXIT HUP INT TERM; [[ -z "$temporary" ]] || rm -f -- "$temporary"; exit "$status"; }
trap cleanup EXIT HUP INT TERM
[[ $# -eq 1 ]] || fail
case "$1" in issue|validate) action="$1" ;; *) fail ;; esac
[[ "${EUID:-$(id -u)}" == 0 ]] || fail
for root in "$COMMON_ROOT" "$WORKFLOW_ROOT"; do
  [[ -d "$root" && ! -L "$root" && "$(stat -c '%u:%g:%a' "$root")" == '1000:1000:700' ]] || fail
done

validate_one() {
  local root="$1" name="$2" file="$1/$2" expected_bytes=64 metadata
  [[ "$name" != forum_api_key ]] || expected_bytes=65
  [[ -f "$file" && ! -L "$file" ]] || fail
  metadata="$(stat -c '%u:%g:%a:%h:%s' "$file")"
  [[ "$metadata" == "1000:1000:600:1:$expected_bytes" ]] || fail
  if [[ "$name" == forum_api_key ]]; then
    head -c 64 "$file" | grep -Eq '^[0-9a-f]{64}$' || fail
    [[ "$(tail -c 1 "$file" | od -An -tu1 | tr -d ' ')" == 10 ]] || fail
  else
    grep -Eq '^[0-9a-f]{64}$' "$file" || fail
  fi
}

issue_one() {
  local root="$1" name="$2" target="$1/$2"
  [[ ! -e "$target" && ! -L "$target" ]] || fail
  umask 077
  temporary="$(mktemp --tmpdir="$root" ".$name.issue.XXXXXXXX")"
  openssl rand -hex 32 | tr -d '\r\n' > "$temporary"
  if [[ "$name" == forum_api_key ]]; then printf '\n' >> "$temporary"; fi
  chown 1000:1000 "$temporary"
  chmod 0600 "$temporary"
  mv -T -- "$temporary" "$target"
  temporary=''
  sync -f "$target"
  validate_one "$root" "$name"
}

if [[ "$action" == issue ]]; then
  existing=0
  for name in "${COMMON_NAMES[@]}"; do [[ -e "$COMMON_ROOT/$name" || -L "$COMMON_ROOT/$name" ]] && existing=$((existing+1)); done
  for name in "${WORKFLOW_NAMES[@]}"; do [[ -e "$WORKFLOW_ROOT/$name" || -L "$WORKFLOW_ROOT/$name" ]] && existing=$((existing+1)); done
  [[ "$existing" == 0 ]] || fail
  for name in "${COMMON_NAMES[@]}"; do issue_one "$COMMON_ROOT" "$name"; done
  for name in "${WORKFLOW_NAMES[@]}"; do issue_one "$WORKFLOW_ROOT" "$name"; done
fi
for name in "${COMMON_NAMES[@]}"; do validate_one "$COMMON_ROOT" "$name"; done
for name in "${WORKFLOW_NAMES[@]}"; do validate_one "$WORKFLOW_ROOT" "$name"; done
printf '%s\n' '{"schema":"aihub-workflow-production-fresh-secret-authority-v1","status":"pass","secretCount":10,"valuesEmitted":false}'
