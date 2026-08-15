#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ $# -eq 2 ]] || { echo "usage: $0 issue|validate|revoke ABSOLUTE_SECRET_FILE" >&2; exit 2; }
exec bash "$script_dir/host-secret-authority.sh" "$1" workflow-review "$2"
