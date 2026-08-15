#!/bin/bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 ABSOLUTE_BASE_COMPOSE ABSOLUTE_PRODUCTION_OVERLAY ABSOLUTE_EVIDENCE_DIRECTORY" >&2
  exit 2
fi
base="$1"
overlay="$2"
evidence="$3"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/workflow-cutover-compose-files.sh"

[[ "$base" == /* && "$overlay" == /* && "$evidence" == /* && -f "$base" && -f "$overlay" ]] || {
  echo "emergency disable paths must be absolute regular files" >&2
  exit 1
}
[[ "$(basename -- "$overlay")" == "compose.workflow-production.yaml" ]] || {
  echo "workflow production overlay is invalid" >&2
  exit 1
}

resolve_workflow_cutover_compose_files "$base" "$overlay" || exit $?
compose_args=()
for compose_file in "${workflow_cutover_compose_files[@]}"; do
  compose_args+=(-f "$compose_file")
done
mkdir -p "$evidence"
disabled_overlay="$evidence/workflow-disabled-identity.yaml"
cat > "$disabled_overlay" <<'EOF'
services:
  identity:
    environment:
      AIHUB_RESOURCE_SUBMISSIONS_ENABLED: "0"
      AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION: "0"
      AIHUB_WORKFLOW_STORE_ENABLED: "0"
      AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED: "0"
      AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED: "0"
      AIHUB_WORKFLOW_STORE_SCHEMA_VERSION: "0"
EOF

# Replace only the production overlay argument. The helper has already fixed the
# base + optional isolated acceptance file set, so named volumes and loopback
# ports stay attached while Identity returns to its disabled base contract.
disabled_args=("${compose_args[@]}")
disabled_args[3]="$disabled_overlay"
docker compose "${disabled_args[@]}" config > "$evidence/workflow-disable-base-compose.yaml"
docker compose "${disabled_args[@]}" up -d --no-build identity
docker compose "${disabled_args[@]}" ps --format json > "$evidence/workflow-disable-status.json"
echo "Workflow and resource-submission capabilities restored to disabled base"
