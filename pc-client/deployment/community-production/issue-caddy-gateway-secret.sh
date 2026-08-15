#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ $# -eq 1 ]] || { echo "usage: $0 ABSOLUTE_SECRET_FILE" >&2; exit 2; }
exec bash "$script_dir/host-secret-authority.sh" issue caddy-gateway "$1"
