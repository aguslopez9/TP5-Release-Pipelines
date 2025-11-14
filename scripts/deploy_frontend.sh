#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"

if [[ -z "$ENVIRONMENT" ]]; then
  echo "Usage: deploy_frontend.sh <environment>"
  exit 1
fi

if [[ -z "${FRONTEND_TOKEN:-}" ]]; then
  echo "FRONTEND_TOKEN no definido"
  exit 1
fi

if [[ -z "${FRONTEND_SITE_ID:-}" ]]; then
  echo "FRONTEND_SITE_ID no definido"
  exit 1
fi

echo "Desplegando frontend en ${ENVIRONMENT}"

rm -f frontend.zip
(
  cd frontend
  zip -rq ../frontend.zip .
)

curl -sSf -X POST \
  -H "Authorization: Bearer ${FRONTEND_TOKEN}" \
  -F "site_id=${FRONTEND_SITE_ID}" \
  -F "environment=${ENVIRONMENT}" \
  -F "artifact=@frontend.zip" \
  "${FRONTEND_DEPLOY_ENDPOINT:-https://example.com/frontend/deploy}"

echo "Frontend desplegado correctamente"

