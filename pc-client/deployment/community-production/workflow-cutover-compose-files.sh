#!/bin/bash

workflow_cutover_approved_owner() {
  if [[ "${EUID:-$(id -u)}" == "0" && -n "${SUDO_UID:-}" && -n "${SUDO_GID:-}" ]]; then
    printf '%s:%s\n' "$SUDO_UID" "$SUDO_GID"
  elif [[ "${EUID:-$(id -u)}" == "0" ]]; then
    printf '%s\n' '0:0'
  else
    id -u | tr -d '\n'
    printf ':'
    id -g
  fi
}

workflow_cutover_validate_compose_file() {
  local candidate="$1"
  local approved_owner="$2"
  local mode owner links canonical
  [[ "$candidate" == /* && -f "$candidate" && ! -L "$candidate" ]] || {
    echo "isolated acceptance compose input must be an absolute regular non-symlink file" >&2
    return 1
  }
  canonical="$(realpath -e -- "$candidate")" || return 1
  [[ "$candidate" == "$canonical" ]] || {
    echo "isolated acceptance compose input must already be canonical" >&2
    return 1
  }
  mode="$(stat -c '%a' -- "$candidate")"
  owner="$(stat -c '%u:%g' -- "$candidate")"
  links="$(stat -c '%h' -- "$candidate")"
  [[ "$owner" == "$approved_owner" && "$links" == "1" ]] || {
    echo "isolated acceptance compose input owner or link count is invalid" >&2
    return 1
  }
  (( (8#$mode & 8#22) == 0 )) || {
    echo "isolated acceptance compose input must not be group or other writable" >&2
    return 1
  }
}

# Sets workflow_cutover_compose_files. The list is never expanded by a shell;
# consumers turn it directly into a docker compose argv array.
resolve_workflow_cutover_compose_files() {
  local base="$1"
  local overlay="$2"
  local acceptance_mode="${AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE:-0}"
  local list="${AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES:-}"
  local root="${AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT:-}"
  local approved_owner entry canonical_root canonical_entry basename
  local -a entries=()
  local windows_seen=0 ports_seen=0 caddy_seen=0

  workflow_cutover_compose_files=()
  approved_owner="$(workflow_cutover_approved_owner)"
  workflow_cutover_validate_compose_file "$base" "$approved_owner" || return 1
  workflow_cutover_validate_compose_file "$overlay" "$approved_owner" || return 1

  case "$acceptance_mode" in
    0)
      [[ ! -v AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES &&
         ! -v AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT ]] || {
        echo "production cutover forbids isolated acceptance compose inputs" >&2
        return 1
      }
      workflow_cutover_compose_files=("$base" "$overlay")
      return 0
      ;;
    1)
      ;;
    *)
      echo "isolated acceptance mode must be 0 or 1" >&2
      return 1
      ;;
  esac

  [[ -v AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES &&
     -v AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT &&
     -n "$list" && -n "$root" ]] || {
    echo "isolated acceptance requires a compose list and compose root" >&2
    return 1
  }
  workflow_cutover_validate_compose_file "$list" "$approved_owner" || return 1
  [[ "$root" == /* && -d "$root" && ! -L "$root" ]] || {
    echo "isolated acceptance compose root must be an absolute non-symlink directory" >&2
    return 1
  }
  canonical_root="$(realpath -e -- "$root")" || return 1
  [[ "$root" == "$canonical_root" ]] || {
    echo "isolated acceptance compose root must already be canonical" >&2
    return 1
  }
  if LC_ALL=C tr -d '\n' < "$list" | LC_ALL=C grep -q '[^ -~]'; then
    echo "isolated acceptance compose list contains control characters" >&2
    return 1
  fi
  mapfile -t entries < "$list"
  [[ "${#entries[@]}" == "5" && -n "${entries[0]:-}" && -n "${entries[1]:-}" ]] || {
    echo "isolated acceptance compose list must contain exactly five files" >&2
    return 1
  }
  [[ "${entries[0]}" == "$base" && "${entries[1]}" == "$overlay" ]] || {
    echo "isolated acceptance compose list must begin with the exact base and production overlay" >&2
    return 1
  }
  [[ "$(basename -- "${entries[2]}")" == "compose.windows-acceptance.yaml" &&
     "$(basename -- "${entries[3]}")" == "ports.override.yaml" &&
     "$(basename -- "${entries[4]}")" == "caddy.override.yaml" ]] || {
    echo "isolated acceptance compose overrides are not in canonical order" >&2
    return 1
  }

  for entry in "${entries[@]}"; do
    [[ -n "$entry" && ! "$entry" =~ [[:cntrl:]] ]] || {
      echo "isolated acceptance compose list entry is invalid" >&2
      return 1
    }
    workflow_cutover_validate_compose_file "$entry" "$approved_owner" || return 1
  done
  for entry in "${entries[@]:2}"; do
    canonical_entry="$(realpath -e -- "$entry")" || return 1
    [[ "$canonical_entry" == "$canonical_root"/* ]] || {
      echo "isolated acceptance compose override is outside the approved root" >&2
      return 1
    }
    basename="$(basename -- "$entry")"
    case "$basename" in
      compose.windows-acceptance.yaml) (( windows_seen == 0 )) || { echo "isolated acceptance compose override is duplicated" >&2; return 1; }; windows_seen=1 ;;
      ports.override.yaml) (( ports_seen == 0 )) || { echo "isolated acceptance compose override is duplicated" >&2; return 1; }; ports_seen=1 ;;
      caddy.override.yaml) (( caddy_seen == 0 )) || { echo "isolated acceptance compose override is duplicated" >&2; return 1; }; caddy_seen=1 ;;
      *) echo "isolated acceptance compose override basename is not approved" >&2; return 1 ;;
    esac
  done
  (( windows_seen == 1 && ports_seen == 1 && caddy_seen == 1 )) || {
    echo "isolated acceptance compose list must include each approved override once" >&2
    return 1
  }
  workflow_cutover_compose_files=("${entries[@]}")
}
