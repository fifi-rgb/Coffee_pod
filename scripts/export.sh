#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ $# -lt 1 || -z "${1:-}" ]]; then
  printf 'Usage: %s <workflow-id>\n' "$0" >&2
  exit 1
fi

ID="$1"
docker compose exec n8n n8n export:workflow --id="$ID" --pretty --output=/workflows/tassimo-price-tracker.json
node scripts/sync.js extract
node scripts/sync.js build
