#!/bin/bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: $0 ABSOLUTE_BASE_COMPOSE ABSOLUTE_PRODUCTION_OVERLAY ABSOLUTE_VERIFIED_BACKUP apply|verify|rollback" >&2
  exit 2
fi

base="$1"
overlay="$2"
backup="$3"
action="$4"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/workflow-cutover-compose-files.sh"

for value in "$base" "$overlay" "$backup"; do
  [[ "$value" == /* ]] || { echo "production workflow backup directory must be absolute" >&2; exit 1; }
done
[[ -f "$base" && -f "$overlay" ]] || { echo "production workflow migration compose is missing" >&2; exit 1; }
resolve_workflow_cutover_compose_files "$base" "$overlay"
compose_args=()
for compose_file in "${workflow_cutover_compose_files[@]}"; do
  compose_args+=(-f "$compose_file")
done
[[ -f "$backup/SHA256SUMS" && -f "$backup/identity.pgdump" && -f "$backup/community.sql" ]] || {
  echo "verified database backup is missing" >&2
  exit 1
}
case "$action" in apply|verify|rollback) ;; *) echo "production workflow migration action is invalid" >&2; exit 1 ;; esac
(cd "$backup" && sha256sum -c SHA256SUMS)

if [[ "$action" == "rollback" ]]; then
  event_state="$(docker compose "${compose_args[@]}" exec -T identity-database psql -U aihub -d aihub -Atqc \
    "SELECT CASE WHEN to_regclass('community_workflow.events') IS NULL THEN 'absent' ELSE (xpath('/row/count/text()', query_to_xml('SELECT count(*) AS count FROM community_workflow.events', false, true, '')))[1]::text END" | tr -d '[:space:]')"
  if [[ "$event_state" == "absent" ]]; then
    echo "production workflow migration was not applied; rollback is a no-op" >&2
    exit 0
  fi
  [[ "$event_state" =~ ^[0-9]+$ ]] || {
    echo "production workflow migration rollback state check failed" >&2
    exit 1
  }
  [[ "$event_state" == "0" ]] || {
    echo "production workflow migration refuses rollback after Workflow events; restore the verified database backup instead" >&2
    exit 1
  }
fi

bash "$script_dir/run-workflow-migration.sh" "$base" "$overlay" "$backup" "$action"
