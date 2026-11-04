#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

node scripts/sync.js build
docker compose exec n8n n8n import:workflow --input=/workflows/tassimo-price-tracker.json

printf '\nNext steps:\n'
printf '1. Add your Gmail OAuth2 credential to the Gmail Alert node in n8n.\n'
printf '2. Activate the workflow in n8n.\n'
