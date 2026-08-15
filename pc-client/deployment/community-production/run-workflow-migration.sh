#!/bin/bash
set -euo pipefail

if [[ $# -eq 3 ]]; then
  compose_file="$1"
  backup="$2"
  action="$3"
  compose_args=(-f "$compose_file")
elif [[ $# -eq 4 ]]; then
  base="$1"
  overlay="$2"
  backup="$3"
  action="$4"
  compose_file="$base"
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "$script_dir/workflow-cutover-compose-files.sh"
  resolve_workflow_cutover_compose_files "$base" "$overlay"
  compose_args=()
  for compose_file in "${workflow_cutover_compose_files[@]}"; do
    compose_args+=(-f "$compose_file")
  done
else
  echo "usage: run-workflow-migration.sh ABSOLUTE_BASE_COMPOSE [ABSOLUTE_PRODUCTION_OVERLAY] VERIFIED_BACKUP_DIRECTORY apply|verify|rollback" >&2
  exit 2
fi

case "$compose_file" in /*) ;; *) echo "compose file must be absolute" >&2; exit 1 ;; esac
case "$backup" in /*) ;; *) echo "backup directory must be absolute" >&2; exit 1 ;; esac
case "$action" in apply|verify|rollback) ;; *) echo "workflow migration action is invalid" >&2; exit 1 ;; esac

[[ -f "$compose_file" ]] || { echo "compose file is missing" >&2; exit 1; }
[[ -f "$backup/SHA256SUMS" && -f "$backup/identity.pgdump" && -f "$backup/community.sql" ]] || {
  echo "verified database backup is missing" >&2
  exit 1
}
(cd "$backup" && sha256sum -c SHA256SUMS)

AIHUB_WORKFLOW_MIGRATION_MODE="$action" \
  docker compose "${compose_args[@]}" --profile workflow-migration run --rm \
    -e AIHUB_WORKFLOW_MIGRATION_MODE="$action" workflow-migrate
