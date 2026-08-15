#!/bin/bash
set -euo pipefail

PATH='/usr/sbin:/usr/bin:/sbin:/bin'
export PATH LC_ALL=C

DEPLOY_UID='1000'
DEPLOY_GID='1000'
STAGING_ROOT='/opt/zhenxing-ai/staging'
RELEASE_ROOT='/opt/zhenxing-ai/releases'
BUNDLE_JSON='.aihub-workflow-release-bundle.json'
BUNDLE_TABLE='.aihub-workflow-release-bundle.tsv'
IDENTITY_MANIFEST='.aihub-identity-source-manifest.json'
PREPARED_MARKER='.aihub-workflow-release-prepared.json'
CADDY_IMAGE='caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'

fail() { echo "$1" >&2; exit 1; }

if [[ $# -ne 2 ]]; then
  fail "usage: sudo -n bash prepare-workflow-production-release.sh ABSOLUTE_INCOMING_BUNDLE ABSOLUTE_RELEASE_TARGET"
fi
[[ "${EUID:-$(id -u)}" == '0' ]] || fail "Workflow release preparation requires EUID 0"
[[ "${SUDO_UID:-}" == "$DEPLOY_UID" && "${SUDO_GID:-}" == "$DEPLOY_GID" ]] ||
  fail "Workflow release preparation requires the approved deployment sudo caller"
[[ "${AIHUB_WORKFLOW_RELEASE_PREPARE_ISOLATED_ACCEPTANCE:-0}" =~ ^[01]$ ]] ||
  fail "Workflow release preparation acceptance mode is invalid"
if [[ "${AIHUB_WORKFLOW_RELEASE_PREPARE_TEST_FAIL_AT:-}" != '' ]]; then
  [[ "${AIHUB_WORKFLOW_RELEASE_PREPARE_ISOLATED_ACCEPTANCE:-0}" == '1' &&
     "${AIHUB_WORKFLOW_RELEASE_PREPARE_TEST_FAIL_AT}" == 'rename' ]] ||
    fail "Workflow release preparation fault injection is forbidden"
fi

incoming="$1"
target="$2"
[[ "$incoming" == /* && "$target" == /* ]] || fail "Workflow release bundle paths must be absolute"
[[ -d "$STAGING_ROOT" && ! -L "$STAGING_ROOT" ]] || fail "Workflow staging root is unavailable"
[[ -d "$RELEASE_ROOT" && ! -L "$RELEASE_ROOT" ]] || fail "Workflow release root is unavailable"
staging_real="$(realpath -e -- "$STAGING_ROOT")"
release_real="$(realpath -e -- "$RELEASE_ROOT")"
[[ "$staging_real" == "$STAGING_ROOT" && "$release_real" == "$RELEASE_ROOT" ]] ||
  fail "Workflow release roots must be canonical"
[[ -d "$incoming" && ! -L "$incoming" ]] || fail "Workflow incoming bundle is unavailable"
incoming_real="$(realpath -e -- "$incoming")"
[[ "$incoming_real" == "$incoming" && "$(dirname -- "$incoming_real")" == "$staging_real" ]] ||
  fail "Workflow incoming bundle must be a canonical direct staging child"
bundle_name="$(basename -- "$incoming_real")"
[[ "$bundle_name" =~ ^community-production-[A-Za-z0-9][A-Za-z0-9-]{5,80}\.bundle$ ]] ||
  fail "Workflow incoming bundle name is invalid"
release_name="${bundle_name%.bundle}"
[[ "$target" == "$release_real/$release_name" ]] || fail "Workflow release target does not match the bundle"
[[ ! -e "$target" && ! -L "$target" ]] || fail "Workflow release target already exists"

temporary="$target.tmp.$$"
[[ ! -e "$temporary" && ! -L "$temporary" ]] || fail "Workflow release temporary target already exists"
install -d -m 0700 -o "$DEPLOY_UID" -g "$DEPLOY_GID" -- "$temporary"
cleanup_temporary() {
  if [[ -n "${temporary:-}" && -d "$temporary" && ! -L "$temporary" &&
        "$(dirname -- "$temporary")" == "$release_real" && "$(basename -- "$temporary")" == "$release_name.tmp.$$" ]]; then
    find -P "$temporary" -depth -delete || true
  fi
}
finish() {
  status=$?
  trap - EXIT HUP INT TERM
  if [[ "$status" -ne 0 ]]; then cleanup_temporary; fi
  exit "$status"
}
trap finish EXIT HUP INT TERM

for control in "$BUNDLE_JSON" "$BUNDLE_TABLE" "$IDENTITY_MANIFEST"; do
  file="$incoming_real/$control"
  [[ -f "$file" && ! -L "$file" ]] || fail "Workflow release bundle control file is unavailable"
  read -r owner mode links bytes < <(stat -c '%u:%g %a %h %s' -- "$file")
  [[ "$owner" == "$DEPLOY_UID:$DEPLOY_GID" && "$links" == '1' && "$bytes" -gt 0 ]] ||
    fail "Workflow release bundle control metadata is invalid"
  (( (8#$mode & 07022) == 0 )) || fail "Workflow release bundle control mode is unsafe"
done
[[ -d "$incoming_real/payload" && ! -L "$incoming_real/payload" ]] || fail "Workflow release payload is unavailable"
if find -P "$incoming_real" -mindepth 1 ! -type d ! -type f -print -quit | grep -q .; then
  fail "Workflow release bundle contains a non-regular entry"
fi
while IFS= read -r entry; do
  read -r owner mode links < <(stat -c '%u:%g %a %h' -- "$entry")
  [[ "$owner" == "$DEPLOY_UID:$DEPLOY_GID" ]] || fail "Workflow release bundle owner is not approved"
  (( (8#$mode & 07022) == 0 )) || fail "Workflow release bundle source mode is unsafe"
  if [[ -f "$entry" ]]; then
    [[ "$links" == '1' ]] || fail "Workflow release bundle contains a hard link"
  fi
done < <(find -P "$incoming_real" -mindepth 0 -print)

table="$incoming_real/$BUNDLE_TABLE"
IFS= read -r heading < "$table"
[[ "$heading" == 'AIHUB_WORKFLOW_PRODUCTION_RELEASE_BUNDLE_V1' ]] ||
  fail "Workflow release bundle table format is invalid"

listed_files="$temporary/.listed-files"
listed_directories="$temporary/.listed-directories"
actual_files="$temporary/.actual-files"
actual_directories="$temporary/.actual-directories"
: > "$listed_files"
: > "$listed_directories"
line_number=0
while IFS=$'\t' read -r kind first second third fourth extra; do
  line_number=$((line_number + 1))
  [[ "$line_number" -gt 1 ]] || continue
  case "$kind" in
    M)
      [[ "$first" =~ ^[A-Za-z][A-Za-z0-9]+$ && -n "$second" && -z "${third}${fourth}${extra}" ]] ||
        fail "Workflow release bundle metadata row is invalid"
      ;;
    D)
      mode="$first" path="$second"
      [[ "$mode" == '0755' && -n "$path" && -z "${third}${fourth}${extra}" ]] ||
        fail "Workflow release bundle directory row is invalid"
      [[ "$path" =~ ^[A-Za-z0-9._/-]+$ && "$path" != /* && "/$path/" != *'/../'* ]] ||
        fail "Workflow release bundle directory path is unsafe"
      printf '%s\n' "$path" >> "$listed_directories"
      ;;
    F)
      mode="$first" bytes="$second" digest="$third" path="$fourth"
      [[ "$mode" == '0644' || "$mode" == '0755' ]] || fail "Workflow release bundle file mode is invalid"
      [[ "$bytes" =~ ^[1-9][0-9]*$ && "$digest" =~ ^[0-9a-f]{64}$ && -n "$path" && -z "$extra" ]] ||
        fail "Workflow release bundle file row is invalid"
      [[ "$path" =~ ^[A-Za-z0-9._/-]+$ && "$path" != /* && "/$path/" != *'/../'* ]] ||
        fail "Workflow release bundle file path is unsafe"
      printf '%s\n' "$path" >> "$listed_files"
      ;;
    *) fail "Workflow release bundle contains an unknown row" ;;
  esac
done < "$table"

[[ "$(sort "$listed_files" | uniq | wc -l)" == "$(wc -l < "$listed_files")" ]] ||
  fail "Workflow release bundle contains a duplicate file"
[[ "$(sort "$listed_directories" | uniq | wc -l)" == "$(wc -l < "$listed_directories")" ]] ||
  fail "Workflow release bundle contains a duplicate directory"
(cd "$incoming_real/payload" && find -P . -type f -print | sed 's#^\./##' | sort) > "$actual_files"
(cd "$incoming_real/payload" && find -P . -mindepth 1 -type d -print | sed 's#^\./##' | sort) > "$actual_directories"
sort "$listed_files" -o "$listed_files"
sort "$listed_directories" -o "$listed_directories"
cmp -s "$listed_files" "$actual_files" || fail "Workflow release bundle file set is incomplete or has extras"
cmp -s "$listed_directories" "$actual_directories" || fail "Workflow release bundle directory set is incomplete or has extras"

while IFS=$'\t' read -r kind first second third fourth extra; do
  [[ "$kind" == 'D' ]] || continue
  install -d -m 0755 -o "$DEPLOY_UID" -g "$DEPLOY_GID" -- "$temporary/$second"
done < "$table"
while IFS=$'\t' read -r kind mode bytes digest relative extra; do
  [[ "$kind" == 'F' ]] || continue
  source_file="$incoming_real/payload/$relative"
  read -r source_owner source_links source_bytes < <(stat -c '%u:%g %h %s' -- "$source_file")
  [[ "$source_owner" == "$DEPLOY_UID:$DEPLOY_GID" && "$source_links" == '1' && "$source_bytes" == "$bytes" ]] ||
    fail "Workflow release bundle file metadata drifted"
  [[ "$(sha256sum -- "$source_file" | awk '{print $1}')" == "$digest" ]] ||
    fail "Workflow release bundle file digest drifted"
  install -m "$mode" -o "$DEPLOY_UID" -g "$DEPLOY_GID" -- "$source_file" "$temporary/$relative"
done < "$table"
install -m 0644 -o "$DEPLOY_UID" -g "$DEPLOY_GID" -- "$incoming_real/$BUNDLE_JSON" "$temporary/$BUNDLE_JSON"
install -m 0644 -o "$DEPLOY_UID" -g "$DEPLOY_GID" -- "$incoming_real/$BUNDLE_TABLE" "$temporary/$BUNDLE_TABLE"
install -m 0644 -o "$DEPLOY_UID" -g "$DEPLOY_GID" -- "$incoming_real/$IDENTITY_MANIFEST" "$temporary/$IDENTITY_MANIFEST"
rm -f -- "$listed_files" "$listed_directories" "$actual_files" "$actual_directories"

script_dir="$temporary/deployment/community-production"
source "$script_dir/workflow-node-runtime.sh"
preflight_workflow_node_runtime
workflow_node="$(prepare_workflow_node_runtime)"
"$workflow_node" "$script_dir/workflow-production-release-bundle.cjs" verify-prepared "$temporary" --write-marker >/dev/null
chown "$DEPLOY_UID:$DEPLOY_GID" -- "$temporary/$PREPARED_MARKER"
chmod 0644 -- "$temporary/$PREPARED_MARKER"
"$workflow_node" "$script_dir/workflow-production-release-bundle.cjs" verify-prepared "$temporary" >/dev/null

docker compose \
  -f "$script_dir/compose.server.yaml" \
  -f "$script_dir/compose.workflow-production.yaml" \
  config --no-interpolate >/dev/null
docker run --rm --network none --read-only \
  -e AIHUB_PUBLIC_HOST=release-prepare.invalid \
  -e AIHUB_COMMUNITY_PUBLIC_HOST=community.release-prepare.invalid \
  -e AIHUB_COMMUNITY_CMS_SECRET=release-prepare-validation-only \
  --mount "type=bind,src=$script_dir/Caddyfile,dst=/etc/caddy/Caddyfile,readonly" \
  --entrypoint caddy "$CADDY_IMAGE" validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null

sync -f "$temporary"
if [[ "${AIHUB_WORKFLOW_RELEASE_PREPARE_TEST_FAIL_AT:-}" == 'rename' ]]; then
  fail "Workflow release preparation injected rename failure"
fi
mv -T -- "$temporary" "$target"
sync -f "$release_real"
trap - EXIT HUP INT TERM
printf '%s\n' "$target"
