#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"

if [[ -z "$ENVIRONMENT" ]]; then
  echo "Usage: deploy_backend.sh <environment>"
  exit 1
fi

if [[ -z "${BACKEND_TOKEN:-}" ]]; then
  echo "BACKEND_TOKEN no definido"
  exit 1
fi

if [[ -z "${BACKEND_SERVICE_ID:-}" ]]; then
  echo "BACKEND_SERVICE_ID no definido"
  exit 1
fi

echo "Desplegando backend en ${ENVIRONMENT}"

rm -f backend.zip
(
  cd backend
  zip -rq ../backend.zip .
)

curl -sSf -X POST \
  -H "Authorization: Bearer ${BACKEND_TOKEN}" \
  -F "service_id=${BACKEND_SERVICE_ID}" \
  -F "environment=${ENVIRONMENT}" \
  -F "artifact=@backend.zip" \
  "${BACKEND_DEPLOY_ENDPOINT:-https://example.com/backend/deploy}"

echo "Backend desplegado correctamente"

