#!/bin/bash

# This affects only the cutover script's local, read-only probes. It is not a
# Compose, Caddy, Identity, or application configuration input.
resolve_workflow_cutover_admin_origin() {
  local acceptance_mode="${AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE:-0}"
  local override_is_set="${AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_ORIGIN+x}"
  local candidate="${AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_ORIGIN:-}"
  local port

  case "$acceptance_mode" in
    0)
      [[ -z "$override_is_set" ]] || {
        echo "production cutover forbids an acceptance Admin origin override" >&2
        return 1
      }
      printf '%s\n' 'http://127.0.0.1:4173'
      return 0
      ;;
    1)
      ;;
    *)
      echo "isolated acceptance mode must be 0 or 1" >&2
      return 1
      ;;
  esac

  [[ -n "$override_is_set" && -n "$candidate" && ! "$candidate" =~ [[:cntrl:]] ]] || {
    echo "isolated acceptance requires a non-empty control-character-free Admin origin" >&2
    return 1
  }
  [[ "$candidate" =~ ^http://127\.0\.0\.1:([1-9][0-9]{3,4})$ ]] || {
    echo "isolated acceptance Admin origin must be an exact loopback root origin" >&2
    return 1
  }
  port="${BASH_REMATCH[1]}"
  (( 10#$port >= 1024 && 10#$port <= 65535 )) || {
    echo "isolated acceptance Admin origin port must be 1024 through 65535" >&2
    return 1
  }
  printf '%s\n' "$candidate"
}
