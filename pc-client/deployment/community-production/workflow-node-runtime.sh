#!/bin/bash
set -euo pipefail

NODE_VERSION='v24.18.1'
NODE_PLATFORM='linux'
NODE_ARCH='x64'
NODE_ARCHIVE_NAME='node-v24.18.1-linux-x64.tar.gz'
NODE_ARCHIVE_BYTES='57254099'
NODE_ARCHIVE_SHA256='9f5eb6ac21845a66c493c91a253b1da32fd684e89e9b7202d4936982336be4ca'
NODE_SHASUMS_BYTES='2967'
NODE_SHASUMS_SHA256='963b6fefe0c1b0f0d731da926ae12d4c552c3898090e94f3db1549b62e7bbb93'
NODE_BINARY_BYTES='123656816'
NODE_BINARY_SHA256='f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a'
NODE_ACCEPTANCE_BINARY_BYTES='92540232'
NODE_ACCEPTANCE_BINARY_SHA256='ac51903c4c111815d52280b1fdcc8da067cbb37e2fe1a765097b85c3292c8582'
WORKFLOW_NODE_DEPLOY_UID='1000'
WORKFLOW_NODE_DEPLOY_GID='1000'

workflow_node_fail() { echo "$1" >&2; return 1; }

workflow_node_version_at_least() {
  local actual="$1" required_major="$2" required_minor="$3" major minor
  major="${actual%%.*}"
  minor="${actual#*.}"
  minor="${minor%%.*}"
  [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] || return 1
  (( major > required_major || (major == required_major && minor >= required_minor) ))
}

workflow_node_current_owner() {
  printf '%s:%s\n' "${EUID:-$(id -u)}" "$(id -g)"
}

workflow_node_deployment_owner() {
  local current_uid current_gid
  current_uid="${EUID:-$(id -u)}"
  current_gid="$(id -g)"
  [[ "$current_uid" =~ ^[0-9]+$ && "$current_gid" =~ ^[0-9]+$ ]] ||
    workflow_node_fail "Workflow Node caller identity is invalid" || return 1
  if [[ "$current_uid" == '0' ]]; then
    [[ "${SUDO_UID:-}" == "$WORKFLOW_NODE_DEPLOY_UID" && "${SUDO_GID:-}" == "$WORKFLOW_NODE_DEPLOY_GID" ]] ||
      workflow_node_fail "Workflow Node root caller is not the approved sudo deployment identity" || return 1
  else
    [[ "$current_uid" == "$WORKFLOW_NODE_DEPLOY_UID" && "$current_gid" == "$WORKFLOW_NODE_DEPLOY_GID" && ! -v SUDO_UID && ! -v SUDO_GID ]] ||
      workflow_node_fail "Workflow Node caller is not the approved deployment identity" || return 1
  fi
  printf '%s:%s\n' "$WORKFLOW_NODE_DEPLOY_UID" "$WORKFLOW_NODE_DEPLOY_GID"
}

workflow_node_validate_source_file() {
  local file="$1" bytes="$2" digest="$3" metadata owner mode links size actual
  [[ "$file" == /* && -f "$file" && ! -L "$file" ]] || workflow_node_fail "Workflow Node source asset is not a regular absolute file" || return 1
  metadata="$(stat -c '%u:%g %a %h %s' -- "$file")" || return 1
  read -r owner mode links size <<< "$metadata"
  [[ "$owner" == "$(workflow_node_deployment_owner)" ]] || workflow_node_fail "Workflow Node source asset owner is not approved" || return 1
  [[ "$mode" == "644" && "$links" == "1" && "$size" == "$bytes" ]] || workflow_node_fail "Workflow Node source asset metadata is invalid" || return 1
  actual="$(sha256sum -- "$file" | awk '{print $1}')" || return 1
  [[ "$actual" == "$digest" ]] || workflow_node_fail "Workflow Node source asset digest is invalid" || return 1
}

workflow_node_paths() {
  local script_dir release_root
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  release_root="$(cd "$script_dir/../.." && pwd -P)"
  workflow_node_archive="$script_dir/runtime/$NODE_ARCHIVE_NAME"
  workflow_node_shasums="$script_dir/runtime/SHASUMS256.txt"
  workflow_node_parent="$release_root/.workflow-runtime"
  workflow_node_home="$workflow_node_parent/node-v24.18.1-linux-x64"
  workflow_node_binary="$workflow_node_home/bin/node"
}

workflow_node_acceptance_mode() {
  local isolated="${AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE:-0}"
  local runtime_isolated="${AIHUB_WORKFLOW_NODE_RUNTIME_ISOLATED_ACCEPTANCE:-0}"
  local runtime_path="${AIHUB_WORKFLOW_NODE_RUNTIME_ACCEPTANCE_PATH:-}"
  if [[ "$isolated" != "1" ]]; then
    [[ "$runtime_isolated" == "0" && -z "$runtime_path" ]] || workflow_node_fail "Workflow Node acceptance override is forbidden in production" || return 2
    return 1
  fi
  [[ "$runtime_isolated" == "1" && -n "$runtime_path" ]] || workflow_node_fail "Workflow Node isolated acceptance runtime is incomplete" || return 2
  return 0
}

workflow_node_validate_acceptance_runtime() {
  local runtime_path canonical metadata owner mode links size actual identity
  runtime_path="${AIHUB_WORKFLOW_NODE_RUNTIME_ACCEPTANCE_PATH:-}"
  [[ "$runtime_path" == /* && "$runtime_path" != *$'\n'* && "$runtime_path" != *$'\r'* && "$runtime_path" != *$'\t'* ]] || workflow_node_fail "Workflow Node acceptance runtime path is invalid" || return 1
  canonical="$(realpath -e -- "$runtime_path")" || return 1
  [[ "$canonical" == "$runtime_path" && -f "$runtime_path" && ! -L "$runtime_path" ]] || workflow_node_fail "Workflow Node acceptance runtime is not a canonical regular file" || return 1
  metadata="$(stat -c '%u:%g %a %h %s' -- "$runtime_path")" || return 1
  read -r owner mode links size <<< "$metadata"
  [[ "$owner" == "$(workflow_node_current_owner)" && "$mode" == "755" && "$links" == "1" && "$size" == "$NODE_ACCEPTANCE_BINARY_BYTES" ]] || workflow_node_fail "Workflow Node acceptance runtime metadata is invalid" || return 1
  actual="$(sha256sum -- "$runtime_path" | awk '{print $1}')" || return 1
  [[ "$actual" == "$NODE_ACCEPTANCE_BINARY_SHA256" ]] || workflow_node_fail "Workflow Node acceptance runtime digest is invalid" || return 1
  identity="$("$runtime_path" -e 'process.stdout.write(process.version+"|"+process.platform+"|"+process.arch)' 2>/dev/null)" || workflow_node_fail "Workflow Node acceptance runtime cannot execute" || return 1
  [[ "$identity" == "$NODE_VERSION|win32|$NODE_ARCH" ]] || workflow_node_fail "Workflow Node acceptance runtime identity is invalid" || return 1
  workflow_node_binary="$runtime_path"
}

preflight_workflow_node_runtime() {
  local PATH='/usr/sbin:/usr/bin:/sbin:/bin'
  local kernel glibc available expected_line count acceptance_status
  if workflow_node_acceptance_mode; then
    acceptance_status=0
  else
    acceptance_status=$?
  fi
  if [[ "$acceptance_status" == "0" ]]; then
    workflow_node_validate_acceptance_runtime
    return
  fi
  [[ "$acceptance_status" == "1" ]] || return "$acceptance_status"
  workflow_node_deployment_owner >/dev/null || return 1
  workflow_node_paths
  for tool in uname getconf stat sha256sum awk grep df tar gzip mktemp install chmod chown mv sync; do
    command -v "$tool" >/dev/null 2>&1 || workflow_node_fail "Workflow Node prerequisite is unavailable" || return 1
  done
  [[ "$(uname -s)" == "Linux" && "$(uname -m)" == "x86_64" ]] || workflow_node_fail "Workflow Node host platform is unsupported" || return 1
  kernel="$(uname -r)"
  workflow_node_version_at_least "$kernel" 4 18 || workflow_node_fail "Workflow Node host kernel is unsupported" || return 1
  glibc="$(getconf GNU_LIBC_VERSION 2>/dev/null || true)"
  [[ "$glibc" == glibc\ * ]] || workflow_node_fail "Workflow Node host libc is unsupported" || return 1
  workflow_node_version_at_least "${glibc#glibc }" 2 28 || workflow_node_fail "Workflow Node host glibc is too old" || return 1
  available="$(df -Pk "$(dirname "$workflow_node_parent")" | awk 'NR==2 {print $4}')"
  [[ "$available" =~ ^[0-9]+$ && "$available" -ge 524288 ]] || workflow_node_fail "Workflow Node runtime disk space is insufficient" || return 1
  workflow_node_validate_source_file "$workflow_node_shasums" "$NODE_SHASUMS_BYTES" "$NODE_SHASUMS_SHA256" || return 1
  workflow_node_validate_source_file "$workflow_node_archive" "$NODE_ARCHIVE_BYTES" "$NODE_ARCHIVE_SHA256" || return 1
  expected_line="$NODE_ARCHIVE_SHA256  $NODE_ARCHIVE_NAME"
  count="$(grep -Fxc -- "$expected_line" "$workflow_node_shasums")"
  [[ "$count" == "1" ]] || workflow_node_fail "Workflow Node official checksum evidence is invalid" || return 1
}

workflow_node_validate_installed() {
  local approved metadata owner mode links size actual identity
  approved="$(workflow_node_deployment_owner)" || return 1
  [[ -d "$workflow_node_home" && ! -L "$workflow_node_home" && -d "$workflow_node_home/bin" && ! -L "$workflow_node_home/bin" && -f "$workflow_node_binary" && ! -L "$workflow_node_binary" ]] || workflow_node_fail "Workflow Node installed runtime is unavailable" || return 1
  [[ "$(stat -c '%u:%g %a' -- "$workflow_node_home")" == "$approved 755" ]] || workflow_node_fail "Workflow Node installed runtime directory metadata is invalid" || return 1
  [[ "$(stat -c '%u:%g %a' -- "$workflow_node_home/bin")" == "$approved 755" ]] || workflow_node_fail "Workflow Node installed runtime directory metadata is invalid" || return 1
  metadata="$(stat -c '%u:%g %a %h %s' -- "$workflow_node_binary")" || return 1
  read -r owner mode links size <<< "$metadata"
  [[ "$owner" == "$approved" && "$mode" == "555" && "$links" == "1" && "$size" == "$NODE_BINARY_BYTES" ]] || workflow_node_fail "Workflow Node installed runtime metadata is invalid" || return 1
  actual="$(sha256sum -- "$workflow_node_binary" | awk '{print $1}')" || return 1
  [[ "$actual" == "$NODE_BINARY_SHA256" ]] || workflow_node_fail "Workflow Node installed runtime digest is invalid" || return 1
  identity="$("$workflow_node_binary" -e 'process.stdout.write(process.version+"|"+process.platform+"|"+process.arch)' 2>/dev/null)" || workflow_node_fail "Workflow Node installed runtime cannot execute" || return 1
  [[ "$identity" == "$NODE_VERSION|$NODE_PLATFORM|$NODE_ARCH" ]] || workflow_node_fail "Workflow Node installed runtime identity is invalid" || return 1
}

prepare_workflow_node_runtime() {
  local PATH='/usr/sbin:/usr/bin:/sbin:/bin'
  local acceptance_status approved owner_uid owner_gid
  workflow_node_temp=""
  preflight_workflow_node_runtime || return 1
  if workflow_node_acceptance_mode; then
    workflow_node_validate_acceptance_runtime || return 1
    printf '%s\n' "$workflow_node_binary"
    return 0
  else
    acceptance_status=$?
  fi
  [[ "$acceptance_status" == "1" ]] || return "$acceptance_status"
  approved="$(workflow_node_deployment_owner)" || return 1
  owner_uid="${approved%%:*}"
  owner_gid="${approved#*:}"
  if [[ -e "$workflow_node_home" ]]; then
    workflow_node_validate_installed || return 1
    printf '%s\n' "$workflow_node_binary"
    return 0
  fi
  if [[ -e "$workflow_node_parent" ]]; then
    [[ -d "$workflow_node_parent" && ! -L "$workflow_node_parent" ]] || workflow_node_fail "Workflow Node runtime parent is invalid" || return 1
    [[ "$(stat -c '%u:%g %a' -- "$workflow_node_parent")" == "$approved 755" ]] || workflow_node_fail "Workflow Node runtime parent metadata is invalid" || return 1
  else
    install -d -m 0755 -o "$owner_uid" -g "$owner_gid" -- "$workflow_node_parent"
  fi
  workflow_node_temp="$(mktemp -d "$workflow_node_parent/.node-v24.18.1-linux-x64.tmp.XXXXXX")"
  cleanup_workflow_node_temp() {
    if [[ -n "${workflow_node_temp:-}" && "$workflow_node_temp" == "$workflow_node_parent/.node-v24.18.1-linux-x64.tmp."* && -d "$workflow_node_temp" ]]; then
      find -P "$workflow_node_temp" -depth -delete
    fi
  }
  trap cleanup_workflow_node_temp EXIT INT TERM
  mkdir -m 0755 -- "$workflow_node_temp/bin"
  tar -xzf "$workflow_node_archive" -C "$workflow_node_temp/bin" --strip-components=2 'node-v24.18.1-linux-x64/bin/node'
  [[ -f "$workflow_node_temp/bin/node" && ! -L "$workflow_node_temp/bin/node" && "$(stat -c '%h %s' -- "$workflow_node_temp/bin/node")" == "1 $NODE_BINARY_BYTES" ]] || workflow_node_fail "Workflow Node extracted runtime is invalid" || return 1
  [[ "$(sha256sum -- "$workflow_node_temp/bin/node" | awk '{print $1}')" == "$NODE_BINARY_SHA256" ]] || workflow_node_fail "Workflow Node extracted runtime digest is invalid" || return 1
  chown "$owner_uid:$owner_gid" "$workflow_node_temp" "$workflow_node_temp/bin" "$workflow_node_temp/bin/node"
  chmod 0755 "$workflow_node_temp" "$workflow_node_temp/bin"
  chmod 0555 "$workflow_node_temp/bin/node"
  sync -f "$workflow_node_temp/bin/node"
  [[ ! -e "$workflow_node_home" ]] || workflow_node_fail "Workflow Node runtime destination already exists" || return 1
  mv -T -- "$workflow_node_temp" "$workflow_node_home"
  workflow_node_temp=""
  trap - EXIT INT TERM
  sync -f "$workflow_node_parent"
  workflow_node_validate_installed || return 1
  printf '%s\n' "$workflow_node_binary"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  case "${1:-}" in
    preflight) [[ $# -eq 1 ]] || workflow_node_fail "Workflow Node runtime accepts one fixed action"; preflight_workflow_node_runtime ;;
    prepare) [[ $# -eq 1 ]] || workflow_node_fail "Workflow Node runtime accepts one fixed action"; prepare_workflow_node_runtime ;;
    *) workflow_node_fail "Workflow Node runtime action is invalid" ;;
  esac
fi
