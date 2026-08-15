#!/bin/bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 issue|validate|revoke caddy-gateway|workflow-review ABSOLUTE_SECRET_FILE" >&2
  exit 2
fi

action="$1"
purpose="$2"
requested_target="$3"
temporary=""
committed=0

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  if [[ "$committed" == "0" && -n "$temporary" ]]; then
    rm -f -- "$temporary"
  fi
  exit "$status"
}
trap cleanup EXIT HUP INT TERM

fail() {
  echo "$1" >&2
  exit 1
}

case "$action" in issue|validate|revoke) ;; *) fail "secret authority action is invalid" ;; esac
case "$purpose" in
  caddy-gateway) expected_name="community_cms_gateway"; require_existing=1 ;;
  workflow-review) expected_name="workflow_review_secret"; require_existing=0 ;;
  *) fail "secret authority purpose is invalid" ;;
esac

[[ "${EUID:-$(id -u)}" == "0" ]] || fail "secret authority must run as root"
[[ "$requested_target" == /* ]] || fail "secret authority path must be absolute"
directory="$(dirname -- "$requested_target")"
[[ -d "$directory" && ! -L "$directory" ]] || fail "secret authority directory is invalid"
directory="$(readlink -f -- "$directory")"
target="$directory/$expected_name"
[[ "$requested_target" == "$target" ]] || fail "secret authority target name is invalid"

if [[ -v SUDO_UID || -v SUDO_GID ]]; then
  [[ -v SUDO_UID && -v SUDO_GID && "$SUDO_UID" =~ ^[0-9]+$ && "$SUDO_GID" =~ ^[0-9]+$ ]] ||
    fail "secret authority sudo caller identity is invalid"
  approved_uid="$SUDO_UID"
  approved_gid="$SUDO_GID"
else
  approved_uid=0
  approved_gid=0
fi

assert_inactive() {
  command -v docker >/dev/null 2>&1 || fail "Docker is required for the active-consumer gate"
  local container mount_sources
  for container in $(docker ps -q); do
    mount_sources="$(docker inspect --format '{{range .Mounts}}{{println .Source}}{{end}}' "$container")" ||
      fail "Docker active-consumer gate is unavailable"
    if grep -Fxq -- "$target" <<< "$mount_sources"; then
      fail "secret authority is mounted by a running container"
    fi
  done
}

assert_source() {
  [[ ! -L "$target" && -f "$target" ]] || fail "secret authority must be a regular file, not a symlink"
  IFS=: read -r source_uid source_gid source_mode source_links source_bytes < <(
    stat -c '%u:%g:%a:%h:%s' -- "$target"
  )
  [[ "$source_uid:$source_gid" == "$approved_uid:$approved_gid" ]] || fail "secret authority owner is not the sudo caller"
  [[ "$source_mode" == "600" ]] || fail "secret authority mode must remain 0600"
  [[ "$source_links" == "1" ]] || fail "secret authority must have exactly one hard link"
  [[ "$source_bytes" -ge 32 && "$source_bytes" -le 512 ]] || fail "secret authority length is invalid"
  [[ "$(wc -l < "$target" | tr -d ' ')" == "0" ]] || fail "secret authority contains control characters"
  [[ "$(LC_ALL=C tr -d '\040-\176' < "$target" | wc -c | tr -d ' ')" == "0" ]] ||
    fail "secret authority contains control characters"
}

write_audit() {
  local outcome="$1"
  umask 077
  printf 'time=%s purpose=%s path=%s owner=%s:%s mode=0600 outcome=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$purpose" "$target" "$approved_uid" "$approved_gid" "$outcome" \
    >> "$directory/.${expected_name}.authority.audit"
}

case "$action" in
  validate)
    assert_source
    echo "secret authority validation passed"
    ;;
  revoke)
    assert_source
    assert_inactive
    revoked="$target.revoked.$(date -u +%Y%m%dT%H%M%SZ)"
    [[ ! -e "$revoked" ]] || fail "secret authority revoke target exists"
    mv -fT -- "$target" "$revoked"
    write_audit revoked
    committed=1
    echo "secret authority revoked"
    ;;
  issue)
    command -v openssl >/dev/null 2>&1 || fail "OpenSSL is required for secret issuance"
    if [[ -e "$target" || -L "$target" ]]; then
      assert_source
    elif [[ "$require_existing" == "1" ]]; then
      fail "secret authority must already exist"
    fi
    assert_inactive
    umask 077
    temporary="$(mktemp --tmpdir="$directory" ".${expected_name}.issue.XXXXXXXX")"
    openssl rand -hex 32 | tr -d '\r\n' > "$temporary"
    chown "$approved_uid:$approved_gid" "$temporary"
    chmod 600 -- "$temporary"
    [[ ! -L "$temporary" && -f "$temporary" ]] || fail "generated secret authority is invalid"
    [[ "$(stat -c '%u:%g:%a:%h:%s' -- "$temporary")" == "$approved_uid:$approved_gid:600:1:64" ]] ||
      fail "generated secret metadata is invalid"
    LC_ALL=C grep -Eq '^[0-9a-f]{64}$' "$temporary" || fail "generated secret content is invalid"
    sync -f "$temporary"
    assert_inactive
    mv -fT -- "$temporary" "$target"
    temporary=""
    assert_source
    write_audit issued
    committed=1
    sync -f "$directory"
    echo "secret authority issued"
    ;;
esac
